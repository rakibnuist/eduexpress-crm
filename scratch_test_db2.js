import { initDatabase } from './sqldb.js';
async function run() {
  const db = await initDatabase('./crm.db');
  console.log("DB initialized");
  let errCount = 0;
  for (let i=0; i<10000; i++) {
     try {
       // Pass an object where a scalar is expected, or something that causes bind to throw
       db.prepare("SELECT * FROM contacts WHERE messenger_id=?").get({});
     } catch(e) {
       errCount++;
     }
  }
  console.log("Done 10000, errors:", errCount);
}
run();
