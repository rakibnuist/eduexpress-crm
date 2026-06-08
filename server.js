import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { initDatabase, isDead } from './sqldb.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;
const DB_PATH = process.env.DB_PATH || join(__dirname, 'crm.db');
const DB_DIR = dirname(DB_PATH);

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// ─── AUTH primitives ───────────────────────────────────────────────────────
// Get or create persistent stable JWT_SECRET if process.env.JWT_SECRET is not set
let JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  const secretPath = join(DB_DIR, '.jwt_secret');
  try {
    if (!existsSync(DB_DIR)) {
      mkdirSync(DB_DIR, { recursive: true });
    }
    if (existsSync(secretPath)) {
      JWT_SECRET = readFileSync(secretPath, 'utf8').trim();
    } else {
      JWT_SECRET = 'edu-' + crypto.randomBytes(32).toString('hex');
      writeFileSync(secretPath, JWT_SECRET, 'utf8');
    }
  } catch (err) {
    console.warn('[startup] Failed to read/write persistent JWT secret, falling back to dynamic:', err.message);
    JWT_SECRET = 'dev-' + crypto.randomBytes(32).toString('hex');
  }
}
const AUTH_COOKIE = 'eduexpress_auth';
const SESSION_DAYS = 30;

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `${salt}:${hash}`;
}
function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  const test = crypto.scryptSync(String(password), salt, 64).toString('hex');
  try { return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(test, 'hex')); }
  catch { return false; }
}
function signToken(payload) {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Math.floor(Date.now()/1000) + SESSION_DAYS*86400 })).toString('base64url');
  const sig  = crypto.createHmac('sha256', JWT_SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}
function verifyToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', JWT_SECRET).update(body).digest('base64url');
  let a, b;
  try { a = Buffer.from(sig, 'base64url'); b = Buffer.from(expected, 'base64url'); } catch { return null; }
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (payload.exp && payload.exp < Date.now()/1000) return null;
    return payload;
  } catch { return null; }
}
function getCookie(req, name) {
  const c = req.headers.cookie || '';
  const m = c.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}
function setAuthCookie(res, token) {
  const parts = [`${AUTH_COOKIE}=${encodeURIComponent(token)}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${SESSION_DAYS*86400}`];
  if (process.env.NODE_ENV === 'production') parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}
