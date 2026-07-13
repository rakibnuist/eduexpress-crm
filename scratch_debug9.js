import { initDatabase } from './sqldb.js';
import fs from 'fs';

async function test() {
  const db = await initDatabase('./crm.db');
  
  const serverjs = fs.readFileSync('server.js', 'utf8');
  const match = serverjs.match(/const LEAD_INSERT_SQL = `INSERT INTO leads \(([\s\S]+?)\) VALUES \(([\s\S]+?)\)`/);
  if (!match) throw new Error("Could not parse");
  
  const cols = match[1].split(',').map(s => s.trim().replace(/\n/g, '')).filter(Boolean);
  
  const tableInfo = db.prepare("PRAGMA table_info(leads)").all();
  const dbCols = tableInfo.map(c => c.name);
  
  let missing = [];
  for (const c of cols) {
    if (!dbCols.includes(c)) {
      missing.push(c);
    }
  }
  
  if (missing.length > 0) {
    console.log("THE FOLLOWING COLUMNS ARE IN LEAD_INSERT_SQL BUT NOT IN THE DATABASE SCHEMA:");
    console.log(missing.join(', '));
  } else {
    console.log("All columns in LEAD_INSERT_SQL exist in the database!");
  }
}
test();
