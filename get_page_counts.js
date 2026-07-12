const Database = require('better-sqlite3');
const db = new Database('crm.db');
const rows = db.prepare("SELECT page_name, COUNT(*) as count FROM leads GROUP BY page_name").all();
console.log(JSON.stringify(rows, null, 2));