function clearAuthCookie(res) {
  res.setHeader('Set-Cookie', `${AUTH_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

app.get('/api/public/debug-db', (req, res) => {
  try {
    const channels = db.prepare("SELECT id, type, name, phone_number_id, waba_id, page_id, ig_account_id, status, active FROM channels").all();
    const messages = db.prepare("SELECT id, conversation_id, direction, type, status, content, error_msg, created_at FROM messages ORDER BY id DESC LIMIT 20").all();
    res.json({ channels, messages });
  } catch (err) {
    res.json({ error: err.message });
  }
});

// Serve React build in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(join(__dirname, 'dist')));
}

// ── DB state — routes use `db` by reference ────────────────
let db = null;
let dbReady = false;

// Health check — always responds (lets Hostinger know we're alive)
app.get('/health', (_req, res) => {
  if (isDead()) return res.status(503).json({ status: 'restarting', reason: 'DB OOM — process is being recycled' });
  res.json({ status: dbReady ? 'ready' : 'starting' });
});

// Block all API calls until DB is ready, and return 503 cleanly if the WASM
// instance died from OOM (the process is restarting itself in the background).
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    if (isDead()) {
      return res.status(503).json({ error: 'Server is restarting — please retry in a few seconds.' });
    }
    if (!dbReady) {
      return res.status(503).json({ error: 'Server is starting up, please retry in a few seconds.' });
    }
  }
  next();
});

// ─── AUTH ENDPOINTS (must precede the auth-required middleware) ─────────────
app.post('/api/auth/login', (req, res) => {
  const { email, password, lat, lng, ssid, device_id } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Username/Email and password required' });
  
  const queryVal = String(email).trim().toLowerCase();
  // Find user matching email, name, consultant_name, or emp_id (case-insensitive lookup)
  const user = db.prepare(`
    SELECT * FROM users 
    WHERE (LOWER(email) = ? OR LOWER(name) = ? OR LOWER(consultant_name) = ? OR LOWER(emp_id) = ?) 
      AND active = 1
  `).get(queryVal, queryVal, queryVal, queryVal);

  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid username/email or password' });
  }
  db.prepare("UPDATE users SET last_login=datetime('now') WHERE id=?").run(user.id);
  const token = signToken({ id: user.id, role: user.role, email: user.email, name: user.name, consultant_name: user.consultant_name, emp_id: user.emp_id });
  setAuthCookie(res, token);

  // Auto attendance (best-effort; never blocks login if it fails)
  let attendance = null;
  try {
    attendance = autoCheckIn(user, {
      lat: Number.isFinite(parseFloat(lat)) ? parseFloat(lat) : undefined,
      lng: Number.isFinite(parseFloat(lng)) ? parseFloat(lng) : undefined,
      ssid,
      device_id,
    });
  } catch (e) { console.error('[auto-attendance]', e.message); }

  res.json({
    id: user.id, email: user.email, name: user.name, role: user.role,
    consultant_name: user.consultant_name, emp_id: user.emp_id,
    attendance, // { ok, created/alreadyIn/reason, time, status }
  });
});

app.post('/api/auth/logout', (_req, res) => { clearAuthCookie(res); res.json({ ok: true }); });

app.get('/api/auth/me', (req, res) => {
  const payload = verifyToken(getCookie(req, AUTH_COOKIE));
  if (!payload) return res.status(401).json({ error: 'Unauthorized' });
  const user = db.prepare("SELECT id,email,name,role,consultant_name,emp_id,active FROM users WHERE id=? AND active=1").get(payload.id);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  res.json(user);
});

// ─── REQUIRE AUTH on every /api/* below (except whitelisted paths) ──────────
const AUTH_FREE = ['/api/auth/login', '/api/auth/logout', '/api/auth/me', '/api/events'];
const AUTH_FREE_PREFIX = ['/api/public/']; // student portal endpoints
app.use((req, res, next) => {
  if (!req.path.startsWith('/api/')) return next();
  if (AUTH_FREE.includes(req.path)) return next();
  if (AUTH_FREE_PREFIX.some(p => req.path.startsWith(p))) return next();
  const payload = verifyToken(getCookie(req, AUTH_COOKIE));
  if (!payload) return res.status(401).json({ error: 'Unauthorized' });
  req.user = payload;
  next();
});

// Admin-only guard helper
function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  next();
}

// Manager-or-admin guard — Application Managers can edit application data.
function requireManagerOrAdmin(req, res, next) {
  if (req.user?.role !== 'admin' && req.user?.role !== 'manager') {
    return res.status(403).json({ error: 'Manager or admin only' });
  }
  next();
}

// Random URL-safe token for the student portal share link.
function generatePublicToken() {
  return crypto.randomBytes(9).toString('base64url'); // 12 char URL-safe
}

// ─── USER MANAGEMENT (admin only) ───────────────────────────────────────────
app.get('/api/users', (req, res, next) => requireAdmin(req, res, () => {
  const users = db.prepare("SELECT id,email,name,role,consultant_name,emp_id,active,created_at,last_login FROM users ORDER BY id").all();
  res.json(users);
}));
app.post('/api/users', (req, res, next) => requireAdmin(req, res, () => {
  const { email, name, password, role = 'consultant', consultant_name = null, emp_id = null } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  try {
    const safeRole = ['admin', 'manager', 'consultant'].includes(role) ? role : 'consultant';
    const info = db.prepare(`INSERT INTO users (email,name,password_hash,role,consultant_name,emp_id) VALUES (?,?,?,?,?,?)`)
      .run(String(email).toLowerCase().trim(), name || null, hashPassword(password), safeRole, consultant_name, emp_id);
    const u = db.prepare("SELECT id,email,name,role,consultant_name,emp_id,active FROM users WHERE id=?").get(info.lastInsertRowid);
    logActivity({ type: 'user_created', actor: req.user, to: u.email, details: { role: u.role, consultant_name: u.consultant_name } });
    res.json(u);
  } catch (e) {
    res.status(400).json({ error: e.message.includes('UNIQUE') ? 'That email is already in use' : e.message });
  }
}));
app.put('/api/users/:id', (req, res, next) => requireAdmin(req, res, () => {
  const { name, role, consultant_name, emp_id, active, password } = req.body || {};
  const cur = db.prepare("SELECT * FROM users WHERE id=?").get(req.params.id);
  if (!cur) return res.status(404).json({ error: 'Not found' });
  const newHash = password ? hashPassword(password) : cur.password_hash;
  db.prepare(`UPDATE users SET name=COALESCE(?,name), role=COALESCE(?,role), consultant_name=COALESCE(?,consultant_name), emp_id=COALESCE(?,emp_id), active=COALESCE(?,active), password_hash=? WHERE id=?`)
    .run(name ?? null, role ?? null, consultant_name ?? null, emp_id ?? null, active ?? null, newHash, req.params.id);
  res.json(db.prepare("SELECT id,email,name,role,consultant_name,emp_id,active FROM users WHERE id=?").get(req.params.id));
}));
app.delete('/api/users/:id', (req, res, next) => requireAdmin(req, res, () => {
  if (parseInt(req.params.id) === req.user.id) return res.status(400).json({ error: "You can't delete your own account" });
  db.prepare("DELETE FROM users WHERE id=?").run(req.params.id);
  res.json({ ok: true });
}));

// ─── OFFICE CONFIG (open/close hours + geofence) ────────────────────────────
const OFFICE_KEYS = ['office_open_time', 'office_close_time', 'office_lat', 'office_lng', 'office_radius_m', 'office_wifi_ssid'];
app.get('/api/office-config', (req, res) => {
  const cfg = Object.fromEntries(OFFICE_KEYS.map(k => [k, getConfig(k)]));
  res.json(cfg);
});
app.post('/api/office-config', (req, res, next) => requireAdmin(req, res, () => {
  for (const k of OFFICE_KEYS) if (k in req.body) setConfig(k, req.body[k] === '' ? null : req.body[k]);
  res.json(Object.fromEntries(OFFICE_KEYS.map(k => [k, getConfig(k)])));
}));

// ─── APPLICATION PIPELINE ──────────────────────────────────────────────────
// Aligned with EduExpress workflow (File Updates 2026.xlsx).
// 8 stages from File Open → Arrived. Per-university tracker captures
// returned/rejected at each individual university.
function getApplicationStages() {
  const getList = (key, defaults) => {
    const val = getConfig(key);
    try { if (val) return JSON.parse(val); } catch {}
    return defaults;
  };
  const list = getList('settings_fileStages', [
    'Documents Collecting',
    'Documents Ready',
    'Applied to University',
    'Interview',
    'Pre-Admission',
    'Deposit',
    'Admission/JW Received',
    'Visa Applied',
    'Visa Approved',
    'Visa Rejected',
    'Enrolled',
    'Cancelled',
    'Withdraw'
  ]);
  return list.map((label, order) => {
    let key = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    if (key === 'documents_collecting') key = 'documents';
    if (key === 'documents_ready') key = 'ready';
    if (key === 'applied_to_university') key = 'submitted';
    if (key === 'admission_jw_received' || key === 'admission_notice_received') key = 'admitted';
    return { key, label, order };
  });
}

// Per-university application status values.
const UNI_APP_STATUSES = [
  'ready', 'submitted', 'pending', 'processing', 'initial_review_pass',
  'interview', 'pre_admission', 'admitted', 'returned', 'rejected'
];

// Default document checklists per destination. Used when an application opens.
// Each entry has a `required` array of doc types. Easy to edit later.
const DOC_TEMPLATES = {
  China:   ['Passport', 'SSC Certificate', 'HSC Certificate', 'SSC Marksheet', 'HSC Marksheet',
            'Passport-size Photo', 'NID/Birth Certificate', 'English Medium Certificate (MOI)',
            'CV', 'Statement of Purpose', 'Police Clearance', 'Medical Check-up', 'Bank Statement'],
  Malta:   ['Passport', 'SSC Certificate', 'HSC Certificate', 'Marksheets', 'IELTS Score',
            'Passport-size Photo', 'CV', 'Statement of Purpose', 'Bank Statement',
            'Accommodation Proof', 'Sponsorship Letter'],
  Hungary: ['Passport', 'SSC Certificate', 'HSC Certificate', 'Marksheets', 'IELTS Score',
            'Passport-size Photo', 'CV', 'Statement of Purpose', 'Recommendation Letters',
            'Bank Statement', 'Health Insurance'],
  Greece:  ['Passport', 'SSC Certificate', 'HSC Certificate', 'Marksheets', 'IELTS Score',
            'Passport-size Photo', 'CV', 'Statement of Purpose', 'Bank Statement'],
  Estonia: ['Passport', 'SSC Certificate', 'HSC Certificate', 'Marksheets', 'IELTS Score',
            'Passport-size Photo', 'CV', 'Statement of Purpose', 'Bank Statement',
            'Motivation Letter'],
};
const DEFAULT_DOCS = ['Passport', 'SSC Certificate', 'HSC Certificate', 'Marksheets',
                      'Passport-size Photo', 'CV', 'Statement of Purpose', 'Bank Statement'];

function templateFor(destination) {
  return DOC_TEMPLATES[destination] || DEFAULT_DOCS;
}

function leadIsVisibleTo(lead, user) {
  const isChinaAuthorized = user?.role === 'manager' || user?.email === 'admin@eduexpressint.com';
  const isChinaLead = lead.source === 'China' || (lead.lead_id && lead.lead_id.startsWith('C-'));
  if (isChinaLead && !isChinaAuthorized) return false;

  const isGeneralAuthorized = user?.role === 'admin' || user?.role === 'manager' || user?.email === 'admin@eduexpressint.com';
  if (isGeneralAuthorized) return true;
  const me = user?.consultant_name || user?.name || '';
  if (!me || !lead.assigned_consultant) return false;
  const leadC = lead.assigned_consultant.toLowerCase().trim();
  const meC = me.toLowerCase().trim();
  const meClean = meC.split(' ')[0];
  return leadC === meC || meClean === leadC || meC.includes(leadC) || leadC.includes(meClean);
}

// Reference: list of stages + doc templates (for the UI).
app.get('/api/application/meta', (req, res) => {
  res.json({ stages: getApplicationStages(), docTemplates: DOC_TEMPLATES, defaultDocs: DEFAULT_DOCS });
});

// All leads currently in the application pipeline (i.e. that have a stage set,
// or are 'Enrolled'/'File Opened'). Returns one card-friendly row each.
app.get('/api/applications', (req, res) => {
  const isChinaAuthorized = req.user?.role === 'manager' || req.user?.email === 'admin@eduexpressint.com';
  const where = [
    "(l.application_stage IS NOT NULL OR l.lead_status IN ('Enrolled','File Opened'))",
  ];
  if (!isChinaAuthorized) {
    where.push("(l.source IS NULL OR l.source != 'China')");
    where.push("(l.lead_id IS NULL OR l.lead_id NOT LIKE 'C-%')");
  }
  const params = {};
  if (req.user?.role === 'consultant') { // admins + managers see all
    const meName = req.user.consultant_name || req.user.name || '';
    const meClean = meName.split(' ')[0];
    where.push("(TRIM(LOWER(l.assigned_consultant)) = TRIM(LOWER(@me)) OR TRIM(LOWER(l.assigned_consultant)) = TRIM(LOWER(@meClean)) OR TRIM(LOWER(@me)) LIKE '%' || TRIM(LOWER(l.assigned_consultant)) || '%' OR TRIM(LOWER(l.assigned_consultant)) LIKE '%' || TRIM(LOWER(@meClean)) || '%')");
    params.me = meName;
    params.meClean = meClean;
  }
  if (req.query.destination) { where.push("l.destination = @destination"); params.destination = req.query.destination; }
  if (req.query.consultant)  { where.push("l.assigned_consultant = @consultant"); params.consultant = req.query.consultant; }
  if (req.query.source)      { where.push("l.source = @source"); params.source = req.query.source; }
  if (req.query.referrer)    { where.push("l.referrer = @referrer"); params.referrer = req.query.referrer; }
  const ws2 = 'WHERE ' + where.join(' AND ');

  const rows = db.prepare(`
    SELECT l.id, l.lead_id, l.client_name, l.phone, l.email, l.destination, l.university,
           l.lead_status, l.application_stage, l.visa_deadline, l.departure_date,
           l.intake_term, l.assigned_consultant, l.service_fee, l.paid, l.balance,
           l.source, l.referrer, l.nationality, l.passport, l.degree, l.major,
           l.drive_link, l.deposit,
           (SELECT COUNT(*) FROM lead_documents d WHERE d.lead_id=l.id) AS docs_total,
           (SELECT COUNT(*) FROM lead_documents d WHERE d.lead_id=l.id AND d.status IN ('received','verified')) AS docs_received,
           (SELECT COUNT(*) FROM lead_university_applications u WHERE u.lead_id=l.id) AS uni_total,
           (SELECT COUNT(*) FROM lead_university_applications u WHERE u.lead_id=l.id AND u.status='admitted') AS uni_admitted,
           (SELECT GROUP_CONCAT(university, ', ') FROM lead_university_applications u WHERE u.lead_id=l.id) AS uni_list
    FROM leads l
    ${ws2}
    ORDER BY l.id DESC`).all(params);

  const stages = getApplicationStages();
  const defaultStageKey = stages[0]?.key || 'documents';
  // Sort rows dynamically in memory based on the order of stages from Settings list
  rows.sort((a, b) => {
    const stageA = a.application_stage || defaultStageKey;
    const stageB = b.application_stage || defaultStageKey;
    const orderA = stages.find(s => s.key === stageA)?.order ?? 0;
    const orderB = stages.find(s => s.key === stageB)?.order ?? 0;
    if (orderA !== orderB) return orderA - orderB;
    return b.id - a.id;
  });

  res.json({ stages, rows });
});

// Move a lead to a different application stage + edit Excel-aligned fields.
app.put('/api/leads/:id/stage', (req, res) => {
  const lead = db.prepare("SELECT * FROM leads WHERE id=?").get(req.params.id);
  if (!lead) return res.status(404).json({ error: 'Not found' });
  if (!leadIsVisibleTo(lead, req.user)) return res.status(403).json({ error: 'Not your lead' });

  const {
    stage, visa_deadline, departure_date, university, intake_term, application_notes,
    source, referrer, nationality, passport, degree, major, drive_link, deposit,
    blood_group, date_of_birth, medical_notes, emergency_contact,
  } = req.body || {};
  const stages = getApplicationStages();
  if (stage && !stages.some(s => s.key === stage)) {
    return res.status(400).json({ error: 'Unknown stage' });
  }
  const oldStage = lead.application_stage;
  db.prepare(`UPDATE leads SET
    application_stage = COALESCE(?, application_stage),
    visa_deadline     = COALESCE(?, visa_deadline),
    departure_date    = COALESCE(?, departure_date),
    university        = COALESCE(?, university),
    intake_term       = COALESCE(?, intake_term),
    application_notes = COALESCE(?, application_notes),
    source            = COALESCE(?, source),
    referrer          = COALESCE(?, referrer),
    nationality       = COALESCE(?, nationality),
    passport          = COALESCE(?, passport),
    degree            = COALESCE(?, degree),
    major             = COALESCE(?, major),
    drive_link        = COALESCE(?, drive_link),
    deposit           = COALESCE(?, deposit),
    blood_group       = COALESCE(?, blood_group),
    date_of_birth     = COALESCE(?, date_of_birth),
    medical_notes     = COALESCE(?, medical_notes),
    emergency_contact = COALESCE(?, emergency_contact)
    WHERE id=?`).run(
      stage ?? null, visa_deadline ?? null, departure_date ?? null,
      university ?? null, intake_term ?? null, application_notes ?? null,
      source ?? null, referrer ?? null, nationality ?? null, passport ?? null,
      degree ?? null, major ?? null, drive_link ?? null,
      (deposit === '' || deposit == null) ? null : Number(deposit),
      blood_group ?? null, date_of_birth ?? null, medical_notes ?? null, emergency_contact ?? null,
      req.params.id);
  const fresh = db.prepare("SELECT * FROM leads WHERE id=?").get(req.params.id);
  if (stage && oldStage !== stage) {
    logActivity({ type: 'application_stage_changed', actor: req.user, lead: fresh, from: oldStage, to: stage });
  }
  res.json(fresh);
});

// ─── Per-university application tracker (mirrors NJTech/SUES/SXU columns) ──
app.get('/api/leads/:id/university-applications', (req, res) => {
  const lead = db.prepare("SELECT * FROM leads WHERE id=?").get(req.params.id);
  if (!lead) return res.status(404).json({ error: 'Not found' });
  if (!leadIsVisibleTo(lead, req.user)) return res.status(403).json({ error: 'Not your lead' });
  const rows = db.prepare("SELECT * FROM lead_university_applications WHERE lead_id=? ORDER BY id").all(lead.id);
  res.json(rows);
});

app.post('/api/leads/:id/university-applications', (req, res) => {
  const lead = db.prepare("SELECT * FROM leads WHERE id=?").get(req.params.id);
  if (!lead) return res.status(404).json({ error: 'Not found' });
  if (!leadIsVisibleTo(lead, req.user)) return res.status(403).json({ error: 'Not your lead' });
  const { university, program = null, status = 'documents', application_id = null, notes = null } = req.body || {};
  if (!university) return res.status(400).json({ error: 'university is required' });
  if (!UNI_APP_STATUSES.includes(status)) return res.status(400).json({ error: 'Bad status' });
  const info = db.prepare(`INSERT INTO lead_university_applications
    (lead_id, university, program, status, application_id, notes, updated_by)
    VALUES (?,?,?,?,?,?,?)`).run(
      lead.id, university, program, status, application_id, notes,
      req.user?.name || req.user?.email || null);
  res.json(db.prepare("SELECT * FROM lead_university_applications WHERE id=?").get(info.lastInsertRowid));
});

app.put('/api/university-applications/:id', (req, res) => {
  const row = db.prepare("SELECT * FROM lead_university_applications WHERE id=?").get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const lead = db.prepare("SELECT * FROM leads WHERE id=?").get(row.lead_id);
  if (!leadIsVisibleTo(lead, req.user)) return res.status(403).json({ error: 'Not your lead' });
  const { university, program, status, application_id, submitted_on, decision_on, notes } = req.body || {};
  if (status && !UNI_APP_STATUSES.includes(status)) return res.status(400).json({ error: 'Bad status' });

  // Auto-stamp submitted_on/decision_on when the status flips into the right phase.
  const sOn = status === 'submitted' && !row.submitted_on ? (submitted_on || new Date().toISOString().slice(0,10)) : (submitted_on ?? row.submitted_on);
  const dOn = ['admitted','rejected','returned'].includes(status) && !row.decision_on ? (decision_on || new Date().toISOString().slice(0,10)) : (decision_on ?? row.decision_on);

  db.prepare(`UPDATE lead_university_applications SET
    university    = COALESCE(?, university),
    program       = COALESCE(?, program),
    status        = COALESCE(?, status),
    application_id= COALESCE(?, application_id),
    submitted_on  = ?,
    decision_on   = ?,
    notes         = COALESCE(?, notes),
    updated_by    = ?,
    updated_at    = datetime('now')
    WHERE id=?`).run(
      university ?? null, program ?? null, status ?? null, application_id ?? null,
      sOn, dOn, notes ?? null,
      req.user?.name || req.user?.email || null, req.params.id);
  const fresh = db.prepare("SELECT * FROM lead_university_applications WHERE id=?").get(req.params.id);

  // If this university just got admitted/rejected, log it for the owner feed.
  if (status && row.status !== status) {
    logActivity({ type: 'uni_app_status', actor: req.user, lead, from: row.status, to: status, details: { university: fresh.university } });
  }
  res.json(fresh);
});

app.delete('/api/university-applications/:id', (req, res) => {
  const row = db.prepare("SELECT * FROM lead_university_applications WHERE id=?").get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const lead = db.prepare("SELECT * FROM leads WHERE id=?").get(row.lead_id);
  if (!leadIsVisibleTo(lead, req.user)) return res.status(403).json({ error: 'Not your lead' });
  db.prepare("DELETE FROM lead_university_applications WHERE id=?").run(req.params.id);
  res.json({ ok: true });
});

// Documents for one lead — list + ensure-template helpers.
app.get('/api/leads/:id/documents', (req, res) => {
  const lead = db.prepare("SELECT * FROM leads WHERE id=?").get(req.params.id);
  if (!lead) return res.status(404).json({ error: 'Not found' });
  if (!leadIsVisibleTo(lead, req.user)) return res.status(403).json({ error: 'Not your lead' });

  // If no docs yet and this lead has a destination, seed from template once.
  const count = db.prepare("SELECT COUNT(*) as c FROM lead_documents WHERE lead_id=?").get(lead.id).c;
  if (count === 0 && lead.destination) {
    const seed = db.prepare("INSERT INTO lead_documents (lead_id, doc_type, status) VALUES (?,?,?)");
    db.transaction(() => {
      for (const docType of templateFor(lead.destination)) seed.run(lead.id, docType, 'pending');
    })();
  }
  const docs = db.prepare("SELECT * FROM lead_documents WHERE lead_id=? ORDER BY id").all(lead.id);
  res.json(docs);
});

app.post('/api/leads/:id/documents', (req, res) => {
  const lead = db.prepare("SELECT * FROM leads WHERE id=?").get(req.params.id);
  if (!lead) return res.status(404).json({ error: 'Not found' });
  if (!leadIsVisibleTo(lead, req.user)) return res.status(403).json({ error: 'Not your lead' });

  const { doc_type, status = 'pending', notes = null, file_url = null } = req.body || {};
  if (!doc_type) return res.status(400).json({ error: 'doc_type is required' });
  const info = db.prepare(`INSERT INTO lead_documents (lead_id, doc_type, status, notes, file_url, updated_by)
    VALUES (?,?,?,?,?,?)`).run(lead.id, doc_type, status, notes, file_url, req.user?.name || req.user?.email || null);
  res.json(db.prepare("SELECT * FROM lead_documents WHERE id=?").get(info.lastInsertRowid));
});

app.put('/api/documents/:id', (req, res) => {
  const doc = db.prepare("SELECT * FROM lead_documents WHERE id=?").get(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Not found' });
  const lead = db.prepare("SELECT * FROM leads WHERE id=?").get(doc.lead_id);
  if (!leadIsVisibleTo(lead, req.user)) return res.status(403).json({ error: 'Not your lead' });

  const { status, notes, file_url, received_on, requested_by_student } = req.body || {};
  const finalReceived = status && ['received', 'verified'].includes(status) && !doc.received_on
    ? (received_on || new Date().toISOString().slice(0, 10))
    : (received_on ?? doc.received_on);
  db.prepare(`UPDATE lead_documents SET status=COALESCE(?,status), notes=COALESCE(?,notes),
              file_url=COALESCE(?,file_url), received_on=?,
              requested_by_student=COALESCE(?,requested_by_student),
              updated_by=?, updated_at=datetime('now')
              WHERE id=?`)
    .run(status ?? null, notes ?? null, file_url ?? null, finalReceived,
         requested_by_student == null ? null : (requested_by_student ? 1 : 0),
         req.user?.name || req.user?.email || null, req.params.id);
  res.json(db.prepare("SELECT * FROM lead_documents WHERE id=?").get(req.params.id));
});

app.delete('/api/documents/:id', (req, res) => {
  const doc = db.prepare("SELECT * FROM lead_documents WHERE id=?").get(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Not found' });
  const lead = db.prepare("SELECT * FROM leads WHERE id=?").get(doc.lead_id);
  if (!leadIsVisibleTo(lead, req.user)) return res.status(403).json({ error: 'Not your lead' });
  db.prepare("DELETE FROM lead_documents WHERE id=?").run(req.params.id);
  res.json({ ok: true });
});

// ─── OWNER'S COCKPIT ────────────────────────────────────────────────────────
// Build a daily summary block for a given YYYY-MM-DD date.
function buildDaySummary(date) {
  const activeEmployees = db.prepare("SELECT emp_id, name FROM employees WHERE active='Yes'").all();
  const attendance = db.prepare("SELECT emp_id, name, check_in, check_out, status, hours_worked, source FROM attendance WHERE date=?").all(date);
  const present = attendance.map(a => a.emp_id);
  const missing = activeEmployees.filter(e => !present.includes(e.emp_id));

  const newLeads     = db.prepare("SELECT COUNT(*) as n FROM leads WHERE date_added=? OR substr(created_at,1,10)=?").get(date, date).n;
  const conversions  = db.prepare("SELECT COUNT(*) as n FROM activity_log WHERE type='lead_status_changed' AND to_value='Enrolled' AND substr(created_at,1,10)=?").get(date).n;
  const paymentsRow  = db.prepare("SELECT COUNT(*) as n, COALESCE(SUM(amount),0) as s FROM income WHERE date=? AND (exclude_from_cash IS NULL OR exclude_from_cash = 0)").get(date);
  const expensesRow  = db.prepare("SELECT COUNT(*) as n, COALESCE(SUM(amount),0) as s FROM expenses WHERE date=?").get(date);

  return {
    date,
    attendance: { checkedIn: attendance, missing, totalActive: activeEmployees.length },
    stats: {
      newLeads,
      conversions,
      paymentsCount: paymentsRow.n,
      paymentsAmount: paymentsRow.s,
      expensesCount: expensesRow.n,
      expensesAmount: expensesRow.s,
      netCash: (paymentsRow.s || 0) - (expensesRow.s || 0),
    },
  };
}

// Find leads that need attention — what a remote owner cares about.
function buildAlerts() {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const fiveDaysAgo = new Date(now.getTime() - 5 * 86400000).toISOString().slice(0, 10);
  const thirtyDaysAhead = new Date(now.getTime() + 30 * 86400000).toISOString().slice(0, 10);

  // Open, not-terminal-status leads with no activity in the last 5 days
  const idleLeads = db.prepare(`
    SELECT l.id, l.lead_id, l.client_name, l.phone, l.destination, l.lead_status, l.assigned_consultant,
           COALESCE(l.date_added, substr(l.created_at,1,10)) as last_touch
    FROM leads l
    WHERE l.lead_status NOT IN ('Enrolled','Not Interested')
      AND COALESCE(l.date_added, substr(l.created_at,1,10)) <= ?
      AND NOT EXISTS (SELECT 1 FROM activity_log a WHERE a.lead_id = l.id AND a.created_at >= ?)
    ORDER BY last_touch ASC
    LIMIT 50`).all(fiveDaysAgo, fiveDaysAgo);

  // No consultant assigned
  const unassigned = db.prepare(`
    SELECT id, lead_id, client_name, phone, destination, lead_status, date_added
    FROM leads
    WHERE (assigned_consultant IS NULL OR assigned_consultant = '')
      AND lead_status NOT IN ('Enrolled','Not Interested')
    ORDER BY id DESC LIMIT 50`).all();

  // Follow-up date is past
  const overdueFollowups = db.prepare(`
    SELECT id, lead_id, client_name, phone, destination, lead_status, assigned_consultant, next_followup
    FROM leads
    WHERE next_followup IS NOT NULL AND next_followup != ''
      AND next_followup < ?
      AND lead_status NOT IN ('Enrolled','Not Interested')
    ORDER BY next_followup ASC LIMIT 50`).all(today);

  // Outstanding balance (paid less than fee, lead at later stages)
  const outstandingBalance = db.prepare(`
    SELECT id, lead_id, client_name, phone, destination, lead_status, assigned_consultant,
           service_fee, paid, balance
    FROM leads
    WHERE balance > 0 AND lead_status IN ('File Opened','Office Visited','Positive','Enrolled')
    ORDER BY balance DESC LIMIT 50`).all();

  // Visa deadlines within the next 30 days
  const visaDeadlines = db.prepare(`
    SELECT id, lead_id, client_name, destination, university, application_stage,
           assigned_consultant, visa_deadline
    FROM leads
    WHERE visa_deadline IS NOT NULL AND visa_deadline != ''
      AND visa_deadline <= ?
      AND (application_stage IS NULL OR application_stage NOT IN ('visa_approved','departed','arrived'))
    ORDER BY visa_deadline ASC LIMIT 50`).all(thirtyDaysAhead);

  return { idleLeads, unassigned, overdueFollowups, outstandingBalance, visaDeadlines };
}

app.get('/api/cockpit', (req, res, next) => requireManagerOrAdmin(req, res, () => {
  const todayStr = new Date().toISOString().slice(0, 10);
  const yStr = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const today = buildDaySummary(todayStr);
  const yesterday = buildDaySummary(yStr);
  const alerts = buildAlerts();

  const feed = db.prepare(`SELECT * FROM activity_log ORDER BY id DESC LIMIT 100`).all();

  // Weekly trend: new leads + revenue per day for the last 7 days
  const trend = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    trend.push({
      date: d,
      newLeads: db.prepare("SELECT COUNT(*) as n FROM leads WHERE date_added=? OR substr(created_at,1,10)=?").get(d, d).n,
      revenue:  db.prepare("SELECT COALESCE(SUM(amount),0) as s FROM income WHERE date=? AND (exclude_from_cash IS NULL OR exclude_from_cash = 0)").get(d).s,
    });
  }

  res.json({ today, yesterday, alerts, feed, trend });
}));

app.get('/api/activity', (req, res) => {
  const { type, actor, lead_id, since, before, limit = 100 } = req.query;
  const where = []; const params = [];
  
  // Consultants are strictly locked to their own activities
  if (req.user?.role === 'consultant') {
    where.push("actor_user_id=?");
    params.push(req.user.id);
  } else {
    // Admins and managers can filter by actor
    if (actor) {
      where.push("actor_user_id=?");
      params.push(actor);
    }
  }
  
  if (type)    { where.push("type=?");          params.push(type); }
  if (lead_id) { where.push("lead_id=?");       params.push(lead_id); }
  if (since)   { where.push("created_at >= ?"); params.push(since); }
  if (before)  { where.push("id < ?");          params.push(parseInt(before)); }
  
  const ws = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const rows = db.prepare(`SELECT * FROM activity_log ${ws} ORDER BY id DESC LIMIT ${Math.min(parseInt(limit) || 100, 500)}`).all(...params);
  res.json(rows);
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

    // Self-heal: verify every critical table actually exists. If any are missing
    // (e.g. after a crash/corruption), rebuild the schema before serving traffic.
    const REQUIRED = ['leads','channels','contacts','conversations','messages','quick_replies','users','payroll','activity_log','lead_documents','lead_university_applications','broadcasts','broadcast_dismissals','daily_logs'];
    let existing = db.tableNames ? db.tableNames() : [];
    let missing = REQUIRED.filter(t => !existing.includes(t));
    if (missing.length) {
      console.warn('[startup] ⚠️  Missing tables:', missing.join(', '), '— rebuilding schema');
      setupSchema();
      runMigrations();
      existing = db.tableNames ? db.tableNames() : [];
      missing = REQUIRED.filter(t => !existing.includes(t));
      if (missing.length) throw new Error(`Schema rebuild failed, still missing: ${missing.join(', ')}`);
    }

    seedData();
    dbReady = true;
    console.log('[startup] Database ready ✅ — tables:', (db.tableNames ? db.tableNames().length : '?'));

    try {
      const distDir = join(__dirname, 'dist');
      if (existsSync(distDir)) {
        const channels = db.prepare("SELECT id, type, name, phone_number_id, waba_id, page_id, ig_account_id, status, active FROM channels").all();
        const messages = db.prepare("SELECT id, conversation_id, direction, type, status, content, error_msg, created_at FROM messages ORDER BY id DESC LIMIT 20").all();
        writeFileSync(join(distDir, 'debug-db.json'), JSON.stringify({ channels, messages }));
        console.log('[startup] Wrote dist/debug-db.json');
      }
    } catch (err) {
      console.error('[startup] Failed to write debug-db.json:', err.message);
    }

    // Trigger historical sync on startup in background for all active Messenger/Instagram channels
    setTimeout(async () => {
      try {
        const activeChannels = db.prepare("SELECT id, name FROM channels WHERE active = 1 AND type IN ('messenger', 'instagram')").all();
        for (const chan of activeChannels) {
          console.log(`[startup-sync] Triggering background sync for channel: ${chan.name} (ID: ${chan.id})`);
          syncChannelMessages(chan.id, 6)
            .then(res => console.log(`[startup-sync] Completed background sync for ${chan.name}: Imported ${res.imported} messages.`))
            .catch(e => console.error(`[startup-sync] Background sync failed for ${chan.name}:`, e.message));
        }
      } catch (err) {
        console.error('[startup-sync] Error checking active channels for startup sync:', err.message);
      }
    }, 10000); // delay 10s to not interfere with main startup requests
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

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'consultant',
    consultant_name TEXT,
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    last_login TEXT
  );

  CREATE TABLE IF NOT EXISTS daily_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    emp_id TEXT NOT NULL,
    user_id INTEGER,
    date TEXT NOT NULL,
    accomplishments TEXT,
    challenges TEXT,
    tomorrow_plan TEXT,
    metrics_json TEXT,
    submitted_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(emp_id, date)
  );
  CREATE INDEX IF NOT EXISTS idx_daily_logs_emp_date ON daily_logs(emp_id, date);

  CREATE TABLE IF NOT EXISTS broadcasts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message TEXT NOT NULL,
    author_id INTEGER,
    author_name TEXT,
    color TEXT DEFAULT 'amber',
    pinned INTEGER DEFAULT 1,
    expires_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS broadcast_dismissals (
    broadcast_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    dismissed_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (broadcast_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS lead_university_applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    university TEXT NOT NULL,
    program TEXT,
    status TEXT NOT NULL DEFAULT 'documents', -- documents | ready | submitted | admitted | returned | rejected
    application_id TEXT,         -- university's reference / file number
    submitted_on TEXT,
    decision_on TEXT,
    notes TEXT,
    updated_by TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_uniapp_lead ON lead_university_applications(lead_id);

  CREATE TABLE IF NOT EXISTS lead_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    doc_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',  -- pending | received | verified | rejected | not_required
    notes TEXT,
    file_url TEXT,
    received_on TEXT,
    updated_by TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_docs_lead ON lead_documents(lead_id);

  CREATE TABLE IF NOT EXISTS activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    actor_user_id INTEGER,
    actor_name TEXT,
    lead_id INTEGER,
    lead_name TEXT,
    amount REAL,
    from_value TEXT,
    to_value TEXT,
    details TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_log(created_at);
  CREATE INDEX IF NOT EXISTS idx_activity_lead    ON activity_log(lead_id);
  CREATE INDEX IF NOT EXISTS idx_activity_actor   ON activity_log(actor_user_id);

  CREATE TABLE IF NOT EXISTS payroll (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    month TEXT NOT NULL,                  -- YYYY-MM
    emp_id TEXT NOT NULL,
    name TEXT,
    base_salary REAL DEFAULT 0,
    days_worked INTEGER DEFAULT 0,
    working_days INTEGER DEFAULT 0,
    bonus REAL DEFAULT 0,
    deductions REAL DEFAULT 0,
    net_pay REAL DEFAULT 0,
    paid_on TEXT,
    status TEXT DEFAULT 'pending',
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(month, emp_id, name)
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
    `ALTER TABLE users      ADD COLUMN emp_id TEXT`,
    `ALTER TABLE leads      ADD COLUMN application_stage TEXT`,
    `ALTER TABLE leads      ADD COLUMN visa_deadline TEXT`,
    `ALTER TABLE leads      ADD COLUMN departure_date TEXT`,
    `ALTER TABLE leads      ADD COLUMN intake_term TEXT`,
    `ALTER TABLE leads      ADD COLUMN university TEXT`,
    `ALTER TABLE leads      ADD COLUMN application_notes TEXT`,
    // Excel-aligned fields (from File Updates 2026.xlsx)
    `ALTER TABLE leads      ADD COLUMN source TEXT`,
    `ALTER TABLE leads      ADD COLUMN referrer TEXT`,
    `ALTER TABLE leads      ADD COLUMN nationality TEXT`,
    `ALTER TABLE leads      ADD COLUMN passport TEXT`,
    `ALTER TABLE leads      ADD COLUMN degree TEXT`,
    `ALTER TABLE leads      ADD COLUMN major TEXT`,
    `ALTER TABLE leads      ADD COLUMN drive_link TEXT`,
    `ALTER TABLE leads      ADD COLUMN deposit REAL DEFAULT 0`,
    // Student portal + medical
    `ALTER TABLE leads      ADD COLUMN public_token TEXT`,
    `ALTER TABLE leads      ADD COLUMN public_enabled INTEGER DEFAULT 1`,
    `ALTER TABLE leads      ADD COLUMN blood_group TEXT`,
    `ALTER TABLE leads      ADD COLUMN date_of_birth TEXT`,
    `ALTER TABLE leads      ADD COLUMN medical_notes TEXT`,
    `ALTER TABLE leads      ADD COLUMN emergency_contact TEXT`,
    // Student-facing document requests
    `ALTER TABLE lead_documents ADD COLUMN requested_by_student INTEGER DEFAULT 0`,
    `ALTER TABLE lead_documents ADD COLUMN student_uploaded_url TEXT`,
    `ALTER TABLE lead_documents ADD COLUMN student_uploaded_at TEXT`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_public_token ON leads(public_token)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_wa_id ON messages(wa_message_id)`,
    `ALTER TABLE income ADD COLUMN exclude_from_cash INTEGER DEFAULT 0`,
  ];
  migrations.forEach(m => { try { db.exec(m); } catch {} });

  // Custom migration for payroll UNIQUE constraint
  try {
    const sql = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='payroll'").get()?.sql || "";
    if (sql.includes("UNIQUE(month, emp_id)") && !sql.includes("UNIQUE(month, emp_id, name)")) {
      console.log("[migration] Updating payroll unique constraint to UNIQUE(month, emp_id, name)...");
      db.exec(`
        CREATE TABLE payroll_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          month TEXT NOT NULL,
          emp_id TEXT NOT NULL,
          name TEXT,
          base_salary REAL DEFAULT 0,
          days_worked INTEGER DEFAULT 0,
          working_days INTEGER DEFAULT 0,
          bonus REAL DEFAULT 0,
          deductions REAL DEFAULT 0,
          net_pay REAL DEFAULT 0,
          paid_on TEXT,
          status TEXT DEFAULT 'pending',
          notes TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          UNIQUE(month, emp_id, name)
        );
        INSERT INTO payroll_new (id, month, emp_id, name, base_salary, days_worked, working_days, bonus, deductions, net_pay, paid_on, status, notes, created_at)
        SELECT id, month, emp_id, name, base_salary, days_worked, working_days, bonus, deductions, net_pay, paid_on, status, notes, created_at FROM payroll;
        DROP TABLE payroll;
        ALTER TABLE payroll_new RENAME TO payroll;
      `);
      console.log("[migration] Payroll unique constraint updated successfully!");
    }
  } catch (e) {
    console.error("[migration] Payroll update failed:", e.message);
  }

  // Dynamic self-healing migration to reset and force file stages config to the updated user pipeline
  try {
    const newStages = [
      'Documents Collecting',
      'Documents Ready',
      'Applied to University',
      'Interview',
      'Pre-Admission',
      'Deposit',
      'Admission/JW Received',
      'Visa Applied',
      'Visa Approved',
      'Visa Rejected',
      'Enrolled',
      'Cancelled',
      'Withdraw'
    ];
    db.prepare("INSERT OR REPLACE INTO meta_config (key, value) VALUES ('settings_fileStages', ?)").run(JSON.stringify(newStages));
    console.log("[migration] Updated settings_fileStages in database to user requested default flow.");

    // Migrate any existing legacy application stages in leads table to their closest new counterparts
    db.prepare("UPDATE leads SET application_stage = 'submitted' WHERE application_stage = 'in_review'").run();
    db.prepare("UPDATE leads SET application_stage = 'admitted' WHERE application_stage = 'jw202'").run();
    db.prepare("UPDATE leads SET application_stage = 'submitted' WHERE application_stage = 'rejected'").run();
    db.prepare("UPDATE leads SET application_stage = 'visa_approved' WHERE application_stage = 'payment_complete'").run();
    console.log("[migration] Successfully remapped legacy lead stages.");
  } catch (e) {
    console.error("[migration] settings_fileStages reset/remap failed:", e.message);
  }

  // Self-healing migration to rename legacy source names in existing leads
  try {
    db.prepare("UPDATE leads SET source = 'China' WHERE source = 'China Agent'").run();
    db.prepare("UPDATE leads SET source = 'B2B' WHERE source = 'Agent'").run();
    db.prepare("UPDATE leads SET source = 'In-House' WHERE source = 'In-house'").run();
    console.log("[migration] Migrated existing source names to China, B2B, and In-House.");
  } catch (e) {
    console.error("[migration] Remap source names failed:", e.message);
  }

  // Self-healing migration to seed pre-June 2026 partner investments
  try {
    // Delete duplicate cumulative entries if they exist
    db.prepare("DELETE FROM income WHERE notes LIKE 'Pre-June 2026 %'").run();

    db.prepare("UPDATE income SET client_name = 'Sakib Al Jubaer' WHERE category='Investment' AND client_name IN ('Sakib', 'Sakib Al Jubaer')").run();

    const investments = [
      { name: 'Abdullah Al Rakib', date: '2024-09-01', month: '2024-09', ref: 'Capital Injection 2024', val: 281800 },
      { name: 'Abdullah Al Rakib', date: '2025-09-01', month: '2025-09', ref: 'Capital Injection 2025', val: 387915 },
      { name: 'Sakib Al Jubaer',    date: '2025-09-01', month: '2025-09', ref: 'Capital Injection 2025', val: 37000 },
      { name: 'Tahmid Imam',        date: '2024-09-01', month: '2024-09', ref: 'Capital Injection 2024', val: 100100 },
      { name: 'Tahmid Imam',        date: '2025-09-01', month: '2025-09', ref: 'Capital Injection 2025', val: 70000 },
      { name: 'Tahmid Imam',        date: '2026-01-15', month: '2026-01', ref: 'Capital Injection 2026', val: 96521 }
    ];

    const check = db.prepare("SELECT COUNT(*) as c FROM income WHERE category='Investment' AND client_name=? AND reference=?");
    const insert = db.prepare(`INSERT INTO income (date, month, category, client_name, reference, amount, notes)
                               VALUES (?, ?, 'Investment', ?, ?, ?, 'Consolidated capital injection pre-data')`);
    
    investments.forEach(inv => {
      if (check.get(inv.name, inv.ref).c === 0) {
        insert.run(inv.date, inv.month, inv.name, inv.ref, inv.val);
        console.log(`[migration] Seeded investment for ${inv.name}: ${inv.val} BDT`);
      }
    });

    // Exclude prior investments from cash calculations (except Sakib's last 100k)
    db.prepare(`
      UPDATE income 
      SET exclude_from_cash = 1 
      WHERE category = 'Investment' 
        AND NOT (client_name = 'Sakib Al Jubaer' AND amount = 100000 AND date = '2026-05-15')
    `).run();

    console.log("[migration] Partner investments self-healing checks complete.");
  } catch (e) {
    console.error("[migration] Seeding partner investments failed:", e.message);
  }

  // Self-healing migration to set the WhatsApp channel consultant to "Abdullah Al Rakib"
  try {
    const info = db.prepare("UPDATE channels SET consultant = 'Abdullah Al Rakib' WHERE type = 'whatsapp'").run();
    if (info.changes > 0) {
      console.log(`[migration] Updated ${info.changes} WhatsApp channels consultant to Abdullah Al Rakib.`);
    }
  } catch (e) {
    console.error("[migration] Failed to set WhatsApp channel consultant:", e.message);
  }

  // Self-healing migration to assign "Abdullah Al Rakib" to any existing unassigned WhatsApp leads
  try {
    const info = db.prepare(`
      UPDATE leads 
      SET assigned_consultant = 'Abdullah Al Rakib' 
      WHERE (assigned_consultant IS NULL OR assigned_consultant = '') 
        AND (lead_source = 'WhatsApp' OR id IN (
          SELECT DISTINCT lead_id FROM conversations WHERE channel_type = 'whatsapp' AND lead_id IS NOT NULL
        ))
    `).run();
    if (info.changes > 0) {
      console.log(`[migration] Updated ${info.changes} unassigned WhatsApp leads to consultant Abdullah Al Rakib.`);
    }
  } catch (e) {
    console.error("[migration] Failed to set WhatsApp leads consultant:", e.message);
  }

  // Self-healing migration to ensure all conversations have status set
  try {
    const info = db.prepare("UPDATE conversations SET status = 'open' WHERE status IS NULL OR status = ''").run();
    if (info.changes > 0) {
      console.log(`[migration] Self-healed ${info.changes} conversations with NULL/empty status to 'open'.`);
    }
  } catch (e) {
    console.error("[migration] Failed to self-heal conversations status:", e.message);
  }
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

  // Seed the first admin user if there are none yet
  if (db.prepare('SELECT COUNT(*) as c FROM users').get().c === 0) {
    const email = process.env.ADMIN_EMAIL    || 'admin@eduexpressint.com';
    const pass  = process.env.ADMIN_PASSWORD || 'ChangeMe!2026';
    db.prepare(`INSERT INTO users (email,name,password_hash,role) VALUES (?,?,?,?)`)
      .run(email.toLowerCase(), 'Administrator', hashPassword(pass), 'admin');
    console.log(`🔐 Seeded admin user: ${email}  (password set from ADMIN_PASSWORD env or default)`);
  }
}

