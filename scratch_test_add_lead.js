import { initDatabase } from './sqldb.js';
async function run() {
  const db = await initDatabase('./crm.db');
  const d = { client_name: 'ssss', phone: '01987654322', email: 'student@example.com' }; // mimic form
  function nextLeadId() { return 'BD-1000'; }
  function leadParams(d, lead_id, balance) {
     const txt = v => (v === '' || v == null) ? null : v;
     return { lead_id, client_name: d.client_name, phone: d.phone, date_added: '2026-07-12', lead_source: 'Manual', lead_status: 'New Lead' };
  }
  const params = leadParams(d, nextLeadId(), 0);
  try {
     console.log("Preparing...");
     const LEAD_INSERT_SQL = `INSERT INTO leads (lead_id, date_added, client_name, phone, lead_source, lead_status) VALUES (:lead_id, :date_added, :client_name, :phone, :lead_source, :lead_status)`;
     const info = db.prepare(LEAD_INSERT_SQL).run(params);
     console.log("Success", info);
  } catch(e) {
     console.error("Error", e);
  }
}
run();
