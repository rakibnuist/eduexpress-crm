const Database = require('better-sqlite3');
const db = new Database('crm.db');

const rows = db.prepare("SELECT * FROM conversations LIMIT 10").all();
console.log(rows);
