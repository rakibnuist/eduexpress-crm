import { db } from './sqldb.js';

const LEAD_INSERT_SQL = `INSERT INTO leads (
  id, client_name, source, lead_source, lead_status, passport, degree, major, program, destination,
  intake_term, date_added, lead_market, lead_type, university, last_education,
  english_test_type, gpa, service_fee, paid, deposit, phone, email,
  assigned_consultant, assigned_employee_id, next_followup, application_stage, referrer,
  page_name, meta_ad_id, meta_campaign, meta_adset_name, meta_adset_id,
  ad_name, channel_id, notes, drive_link, blood_group, date_of_birth, age,
  nationality, medical_notes, emergency_contact, passing_year,
  last_education_major, height, weight, payment_agreement, hardcopy_status,
  hardcopy_documents, english_score
) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;

function nextLeadId() {
  const row = db.prepare("SELECT id FROM leads ORDER BY _rowid_ DESC LIMIT 1").get();
  if (!row) return 'LEAD-1001';
  const match = row.id.match(/^LEAD-(\d+)$/);
  return match ? `LEAD-${parseInt(match[1]) + 1}` : `LEAD-${Date.now()}`;
}

const contactId = 491;
const contact = db.prepare("SELECT * FROM contacts WHERE id=?").get(contactId);
console.log("Contact:", contact);

const lead_id = nextLeadId();
const params = [
  lead_id, 'Test', 'In-House', 'WhatsApp', 'New Lead', null, null, null, null, 'Bangladesh',
  null, new Date().toISOString().slice(0, 10), null, null, null, null,
  null, null, 0, 0, 0, '01234567890', null,
  null, null, null, null, null,
  null, null, null, null, null,
  null, null, 'Test Note', null, null, null, null,
  null, null, null, null,
  null, null, null, null, null,
  null, null
];

try {
  const info = db.prepare(LEAD_INSERT_SQL).run(params);
  console.log("Inserted:", info);
} catch (e) {
  console.error("Error inserting lead:", e.message);
}
