// ─────────────────────────────────────────────────────────
// WhatsApp Linked Devices (Baileys) — MULTI-ACCOUNT.
// Link several WhatsApp Business numbers (one per consultant).
// Each number = its own session + its own CRM channel; chats
// auto-assign to the channel's consultant.
//
// Works like WhatsApp Web: scan QR from the WA Business app
// (Linked Devices → Link a device). Sessions persist on disk:
//   <dataDir>/wa_auth           → legacy/default session
//   <dataDir>/wa_auth/<id>      → additional sessions
// ─────────────────────────────────────────────────────────
import { join } from 'path';
import { mkdirSync, rmSync, existsSync, readdirSync } from 'fs';

let QRCode = null; // lazy-loaded — dependency installed at deploy time
async function getQRCode() {
  if (!QRCode) { try { QRCode = (await import('qrcode')).default; } catch { /* optional */ } }
  return QRCode;
}

let baileysLib = null;
async function getBaileys() {
  if (baileysLib) return baileysLib;
  let mod;
  try { mod = await import('baileys'); }
  catch { throw new Error('WhatsApp library (baileys) is not installed on the server. Run npm install.'); }
  const lib = mod.default && mod.default.makeWASocket ? mod.default : mod;
  baileysLib = {
    makeWASocket: lib.makeWASocket || mod.default,
    useMultiFileAuthState: lib.useMultiFileAuthState,
    DisconnectReason: lib.DisconnectReason,
    fetchLatestBaileysVersion: lib.fetchLatestBaileysVersion,
    jidNormalizedUser: lib.jidNormalizedUser,
  };
  if (typeof baileysLib.makeWASocket !== 'function' || typeof baileysLib.useMultiFileAuthState !== 'function') {
    baileysLib = null;
    throw new Error('Incompatible baileys version (missing exports).');
  }
  return baileysLib;
}

const mgr = {
  deps: null,
  rootDir: null,               // <dataDir>/wa_auth
  sessions: new Map(),         // id → session
};

function log(...a) { console.log('[wa-linked]', ...a); }

const pnidFor = (id) => id === 'default' ? 'linked_device' : `linked_device_${id}`;
const authDirFor = (id) => id === 'default' ? mgr.rootDir : join(mgr.rootDir, id);

function newSession(id, { label, consultant } = {}) {
  const s = {
    id,
    label: label || (id === 'default' ? 'WhatsApp (Linked Device)' : `WhatsApp ${id}`),
    consultant: consultant || null,
    sock: null,
    status: 'disconnected',    // disconnected | connecting | qr | connected
    qrDataUrl: null,
    me: null,
    lastError: null,
    startedAt: null,
    reconnectTimer: null,
    history: { chats: 0, messages: 0 },
  };
  mgr.sessions.set(id, s);
  return s;
}

// Channel row for a session — chats route to channel.consultant automatically
function getSessionChannel(s) {
  const { db } = mgr.deps;
  const pnid = pnidFor(s.id);
  let ch = db.prepare("SELECT * FROM channels WHERE type='whatsapp' AND phone_number_id=?").get(pnid);
  if (!ch) {
    db.prepare(`INSERT INTO channels (type, name, phone_number_id, status, color) VALUES ('whatsapp', ?, ?, 'active', '#25D366')`)
      .run(s.label, pnid);
    ch = db.prepare("SELECT * FROM channels WHERE type='whatsapp' AND phone_number_id=?").get(pnid);
    log('Created channel for session', s.id, '→ channel', ch?.id);
  }
  // Keep channel name/consultant in sync with session settings
  try {
    if (s.label && ch.name !== s.label) db.prepare("UPDATE channels SET name=? WHERE id=?").run(s.label, ch.id);
    if (s.consultant !== undefined && s.consultant !== null && ch.consultant !== s.consultant) {
      db.prepare("UPDATE channels SET consultant=? WHERE id=?").run(s.consultant, ch.id);
    }
  } catch {}
  return db.prepare("SELECT * FROM channels WHERE id=?").get(ch.id);
}

