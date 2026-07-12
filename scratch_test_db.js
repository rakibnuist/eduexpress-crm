import { initDatabase } from './sqldb.js';
async function run() {
  const db = await initDatabase('./crm.db');
  console.log("DB initialized");
  try {
    for (let i=0; i<10000; i++) {
       db.prepare("SELECT * FROM contacts WHERE messenger_id=?").get("123");
    }
    console.log("Done 10000");
  } catch(e) {
    console.error("Failed:", e);
  }
}
run();