// ─────────────────────────────────────────────────────────
// SSE REAL-TIME BROADCAST
// ─────────────────────────────────────────────────────────
// Each SSE client = { res, user }. The user object lets us push only to admins,
// or only to the consultant who owns a specific lead.
const sseClients = new Map();

app.get('/api/events', (req, res) => {
  // Auth via cookie — EventSource always sends cookies, no extra setup needed.
  const payload = verifyToken(getCookie(req, AUTH_COOKIE));
  if (!payload) return res.status(401).end();

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');   // disables nginx buffering
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.flushHeaders();

  const id = Date.now() + Math.random();
  sseClients.set(id, { res, user: payload });
  res.write(`data: ${JSON.stringify({ type: 'connected', id })}\n\n`);
  if (typeof res.flush === 'function') res.flush();

  const ping = setInterval(() => {
    try {
      res.write(`: ping\n\n`);
      if (typeof res.flush === 'function') res.flush();
    } catch { clearInterval(ping); sseClients.delete(id); }
  }, 20000);

  req.on('close', () => { clearInterval(ping); sseClients.delete(id); });
});

// Broadcast to every connected client. Optional `filter(user)` decides whether
// to send to a given client — used to scope notifications by role/consultant.
function broadcast(type, data, filter = null) {
  const msg = `data: ${JSON.stringify({ type, ...data })}\n\n`;
  sseClients.forEach((client, id) => {
    if (filter && !filter(client.user)) return;
    try {
      client.res.write(msg);
      if (typeof client.res.flush === 'function') client.res.flush();
    } catch {
      sseClients.delete(id);
    }
  });
}

// Push a freshly-logged activity to the people who should see it.
// Admins see everything; consultants only see activities about their own leads.
function broadcastActivity(row) {
  if (!row) return;
  broadcast('activity', { activity: row }, (u) => {
    if (u?.role === 'admin') return true;
    if (!row.lead_id) return false;
    // Cheap consultant-scope check — does this user own this lead?
    const consultant = u?.consultant_name || u?.name;
    if (!consultant) return false;
    try {
      const lead = db.prepare("SELECT assigned_consultant FROM leads WHERE id=?").get(row.lead_id);
      return lead && lead.assigned_consultant === consultant;
    } catch { return false; }
  });
}

// ─────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────
function nextLeadId() {
  const row = db.prepare("SELECT lead_id FROM leads WHERE lead_id LIKE 'L-%' ORDER BY CAST(SUBSTR(lead_id,3) AS INTEGER) DESC LIMIT 1").get();
  return 'L-' + String(parseInt((row?.lead_id || 'L-00000').replace('L-', '')) + 1).padStart(5, '0');
}

function nextChinaLeadId() {
  const row = db.prepare("SELECT lead_id FROM leads WHERE lead_id LIKE 'C-%' ORDER BY CAST(SUBSTR(lead_id,3) AS INTEGER) DESC LIMIT 1").get();
  const nextNum = row ? parseInt(row.lead_id.replace('C-', '')) + 1 : 1;
  return 'C-' + String(nextNum).padStart(5, '0');
}

function getConfig(key) {
  return db.prepare("SELECT value FROM meta_config WHERE key=?").get(key)?.value || null;
}

/* Activity log — concise audit trail of the changes an owner actually cares
   about. Never throws (logging is best-effort), always returns synchronously.
   Types: lead_created, lead_status_changed, lead_assigned, lead_payment,
          payment_recorded, expense_recorded, user_created, attendance_in. */
function logActivity({ type, actor, lead, amount, from, to, details }) {
  try {
    const info = db.prepare(`INSERT INTO activity_log
        (type, actor_user_id, actor_name, lead_id, lead_name, amount, from_value, to_value, details)
        VALUES (?,?,?,?,?,?,?,?,?)`).run(
      type,
      actor?.id || null,
      actor?.name || actor?.email || 'System',
      lead?.id || null,
      lead?.client_name || lead?.lead_id || null,
      amount ?? null,
      from == null ? null : String(from),
      to   == null ? null : String(to),
      details ? (typeof details === 'string' ? details : JSON.stringify(details)) : null,
    );
    // Push to connected clients so the bell + Cockpit feed update instantly
    const row = db.prepare("SELECT * FROM activity_log WHERE id=?").get(info.lastInsertRowid);
    if (typeof broadcastActivity === 'function') broadcastActivity(row);
  } catch (e) { console.error('[activity]', e.message); }
}

function setConfig(key, value) {
  db.prepare(`INSERT INTO meta_config (key,value) VALUES (?,?)
              ON CONFLICT(key) DO UPDATE SET value=excluded.value`)
    .run(key, value == null ? null : String(value));
}

/* ─── Auto attendance helpers ─────────────────────────────────────────────
   - Find the employee record linked to a logged-in user (by emp_id or email)
   - Close any of their previous-day open check-ins to the configured close time
   - Auto check-in for today (optionally gated by a configured office geofence)
*/
function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function findEmployeeForUser(user) {
  if (!user) return null;
  // Match by email first (most precise, unique identifier)
  if (user.email) {
    const e = db.prepare("SELECT * FROM employees WHERE LOWER(email)=LOWER(?) AND active='Yes'").get(user.email);
    if (e) return e;
  }
  // If no email match, search by Employee ID and resolve duplicates by name
  if (user.emp_id) {
    const list = db.prepare("SELECT * FROM employees WHERE emp_id=? AND active='Yes'").all(user.emp_id);
    if (list.length === 1) return list[0];
    if (list.length > 1 && user.name) {
      const exact = list.find(e => 
        e.name.toLowerCase().includes(user.name.toLowerCase()) || 
        user.name.toLowerCase().includes(e.name.toLowerCase())
      );
      if (exact) return exact;
    }
    if (list.length > 0) return list[0];
  }
  return null;
}
function timeToHours(hhmm) {
  if (!hhmm || !/^\d{1,2}:\d{2}/.test(hhmm)) return null;
  const [h, m] = hhmm.split(':').map(Number);
  return h + m / 60;
}
function autoCloseStaleAttendance(emp, today) {
  const closeTime = getConfig('office_close_time') || '18:00';
  const stale = db.prepare("SELECT id, check_in, date FROM attendance WHERE emp_id=? AND check_out IS NULL AND date < ?").all(emp.emp_id, today);
  for (const s of stale) {
    const start = timeToHours(s.check_in) ?? 9.5;
    const end   = timeToHours(closeTime) ?? 18;
    const hours = Math.max(0, +(end - start).toFixed(2));
    db.prepare("UPDATE attendance SET check_out=?, hours_worked=?, source=COALESCE(source,'manual')||'+auto-close' WHERE id=?")
      .run(closeTime, hours, s.id);
  }
  return stale.length;
}
function autoCheckIn(user, opts = {}) {
  const emp = findEmployeeForUser(user);
  if (!emp) return { ok: false, reason: 'no_linked_employee' };

  const today = new Date().toISOString().slice(0, 10);
  autoCloseStaleAttendance(emp, today);

  // Office Wi-Fi SSID Verification
  const officeSSID = getConfig('office_wifi_ssid');
  const onOfficeWifi = officeSSID && opts.ssid && String(opts.ssid).toLowerCase().trim() === String(officeSSID).toLowerCase().trim();

  // Already checked in today?
  const existing = db.prepare("SELECT * FROM attendance WHERE emp_id=? AND date=?").get(emp.emp_id, today);
  
  if (existing) {
    if (onOfficeWifi && existing.source !== 'wifi') {
      db.prepare("UPDATE attendance SET source='wifi', ssid=? WHERE id=?").run(opts.ssid, existing.id);
    }
    return { ok: true, alreadyIn: true, id: existing.id };
  }

  // Geofence Check (bypass if they are verified on Office Wi-Fi)
  if (!onOfficeWifi) {
    const olat = parseFloat(getConfig('office_lat'));
    const olng = parseFloat(getConfig('office_lng'));
    const radius = parseInt(getConfig('office_radius_m')) || 200;
    if (Number.isFinite(olat) && Number.isFinite(olng)) {
      if (!Number.isFinite(opts.lat) || !Number.isFinite(opts.lng)) {
        return { ok: false, reason: 'no_location' };
      }
      const d = haversineMeters(olat, olng, opts.lat, opts.lng);
      if (d > radius) return { ok: false, reason: 'outside_office', distance: Math.round(d) };
    }
  }

  const now = new Date();
  const time = now.toTimeString().slice(0, 5);
  const openTime = timeToHours(getConfig('office_open_time') || '09:30');
  const lateAfter = openTime != null ? openTime + 0.25 : 9.75; // 15-min grace
  const status = timeToHours(time) > lateAfter ? 'Late' : 'Present';

  const source = onOfficeWifi ? 'wifi' : 'auto-login';
  const ssid = onOfficeWifi ? opts.ssid : '';

  const info = db.prepare("INSERT INTO attendance (emp_id, name, date, check_in, status, source, ssid) VALUES (?,?,?,?,?,?,?)")
    .run(emp.emp_id, emp.name, today, time, status, source, ssid);
    
  logActivity({ 
    type: 'attendance_in', 
    actor: { id: user.id, name: user.name || emp.name }, 
    to: time, 
    details: { emp_id: emp.emp_id, status, source, ssid } 
  });
  
  return { ok: true, created: info.lastInsertRowid, status, time, source, ssid };
}

function upsertContact({ name, phone, wa_id, messenger_id, instagram_id, email, avatar_url }) {
  const existing = wa_id
    ? db.prepare("SELECT * FROM contacts WHERE wa_id=?").get(wa_id)
    : messenger_id
    ? db.prepare("SELECT * FROM contacts WHERE messenger_id=?").get(messenger_id)
    : instagram_id
    ? db.prepare("SELECT * FROM contacts WHERE instagram_id=?").get(instagram_id)
    : phone ? db.prepare("SELECT * FROM contacts WHERE phone=?").get(phone) : null;

  if (existing) {
    // Fill in a real name / avatar if we now have one and didn't before
    if (name && (!existing.name || existing.name === 'Unknown' || existing.name.endsWith(' User')))
      db.prepare("UPDATE contacts SET name=? WHERE id=?").run(name, existing.id);
    if (avatar_url && !existing.avatar_url)
      db.prepare("UPDATE contacts SET avatar_url=? WHERE id=?").run(avatar_url, existing.id);
    return existing;
  }
  const info = db.prepare(`INSERT INTO contacts (name,phone,email,wa_id,messenger_id,instagram_id,avatar_url) VALUES (?,?,?,?,?,?,?)`)
    .run(name || 'Unknown', phone || null, email || null, wa_id || null, messenger_id || null, instagram_id || null, avatar_url || null);
  return db.prepare("SELECT * FROM contacts WHERE id=?").get(info.lastInsertRowid);
}

