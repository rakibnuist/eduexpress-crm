import express from 'express';
import cors from 'cors';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { initDatabase } from './sqldb.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;
const DB_PATH = process.env.DB_PATH || join(__dirname, 'crm.db');

const app = express();
app.use(cors());
app.use(express.json());

// Serve React build in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(join(__dirname, 'dist')));
}

// ── DB state — routes use `db` by reference ────────────────
let db = null;
let dbReady = false;

// Health check — always responds (lets Hostinger know we're alive)
app.get('/health', (_req, res) => res.json({ status: dbReady ? 'ready' : 'starting' }));

// Block all API calls until DB is ready
app.use((req, res, next) => {
  if (!dbReady && req.path.startsWith('/api')) {
    return res.status(503).json({ error: 'Server is starting up, please retry in a few seconds.' });
  }
  next();
});

// Start HTTP server IMMEDIATELY so Hostinger health check passes
app.listen(PORT, () => console.log(`🚀 CRM + Messaging API → http://localhost:${PORT}`));

// ── Init DB async in background ────────────────────────────
(async () => {
  try {
    console.log('[startup] Loading database...');
    db = await initDatabase(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    setupSchema();
    runMigrations();
    seedData();
    dbReady = true;
    console.log('[startup] Database ready ✅');
  } catch (e) {
    console.error('[startup] DB init failed:', e.message);
    process.exit(1);
  }
})();

// Graceful shutdown — flush DB before exit
process.on('SIGTERM', () => { if (db) db.flush(); process.exit(0); });
process.on('SIGINT',  () => { if (db) db.flush(); process.exit(0); });

// ─────────────────────────────────────────────────────────
// SCHEMA / MIGRATIONS / SEED  (called after DB ready)
// ─────────────────────────────────────────────────────────
function setupSchema() { db.exec(`
  CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id TEXT UNIQUE,
    date_added TEXT,
    client_name TEXT,
    phone TEXT,
    email TEXT,
    destination TEXT,
    last_education TEXT,
    gpa REAL,
    english_score TEXT,
    program TEXT,
    lead_source TEXT,
    lead_status TEXT DEFAULT 'New Lead',
    assigned_consultant TEXT,
    service_fee REAL DEFAULT 0,
    paid REAL DEFAULT 0,
    balance REAL DEFAULT 0,
    payment_status TEXT,
    next_followup TEXT,
    notes TEXT,
    meta_lead_id TEXT,
    meta_form_id TEXT,
    meta_ad_id TEXT,
    meta_campaign TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS income (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT, month TEXT, category TEXT, lead_id TEXT,
    client_name TEXT, reference TEXT, amount REAL DEFAULT 0, notes TEXT
  );

  CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT, month TEXT, category TEXT, paid_to TEXT,
    reference TEXT, amount REAL DEFAULT 0, notes TEXT
  );

  CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    emp_id TEXT, name TEXT, role TEXT, email TEXT, phone TEXT,
    device_id TEXT, salary REAL DEFAULT 0, active TEXT DEFAULT 'Yes',
    join_date TEXT
  );

  CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    emp_id TEXT, name TEXT, date TEXT,
    check_in TEXT, check_out TEXT, hours_worked REAL,
    status TEXT DEFAULT 'Present', device_id TEXT, ssid TEXT,
    source TEXT DEFAULT 'manual', notes TEXT
  );

  CREATE TABLE IF NOT EXISTS kpi_targets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    consultant TEXT NOT NULL, month TEXT NOT NULL,
    target_leads INTEGER DEFAULT 0,
    target_enrolled INTEGER DEFAULT 0,
    target_revenue REAL DEFAULT 0,
    UNIQUE(consultant, month)
  );

  CREATE TABLE IF NOT EXISTS meta_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE, value TEXT
  );

  -- ── MESSAGING ──────────────────────────────────────────

  CREATE TABLE IF NOT EXISTS channels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    phone_number_id TEXT,
    waba_id TEXT,
    page_id TEXT,
    ig_account_id TEXT,
    access_token TEXT,
    webhook_verify_token TEXT DEFAULT 'eduexpress_verify_2024',
    status TEXT DEFAULT 'active',
    color TEXT DEFAULT '#3b82f6',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    phone TEXT,
    email TEXT,
    wa_id TEXT UNIQUE,
    messenger_id TEXT,
    instagram_id TEXT,
    lead_id INTEGER REFERENCES leads(id) ON DELETE SET NULL,
    avatar_url TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contact_id INTEGER REFERENCES contacts(id),
    channel_id INTEGER REFERENCES channels(id),
    channel_type TEXT,
    status TEXT DEFAULT 'open',
    assigned_to TEXT,
    unread_count INTEGER DEFAULT 0,
    last_message TEXT,
    last_message_at TEXT,
    lead_id INTEGER REFERENCES leads(id) ON DELETE SET NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
    direction TEXT NOT NULL,
    type TEXT DEFAULT 'text',
    content TEXT,
    media_url TEXT,
    media_mime TEXT,
    caption TEXT,
    wa_message_id TEXT UNIQUE,
    status TEXT DEFAULT 'sent',
    sent_by TEXT,
    error_msg TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS quick_replies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_leads_status       ON leads(lead_status);
  CREATE INDEX IF NOT EXISTS idx_leads_consultant   ON leads(assigned_consultant);
  CREATE INDEX IF NOT EXISTS idx_attendance_emp     ON attendance(emp_id, date);
  CREATE INDEX IF NOT EXISTS idx_messages_conv      ON messages(conversation_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_conv_contact       ON conversations(contact_id);
  CREATE INDEX IF NOT EXISTS idx_conv_status        ON conversations(status, last_message_at);
`); }

function runMigrations() {
  const migrations = [
    `ALTER TABLE attendance ADD COLUMN check_in TEXT`,
    `ALTER TABLE attendance ADD COLUMN check_out TEXT`,
    `ALTER TABLE attendance ADD COLUMN hours_worked REAL`,
    `ALTER TABLE attendance ADD COLUMN source TEXT DEFAULT 'manual'`,
    `ALTER TABLE attendance ADD COLUMN notes TEXT`,
    `ALTER TABLE employees  ADD COLUMN join_date TEXT`,
    `ALTER TABLE leads      ADD COLUMN meta_lead_id TEXT`,
    `ALTER TABLE leads      ADD COLUMN meta_form_id TEXT`,
    `ALTER TABLE leads      ADD COLUMN meta_ad_id TEXT`,
    `ALTER TABLE leads      ADD COLUMN meta_campaign TEXT`,
    `ALTER TABLE channels   ADD COLUMN active INTEGER DEFAULT 1`,
    `ALTER TABLE channels   ADD COLUMN consultant TEXT`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_wa_id ON messages(wa_message_id)`,
  ];
  migrations.forEach(m => { try { db.exec(m); } catch {} });
}

function seedData() {
  const seedFile = join(__dirname, 'seed_data.json');
  if (existsSync(seedFile) && db.prepare('SELECT COUNT(*) as c FROM leads').get().c === 0) {
    const seed = JSON.parse(readFileSync(seedFile, 'utf8'));
    const insertLead = db.prepare(`INSERT OR IGNORE INTO leads
      (lead_id,date_added,client_name,phone,email,destination,last_education,gpa,english_score,program,lead_source,lead_status,assigned_consultant,service_fee,paid,balance,payment_status,next_followup,notes)
      VALUES (@lead_id,@date_added,@client_name,@phone,@email,@destination,@last_education,@gpa,@english_score,@program,@lead_source,@lead_status,@assigned_consultant,@service_fee,@paid,@balance,@payment_status,@next_followup,@notes)`);
    const txn = db.transaction(leads => leads.forEach(l => {
      if (l.lead_id) insertLead.run({ ...l, phone: String(l.phone || ''), service_fee: l.service_fee || 0, paid: l.paid || 0, balance: l.balance || 0 });
    }));
    txn(seed.leads);
    const insertEmp = db.prepare(`INSERT INTO employees (emp_id,name,role,email,phone,device_id,salary,active) VALUES (@emp_id,@name,@role,@email,@phone,@device_id,@salary,@active)`);
    seed.employees.filter(e => e.name).forEach(e => insertEmp.run({ ...e, salary: e.salary || 0, active: e.active || 'Yes' }));
    const insertAttn = db.prepare(`INSERT INTO attendance (emp_id,name,date,check_in,status,device_id,ssid,source) VALUES (@emp_id,@name,@date,@check_in,@status,@device_id,@ssid,@source)`);
    seed.attendance.forEach(a => insertAttn.run({ emp_id: a.emp_id, name: a.name, date: a.date?.slice(0,10), check_in: a.time, status: a.status, device_id: a.device_id, ssid: a.ssid, source: 'wifi' }));
    console.log('✅ Seeded from Excel');
  }
  if (db.prepare('SELECT COUNT(*) as c FROM quick_replies').get().c === 0) {
    const qr = db.prepare(`INSERT INTO quick_replies (title,content,category) VALUES (?,?,?)`);
    [
      ['Greeting', 'Hello! Thank you for reaching out to EduExpress International. How can we help you today? 🎓', 'greetings'],
      ['China Info', 'We offer MBBS, BSc Engineering, and MBA programs in China. Tuition starts from ৳2.5 lakh. Would you like details?', 'info'],
      ['Georgia Info', 'Georgia offers EU-recognized medical degrees at very affordable costs. Reply YES for a brochure!', 'info'],
      ['Office Visit', 'Great! Please visit our office at Dhaka. Our consultants are available Sun–Thu, 11AM–6PM. 📍', 'appointment'],
      ['Documents', 'Please bring: SSC/HSC certificates, NID/passport copy, 2 photos. Anything else you need?', 'documents'],
      ['Follow Up', "Hi! This is a follow-up from EduExpress. Have you had a chance to consider our programs? We're here to help! 😊", 'followup'],
      ['Not Available', 'Sorry, our office is closed right now. We will get back to you during business hours (11AM–6PM). Thank you!', 'auto'],
    ].forEach(([t, c, cat]) => qr.run(t, c, cat));
  }
}

// ─────────────────────────────────────────────────────────
// SSE REAL-TIME BROADCAST
// ─────────────────────────────────────────────────────────
const sseClients = new Map();

app.get('/api/events', (req, res) => {
  // Critical for Nginx/Hostinger — disables proxy buffering so events flow instantly
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('X-Accel-Buffering', 'no');   // ← disables nginx buffering
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.flushHeaders();

  const id = Date.now() + Math.random();
  sseClients.set(id, res);
  // Send connected confirmation
  res.write(`data: ${JSON.stringify({ type: 'connected', id })}\n\n`);
  // Force flush immediately
  if (typeof res.flush === 'function') res.flush();

  // Keepalive ping every 20s (SSE comment, minimal overhead)
  const ping = setInterval(() => {
    try {
      res.write(`: ping\n\n`);
      if (typeof res.flush === 'function') res.flush();
    } catch { clearInterval(ping); sseClients.delete(id); }
  }, 20000);

  req.on('close', () => { clearInterval(ping); sseClients.delete(id); });
});

function broadcast(type, data) {
  const msg = `data: ${JSON.stringify({ type, ...data })}\n\n`;
  sseClients.forEach((client, id) => {
    try {
      client.write(msg);
      // Force flush past Nginx proxy buffer immediately
      if (typeof client.flush === 'function') client.flush();
    } catch {
      sseClients.delete(id);
    }
  });
}

// ─────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────
function nextLeadId() {
  const row = db.prepare("SELECT lead_id FROM leads WHERE lead_id LIKE 'L-%' ORDER BY CAST(SUBSTR(lead_id,3) AS INTEGER) DESC LIMIT 1").get();
  return 'L-' + String(parseInt((row?.lead_id || 'L-00000').replace('L-', '')) + 1).padStart(5, '0');
}

function getConfig(key) {
  return db.prepare("SELECT value FROM meta_config WHERE key=?").get(key)?.value || null;
}

function upsertContact({ name, phone, wa_id, messenger_id, instagram_id, email }) {
  const existing = wa_id
    ? db.prepare("SELECT * FROM contacts WHERE wa_id=?").get(wa_id)
    : messenger_id
    ? db.prepare("SELECT * FROM contacts WHERE messenger_id=?").get(messenger_id)
    : instagram_id
    ? db.prepare("SELECT * FROM contacts WHERE instagram_id=?").get(instagram_id)
    : phone ? db.prepare("SELECT * FROM contacts WHERE phone=?").get(phone) : null;

  if (existing) {
    if (name && !existing.name) db.prepare("UPDATE contacts SET name=? WHERE id=?").run(name, existing.id);
    return existing;
  }
  const info = db.prepare(`INSERT INTO contacts (name,phone,email,wa_id,messenger_id,instagram_id) VALUES (?,?,?,?,?,?)`)
    .run(name || 'Unknown', phone || null, email || null, wa_id || null, messenger_id || null, instagram_id || null);
  return db.prepare("SELECT * FROM contacts WHERE id=?").get(info.lastInsertRowid);
}

function upsertConversation(contactId, channelId, channelType) {
  const existing = db.prepare("SELECT * FROM conversations WHERE contact_id=? AND channel_id=? AND status != 'resolved'").get(contactId, channelId);
  if (existing) return existing;
  const info = db.prepare(`INSERT INTO conversations (contact_id,channel_id,channel_type,status) VALUES (?,?,?,'open')`).run(contactId, channelId, channelType);
  return db.prepare("SELECT * FROM conversations WHERE id=?").get(info.lastInsertRowid);
}

function saveInboundMessage(convId, content, type = 'text', waMessageId = null, mediaUrl = null, caption = null) {
  try {
    const info = db.prepare(`INSERT INTO messages (conversation_id,direction,type,content,wa_message_id,media_url,caption,status)
      VALUES (?,?,?,?,?,?,?,'delivered')`).run(convId, 'in', type, content, waMessageId, mediaUrl, caption);
    const msg = db.prepare("SELECT * FROM messages WHERE id=?").get(info.lastInsertRowid);
    db.prepare("UPDATE conversations SET last_message=?, last_message_at=datetime('now'), unread_count=unread_count+1 WHERE id=?").run(content || `[${type}]`, convId);
    const conv = db.prepare("SELECT conversations.*, contacts.name as contact_name, contacts.phone as contact_phone, channels.name as channel_name, channels.type as channel_type FROM conversations LEFT JOIN contacts ON contacts.id=conversations.contact_id LEFT JOIN channels ON channels.id=conversations.channel_id WHERE conversations.id=?").get(convId);
    broadcast('new_message', {
      ...msg,
      conversation_id: convId,
      direction: 'inbound',
      contact_name: conv?.contact_name,
      channel_type: conv?.channel_type,
    });
    return msg;
  } catch (e) {
    if (!e.message.includes('UNIQUE')) console.error('saveInboundMessage:', e.message);
    return null;
  }
}

async function sendWhatsApp(channel, to, text) {
  const url = `https://graph.facebook.com/v19.0/${channel.phone_number_id}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${channel.access_token}` },
    body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body: text } })
  });
  return res.json();
}

