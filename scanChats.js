import { initDatabase } from './sqldb.js';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const db = await initDatabase(join(__dirname, 'crm.db'));
  
  const channel = db.prepare("SELECT * FROM channels WHERE name='Study & Work Abroad' LIMIT 1").get();
  if (!channel) {
    console.log("Channel not found");
    process.exit(1);
  }

  const conversations = db.prepare("SELECT * FROM conversations WHERE channel_id=?").all(channel.id);
  console.log(`Found ${conversations.length} conversations for ${channel.name}`);

  let created = 0;
  let updated = 0;

  function nextLeadId() {
    let newId;
    for(let i=0; i<10; i++) {
      const r = Math.floor(100000 + Math.random() * 900000);
      newId = 'L26' + String(r).slice(-4);
      const existing = db.prepare("SELECT id FROM leads WHERE lead_id=?").get(newId);
      if (!existing) return newId;
    }
    return 'L26' + Date.now().toString().slice(-4);
  }

  for (const conv of conversations) {
    const messages = db.prepare("SELECT * FROM messages WHERE conversation_id=? ORDER BY created_at ASC").all(conv.id);
    const allText = messages.map(m => m.content).join(' ');
    const inboundText = messages.filter(m => m.direction === 'in').map(m => m.content).join(' ');
    
    const phoneRegex = /(?:(?:\+|00)?88[\s\-]?)?01[3-9](?:[\s\-]*\d){8}/g;
    const phones = inboundText.match(phoneRegex) || allText.match(phoneRegex);
    
    let extractedPhone = null;
    if (phones && phones.length > 0) {
      extractedPhone = phones[0].replace(/[\s\-]/g, '');
      if (extractedPhone.startsWith('01')) extractedPhone = '+88' + extractedPhone;
    }

    const adMatch = allText.match(/ad_id=(\d+)/i) || allText.match(/campaign_id=(\d+)/i);
    const adId = adMatch ? adMatch[1] : null;

    if (extractedPhone || adId) {
      const contact = db.prepare("SELECT * FROM contacts WHERE id=?").get(conv.contact_id);
      const client_name = contact ? contact.name : 'Unknown Chat Lead';
      
      let lead_id_val = conv.lead_id;
      
      if (!lead_id_val && extractedPhone) {
        const existingByPhone = db.prepare("SELECT id FROM leads WHERE phone=? LIMIT 1").get(extractedPhone);
        if (existingByPhone) {
          lead_id_val = existingByPhone.id;
          db.prepare("UPDATE conversations SET lead_id=? WHERE id=?").run(lead_id_val, conv.id);
          if (contact) db.prepare("UPDATE contacts SET lead_id=? WHERE id=?").run(lead_id_val, contact.id);
        }
      }

      if (lead_id_val) {
        let updateSql = "UPDATE leads SET ";
        let params = [];
        let updates = [];
        if (extractedPhone) {
          updates.push("phone=?");
          params.push(extractedPhone);
        }
        if (adId) {
          updates.push("meta_ad_id=?");
          params.push(adId);
        }
        if (updates.length > 0) {
          updateSql += updates.join(", ") + " WHERE id=?";
          params.push(lead_id_val);
          db.prepare(updateSql).run(...params);
          updated++;
        }
      } else {
        const new_lead_id = nextLeadId();
        const date_added = new Date().toISOString().slice(0, 10);
        const lead_source = channel.type === 'messenger' ? 'Messenger' : 'WhatsApp';
        const lead_status = 'New Lead';
        const page_name = channel.name;
        const channel_id = channel.id;
        const lead_market = 'Bangladesh';
        const lead_type = 'B2C';
        const source = 'In-House';
        
        const info = db.prepare(`INSERT INTO leads (
          lead_id, date_added, client_name, phone, lead_source, lead_status, page_name, channel_id, meta_ad_id, lead_market, lead_type, source
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
          new_lead_id, date_added, client_name, extractedPhone, lead_source, lead_status, page_name, channel_id, adId, lead_market, lead_type, source
        );
        
        db.prepare("UPDATE conversations SET lead_id=? WHERE id=?").run(info.lastInsertRowid, conv.id);
        if (contact) db.prepare("UPDATE contacts SET lead_id=? WHERE id=?").run(info.lastInsertRowid, contact.id);
        
        created++;
      }
    }
  }

  // Force flush just to be safe
  db.flush();
  console.log(`Scan complete. Created ${created} new leads, updated ${updated} existing leads.`);
  setTimeout(() => process.exit(0), 500);
}

main().catch(console.error);