function upsertConversation(contactId, channelId, channelType) {
  const existing = db.prepare("SELECT * FROM conversations WHERE contact_id=? AND channel_id=? AND status != 'resolved'").get(contactId, channelId);
  if (existing) return existing;
  const info = db.prepare(`INSERT INTO conversations (contact_id,channel_id,channel_type,status) VALUES (?,?,?,'open')`).run(contactId, channelId, channelType);
  return db.prepare("SELECT * FROM conversations WHERE id=?").get(info.lastInsertRowid);
}

function createLeadFromContact(contactId, source, initialMessage) {
  try {
    const contact = db.prepare("SELECT * FROM contacts WHERE id=?").get(contactId);
    if (!contact || contact.lead_id) return null;

    const lead_id = nextLeadId();
    const client_name = contact.name || (source === 'whatsapp' ? 'WhatsApp Inquiry' : source === 'messenger' ? 'Messenger Inquiry' : 'Instagram Inquiry');
    const phone = contact.phone || null;
    const email = contact.email || null;

    // Find the channel consultant for this contact's conversation
    let assigned_consultant = null;
    const lastConv = db.prepare("SELECT channel_id FROM conversations WHERE contact_id=? ORDER BY id DESC LIMIT 1").get(contactId);
    if (lastConv) {
      const chan = db.prepare("SELECT consultant FROM channels WHERE id=?").get(lastConv.channel_id);
      if (chan) {
        assigned_consultant = chan.consultant;
      }
    }

    const params = leadParams({
      client_name,
      phone,
      email,
      lead_source: source === 'whatsapp' ? 'WhatsApp' : source === 'messenger' ? 'Messenger' : 'Instagram',
      lead_status: 'New Lead',
      assigned_consultant,
      notes: initialMessage ? `Initial Inquiry: "${initialMessage}"` : `Auto-created from ${source} chat integration.`
    }, lead_id, 0);

    const info = db.prepare(LEAD_INSERT_SQL).run(params);
    const lead = db.prepare("SELECT * FROM leads WHERE id=?").get(info.lastInsertRowid);

    if (lead) {
      db.prepare("UPDATE contacts SET lead_id=? WHERE id=?").run(lead.id, contact.id);
      db.prepare("UPDATE conversations SET lead_id=? WHERE contact_id=?").run(lead.id, contact.id);
      
      logActivity({
        type: 'lead_created',
        actor: { name: 'Meta Automation' },
        lead,
        details: { source: lead.lead_source, note: 'Automatically created from chat integration' }
      });

      broadcast('new_lead', { lead });
      console.log(`✅ Auto-created Lead from ${source}: ${lead_id} — ${client_name}`);
      return lead;
    }
  } catch(e) {
    console.error('Error auto-creating lead from contact:', e.message);
  }
  return null;
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
  const cleanTo = to.replace(/\D/g, '');
  const url = `https://graph.facebook.com/v19.0/${channel.phone_number_id}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${channel.access_token}` },
    body: JSON.stringify({ messaging_product: 'whatsapp', to: cleanTo, type: 'text', text: { body: text } })
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
  const isConsultant = req.user?.role === 'consultant';
  const meName = req.user?.consultant_name || req.user?.name || '';
  const meClean = meName.split(' ')[0];
  
  let ws = "WHERE (source IS NULL OR source != 'China') AND (lead_id IS NULL OR lead_id NOT LIKE 'C-%')";
  const params = {};
  if (isConsultant) {
    ws += " AND (TRIM(LOWER(assigned_consultant)) = TRIM(LOWER(@me)) OR TRIM(LOWER(assigned_consultant)) = TRIM(LOWER(@meClean)) OR TRIM(LOWER(@me)) LIKE '%' || TRIM(LOWER(assigned_consultant)) || '%' OR TRIM(LOWER(assigned_consultant)) LIKE '%' || TRIM(LOWER(@meClean)) || '%')";
    params.me = meName;
    params.meClean = meClean;
  }

  const pipeline     = db.prepare(`SELECT lead_status, COUNT(*) as count FROM leads ${ws} GROUP BY lead_status`).all(params);
  const total        = db.prepare(`SELECT COUNT(*) as c FROM leads ${ws}`).get(params).c;
  const today        = new Date().toISOString().slice(0, 10);
  const followupToday= db.prepare(`SELECT COUNT(*) as c FROM leads ${ws ? ws + ' AND' : 'WHERE'} next_followup=@today`).get({ ...params, today }).c;
  const recentLeads  = db.prepare(`SELECT * FROM leads ${ws} ORDER BY id DESC LIMIT 5`).all(params);
  const totalPaid    = db.prepare(`SELECT SUM(paid) as s FROM leads ${ws}`).get(params).s || 0;
  const metaLeads    = db.prepare(`SELECT COUNT(*) as c FROM leads ${ws ? ws + ' AND' : 'WHERE'} meta_lead_id IS NOT NULL`).get(params).c;
  const openConvs    = db.prepare("SELECT COUNT(*) as c FROM conversations WHERE status='open'").get().c;
  const unreadMsgs   = db.prepare("SELECT SUM(unread_count) as s FROM conversations").get().s || 0;
  res.json({ pipeline, total, followupToday, recentLeads, totalPaid, metaLeads, openConvs, unreadMsgs });
});

// ─────────────────────────────────────────────────────────
// LEADS
// ─────────────────────────────────────────────────────────
app.get('/api/leads', (req, res) => {
  const { search, status, consultant, destination, source, page = 1, limit = 50 } = req.query;
  const where = ["(source IS NULL OR source != 'China') AND (lead_id IS NULL OR lead_id NOT LIKE 'C-%')"]; const params = {};
  if (search && search !== 'undefined' && search !== 'null') { where.push("(client_name LIKE @search OR phone LIKE @search OR lead_id LIKE @search OR email LIKE @search)"); params.search = `%${search}%`; }
  if (status)      { where.push("lead_status=@status");           params.status = status; }
  if (consultant)  { where.push("assigned_consultant=@consultant");params.consultant = consultant; }
  if (destination) { where.push("destination=@destination");      params.destination = destination; }
  if (source === 'meta') where.push("meta_lead_id IS NOT NULL");
  // Consultants are scoped to their own assigned leads — enforced server-side.
  // Admins and Application Managers see everything.
  if (req.user?.role === 'consultant') {
    const meName = req.user.consultant_name || req.user.name || '';
    const meClean = meName.split(' ')[0];
    where.push("(TRIM(LOWER(assigned_consultant)) = TRIM(LOWER(@me)) OR TRIM(LOWER(assigned_consultant)) = TRIM(LOWER(@meClean)) OR TRIM(LOWER(@me)) LIKE '%' || TRIM(LOWER(assigned_consultant)) || '%' OR TRIM(LOWER(assigned_consultant)) LIKE '%' || TRIM(LOWER(@meClean)) || '%')");
    params.me = meName;
    params.meClean = meClean;
  }
  const ws = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const total  = db.prepare(`SELECT COUNT(*) as c FROM leads ${ws}`).get(params).c;
  const leads  = db.prepare(`SELECT * FROM leads ${ws} ORDER BY id DESC LIMIT ${limit} OFFSET ${offset}`).all(params);
  res.json({ leads, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
});
app.get('/api/leads/:id', (req, res) => {
  const lead = db.prepare("SELECT * FROM leads WHERE id=? OR lead_id=?").get(req.params.id, req.params.id);
  if (!lead) return res.status(404).json({ error: 'Not found' });
  if (!leadIsVisibleTo(lead, req.user)) {
    return res.status(403).json({ error: 'Access denied to this lead record' });
  }
  res.json(lead);
});
// Build a uniform params object for the lead create/update statements.
// Whitelist exactly the columns we persist so unknown fields in req.body
// can't slip into the SQL.
function leadParams(d, lead_id, balance) {
  const num = v => v === '' || v == null ? 0 : Number(v);
  const txt = v => (v === '' || v == null) ? null : v;
  return {
    lead_id, balance,
    date_added: d.date_added || new Date().toISOString().slice(0,10),
    client_name: d.client_name,
    phone: d.phone, email: d.email,
    destination: txt(d.destination),
    last_education: txt(d.last_education),
    gpa: d.gpa === '' || d.gpa == null ? null : Number(d.gpa),
    english_score: txt(d.english_score),
    program: txt(d.program || d.major),
    lead_source: d.lead_source || 'Manual',
    lead_status: d.lead_status || 'New Lead',
    assigned_consultant: txt(d.assigned_consultant),
    service_fee: num(d.service_fee), paid: num(d.paid),
    payment_status: txt(d.payment_status),
    next_followup: txt(d.next_followup),
    notes: txt(d.notes),
    meta_lead_id: txt(d.meta_lead_id), meta_form_id: txt(d.meta_form_id),
    meta_ad_id: txt(d.meta_ad_id), meta_campaign: txt(d.meta_campaign),
    // Excel-aligned
    source: txt(d.source), referrer: txt(d.referrer),
    nationality: txt(d.nationality), passport: txt(d.passport),
    degree: txt(d.degree), major: txt(d.major),
    intake_term: txt(d.intake_term), university: txt(d.university),
    drive_link: txt(d.drive_link), deposit: num(d.deposit),
    // Medical
    blood_group: txt(d.blood_group), date_of_birth: txt(d.date_of_birth),
    medical_notes: txt(d.medical_notes), emergency_contact: txt(d.emergency_contact),
    // Active application stage
    application_stage: txt(d.application_stage),
  };
}

const LEAD_INSERT_SQL = `INSERT INTO leads (
  lead_id, date_added, client_name, phone, email, destination, last_education, gpa,
  english_score, program, lead_source, lead_status, assigned_consultant,
  service_fee, paid, balance, payment_status, next_followup, notes,
  meta_lead_id, meta_form_id, meta_ad_id, meta_campaign,
  source, referrer, nationality, passport, degree, major, intake_term, university,
  drive_link, deposit, blood_group, date_of_birth, medical_notes, emergency_contact,
  application_stage
) VALUES (
  @lead_id, @date_added, @client_name, @phone, @email, @destination, @last_education, @gpa,
  @english_score, @program, @lead_source, @lead_status, @assigned_consultant,
  @service_fee, @paid, @balance, @payment_status, @next_followup, @notes,
  @meta_lead_id, @meta_form_id, @meta_ad_id, @meta_campaign,
  @source, @referrer, @nationality, @passport, @degree, @major, @intake_term, @university,
  @drive_link, @deposit, @blood_group, @date_of_birth, @medical_notes, @emergency_contact,
  @application_stage
)`;
const LEAD_UPDATE_SQL = `UPDATE leads SET
  client_name=@client_name, phone=@phone, email=@email, destination=@destination,
  last_education=@last_education, gpa=@gpa, english_score=@english_score, program=@program,
  lead_source=@lead_source, lead_status=@lead_status, assigned_consultant=@assigned_consultant,
  service_fee=@service_fee, paid=@paid, balance=@balance, payment_status=@payment_status,
  next_followup=@next_followup, notes=@notes,
  source=@source, referrer=@referrer, nationality=@nationality, passport=@passport,
  degree=@degree, major=@major, intake_term=@intake_term, university=@university,
  drive_link=@drive_link, deposit=@deposit,
  blood_group=@blood_group, date_of_birth=@date_of_birth, medical_notes=@medical_notes,
  emergency_contact=@emergency_contact,
  application_stage=@application_stage
WHERE id=@id`;

app.post('/api/leads', async (req, res) => {
  const d = req.body;
  const isChinaApp = d.isChinaApp || d.source === 'China' || (d.lead_id && String(d.lead_id).startsWith('C-'));
  const isChinaAuthorized = req.user?.role === 'manager' || req.user?.email === 'admin@eduexpressint.com';
  if (isChinaApp && !isChinaAuthorized) {
    return res.status(403).json({ error: 'Access denied: only Super Admin and Application Manager can add China inside student records.' });
  }
  const lead_id = d.lead_id || (isChinaApp ? nextChinaLeadId() : nextLeadId());
  const balance = (parseFloat(d.service_fee)||0) - (parseFloat(d.paid)||0);
  const params = leadParams(d, lead_id, balance);
  const info = db.prepare(LEAD_INSERT_SQL).run(params);
  const lead = db.prepare("SELECT * FROM leads WHERE id=?").get(info.lastInsertRowid);
  sendCAPIEvent('Lead', lead);
  logActivity({ type: 'lead_created', actor: req.user, lead, details: { source: lead.lead_source, destination: lead.destination, assigned_consultant: lead.assigned_consultant } });
  if (lead.assigned_consultant)
    logActivity({ type: 'lead_assigned', actor: req.user, lead, to: lead.assigned_consultant });
  res.json(lead);
});

app.put('/api/leads/:id', async (req, res) => {
  const d = req.body;
  const oldLead = db.prepare("SELECT * FROM leads WHERE id=?").get(req.params.id);
  if (!oldLead) return res.status(404).json({ error: 'Not found' });
  if (!leadIsVisibleTo(oldLead, req.user)) {
    return res.status(403).json({ error: 'Access denied to this lead record' });
  }
  const isChinaApp = d.source === 'China' || oldLead.source === 'China' || (d.lead_id && String(d.lead_id).startsWith('C-')) || (oldLead.lead_id && String(oldLead.lead_id).startsWith('C-'));
  const isChinaAuthorized = req.user?.role === 'manager' || req.user?.email === 'admin@eduexpressint.com';
  if (isChinaApp && !isChinaAuthorized) {
    return res.status(403).json({ error: 'Access denied: only Super Admin and Application Manager can edit China inside student records.' });
  }
  const balance = (parseFloat(d.service_fee)||0) - (parseFloat(d.paid)||0);
  const params = leadParams(d, oldLead.lead_id, balance);
  db.prepare(LEAD_UPDATE_SQL).run({ ...params, id: req.params.id });
  const lead = db.prepare("SELECT * FROM leads WHERE id=?").get(req.params.id);

  // Audit the changes that matter to an owner.
  if (oldLead?.lead_status !== lead.lead_status) {
    logActivity({ type: 'lead_status_changed', actor: req.user, lead, from: oldLead?.lead_status, to: lead.lead_status });
    const evtMap = { 'Enrolled':'Purchase','File Opened':'InitiateCheckout','Office Visited':'Schedule','Positive':'Lead' };
    if (evtMap[lead.lead_status]) sendCAPIEvent(evtMap[lead.lead_status], lead);
  }
  if ((oldLead?.assigned_consultant || '') !== (lead.assigned_consultant || '')) {
    logActivity({ type: 'lead_assigned', actor: req.user, lead, from: oldLead?.assigned_consultant, to: lead.assigned_consultant });
  }
  if ((parseFloat(oldLead?.paid) || 0) !== (parseFloat(lead.paid) || 0)) {
    const delta = (parseFloat(lead.paid) || 0) - (parseFloat(oldLead?.paid) || 0);
    if (delta !== 0) logActivity({ type: 'lead_payment', actor: req.user, lead, amount: delta, from: oldLead.paid, to: lead.paid });
  }
  res.json(lead);
});
app.delete('/api/leads/:id', (req, res) => {
  const lead = db.prepare("SELECT * FROM leads WHERE id=?").get(req.params.id);
  if (!lead) return res.status(404).json({ error: 'Not found' });
  if (!leadIsVisibleTo(lead, req.user)) {
    return res.status(403).json({ error: 'Access denied to this lead record' });
  }
  const isChinaApp = lead.source === 'China' || (lead.lead_id && String(lead.lead_id).startsWith('C-'));
  const isChinaAuthorized = req.user?.role === 'manager' || req.user?.email === 'admin@eduexpressint.com';
  if (isChinaApp && !isChinaAuthorized) {
    return res.status(403).json({ error: 'Access denied: only Super Admin and Application Manager can delete China inside student records.' });
  }
  db.prepare("DELETE FROM leads WHERE id=?").run(req.params.id);
  res.json({ ok: true });
});

// ─── LEAD TIMELINE — full chronological story of one lead ──────────────────
// Merges activity_log entries for this lead with related income rows so the
// owner sees one single feed: created, status changes, reassignments, every
// payment (whether logged inline or as a separate income row), notes,
// university-application status flips, etc.
app.get('/api/leads/:id/timeline', (req, res) => {
  const lead = db.prepare("SELECT * FROM leads WHERE id=? OR lead_id=?").get(req.params.id, req.params.id);
  if (!lead) return res.status(404).json({ error: 'Not found' });
  if (!leadIsVisibleTo(lead, req.user)) return res.status(403).json({ error: 'Not your lead' });

  // 1) Activity log entries tied to this lead (numeric id link)
  const activities = db.prepare("SELECT * FROM activity_log WHERE lead_id=? ORDER BY id DESC LIMIT 500").all(lead.id);

  // 2) Income rows that reference the human lead_id — useful for older entries
  //    that were recorded before the activity log existed.
  const incomes = lead.lead_id
    ? db.prepare("SELECT id, date, amount, category, reference, notes FROM income WHERE lead_id=? ORDER BY id DESC").all(lead.lead_id)
    : [];

  // De-dupe: if we already logged a payment_recorded for the same amount on
  // the same date, skip the income row (it'd be a duplicate event).
  const seen = new Set(activities
    .filter(a => a.type === 'payment_recorded' && a.amount)
    .map(a => `${a.amount}|${(a.created_at || '').slice(0, 10)}`));
  const extraIncome = incomes
    .filter(i => !seen.has(`${i.amount}|${i.date}`))
    .map(i => ({
      id: 'inc-' + i.id,
      type: 'payment_recorded',
      actor_name: null,
      amount: i.amount,
      details: JSON.stringify({ category: i.category, reference: i.reference, notes: i.notes }),
      created_at: i.date + ' 12:00:00',
    }));

  const merged = [...activities, ...extraIncome]
    .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));

  res.json({ lead, timeline: merged });
});

// Add a note to a lead — appears in the timeline.
app.post('/api/leads/:id/notes', (req, res) => {
  const lead = db.prepare("SELECT * FROM leads WHERE id=? OR lead_id=?").get(req.params.id, req.params.id);
  if (!lead) return res.status(404).json({ error: 'Not found' });
  if (!leadIsVisibleTo(lead, req.user)) return res.status(403).json({ error: 'Not your lead' });
  const { text } = req.body || {};
  if (!text || !text.trim()) return res.status(400).json({ error: 'text is required' });
  logActivity({ type: 'note', actor: req.user, lead, details: text.trim() });
  res.json({ ok: true });
});

// ─── BROADCASTS — owner's sticky-note for the whole team ───────────────────
app.get('/api/broadcasts', (req, res) => {
  const userId = req.user?.id;
  const rows = db.prepare(`SELECT b.*,
      EXISTS(SELECT 1 FROM broadcast_dismissals d WHERE d.broadcast_id=b.id AND d.user_id=?) AS dismissed
    FROM broadcasts b
    WHERE b.expires_at IS NULL OR b.expires_at > datetime('now')
    ORDER BY b.pinned DESC, b.id DESC`).all(userId || 0);
  res.json(rows);
});

