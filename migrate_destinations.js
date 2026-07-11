import { initDatabase } from './sqldb.js';

async function run() {
  const db = await initDatabase('crm.db');
  
  // Ensure the table exists since we just added it to schema but server might not have restarted yet
  db.exec(`
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
  `);

  const row = db.prepare("SELECT value FROM meta_config WHERE key='settings_destinations'").get();
  if (row && row.value) {
    try {
      const dests = JSON.parse(row.value);
      for (const d of dests) {
        const slug = d.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        db.prepare(`INSERT OR IGNORE INTO destinations (slug, name, is_public) VALUES (?, ?, 1)`).run(slug, d);
      }
      console.log(`Migrated ${dests.length} destinations.`);
    } catch (e) {
      console.error('Error parsing existing destinations', e);
    }
  } else {
    // Default destinations
    const defaults = ['China', 'Malta', 'Hungary', 'Greece', 'Estonia', 'Georgia', 'Malaysia', 'Thailand'];
    for (const d of defaults) {
      const slug = d.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      db.prepare(`INSERT OR IGNORE INTO destinations (slug, name, is_public) VALUES (?, ?, 1)`).run(slug, d);
    }
    console.log(`Migrated ${defaults.length} default destinations.`);
  }
}

run().catch(console.error);
