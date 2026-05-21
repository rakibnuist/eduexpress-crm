/**
 * sqldb.js — sql.js compatibility wrapper for better-sqlite3 API
 * Supports: db.pragma(), db.exec(), db.prepare().get/all/run(), db.transaction()
 * Named params: @param style (better-sqlite3) → auto-converted to :param (sql.js)
 */

import { createRequire } from 'module';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

let _SQL = null;
let _db = null;
let _dbPath = null;
let _saveTimer = null;

// Debounced save — batches rapid writes into one disk write per 200ms
function scheduleSave() {
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => {
    try {
      const data = _db.export();
      writeFileSync(_dbPath, Buffer.from(data));
    } catch (e) {
      console.error('[sqldb] save error:', e.message);
    }
  }, 200);
}

function immediatelySave() {
  try {
    if (_saveTimer) { clearTimeout(_saveTimer); _saveTimer = null; }
    const data = _db.export();
    writeFileSync(_dbPath, Buffer.from(data));
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
      // Support both .get(obj) and .get(val1, val2, ...)
      const params = args.length === 1 ? convertParams(args[0]) : args;
      try {
        const stmt = _db.prepare(sql);
        stmt.bind(params);
        const row = stmt.step() ? stmt.getAsObject() : undefined;
        stmt.free();
        return row || undefined;
      } catch (e) {
        throw new Error(`[sqldb] get failed: ${e.message}\nSQL: ${sql}`);
      }
    },

    all(...args) {
      const params = args.length === 0 ? {} : args.length === 1 ? convertParams(args[0]) : args;
      try {
        const stmt = _db.prepare(sql);
        stmt.bind(params);
        const rows = [];
        while (stmt.step()) rows.push(stmt.getAsObject());
        stmt.free();
        return rows;
      } catch (e) {
        throw new Error(`[sqldb] all failed: ${e.message}\nSQL: ${sql}`);
      }
    },

    run(...args) {
      const params = args.length === 0 ? {} : args.length === 1 ? convertParams(args[0]) : args;
      try {
        const stmt = _db.prepare(sql);
        stmt.bind(params);
        stmt.step();
        stmt.free();
        const changes = _db.getRowsModified();
        const lastInsertRowid = _db.exec('SELECT last_insert_rowid()')[0]?.values[0][0] ?? 0;
        if (write) scheduleSave();
        return { changes, lastInsertRowid };
      } catch (e) {
        throw new Error(`[sqldb] run failed: ${e.message}\nSQL: ${sql}`);
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

  // Use sql-asm.js (pure JavaScript, no WASM file needed — works on any server)
  const initSqlJs = require(join(__dirname, 'node_modules/sql.js/dist/sql-asm.js'));
  _SQL = await initSqlJs();

  // Load existing DB file or create new
  if (existsSync(dbPath)) {
    const buf = readFileSync(dbPath);
    _db = new _SQL.Database(buf);
    console.log(`[sqldb] Loaded existing DB from ${dbPath}`);
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
      try {
        _db.run(sql);
        immediatelySave();
      } catch (e) {
        // Ignore "already exists" errors (CREATE TABLE IF NOT EXISTS sometimes still throws)
        if (!e.message.includes('already exists')) throw e;
      }
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

    close() { immediatelySave(); _db.close(); }
  };
}
