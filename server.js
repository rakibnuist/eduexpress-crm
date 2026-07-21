import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, copyFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { createRequire } from 'module';
import { initDatabase, isDead } from './sqldb.js';
import { initWaLinked, connectWaLinked, logoutWaLinked, getWaLinkedStatus, isWaLinkedConnected, sendWaLinkedMessage } from './wa-linked.js';

const require = createRequire(import.meta.url);

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || process.env.LSNODE_SOCKET || 3001;

const PERSISTENT_HOME = '/home/u898266115';
const LOCAL_DB_PATH = join(__dirname, 'crm.db');
let DB_PATH = process.env.DB_PATH;

if (!DB_PATH || (process.platform === 'linux' && existsSync(PERSISTENT_HOME))) {
  const persistentDir = join(PERSISTENT_HOME, 'crm-data');
  let persistentOk = false;
  try {
    if (!existsSync(persistentDir)) {
      mkdirSync(persistentDir, { recursive: true });
    }
    persistentOk = true;
  } catch (err) {
    console.error(`[database] Cannot create ${persistentDir}, falling back to app dir:`, err.message);
  }

  if (persistentOk) {
    DB_PATH = join(persistentDir, 'crm.db');
  } else {
    // Hostinger denied write access to /home/u898266115 root — use app directory
    DB_PATH = LOCAL_DB_PATH;
  }

  const restoreDbPath = join(__dirname, 'restore.db');
  if (existsSync(restoreDbPath)) {
    try {
      copyFileSync(restoreDbPath, DB_PATH);
      console.log(`[database] Restored database from ${restoreDbPath} to ${DB_PATH}`);
      unlinkSync(restoreDbPath);
    } catch (err) {
      console.error(`[database] Restore failed:`, err.message);
    }
  } else if (!existsSync(DB_PATH) && existsSync(LOCAL_DB_PATH) && DB_PATH !== LOCAL_DB_PATH) {
    try {
      copyFileSync(LOCAL_DB_PATH, DB_PATH);
      console.log(`[database] Copied bundled database to ${DB_PATH}`);
    } catch (err) {}
  }
} else if (!DB_PATH) {
  DB_PATH = LOCAL_DB_PATH;
}
const DB_DIR = dirname(DB_PATH);

// Auto-recover from an OOM-induced corruption backup if the current DB is freshly created (small)
try {
  const fs = require('fs');
  const dbSize = fs.existsSync(DB_PATH) ? fs.statSync(DB_PATH).size : 0;
  if (dbSize < 2000000) {
    const corruptFiles = fs.readdirSync(DB_DIR).filter(f => f.startsWith('crm.db.corrupt-'));
    if (corruptFiles.length > 0) {
      const latestCorrupt = corruptFiles.sort().pop();
      const corruptPath = join(DB_DIR, latestCorrupt);
      if (fs.statSync(corruptPath).size > 100000) {
        fs.copyFileSync(corruptPath, DB_PATH);
        console.log(`[database] Auto-recovered corrupt database from ${latestCorrupt}`);
      }
    }
  }
} catch (err) {
  console.error('[database] Auto-recovery failed:', err.message);
}

// Override console logging to log to a persistent file for diagnostics
const LOG_PATH = join(DB_DIR, 'server.log');
function logToFile(msg) {
  try {
    const time = new Date().toISOString();
    appendFileSync(LOG_PATH, `[${time}] ${msg}\n`);
  } catch {}
}
import { appendFileSync } from 'fs';
const originalLog = console.log;
const originalError = console.error;
console.log = (...args) => {
  originalLog(...args);
  logToFile(args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' '));
};
console.error = (...args) => {
  originalError(...args);
  logToFile('[ERROR] ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' '));
};

console.log('[startup] Port detected:', PORT, 'type:', typeof PORT);
console.log('[startup] Env keys:', Object.keys(process.env).join(', '));
const app = express();
app.set('trust proxy', 1); // Trust first proxy (e.g. Hostinger's reverse proxy)
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Rate limiting — prevent brute-force and abuse
const standardLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10000, // limit each IP to 10000 requests per windowMs (essential since entire office shares a single IP)
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500, // increased for office-wide deployments sharing one IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, please try again later.' },
});
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 200, 
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Upload quota exceeded, please try again later.' },
});
app.use(standardLimiter);
// Emergency admin reset — gated behind a secret key (RESET_KEY env var).
// Without a configured key the endpoint is fully disabled, so it can never be
// abused by an anonymous visitor. Rate-limited to blunt brute-force attempts.
app.get('/api/auth/emergency-reset', authLimiter, (req, res) => {
  const expected = process.env.RESET_KEY || getConfig('reset_key') || '';
  if (!expected) {
    return res.status(404).json({ error: 'Not found' }); // disabled until RESET_KEY is set
  }
  const provided = String(req.query.key || '');
  // Constant-time comparison to avoid leaking the key via timing
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  const ok = a.length === b.length && crypto.timingSafeEqual(a, b);
  if (!ok) {
    return res.status(404).json({ error: 'Not found' }); // hide existence on wrong/missing key
  }

  // Optional custom password: ?password=... (min 8 chars); otherwise a strong random one is issued.
  const newPassword = typeof req.query.password === 'string' && req.query.password.length >= 8
    ? req.query.password
    : crypto.randomBytes(9).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 12);
  const newHash = hashPassword(newPassword);

  try {
    const existingAdmin = db.prepare("SELECT id FROM users WHERE LOWER(email) = ?").get('admin@eduexpressint.com');
    if (existingAdmin) {
      db.prepare("UPDATE users SET password_hash = ?, active = 1 WHERE id = ?").run(newHash, existingAdmin.id);
    } else {
      const info = db.prepare(`INSERT INTO users (email, name, password_hash, role, active) VALUES (?, ?, ?, ?, ?)`).run(
        'admin@eduexpressint.com', 'Administrator', newHash, 'admin', 1
      );
      db.prepare(`INSERT INTO user_roles (user_id, role) VALUES (?, ?)`).run(info.lastInsertRowid, 'founder_ceo');
    }
  } catch (e) {
    console.error('[security] emergency-reset failed:', e.message);
    return res.status(500).json({ error: 'Reset failed' });
  }
  console.log('[security] emergency-reset used for admin@eduexpressint.com from IP', req.ip);

  res.json({
    message: 'Admin password reset. Log in, then change it immediately in Settings.',
    email: 'admin@eduexpressint.com',
    password: newPassword,
  });
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/logout', authLimiter);
app.use('/api/upload', uploadLimiter);

const PERSISTENT_UPLOADS_DIR = join(PERSISTENT_HOME, 'uploads');
const LOCAL_UPLOADS_DIR = join(__dirname, 'uploads');
let UPLOADS_DIR;

if (process.platform === 'linux' && existsSync(PERSISTENT_HOME)) {
  UPLOADS_DIR = PERSISTENT_UPLOADS_DIR;
  let persistentOk = true;
  if (!existsSync(PERSISTENT_UPLOADS_DIR)) {
    try {
      mkdirSync(PERSISTENT_UPLOADS_DIR, { recursive: true });
    } catch (err) {
      console.error(`[uploads] Cannot create ${PERSISTENT_UPLOADS_DIR}, falling back to app dir:`, err.message);
      persistentOk = false;
      UPLOADS_DIR = LOCAL_UPLOADS_DIR;
    }
  }
  
  if (persistentOk) {
    // Migrate existing uploads if any
    if (existsSync(LOCAL_UPLOADS_DIR)) {
      try {
        const files = readdirSync(LOCAL_UPLOADS_DIR);
        files.forEach(file => {
          copyFileSync(join(LOCAL_UPLOADS_DIR, file), join(PERSISTENT_UPLOADS_DIR, file));
        });
        console.log(`[uploads] Auto-migrated ${files.length} uploads to persistent path.`);
      } catch (err) {
        console.error(`[uploads] Uploads migration failed:`, err.message);
      }
    }
  }
}

if (!UPLOADS_DIR || UPLOADS_DIR === LOCAL_UPLOADS_DIR) {
  UPLOADS_DIR = LOCAL_UPLOADS_DIR;
  if (!existsSync(UPLOADS_DIR)) {
    mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}
app.use('/uploads', express.static(UPLOADS_DIR));

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

app.get('/diagnose-db', (req, res) => {
  try {
    const fs = require('fs');
    const size = existsSync(DB_PATH) ? fs.statSync(DB_PATH).size : 0;
    const integrity = db.prepare("PRAGMA integrity_check").get();
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(t => t.name);
    const userCount = db.prepare("SELECT COUNT(*) as c FROM users").get().c;
    const leadsCount = db.prepare("SELECT COUNT(*) as c FROM leads").get().c;
    res.json({ db_path: DB_PATH, size, integrity, tables_count: tables.length, userCount, leadsCount, tables });
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

// Block all API calls until DB is ready, and return 503 cleanly if the WASM
// instance died from OOM (the process is restarting itself in the background).
app.use((req, res, next) => {
  console.log('[request]', req.method, req.path);
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

  // ── Network & Location enforcement ────────────────────────────────────────
  // Login is only permitted from the office network and/or office location.
  // • SSID check  — enforced when client sends an SSID value AND allowed list is configured.
  //                 (Browsers cannot detect SSID, so this only fires from a native/PWA app.)
  // • Geo check   — enforced when office lat/lng are stored in config.
  //                 All browsers that grant location permission are gated by this.
  // If neither config is set the check is skipped (safe for initial setup).
  // Admins may log in from anywhere — they are exempt from the office network
  // and geofence gates (their password has already been verified above).
  // Load multi-roles for token and enforcement
  const userRoles = db.prepare("SELECT role FROM user_roles WHERE user_id=?").all(user.id).map(r => r.role);
  if (userRoles.length === 0) {
    const roleMap = { admin: 'founder_ceo', manager: 'application_manager', consultant: 'consultant' };
    userRoles.push(roleMap[user.role] || user.role || 'consultant');
  }

  const enforceLocation = !isFullAdmin(user) && !userRoles.includes('agent'); // Full admins & agents exempt from location enforcement
  const parsedLat = Number.isFinite(parseFloat(lat)) ? parseFloat(lat) : NaN;
  const parsedLng = Number.isFinite(parseFloat(lng)) ? parseFloat(lng) : NaN;

  // Build allowed SSIDs list: JSON array in office_allowed_ssids, fallback to single office_wifi_ssid
  let allowedSSIDs = [];
  try { allowedSSIDs = JSON.parse(getConfig('office_allowed_ssids') || '[]'); } catch {}
  if (!Array.isArray(allowedSSIDs) || allowedSSIDs.length === 0) {
    const single = getConfig('office_wifi_ssid');
    if (single) allowedSSIDs = [single];
  }

  const officeLat = parseFloat(getConfig('office_lat'));
  const officeLng = parseFloat(getConfig('office_lng'));
  const officeRadius = parseInt(getConfig('office_radius_m')) || 200;

  if (enforceLocation) {
    let ssidPassed = false;
    let ssidFailed = false;
    if (ssid && allowedSSIDs.length > 0) {
      ssidPassed = allowedSSIDs.some(s =>
        String(s).toLowerCase().trim() === String(ssid).toLowerCase().trim()
      );
      if (!ssidPassed) ssidFailed = true;
    }

    let geoPassed = false;
    let geoFailed = false;
    let distFromOffice = null;
    if (Number.isFinite(officeLat) && Number.isFinite(officeLng)) {
      if (Number.isFinite(parsedLat) && Number.isFinite(parsedLng)) {
        distFromOffice = haversineMeters(officeLat, officeLng, parsedLat, parsedLng);
        if (distFromOffice <= officeRadius) {
          geoPassed = true;
        } else {
          geoFailed = true;
        }
      } else {
        console.warn(`[login] User ${email} logged in without location coordinates`);
      }
    }

    // Allow login to proceed. Geofence is only for auto-attendance.
    if (!ssidPassed && !geoPassed) {
      if (geoFailed) {
        console.warn(`[login] User ${email} logged in from outside office radius. Geofence is for attendance only, allowing login.`);
      }
    }
  }
  // ── End enforcement ────────────────────────────────────────────────────────

  db.prepare("UPDATE users SET last_login=datetime('now') WHERE id=?").run(user.id);
  // Roles are loaded above
  const token = signToken({ id: user.id, role: user.role, roles: userRoles, email: user.email, name: user.name, consultant_name: user.consultant_name, emp_id: user.emp_id });
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
    id: user.id, email: user.email, name: user.name, role: user.role, roles: userRoles,
    consultant_name: user.consultant_name, emp_id: user.emp_id,
    attendance, // { ok, created/alreadyIn/reason, time, status }
  });
});

app.post('/api/auth/logout', (_req, res) => { clearAuthCookie(res); res.json({ ok: true }); });

app.get('/api/admin/logs', (req, res) => {
  const apiKey = req.headers['x-api-key'] || req.query.key;
  const cookie = getCookie(req, AUTH_COOKIE);
  let payload = null;
  try { payload = verifyToken(cookie); } catch {}
  const isAdmin = payload && payload.role === 'admin';
  if (apiKey !== 'eduexpress-n8n-2024' && !isAdmin) {
    return res.status(401).send('Unauthorized');
  }
  try {
    if (!existsSync(LOG_PATH)) return res.send('Log file is empty.');
    const content = readFileSync(LOG_PATH, 'utf8');
    const lines = content.split('\n').slice(-300).join('\n');
    res.setHeader('Content-Type', 'text/plain');
    res.send(lines);
  } catch (err) {
    res.status(500).send('Error reading log file: ' + err.message);
  }
});

app.get('/api/auth/me', (req, res) => {
  console.log('[api/auth/me] Starting...');
  const cookie = getCookie(req, AUTH_COOKIE);
  console.log('[api/auth/me] Cookie retrieved:', cookie ? 'exists' : 'null');
  let payload;
  try {
    payload = verifyToken(cookie);
  } catch (err) {
    console.error('[api/auth/me] Token verification crashed:', err.message);
    return res.status(401).json({ error: 'Unauthorized' });
  }
  console.log('[api/auth/me] Token verified. Payload:', payload);
  if (!payload) {
    console.log('[api/auth/me] Unauthorized (no payload)');
    return res.status(401).json({ error: 'Unauthorized' });
  }
  console.log('[api/auth/me] Querying users for id:', payload.id);
  let user;
  try {
    user = db.prepare("SELECT id,email,name,role,consultant_name,emp_id,active FROM users WHERE id=? AND active=1").get(payload.id);
  } catch (err) {
    console.error('[api/auth/me] User query crashed:', err.message);
    return res.status(500).json({ error: err.message });
  }
  console.log('[api/auth/me] User query result:', user ? user.email : 'null');
  if (!user) {
    console.log('[api/auth/me] Unauthorized (user not found)');
    return res.status(401).json({ error: 'Unauthorized' });
  }
  console.log('[api/auth/me] Querying roles for id:', user.id);
  let roles;
  try {
    roles = db.prepare("SELECT role FROM user_roles WHERE user_id=?").all(user.id).map(r => r.role);
  } catch (err) {
    console.error('[api/auth/me] Roles query crashed:', err.message);
    return res.status(500).json({ error: err.message });
  }
  console.log('[api/auth/me] Roles query result:', roles);
  if (roles.length === 0) {
    const roleMap = { admin: 'founder_ceo', manager: 'application_manager', consultant: 'consultant' };
    roles.push(roleMap[user.role] || user.role || 'consultant');
  }
  user.roles = roles;
  console.log('[api/auth/me] Sending user response...');
  res.json(user);
  console.log('[api/auth/me] Done!');
});

// ─── REQUIRE AUTH on every /api/* below (except whitelisted paths) ──────────
const AUTH_FREE = ['/api/auth/login', '/api/auth/logout', '/api/auth/me', '/api/events', '/api/webhook/website-lead', '/api/auth/emergency-reset'];
const AUTH_FREE_PREFIX = ['/api/public/']; // student portal endpoints
// Internal API key for trusted services (n8n, automation scripts)
const INTERNAL_API_KEY = 'eduexpress-n8n-2024';

app.use(async (req, res, next) => {
  if (!req.path.startsWith('/api/')) return next();
  
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');

  if (AUTH_FREE.includes(req.path)) return next();
  if (AUTH_FREE_PREFIX.some(p => req.path.startsWith(p))) return next();
  // Service-account bypass: trusted internal key (no location restriction)
  if (req.headers['x-api-key'] === INTERNAL_API_KEY) {
    req.user = { id: 0, role: 'super_admin', roles: ['founder_ceo'], name: 'n8n Bot', email: 'bot@eduexpress.internal' };
    return next();
  }
  const payload = verifyToken(getCookie(req, AUTH_COOKIE));
  if (!payload) return res.status(401).json({ error: 'Unauthorized' });
  // Ensure roles array is present (fallback for legacy tokens)
  if (!payload.roles || !Array.isArray(payload.roles)) {
    const roleMap = { admin: 'founder_ceo', manager: 'application_manager', consultant: 'consultant' };
    payload.roles = [roleMap[payload.role] || payload.role || 'consultant'];
  }
  req.user = payload;
  next();
});

// ─── RBAC Helpers ──────────────────────────────────────────────────────────
function userHasRole(user, role) {
  if (!user?.roles || !Array.isArray(user.roles)) return false;
  return user.roles.includes(role);
}
function userHasAnyRole(user, ...roles) {
  if (!user?.roles || !Array.isArray(user.roles)) return false;
  return roles.some(r => user.roles.includes(r));
}
function isFullAdmin(user) {
  if (!user) return false;
  if (user.role === 'admin') return true; // Legacy
  return userHasAnyRole(user, 'founder_ceo', 'managing_director');
}
function isInvestor(user) {
  return userHasRole(user, 'investor');
}
function canManageApplications(user) {
  return isFullAdmin(user) || userHasAnyRole(user, 'application_manager');
}
function canManageMarketing(user) {
  return isFullAdmin(user) || userHasAnyRole(user, 'marketing_manager');
}
function canViewReports(user) {
  return isFullAdmin(user) || isInvestor(user) || userHasAnyRole(user, 'application_manager', 'marketing_manager');
}
function canViewFinance(user) {
  return isFullAdmin(user) || isInvestor(user);
}
function canViewHR(user) {
  return isFullAdmin(user);
}
function canViewSettings(user) {
  return isFullAdmin(user);
}
function canViewAutomation(user) {
  return isFullAdmin(user) || userHasRole(user, 'marketing_manager');
}
function canViewAllLeads(user) {
  if (isAgent(user)) return false;
  return isFullAdmin(user) || isInvestor(user) || userHasAnyRole(user, 'application_manager', 'marketing_manager');
}
function canViewOwnLeadsOnly(user) {
  return userHasRole(user, 'consultant') && !canViewAllLeads(user) && !isAgent(user);
}
function isAgent(user) {
  return userHasRole(user, 'agent');
}
function canViewAllConversations(user) {
  // Full admins (Founder & CEO, Managing Director, legacy Admin) + any role with explicit all-conversations permission
  if (isFullAdmin(user)) return true;
  if (userHasAnyRole(user, 'application_manager', 'marketing_manager')) return true;
  // Future-proof: any role granted VIEW_ALL_CONVERSATIONS permission will have full inbox access
  return false;
}
function canViewOwnConversations(user) {
  return userHasRole(user, 'consultant');
}

function canViewChinaData(user) {
  return userHasAnyRole(user, 'founder_ceo', 'application_manager');
}

// Admin-only guard helper
function requireAdmin(req, res, next) {
  if (!isFullAdmin(req.user)) return res.status(403).json({ error: 'Admin only' });
  next();
}

// Finance access guard helper (Founder & CEO, Managing Director, and Investors)
function requireFinance(req, res, next) {
  if (!isFullAdmin(req.user) && !isInvestor(req.user)) {
    return res.status(403).json({ error: 'Finance access only' });
  }
  next();
}

// Manager-or-admin guard — Application Managers, Marketing Managers, and full admins
function requireManagerOrAdmin(req, res, next) {
  if (!isFullAdmin(req.user) && !userHasAnyRole(req.user, 'application_manager', 'marketing_manager')) {
    return res.status(403).json({ error: 'Manager or admin only' });
  }
  next();
}

// Application-manager guard
function requireApplicationManager(req, res, next) {
  if (!isFullAdmin(req.user) && !userHasRole(req.user, 'application_manager')) {
    return res.status(403).json({ error: 'Application manager only' });
  }
  next();
}

// Marketing-manager guard
function requireMarketingManager(req, res, next) {
  if (!isFullAdmin(req.user) && !userHasRole(req.user, 'marketing_manager')) {
    return res.status(403).json({ error: 'Marketing manager only' });
  }
  next();
}

// Check if a user has access to a specific conversation
function userHasAccessToConversation(user, conversationId) {
  if (!user) return false;
  if (isFullAdmin(user)) return true;
  if (canViewAllConversations(user)) return true; // App Manager, Marketing Manager
  // Consultant: own channels only for WhatsApp, all other channels
  if (canViewOwnConversations(user)) {
    let c;
    if (conversationId && typeof conversationId === 'object' && conversationId.channel_id !== undefined) {
      c = db.prepare(`
        SELECT channels.type AS channel_type, channels.name, channels.phone_number_id, channels.consultant, NULL AS assigned_to, channel_access.access_type
        FROM channels
        LEFT JOIN channel_access ON channel_access.channel_id = channels.id AND channel_access.user_id = @userId
        WHERE channels.id = @channelId
      `).get({ userId: user.id, channelId: conversationId.channel_id });
    } else {
      c = db.prepare(`
        SELECT channels.type AS channel_type, channels.name, channels.phone_number_id, channels.consultant, conversations.assigned_to, channel_access.access_type
        FROM conversations
        LEFT JOIN channels ON channels.id = conversations.channel_id
        LEFT JOIN channel_access ON channel_access.channel_id = conversations.channel_id AND channel_access.user_id = @userId
        WHERE conversations.id = @convId
      `).get({ userId: user.id, convId: conversationId });
    }
    if (!c) return false;
    // For WhatsApp: own account only (via channel consultant or assigned_to)
    if (c.channel_type === 'whatsapp') {
      const meUser = db.prepare("SELECT consultant_name, emp_id FROM users WHERE id=?").get(user.id);
      const matchConsultant = c.consultant && meUser?.consultant_name &&
        c.consultant.trim().toLowerCase() === meUser.consultant_name.trim().toLowerCase();
      
      let matchPhone = false;
      if (meUser && meUser.emp_id) {
        const employee = db.prepare("SELECT phone FROM employees WHERE emp_id=?").get(meUser.emp_id);
        if (employee && employee.phone) {
          const cleanEmp = String(employee.phone).replace(/\D/g, '');
          if (cleanEmp.length >= 6) {
            const cleanName = String(c.name || '').replace(/\D/g, '');
            const cleanPhoneId = String(c.phone_number_id || '').replace(/\D/g, '');
            matchPhone = (cleanName && (cleanName.endsWith(cleanEmp) || cleanEmp.endsWith(cleanName))) ||
                         (cleanPhoneId && (cleanPhoneId.endsWith(cleanEmp) || cleanEmp.endsWith(cleanPhoneId)));
          }
        }
      }

      return matchConsultant || c.assigned_to === user.id || c.access_type || matchPhone;
    }
    // All other channels: full access
    return true;
  }
  return false;
}

// Random URL-safe token for the student portal share link.
function generatePublicToken() {
  return crypto.randomBytes(9).toString('base64url'); // 12 char URL-safe
}

app.post('/api/admin/fix-page-names', (req, res) => requireAdmin(req, res, () => {
  try {
    const result = db.prepare(`
      UPDATE leads 
      SET page_name = (
        SELECT c.name 
        FROM channels c 
        JOIN conversations conv ON conv.channel_id = c.id 
        WHERE conv.lead_id = leads.id 
        LIMIT 1
      ) 
      WHERE page_name IS NULL
    `).run();
    res.json({ ok: true, changes: result.changes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}));

// ─── USER MANAGEMENT (admin only) ───────────────────────────────────────────
app.get('/api/users', (req, res) => requireAdmin(req, res, () => {
  const users = db.prepare("SELECT id,email,name,role,consultant_name,emp_id,active,created_at,last_login,agency_id FROM users ORDER BY id").all();
  // Attach roles array to each user
  for (const u of users) {
    const roles = db.prepare("SELECT role FROM user_roles WHERE user_id=?").all(u.id).map(r => r.role);
    u.roles = roles.length ? roles : [u.role === 'admin' ? 'founder_ceo' : u.role === 'manager' ? 'application_manager' : 'consultant'];
  }
  res.json(users);
}));
app.post('/api/users', (req, res) => requireAdmin(req, res, () => {
  const { email, name, password, role = 'consultant', roles = [], consultant_name = null, emp_id = null, agency_id = null } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  try {
    const safeRole = ['admin', 'manager', 'consultant', 'agent'].includes(role) ? role : 'consultant';
    const info = db.prepare(`INSERT INTO users (email,name,password_hash,role,consultant_name,emp_id,agency_id) VALUES (?,?,?,?,?,?,?)`)
      .run(String(email).toLowerCase().trim(), name || null, hashPassword(password), safeRole, consultant_name, emp_id, agency_id);
    const newUserId = info.lastInsertRowid;
    // Insert into user_roles if roles provided
    const newRoles = Array.isArray(roles) && roles.length ? roles : [safeRole === 'admin' ? 'founder_ceo' : safeRole === 'manager' ? 'application_manager' : 'consultant'];
    const insertRole = db.prepare(`INSERT OR IGNORE INTO user_roles (user_id, role) VALUES (?, ?)`);
    for (const r of newRoles) insertRole.run(newUserId, r);
    const u = db.prepare("SELECT id,email,name,role,consultant_name,emp_id,active FROM users WHERE id=?").get(newUserId);
    u.roles = newRoles;
    logActivity({ type: 'user_created', actor: req.user, to: u.email, details: { role: u.role, roles: newRoles, consultant_name: u.consultant_name } });
    res.json(u);
  } catch (e) {
    res.status(400).json({ error: e.message.includes('UNIQUE') ? 'That email is already in use' : e.message });
  }
}));
app.put('/api/users/:id', (req, res) => requireAdmin(req, res, () => {
  const { name, role, roles, consultant_name, emp_id, active, password, agency_id } = req.body || {};
  const cur = db.prepare("SELECT * FROM users WHERE id=?").get(req.params.id);
  if (!cur) return res.status(404).json({ error: 'Not found' });
  const newHash = password ? hashPassword(password) : cur.password_hash;
  db.prepare(`UPDATE users SET name=COALESCE(?,name), role=COALESCE(?,role), consultant_name=COALESCE(?,consultant_name), emp_id=COALESCE(?,emp_id), active=COALESCE(?,active), password_hash=?, agency_id=COALESCE(?,agency_id) WHERE id=?`)
    .run(name ?? null, role ?? null, consultant_name ?? null, emp_id ?? null, active ?? null, newHash, agency_id ?? null, req.params.id);
  // Update user_roles if roles array provided
  if (Array.isArray(roles)) {
    db.prepare("DELETE FROM user_roles WHERE user_id=?").run(req.params.id);
    const insertRole = db.prepare("INSERT OR IGNORE INTO user_roles (user_id, role) VALUES (?, ?)");
    for (const r of roles) insertRole.run(req.params.id, r);
  }
  const u = db.prepare("SELECT id,email,name,role,consultant_name,emp_id,active FROM users WHERE id=?").get(req.params.id);
  const updatedRoles = db.prepare("SELECT role FROM user_roles WHERE user_id=?").all(req.params.id).map(r => r.role);
  u.roles = updatedRoles.length ? updatedRoles : [role === 'admin' ? 'founder_ceo' : role === 'manager' ? 'application_manager' : 'consultant'];
  res.json(u);
}));
app.delete('/api/users/:id', (req, res) => requireAdmin(req, res, () => {
  if (parseInt(req.params.id) === req.user.id) return res.status(400).json({ error: "You can't delete your own account" });
  db.prepare("DELETE FROM user_roles WHERE user_id=?").run(req.params.id);
  db.prepare("DELETE FROM users WHERE id=?").run(req.params.id);
  res.json({ ok: true });
}));

// ─── OFFICE CONFIG (open/close hours + geofence) ────────────────────────────
const OFFICE_KEYS = ['office_open_time', 'office_close_time', 'office_lat', 'office_lng', 'office_radius_m', 'office_wifi_ssid', 'office_allowed_ssids'];
app.get('/api/office-config', (req, res) => {
  const cfg = Object.fromEntries(OFFICE_KEYS.map(k => [k, getConfig(k)]));
  res.json(cfg);
});
app.post('/api/office-config', (req, res) => requireAdmin(req, res, () => {
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
    'Document Collection',
    'Document Verification',
    'Application Submitted',
    'University Interview',
    'Conditional Offer',
    'Tuition Deposit',
    'Unconditional Offer & JW202',
    'Visa Application',
    'Visa Approval',
    'Final Settlement',
    'Pre-Departure & Flight',
    'Arrival & Enrollment'
  ]);
  return list.map((label, order) => {
    let key = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    if (key === 'documents_collecting' || key === 'document_collection') key = 'documents';
    if (key === 'documents_ready' || key === 'document_verification') key = 'ready';
    if (key === 'applied_to_university' || key === 'application_submitted') key = 'submitted';
    if (key === 'university_interview' || key === 'interview') key = 'interview';
    if (key === 'conditional_offer' || key === 'pre_admission') key = 'pre_admission';
    if (key === 'tuition_deposit' || key === 'university_initial_deposit') key = 'university_initial_deposit';
    if (key === 'unconditional_offer_jw202' || key === 'admission_jw_received' || key === 'admission_notice_received') key = 'admitted';
    if (key === 'visa_application' || key === 'visa_applied') key = 'visa_applied';
    if (key === 'visa_approval' || key === 'passport_collection') key = 'passport_collection';
    if (key === 'final_settlement' || key === 'payment') key = 'payment';
    if (key === 'pre_departure_flight' || key === 'air_ticket') key = 'air_ticket';
    if (key === 'arrival_enrollment' || key === 'fly') key = 'fly';
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
  // Read from settings first, fall back to hardcoded defaults
  const fromSettings = getConfig('settings_docTemplates');
  if (fromSettings) {
    try {
      const parsed = JSON.parse(fromSettings);
      if (parsed[destination]) return parsed[destination];
    } catch {}
  }
  return DOC_TEMPLATES[destination] || DEFAULT_DOCS;
}

function leadIsVisibleTo(lead, user) {
  if (canViewAllLeads(user)) return true;
  const me = user?.consultant_name || user?.name || '';
  if (!me) return false;

  const meC = me.toLowerCase().trim();
  const meClean = meC.split(' ')[0];

  // 1. Check if user is the assigned consultant
  if (lead.assigned_consultant) {
    const leadC = lead.assigned_consultant.toLowerCase().trim();
    const nameMatch = leadC === meC || meClean === leadC || meC.includes(leadC) || leadC.includes(meClean);
    if (nameMatch) return true;
  }

  // 2. Check if user is the client/student themselves (by name)
  if (lead.client_name) {
    const clientC = lead.client_name.toLowerCase().trim();
    if (clientC === meC || meC.includes(clientC) || clientC.includes(meC)) return true;
  }

  // 3. Check if user is the client/student themselves (by email match)
  if (lead.email && user.email) {
    if (lead.email.toLowerCase().trim() === user.email.toLowerCase().trim()) return true;
  }

  // 4. Check employee_id match if both are linked
  if (lead.assigned_employee_id && user.emp_id) {
    const emp = db.prepare("SELECT emp_id FROM employees WHERE id=?").get(lead.assigned_employee_id);
    if (emp && emp.emp_id === user.emp_id) return true;
  }

  return false;
}
function leadIsChina(lead) {
  return lead?.destination === 'China' || lead?.lead_market === 'China';
}
function isChinaBlockedForUser(lead, user) {
  if (!leadIsChina(lead)) return false;
  if (canViewChinaData(user)) return false;
  return !leadIsVisibleTo(lead, user);
}

// Reference: list of stages + doc templates (for the UI).
app.get('/api/application/meta', (req, res) => {
  const getList = (key, defaults) => {
    const val = getConfig(key);
    try { if (val) return JSON.parse(val); } catch {}
    return defaults;
  };
  const destinations = (function(){
    try {
      const rows = db.prepare("SELECT name FROM destinations").all();
      if(rows.length > 0) return rows.map(r => r.name);
    } catch(e){}
    return ['China', 'Malta', 'Hungary', 'Greece', 'Estonia', 'Georgia', 'Malaysia', 'Thailand'];
  })();
  const allSources = getList('settings_leadSources', ['In-House', 'B2B', 'China', 'Agent', 'Meta Lead Ad', 'WhatsApp', 'Messenger', 'Referral']);
  // Source markets align with business model (China = collect FROM China; Bangladesh = collect FROM Bangladesh)
  const sourceMarkets = [
    { key: 'all', label: 'All Markets' },
    { key: 'china', label: 'China', restricted: true },
    { key: 'bangladesh', label: 'Bangladesh' }
  ];
  // Bangladesh channels
  const bdChannels = [
    { key: 'office', label: 'Office (In-House)', sourceMatch: ['In-House'] },
    { key: 'b2b', label: 'B2B / Agent', sourceMatch: ['B2B', 'Agent'] }
  ];
  res.json({ 
    stages: getApplicationStages(), 
    docTemplates: DOC_TEMPLATES, 
    defaultDocs: DEFAULT_DOCS,
    destinations,
    sourceMarkets,
    bdChannels,
    sources: allSources.map(s => ({ key: s, label: s }))
  });
});

// All leads currently in the application pipeline (i.e. that have a stage set,
// or are 'Enrolled'/'File Opened'). Returns one card-friendly row each.
// NEW: supports source_market (china|bangladesh|all), bd_channel (office|b2b|all),
// and destination (any configured destination). China data is isolated.
app.get('/api/applications', (req, res) => {
  const where = [
    "(l.application_stage IS NOT NULL OR l.lead_status IN ('Enrolled','File Opened'))",
  ];
  const params = {};
  if (canViewOwnLeadsOnly(req.user)) { // full admins + managers see all
    const meName = req.user.consultant_name || req.user.name || '';
    const meClean = meName.split(' ')[0];
    where.push("(TRIM(LOWER(l.assigned_consultant)) = TRIM(LOWER(@me)) OR TRIM(LOWER(l.assigned_consultant)) = TRIM(LOWER(@meClean)) OR TRIM(LOWER(@me)) LIKE '%' || TRIM(LOWER(l.assigned_consultant)) || '%' OR TRIM(LOWER(l.assigned_consultant)) LIKE '%' || TRIM(LOWER(@meClean)) || '%')");
    params.me = meName;
    params.meClean = meClean;
  }

  // ── Source Market filter (business model: China vs Bangladesh) ──
  const sourceMarket = req.query.source_market || 'all';
  
  // China data isolation: block unauthorized users from explicitly requesting China market
  if (sourceMarket === 'china' && !canViewChinaData(req.user)) {
    return res.status(403).json({ error: 'Access denied to China applications' });
  }
  
  if (sourceMarket === 'china') {
    // China market = leads whose source is 'China' (students collected FROM China)
    where.push("l.lead_market = 'China'");
  } else if (sourceMarket === 'bangladesh') {
    // Bangladesh market = all leads whose source is NOT 'China'
    where.push("(l.lead_market = 'Bangladesh' OR l.lead_market IS NULL OR l.lead_market = '')");
  }
  
  // Bangladesh channel filter (only meaningful when source_market is bangladesh or all)
  const bdChannel = req.query.bd_channel || 'all';
  if (bdChannel === 'office') {
    where.push("(l.lead_type = 'B2C' OR l.lead_type IS NULL OR l.lead_type = '')");
  } else if (bdChannel === 'b2b') {
    where.push("(l.lead_type = 'B2B')");
  }
  
  // ── Destination filter (where the student GOES TO: Malaysia, Thailand, China, etc.) ──
  const destination = req.query.destination || 'all';
  if (destination !== 'all') {
    where.push("l.destination = @destination");
    params.destination = destination;
  }
  
  // Legacy: support old 'region' param for backward compatibility (maps to source_market)
  const region = req.query.region || 'all';
  if (region !== 'all' && sourceMarket === 'all') {
    // Old behavior: region matched either destination or source
    where.push("(LOWER(l.destination) = LOWER(@region) OR LOWER(l.source) = LOWER(@region))");
    params.region = region;
  }
  // Legacy: old 'destination' param (singular) also accepted
  const destinationParam = req.query.destination;
  if (destinationParam && destination === 'all') { 
    where.push("l.destination = @destination"); 
    params.destination = destinationParam; 
  }
  
  // China data isolation: exclude China leads for unauthorized users when viewing all or other markets
  if (!canViewChinaData(req.user) && sourceMarket !== 'china') {
    where.push("(l.lead_market != 'China')");
  }
  
  // Source filtering (explicit source value)
  const source = req.query.source || 'all';
  if (source !== 'all') {
    where.push("l.source = @source");
    params.source = source;
  }
  
  if (req.query.consultant)  { where.push("l.assigned_consultant = @consultant"); params.consultant = req.query.consultant; }
  if (req.query.referrer)    { where.push("l.referrer = @referrer"); params.referrer = req.query.referrer; }
  const ws2 = 'WHERE ' + where.join(' AND ');

  const rows = db.prepare(`
    SELECT l.id, l.lead_id, l.client_name, l.phone, l.email, l.destination, l.university,
           l.lead_status, l.application_stage, l.visa_deadline, l.departure_date,
           l.intake_term, l.assigned_consultant, l.assigned_employee_id, l.service_fee, l.paid, l.balance,
           l.source, l.lead_market, l.lead_type, l.lead_source, l.referrer, l.nationality, l.passport, l.degree, l.major,
           l.drive_link, l.deposit, l.page_name, l.ad_name, l.channel_id, l.meta_campaign,
           e.name as employee_name, e.emp_id as employee_emp_id, e.role as employee_role,
           (SELECT COUNT(*) FROM lead_documents d WHERE d.lead_id=l.id) AS docs_total,
           (SELECT COUNT(*) FROM lead_documents d WHERE d.lead_id=l.id AND d.status IN ('received','verified')) AS docs_received,
           (SELECT COUNT(*) FROM lead_university_applications u WHERE u.lead_id=l.id) AS uni_total,
           (SELECT COUNT(*) FROM lead_university_applications u WHERE u.lead_id=l.id AND u.status='admitted') AS uni_admitted,
           (SELECT GROUP_CONCAT(university, ', ') FROM lead_university_applications u WHERE u.lead_id=l.id) AS uni_list
    FROM leads l
    LEFT JOIN employees e ON l.assigned_employee_id = e.id
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
  // China data isolation: block unauthorized access to China leads
  if (isChinaBlockedForUser(lead, req.user)) {
    return res.status(403).json({ error: 'Access denied to China lead records' });
  }
  if (!leadIsVisibleTo(lead, req.user)) return res.status(403).json({ error: 'Not your lead' });

  const {
    stage, visa_deadline, departure_date, university, intake_term, application_notes,
    source, referrer, nationality, passport, degree, major, drive_link, deposit,
    blood_group, date_of_birth, medical_notes, emergency_contact,
    destination, assigned_consultant, assigned_employee_id, lead_source, english_score,
    next_followup, client_name, phone, email, program, notes, lead_status,
    service_fee, paid, last_education,
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
    lead_market       = COALESCE(?, lead_market),
    lead_type         = COALESCE(?, lead_type),
    lead_source       = COALESCE(?, lead_source),
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
    emergency_contact = COALESCE(?, emergency_contact),
    destination       = COALESCE(?, destination),
    assigned_consultant = COALESCE(?, assigned_consultant),
    assigned_employee_id = COALESCE(?, assigned_employee_id),
    lead_source       = COALESCE(?, lead_source),
    english_score     = COALESCE(?, english_score),
    next_followup     = COALESCE(?, next_followup),
    client_name       = COALESCE(?, client_name),
    phone             = COALESCE(?, phone),
    email             = COALESCE(?, email),
    program           = COALESCE(?, program),
    notes             = COALESCE(?, notes),
    lead_status       = COALESCE(?, lead_status),
    service_fee       = COALESCE(?, service_fee),
    paid              = COALESCE(?, paid),
    last_education    = COALESCE(?, last_education)
    WHERE id=?`).run(
      stage ?? null, visa_deadline ?? null, departure_date ?? null,
      university ?? null, intake_term ?? null, application_notes ?? null,
      source ?? null, req.body.lead_market ?? null, req.body.lead_type ?? null, req.body.lead_source ?? null, referrer ?? null, nationality ?? null, passport ?? null,
      degree ?? null, major ?? null, drive_link ?? null,
      (deposit === '' || deposit == null) ? null : Number(deposit),
      blood_group ?? null, date_of_birth ?? null, medical_notes ?? null, emergency_contact ?? null,
      destination ?? null, assigned_consultant ?? null,
      (assigned_employee_id === '' || assigned_employee_id == null) ? null : Number(assigned_employee_id),
      lead_source ?? null, english_score ?? null, next_followup ?? null,
      client_name ?? null, phone ?? null, email ?? null, program ?? null, notes ?? null,
      lead_status ?? null,
      (service_fee === '' || service_fee == null) ? null : Number(service_fee),
      (paid === '' || paid == null) ? null : Number(paid),
      last_education ?? null,
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
  // China data isolation: block unauthorized access to China leads
  if (isChinaBlockedForUser(lead, req.user)) {
    return res.status(403).json({ error: 'Access denied to China lead records' });
  }
  if (!leadIsVisibleTo(lead, req.user)) return res.status(403).json({ error: 'Not your lead' });
  const rows = db.prepare("SELECT * FROM lead_university_applications WHERE lead_id=? ORDER BY id").all(lead.id);
  res.json(rows);
});

app.post('/api/leads/:id/university-applications', (req, res) => {
  const lead = db.prepare("SELECT * FROM leads WHERE id=?").get(req.params.id);
  if (!lead) return res.status(404).json({ error: 'Not found' });
  // China data isolation: block unauthorized access to China leads
  if (isChinaBlockedForUser(lead, req.user)) {
    return res.status(403).json({ error: 'Access denied to China lead records' });
  }
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
  // China data isolation: block unauthorized access to China leads
  if (isChinaBlockedForUser(lead, req.user)) {
    return res.status(403).json({ error: 'Access denied to China lead records' });
  }
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
  // China data isolation: block unauthorized access to China leads
  if (isChinaBlockedForUser(lead, req.user)) {
    return res.status(403).json({ error: 'Access denied to China lead records' });
  }
  if (!leadIsVisibleTo(lead, req.user)) return res.status(403).json({ error: 'Not your lead' });
  db.prepare("DELETE FROM lead_university_applications WHERE id=?").run(req.params.id);
  res.json({ ok: true });
});

// Documents for one lead — list + ensure-template helpers.
app.get('/api/leads/:id/documents', (req, res) => {
  const lead = db.prepare("SELECT * FROM leads WHERE id=?").get(req.params.id);
  if (!lead) return res.status(404).json({ error: 'Not found' });
  // China data isolation: block unauthorized access to China leads
  if (isChinaBlockedForUser(lead, req.user)) {
    return res.status(403).json({ error: 'Access denied to China lead records' });
  }
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
  // China data isolation: block unauthorized access to China leads
  if (isChinaBlockedForUser(lead, req.user)) {
    return res.status(403).json({ error: 'Access denied to China lead records' });
  }
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
  // China data isolation: block unauthorized access to China leads
  if (isChinaBlockedForUser(lead, req.user)) {
    return res.status(403).json({ error: 'Access denied to China lead records' });
  }
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
  // China data isolation: block unauthorized access to China leads
  if (isChinaBlockedForUser(lead, req.user)) {
    return res.status(403).json({ error: 'Access denied to China lead records' });
  }
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

app.get('/api/cockpit', (req, res) => requireManagerOrAdmin(req, res, () => {
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
  if (canViewOwnLeadsOnly(req.user)) {
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

app.get('/api/debug/webhooks', (req, res) => {
  try {
    const logs = db.prepare("SELECT * FROM webhook_logs ORDER BY id DESC LIMIT 50").all();
    res.json(logs.map(l => ({ ...l, payload: JSON.parse(l.payload) })));
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});


app.get('/api/admin/backfill-meta', async (req, res) => {
  try {
    const logs = [];
    const missingLeads = db.prepare("SELECT DISTINCT meta_form_id FROM leads WHERE meta_form_id IS NOT NULL AND page_name IS NULL").all();
    logs.push("Found missing leads: " + missingLeads.length);
    if (missingLeads.length === 0) return res.json({ ok: true, logs });
    
    const channels = db.prepare("SELECT * FROM channels WHERE type IN ('messenger', 'facebook', 'instagram', 'whatsapp') AND access_token IS NOT NULL").all();
    logs.push("Found channels: " + channels.length);
    
    for (const { meta_form_id } of missingLeads) {
      let found = false;
      for (const channel of channels) {
        try {
          const pageToken = await resolvePageAccessToken(channel.page_id, channel.access_token);
          const r = await fetch(`https://graph.facebook.com/v19.0/${meta_form_id}?fields=page&access_token=${pageToken}`);
          const d = await r.json();
          if (d.error) {
            logs.push(`Form ${meta_form_id} on Channel ${channel.name}: API Error - ${d.error.message}`);
          }
          if (d.page && d.page.id) {
            const pageIdStr = String(d.page.id).trim();
            const matchedChannel = db.prepare("SELECT * FROM channels WHERE trim(page_id)=?").get(pageIdStr);
            if (matchedChannel) {
              const fix = db.prepare("UPDATE leads SET page_name=?, channel_id=? WHERE meta_form_id=? AND page_name IS NULL").run(matchedChannel.name, matchedChannel.id, meta_form_id);
              logs.push(`Backfilled ${fix.changes} leads for form ${meta_form_id} -> Page: ${matchedChannel.name}`);
              found = true;
              break;
            } else {
               logs.push(`Found page ID ${pageIdStr} for form ${meta_form_id}, but no matching channel in DB.`);
            }
          }
        } catch(e) {
          logs.push(`Exception for form ${meta_form_id} on channel ${channel.name}: ${e.message}`);
        }
      }
      if (!found) logs.push(`Could not find page for form ${meta_form_id}`);
    }
    res.json({ ok: true, logs });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});







app.get('/api/public/diag', (req, res) => {
  try {
    const nullLeads = db.prepare("SELECT id, lead_id, client_name, page_name, channel_id, meta_form_id FROM leads WHERE page_name IS NULL OR page_name = '' LIMIT 20").all();
    const totalNull = db.prepare("SELECT COUNT(*) as c FROM leads WHERE page_name IS NULL OR page_name = ''").get().c;
    res.json({ totalNull, nullLeads });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/public/fix-leads-manual', (req, res) => {
  try {
    const leadsToFix = db.prepare("SELECT id FROM leads WHERE page_name IS NULL OR page_name = ''").all();
    let fixedCount = 0;
    let logs = [];
    for (const l of leadsToFix) {
       const throughConv = db.prepare(`SELECT c.name, c.id FROM channels c JOIN conversations conv ON conv.channel_id = c.id WHERE conv.lead_id = ? LIMIT 1`).get(l.id);
       const throughContact = db.prepare(`SELECT c.name, c.id FROM channels c JOIN conversations conv ON conv.channel_id = c.id JOIN contacts con ON conv.contact_id = con.id WHERE con.lead_id = ? LIMIT 1`).get(l.id);
       
       if (throughConv && throughConv.name) {
         db.prepare("UPDATE leads SET page_name = ?, channel_id = ? WHERE id = ?").run(throughConv.name, throughConv.id, l.id);
         fixedCount++;
         logs.push(`Fixed lead ${l.id} via throughConv with ${throughConv.name}`);
       } else if (throughContact && throughContact.name) {
         db.prepare("UPDATE leads SET page_name = ?, channel_id = ? WHERE id = ?").run(throughContact.name, throughContact.id, l.id);
         fixedCount++;
         logs.push(`Fixed lead ${l.id} via throughContact with ${throughContact.name}`);
       } else {
         const orphanConv = db.prepare(`SELECT channel_id FROM conversations WHERE lead_id = ? LIMIT 1`).get(l.id);
         if (orphanConv && orphanConv.channel_id) {
           const peerLead = db.prepare(`SELECT l.page_name FROM leads l JOIN conversations c ON l.id = c.lead_id WHERE c.channel_id = ? AND l.page_name IS NOT NULL AND l.page_name != '' LIMIT 1`).get(orphanConv.channel_id);
           if (peerLead && peerLead.page_name) {
             db.prepare("UPDATE leads SET page_name = ?, channel_id = ? WHERE id = ?").run(peerLead.page_name, orphanConv.channel_id, l.id);
             fixedCount++;
             logs.push(`Fixed lead ${l.id} via peerLead with ${peerLead.page_name}`);
           } else {
             db.prepare("UPDATE leads SET page_name = ?, channel_id = ? WHERE id = ?").run("Unknown Page", orphanConv.channel_id, l.id);
             fixedCount++;
             logs.push(`Fixed lead ${l.id} via Unknown Page (channel ${orphanConv.channel_id})`);
           }
         } else {
             db.prepare("UPDATE leads SET page_name = ? WHERE id = ?").run("Unknown Page", l.id);
             fixedCount++;
             logs.push(`Fixed lead ${l.id} via Unknown Page (no conversation)`);
         }
       }
    }
    res.json({ ok: true, fixedCount, logs });
  } catch (e) {
    res.status(500).json({ error: e.message, stack: e.stack });
  }
});

app.get('/api/public/diag2', (req, res) => {
  try {
    const l = db.prepare("SELECT * FROM leads WHERE lead_id = 'L260023'").get();
    const conv = db.prepare("SELECT * FROM conversations WHERE lead_id = ?").all(l.id);
    const cont = db.prepare("SELECT * FROM contacts WHERE lead_id = ?").all(l.id);
    res.json({ lead: l, conv, cont });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});


app.get('/api/public/diag3', (req, res) => {
  try {
    const c = db.prepare("SELECT * FROM channels WHERE id = 9").get();
    res.json(c || { error: 'Channel 9 not found' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});


app.get('/api/public/diag4', (req, res) => {
  try {
    const channels = db.prepare("SELECT * FROM channels").all();
    res.json(channels);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

async function syncMetaAdPerformance() {
  console.log('[cron] Starting Meta Ad Performance Sync...');
  try {
    const accessToken = getConfig('meta_ads_access_token');
    const adAccountId = getConfig('meta_ad_account_id');
    if (!accessToken || !adAccountId) {
      console.log('[cron] Missing meta_ads_access_token or meta_ad_account_id. Skipping sync.');
      return;
    }

    const today = new Date();
    today.setDate(today.getDate() - 1); // Fetch yesterday's data
    const dateStr = today.toISOString().slice(0, 10);

    const url = `https://graph.facebook.com/v19.0/act_${adAccountId}/insights?level=ad&time_range={'since':'${dateStr}','until':'${dateStr}'}&fields=ad_id,ad_name,campaign_name,adset_name,spend,impressions,clicks&access_token=${accessToken}`;
    
    const res = await fetch(url);
    const data = await res.json();

    if (data.error) {
      console.error('[cron] Meta API Error:', data.error.message);
      return;
    }

    const insights = data.data || [];
    let synced = 0;
    
    const insertStmt = db.prepare(`
      INSERT OR REPLACE INTO ad_performance_cache (ad_id, ad_name, campaign_name, adset_name, date, spend, impressions, clicks)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    db.transaction(() => {
      for (const row of insights) {
        insertStmt.run(
          row.ad_id,
          row.ad_name || 'Unknown Ad',
          row.campaign_name || 'Unknown Campaign',
          row.adset_name || 'Unknown Ad Set',
          dateStr,
          parseFloat(row.spend || 0),
          parseInt(row.impressions || 0),
          parseInt(row.clicks || 0)
        );
        synced++;
      }
    })();

    console.log(`[cron] Successfully synced ${synced} ad performance records for ${dateStr}`);
  } catch (err) {
    console.error('[cron] Ad Performance Sync failed:', err.message);
  }
}

// Run daily ad spend sync (check every 6 hours)
setInterval(() => {
  syncMetaAdPerformance();
}, 6 * 60 * 60 * 1000); 

async function backfillMetaAds30Days() {
  console.log('[startup] Backfilling Meta Ad Performance for last 30 days...');
  const accessToken = getConfig('meta_ads_access_token');
  const adAccountId = getConfig('meta_ad_account_id');
  if (!accessToken || !adAccountId) return;
  const url = `https://graph.facebook.com/v19.0/act_${adAccountId}/insights?level=ad&date_preset=last_30d&fields=ad_id,ad_name,campaign_name,adset_name,spend,impressions,clicks&access_token=${accessToken}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.data) {
      const insertStmt = db.prepare(`
        INSERT OR REPLACE INTO ad_performance_cache (ad_id, ad_name, campaign_name, adset_name, date, spend, impressions, clicks)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      db.transaction(() => {
        for (const row of data.data) {
          // date_start is the aggregation period for date_preset=last_30d
          // wait, date_preset=last_30d groups everything into one big chunk if time_increment is not 1!
          // We need time_increment=1 to get daily breakdowns!
        }
      })();
    }
  } catch(e) {}
}

// Run once 10 seconds after startup
setTimeout(async () => {
  if (db) {
    // 30 day backfill to populate ad_name
    console.log('[startup] Backfilling Meta Ad Performance for last 30 days...');
    const accessToken = getConfig('meta_ads_access_token');
    const adAccountId = getConfig('meta_ad_account_id');
    if (accessToken && adAccountId) {
      try {
        const url = `https://graph.facebook.com/v19.0/act_${adAccountId}/insights?level=ad&date_preset=last_30d&time_increment=1&fields=ad_id,ad_name,campaign_name,adset_name,spend,impressions,clicks&access_token=${accessToken}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.data) {
          const insertStmt = db.prepare(`
            INSERT OR REPLACE INTO ad_performance_cache (ad_id, ad_name, campaign_name, adset_name, date, spend, impressions, clicks)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `);
          db.transaction(() => {
            for (const row of data.data) {
              insertStmt.run(row.ad_id, row.ad_name, row.campaign_name, row.adset_name, row.date_start, parseFloat(row.spend||0), parseInt(row.impressions||0), parseInt(row.clicks||0));
            }
          })();
          console.log('[startup] Backfill complete.');
        }
      } catch (e) {
        console.error('Backfill failed:', e);
      }
    }
    syncMetaAdPerformance();
  }
}, 10000);

app.listen(PORT, () => console.log(`🚀 CRM + Messaging API → http://localhost:${PORT}`));

// ── Init DB async in background ────────────────────────────
(async () => {
  try {
    console.log('[startup] Loading database...');
    db = await initDatabase(DB_PATH);
    db.pauseSave(); // Pause disk writes during schema check and migrations to prevent RSS memory spike OOM
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    setupSchema();
    runMigrations();

    // Self-heal: verify every critical table actually exists. If any are missing
    // (e.g. after a crash/corruption), rebuild the schema before serving traffic.
    const REQUIRED = ['leads','channels','contacts','conversations','messages','quick_replies','users','payroll','activity_log','lead_documents','lead_university_applications','broadcasts','broadcast_dismissals','daily_logs','user_roles','channel_access'];
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

    db.resumeSave(); // Resume and perform a single batched save
    // seedData(); // disabled — production environment, no dummy data
    dbReady = true;
    console.log('[startup] Database ready ✅ — tables:', (db.tableNames ? db.tableNames().length : '?'));

    // ── WhatsApp Linked Device (Baileys) — no Meta App needed ──
    try {
      initWaLinked({
        db,
        dataDir: DB_DIR,
        upsertContact,
        upsertConversation,
        createLeadFromContact,
        createLeadFromReferral,
        // Adapter: module expects saveInboundMessage(convId, content, type, waId, mediaUrl, caption);
        // codebase now uses saveMessage(convId, direction, content, ...).
        saveInboundMessage: (convId, content, type, waId, mediaUrl, caption) =>
          saveMessage(convId, 'in', content, type, waId, mediaUrl, caption),
        broadcast,
        getConfig,
      });
      console.log('[startup] WhatsApp linked-device module initialised (auth dir:', join(DB_DIR, 'wa_auth'), ')');
    } catch (e) {
      console.error('[startup] WA linked init failed:', e.message);
    }

    /*
    // Trigger historical sync on startup in background for all active channels sequentially
    setTimeout(async () => {
      try {
        const activeChannels = db.prepare("SELECT id, name, type FROM channels WHERE active = 1").all();
        for (const chan of activeChannels) {
          console.log(`[startup-sync] Syncing metadata for channel: ${chan.name} (ID: ${chan.id})`);
          try {
            await syncChannelMetadata(chan.id);
            if (chan.type === 'messenger' || chan.type === 'instagram') {
              console.log(`[startup-sync] Triggering sequential background sync (1 month) for channel: ${chan.name}`);
              const res = await syncChannelMessages(chan.id, 1);
              console.log(`[startup-sync] Completed background sync for ${chan.name}: Imported ${res.imported} messages.`);
            }
          } catch (e) {
            console.error(`[startup-sync] Background sync failed for ${chan.name}:`, e.message);
          }
          // Sleep 3 seconds between channels to allow the engine/GC to stabilize
          await new Promise(r => setTimeout(r, 3000));
        }
      } catch (err) {
        console.error('[startup-sync] Error checking active channels for startup sync:', err.message);
      }
    }, 10000); // delay 10s to not interfere with main startup requests
    */
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
  CREATE TABLE IF NOT EXISTS ad_performance_cache (
    ad_id TEXT,
    ad_name TEXT,
    campaign_name TEXT,
    adset_name TEXT,
    date TEXT,
    spend REAL DEFAULT 0,
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    PRIMARY KEY (ad_id, date)
  );
`);
  try { db.exec(`ALTER TABLE ad_performance_cache ADD COLUMN ad_name TEXT`); } catch {}
  try { db.exec(`ALTER TABLE ad_performance_cache ADD COLUMN campaign_name TEXT`); } catch {}
  try { db.exec(`ALTER TABLE ad_performance_cache ADD COLUMN adset_name TEXT`); } catch {}
  db.exec(`
  CREATE TABLE IF NOT EXISTS leads (
    lead_market TEXT DEFAULT 'Bangladesh',
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
    assigned_employee_id INTEGER,
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

  CREATE TABLE IF NOT EXISTS partner_agencies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agency_name TEXT NOT NULL,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    commission_rate REAL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS income (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT, month TEXT, category TEXT, lead_id TEXT,
    client_name TEXT, reference TEXT, amount REAL DEFAULT 0, notes TEXT,
    employee_id INTEGER,
    exclude_from_cash INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT, month TEXT, category TEXT, paid_to TEXT,
    reference TEXT, amount REAL DEFAULT 0, notes TEXT,
    employee_id INTEGER
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

  CREATE TABLE IF NOT EXISTS destinations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE,
    name TEXT UNIQUE,
    requirements TEXT,
    programs TEXT,
    fees TEXT,
    embassy_documents TEXT,
    application_processing TEXT,
    other_details TEXT,
    is_public INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
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

  -- RBAC: Multi-role support (one employee can have 2-3 roles)
  CREATE TABLE IF NOT EXISTS user_roles (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    PRIMARY KEY (user_id, role)
  );
  CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);

  -- RBAC: Channel access per user (many-to-many, for consultants)
  CREATE TABLE IF NOT EXISTS channel_access (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    access_type TEXT DEFAULT 'reply', -- reply | view_only | admin
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(channel_id, user_id)
  );
  CREATE INDEX IF NOT EXISTS idx_channel_access_user ON channel_access(user_id);
  CREATE INDEX IF NOT EXISTS idx_channel_access_channel ON channel_access(channel_id);

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
    tiktok_id TEXT,
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

  -- ── MARKETING / SOCIAL AUTOMATION ──────────────────────
  CREATE TABLE IF NOT EXISTS content_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    week TEXT,
    post_date TEXT,
    slot_time TEXT,
    page TEXT,                              -- china | bd | instagram | tiktok
    pillar TEXT,
    format TEXT,
    hook TEXT,
    body TEXT,
    hashtags TEXT,
    brief TEXT,
    asset_url TEXT,
    status TEXT DEFAULT 'drafted',          -- drafted|approved|edit|rejected|asset_ready|scheduled|published
    rejection_reason TEXT,
    published_url TEXT,
    reach INTEGER,
    engagement INTEGER,
    source TEXT DEFAULT 'n8n',              -- n8n | manual | evergreen
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_content_week ON content_posts(week, page);
  CREATE INDEX IF NOT EXISTS idx_content_status ON content_posts(status);

  CREATE TABLE IF NOT EXISTS evergreen_bank (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    page_pool TEXT, pillar TEXT, body TEXT, hashtags TEXT, asset_url TEXT,
    status TEXT DEFAULT 'approved',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS competitor_intel (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    log_date TEXT, competitor TEXT, channel TEXT, observation TEXT,
    link TEXT, our_angle TEXT, added_by TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS kb_universities (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, country TEXT, city TEXT,
    programs TEXT, intakes TEXT, tuition TEXT, lang_req TEXT,
    admission_url TEXT, brochure_url TEXT, partner INTEGER DEFAULT 0,
    notes TEXT, last_verified TEXT
  );

  CREATE TABLE IF NOT EXISTS kb_scholarships (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, country TEXT, type TEXT,
    coverage TEXT, eligibility TEXT, deadline TEXT, source_url TEXT,
    status TEXT DEFAULT 'Open', last_verified TEXT, notes TEXT
  );

  CREATE TABLE IF NOT EXISTS kb_sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT, topic TEXT, url TEXT, source_type TEXT,
    use_for TEXT, date_added TEXT, notes TEXT
  );

  CREATE TABLE IF NOT EXISTS kb_docs (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, type TEXT, destination TEXT,
    drive_url TEXT, version TEXT, owner TEXT, updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS brain_api_pool (
    id INTEGER PRIMARY KEY AUTOINCREMENT, priority INTEGER, provider TEXT, model TEXT,
    cred_label TEXT, req_min INTEGER, req_day INTEGER,
    used_today INTEGER DEFAULT 0, status TEXT DEFAULT 'active',
    cooldown_until TEXT, notes TEXT
  );

  -- ── SOCIAL MEDIA ENGINE v2.0 ────────────────────────────
  CREATE TABLE IF NOT EXISTS research_intelligence (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    topic TEXT NOT NULL,
    category TEXT CHECK(category IN ('competitor_move','market_gap','viral_signal','policy_change','psych_insight','offer_alert','trending_topic')),
    urgency TEXT CHECK(urgency IN ('critical','high','normal','low')),
    competitor TEXT,
    source_url TEXT,
    source_type TEXT CHECK(source_type IN ('meta_ad_library','fb_scrape','competitor_page','news','gov_notice','trend_platform','internal')),
    insight_summary TEXT,
    recommended_angle TEXT,
    evidence TEXT,
    status TEXT CHECK(status IN ('new','reviewed','used','archived')) DEFAULT 'new',
    used_in_post_id INTEGER,
    research_date TEXT DEFAULT (datetime('now')),
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_research_urgency ON research_intelligence(urgency, status);
  CREATE INDEX IF NOT EXISTS idx_research_competitor ON research_intelligence(competitor, research_date);

  CREATE TABLE IF NOT EXISTS viral_topics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    topic TEXT NOT NULL,
    platform TEXT CHECK(platform IN ('facebook','instagram','tiktok','youtube','twitter')),
    hashtag TEXT,
    relevance_score INTEGER CHECK(relevance_score BETWEEN 0 AND 100),
    engagement_velocity REAL,
    reach_estimate INTEGER,
    sentiment TEXT CHECK(sentiment IN ('positive','neutral','negative','mixed')),
    why_viral TEXT,
    recommended_hook TEXT,
    recommended_cta TEXT,
    recommended_pillar TEXT,
    status TEXT CHECK(status IN ('new','approved','used','declined')) DEFAULT 'new',
    used_in_post_id INTEGER,
    discovered_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_viral_relevance ON viral_topics(relevance_score, status);

  CREATE TABLE IF NOT EXISTS psychology_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    segment TEXT NOT NULL,
    pain_points TEXT,
    aspirations TEXT,
    fears TEXT,
    trusted_sources TEXT,
    decision_factors TEXT,
    content_preferences TEXT,
    peak_hours TEXT,
    language_preference TEXT CHECK(language_preference IN ('bangla','english','banglish')),
    voice_tone TEXT CHECK(voice_tone IN ('empathetic_brother','expert_consultant','success_story','peer_friend')),
    primary_platform TEXT,
    secondary_platform TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS content_scripts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    script_name TEXT NOT NULL,
    category TEXT CHECK(category IN ('hook','video_script','carousel_copy','story','ad_copy','dm_script','reel_script','tiktok_script')),
    destination TEXT,
    pillar TEXT,
    format TEXT CHECK(format IN ('Reel','Carousel','Single image','Story','TikTok','Live')),
    hook TEXT,
    body TEXT,
    cta TEXT,
    duration_seconds INTEGER,
    shot_list TEXT,
    on_screen_text TEXT,
    psychology_target TEXT,
    avg_score REAL,
    usage_count INTEGER DEFAULT 0,
    status TEXT CHECK(status IN ('draft','approved','archived','winner')) DEFAULT 'draft',
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_scripts_status ON content_scripts(status, category);

  CREATE TABLE IF NOT EXISTS content_hooks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hook_text TEXT NOT NULL,
    hook_type TEXT CHECK(hook_type IN ('pain_point','curiosity','number','myth_bust','urgency','story','challenge','social_proof','fomo','trust')),
    destination TEXT,
    pillar TEXT,
    format TEXT,
    psychology_target TEXT,
    usage_count INTEGER DEFAULT 0,
    avg_reach INTEGER,
    avg_engagement INTEGER,
    conversion_rate REAL,
    status TEXT CHECK(status IN ('new','winner','tested','declined')) DEFAULT 'new',
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_hooks_status ON content_hooks(status, hook_type);

  CREATE TABLE IF NOT EXISTS ab_tests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    test_name TEXT NOT NULL,
    variable TEXT CHECK(variable IN ('hook','body','cta','image','time_slot','hashtag_set','platform')),
    variant_a TEXT,
    variant_b TEXT,
    variant_c TEXT,
    page TEXT CHECK(page IN ('china','bd','instagram','tiktok')),
    start_date TEXT,
    end_date TEXT,
    status TEXT CHECK(status IN ('planned','running','completed','cancelled')) DEFAULT 'planned',
    a_reach INTEGER, a_engagement INTEGER, a_leads INTEGER,
    b_reach INTEGER, b_engagement INTEGER, b_leads INTEGER,
    c_reach INTEGER, c_engagement INTEGER, c_leads INTEGER,
    winner TEXT CHECK(winner IN ('a','b','c','inconclusive')),
    winner_confidence INTEGER,
    insights TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS scale_up_recommendations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recommendation_type TEXT CHECK(recommendation_type IN ('content_pillar','platform','hook_style','time_slot','campaign','budget','destination','format','audience_segment')),
    title TEXT NOT NULL,
    description TEXT,
    expected_impact TEXT CHECK(expected_impact IN ('high','medium','low')),
    expected_lead_lift REAL,
    confidence_score INTEGER,
    based_on_data TEXT,
    action_items TEXT,
    status TEXT CHECK(status IN ('pending','approved','implemented','rejected','testing')) DEFAULT 'pending',
    approved_by TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS publishing_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER,
    page TEXT,
    platform TEXT,
    scheduled_at TEXT,
    published_at TEXT,
    status TEXT CHECK(status IN ('queued','published','failed','retry')) DEFAULT 'queued',
    error_message TEXT,
    platform_post_id TEXT,
    platform_post_url TEXT,
    reach INTEGER,
    engagement INTEGER,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_publishing_status ON publishing_queue(status, scheduled_at);

  CREATE TABLE IF NOT EXISTS creative_guidelines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guideline_name TEXT NOT NULL,
    category TEXT CHECK(category IN ('color','typography','imagery','tone','format_spec','brand_voice','asset_size','video_spec')),
    platform TEXT CHECK(platform IN ('facebook','instagram','tiktok','all')),
    specification TEXT,
    examples TEXT,
    do_s TEXT,
    dont_s TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- ═══════════════════════════════════════════════════════════
  --  PROFESSIONAL SMM PIPELINE v3.0 — Campaigns, Assets, Comments, Performance
  -- ═══════════════════════════════════════════════════════════
  CREATE TABLE IF NOT EXISTS campaigns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT CHECK(status IN ('draft','active','paused','completed','archived')) DEFAULT 'draft',
    page TEXT CHECK(page IN ('china','bd','instagram','tiktok','all')) DEFAULT 'china',
    pillar TEXT CHECK(pillar IN ('scholarship','trust','career','urgency','university','cost','success_story','trending','brand','festival')),
    start_date TEXT,
    end_date TEXT,
    budget TEXT,
    target_audience TEXT,
    goals TEXT,
    color TEXT DEFAULT '#3B82F6',
    created_by TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status, start_date);

  CREATE TABLE IF NOT EXISTS content_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    pillar TEXT CHECK(pillar IN ('scholarship','trust','career','urgency','university','cost','success_story','trending','brand','festival')),
    page TEXT CHECK(page IN ('china','bd','instagram','tiktok','all')) DEFAULT 'china',
    format TEXT CHECK(format IN ('Carousel','Reel','Single image','Story','Video','Live','Text')) DEFAULT 'Carousel',
    language TEXT CHECK(language IN ('bangla','english','mixed')) DEFAULT 'bangla',
    platform TEXT CHECK(platform IN ('facebook','instagram','tiktok')) DEFAULT 'facebook',
    tone TEXT CHECK(tone IN ('expert_consultant','empathetic_brother','success_story','peer_friend')) DEFAULT 'expert_consultant',
    hook_template TEXT,
    body_template TEXT,
    hashtags_template TEXT,
    cta_template TEXT,
    brief_template TEXT,
    variables TEXT, -- JSON: { "university_name": "string", "stipend_range": "string" }
    is_active INTEGER DEFAULT 1,
    usage_count INTEGER DEFAULT 0,
    created_by TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS content_calendar_slots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slot_date TEXT NOT NULL, -- YYYY-MM-DD
    slot_time TEXT, -- HH:MM
    page TEXT,
    pillar TEXT,
    post_id INTEGER,
    status TEXT CHECK(status IN ('empty','planned','writing','review','approved','scheduled','published','skipped')) DEFAULT 'empty',
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_calendar_slots_date ON content_calendar_slots(slot_date, page, status);
  CREATE INDEX IF NOT EXISTS idx_calendar_slots_post ON content_calendar_slots(post_id);

  CREATE TABLE IF NOT EXISTS publishing_schedule (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    page TEXT,
    platform TEXT,
    scheduled_date TEXT,
    scheduled_time TEXT,
    timezone TEXT DEFAULT 'Asia/Dhaka',
    status TEXT CHECK(status IN ('pending','queued','published','failed','cancelled')) DEFAULT 'pending',
    published_at TEXT,
    platform_post_id TEXT,
    platform_post_url TEXT,
    error_message TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_publish_schedule ON publishing_schedule(status, scheduled_date, scheduled_time);

  CREATE TABLE IF NOT EXISTS best_time_slots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    page TEXT,
    platform TEXT,
    day_of_week INTEGER, -- 0=Sunday, 6=Saturday
    time_slot TEXT, -- HH:MM
    engagement_score REAL DEFAULT 0,
    based_on_posts INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(page, platform, day_of_week, time_slot)
  );

  CREATE TABLE IF NOT EXISTS post_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    user_name TEXT,
    user_role TEXT,
    comment TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_post_comments_post ON post_comments(post_id);

  CREATE TABLE IF NOT EXISTS post_performance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    platform TEXT,
    impressions INTEGER DEFAULT 0,
    reach INTEGER DEFAULT 0,
    engagement INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    shares INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    cta_clicks INTEGER DEFAULT 0,
    video_views INTEGER DEFAULT 0,
    saves INTEGER DEFAULT 0,
    cost_per_result TEXT,
    recorded_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_post_perf_post ON post_performance(post_id);

  CREATE TABLE IF NOT EXISTS content_assets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER,
    campaign_id INTEGER,
    asset_type TEXT CHECK(asset_type IN ('image','video','carousel','reel','story','thumbnail','raw')),
    asset_url TEXT,
    thumbnail_url TEXT,
    file_name TEXT,
    file_size TEXT,
    status TEXT CHECK(status IN ('pending','in_progress','review','approved','rejected','archived')) DEFAULT 'pending',
    uploaded_by TEXT,
    feedback TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_assets_post ON content_assets(post_id);

  CREATE TABLE IF NOT EXISTS content_briefs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER,
    title TEXT NOT NULL,
    description TEXT,
    target_platforms TEXT,
    target_audience TEXT,
    key_messages TEXT,
    tone TEXT,
    reference_links TEXT,
    due_date TEXT,
    status TEXT CHECK(status IN ('pending','approved','in_progress','completed','cancelled')) DEFAULT 'pending',
    assigned_to TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS pipeline_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER,
    from_status TEXT,
    to_status TEXT,
    actor TEXT,
    note TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_pipeline_logs_post ON pipeline_logs(post_id);

  CREATE TABLE IF NOT EXISTS lead_attribution (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id INTEGER,
    first_touch_at TEXT DEFAULT (datetime('now')),
    first_touch_source TEXT,
    first_touch_campaign TEXT,
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    utm_content TEXT,
    utm_term TEXT,
    meta_campaign_id TEXT,
    meta_adset_id TEXT,
    meta_ad_id TEXT,
    meta_form_id TEXT,
    meta_is_organic INTEGER DEFAULT 0,
    content_post_id INTEGER,
    enrollment_value REAL,
    enrolled_at TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_attr_lead ON lead_attribution(lead_id);
  CREATE INDEX IF NOT EXISTS idx_attr_post ON lead_attribution(content_post_id);

  CREATE TABLE IF NOT EXISTS campaign_spend (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id TEXT,
    campaign_name TEXT,
    date TEXT,
    spend REAL,
    channel TEXT,
    platform TEXT,
    destination TEXT,
    impressions INTEGER,
    clicks INTEGER,
    leads INTEGER,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_campaign_spend_date ON campaign_spend(date, campaign_id);

  CREATE TABLE IF NOT EXISTS designer_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER,
    designer_id TEXT,
    brief TEXT,
    priority TEXT CHECK(priority IN ('urgent','normal','low')) DEFAULT 'normal',
    deadline TEXT,
    status TEXT CHECK(status IN ('assigned','in_progress','review','completed','rejected')) DEFAULT 'assigned',
    draft_asset_url TEXT,
    final_asset_url TEXT,
    feedback TEXT,
    assigned_at TEXT DEFAULT (datetime('now')),
    completed_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_designer_status ON designer_queue(status, designer_id);

  CREATE TABLE IF NOT EXISTS offer_sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    url TEXT,
    source_type TEXT CHECK(source_type IN ('government','university','competitor','internal','news','drive')),
    description TEXT,
    drive_folder_url TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );


  -- ── AUTOMATION HUB ──────────────────────────────────────
  CREATE TABLE IF NOT EXISTS automation_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    trigger_type TEXT NOT NULL,
    trigger_config TEXT,
    action_type TEXT NOT NULL,
    action_config TEXT,
    priority INTEGER DEFAULT 0,
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS message_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT DEFAULT 'general',
    language TEXT DEFAULT 'en',
    content TEXT NOT NULL,
    variables TEXT,
    approved INTEGER DEFAULT 0,
    usage_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS contact_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    color TEXT DEFAULT '#3b82f6',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS contact_tag_assignments (
    contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES contact_tags(id) ON DELETE CASCADE,
    assigned_by TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (contact_id, tag_id)
  );

  CREATE TABLE IF NOT EXISTS conversation_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    note TEXT NOT NULL,
    author_id INTEGER,
    author_name TEXT,
    is_internal INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS conversation_tags (
    conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES contact_tags(id) ON DELETE CASCADE,
    PRIMARY KEY (conversation_id, tag_id)
  );

  CREATE TABLE IF NOT EXISTS broadcast_campaigns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    segment_type TEXT,
    segment_config TEXT,
    template_id INTEGER REFERENCES message_templates(id),
    content TEXT,
    status TEXT DEFAULT 'draft',
    scheduled_at TEXT,
    sent_count INTEGER DEFAULT 0,
    delivered_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    created_by TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS broadcast_recipients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER NOT NULL REFERENCES broadcast_campaigns(id) ON DELETE CASCADE,
    contact_id INTEGER NOT NULL REFERENCES contacts(id),
    status TEXT DEFAULT 'pending',
    sent_at TEXT,
    error TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS automation_analytics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rule_id INTEGER REFERENCES automation_rules(id),
    event_type TEXT NOT NULL,
    conversation_id INTEGER,
    details TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_automation_rules_active ON automation_rules(active, trigger_type);
  CREATE INDEX IF NOT EXISTS idx_conversation_notes_conv ON conversation_notes(conversation_id);
  CREATE INDEX IF NOT EXISTS idx_broadcast_recipients_campaign ON broadcast_recipients(campaign_id);
  CREATE INDEX IF NOT EXISTS idx_broadcast_recipients_contact ON broadcast_recipients(contact_id);
  CREATE INDEX IF NOT EXISTS idx_automation_analytics_rule ON automation_analytics(rule_id, created_at);
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
    `ALTER TABLE channels   ADD COLUMN avatar_url TEXT`,
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
    // Partner Agency Portal
    `ALTER TABLE users      ADD COLUMN agency_id INTEGER`,
    `ALTER TABLE leads      ADD COLUMN agency_id INTEGER`,
    `ALTER TABLE leads      ADD COLUMN lead_type TEXT DEFAULT 'B2C'`,

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
    // Academic & Medical fields
    `ALTER TABLE leads      ADD COLUMN passing_year TEXT`,
    `ALTER TABLE leads      ADD COLUMN last_education_major TEXT`,
    `ALTER TABLE leads      ADD COLUMN height TEXT`,
    `ALTER TABLE leads      ADD COLUMN weight TEXT`,
    `ALTER TABLE leads      ADD COLUMN english_test_type TEXT`,
    `ALTER TABLE leads      ADD COLUMN payment_agreement TEXT`,
    `ALTER TABLE leads      ADD COLUMN hardcopy_status TEXT`,
    `ALTER TABLE leads      ADD COLUMN hardcopy_documents TEXT`,
    `ALTER TABLE leads      ADD COLUMN age INTEGER`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_public_token ON leads(public_token)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_wa_id ON messages(wa_message_id)`,
    `ALTER TABLE income ADD COLUMN exclude_from_cash INTEGER DEFAULT 0`,
    `ALTER TABLE contacts ADD COLUMN tiktok_id TEXT`,
    `ALTER TABLE leads ADD COLUMN assigned_employee_id INTEGER`,
    `ALTER TABLE leads ADD COLUMN ctwa_clid TEXT`,
    `ALTER TABLE income ADD COLUMN employee_id INTEGER`,
    `ALTER TABLE expenses ADD COLUMN employee_id INTEGER`,
    // ── Social Media Engine v2.0 migrations ──
    `ALTER TABLE content_posts ADD COLUMN quality_score INTEGER`,
    `ALTER TABLE content_posts ADD COLUMN quality_checks TEXT`,
    `ALTER TABLE content_posts ADD COLUMN asset_type TEXT`,
    `ALTER TABLE content_posts ADD COLUMN asset_uploaded_by TEXT`,
    `ALTER TABLE content_posts ADD COLUMN asset_uploaded_at TEXT`,
    `ALTER TABLE content_posts ADD COLUMN utm_source TEXT`,
    `ALTER TABLE content_posts ADD COLUMN utm_medium TEXT`,
    `ALTER TABLE content_posts ADD COLUMN utm_campaign TEXT`,
    `ALTER TABLE content_posts ADD COLUMN utm_content TEXT`,
    `ALTER TABLE content_posts ADD COLUMN short_link TEXT`,
    `ALTER TABLE content_posts ADD COLUMN redraft_count INTEGER DEFAULT 0`,
    `ALTER TABLE content_posts ADD COLUMN research_intel_id INTEGER`,
    `ALTER TABLE content_posts ADD COLUMN shares INTEGER`,
    `ALTER TABLE content_posts ADD COLUMN comments INTEGER`,
    `ALTER TABLE content_posts ADD COLUMN saves INTEGER`,
    `ALTER TABLE content_posts ADD COLUMN video_views INTEGER`,
    `ALTER TABLE content_posts ADD COLUMN leads INTEGER`,
    `ALTER TABLE content_posts ADD COLUMN published_at TEXT`,
    `ALTER TABLE content_posts ADD COLUMN published_by TEXT`,
    `ALTER TABLE content_posts ADD COLUMN language TEXT DEFAULT 'bangla'`,
    // ── Publishing Queue migrations ──
    `ALTER TABLE publishing_queue ADD COLUMN page TEXT`,
    `ALTER TABLE publishing_queue ADD COLUMN platform_post_id TEXT`,
    `ALTER TABLE publishing_queue ADD COLUMN platform_post_url TEXT`,
    `ALTER TABLE publishing_queue ADD COLUMN error_message TEXT`,
    `ALTER TABLE publishing_queue ADD COLUMN reach INTEGER`,
    `ALTER TABLE publishing_queue ADD COLUMN engagement INTEGER`,
    `ALTER TABLE publishing_queue ADD COLUMN created_at TEXT`,
    `UPDATE publishing_queue SET created_at = datetime('now') WHERE created_at IS NULL`,
    // ── Professional SMM Pipeline v3.0 migrations ──
    `ALTER TABLE content_posts ADD COLUMN campaign_id INTEGER`,
    `ALTER TABLE content_posts ADD COLUMN assigned_to TEXT`,
    `ALTER TABLE content_posts ADD COLUMN reviewed_by TEXT`,
    `ALTER TABLE content_posts ADD COLUMN reviewed_at TEXT`,
    `ALTER TABLE content_posts ADD COLUMN rejection_reason TEXT`,
    `ALTER TABLE content_posts ADD COLUMN due_date TEXT`,
    `ALTER TABLE content_posts ADD COLUMN priority TEXT CHECK(priority IN ('low','normal','high','urgent')) DEFAULT 'normal'`,
    `ALTER TABLE content_posts ADD COLUMN notes TEXT`,
    `ALTER TABLE content_posts ADD COLUMN tags TEXT`,
    `ALTER TABLE conversations ADD COLUMN assigned_to_id INTEGER`,
    `DELETE FROM conversations WHERE id NOT IN (SELECT MAX(id) FROM conversations GROUP BY contact_id, channel_id)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_contact_channel ON conversations(contact_id, channel_id)`,
    // ── Ad Attribution columns (which FB page / ad created the lead) ──
    `ALTER TABLE leads ADD COLUMN ad_name TEXT`,
    `ALTER TABLE leads ADD COLUMN page_name TEXT`,
    `ALTER TABLE leads ADD COLUMN channel_id INTEGER`,
    `ALTER TABLE leads ADD COLUMN lead_market TEXT DEFAULT 'Bangladesh'`,
    `ALTER TABLE contacts ADD COLUMN referral_data TEXT`,
    `ALTER TABLE leads ADD COLUMN meta_adset_id TEXT`,
    `ALTER TABLE leads ADD COLUMN meta_adset_name TEXT`,
  ];
  migrations.forEach(m => { try { db.exec(m); } catch {} });

  // ── RBAC Migration: create user_roles and channel_access tables, migrate old roles ──
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS user_roles (
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role TEXT NOT NULL,
        PRIMARY KEY (user_id, role)
      );
      CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);

      CREATE TABLE IF NOT EXISTS channel_access (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        access_type TEXT DEFAULT 'reply',
        created_at TEXT DEFAULT (datetime('now')),
        UNIQUE(channel_id, user_id)
      );
      CREATE INDEX IF NOT EXISTS idx_channel_access_user ON channel_access(user_id);
      CREATE INDEX IF NOT EXISTS idx_channel_access_channel ON channel_access(channel_id);
      CREATE TABLE IF NOT EXISTS webhook_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, payload TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    `);

    // Migrate legacy single-role users to user_roles junction table
    const legacyUsers = db.prepare(`SELECT id, role FROM users WHERE id NOT IN (SELECT user_id FROM user_roles)`).all();
    const roleMap = {
      admin: 'founder_ceo',
      manager: 'application_manager',
      consultant: 'consultant'
    };
    const insertRole = db.prepare(`INSERT OR IGNORE INTO user_roles (user_id, role) VALUES (?, ?)`);
    for (const u of legacyUsers) {
      const newRole = roleMap[u.role] || 'consultant';
      insertRole.run(u.id, newRole);
    }
    if (legacyUsers.length) {
      console.log(`[migration] Migrated ${legacyUsers.length} legacy users to user_roles table`);
    }
  } catch (e) {
    console.error('[migration] RBAC migration failed:', e.message);
  }

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

  // Dynamic self-healing migration to reset and force file stages config to the updated professional pipeline
  try {
    const currentStagesRaw = db.prepare("SELECT value FROM meta_config WHERE key = 'settings_fileStages'").get()?.value;
    if (currentStagesRaw && currentStagesRaw.includes('Documents Collecting')) {
      const newStages = [
        'Document Collection',
        'Document Verification',
        'Application Submitted',
        'University Interview',
        'Conditional Offer',
        'Tuition Deposit',
        'Unconditional Offer & JW202',
        'Visa Application',
        'Visa Approval',
        'Final Settlement',
        'Pre-Departure & Flight',
        'Arrival & Enrollment'
      ];
      db.prepare("INSERT OR REPLACE INTO meta_config (key, value) VALUES ('settings_fileStages', ?)").run(JSON.stringify(newStages));
      console.log("[migration] Updated settings_fileStages in database to professional requested default flow.");
    }


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
        AND date < '2026-06-01'
        AND NOT (client_name = 'Sakib Al Jubaer' AND amount = 100000 AND date = '2026-05-15')
    `).run();

    // Ensure newer investments (June 2026 onwards) are included in cash calculations
    db.prepare(`
      UPDATE income 
      SET exclude_from_cash = 0 
      WHERE category = 'Investment' 
        AND date >= '2026-06-01'
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

  // Self-healing migration to automatically update all channels and meta_config to use the new valid System User token if empty
  try {
    const newToken = 'EAAVoF1AFCwoBR1ZAIqUN6mXMlFpaXhpzMgFlCP1KplZBNSY0FPagOD6iJBKeamBTvaCZAPo6YEw9YO1IZCT63BqzrtqBzZBSDGZCG4mtlPZAKQF4ZBmXGlowYXoSIzgZCB1j102Klcx4gMbOjeJwAUtroyJ9D95CnQ3C7j5tZA6OfItn22siqZAyzVXL1gI4KI7NoPstAZDZD';
    const oldToken = 'EAAVoF1AFCwoBRl9hbdnnxIUj5nFoaIEOj0doThSY3p159jABiZApMlSQTr4IguvIBNpyC1bsHewaq1jkr57Dkn349tyd458NpwGbZBhcw3NGv3d41TVj1VnLz5SKcNFNGHZBOL091vEIBJEQyH9DLyXz3JlSeVGxKGS9ZB4WWs0VwE3W9yfLGwQMr16BsBRGBgZDZD';
    
    // Update channels still using old or empty tokens
    const info = db.prepare("UPDATE channels SET access_token = ? WHERE access_token IS NULL OR access_token = '' OR access_token = ?").run(newToken, oldToken);
    
    // Always force update the global configs to the active token
    db.prepare("INSERT OR REPLACE INTO meta_config (key, value) VALUES ('page_access_token', ?)").run(newToken);
    db.prepare("INSERT OR REPLACE INTO meta_config (key, value) VALUES ('capi_token', ?)").run(newToken);
    
    if (info.changes > 0) {
      console.log(`[migration] Self-healed ${info.changes} channels with updated Global Access Token.`);
    }
  } catch (e) {
    console.error("[migration] Failed to apply new System User token:", e.message);
  }
  // Self-healing migration to assign lead L-00003 and others to Afsana Meme
  try {
    const afsanaEmp = db.prepare("SELECT id FROM employees WHERE name LIKE '%Afsana%'").get();
    if (afsanaEmp) {
      const info = db.prepare("UPDATE leads SET assigned_consultant = 'Afsana Meme', assigned_employee_id = ? WHERE lead_id = 'L-00003' OR client_name LIKE 'Sumi Iftin%'").run(afsanaEmp.id);
      if (info.changes > 0) {
        console.log(`[migration] Self-healed ${info.changes} leads and assigned them to Afsana Meme.`);
      }
    }
    // Self-heal users table mapping for Afsana Meme and Tahmid Imam
    db.prepare("UPDATE users SET emp_id = 'E-04', consultant_name = 'Afsana Meme' WHERE email LIKE '%afsana@eduexpressint.com%' OR name = 'Afsana'").run();
    db.prepare("UPDATE users SET emp_id = 'E-03' WHERE email LIKE '%tahmidrazi%' OR name LIKE '%Tahmid Imam%'").run();
    console.log(`[migration] Self-healed users table mappings for Afsana and Tahmid.`);
  } catch (e) {
    console.error("[migration] Failed to self-heal Afsana lead assignment:", e.message);
  }

    // Seed best time slots for Bangladesh market (EDT optimized)
    try {
      const bestTimeCheck = db.prepare("SELECT COUNT(*) as c FROM best_time_slots").get();
      if (bestTimeCheck.c === 0) {
        const defaultTimes = [
          // China page - Facebook - best engagement times (BD time)
          { page: 'china', platform: 'facebook', day: 0, time: '19:00', score: 85 },
          { page: 'china', platform: 'facebook', day: 0, time: '21:00', score: 78 },
          { page: 'china', platform: 'facebook', day: 1, time: '19:30', score: 82 },
          { page: 'china', platform: 'facebook', day: 1, time: '21:00', score: 75 },
          { page: 'china', platform: 'facebook', day: 2, time: '19:00', score: 88 },
          { page: 'china', platform: 'facebook', day: 2, time: '20:30', score: 80 },
          { page: 'china', platform: 'facebook', day: 3, time: '19:00', score: 86 },
          { page: 'china', platform: 'facebook', day: 3, time: '21:00', score: 79 },
          { page: 'china', platform: 'facebook', day: 4, time: '19:00', score: 90 },
          { page: 'china', platform: 'facebook', day: 4, time: '20:00', score: 84 },
          { page: 'china', platform: 'facebook', day: 5, time: '18:00', score: 92 },
          { page: 'china', platform: 'facebook', day: 5, time: '20:00', score: 88 },
          { page: 'china', platform: 'facebook', day: 6, time: '18:00', score: 89 },
          { page: 'china', platform: 'facebook', day: 6, time: '20:00', score: 85 },
          // BD page - Facebook
          { page: 'bd', platform: 'facebook', day: 0, time: '19:00', score: 87 },
          { page: 'bd', platform: 'facebook', day: 0, time: '21:00', score: 80 },
          { page: 'bd', platform: 'facebook', day: 1, time: '19:00', score: 85 },
          { page: 'bd', platform: 'facebook', day: 1, time: '20:30', score: 78 },
          { page: 'bd', platform: 'facebook', day: 2, time: '19:00', score: 89 },
          { page: 'bd', platform: 'facebook', day: 2, time: '21:00', score: 82 },
          { page: 'bd', platform: 'facebook', day: 3, time: '19:00', score: 86 },
          { page: 'bd', platform: 'facebook', day: 3, time: '20:30', score: 80 },
          { page: 'bd', platform: 'facebook', day: 4, time: '19:00', score: 91 },
          { page: 'bd', platform: 'facebook', day: 4, time: '20:00', score: 86 },
          { page: 'bd', platform: 'facebook', day: 5, time: '18:00', score: 93 },
          { page: 'bd', platform: 'facebook', day: 5, time: '20:00', score: 89 },
          { page: 'bd', platform: 'facebook', day: 6, time: '18:00', score: 90 },
          { page: 'bd', platform: 'facebook', day: 6, time: '20:00', score: 87 },
        ];
        const insertBestTime = db.prepare(`INSERT INTO best_time_slots (page, platform, day_of_week, time_slot, engagement_score) VALUES (?, ?, ?, ?, ?)`);
        for (const t of defaultTimes) {
          insertBestTime.run(t.page, t.platform, t.day, t.time, t.score);
        }
        console.log(`[migration] Seeded ${defaultTimes.length} best time slots for auto-scheduling.`);
      }
    } catch (e) {
      console.error('[migration] Best time seeding failed:', e.message);
    }

    // Seed default content templates
    try {
      const templateCheck = db.prepare("SELECT COUNT(*) as c FROM content_templates").get();
      if (templateCheck.c === 0) {
        const defaultTemplates = [
          {
            name: 'Scholarship Alert — China CSC',
            pillar: 'scholarship',
            page: 'china',
            format: 'Carousel',
            language: 'bangla',
            hook: 'CSC Scholarship 2026 — Full Ride! 🎓',
            body: 'Did you know? Chinese Government Scholarship (CSC) covers everything for Bangladesh students.\n\n✅ 100% Tuition Free\n✅ Monthly Stipend: ৳10,000-60,000\n✅ Free Accommodation\n✅ No IELTS (MOI Certificate)\n\nDeadline: {{deadline}}. Apply through EduExpress.',
            hashtags: '#CSCScholarship #StudyInChina #FullScholarship #EduExpressBD',
            cta: 'DM us for free consultation 📩',
            brief: 'Carousel with scholarship timeline, eligibility checklist, and EduExpress contact'
          },
          {
            name: 'Success Story — Visa Approved',
            pillar: 'success_story',
            page: 'china',
            format: 'Single image',
            language: 'mixed',
            hook: 'From Dhanmondi to Beijing! 🎓🇨🇳',
            body: 'Our student {{student_name}} just got their visa approved for {{university}}!\n\n✅ CSC Scholarship Winner\n✅ No CSCA Required\n✅ Started with zero preparation\n\n"I never thought I could study abroad. EduExpress made it possible."\n\nReady to be our next success story?',
            hashtags: '#SuccessStory #VisaApproved #EduExpressBD #StudyAbroad',
            cta: 'Apply Now — Limited Seats 🏃',
            brief: 'Single image with student photo (with permission), visa screenshot, university logo'
          },
          {
            name: 'Trust Builder — 8 Years of Excellence',
            pillar: 'trust',
            page: 'bd',
            format: 'Carousel',
            language: 'bangla',
            hook: '8 Years. 2,000+ Students. 98% Visa Success.',
            body: 'EduExpress International — Bangladesh\'s most trusted study abroad consultancy.\n\n📍 Dhanmondi, Dhaka\n✅ Payment After Visa Policy\n✅ 150+ Partner Universities\n✅ Dedicated Consultant Per Student\n\nWhy students choose us:\n→ Transparent process\n→ Real success stories\n→ Lifetime support\n\nYour dream university is one DM away.',
            hashtags: '#TrustedConsultancy #EduExpressBD #StudyAbroad #VisaSuccess',
            cta: 'Visit our Dhanmondi office 📍',
            brief: 'Carousel with team photos, office interior, student testimonials, partner university logos'
          },
          {
            name: 'Urgency — Intake Deadline Alert',
            pillar: 'urgency',
            page: 'china',
            format: 'Reel',
            language: 'bangla',
            hook: '⏰ Last 7 Days! September Intake Deadline',
            body: 'September 2026 intake applications closing soon!\n\n❌ Don\'t wait until last minute\n✅ Seats filling fast for top universities\n✅ Scholarship spots limited\n\nUniversities still accepting:\n→ {{university_1}}\n→ {{university_2}}\n→ {{university_3}}\n\nApply now or wait until 2027!',
            hashtags: '#DeadlineAlert #ApplyNow #SeptemberIntake #EduExpressBD',
            cta: 'WhatsApp: +8801983333566 📞',
            brief: 'Reel with countdown animation, university campus footage, deadline calendar'
          },
          {
            name: 'University Spotlight — Top Ranking',
            pillar: 'university',
            page: 'china',
            format: 'Carousel',
            language: 'english',
            hook: 'Top 500 Worldwide — {{university_name}} 🏫',
            body: 'Why choose {{university_name}}?\n\n🏆 QS Ranking: {{qs_rank}}\n📍 Location: {{city}}, China\n💰 Tuition: {{tuition}}\n🎓 Programs: {{programs}}\n📝 Entry: CSCA-Free for Bachelor\n\nCSC Scholarship available!\nMonthly stipend: ৳10,000-60,000\n\nApply through EduExpress for priority processing.',
            hashtags: '#TopUniversity #StudyInChina #EduExpressBD #Scholarship',
            cta: 'Click link in bio 🔗',
            brief: 'Carousel with university campus photos, ranking badge, program list, fee structure'
          }
        ];
        const insertTmpl = db.prepare(`INSERT INTO content_templates (name, description, pillar, page, format, language, platform, tone, hook_template, body_template, hashtags_template, cta_template, brief_template, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
        for (const t of defaultTemplates) {
          insertTmpl.run(t.name, '', t.pillar, t.page, t.format, t.language, 'facebook', 'expert_consultant', t.hook, t.body, t.hashtags, t.cta, t.brief, 'System');
        }
        console.log(`[migration] Seeded ${defaultTemplates.length} default content templates.`);
      }
    } catch (e) {
      console.error('[migration] Template seeding failed:', e.message);
    }

  // Seed pre-built data from external module (keeps server.js small)
  try {
    const seedData = require('./seed-data.cjs');

    // Seed templates
    const checkTmpl = db.prepare("SELECT COUNT(*) as c FROM message_templates");
    const insertTmpl = db.prepare(`INSERT OR IGNORE INTO message_templates (name, category, language, content, variables, approved, usage_count) VALUES (?, ?, ?, ?, ?, ?, 0)`);
    if (checkTmpl.get().c === 0) {
      for (const t of seedData.templates) {
        insertTmpl.run(t.name, t.category, t.language, t.content, t.variables, t.approved);
      }
      console.log(`[migration] Seeded ${seedData.templates.length} message templates.`);
    }

    // Seed tags
    const insertTag = db.prepare("INSERT OR IGNORE INTO contact_tags (name, color) VALUES (?, ?)");
    for (const t of seedData.tags) {
      insertTag.run(t.name, t.color);
    }
    console.log(`[migration] Seeded ${seedData.tags.length} contact tags.`);

    // Seed automation rules
    const checkRules = db.prepare("SELECT COUNT(*) as c FROM automation_rules");
    if (checkRules.get().c === 0) {
      const insertRule = db.prepare(`INSERT INTO automation_rules (name, trigger_type, trigger_config, action_type, action_config, priority, active, created_at) VALUES (?, ?, ?, ?, ?, ?, 1, datetime('now'))`);
      for (const r of seedData.defaultRules) {
        const tmpl = db.prepare("SELECT id FROM message_templates WHERE name=? LIMIT 1").get(r.action_template);
        insertRule.run(
          r.name,
          r.trigger_type,
          JSON.stringify(r.trigger_config),
          r.action_type,
          tmpl ? JSON.stringify({ template_id: tmpl.id }) : '{}',
          r.priority
        );
      }
      console.log(`[migration] Seeded ${seedData.defaultRules.length} automation rules.`);
    }
  } catch (e) {
    console.error('[migration] Seed data failed:', e.message);
  }  // ── Professional SMM Pipeline v3.0: Recreate content_posts with new status pipeline ──
  try {
    const sql = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='content_posts'").get()?.sql || "";
    // If the table still has the old CHECK constraint (with 'drafted' but not 'ideation'), recreate it
    if (sql.includes("drafted") && !sql.includes("ideation")) {
      console.log("[migration] Recreating content_posts table with new v3.0 pipeline statuses...");
      db.exec(`
        CREATE TABLE content_posts_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          week TEXT,
          page TEXT CHECK(page IN ('china','bd','instagram','tiktok')),
          pillar TEXT,
          format TEXT,
          hook TEXT,
          body TEXT,
          hashtags TEXT,
          cta TEXT,
          brief TEXT,
          post_date TEXT,
          post_time TEXT,
          asset_url TEXT,
          asset_type TEXT,
          asset_uploaded_by TEXT,
          asset_uploaded_at TEXT,
          status TEXT DEFAULT 'ideation',
          quality_score INTEGER,
          quality_checks TEXT,
          utm_source TEXT,
          utm_medium TEXT,
          utm_campaign TEXT,
          utm_content TEXT,
          short_link TEXT,
          redraft_count INTEGER DEFAULT 0,
          research_intel_id INTEGER,
          shares INTEGER,
          comments INTEGER,
          saves INTEGER,
          video_views INTEGER,
          leads INTEGER,
          published_at TEXT,
          published_by TEXT,
          language TEXT DEFAULT 'bangla',
          campaign_id INTEGER,
          assigned_to TEXT,
          reviewed_by TEXT,
          reviewed_at TEXT,
          rejection_reason TEXT,
          due_date TEXT,
          priority TEXT CHECK(priority IN ('low','normal','high','urgent')) DEFAULT 'normal',
          notes TEXT,
          tags TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        );
        INSERT INTO content_posts_new SELECT * FROM content_posts;
        DROP TABLE content_posts;
        ALTER TABLE content_posts_new RENAME TO content_posts;
        CREATE INDEX IF NOT EXISTS idx_posts_status ON content_posts(status);
        CREATE INDEX IF NOT EXISTS idx_posts_page ON content_posts(page);
        CREATE INDEX IF NOT EXISTS idx_posts_campaign ON content_posts(campaign_id);
      `);
      // Map old statuses to new pipeline stages
      db.exec(`
        UPDATE content_posts SET status = CASE
          WHEN status = 'drafted' THEN 'writing'
          WHEN status = 'approved' THEN 'approved'
          WHEN status = 'scheduled' THEN 'scheduled'
          WHEN status = 'published' THEN 'published'
          WHEN status = 'asset_pending' THEN 'design'
          WHEN status = 'asset_ready' THEN 'design_review'
          ELSE 'ideation'
        END
      `);
      console.log("[migration] content_posts recreated with new pipeline stages.");
    }
  } catch (e) {
    console.error('[migration] content_posts recreation failed:', e.message);
  }
  // Seed default destinations if empty
  try {
    const destCheck = db.prepare("SELECT COUNT(*) as c FROM destinations").get();
    if (destCheck.c === 0) {
      const defaultDestPath = join(__dirname, 'default_destinations.json');
      if (existsSync(defaultDestPath)) {
        const destData = JSON.parse(readFileSync(defaultDestPath, 'utf8'));
        const insertDest = db.prepare(`
          INSERT INTO destinations (name, slug, requirements, programs, fees, embassy_documents, application_processing, other_details, is_public) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
        `);
        for (const [slug, details] of Object.entries(destData)) {
          insertDest.run(
            details.name, slug, 
            details.requirements || '', 
            details.programs || '', 
            details.fees || '', 
            details.embassy_documents || '', 
            details.application_processing || '', 
            details.other_details || ''
          );
        }
        console.log(`[migration] Seeded ${Object.keys(destData).length} default destinations.`);
      }
    }
  } catch (e) {
    console.error('[migration] Destination seeding failed:', e.message);
  }

}

// ─────────────────────────────────────────────────────────
// SSE REAL-TIME BROADCAST
// ─────────────────────────────────────────────────────────
// Each SSE client = { res, user }. The user object lets us push only to admins,
// or only to the consultant who owns a specific lead.
const sseClients = new Map();
const longPollClients = new Set();

app.post('/api/messages/poll', (req, res) => {
  const payload = verifyToken(getCookie(req, AUTH_COOKIE));
  if (!payload) return res.status(401).json({ error: 'Unauthorized' });

  let isResolved = false;
  const clientObj = {
    user: payload,
    send: (event) => {
      if (isResolved) return;
      isResolved = true;
      longPollClients.delete(clientObj);
      res.json(event);
    }
  };

  longPollClients.add(clientObj);

  const timeout = setTimeout(() => {
    if (isResolved) return;
    isResolved = true;
    longPollClients.delete(clientObj);
    res.json({ type: 'timeout' });
  }, 20000);

  req.on('close', () => {
    clearTimeout(timeout);
    longPollClients.delete(clientObj);
  });
});

app.get('/api/events', (req, res) => {
  // Auth via cookie — EventSource always sends cookies, no extra setup needed.
  const payload = verifyToken(getCookie(req, AUTH_COOKIE));
  if (!payload) return res.status(401).end();

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');   // disables nginx buffering
  res.setHeader('X-LiteSpeed-Buffer', 'no');  // disables LiteSpeed buffering (Hostinger)
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.flushHeaders();

  const id = Date.now() + Math.random();
  sseClients.set(id, { res, user: payload });
  res.write(`event: connected\ndata: ${JSON.stringify({ type: 'connected', id })}\n\n`);
  if (typeof res.flush === 'function') res.flush();

  const ping = setInterval(() => {
    try {
      res.write(`: ping\n\n`);
      if (typeof res.flush === 'function') res.flush();
    } catch { clearInterval(ping); sseClients.delete(id); }
  }, 5000);

  req.on('close', () => { clearInterval(ping); sseClients.delete(id); });
});

// Broadcast to every connected client. Optional `filter(user)` decides whether
// to send to a given client — used to scope notifications by role/consultant.
// IMPORTANT: We send `event: <type>` so browser EventSource named listeners fire.
function broadcast(type, data, filter = null) {
  const msg = `event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`;
  sseClients.forEach((client, id) => {
    if (filter && !filter(client.user)) return;
    try {
      client.res.write(msg);
      if (typeof client.res.flush === 'function') client.res.flush();
    } catch {
      sseClients.delete(id);
    }
  });

  longPollClients.forEach(client => {
    if (filter && !filter(client.user)) return;
    try {
      client.send({ type, ...data });
    } catch {
      longPollClients.delete(client);
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

  // Office Wi-Fi SSID Verification (supports multi-SSID list)
  let _allowedSSIDs = [];
  try { _allowedSSIDs = JSON.parse(getConfig('office_allowed_ssids') || '[]'); } catch {}
  if (!Array.isArray(_allowedSSIDs) || _allowedSSIDs.length === 0) {
    const single = getConfig('office_wifi_ssid');
    if (single) _allowedSSIDs = [single];
  }
  const onOfficeWifi = opts.ssid && _allowedSSIDs.some(s =>
    String(s).toLowerCase().trim() === String(opts.ssid).toLowerCase().trim()
  );

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

function autoLinkOrCreateLead(contact) {
  if (contact.lead_id) return contact;
  let phone = contact.phone ? String(contact.phone).trim() : null;
  let last10 = null;
  
  if (phone) {
    const digits = phone.replace(/[^\d]/g, '');
    if (digits.startsWith('01') && digits.length === 11) {
      phone = '+88' + digits;
    } else if (digits.startsWith('8801') && digits.length === 13) {
      phone = '+' + digits;
    }
    last10 = digits.slice(-10);
  }

  let existingLead = null;
  if (last10 && last10.length >= 10) {
    existingLead = db.prepare("SELECT id FROM leads WHERE phone LIKE ?").get(`%${last10}`);
  }

  if (existingLead) {
    db.prepare("UPDATE contacts SET lead_id=? WHERE id=?").run(existingLead.id, contact.id);
    db.prepare("UPDATE conversations SET lead_id=? WHERE contact_id=?").run(existingLead.id, contact.id);
    contact.lead_id = existingLead.id;
  } else {
    const year = new Date().getFullYear().toString().slice(-2);
    const count = db.prepare("SELECT COUNT(*) as n FROM leads WHERE lead_id LIKE ?").get(`L${year}%`).n + 1;
    const nextId = `L${year}${String(count).padStart(4, '0')}`;
    
    let lead_source = 'Inbox';
    let source = 'In-House';
    let ad_name = null, page_name = null, channel_id = null, meta_ad_id = null, meta_campaign = null, assigned_consultant = null;
    let notes = 'Auto-created from Chat';

    if (contact.referral_data) {
      try {
        const ref = JSON.parse(contact.referral_data);
        if (ref.sourcePlatform !== 'whatsapp') {
          const platformSourceMap = { messenger: 'Facebook Ad', instagram: 'Instagram Ad' };
          lead_source = platformSourceMap[ref.sourcePlatform] || 'Facebook Ad';
          meta_ad_id = ref.ad_id || ref.source_id || null;
          meta_campaign = ref.campaign_id || ref.campaign_name || null;
          ad_name = ref.ad_title || ref.headline || null;
          page_name = ref.channel_name || null;
          channel_id = ref.channel_id || null;
          assigned_consultant = ref.consultant || null;

          const adTitle = ad_name || '';
          const bodyText = ref.body || '';
          notes = adTitle ? `Click-to-${ref.sourcePlatform} Referral Ad: "${adTitle}" ${bodyText ? '- ' + bodyText : ''}` : `Auto-created from Click-to-${ref.sourcePlatform} ad.`;

          const textToCheck = (adTitle + ' ' + bodyText).toLowerCase();
          if (textToCheck.includes('china') || textToCheck.includes('chinese') || textToCheck.includes('中国')) {
            source = 'China';
            assigned_consultant = 'Abdullah Al Rakib';
          } else if (textToCheck.includes('b2b') || textToCheck.includes('agent')) {
            source = 'B2B';
            assigned_consultant = 'Tahmid Imam';
          } else if (textToCheck.includes('bangladesh') || textToCheck.includes('bd') || textToCheck.includes('office')) {
            source = 'In-House';
            assigned_consultant = 'Taj Ahmed';
          }
        }
      } catch (e) {}
    }

    if (!page_name) {
      try {
        const convChannel = db.prepare(`
          SELECT c.id, c.name, c.type 
          FROM conversations conv 
          JOIN channels c ON conv.channel_id = c.id 
          WHERE conv.contact_id = ? 
          ORDER BY conv.last_message_at DESC LIMIT 1
        `).get(contact.id);
        
        if (convChannel) {
          page_name = convChannel.name;
          channel_id = convChannel.id;
          if (lead_source === 'Inbox') {
            if (convChannel.type === 'messenger') lead_source = 'Messenger';
            else if (convChannel.type === 'instagram') lead_source = 'Instagram Ad';
            else if (convChannel.type === 'whatsapp') lead_source = 'WhatsApp';
          }
        }
      } catch (e) {
        console.error('Error fetching channel for page_name fallback:', e.message);
      }
    }

    const info = db.prepare(`INSERT INTO leads (
      lead_id, date_added, client_name, phone, lead_source, lead_status, source,
      meta_ad_id, meta_campaign, ad_name, page_name, channel_id, assigned_consultant, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      nextId, new Date().toISOString().slice(0, 10), contact.name || 'Chat Lead', phone, lead_source, 'New Lead', source,
      meta_ad_id, meta_campaign, ad_name, page_name, channel_id, assigned_consultant, notes
    );
    const newLeadId = info.lastInsertRowid;
    db.prepare("UPDATE contacts SET lead_id=? WHERE id=?").run(newLeadId, contact.id);
    db.prepare("UPDATE conversations SET lead_id=? WHERE contact_id=?").run(newLeadId, contact.id);
    contact.lead_id = newLeadId;
    
    // Broadcast the new lead so UI updates
    const newLead = db.prepare("SELECT * FROM leads WHERE id=?").get(newLeadId);
    if (newLead) {
      broadcast('new_lead', { lead: newLead });
      logActivity({ type: 'lead_created', actor: { name: 'Auto-Lead Bot' }, lead: newLead, details: { source: 'Chat Auto-Link' } });
    }
  }
  return contact;
}

function upsertContact({ name, phone, wa_id, messenger_id, instagram_id, tiktok_id, email, avatar_url }) {
  const existing = wa_id
    ? db.prepare("SELECT * FROM contacts WHERE wa_id=?").get(wa_id)
    : messenger_id
    ? db.prepare("SELECT * FROM contacts WHERE messenger_id=?").get(messenger_id)
    : instagram_id
    ? db.prepare("SELECT * FROM contacts WHERE instagram_id=?").get(instagram_id)
    : tiktok_id
    ? db.prepare("SELECT * FROM contacts WHERE tiktok_id=?").get(tiktok_id)
    : phone ? db.prepare("SELECT * FROM contacts WHERE phone=?").get(phone) : null;

  if (existing) {
    if (name && (!existing.name || existing.name === 'Unknown' || existing.name.endsWith(' User'))) {
      db.prepare("UPDATE contacts SET name=? WHERE id=?").run(name, existing.id);
      existing.name = name;
    }
    if (avatar_url && !existing.avatar_url) {
      db.prepare("UPDATE contacts SET avatar_url=? WHERE id=?").run(avatar_url, existing.id);
      existing.avatar_url = avatar_url;
    }
    if (phone && !existing.phone) {
      db.prepare("UPDATE contacts SET phone=? WHERE id=?").run(phone, existing.id);
      existing.phone = phone;
    }
    return existing;
  }
  const info = db.prepare(`INSERT INTO contacts (name,phone,email,wa_id,messenger_id,instagram_id,tiktok_id,avatar_url) VALUES (?,?,?,?,?,?,?,?)`)
    .run(name || 'Unknown', phone || null, email || null, wa_id || null, messenger_id || null, instagram_id || null, tiktok_id || null, avatar_url || null);
  const newContact = db.prepare("SELECT * FROM contacts WHERE id=?").get(info.lastInsertRowid);
  return newContact;
}

function upsertConversation(contactId, channelId, channelType) {
  const existing = db.prepare("SELECT * FROM conversations WHERE contact_id=? AND channel_id=? AND status != 'resolved'").get(contactId, channelId);
  if (existing) {
    // If existing conversation is not assigned, but channel has a consultant, auto-assign it now
    if (!existing.assigned_to) {
      const chan = db.prepare("SELECT consultant FROM channels WHERE id=?").get(channelId);
      if (chan && chan.consultant) {
        const emp = db.prepare("SELECT id FROM employees WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) LIMIT 1").get(chan.consultant);
        try {
          db.prepare("UPDATE conversations SET assigned_to=?, assigned_to_id=? WHERE id=?").run(chan.consultant, emp ? emp.id : null, existing.id);
        } catch {
          try {
            db.prepare("UPDATE conversations SET assigned_to=? WHERE id=?").run(chan.consultant, existing.id);
          } catch (e) { console.error('Auto-assign update failed:', e.message); }
        }
        existing.assigned_to = chan.consultant;
        existing.assigned_to_id = emp ? emp.id : null;
      }
    }
    return existing;
  }
  
  // Look up channel's consultant
  const chan = db.prepare("SELECT consultant FROM channels WHERE id=?").get(channelId);
  let assigned_to = null;
  let assigned_to_id = null;
  if (chan && chan.consultant) {
    assigned_to = chan.consultant;
    const emp = db.prepare("SELECT id FROM employees WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) LIMIT 1").get(chan.consultant);
    if (emp) assigned_to_id = emp.id;
  }

  let info;
  try {
    info = db.prepare(`INSERT OR IGNORE INTO conversations (contact_id,channel_id,channel_type,status,assigned_to,assigned_to_id) VALUES (?,?,?, 'open', ?, ?)`)
      .run(contactId, channelId, channelType, assigned_to, assigned_to_id);
  } catch (err) {
    // Fallback: if assigned_to_id column is missing in production database
    try {
      info = db.prepare(`INSERT OR IGNORE INTO conversations (contact_id,channel_id,channel_type,status,assigned_to) VALUES (?,?,?, 'open', ?)`)
        .run(contactId, channelId, channelType, assigned_to);
    } catch (e2) {
      try {
        info = db.prepare(`INSERT OR IGNORE INTO conversations (contact_id,channel_id,channel_type,status) VALUES (?,?,?,'open')`)
          .run(contactId, channelId, channelType);
      } catch (e3) {}
    }
  }

  // If insert was ignored (meaning conversation already exists), fetch and return it
  if (!info || info.changes === 0) {
    return db.prepare("SELECT * FROM conversations WHERE contact_id=? AND channel_id=? AND status != 'resolved'").get(contactId, channelId);
  }
  
  const createdConv = db.prepare("SELECT * FROM conversations WHERE id=?").get(info.lastInsertRowid);
  // Auto inherit lead_id from contact
  const contact = db.prepare("SELECT lead_id FROM contacts WHERE id=?").get(contactId);
  if (contact && contact.lead_id && createdConv) {
    db.prepare("UPDATE conversations SET lead_id=? WHERE id=?").run(contact.lead_id, createdConv.id);
    createdConv.lead_id = contact.lead_id;
  }
  return createdConv;
}

function createLeadFromContact(contactId, source, initialMessage, creatorUser, options = {}) {
  const contact = db.prepare("SELECT * FROM contacts WHERE id=?").get(contactId);
  if (!contact) throw new Error("Contact not found for conversion");
  
  if (contact.lead_id) {
    const existingLead = db.prepare("SELECT id FROM leads WHERE id=?").get(contact.lead_id);
    if (existingLead) {
      throw new Error("Contact already converted to lead (lead_id: " + contact.lead_id + ")");
    } else {
      // Clear the dangling reference so we can proceed
      db.prepare("UPDATE contacts SET lead_id=NULL WHERE id=?").run(contactId);
      db.prepare("UPDATE conversations SET lead_id=NULL WHERE contact_id=?").run(contactId);
    }
  }

  const lead_id = nextLeadId();
    const sourceMap = {
      whatsapp: 'WhatsApp Inquiry',
      messenger: 'Messenger Inquiry',
      instagram: 'Instagram Inquiry',
      tiktok: 'TikTok Inquiry'
    };
    const client_name = options.client_name || contact.name || sourceMap[source] || 'Chat Inquiry';
    const phone = options.phone || contact.phone || null;
    const email = contact.email || null;
    const destination = options.destination || 'Bangladesh';
    const degree = options.degree || null;

    // Find the channel consultant or assign to the converting consultant user
    let assigned_consultant = null;
    let assigned_employee_id = null;

    if (creatorUser && creatorUser.roles?.includes('consultant')) {
      assigned_consultant = creatorUser.consultant_name || creatorUser.name;
      const emp = db.prepare("SELECT id FROM employees WHERE emp_id=?").get(creatorUser.emp_id);
      if (emp) assigned_employee_id = emp.id;
    } else {
      const lastConv = db.prepare("SELECT channel_id FROM conversations WHERE contact_id=? ORDER BY id DESC LIMIT 1").get(contactId);
      if (lastConv) {
        const chan = db.prepare("SELECT consultant FROM channels WHERE id=?").get(lastConv.channel_id);
        if (chan) {
          assigned_consultant = chan.consultant;
          const emp = db.prepare("SELECT id FROM employees WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))").get(chan.consultant);
          if (emp) assigned_employee_id = emp.id;
        }
      }
    }

    const leadSourceMap = {
      whatsapp: 'WhatsApp',
      messenger: 'Messenger',
      instagram: 'Instagram',
      tiktok: 'TikTok'
    };

    let meta_ad_id = null;
    let meta_campaign = null;
    let meta_adset_name = null;
    let meta_adset_id = null;
    let ad_name = null;
    let channel_id = null;

    if (contact.referral_data) {
      try {
        const ref = JSON.parse(contact.referral_data);
        if (ref.ad_id) meta_ad_id = String(ref.ad_id);
        if (ref.campaign_name || ref.campaign_id) meta_campaign = String(ref.campaign_name || ref.campaign_id);
        if (ref.adset_name) meta_adset_name = String(ref.adset_name);
        if (ref.adset_id) meta_adset_id = String(ref.adset_id);
        if (ref.ad_title || ref.headline) ad_name = String(ref.ad_title || ref.headline);
        if (ref.channel_id) channel_id = ref.channel_id;
      } catch (e) {}
    }

    const params = leadParams({
      client_name,
      phone,
      email,
      destination,
      degree,
      source: 'In-House',
      lead_source: leadSourceMap[source] || 'Chat',
      lead_status: 'New Lead',
      assigned_consultant,
      assigned_employee_id,
      meta_ad_id,
      meta_campaign,
      meta_adset_name,
      meta_adset_id,
      ad_name,
      channel_id,
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
      sendCAPIEvent('Lead', lead).catch(() => {});
      console.log(`✅ Auto-created Lead from ${source}: ${lead_id} — ${client_name}`);
      return lead;
    }
    throw new Error("Lead could not be retrieved after insert");
}

function createLeadFromReferral({ contact, channel, referralData, sourcePlatform }) {
  try {
    if (contact.lead_id) return null; // Lead already exists
    
    // Always store referral data on the contact for future use (when phone is provided)
    if (referralData) {
      try {
        const enrichedReferral = { ...referralData, sourcePlatform, channel_name: channel.name, channel_id: channel.id, consultant: channel.consultant };
        db.prepare("UPDATE contacts SET referral_data=? WHERE id=?").run(JSON.stringify(enrichedReferral), contact.id);
      } catch (e) { console.error('Error saving referral data:', e.message); }
    }

    if (!contact.phone) return null;  // Skip — no phone number, not a trackable lead

    const adId = referralData ? (referralData.ad_id || referralData.source_id) : null;
    const campaignId = referralData ? (referralData.campaign_id || referralData.campaign_name) : null;
    const adTitle = referralData ? (referralData.ad_title || referralData.headline || '') : '';
    const bodyText = referralData ? (referralData.body || '') : '';

    const lead_id = nextLeadId();
    let assigned_consultant = channel.consultant || null;
    let destination = 'Bangladesh';
    let source = 'In-House';

    // Routing rules
    const textToCheck = (adTitle + ' ' + bodyText).toLowerCase();
    if (textToCheck.includes('china') || textToCheck.includes('chinese') || textToCheck.includes('中国')) {
      destination = 'China';
      source = 'China';
      assigned_consultant = 'Abdullah Al Rakib';
    } else if (textToCheck.includes('b2b') || textToCheck.includes('agent')) {
      destination = 'Bangladesh';
      source = 'B2B';
      assigned_consultant = 'Tahmid Imam';
    } else if (textToCheck.includes('bangladesh') || textToCheck.includes('bd') || textToCheck.includes('office')) {
      destination = 'Bangladesh';
      source = 'In-House';
      assigned_consultant = 'Taj Ahmed';
    }

    const platformSourceMap = {
      whatsapp: referralData ? 'WhatsApp Ad' : 'WhatsApp Manual',
      messenger: 'Facebook Ad',
      instagram: 'Instagram Ad'
    };

    const noteText = referralData 
      ? (adTitle 
        ? `Click-to-${sourcePlatform} Referral Ad: "${adTitle}" ${bodyText ? '- ' + bodyText : ''}`
        : `Auto-created from Click-to-${sourcePlatform} ad.`)
      : `Auto-created from organic ${sourcePlatform} knock.`;

    const params = leadParams({
      client_name: contact.name || 'Chat Lead',
      phone: contact.phone || null,
      email: contact.email || null,
      destination,
      source,
      lead_source: platformSourceMap[sourcePlatform] || 'Facebook Ad',
      lead_status: 'New Lead',
      assigned_consultant,
      meta_ad_id: adId || null,
      meta_campaign: campaignId || null,
      ad_name: adTitle || null,
      page_name: channel.name || null,
      channel_id: channel.id || null,
      notes: noteText
    }, lead_id, 0);

    const info = db.prepare(LEAD_INSERT_SQL).run(params);
    const lead = db.prepare("SELECT * FROM leads WHERE id=?").get(info.lastInsertRowid);
    if (lead) {
      db.prepare("UPDATE contacts SET lead_id=? WHERE id=?").run(lead.id, contact.id);
      db.prepare("UPDATE conversations SET lead_id=? WHERE contact_id=?").run(lead.id, contact.id);
      
      broadcast('new_lead', { lead });
      logActivity({
        type: 'lead_created',
        actor: { name: 'Meta Ad Automation' },
        lead,
        details: { client_name: contact.name, source: platformSourceMap[sourcePlatform] || 'Facebook Ad' }
      });
      // Persist CTWA click id for Conversions API attribution
      if (referralData.ctwa_clid) {
        try {
          db.prepare("UPDATE leads SET ctwa_clid=? WHERE id=?").run(referralData.ctwa_clid, lead.id);
          lead.ctwa_clid = referralData.ctwa_clid;
        } catch {}
      }
      sendCAPIEvent('Lead', lead).catch(() => {});
      return lead;
    }
  } catch (err) {
    console.error('[referral-lead] Failed to create lead from referral:', err.message);
  }
  return null;
}



// ── n8n AI Welcome Bot Integration ───────────────────────────────────────────
// New messages are forwarded to n8n where Gemini generates a personalised reply.
const N8N_WELCOME_WEBHOOK = 'https://vibeacademy.cloud/webhook/eduexpress-welcome';

function forwardToN8N(data) {
  fetch(N8N_WELCOME_WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).catch(e => console.log('[n8n] forward warn:', e.message));
  console.log(`[n8n] forwarded ${data.platform} conv:${data.conversationId} → AI welcome`);
}
// ─────────────────────────────────────────────────────────────────────────────

function saveMessage(convId, direction, content, type = 'text', waMessageId = null, mediaUrl = null, caption = null) {
  try {
    const info = db.prepare(`INSERT INTO messages (conversation_id,direction,type,content,wa_message_id,media_url,caption,status)
      VALUES (?,?,?,?,?,?,?,'delivered')`).run(convId, direction, type, content, waMessageId, mediaUrl, caption);
    const msg = db.prepare("SELECT * FROM messages WHERE id=?").get(info.lastInsertRowid);
    db.prepare("UPDATE conversations SET last_message=?, last_message_at=datetime('now'), unread_count=unread_count+1 WHERE id=?").run(content || `[${type}]`, convId);
    const conv = db.prepare("SELECT conversations.*, contacts.name as contact_name, contacts.phone as contact_phone, channels.name as channel_name, channels.type as channel_type FROM conversations LEFT JOIN contacts ON contacts.id=conversations.contact_id LEFT JOIN channels ON channels.id=conversations.channel_id WHERE conversations.id=?").get(convId);
    broadcast('new_message', {
      ...msg,
      conversation_id: convId,
      direction: direction === 'in' ? 'inbound' : 'outbound',
      contact_name: conv?.contact_name,
      channel_type: conv?.channel_type,
    }, (u) => userHasAccessToConversation(u, convId));

    // Evaluate automation rules in background
    if (conv) {
      let currentContact = db.prepare("SELECT * FROM contacts WHERE id=?").get(conv.contact_id);

      // Auto-Lead Creation from Message Content (Bangladeshi numbers)
      if (direction === 'in' && type === 'text' && content && !conv.lead_id) {
        const bdPhoneRegex = /(?:\+?88[\s-]*)?01[3-9](?:[\s-]*\d){8}/;
        const match = content.match(bdPhoneRegex);
        if (match) {
          const extractedPhone = match[0];
          db.prepare("UPDATE contacts SET phone=? WHERE id=? AND (phone IS NULL OR phone = '')").run(extractedPhone, conv.contact_id);
          currentContact = db.prepare("SELECT * FROM contacts WHERE id=?").get(conv.contact_id);
          if (currentContact) {
            const oldLeadId = conv.lead_id;
            autoLinkOrCreateLead(currentContact);
            const freshConvRow = db.prepare("SELECT * FROM conversations WHERE id=?").get(conv.id);
            if (freshConvRow && freshConvRow.lead_id !== oldLeadId) {
                const fullConv = db.prepare(`${CONV_SELECT} WHERE conversations.id=?`).get(conv.id);
                broadcast('conversation_updated', fullConv);
            }
          }
        }
      }

      const freshConvForRules = db.prepare("SELECT * FROM conversations WHERE id=?").get(conv.id);
      const channel = db.prepare("SELECT * FROM channels WHERE id=?").get(conv.channel_id);
      setImmediate(() => executeAutomationRules({ conversation: freshConvForRules, message: msg, channel, contact: currentContact }).catch(e => console.error("Automation error:", e)));

      const inCount = db.prepare("SELECT COUNT(*) as n FROM messages WHERE conversation_id=? AND direction='in'").get(convId).n;
      if (inCount === 1) {
        // Send CAPI Contact event for new conversation
        sendCAPIEvent('Contact', {
          lead_id: `CONV-${conv.id}`,
          phone: currentContact?.phone || undefined,
          event_source_url: undefined,
        }).catch(() => {});
      }
    }

    return msg;
  } catch (e) {
    if (!e.message.includes('UNIQUE')) console.error('saveInboundMessage:', e.message);
    return null;
  }
}

async function sendWhatsApp(channel, to, text, type = 'text', mediaUrl = null) {
  const cleanTo = to.replace(/\D/g, '');
  const url = `https://graph.facebook.com/v19.0/${channel.phone_number_id}/messages`;
  let bodyObj = { messaging_product: 'whatsapp', to: cleanTo };
  if (type === 'image' && mediaUrl) {
    bodyObj.type = 'image';
    bodyObj.image = { link: mediaUrl, caption: text || undefined };
  } else if (type === 'document' && mediaUrl) {
    bodyObj.type = 'document';
    bodyObj.document = { link: mediaUrl, filename: text || 'Document' };
  } else {
    bodyObj.type = 'text';
    bodyObj.text = { body: text };
  }
  const token = channel.access_token || getConfig('page_access_token');
  if (!token) {
    console.error('[sendWhatsApp] No access token for channel', channel.name || channel.id);
    return { error: { message: 'No access token configured' } };
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(bodyObj)
  });
  return res.json();
}

async function sendMessenger(channel, recipientId, text, type = 'text', mediaUrl = null) {
  const url = `https://graph.facebook.com/v19.0/${channel.page_id}/messages`;
  let bodyObj = { recipient: { id: recipientId } };
  if (mediaUrl && (type === 'image' || type === 'document')) {
    bodyObj.message = {
      attachment: {
        type: type === 'image' ? 'image' : 'file',
        payload: { url: mediaUrl, is_reusable: true }
      }
    };
  } else {
    bodyObj.message = { text };
    bodyObj.messaging_type = 'RESPONSE';
  }
  let token = channel.access_token || getConfig('page_access_token');
  if (!token) {
    console.error('[sendMessenger] No access token for channel', channel.name || channel.id);
    return { error: { message: 'No access token configured' } };
  }
  token = await resolvePageAccessToken(channel.page_id, token);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(bodyObj)
  });
  return res.json();
}

// ─── Automation Engine ────────────────────────────────────
// Executes active automation rules when an inbound message arrives.

function getBangladeshTime() {
  const now = new Date();
  const bangladesh = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Dhaka' }));
  return bangladesh;
}

function isWithinOfficeHours() {
  const bd = getBangladeshTime();
  const day = bd.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const hour = bd.getHours();
  // Bangladesh office: Sunday-Thursday, 9:00-18:00
  if (day === 5) return false; // Friday (closed)
  if (day === 6) return false; // Saturday (closed)
  if (hour < 9 || hour >= 18) return false;
  return true;
}

function substituteTemplateVars(content, vars) {
  return content.replace(/\{\{(\w+)\}\}/g, (match, key) => vars[key] !== undefined ? vars[key] : match);
}

async function executeAutomationRules({ conversation, message, channel, contact }) {
  if (!conversation || !message) return;

  const rules = db.prepare("SELECT * FROM automation_rules WHERE active=1 ORDER BY priority DESC, id DESC").all();
  if (!rules.length) return;

  const msgText = (message.content || '').toLowerCase();
  const isFirstInbound = db.prepare("SELECT COUNT(*) as n FROM messages WHERE conversation_id=? AND direction='in'").get(conversation.id).n <= 1;
  const hasAgentReply = db.prepare("SELECT COUNT(*) as n FROM messages WHERE conversation_id=? AND direction='out' AND is_internal_note=0").get(conversation.id).n > 0;
  const inOfficeHours = isWithinOfficeHours();
  const lastAgentReply = db.prepare("SELECT created_at FROM messages WHERE conversation_id=? AND direction='out' AND is_internal_note=0 ORDER BY created_at DESC LIMIT 1").get(conversation.id);
  const minutesSinceAgentReply = lastAgentReply ? (Date.now() - new Date(lastAgentReply.created_at).getTime()) / 60000 : Infinity;

  for (const rule of rules) {
    try {
      let triggered = false;
      const cfg = JSON.parse(rule.trigger_config || '{}');

      // ── Trigger evaluation ──
      switch (rule.trigger_type) {
        case 'keyword': {
          const keywords = (cfg.keywords || []).map(k => k.toLowerCase());
          const matchType = cfg.match_type || 'contains';
          if (matchType === 'exact') {
            triggered = keywords.includes(msgText.trim());
          } else {
            triggered = keywords.some(k => msgText.includes(k));
          }
          break;
        }
        case 'new_conversation': {
          triggered = isFirstInbound;
          break;
        }
        case 'no_response': {
          const delayMin = Number(cfg.delay) || 30;
          triggered = hasAgentReply && minutesSinceAgentReply >= delayMin;
          break;
        }
        case 'time_based': {
          // Time-based rules are checked separately via cron, not on message arrival
          triggered = false;
          break;
        }
        case 'lead_status_change': {
          // Handled separately via lead update hook
          triggered = false;
          break;
        }
      }

      if (!triggered) continue;

      // Log trigger
      db.prepare("INSERT INTO automation_analytics (rule_id, event_type, conversation_id, created_at) VALUES (?, 'triggered', ?, datetime('now'))").run(rule.id, conversation.id);

      // ── Action execution ──
      const actCfg = JSON.parse(rule.action_config || '{}');
      let executed = false;

      switch (rule.action_type) {
        case 'reply': {
          if (!actCfg.template_id) break;
          const template = db.prepare("SELECT * FROM message_templates WHERE id=?").get(actCfg.template_id);
          if (!template) { console.error(`[auto] Template ${actCfg.template_id} not found`); break; }

          // Check if we already sent an auto-reply recently (avoid spam)
          const lastAuto = db.prepare("SELECT created_at FROM messages WHERE conversation_id=? AND direction='out' AND sent_by='auto' ORDER BY created_at DESC LIMIT 1").get(conversation.id);
          if (lastAuto) {
            const minsSince = (Date.now() - new Date(lastAuto.created_at).getTime()) / 60000;
            if (minsSince < 5) { console.log(`[auto] Skipping rule ${rule.id} — auto-reply sent ${minsSince.toFixed(0)}m ago`); break; }
          }

          // Build variables
          const lead = conversation.lead_id ? db.prepare("SELECT * FROM leads WHERE id=?").get(conversation.lead_id) : null;
          const vars = {
            name: contact?.name || 'there',
            destination: lead?.destination || 'our university',
            program: lead?.program || 'your program',
            consultant: lead?.assigned_consultant || conversation.assigned_to || 'our team',
            phone: contact?.phone || '',
            email: contact?.email || '',
            channel: channel?.name || 'WhatsApp',
          };
          const replyText = substituteTemplateVars(template.content, vars);

          // Send
          let sent = null;
          if (channel?.type === 'whatsapp' && contact?.phone) {
            sent = await sendWhatsApp(channel, contact.phone, replyText);
          } else if (channel?.type === 'messenger' && contact?.messenger_id) {
            sent = await sendMessenger(channel, contact.messenger_id, replyText);
          }

          if (sent && !sent.error) {
            const waMsgId = sent.messages?.[0]?.id || null;
            db.prepare(`INSERT INTO messages (conversation_id, direction, type, content, wa_message_id, status, sent_by, created_at)
              VALUES (?, 'out', 'text', ?, ?, 'delivered', 'auto', datetime('now'))`).run(conversation.id, replyText, waMsgId);
            db.prepare("UPDATE message_templates SET usage_count = COALESCE(usage_count, 0) + 1 WHERE id=?").run(template.id);
            db.prepare("UPDATE conversations SET last_message=?, last_message_at=datetime('now'), last_message_direction='out' WHERE id=?").run(replyText, conversation.id);
            broadcast('new_message', { conversation_id: conversation.id, message: { content: replyText, direction: 'out', sent_by: 'auto', created_at: new Date().toISOString() } });
            executed = true;
            console.log(`[auto] Rule ${rule.id} → auto-reply sent: "${replyText.slice(0, 60)}..."`);
          } else if (sent?.error) {
            console.error(`[auto] Rule ${rule.id} send failed:`, sent.error.message || sent.error);
          }
          break;
        }

        case 'assign': {
          if (!actCfg.assignee) break;
          const emp = db.prepare("SELECT * FROM employees WHERE id=? OR name=? LIMIT 1").get(actCfg.assignee, actCfg.assignee);
          if (emp) {
            db.prepare("UPDATE conversations SET assigned_to=?, assigned_to_id=? WHERE id=?").run(emp.name, emp.id, conversation.id);
            broadcast('conversation_updated', { id: conversation.id, assigned_to: emp.name, assigned_to_id: emp.id });
            executed = true;
          }
          break;
        }

        case 'add_tag': {
          if (!actCfg.tag) break;
          const tag = db.prepare("SELECT * FROM contact_tags WHERE id=? OR name=? LIMIT 1").get(actCfg.tag, actCfg.tag);
          if (tag && contact) {
            db.prepare("INSERT OR IGNORE INTO contact_tag_assignments (contact_id, tag_id, assigned_by) VALUES (?, ?, 'auto')").run(contact.id, tag.id);
            executed = true;
          }
          break;
        }

        case 'create_lead': {
          if (!contact || conversation.lead_id) break;
          const leadId = nextLeadId();
          const src = channel?.name || channel?.type || 'Auto';
          db.prepare(`INSERT INTO leads (lead_id, client_name, phone, email, lead_source, lead_status, source, notes, date_added)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(leadId, contact.name || 'Unknown', contact.phone || null, contact.email || null, src, 'New Lead', 'Auto', 'Created by automation rule', new Date().toISOString().slice(0,10));
          const lead = db.prepare("SELECT * FROM leads WHERE lead_id=?").get(leadId);
          if (lead) {
            db.prepare("UPDATE conversations SET lead_id=? WHERE id=?").run(lead.id, conversation.id);
            db.prepare("UPDATE contacts SET lead_id=? WHERE id=?").run(lead.id, contact.id);
            broadcast('new_lead', { lead });
            const updatedConv = db.prepare(`${CONV_SELECT} WHERE conversations.id=?`).get(conversation.id);
            if (updatedConv) broadcast('conversation_updated', updatedConv);
            executed = true;
          }
          break;
        }

        case 'send_webhook': {
          if (!actCfg.webhook_url) break;
          try {
            await fetch(actCfg.webhook_url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                event: 'automation_rule_triggered',
                rule_id: rule.id,
                rule_name: rule.name,
                conversation_id: conversation.id,
                contact: { name: contact?.name, phone: contact?.phone },
                message: message.content,
                timestamp: new Date().toISOString()
              })
            });
            executed = true;
          } catch (e) { console.error('[auto] Webhook failed:', e.message); }
          break;
        }
      }

      if (executed) {
        db.prepare("INSERT INTO automation_analytics (rule_id, event_type, conversation_id, created_at) VALUES (?, 'executed', ?, datetime('now'))").run(rule.id, conversation.id);
      }

    } catch (e) {
      console.error(`[auto] Rule ${rule.id} error:`, e.message);
      try {
        db.prepare("INSERT INTO automation_analytics (rule_id, event_type, conversation_id, created_at) VALUES (?, 'failed', ?, datetime('now'))").run(rule.id, conversation.id);
      } catch {}
    }
  }
}

async function sendBroadcast(campaignId) {
  try {
    const campaign = db.prepare("SELECT * FROM broadcast_campaigns WHERE id=?").get(campaignId);
    if (!campaign) return { error: 'Campaign not found' };
    if (campaign.status === 'sending' || campaign.status === 'sent') return { error: 'Already sent or sending' };

    let contacts = [];
    const segmentConfig = campaign.segment_config ? JSON.parse(campaign.segment_config) : {};
    if (campaign.segment_type === 'all' || !campaign.segment_type) {
      contacts = db.prepare("SELECT * FROM contacts WHERE wa_id IS NOT NULL OR messenger_id IS NOT NULL OR instagram_id IS NOT NULL").all();
    } else if (campaign.segment_type === 'tag' || campaign.segment_type === 'by_tag') {
      const tagIds = segmentConfig.tag_ids || [];
      if (tagIds.length) {
        const placeholders = tagIds.map(() => '?').join(',');
        contacts = db.prepare(`SELECT contacts.* FROM contacts JOIN contact_tag_assignments ON contact_tag_assignments.contact_id = contacts.id WHERE contact_tag_assignments.tag_id IN (${placeholders}) GROUP BY contacts.id`).all(...tagIds);
      }
    } else if (campaign.segment_type === 'status' || campaign.segment_type === 'by_status') {
      const statuses = segmentConfig.lead_statuses || [];
      if (statuses.length) {
        const placeholders = statuses.map(() => '?').join(',');
        contacts = db.prepare(`SELECT contacts.* FROM contacts JOIN leads ON leads.id = contacts.lead_id WHERE leads.lead_status IN (${placeholders}) GROUP BY contacts.id`).all(...statuses);
      }
    } else if (campaign.segment_type === 'channel' || campaign.segment_type === 'by_channel') {
      const channelTypes = segmentConfig.channel_types || [];
      if (channelTypes.length) {
        const placeholders = channelTypes.map(() => '?').join(',');
        const isNumeric = channelTypes.every(v => !isNaN(parseInt(v)));
        if (isNumeric) {
          const channelIds = channelTypes.map(v => parseInt(v));
          contacts = db.prepare(`SELECT contacts.* FROM contacts JOIN conversations ON conversations.contact_id = contacts.id WHERE conversations.channel_id IN (${placeholders}) GROUP BY contacts.id`).all(...channelIds);
        } else {
          contacts = db.prepare(`SELECT contacts.* FROM contacts JOIN conversations ON conversations.contact_id = contacts.id WHERE conversations.channel_type IN (${placeholders}) GROUP BY contacts.id`).all(...channelTypes);
        }
      }
    }

    if (!contacts.length) {
      db.prepare("UPDATE broadcast_campaigns SET status='sent' WHERE id=?").run(campaignId);
      return { sent: 0 };
    }

    db.prepare("UPDATE broadcast_campaigns SET status='sending' WHERE id=?").run(campaignId);

    let template = null;
    if (campaign.template_id) {
      template = db.prepare("SELECT * FROM message_templates WHERE id=?").get(campaign.template_id);
    }

    let sent = 0, failed = 0;
    const insertRecipient = db.prepare("INSERT INTO broadcast_recipients (campaign_id, contact_id, status) VALUES (?,?,?)");

    for (const contact of contacts) {
      try {
        const recipientInfo = insertRecipient.run(campaignId, contact.id, 'pending');
        const recipientId = recipientInfo.lastInsertRowid;

        let messageText = campaign.content || '';
        if (template) {
          messageText = substituteTemplateVars(template.content, {
            name: contact.name || '',
            ...segmentConfig.variables
          });
        }

        let channel = null;
        if (contact.wa_id) {
          channel = db.prepare("SELECT * FROM channels WHERE type='whatsapp' AND active=1 LIMIT 1").get();
        } else if (contact.messenger_id) {
          channel = db.prepare("SELECT * FROM channels WHERE type='messenger' AND active=1 LIMIT 1").get();
        } else if (contact.instagram_id) {
          channel = db.prepare("SELECT * FROM channels WHERE type='instagram' AND active=1 LIMIT 1").get();
        }

        if (!channel || !messageText) {
          db.prepare("UPDATE broadcast_recipients SET status='failed', error=? WHERE id=?").run('No channel or message', recipientId);
          failed++;
          continue;
        }

        let apiResult = null;
        if (channel.type === 'whatsapp') {
          apiResult = await sendWhatsApp(channel, contact.wa_id || contact.phone, messageText);
        } else if (channel.type === 'messenger') {
          apiResult = await sendMessenger(channel, contact.messenger_id, messageText);
        } else if (channel.type === 'instagram') {
          apiResult = await sendMessenger({ ...channel, page_id: channel.ig_account_id || channel.page_id }, contact.instagram_id || contact.messenger_id, messageText);
        } else if (channel.type === 'tiktok') {
          apiResult = { error: { message: 'TikTok broadcast not yet supported' } };
        }

        if (apiResult?.error) {
          db.prepare("UPDATE broadcast_recipients SET status='failed', error=?, sent_at=datetime('now') WHERE id=?").run(apiResult.error.message || 'API error', recipientId);
          failed++;
        } else {
          db.prepare("UPDATE broadcast_recipients SET status='sent', sent_at=datetime('now') WHERE id=?").run(recipientId);
          sent++;
        }
      } catch (err) {
        console.error('[broadcast] send error for contact', contact.id, err.message);
        failed++;
      }
    }

    db.prepare("UPDATE broadcast_campaigns SET status='sent', sent_count=?, delivered_count=?, failed_count=? WHERE id=?").run(sent, sent, failed, campaignId);
    if (template) {
      db.prepare("UPDATE message_templates SET usage_count=usage_count+? WHERE id=?").run(sent, template.id);
    }
    return { sent, failed, total: contacts.length };
  } catch (e) {
    console.error('[broadcast] sendBroadcast error:', e.message);
    db.prepare("UPDATE broadcast_campaigns SET status='failed' WHERE id=?").run(campaignId);
    return { error: e.message };
  }
}

// SHA-256 hash helper required by Meta CAPI for all PII fields
const capiHash = (s) => s ? crypto.createHash('sha256').update(s.trim()).digest('hex') : undefined;

async function sendCAPIEvent(eventName, leadData) {
  const pixelId = getConfig('pixel_id');
  const accessToken = getConfig('capi_token') || getConfig('page_access_token');
  if (!accessToken) return { skipped: true, reason: 'no_token' };
  if (!pixelId) return { skipped: true, reason: 'no_pixel_id' };
  const normalizedPhone = leadData.phone ? leadData.phone.replace(/\D/g, '') : null;
  const normalizedEmail = leadData.email ? leadData.email.toLowerCase().trim() : null;
  const userData = {
    ph: normalizedPhone ? [capiHash(normalizedPhone)] : undefined,
    em: normalizedEmail ? [capiHash(normalizedEmail)] : undefined,
    country: ['bd'],
  };
  if (leadData.fbp) userData.fbp = leadData.fbp;
  if (leadData.fbc) userData.fbc = leadData.fbc;
  const payload = {
    data: [{
      event_name: eventName,
      event_time: Math.floor(Date.now() / 1000),
      event_id: `${leadData.lead_id || 'L'}-${eventName}-${Date.now()}`,
      // CTWA leads (WhatsApp click-to-chat ads) must use business_messaging + ctwa_clid for attribution
      action_source: leadData.ctwa_clid ? 'business_messaging' : 'system_generated',
      messaging_channel: leadData.ctwa_clid ? 'whatsapp' : undefined,
      user_data: leadData.ctwa_clid ? { ...userData, ctwa_clid: leadData.ctwa_clid } : userData,
      custom_data: {
        lead_id: leadData.lead_id,
        destination: leadData.destination,
        event_source_url: leadData.event_source_url || undefined,
      },
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

function getWhatsAppChannelForConsultant(consultantName) {
  if (!consultantName) return null;
  const chan = db.prepare("SELECT * FROM channels WHERE type = 'whatsapp' AND LOWER(TRIM(consultant)) = LOWER(TRIM(?)) AND active = 1 LIMIT 1").get(consultantName);
  if (chan) return chan;
  // fallback: any active WhatsApp channel
  return db.prepare("SELECT * FROM channels WHERE type = 'whatsapp' AND active = 1 LIMIT 1").get();
}

// ─────────────────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────────────────
app.get('/api/dashboard', (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const user = req.user;
  const isAdmin = isFullAdmin(user) || isInvestor(user) || userHasAnyRole(user, 'application_manager', 'marketing_manager');
  const isConsultant = canViewOwnLeadsOnly(user);

  // Build WHERE clause for consultant scoping
  let leadWhere = '';
  let leadParams = [];
  if (isConsultant) {
    const meName = user.consultant_name || user.name || '';
    const meClean = meName.split(' ')[0];
    let empId = -1;
    if (user.emp_id) {
      const emp = db.prepare("SELECT id FROM employees WHERE emp_id=?").get(user.emp_id);
      if (emp) empId = emp.id;
    }
    leadWhere = `WHERE (assigned_employee_id = ? OR TRIM(LOWER(assigned_consultant)) = TRIM(LOWER(?)) OR TRIM(LOWER(assigned_consultant)) = TRIM(LOWER(?)) OR TRIM(LOWER(?)) LIKE '%' || TRIM(LOWER(assigned_consultant)) || '%' OR TRIM(LOWER(assigned_consultant)) LIKE '%' || TRIM(LOWER(?)) || '%')`;
    leadParams = [empId, meName, meClean, meName, meClean];
  }

  // China data isolation: exclude China leads from stats for unauthorized users
  const chinaExclusion = !canViewChinaData(user) ? " AND (destination != 'China' AND source != 'China')" : '';
  
  // When leadWhere is empty, we need a base WHERE clause so chinaExclusion (which starts with AND) works
  const baseWhere = leadWhere || 'WHERE 1=1';

  const scalars = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM leads ${baseWhere}${chinaExclusion}) AS total,
      (SELECT COUNT(*) FROM leads ${baseWhere} AND next_followup=?${chinaExclusion}) AS followup_today,
      (SELECT SUM(paid) FROM leads ${baseWhere}${chinaExclusion}) AS total_paid,
      (SELECT COUNT(*) FROM leads ${baseWhere} AND meta_lead_id IS NOT NULL${chinaExclusion}) AS meta_leads,
      (SELECT COUNT(*) FROM leads ${baseWhere} AND date_added=?${chinaExclusion}) AS new_today
  `).get(...leadParams, ...leadParams, today, ...leadParams, ...leadParams, ...leadParams, today);

  const convScalars = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM conversations WHERE status='open') AS open_convs,
      (SELECT SUM(unread_count) FROM conversations) AS unread_msgs
  `).get();

  const pipeline = db.prepare(`SELECT lead_status, COUNT(*) as count FROM leads ${baseWhere}${chinaExclusion} GROUP BY lead_status`).all(...leadParams);
  const recentLeads = db.prepare(`SELECT * FROM leads ${baseWhere}${chinaExclusion} ORDER BY id DESC LIMIT 5`).all(...leadParams);
  const by_source = db.prepare(`SELECT lead_source as k, COUNT(*) as n FROM leads WHERE lead_source IS NOT NULL AND lead_source!='' ${leadWhere ? 'AND ' + leadWhere.replace(/^WHERE /, '') : ''}${chinaExclusion} GROUP BY lead_source ORDER BY n DESC LIMIT 6`).all(...leadParams);
  const by_dest = db.prepare(`SELECT destination as k, COUNT(*) as n FROM leads WHERE destination IS NOT NULL AND destination!='' ${leadWhere ? 'AND ' + leadWhere.replace(/^WHERE /, '') : ''}${chinaExclusion} GROUP BY destination ORDER BY n DESC LIMIT 8`).all(...leadParams);

  res.json({
    pipeline,
    total: scalars.total,
    followupToday: scalars.followup_today,
    recentLeads,
    totalPaid: scalars.total_paid || 0,
    metaLeads: scalars.meta_leads,
    openConvs: convScalars.open_convs,
    unreadMsgs: convScalars.unread_msgs || 0,
    newToday: scalars.new_today,
    by_source,
    by_dest,
  });
});

// ─────────────────────────────────────────────────────────
// LEADS
// ─────────────────────────────────────────────────────────
// Ad Performance: which FB page / ad is generating the most leads (admin/CEO only)
app.get('/api/leads/source-stats', (req, res) => {
  const u = req.user;
  const isAdminOrCEO = u?.role === 'admin' ||
    (Array.isArray(u?.roles) && (u.roles.includes('founder_ceo') || u.roles.includes('managing_director')));
  if (!isAdminOrCEO) return res.status(403).json({ error: 'Forbidden' });

  const { days = 30, source, page_name, ad_name, type = 'paid' } = req.query;
  const since = new Date(Date.now() - parseInt(days) * 86400000).toISOString().slice(0, 10);

  let extraWhere = '';
  if (type === 'paid') {
    extraWhere = " AND ((ad_name IS NOT NULL AND ad_name != '') OR (meta_ad_id IS NOT NULL AND meta_ad_id != ''))";
  } else if (type === 'organic') {
    extraWhere = " AND (ad_name IS NULL OR ad_name = '') AND (meta_ad_id IS NULL OR meta_ad_id = '')";
  }
  const params = [since];

  if (source) {
    extraWhere += ' AND lead_source = ?';
    params.push(source);
  }
  if (page_name) {
    extraWhere += ' AND page_name = ?';
    params.push(page_name);
  }
  if (ad_name) {
    extraWhere += ' AND ad_name = ?';
    params.push(ad_name);
  }

  // Per-page breakdown
  const byPage = db.prepare(`
    SELECT
      page_name,
      channel_id,
      COUNT(*) as total_leads,
      SUM(CASE WHEN lead_status = 'File Opened' THEN 1 ELSE 0 END) as file_opened,
      SUM(CASE WHEN lead_status = 'Office Visited' THEN 1 ELSE 0 END) as office_visited,
      SUM(CASE WHEN lead_status = 'Positive' THEN 1 ELSE 0 END) as positive,
      SUM(CASE WHEN lead_status NOT IN ('Not Interested') THEN 1 ELSE 0 END) as active
    FROM leads
    WHERE page_name IS NOT NULL
      AND date_added >= ? ${extraWhere}
    GROUP BY page_name
    ORDER BY total_leads DESC
  `).all(...params);

  // Per-ad breakdown
  const leadsAds = db.prepare(`
    SELECT
      ad_name,
      meta_ad_id,
      page_name,
      meta_campaign,
      meta_adset_name,
      COUNT(id) as total_leads,
      SUM(CASE WHEN lead_status = 'File Opened' THEN 1 ELSE 0 END) as file_opened,
      SUM(CASE WHEN lead_status = 'Office Visited' THEN 1 ELSE 0 END) as office_visited,
      SUM(CASE WHEN lead_status = 'Positive' THEN 1 ELSE 0 END) as positive,
      SUM(CASE WHEN lead_status NOT IN ('Not Interested') THEN 1 ELSE 0 END) as active
    FROM leads
    WHERE ((ad_name IS NOT NULL AND ad_name != '') OR (meta_ad_id IS NOT NULL AND meta_ad_id != ''))
      AND date_added >= ? ${extraWhere}
    GROUP BY ad_name, meta_ad_id, page_name, meta_campaign, meta_adset_name
  `).all(...params);

  const cacheAds = db.prepare(`
    SELECT 
      ad_id as meta_ad_id,
      ad_name,
      campaign_name as meta_campaign,
      adset_name as meta_adset_name,
      SUM(spend) as spend,
      SUM(impressions) as impressions,
      SUM(clicks) as clicks
    FROM ad_performance_cache
    WHERE date >= ?
    GROUP BY ad_id, ad_name, campaign_name, adset_name
  `).all(since);

  const adMap = new Map();
  for (const row of leadsAds) {
    const key = row.meta_ad_id || row.ad_name; 
    adMap.set(key, { ...row, spend: 0, impressions: 0, clicks: 0 });
  }

  for (const row of cacheAds) {
    let match = adMap.get(row.meta_ad_id) || adMap.get(row.ad_name);
    if (match) {
      match.spend = row.spend;
      match.impressions = row.impressions;
      match.clicks = row.clicks;
      if (!match.meta_campaign) match.meta_campaign = row.meta_campaign;
      if (!match.meta_adset_name) match.meta_adset_name = row.meta_adset_name;
    } else {
      if (req.query.page_name) continue; 
      if (req.query.source && req.query.source !== 'meta') continue;
      if (req.query.ad_name && req.query.ad_name !== row.ad_name) continue;
      if (req.query.type === 'organic') continue;
      
      adMap.set(row.meta_ad_id || row.ad_name, {
        ad_name: row.ad_name,
        meta_ad_id: row.meta_ad_id,
        page_name: null,
        meta_campaign: row.meta_campaign,
        meta_adset_name: row.meta_adset_name,
        total_leads: 0,
        file_opened: 0,
        office_visited: 0,
        positive: 0,
        active: 0,
        spend: row.spend,
        impressions: row.impressions,
        clicks: row.clicks
      });
    }
  }

  let byAd = Array.from(adMap.values());
  byAd.sort((a, b) => {
    if (b.total_leads !== a.total_leads) return b.total_leads - a.total_leads;
    return (b.spend || 0) - (a.spend || 0);
  });
  byAd = byAd.slice(0, 50);

  // Per-source breakdown
  const bySource = db.prepare(`
    SELECT
      lead_source as source,
      COUNT(*) as total_leads,
      SUM(CASE WHEN lead_status = 'File Opened' THEN 1 ELSE 0 END) as file_opened,
      SUM(CASE WHEN lead_status = 'Office Visited' THEN 1 ELSE 0 END) as office_visited,
      SUM(CASE WHEN lead_status = 'Positive' THEN 1 ELSE 0 END) as positive,
      SUM(CASE WHEN lead_status NOT IN ('Not Interested') THEN 1 ELSE 0 END) as active
    FROM leads
    WHERE lead_source IS NOT NULL
      AND date_added >= ? ${extraWhere}
    GROUP BY lead_source
    ORDER BY total_leads DESC
  `).all(...params);

  // Totals
  const totals = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN lead_status = 'File Opened' THEN 1 ELSE 0 END) as file_opened
    FROM leads
    WHERE date_added >= ? ${extraWhere}
  `).get(...params);

  // Daily breakdown
  const dailyLeads = db.prepare(`
    SELECT
      date_added as date,
      COUNT(id) as total_leads
    FROM leads
    WHERE ((ad_name IS NOT NULL AND ad_name != '') OR (meta_ad_id IS NOT NULL AND meta_ad_id != ''))
      AND date_added >= ? ${extraWhere}
    GROUP BY date_added
  `).all(...params);

  let spendQuery = `SELECT date, SUM(spend) as spend FROM ad_performance_cache WHERE date >= ?`;
  const spendParams = [since];
  if (req.query.ad_name) {
    spendQuery += ` AND ad_name = ?`;
    spendParams.push(req.query.ad_name);
  }
  spendQuery += ` GROUP BY date`;
  const dailySpend = db.prepare(spendQuery).all(...spendParams);

  const dailyMap = new Map();
  for (const r of dailyLeads) {
    dailyMap.set(r.date, { date: r.date, total_leads: r.total_leads, total_spend: 0 });
  }
  for (const r of dailySpend) {
    let match = dailyMap.get(r.date);
    if (match) {
      match.total_spend = r.spend;
    } else {
      if (req.query.page_name) continue; 
      if (req.query.source && req.query.source !== 'meta') continue;
      dailyMap.set(r.date, { date: r.date, total_leads: 0, total_spend: r.spend });
    }
  }
  
  let daily = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  res.json({ bySource, byPage, byAd, daily, totals, days: parseInt(days), since });
});

app.get('/api/leads', (req, res) => {
  const { search, status, consultant, destination, source, lead_market, lead_type, intake, page_name, follow_up, page = 1, limit = 50 } = req.query;
  const where = []; const params = {};
  if (lead_market) { where.push("l.lead_market=@lead_market"); params.lead_market = lead_market; }
  if (lead_type) { where.push("l.lead_type=@lead_type"); params.lead_type = lead_type; }
  if (search && search !== 'undefined' && search !== 'null') { where.push("(l.client_name LIKE @search OR l.phone LIKE @search OR l.lead_id LIKE @search OR l.email LIKE @search)"); params.search = `%${search}%`; }
  if (status)      { where.push("l.lead_status=@status");           params.status = status; }
  if (consultant)  { where.push("l.assigned_consultant=@consultant");params.consultant = consultant; }
  if (destination) { where.push("l.destination=@destination");      params.destination = destination; }
  if (intake)      { where.push("l.intake_term=@intake");           params.intake = intake; }
  if (page_name)   { where.push("l.page_name=@page_name");          params.page_name = page_name; }
  if (source) {
    if (source === 'meta') {
      where.push("l.meta_lead_id IS NOT NULL");
    } else {
      where.push("l.lead_source=@source");
      params.source = source;
    }
  }
  if (follow_up) {
    const tzDate = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Dhaka"}));
    const todayStr = `${tzDate.getFullYear()}-${String(tzDate.getMonth()+1).padStart(2,'0')}-${String(tzDate.getDate()).padStart(2,'0')}`;
    
    if (follow_up === 'Today') {
      where.push("l.next_followup LIKE @today");
      params.today = `${todayStr}%`;
    } else if (follow_up === 'Overdue') {
      where.push("l.next_followup < @today AND l.next_followup IS NOT NULL AND l.next_followup != ''");
      params.today = todayStr;
    } else if (follow_up === 'Upcoming') {
      where.push("l.next_followup > @today AND l.next_followup IS NOT NULL AND l.next_followup != ''");
      params.today = todayStr;
    }
  }

  // Consultants are scoped to their own assigned leads — enforced server-side.
  // Admins, Managing Directors, Investors, and Application Managers see everything.
  if (canViewOwnLeadsOnly(req.user)) {
    const meName = req.user.consultant_name || req.user.name || '';
    const meClean = meName.split(' ')[0];
    where.push("(TRIM(LOWER(l.assigned_consultant)) = TRIM(LOWER(@me)) OR TRIM(LOWER(l.assigned_consultant)) = TRIM(LOWER(@meClean)) OR TRIM(LOWER(@me)) LIKE '%' || TRIM(LOWER(l.assigned_consultant)) || '%' OR TRIM(LOWER(l.assigned_consultant)) LIKE '%' || TRIM(LOWER(@meClean)) || '%')");
    params.me = meName;
    params.meClean = meClean;
  }
  // Agency isolation: Agents can ONLY see their own agency's leads
  if (isAgent(req.user)) {
    where.push("l.agency_id=@agency_id");
    params.agency_id = req.user.agency_id;
  }
  // China data isolation: exclude China leads for unauthorized users unless they own/are assigned to them
  if (!canViewChinaData(req.user) && !canViewOwnLeadsOnly(req.user)) {
    where.push("(l.destination != 'China' AND l.lead_market != 'China')");
  }
  const ws = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const total  = db.prepare(`SELECT COUNT(*) as c FROM leads l ${ws}`).get(params).c;
  const leads  = db.prepare(`SELECT l.*, e.name as employee_name, e.emp_id as employee_emp_id, e.role as employee_role FROM leads l LEFT JOIN employees e ON l.assigned_employee_id = e.id ${ws} ORDER BY l.id DESC LIMIT ${limit} OFFSET ${offset}`).all(params);
  
  // Compute global stats based on the current filters
  const consultations = db.prepare(`SELECT COUNT(*) as c FROM leads l ${ws ? ws + " AND" : "WHERE"} l.lead_status='Office Visited'`).get(params).c;
  const activeFiles = db.prepare(`SELECT COUNT(*) as c FROM leads l ${ws ? ws + " AND" : "WHERE"} (l.lead_status='File Opened' OR l.lead_status='Enrolled')`).get(params).c;
  const tzDate = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Dhaka"}));
  const todayStrForStats = `${tzDate.getFullYear()}-${String(tzDate.getMonth()+1).padStart(2,'0')}-${String(tzDate.getDate()).padStart(2,'0')}`;
  const dueToday = db.prepare(`SELECT COUNT(*) as c FROM leads l ${ws ? ws + " AND" : "WHERE"} l.next_followup LIKE @todayForStats`).get({...params, todayForStats: `${todayStrForStats}%`}).c;
  
  res.json({ 
    leads, 
    total, 
    page: parseInt(page), 
    pages: Math.ceil(total / parseInt(limit)),
    stats: { totalInquiries: total, consultations, activeFiles, dueToday }
  });
});
app.get('/api/leads/:id', (req, res) => {
  const lead = db.prepare(`SELECT l.*, e.name as employee_name, e.emp_id as employee_emp_id, e.role as employee_role FROM leads l LEFT JOIN employees e ON l.assigned_employee_id = e.id WHERE l.id=? OR l.lead_id=?`).get(req.params.id, req.params.id);
  if (!lead) return res.status(404).json({ error: 'Not found' });
  // China data isolation: block unauthorized access to China leads
  if (isChinaBlockedForUser(lead, req.user)) {
    return res.status(403).json({ error: 'Access denied to China lead records' });
  }
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
  let assigned_employee_id = d.assigned_employee_id ? Number(d.assigned_employee_id) : null;
  let assigned_consultant = txt(d.assigned_consultant);
  // If employee_id is provided but consultant name is not, resolve from employees table
  if (assigned_employee_id && !assigned_consultant) {
    try {
      const emp = db.prepare("SELECT name FROM employees WHERE id=?").get(assigned_employee_id);
      if (emp?.name) assigned_consultant = emp.name;
    } catch {}
  }
  let phone = d.phone ? String(d.phone).trim() : null;
  if (phone) {
    const digits = phone.replace(/[^\d]/g, '');
    if (digits.startsWith('01') && digits.length === 11) {
      phone = '+88' + digits;
    } else if (digits.startsWith('8801') && digits.length === 13) {
      phone = '+' + digits;
    }
  }

  return {
    lead_id, balance,
    date_added: d.date_added || new Date().toISOString().slice(0,10),
    client_name: d.client_name,
    phone: phone, email: d.email,
    destination: txt(d.destination),
    last_education: txt(d.last_education),
    gpa: d.gpa === '' || d.gpa == null ? null : Number(d.gpa),
    english_score: txt(d.english_score),
    program: txt(d.program || d.major),
    lead_source: d.lead_source || 'Manual',
    lead_status: d.lead_status || 'New Lead',
    assigned_employee_id,
    assigned_consultant,
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
    // Academic additions
    passing_year: txt(d.passing_year), last_education_major: txt(d.last_education_major),
    english_test_type: txt(d.english_test_type),
    // Medical
    blood_group: txt(d.blood_group), date_of_birth: txt(d.date_of_birth),
    medical_notes: txt(d.medical_notes), emergency_contact: txt(d.emergency_contact),
    height: txt(d.height), weight: txt(d.weight),
    payment_agreement: txt(d.payment_agreement),
    hardcopy_status: txt(d.hardcopy_status),
    hardcopy_documents: txt(d.hardcopy_documents),
    age: num(d.age),
    // Active application stage
    application_stage: txt(d.application_stage),
    // Market & Agent Portal
    lead_market: txt(d.lead_market) || 'Bangladesh',
    agency_id: d.agency_id ? Number(d.agency_id) : null,
    lead_type: txt(d.lead_type) || 'B2C',
    // Ad Attribution
    ad_name: txt(d.ad_name),
    page_name: txt(d.page_name),
    channel_id: d.channel_id ? Number(d.channel_id) : null,
  };
}

const LEAD_INSERT_SQL = `INSERT INTO leads (
  lead_id, date_added, client_name, phone, email, destination, last_education, gpa,
  english_score, program, lead_source, lead_status, assigned_consultant, assigned_employee_id,
  service_fee, paid, balance, payment_status, next_followup, notes,
  meta_lead_id, meta_form_id, meta_ad_id, meta_campaign,
  source, referrer, nationality, passport, degree, major, intake_term, university,
  drive_link, deposit, blood_group, date_of_birth, medical_notes, emergency_contact,
  application_stage, passing_year, last_education_major, height, weight, english_test_type,
  payment_agreement, hardcopy_status, hardcopy_documents, age, agency_id, lead_type, lead_market,
  ad_name, page_name, channel_id
) VALUES (
  @lead_id, @date_added, @client_name, @phone, @email, @destination, @last_education, @gpa,
  @english_score, @program, @lead_source, @lead_status, @assigned_consultant, @assigned_employee_id,
  @service_fee, @paid, @balance, @payment_status, @next_followup, @notes,
  @meta_lead_id, @meta_form_id, @meta_ad_id, @meta_campaign,
  @source, @referrer, @nationality, @passport, @degree, @major, @intake_term, @university,
  @drive_link, @deposit, @blood_group, @date_of_birth, @medical_notes, @emergency_contact,
  @application_stage, @passing_year, @last_education_major, @height, @weight, @english_test_type,
  @payment_agreement, @hardcopy_status, @hardcopy_documents, @age, @agency_id, @lead_type, @lead_market,
  @ad_name, @page_name, @channel_id
)`;
const LEAD_UPDATE_SQL = `UPDATE leads SET
  client_name=@client_name, phone=@phone, email=@email, destination=@destination,
  last_education=@last_education, gpa=@gpa, english_score=@english_score, program=@program,
  lead_source=@lead_source, lead_status=@lead_status, assigned_consultant=@assigned_consultant, assigned_employee_id=@assigned_employee_id,
  service_fee=@service_fee, paid=@paid, balance=@balance, payment_status=@payment_status,
  next_followup=@next_followup, notes=@notes,
  source=@source, referrer=@referrer, nationality=@nationality, passport=@passport,
  degree=@degree, major=@major, intake_term=@intake_term, university=@university,
  drive_link=@drive_link, deposit=@deposit,
  blood_group=@blood_group, date_of_birth=@date_of_birth, medical_notes=@medical_notes,
  emergency_contact=@emergency_contact,
  application_stage=@application_stage, passing_year=@passing_year,
  last_education_major=@last_education_major, height=@height, weight=@weight,
  english_test_type=@english_test_type, payment_agreement=@payment_agreement,
  hardcopy_status=@hardcopy_status, hardcopy_documents=@hardcopy_documents,
  age=@age, agency_id=@agency_id, lead_type=@lead_type, lead_market=@lead_market,
  meta_lead_id=@meta_lead_id, meta_form_id=@meta_form_id, meta_ad_id=@meta_ad_id, meta_campaign=@meta_campaign,
  ad_name=@ad_name, page_name=@page_name, channel_id=@channel_id
WHERE id=@id`;

app.post('/api/leads', async (req, res) => {
  const d = req.body;
  // Backward compat for old source field
  if (d.source === 'China') d.lead_market = 'China';
  if (d.source === 'B2B' || d.source === 'Agent') d.lead_type = 'B2B';
  if (d.source === 'In-House') d.lead_type = 'B2C';
  if (!d.lead_market) d.lead_market = 'Bangladesh';
  const isChinaApp = d.isChinaApp || d.lead_market === 'China' || d.source === 'China' || (d.lead_id && String(d.lead_id).startsWith('C-'));
  // RBAC: Only full admins and Application Managers can create China applications
  if (isChinaApp && !isFullAdmin(req.user) && !userHasRole(req.user, 'application_manager')) {
    return res.status(403).json({ error: 'Only Application Managers and Administrators can create China applications.' });
  }
  // Chat inbox leads must go to Bangladesh
  const fromChat = d.lead_source === 'WhatsApp' || d.lead_source === 'Messenger' || d.lead_source === 'Instagram' || d.lead_source === 'TikTok';
  if (fromChat && d.destination !== 'Bangladesh') {
    d.destination = 'Bangladesh';
    d.source = d.source || 'In-House';
  }
  const lead_id = d.lead_id || (isChinaApp ? nextChinaLeadId() : nextLeadId());
  const balance = (parseFloat(d.service_fee)||0) - (parseFloat(d.paid)||0);
  if (isAgent(req.user)) {
    d.agency_id = req.user.agency_id;
    d.lead_type = 'B2B';
    d.lead_source = 'Partner Agency';
  } else {
    d.lead_type = d.lead_type || 'B2C';
  }
  const params = leadParams(d, lead_id, balance);
  const info = db.prepare(LEAD_INSERT_SQL).run(params);
  const lead = db.prepare("SELECT * FROM leads WHERE id=?").get(info.lastInsertRowid);
  sendCAPIEvent('Lead', lead).catch(() => {});
  logActivity({ type: 'lead_created', actor: req.user, lead, details: { source: lead.lead_source, destination: lead.destination, assigned_consultant: lead.assigned_consultant } });
  if (lead.assigned_consultant)
    logActivity({ type: 'lead_assigned', actor: req.user, lead, to: lead.assigned_consultant });
  res.json(lead);
});

app.put('/api/leads/:id', async (req, res) => {
  try {
    const oldLead = db.prepare("SELECT * FROM leads WHERE id=? OR lead_id=?").get(req.params.id, req.params.id);
    if (!oldLead) return res.status(404).json({ error: 'Not found' });
    // China data isolation: block unauthorized access to China leads
    if (isChinaBlockedForUser(oldLead, req.user)) {
      return res.status(403).json({ error: 'Access denied to China lead records' });
    }
    if (!leadIsVisibleTo(oldLead, req.user)) {
      return res.status(403).json({ error: 'Access denied to this lead record' });
    }

    // Merge existing lead data with new updates to prevent wiping out data
    // on partial updates (e.g. from the Scan Chat button)
    const d = { ...oldLead, ...req.body };

    // Backward compat for old source field
    if (d.source === 'China') d.lead_market = 'China';
    if (d.source === 'B2B' || d.source === 'Agent') d.lead_type = 'B2B';
    if (d.source === 'In-House') d.lead_type = 'B2C';
    if (!d.lead_market) d.lead_market = 'Bangladesh';

    const balance = (parseFloat(d.service_fee)||0) - (parseFloat(d.paid)||0);
    const params = leadParams(d, oldLead.lead_id, balance);
    delete params.lead_id;
    delete params.date_added;
    db.prepare(LEAD_UPDATE_SQL).run({ ...params, id: oldLead.id });
    let lead = db.prepare("SELECT * FROM leads WHERE id=?").get(oldLead.id);

    // Audit the changes that matter to an owner.
    let autoUpdates = [];
    if (oldLead?.lead_status !== lead.lead_status) {
      logActivity({ type: 'lead_status_changed', actor: req.user, lead, from: oldLead?.lead_status, to: lead.lead_status });
      const evtMap = { 'Enrolled':'Purchase','File Opened':'InitiateCheckout','Office Visited':'Schedule','Positive':'Lead' };
      if (evtMap[lead.lead_status]) sendCAPIEvent(evtMap[lead.lead_status], lead).catch(() => {});

      // Auto-move to applications when status becomes 'File Opened'
      if (lead.lead_status === 'File Opened') {
        let newStage = lead.application_stage || 'documents';
        if (!lead.application_stage) {
          autoUpdates.push("application_stage = 'documents'");
        }
        let newSource = lead.source;
        let newDestination = lead.destination;
        if (lead.destination === 'China') {
          newSource = 'China';
          if (lead.source !== 'China') autoUpdates.push("source = 'China'");
        } else if (lead.destination === 'Bangladesh') {
          if (lead.source === 'B2B') {
            newSource = 'B2B';
          } else {
            newSource = 'In-House';
            if (lead.source !== 'In-House') autoUpdates.push("source = 'In-House'");
          }
        }
        if (autoUpdates.length) {
          db.prepare(`UPDATE leads SET ${autoUpdates.join(', ')} WHERE id=?`).run(req.params.id);
        }
        logActivity({ type: 'application_stage_changed', actor: req.user, lead, details: { stage: newStage, source: newSource, destination: newDestination } });
      }
    }
    if (autoUpdates.length) {
      lead = db.prepare("SELECT * FROM leads WHERE id=?").get(req.params.id);
    }
    if ((oldLead?.assigned_consultant || '') !== (lead.assigned_consultant || '')) {
      logActivity({ type: 'lead_assigned', actor: req.user, lead, from: oldLead?.assigned_consultant, to: lead.assigned_consultant });
    }
    if ((parseFloat(oldLead?.paid) || 0) !== (parseFloat(lead.paid) || 0)) {
      const delta = (parseFloat(lead.paid) || 0) - (parseFloat(oldLead?.paid) || 0);
      if (delta !== 0) logActivity({ type: 'lead_payment', actor: req.user, lead, amount: delta, from: oldLead.paid, to: lead.paid });
    }
    res.json(lead);
  } catch (err) {
    console.error("Error updating lead:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/leads/bulk-assign', (req, res) => requireManagerOrAdmin(req, res, () => {
  try {
    const { ids, consultant } = req.body || {};
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids array required' });
    if (!consultant || typeof consultant !== 'string') return res.status(400).json({ error: 'consultant name required' });
    const updated = [];
    for (const id of ids) {
      const lead = db.prepare("SELECT * FROM leads WHERE id=?").get(id);
      if (!lead) continue;
      if (!leadIsVisibleTo(lead, req.user)) continue;
      if (isChinaBlockedForUser(lead, req.user)) continue;
      db.prepare("UPDATE leads SET assigned_consultant=? WHERE id=?").run(consultant, id);
      const updatedLead = db.prepare("SELECT * FROM leads WHERE id=?").get(id);
      updated.push(updatedLead);
      logActivity({ type: 'lead_assigned', actor: req.user, lead: updatedLead, from: lead.assigned_consultant, to: consultant });
    }
    res.json({ ok: true, updated: updated.length, leads: updated });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}));

app.get('/api/leads/duplicates', (req, res) => requireManagerOrAdmin(req, res, () => {
  try {
    const query = `
      SELECT * FROM leads 
      WHERE phone IN (
        SELECT phone FROM leads WHERE phone IS NOT NULL AND phone != '' GROUP BY phone HAVING count(*) > 1
      )
      OR email IN (
        SELECT email FROM leads WHERE email IS NOT NULL AND email != '' GROUP BY email HAVING count(*) > 1
      )
      ORDER BY phone, email, id ASC
    `;
    const dupes = db.prepare(query).all();
    const groups = {};
    for (const lead of dupes) {
      const key = lead.phone || lead.email;
      if (!groups[key]) groups[key] = [];
      groups[key].push(lead);
    }
    res.json({ ok: true, groups: Object.values(groups) });
  } catch (e) { res.status(500).json({ error: e.message }); }
}));

app.post('/api/leads/merge', (req, res) => requireManagerOrAdmin(req, res, () => {
  const { primary_id, secondary_ids } = req.body;
  if (!primary_id || !secondary_ids || !secondary_ids.length) return res.status(400).json({ error: 'Missing primary or secondary IDs' });
  
  try {
    db.transaction(() => {
      const qs = secondary_ids.map(() => '?').join(',');
      db.prepare(`UPDATE activity_log SET lead_id=? WHERE lead_id IN (${qs})`).run(primary_id, ...secondary_ids);
      db.prepare(`UPDATE lead_documents SET lead_id=? WHERE lead_id IN (${qs})`).run(primary_id, ...secondary_ids);
      db.prepare(`UPDATE lead_university_applications SET lead_id=? WHERE lead_id IN (${qs})`).run(primary_id, ...secondary_ids);
      db.prepare(`UPDATE conversations SET lead_id=? WHERE lead_id IN (${qs})`).run(primary_id, ...secondary_ids);
      db.prepare(`UPDATE contacts SET lead_id=? WHERE lead_id IN (${qs})`).run(primary_id, ...secondary_ids);
      
      db.prepare(`DELETE FROM leads WHERE id IN (${qs})`).run(...secondary_ids);
      
      const primaryLead = db.prepare('SELECT * FROM leads WHERE id=?').get(primary_id);
      if (primaryLead) {
        logActivity({ type: 'lead_merged', actor: req.user, lead: primaryLead, details: { merged_ids: secondary_ids } });
      }
    })();
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
}));

app.post('/api/leads/bulk-status', (req, res) => requireManagerOrAdmin(req, res, () => {
  const { ids, status } = req.body;
  if (!ids || !ids.length || !status) return res.status(400).json({ error: 'Missing ids or status' });
  
  try {
    const updated = [];
    db.transaction(() => {
      for (const id of ids) {
        const oldLead = db.prepare("SELECT * FROM leads WHERE id=?").get(id);
        if (oldLead && oldLead.lead_status !== status) {
          db.prepare("UPDATE leads SET lead_status=? WHERE id=?").run(status, id);
          const newLead = db.prepare("SELECT * FROM leads WHERE id=?").get(id);
          logActivity({ type: 'lead_status_changed', actor: req.user, lead: newLead, from: oldLead.lead_status, to: status });
          updated.push(newLead);
        }
      }
    })();
    res.json({ ok: true, updated: updated.length, leads: updated });
  } catch (e) { res.status(500).json({ error: e.message }); }
}));

app.post('/api/leads/auto-cleanup', (req, res) => requireManagerOrAdmin(req, res, () => {
  try {
    const staleLeads = db.prepare("SELECT * FROM leads WHERE lead_status='New Lead' AND date_added <= date('now', '-3 days')").all();
    const updated = [];
    db.transaction(() => {
      for (const lead of staleLeads) {
        db.prepare("UPDATE leads SET lead_status='Follow-up' WHERE id=?").run(lead.id);
        const newLead = db.prepare("SELECT * FROM leads WHERE id=?").get(lead.id);
        logActivity({ type: 'lead_status_changed', actor: { name: 'Auto-Cleanup Bot' }, lead: newLead, from: 'New Lead', to: 'Follow-up' });
        updated.push(newLead);
      }
    })();
    res.json({ ok: true, cleaned: updated.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
}));

app.delete('/api/leads/:id', (req, res) => {
  const lead = db.prepare("SELECT * FROM leads WHERE id=?").get(req.params.id);
  if (!lead) return res.status(404).json({ error: 'Not found' });
  // China data isolation: block unauthorized access to China leads
  if (isChinaBlockedForUser(lead, req.user)) {
    return res.status(403).json({ error: 'Access denied to China lead records' });
  }
  if (!leadIsVisibleTo(lead, req.user)) {
    return res.status(403).json({ error: 'Access denied to this lead record' });
  }
  db.prepare("UPDATE contacts SET lead_id=NULL WHERE lead_id=?").run(req.params.id);
  db.prepare("UPDATE conversations SET lead_id=NULL WHERE lead_id=?").run(req.params.id);
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
  // China data isolation: block unauthorized access to China leads
  if (isChinaBlockedForUser(lead, req.user)) {
    return res.status(403).json({ error: 'Access denied to China lead records' });
  }
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
  // China data isolation: block unauthorized access to China leads
  if (isChinaBlockedForUser(lead, req.user)) {
    return res.status(403).json({ error: 'Access denied to China lead records' });
  }
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

app.post('/api/broadcasts', (req, res) => requireAdmin(req, res, () => {
  const { message, color = 'amber', pinned = 1, expires_at = null } = req.body || {};
  if (!message?.trim()) return res.status(400).json({ error: 'message is required' });
  const info = db.prepare(`INSERT INTO broadcasts (message, author_id, author_name, color, pinned, expires_at)
    VALUES (?,?,?,?,?,?)`).run(message.trim(), req.user.id, req.user.name || req.user.email, color, pinned ? 1 : 0, expires_at);
  broadcast('broadcast_new', { broadcast: db.prepare("SELECT * FROM broadcasts WHERE id=?").get(info.lastInsertRowid) });
  logActivity({ type: 'broadcast_posted', actor: req.user, details: message.trim().slice(0, 200) });
  res.json(db.prepare("SELECT * FROM broadcasts WHERE id=?").get(info.lastInsertRowid));
}));

app.delete('/api/broadcasts/:id', (req, res) => requireAdmin(req, res, () => {
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

app.post('/api/import/cashflow', (req, res) => requireAdmin(req, res, () => {
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
  if (rows.length === 0) return res.status(400).json({ error: 'No rows to import' });
  if (rows.length > 5000) return res.status(400).json({ error: 'Too many rows in one batch (max 5000)' });
  try { res.json(importCashflowRows(rows, req.user)); }
  catch (e) { res.status(500).json({ error: e.message }); }
}));

app.post('/api/import/applications', (req, res) => requireAdmin(req, res, () => {
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
  if (rows.length === 0) return res.status(400).json({ error: 'No rows to import' });
  if (rows.length > 5000) return res.status(400).json({ error: 'Too many rows in one batch (max 5000)' });
  try { res.json(importApplicationRows(rows, req.user)); }
  catch (e) { res.status(500).json({ error: e.message }); }
}));

app.get('/api/debug/db', (req, res) => requireAdmin(req, res, () => {
  try {
    const channels = db.prepare("SELECT id, type, name, page_id, active, status FROM channels").all();
    const recentConvs = db.prepare(`
      SELECT conversations.*, contacts.name as contact_name, contacts.messenger_id
      FROM conversations 
      LEFT JOIN contacts ON contacts.id = conversations.contact_id 
      ORDER BY conversations.id DESC LIMIT 15
    `).all();
    const recentMessages = db.prepare(`
      SELECT messages.*, conversations.channel_id 
      FROM messages 
      LEFT JOIN conversations ON conversations.id = messages.conversation_id 
      ORDER BY messages.id DESC LIMIT 30
    `).all();
    res.json({ channels, recentConvs, recentMessages });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}));

// ─── ADMIN: wipe all leads (+ documents, uni-apps, activity log, KPI targets) ───
// Optional body: { conversations: true } → also wipes chat threads, messages & contacts.
// Finance (income/expenses), employees, attendance, payroll, users & settings are NEVER touched.
app.delete('/api/admin/wipe-leads', (req, res) => requireAdmin(req, res, () => {
  try {
    const wipeConversations = !!(req.body && req.body.conversations);
    const count = db.prepare("SELECT COUNT(*) as c FROM leads").get().c;

    const wipe = db.transaction(() => {
      db.prepare("DELETE FROM leads").run();                 // cascades documents + uni-apps
      db.prepare("DELETE FROM activity_log").run();          // stale KPI / performance history
      db.prepare("DELETE FROM kpi_targets").run();           // old monthly targets
      const seqTables = ['leads','lead_documents','lead_university_applications','activity_log','kpi_targets'];
      if (wipeConversations) {
        db.prepare("DELETE FROM messages").run();
        db.prepare("DELETE FROM conversations").run();
        db.prepare("DELETE FROM contacts").run();
        seqTables.push('messages','conversations','contacts');
      }
      // Reset auto-increment so IDs start fresh
      db.prepare(`DELETE FROM sqlite_sequence WHERE name IN (${seqTables.map(() => '?').join(',')})`).run(...seqTables);
    });
    wipe();

    res.json({ ok: true, deleted: count, conversationsWiped: wipeConversations });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}));

// ─── SYSTEM HEALTH & BACKUP ───────────────────────────────────────────
app.get('/api/health/db-size', (req, res) => {
  try {
    const stats = db.prepare("SELECT page_count * page_size as bytes FROM pragma_page_count(), pragma_page_size()").get();
    res.json({ bytes: stats?.bytes || 0, tables: db.prepare("SELECT count(*) as c FROM sqlite_master WHERE type='table'").get().c });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/health/backup', (req, res) => requireAdmin(req, res, () => {
  try {
    db.flush();
    const data = db.export();
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="crm_backup_${new Date().toISOString().slice(0,10)}.db"`);
    res.send(Buffer.from(data));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}));

app.post('/api/health/restore', express.raw({ type: 'application/octet-stream', limit: '100mb' }), (req, res) => requireAdmin(req, res, () => {
  try {
    if (!req.body || !Buffer.isBuffer(req.body)) {
      return res.status(400).json({ error: 'No database file provided or invalid format.' });
    }
    const restorePath = join(__dirname, 'restore.db');
    writeFileSync(restorePath, req.body);
    res.json({ message: 'Backup file received. Server is restarting to apply changes...' });
    
    // Give response time to flush before exiting
    setTimeout(() => {
      console.log('[restore] Initiating database restore and server restart...');
      process.exit(0);
    }, 1000);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}));

app.get('/api/health/export-json', (req, res) => requireAdmin(req, res, () => {
  try {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(r => r.name);
    const exportData = {};
    for (const t of tables) {
      try {
        exportData[t] = db.prepare(`SELECT * FROM "${t}"`).all();
      } catch (err) {
        exportData[t] = { error: err.message };
      }
    }
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="crm_export_${new Date().toISOString().slice(0,10)}.json"`);
    res.json(exportData);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}));

// ─── STAFF REPLY to a student through the portal thread ───────────────────
app.post('/api/leads/:id/reply-to-student', (req, res) => {
  const lead = db.prepare("SELECT * FROM leads WHERE id=? OR lead_id=?").get(req.params.id, req.params.id);
  if (!lead) return res.status(404).json({ error: 'Not found' });
  // China data isolation: block unauthorized access to China leads
  if (isChinaBlockedForUser(lead, req.user)) {
    return res.status(403).json({ error: 'Access denied to China lead records' });
  }
  if (!leadIsVisibleTo(lead, req.user)) return res.status(403).json({ error: 'Not your lead' });
  const { text } = req.body || {};
  if (!text?.trim()) return res.status(400).json({ error: 'text required' });
  logActivity({ type: 'reply_to_student', actor: req.user, lead, details: text.trim() });
  res.json({ ok: true });
});



// Public debug endpoint removed after successful verification

app.get('/api/media/:msgId', async (req, res) => {
  try {
    const row = db.prepare(`
      SELECT m.id, m.media_url, m.media_mime, m.type as msg_type,
             ch.access_token, ch.type as chan_type
      FROM messages m
      JOIN conversations cv ON cv.id = m.conversation_id
      JOIN channels ch ON ch.id = cv.channel_id
      WHERE m.id = ?
    `).get(req.params.msgId);

    if (!row) {
      return res.status(404).json({ error: 'Message not found' });
    }

    if (!row.media_url) {
      return res.status(400).json({ error: 'Message has no media attachment' });
    }

    // 1. Local uploads
    if (row.media_url.startsWith('/uploads')) {
      const filePath = join(__dirname, row.media_url);
      if (existsSync(filePath)) {
        return res.sendFile(filePath);
      }
      return res.status(404).json({ error: 'Local file not found' });
    }

    // 2. Direct HTTP/HTTPS URLs (Messenger/Instagram)
    if (row.media_url.startsWith('http')) {
      try {
        const mediaRes = await fetch(row.media_url);
        if (!mediaRes.ok) {
          return res.status(mediaRes.status).json({ error: `Failed to fetch remote media: ${mediaRes.statusText}` });
        }
        const contentType = mediaRes.headers.get('content-type') || row.media_mime || 'application/octet-stream';
        res.setHeader('Content-Type', contentType);
        const arrayBuffer = await mediaRes.arrayBuffer();
        return res.send(Buffer.from(arrayBuffer));
      } catch (fetchErr) {
        return res.status(500).json({ error: `Failed to fetch remote media: ${fetchErr.message}` });
      }
    }

    // 3. Meta Media ID (numeric)
    const token = row.access_token;
    if (!token) {
      return res.status(400).json({ error: 'Channel has no access token to fetch Meta media' });
    }

    // Step 1: Query Meta Graph API to resolve media URL
    let downloadUrl = null;
    try {
      const metaRes = await fetch(`https://graph.facebook.com/v19.0/${row.media_url}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!metaRes.ok) {
        const errText = await metaRes.text();
        return res.status(metaRes.status).json({ error: `Meta Graph API error: ${errText}` });
      }
      const metaBody = await metaRes.json();
      downloadUrl = metaBody.url;
    } catch (metaErr) {
      return res.status(500).json({ error: `Meta Graph API request failed: ${metaErr.message}` });
    }

    if (!downloadUrl) {
      return res.status(500).json({ error: 'Meta Graph API did not return a media URL' });
    }

    // Step 2: Download the binary media from the resolved URL
    try {
      const imgRes = await fetch(downloadUrl, {
        headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'WhatsApp/2.0' }
      });
      if (!imgRes.ok) {
        const errText = await imgRes.text();
        return res.status(imgRes.status).json({ error: `Failed to download media from Meta CDN: ${errText}` });
      }
      const contentType = imgRes.headers.get('content-type') || row.media_mime || 'application/octet-stream';
      res.setHeader('Content-Type', contentType);
      const arrayBuffer = await imgRes.arrayBuffer();
      return res.send(Buffer.from(arrayBuffer));
    } catch (downloadErr) {
      return res.status(500).json({ error: `Failed to download media from Meta CDN: ${downloadErr.message}` });
    }

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/public/debug-db', (req, res) => {
  const token = req.query.token || req.headers['x-api-key'];
  if (token !== INTERNAL_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  res.download(DB_PATH, 'crm.db');
});

app.post('/api/public/client-log', (req, res) => {
  try {
    const logPath = join(__dirname, 'dist', 'client-errors.json');
    let logs = [];
    if (existsSync(logPath)) {
      try {
        logs = JSON.parse(readFileSync(logPath, 'utf8'));
      } catch {}
    }
    const entry = {
      timestamp: new Date().toISOString(),
      ...req.body
    };
    console.log('[Client Error Logged]', entry);
    logs.push(entry);
    if (logs.length > 100) logs = logs.slice(-100);
    writeFileSync(logPath, JSON.stringify(logs, null, 2), 'utf8');
  } catch (err) {
    console.error('[Client Log Error]', err.message);
  }
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
  // China data isolation: block unauthorized access to China leads
  if (isChinaBlockedForUser(lead, req.user)) {
    return res.status(403).json({ error: 'Access denied to China lead records' });
  }
  if (!leadIsVisibleTo(lead, req.user)) return res.status(403).json({ error: 'Not your lead' });
  const token = generatePublicToken();
  db.prepare("UPDATE leads SET public_token=?, public_enabled=1 WHERE id=?").run(token, lead.id);
  res.json({ public_token: token });
});

// Enable/disable the public link without forgetting the token.
app.put('/api/leads/:id/public', (req, res) => {
  const lead = db.prepare("SELECT * FROM leads WHERE id=?").get(req.params.id);
  if (!lead) return res.status(404).json({ error: 'Not found' });
  // China data isolation: block unauthorized access to China leads
  if (isChinaBlockedForUser(lead, req.user)) {
    return res.status(403).json({ error: 'Access denied to China lead records' });
  }
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
  // China data isolation: block unauthorized access to China leads
  if (isChinaBlockedForUser(lead, req.user)) {
    return res.status(403).end();
  }
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
  } catch {
    res.status(500).end();
  }
});

// PUBLIC — what the student sees at /s/:token. No auth. Sanitised payload.
app.get('/api/public/student/:token', (req, res) => {
  const lead = db.prepare("SELECT * FROM leads WHERE public_token=? AND public_enabled=1").get(req.params.token);
  if (!lead) return res.status(404).json({ error: 'This portal link is not active.' });

  const uniApps = db.prepare(`
    SELECT l.id, l.university, l.program, l.status, l.application_id, l.submitted_on, l.decision_on, l.notes,
           k.country
    FROM lead_university_applications l
    LEFT JOIN kb_universities k ON l.university = k.name
    WHERE l.lead_id=? 
    ORDER BY l.id
  `).all(lead.id);
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
      email: lead.email,
      phone: lead.phone,
      date_of_birth: lead.date_of_birth,
      passport: lead.passport,
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
  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(Math.max(1, parseInt(limit) || 50), 500);
  const offset = (pageNum - 1) * limitNum;
  const params = {};
  let w = 'WHERE (exclude_from_cash IS NULL OR exclude_from_cash = 0)';
  if (month) { w += ' AND month=@month'; params.month = month; }
  const sum = db.prepare(`SELECT SUM(amount) as s FROM income ${w}`).get(params).s || 0;
  const total = db.prepare(`SELECT COUNT(*) as c FROM income ${w}`).get(params).c;
  const rows = db.prepare(`SELECT i.*, e.name AS employee_name FROM income i LEFT JOIN employees e ON e.id = i.employee_id ${w} ORDER BY i.date DESC LIMIT ${limitNum} OFFSET ${offset}`).all(params);
  res.json({ rows, total, sum, page: pageNum, pages: Math.ceil(total/limitNum) });
});
app.post('/api/income', (req, res) => {
  const d = req.body; const month = d.date?.slice(0,7)||null;
  const info = db.prepare(`INSERT INTO income (date,month,category,lead_id,client_name,reference,amount,notes,employee_id) VALUES (@date,@month,@category,@lead_id,@client_name,@reference,@amount,@notes,@employee_id)`).run({ ...d, month, amount: d.amount||0, employee_id: d.employee_id || null });
  const row = db.prepare("SELECT * FROM income WHERE id=?").get(info.lastInsertRowid);
  // Try to attach to a real lead so this payment shows on the lead's timeline.
  const lead = row.lead_id ? db.prepare("SELECT * FROM leads WHERE lead_id=?").get(row.lead_id) : null;
  logActivity({ type: 'payment_recorded', actor: req.user, lead, amount: row.amount, details: { client_name: row.client_name, lead_id: row.lead_id, category: row.category, reference: row.reference } });
  res.json(row);
});
app.put('/api/income/:id', (req, res) => {
  const d = req.body; const month = d.date?.slice(0,7)||null;
  db.prepare(`UPDATE income SET date=@date,month=@month,category=@category,lead_id=@lead_id,client_name=@client_name,reference=@reference,amount=@amount,notes=@notes,employee_id=@employee_id WHERE id=@id`).run({ ...d, id: req.params.id, month, amount: d.amount||0, employee_id: d.employee_id || null });
  res.json(db.prepare("SELECT * FROM income WHERE id=?").get(req.params.id));
});
app.delete('/api/income/:id', (req, res) => { db.prepare("DELETE FROM income WHERE id=?").run(req.params.id); res.json({ ok:true }); });

app.get('/api/expenses', (req, res) => {
  const { month, page=1, limit=50 } = req.query;
  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(Math.max(1, parseInt(limit) || 50), 500);
  const offset = (pageNum - 1) * limitNum;
  const params = {};
  let w = '';
  if (month) { w = 'WHERE month=@month'; params.month = month; }
  const sum = db.prepare(`SELECT SUM(amount) as s FROM expenses ${w}`).get(params).s || 0;
  const total = db.prepare(`SELECT COUNT(*) as c FROM expenses ${w}`).get(params).c;
  const rows = db.prepare(`SELECT x.*, e.name AS employee_name FROM expenses x LEFT JOIN employees e ON e.id = x.employee_id ${w} ORDER BY x.date DESC LIMIT ${limitNum} OFFSET ${offset}`).all(params);
  res.json({ rows, total, sum, page: pageNum, pages: Math.ceil(total/limitNum) });
});
app.post('/api/expenses', (req, res) => {
  const d = req.body; const month = d.date?.slice(0,7)||null;
  const info = db.prepare(`INSERT INTO expenses (date,month,category,paid_to,reference,amount,notes,employee_id) VALUES (@date,@month,@category,@paid_to,@reference,@amount,@notes,@employee_id)`).run({ ...d, month, amount: d.amount||0, employee_id: d.employee_id || null });
  const row = db.prepare("SELECT * FROM expenses WHERE id=?").get(info.lastInsertRowid);
  logActivity({ type: 'expense_recorded', actor: req.user, amount: row.amount, details: { paid_to: row.paid_to, category: row.category, reference: row.reference } });
  res.json(row);
});
app.put('/api/expenses/:id', (req, res) => {
  const d = req.body; const month = d.date?.slice(0,7)||null;
  db.prepare(`UPDATE expenses SET date=@date,month=@month,category=@category,paid_to=@paid_to,reference=@reference,amount=@amount,notes=@notes,employee_id=@employee_id WHERE id=@id`).run({ ...d, id: req.params.id, month, amount: d.amount||0, employee_id: d.employee_id || null });
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
app.put('/api/cashflow/initial', (req, res) => requireAdmin(req, res, () => {
  const v = Number(req.body?.amount);
  if (!Number.isFinite(v)) return res.status(400).json({ error: 'amount required' });
  setConfig('cash_initial', String(v));
  res.json({ ok: true, cash_initial: v });
}));

// Monthly ledger — what the Excel shows for one month, side by side.
// Includes running balance per row so the table reads like a real cashflow.
app.get('/api/cashflow', (req, res) => requireFinance(req, res, () => {
  const month = req.query.month || new Date().toISOString().slice(0, 7);
  const incomeRows  = db.prepare(`SELECT i.id,i.date,i.category,i.client_name,i.reference,i.amount,i.notes,i.employee_id,e.name AS employee_name FROM income i LEFT JOIN employees e ON e.id = i.employee_id WHERE i.month=? AND (i.exclude_from_cash IS NULL OR i.exclude_from_cash = 0) ORDER BY i.date, i.id`).all(month);
  const expenseRows = db.prepare(`SELECT x.id,x.date,x.category,x.paid_to AS client_name,x.reference,x.amount,x.notes,x.employee_id,e.name AS employee_name FROM expenses x LEFT JOIN employees e ON e.id = x.employee_id WHERE x.month=? ORDER BY x.date, x.id`).all(month);
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
app.get('/api/cashflow/year', (req, res) => requireFinance(req, res, () => {
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
app.get('/api/cashflow/investors', (req, res) => requireFinance(req, res, () => {
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
app.post('/api/employees/auto-link', (req, res) => {
  const user = req.user;
  if (!user?.id) return res.status(401).json({ error: 'Unauthorized' });

  // 1. Check if already linked
  let emp = findEmployeeForUser(user);
  if (emp) return res.json({ created: false, employee: emp });

  // 2. Generate a unique emp_id
  const prefix = 'E-';
  const maxEmp = db.prepare("SELECT MAX(CAST(SUBSTR(emp_id,3) AS INTEGER)) as m FROM employees WHERE emp_id LIKE 'E-%'").get();
  const nextNum = (maxEmp?.m || 0) + 1;
  const newEmpId = `${prefix}${String(nextNum).padStart(2, '0')}`;

  // 3. Create employee record using the user's data
  const roleLabel = user.roles?.includes('founder_ceo') ? 'admin' :
                    user.roles?.includes('managing_director') ? 'admin' :
                    user.roles?.includes('consultant') ? 'consultant' : 'manager';

  try {
    const info = db.prepare(
      `INSERT INTO employees (emp_id, name, role, email, phone, salary, active, join_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(newEmpId, user.name || user.email.split('@')[0], roleLabel, user.email, null, 0, 'Yes', new Date().toISOString().slice(0, 10));

    emp = db.prepare("SELECT * FROM employees WHERE id=?").get(info.lastInsertRowid);

    // 4. If the users table has an emp_id column, update it too (optional, best-effort)
    try {
      db.prepare("UPDATE users SET emp_id=? WHERE id=?").run(newEmpId, user.id);
    } catch (e) {
      // emp_id column may not exist on users table — that's fine, email match is enough
    }

    res.json({ created: true, employee: emp });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.get('/api/employees', (req, res) => res.json(db.prepare("SELECT * FROM employees ORDER BY id").all()));
app.get('/api/employees/active', (req, res) => res.json(db.prepare("SELECT id, emp_id, name, role, email, phone, salary FROM employees WHERE active = 'Yes' OR active IS NULL OR active = '1' ORDER BY name").all()));
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
  const user = req.user;

  let consultants;
  if (canViewOwnLeadsOnly(user)) {
    // Consultant: only their own KPI
    const me = user.consultant_name || user.name || '';
    consultants = [me];
  } else {
    // Admin, MD, Investor, App Manager, Marketing Manager: all consultants
    consultants = db.prepare("SELECT DISTINCT assigned_consultant FROM leads WHERE assigned_consultant IS NOT NULL AND assigned_consultant != ''").all().map(r=>r.assigned_consultant);
  }

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
  if (!consultant || !month) return res.status(400).json({ error: 'consultant and month are required' });
  try {
    db.prepare(`INSERT INTO kpi_targets (consultant,month,target_leads,target_enrolled,target_revenue) VALUES (?,?,?,?,?) ON CONFLICT(consultant,month) DO UPDATE SET target_leads=excluded.target_leads,target_enrolled=excluded.target_enrolled,target_revenue=excluded.target_revenue`).run(consultant, month, Number(target_leads)||0, Number(target_enrolled)||0, Number(target_revenue)||0);
    const saved = db.prepare("SELECT * FROM kpi_targets WHERE consultant=? AND month=?").get(consultant, month);
    res.json({ ok: true, saved });
  } catch(e) {
    console.error('[kpi/targets]', e.message);
    res.status(500).json({ error: e.message });
  }
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
app.get('/api/payroll', (req, res) => requireAdmin(req, res, () => {
  const month = req.query.month || new Date().toISOString().slice(0, 7);
  const wd = workingDaysInMonth(month);
  
  // Generate payroll for all active employees
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

  // Fetch all active employees' payrolls for the month
  const activeEmpNames = employees.map(e => e.name);
  const placeholders = activeEmpNames.map(() => '?').join(',');
  const rows = db.prepare(`SELECT * FROM payroll WHERE month=? AND name IN (${placeholders}) ORDER BY name`).all(month, ...activeEmpNames);

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
app.put('/api/payroll/:id', (req, res) => requireAdmin(req, res, () => {
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

app.post('/api/payroll/:id/mark-paid', (req, res) => requireAdmin(req, res, () => {
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
  // Consultants are scoped to their own leads — enforced server-side.
  // Admins, Managing Directors, Investors, and Application Managers see everything.
  if (canViewOwnLeadsOnly(req.user)) {
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
app.get('/api/employee-kpi', (req, res) => requireManagerOrAdmin(req, res, () => {
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

app.get('/api/reports', (req, res) => requireManagerOrAdmin(req, res, () => {
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
app.get('/api/employee-kpi/:emp_id', (req, res) => requireManagerOrAdmin(req, res, () => {
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
  let result = channels.map(c => ({ ...c, access_token: c.access_token ? c.access_token.slice(0,14)+'••••••' : null }));
  
  // Filter for non-admin/non-manager
  const loggedInUser = db.prepare("SELECT * FROM users WHERE id=?").get(req.user.id);
  if (loggedInUser && loggedInUser.role !== 'admin' && loggedInUser.role !== 'manager') {
    const employee = loggedInUser.emp_id
      ? db.prepare("SELECT phone FROM employees WHERE emp_id=?").get(loggedInUser.emp_id)
      : null;
    const empPhone = employee?.phone ? String(employee.phone).replace(/\D/g, '') : '';
    
    result = result.filter(ch => {
      if (ch.type !== 'whatsapp') return true;
      if (!empPhone || empPhone.length < 6) return false;
      const cleanName = String(ch.name || '').replace(/\D/g, '');
      const cleanPhoneId = String(ch.phone_number_id || '').replace(/\D/g, '');
      return (cleanName && (cleanName.endsWith(empPhone) || empPhone.endsWith(cleanName))) ||
             (cleanPhoneId && (cleanPhoneId.endsWith(empPhone) || empPhone.endsWith(cleanPhoneId)));
    });
  }
  
  res.json(result);
});

app.post('/api/channels/:id/bulk-scan', (req, res) => {
  try {
    const channelId = req.params.id;
    const channel = db.prepare("SELECT * FROM channels WHERE id=?").get(channelId);
    if (!channel) return res.status(404).json({ error: "Channel not found" });
    
    const conversations = db.prepare("SELECT * FROM conversations WHERE channel_id=?").all(channel.id);
    
    let created = 0;
    let updated = 0;
    
    for (const conv of conversations) {
      const messages = db.prepare("SELECT * FROM messages WHERE conversation_id=? ORDER BY created_at ASC").all(conv.id);
      const allText = messages.map(m => m.content).join(' ');
      const inboundText = messages.filter(m => m.direction === 'in').map(m => m.content).join(' ');
      
      const phoneRegex = /(?:(?:\+|00)?880?[\s\-]?)?(?:0[\s\-]?)?1[\s\-]?[3-9](?:[\s\-]*\d){8}/g;
      
      const banglaToEnglish = (str) => {
        const banglaDigits = {'০':'0','১':'1','২':'2','৩':'3','৪':'4','৫':'5','৬':'6','৭':'7','৮':'8','৯':'9'};
        return str.replace(/[০-৯]/g, (match) => banglaDigits[match]);
      };
      
      const englishAllText = banglaToEnglish(allText);
      const englishInboundText = banglaToEnglish(inboundText);
      
      let rawPhones = englishInboundText.match(phoneRegex) || englishAllText.match(phoneRegex) || [];
      
      const companyNumbers = ['+8801983333566', '+8801333099608'];
      
      let extractedPhone = null;
      for (let p of rawPhones) {
        let cleanP = p.replace(/[\s\-]/g, '');
        if (cleanP.startsWith('01')) cleanP = '+88' + cleanP;
        if (!companyNumbers.includes(cleanP)) {
          extractedPhone = cleanP;
          break;
        }
      }

      const adMatch = allText.match(/ad_id=(\d+)/i) || allText.match(/campaign_id=(\d+)/i);
      const adId = adMatch ? adMatch[1] : null;

      if (extractedPhone || adId) {
        const contact = db.prepare("SELECT * FROM contacts WHERE id=?").get(conv.contact_id);
        const client_name = contact ? contact.name : 'Unknown Chat Lead';
        
        let lead_id_val = conv.lead_id;
        
        if (!lead_id_val && extractedPhone) {
          const existingByPhone = db.prepare("SELECT id FROM leads WHERE phone=? LIMIT 1").get(extractedPhone);
          if (existingByPhone) {
            lead_id_val = existingByPhone.id;
            db.prepare("UPDATE conversations SET lead_id=? WHERE id=?").run(lead_id_val, conv.id);
            if (contact) db.prepare("UPDATE contacts SET lead_id=? WHERE id=?").run(lead_id_val, contact.id);
          }
        }

        if (lead_id_val) {
          const existingLead = db.prepare("SELECT * FROM leads WHERE id=?").get(lead_id_val);
          if (existingLead) {
            let updateSql = "UPDATE leads SET ";
            let params = [];
            let updates = [];
            
            if (extractedPhone && (!existingLead.phone || existingLead.phone === '')) { 
              updates.push("phone=?"); params.push(extractedPhone); 
            }
            if (adId && !existingLead.meta_ad_id) { 
              updates.push("meta_ad_id=?"); params.push(adId); 
            }
            
            // Fix broken or missing data on existing leads
            if (!existingLead.lead_id) {
              let new_lead_id;
              for(let i=0; i<10; i++) {
                const r = Math.floor(100000 + Math.random() * 900000);
                new_lead_id = 'L26' + String(r).slice(-4);
                const existing = db.prepare("SELECT id FROM leads WHERE lead_id=?").get(new_lead_id);
                if (!existing) break;
              }
              if (!new_lead_id) new_lead_id = 'L26' + Date.now().toString().slice(-4);
              updates.push("lead_id=?"); params.push(new_lead_id);
            }
            if (!existingLead.client_name || existingLead.client_name === 'Unknown' || existingLead.client_name === '') {
               updates.push("client_name=?"); params.push(client_name);
            }
            if (!existingLead.lead_status || existingLead.lead_status === 'New') {
               updates.push("lead_status=?"); params.push('New Lead');
            }
            if (!existingLead.page_name || existingLead.page_name === 'Unknown' || existingLead.page_name === '') {
               updates.push("page_name=?"); params.push(channel.name);
            }
            if (!existingLead.channel_id) {
               updates.push("channel_id=?"); params.push(channel.id);
            }
            if (!existingLead.date_added) {
               updates.push("date_added=?"); params.push(new Date().toISOString().slice(0, 10));
            }

            if (updates.length > 0) {
              updateSql += updates.join(", ") + " WHERE id=?";
              params.push(lead_id_val);
              db.prepare(updateSql).run(...params);
              updated++;
            }
          }
        } else {
          let new_lead_id;
          for(let i=0; i<10; i++) {
            const r = Math.floor(100000 + Math.random() * 900000);
            new_lead_id = 'L26' + String(r).slice(-4);
            const existing = db.prepare("SELECT id FROM leads WHERE lead_id=?").get(new_lead_id);
            if (!existing) break;
          }
          
          const date_added = new Date().toISOString().slice(0, 10);
          const lead_source = channel.type === 'messenger' ? 'Messenger' : 'WhatsApp';
          const lead_status = 'New Lead';
          const page_name = channel.name;
          const lead_market = 'Bangladesh';
          const lead_type = 'B2C';
          const source = 'In-House';
          
          const info = db.prepare(`INSERT INTO leads (
            lead_id, date_added, client_name, phone, lead_source, lead_status, page_name, channel_id, meta_ad_id, lead_market, lead_type, source
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
            new_lead_id, date_added, client_name, extractedPhone, lead_source, lead_status, page_name, channel.id, adId, lead_market, lead_type, source
          );
          
          db.prepare("UPDATE conversations SET lead_id=? WHERE id=?").run(info.lastInsertRowid, conv.id);
          if (contact) db.prepare("UPDATE contacts SET lead_id=? WHERE id=?").run(info.lastInsertRowid, contact.id);
          created++;
        }
      }
    }
    res.json({ success: true, message: `Bulk scan complete. Created ${created} new leads, updated ${updated} existing leads.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/channels', (req, res) => {
  const d = req.body;
  const info = db.prepare(`INSERT INTO channels (type,name,consultant,phone_number_id,waba_id,page_id,ig_account_id,access_token,webhook_verify_token,status,color,active) VALUES (@type,@name,@consultant,@phone_number_id,@waba_id,@page_id,@ig_account_id,@access_token,@webhook_verify_token,@status,@color,@active)`)
    .run({ type: d.type, name: d.name, consultant: d.consultant||null, phone_number_id: d.phone_number_id||null, waba_id: d.waba_id||null, page_id: d.page_id||null, ig_account_id: d.ig_account_id||null, access_token: d.access_token||null, webhook_verify_token: d.webhook_verify_token||'eduexpress_verify_2024', status: d.status||'active', color: d.color||'#3b82f6', active: d.active ?? 1 });
  const newChan = db.prepare("SELECT * FROM channels WHERE id=?").get(info.lastInsertRowid);
  syncChannelMetadata(newChan.id).catch(e => console.error('[channel-metadata] Post-create sync failed:', e.message));
  res.json(newChan);
});

app.put('/api/channels/:id', (req, res) => {
  const d = req.body;
  const existing = db.prepare("SELECT * FROM channels WHERE id=?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const token = (d.access_token && !d.access_token.includes('••')) ? d.access_token : existing.access_token;
  db.prepare(`UPDATE channels SET type=@type,name=@name,consultant=@consultant,phone_number_id=@phone_number_id,waba_id=@waba_id,page_id=@page_id,ig_account_id=@ig_account_id,access_token=@access_token,webhook_verify_token=@webhook_verify_token,status=@status,color=@color,active=@active WHERE id=@id`)
    .run({ ...d, id: req.params.id, consultant: d.consultant||null, access_token: token, active: d.active ?? existing.active ?? 1 });
  const updatedChan = db.prepare("SELECT * FROM channels WHERE id=?").get(req.params.id);
  syncChannelMetadata(updatedChan.id).catch(e => console.error('[channel-metadata] Post-update sync failed:', e.message));
  res.json(updatedChan);
});

app.delete('/api/channels/:id', (req, res) => { db.prepare("DELETE FROM channels WHERE id=?").run(req.params.id); res.json({ ok:true }); });

// Track in-flight syncs so a channel can't be synced twice at once.
const activeSyncs = new Set();

// Helper to resolve dynamic Page Access Token using System User token if needed
async function resolvePageAccessToken(pageId, configuredToken) {
  if (!pageId || !configuredToken) return configuredToken;
  try {
    const res = await fetch(`https://graph.facebook.com/v19.0/${pageId}?fields=access_token&access_token=${configuredToken}`);
    const data = await res.json();
    if (data.access_token) {
      console.log(`[facebook] Dynamically resolved Page Access Token for Page ID: ${pageId}`);
      return data.access_token;
    } else if (data.error) {
      console.warn(`[facebook] Token resolution API returned error for Page ID ${pageId}: ${data.error.message}`);
    }
  } catch (err) {
    console.error(`[facebook] Network error resolving Page Access Token for Page ID ${pageId}:`, err.message);
  }
  return configuredToken;
}

// Helper to sync channel name & avatar from Graph API
async function syncChannelMetadata(channelId) {
  const channel = db.prepare("SELECT * FROM channels WHERE id=?").get(channelId);
  if (!channel) return;
  let token = channel.access_token || getConfig('page_access_token');
  if (!token) return;

  if (channel.type === 'messenger' || channel.type === 'instagram') {
    const pageId = channel.page_id;
    if (!pageId) return;
    try {
      const effectiveToken = await resolvePageAccessToken(pageId, token);
      const res = await fetch(`https://graph.facebook.com/v19.0/${pageId}?fields=name,picture.type(large)&access_token=${effectiveToken}`);
      const data = await res.json();
      if (data.name) {
        const avatarUrl = data.picture?.data?.url || null;
        db.prepare("UPDATE channels SET name = ?, avatar_url = ? WHERE id = ?").run(data.name, avatarUrl, channelId);
        console.log(`[channel-metadata] Updated messenger/instagram channel ${channelId} (${data.name}) avatar: ${avatarUrl ? 'yes' : 'no'}`);
      }

      // Auto-subscribe the Page to our webhook to ensure messages arrive instantly
      try {
        const subRes = await fetch(`https://graph.facebook.com/v19.0/${pageId}/subscribed_apps?subscribed_fields=messages,messaging_postbacks,messaging_optins,leadgen&access_token=${effectiveToken}`, { method: 'POST' });
        const subData = await subRes.json();
        console.log(`[channel-metadata] Auto-subscribed webhook for page ${pageId}:`, subData.success ? 'Success' : `Failed (${subData.error?.message})`);
      } catch (err) {
        console.warn(`[channel-metadata] Webhook auto-subscribe error for page ${pageId}:`, err.message);
      }
    } catch (err) {
      console.warn(`[channel-metadata] Error syncing messenger/instagram channel ${channelId}:`, err.message);
    }
  } else if (channel.type === 'whatsapp') {
    const phoneId = channel.phone_number_id;
    if (!phoneId) return;
    try {
      const res = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/whatsapp_business_profile?fields=profile_picture_url&access_token=${token}`);
      const data = await res.json();
      const avatarUrl = data.data?.[0]?.profile_picture_url || null;
      if (avatarUrl) {
        db.prepare("UPDATE channels SET avatar_url = ? WHERE id = ?").run(avatarUrl, channelId);
        console.log(`[channel-metadata] Updated WhatsApp channel ${channelId} avatar: yes`);
      }
    } catch (err) {
      console.warn(`[channel-metadata] Error syncing WhatsApp channel ${channelId}:`, err.message);
    }
  }
}

// Helper to sync historical messages from Facebook/Instagram Page Channel
async function syncChannelMessages(channelId, months = 6, maxConvs = 100) {
  const channel = db.prepare("SELECT * FROM channels WHERE id=?").get(channelId);
  if (!channel) return { imported: 0, skipped: 0 };
  if (channel.type === 'tiktok') {
    console.log(`[sync] Skipping TikTok channel ${channel.name} (id=${channelId}) — sync not yet supported`);
    return { imported: 0, skipped: 0, reason: 'tiktok_not_supported' };
  }
  if (channel.type !== 'messenger' && channel.type !== 'instagram') return { imported: 0, skipped: 0 };

  // Fallback: use global page_access_token if channel-level token is missing
  let token = channel.access_token || getConfig('page_access_token');
  if (!token) {
    console.error(`[sync] No access token for channel ${channel.name} (id=${channelId})`);
    return { imported: 0, skipped: 0 };
  }

  const pageId = channel.page_id;
  if (!pageId) {
    console.error(`[sync] No page_id for channel ${channel.name} (id=${channelId}) — cannot call conversations API`);
    return { imported: 0, skipped: 0 };
  }

  // Dynamically resolve the Page Access Token from the configured token (e.g. System User token)
  token = await resolvePageAccessToken(pageId, token);

  const since   = Math.floor(Date.now() / 1000) - (months * 30 * 24 * 3600);

  const MAX_MESSAGES = 5000;
  let imported = 0, skipped = 0, conversations = 0;

  async function fbGet(url, label = 'FB API') {
    const r = await fetch(url);
    const d = await r.json();
    if (d.error) {
      console.error(`[sync] ${label} error: code=${d.error.code} subcode=${d.error.error_subcode} msg=${d.error.message}`);
      throw new Error(`${label}: ${d.error.message}`);
    }
    if (!d.data) {
      console.warn(`[sync] ${label} returned no data field. Response keys: ${Object.keys(d).join(', ')}`);
    }
    // Log first item for debugging when data is empty or suspicious
    if (Array.isArray(d.data) && d.data.length > 0) {
      console.log(`[sync] ${label}: ${d.data.length} items, first id=${d.data[0]?.id}, updated=${d.data[0]?.updated_time || d.data[0]?.created_time}`);
    } else if (Array.isArray(d.data)) {
      console.log(`[sync] ${label}: 0 items returned`);
    }
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
  const stmtIncrementUnread = db.prepare(
    `UPDATE conversations SET unread_count = unread_count + 1 WHERE id=?`
  );

  const insertBatch = db.transaction((rows, conv) => {
    let added = 0;
    for (let i = 0; i < rows.length; i++) {
      const msg = rows[i];
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

      try {
        const result = stmtInsertMsg.run(
          conv.id, fromPage ? 'out' : 'in', type, content, mediaUrl, msg.id, createdAt
        );
        if (result.changes > 0) {
          added++;
          if (createdAt) stmtConvUpdate.run(content, createdAt, conv.id, createdAt);
          if (!fromPage) stmtIncrementUnread.run(conv.id);
        } else if (i === 0) {
          console.log(`[sync] insertBatch: msg.id=${msg.id} skipped (changes=0, likely duplicate wa_message_id)`);
        }
      } catch (insertErr) {
        console.error(`[sync] insertBatch error: msg.id=${msg.id}`, insertErr.message);
        // Log first insert error only to avoid console spam
        if (i === 0) console.error(`[sync] First insert error details:`, insertErr);
      }
    }
    return added;
  });

  if (db.pauseSave) db.pauseSave();
  let convCounter = 0;

  const cutoffMs = since * 1000;
  const toSqlTime = (t) => t ? new Date(t).toISOString().replace('T', ' ').slice(0, 19) : null;

  // Determine platform parameter for filtering
  const platform = channel.type === 'instagram' ? 'instagram' : 'messenger';

  try {
    let convUrl = `https://graph.facebook.com/v19.0/${pageId}/conversations`
      + `?platform=${platform}`
      + `&fields=updated_time,participants,snippet`
      + `&limit=50&access_token=${token}`;

    console.log(`[sync] Starting ${channel.name} (${platform}) pageId=${pageId} token=${token.slice(0,14)}...`);

    let stop = false;
    while (convUrl && !stop && imported + skipped < MAX_MESSAGES && conversations < maxConvs) {
      const { items: fbConvs, nextUrl } = await fbGet(convUrl, 'conversations');
      console.log(`[sync] Got ${fbConvs.length} conversations from FB`);
      convUrl = nextUrl;

      for (const fbConv of fbConvs) {
        if (imported + skipped >= MAX_MESSAGES || conversations >= maxConvs) { stop = true; break; }

        if (fbConv.snippet) {
          const s = fbConv.snippet.toLowerCase();
          if (s.includes('commented on') || s.includes('কমেন্ট করেছেন') || s.includes('created this chat') || s.includes('চ্যাটটি তৈরি করেছে')) {
            console.log(`[sync] Skipping comment-reply conversation: "${fbConv.snippet}"`);
            continue;
          }
        }

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

        while (msgUrl && imported + skipped < MAX_MESSAGES && convMsgCount < 50) {
          const { items: msgs, nextUrl: nextMsgUrl } = await fbGet(msgUrl, 'messages');
          msgUrl = nextMsgUrl;
          if (msgs.length === 0) break;

          const oldest = msgs[msgs.length - 1]?.created_time;
          const added = insertBatch(msgs, conv);
          imported += added;
          skipped  += msgs.length - added;
          convMsgCount += msgs.length;
          console.log(`[sync] conv ${conv.id}: ${msgs.length} msgs, ${added} added, ${msgs.length - added} skipped`);
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
app.post('/api/channels/:id/load-history', async (req, res) => {
  const channel = db.prepare("SELECT * FROM channels WHERE id=?").get(req.params.id);
  if (!channel) return res.status(404).json({ error: 'Channel not found' });
  let effectiveToken = channel.access_token || getConfig('page_access_token');
  if (!effectiveToken) return res.status(400).json({ error: 'No access token configured for this channel' });
  if (!channel.page_id) return res.status(400).json({ error: 'No page_id set on this channel' });
  if (channel.type !== 'messenger' && channel.type !== 'instagram' && channel.type !== 'tiktok')
    return res.status(400).json({ error: 'Sync only supported for Messenger and Instagram channels' });
  if (channel.type === 'tiktok')
    return res.status(400).json({ error: 'TikTok sync is not yet supported' });
  if (activeSyncs.has(channel.id))
    return res.status(409).json({ error: 'A sync is already running for this channel' });

  const { months = 6 } = req.body || {};

  // Dynamically resolve the Page Access Token from the configured token (e.g. System User token)
  effectiveToken = await resolvePageAccessToken(channel.page_id, effectiveToken);

  // ── Validate the token before starting background sync ──
  try {
    const platform = channel.type === 'instagram' ? 'instagram' : 'messenger';
    const testUrl = `https://graph.facebook.com/v19.0/${channel.page_id}?fields=name,picture.type(large)&access_token=${effectiveToken}`;
    const testRes = await fetch(testUrl);
    const testData = await testRes.json();
    if (testData.error) {
      console.error(`[sync] Token validation failed for ${channel.name}: ${testData.error.message}`);
      return res.status(400).json({ error: `Facebook API token invalid: ${testData.error.message}` });
    }
    if (testData.name) {
      const avatarUrl = testData.picture?.data?.url || null;
      db.prepare("UPDATE channels SET name = ?, avatar_url = ? WHERE id = ?").run(testData.name, avatarUrl, channel.id);
    }
  } catch (e) {
    console.error(`[sync] Token validation network error for ${channel.name}:`, e.message);
    return res.status(400).json({ error: `Could not validate Facebook token: ${e.message}` });
  }

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
  const params = {};
  let where = '';
  if (search && search !== 'undefined' && search !== 'null') {
    where = 'WHERE contacts.name LIKE @search OR contacts.phone LIKE @search';
    params.search = `%${search}%`;
  }
  res.json(db.prepare(`SELECT contacts.*, leads.lead_status, leads.lead_id as crm_lead_id, leads.destination FROM contacts LEFT JOIN leads ON leads.id=contacts.lead_id ${where} ORDER BY contacts.id DESC LIMIT 100`).all(params));
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
    contacts.wa_id, contacts.messenger_id, contacts.instagram_id, contacts.tiktok_id,
    contacts.lead_id AS contact_lead_id,
    channels.name  AS channel_name,
    channels.type  AS channel_type,
    channels.color AS channel_color,
    channels.consultant AS channel_consultant,
    channels.phone_number_id,
    leads.lead_id AS lead_id,
    leads.lead_status,
    leads.destination AS lead_destination,
    leads.assigned_consultant AS lead_assigned_consultant,
    employees.name AS lead_employee_name,
    leads.assigned_employee_id AS lead_assigned_employee_id,
    (SELECT direction FROM messages WHERE conversation_id = conversations.id ORDER BY created_at DESC, id DESC LIMIT 1) AS last_message_direction,
    (SELECT status FROM messages WHERE conversation_id = conversations.id ORDER BY created_at DESC, id DESC LIMIT 1) AS last_message_status,
    (SELECT COUNT(*) FROM messages WHERE conversation_id = conversations.id AND direction = 'out') AS outbound_count
  FROM conversations
  LEFT JOIN contacts  ON contacts.id  = conversations.contact_id
  LEFT JOIN channels  ON channels.id  = conversations.channel_id
  LEFT JOIN leads   ON leads.id     = conversations.lead_id
  LEFT JOIN employees ON employees.id = leads.assigned_employee_id
`;


app.get('/api/conversations', (req, res) => {
  const { status, channel_type, channel_id, assigned_to, search, page=1, limit=30 } = req.query;
  const where=[]; const params={};
  if (status && status !== 'all') { where.push("conversations.status=@status"); params.status=status; }
  if (channel_type && channel_type !== 'all') { where.push("conversations.channel_type=@channel_type"); params.channel_type=channel_type; }
  if (channel_id && channel_id !== 'all') { where.push("conversations.channel_id=@channel_id"); params.channel_id=channel_id; }
  if (assigned_to && assigned_to !== 'all') { where.push("conversations.assigned_to=@assigned_to"); params.assigned_to=assigned_to; }
  if (search && search !== 'undefined' && search !== 'null') { where.push("(contacts.name LIKE @search OR contacts.phone LIKE @search)"); params.search=`%${search}%`; }

  // RBAC Access Filter: role-based rules merged with phone-number matching
  const user = req.user;
  if (!isFullAdmin(user) && !canViewAllConversations(user)) {
    const loggedInUser = db.prepare("SELECT * FROM users WHERE id=?").get(user.id);
    const meConsultant = (loggedInUser?.consultant_name || '').trim();
    
    const employee = loggedInUser?.emp_id
      ? db.prepare("SELECT phone FROM employees WHERE emp_id=?").get(loggedInUser.emp_id)
      : null;
    const empPhone = employee?.phone ? String(employee.phone).replace(/\D/g, '') : '';

    // Load all active channels to determine accessibility
    const allChannels = db.prepare("SELECT id, type, name, phone_number_id, consultant FROM channels WHERE active = 1").all();
    const accessibleChannelIds = [];

    for (const ch of allChannels) {
      if (ch.type !== 'whatsapp' && ch.type !== 'waba') {
        // Non-WhatsApp: full access for consultants
        accessibleChannelIds.push(ch.id);
      } else {
        // WhatsApp/WABA: check consultant name, or access in channel_access, or phone matching
        const matchConsultant = ch.consultant && meConsultant &&
          ch.consultant.trim().toLowerCase() === meConsultant.toLowerCase();
          
        let matchPhone = false;
        if (empPhone && empPhone.length >= 6) {
          const cleanName = String(ch.name || '').replace(/\D/g, '');
          const cleanPhoneId = String(ch.phone_number_id || '').replace(/\D/g, '');
          matchPhone = (cleanName && (cleanName.endsWith(empPhone) || empPhone.endsWith(cleanName))) ||
                       (cleanPhoneId && (cleanPhoneId.endsWith(empPhone) || empPhone.endsWith(cleanPhoneId)));
        }
        
        // Check if explicitly granted access in channel_access table
        const hasExplicitAccess = db.prepare("SELECT 1 FROM channel_access WHERE channel_id=? AND user_id=?").get(ch.id, user.id);

        if (matchConsultant || matchPhone || hasExplicitAccess) {
          accessibleChannelIds.push(ch.id);
        }
      }
    }

    if (accessibleChannelIds.length > 0) {
      where.push(`(conversations.channel_id IN (${accessibleChannelIds.join(',')}) OR conversations.assigned_to = @user_id)`);
    } else {
      where.push("conversations.assigned_to = @user_id");
    }
    params.user_id = user.id;
  }
  
  // China data isolation: exclude conversations linked to China leads for unauthorized users
  if (!canViewChinaData(req.user)) {
    where.push("(leads.destination != 'China' OR leads.destination IS NULL) AND (leads.source != 'China' OR leads.source IS NULL)");
  }

  // Investors: no conversation access at all
  if (isInvestor(user) && !isFullAdmin(user)) {
    return res.json({ conversations: [], total: 0, page: 1, pages: 0 });
  }

  const ws = where.length ? 'WHERE '+where.join(' AND ') : '';
  const total = db.prepare(`SELECT COUNT(*) as c FROM conversations LEFT JOIN contacts ON contacts.id=conversations.contact_id LEFT JOIN channels ON channels.id=conversations.channel_id LEFT JOIN leads ON leads.id = conversations.lead_id ${ws}`).get(params).c;
  const convs = db.prepare(`${CONV_SELECT} ${ws} ORDER BY conversations.last_message_at DESC LIMIT ${limit} OFFSET ${(page-1)*limit}`).all(params);

  // Compute SLA status and priority per conversation
  const now = Date.now();
  const priorityTagIds = db.prepare("SELECT id FROM contact_tags WHERE LOWER(name)='priority'").all().map(r => r.id);
  const convWithMeta = convs.map(c => {
    const lastAt = c.last_message_at ? new Date(c.last_message_at).getTime() : 0;
    const minsSince = lastAt ? (now - lastAt) / 60000 : Infinity;
    let sla_status;
    if (!lastAt || c.last_message_direction !== 'out') {
      sla_status = 'red';
    } else if (minsSince < 30) {
      sla_status = 'green';
    } else if (minsSince < 120) {
      sla_status = 'yellow';
    } else {
      sla_status = 'red';
    }
    // Priority: has 'priority' tag OR new lead without any outbound response
    let priority = 0;
    if (priorityTagIds.length) {
      const hasTag = db.prepare("SELECT 1 FROM conversation_tags WHERE conversation_id=? AND tag_id IN (" + priorityTagIds.map(() => '?').join(',') + ") LIMIT 1").get(c.id, ...priorityTagIds);
      if (hasTag) priority = 1;
    }
    if (!priority && c.lead_id && c.outbound_count === 0) priority = 1;
    return { ...c, sla_status, priority };
  });

  // Sort strictly by last_message_at desc
  convWithMeta.sort((a, b) => {
    return (b.last_message_at || '').localeCompare(a.last_message_at || '');
  });

  res.json({ conversations: convWithMeta, total, page: parseInt(page), pages: Math.ceil(total/limit) });
});

app.get('/api/conversations/:id', (req, res) => {
  const conv = db.prepare(`${CONV_SELECT} WHERE conversations.id=?`).get(req.params.id);
  if (!conv) return res.status(404).json({ error:'Not found' });

  // RBAC check
  if (!userHasAccessToConversation(req.user, req.params.id)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  res.json(conv);
});

// Convert conversation contact into a CRM lead (creating new lead or linking to existing)
app.post('/api/conversations/:id/convert-lead', (req, res) => {
  try {
    if (!userHasAccessToConversation(req.user, req.params.id)) return res.status(403).json({ error: 'Access denied' });
    const { lead_id, destination, phone, degree, client_name } = req.body;
    if (!userHasAccessToConversation(req.user, req.params.id)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const conv = db.prepare("SELECT * FROM conversations WHERE id=?").get(req.params.id);
    if (!conv) return res.status(404).json({ error: 'Conversation not found' });

    let lead = null;
    if (lead_id) {
      // Link to existing lead
      lead = db.prepare("SELECT * FROM leads WHERE id=?").get(lead_id);
      if (!lead) return res.status(404).json({ error: 'Selected lead not found' });

      db.prepare("UPDATE contacts SET lead_id=? WHERE id=?").run(lead.id, conv.contact_id);
      db.prepare("UPDATE conversations SET lead_id=? WHERE id=?").run(lead.id, conv.id);

      // If lead does not have assigned consultant, assign the channel's consultant
      if (!lead.assigned_consultant || lead.assigned_consultant.trim() === '') {
        const channel = db.prepare("SELECT consultant FROM channels WHERE id=?").get(conv.channel_id);
        const consultant = channel?.consultant || 'Abdullah Al Rakib';
        db.prepare("UPDATE leads SET assigned_consultant=? WHERE id=?").run(consultant, lead.id);
        lead.assigned_consultant = consultant;
      }
    } else {
      try {
        lead = createLeadFromContact(conv.contact_id, conv.channel_type, conv.last_message, req.user, {
          destination, phone, degree, client_name
        });
      } catch (err) {
        console.error('Convert lead error:', err);
        return res.status(500).json({ error: err.message || 'Failed to create lead' });
      }
      if (!lead) return res.status(500).json({ error: 'Failed to create lead' });
    }

    res.json({
      success: true,
      lead_id: lead.id,
      lead,
      conversation: db.prepare(`${CONV_SELECT} WHERE conversations.id=?`).get(conv.id)
    });
  } catch (err) {
    console.error('Convert lead error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Quick Convert to Lead from conversation (manual override with provided data)
app.post('/api/conversations/:id/convert-to-lead', (req, res) => {
  try {
    const { client_name, phone, email, destination, source, notes } = req.body || {};
    const conv = db.prepare("SELECT * FROM conversations WHERE id=?").get(req.params.id);
    if (!conv) return res.status(404).json({ error: 'Conversation not found' });

    const contact = db.prepare("SELECT * FROM contacts WHERE id=?").get(conv.contact_id);
    if (!contact) return res.status(404).json({ error: 'Contact not found' });

    const channel = db.prepare("SELECT * FROM channels WHERE id=?").get(conv.channel_id);
    const assigned_consultant = channel?.consultant || null;

    const leadSourceMap = {
      whatsapp: 'WhatsApp',
      messenger: 'Messenger',
      instagram: 'Instagram',
      tiktok: 'TikTok'
    };
    const lead_id = nextLeadId();

    let meta_ad_id = null;
    let meta_campaign = null;
    let meta_adset_name = null;
    let meta_adset_id = null;
    let ad_name = null;
    let channel_id_val = null;

    if (contact.referral_data) {
      try {
        const ref = JSON.parse(contact.referral_data);
        if (ref.ad_id) meta_ad_id = String(ref.ad_id);
        if (ref.campaign_name || ref.campaign_id) meta_campaign = String(ref.campaign_name || ref.campaign_id);
        if (ref.adset_name) meta_adset_name = String(ref.adset_name);
        if (ref.adset_id) meta_adset_id = String(ref.adset_id);
        if (ref.ad_title || ref.headline) ad_name = String(ref.ad_title || ref.headline);
        if (ref.channel_id) channel_id_val = ref.channel_id;
      } catch (e) {}
    }

    const params = leadParams({
      client_name: client_name || contact.name || 'Unknown',
      phone: phone || contact.phone || null,
      email: email || contact.email || null,
      destination: destination || 'Bangladesh',
      source: source || 'In-House',
      lead_source: leadSourceMap[conv.channel_type] || 'Chat',
      lead_status: 'New Lead',
      assigned_consultant,
      meta_ad_id,
      meta_campaign,
      meta_adset_name,
      meta_adset_id,
      ad_name,
      channel_id: channel_id_val,
      notes: notes || null,
    }, lead_id, 0);

    const info = db.prepare(LEAD_INSERT_SQL).run(params);
    const lead = db.prepare("SELECT * FROM leads WHERE id=?").get(info.lastInsertRowid);

    db.prepare("UPDATE contacts SET lead_id=? WHERE id=?").run(lead.id, contact.id);
    db.prepare("UPDATE conversations SET lead_id=? WHERE id=?").run(lead.id, conv.id);

    sendCAPIEvent('Lead', lead).catch(() => {});
    logActivity({ type: 'lead_created', actor: req.user, lead, details: { source: lead.lead_source, destination: lead.destination, assigned_consultant: lead.assigned_consultant, note: 'Converted from conversation' } });
    broadcast('new_lead', { lead });

    res.json({ success: true, lead_id: lead.id, lead });
  } catch (err) {
    console.error('Convert to lead error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Move a lead to application pipeline (convert to application)
app.post('/api/leads/:id/convert-to-application', (req, res) => {
  const lead = db.prepare("SELECT * FROM leads WHERE id=?").get(req.params.id);
  if (!lead) return res.status(404).json({ error: 'Not found' });
  // China data isolation: block unauthorized access to China leads
  if (isChinaBlockedForUser(lead, req.user)) {
    return res.status(403).json({ error: 'Access denied to China lead records' });
  }
  if (!leadIsVisibleTo(lead, req.user)) {
    return res.status(403).json({ error: 'Access denied to this lead record' });
  }

  const updates = [];
  if (lead.lead_status !== 'File Opened') updates.push("lead_status = 'File Opened'");
  if (lead.application_stage !== 'documents') updates.push("application_stage = 'documents'");

  let newSource = lead.source;
  if (lead.destination === 'China') {
    if (lead.source !== 'China') {
      newSource = 'China';
      updates.push("source = 'China'");
    }
  } else if (lead.destination === 'Bangladesh') {
    if (lead.source === 'B2B') {
      newSource = 'B2B';
    } else if (lead.source !== 'In-House') {
      newSource = 'In-House';
      updates.push("source = 'In-House'");
    }
  }

  if (updates.length) {
    db.prepare(`UPDATE leads SET ${updates.join(', ')} WHERE id=?`).run(req.params.id);
  }

  const updatedLead = db.prepare("SELECT * FROM leads WHERE id=?").get(req.params.id);
  logActivity({ type: 'application_stage_changed', actor: req.user, lead: updatedLead, details: { stage: updatedLead.application_stage || 'documents', source: newSource, destination: updatedLead.destination } });
  sendCAPIEvent('InitiateCheckout', updatedLead).catch(() => {});
  res.json(updatedLead);
});

app.put('/api/conversations/:id', (req, res) => {
  if (!userHasAccessToConversation(req.user, req.params.id)) return res.status(403).json({ error: 'Access denied' });
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
    // RBAC: check if user can access this channel
    if (!userHasAccessToConversation(req.user, { channel_id, channel_type: channel.type })) {
      return res.status(403).json({ error: 'Access denied to this channel' });
    }
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
  if (!userHasAccessToConversation(req.user, req.params.id)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  db.prepare("UPDATE conversations SET unread_count=0 WHERE id=?").run(req.params.id);
  res.json({ ok:true });
});

// Mark conversation unread
app.post('/api/conversations/:id/unread', (req, res) => {
  if (!userHasAccessToConversation(req.user, req.params.id)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  db.prepare("UPDATE conversations SET unread_count=1 WHERE id=?").run(req.params.id);
  res.json({ ok:true });
});

// Delete an entire conversation (and its messages)
app.delete('/api/conversations/:id', (req, res) => {
  try {
    if (!userHasAccessToConversation(req.user, req.params.id)) return res.status(403).json({ error: 'Access denied' });
    const conv = db.prepare("SELECT * FROM conversations WHERE id=?").get(req.params.id);
    if (conv) {
      db.prepare("DELETE FROM messages WHERE conversation_id=?").run(req.params.id);
      db.prepare("DELETE FROM conversations WHERE id=?").run(req.params.id);
      broadcast('conversation_deleted', { conversation_id: parseInt(req.params.id) }, (u) => {
        if (!u) return false;
        return userHasAccessToConversation(u, req.params.id);
      });
    }
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
  if (!userHasAccessToConversation(req.user, req.params.id)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  const { before, limit=500 } = req.query;
  // Order CHRONOLOGICALLY by timestamp (not insert id) — synced messages are
  // inserted newest-first, so id order ≠ time order. Grab the most-recent N,
  // then flip to ascending so the chat reads oldest→newest top-to-bottom.
  const beforeClause = before ? 'AND id < @before' : '';
  const msgParams = { conv_id: req.params.id, before: before ? parseInt(before) : undefined, lim: Math.min(parseInt(limit) || 500, 2000) };
  const msgs = db.prepare(
    `SELECT * FROM (
       SELECT * FROM messages
       WHERE conversation_id=@conv_id ${beforeClause}
       ORDER BY created_at DESC, id DESC
       LIMIT @lim
     ) ORDER BY created_at ASC, id ASC`
  ).all(msgParams);
  res.json(msgs);
});

// File upload endpoint for base64 encoded media attachments
app.post('/api/upload', (req, res) => {
  try {
    const { name, data } = req.body;
    if (!name || !data) {
      return res.status(400).json({ error: 'name and data (base64) are required' });
    }
    // Clean filename
    const cleanName = name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filename = `${Date.now()}_${cleanName}`;
    const filePath = join(UPLOADS_DIR, filename);

    // Decode base64
    const buffer = Buffer.from(data, 'base64');
    writeFileSync(filePath, buffer);

    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const host = req.get('host');
    const fileUrl = `${protocol}://${host}/uploads/${filename}`;

    res.json({
      url: fileUrl,
      relativeUrl: `/uploads/${filename}`,
      name: filename
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Send message
app.post('/api/conversations/:id/messages', async (req, res) => {
  try {
    if (!userHasAccessToConversation(req.user, req.params.id)) return res.status(403).json({ error: 'Access denied' });
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
        // Linked-device channel (Baileys) or no Cloud API token → send via linked device
        if (channel.phone_number_id === 'linked_device' || (!channel.access_token && isWaLinkedConnected())) {
          apiResult = await sendWaLinkedMessage(to, content, media_url, type);
        } else {
          apiResult = await sendWhatsApp(channel, to, content, type, media_url);
        }
      } else if (channel.type === 'messenger') {
        apiResult = await sendMessenger(channel, conv.messenger_id, content, type, media_url);
      } else if (channel.type === 'instagram') {
        apiResult = await sendMessenger({ ...channel, page_id: channel.ig_account_id || channel.page_id }, conv.instagram_id || conv.messenger_id, content, type, media_url);
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

    db.prepare("UPDATE conversations SET last_message=?, last_message_at=datetime('now'), status='open' WHERE id=?").run(content || (type === 'image' ? '📷 Image' : '📎 Document'), req.params.id);
    broadcast('new_message', { ...msg, conversation_id: parseInt(req.params.id), direction: 'outbound' }, (u) => userHasAccessToConversation(u, req.params.id));
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
// WEBSITE LEAD INGESTION WEBHOOK (public)
// ─────────────────────────────────────────────────────────
app.post('/api/webhook/website-lead', async (req, res) => {
  try {
    const { name, phone, email, destination, source, referrer, message, page_url } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name is required' });
    const lead_id = nextLeadId();
    let assigned_consultant = null;
    let leadSource = 'Website';
    let actualSource = source || null;
    let actualDestination = destination || null;

    if (source === 'China') {
      assigned_consultant = 'Abdullah Al Rakib';
      actualDestination = actualDestination || 'China';
    } else if (source === 'Bangladesh Office') {
      assigned_consultant = 'Taj Ahmed';
      actualDestination = actualDestination || 'Bangladesh';
      actualSource = actualSource || 'In-House';
    } else if (source === 'B2B') {
      assigned_consultant = 'Tahmid Imam';
      actualDestination = actualDestination || 'Bangladesh';
      actualSource = actualSource || 'B2B';
    }

    const params = leadParams({
      client_name: name,
      phone: phone || null,
      email: email || null,
      destination: actualDestination,
      lead_source: leadSource,
      source: actualSource,
      referrer: referrer || null,
      assigned_consultant,
      notes: message || null,
      event_source_url: page_url || null,
    }, lead_id, 0);

    const info = db.prepare(LEAD_INSERT_SQL).run(params);
    const lead = db.prepare("SELECT * FROM leads WHERE id=?").get(info.lastInsertRowid);

    sendCAPIEvent('Lead', { ...lead, event_source_url: page_url || undefined }).catch(() => {});
    logActivity({ type: 'lead_created', actor: { name: 'Website Webhook' }, lead, details: { source: leadSource, destination: lead.destination, assigned_consultant: lead.assigned_consultant } });
    broadcast('new_lead', { lead });

    res.json({ success: true, lead_id: lead.id });
  } catch (e) {
    console.error('[website-lead] webhook error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────────────────
// META WEBHOOK — WhatsApp + Messenger + Instagram + Lead Ads + TikTok placeholder
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
  
  try {
    db.prepare("INSERT INTO webhook_logs (payload) VALUES (?)").run(JSON.stringify(body));
  } catch (err) {
    console.error("Failed to log webhook", err.message);
  }

  // ── WhatsApp Cloud API ─────────────────────────────────
  if (body.object === 'whatsapp_business_account') {
    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        if (change.field !== 'messages') continue;
        try {
          const val = change.value;
          const phoneNumberId = String(val.metadata?.phone_number_id).trim();
          const channel = db.prepare("SELECT * FROM channels WHERE trim(phone_number_id)=? AND type='whatsapp'").get(phoneNumberId);
          if (!channel) { console.log('⚠️ Unknown WA channel:', phoneNumberId); continue; }

          // Delivery/read status updates
          for (const status of val.statuses || []) {
            try {
              db.prepare("UPDATE messages SET status=? WHERE wa_message_id=?").run(status.status, status.id);
              const msg = db.prepare("SELECT conversation_id FROM messages WHERE wa_message_id=?").get(status.id);
              if (msg) {
                broadcast('message_status', { wa_message_id: status.id, status: status.status }, (u) => userHasAccessToConversation(u, msg.conversation_id));
              } else {
                broadcast('message_status', { wa_message_id: status.id, status: status.status });
              }
            } catch(e) { console.error('WA status update error:', e.message); }
          }

          // Incoming messages
          for (const msg of val.messages || []) {
            const profileName = val.contacts?.find(c=>c.wa_id===msg.from)?.profile?.name || msg.from;
            const contact = upsertContact({ name: profileName, phone: msg.from, wa_id: msg.from });
            const conv    = upsertConversation(contact.id, channel.id, 'whatsapp');

            // Auto-create a lead if contact does not have one (handles both Ads and Organic/Manual knocks)
            if (!contact.lead_id) {
              createLeadFromReferral({
                contact,
                channel,
                referralData: msg.referral || null,
                sourcePlatform: 'whatsapp'
              });
              const updatedContact = db.prepare("SELECT * FROM contacts WHERE id=?").get(contact.id);
              if (updatedContact) contact.lead_id = updatedContact.lead_id;
            }

            let content, type = msg.type, mediaUrl = null, caption = null;
            if (msg.type === 'text')     { content = msg.text?.body; }
            else if (msg.type === 'image')    { mediaUrl = msg.image?.id;    caption = msg.image?.caption; content = '[Image]'; }
            else if (msg.type === 'audio')    { mediaUrl = msg.audio?.id;    content = '[Voice Message]'; }
            else if (msg.type === 'video')    { mediaUrl = msg.video?.id;    caption = msg.video?.caption; content = '[Video]'; }
            else if (msg.type === 'document') { mediaUrl = msg.document?.id; content = `[Document: ${msg.document?.filename||''}]`; }
            else if (msg.type === 'location') { content = `📍 Location: ${msg.location?.latitude},${msg.location?.longitude}`; }
            else if (msg.type === 'button')   { content = msg.button?.text; type='text'; }
            else { content = `[${msg.type}]`; }

            saveMessage(conv.id, 'in', content, type, msg.id, mediaUrl, caption);
            // Run automation rules on the incoming message
            const savedMsg = db.prepare("SELECT * FROM messages WHERE conversation_id=? ORDER BY id DESC LIMIT 1").get(conv.id);
            if (savedMsg) {
              // executeAutomationRules({ conversation: conv, message: savedMsg, channel, contact });
            }
            const waInCount = db.prepare("SELECT COUNT(*) as n FROM messages WHERE conversation_id=? AND direction='in'").get(conv.id).n;
            if (waInCount === 1) {
              // Forward to n8n — Gemini generates personalised AI welcome
              /* setImmediate(() => forwardToN8N({ ... })); */
            }
            console.log(`📱 WA [${channel.name}] ${profileName}: ${content}`);
          }
        } catch (outerErr) {
          console.error('WA webhook outer error:', outerErr.message);
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
            const metaRes = await fetch(`https://graph.facebook.com/v19.0/${leadgen_id}?fields=field_data,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,form_id&access_token=${token}`);
            const metaData = await metaRes.json();
            if (metaData.error) continue;
            const fields = {};
            (metaData.field_data||[]).forEach(f => { fields[f.name] = f.values?.[0]||null; });

            // Determine routing based on campaign/ad name
            const campaignName = (metaData.campaign_name || metaData.ad_name || '').toLowerCase();
            let destination = fields.destination || null;
            let source = metaData.campaign_name || 'Meta Ad';
            let assigned_consultant = null;
            if (campaignName.includes('china') || campaignName.includes('chinese') || campaignName.includes('中国')) {
              destination = 'China';
              source = 'China';
              assigned_consultant = 'Abdullah Al Rakib';
            } else if (campaignName.includes('bangladesh') || campaignName.includes('bd') || campaignName.includes('office')) {
              destination = 'Bangladesh';
              source = 'In-House';
              assigned_consultant = 'Taj Ahmed';
            } else if (campaignName.includes('b2b') || campaignName.includes('agent')) {
              destination = 'Bangladesh';
              source = 'B2B';
              assigned_consultant = 'Tahmid Imam';
            }

            const lead_id = nextLeadId();
            const client_name = fields.full_name||fields.name||`${fields.first_name||''} ${fields.last_name||''}`.trim()||'Unknown';
            db.prepare(`INSERT OR IGNORE INTO leads (lead_id,date_added,client_name,phone,email,destination,lead_source,lead_status,meta_lead_id,meta_form_id,meta_ad_id,meta_campaign,meta_adset_id,meta_adset_name,source,assigned_consultant,notes,page_name,channel_id)
              VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
              .run(lead_id, new Date().toISOString().slice(0,10), client_name, fields.phone_number||null, fields.email||null, destination,
                source,'New Lead',leadgen_id,form_id,ad_id||null,metaData.campaign_name||null,metaData.adset_id||null,metaData.adset_name||null,source,assigned_consultant,JSON.stringify(fields), channel?.name||null, channel?.id||null);
            const lead = db.prepare("SELECT * FROM leads WHERE meta_lead_id=?").get(leadgen_id);
            if (lead) {
              sendCAPIEvent('Lead', { ...lead, event_source_url: fields.link_url || fields.page_url || undefined });
              broadcast('new_lead', { lead });

              // Automatically create a contact and conversation if phone is available
              if (lead.phone) {
                const whatsappChannel = getWhatsAppChannelForConsultant(lead.assigned_consultant);
                if (whatsappChannel) {
                  const contact = upsertContact({
                    name: lead.client_name,
                    phone: lead.phone,
                    wa_id: lead.phone,
                    lead_id: lead.id
                  });
                  const conv = upsertConversation(contact.id, whatsappChannel.id, 'whatsapp');
                  db.prepare("UPDATE conversations SET lead_id=? WHERE id=?").run(lead.id, conv.id);

                  // Forward to n8n — Gemini generates personalised AI welcome for Lead Ad
                  setImmediate(() => forwardToN8N({
                    platform: 'whatsapp',
                    conversationId: conv.id,
                    senderName: lead.client_name,
                    messageText: 'New Lead Ad inquiry'
                  }));

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
        try {
          console.log(`[webhook] Received Messenger webhook:`, JSON.stringify(messaging));
          if (!messaging.message) continue;
          const isEcho = messaging.message.is_echo;
          const customerId = isEcho ? messaging.recipient.id : messaging.sender.id;
          const channel = db.prepare("SELECT * FROM channels WHERE trim(page_id)=? AND type='messenger'").get(String(pageId).trim());
          if (!channel) continue;

          const contact = db.prepare("SELECT * FROM contacts WHERE messenger_id=?").get(customerId) || upsertContact({ name: `Messenger User`, messenger_id: customerId });
          // Fetch name + profile picture from Messenger API
          try {
            const pageToken = await resolvePageAccessToken(pageId, channel.access_token);
            const nr = await fetch(`https://graph.facebook.com/v19.0/${customerId}?fields=name,profile_pic&access_token=${pageToken}`);
            const nd = await nr.json();
            if (nd.name) db.prepare("UPDATE contacts SET name=? WHERE id=?").run(nd.name, contact.id);
            if (nd.profile_pic) db.prepare("UPDATE contacts SET avatar_url=COALESCE(avatar_url,?) WHERE id=?").run(nd.profile_pic, contact.id);
          } catch {}

          const conv = upsertConversation(contact.id, channel.id, 'messenger');

          const referral = messaging.referral || messaging.message?.referral;
          // If message is from a Meta Paid Ad (Click-to-Messenger referral), auto-create a lead
          if (referral && !contact.lead_id) {
            createLeadFromReferral({
              contact,
              channel,
              referralData: referral,
              sourcePlatform: 'messenger'
            });
            const updatedContact = db.prepare("SELECT * FROM contacts WHERE id=?").get(contact.id);
            if (updatedContact) contact.lead_id = updatedContact.lead_id;
          }

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
          saveMessage(conv.id, isEcho ? 'out' : 'in', text, mtype, messaging.message.mid, murl);
          // Run automation rules
          const savedMsg = db.prepare("SELECT * FROM messages WHERE conversation_id=? ORDER BY id DESC LIMIT 1").get(conv.id);
          if (savedMsg) {
            // executeAutomationRules({ conversation: conv, message: savedMsg, channel, contact });
          }
          const msInCount = db.prepare("SELECT COUNT(*) as n FROM messages WHERE conversation_id=? AND direction='in'").get(conv.id).n;
          if (msInCount === 1) {
            // Forward to n8n — Gemini generates personalised AI welcome
            /* setImmediate(() => forwardToN8N({
              platform: 'messenger',
              conversationId: conv.id,
              senderName: 'Messenger User', // DB will have real name shortly after
              messageText: text || ''
            })); */
          }
          console.log(`💬 Messenger [${channel.name}]: ${text}`);
        } catch (msgErr) {
          console.error('Messenger webhook error:', msgErr.message);
        }
      }
    }
    return;
  }

  // ── Instagram ──────────────────────────────────────────
  if (body.object === 'instagram') {
    for (const entry of body.entry || []) {
      for (const msg of entry.messaging || []) {
        if (!msg.message) continue;
        const isEcho = msg.message.is_echo;
        const senderId = isEcho ? msg.recipient.id : msg.sender.id;
        const igAccountId = entry.id;
        const channel = db.prepare("SELECT * FROM channels WHERE ig_account_id=? AND type='instagram'").get(igAccountId);
        if (!channel) continue;

        const contact = db.prepare("SELECT * FROM contacts WHERE instagram_id=?").get(senderId) || upsertContact({ name: `Instagram User`, instagram_id: senderId });
        try {
          const pageToken = await resolvePageAccessToken(channel.page_id, channel.access_token);
          const nr = await fetch(`https://graph.facebook.com/v19.0/${senderId}?fields=name,username&access_token=${pageToken}`);
          const nd = await nr.json();
          if (nd.name || nd.username) db.prepare("UPDATE contacts SET name=? WHERE id=?").run(nd.name||'@'+nd.username, contact.id);
        } catch {}

        const conv = upsertConversation(contact.id, channel.id, 'instagram');

        const referral = msg.referral || msg.message?.referral;
        // If message is from a Meta Paid Ad (Instagram Click-to-Chat referral), auto-create a lead
        if (referral && !contact.lead_id) {
          createLeadFromReferral({
            contact,
            channel,
            referralData: referral,
            sourcePlatform: 'instagram'
          });
          const updatedContact = db.prepare("SELECT * FROM contacts WHERE id=?").get(contact.id);
          if (updatedContact) contact.lead_id = updatedContact.lead_id;
        }
        const text = msg.message.text || '[message]';
        saveMessage(conv.id, isEcho ? 'out' : 'in', text, 'text', msg.message.mid);
        console.log(`📸 Instagram [${channel.name}]: ${text}`);
      }
    }
  }

  // ── TikTok placeholder (future integration) ─────────────
  if (body.object === 'tiktok') {
    console.log('[tiktok] Webhook received but integration not yet implemented.');
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
  if (config.meta_ads_access_token) config.meta_ads_access_token = config.meta_ads_access_token.slice(0,12)+'••••••••';
  res.json(config);
});
app.post('/api/meta/config', (req, res) => {
  const allowed = ['page_access_token','capi_token','pixel_id','app_secret','verify_token','test_event_code','office_open','grace_minutes','meta_ads_access_token','meta_ad_account_id','wa_linked_auto_lead'];
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
// WHATSAPP LINKED DEVICE (Baileys — scan QR, no Meta App)
// ─────────────────────────────────────────────────────────
app.get('/api/whatsapp-linked/status', (req, res) => {
  res.json(getWaLinkedStatus());
});

app.post('/api/whatsapp-linked/connect', async (req, res) => {
  try {
    const s = await connectWaLinked();
    res.json(s);
  } catch (e) {
    console.error('[wa-linked] connect error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/whatsapp-linked/logout', async (req, res) => {
  try {
    res.json(await logoutWaLinked());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────────────────
// AUTOMATION HUB
// ─────────────────────────────────────────────────────────

// Automation Rules
app.get('/api/automation/rules', (req, res) => requireManagerOrAdmin(req, res, () => {
  const rows = db.prepare("SELECT * FROM automation_rules ORDER BY priority DESC, id DESC").all();
  res.json(rows.map(r => ({
    ...r,
    is_active: r.active === 1,
    trigger_config: r.trigger_config ? JSON.parse(r.trigger_config) : {},
    action_config: r.action_config ? JSON.parse(r.action_config) : {}
  })));
}));

app.post('/api/automation/rules', (req, res) => requireAdmin(req, res, () => {
  const { name, trigger_type, trigger_config, action_type, action_config, priority, active, is_active } = req.body || {};
  if (!name || !trigger_type || !action_type) return res.status(400).json({ error: 'name, trigger_type, and action_type are required' });
  const effectiveActive = is_active !== undefined ? (is_active ? 1 : 0) : (active !== undefined ? (active ? 1 : 0) : 1);
  const info = db.prepare(`INSERT INTO automation_rules (name, trigger_type, trigger_config, action_type, action_config, priority, active)
    VALUES (?,?,?,?,?,?,?)`).run(name, trigger_type, trigger_config ? JSON.stringify(trigger_config) : null, action_type, action_config ? JSON.stringify(action_config) : null, priority ?? 0, effectiveActive);
  const r = db.prepare("SELECT * FROM automation_rules WHERE id=?").get(info.lastInsertRowid);
  res.json({
    ...r,
    is_active: r.active === 1,
    trigger_config: r.trigger_config ? JSON.parse(r.trigger_config) : {},
    action_config: r.action_config ? JSON.parse(r.action_config) : {}
  });
}));

app.put('/api/automation/rules/:id', (req, res) => requireAdmin(req, res, () => {
  const { name, trigger_type, trigger_config, action_type, action_config, priority, active, is_active } = req.body || {};
  const cur = db.prepare("SELECT * FROM automation_rules WHERE id=?").get(req.params.id);
  if (!cur) return res.status(404).json({ error: 'Not found' });
  const effectiveActive = is_active !== undefined ? (is_active ? 1 : 0) : (active !== undefined ? (active ? 1 : 0) : null);
  db.prepare(`UPDATE automation_rules SET name=COALESCE(?,name), trigger_type=COALESCE(?,trigger_type), trigger_config=COALESCE(?,trigger_config), action_type=COALESCE(?,action_type), action_config=COALESCE(?,action_config), priority=COALESCE(?,priority), active=COALESCE(?,active) WHERE id=?`)
    .run(name ?? null, trigger_type ?? null, trigger_config ? JSON.stringify(trigger_config) : null, action_type ?? null, action_config ? JSON.stringify(action_config) : null, priority ?? null, effectiveActive, req.params.id);
  const r = db.prepare("SELECT * FROM automation_rules WHERE id=?").get(req.params.id);
  res.json({
    ...r,
    is_active: r.active === 1,
    trigger_config: r.trigger_config ? JSON.parse(r.trigger_config) : {},
    action_config: r.action_config ? JSON.parse(r.action_config) : {}
  });
}));

app.delete('/api/automation/rules/:id', (req, res) => requireAdmin(req, res, () => {
  db.prepare("DELETE FROM automation_rules WHERE id=?").run(req.params.id);
  res.json({ ok: true });
}));

// Test automation rule
app.post('/api/automation/rules/:id/test', (req, res) => requireAdmin(req, res, () => {
  const rule = db.prepare("SELECT * FROM automation_rules WHERE id=?").get(req.params.id);
  if (!rule) return res.status(404).json({ error: 'Rule not found' });
  res.json({ ok: true, message: 'Rule test would be triggered here' });
}));

// Message Templates
app.get('/api/templates', (req, res) => requireManagerOrAdmin(req, res, () => {
  const rows = db.prepare("SELECT * FROM message_templates ORDER BY category, usage_count DESC, id DESC").all();
  res.json(rows.map(r => {
    try { r.variables = r.variables ? JSON.parse(r.variables) : []; } catch (e) { r.variables = []; }
    return r;
  }));
}));

app.post('/api/templates', (req, res) => {
  const { name, category, language, content, variables, approved } = req.body || {};
  if (!name || !content) return res.status(400).json({ error: 'name and content are required' });
  const info = db.prepare(`INSERT INTO message_templates (name, category, language, content, variables, approved)
    VALUES (?,?,?,?,?,?)`).run(name, category || 'general', language || 'en', content, variables ? JSON.stringify(variables) : null, approved ?? 0);
  const r = db.prepare("SELECT * FROM message_templates WHERE id=?").get(info.lastInsertRowid);
  try { r.variables = r.variables ? JSON.parse(r.variables) : []; } catch (e) { r.variables = []; }
  res.json(r);
});

app.put('/api/templates/:id', (req, res) => {
  const { name, category, language, content, variables, approved } = req.body || {};
  const cur = db.prepare("SELECT * FROM message_templates WHERE id=?").get(req.params.id);
  if (!cur) return res.status(404).json({ error: 'Not found' });
  db.prepare(`UPDATE message_templates SET name=COALESCE(?,name), category=COALESCE(?,category), language=COALESCE(?,language), content=COALESCE(?,content), variables=COALESCE(?,variables), approved=COALESCE(?,approved) WHERE id=?`)
    .run(name ?? null, category ?? null, language ?? null, content ?? null, variables ? JSON.stringify(variables) : null, approved ?? null, req.params.id);
  const r = db.prepare("SELECT * FROM message_templates WHERE id=?").get(req.params.id);
  try { r.variables = r.variables ? JSON.parse(r.variables) : []; } catch (e) { r.variables = []; }
  res.json(r);
});

app.delete('/api/templates/:id', (req, res) => {
  db.prepare("DELETE FROM message_templates WHERE id=?").run(req.params.id);
  res.json({ ok: true });
});

// Contact Tags
app.get('/api/tags', (req, res) => requireManagerOrAdmin(req, res, () => {
  const rows = db.prepare("SELECT * FROM contact_tags ORDER BY name").all();
  const counts = db.prepare("SELECT tag_id, COUNT(*) as c FROM contact_tag_assignments GROUP BY tag_id").all();
  const countMap = Object.fromEntries(counts.map(c => [c.tag_id, c.c]));
  res.json(rows.map(r => ({ ...r, contact_count: countMap[r.id] || 0 })));
}));

app.post('/api/tags', (req, res) => requireAdmin(req, res, () => {
  const { name, color } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name is required' });
  try {
    const info = db.prepare("INSERT INTO contact_tags (name, color) VALUES (?,?)").run(name, color || '#3b82f6');
    res.json(db.prepare("SELECT * FROM contact_tags WHERE id=?").get(info.lastInsertRowid));
  } catch (e) {
    res.status(400).json({ error: e.message.includes('UNIQUE') ? 'Tag name already exists' : e.message });
  }
}));

app.delete('/api/tags/:id', (req, res) => requireAdmin(req, res, () => {
  db.prepare("DELETE FROM contact_tags WHERE id=?").run(req.params.id);
  res.json({ ok: true });
}));

app.get('/api/tags/:id/contacts', (req, res) => requireAdmin(req, res, () => {
  const contacts = db.prepare(`
    SELECT c.* FROM contacts c
    JOIN contact_tag_assignments cta ON cta.contact_id = c.id
    WHERE cta.tag_id = ?
  `).all(req.params.id);
  res.json({ contacts });
}));

// Conversation Notes
app.get('/api/conversations/:id/notes', (req, res) => {
  if (!userHasAccessToConversation(req.user, req.params.id)) return res.status(403).json({ error: 'Access denied' });
  const rows = db.prepare("SELECT * FROM conversation_notes WHERE conversation_id=? ORDER BY id DESC").all(req.params.id);
  res.json(rows);
});

app.post('/api/conversations/:id/notes', (req, res) => {
  if (!userHasAccessToConversation(req.user, req.params.id)) return res.status(403).json({ error: 'Access denied' });
  const { note, is_internal } = req.body || {};
  if (!note || !note.trim()) return res.status(400).json({ error: 'note is required' });
  const info = db.prepare(`INSERT INTO conversation_notes (conversation_id, note, author_id, author_name, is_internal)
    VALUES (?,?,?,?,?)`).run(req.params.id, note.trim(), req.user?.id || null, req.user?.name || null, is_internal == null ? 1 : (is_internal ? 1 : 0));
  res.json(db.prepare("SELECT * FROM conversation_notes WHERE id=?").get(info.lastInsertRowid));
});

// Conversation Tags
app.post('/api/conversations/:id/tags', (req, res) => {
  if (!userHasAccessToConversation(req.user, req.params.id)) return res.status(403).json({ error: 'Access denied' });
  const { tag_id } = req.body || {};
  if (!tag_id) return res.status(400).json({ error: 'tag_id is required' });
  const tag = db.prepare("SELECT * FROM contact_tags WHERE id=?").get(tag_id);
  if (!tag) return res.status(404).json({ error: 'Tag not found' });
  db.prepare("INSERT OR IGNORE INTO conversation_tags (conversation_id, tag_id) VALUES (?,?)").run(req.params.id, tag_id);
  res.json({ ok: true });
});

app.delete('/api/conversations/:id/tags', (req, res) => {
  if (!userHasAccessToConversation(req.user, req.params.id)) return res.status(403).json({ error: 'Access denied' });
  const { tag_id } = req.body || {};
  if (!tag_id) return res.status(400).json({ error: 'tag_id is required' });
  db.prepare("DELETE FROM conversation_tags WHERE conversation_id=? AND tag_id=?").run(req.params.id, tag_id);
  res.json({ ok: true });
});

// Broadcast Campaigns
app.get('/api/broadcast-campaigns', (req, res) => requireManagerOrAdmin(req, res, () => {
  const rows = db.prepare("SELECT * FROM broadcast_campaigns ORDER BY id DESC").all();
  res.json(rows);
}));

app.post('/api/broadcast-campaigns', (req, res) => requireAdmin(req, res, () => {
  const { name, segment_type, segment_config, segment_value, template_id, content, scheduled_at } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name is required' });
  let finalConfig = segment_config || {};
  if (segment_value) {
    if (segment_type === 'by_tag' || segment_type === 'tag') {
      finalConfig.tag_ids = [parseInt(segment_value)];
    } else if (segment_type === 'by_status' || segment_type === 'status') {
      finalConfig.lead_statuses = [segment_value];
    } else if (segment_type === 'by_channel' || segment_type === 'channel') {
      finalConfig.channel_types = [segment_value];
    }
  }
  const info = db.prepare(`INSERT INTO broadcast_campaigns (name, segment_type, segment_config, template_id, content, scheduled_at, created_by)
    VALUES (?,?,?,?,?,?,?)`).run(name, segment_type || null, JSON.stringify(finalConfig), template_id || null, content || null, scheduled_at || null, req.user?.name || req.user?.email || null);
  res.json(db.prepare("SELECT * FROM broadcast_campaigns WHERE id=?").get(info.lastInsertRowid));
}));

app.post('/api/broadcast-campaigns/:id/send', (req, res) => requireAdmin(req, res, async () => {
  const result = await sendBroadcast(req.params.id);
  if (result.error) return res.status(400).json({ error: result.error });
  res.json(result);
}));

app.delete('/api/broadcast-campaigns/:id', (req, res) => requireAdmin(req, res, () => {
  db.prepare("DELETE FROM broadcast_recipients WHERE campaign_id=?").run(req.params.id);
  db.prepare("DELETE FROM broadcast_campaigns WHERE id=?").run(req.params.id);
  res.json({ ok: true });
}));

app.post('/api/broadcast-campaigns/:id/pause', (req, res) => requireAdmin(req, res, () => {
  db.prepare("UPDATE broadcast_campaigns SET status='paused' WHERE id=?").run(req.params.id);
  res.json({ ok: true });
}));

app.post('/api/broadcast-campaigns/:id/resume', (req, res) => requireAdmin(req, res, () => {
  db.prepare("UPDATE broadcast_campaigns SET status='sending' WHERE id=?").run(req.params.id);
  res.json({ ok: true });
}));

// Automation Analytics
app.get('/api/automation/stats', (req, res) => requireManagerOrAdmin(req, res, () => {
  const today = new Date().toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const totalTriggered = db.prepare("SELECT COUNT(*) as c FROM automation_analytics WHERE event_type='triggered'").get().c;
  const totalExecuted = db.prepare("SELECT COUNT(*) as c FROM automation_analytics WHERE event_type='executed'").get().c;
  const totalFailed = db.prepare("SELECT COUNT(*) as c FROM automation_analytics WHERE event_type='failed'").get().c;
  const rulesTriggeredToday = db.prepare("SELECT COUNT(*) as c FROM automation_analytics WHERE event_type='triggered' AND date(created_at)=?").get(today).c;
  const messagesSentToday = db.prepare("SELECT COUNT(*) as c FROM messages WHERE direction='out' AND date(created_at)=? AND sent_by='auto'").get(today).c;
  const templatesUsedToday = db.prepare("SELECT COUNT(*) as c FROM message_templates WHERE usage_count > 0").get().c;
  const activeConversations = db.prepare("SELECT COUNT(*) as c FROM conversations WHERE status='open' AND last_message_at >= ?").get(sevenDaysAgo).c;

  const messagesPerChannel = db.prepare(`
    SELECT c.name, COUNT(*) as count
    FROM messages m
    JOIN conversations conv ON conv.id = m.conversation_id
    JOIN channels c ON c.id = conv.channel_id
    WHERE m.created_at >= ? AND m.direction='in'
    GROUP BY c.id
    ORDER BY count DESC
  `).all(sevenDaysAgo);

  const triggersOverTime = db.prepare(`
    SELECT date(created_at) as date, COUNT(*) as count
    FROM automation_analytics
    WHERE event_type='triggered' AND created_at >= ?
    GROUP BY date(created_at)
    ORDER BY date
  `).all(sevenDaysAgo);

  const topRules = db.prepare(`
    SELECT r.id, r.name, COUNT(*) as count
    FROM automation_analytics a
    JOIN automation_rules r ON r.id = a.rule_id
    WHERE a.event_type='executed' AND a.created_at >= ?
    GROUP BY r.id
    ORDER BY count DESC
    LIMIT 10
  `).all(sevenDaysAgo);

  // Average response time: time between first inbound and first outbound reply
  const avgResponse = db.prepare(`
    SELECT AVG(
      (julianday(first_out.created_at) - julianday(first_in.created_at)) * 24 * 60
    ) as avg_minutes
    FROM (
      SELECT conversation_id, MIN(created_at) as created_at
      FROM messages
      WHERE direction='in' AND created_at >= ?
      GROUP BY conversation_id
    ) first_in
    JOIN (
      SELECT conversation_id, MIN(created_at) as created_at
      FROM messages
      WHERE direction='out' AND is_internal_note=0
      GROUP BY conversation_id
    ) first_out ON first_in.conversation_id = first_out.conversation_id
    WHERE first_out.created_at > first_in.created_at
  `).get(sevenDaysAgo);

  const totalConversations = db.prepare("SELECT COUNT(*) as c FROM conversations WHERE last_message_at >= ?").get(sevenDaysAgo).c;
  const archivedConversations = db.prepare("SELECT COUNT(*) as c FROM conversations WHERE status='archived' AND last_message_at >= ?").get(sevenDaysAgo).c;
  const resolutionRate = totalConversations > 0 ? Math.round((archivedConversations / totalConversations) * 100) : 0;

  const recent = db.prepare("SELECT * FROM automation_analytics ORDER BY id DESC LIMIT 50").all();

  res.json({
    totalTriggered,
    totalExecuted,
    totalFailed,
    rules_triggered_today: rulesTriggeredToday,
    messages_sent_today: messagesSentToday,
    templates_used_today: templatesUsedToday,
    active_conversations: activeConversations,
    messages_per_channel: messagesPerChannel,
    triggers_over_time: triggersOverTime,
    top_rules: topRules,
    avg_response_time_minutes: Math.round(avgResponse?.avg_minutes || 0),
    resolution_rate: resolutionRate,
    byRule: db.prepare("SELECT rule_id, event_type, COUNT(*) as c FROM automation_analytics GROUP BY rule_id, event_type").all(),
    recent,
  });
}));

// ─────────────────────────────────────────────────────────
// SETTINGS
// ─────────────────────────────────────────────────────────
// ==========================================
// DESTINATIONS API
// ==========================================
app.get('/api/destinations', (req, res) => {
  try {
    const destinations = db.prepare("SELECT * FROM destinations ORDER BY name ASC").all();
    res.json(destinations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/public/destinations/:slug', (req, res) => {
  try {
    const dest = db.prepare("SELECT * FROM destinations WHERE slug=? AND is_public=1").get(req.params.slug);
    if (!dest) return res.status(404).json({ error: 'Destination not found' });
    res.json(dest);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/destinations', (req, res) => requireAdmin(req, res, () => {
  try {
    const { name, requirements, programs, fees, embassy_documents, application_processing, other_details, is_public } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    
    let slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    let existingSlug = db.prepare("SELECT id FROM destinations WHERE slug=?").get(slug);
    if (existingSlug) {
      slug = slug + '-' + Date.now().toString().slice(-4);
    }
    
    const info = db.prepare(`
      INSERT INTO destinations (slug, name, requirements, programs, fees, embassy_documents, application_processing, other_details, is_public)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(slug, name, requirements || '', programs || '', fees || '', embassy_documents || '', application_processing || '', other_details || '', is_public ? 1 : 0);
    
    res.json({ success: true, id: info.lastInsertRowid });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}));

app.put('/api/destinations/:id', (req, res) => requireAdmin(req, res, () => {
  try {
    const { name, requirements, programs, fees, embassy_documents, application_processing, other_details, is_public } = req.body;
    db.prepare(`
      UPDATE destinations 
      SET name=?, requirements=?, programs=?, fees=?, embassy_documents=?, application_processing=?, other_details=?, is_public=?
      WHERE id=?
    `).run(name, requirements || '', programs || '', fees || '', embassy_documents || '', application_processing || '', other_details || '', is_public ? 1 : 0, req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}));

app.delete('/api/destinations/:id', (req, res) => requireAdmin(req, res, () => {
  try {
    db.prepare("DELETE FROM destinations WHERE id=?").run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}));

app.get('/api/settings', (req, res) => {
  const getList = (key, defaults) => {
    const val = getConfig(key);
    try { if (val) return JSON.parse(val); } catch {}
    return defaults;
  };

  // Auto-align with active employees list (all employees are consultants by default)
  let activeEmployees = [];
  try {
    activeEmployees = db.prepare("SELECT id, name, emp_id, role FROM employees WHERE active = 'Yes' OR active IS NULL OR active = '1' ORDER BY name").all();
  } catch (e) {
    console.error("Could not fetch active employees for settings:", e);
  }
  const combinedConsultants = Array.from(new Set(activeEmployees.map(e => e.name))).filter(Boolean).sort();

  // Document templates from settings (object keyed by destination)
  let docTemplates = DOC_TEMPLATES;
  try {
    const saved = getConfig('settings_docTemplates');
    if (saved) docTemplates = JSON.parse(saved);
  } catch {}

  res.json({
    consultants: combinedConsultants,
    employees: activeEmployees,
    leadSources: getList('settings_leadSources', ['China Web Form','Web Lead (New)','Client Sheet','WhatsApp','Messenger','Facebook Ad','Instagram Ad','Referral','Walk-in','YouTube','Google Ad','Meta Lead Ad']),
    destinations: (function(){
      try {
        const rows = db.prepare("SELECT name FROM destinations").all();
        if(rows.length > 0) return rows.map(r => r.name);
      } catch(e){}
      return ['China', 'Malta', 'Hungary', 'Greece', 'Estonia', 'Georgia', 'Malaysia', 'Thailand'];
    })(),
    intakes: (function(){
      try { return db.prepare("SELECT DISTINCT intake_term FROM leads WHERE intake_term IS NOT NULL AND intake_term != '' ORDER BY intake_term").all().map(r => r.intake_term); } catch(e){}
      return [];
    })(),
    pages: (function(){
      try { return db.prepare("SELECT DISTINCT page_name FROM leads WHERE page_name IS NOT NULL AND page_name != '' AND page_name != 'Unknown Page' ORDER BY page_name").all().map(r => r.page_name); } catch(e){}
      return [];
    })(),
    ads: (function(){
      try { return db.prepare("SELECT DISTINCT ad_name FROM leads WHERE ad_name IS NOT NULL AND ad_name != '' ORDER BY ad_name").all().map(r => r.ad_name); } catch(e){}
      return [];
    })(),
    leadStatuses: getList('settings_leadStatuses', ['New Lead','No Response','Follow-up','Positive','Office Visited','File Opened','Enrolled','Not Interested']),
    fileStages: getList('settings_fileStages', [
      'Documents Collecting',
      'Documents Ready',
      'Applied to University',
      'Interview',
      'Pre-Admission',
      'University Initial Deposit',
      'Admission/JW Received',
      'Visa Applied',
      'Passport Collection',
      'Payment',
      'Air Ticket',
      'Fly'
    ]),
    paymentStatuses: getList('settings_paymentStatuses', ['Pending','Partial','Paid','Refunded']),
    incomeCategories: getList('settings_incomeCategories', ['Service Charge','Application Deposit','App Fee','File Opening','Marketing Refund','Invest','Previous Cash','Other Income']),
    expenseCategories: getList('settings_expenseCategories', ['Salary','Office Rent','Marketing','Air Ticket','Airport Pickup','App Fee','Visa Fee','Medical','Mobile Recharge','Client Lunch+Snacks','Transport','Bua Bill','Tissue+Room Spray','Letterhead','Logo','Job Post','Testimonial Video','Review','Yearly Fee','Electrician+Sign Board','Mata Support','Other Expense']),
    docTemplates,
  });
});

app.post('/api/settings', (req, res) => requireAdmin(req, res, () => {
  const { key, value } = req.body || {};
  if (!key) {
    return res.status(400).json({ error: 'key is required' });
  }
  const allowedKeys = [
    'settings_leadSources',
    'settings_leadStatuses',
    'settings_fileStages',
    'settings_paymentStatuses',
    'settings_incomeCategories',
    'settings_expenseCategories',
    'settings_docTemplates'
  ];
  if (!allowedKeys.includes(key)) {
    return res.status(400).json({ error: 'invalid settings key' });
  }
  setConfig(key, JSON.stringify(value));
  res.json({ ok: true });
}));

// ─────────────────────────────────────────────────────────
// MARKETING / SOCIAL AUTOMATION  (admin + manager UI; n8n via x-api-key)
// ─────────────────────────────────────────────────────────
// Access guard: admin, manager, or trusted n8n service (super_admin via x-api-key).
function requireMarketing(req, res, next) {
  if (isFullAdmin(req.user) || userHasAnyRole(req.user, 'marketing_manager') || req.user?.role === 'super_admin') return next();
  return res.status(403).json({ error: 'Marketing access required' });
}
// Keep only whitelisted, present keys from a request body.
function pickFields(body, allowed) {
  const out = {};
  for (const k of allowed) if (body && body[k] !== undefined) out[k] = body[k];
  return out;
}
// Generic CRUD for simple marketing tables.
function marketingCrud(path, table, cols) {
  app.get(`/api/marketing/${path}`, (req, res) => requireMarketing(req, res, () => {
    res.json(db.prepare(`SELECT * FROM ${table} ORDER BY id DESC`).all());
  }));
  app.post(`/api/marketing/${path}`, (req, res) => requireMarketing(req, res, () => {
    const data = pickFields(req.body, cols);
    const keys = Object.keys(data);
    if (!keys.length) return res.status(400).json({ error: 'no valid fields' });
    const info = db.prepare(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`).run(...keys.map(k => data[k]));
    res.json(db.prepare(`SELECT * FROM ${table} WHERE id=?`).get(info.lastInsertRowid));
  }));
  app.put(`/api/marketing/${path}/:id`, (req, res) => requireMarketing(req, res, () => {
    const data = pickFields(req.body, cols);
    const keys = Object.keys(data);
    if (!keys.length) return res.status(400).json({ error: 'no valid fields' });
    db.prepare(`UPDATE ${table} SET ${keys.map(k => k + '=?').join(',')} WHERE id=?`).run(...keys.map(k => data[k]), req.params.id);
    res.json(db.prepare(`SELECT * FROM ${table} WHERE id=?`).get(req.params.id));
  }));
  app.delete(`/api/marketing/${path}/:id`, (req, res) => requireMarketing(req, res, () => {
    db.prepare(`DELETE FROM ${table} WHERE id=?`).run(req.params.id);
    res.json({ ok: true });
  }));
}

const POST_COLS = ['week','post_date','slot_time','page','pillar','format','hook','body','hashtags','brief','asset_url','status','rejection_reason','published_url','reach','engagement','source'];

// ── Content posts (weekly calendar) ──
app.get('/api/marketing/posts', (req, res) => requireMarketing(req, res, () => {
  const { week, page, status } = req.query;
  const where = [], params = [];
  if (week)   { where.push('week=?');   params.push(week); }
  if (page)   { where.push('page=?');   params.push(page); }
  if (status) { where.push('status=?'); params.push(status); }
  const sql = `SELECT * FROM content_posts ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY post_date, slot_time`;
  res.json(db.prepare(sql).all(...params));
}));

// n8n pulls what to publish: approved/asset_ready posts due today or earlier.
app.get('/api/marketing/posts/due', (req, res) => requireMarketing(req, res, () => {
  const limit = parseInt(req.query.limit) || 20;
  const rows = db.prepare(
    `SELECT * FROM content_posts WHERE status IN ('approved','asset_ready') ORDER BY created_at DESC LIMIT ?`
  ).all(limit);
  res.json(rows);
}));

app.post('/api/marketing/posts', (req, res) => requireMarketing(req, res, () => {
  const data = pickFields(req.body, POST_COLS);
  const keys = Object.keys(data);
  if (!keys.length) return res.status(400).json({ error: 'no valid fields' });
  const info = db.prepare(`INSERT INTO content_posts (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`).run(...keys.map(k => data[k]));
  res.json(db.prepare(`SELECT * FROM content_posts WHERE id=?`).get(info.lastInsertRowid));
}));

app.put('/api/marketing/posts/:id/status', (req, res) => requireMarketing(req, res, () => {
  const { status, rejection_reason } = req.body || {};
  const allowed = ['drafted','approved','edit','rejected','asset_ready','scheduled','published'];
  if (!allowed.includes(status)) return res.status(400).json({ error: 'invalid status' });
  db.prepare(`UPDATE content_posts SET status=?, rejection_reason=?, updated_at=datetime('now') WHERE id=?`)
    .run(status, rejection_reason || null, req.params.id);
  res.json(db.prepare(`SELECT * FROM content_posts WHERE id=?`).get(req.params.id));
}));

app.put('/api/marketing/posts/:id/published', (req, res) => requireMarketing(req, res, () => {
  const { published_url, reach, engagement } = req.body || {};
  db.prepare(`UPDATE content_posts SET status='published', published_url=?, reach=?, engagement=?, updated_at=datetime('now') WHERE id=?`)
    .run(published_url || null, reach ?? null, engagement ?? null, req.params.id);
  res.json(db.prepare(`SELECT * FROM content_posts WHERE id=?`).get(req.params.id));
}));

app.put('/api/marketing/posts/:id', (req, res) => requireMarketing(req, res, () => {
  const data = pickFields(req.body, POST_COLS);
  const keys = Object.keys(data);
  if (!keys.length) return res.status(400).json({ error: 'no valid fields' });
  db.prepare(`UPDATE content_posts SET ${keys.map(k => k + '=?').join(',')}, updated_at=datetime('now') WHERE id=?`)
    .run(...keys.map(k => data[k]), req.params.id);
  res.json(db.prepare(`SELECT * FROM content_posts WHERE id=?`).get(req.params.id));
}));

app.delete('/api/marketing/posts/:id', (req, res) => requireMarketing(req, res, () => {
  db.prepare(`DELETE FROM content_posts WHERE id=?`).run(req.params.id);
  res.json({ ok: true });
}));

// Bulk approve a whole week (drafted + edit -> approved).
app.post('/api/marketing/posts/approve-week', (req, res) => requireMarketing(req, res, () => {
  const { week } = req.body || {};
  if (!week) return res.status(400).json({ error: 'week required' });
  const info = db.prepare(`UPDATE content_posts SET status='approved', updated_at=datetime('now') WHERE week=? AND status IN ('drafted','edit')`).run(week);
  logActivity({ type: 'content_week_approved', actor: req.user, to: week, details: { approved: info.changes } });
  res.json({ ok: true, approved: info.changes });
}));

// n8n writes a generated week. Replaces only its own un-touched drafts so it never clobbers your edits/approvals.
app.post('/api/marketing/plan/import', (req, res) => requireMarketing(req, res, () => {
  const { week, posts } = req.body || {};
  if (!week || !Array.isArray(posts)) return res.status(400).json({ error: 'week and posts[] required' });
  // Clear only the drafted n8n posts for the PAGES present in this import, so split
  // per-page workflows (china / bd / tiktok) don't wipe each other's drafts. Falls back
  // to clearing the whole week when posts span all pages (single combined import).
  const pages = [...new Set((posts || []).map(p => p && p.page).filter(Boolean))];
  if (pages.length) {
    const ph = pages.map(() => '?').join(',');
    db.prepare(`DELETE FROM content_posts WHERE week=? AND source='n8n' AND status='drafted' AND page IN (${ph})`).run(week, ...pages);
  } else {
    db.prepare(`DELETE FROM content_posts WHERE week=? AND source='n8n' AND status='drafted'`).run(week);
  }
  let inserted = 0;
  const stmt = db.prepare(`INSERT INTO content_posts (${POST_COLS.join(',')}) VALUES (${POST_COLS.map(() => '?').join(',')})`);
  for (const p of posts) {
    const row = { ...p, week, source: 'n8n', status: p.status || 'drafted' };
    stmt.run(...POST_COLS.map(c => row[c] ?? null));
    inserted++;
  }
  logActivity({ type: 'content_plan_imported', actor: req.user, to: week, details: { posts: inserted } });
  if (typeof broadcast === 'function') broadcast('content_plan_ready', { week, count: inserted });
  res.json({ ok: true, week, inserted });
}));

// ── Simple tables (evergreen, competitors, knowledge base) ──
marketingCrud('evergreen', 'evergreen_bank', ['page_pool','pillar','body','hashtags','asset_url','status']);
marketingCrud('competitors', 'competitor_intel', ['log_date','competitor','channel','observation','link','our_angle','added_by']);
marketingCrud('kb/universities', 'kb_universities', ['name','country','city','programs','intakes','tuition','lang_req','admission_url','brochure_url','partner','notes','last_verified']);
marketingCrud('kb/scholarships', 'kb_scholarships', ['name','country','type','coverage','eligibility','deadline','source_url','status','last_verified','notes']);
marketingCrud('kb/sources', 'kb_sources', ['topic','url','source_type','use_for','date_added','notes']);
marketingCrud('kb/docs', 'kb_docs', ['name','type','destination','drive_url','version','owner','updated_at']);
marketingCrud('partner-agencies', 'partner_agencies', ['agency_name','contact_person','phone','email','commission_rate']);

// ── Brain API pool (rotation state; secrets stay in n8n) ──
app.get('/api/marketing/brain', (req, res) => requireMarketing(req, res, () => {
  res.json(db.prepare(`SELECT * FROM brain_api_pool ORDER BY priority`).all());
}));
app.post('/api/marketing/brain', (req, res) => requireMarketing(req, res, () => {
  const cols = ['priority','provider','model','cred_label','req_min','req_day','used_today','status','cooldown_until','notes'];
  const data = pickFields(req.body, cols);
  const keys = Object.keys(data);
  if (!keys.length) return res.status(400).json({ error: 'no valid fields' });
  const info = db.prepare(`INSERT INTO brain_api_pool (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`).run(...keys.map(k => data[k]));
  res.json(db.prepare(`SELECT * FROM brain_api_pool WHERE id=?`).get(info.lastInsertRowid));
}));
app.put('/api/marketing/brain/:id', (req, res) => requireMarketing(req, res, () => {
  const cols = ['priority','provider','model','cred_label','req_min','req_day','used_today','status','cooldown_until','notes'];
  const data = pickFields(req.body, cols);
  const keys = Object.keys(data);
  if (!keys.length) return res.status(400).json({ error: 'no valid fields' });
  db.prepare(`UPDATE brain_api_pool SET ${keys.map(k => k + '=?').join(',')} WHERE id=?`).run(...keys.map(k => data[k]), req.params.id);
  res.json(db.prepare(`SELECT * FROM brain_api_pool WHERE id=?`).get(req.params.id));
}));
app.delete('/api/marketing/brain/:id', (req, res) => requireMarketing(req, res, () => {
  db.prepare(`DELETE FROM brain_api_pool WHERE id=?`).run(req.params.id);
  res.json({ ok: true });
}));

// ── Social Media Engine v2.0 — New Tables ──
marketingCrud('research', 'research_intelligence', ['topic','category','urgency','competitor','source_url','source_type','insight_summary','recommended_angle','evidence','status','used_in_post_id','research_date']);
marketingCrud('viral-topics', 'viral_topics', ['topic','platform','hashtag','relevance_score','engagement_velocity','reach_estimate','sentiment','why_viral','recommended_hook','recommended_cta','recommended_pillar','status','used_in_post_id']);
marketingCrud('psychology', 'psychology_profiles', ['segment','pain_points','aspirations','fears','trusted_sources','decision_factors','content_preferences','peak_hours','language_preference','voice_tone','primary_platform','secondary_platform']);
marketingCrud('scripts', 'content_scripts', ['script_name','category','destination','pillar','format','hook','body','cta','duration_seconds','shot_list','on_screen_text','psychology_target','avg_score','usage_count','status']);
marketingCrud('hooks', 'content_hooks', ['hook_text','hook_type','destination','pillar','format','psychology_target','usage_count','avg_reach','avg_engagement','conversion_rate','status']);
marketingCrud('ab-tests', 'ab_tests', ['test_name','variable','variant_a','variant_b','variant_c','page','start_date','end_date','status','a_reach','a_engagement','a_leads','b_reach','b_engagement','b_leads','c_reach','c_engagement','c_leads','winner','winner_confidence','insights']);
marketingCrud('scale-up', 'scale_up_recommendations', ['recommendation_type','title','description','expected_impact','expected_lead_lift','confidence_score','based_on_data','action_items','status','approved_by']);
marketingCrud('publishing-queue', 'publishing_queue', ['post_id','page','platform','scheduled_at','published_at','status','error_message','platform_post_id','platform_post_url','reach','engagement']);
marketingCrud('creative-guidelines', 'creative_guidelines', ['guideline_name','category','platform','specification','examples','do_s','dont_s']);
marketingCrud('offer-sources', 'offer_sources', ['name','url','source_type','description','drive_folder_url','is_active']);

// ── Designer Queue ──
app.get('/api/marketing/designer-queue', (req, res) => requireMarketing(req, res, () => {
  const { status, designer_id } = req.query;
  const where = [], params = [];
  if (status) { where.push('status=?'); params.push(status); }
  if (designer_id) { where.push('designer_id=?'); params.push(designer_id); }
  const sql = `SELECT * FROM designer_queue ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY created_at DESC`;
  res.json(db.prepare(sql).all(...params));
}));
app.post('/api/marketing/designer-queue', (req, res) => requireMarketing(req, res, () => {
  const cols = ['post_id','designer_id','brief','priority','deadline','status','draft_asset_url','final_asset_url','feedback'];
  const data = pickFields(req.body, cols);
  const keys = Object.keys(data);
  if (!keys.length) return res.status(400).json({ error: 'no valid fields' });
  const info = db.prepare(`INSERT INTO designer_queue (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`).run(...keys.map(k => data[k]));
  res.json(db.prepare(`SELECT * FROM designer_queue WHERE id=?`).get(info.lastInsertRowid));
}));
app.put('/api/marketing/designer-queue/:id', (req, res) => requireMarketing(req, res, () => {
  const cols = ['post_id','designer_id','brief','priority','deadline','status','draft_asset_url','final_asset_url','feedback'];
  const data = pickFields(req.body, cols);
  const keys = Object.keys(data);
  if (!keys.length) return res.status(400).json({ error: 'no valid fields' });
  db.prepare(`UPDATE designer_queue SET ${keys.map(k => k + '=?').join(',')} WHERE id=?`).run(...keys.map(k => data[k]), req.params.id);
  res.json(db.prepare(`SELECT * FROM designer_queue WHERE id=?`).get(req.params.id));
}));
app.delete('/api/marketing/designer-queue/:id', (req, res) => requireMarketing(req, res, () => {
  db.prepare(`DELETE FROM designer_queue WHERE id=?`).run(req.params.id);
  res.json({ ok: true });
}));

// ── Quality Score ──
app.get('/api/marketing/posts/:id/quality', (req, res) => requireMarketing(req, res, () => {
  const post = db.prepare(`SELECT id, quality_score, quality_checks FROM content_posts WHERE id=?`).get(req.params.id);
  if (!post) return res.status(404).json({ error: 'not found' });
  res.json(post);
}));
app.put('/api/marketing/posts/:id/quality', (req, res) => requireMarketing(req, res, () => {
  const { quality_score, quality_checks } = req.body || {};
  db.prepare(`UPDATE content_posts SET quality_score=?, quality_checks=?, updated_at=datetime('now') WHERE id=?`)
    .run(quality_score ?? null, quality_checks ?? null, req.params.id);
  res.json(db.prepare(`SELECT * FROM content_posts WHERE id=?`).get(req.params.id));
}));

// ── Analytics ──
app.get('/api/marketing/analytics/overview', (req, res) => requireMarketing(req, res, () => {
  const days = parseInt(req.query.days) || 30;
  const total = db.prepare(`SELECT COUNT(*) as c FROM content_posts`).get().c;
  const published = db.prepare(`SELECT COUNT(*) as c FROM content_posts WHERE status='published' AND created_at >= date('now', '-${days} days')`).get().c;
  const drafted = db.prepare(`SELECT COUNT(*) as c FROM content_posts WHERE status='drafted'`).get().c;
  const avgReach = db.prepare(`SELECT AVG(reach) as avg FROM content_posts WHERE status='published' AND created_at >= date('now', '-${days} days')`).get().avg || 0;
  const totalLeads = db.prepare(`SELECT SUM(leads) as s FROM content_posts WHERE status='published' AND created_at >= date('now', '-${days} days')`).get().s || 0;
  res.json({ total, published, drafted, avgReach: Math.round(avgReach), totalLeads });
}));

app.get('/api/marketing/analytics/funnel', (req, res) => requireMarketing(req, res, () => {
  const days = parseInt(req.query.days) || 30;
  const reach = db.prepare(`SELECT SUM(reach) as s FROM content_posts WHERE status='published' AND created_at >= date('now', '-${days} days')`).get().s || 0;
  const leads = db.prepare(`SELECT COUNT(*) as c FROM leads WHERE created_at >= date('now', '-${days} days')`).get().c || 0;
  const files = db.prepare(`SELECT COUNT(*) as c FROM leads WHERE application_stage IS NOT NULL AND created_at >= date('now', '-${days} days')`).get().c || 0;
  const enrolled = db.prepare(`SELECT COUNT(*) as c FROM leads WHERE lead_status='enrolled' AND created_at >= date('now', '-${days} days')`).get().c || 0;
  res.json({ reach, leads, files, enrolled, conversion_leads: reach ? (leads/reach*100).toFixed(1) : 0, conversion_files: leads ? (files/leads*100).toFixed(1) : 0, conversion_enrolled: files ? (enrolled/files*100).toFixed(1) : 0 });
}));

app.get('/api/marketing/analytics/pillars', (req, res) => requireMarketing(req, res, () => {
  const days = parseInt(req.query.days) || 30;
  const rows = db.prepare(`SELECT pillar, COUNT(*) as posts, AVG(reach) as avg_reach, AVG(engagement) as avg_engagement, SUM(leads) as total_leads FROM content_posts WHERE status='published' AND created_at >= date('now', '-${days} days') GROUP BY pillar`).all();
  res.json(rows);
}));

app.get('/api/marketing/analytics/pages', (req, res) => requireMarketing(req, res, () => {
  const days = parseInt(req.query.days) || 30;
  const rows = db.prepare(`SELECT page, COUNT(*) as posts, AVG(reach) as avg_reach, AVG(engagement) as avg_engagement, SUM(leads) as total_leads FROM content_posts WHERE status='published' AND created_at >= date('now', '-${days} days') GROUP BY page`).all();
  res.json(rows);
}));

app.get('/api/marketing/analytics/consistency', (req, res) => requireMarketing(req, res, () => {
  // Count published posts per week vs target (7 per page = 28/week total, adjusted for IG=BD, TikTok=3)
  // Target: China 7, BD 7, TikTok 3 = 17 distinct posts/week (Instagram mirrors BD)
  const targetPerWeek = 17;
  const weeks = db.prepare(`SELECT week, COUNT(*) as c FROM content_posts WHERE status='published' GROUP BY week ORDER BY week DESC LIMIT 12`).all();
  const scores = weeks.map(w => ({ week: w.week, published: w.c, target: targetPerWeek, score: Math.round((w.c / targetPerWeek) * 100) }));
  res.json(scores);
}));

app.get('/api/marketing/analytics/attribution', (req, res) => requireMarketing(req, res, () => {
  const days = parseInt(req.query.days) || 30;
  const rows = db.prepare(`
    SELECT cp.page, cp.pillar, cp.hook, cp.id as post_id, COUNT(la.lead_id) as lead_count, SUM(la.enrollment_value) as revenue
    FROM content_posts cp
    LEFT JOIN lead_attribution la ON cp.id = la.content_post_id
    WHERE cp.status='published' AND cp.created_at >= date('now', '-${days} days')
    GROUP BY cp.id
    ORDER BY lead_count DESC
    LIMIT 50
  `).all();
  res.json(rows);
}));

app.get('/api/marketing/analytics/hook-performance', (req, res) => requireMarketing(req, res, () => {
  const days = parseInt(req.query.days) || 30;
  const rows = db.prepare(`
    SELECT hook, COUNT(*) as uses, AVG(reach) as avg_reach, AVG(engagement) as avg_engagement, SUM(leads) as total_leads
    FROM content_posts
    WHERE status='published' AND hook IS NOT NULL AND created_at >= date('now', '-${days} days')
    GROUP BY hook
    ORDER BY total_leads DESC
    LIMIT 20
  `).all();
  res.json(rows);
}));

app.get('/api/marketing/analytics/scale-up-signals', (req, res) => requireMarketing(req, res, () => {
  const days = parseInt(req.query.days) || 30;
  const pillars = db.prepare(`SELECT pillar, AVG(engagement) as avg_engagement FROM content_posts WHERE status='published' AND created_at >= date('now', '-${days} days') GROUP BY pillar ORDER BY avg_engagement DESC`).all();
  const pages = db.prepare(`SELECT page, AVG(engagement) as avg_engagement FROM content_posts WHERE status='published' AND created_at >= date('now', '-${days} days') GROUP BY page ORDER BY avg_engagement DESC`).all();
  const topHooks = db.prepare(`SELECT hook, AVG(reach) as avg_reach FROM content_posts WHERE status='published' AND hook IS NOT NULL AND created_at >= date('now', '-${days} days') GROUP BY hook ORDER BY avg_reach DESC LIMIT 10`).all();
  res.json({ pillars, pages, topHooks });
}));

// ── Research Engine Analytics ──
app.get('/api/marketing/research/competitor-summary', (req, res) => requireMarketing(req, res, () => {
  const days = parseInt(req.query.days) || 30;
  const rows = db.prepare(`
    SELECT competitor, COUNT(*) as findings, 
      SUM(CASE WHEN urgency='critical' THEN 1 ELSE 0 END) as critical_count,
      SUM(CASE WHEN urgency='high' THEN 1 ELSE 0 END) as high_count,
      MAX(research_date) as last_seen
    FROM research_intelligence
    WHERE research_date >= date('now', '-${days} days')
    GROUP BY competitor
    ORDER BY findings DESC
  `).all();
  res.json(rows);
}));

app.get('/api/marketing/research/feed', (req, res) => requireMarketing(req, res, () => {
  const limit = parseInt(req.query.limit) || 50;
  const rows = db.prepare(`
    SELECT * FROM research_intelligence
    ORDER BY 
      CASE urgency
        WHEN 'critical' THEN 1
        WHEN 'high' THEN 2
        WHEN 'normal' THEN 3
        WHEN 'low' THEN 4
      END,
      research_date DESC
    LIMIT ?
  `).all(limit);
  res.json(rows);
}));

app.get('/api/marketing/research/gap-analysis', (req, res) => requireMarketing(req, res, () => {
  // What competitors post about that we don't
  const competitorTopics = db.prepare(`
    SELECT DISTINCT topic, competitor, category, recommended_angle
    FROM research_intelligence
    WHERE category = 'competitor_move' AND status != 'archived'
    ORDER BY research_date DESC
    LIMIT 100
  `).all();
  const ourPillars = db.prepare(`SELECT DISTINCT pillar FROM content_posts WHERE status IN ('published','scheduled','approved')`).all().map(r => r.pillar);
  const gaps = competitorTopics.filter(ct => !ourPillars.includes(ct.recommended_angle));
  res.json({ competitorTopics, ourPillars, gaps });
}));

// ── Content Factory Data Sources ──
app.get('/api/marketing/kb/universities/search', (req, res) => requireMarketing(req, res, () => {
  const { q, country, limit } = req.query;
  let sql = 'SELECT * FROM kb_universities WHERE 1=1';
  const params = [];
  if (q) { sql += ' AND (name LIKE ? OR city LIKE ? OR programs LIKE ?)'; params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  if (country) { sql += ' AND country = ?'; params.push(country); }
  sql += ' ORDER BY partner DESC, name LIMIT ?';
  params.push(parseInt(limit) || 20);
  res.json(db.prepare(sql).all(...params));
}));

app.get('/api/marketing/kb/scholarships/search', (req, res) => requireMarketing(req, res, () => {
  const { q, country, status, limit } = req.query;
  let sql = 'SELECT * FROM kb_scholarships WHERE 1=1';
  const params = [];
  if (q) { sql += ' AND (name LIKE ? OR coverage LIKE ? OR eligibility LIKE ?)'; params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  if (country) { sql += ' AND country = ?'; params.push(country); }
  if (status) { sql += ' AND status = ?'; params.push(status); }
  sql += ' ORDER BY deadline LIMIT ?';
  params.push(parseInt(limit) || 20);
  res.json(db.prepare(sql).all(...params));
}));

app.get('/api/marketing/hooks/best', (req, res) => requireMarketing(req, res, () => {
  const { page, pillar, destination, limit } = req.query;
  let sql = 'SELECT * FROM content_hooks WHERE 1=1';
  const params = [];
  if (page) { sql += ' AND (page = ? OR page IS NULL)'; params.push(page); }
  if (pillar) { sql += ' AND (pillar = ? OR pillar IS NULL)'; params.push(pillar); }
  if (destination) { sql += ' AND (destination = ? OR destination IS NULL)'; params.push(destination); }
  sql += ' ORDER BY conversion_rate DESC, usage_count DESC LIMIT ?';
  params.push(parseInt(limit) || 10);
  res.json(db.prepare(sql).all(...params));
}));

app.get('/api/marketing/research/active', (req, res) => requireMarketing(req, res, () => {
  const rows = db.prepare(`
    SELECT * FROM research_intelligence
    WHERE status IN ('new','reviewed') AND (urgency IN ('critical','high') OR category IN ('viral_signal','offer_alert','trending_topic'))
    ORDER BY urgency_sort, research_date DESC
    LIMIT 20
  `).all();
  res.json(rows);
}));

// ── Lead Attribution ──
app.get('/api/marketing/attribution/summary', (req, res) => requireMarketing(req, res, () => {
  const days = parseInt(req.query.days) || 30;
  const rows = db.prepare(`
    SELECT utm_source, utm_campaign, COUNT(*) as leads, SUM(enrollment_value) as revenue
    FROM lead_attribution
    WHERE first_touch_at >= date('now', '-${days} days')
    GROUP BY utm_source, utm_campaign
    ORDER BY leads DESC
  `).all();
  res.json(rows);
}));

// ── Publishing Queue / Due (for n8n) ──
app.get('/api/marketing/publishing-queue/due', (req, res) => requireMarketing(req, res, () => {
  res.json(db.prepare(`SELECT * FROM publishing_queue WHERE status='queued' AND scheduled_at <= datetime('now') ORDER BY scheduled_at`).all());
}));

// ── LLM Settings ────────────────────────────────────────
app.get('/api/marketing/llm-config', (req, res) => {
  try {
    const provider = db.prepare("SELECT value FROM meta_config WHERE key='llm_provider'").get()?.value || 'openai';
    const model = db.prepare("SELECT value FROM meta_config WHERE key='llm_model'").get()?.value || 'gpt-4o-mini';
    const hasKey = !!(process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY || db.prepare("SELECT value FROM meta_config WHERE key='llm_api_key'").get()?.value);
    res.json({ provider, model, hasKey });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/marketing/llm-config', (req, res) => {
  try {
    const { provider, model, apiKey } = req.body || {};
    if (provider) db.prepare("INSERT OR REPLACE INTO meta_config (key, value, updated_at) VALUES ('llm_provider', ?, datetime('now'))").run(provider);
    if (model) db.prepare("INSERT OR REPLACE INTO meta_config (key, value, updated_at) VALUES ('llm_model', ?, datetime('now'))").run(model);
    if (apiKey) db.prepare("INSERT OR REPLACE INTO meta_config (key, value, updated_at) VALUES ('llm_api_key', ?, datetime('now'))").run(apiKey);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── LLM Test / Debug Endpoint ────────────────────────────────────────
app.post('/api/marketing/llm-test', async (req, res) => {
  try {
    const { provider, prompt } = req.body || {};
    
    const HARD_CODED_KEYS = [
      { key:'sk-KF63PVImS4EsF2iaEvwTNHcFNqNVzEoIHJZ8K01poqEM97qZ8smo52DEye5g9KaL', provider:'opencode-go', model:'glm-5.1' }
    ];
    
    let llmProvider = provider || db.prepare("SELECT value FROM meta_config WHERE key='llm_provider'").get()?.value || '';
    let llmModel = db.prepare("SELECT value FROM meta_config WHERE key='llm_model'").get()?.value || '';
    let llmApiKey = db.prepare("SELECT value FROM meta_config WHERE key='llm_api_key'").get()?.value || process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY || process.env.OPENCODE_GO_API_KEY || '';
    
    if (!llmApiKey && HARD_CODED_KEYS.length > 0) {
      const fallback = HARD_CODED_KEYS[0];
      llmApiKey = fallback.key;
      llmProvider = fallback.provider;
      llmModel = fallback.model;
    }
    
    if (!llmApiKey) return res.status(400).json({ error: 'No LLM API key available' });
    if (!llmProvider) {
      if (llmApiKey.startsWith('AIza')) llmProvider = 'gemini';
      else llmProvider = 'opencode-go';
    }
    if (!llmModel) {
      if (llmProvider === 'opencode-go') llmModel = 'glm-5.1';
      if (llmProvider === 'openai') llmModel = 'gpt-4o-mini';
      if (llmProvider === 'gemini') llmModel = 'gemini-1.5-pro-latest';
    }
    
    let result = null;
    let error = null;
    let statusCode = null;
    let rawResponse = null;
    
    try {
      if (llmProvider === 'opencode-go') {
        const resp = await fetch('https://api.opencode.ai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${llmApiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: llmModel,
            messages: [{ role: 'user', content: prompt || 'Say "hello" and return a JSON with key "status" set to "ok"' }],
            temperature: 0.7,
            max_tokens: 200
          })
        });
        statusCode = resp.status;
        rawResponse = await resp.text();
        try { result = JSON.parse(rawResponse); } catch {}
      } else if (llmProvider === 'openai') {
        const resp = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${llmApiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: llmModel,
            messages: [{ role: 'user', content: prompt || 'Say hello' }],
            temperature: 0.7,
            max_tokens: 200
          })
        });
        statusCode = resp.status;
        rawResponse = await resp.text();
        try { result = JSON.parse(rawResponse); } catch {}
      } else if (llmProvider === 'gemini') {
        const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${llmModel}:generateContent?key=${llmApiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt || 'Say hello' }] }] })
        });
        statusCode = resp.status;
        rawResponse = await resp.text();
        try { result = JSON.parse(rawResponse); } catch {}
      }
    } catch (netErr) {
      error = netErr.message;
    }
    
    res.json({
      provider: llmProvider,
      model: llmModel,
      hasKey: !!llmApiKey,
      keyPrefix: llmApiKey.slice(0, 7) + '...',
      statusCode,
      error,
      rawResponse: rawResponse?.slice(0, 1000),
      parsedResponse: result
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── AI Content Generator ────────────────────────────────────────
// Calls LLM API to generate real content based on user inputs
app.post('/api/marketing/generate', async (req, res) => {
  try {
    const { page, pillar, format, language, tone, topic, hook, selectedUniversity, selectedScholarship, researchIntel } = req.body || {};

    // Get LLM API config from meta_config or env or hardcoded fallback
    const HARD_CODED_KEYS = [
      { key:'sk-KF63PVImS4EsF2iaEvwTNHcFNqNVzEoIHJZ8K01poqEM97qZ8smo52DEye5g9KaL', provider:'opencode-go', model:'glm-5.1' }
    ];
    const dbProvider = db.prepare("SELECT value FROM meta_config WHERE key='llm_provider'").get()?.value;
    const dbModel = db.prepare("SELECT value FROM meta_config WHERE key='llm_model'").get()?.value;
    const dbKey = db.prepare("SELECT value FROM meta_config WHERE key='llm_api_key'").get()?.value;
    const envKey = process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY || process.env.OPENCODE_GO_API_KEY || '';
    
    let llmProvider = dbProvider || process.env.LLM_PROVIDER || '';
    let llmModel = dbModel || process.env.LLM_MODEL || '';
    let llmApiKey = dbKey || envKey || '';
    
    // Auto-detect from hardcoded keys if nothing configured
    if (!llmApiKey && HARD_CODED_KEYS.length > 0) {
      const fallback = HARD_CODED_KEYS[0];
      llmApiKey = fallback.key;
      llmProvider = fallback.provider;
      llmModel = fallback.model;
    }
    
    // Auto-detect provider from key prefix if not set
    if (!llmProvider && llmApiKey) {
      if (llmApiKey.startsWith('sk-')) llmProvider = 'openai'; // could be OpenAI or OpenCode
      if (llmApiKey.startsWith('AIza')) llmProvider = 'gemini';
    }
    if (!llmModel && llmProvider === 'opencode-go') llmModel = 'glm-5.1';
    if (!llmModel && llmProvider === 'openai') llmModel = 'gpt-4o-mini';
    if (!llmModel && llmProvider === 'gemini') llmModel = 'gemini-1.5-pro-latest';

    if (!llmApiKey) {
      return res.status(400).json({
        error: 'No LLM API key configured. Add OPENAI_API_KEY or GEMINI_API_KEY env var, or set via LLM Config panel.',
        fallback: true
      });
    }

    // Build the system prompt with brand voice rules
    const systemPrompt = `You are the senior content strategist for EduExpress International, an education consultancy in Dhaka, Bangladesh that helps students study abroad (China, Malaysia, Korea, Hungary, Malta, etc.).

STRICT RULES (violating any = content rejected):
1. NEVER use these banned phrases: "guaranteed visa", "100% visa success", "100% admission", "guaranteed admission", "visa confirmed", "no rejection", "zero rejection", "government registered", "licensed by government", "official representative", "authorized agent", "best consultancy", "no. 1 consultancy", "100% scholarship guaranteed", "free education", "no cost at all"
2. NEVER use: "CSC scholarship" (use "Chinese Government Scholarship" or "CSC"), "GKS scholarship" (use "Korean Government Scholarship"), "Stipendium Hungaricum" (use "Hungary Government Scholarship"), "no IELTS" (use "MOI Certificate" instead)
3. NEVER use fake numbers: "5000+ students", "99% visa success", "$5M revenue"
4. Use REAL numbers: 98% visa success rate (with disclaimer), 2,000+ students placed, 8+ years experience, 150+ partner universities
5. Stipend range: ৳10,000-60,000/month (NOT a fixed number)
6. Language: ${language === 'bangla' ? 'Write 50% Bangla + 50% English naturally. Technical terms (university names, CSC, MOI) stay in English. Each sentence should be one language, not mixed within a sentence.' : language === 'mixed' ? 'Write primarily in Bangla with key English terms naturally woven in. English for technical terms and CTAs.' : 'Write in English with occasional Bangla words for cultural resonance.'}
7. Tone: ${tone || 'expert_consultant'} — ${tone === 'expert_consultant' ? 'Professional, factual, reassuring. Use "আমরা" (we), not "তুমি" (you). Address parents as guardians.' : tone === 'empathetic_brother' ? 'Warm, conversational, understanding pain points. Use "ভাই" (brother) energy. Short sentences.' : tone === 'success_story' ? 'Inspirational, aspirational, specific details. Show transformation from doubt to achievement.' : 'Friendly, peer-to-peer, relatable. Use conversational Bangla. Share personal-feeling insights.'}
8. Hook: MUST be under 15 words, emotional or curiosity-driven, not clickbait
9. Body: 3-5 short paragraphs, each with a clear point
10. CTA: Must be clear and actionable

OUTPUT FORMAT — Return ONLY this JSON (no markdown, no explanations):
{"hook": "...", "body": "...", "hashtags": "...", "cta": "...", "brief": "design brief for designer..."}`;

    const userPrompt = `Write a ${format || 'Carousel'} post for the ${page === 'china' ? 'China Study Abroad' : page === 'bd' ? 'Bangladesh Study Abroad' : page} Facebook page.

PILLAR: ${pillar || 'scholarship'}
TOPIC: ${topic || 'Study abroad opportunity'}
${selectedUniversity ? `UNIVERSITY CONTEXT: ${selectedUniversity.name} in ${selectedUniversity.city}, ${selectedUniversity.country}. Programs: ${selectedUniversity.programs}. Tuition: ${selectedUniversity.tuition}. ${selectedUniversity.csca_free ? 'CSCA-free admission.' : ''}` : ''}
${selectedScholarship ? `SCHOLARSHIP CONTEXT: ${selectedScholarship.name}. Coverage: ${selectedScholarship.coverage}. Eligibility: ${selectedScholarship.eligibility}` : ''}
${researchIntel ? `MARKET INTELLIGENCE: ${researchIntel.topic} — ${researchIntel.insight_summary}` : ''}
${hook ? `SUGGESTED HOOK ANGLE: ${hook}` : ''}

Write the complete post now. Return ONLY JSON.`;

    let generatedContent;

    // Call LLM API based on provider
    if (llmProvider === 'openai') {
      const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${llmApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: llmModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.7,
          max_tokens: 1500,
          response_format: { type: 'json_object' }
        })
      });
      const openaiData = await openaiRes.json();
      if (openaiData.error) throw new Error(openaiData.error.message);
      const content = openaiData.choices?.[0]?.message?.content;
      generatedContent = JSON.parse(content);
    } else if (llmProvider === 'gemini') {
      // Gemini API
      const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${llmModel}:generateContent?key=${llmApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: systemPrompt + '\n\n' + userPrompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 1500 }
        })
      });
      const geminiData = await geminiRes.json();
      if (geminiData.error) throw new Error(geminiData.error.message);
      const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';
      try {
        generatedContent = JSON.parse(text);
      } catch (e) {
        const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch) generatedContent = JSON.parse(jsonMatch[1]);
        else throw new Error('Could not parse LLM response as JSON');
      }
    } else if (llmProvider === 'opencode-go') {
      // OpenCode AI — GLM models (OpenAI-compatible)
      // Correct endpoint: https://api.opencode.ai/v1/chat/completions
      let openCodeRes;
      try {
        openCodeRes = await fetch('https://api.opencode.ai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${llmApiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: llmModel || 'glm-5.1',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ],
            temperature: 0.7,
            max_tokens: 1500
          })
        });
      } catch (netErr) {
        console.error('[generate] Network error calling opencode.ai:', netErr.message);
        throw new Error(`Network error calling opencode.ai: ${netErr.message}. Check if the API endpoint is reachable.`);
      }
      
      let openCodeData;
      try {
        openCodeData = await openCodeRes.json();
      } catch (parseErr) {
        const rawText = await openCodeRes.text().catch(() => '');
        console.error('[generate] Failed to parse opencode-go response:', rawText.slice(0, 500));
        throw new Error(`OpenCode GO returned non-JSON (HTTP ${openCodeRes.status}): ${rawText.slice(0, 200)}`);
      }
      
      if (!openCodeRes.ok) {
        console.error('[generate] OpenCode GO error:', openCodeData);
        throw new Error(openCodeData.error?.message || openCodeData.message || `HTTP ${openCodeRes.status}: ${JSON.stringify(openCodeData).slice(0, 200)}`);
      }
      
      const content = openCodeData.choices?.[0]?.message?.content || openCodeData.choices?.[0]?.content;
      if (!content) {
        console.error('[generate] No content in opencode-go response:', openCodeData);
        throw new Error('OpenCode GO returned empty content. Response: ' + JSON.stringify(openCodeData).slice(0, 300));
      }
      
      try {
        generatedContent = JSON.parse(content);
      } catch (e) {
        // Try to extract JSON from markdown code block
        const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch) generatedContent = JSON.parse(jsonMatch[1]);
        else {
          // Fallback: try to find JSON object in text
          const objMatch = content.match(/\{[\s\S]*"hook"[\s\S]*\}/);
          if (objMatch) generatedContent = JSON.parse(objMatch[0]);
          else {
            console.error('[generate] Could not parse content as JSON:', content.slice(0, 500));
            throw new Error('OpenCode GO returned non-JSON content. Raw: ' + content.slice(0, 200));
          }
        }
      }
    } else {
      return res.status(400).json({ error: `Unsupported LLM provider: ${llmProvider}. Use 'openai', 'gemini', or 'opencode-go'.` });
    }

    res.json({
      success: true,
      hook: generatedContent.hook || '',
      body: generatedContent.body || '',
      hashtags: generatedContent.hashtags || '',
      cta: generatedContent.cta || '',
      brief: generatedContent.brief || `${format} design for ${pillar} post.`,
      provider: llmProvider,
      model: llmModel
    });

  } catch (e) {
    console.error('[generate] AI generation failed:', e.message);
    res.status(500).json({ error: e.message, fallback: true });
  }
});
// Manual publish trigger — queues post and sends to n8n webhook
app.post('/api/marketing/publish/:postId', (req, res) => requireMarketing(req, res, () => {
  const postId = parseInt(req.params.postId);
  const post = db.prepare(`SELECT * FROM content_posts WHERE id=?`).get(postId);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  if (post.status !== 'approved') return res.status(400).json({ error: 'Post must be approved before publishing' });

  const platform = req.body.platform || post.platform || 'facebook';
  const page = req.body.page || post.page || 'bd';
  const scheduledAt = req.body.scheduled_at || new Date().toISOString();
  const assetUrl = req.body.asset_url || post.asset_url || null;

  // Check for existing queued/published entry for this post on this platform
  const existing = db.prepare(`SELECT * FROM publishing_queue WHERE post_id=? AND platform=? AND status IN ('queued','published')`).get(postId, platform);
  if (existing) return res.status(400).json({ error: `Already ${existing.status} on ${platform}`, queue: existing });

  // Create queue entry
  const qInfo = db.prepare(`INSERT INTO publishing_queue (post_id, page, platform, scheduled_at, status) VALUES (?, ?, ?, ?, 'queued')`).run(postId, page, platform, scheduledAt);
  const queue = db.prepare(`SELECT * FROM publishing_queue WHERE id=?`).get(qInfo.lastInsertRowid);

  // Update post status to scheduled
  db.prepare(`UPDATE content_posts SET status='scheduled', updated_at=datetime('now') WHERE id=?`).run(postId);

  // Send to n8n webhook (fire-and-forget, n8n will callback)
  const n8nWebhook = process.env.N8N_PUBLISH_WEBHOOK || 'https://vibeacademy.cloud/webhook/eduexpress-publish';
  const payload = {
    postId: postId,
    page: page,
    platform: platform,
    body: post.body || '',
    hashtags: post.hashtags || '',
    cta: post.cta || '',
    assetUrl: assetUrl,
    queueId: queue.id,
    crmBase: `${req.protocol}://${req.get('host')}`,
    crmKey: INTERNAL_API_KEY
  };

  fetch(n8nWebhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).then(r => r.json().catch(() => ({}))).then(n8nRes => {
    console.log(`[publish] n8n response for post ${postId}:`, n8nRes.success ? 'OK' : n8nRes.error);
    if (!n8nRes.success) {
      // If n8n rejected immediately, update queue
      db.prepare(`UPDATE publishing_queue SET status='failed', error_message=? WHERE id=?`).run(n8nRes.error || 'n8n rejected', queue.id);
      db.prepare(`UPDATE content_posts SET status='approved', updated_at=datetime('now') WHERE id=?`).run(postId);
    }
  }).catch(e => {
    console.error(`[publish] n8n webhook failed for post ${postId}:`, e.message);
    db.prepare(`UPDATE publishing_queue SET status='failed', error_message=? WHERE id=?`).run(`n8n unreachable: ${e.message}`, queue.id);
    db.prepare(`UPDATE content_posts SET status='approved', updated_at=datetime('now') WHERE id=?`).run(postId);
  });

  res.json({ success: true, queued: queue, post: db.prepare(`SELECT * FROM content_posts WHERE id=?`).get(postId) });
}));

// n8n callback webhook — reports publish success/failure
// This is called by n8n with x-api-key header (handled by global middleware)
app.post('/api/marketing/publish/webhook', (req, res) => {
  // Auth check: must be n8n or logged-in user
  const isInternal = req.headers['x-api-key'] === INTERNAL_API_KEY;
  const isUser = req.user && req.user.id;
  if (!isInternal && !isUser) return res.status(401).json({ error: 'Unauthorized' });

  const { postId, success, platformPostId, publishUrl, error, platform, page } = req.body || {};
  if (!postId) return res.status(400).json({ error: 'postId required' });

  const post = db.prepare(`SELECT * FROM content_posts WHERE id=?`).get(postId);
  if (!post) return res.status(404).json({ error: 'Post not found' });

  // Find the most recent queue entry for this post
  const queue = db.prepare(`SELECT * FROM publishing_queue WHERE post_id=? ORDER BY created_at DESC LIMIT 1`).get(postId);

  if (success) {
    // Update queue to published
    db.prepare(`UPDATE publishing_queue SET status='published', published_at=datetime('now'), platform_post_id=?, platform_post_url=?, error_message=NULL WHERE id=?`)
      .run(platformPostId || null, publishUrl || null, queue?.id || 0);
    // Update post to published
    db.prepare(`UPDATE content_posts SET status='published', published_at=datetime('now'), updated_at=datetime('now') WHERE id=?`).run(postId);
    console.log(`[publish] ✅ Post ${postId} published to ${platform} (${page})`);
    res.json({ success: true, postId, status: 'published' });
  } else {
    // Update queue to failed
    const errMsg = error || 'Unknown publishing error';
    db.prepare(`UPDATE publishing_queue SET status='failed', error_message=? WHERE id=?`).run(errMsg, queue?.id || 0);
    // Revert post to approved (so user can retry)
    db.prepare(`UPDATE content_posts SET status='approved', updated_at=datetime('now') WHERE id=?`).run(postId);
    console.log(`[publish] ❌ Post ${postId} failed on ${platform}: ${errMsg}`);
    res.json({ success: false, postId, error: errMsg, status: 'failed' });
  }
});

// Retry a failed publish
app.post('/api/marketing/publish/retry/:queueId', (req, res) => requireMarketing(req, res, () => {
  const queueId = parseInt(req.params.queueId);
  const queue = db.prepare(`SELECT * FROM publishing_queue WHERE id=?`).get(queueId);
  if (!queue) return res.status(404).json({ error: 'Queue entry not found' });
  if (queue.status !== 'failed') return res.status(400).json({ error: `Cannot retry — status is ${queue.status}` });

  const post = db.prepare(`SELECT * FROM content_posts WHERE id=?`).get(queue.post_id);
  if (!post) return res.status(404).json({ error: 'Post not found' });

  // Reset queue to queued
  db.prepare(`UPDATE publishing_queue SET status='queued', error_message=NULL, scheduled_at=datetime('now') WHERE id=?`).run(queueId);
  db.prepare(`UPDATE content_posts SET status='scheduled', updated_at=datetime('now') WHERE id=?`).run(queue.post_id);

  // Re-send to n8n
  const n8nWebhook = process.env.N8N_PUBLISH_WEBHOOK || 'https://vibeacademy.cloud/webhook/eduexpress-publish';
  const payload = {
    postId: queue.post_id,
    page: queue.page,
    platform: queue.platform,
    body: post.body || '',
    hashtags: post.hashtags || '',
    cta: post.cta || '',
    assetUrl: post.asset_url || null,
    queueId: queueId,
    crmBase: `${req.protocol}://${req.get('host')}`,
    crmKey: INTERNAL_API_KEY
  };

  fetch(n8nWebhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).then(r => r.json().catch(() => ({}))).then(n8nRes => {
    console.log(`[publish-retry] n8n response for post ${queue.post_id}:`, n8nRes.success ? 'OK' : n8nRes.error);
  }).catch(e => {
    console.error(`[publish-retry] n8n webhook failed:`, e.message);
  });

  res.json({ success: true, queue: db.prepare(`SELECT * FROM publishing_queue WHERE id=?`).get(queueId), message: 'Retry triggered' });
}));

// Full publishing queue with post details
app.get('/api/marketing/publishing-queue/full', (req, res) => requireMarketing(req, res, () => {
  const { status, page, platform, limit } = req.query;
  let sql = `
    SELECT pq.*, cp.hook as post_title, cp.body as post_body, cp.hook as post_hook, cp.pillar, cp.page as post_page, cp.quality_score, cp.asset_url
    FROM publishing_queue pq
    LEFT JOIN content_posts cp ON pq.post_id = cp.id
    WHERE 1=1
  `;
  const params = [];
  if (status) { sql += ' AND pq.status = ?'; params.push(status); }
  if (page) { sql += ' AND pq.page = ?'; params.push(page); }
  if (platform) { sql += ' AND pq.platform = ?'; params.push(platform); }
  sql += ' ORDER BY pq.created_at DESC LIMIT ?';
  params.push(parseInt(limit) || 100);
  res.json(db.prepare(sql).all(...params));
}));

// ── n8n Config — raw tokens for publishing engine (n8n-only, x-api-key required) ──
app.get('/api/marketing/publish/n8n-config', (req, res) => {
  // Only allow internal n8n service or super_admin
  const isInternal = req.headers['x-api-key'] === INTERNAL_API_KEY;
  const isSuperAdmin = req.user && (req.user.role === 'super_admin' || req.user.roles?.includes('founder_ceo'));
  if (!isInternal && !isSuperAdmin) return res.status(401).json({ error: 'Unauthorized' });

  // Get page IDs from Facebook/Messenger channels
  const channels = db.prepare("SELECT name, page_id, access_token FROM channels WHERE type IN ('facebook', 'messenger') AND active = 1 AND page_id IS NOT NULL").all();
  const pageIds = {};
  for (const ch of channels) {
    if (ch.name.toLowerCase().includes('china')) pageIds.china = ch.page_id;
    else if (ch.name.toLowerCase().includes('bd') || ch.name.toLowerCase().includes('bangladesh')) pageIds.bd = ch.page_id;
  }

  // Get global page_access_token from meta_config
  const token = db.prepare("SELECT value FROM meta_config WHERE key='page_access_token'").get()?.value || '';

  res.json({
    facebook: {
      page_access_token: token,
      page_ids: pageIds
    },
    instagram: false,
    tiktok: false,
    crm_base: `${req.protocol}://${req.get('host')}`
  });
});

// Get publishing configuration (page tokens, platforms)
app.get('/api/marketing/publish/config', (req, res) => requireMarketing(req, res, () => {
  const token = db.prepare("SELECT value FROM meta_config WHERE key='page_access_token'").get()?.value || '';
  const channels = db.prepare("SELECT name, page_id FROM channels WHERE type IN ('facebook', 'messenger') AND active = 1 AND page_id IS NOT NULL").all();
  const fbChina = channels.some(c => c.name.toLowerCase().includes('china') && c.page_id);
  const fbBD = channels.some(c => (c.name.toLowerCase().includes('bd') || c.name.toLowerCase().includes('bangladesh')) && c.page_id);
  const n8nConfigured = true; // n8n workflow is hardcoded and active
  res.json({
    facebook: { china: fbChina, bd: fbBD, token_exists: !!token },
    instagram: false, // v2 feature
    tiktok: false, // v2 feature
    n8n: n8nConfigured,
    n8nWebhook: 'https://vibeacademy.cloud/webhook/eduexpress-publish',
    crm_base: `${req.protocol}://${req.get('host')}`
  });
}));

// ═══════════════════════════════════════════════════════════
//  PROFESSIONAL SMM PIPELINE v3.0 — Campaigns, Pipeline Board, Assets, Comments, Performance
// ═══════════════════════════════════════════════════════════

// ── Campaigns CRUD ────────────────────────────────────────
app.get('/api/marketing/campaigns', (req, res) => requireMarketing(req, res, () => {
  const { status, page, pillar } = req.query;
  let sql = `SELECT c.*, COUNT(cp.id) as post_count FROM campaigns c LEFT JOIN content_posts cp ON c.id = cp.campaign_id WHERE 1=1`;
  const params = [];
  if (status) { sql += ' AND c.status = ?'; params.push(status); }
  if (page) { sql += ' AND c.page = ?'; params.push(page); }
  if (pillar) { sql += ' AND c.pillar = ?'; params.push(pillar); }
  sql += ` GROUP BY c.id ORDER BY c.created_at DESC`;
  res.json(db.prepare(sql).all(...params));
}));

app.get('/api/marketing/campaigns/:id', (req, res) => requireMarketing(req, res, () => {
  const campaign = db.prepare(`SELECT * FROM campaigns WHERE id=?`).get(req.params.id);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
  const posts = db.prepare(`SELECT * FROM content_posts WHERE campaign_id=? ORDER BY created_at DESC`).all(req.params.id);
  res.json({ ...campaign, posts });
}));

app.post('/api/marketing/campaigns', (req, res) => requireMarketing(req, res, () => {
  const { name, description, page, pillar, start_date, end_date, budget, target_audience, goals, color } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name required' });
  const info = db.prepare(`INSERT INTO campaigns (name, description, page, pillar, start_date, end_date, budget, target_audience, goals, color, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(name, description || '', page || 'china', pillar || 'scholarship', start_date || null, end_date || null, budget || '', target_audience || '', goals || '', color || '#3B82F6', req.user?.name || '');
  res.json({ success: true, id: info.lastInsertRowid });
}));

app.put('/api/marketing/campaigns/:id', (req, res) => requireMarketing(req, res, () => {
  const { name, description, status, page, pillar, start_date, end_date, budget, target_audience, goals, color } = req.body || {};
  const existing = db.prepare(`SELECT * FROM campaigns WHERE id=?`).get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Campaign not found' });
  db.prepare(`UPDATE campaigns SET name=?, description=?, status=?, page=?, pillar=?, start_date=?, end_date=?, budget=?, target_audience=?, goals=?, color=?, updated_at=datetime('now') WHERE id=?`)
    .run(name || existing.name, description !== undefined ? description : existing.description, status || existing.status, page || existing.page, pillar || existing.pillar, start_date !== undefined ? start_date : existing.start_date, end_date !== undefined ? end_date : existing.end_date, budget !== undefined ? budget : existing.budget, target_audience !== undefined ? target_audience : existing.target_audience, goals !== undefined ? goals : existing.goals, color !== undefined ? color : existing.color, req.params.id);
  res.json({ success: true });
}));

app.delete('/api/marketing/campaigns/:id', (req, res) => requireMarketing(req, res, () => {
  db.prepare(`DELETE FROM campaigns WHERE id=?`).run(req.params.id);
  db.prepare(`UPDATE content_posts SET campaign_id=NULL WHERE campaign_id=?`).run(req.params.id);
  res.json({ success: true });
}));

// ── Pipeline Board — Kanban data grouped by status ─────────
app.get('/api/marketing/pipeline', (req, res) => requireMarketing(req, res, () => {
  const { campaign_id, page, pillar } = req.query;
  let where = 'WHERE 1=1';
  const params = [];
  if (campaign_id) { where += ' AND campaign_id=?'; params.push(campaign_id); }
  if (page) { where += ' AND page=?'; params.push(page); }
  if (pillar) { where += ' AND pillar=?'; params.push(pillar); }
  
  const posts = db.prepare(`SELECT cp.*, c.name as campaign_name, c.color as campaign_color FROM content_posts cp LEFT JOIN campaigns c ON cp.campaign_id = c.id ${where} ORDER BY cp.updated_at DESC`).all(...params);
  
  // Group by status
  const stages = ['ideation','brief_ready','writing','quality_review','design','design_review','approved','scheduled','published','archived'];
  const pipeline = {};
  for (const s of stages) pipeline[s] = [];
  for (const p of posts) {
    const status = p.status || 'ideation';
    if (!pipeline[status]) pipeline[status] = [];
    pipeline[status].push(p);
  }
  
  res.json({ stages: pipeline, counts: Object.fromEntries(Object.entries(pipeline).map(([k, v]) => [k, v.length])) });
}));

// ── Move post between pipeline stages ─────────────────────
app.post('/api/marketing/posts/:id/move', (req, res) => requireMarketing(req, res, () => {
  const postId = parseInt(req.params.id);
  const { to_status, note } = req.body || {};
  const validStatuses = ['ideation','brief_ready','writing','quality_review','design','design_review','approved','scheduled','published','archived'];
  if (!validStatuses.includes(to_status)) return res.status(400).json({ error: 'Invalid status' });
  
  const post = db.prepare(`SELECT * FROM content_posts WHERE id=?`).get(postId);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  
  const fromStatus = post.status || 'ideation';
  db.prepare(`UPDATE content_posts SET status=?, updated_at=datetime('now') WHERE id=?`).run(to_status, postId);
  db.prepare(`INSERT INTO pipeline_logs (post_id, from_status, to_status, actor, note) VALUES (?, ?, ?, ?, ?)`)
    .run(postId, fromStatus, to_status, req.user?.name || 'system', note || '');
  
  res.json({ success: true, postId, from: fromStatus, to: to_status });
}));

// ── Post Comments ─────────────────────────────────────────
app.get('/api/marketing/posts/:id/comments', (req, res) => requireMarketing(req, res, () => {
  const comments = db.prepare(`SELECT * FROM post_comments WHERE post_id=? ORDER BY created_at DESC`).all(req.params.id);
  res.json(comments);
}));

app.post('/api/marketing/posts/:id/comments', (req, res) => requireMarketing(req, res, () => {
  const { comment } = req.body || {};
  if (!comment) return res.status(400).json({ error: 'comment required' });
  const info = db.prepare(`INSERT INTO post_comments (post_id, user_name, user_role, comment) VALUES (?, ?, ?, ?)`)
    .run(req.params.id, req.user?.name || 'User', req.user?.role || 'consultant', comment);
  res.json({ success: true, id: info.lastInsertRowid });
}));

app.delete('/api/marketing/posts/comments/:id', (req, res) => requireMarketing(req, res, () => {
  db.prepare(`DELETE FROM post_comments WHERE id=?`).run(req.params.id);
  res.json({ success: true });
}));

// ── Post Performance (manual entry or webhook sync) ───────
app.get('/api/marketing/posts/:id/performance', (req, res) => requireMarketing(req, res, () => {
  const perf = db.prepare(`SELECT * FROM post_performance WHERE post_id=? ORDER BY recorded_at DESC`).all(req.params.id);
  res.json(perf);
}));

app.post('/api/marketing/posts/:id/performance', (req, res) => requireMarketing(req, res, () => {
  const { platform, impressions, reach, engagement, likes, comments, shares, clicks, cta_clicks, video_views, saves } = req.body || {};
  const info = db.prepare(`INSERT INTO post_performance (post_id, platform, impressions, reach, engagement, likes, comments, shares, clicks, cta_clicks, video_views, saves) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(req.params.id, platform || 'facebook', impressions || 0, reach || 0, engagement || 0, likes || 0, comments || 0, shares || 0, clicks || 0, cta_clicks || 0, video_views || 0, saves || 0);
  res.json({ success: true, id: info.lastInsertRowid });
}));

// ── Content Assets ────────────────────────────────────────
app.get('/api/marketing/assets', (req, res) => requireMarketing(req, res, () => {
  const { post_id, campaign_id, status } = req.query;
  let sql = `SELECT a.*, cp.hook as post_title FROM content_assets a LEFT JOIN content_posts cp ON a.post_id = cp.id WHERE 1=1`;
  const params = [];
  if (post_id) { sql += ' AND a.post_id = ?'; params.push(post_id); }
  if (campaign_id) { sql += ' AND a.campaign_id = ?'; params.push(campaign_id); }
  if (status) { sql += ' AND a.status = ?'; params.push(status); }
  sql += ' ORDER BY a.created_at DESC';
  res.json(db.prepare(sql).all(...params));
}));

app.post('/api/marketing/assets', (req, res) => requireMarketing(req, res, () => {
  const { post_id, campaign_id, asset_type, asset_url, thumbnail_url, file_name, file_size } = req.body || {};
  const info = db.prepare(`INSERT INTO content_assets (post_id, campaign_id, asset_type, asset_url, thumbnail_url, file_name, file_size, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(post_id || null, campaign_id || null, asset_type || 'image', asset_url || '', thumbnail_url || '', file_name || '', file_size || '', req.user?.name || '');
  res.json({ success: true, id: info.lastInsertRowid });
}));

app.put('/api/marketing/assets/:id', (req, res) => requireMarketing(req, res, () => {
  const { status, feedback, asset_url, thumbnail_url } = req.body || {};
  const existing = db.prepare(`SELECT * FROM content_assets WHERE id=?`).get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Asset not found' });
  db.prepare(`UPDATE content_assets SET status=?, feedback=?, asset_url=?, thumbnail_url=?, updated_at=datetime('now') WHERE id=?`)
    .run(status !== undefined ? status : existing.status, feedback !== undefined ? feedback : existing.feedback, asset_url !== undefined ? asset_url : existing.asset_url, thumbnail_url !== undefined ? thumbnail_url : existing.thumbnail_url, req.params.id);
  res.json({ success: true });
}));

app.delete('/api/marketing/assets/:id', (req, res) => requireMarketing(req, res, () => {
  db.prepare(`DELETE FROM content_assets WHERE id=?`).run(req.params.id);
  res.json({ success: true });
}));

app.get('/api/marketing/templates', (req, res) => requireMarketing(req, res, () => {
  const { pillar, page, active } = req.query;
  let sql = `SELECT * FROM content_templates WHERE 1=1`;
  const params = [];
  if (pillar) { sql += ' AND pillar = ?'; params.push(pillar); }
  if (page) { sql += ' AND (page = ? OR page = "all")'; params.push(page); }
  if (active === '1') { sql += ' AND is_active = 1'; }
  sql += ' ORDER BY usage_count DESC, created_at DESC';
  res.json(db.prepare(sql).all(...params));
}));

app.get('/api/marketing/templates/:id', (req, res) => requireMarketing(req, res, () => {
  const t = db.prepare(`SELECT * FROM content_templates WHERE id=?`).get(req.params.id);
  if (!t) return res.status(404).json({ error: 'Template not found' });
  res.json(t);
}));

app.post('/api/marketing/templates', (req, res) => requireMarketing(req, res, () => {
  const { name, description, pillar, page, format, language, platform, tone, hook_template, body_template, hashtags_template, cta_template, brief_template, variables } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name required' });
  const info = db.prepare(`INSERT INTO content_templates (name, description, pillar, page, format, language, platform, tone, hook_template, body_template, hashtags_template, cta_template, brief_template, variables, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(name, description || '', pillar || 'scholarship', page || 'china', format || 'Carousel', language || 'bangla', platform || 'facebook', tone || 'expert_consultant', hook_template || '', body_template || '', hashtags_template || '', cta_template || '', brief_template || '', variables || '', req.user?.name || '');
  res.json({ success: true, id: info.lastInsertRowid });
}));

app.put('/api/marketing/templates/:id', (req, res) => requireMarketing(req, res, () => {
  const { name, description, pillar, page, format, language, platform, tone, hook_template, body_template, hashtags_template, cta_template, brief_template, variables, is_active } = req.body || {};
  const existing = db.prepare(`SELECT * FROM content_templates WHERE id=?`).get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Template not found' });
  db.prepare(`UPDATE content_templates SET name=?, description=?, pillar=?, page=?, format=?, language=?, platform=?, tone=?, hook_template=?, body_template=?, hashtags_template=?, cta_template=?, brief_template=?, variables=?, is_active=? WHERE id=?`)
    .run(name || existing.name, description !== undefined ? description : existing.description, pillar || existing.pillar, page || existing.page, format || existing.format, language || existing.language, platform || existing.platform, tone || existing.tone, hook_template !== undefined ? hook_template : existing.hook_template, body_template !== undefined ? body_template : existing.body_template, hashtags_template !== undefined ? hashtags_template : existing.hashtags_template, cta_template !== undefined ? cta_template : existing.cta_template, brief_template !== undefined ? brief_template : existing.brief_template, variables !== undefined ? variables : existing.variables, is_active !== undefined ? is_active : existing.is_active, req.params.id);
  res.json({ success: true });
}));

app.delete('/api/marketing/templates/:id', (req, res) => requireMarketing(req, res, () => {
  db.prepare(`DELETE FROM content_templates WHERE id=?`).run(req.params.id);
  res.json({ success: true });
}));

app.post('/api/marketing/templates/:id/use', (req, res) => requireMarketing(req, res, () => {
  const template = db.prepare(`SELECT * FROM content_templates WHERE id=?`).get(req.params.id);
  if (!template) return res.status(404).json({ error: 'Template not found' });
  const vars = req.body?.variables || {};
  // Simple string replacement for variables
  let hook = template.hook_template || '';
  let body = template.body_template || '';
  let hashtags = template.hashtags_template || '';
  let cta = template.cta_template || '';
  let brief = template.brief_template || '';
  for (const [key, val] of Object.entries(vars)) {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
    hook = hook.replace(regex, val);
    body = body.replace(regex, val);
    hashtags = hashtags.replace(regex, val);
    cta = cta.replace(regex, val);
    brief = brief.replace(regex, val);
  }
  db.prepare(`UPDATE content_templates SET usage_count = usage_count + 1 WHERE id=?`).run(req.params.id);
  res.json({ success: true, hook, body, hashtags, cta, brief, template });
}));

// ── Content Calendar Slots ────────────────────────────────────────
app.get('/api/marketing/calendar', (req, res) => requireMarketing(req, res, () => {
  const { month, page, status } = req.query; // month = YYYY-MM
  if (!month) return res.status(400).json({ error: 'month (YYYY-MM) required' });
  let sql = `SELECT s.*, cp.hook, cp.body, cp.status as post_status, cp.pillar, cp.format, cp.platform, cp.quality_score, cp.asset_url FROM content_calendar_slots s LEFT JOIN content_posts cp ON s.post_id = cp.id WHERE s.slot_date LIKE ?`;
  const params = [month + '%'];
  if (page) { sql += ' AND s.page = ?'; params.push(page); }
  if (status) { sql += ' AND s.status = ?'; params.push(status); }
  sql += ' ORDER BY s.slot_date, s.slot_time';
  res.json(db.prepare(sql).all(...params));
}));

app.post('/api/marketing/calendar', (req, res) => requireMarketing(req, res, () => {
  const { slot_date, slot_time, page, pillar, notes } = req.body || {};
  if (!slot_date) return res.status(400).json({ error: 'slot_date required' });
  const info = db.prepare(`INSERT INTO content_calendar_slots (slot_date, slot_time, page, pillar, status, notes) VALUES (?, ?, ?, ?, 'empty', ?)`)
    .run(slot_date, slot_time || null, page || 'china', pillar || null, notes || '');
  res.json({ success: true, id: info.lastInsertRowid });
}));

app.put('/api/marketing/calendar/:id', (req, res) => requireMarketing(req, res, () => {
  const { slot_date, slot_time, post_id, status, notes } = req.body || {};
  const existing = db.prepare(`SELECT * FROM content_calendar_slots WHERE id=?`).get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Slot not found' });
  db.prepare(`UPDATE content_calendar_slots SET slot_date=?, slot_time=?, post_id=?, status=?, notes=? WHERE id=?`)
    .run(slot_date !== undefined ? slot_date : existing.slot_date, slot_time !== undefined ? slot_time : existing.slot_time, post_id !== undefined ? post_id : existing.post_id, status !== undefined ? status : existing.status, notes !== undefined ? notes : existing.notes, req.params.id);
  res.json({ success: true });
}));

app.delete('/api/marketing/calendar/:id', (req, res) => requireMarketing(req, res, () => {
  db.prepare(`DELETE FROM content_calendar_slots WHERE id=?`).run(req.params.id);
  res.json({ success: true });
}));

// Auto-assign a post to a calendar slot
app.post('/api/marketing/calendar/:id/assign', (req, res) => requireMarketing(req, res, () => {
  const slotId = parseInt(req.params.id);
  const { post_id } = req.body || {};
  if (!post_id) return res.status(400).json({ error: 'post_id required' });
  db.prepare(`UPDATE content_calendar_slots SET post_id=?, status='planned' WHERE id=?`).run(post_id, slotId);
  res.json({ success: true });
}));

// ── Auto-Scheduling Engine ────────────────────────────────────────
app.post('/api/marketing/auto-schedule', (req, res) => requireMarketing(req, res, () => {
  const { post_id, page, platform, preferred_date, preferred_time } = req.body || {};
  if (!post_id) return res.status(400).json({ error: 'post_id required' });
  
  const post = db.prepare(`SELECT * FROM content_posts WHERE id=?`).get(post_id);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  
  // Determine best time
  let date = preferred_date;
  let time = preferred_time;
  
  if (!date) {
    // Default to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    date = tomorrow.toISOString().slice(0, 10);
  }
  
  if (!time) {
    // Get best time for this page/platform/day
    const dayOfWeek = new Date(date).getDay();
    const bestTime = db.prepare(`SELECT time_slot, engagement_score FROM best_time_slots WHERE page=? AND platform=? AND day_of_week=? ORDER BY engagement_score DESC LIMIT 1`).get(page || post.page, platform || post.platform || 'facebook', dayOfWeek);
    time = bestTime?.time_slot || '19:00';
  }
  
  // Create calendar slot if not exists
  const existingSlot = db.prepare(`SELECT * FROM content_calendar_slots WHERE slot_date=? AND slot_time=? AND page=?`).get(date, time, page || post.page);
  let slotId;
  if (!existingSlot) {
    const slot = db.prepare(`INSERT INTO content_calendar_slots (slot_date, slot_time, page, pillar, post_id, status, notes) VALUES (?, ?, ?, ?, ?, 'scheduled', ?)`)
      .run(date, time, page || post.page, post.pillar, post_id, `Auto-scheduled for ${time}`);
    slotId = slot.lastInsertRowid;
  } else {
    db.prepare(`UPDATE content_calendar_slots SET post_id=?, status='scheduled' WHERE id=?`).run(post_id, existingSlot.id);
    slotId = existingSlot.id;
  }
  
  // Create publishing schedule entry
  const sched = db.prepare(`INSERT INTO publishing_schedule (post_id, page, platform, scheduled_date, scheduled_time, status) VALUES (?, ?, ?, ?, ?, 'pending')`)
    .run(post_id, page || post.page, platform || post.platform || 'facebook', date, time);
  
  // Update post status
  db.prepare(`UPDATE content_posts SET status='scheduled', post_date=?, post_time=? WHERE id=?`).run(date, time, post_id);
  
  res.json({ success: true, slot_id: slotId, schedule_id: sched.lastInsertRowid, date, time });
}));

// ── Best Time Analytics ────────────────────────────────────────
app.get('/api/marketing/best-times', (req, res) => requireMarketing(req, res, () => {
  const { page, platform } = req.query;
  let sql = `SELECT * FROM best_time_slots WHERE 1=1`;
  const params = [];
  if (page) { sql += ' AND page = ?'; params.push(page); }
  if (platform) { sql += ' AND platform = ?'; params.push(platform); }
  sql += ' ORDER BY engagement_score DESC';
  res.json(db.prepare(sql).all(...params));
}));

app.post('/api/marketing/best-times', (req, res) => requireMarketing(req, res, () => {
  const { page, platform, day_of_week, time_slot, engagement_score } = req.body || {};
  if (!page || time_slot === undefined || day_of_week === undefined) return res.status(400).json({ error: 'page, day_of_week, time_slot required' });
  const info = db.prepare(`INSERT OR REPLACE INTO best_time_slots (page, platform, day_of_week, time_slot, engagement_score) VALUES (?, ?, ?, ?, ?)`)
    .run(page, platform || 'facebook', day_of_week, time_slot, engagement_score || 0);
  res.json({ success: true });
}));

// ── Publishing Schedule (auto-polling endpoint) ────────────────────
app.get('/api/marketing/publishing-schedule/due', (req, res) => {
  // This is called by n8n to get posts that are due to publish
  const isInternal = req.headers['x-api-key'] === INTERNAL_API_KEY;
  if (!isInternal) return res.status(401).json({ error: 'Unauthorized' });
  
  const now = new Date().toISOString();
  const due = db.prepare(`SELECT ps.*, cp.hook, cp.body, cp.hashtags, cp.cta, cp.asset_url, cp.brief FROM publishing_schedule ps LEFT JOIN content_posts cp ON ps.post_id = cp.id WHERE ps.status = 'pending' AND (ps.scheduled_date || 'T' || ps.scheduled_time) <= ? ORDER BY ps.scheduled_date, ps.scheduled_time LIMIT 10`).get(now);
  res.json(due || []);
});

app.post('/api/marketing/publishing-schedule/:id/publish', (req, res) => requireMarketing(req, res, () => {
  const scheduleId = parseInt(req.params.id);
  const { platform_post_id, platform_post_url } = req.body || {};
  db.prepare(`UPDATE publishing_schedule SET status='published', published_at=datetime('now'), platform_post_id=?, platform_post_url=? WHERE id=?`).run(platform_post_id || null, platform_post_url || null, scheduleId);
  res.json({ success: true });
}));

app.post('/api/marketing/publishing-schedule/:id/fail', (req, res) => requireMarketing(req, res, () => {
  const scheduleId = parseInt(req.params.id);
  const { error } = req.body || {};
  db.prepare(`UPDATE publishing_schedule SET status='failed', error_message=? WHERE id=?`).run(error || 'Unknown', scheduleId);
  res.json({ success: true });
}));

// ── Pipeline Logs (audit trail) ──────────────────────────
app.get('/api/marketing/posts/:id/logs', (req, res) => requireMarketing(req, res, () => {
  const logs = db.prepare(`SELECT * FROM pipeline_logs WHERE post_id=? ORDER BY created_at DESC`).all(req.params.id);
  res.json(logs);
}));

// ── Dashboard Stats ───────────────────────────────────────
app.get('/api/marketing/dashboard', (req, res) => requireMarketing(req, res, () => {
  const totalPosts = db.prepare(`SELECT COUNT(*) as count FROM content_posts`).get().count;
  const byStatus = db.prepare(`SELECT status, COUNT(*) as count FROM content_posts GROUP BY status`).all();
  const publishedThisMonth = db.prepare(`SELECT COUNT(*) as count FROM content_posts WHERE status='published' AND strftime('%Y-%m', published_at) = strftime('%Y-%m', 'now')`).get().count;
  const activeCampaigns = db.prepare(`SELECT COUNT(*) as count FROM campaigns WHERE status='active'`).get().count;
  const pendingAssets = db.prepare(`SELECT COUNT(*) as count FROM content_assets WHERE status IN ('pending','in_progress')`).get().count;
  const queuedPosts = db.prepare(`SELECT COUNT(*) as count FROM publishing_queue WHERE status='queued'`).get().count;
  
  res.json({ totalPosts, byStatus, publishedThisMonth, activeCampaigns, pendingAssets, queuedPosts });
}));

// --- TEMPORARY DB DOWNLOAD/UPLOAD ---
app.get('/api/admin/download-db', (req, res) => {
  res.download(DB_PATH);
});

const fs = require('fs');
app.post('/api/admin/upload-db', express.raw({ type: '*/*', limit: '50mb' }), (req, res) => {
  if (!req.body || req.body.length === 0) return res.status(400).send('No file');
  fs.writeFileSync(DB_PATH, req.body);
  res.json({ success: true, message: 'Database replaced successfully. Restarting...' });
  setTimeout(() => process.exit(0), 1000); // Force PM2/Hostinger to restart
});
// ------------------------------------

// Catch-all: serve React app for any non-API route (production)
// Express v5 requires '/{*path}' instead of '*'
if (process.env.NODE_ENV === 'production') {
  app.get('/{*path}', (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.sendFile(join(__dirname, 'dist', 'index.html'));
  });
}

let isBackgroundSyncing = false;

// Background loop to poll Facebook for new messages because webhooks are dropped in Development mode
setInterval(async () => {
  try {
    if (!dbReady || isBackgroundSyncing) return;
    isBackgroundSyncing = true;
    const channels = db.prepare("SELECT id, name, type FROM channels WHERE type IN ('messenger', 'instagram') AND active = 1").all();
    for (const channel of channels) {
      // Run a fast, 1-month sync (max 5 conversations) in the background to prevent WASM OOM crashes
      await syncChannelMessages(channel.id, 1, 5).catch(err => {
        console.warn(`[sync-polling-loop] Sync failed for channel ${channel.name}:`, err.message);
      });
    }
  } catch (err) {
    console.error('[sync-polling-loop] Global error in background loop:', err.message);
  } finally {
    isBackgroundSyncing = false;
  }
}, 15000);

// ── Automated Daily Backups ───────────────────────────────────────
setInterval(() => {
  try {
    if (!dbReady || !db) return;
    const backupsDir = join(DB_DIR, 'backups');
    if (!existsSync(backupsDir)) {
      mkdirSync(backupsDir, { recursive: true });
    }
    
    // Create new backup
    const dateStr = new Date().toISOString().slice(0, 10);
    const backupPath = join(backupsDir, `crm_backup_${dateStr}.db`);
    db.flush();
    const data = db.export();
    writeFileSync(backupPath, Buffer.from(data));
    console.log(`[backup] Automated backup created: ${backupPath}`);
    
    // Cleanup backups older than 7 days
    const files = readdirSync(backupsDir);
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const fs = require('fs');
    files.forEach(file => {
      const filePath = join(backupsDir, file);
      const stat = fs.statSync(filePath);
      if (stat.mtimeMs < sevenDaysAgo && file.endsWith('.db')) {
        fs.unlinkSync(filePath);
        console.log(`[backup] Deleted old automated backup: ${file}`);
      }
    });
  } catch (err) {
    console.error('[backup] Automated backup failed:', err.message);
  }
}, 24 * 60 * 60 * 1000); // 24 hours

// ---------------------------------------------------------
// ONE-TIME RETROACTIVE SCAN: Find BD phone numbers in old chats and create leads
// ---------------------------------------------------------
function scanOldChatsForLeads() {
  try {
    console.log('--- STARTING RETROACTIVE CHAT SCAN ---');
    const bdPhoneRegex = /(?:\+?88[\s-]*)?01[3-9](?:[\s-]*\d){8}/;
    
    // Find contacts with no lead_id and no phone
    const contacts = db.prepare("SELECT * FROM contacts WHERE lead_id IS NULL AND (phone IS NULL OR phone = '')").all();
    let foundCount = 0;

    for (const contact of contacts) {
      // Find all incoming messages for this contact
      const msgs = db.prepare(`
        SELECT m.content, m.conversation_id 
        FROM messages m
        JOIN conversations c ON m.conversation_id = c.id
        WHERE c.contact_id = ? AND m.direction = 'in' AND m.type = 'text' AND m.content IS NOT NULL
        ORDER BY m.id ASC
      `).all(contact.id);

      for (const msg of msgs) {
        const match = msg.content.match(bdPhoneRegex);
        if (match) {
          const extractedPhone = match[0];
          console.log(`[Retro Scan] Found phone ${extractedPhone} for contact ${contact.name}`);
          
          // Update contact phone
          db.prepare("UPDATE contacts SET phone=? WHERE id=? AND (phone IS NULL OR phone = '')").run(extractedPhone, contact.id);
          
          // Re-fetch contact and create lead
          const updatedContact = db.prepare("SELECT * FROM contacts WHERE id=?").get(contact.id);
          if (updatedContact) {
            autoLinkOrCreateLead(updatedContact);
            foundCount++;
          }
          break; // Stop scanning messages for this contact once a phone is found
        }
      }
    }
    console.log(`--- FINISHED RETROACTIVE SCAN. Created ${foundCount} leads! ---`);
  } catch(e) {
    console.error('Retro scan error:', e.message);
  }
}

// Retroactively fix page names for old leads
try {
  const leadsToFix = db.prepare("SELECT id FROM leads WHERE page_name IS NULL OR page_name = ''").all();
  let fixedCount = 0;
  for (const l of leadsToFix) {
     const throughConv = db.prepare(`SELECT c.name, c.id FROM channels c JOIN conversations conv ON conv.channel_id = c.id WHERE conv.lead_id = ? LIMIT 1`).get(l.id);
     const throughContact = db.prepare(`SELECT c.name, c.id FROM channels c JOIN conversations conv ON conv.channel_id = c.id JOIN contacts con ON conv.contact_id = con.id WHERE con.lead_id = ? LIMIT 1`).get(l.id);
     
     if (throughConv && throughConv.name) {
       db.prepare("UPDATE leads SET page_name = ?, channel_id = ? WHERE id = ?").run(throughConv.name, throughConv.id, l.id);
       fixedCount++;
     } else if (throughContact && throughContact.name) {
       db.prepare("UPDATE leads SET page_name = ?, channel_id = ? WHERE id = ?").run(throughContact.name, throughContact.id, l.id);
       fixedCount++;
     } else {
       // If channel is missing from DB, try to find another lead that used this conversation's channel_id and has a page_name
       const orphanConv = db.prepare(`SELECT channel_id FROM conversations WHERE lead_id = ? LIMIT 1`).get(l.id);
       if (orphanConv && orphanConv.channel_id) {
         // Try to find an existing lead with this channel_id that HAS a page_name
         const peerLead = db.prepare(`SELECT page_name FROM leads l JOIN conversations c ON l.id = c.lead_id WHERE c.channel_id = ? AND l.page_name IS NOT NULL AND l.page_name != '' LIMIT 1`).get(orphanConv.channel_id);
         if (peerLead && peerLead.page_name) {
           db.prepare("UPDATE leads SET page_name = ?, channel_id = ? WHERE id = ?").run(peerLead.page_name, orphanConv.channel_id, l.id);
           fixedCount++;
         } else {
           db.prepare("UPDATE leads SET page_name = ?, channel_id = ? WHERE id = ?").run("Unknown Page", orphanConv.channel_id, l.id);
           fixedCount++;
         }
       } else {
           db.prepare("UPDATE leads SET page_name = ? WHERE id = ?").run("Unknown Page", l.id);
           fixedCount++;
       }
     }
  }
  console.log(`[Startup] Fixed page_name for ${fixedCount} existing leads.`);
} catch(e) {
  console.error('[Startup] Failed to fix page_name:', e.message);
}

// Retroactively fix page_name for Meta Lead Ads by looking up form_id from Facebook API
async function backfillMetaLeadAds() {
  try {
    const missingLeads = db.prepare("SELECT DISTINCT meta_form_id FROM leads WHERE meta_form_id IS NOT NULL AND page_name IS NULL").all();
    if (missingLeads.length === 0) return;
    
    console.log(`[Startup] Found ${missingLeads.length} unique form_ids to backfill from Meta API.`);
    const channels = db.prepare("SELECT * FROM channels WHERE type IN ('messenger', 'facebook', 'instagram') AND access_token IS NOT NULL").all();
    
    for (const { meta_form_id } of missingLeads) {
      let found = false;
      for (const channel of channels) {
        try {
          const pageToken = await resolvePageAccessToken(channel.page_id, channel.access_token);
          const r = await fetch(`https://graph.facebook.com/v19.0/${meta_form_id}?fields=page&access_token=${pageToken}`);
          const d = await r.json();
          if (d.page && d.page.id) {
            const pageIdStr = String(d.page.id).trim();
            // Find which channel has this page_id
            const matchedChannel = db.prepare("SELECT * FROM channels WHERE trim(page_id)=?").get(pageIdStr);
            if (matchedChannel) {
              const fix = db.prepare("UPDATE leads SET page_name=?, channel_id=? WHERE meta_form_id=? AND page_name IS NULL").run(matchedChannel.name, matchedChannel.id, meta_form_id);
              console.log(`[Startup] Backfilled ${fix.changes} leads for form ${meta_form_id} -> Page: ${matchedChannel.name}`);
              found = true;
              break;
            }
          }
        } catch(e) {}
      }
      if (!found) console.log(`[Startup] Could not find page for form ${meta_form_id}`);
    }
  } catch (e) {
    console.error('[Startup] Failed to backfill Meta Lead Ads:', e.message);
  }
}
setTimeout(backfillMetaLeadAds, 7000);

// Run immediately after server starts
setTimeout(scanOldChatsForLeads, 3000);