app.post('/api/broadcasts', (req, res, next) => requireAdmin(req, res, () => {
  const { message, color = 'amber', pinned = 1, expires_at = null } = req.body || {};
  if (!message?.trim()) return res.status(400).json({ error: 'message is required' });
  const info = db.prepare(`INSERT INTO broadcasts (message, author_id, author_name, color, pinned, expires_at)
    VALUES (?,?,?,?,?,?)`).run(message.trim(), req.user.id, req.user.name || req.user.email, color, pinned ? 1 : 0, expires_at);
  broadcast('broadcast_new', { broadcast: db.prepare("SELECT * FROM broadcasts WHERE id=?").get(info.lastInsertRowid) });
  logActivity({ type: 'broadcast_posted', actor: req.user, details: message.trim().slice(0, 200) });
  res.json(db.prepare("SELECT * FROM broadcasts WHERE id=?").get(info.lastInsertRowid));
}));

app.delete('/api/broadcasts/:id', (req, res, next) => requireAdmin(req, res, () => {
  db.prepare("DELETE FROM broadcast_dismissals WHERE broadcast_id=?").run(req.params.id);
  db.prepare("DELETE FROM broadcasts WHERE id=?").run(req.params.id);
  res.json({ ok: true });
}));

app.post('/api/broadcasts/:id/dismiss', (req, res) => {
  if (!req.user?.id) return res.status(401).json({ error: 'auth required' });
  db.prepare(`INSERT OR IGNORE INTO broadcast_dismissals (broadcast_id, user_id) VALUES (?,?)`)
    .run(req.params.id, req.user.id);
  res.json({ ok: true });
});

// ─── DATA IMPORT — parsed rows come from the browser (SheetJS); the server
// just inserts what's already mapped, with idempotency by content key. ─────
function importCashflowRows(rows, actor) {
  let inserted = 0, skipped = 0;
  const insIn  = db.prepare(`INSERT INTO income   (date, month, category, client_name, reference, amount, notes) VALUES (?,?,?,?,?,?,?)`);
  const insOut = db.prepare(`INSERT INTO expenses (date, month, category, paid_to,    reference, amount, notes) VALUES (?,?,?,?,?,?,?)`);
  // Dedupe by (kind, month, category, client_name, amount)
  const existingIn  = new Set(db.prepare("SELECT date||'|'||COALESCE(category,'')||'|'||COALESCE(client_name,'')||'|'||amount AS k FROM income").all().map(r => r.k));
  const existingOut = new Set(db.prepare("SELECT date||'|'||COALESCE(category,'')||'|'||COALESCE(paid_to,'')||'|'||amount AS k FROM expenses").all().map(r => r.k));

  const txn = db.transaction(() => {
    for (const r of rows) {
      if (!r || typeof r !== 'object') continue;
      const amount = Number(r.amount) || 0;
      if (amount === 0 && !r.client_name && !r.category) { skipped++; continue; }
      const date = r.date || (r.month ? `${r.month}-01` : new Date().toISOString().slice(0,10));
      const month = r.month || date.slice(0,7);
      const key = `${date}|${r.category||''}|${r.client_name||''}|${amount}`;
      if (r.kind === 'in') {
        if (existingIn.has(key)) { skipped++; continue; }
        insIn.run(date, month, r.category||null, r.client_name||null, r.reference||null, amount, r.notes||null);
        existingIn.add(key); inserted++;
      } else {
        if (existingOut.has(key)) { skipped++; continue; }
        insOut.run(date, month, r.category||null, r.client_name||null, r.reference||null, amount, r.notes||null);
        existingOut.add(key); inserted++;
      }
    }
  });
  txn();
  logActivity({ type: 'import_cashflow', actor, details: { inserted, skipped, total: rows.length } });
  return { inserted, skipped };
}

function importApplicationRows(rows, actor) {
  let inserted = 0, updated = 0, skipped = 0;
  const newLeadId = () => {
    const last = db.prepare("SELECT lead_id FROM leads WHERE lead_id LIKE 'LEAD-%' ORDER BY id DESC LIMIT 1").get();
    const n = last ? parseInt(last.lead_id.split('-')[1]) + 1 : 1;
    return `LEAD-${String(n).padStart(4, '0')}`;
  };
  const ins = db.prepare(`INSERT INTO leads
    (lead_id, date_added, client_name, phone, email, destination, last_education, gpa, english_score,
     program, lead_source, lead_status, assigned_consultant, service_fee, paid, balance,
     source, referrer, nationality, passport, degree, major, intake_term, university,
     drive_link, deposit, application_stage)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const upd = db.prepare(`UPDATE leads SET
     source=COALESCE(?, source), referrer=COALESCE(?, referrer),
     nationality=COALESCE(?, nationality), passport=COALESCE(?, passport),
     degree=COALESCE(?, degree), major=COALESCE(?, major),
     intake_term=COALESCE(?, intake_term), university=COALESCE(?, university),
     drive_link=COALESCE(?, drive_link), destination=COALESCE(?, destination),
     application_stage=COALESCE(?, application_stage)
   WHERE id=?`);
  const insUniApp = db.prepare(`INSERT INTO lead_university_applications (lead_id, university, status) VALUES (?,?,?)`);

  // Pre-load passport map and name map for dedupe.
  const byPassport = new Map(db.prepare("SELECT id, passport FROM leads WHERE passport IS NOT NULL").all().map(r => [String(r.passport).toUpperCase(), r.id]));
  const byName = new Map(db.prepare("SELECT id, client_name FROM leads").all().map(r => [String(r.client_name || '').toLowerCase().trim(), r.id]));

  const STATUS_MAP = {
    'documents': 'documents', 'documents collecting': 'documents',
    'ready': 'ready', 'documents ready': 'ready',
    'submitted': 'submitted', 'applied to university': 'submitted',
    'interview': 'interview',
    'pre_admission': 'pre_admission', 'pre-admission': 'pre_admission',
    'deposit': 'deposit',
    'admitted': 'admitted', 'admission/jw received': 'admitted', 'jw received': 'admitted',
    'visa_applied': 'visa_applied', 'visa applied': 'visa_applied',
    'visa_approved': 'visa_approved', 'visa approved': 'visa_approved',
    'visa_rejected': 'visa_rejected', 'visa rejected': 'visa_rejected',
    'enrolled': 'enrolled',
    'cancelled': 'cancelled',
    'withdraw': 'withdraw', 'withdrawn': 'withdraw',
    'return': 'submitted', 'returned': 'submitted',
    'reject': 'documents', 'rejected': 'documents'
  };
  const APP_STAGE_FROM_STATUS = { ...STATUS_MAP };

  const txn = db.transaction(() => {
    for (const r of rows) {
      if (!r || !r.client_name?.trim()) { skipped++; continue; }
      const name = r.client_name.trim();
      const passportKey = r.passport ? String(r.passport).toUpperCase().trim() : null;
      let existingId = null;
      if (passportKey && byPassport.has(passportKey)) existingId = byPassport.get(passportKey);
      else if (byName.has(name.toLowerCase())) existingId = byName.get(name.toLowerCase());

      const statusKey = (r.status || '').toLowerCase().trim();
      const appStage = APP_STAGE_FROM_STATUS[statusKey] || 'documents';
      const firstUni = r.universities ? String(r.universities).split(/[,/;]/)[0]?.trim() : (r.university || null);

      if (existingId) {
        const lead = db.prepare("SELECT lead_status, application_stage FROM leads WHERE id=?").get(existingId);
        const nextStage = APP_STAGE_FROM_STATUS[statusKey] || lead?.application_stage || 'documents';
        const nextStatus = (lead?.lead_status && lead.lead_status !== 'New Lead') ? lead.lead_status : 'File Opened';
        
        db.prepare("UPDATE leads SET lead_status=? WHERE id=?").run(nextStatus, existingId);

        upd.run(
          r.source || null, r.referrer || null, r.nationality || null, r.passport || null,
          r.degree || null, r.major || null, r.intake_term || null, firstUni,
          r.drive_link || null, r.destination || null, nextStage, existingId);
        updated++;
      } else {
        const lead_id = newLeadId();
        const info = ins.run(
          lead_id, r.date_added || new Date().toISOString().slice(0, 10),
          name, r.phone || null, r.email || null, r.destination || null,
          r.last_education || null, r.gpa || null, r.english_score || null,
          r.program || r.major || null, r.lead_source || 'Excel import',
          'File Opened',
          r.assigned_consultant || null, r.service_fee || 0, r.paid || 0, (r.service_fee || 0) - (r.paid || 0),
          r.source || null, r.referrer || null, r.nationality || null, r.passport || null,
          r.degree || null, r.major || null, r.intake_term || null, firstUni,
          r.drive_link || null, r.deposit || 0,
          appStage
        );
        existingId = info.lastInsertRowid;
        if (passportKey) byPassport.set(passportKey, existingId);
        byName.set(name.toLowerCase(), existingId);
        inserted++;
      }

      // Per-university applications from the comma-separated 'universities' field
      if (r.universities && existingId) {
        const list = String(r.universities).split(/[,/;]/).map(s => s.trim()).filter(Boolean);
        const have = new Set(db.prepare("SELECT university FROM lead_university_applications WHERE lead_id=?").all(existingId).map(x => x.university.toLowerCase()));
        const uStatus = STATUS_MAP[statusKey] || 'documents';
        for (const u of list) {
          if (have.has(u.toLowerCase())) continue;
          insUniApp.run(existingId, u, uStatus);
        }
      }
    }
  });
  txn();
  logActivity({ type: 'import_applications', actor, details: { inserted, updated, skipped, total: rows.length } });
  return { inserted, updated, skipped };
}

app.post('/api/import/cashflow', (req, res, next) => requireAdmin(req, res, () => {
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
  if (rows.length === 0) return res.status(400).json({ error: 'No rows to import' });
  if (rows.length > 5000) return res.status(400).json({ error: 'Too many rows in one batch (max 5000)' });
  try { res.json(importCashflowRows(rows, req.user)); }
  catch (e) { res.status(500).json({ error: e.message }); }
}));

app.post('/api/import/applications', (req, res, next) => requireAdmin(req, res, () => {
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
  if (rows.length === 0) return res.status(400).json({ error: 'No rows to import' });
  if (rows.length > 5000) return res.status(400).json({ error: 'Too many rows in one batch (max 5000)' });
  try { res.json(importApplicationRows(rows, req.user)); }
  catch (e) { res.status(500).json({ error: e.message }); }
}));

// ─── STAFF REPLY to a student through the portal thread ───────────────────
app.post('/api/leads/:id/reply-to-student', (req, res) => {
  const lead = db.prepare("SELECT * FROM leads WHERE id=? OR lead_id=?").get(req.params.id, req.params.id);
  if (!lead) return res.status(404).json({ error: 'Not found' });
  if (!leadIsVisibleTo(lead, req.user)) return res.status(403).json({ error: 'Not your lead' });
  const { text } = req.body || {};
  if (!text?.trim()) return res.status(400).json({ error: 'text required' });
  logActivity({ type: 'reply_to_student', actor: req.user, lead, details: text.trim() });
  res.json({ ok: true });
});



// Public — student fetches the conversation thread (their messages + staff replies)
app.get('/api/public/student/:token/thread', (req, res) => {
  const lead = db.prepare("SELECT * FROM leads WHERE public_token=? AND public_enabled=1").get(req.params.token);
  if (!lead) return res.status(404).json({ error: 'Portal link not active.' });
  const rows = db.prepare(`SELECT id, type, actor_name, details, created_at
    FROM activity_log
    WHERE lead_id=? AND type IN ('note','reply_to_student','student_doc_upload')
    ORDER BY id ASC`).all(lead.id);
  res.json(rows);
});

// ─── STUDENT PORTAL (public link) ──────────────────────────────────────────
// Returns the public share URL for a lead, regenerating the token on demand.
app.post('/api/leads/:id/regenerate-token', (req, res) => {
  const lead = db.prepare("SELECT * FROM leads WHERE id=?").get(req.params.id);
  if (!lead) return res.status(404).json({ error: 'Not found' });
  if (!leadIsVisibleTo(lead, req.user)) return res.status(403).json({ error: 'Not your lead' });
  const token = generatePublicToken();
  db.prepare("UPDATE leads SET public_token=?, public_enabled=1 WHERE id=?").run(token, lead.id);
  res.json({ public_token: token });
});

// Enable/disable the public link without forgetting the token.
app.put('/api/leads/:id/public', (req, res) => {
  const lead = db.prepare("SELECT * FROM leads WHERE id=?").get(req.params.id);
  if (!lead) return res.status(404).json({ error: 'Not found' });
  if (!leadIsVisibleTo(lead, req.user)) return res.status(403).json({ error: 'Not your lead' });
  const { enabled } = req.body || {};
  db.prepare("UPDATE leads SET public_enabled=? WHERE id=?").run(enabled ? 1 : 0, lead.id);
  res.json({ ok: true });
});

// QR code as a PNG image, generated via a public QR endpoint. We proxy it so
// the front-end can embed without exposing the URL builder logic.
app.get('/api/leads/:id/qr', async (req, res) => {
  const lead = db.prepare("SELECT * FROM leads WHERE id=?").get(req.params.id);
  if (!lead) return res.status(404).end();
  if (!leadIsVisibleTo(lead, req.user)) return res.status(403).end();
  if (!lead.public_token) {
    const token = generatePublicToken();
    db.prepare("UPDATE leads SET public_token=?, public_enabled=1 WHERE id=?").run(token, lead.id);
    lead.public_token = token;
  }
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
  const host = req.headers['x-forwarded-host'] || req.get('host');
  const url = `${proto}://${host}/s/${lead.public_token}`;
  const size = Math.min(parseInt(req.query.size) || 240, 600);
  try {
    const r = await fetch(`https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}&margin=0`);
    const buf = Buffer.from(await r.arrayBuffer());
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(buf);
  } catch (e) {
    res.status(500).end();
  }
});

// PUBLIC — what the student sees at /s/:token. No auth. Sanitised payload.
app.get('/api/public/student/:token', (req, res) => {
  const lead = db.prepare("SELECT * FROM leads WHERE public_token=? AND public_enabled=1").get(req.params.token);
  if (!lead) return res.status(404).json({ error: 'This portal link is not active.' });

  const uniApps = db.prepare("SELECT id, university, program, status, application_id, submitted_on, decision_on, notes FROM lead_university_applications WHERE lead_id=? ORDER BY id").all(lead.id);
  const docs = db.prepare(`SELECT id, doc_type, status, notes, file_url, student_uploaded_url, student_uploaded_at, requested_by_student, received_on
                           FROM lead_documents
                           WHERE lead_id=?
                           ORDER BY requested_by_student DESC, id ASC`).all(lead.id);

  res.json({
    student: {
      ref_id: lead.lead_id,
      name: lead.client_name,
      nationality: lead.nationality,
      destination: lead.destination,
      university: lead.university,
      degree: lead.degree,
      major: lead.major,
      intake_term: lead.intake_term,
      application_stage: lead.application_stage,
      visa_deadline: lead.visa_deadline,
      departure_date: lead.departure_date,
      assigned_consultant: lead.assigned_consultant,
      drive_link: lead.drive_link,
      blood_group: lead.blood_group,
    },
    stages: getApplicationStages(),
    universities: uniApps,
    documents: docs.map(d => ({
      id: d.id,
      doc_type: d.doc_type,
      status: d.status,
      requested_by_student: !!d.requested_by_student,
      notes: d.notes,
      file_url: d.file_url,
      student_uploaded_url: d.student_uploaded_url,
      student_uploaded_at: d.student_uploaded_at,
      received_on: d.received_on,
    })),
    updated_at: new Date().toISOString(),
  });
});

// PUBLIC — student attaches a Drive (or any URL) link for a requested doc.
app.post('/api/public/student/:token/documents/:docId', (req, res) => {
  const lead = db.prepare("SELECT * FROM leads WHERE public_token=? AND public_enabled=1").get(req.params.token);
  if (!lead) return res.status(404).json({ error: 'This portal link is not active.' });
  const doc = db.prepare("SELECT * FROM lead_documents WHERE id=? AND lead_id=?").get(req.params.docId, lead.id);
  if (!doc) return res.status(404).json({ error: 'Document not found' });
  const { url, notes } = req.body || {};
  if (!url || !/^https?:\/\//i.test(String(url))) {
    return res.status(400).json({ error: 'A valid http(s) URL is required (e.g. a Google Drive share link).' });
  }
  db.prepare(`UPDATE lead_documents SET
      student_uploaded_url=?, student_uploaded_at=datetime('now'),
      status=CASE WHEN status='pending' THEN 'received' ELSE status END,
      received_on=COALESCE(received_on, date('now')),
      notes=COALESCE(?, notes),
      updated_at=datetime('now')
    WHERE id=?`).run(String(url).trim(), notes ?? null, doc.id);
  logActivity({ type: 'student_doc_upload', actor: { name: lead.client_name }, lead, details: { doc_type: doc.doc_type, url } });
  res.json({ ok: true });
});

// PUBLIC — student sends a short message. Becomes a 'note' in the timeline.
app.post('/api/public/student/:token/message', (req, res) => {
  const lead = db.prepare("SELECT * FROM leads WHERE public_token=? AND public_enabled=1").get(req.params.token);
  if (!lead) return res.status(404).json({ error: 'This portal link is not active.' });
  const { text } = req.body || {};
  if (!text || !String(text).trim()) return res.status(400).json({ error: 'text is required' });
  logActivity({ type: 'note', actor: { name: `${lead.client_name} (Student)` }, lead, details: `[via student portal] ${String(text).trim()}` });
  res.json({ ok: true });
});

// ─────────────────────────────────────────────────────────
// FINANCE
// ─────────────────────────────────────────────────────────
app.get('/api/income', (req, res) => {
  const { month, page=1, limit=50 } = req.query;
  const w = month 
    ? `WHERE month='${month}' AND (exclude_from_cash IS NULL OR exclude_from_cash = 0)` 
    : `WHERE (exclude_from_cash IS NULL OR exclude_from_cash = 0)`;
  const sum = db.prepare(`SELECT SUM(amount) as s FROM income ${w}`).get().s || 0;
  const total = db.prepare(`SELECT COUNT(*) as c FROM income ${w}`).get().c;
  const rows = db.prepare(`SELECT * FROM income ${w} ORDER BY date DESC LIMIT ${limit} OFFSET ${(page-1)*limit}`).all();
  res.json({ rows, total, sum, page: parseInt(page), pages: Math.ceil(total/limit) });
});
app.post('/api/income', (req, res) => {
  const d = req.body; const month = d.date?.slice(0,7)||null;
  const info = db.prepare(`INSERT INTO income (date,month,category,lead_id,client_name,reference,amount,notes) VALUES (@date,@month,@category,@lead_id,@client_name,@reference,@amount,@notes)`).run({ ...d, month, amount: d.amount||0 });
  const row = db.prepare("SELECT * FROM income WHERE id=?").get(info.lastInsertRowid);
  // Try to attach to a real lead so this payment shows on the lead's timeline.
  const lead = row.lead_id ? db.prepare("SELECT * FROM leads WHERE lead_id=?").get(row.lead_id) : null;
  logActivity({ type: 'payment_recorded', actor: req.user, lead, amount: row.amount, details: { client_name: row.client_name, lead_id: row.lead_id, category: row.category, reference: row.reference } });
  res.json(row);
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
  const row = db.prepare("SELECT * FROM expenses WHERE id=?").get(info.lastInsertRowid);
  logActivity({ type: 'expense_recorded', actor: req.user, amount: row.amount, details: { paid_to: row.paid_to, category: row.category, reference: row.reference } });
  res.json(row);
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
    const inc = db.prepare("SELECT SUM(amount) as s FROM income WHERE month=? AND (exclude_from_cash IS NULL OR exclude_from_cash = 0)").get(m).s||0;
    const exp = db.prepare("SELECT SUM(amount) as s FROM expenses WHERE month=?").get(m).s||0;
    return { month: m, income: inc, expense: exp, profit: inc-exp, margin: inc>0?((inc-exp)/inc*100).toFixed(1):0 };
  }));
});

