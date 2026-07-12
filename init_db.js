import { initDatabase } from './sqldb.js';
import crypto from 'crypto';

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

async function run() {
  const db = await initDatabase('./crm.db');
  db.pauseSave();
  
  db.exec(`
    DROP TABLE IF EXISTS partner_agencies;
    CREATE TABLE IF NOT EXISTS partner_agencies (
      id TEXT PRIMARY KEY,
      agency_name TEXT NOT NULL,
      contact_person TEXT,
      phone TEXT,
      email TEXT,
      commission_rate REAL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
  
  const insertAgency = db.prepare(`
    INSERT INTO partner_agencies (id, agency_name, email, commission_rate)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(id) DO NOTHING;
  `);
  insertAgency.run(['TEST_AGENCY_1', 'Global Edutrust Partners', 'partners@globaledutrust.com', 15]);
  
  const pHash = hashPassword('agent123');
  const insertUser = db.prepare(`
    INSERT INTO users (email, name, password_hash, role, roles, agency_id, active)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(email) DO UPDATE SET password_hash=?, roles=?, agency_id=?;
  `);
  insertUser.run([
    'agent@test.com', 'Agent Smith', pHash, 'agent', '["agent"]', 'TEST_AGENCY_1', 1,
    pHash, '["agent"]', 'TEST_AGENCY_1'
  ]);
  
  db.resumeSave();
  console.log('Schema setup and agency user (agent@test.com / agent123) created successfully.');
  process.exit(0);
}
run();
