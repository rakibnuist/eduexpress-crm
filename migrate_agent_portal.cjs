const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./crm.db');

db.serialize(() => {
  console.log("Starting migration...");

  // 1. Create partner_agencies table
  db.run(`
    CREATE TABLE IF NOT EXISTS partner_agencies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agency_name TEXT NOT NULL,
      contact_person TEXT,
      phone TEXT,
      email TEXT,
      commission_rate REAL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `, (err) => {
    if (err) console.error("Error creating partner_agencies:", err);
    else console.log("partner_agencies table checked/created.");
  });

  // 2. Add agency_id to users
  db.run(`ALTER TABLE users ADD COLUMN agency_id INTEGER`, (err) => {
    if (err && !err.message.includes("duplicate column name")) {
      console.error("Error adding agency_id to users:", err);
    } else {
      console.log("agency_id added to users (or already exists).");
    }
  });

  // 3. Add agency_id to leads
  db.run(`ALTER TABLE leads ADD COLUMN agency_id INTEGER`, (err) => {
    if (err && !err.message.includes("duplicate column name")) {
      console.error("Error adding agency_id to leads:", err);
    } else {
      console.log("agency_id added to leads (or already exists).");
    }
  });

  // 4. Add lead_type to leads
  db.run(`ALTER TABLE leads ADD COLUMN lead_type TEXT DEFAULT 'B2C'`, (err) => {
    if (err && !err.message.includes("duplicate column name")) {
      console.error("Error adding lead_type to leads:", err);
    } else {
      console.log("lead_type added to leads (or already exists).");
    }
  });

  // 5. Add document_drive_link to leads
  db.run(`ALTER TABLE leads ADD COLUMN document_drive_link TEXT`, (err) => {
    if (err && !err.message.includes("duplicate column name")) {
      console.error("Error adding document_drive_link to leads:", err);
    } else {
      console.log("document_drive_link added to leads (or already exists).");
    }
  });

  console.log("Migration script executed.");
});

db.close();