// ─── CASHFLOW (aligned with CashFlow 2026.xlsx) ────────────────────────────
const INCOME_CATEGORIES = [
  'Service Charge', 'File Opening', 'Application Deposit', 'Investment',
  'Marketing', 'Refund', 'Previous Cash', 'Other Income',
];
const EXPENSE_CATEGORIES = [
  'Salary', 'Office Rent', 'Air Ticket', 'Medical', 'App Fee',
  'Meta Marketing', 'Marketing', 'Client Hospitality', 'Visa Fee',
  'Translation Fee', 'Office Supplies', 'Utilities', 'Travel',
  'Mata Support', 'Refund Out', 'Other Expense',
];

// Helper — opening balance for a given month = initial cash + all prior in/out.
function computeOpeningBalance(month) {
  const initial = parseFloat(getConfig('cash_initial')) || 0;
  if (!month) return initial;
  const sumIn  = db.prepare("SELECT COALESCE(SUM(amount),0) AS s FROM income   WHERE month < ? AND (exclude_from_cash IS NULL OR exclude_from_cash = 0)").get(month).s;
  const sumOut = db.prepare("SELECT COALESCE(SUM(amount),0) AS s FROM expenses WHERE month < ?").get(month).s;
  return initial + sumIn - sumOut;
}

// Categories endpoint — frontend uses these as dropdown presets.
app.get('/api/cashflow/categories', (req, res) => {
  res.json({ income: INCOME_CATEGORIES, expense: EXPENSE_CATEGORIES });
});

// Set initial cash (admin only) — the one-time opening balance.
app.put('/api/cashflow/initial', (req, res, next) => requireAdmin(req, res, () => {
  const v = Number(req.body?.amount);
  if (!Number.isFinite(v)) return res.status(400).json({ error: 'amount required' });
  setConfig('cash_initial', String(v));
  res.json({ ok: true, cash_initial: v });
}));

// Monthly ledger — what the Excel shows for one month, side by side.
// Includes running balance per row so the table reads like a real cashflow.
app.get('/api/cashflow', (req, res, next) => requireManagerOrAdmin(req, res, () => {
  const month = req.query.month || new Date().toISOString().slice(0, 7);
  const incomeRows  = db.prepare("SELECT id,date,category,client_name,reference,amount,notes FROM income   WHERE month=? AND (exclude_from_cash IS NULL OR exclude_from_cash = 0) ORDER BY date, id").all(month);
  const expenseRows = db.prepare("SELECT id,date,category,paid_to AS client_name,reference,amount,notes FROM expenses WHERE month=? ORDER BY date, id").all(month);
  const opening = computeOpeningBalance(month);
  const totalIn  = incomeRows.reduce((s, r) => s + (r.amount || 0), 0);
  const totalOut = expenseRows.reduce((s, r) => s + (r.amount || 0), 0);

  // Build a unified chronological feed for running-balance computation.
  const events = [
    ...incomeRows.map(r => ({ ...r, kind: 'in',  ts: `${r.date || month + '-01'}-i-${r.id}` })),
    ...expenseRows.map(r => ({ ...r, kind: 'out', ts: `${r.date || month + '-01'}-o-${r.id}` })),
  ].sort((a, b) => a.ts.localeCompare(b.ts));
  let running = opening;
  for (const e of events) { running += e.kind === 'in' ? e.amount : -e.amount; e.running = running; }
  const rowsWithRunning = id => events.find(e => e.id === id && e.kind === 'in')  || events.find(e => e.id === id && e.kind === 'out');

  // Re-attach running balance back to each row in order
  const incomeWithRun  = incomeRows.map(r => ({ ...r, running: events.find(e => e.kind === 'in'  && e.id === r.id)?.running }));
  const expenseWithRun = expenseRows.map(r => ({ ...r, running: events.find(e => e.kind === 'out' && e.id === r.id)?.running }));

  // Category breakdowns for the donut/sidebar
  const incByCat  = {}; incomeRows.forEach(r  => { const k = r.category || 'Uncategorised'; incByCat[k]  = (incByCat[k]  || 0) + (r.amount || 0); });
  const expByCat  = {}; expenseRows.forEach(r => { const k = r.category || 'Uncategorised'; expByCat[k]  = (expByCat[k]  || 0) + (r.amount || 0); });
  // Per-reference (who handled / referred) breakdown for income
  const incByRef  = {}; incomeRows.forEach(r  => { const k = r.reference || 'Direct'; incByRef[k] = (incByRef[k] || 0) + (r.amount || 0); });

  res.json({
    month, opening,
    income:  incomeWithRun,
    expense: expenseWithRun,
    totals: { in: totalIn, out: totalOut, net: totalIn - totalOut, closing: opening + totalIn - totalOut },
    by_category: {
      income:  Object.entries(incByCat).sort((a,b) => b[1]-a[1]).map(([name, amount]) => ({ name, amount })),
      expense: Object.entries(expByCat).sort((a,b) => b[1]-a[1]).map(([name, amount]) => ({ name, amount })),
    },
    income_by_reference: Object.entries(incByRef).sort((a,b) => b[1]-a[1]).map(([name, amount]) => ({ name, amount })),
  });
}));

// Year view — 12 months at a glance with running cash.
app.get('/api/cashflow/year', (req, res, next) => requireManagerOrAdmin(req, res, () => {
  const year = (req.query.year || new Date().toISOString().slice(0, 4)).toString();
  const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
  const initial = parseFloat(getConfig('cash_initial')) || 0;
  const priorIn  = db.prepare("SELECT COALESCE(SUM(amount),0) AS s FROM income   WHERE month < ? AND (exclude_from_cash IS NULL OR exclude_from_cash = 0)").get(`${year}-01`).s;
  const priorOut = db.prepare("SELECT COALESCE(SUM(amount),0) AS s FROM expenses WHERE month < ?").get(`${year}-01`).s;
  let running = initial + priorIn - priorOut;

  const rows = months.map(m => {
    const inc = db.prepare("SELECT COALESCE(SUM(amount),0) AS s FROM income   WHERE month=? AND (exclude_from_cash IS NULL OR exclude_from_cash = 0)").get(m).s;
    const exp = db.prepare("SELECT COALESCE(SUM(amount),0) AS s FROM expenses WHERE month=?").get(m).s;
    const opening = running;
    const closing = opening + inc - exp;
    running = closing;
    return { month: m, opening, income: inc, expense: exp, net: inc - exp, closing };
  });
  res.json({ year, opening: rows[0]?.opening || initial, closing: rows[11]?.closing || initial, rows });
}));

// Investor / partner contributions — derived from income where category='Investment'.
// Tracks both totals by person and time-series.
app.get('/api/cashflow/investors', (req, res, next) => requireAdmin(req, res, () => {
  const rows = db.prepare(`SELECT date, month, client_name, reference, amount, notes
                           FROM income WHERE category='Investment' ORDER BY date, id`).all();
  const byPerson = {};
  rows.forEach(r => {
    const key = r.client_name || 'Unknown';
    byPerson[key] = (byPerson[key] || 0) + (r.amount || 0);
  });
  res.json({
    total: rows.reduce((s, r) => s + (r.amount || 0), 0),
    contributions: rows,
    by_person: Object.entries(byPerson).sort((a, b) => b[1] - a[1]).map(([name, amount]) => ({ name, amount })),
  });
}));

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
    return { consultant:c, total, thisMonth, enrolled:byStatus['Enrolled']||0, fileOpened:byStatus['File Opened']||0, officeVisited:byStatus['Office Visited']||0, positive:byStatus['Positive']||0, notInterested:byStatus['Not Interested']||0, revenue, collected, conversionRate: total>0?((( byStatus['File Opened']||0)/total)*100).toFixed(1):0, responseRate: total>0?(((total-(byStatus['No Response']||0))/total)*100).toFixed(1):0, target_leads:target.target_leads||0, target_enrolled:target.target_enrolled||0, target_revenue:target.target_revenue||0 };
  }));
});
app.put('/api/kpi/targets', (req, res) => {
  const { consultant, month, target_leads, target_enrolled, target_revenue } = req.body;
  db.prepare(`INSERT INTO kpi_targets (consultant,month,target_leads,target_enrolled,target_revenue) VALUES (?,?,?,?,?) ON CONFLICT(consultant,month) DO UPDATE SET target_leads=excluded.target_leads,target_enrolled=excluded.target_enrolled,target_revenue=excluded.target_revenue`).run(consultant,month,target_leads||0,target_enrolled||0,target_revenue||0);
  res.json({ ok:true });
});

// ─────────────────────────────────────────────────────────
// PAYROLL
// ─────────────────────────────────────────────────────────
function workingDaysInMonth(month) {
  const [y, m] = month.split('-').map(Number);
  const days = new Date(y, m, 0).getDate();
  let wd = 0;
  for (let d = 1; d <= days; d++) { const dow = new Date(y, m - 1, d).getDay(); if (dow !== 5 && dow !== 6) wd++; }
  return wd;
}

// Auto-record payroll payment as an expense in Finance
function logPayrollExpense(row) {
  if (!row || row.status !== 'paid') return;
  const date = row.paid_on || new Date().toISOString().slice(0, 10);
  const expenseMonth = date.slice(0, 7);

  // Check if expense already exists to prevent duplicate entries by looking up the unique reference "Salary - YYYY-MM"
  const existing = db.prepare("SELECT * FROM expenses WHERE category='Salary' AND paid_to=? AND reference=?")
    .get(row.name, `Salary - ${row.month}`);
  
  if (existing) {
    db.prepare(`UPDATE expenses SET 
                  date = ?, 
                  month = ?, 
                  amount = ?, 
                  notes = ? 
                WHERE id = ?`)
      .run(
        date,
        expenseMonth,
        row.net_pay || 0,
        row.notes || `Salary payment for ${row.month}`,
        existing.id
      );
  } else {
    db.prepare(`INSERT INTO expenses (date, month, category, paid_to, reference, amount, notes)
                VALUES (?, ?, 'Salary', ?, ?, ?, ?)`)
      .run(
        date,
        expenseMonth,
        row.name,
        `Salary - ${row.month}`,
        row.net_pay || 0,
        row.notes || `Salary payment for ${row.month}`
      );
  }
  
  // Log activity
  logActivity({
    type: 'expense_recorded',
    actor: { name: 'System' },
    amount: row.net_pay,
    to: row.name,
    details: `Auto-recorded salary expense for ${row.month}`
  });
}

// List payroll entries for a month (auto-creates rows for active employees if missing)
app.get('/api/payroll', (req, res, next) => requireAdmin(req, res, () => {
  const month = req.query.month || new Date().toISOString().slice(0, 7);
  const wd = workingDaysInMonth(month);
  const employees = db.prepare("SELECT * FROM employees WHERE active='Yes'").all();
  const ensure = db.prepare(`INSERT OR IGNORE INTO payroll
    (month, emp_id, name, base_salary, working_days, days_worked, net_pay)
    VALUES (?, ?, ?, ?, ?, ?, ?)`);
  const recalc = db.prepare("UPDATE payroll SET days_worked=?, working_days=? WHERE month=? AND emp_id=? AND name=?");

  for (const emp of employees) {
    const present = db.prepare("SELECT COUNT(*) as n FROM attendance WHERE emp_id=? AND date LIKE ? AND (status='Present' OR status='Late')")
      .get(emp.emp_id, `${month}%`).n;
    ensure.run(month, emp.emp_id, emp.name, emp.salary || 0, wd, present, emp.salary || 0);
    recalc.run(present, wd, month, emp.emp_id, emp.name);
  }

  const rows = db.prepare("SELECT * FROM payroll WHERE month=? ORDER BY name").all(month);
  
  // Defensive deduplication to ensure same name is never shown twice in payroll
  const seen = new Set();
  const uniqueRows = [];
  for (const r of rows) {
    const key = `${r.month}-${r.name}`;
    if (seen.has(key)) {
      db.prepare("DELETE FROM payroll WHERE id=?").run(r.id);
    } else {
      seen.add(key);
      uniqueRows.push(r);
    }
  }

  const totals = uniqueRows.reduce((a, r) => ({
    base: a.base + (r.base_salary || 0),
    bonus: a.bonus + (r.bonus || 0),
    deductions: a.deductions + (r.deductions || 0),
    net: a.net + (r.net_pay || 0),
    paid: a.paid + (r.status === 'paid' ? (r.net_pay || 0) : 0),
    pending: a.pending + (r.status !== 'paid' ? (r.net_pay || 0) : 0),
  }), { base: 0, bonus: 0, deductions: 0, net: 0, paid: 0, pending: 0 });

  res.json({ month, workingDays: wd, rows: uniqueRows, totals });
}));

// Adjust a single payroll line (bonus, deductions, status, paid_on, notes)
app.put('/api/payroll/:id', (req, res, next) => requireAdmin(req, res, () => {
  const cur = db.prepare("SELECT * FROM payroll WHERE id=?").get(req.params.id);
  if (!cur) return res.status(404).json({ error: 'Not found' });
  const { bonus, deductions, status, paid_on, notes, base_salary } = req.body || {};
  const base = (base_salary !== undefined ? Number(base_salary) : cur.base_salary) || 0;
  const b = (bonus      !== undefined ? Number(bonus)      : cur.bonus)      || 0;
  const d = (deductions !== undefined ? Number(deductions) : cur.deductions) || 0;
  const net = base + b - d;
  const stat = status || cur.status;
  const paidOn = (stat === 'paid') ? (paid_on || cur.paid_on || new Date().toISOString().slice(0, 10)) : null;
  db.prepare(`UPDATE payroll SET base_salary=?, bonus=?, deductions=?, net_pay=?, status=?, paid_on=?, notes=? WHERE id=?`)
    .run(base, b, d, net, stat, paidOn, notes ?? cur.notes ?? null, req.params.id);
  
  const updated = db.prepare("SELECT * FROM payroll WHERE id=?").get(req.params.id);
  if (stat === 'paid') {
    logPayrollExpense(updated);
  } else {
    db.prepare("DELETE FROM expenses WHERE category='Salary' AND paid_to=? AND reference=?")
      .run(updated.name, `Salary - ${updated.month}`);
  }
  res.json(updated);
}));

app.post('/api/payroll/:id/mark-paid', (req, res, next) => requireAdmin(req, res, () => {
  const cur = db.prepare("SELECT * FROM payroll WHERE id=?").get(req.params.id);
  if (!cur) return res.status(404).json({ error: 'Not found' });
  db.prepare("UPDATE payroll SET status='paid', paid_on=COALESCE(paid_on, ?) WHERE id=?")
    .run(new Date().toISOString().slice(0, 10), req.params.id);
  
  const updated = db.prepare("SELECT * FROM payroll WHERE id=?").get(req.params.id);
  logPayrollExpense(updated);
  res.json(updated);
}));

// ─────────────────────────────────────────────────────────
// EMPLOYEE PERFORMANCE — Attendance + Daily Logs + Activity
// ─────────────────────────────────────────────────────────

// Daily log — what an employee writes before they leave for the day.
app.get('/api/daily-logs', (req, res) => {
  const { emp_id, from, to, date } = req.query;
  const where = []; const params = [];
  if (emp_id)         { where.push('emp_id=?'); params.push(emp_id); }
  if (from)           { where.push('date >= ?'); params.push(from); }
  if (to)             { where.push('date <= ?'); params.push(to); }
  if (date)           { where.push('date = ?'); params.push(date); }

  // Consultants only see their own logs (scoped by their linked emp_id or name match)
  if (req.user?.role === 'consultant') {
    const emp = findEmployeeForUser(req.user);
    if (!emp) return res.json([]);
    where.push('emp_id=?'); params.push(emp.emp_id);
  }
  const ws = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const rows = db.prepare(`SELECT * FROM daily_logs ${ws} ORDER BY date DESC, id DESC LIMIT 365`).all(...params);
  res.json(rows);
});

// Submit (or upsert) today's log for the current user
app.post('/api/daily-logs', (req, res) => {
  const emp = findEmployeeForUser(req.user);
  if (!emp) return res.status(400).json({ error: 'Your user account is not linked to an HR employee — ask the admin to link it in Settings → Users.' });
  const today = new Date().toISOString().slice(0, 10);
  const date  = (req.body?.date || today).slice(0, 10);
  if (date > today) return res.status(400).json({ error: "Can't log for a future date" });

  const { accomplishments, challenges, tomorrow_plan, metrics } = req.body || {};
  if (!accomplishments?.trim()) return res.status(400).json({ error: 'Accomplishments is required' });
  const metrics_json = metrics ? JSON.stringify(metrics) : null;

  const existing = db.prepare("SELECT id FROM daily_logs WHERE emp_id=? AND date=?").get(emp.emp_id, date);
  if (existing) {
    db.prepare(`UPDATE daily_logs SET accomplishments=?, challenges=?, tomorrow_plan=?, metrics_json=?, updated_at=datetime('now') WHERE id=?`)
      .run(accomplishments.trim(), challenges?.trim() || null, tomorrow_plan?.trim() || null, metrics_json, existing.id);
    logActivity({ type: 'daily_log_updated', actor: req.user, details: { date, emp_id: emp.emp_id } });
  } else {
    db.prepare(`INSERT INTO daily_logs (emp_id, user_id, date, accomplishments, challenges, tomorrow_plan, metrics_json) VALUES (?,?,?,?,?,?,?)`)
      .run(emp.emp_id, req.user.id || null, date, accomplishments.trim(), challenges?.trim() || null, tomorrow_plan?.trim() || null, metrics_json);
    logActivity({ type: 'daily_log_submitted', actor: req.user, details: { date, emp_id: emp.emp_id } });
  }
  res.json(db.prepare("SELECT * FROM daily_logs WHERE emp_id=? AND date=?").get(emp.emp_id, date));
});

// "Did I submit today's log?" — used by the dashboard banner
app.get('/api/daily-logs/me/today', (req, res) => {
  const emp = findEmployeeForUser(req.user);
  if (!emp) return res.json({ linked: false });
  const today = new Date().toISOString().slice(0, 10);
  const row = db.prepare("SELECT * FROM daily_logs WHERE emp_id=? AND date=?").get(emp.emp_id, today);
  res.json({ linked: true, emp_id: emp.emp_id, emp_name: emp.name, today, log: row || null });
});

