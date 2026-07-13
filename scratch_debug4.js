import { initDatabase } from './sqldb.js';
import { readFileSync } from 'fs';

const serverCode = readFileSync('./server.js', 'utf8');

// I will just use sqldb directly
(async () => {
  const db = await initDatabase('crm.db');
  global.db = db;

  const contactId = 491;

  const conv = db.prepare("SELECT * FROM conversations WHERE id=491").get();
  const contact = db.prepare("SELECT * FROM contacts WHERE id=?").get(conv.contact_id);

  function nextLeadId() {
    const row = db.prepare("SELECT lead_id FROM leads WHERE lead_id LIKE 'L-%' ORDER BY CAST(SUBSTR(lead_id,3) AS INTEGER) DESC LIMIT 1").get();
    return 'L-' + String(parseInt((row?.lead_id || 'L-00000').replace('L-', '')) + 1).padStart(5, '0');
  }

  function leadParams(d, lead_id, balance) {
    const num = v => v === '' || v == null ? 0 : Number(v);
    const txt = v => (v === '' || v == null) ? null : v;
    let assigned_employee_id = d.assigned_employee_id ? Number(d.assigned_employee_id) : null;
    let assigned_consultant = txt(d.assigned_consultant);
    if (assigned_employee_id && !assigned_consultant) {
      try {
        const emp = db.prepare("SELECT name FROM employees WHERE id=?").get(assigned_employee_id);
        if (emp?.name) assigned_consultant = emp.name;
      } catch {}
    }
    let phone = d.phone ? String(d.phone).trim() : null;
    if (phone) {
      const digits = phone.replace(/[^\d]/g, '');
      if (digits.startsWith('01') && digits.length === 11) phone = '+88' + digits;
      else if (digits.startsWith('8801') && digits.length === 13) phone = '+' + digits;
    }
    return {
      lead_id, balance,
      date_added: d.date_added || new Date().toISOString().slice(0,10),
      client_name: d.client_name,
      phone, email: d.email, destination: txt(d.destination),
      last_education: txt(d.last_education), gpa: d.gpa === '' || d.gpa == null ? null : Number(d.gpa),
      english_score: txt(d.english_score), program: txt(d.program || d.major),
      lead_source: d.lead_source || 'Manual', lead_status: d.lead_status || 'New Lead',
      assigned_employee_id, assigned_consultant, service_fee: num(d.service_fee), paid: num(d.paid),
      payment_status: txt(d.payment_status), next_followup: txt(d.next_followup), notes: txt(d.notes),
      meta_lead_id: txt(d.meta_lead_id), meta_form_id: txt(d.meta_form_id), meta_ad_id: txt(d.meta_ad_id), meta_campaign: txt(d.meta_campaign),
      source: txt(d.source), referrer: txt(d.referrer), nationality: txt(d.nationality), passport: txt(d.passport),
      degree: txt(d.degree), major: txt(d.major), intake_term: txt(d.intake_term), university: txt(d.university),
      drive_link: txt(d.drive_link), deposit: num(d.deposit), passing_year: txt(d.passing_year), last_education_major: txt(d.last_education_major),
      english_test_type: txt(d.english_test_type), blood_group: txt(d.blood_group), date_of_birth: txt(d.date_of_birth),
      medical_notes: txt(d.medical_notes), emergency_contact: txt(d.emergency_contact), height: txt(d.height), weight: txt(d.weight),
      payment_agreement: txt(d.payment_agreement), hardcopy_status: txt(d.hardcopy_status), hardcopy_documents: txt(d.hardcopy_documents),
      age: num(d.age), application_stage: txt(d.application_stage), lead_market: txt(d.lead_market) || 'Bangladesh',
      agency_id: d.agency_id ? Number(d.agency_id) : null, lead_type: txt(d.lead_type) || 'B2C',
      ad_name: txt(d.ad_name), page_name: txt(d.page_name), channel_id: d.channel_id ? Number(d.channel_id) : null,
    };
  }

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

  try {
    const creatorUser = { id: 1, role: 'admin', roles: ['admin'] };
    const source = conv.channel_type;
    const initialMessage = conv.last_message;
    const options = {
      destination: 'Bangladesh', 
      phone: '01234567891', 
      client_name: 'Gabriel Ezemi'
    };
    
    const lead_id = nextLeadId();
    const sourceMap = { whatsapp: 'WhatsApp Inquiry', messenger: 'Messenger Inquiry', instagram: 'Instagram Inquiry', tiktok: 'TikTok Inquiry' };
    const client_name = options.client_name || contact.name || sourceMap[source] || 'Chat Inquiry';
    const phone = options.phone || contact.phone || null;
    const email = contact.email || null;
    const destination = options.destination || 'Bangladesh';
    const degree = options.degree || null;

    let assigned_consultant = null;
    let assigned_employee_id = null;
    
    if (creatorUser && creatorUser.roles?.includes('consultant')) {
      assigned_consultant = creatorUser.consultant_name || creatorUser.name;
      const emp = db.prepare("SELECT id FROM employees WHERE emp_id=?").get(creatorUser.emp_id);
      if (emp) assigned_employee_id = emp.id;
    } else {
      const lastConv = db.prepare("SELECT channel_id FROM conversations WHERE contact_id=? ORDER BY id DESC LIMIT 1").get(contactId);
      if (lastConv) {
        const chan = db.prepare("SELECT consultant FROM channels WHERE id=?").get(lastConv.channel_id);
        if (chan) {
          assigned_consultant = chan.consultant;
          const emp = db.prepare("SELECT id FROM employees WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))").get(chan.consultant);
          if (emp) assigned_employee_id = emp.id;
        }
      }
    }

    const leadSourceMap = { whatsapp: 'WhatsApp', messenger: 'Messenger', instagram: 'Instagram', tiktok: 'TikTok' };
    let meta_ad_id = null, meta_campaign = null, meta_adset_name = null, meta_adset_id = null, ad_name = null, channel_id = null;

    if (contact.referral_data) {
      try {
        const ref = JSON.parse(contact.referral_data);
        if (ref.ad_id) meta_ad_id = String(ref.ad_id);
        if (ref.campaign_name || ref.campaign_id) meta_campaign = String(ref.campaign_name || ref.campaign_id);
        if (ref.adset_name) meta_adset_name = String(ref.adset_name);
        if (ref.adset_id) meta_adset_id = String(ref.adset_id);
        if (ref.ad_title || ref.headline) ad_name = String(ref.ad_title || ref.headline);
        if (ref.channel_id) channel_id = ref.channel_id;
      } catch (e) {}
    }

    const params = leadParams({
      client_name, phone, email, destination, degree, source: 'In-House',
      lead_source: leadSourceMap[source] || 'Chat', lead_status: 'New Lead',
      assigned_consultant, assigned_employee_id, meta_ad_id, meta_campaign, meta_adset_name, meta_adset_id,
      ad_name, channel_id, notes: initialMessage ? `Initial Inquiry: "${initialMessage}"` : `Auto-created from ${source} chat integration.`
    }, lead_id, 0);

    console.log("Executing SQL...");
    const info = db.prepare(LEAD_INSERT_SQL).run(params);
    console.log("Insert Info:", info);
    const lead = db.prepare("SELECT * FROM leads WHERE id=?").get(info.lastInsertRowid);
    console.log("Lead created!");
  } catch(e) {
    console.error('Error auto-creating lead from contact:', e.message);
  }
})();
