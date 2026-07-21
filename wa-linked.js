// ─────────────────────────────────────────────────────────
// WhatsApp Linked Device (Baileys) — no Meta App / Cloud API needed.
// Works like WhatsApp Web: scan QR from the WA Business app
// (Linked Devices → Link a device). Session persists on disk.
//
// Feeds the SAME pipeline as the Cloud API webhook:
//   upsertContact → upsertConversation → saveInboundMessage
//   + auto-lead creation (CTWA ad referral aware, with ctwa_clid)
//   + CAPI Lead events fired by the lead-creation helpers.
// ─────────────────────────────────────────────────────────
import { join } from 'path';
import { mkdirSync, rmSync, existsSync } from 'fs';

let QRCode = null; // lazy-loaded — dependency installed at deploy time
async function getQRCode() {
  if (!QRCode) { try { QRCode = (await import('qrcode')).default; } catch { /* optional */ } }
  return QRCode;
}

let makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, jidNormalizedUser;

const state = {
  sock: null,
  status: 'disconnected',   // disconnected | connecting | qr | connected
  qrDataUrl: null,
  qrString: null,
  me: null,                 // { id, name }
  lastError: null,
  startedAt: null,
  reconnectTimer: null,
  historyImported: { chats: 0, messages: 0 },
  deps: null,
  authDir: null,
};

function log(...a) { console.log('[wa-linked]', ...a); }

// Get or create the CRM "channel" row representing the linked device
function getLinkedChannel(db) {
  let ch = db.prepare("SELECT * FROM channels WHERE type='whatsapp' AND phone_number_id='linked_device'").get();
  if (!ch) {
    db.prepare(`INSERT INTO channels (type, name, phone_number_id, status, color) VALUES ('whatsapp', 'WhatsApp (Linked Device)', 'linked_device', 'active', '#25D366')`).run();
    ch = db.prepare("SELECT * FROM channels WHERE type='whatsapp' AND phone_number_id='linked_device'").get();
    log('Created linked-device channel id', ch?.id);
  }
  return ch;
}

function classify(message) {
  if (!message) return { type: 'text', content: null };
  if (message.ephemeralMessage?.message) return classify(message.ephemeralMessage.message);
  if (message.viewOnceMessage?.message) return classify(message.viewOnceMessage.message);
  if (message.conversation) return { type: 'text', content: message.conversation };
  if (message.extendedTextMessage) return { type: 'text', content: message.extendedTextMessage.text };
  if (message.imageMessage) return { type: 'image', content: '[Image]', caption: message.imageMessage.caption || null };
  if (message.videoMessage) return { type: 'video', content: '[Video]', caption: message.videoMessage.caption || null };
  if (message.audioMessage) return { type: 'audio', content: '[Voice Message]' };
  if (message.documentMessage) return { type: 'document', content: `[Document: ${message.documentMessage.fileName || ''}]` };
  if (message.stickerMessage) return { type: 'sticker', content: '[Sticker]' };
  if (message.locationMessage) return { type: 'location', content: `📍 Location: ${message.locationMessage.degreesLatitude},${message.locationMessage.degreesLongitude}` };
  if (message.contactMessage) return { type: 'contact', content: `[Contact: ${message.contactMessage.displayName || ''}]` };
  const key = Object.keys(message)[0];
  return { type: 'text', content: key ? `[${key.replace('Message', '')}]` : null };
}

// Pull CTWA ad-referral info out of a Baileys message (Click-to-WhatsApp ads)
function extractAdReferral(message) {
  if (!message) return null;
  const inner = message.ephemeralMessage?.message || message.viewOnceMessage?.message || message;
  const ctx = inner.extendedTextMessage?.contextInfo
    || inner.imageMessage?.contextInfo
    || inner.videoMessage?.contextInfo
    || inner.conversationContextInfo
    || null;
  const ad = ctx?.externalAdReply;
  if (!ad) return null;
  const ctwa_clid = ad.ctwaClid || ctx?.ctwaClid || null;
  return {
    ad_id: ad.sourceId || null,
    source_id: ad.sourceId || null,
    headline: ad.title || null,
    ad_title: ad.title || null,
    body: ad.body || null,
    source_url: ad.sourceUrl || null,
    source_type: ad.sourceType || 'ad',
    ctwa_clid,
  };
}

function phoneFromJid(jid) {
  return String(jid || '').split('@')[0].split(':')[0].replace(/\D/g, '');
}

function isPersonalChat(jid) {
  return typeof jid === 'string' && jid.endsWith('@s.whatsapp.net');
}

