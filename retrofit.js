import { initDatabase } from './sqldb.js';

async function run() {
  const db = await initDatabase('crm.db');

  const contacts = db.prepare("SELECT * FROM contacts WHERE phone IS NOT NULL AND phone != '' AND lead_id IS NULL").all();

  let linked = 0;
  let created = 0;

  for (const c of contacts) {
    let phone = c.phone.trim();
    const digits = phone.replace(/[^\d]/g, '');
    if (digits.startsWith('01') && digits.length === 11) {
      phone = '+88' + digits;
    } else if (digits.startsWith('8801') && digits.length === 13) {
      phone = '+' + digits;
    }
    
    // Find lead by last 10 digits
    const last10 = digits.slice(-10);
    if (!last10 || last10.length < 10) continue; // Skip invalid phones

    const existingLead = db.prepare("SELECT id FROM leads WHERE phone LIKE ?").get(`%${last10}`);

    if (existingLead) {
      db.prepare("UPDATE contacts SET lead_id=? WHERE id=?").run(existingLead.id, c.id);
      db.prepare("UPDATE conversations SET lead_id=? WHERE contact_id=?").run(existingLead.id, c.id);
      linked++;
    } else {
      // Create lead
      const year = new Date().getFullYear().toString().slice(-2);
      const count = db.prepare("SELECT COUNT(*) as n FROM leads WHERE lead_id LIKE ?").get(`L${year}%`).n + 1;
      const nextId = `L${year}${String(count).padStart(4, '0')}`;
      
      const info = db.prepare(`INSERT INTO leads (
        lead_id, date_added, client_name, phone, lead_source, lead_status, source
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
        nextId, 
        new Date().toISOString().slice(0, 10), 
        c.name || 'Chat Lead', 
        phone, 
        'Inbox', 
        'New Lead',
        'In-House'
      );
      
      const newLeadId = info.lastInsertRowid;
      db.prepare("UPDATE contacts SET lead_id=? WHERE id=?").run(newLeadId, c.id);
      db.prepare("UPDATE conversations SET lead_id=? WHERE contact_id=?").run(newLeadId, c.id);
      created++;
    }
  }

  console.log(`Retrofit complete. Linked existing: ${linked}, Created new leads: ${created}`);
}

run().catch(console.error);
