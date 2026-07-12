const Database = require('better-sqlite3');
const db = new Database('crm.db');

const before = db.prepare("SELECT id, page_name FROM leads WHERE id = 14").get();
console.log('Before:', before);

const res = db.prepare(`
    UPDATE leads 
    SET page_name = (
      SELECT c.name 
      FROM channels c 
      JOIN conversations conv ON conv.channel_id = c.id 
      WHERE conv.lead_id = leads.id 
      LIMIT 1
    ) 
    WHERE id = 14
`).run();
console.log('Changes:', res.changes);

const after = db.prepare("SELECT id, page_name FROM leads WHERE id = 14").get();
console.log('After:', after);