async function handleIncoming(msg, { fromHistory = false } = {}) {
  const { db, upsertContact, upsertConversation, createLeadFromReferral, createLeadFromContact, saveInboundMessage, getConfig } = state.deps;
  try {
    const jid = jidNormalizedUser ? jidNormalizedUser(msg.key.remoteJid) : msg.key.remoteJid;
    if (!isPersonalChat(jid)) return;                 // skip groups, broadcast, status
    if (msg.key.fromMe) return handleOutgoingEcho(msg, jid, fromHistory);
    const phone = phoneFromJid(jid);
    if (!phone) return;

    const { type, content, caption } = classify(msg.message);
    if (!content) return;

    const name = msg.pushName || phone;
    const channel = getLinkedChannel(db);
    const contact = upsertContact({ name, phone, wa_id: phone });
    const conv = upsertConversation(contact.id, channel.id, 'whatsapp');

    // ── CTWA ad referral → auto-create lead with ad attribution ──
    const referral = extractAdReferral(msg.message);
    if (referral && !contact.lead_id) {
      const lead = createLeadFromReferral({ contact, channel, referralData: referral, sourcePlatform: 'whatsapp' });
      if (lead && referral.ctwa_clid) {
        try { db.prepare('UPDATE leads SET ctwa_clid=? WHERE id=?').run(referral.ctwa_clid, lead.id); } catch {}
      }
      const updated = db.prepare('SELECT lead_id FROM contacts WHERE id=?').get(contact.id);
      if (updated) contact.lead_id = updated.lead_id;
    }

    // ── Organic first message → auto-create lead (toggleable) ──
    if (!referral && !contact.lead_id && !fromHistory) {
      const autoLead = (getConfig('wa_linked_auto_lead') ?? '1') !== '0';
      if (autoLead) {
        createLeadFromContact(contact.id, 'whatsapp', content, null, {});
      }
    }

    // Dedup by WhatsApp message id (also protects on reconnect replays)
    const exists = msg.key.id ? db.prepare('SELECT id FROM messages WHERE wa_message_id=?').get(msg.key.id) : null;
    if (exists) return;

    saveInboundMessage(conv.id, content, type, msg.key.id || null, null, caption || null);
    if (!fromHistory) log(`📥 ${name} (${phone}): ${String(content).slice(0, 60)}`);
  } catch (e) {
    console.error('[wa-linked] handleIncoming error:', e.message);
  }
}

// Messages you (or a colleague on the phone) sent — mirror them into the CRM
function handleOutgoingEcho(msg, jid, fromHistory) {
  const { db, upsertContact, upsertConversation, broadcast } = state.deps;
  try {
    const phone = phoneFromJid(jid);
    if (!phone) return;
    const { type, content, caption } = classify(msg.message);
    if (!content) return;
    const exists = msg.key.id ? db.prepare('SELECT id FROM messages WHERE wa_message_id=?').get(msg.key.id) : null;
    if (exists) return;
    const channel = getLinkedChannel(db);
    const contact = upsertContact({ name: phone, phone, wa_id: phone });
    const conv = upsertConversation(contact.id, channel.id, 'whatsapp');
    const info = db.prepare(`INSERT INTO messages (conversation_id,direction,type,content,caption,wa_message_id,status,sent_by) VALUES (?,?,?,?,?,?,?,?)`)
      .run(conv.id, 'out', type, content, caption || null, msg.key.id || null, 'sent', 'WhatsApp App');
    db.prepare("UPDATE conversations SET last_message=?, last_message_at=datetime('now') WHERE id=?").run(content, conv.id);
    if (!fromHistory && broadcast) {
      const saved = db.prepare('SELECT * FROM messages WHERE id=?').get(info.lastInsertRowid);
      broadcast('new_message', { ...saved, conversation_id: conv.id, direction: 'outbound' });
    }
  } catch (e) {
    console.error('[wa-linked] outgoing echo error:', e.message);
  }
}

// First link: WhatsApp pushes chat history — import it so the whole inbox appears in CRM
async function handleHistorySet({ chats = [], contacts = [], messages = [] }) {
  const { db, upsertContact, upsertConversation } = state.deps;
  try {
    const channel = getLinkedChannel(db);
    const nameByJid = {};
    for (const c of contacts) {
      if (c.id && (c.name || c.notify)) nameByJid[c.id] = c.name || c.notify;
    }
    let chatCount = 0;
    for (const chat of chats) {
      if (!isPersonalChat(chat.id)) continue;
      const phone = phoneFromJid(chat.id);
      if (!phone) continue;
      const name = chat.name || nameByJid[chat.id] || phone;
      const contact = upsertContact({ name, phone, wa_id: phone });
      upsertConversation(contact.id, channel.id, 'whatsapp');
      chatCount++;
    }
    // Import messages (bounded — history sync can be huge)
    let msgCount = 0;
    for (const m of messages.slice(-1500)) {
      await handleIncoming(m, { fromHistory: true });
      msgCount++;
    }
    state.historyImported.chats += chatCount;
    state.historyImported.messages += msgCount;
    log(`📚 History sync: ${chatCount} chats, ${msgCount} messages imported`);
  } catch (e) {
    console.error('[wa-linked] history sync error:', e.message);
  }
}

