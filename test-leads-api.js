import { initDatabase } from './sqldb.js';
(async () => {
  const db = await initDatabase('./crm.db');
  const leads = db.prepare("SELECT l.* FROM leads l ORDER BY id DESC LIMIT 5").all();
  console.log(JSON.stringify(leads, null, 2));
})();