// Employee KPI dashboard — Attendance + Office Work + Activity per employee.
app.get('/api/employee-kpi', (req, res, next) => requireManagerOrAdmin(req, res, () => {
  const month = req.query.month || new Date().toISOString().slice(0, 7);
  const [y, m] = month.split('-').map(Number);
  const start = `${month}-01`;
  const endDate = new Date(y, m, 0);
  const end = endDate.toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);

  // Working days in the month (Sun-Thu = working in Bangladesh, per existing logic)
  const daysInMonth = endDate.getDate();
  let workingDays = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(y, m - 1, d).getDay();
    if (dow !== 5 && dow !== 6) workingDays++;
  }
  // Effective working days so far (don't penalise for days that haven't happened yet)
  let effWorking = 0;
  const todayInMonth = today >= start && today <= end;
  const cutoff = todayInMonth ? today : end;
  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${month}-${String(d).padStart(2, '0')}`;
    if (date > cutoff) break;
    const dow = new Date(y, m - 1, d).getDay();
    if (dow !== 5 && dow !== 6) effWorking++;
  }

  const employees = db.prepare("SELECT * FROM employees WHERE active='Yes'").all();
  // Activity types we score against. Weights are intentionally simple.
  const ACT_WEIGHTS = {
    lead_created:              3,
    lead_status_changed:       2,
    lead_assigned:             1,
    lead_payment:              4,
    payment_recorded:          2,
    application_stage_changed: 3,
    uni_app_status:            3,
    reply_to_student:          2,
    note:                      1,
  };
  const ACT_GROUPS = {
    lead_work:    ['lead_created', 'lead_status_changed', 'lead_assigned'],
    payments:     ['lead_payment', 'payment_recorded'],
    application:  ['application_stage_changed', 'uni_app_status'],
    communication:['reply_to_student', 'note'],
  };

  const rows = employees.map(emp => {
    // — Attendance —
    const attLogs = db.prepare("SELECT * FROM attendance WHERE emp_id=? AND date BETWEEN ? AND ?").all(emp.emp_id, start, end);
    const present = attLogs.filter(l => l.status === 'Present').length;
    const late    = attLogs.filter(l => l.status === 'Late').length;
    const absent  = Math.max(0, effWorking - present - late);
    const hours   = attLogs.reduce((s, l) => s + (l.hours_worked || 0), 0);
    const avgIn   = attLogs.filter(l => l.check_in).map(l => l.check_in).sort()[Math.floor(attLogs.length / 2)] || null;
    const attendancePct = effWorking > 0 ? Math.round(((present + late) / effWorking) * 100) : 0;

    // — Office Work (daily logs) —
    const logs = db.prepare("SELECT date FROM daily_logs WHERE emp_id=? AND date BETWEEN ? AND ?").all(emp.emp_id, start, end);
    const logsSubmitted = logs.length;
    // Streak: count back from today (or end of month) however many consecutive days have a log
    let streak = 0;
    {
      const dates = new Set(logs.map(l => l.date));
      const d = new Date(Math.min(new Date(today).getTime(), endDate.getTime()));
      while (true) {
        const ds = d.toISOString().slice(0, 10);
        if (ds < start) break;
        const dow = d.getDay();
        if (dow !== 5 && dow !== 6) {
          if (!dates.has(ds)) break;
          streak++;
        }
        d.setDate(d.getDate() - 1);
      }
    }
    const logPct = effWorking > 0 ? Math.round((logsSubmitted / effWorking) * 100) : 0;

    // — Activity (auto-pulled from activity_log) —
    // Match by both possible identities: user account name and user_id link
    const acts = db.prepare(`
      SELECT type, COUNT(*) as n
      FROM activity_log
      WHERE substr(created_at,1,10) BETWEEN ? AND ?
        AND (actor_name = ? OR actor_user_id IN (SELECT id FROM users WHERE emp_id=? OR LOWER(email)=LOWER(?)))
      GROUP BY type`).all(start, end, emp.name, emp.emp_id, emp.email || '');
    const actByType = {}; acts.forEach(a => actByType[a.type] = a.n);
    let actScore = 0;
    Object.entries(ACT_WEIGHTS).forEach(([type, w]) => actScore += (actByType[type] || 0) * w);
    const groupTotals = Object.fromEntries(Object.entries(ACT_GROUPS).map(([g, types]) =>
      [g, types.reduce((s, t) => s + (actByType[t] || 0), 0)]
    ));
    const totalEvents = Object.values(actByType).reduce((s, n) => s + n, 0);

    // — Composite Score (0-100). Attendance 30 + Office Work 20 + Activity 50.
    // Activity is normalised against a "good day = 12 weighted points" expectation.
    const attendanceScore = Math.min(30, (attendancePct / 100) * 30);
    const logsScore       = Math.min(20, (logPct / 100) * 20);
    const targetActScore  = Math.max(1, effWorking * 12);
    const activityScore   = Math.min(50, (actScore / targetActScore) * 50);
    const score = Math.round(attendanceScore + logsScore + activityScore);

    return {
      id: emp.id,
      emp_id: emp.emp_id, name: emp.name, role: emp.role,
      attendance: { present, late, absent, workingDays: effWorking, totalHours: +hours.toFixed(1), avgCheckIn: avgIn, attendancePct },
      office_work: { logsSubmitted, logPct, streak, effWorking },
      activity:    { total: totalEvents, score: actScore, by_type: actByType, by_group: groupTotals },
      score,
    };
  }).sort((a, b) => b.score - a.score);

  res.json({ month, workingDays, effWorking, employees: rows });
}));

// ─── REPORTS — weekly / monthly performance digest ─────────────────────────
// Comprehensive aggregation across all subsystems in one JSON response so
// the Dashboard can render the whole digest with one fetch.
function dayRangeFor(period, anchorIso) {
  const anchor = new Date(anchorIso + 'T00:00:00Z');
  const day = (d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  if (period === 'week') {
    // ISO-ish week, but office-friendly: Sun → Sat for Bangladesh weeks.
    const dow = anchor.getUTCDay(); // 0 = Sunday
    const start = day(new Date(anchor.getTime() - dow * 86400000));
    const end   = day(new Date(start.getTime() + 6 * 86400000));
    const prevStart = day(new Date(start.getTime() - 7 * 86400000));
    const prevEnd   = day(new Date(end.getTime()   - 7 * 86400000));
    return { start, end, prevStart, prevEnd, label: `${start.toISOString().slice(5,10)}–${end.toISOString().slice(5,10)}`, prevLabel: `${prevStart.toISOString().slice(5,10)}–${prevEnd.toISOString().slice(5,10)}` };
  }
  // month
  const start = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1));
  const end   = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 0));
  const prevStart = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() - 1, 1));
  const prevEnd   = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 0));
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  return { start, end, prevStart, prevEnd,
    label: `${monthNames[anchor.getUTCMonth()]} ${anchor.getUTCFullYear()}`,
    prevLabel: `${monthNames[prevStart.getUTCMonth()]} ${prevStart.getUTCFullYear()}`,
  };
}
function isoDate(d) { return d.toISOString().slice(0, 10); }

app.get('/api/reports', (req, res, next) => requireManagerOrAdmin(req, res, () => {
  const period = req.query.period === 'week' ? 'week' : 'month';
  const anchor = (req.query.date || new Date().toISOString().slice(0, 10)).slice(0, 10);
  const range = dayRangeFor(period, anchor);
  const startStr = isoDate(range.start), endStr = isoDate(range.end);
  const prevStartStr = isoDate(range.prevStart), prevEndStr = isoDate(range.prevEnd);

  // ── Leads ──────────────────────────────────────────────────────────────
  const newLeadsRow = db.prepare(`SELECT COUNT(*) AS n FROM leads
    WHERE (date_added BETWEEN ? AND ?) OR (substr(created_at,1,10) BETWEEN ? AND ?)`).get(startStr, endStr, startStr, endStr);
  const newLeadsPrev = db.prepare(`SELECT COUNT(*) AS n FROM leads
    WHERE (date_added BETWEEN ? AND ?) OR (substr(created_at,1,10) BETWEEN ? AND ?)`).get(prevStartStr, prevEndStr, prevStartStr, prevEndStr);
  const leadsBySource = db.prepare(`SELECT COALESCE(source,'Unknown') AS k, COUNT(*) AS n FROM leads
    WHERE (date_added BETWEEN ? AND ?) OR (substr(created_at,1,10) BETWEEN ? AND ?) GROUP BY source`).all(startStr, endStr, startStr, endStr);
  const leadsByDest = db.prepare(`SELECT COALESCE(destination,'Unknown') AS k, COUNT(*) AS n FROM leads
    WHERE (date_added BETWEEN ? AND ?) OR (substr(created_at,1,10) BETWEEN ? AND ?) GROUP BY destination`).all(startStr, endStr, startStr, endStr);
  const enrolled = db.prepare(`SELECT COUNT(*) AS n FROM activity_log
    WHERE type='lead_status_changed' AND to_value='Enrolled' AND substr(created_at,1,10) BETWEEN ? AND ?`).get(startStr, endStr).n;
  const enrolledPrev = db.prepare(`SELECT COUNT(*) AS n FROM activity_log
    WHERE type='lead_status_changed' AND to_value='Enrolled' AND substr(created_at,1,10) BETWEEN ? AND ?`).get(prevStartStr, prevEndStr).n;

  // ── Applications ───────────────────────────────────────────────────────
  const stagesAdvanced = db.prepare(`SELECT to_value AS stage, COUNT(*) AS n FROM activity_log
    WHERE type='application_stage_changed' AND substr(created_at,1,10) BETWEEN ? AND ? GROUP BY to_value`).all(startStr, endStr);
  const uniMoves = db.prepare(`SELECT to_value AS status, COUNT(*) AS n FROM activity_log
    WHERE type='uni_app_status' AND substr(created_at,1,10) BETWEEN ? AND ? GROUP BY to_value`).all(startStr, endStr);

  // ── Cashflow ───────────────────────────────────────────────────────────
  const cashIn  = db.prepare(`SELECT COALESCE(SUM(amount),0) AS s, COUNT(*) AS c FROM income   WHERE date BETWEEN ? AND ? AND (exclude_from_cash IS NULL OR exclude_from_cash = 0)`).get(startStr, endStr);
  const cashOut = db.prepare(`SELECT COALESCE(SUM(amount),0) AS s, COUNT(*) AS c FROM expenses WHERE date BETWEEN ? AND ?`).get(startStr, endStr);
  const prevIn  = db.prepare(`SELECT COALESCE(SUM(amount),0) AS s FROM income   WHERE date BETWEEN ? AND ? AND (exclude_from_cash IS NULL OR exclude_from_cash = 0)`).get(prevStartStr, prevEndStr).s;
  const prevOut = db.prepare(`SELECT COALESCE(SUM(amount),0) AS s FROM expenses WHERE date BETWEEN ? AND ?`).get(prevStartStr, prevEndStr).s;
  const incomeCat  = db.prepare(`SELECT COALESCE(category,'Uncategorised') AS k, SUM(amount) AS v FROM income   WHERE date BETWEEN ? AND ? AND (exclude_from_cash IS NULL OR exclude_from_cash = 0) GROUP BY category ORDER BY v DESC`).all(startStr, endStr);
  const expenseCat = db.prepare(`SELECT COALESCE(category,'Uncategorised') AS k, SUM(amount) AS v FROM expenses WHERE date BETWEEN ? AND ? GROUP BY category ORDER BY v DESC`).all(startStr, endStr);
  const topClients = db.prepare(`SELECT client_name AS k, SUM(amount) AS v FROM income WHERE date BETWEEN ? AND ? AND client_name IS NOT NULL AND (exclude_from_cash IS NULL OR exclude_from_cash = 0) GROUP BY client_name ORDER BY v DESC LIMIT 5`).all(startStr, endStr);
  // Cash position at end of period
  const initial = parseFloat(getConfig('cash_initial')) || 0;
  const priorIn  = db.prepare(`SELECT COALESCE(SUM(amount),0) AS s FROM income   WHERE date < ? AND (exclude_from_cash IS NULL OR exclude_from_cash = 0)`).get(startStr).s;
  const priorOut = db.prepare(`SELECT COALESCE(SUM(amount),0) AS s FROM expenses WHERE date < ?`).get(startStr).s;
  const opening = initial + priorIn - priorOut;
  const closing = opening + cashIn.s - cashOut.s;

  // ── Attendance summary ─────────────────────────────────────────────────
  const activeEmps = db.prepare("SELECT COUNT(*) AS n FROM employees WHERE active='Yes'").get().n;
  const attRows = db.prepare(`SELECT emp_id, status FROM attendance WHERE date BETWEEN ? AND ?`).all(startStr, endStr);
  const presentCount = attRows.filter(r => r.status === 'Present' || r.status === 'Late').length;
  const lateCount    = attRows.filter(r => r.status === 'Late').length;
  // Working-day count in the range (Sun-Thu)
  let workingDays = 0;
  for (let d = new Date(range.start); d <= range.end; d.setUTCDate(d.getUTCDate() + 1)) {
    const dow = d.getUTCDay(); if (dow !== 5 && dow !== 6) workingDays++;
  }
  const attendancePct = (activeEmps * workingDays) > 0
    ? Math.round((presentCount / (activeEmps * workingDays)) * 100) : 0;
  const dailyLogsSubmitted = db.prepare(`SELECT COUNT(*) AS n FROM daily_logs WHERE date BETWEEN ? AND ?`).get(startStr, endStr).n;

  // ── Top Performers (this period) ───────────────────────────────────────
  // Use activity-points to rank consultants by ACTOR_NAME
  const ACT_WEIGHTS = { lead_created:3, lead_status_changed:2, lead_assigned:1, lead_payment:4, payment_recorded:2, application_stage_changed:3, uni_app_status:3, reply_to_student:2, note:1 };
  const actorRows = db.prepare(`SELECT actor_name, type, COUNT(*) AS n FROM activity_log
    WHERE substr(created_at,1,10) BETWEEN ? AND ? AND actor_name IS NOT NULL AND actor_name != 'System'
    GROUP BY actor_name, type`).all(startStr, endStr);
  const byActor = {};
  actorRows.forEach(r => {
    if (!byActor[r.actor_name]) byActor[r.actor_name] = { name: r.actor_name, points: 0, events: 0, by_type: {} };
    byActor[r.actor_name].events += r.n;
    byActor[r.actor_name].points += (ACT_WEIGHTS[r.type] || 0) * r.n;
    byActor[r.actor_name].by_type[r.type] = r.n;
  });
  const topPerformers = Object.values(byActor).sort((a, b) => b.points - a.points).slice(0, 5);

  // ── Highlights — notable single events ─────────────────────────────────
  const highlights = [];
  const enrollEvents = db.prepare(`SELECT lead_name, actor_name, created_at FROM activity_log
    WHERE type='lead_status_changed' AND to_value='Enrolled' AND substr(created_at,1,10) BETWEEN ? AND ?
    ORDER BY id DESC LIMIT 3`).all(startStr, endStr);
  enrollEvents.forEach(e => highlights.push({ icon: '🎓', text: `${e.lead_name} enrolled (by ${e.actor_name})` }));

  const bigPays = db.prepare(`SELECT amount, lead_name, actor_name FROM activity_log
    WHERE type IN ('lead_payment','payment_recorded') AND substr(created_at,1,10) BETWEEN ? AND ? AND amount IS NOT NULL
    ORDER BY amount DESC LIMIT 3`).all(startStr, endStr);
  bigPays.forEach(p => highlights.push({ icon: '💰', text: `৳${Number(p.amount).toLocaleString()} payment${p.lead_name ? ` for ${p.lead_name}` : ''}${p.actor_name ? ` (by ${p.actor_name})` : ''}` }));

  const visaApprovals = db.prepare(`SELECT lead_name, actor_name FROM activity_log
    WHERE type='application_stage_changed' AND to_value='visa_approved' AND substr(created_at,1,10) BETWEEN ? AND ?
    ORDER BY id DESC LIMIT 3`).all(startStr, endStr);
  visaApprovals.forEach(v => highlights.push({ icon: '🛂', text: `${v.lead_name} visa approved (by ${v.actor_name})` }));

  const newLeadCount = db.prepare(`SELECT COUNT(*) AS n FROM leads WHERE lead_status='New Lead' AND (((date_added BETWEEN ? AND ?) OR (substr(created_at,1,10) BETWEEN ? AND ?)))`).get(startStr, endStr, startStr, endStr).n;
  const officeVisitCount = db.prepare(`SELECT COUNT(*) AS n FROM leads WHERE lead_status='Office Visited' AND (((date_added BETWEEN ? AND ?) OR (substr(created_at,1,10) BETWEEN ? AND ?)))`).get(startStr, endStr, startStr, endStr).n;
  const fileOpenCount = db.prepare(`SELECT COUNT(*) AS n FROM leads WHERE lead_status='File Opened' AND (((date_added BETWEEN ? AND ?) OR (substr(created_at,1,10) BETWEEN ? AND ?)))`).get(startStr, endStr, startStr, endStr).n;
  const positiveCount = db.prepare(`SELECT COUNT(*) AS n FROM leads WHERE lead_status='Positive' AND (((date_added BETWEEN ? AND ?) OR (substr(created_at,1,10) BETWEEN ? AND ?)))`).get(startStr, endStr, startStr, endStr).n;
  const noResponseCount = db.prepare(`SELECT COUNT(*) AS n FROM leads WHERE lead_status='No Response' AND (((date_added BETWEEN ? AND ?) OR (substr(created_at,1,10) BETWEEN ? AND ?)))`).get(startStr, endStr, startStr, endStr).n;

  const workTimeRow = db.prepare(`SELECT COALESCE(SUM(hours_worked),0) AS total_hours, COALESCE(AVG(hours_worked),0) AS avg_hours FROM attendance WHERE date BETWEEN ? AND ?`).get(startStr, endStr);

  const delta = (cur, prev) => prev === 0 ? (cur > 0 ? 100 : 0) : Math.round(((cur - prev) / prev) * 100);

  res.json({
    period: { type: period, start: startStr, end: endStr, label: range.label,
              previousStart: prevStartStr, previousEnd: prevEndStr, previousLabel: range.prevLabel },
    headline: {
      new_leads:    { current: newLeadsRow.n, previous: newLeadsPrev.n, delta: delta(newLeadsRow.n, newLeadsPrev.n) },
      enrolments:   { current: enrolled, previous: enrolledPrev, delta: delta(enrolled, enrolledPrev) },
      revenue:      { current: cashIn.s,  previous: prevIn,  delta: delta(cashIn.s, prevIn) },
      net_cash:     { current: cashIn.s - cashOut.s, previous: prevIn - prevOut, delta: delta(cashIn.s - cashOut.s, prevIn - prevOut) },
      attendance:   { current: attendancePct },
    },
    leads:         { 
      new: newLeadsRow.n, 
      by_source: leadsBySource, 
      by_destination: leadsByDest, 
      enrolled, 
      conversion_rate: newLeadsRow.n ? Math.round((enrolled / newLeadsRow.n) * 100) : 0,
      by_status: {
        new_lead: newLeadCount,
        office_visit: officeVisitCount,
        file_open: fileOpenCount,
        positive: positiveCount,
        no_response: noResponseCount
      }
    },
    applications:  { stages_advanced: stagesAdvanced, university_moves: uniMoves },
    cashflow:      { opening, in: cashIn.s, out: cashOut.s, net: cashIn.s - cashOut.s, closing,
                     income_by_category: incomeCat, expense_by_category: expenseCat, top_clients: topClients,
                     income_entries: cashIn.c, expense_entries: cashOut.c },
    attendance:    { active_employees: activeEmps, working_days: workingDays, attendance_pct: attendancePct,
                     late_count: lateCount, total_logs: dailyLogsSubmitted,
                     total_hours: Math.round(workTimeRow.total_hours),
                     avg_hours: Number(workTimeRow.avg_hours.toFixed(1)) },
    top_performers: topPerformers,
    highlights,
  });
}));

// Per-employee drilldown — full activity feed + daily logs for one person
app.get('/api/employee-kpi/:emp_id', (req, res, next) => requireManagerOrAdmin(req, res, () => {
  const month = req.query.month || new Date().toISOString().slice(0, 7);
  const start = `${month}-01`;
  const endDate = new Date(parseInt(month.slice(0, 4)), parseInt(month.slice(5)), 0);
  const end = endDate.toISOString().slice(0, 10);
  const emp = db.prepare("SELECT * FROM employees WHERE emp_id=?").get(req.params.emp_id);
  if (!emp) return res.status(404).json({ error: 'Employee not found' });

  const attendance = db.prepare("SELECT * FROM attendance WHERE emp_id=? AND date BETWEEN ? AND ? ORDER BY date").all(emp.emp_id, start, end);
  const logs       = db.prepare("SELECT * FROM daily_logs WHERE emp_id=? AND date BETWEEN ? AND ? ORDER BY date DESC").all(emp.emp_id, start, end);
  const activity   = db.prepare(`SELECT * FROM activity_log
    WHERE substr(created_at,1,10) BETWEEN ? AND ?
      AND (actor_name = ? OR actor_user_id IN (SELECT id FROM users WHERE emp_id=? OR LOWER(email)=LOWER(?)))
    ORDER BY id DESC LIMIT 500`).all(start, end, emp.name, emp.emp_id, emp.email || '');
  res.json({ employee: emp, month, attendance, logs, activity });
}));

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

// Track in-flight syncs so a channel can't be synced twice at once.
const activeSyncs = new Set();

// Helper to sync historical messages from Facebook/Instagram Page Channel
async function syncChannelMessages(channelId, months = 6) {
  const channel = db.prepare("SELECT * FROM channels WHERE id=?").get(channelId);
  if (!channel || !channel.access_token) return { imported: 0, skipped: 0 };
  if (channel.type !== 'messenger' && channel.type !== 'instagram') return { imported: 0, skipped: 0 };

  const token   = channel.access_token;
  const pageId  = channel.page_id;
  const since   = Math.floor(Date.now() / 1000) - (months * 30 * 24 * 3600);

  const MAX_MESSAGES = 5000;
  let imported = 0, skipped = 0, conversations = 0;

  async function fbGet(url) {
    const r = await fetch(url);
    const d = await r.json();
    if (d.error) throw new Error(`FB API: ${d.error.message}`);
    return { items: d.data || [], nextUrl: d.paging?.next || null };
  }

  const stmtInsertMsg = db.prepare(
    `INSERT OR IGNORE INTO messages
       (conversation_id, direction, type, content, media_url, wa_message_id, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'delivered', ?)`
  );
  const stmtConvUpdate = db.prepare(
    `UPDATE conversations SET last_message=?, last_message_at=?
     WHERE id=? AND (last_message_at IS NULL OR last_message_at < ?)`
  );

  const insertBatch = db.transaction((rows, conv) => {
    let added = 0;
    for (const msg of rows) {
      const fromPage = String(msg.from?.id) === String(pageId);

      let content, type = 'text', mediaUrl = null;
      const att = msg.attachments?.data?.[0];
      if (msg.message) {
        content = msg.message;
      } else if (msg.sticker) {
        content = '😊 Sticker'; type = 'sticker'; mediaUrl = msg.sticker;
      } else if (att) {
        const mime = att.mime_type || '';
        mediaUrl = att.image_data?.url || att.video_data?.url || att.file_url || null;
        if (mime.startsWith('image'))      { content = '📷 Photo';      type = 'image'; }
        else if (mime.startsWith('video')) { content = '🎥 Video';      type = 'video'; }
        else if (mime.startsWith('audio')) { content = '🎵 Audio';      type = 'audio'; }
        else                               { content = `📎 ${att.name || 'File'}`; type = 'file'; }
      } else {
        content = '[message]';
      }

      const createdAt = msg.created_time
        ? new Date(msg.created_time).toISOString().replace('T', ' ').slice(0, 19)
        : null;

      const result = stmtInsertMsg.run(
        conv.id, fromPage ? 'out' : 'in', type, content, mediaUrl, msg.id, createdAt
      );
      if (result.changes > 0) {
        added++;
        if (createdAt) stmtConvUpdate.run(content, createdAt, conv.id, createdAt);
      }
    }
    return added;
  });

  if (db.pauseSave) db.pauseSave();
  let convCounter = 0;

  const cutoffMs = since * 1000;
  const toSqlTime = (t) => t ? new Date(t).toISOString().replace('T', ' ').slice(0, 19) : null;

  try {
    let convUrl = `https://graph.facebook.com/v19.0/${pageId}/conversations`
      + `?fields=updated_time,participants,snippet`
      + `&limit=50&access_token=${token}`;

    let stop = false;
    while (convUrl && !stop && imported + skipped < MAX_MESSAGES) {
      const { items: fbConvs, nextUrl } = await fbGet(convUrl);
      convUrl = nextUrl;

      for (const fbConv of fbConvs) {
        if (imported + skipped >= MAX_MESSAGES) break;

        const updatedMs = fbConv.updated_time ? new Date(fbConv.updated_time).getTime() : 0;
        if (updatedMs && updatedMs < cutoffMs) { stop = true; break; }

        conversations++;
        const other = (fbConv.participants?.data || []).find(p => String(p.id) !== String(pageId));
        if (!other) continue;

        let avatar = null;
        try {
          const pr = await fetch(`https://graph.facebook.com/v19.0/${other.id}?fields=profile_pic,name&access_token=${token}`);
          const pd = await pr.json();
          if (!pd.error) avatar = pd.profile_pic || null;
          if (pd.name) other.name = pd.name;
        } catch {}

        const contact = upsertContact({ name: other.name || 'Messenger User', messenger_id: other.id, avatar_url: avatar });
        const conv    = upsertConversation(contact.id, channel.id, 'messenger');

        const convTime = toSqlTime(fbConv.updated_time);
        if (convTime) {
          db.prepare(`UPDATE conversations SET last_message=COALESCE(@snip,last_message), last_message_at=@t
                      WHERE id=@id AND (last_message_at IS NULL OR last_message_at < @t)`)
            .run({ snip: fbConv.snippet || null, t: convTime, id: conv.id });
        }

        let msgUrl = `https://graph.facebook.com/v19.0/${fbConv.id}/messages`
          + `?fields=message,from,created_time,sticker,attachments{mime_type,name,image_data,video_data,file_url}`
          + `&limit=25&access_token=${token}`;
        let convMsgCount = 0;

        while (msgUrl && imported + skipped < MAX_MESSAGES && convMsgCount < 500) {
          const { items: msgs, nextUrl: nextMsgUrl } = await fbGet(msgUrl);
          msgUrl = nextMsgUrl;
          if (msgs.length === 0) break;

          const oldest = msgs[msgs.length - 1]?.created_time;
          const added = insertBatch(msgs, conv);
          imported += added;
          skipped  += msgs.length - added;
          convMsgCount += msgs.length;
          if (oldest && new Date(oldest).getTime() < cutoffMs) break;
        }

        if (++convCounter % 10 === 0 && db.resumeSave && db.pauseSave) {
          db.resumeSave();
          db.pauseSave();
          broadcast('sync_progress', { channel_id: channel.id, channel: channel.name, conversations, imported });
        }
      }
    }

    const capped = (imported + skipped >= MAX_MESSAGES);
    console.log(`[sync] ${channel.name}: ${conversations} convs, ${imported} imported, ${skipped} skipped${capped ? ' (capped)' : ''}`);
    broadcast('sync_done', { channel_id: channel.id, channel: channel.name, imported, skipped, conversations, capped });
    return { imported, skipped, conversations, capped };

  } catch (e) {
    console.error('[sync] error:', e.message);
    broadcast('sync_error', { channel_id: channel.id, channel: channel.name, error: e.message, imported, conversations });
    throw e;
  } finally {
    if (db.resumeSave) db.resumeSave();
  }
}

