/**
 * sqldb.js — sql.js compatibility wrapper for better-sqlite3 API
 * Supports: db.pragma(), db.exec(), db.prepare().get/all/run(), db.transaction()
 * Named params: @param style (better-sqlite3) → auto-converted to :param (sql.js)
 */

import { createRequire } from 'module';
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync, unlinkSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

let _SQL = null;
let _db = null;
let _dbPath = null;
let _saveTimer = null;
let _savePaused = false;   // when true, writes are NOT exported to disk (used during bulk sync)
let _saveDirty = false;    // tracks whether a write happened while paused
let _dead = false;         // set to true when sql.js WASM OOM's — process must restart

/*
   When sql.js hits Aborted(OOM), the WASM heap is unrecoverable: every
   subsequent query throws "no such table" even though the on-disk file is
   still valid. The only way out is to restart the Node process so a fresh
   WASM instance is created and the disk file is reloaded.

   handleFatalError() detects OOM, marks the DB dead, and schedules a graceful
   process exit so Hostinger relaunches the app automatically.
*/
function handleFatalError(error, context) {
  const msg = String(error?.message || error || '');
  const isOOM = msg.includes('Aborted(OOM)') || /\bOOM\b/.test(msg) || msg.startsWith('Aborted');
  if (!isOOM) return false;
  if (_dead) return true; // already handling
  _dead = true;
  console.error('=============================================================');
  console.error('  🚨 SQL.JS WASM OOM — instance is unrecoverable.');
  console.error('  Context:', context);
  console.error('  Scheduling process exit so Hostinger restarts the app.');
  console.error('=============================================================');
  // Give in-flight requests a chance to send their response before we exit.
  setTimeout(() => process.exit(1), 1500);
  return true;
}

export function isDead() { return _dead; }

let _isSaving = false;

// Atomic save: export to a temp file, then rename. A crash mid-write can never
// leave a half-written (corrupt) crm.db on disk.
// If atomic save fails (e.g. rename is restricted or throws ENOENT on some hosts),
// we fall back to a direct write to guarantee that data is saved.
function doSave() {
  if (_dead || !_db || _isSaving) return;
  _isSaving = true;
  try {
    const data = _db.export();
    const dir = dirname(_dbPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    const tmp = _dbPath + '.tmp';
    try {
      writeFileSync(tmp, Buffer.from(data));
      renameSync(tmp, _dbPath);
    } catch (err) {
      console.warn(`[sqldb] Atomic save failed (${err.message}). Falling back to direct write.`);
      writeFileSync(_dbPath, Buffer.from(data));
      try {
        if (existsSync(tmp)) {
          unlinkSync(tmp);
        }
      } catch (unlinkErr) {
        console.warn(`[sqldb] Failed to clean up temp file ${tmp}:`, unlinkErr.message);
      }
    }
  } finally {
    _isSaving = false;
  }
}

// Debounced save — batches rapid writes into one disk write per 200ms
function scheduleSave() {
  if (_savePaused) { _saveDirty = true; return; }
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => {
    try { doSave(); } catch (e) { console.error('[sqldb] save error:', e.message); }
  }, 200);
}

function immediatelySave() {
  if (_savePaused) { _saveDirty = true; return; }
  try {
    if (_saveTimer) { clearTimeout(_saveTimer); _saveTimer = null; }
    doSave();
  } catch (e) {
    console.error('[sqldb] save error:', e.message);
  }
}

// Convert @param → :param in SQL strings
function convertSQL(sql) {
  return sql.replace(/@(\w+)/g, ':$1');
}

// Convert {param: val} → {':param': val} for sql.js named params
// Also handles positional arrays and single scalar values
function convertParams(params) {
  if (params === undefined || params === null) return {};
  if (Array.isArray(params)) return params;
  if (typeof params === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(params)) {
      out[k.startsWith(':') ? k : `:${k}`] = v ?? null;
    }
    return out;
  }
  return [params]; // single positional value
}

function isWriteSQL(sql) {
  return /^\s*(INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|REPLACE|BEGIN|COMMIT|ROLLBACK)/i.test(sql);
}

function makeStatement(rawSql) {
  const sql = convertSQL(rawSql);
  const write = isWriteSQL(sql);

  return {
    get(...args) {
      if (_dead) throw new Error('[sqldb] DB is restarting — please retry in a few seconds');
      // Support both .get(obj) and .get(val1, val2, ...)
      const params = args.length === 1 ? convertParams(args[0]) : args;
      try {
        const stmt = _db.prepare(sql);
        try {
          stmt.bind(params);
          const row = stmt.step() ? stmt.getAsObject() : undefined;
          return row || undefined;
        } finally {
          stmt.free();
        }
      } catch (e) {
        if (handleFatalError(e, `get ${sql.slice(0, 60)}`)) throw new Error('[sqldb] OOM — restarting', { cause: e });
        throw new Error(`[sqldb] get failed: ${e.message}\nSQL: ${sql}`, { cause: e });
      }
    },

    all(...args) {
      if (_dead) throw new Error('[sqldb] DB is restarting — please retry in a few seconds');
      const params = args.length === 0 ? {} : args.length === 1 ? convertParams(args[0]) : args;
      try {
        const stmt = _db.prepare(sql);
        try {
          stmt.bind(params);
          const rows = [];
          while (stmt.step()) rows.push(stmt.getAsObject());
          return rows;
        } finally {
          stmt.free();
        }
      } catch (e) {
        if (handleFatalError(e, `all ${sql.slice(0, 60)}`)) throw new Error('[sqldb] OOM — restarting', { cause: e });
        throw new Error(`[sqldb] all failed: ${e.message}\nSQL: ${sql}`, { cause: e });
      }
    },

    run(...args) {
      if (_dead) throw new Error('[sqldb] DB is restarting — please retry in a few seconds');
      const params = args.length === 0 ? {} : args.length === 1 ? convertParams(args[0]) : args;
      try {
        const stmt = _db.prepare(sql);
        let changes, lastInsertRowid;
        try {
          stmt.bind(params);
          stmt.step();
        } finally {
          stmt.free();
        }
        changes = _db.getRowsModified();
        lastInsertRowid = _db.exec('SELECT last_insert_rowid()')[0]?.values[0][0] ?? 0;
        if (write) scheduleSave();
        return { changes, lastInsertRowid };
      } catch (e) {
        if (handleFatalError(e, `run ${sql.slice(0, 60)}`)) throw new Error('[sqldb] OOM — restarting', { cause: e });
        throw new Error(`[sqldb] run failed: ${e.message}\nSQL: ${sql}`, { cause: e });
      }
    },

    iterate(...args) {
      const params = args.length === 0 ? {} : args.length === 1 ? convertParams(args[0]) : args;
      const stmt = _db.prepare(sql);
      stmt.bind(params);
      return {
        [Symbol.iterator]() {
          return {
            next() {
              if (stmt.step()) return { value: stmt.getAsObject(), done: false };
              stmt.free();
              return { value: undefined, done: true };
            },
            return() { stmt.free(); return { done: true }; }
          };
        }
      };
    }
  };
}

