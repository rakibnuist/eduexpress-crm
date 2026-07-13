import { initDatabase } from './sqldb.js';

(async () => {
  const db = await initDatabase('crm.db');
  global.db = db;

  const conv = db.prepare("SELECT * FROM conversations WHERE id=491").get();
  const contact = db.prepare("SELECT * FROM contacts WHERE id=?").get(conv.contact_id);
  console.log("Contact:", contact);

  const LEAD_INSERT_SQL = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='leads'").get().sql; // no this is DDL
  // We'll read server.js to extract createLeadFromContact and run it
})();
