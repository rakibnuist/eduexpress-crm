import { getDb } from './sqldb.js';
const db = getDb();
const rows = db.prepare('SELECT lead_id, source, lead_market, lead_type, lead_source, page_name, channel_id FROM leads ORDER BY id DESC LIMIT 10').all();
console.log(rows);