async function sendMessenger(channel, recipientId, text) {
  const url = `https://graph.facebook.com/v19.0/${channel.page_id}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${channel.access_token}` },
    body: JSON.stringify({ recipient: { id: recipientId }, message: { text }, messaging_type: 'RESPONSE' })
  });
  return res.json();
}

async function sendCAPIEvent(eventName, leadData) {
  const pixelId = getConfig('pixel_id');
  const accessToken = getConfig('capi_token');
  if (!pixelId || !accessToken) return { skipped: true };
  const payload = {
    data: [{
      event_name: eventName,
      event_time: Math.floor(Date.now() / 1000),
      action_source: 'crm',
      user_data: {
        ph: leadData.phone ? [leadData.phone.replace(/\D/g, '')] : undefined,
        em: leadData.email ? [leadData.email.toLowerCase()] : undefined,
        country: ['bd'],
      },
      custom_data: { lead_id: leadData.lead_id, destination: leadData.destination },
    }],
  };
  const clean = o => {
    if (typeof o !== 'object' || !o) return o;
    if (Array.isArray(o)) return o.filter(v => v !== undefined).map(clean);
    return Object.fromEntries(Object.entries(o).filter(([,v]) => v !== undefined).map(([k,v]) => [k, clean(v)]));
  };
  try {
    const res = await fetch(`https://graph.facebook.com/v19.0/${pixelId}/events?access_token=${accessToken}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(clean(payload))
    });
    return res.json();
  } catch (e) { return { error: e.message }; }
}

// ─────────────────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────────────────
app.get('/api/dashboard', (req, res) => {
  const pipeline     = db.prepare("SELECT lead_status, COUNT(*) as count FROM leads GROUP BY lead_status").all();
  const total        = db.prepare("SELECT COUNT(*) as c FROM leads").get().c;
  const today        = new Date().toISOString().slice(0, 10);
  const followupToday= db.prepare("SELECT COUNT(*) as c FROM leads WHERE next_followup=?").get(today).c;
  const recentLeads  = db.prepare("SELECT * FROM leads ORDER BY id DESC LIMIT 5").all();
  const totalPaid    = db.prepare("SELECT SUM(paid) as s FROM leads").get().s || 0;
  const metaLeads    = db.prepare("SELECT COUNT(*) as c FROM leads WHERE meta_lead_id IS NOT NULL").get().c;
  const openConvs    = db.prepare("SELECT COUNT(*) as c FROM conversations WHERE status='open'").get().c;
  const unreadMsgs   = db.prepare("SELECT SUM(unread_count) as s FROM conversations").get().s || 0;
  res.json({ pipeline, total, followupToday, recentLeads, totalPaid, metaLeads, openConvs, unreadMsgs });
});

// ─────────────────────────────────────────────────────────
// LEADS
// ─────────────────────────────────────────────────────────
app.get('/api/leads', (req, res) => {
  const { search, status, consultant, destination, source, page = 1, limit = 50 } = req.query;
  const where = []; const params = {};
  if (search) { where.push("(client_name LIKE @search OR phone LIKE @search OR lead_id LIKE @search OR email LIKE @search)"); params.search = `%${search}%`; }
  if (status)      { where.push("lead_status=@status");           params.status = status; }
  if (consultant)  { where.push("assigned_consultant=@consultant");params.consultant = consultant; }
  if (destination) { where.push("destination=@destination");      params.destination = destination; }
  if (source === 'meta') where.push("meta_lead_id IS NOT NULL");
  const ws = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const total  = db.prepare(`SELECT COUNT(*) as c FROM leads ${ws}`).get(params).c;
  const leads  = db.prepare(`SELECT * FROM leads ${ws} ORDER BY id DESC LIMIT ${limit} OFFSET ${offset}`).all(params);
  res.json({ leads, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
});
app.get('/api/leads/:id', (req, res) => {
  const lead = db.prepare("SELECT * FROM leads WHERE id=? OR lead_id=?").get(req.params.id, req.params.id);
  if (!lead) return res.status(404).json({ error: 'Not found' });
  res.json(lead);
});
app.post('/api/leads', async (req, res) => {
  const d = req.body;
  const lead_id = d.lead_id || nextLeadId();
  const balance = (parseFloat(d.service_fee)||0) - (parseFloat(d.paid)||0);
  const info = db.prepare(`INSERT INTO leads (lead_id,date_added,client_name,phone,email,destination,last_education,gpa,english_score,program,lead_source,lead_status,assigned_consultant,service_fee,paid,balance,payment_status,next_followup,notes,meta_lead_id,meta_form_id,meta_ad_id,meta_campaign)
    VALUES (@lead_id,@date_added,@client_name,@phone,@email,@destination,@last_education,@gpa,@english_score,@program,@lead_source,@lead_status,@assigned_consultant,@service_fee,@paid,@balance,@payment_status,@next_followup,@notes,@meta_lead_id,@meta_form_id,@meta_ad_id,@meta_campaign)`)
    .run({ lead_id, date_added: d.date_added||new Date().toISOString().slice(0,10), client_name: d.client_name, phone: d.phone, email: d.email, destination: d.destination, last_education: d.last_education, gpa: d.gpa, english_score: d.english_score, program: d.program, lead_source: d.lead_source||'Manual', lead_status: d.lead_status||'New Lead', assigned_consultant: d.assigned_consultant, service_fee: d.service_fee||0, paid: d.paid||0, balance, payment_status: d.payment_status, next_followup: d.next_followup, notes: d.notes, meta_lead_id: d.meta_lead_id||null, meta_form_id: d.meta_form_id||null, meta_ad_id: d.meta_ad_id||null, meta_campaign: d.meta_campaign||null });
  const lead = db.prepare("SELECT * FROM leads WHERE id=?").get(info.lastInsertRowid);
  sendCAPIEvent('Lead', lead);
  res.json(lead);
});
app.put('/api/leads/:id', async (req, res) => {
  const d = req.body;
  const old = db.prepare("SELECT lead_status FROM leads WHERE id=?").get(req.params.id);
  const balance = (parseFloat(d.service_fee)||0) - (parseFloat(d.paid)||0);
  db.prepare(`UPDATE leads SET client_name=@client_name,phone=@phone,email=@email,destination=@destination,last_education=@last_education,gpa=@gpa,english_score=@english_score,program=@program,lead_source=@lead_source,lead_status=@lead_status,assigned_consultant=@assigned_consultant,service_fee=@service_fee,paid=@paid,balance=@balance,payment_status=@payment_status,next_followup=@next_followup,notes=@notes WHERE id=@id`).run({ ...d, id: req.params.id, balance });
  const lead = db.prepare("SELECT * FROM leads WHERE id=?").get(req.params.id);
  if (old?.lead_status !== d.lead_status) {
    const evtMap = { 'Enrolled':'Purchase','File Opened':'InitiateCheckout','Office Visited':'Schedule','Positive':'Lead' };
    if (evtMap[d.lead_status]) sendCAPIEvent(evtMap[d.lead_status], lead);
  }
  res.json(lead);
});
app.delete('/api/leads/:id', (req, res) => { db.prepare("DELETE FROM leads WHERE id=?").run(req.params.id); res.json({ ok: true }); });

// ─────────────────────────────────────────────────────────
// FINANCE
// ─────────────────────────────────────────────────────────
app.get('/api/income', (req, res) => {
  const { month, page=1, limit=50 } = req.query;
  const w = month ? `WHERE month='${month}'` : '';
  const sum = db.prepare(`SELECT SUM(amount) as s FROM income ${w}`).get().s || 0;
  const total = db.prepare(`SELECT COUNT(*) as c FROM income ${w}`).get().c;
  const rows = db.prepare(`SELECT * FROM income ${w} ORDER BY date DESC LIMIT ${limit} OFFSET ${(page-1)*limit}`).all();
  res.json({ rows, total, sum, page: parseInt(page), pages: Math.ceil(total/limit) });
});
app.post('/api/income', (req, res) => {
  const d = req.body; const month = d.date?.slice(0,7)||null;
  const info = db.prepare(`INSERT INTO income (date,month,category,lead_id,client_name,reference,amount,notes) VALUES (@date,@month,@category,@lead_id,@client_name,@reference,@amount,@notes)`).run({ ...d, month, amount: d.amount||0 });
  res.json(db.prepare("SELECT * FROM income WHERE id=?").get(info.lastInsertRowid));
});
app.put('/api/income/:id', (req, res) => {
  const d = req.body; const month = d.date?.slice(0,7)||null;
  db.prepare(`UPDATE income SET date=@date,month=@month,category=@category,lead_id=@lead_id,client_name=@client_name,reference=@reference,amount=@amount,notes=@notes WHERE id=@id`).run({ ...d, id: req.params.id, month, amount: d.amount||0 });
  res.json(db.prepare("SELECT * FROM income WHERE id=?").get(req.params.id));
});
app.delete('/api/income/:id', (req, res) => { db.prepare("DELETE FROM income WHERE id=?").run(req.params.id); res.json({ ok:true }); });

app.get('/api/expenses', (req, res) => {
  const { month, page=1, limit=50 } = req.query;
  const w = month ? `WHERE month='${month}'` : '';
  const sum = db.prepare(`SELECT SUM(amount) as s FROM expenses ${w}`).get().s || 0;
  const total = db.prepare(`SELECT COUNT(*) as c FROM expenses ${w}`).get().c;
  const rows = db.prepare(`SELECT * FROM expenses ${w} ORDER BY date DESC LIMIT ${limit} OFFSET ${(page-1)*limit}`).all();
  res.json({ rows, total, sum, page: parseInt(page), pages: Math.ceil(total/limit) });
});
app.post('/api/expenses', (req, res) => {
  const d = req.body; const month = d.date?.slice(0,7)||null;
  const info = db.prepare(`INSERT INTO expenses (date,month,category,paid_to,reference,amount,notes) VALUES (@date,@month,@category,@paid_to,@reference,@amount,@notes)`).run({ ...d, month, amount: d.amount||0 });
  res.json(db.prepare("SELECT * FROM expenses WHERE id=?").get(info.lastInsertRowid));
});
app.put('/api/expenses/:id', (req, res) => {
  const d = req.body; const month = d.date?.slice(0,7)||null;
  db.prepare(`UPDATE expenses SET date=@date,month=@month,category=@category,paid_to=@paid_to,reference=@reference,amount=@amount,notes=@notes WHERE id=@id`).run({ ...d, id: req.params.id, month, amount: d.amount||0 });
  res.json(db.prepare("SELECT * FROM expenses WHERE id=?").get(req.params.id));
});
app.delete('/api/expenses/:id', (req, res) => { db.prepare("DELETE FROM expenses WHERE id=?").run(req.params.id); res.json({ ok:true }); });

app.get('/api/pnl', (req, res) => {
  const months = db.prepare("SELECT DISTINCT month FROM (SELECT month FROM income UNION SELECT month FROM expenses) WHERE month IS NOT NULL ORDER BY month").all().map(r => r.month);
  res.json(months.map(m => {
    const inc = db.prepare("SELECT SUM(amount) as s FROM income WHERE month=?").get(m).s||0;
    const exp = db.prepare("SELECT SUM(amount) as s FROM expenses WHERE month=?").get(m).s||0;
    return { month: m, income: inc, expense: exp, profit: inc-exp, margin: inc>0?((inc-exp)/inc*100).toFixed(1):0 };
  }));
});

// ─────────────────────────────────────────────────────────
// EMPLOYEES / ATTENDANCE / KPI  (unchanged from before)
// ─────────────────────────────────────────────────────────
app.get('/api/employees', (req, res) => res.json(db.prepare("SELECT * FROM employees ORDER BY id").all()));
app.post('/api/employees', (req, res) => {
  const d = req.body;
  const info = db.prepare(`INSERT INTO employees (emp_id,name,role,email,phone,device_id,salary,active,join_date) VALUES (@emp_id,@name,@role,@email,@phone,@device_id,@salary,@active,@join_date)`).run({ ...d, salary: d.salary||0, active: d.active||'Yes', join_date: d.join_date||null });
  res.json(db.prepare("SELECT * FROM employees WHERE id=?").get(info.lastInsertRowid));
});
app.put('/api/employees/:id', (req, res) => {
  const d = req.body;
  db.prepare(`UPDATE employees SET emp_id=@emp_id,name=@name,role=@role,email=@email,phone=@phone,device_id=@device_id,salary=@salary,active=@active,join_date=@join_date WHERE id=@id`).run({ ...d, id: req.params.id, salary: d.salary||0, join_date: d.join_date||null });
  res.json(db.prepare("SELECT * FROM employees WHERE id=?").get(req.params.id));
});
app.delete('/api/employees/:id', (req, res) => { db.prepare("DELETE FROM employees WHERE id=?").run(req.params.id); res.json({ ok:true }); });

app.get('/api/attendance', (req, res) => {
  const { month, emp_id, date } = req.query;
  const where=[]; const params={};
  if (month)  { where.push("date LIKE @month"); params.month=`${month}%`; }
  if (emp_id) { where.push("emp_id=@emp_id");   params.emp_id=emp_id; }
  if (date)   { where.push("date=@date");        params.date=date; }
  const ws = where.length ? 'WHERE '+where.join(' AND ') : '';
  res.json(db.prepare(`SELECT * FROM attendance ${ws} ORDER BY date DESC, check_in DESC`).all(params));
});
app.post('/api/attendance/checkin', (req, res) => {
  const { emp_id, date, time, device_id, ssid, source } = req.body;
  const emp = db.prepare("SELECT * FROM employees WHERE emp_id=?").get(emp_id);
  if (!emp) return res.status(404).json({ error: 'Employee not found' });
  const existing = db.prepare("SELECT * FROM attendance WHERE emp_id=? AND date=?").get(emp_id, date);
  if (existing) return res.status(409).json({ error: 'Already checked in', record: existing });
  const openHHMM = getConfig('office_open')||'11:00', grace = parseInt(getConfig('grace_minutes')||'30');
  const [oh,om] = openHHMM.split(':').map(Number);
  const [ch,cm] = (time||'00:00').split(':').map(Number);
  const status = (ch*60+cm) <= (oh*60+om+grace) ? 'Present' : 'Late';
  const info = db.prepare(`INSERT INTO attendance (emp_id,name,date,check_in,status,device_id,ssid,source) VALUES (?,?,?,?,?,?,?,?)`).run(emp_id, emp.name, date, time, status, device_id||emp.device_id, ssid||'', source||'manual');
  res.json(db.prepare("SELECT * FROM attendance WHERE id=?").get(info.lastInsertRowid));
});
app.put('/api/attendance/:id/checkout', (req, res) => {
  const { time } = req.body;
  const rec = db.prepare("SELECT * FROM attendance WHERE id=?").get(req.params.id);
  if (!rec) return res.status(404).json({ error: 'Not found' });
  let hours_worked = null;
  if (rec.check_in && time) {
    const [ih,im] = rec.check_in.split(':').map(Number);
    const [oh,om] = time.split(':').map(Number);
    hours_worked = Math.max(0, (oh*60+om - (ih*60+im)) / 60);
  }
  db.prepare("UPDATE attendance SET check_out=?,hours_worked=? WHERE id=?").run(time, hours_worked, req.params.id);
  res.json(db.prepare("SELECT * FROM attendance WHERE id=?").get(req.params.id));
});
app.post('/api/attendance', (req, res) => {
  const d = req.body;
  const emp = db.prepare("SELECT * FROM employees WHERE emp_id=?").get(d.emp_id);
  const info = db.prepare(`INSERT INTO attendance (emp_id,name,date,check_in,check_out,hours_worked,status,device_id,ssid,source,notes) VALUES (@emp_id,@name,@date,@check_in,@check_out,@hours_worked,@status,@device_id,@ssid,@source,@notes)`).run({ emp_id: d.emp_id, name: emp?.name||d.name||'', date: d.date, check_in: d.check_in||d.time, check_out: d.check_out||null, hours_worked: d.hours_worked||null, status: d.status||'Present', device_id: d.device_id||'', ssid: d.ssid||'', source: d.source||'manual', notes: d.notes||null });
  res.json(db.prepare("SELECT * FROM attendance WHERE id=?").get(info.lastInsertRowid));
});
app.put('/api/attendance/:id', (req, res) => {
  const d = req.body;
  db.prepare(`UPDATE attendance SET check_in=@check_in,check_out=@check_out,hours_worked=@hours_worked,status=@status,notes=@notes WHERE id=@id`).run({ ...d, id: req.params.id });
  res.json(db.prepare("SELECT * FROM attendance WHERE id=?").get(req.params.id));
});
app.delete('/api/attendance/:id', (req, res) => { db.prepare("DELETE FROM attendance WHERE id=?").run(req.params.id); res.json({ ok:true }); });

app.get('/api/attendance/summary/:month', (req, res) => {
  const { month } = req.params;
  const [y,m] = month.split('-').map(Number);
  const daysInMonth = new Date(y,m,0).getDate();
  let workingDays = 0;
  for (let d=1; d<=daysInMonth; d++) { const dow = new Date(y,m-1,d).getDay(); if (dow!==5&&dow!==6) workingDays++; }
  const employees = db.prepare("SELECT * FROM employees WHERE active='Yes'").all();
  const summary = employees.map(emp => {
    const logs = db.prepare("SELECT * FROM attendance WHERE emp_id=? AND date LIKE ?").all(emp.emp_id, `${month}%`);
    const present = logs.filter(l=>l.status==='Present').length;
    const late    = logs.filter(l=>l.status==='Late').length;
    const absent  = Math.max(0, workingDays-present-late);
    const totalHours = logs.reduce((s,l)=>s+(l.hours_worked||0),0);
    const avgCheckin = logs.filter(l=>l.check_in).map(l=>l.check_in).sort()[Math.floor(logs.length/2)]||null;
    return { ...emp, present, late, absent, workingDays, totalHours: totalHours.toFixed(1), avgCheckin, attendancePct: workingDays>0?Math.round(((present+late)/workingDays)*100):0, logs };
  });
  res.json({ summary, workingDays });
});

app.get('/api/kpi/:month', (req, res) => {
  const { month } = req.params;
  const consultants = db.prepare("SELECT DISTINCT assigned_consultant FROM leads WHERE assigned_consultant IS NOT NULL AND assigned_consultant != ''").all().map(r=>r.assigned_consultant);
  res.json(consultants.map(c => {
    const total = db.prepare("SELECT COUNT(*) as n FROM leads WHERE assigned_consultant=?").get(c).n;
    const thisMonth = db.prepare("SELECT COUNT(*) as n FROM leads WHERE assigned_consultant=? AND (date_added LIKE ? OR created_at LIKE ?)").get(c,`${month}%`,`${month}%`).n;
    const byStatus = Object.fromEntries(db.prepare("SELECT lead_status,COUNT(*) as n FROM leads WHERE assigned_consultant=? GROUP BY lead_status").all(c).map(r=>[r.lead_status,r.n]));
    const revenue  = db.prepare("SELECT SUM(service_fee) as s FROM leads WHERE assigned_consultant=?").get(c).s||0;
    const collected= db.prepare("SELECT SUM(paid) as s FROM leads WHERE assigned_consultant=?").get(c).s||0;
    const target   = db.prepare("SELECT * FROM kpi_targets WHERE consultant=? AND month=?").get(c,month)||{};
    return { consultant:c, total, thisMonth, enrolled:byStatus['Enrolled']||0, fileOpened:byStatus['File Opened']||0, officeVisited:byStatus['Office Visited']||0, positive:byStatus['Positive']||0, notInterested:byStatus['Not Interested']||0, revenue, collected, conversionRate: total>0?((( byStatus['Enrolled']||0)/total)*100).toFixed(1):0, responseRate: total>0?(((total-(byStatus['No Response']||0))/total)*100).toFixed(1):0, target_leads:target.target_leads||0, target_enrolled:target.target_enrolled||0, target_revenue:target.target_revenue||0 };
  }));
});
app.put('/api/kpi/targets', (req, res) => {
  const { consultant, month, target_leads, target_enrolled, target_revenue } = req.body;
  db.prepare(`INSERT INTO kpi_targets (consultant,month,target_leads,target_enrolled,target_revenue) VALUES (?,?,?,?,?) ON CONFLICT(consultant,month) DO UPDATE SET target_leads=excluded.target_leads,target_enrolled=excluded.target_enrolled,target_revenue=excluded.target_revenue`).run(consultant,month,target_leads||0,target_enrolled||0,target_revenue||0);
  res.json({ ok:true });
});

// ─────────────────────────────────────────────────────────
// CHANNELS (WhatsApp accounts, Pages, IG accounts)
// ─────────────────────────────────────────────────────────
app.get('/api/channels', (req, res) => {
  const channels = db.prepare("SELECT * FROM channels ORDER BY id").all();
  // Mask tokens
  res.json(channels.map(c => ({ ...c, access_token: c.access_token ? c.access_token.slice(0,14)+'••••••' : null })));
});

app.post('/api/channels', (req, res) => {
  const d = req.body;
  const info = db.prepare(`INSERT INTO channels (type,name,consultant,phone_number_id,waba_id,page_id,ig_account_id,access_token,webhook_verify_token,status,color,active) VALUES (@type,@name,@consultant,@phone_number_id,@waba_id,@page_id,@ig_account_id,@access_token,@webhook_verify_token,@status,@color,@active)`)
    .run({ type: d.type, name: d.name, consultant: d.consultant||null, phone_number_id: d.phone_number_id||null, waba_id: d.waba_id||null, page_id: d.page_id||null, ig_account_id: d.ig_account_id||null, access_token: d.access_token||null, webhook_verify_token: d.webhook_verify_token||'eduexpress_verify_2024', status: d.status||'active', color: d.color||'#3b82f6', active: d.active ?? 1 });
  res.json(db.prepare("SELECT * FROM channels WHERE id=?").get(info.lastInsertRowid));
});

app.put('/api/channels/:id', (req, res) => {
  const d = req.body;
  const existing = db.prepare("SELECT * FROM channels WHERE id=?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const token = (d.access_token && !d.access_token.includes('••')) ? d.access_token : existing.access_token;
  db.prepare(`UPDATE channels SET type=@type,name=@name,consultant=@consultant,phone_number_id=@phone_number_id,waba_id=@waba_id,page_id=@page_id,ig_account_id=@ig_account_id,access_token=@access_token,webhook_verify_token=@webhook_verify_token,status=@status,color=@color,active=@active WHERE id=@id`)
    .run({ ...d, id: req.params.id, consultant: d.consultant||null, access_token: token, active: d.active ?? existing.active ?? 1 });
  res.json(db.prepare("SELECT * FROM channels WHERE id=?").get(req.params.id));
});

app.delete('/api/channels/:id', (req, res) => { db.prepare("DELETE FROM channels WHERE id=?").run(req.params.id); res.json({ ok:true }); });

// ─── Sync historical messages from a Messenger / Instagram channel ───────────
app.post('/api/channels/:id/sync', async (req, res) => {
  const channel = db.prepare("SELECT * FROM channels WHERE id=?").get(req.params.id);
  if (!channel) return res.status(404).json({ error: 'Channel not found' });
  if (!channel.access_token) return res.status(400).json({ error: 'No access token on this channel' });
  if (channel.type !== 'messenger' && channel.type !== 'instagram')
    return res.status(400).json({ error: 'Sync only supported for Messenger and Instagram channels' });

  const token   = channel.access_token;
  const pageId  = channel.page_id;
  const { months = 6 } = req.body || {};
  const since   = Math.floor(Date.now() / 1000) - (months * 30 * 24 * 3600);

  let imported = 0, skipped = 0, conversations = 0;

  // Fetch one page of FB API results; returns { items, nextUrl }
  async function fbGet(url) {
    const r = await fetch(url);
    const d = await r.json();
    if (d.error) throw new Error(`FB API: ${d.error.message}`);
    return { items: d.data || [], nextUrl: d.paging?.next || null };
  }

  // Pre-prepare statements ONCE — avoids re-compiling SQL in wasm on every row
  const stmtInsertMsg = db.prepare(
    `INSERT OR IGNORE INTO messages
       (conversation_id, direction, type, content, wa_message_id, status, created_at)
     VALUES (?, ?, 'text', ?, ?, 'delivered', ?)`
  );
  const stmtConvUpdate = db.prepare(
    `UPDATE conversations SET last_message=?, last_message_at=?
     WHERE id=? AND (last_message_at IS NULL OR last_message_at < ?)`
  );

  // Batch-insert all messages for one conversation inside a single transaction
  const insertBatch = db.transaction((rows, conv) => {
    let added = 0;
    for (const msg of rows) {
      const fromPage = String(msg.from?.id) === String(pageId);
      const content  = msg.message
        || (msg.attachments?.data?.[0] ? '[Attachment]' : null)
        || (msg.sticker ? '[Sticker]' : null)
        || '[message]';
      const createdAt = msg.created_time
        ? new Date(msg.created_time).toISOString().replace('T', ' ').slice(0, 19)
        : null;

      const result = stmtInsertMsg.run(
        conv.id, fromPage ? 'out' : 'in', content, msg.id, createdAt
      );
      if (result.changes > 0) {
        added++;
        if (createdAt) stmtConvUpdate.run(content, createdAt, conv.id, createdAt);
      }
    }
    return added;
  });

  try {
    // ── Step 1: paginate through ALL conversations ────────────────────────────
    let convUrl = `https://graph.facebook.com/v19.0/${pageId}/conversations`
      + `?fields=participants&limit=100&since=${since}&access_token=${token}`;

    while (convUrl) {
      const { items: fbConvs, nextUrl } = await fbGet(convUrl);
      convUrl = nextUrl;

      for (const fbConv of fbConvs) {
        conversations++;
        const other = (fbConv.participants?.data || []).find(p => String(p.id) !== String(pageId));
        if (!other) continue;

        const contact = upsertContact({ name: other.name || 'Messenger User', messenger_id: other.id });
        const conv    = upsertConversation(contact.id, channel.id, 'messenger');

        // ── Step 2: paginate through ALL messages for this conversation ───────
        let msgUrl = `https://graph.facebook.com/v19.0/${fbConv.id}/messages`
          + `?fields=message,from,created_time,sticker,attachments&limit=100&since=${since}&access_token=${token}`;

        while (msgUrl) {
          const { items: msgs, nextUrl: nextMsgUrl } = await fbGet(msgUrl);
          msgUrl = nextMsgUrl;

          if (msgs.length === 0) break;

          // Insert entire page as one transaction — drastically reduces wasm heap pressure
          const added = insertBatch(msgs, conv);
          imported += added;
          skipped  += msgs.length - added;
        }
      }
    }

    console.log(`[sync] ${channel.name}: ${conversations} convs, ${imported} imported, ${skipped} skipped`);
    res.json({ ok: true, imported, skipped, conversations, channel: channel.name });

  } catch (e) {
    console.error('[sync] error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────────────────
// CONTACTS
// ─────────────────────────────────────────────────────────
app.get('/api/contacts', (req, res) => {
  const { search } = req.query;
  const where = search ? `WHERE name LIKE '%${search}%' OR phone LIKE '%${search}%'` : '';
  res.json(db.prepare(`SELECT contacts.*, leads.lead_status, leads.lead_id as crm_lead_id, leads.destination FROM contacts LEFT JOIN leads ON leads.id=contacts.lead_id ${where} ORDER BY contacts.id DESC LIMIT 100`).all());
});

app.put('/api/contacts/:id', (req, res) => {
  const d = req.body;
  db.prepare(`UPDATE contacts SET name=@name,phone=@phone,email=@email,lead_id=@lead_id WHERE id=@id`).run({ ...d, id: req.params.id });
  res.json(db.prepare("SELECT * FROM contacts WHERE id=?").get(req.params.id));
});

// ─────────────────────────────────────────────────────────
// CONVERSATIONS
// ─────────────────────────────────────────────────────────
const CONV_SELECT = `
  SELECT conversations.*,
    contacts.name  AS contact_name,
    contacts.phone AS contact_phone,
    contacts.wa_id, contacts.messenger_id, contacts.instagram_id,
    contacts.lead_id AS contact_lead_id,
    channels.name  AS channel_name,
    channels.type  AS channel_type,
    channels.color AS channel_color,
    channels.consultant AS channel_consultant,
    channels.phone_number_id
  FROM conversations
  LEFT JOIN contacts  ON contacts.id  = conversations.contact_id
  LEFT JOIN channels  ON channels.id  = conversations.channel_id
`;

app.get('/api/conversations', (req, res) => {
  const { status, channel_type, channel_id, search, page=1, limit=30 } = req.query;
  const where=[]; const params={};
  if (status && status !== 'all') { where.push("conversations.status=@status"); params.status=status; }
  if (channel_type && channel_type !== 'all') { where.push("conversations.channel_type=@channel_type"); params.channel_type=channel_type; }
  if (channel_id && channel_id !== 'all') { where.push("conversations.channel_id=@channel_id"); params.channel_id=channel_id; }
  if (search) { where.push("(contacts.name LIKE @search OR contacts.phone LIKE @search)"); params.search=`%${search}%`; }
  const ws = where.length ? 'WHERE '+where.join(' AND ') : '';
  const total = db.prepare(`SELECT COUNT(*) as c FROM conversations LEFT JOIN contacts ON contacts.id=conversations.contact_id ${ws}`).get(params).c;
  const convs = db.prepare(`${CONV_SELECT} ${ws} ORDER BY conversations.last_message_at DESC LIMIT ${limit} OFFSET ${(page-1)*limit}`).all(params);
  res.json({ conversations: convs, total, page: parseInt(page), pages: Math.ceil(total/limit) });
});

app.get('/api/conversations/:id', (req, res) => {
  const conv = db.prepare(`${CONV_SELECT} WHERE conversations.id=?`).get(req.params.id);
  if (!conv) return res.status(404).json({ error:'Not found' });
  res.json(conv);
});

app.put('/api/conversations/:id', (req, res) => {
  const { status, assigned_to, lead_id } = req.body;
  db.prepare("UPDATE conversations SET status=COALESCE(@status,status), assigned_to=COALESCE(@assigned_to,assigned_to), lead_id=COALESCE(@lead_id,lead_id), unread_count=CASE WHEN @status='open' THEN unread_count ELSE 0 END WHERE id=@id")
    .run({ status: status||null, assigned_to: assigned_to||null, lead_id: lead_id||null, id: req.params.id });
  res.json(db.prepare(`${CONV_SELECT} WHERE conversations.id=?`).get(req.params.id));
});

// Create outbound conversation manually
app.post('/api/conversations', (req, res) => {
  try {
    const { channel_id, phone, name } = req.body;
    if (!channel_id || !phone) return res.status(400).json({ error: 'channel_id and phone required' });
    const channel = db.prepare("SELECT * FROM channels WHERE id=?").get(channel_id);
    if (!channel) return res.status(404).json({ error: 'Channel not found' });
    const contact = upsertContact({ name: name || phone, phone, wa_id: channel.type === 'whatsapp' ? phone : null });
    const conversation = upsertConversation(contact.id, channel_id, channel.type);
    const conv = db.prepare(`${CONV_SELECT} WHERE conversations.id=?`).get(conversation.id);
    res.json(conv);
  } catch(e) {
    console.error('createConversation error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// Mark conversation read
app.post('/api/conversations/:id/read', (req, res) => {
  db.prepare("UPDATE conversations SET unread_count=0 WHERE id=?").run(req.params.id);
  res.json({ ok:true });
});

// Delete an entire conversation (and its messages)
app.delete('/api/conversations/:id', (req, res) => {
  try {
    db.prepare("DELETE FROM messages WHERE conversation_id=?").run(req.params.id);
    db.prepare("DELETE FROM conversations WHERE id=?").run(req.params.id);
    broadcast('conversation_deleted', { conversation_id: parseInt(req.params.id) });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Delete a single message
app.delete('/api/messages/:id', (req, res) => {
  try {
    const msg = db.prepare("SELECT * FROM messages WHERE id=?").get(req.params.id);
    db.prepare("DELETE FROM messages WHERE id=?").run(req.params.id);
    if (msg) {
      // Refresh conversation's last_message preview
      const last = db.prepare("SELECT content, type, created_at FROM messages WHERE conversation_id=? ORDER BY id DESC LIMIT 1").get(msg.conversation_id);
      db.prepare("UPDATE conversations SET last_message=?, last_message_at=? WHERE id=?")
        .run(last?.content || (last ? `[${last.type}]` : ''), last?.created_at || null, msg.conversation_id);
      broadcast('message_deleted', { conversation_id: msg.conversation_id, message_id: parseInt(req.params.id) });
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────────────────
// MESSAGES
// ─────────────────────────────────────────────────────────
app.get('/api/conversations/:id/messages', (req, res) => {
  const { before, limit=50 } = req.query;
  const where = before ? `WHERE conversation_id=? AND id < ${parseInt(before)}` : 'WHERE conversation_id=?';
  const msgs = db.prepare(`SELECT * FROM messages ${where} ORDER BY id ASC LIMIT ${limit}`).all(req.params.id);
  res.json(msgs);
});

// Send message
app.post('/api/conversations/:id/messages', async (req, res) => {
  try {
    const { content, type='text', sent_by='Admin', media_url } = req.body;
    if (!content && !media_url) return res.status(400).json({ error: 'content is required' });

    const conv = db.prepare(`${CONV_SELECT} WHERE conversations.id=?`).get(req.params.id);
    if (!conv) return res.status(404).json({ error:'Conversation not found' });

    // Get full channel (with token)
    const channel = db.prepare("SELECT * FROM channels WHERE id=?").get(conv.channel_id);
    if (!channel) return res.status(400).json({ error:'Channel not found' });

    let apiResult = null;
    try {
      if (channel.type === 'whatsapp') {
        const to = conv.wa_id || conv.contact_phone;
        if (!to) throw new Error('No recipient phone number found');
        apiResult = await sendWhatsApp(channel, to, content);
      } else if (channel.type === 'messenger') {
        apiResult = await sendMessenger(channel, conv.messenger_id, content);
      } else if (channel.type === 'instagram') {
        apiResult = await sendMessenger({ ...channel, page_id: channel.ig_account_id || channel.page_id }, conv.instagram_id || conv.messenger_id, content);
      }
    } catch (e) {
      console.error('Send API error:', e.message);
      apiResult = { error: { message: e.message } };
    }

    const waId = apiResult?.messages?.[0]?.id || apiResult?.message_id || null;
    const status = apiResult?.error ? 'failed' : 'sent';
    const info = db.prepare(`INSERT INTO messages (conversation_id,direction,type,content,media_url,wa_message_id,status,sent_by) VALUES (?,?,?,?,?,?,?,?)`)
      .run(req.params.id, 'out', type, content, media_url||null, waId, status, sent_by);
    const msg = db.prepare("SELECT * FROM messages WHERE id=?").get(info.lastInsertRowid);

    db.prepare("UPDATE conversations SET last_message=?, last_message_at=datetime('now'), status='open' WHERE id=?").run(content, req.params.id);
    broadcast('new_message', { ...msg, conversation_id: parseInt(req.params.id), direction: 'outbound' });
    res.json({ message: msg, apiResult });
  } catch(e) {
    console.error('sendMessage error:', e.message, e.stack);
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────────────────
// QUICK REPLIES
// ─────────────────────────────────────────────────────────
app.get('/api/quick-replies', (req, res) => res.json(db.prepare("SELECT * FROM quick_replies ORDER BY category, title").all()));
app.post('/api/quick-replies', (req, res) => {
  const { title, content, category } = req.body;
  const info = db.prepare("INSERT INTO quick_replies (title,content,category) VALUES (?,?,?)").run(title, content, category||null);
  res.json(db.prepare("SELECT * FROM quick_replies WHERE id=?").get(info.lastInsertRowid));
});
app.put('/api/quick-replies/:id', (req, res) => {
  const { title, content, category } = req.body;
  db.prepare("UPDATE quick_replies SET title=?,content=?,category=? WHERE id=?").run(title, content, category||null, req.params.id);
  res.json(db.prepare("SELECT * FROM quick_replies WHERE id=?").get(req.params.id));
});
app.delete('/api/quick-replies/:id', (req, res) => { db.prepare("DELETE FROM quick_replies WHERE id=?").run(req.params.id); res.json({ ok:true }); });

// ─────────────────────────────────────────────────────────
// META WEBHOOK — WhatsApp + Messenger + Instagram + Lead Ads
// ─────────────────────────────────────────────────────────
app.get('/webhook/meta', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode !== 'subscribe') return res.sendStatus(403);
  // Accept: global config token, any channel's verify token, or common defaults
  const globalToken = getConfig('verify_token') || '';
  const defaults = ['eduexpress2024', 'eduexpress_verify_2024', 'eduexpress', 'verify_token'];
  const channelTokens = db.prepare("SELECT webhook_verify_token FROM channels").all().map(r => r.webhook_verify_token).filter(Boolean);
  const allTokens = [globalToken, ...defaults, ...channelTokens].filter(Boolean);
  if (allTokens.includes(token)) {
    console.log('✅ Meta webhook verified with token:', token);
    return res.status(200).send(challenge);
  }
  console.log('❌ Webhook verify failed. Got:', token, '| Expected one of:', allTokens);
  res.sendStatus(403);
});

app.post('/webhook/meta', async (req, res) => {
  res.sendStatus(200);
  const body = req.body;

  // ── WhatsApp Cloud API ─────────────────────────────────
  if (body.object === 'whatsapp_business_account') {
    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        if (change.field !== 'messages') continue;
        const val = change.value;
        const phoneNumberId = val.metadata?.phone_number_id;
        const channel = db.prepare("SELECT * FROM channels WHERE phone_number_id=? AND type='whatsapp'").get(phoneNumberId);
        if (!channel) { console.log('⚠️ Unknown WA channel:', phoneNumberId); continue; }

        // Delivery/read status updates
        for (const status of val.statuses || []) {
          db.prepare("UPDATE messages SET status=? WHERE wa_message_id=?").run(status.status, status.id);
          broadcast('message_status', { wa_message_id: status.id, status: status.status });
        }

        // Incoming messages
        for (const msg of val.messages || []) {
          const profileName = val.contacts?.find(c=>c.wa_id===msg.from)?.profile?.name || msg.from;
          const contact = upsertContact({ name: profileName, phone: msg.from, wa_id: msg.from });
          const conv    = upsertConversation(contact.id, channel.id, 'whatsapp');

          let content = null, type = msg.type, mediaUrl = null, caption = null;
          if (msg.type === 'text')     { content = msg.text?.body; }
          else if (msg.type === 'image')    { mediaUrl = msg.image?.id;    caption = msg.image?.caption; content = '[Image]'; }
          else if (msg.type === 'audio')    { mediaUrl = msg.audio?.id;    content = '[Voice Message]'; }
          else if (msg.type === 'video')    { mediaUrl = msg.video?.id;    caption = msg.video?.caption; content = '[Video]'; }
          else if (msg.type === 'document') { mediaUrl = msg.document?.id; content = `[Document: ${msg.document?.filename||''}]`; }
          else if (msg.type === 'location') { content = `📍 Location: ${msg.location?.latitude},${msg.location?.longitude}`; }
          else if (msg.type === 'button')   { content = msg.button?.text; type='text'; }
          else { content = `[${msg.type}]`; }

          saveInboundMessage(conv.id, content, type, msg.id, mediaUrl, caption);
          console.log(`📱 WA [${channel.name}] ${profileName}: ${content}`);
        }
      }
    }
    return;
  }

  // ── Facebook Page (Messenger + Lead Ads) ───────────────
  if (body.object === 'page') {
    for (const entry of body.entry || []) {
      const pageId = entry.id;

      // Lead Ads
      for (const change of entry.changes || []) {
        if (change.field === 'leadgen') {
          const { leadgen_id, form_id, ad_id } = change.value;
          try {
            const channel = db.prepare("SELECT * FROM channels WHERE (page_id=? OR ig_account_id=?)").get(pageId, pageId);
            const token = channel?.access_token || getConfig('page_access_token');
            if (!token) continue;
            const metaRes = await fetch(`https://graph.facebook.com/v19.0/${leadgen_id}?fields=field_data,ad_id,ad_name,campaign_id,campaign_name,form_id&access_token=${token}`);
            const metaData = await metaRes.json();
            if (metaData.error) continue;
            const fields = {};
            (metaData.field_data||[]).forEach(f => { fields[f.name] = f.values?.[0]||null; });
            const lead_id = nextLeadId();
            const client_name = fields.full_name||fields.name||`${fields.first_name||''} ${fields.last_name||''}`.trim()||'Unknown';
            db.prepare(`INSERT OR IGNORE INTO leads (lead_id,date_added,client_name,phone,email,destination,lead_source,lead_status,meta_lead_id,meta_form_id,meta_ad_id,meta_campaign,notes)
              VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
              .run(lead_id, new Date().toISOString().slice(0,10), client_name, fields.phone_number||null, fields.email||null, fields.destination||null,
                metaData.campaign_name||'Meta Ad','New Lead',leadgen_id,form_id,ad_id||null,metaData.campaign_name||null,JSON.stringify(fields));
            const lead = db.prepare("SELECT * FROM leads WHERE meta_lead_id=?").get(leadgen_id);
            if (lead) { sendCAPIEvent('Lead', lead); broadcast('new_lead', { lead }); }
            console.log(`✅ Meta Lead: ${lead_id} — ${client_name}`);
          } catch(e) { console.error('Lead webhook error:', e.message); }
        }
      }

      // Messenger messages
      for (const messaging of entry.messaging || []) {
        if (!messaging.message || messaging.message.is_echo) continue;
        const senderId = messaging.sender.id;
        const channel = db.prepare("SELECT * FROM channels WHERE page_id=? AND type='messenger'").get(pageId);
        if (!channel) continue;

        const contact = upsertContact({ name: `Messenger User`, messenger_id: senderId });
        // Fetch name from Messenger API
        try {
          const nr = await fetch(`https://graph.facebook.com/v19.0/${senderId}?fields=name&access_token=${channel.access_token}`);
          const nd = await nr.json();
          if (nd.name) db.prepare("UPDATE contacts SET name=? WHERE id=?").run(nd.name, contact.id);
        } catch {}

        const conv = upsertConversation(contact.id, channel.id, 'messenger');
        const text = messaging.message.text || (messaging.message.attachments?.[0] ? `[${messaging.message.attachments[0].type}]` : '[message]');
        saveInboundMessage(conv.id, text, 'text', messaging.message.mid);
        console.log(`💬 Messenger [${channel.name}]: ${text}`);
      }
    }
    return;
  }

  // ── Instagram ──────────────────────────────────────────
  if (body.object === 'instagram') {
    for (const entry of body.entry || []) {
      for (const msg of entry.messaging || []) {
        if (!msg.message || msg.message.is_echo) continue;
        const senderId = msg.sender.id;
        const igAccountId = entry.id;
        const channel = db.prepare("SELECT * FROM channels WHERE ig_account_id=? AND type='instagram'").get(igAccountId);
        if (!channel) continue;

        const contact = upsertContact({ name: `Instagram User`, instagram_id: senderId });
        try {
          const nr = await fetch(`https://graph.facebook.com/v19.0/${senderId}?fields=name,username&access_token=${channel.access_token}`);
          const nd = await nr.json();
          if (nd.name || nd.username) db.prepare("UPDATE contacts SET name=? WHERE id=?").run(nd.name||'@'+nd.username, contact.id);
        } catch {}

        const conv = upsertConversation(contact.id, channel.id, 'instagram');
        const text = msg.message.text || '[message]';
        saveInboundMessage(conv.id, text, 'text', msg.message.mid);
        console.log(`📸 Instagram [${channel.name}]: ${text}`);
      }
    }
  }
});

// ─────────────────────────────────────────────────────────
// META CONFIG + CAPI
// ─────────────────────────────────────────────────────────
app.get('/api/meta/config', (req, res) => {
  const rows = db.prepare("SELECT key,value FROM meta_config").all();
  const config = Object.fromEntries(rows.map(r => [r.key, r.value]));
  if (config.page_access_token) config.page_access_token = config.page_access_token.slice(0,12)+'••••••••';
  if (config.capi_token) config.capi_token = config.capi_token.slice(0,12)+'••••••••';
  res.json(config);
});
app.post('/api/meta/config', (req, res) => {
  const allowed = ['page_access_token','capi_token','pixel_id','app_secret','verify_token','test_event_code','office_open','grace_minutes'];
  for (const [key,value] of Object.entries(req.body)) {
    if (!allowed.includes(key)||!value||value.includes('••')) continue;
    db.prepare("INSERT INTO meta_config (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(key,value);
  }
  res.json({ ok:true });
});
app.post('/api/meta/test-capi', async (req, res) => {
  const result = await sendCAPIEvent(req.body.event_name||'Lead', { lead_id:'TEST-001', phone:'01700000000', email:'test@example.com', client_name:'Test User', destination:'China' });
  res.json(result);
});
app.get('/api/meta/stats', (req, res) => {
  const total = db.prepare("SELECT COUNT(*) as c FROM leads WHERE meta_lead_id IS NOT NULL").get().c;
  const byStatus = db.prepare("SELECT lead_status,COUNT(*) as c FROM leads WHERE meta_lead_id IS NOT NULL GROUP BY lead_status").all();
  const byCampaign = db.prepare("SELECT meta_campaign,COUNT(*) as c FROM leads WHERE meta_campaign IS NOT NULL GROUP BY meta_campaign ORDER BY c DESC").all();
  const recent = db.prepare("SELECT * FROM leads WHERE meta_lead_id IS NOT NULL ORDER BY id DESC LIMIT 10").all();
  res.json({ total, byStatus, byCampaign, recent });
});

// ─────────────────────────────────────────────────────────
// SETTINGS
// ─────────────────────────────────────────────────────────
app.get('/api/settings', (req, res) => res.json({
  consultants: ['Ema','Afsana','Sakib','Mukta','Rafi','Admin'],
  leadSources: ['China Web Form','Web Lead (New)','Client Sheet','WhatsApp','Facebook Ad','Instagram Ad','Referral','Walk-in','YouTube','Google Ad','Meta Lead Ad'],
  destinations: ['China','Georgia','Malta'],
  leadStatuses: ['New Lead','No Response','Positive','Office Visited','File Opened','Enrolled','Not Interested'],
  fileStages: ['Documents Collecting','Documents Ready','Applied to University','Offer Letter Received','Visa Applied','Visa Approved','Visa Rejected','Enrolled','Cancelled'],
  paymentStatuses: ['Pending','Partial','Paid','Refunded'],
  incomeCategories: ['Service Charge','Application Deposit','App Fee','File Opening','Marketing Refund','Invest','Previous Cash','Other Income'],
  expenseCategories: ['Salary','Office Rent','Marketing','Air Ticket','Airport Pickup','App Fee','Visa Fee','Medical','Mobile Recharge','Client Lunch+Snacks','Transport','Bua Bill','Tissue+Room Spray','Letterhead','Logo','Job Post','Testimonial Video','Review','Yearly Fee','Electrician+Sign Board','Mata Support','Other Expense'],
}));

// Catch-all: serve React app for any non-API route (production)
// Express v5 requires '/{*path}' instead of '*'
if (process.env.NODE_ENV === 'production') {
  app.get('/{*path}', (req, res) => {
    res.sendFile(join(__dirname, 'dist', 'index.html'));
  });
}
