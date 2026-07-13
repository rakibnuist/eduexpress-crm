import { initDatabase } from './sqldb.js';

async function test() {
  const db = await initDatabase('./crm.db');
  
  // Need to mimic exactly what createLeadFromContact does
  const contactId = 491;
  const contact = db.prepare("SELECT * FROM contacts WHERE id=?").get(contactId);
  console.log("Contact:", contact);

  const row = db.prepare("SELECT lead_id FROM leads WHERE lead_id LIKE 'L-%' ORDER BY CAST(SUBSTR(lead_id,3) AS INTEGER) DESC LIMIT 1").get();
  const nextLeadId = 'L-' + String(parseInt((row?.lead_id || 'L-00000').replace('L-', '')) + 1).padStart(5, '0');
  
  const params = {
    ':lead_id': nextLeadId,
    ':date_added': new Date().toISOString().slice(0,10),
    ':client_name': 'Ahona Jahan',
    ':phone': '+8801891983098',
    ':email': contact.email || null,
    ':destination': 'Bangladesh',
    ':last_education': null,
    ':gpa': null,
    ':english_score': null,
    ':program': null,
    ':lead_source': 'Messenger',
    ':lead_status': 'New Lead',
    ':assigned_consultant': null,
    ':assigned_employee_id': null,
    ':service_fee': 0,
    ':paid': 0,
    ':balance': 0,
    ':payment_status': null,
    ':next_followup': null,
    ':notes': 'Auto-created from messenger chat integration.',
    ':meta_lead_id': null,
    ':meta_form_id': null,
    ':meta_ad_id': null,
    ':meta_campaign': null,
    ':source': 'In-House',
    ':referrer': null,
    ':nationality': null,
    ':passport': null,
    ':degree': null,
    ':major': null,
    ':intake_term': null,
    ':university': null,
    ':drive_link': null,
    ':deposit': 0,
    ':blood_group': null,
    ':date_of_birth': null,
    ':medical_notes': null,
    ':emergency_contact': null,
    ':application_stage': null,
    ':passing_year': null,
    ':last_education_major': null,
    ':height': null,
    ':weight': null,
    ':english_test_type': null,
    ':payment_agreement': null,
    ':hardcopy_status': null,
    ':hardcopy_documents': null,
    ':age': null,
    ':agency_id': null,
    ':lead_type': 'B2C',
    ':lead_market': 'Bangladesh',
    ':ad_name': null,
    ':page_name': null,
    ':channel_id': null
  };

  const LEAD_INSERT_SQL = `INSERT INTO leads (
    lead_id, date_added, client_name, phone, email, destination, last_education, gpa,
    english_score, program, lead_source, lead_status, assigned_consultant, assigned_employee_id,
    service_fee, paid, balance, payment_status, next_followup, notes,
    meta_lead_id, meta_form_id, meta_ad_id, meta_campaign,
    source, referrer, nationality, passport, degree, major, intake_term, university,
    drive_link, deposit, blood_group, date_of_birth, medical_notes, emergency_contact,
    application_stage, passing_year, last_education_major, height, weight, english_test_type,
    payment_agreement, hardcopy_status, hardcopy_documents, age, agency_id, lead_type, lead_market,
    ad_name, page_name, channel_id
  ) VALUES (
    @lead_id, @date_added, @client_name, @phone, @email, @destination, @last_education, @gpa,
    @english_score, @program, @lead_source, @lead_status, @assigned_consultant, @assigned_employee_id,
    @service_fee, @paid, @balance, @payment_status, @next_followup, @notes,
    @meta_lead_id, @meta_form_id, @meta_ad_id, @meta_campaign,
    @source, @referrer, @nationality, @passport, @degree, @major, @intake_term, @university,
    @drive_link, @deposit, @blood_group, @date_of_birth, @medical_notes, @emergency_contact,
    @application_stage, @passing_year, @last_education_major, @height, @weight, @english_test_type,
    @payment_agreement, @hardcopy_status, @hardcopy_documents, @age, @agency_id, @lead_type, @lead_market,
    @ad_name, @page_name, @channel_id
  )`;
  
  // wait, the actual params should use `@` not `:` since SQL has `@`. sqldb uses both but better safe.
  const finalParams = {};
  for (const k of Object.keys(params)) {
    finalParams[k.replace(':', '@')] = params[k];
  }

  try {
    const info = db.prepare(LEAD_INSERT_SQL).run(finalParams);
    console.log("Success:", info);
  } catch (err) {
    console.log("Error inserting:", err.message);
  }
}
test();