function classify(message) {
  if (!message) return { type: 'text', content: null };
  if (message.ephemeralMessage?.message) return classify(message.ephemeralMessage.message);
  if (message.viewOnceMessage?.message) return classify(message.viewOnceMessage.message);
  if (message.documentWithCaptionMessage?.message) return classify(message.documentWithCaptionMessage.message);
  if (message.editedMessage?.message) return classify(message.editedMessage.message);
  if (message.conversation) return { type: 'text', content: message.conversation };
  if (message.extendedTextMessage) return { type: 'text', content: message.extendedTextMessage.text };
  if (message.imageMessage) return { type: 'image', content: '[Image]', caption: message.imageMessage.caption || null };
  if (message.videoMessage) return { type: 'video', content: '[Video]', caption: message.videoMessage.caption || null };
  if (message.audioMessage) return { type: 'audio', content: '[Voice Message]' };
  if (message.documentMessage) return { type: 'document', content: `[Document: ${message.documentMessage.fileName || ''}]` };
  if (message.stickerMessage) return { type: 'sticker', content: '[Sticker]' };
  if (message.locationMessage) return { type: 'location', content: `📍 Location: ${message.locationMessage.degreesLatitude},${message.locationMessage.degreesLongitude}` };
  if (message.contactMessage) return { type: 'contact', content: `[Contact: ${message.contactMessage.displayName || ''}]` };
  if (message.buttonsResponseMessage) return { type: 'text', content: message.buttonsResponseMessage.selectedButtonId || message.buttonsResponseMessage.selectedDisplayText };
  if (message.interactiveResponseMessage) return { type: 'text', content: message.interactiveResponseMessage.nativeFlowResponseMessage?.paramsJson || '[Interactive Response]' };
  if (message.templateButtonReplyMessage) return { type: 'text', content: message.templateButtonReplyMessage.selectedId || '[Button Click]' };
  const key = Object.keys(message)[0];
  return { type: 'text', content: key ? `[${key.replace('Message', '')}]` : null };
}

// CTWA ad-referral info (Click-to-WhatsApp ads)
function extractAdReferral(message) {
  if (!message) return null;
  const inner = message.ephemeralMessage?.message || message.viewOnceMessage?.message || message;
  const ctx = inner.extendedTextMessage?.contextInfo
    || inner.imageMessage?.contextInfo
    || inner.videoMessage?.contextInfo
    || null;
  const ad = ctx?.externalAdReply;
  if (!ad) return null;
  return {
    ad_id: ad.sourceId || null,
    source_id: ad.sourceId || null,
    headline: ad.title || null,
    ad_title: ad.title || null,
    body: ad.body || null,
    source_url: ad.sourceUrl || null,
    source_type: ad.sourceType || 'ad',
    ctwa_clid: ad.ctwaClid || ctx?.ctwaClid || null,
  };
}

const phoneFromJid = (jid) => String(jid || '').split('@')[0].split(':')[0].replace(/\D/g, '');
const isPersonalChat = (jid) => {
  if (typeof jid !== 'string' || !jid) return false;
  if (jid.endsWith('@g.us') || jid.endsWith('@broadcast') || jid.startsWith('status@')) return false;
  return true;
};

