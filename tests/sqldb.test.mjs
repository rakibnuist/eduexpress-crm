import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { initDatabase, validateDatabaseBuffer } from '../sqldb.js';

test('transactions commit once, roll back on failure, and support nesting', async () => {
  const testDir = mkdtempSync(join(tmpdir(), 'crm-sqldb-test-'));
  const dbPath = join(testDir, 'test.db');
  const db = await initDatabase(dbPath);

  try {
    db.exec('CREATE TABLE test_items (id INTEGER PRIMARY KEY, name TEXT)');

    db.transaction(() => {
      db.prepare('INSERT INTO test_items (name) VALUES (?)').run('one');
      db.prepare('INSERT INTO test_items (name) VALUES (?)').run('two');
    })();

    assert.throws(() => {
      db.transaction(() => {
        db.prepare('INSERT INTO test_items (name) VALUES (?)').run('rolled-back');
        throw new Error('force rollback');
      })();
    }, /force rollback/);

    db.transaction(() => {
      db.prepare('INSERT INTO test_items (name) VALUES (?)').run('outer');
      db.transaction(() => {
        db.prepare('INSERT INTO test_items (name) VALUES (?)').run('inner');
      })();
    })();

    db.flush();
    assert.deepEqual(
      db.prepare('SELECT name FROM test_items ORDER BY id').all().map(row => row.name),
      ['one', 'two', 'outer', 'inner'],
    );
    assert.deepEqual(validateDatabaseBuffer(readFileSync(dbPath), ['test_items']), {
      valid: true,
      tables: 1,
    });
    assert.throws(
      () => validateDatabaseBuffer(readFileSync(dbPath), ['missing_table']),
      /Required tables missing/,
    );
    assert.throws(
      () => validateDatabaseBuffer(Buffer.from('not a sqlite database')),
      /file is not a database|not a database/i,
    );
  } finally {
    db.close();
    rmSync(testDir, { recursive: true, force: true });
  }
});
