/**
 * sqldb.js — better-sqlite3 adapter used by the CRM server.
 *
 * The previous sql.js implementation kept the whole database in WebAssembly
 * memory and exported the entire file after every mutation. That made write
 * requests slower as the database grew and exposed the server to unrecoverable
 * WASM out-of-memory failures. This adapter writes directly to SQLite on disk:
 * a successful transaction is durable before the API response is returned.
 */

import Database from 'better-sqlite3';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';

let database = null;
let databasePath = null;
let closed = false;

function requireDatabase() {
  if (!database || closed) {
    throw new Error('[sqldb] Database is not available');
  }
  return database;
}

function checkpoint(mode = 'FULL') {
  if (!database || closed) return;
  database.pragma(`wal_checkpoint(${mode})`);
}

function normalizeRunResult(result) {
  const lastInsertRowid = result.lastInsertRowid;
  return {
    changes: Number(result.changes),
    lastInsertRowid: typeof lastInsertRowid === 'bigint'
      ? Number(lastInsertRowid)
      : lastInsertRowid,
  };
}

function wrapStatement(statement) {
  return {
    get(...args) {
      return statement.get(...args);
    },
    all(...args) {
      return statement.all(...args);
    },
    run(...args) {
      return normalizeRunResult(statement.run(...args));
    },
    iterate(...args) {
      return statement.iterate(...args);
    },
  };
}

export function isDead() {
  return closed;
}

export async function initDatabase(dbPath) {
  if (database && !closed) {
    throw new Error('[sqldb] Database has already been initialized');
  }

  databasePath = dbPath;
  closed = false;

  const dir = dirname(dbPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const existed = existsSync(dbPath);
  try {
    database = new Database(dbPath, {
      fileMustExist: existed,
      timeout: 5000,
    });

    if (existed) {
      const integrity = database.pragma('integrity_check', { simple: true });
      if (integrity !== 'ok') {
        throw new Error(`integrity_check returned: ${integrity}`);
      }
    }

    // WAL permits reads while a write transaction is committing. FULL
    // synchronous mode guarantees that a successful commit is on durable
    // storage before the request returns.
    database.pragma('journal_mode = WAL');
    database.pragma('synchronous = FULL');
    database.pragma('foreign_keys = ON');
    database.pragma('busy_timeout = 5000');
    database.pragma('wal_autocheckpoint = 1000');
    database.pragma('temp_store = MEMORY');

    if (existed) {
      console.log(`[sqldb] Opened durable SQLite database at ${dbPath}`);
    } else {
      console.log(`[sqldb] Created durable SQLite database at ${dbPath}`);
    }
  } catch (error) {
    try {
      database?.close();
    } catch {}
    database = null;
    closed = true;
    throw new Error(
      `[sqldb] Existing database failed integrity validation and was left untouched: ${error.message}`,
      { cause: error },
    );
  }

  return {
    pragma(value) {
      return requireDatabase().pragma(value);
    },

    exec(sql) {
      return requireDatabase().exec(sql);
    },

    prepare(sql) {
      return wrapStatement(requireDatabase().prepare(sql));
    },

    transaction(fn) {
      const transaction = requireDatabase().transaction(fn);
      return (...args) => transaction(...args);
    },

    // SQLite commits are already durable. A checkpoint is still useful before
    // copying/downloading the main file so it contains every committed frame.
    flush() {
      checkpoint('FULL');
    },

    // Kept for compatibility with startup and bulk-sync call sites. Native
    // SQLite transactions no longer require pausing whole-file exports.
    pauseSave() {},
    resumeSave() {},

    tableNames() {
      return requireDatabase()
        .prepare("SELECT name FROM sqlite_master WHERE type='table'")
        .all()
        .map(row => row.name);
    },

    close() {
      if (!database || closed) return;
      checkpoint('TRUNCATE');
      database.close();
      database = null;
      closed = true;
    },

    export() {
      checkpoint('FULL');
      return readFileSync(databasePath);
    },
  };
}

export function validateDatabaseBuffer(buffer, requiredTables = []) {
  const validationDir = mkdtempSync(join(tmpdir(), 'eduexpress-db-validate-'));
  const candidatePath = join(validationDir, 'candidate.db');
  let candidate = null;

  try {
    writeFileSync(candidatePath, Buffer.from(buffer), { mode: 0o600 });
    candidate = new Database(candidatePath, {
      readonly: true,
      fileMustExist: true,
      timeout: 1000,
    });

    const integrity = candidate.pragma('integrity_check', { simple: true });
    if (integrity !== 'ok') {
      throw new Error(`Integrity check failed: ${integrity || 'unknown result'}`);
    }

    const tables = new Set(
      candidate
        .prepare("SELECT name FROM sqlite_master WHERE type='table'")
        .all()
        .map(row => row.name),
    );
    const missing = requiredTables.filter(table => !tables.has(table));
    if (missing.length) {
      throw new Error(`Required tables missing: ${missing.join(', ')}`);
    }

    return { valid: true, tables: tables.size };
  } finally {
    try {
      candidate?.close();
    } catch {}
    rmSync(validationDir, { recursive: true, force: true });
  }
}

function flushBeforeExit() {
  try {
    checkpoint('FULL');
  } catch (error) {
    console.error('[sqldb] Final checkpoint failed:', error.message);
  }
}

process.on('SIGTERM', flushBeforeExit);
process.on('SIGINT', flushBeforeExit);
process.on('beforeExit', flushBeforeExit);
process.on('exit', flushBeforeExit);