async function handleIncoming(s, msg, { fromHistory = false } = {}) {
  const { db, upsertContact, upsertConversation, createLeadFromReferral, saveInboundMessage } = mgr.deps;
  try {
    const jid = baileysLib?.jidNormalizedUser ? baileysLib.jidNormalizedUser(msg.key.remoteJid) : msg.key.remoteJid;
    if (!isPersonalChat(jid)) return;                 // skip groups, broadcast, status
    if (msg.key.fromMe) return handleOutgoingEcho(s, msg, jid, fromHistory);
    const phone = phoneFromJid(jid);
    if (!phone) return;

    const { type, content, caption } = classify(msg.message);
    if (!content) return;

    const name = msg.pushName || phone;
    const channel = getSessionChannel(s);
    const contact = upsertContact({ name, phone, wa_id: phone });
    const conv = upsertConversation(contact.id, channel.id, 'whatsapp');

    // CTWA ad referral → lead with ad attribution + ctwa_clid
    const referral = extractAdReferral(msg.message);
    if (referral && !contact.lead_id) {
      createLeadFromReferral({ contact, channel, referralData: referral, sourcePlatform: 'whatsapp' });
      const updated = db.prepare('SELECT lead_id FROM contacts WHERE id=?').get(contact.id);
      if (updated) contact.lead_id = updated.lead_id;
    }
    // Organic messages: lead auto-created inside saveInboundMessage → saveMessage
    // (every WhatsApp number becomes a lead, deduped by phone, fires CAPI 'Lead').

    const exists = msg.key.id ? db.prepare('SELECT id FROM messages WHERE wa_message_id=?').get(msg.key.id) : null;
    if (exists) return;

    saveInboundMessage(conv.id, content, type, msg.key.id || null, null, caption || null);
    if (!fromHistory) log(`📥 [${s.label}] ${name} (${phone}): ${String(content).slice(0, 50)}`);
  } catch (e) {
    console.error('[wa-linked] handleIncoming error:', e.message);
  }
}

function handleOutgoingEcho(s, msg, jid, fromHistory) {
  const { db, upsertContact, upsertConversation, broadcast } = mgr.deps;
  try {
    const phone = phoneFromJid(jid);
    if (!phone) return;
    const { type, content, caption } = classify(msg.message);
    if (!content) return;
    const exists = msg.key.id ? db.prepare('SELECT id FROM messages WHERE wa_message_id=?').get(msg.key.id) : null;
    if (exists) return;
    const channel = getSessionChannel(s);
    const contact = upsertContact({ name: phone, phone, wa_id: phone });
    const conv = upsertConversation(contact.id, channel.id, 'whatsapp');
    const info = db.prepare(`INSERT INTO messages (conversation_id,direction,type,content,caption,wa_message_id,status,sent_by) VALUES (?,?,?,?,?,?,?,?)`)
      .run(conv.id, 'out', type, content, caption || null, msg.key.id || null, 'sent', s.consultant || 'WhatsApp App');
    db.prepare("UPDATE conversations SET last_message=?, last_message_at=datetime('now') WHERE id=?").run(content, conv.id);
    if (!fromHistory && broadcast) {
      const saved = db.prepare('SELECT * FROM messages WHERE id=?').get(info.lastInsertRowid);
      broadcast('new_message', { ...saved, conversation_id: conv.id, direction: 'outbound' });
    }
  } catch (e) {
    console.error('[wa-linked] outgoing echo error:', e.message);
  }
}

async function handleHistorySet(s, { chats = [], contacts = [], messages = [] }) {
  const { upsertContact, upsertConversation } = mgr.deps;
  try {
    const channel = getSessionChannel(s);
    const nameByJid = {};
    for (const c of contacts) if (c.id && (c.name || c.notify)) nameByJid[c.id] = c.name || c.notify;
    let chatCount = 0;
    for (const chat of chats) {
      if (!isPersonalChat(chat.id)) continue;
      const phone = phoneFromJid(chat.id);
      if (!phone) continue;
      const contact = upsertContact({ name: chat.name || nameByJid[chat.id] || phone, phone, wa_id: phone });
      upsertConversation(contact.id, channel.id, 'whatsapp');
      chatCount++;
    }
    let msgCount = 0;
    for (const m of messages.slice(-1500)) { await handleIncoming(s, m, { fromHistory: true }); msgCount++; }
    s.history.chats += chatCount;
    s.history.messages += msgCount;
    log(`📚 [${s.label}] history sync: ${chatCount} chats, ${msgCount} messages`);
  } catch (e) {
    console.error('[wa-linked] history sync error:', e.message);
  }
}

