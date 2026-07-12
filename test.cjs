const Database = require('better-sqlite3');
const db = new Database('crm.db');
const nullLeads = db.prepare("SELECT COUNT(*) as count FROM leads WHERE page_name IS NULL").get();
console.log("Leads with null page_name:", nullLeads.count);