async function startSocket() {
  const baileys = await import('baileys');
  const lib = baileys.default && baileys.default.makeWASocket ? baileys.default : baileys;
  makeWASocket = lib.makeWASocket || baileys.default;
  useMultiFileAuthState = lib.useMultiFileAuthState;
  DisconnectReason = lib.DisconnectReason;
  fetchLatestBaileysVersion = lib.fetchLatestBaileysVersion;
  jidNormalizedUser = lib.jidNormalizedUser;

  mkdirSync(state.authDir, { recursive: true });
  const { state: authState, saveCreds } = await useMultiFileAuthState(state.authDir);
  let version;
  try { ({ version } = await fetchLatestBaileysVersion()); } catch { version = undefined; }

  state.status = 'connecting';
  state.lastError = null;

  const sock = makeWASocket({
    version,
    auth: authState,
    printQRInTerminal: false,
    syncFullHistory: false,          // recent history only — keeps first sync fast
    markOnlineOnConnect: false,      // don't steal notifications from the phone
    browser: ['EduExpress CRM', 'Chrome', '1.0.0'],
  });
  state.sock = sock;

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (u) => {
    const { connection, lastDisconnect, qr } = u;
    if (qr) {
      state.status = 'qr';
      state.qrString = qr;
      try {
        const qrlib = await getQRCode();
        if (qrlib) state.qrDataUrl = await qrlib.toDataURL(qr, { width: 300, margin: 1 });
      } catch {}
    }
    if (connection === 'open') {
      state.status = 'connected';
      state.qrDataUrl = null; state.qrString = null;
      state.startedAt = new Date().toISOString();
      state.me = { id: phoneFromJid(sock.user?.id), name: sock.user?.name || null };
      log('✅ Connected as', state.me.id);
      getLinkedChannel(state.deps.db);
    }
    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      const loggedOut = code === (DisconnectReason?.loggedOut ?? 401);
      state.status = 'disconnected';
      state.sock = null;
      state.lastError = lastDisconnect?.error?.message || null;
      if (loggedOut) {
        log('Logged out from phone — clearing session.');
        try { rmSync(state.authDir, { recursive: true, force: true }); } catch {}
        state.me = null;
        return; // wait for user to reconnect via UI
      }
      log('Connection closed (code ' + code + ') — reconnecting in 5s');
      clearTimeout(state.reconnectTimer);
      state.reconnectTimer = setTimeout(() => startSocket().catch(e => {
        state.lastError = e.message; state.status = 'disconnected';
      }), 5000);
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify' && type !== 'append') return;
    for (const m of messages) await handleIncoming(m);
  });

  sock.ev.on('messaging-history.set', handleHistorySet);

  return sock;
}

// ── Public API ────────────────────────────────────────────
export function initWaLinked(deps) {
  state.deps = deps;
  state.authDir = deps.authDir || join(deps.dataDir || '.', 'wa_auth');
  // Auto-start only if a session already exists (server restart / redeploy)
  if (existsSync(join(state.authDir, 'creds.json'))) {
    log('Existing session found — reconnecting…');
    startSocket().catch(e => { state.lastError = e.message; state.status = 'disconnected'; });
  }
}

export async function connectWaLinked() {
  if (state.status === 'connected' || state.status === 'connecting' || state.status === 'qr') return getWaLinkedStatus();
  await startSocket();
  return getWaLinkedStatus();
}

export async function logoutWaLinked() {
  try { await state.sock?.logout?.(); } catch {}
  try { state.sock?.end?.(); } catch {}
  clearTimeout(state.reconnectTimer);
  state.sock = null; state.me = null;
  state.status = 'disconnected'; state.qrDataUrl = null; state.qrString = null;
  try { rmSync(state.authDir, { recursive: true, force: true }); } catch {}
  return { ok: true };
}

export function getWaLinkedStatus() {
  return {
    status: state.status,
    qr: state.qrDataUrl,
    me: state.me,
    connected_since: state.startedAt,
    last_error: state.lastError,
    history: state.historyImported,
  };
}

export function isWaLinkedConnected() {
  return state.status === 'connected' && !!state.sock;
}

export async function sendWaLinkedMessage(to, text, mediaUrl = null, type = 'text') {
  if (!isWaLinkedConnected()) throw new Error('WhatsApp linked device is not connected');
  const phone = String(to).replace(/\D/g, '');
  if (!phone) throw new Error('Invalid recipient phone');
  const jid = `${phone}@s.whatsapp.net`;
  let payload;
  if (mediaUrl && type === 'image') payload = { image: { url: mediaUrl }, caption: text || undefined };
  else if (mediaUrl && type === 'document') payload = { document: { url: mediaUrl }, caption: text || undefined, fileName: text || 'document' };
  else payload = { text: String(text ?? '') };
  const result = await state.sock.sendMessage(jid, payload);
  return { messages: [{ id: result?.key?.id || null }], linked_device: true };
}