async function startSocket(s) {
  const B = await getBaileys();
  const dir = authDirFor(s.id);
  mkdirSync(dir, { recursive: true });
  const { state: authState, saveCreds } = await B.useMultiFileAuthState(dir);
  let version;
  try { ({ version } = await B.fetchLatestBaileysVersion()); } catch { version = undefined; }

  s.status = 'connecting';
  s.lastError = null;

  const sock = B.makeWASocket({
    version,
    auth: authState,
    printQRInTerminal: false,
    syncFullHistory: false,
    markOnlineOnConnect: false,
    browser: ['EduExpress CRM', 'Chrome', '1.0.0'],
  });
  s.sock = sock;

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (u) => {
    const { connection, lastDisconnect, qr } = u;
    if (qr) {
      s.status = 'qr';
      try {
        const qrlib = await getQRCode();
        if (qrlib) s.qrDataUrl = await qrlib.toDataURL(qr, { width: 300, margin: 1 });
      } catch {}
    }
    if (connection === 'open') {
      s.status = 'connected';
      s.qrDataUrl = null;
      s.startedAt = new Date().toISOString();
      s.me = { id: phoneFromJid(sock.user?.id), name: sock.user?.name || null };
      log(`✅ [${s.label}] connected as`, s.me.id);
      getSessionChannel(s);
    }
    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      const loggedOut = code === (B.DisconnectReason?.loggedOut ?? 401);
      s.status = 'disconnected';
      s.sock = null;
      s.lastError = lastDisconnect?.error?.message || null;
      if (loggedOut) {
        log(`[${s.label}] logged out from phone — clearing session.`);
        try { clearAuthDir(s.id); } catch {}
        s.me = null;
        return;
      }
      log(`[${s.label}] connection closed (${code}) — reconnecting in 5s`);
      clearTimeout(s.reconnectTimer);
      s.reconnectTimer = setTimeout(() => startSocket(s).catch(e => {
        s.lastError = e.message; s.status = 'disconnected';
      }), 5000);
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    if (!Array.isArray(messages)) return;
    for (const m of messages) await handleIncoming(s, m);
  });

  sock.ev.on('messaging-history.set', (h) => handleHistorySet(s, h));
  return sock;
}

function clearAuthDir(id) {
  const dir = authDirFor(id);
  if (id === 'default') {
    // root dir also holds sub-session dirs — only remove default's own files
    try {
      for (const f of readdirSync(dir)) {
        const p = join(dir, f);
        if (f.endsWith('.json')) rmSync(p, { force: true });
      }
    } catch {}
  } else {
    rmSync(dir, { recursive: true, force: true });
  }
}

const hasCreds = (id) => existsSync(join(authDirFor(id), 'creds.json'));

// ── Public API ────────────────────────────────────────────
export function initWaLinked(deps) {
  mgr.deps = deps;
  mgr.rootDir = deps.authDir || join(deps.dataDir || process.cwd(), 'wa_auth');
  mkdirSync(mgr.rootDir, { recursive: true });

  // Discover sessions from existing channels (linked_device / linked_device_<id>)
  try {
    const rows = deps.db.prepare("SELECT * FROM channels WHERE type='whatsapp' AND phone_number_id LIKE 'linked_device%'").all();
    for (const ch of rows) {
      const id = ch.phone_number_id === 'linked_device' ? 'default' : ch.phone_number_id.replace('linked_device_', '');
      if (!mgr.sessions.has(id)) newSession(id, { label: ch.name, consultant: ch.consultant || null });
    }
  } catch (e) { console.error('[wa-linked] session discovery failed:', e.message); }

  // Also discover orphan auth dirs (creds without channel rows)
  try {
    if (hasCreds('default') && !mgr.sessions.has('default')) newSession('default');
    for (const f of readdirSync(mgr.rootDir, { withFileTypes: true })) {
      if (f.isDirectory() && hasCreds(f.name) && !mgr.sessions.has(f.name)) newSession(f.name);
    }
  } catch {}

  // Auto-reconnect sessions that have saved credentials
  for (const s of mgr.sessions.values()) {
    if (hasCreds(s.id)) {
      log(`[${s.label}] existing session found — reconnecting…`);
      startSocket(s).catch(e => { s.lastError = e.message; s.status = 'disconnected'; });
    }
  }
  log(`initialised with ${mgr.sessions.size} session(s)`);
}

