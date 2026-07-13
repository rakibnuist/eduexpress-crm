import { initDatabase } from './sqldb.js';

async function test() {
  const db = await initDatabase('./crm.db');
  try {
    const emp = db.prepare("SELECT id FROM employees WHERE emp_id=?").get(undefined);
    console.log("Success:", emp);
  } catch(e) {
    console.log("Error:", e.message);
  }
}
test();