// ─── Sync historical messages from a Messenger / Instagram channel ───────────
// Runs in the BACKGROUND and responds immediately — a long sync would otherwise
// exceed nginx's gateway timeout (504). Progress streams over SSE; the inbox
// polling picks up new conversations as they're imported.
app.post('/api/channels/:id/sync', async (req, res) => {
  const channel = db.prepare("SELECT * FROM channels WHERE id=?").get(req.params.id);
  if (!channel) return res.status(404).json({ error: 'Channel not found' });
  if (!channel.access_token) return res.status(400).json({ error: 'No access token on this channel' });
  if (channel.type !== 'messenger' && channel.type !== 'instagram')
    return res.status(400).json({ error: 'Sync only supported for Messenger and Instagram channels' });
  if (activeSyncs.has(channel.id))
    return res.status(409).json({ error: 'A sync is already running for this channel' });

  const { months = 6 } = req.body || {};

  // Respond NOW — everything below runs in the background.
  activeSyncs.add(channel.id);
  res.json({ ok: true, started: true, channel: channel.name });

  syncChannelMessages(channel.id, months)
    .catch(e => console.error('[sync] Background sync failed:', e.message))
    .finally(() => activeSyncs.delete(channel.id));
});

// ─────────────────────────────────────────────────────────
// CONTACTS
// ─────────────────────────────────────────────────────────
app.get('/api/contacts', (req, res) => {
  const { search } = req.query;
  const where = (search && search !== 'undefined' && search !== 'null') ? `WHERE name LIKE '%${search}%' OR phone LIKE '%${search}%'` : '';
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
    contacts.avatar_url AS contact_avatar,
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
  if (search && search !== 'undefined' && search !== 'null') { where.push("(contacts.name LIKE @search OR contacts.phone LIKE @search)"); params.search=`%${search}%`; }
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

  if (lead_id) {
    const conv = db.prepare("SELECT channel_id FROM conversations WHERE id=?").get(req.params.id);
    if (conv) {
      const channel = db.prepare("SELECT consultant FROM channels WHERE id=?").get(conv.channel_id);
      const lead = db.prepare("SELECT assigned_consultant FROM leads WHERE id=?").get(lead_id);
      if (lead && (!lead.assigned_consultant || lead.assigned_consultant.trim() === '')) {
        db.prepare("UPDATE leads SET assigned_consultant=? WHERE id=?").run(channel?.consultant || 'Abdullah Al Rakib', lead_id);
      }
    }
  }

  res.json(db.prepare(`${CONV_SELECT} WHERE conversations.id=?`).get(req.params.id));
});

// Create outbound conversation manually
app.post('/api/conversations', (req, res) => {
  try {
    const { channel_id, phone, name, lead_id } = req.body;
    if (!channel_id || !phone) return res.status(400).json({ error: 'channel_id and phone required' });
    const channel = db.prepare("SELECT * FROM channels WHERE id=?").get(channel_id);
    if (!channel) return res.status(404).json({ error: 'Channel not found' });
    const contact = upsertContact({ name: name || phone, phone, wa_id: channel.type === 'whatsapp' ? phone : null });
    
    // Link contact and conversation to lead if lead_id is provided
    let resolvedLeadId = lead_id;
    if (!resolvedLeadId && phone) {
      // Find lead by matching phone exactly
      let matchedLead = db.prepare("SELECT id FROM leads WHERE phone=?").get(phone);
      if (!matchedLead) {
        // Try cleaning the input phone to check if any lead phone matches when cleaned
        const cleanPhone = phone.replace(/\D/g, '');
        if (cleanPhone.length >= 8) {
          // Find all leads and look for one with matching digits
          const allLeads = db.prepare("SELECT id, phone FROM leads WHERE phone IS NOT NULL").all();
          matchedLead = allLeads.find(l => {
            const lp = l.phone.replace(/\D/g, '');
            return lp === cleanPhone || lp.endsWith(cleanPhone) || cleanPhone.endsWith(lp);
          });
        }
      }
      if (matchedLead) {
        resolvedLeadId = matchedLead.id;
      }
    }
    
    if (resolvedLeadId) {
      db.prepare("UPDATE contacts SET lead_id=? WHERE id=?").run(resolvedLeadId, contact.id);
    }
    
    const conversation = upsertConversation(contact.id, channel_id, channel.type);
    
    // Make sure conversation lead_id is set
    if (resolvedLeadId) {
      db.prepare("UPDATE conversations SET lead_id=? WHERE id=?").run(resolvedLeadId, conversation.id);
      // Auto-assign consultant to the lead if not set
      const lead = db.prepare("SELECT assigned_consultant FROM leads WHERE id=?").get(resolvedLeadId);
      if (lead && (!lead.assigned_consultant || lead.assigned_consultant.trim() === '')) {
        db.prepare("UPDATE leads SET assigned_consultant=? WHERE id=?").run(channel.consultant || 'Abdullah Al Rakib', resolvedLeadId);
      }
    }

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
  const { before, limit=500 } = req.query;
  const lim = Math.min(parseInt(limit) || 500, 2000);
  // Order CHRONOLOGICALLY by timestamp (not insert id) — synced messages are
  // inserted newest-first, so id order ≠ time order. Grab the most-recent N,
  // then flip to ascending so the chat reads oldest→newest top-to-bottom.
  const beforeClause = before ? `AND id < ${parseInt(before)}` : '';
  const msgs = db.prepare(
    `SELECT * FROM (
       SELECT * FROM messages
       WHERE conversation_id=? ${beforeClause}
       ORDER BY datetime(created_at) DESC, id DESC
       LIMIT ${lim}
     ) ORDER BY datetime(created_at) ASC, id ASC`
  ).all(req.params.id);
  res.json(msgs);
});

// Send message
app.post('/api/conversations/:id/messages', async (req, res) => {
  try {
    const { content, type='text', sent_by='Admin', media_url } = req.body;
    if (!content && !media_url) return res.status(400).json({ error: 'content is required' });

    const conv = db.prepare(`${CONV_SELECT} WHERE conversations.id=?`).get(req.params.id);
    if (!conv) return res.status(404).json({ error:'Conversation not found' });

    // Get full channel (with token), fallback to active channel of same type if not found
    let channel = db.prepare("SELECT * FROM channels WHERE id=?").get(conv.channel_id);
    if (!channel) {
      channel = db.prepare("SELECT * FROM channels WHERE type=? AND status='active'").get(conv.channel_type);
      if (channel) {
        db.prepare("UPDATE conversations SET channel_id=? WHERE id=?").run(channel.id, req.params.id);
      }
    }
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
    const errMsg = apiResult?.error ? (apiResult.error.message || JSON.stringify(apiResult.error)) : null;
    const info = db.prepare(`INSERT INTO messages (conversation_id,direction,type,content,media_url,wa_message_id,status,sent_by,error_msg) VALUES (?,?,?,?,?,?,?,?,?)`)
      .run(req.params.id, 'out', type, content, media_url||null, waId, status, sent_by, errMsg);
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

          let content, type = msg.type, mediaUrl = null, caption = null;
          if (msg.type === 'text')     { content = msg.text?.body; }
          else if (msg.type === 'image')    { mediaUrl = msg.image?.id;    caption = msg.image?.caption; content = '[Image]'; }
          else if (msg.type === 'audio')    { mediaUrl = msg.audio?.id;    content = '[Voice Message]'; }
          else if (msg.type === 'video')    { mediaUrl = msg.video?.id;    caption = msg.video?.caption; content = '[Video]'; }
          else if (msg.type === 'document') { mediaUrl = msg.document?.id; content = `[Document: ${msg.document?.filename||''}]`; }
          else if (msg.type === 'location') { content = `📍 Location: ${msg.location?.latitude},${msg.location?.longitude}`; }
          else if (msg.type === 'button')   { content = msg.button?.text; type='text'; }
          else { content = `[${msg.type}]`; }

          saveInboundMessage(conv.id, content, type, msg.id, mediaUrl, caption);
          createLeadFromContact(contact.id, 'whatsapp', content);
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
            if (lead) { 
              sendCAPIEvent('Lead', lead); 
              broadcast('new_lead', { lead }); 

              // Automatically create a contact and conversation if phone is available
              if (lead.phone) {
                const whatsappChannel = db.prepare("SELECT * FROM channels WHERE type='whatsapp' AND active=1 LIMIT 1").get();
                if (whatsappChannel) {
                  const contact = upsertContact({
                    name: lead.client_name,
                    phone: lead.phone,
                    wa_id: lead.phone,
                    lead_id: lead.id
                  });
                  const conv = upsertConversation(contact.id, whatsappChannel.id, 'whatsapp');
                  db.prepare("UPDATE conversations SET lead_id=? WHERE id=?").run(lead.id, conv.id);
                  
                  // Auto-assign consultant to the lead if not set
                  if (!lead.assigned_consultant || lead.assigned_consultant.trim() === '') {
                    db.prepare("UPDATE leads SET assigned_consultant=? WHERE id=?").run(whatsappChannel.consultant || 'Abdullah Al Rakib', lead.id);
                  }
                  console.log(`[leadgen] Auto-created WhatsApp conversation for lead ${lead.lead_id}`);
                }
              }
            }
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
        // Fetch name + profile picture from Messenger API
        try {
          const nr = await fetch(`https://graph.facebook.com/v19.0/${senderId}?fields=name,profile_pic&access_token=${channel.access_token}`);
          const nd = await nr.json();
          if (nd.name) db.prepare("UPDATE contacts SET name=? WHERE id=?").run(nd.name, contact.id);
          if (nd.profile_pic) db.prepare("UPDATE contacts SET avatar_url=COALESCE(avatar_url,?) WHERE id=?").run(nd.profile_pic, contact.id);
        } catch {}

        const conv = upsertConversation(contact.id, channel.id, 'messenger');

        // Extract text or media attachment
        let text = messaging.message.text, mtype = 'text', murl = null;
        const att = messaging.message.attachments?.[0];
        if (!text && att) {
          murl = att.payload?.url || null;
          if (att.type === 'image')      { text = '📷 Photo';  mtype = 'image'; }
          else if (att.type === 'video') { text = '🎥 Video';  mtype = 'video'; }
          else if (att.type === 'audio') { text = '🎵 Audio';  mtype = 'audio'; }
          else if (att.type === 'file')  { text = '📎 File';   mtype = 'file'; }
          else                           { text = `[${att.type}]`; mtype = att.type || 'text'; }
        }
        if (!text) text = '[message]';
        saveInboundMessage(conv.id, text, mtype, messaging.message.mid, murl);
        createLeadFromContact(contact.id, 'messenger', text);
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
        createLeadFromContact(contact.id, 'instagram', text);
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
app.get('/api/settings', (req, res) => {
  const getList = (key, defaults) => {
    const val = getConfig(key);
    try { if (val) return JSON.parse(val); } catch {}
    return defaults;
  };
  
  // Auto-align with active employees list (all employees are consultants by default)
  let activeEmployees = [];
  try {
    activeEmployees = db.prepare("SELECT name FROM employees WHERE active = 'Yes' OR active IS NULL OR active = '1'").all().map(e => e.name).filter(Boolean);
  } catch (e) {
    console.error("Could not fetch active employees for settings:", e);
  }
  const customConsultants = getList('settings_consultants', ['Ema','Afsana','Sakib','Mukta','Rafi','Admin']);
  const combinedConsultants = Array.from(new Set([...activeEmployees, ...customConsultants])).filter(Boolean).sort();

  res.json({
    consultants: combinedConsultants,
    leadSources: getList('settings_leadSources', ['China Web Form','Web Lead (New)','Client Sheet','WhatsApp','Facebook Ad','Instagram Ad','Referral','Walk-in','YouTube','Google Ad','Meta Lead Ad']),
    destinations: getList('settings_destinations', ['China','Georgia','Malta']),
    leadStatuses: getList('settings_leadStatuses', ['New Lead','No Response','Positive','Office Visited','File Opened','Enrolled','Not Interested']),
    fileStages: getList('settings_fileStages', [
      'Documents Collecting',
      'Documents Ready',
      'Applied to University',
      'Interview',
      'Pre-Admission',
      'Deposit',
      'Admission/JW Received',
      'Visa Applied',
      'Visa Approved',
      'Visa Rejected',
      'Enrolled',
      'Cancelled',
      'Withdraw'
    ]),
    paymentStatuses: getList('settings_paymentStatuses', ['Pending','Partial','Paid','Refunded']),
    incomeCategories: getList('settings_incomeCategories', ['Service Charge','Application Deposit','App Fee','File Opening','Marketing Refund','Invest','Previous Cash','Other Income']),
    expenseCategories: getList('settings_expenseCategories', ['Salary','Office Rent','Marketing','Air Ticket','Airport Pickup','App Fee','Visa Fee','Medical','Mobile Recharge','Client Lunch+Snacks','Transport','Bua Bill','Tissue+Room Spray','Letterhead','Logo','Job Post','Testimonial Video','Review','Yearly Fee','Electrician+Sign Board','Mata Support','Other Expense']),
  });
});

app.post('/api/settings', (req, res, next) => requireAdmin(req, res, () => {
  const { key, value } = req.body || {};
  if (!key || !Array.isArray(value)) {
    return res.status(400).json({ error: 'key and array value are required' });
  }
  const allowedKeys = [
    'settings_consultants',
    'settings_leadSources',
    'settings_destinations',
    'settings_leadStatuses',
    'settings_fileStages',
    'settings_paymentStatuses',
    'settings_incomeCategories',
    'settings_expenseCategories'
  ];
  if (!allowedKeys.includes(key)) {
    return res.status(400).json({ error: 'invalid settings key' });
  }
  setConfig(key, JSON.stringify(value));
  res.json({ ok: true });
}));

// Catch-all: serve React app for any non-API route (production)
// Express v5 requires '/{*path}' instead of '*'
if (process.env.NODE_ENV === 'production') {
  app.get('/{*path}', (req, res) => {
    res.sendFile(join(__dirname, 'dist', 'index.html'));
  });
}