export async function connectWaLinked({ id, label, consultant } = {}) {
  let s;
  if (id && mgr.sessions.has(id)) {
    s = mgr.sessions.get(id);
    if (label) s.label = label;
    if (consultant !== undefined) s.consultant = consultant;
  } else if (!id && mgr.sessions.size === 0) {
    s = newSession('default', { label, consultant });
  } else {
    const newId = id || `wa${Date.now().toString(36)}`;
    s = newSession(newId, { label, consultant });
  }
  getSessionChannel(s); // ensure channel exists with label/consultant
  if (s.status === 'connected' || s.status === 'connecting' || s.status === 'qr') return sessionInfo(s);
  await startSocket(s);
  return sessionInfo(s);
}

export async function logoutWaLinked(id) {
  const s = id ? mgr.sessions.get(id) : mgr.sessions.get('default');
  if (!s) return { ok: false, error: 'Session not found' };
  try { await s.sock?.logout?.(); } catch {}
  try { s.sock?.end?.(); } catch {}
  clearTimeout(s.reconnectTimer);
  s.sock = null; s.me = null;
  s.status = 'disconnected'; s.qrDataUrl = null;
  try { clearAuthDir(s.id); } catch {}
  if (s.id !== 'default') mgr.sessions.delete(s.id);
  return { ok: true };
}

function sessionInfo(s) {
  return {
    id: s.id,
    label: s.label,
    consultant: s.consultant,
    status: s.status,
    qr: s.qrDataUrl,
    me: s.me,
    connected_since: s.startedAt,
    last_error: s.lastError,
    history: s.history,
  };
}

export function getWaLinkedStatus() {
  const sessions = [...mgr.sessions.values()].map(sessionInfo);
  const first = sessions[0] || null;
  return {
    sessions,
    connected_count: sessions.filter(x => x.status === 'connected').length,
    // Back-compat single-session fields (first session)
    status: first?.status || 'disconnected',
    qr: first?.qr || null,
    me: first?.me || null,
    connected_since: first?.connected_since || null,
    last_error: first?.last_error || null,
    history: first?.history || { chats: 0, messages: 0 },
  };
}

export function isWaLinkedConnected() {
  return [...mgr.sessions.values()].some(s => s.status === 'connected' && s.sock);
}

// Send via a specific channel's session (pnid = channels.phone_number_id), or any connected one
export async function sendWaLinkedMessage(to, text, mediaUrl = null, type = 'text', pnid = null) {
  let s = null;
  if (pnid) {
    const id = pnid === 'linked_device' ? 'default' : String(pnid).replace('linked_device_', '');
    s = mgr.sessions.get(id);
  }
  if (!s || s.status !== 'connected' || !s.sock) {
    s = [...mgr.sessions.values()].find(x => x.status === 'connected' && x.sock) || null;
  }
  if (!s) throw new Error('No WhatsApp linked device is connected');
  const phone = String(to).replace(/\D/g, '');
  if (!phone) throw new Error('Invalid recipient phone');
  const jid = `${phone}@s.whatsapp.net`;
  let payload;
  if (mediaUrl && type === 'image') payload = { image: { url: mediaUrl }, caption: text || undefined };
  else if (mediaUrl && type === 'document') payload = { document: { url: mediaUrl }, caption: text || undefined, fileName: text || 'document' };
  else payload = { text: String(text ?? '') };
  const result = await s.sock.sendMessage(jid, payload);
  return { messages: [{ id: result?.key?.id || null }], linked_device: true, session: s.id };
}
