import { initDatabase } from './sqldb.js';
const db = initDatabase();
console.log(db.prepare("PRAGMA table_info(leads)").all().map(r => r.name));