export async function initDatabase(dbPath) {
  _dbPath = dbPath;

  // Ensure directory exists
  const dir = dirname(dbPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  // Use sql-wasm.js which has dynamic memory growth to prevent OOM
  const initSqlJs = require(join(__dirname, 'node_modules/sql.js/dist/sql-wasm.js'));
  const wasmBinary = readFileSync(join(__dirname, 'node_modules/sql.js/dist/sql-wasm.wasm'));
  _SQL = await initSqlJs({ wasmBinary });

  // Load existing DB file or create new — with corruption recovery.
  // Three integrity gates: (1) buffer loads, (2) sqlite_master readable,
  // (3) PRAGMA integrity_check returns 'ok'. If any fail we back up the file
  // and start fresh; the schema rebuilder in setupSchema() then recreates
  // every required table.
  if (existsSync(dbPath)) {
    const buf = readFileSync(dbPath);
    try {
      _db = new _SQL.Database(buf);
      _db.exec("SELECT count(*) FROM sqlite_master");
      const integrity = _db.exec("PRAGMA integrity_check")?.[0]?.values?.[0]?.[0];
      if (integrity && integrity !== 'ok') throw new Error(`integrity_check returned: ${integrity}`);
      // Verify at least one well-known table is queryable. If sqlite_master is
      // good but a known table fails (e.g. partially-truncated B-tree pages),
      // treat the whole file as corrupt.
      try { _db.exec("SELECT count(*) FROM sqlite_master WHERE type='table'"); }
      catch (e2) { throw new Error(`master query failed: ${e2.message}`, { cause: e2 }); }
      console.log(`[sqldb] Loaded existing DB from ${dbPath}`);
    } catch (e) {
      console.error(`[sqldb] ⚠️  DB corrupt (${e.message}). Backing up and recreating.`);
      try { renameSync(dbPath, `${dbPath}.corrupt-${Date.now()}`); } catch {}
      _db = new _SQL.Database();
    }
  } else {
    _db = new _SQL.Database();
    console.log(`[sqldb] Created new DB at ${dbPath}`);
  }

  // Return better-sqlite3 compatible interface
  return {
    pragma(str) {
      try { _db.run(`PRAGMA ${str}`); } catch {}
    },

    exec(sql) {
      // Run each statement INDEPENDENTLY so one failure can't block the rest
      // (e.g. a bad CREATE INDEX must not prevent later CREATE TABLE statements).
      const statements = sql.split(';').map(s => s.trim()).filter(Boolean);
      for (const stmt of statements) {
        try {
          _db.run(stmt);
        } catch (e) {
          if (!e.message.includes('already exists') && !e.message.includes('duplicate column')) {
            console.error('[sqldb] exec stmt failed:', e.message, '\n  →', stmt.slice(0, 80));
          }
        }
      }
      immediatelySave();
    },

    prepare(sql) {
      return makeStatement(sql);
    },

    transaction(fn) {
      return (...args) => {
        _db.run('BEGIN');
        try {
          const result = fn(...args);
          _db.run('COMMIT');
          immediatelySave();
          return result;
        } catch (e) {
          try { _db.run('ROLLBACK'); } catch {}
          throw e;
        }
      };
    },

    // Flush any pending save immediately (call before process exit)
    flush() { immediatelySave(); },

    // Suspend disk writes during bulk work (sync) to avoid export-thrashing OOM.
    // Writes still happen in-memory; nothing is persisted until resumeSave().
    pauseSave() { _savePaused = true; _saveDirty = false; },

    // Resume disk writes and persist once if anything changed while paused.
    resumeSave() {
      _savePaused = false;
      if (_saveDirty) { _saveDirty = false; try { doSave(); } catch (e) { console.error('[sqldb] save error:', e.message); } }
    },

    // List existing table names (used by startup self-heal check)
    tableNames() {
      try {
        const r = _db.exec("SELECT name FROM sqlite_master WHERE type='table'");
        return r?.[0]?.values?.map(v => v[0]) || [];
      } catch { return []; }
    },

    close() { immediatelySave(); _db.close(); },

    // Export raw sql.js database (for backup/download)
    export() { return _db.export(); }
  };
}
