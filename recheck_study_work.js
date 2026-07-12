import { initDatabase } from './sqldb.js';

async function run() {
  const db = await initDatabase('crm.db');
  
  const channels = db.prepare("SELECT * FROM channels WHERE name LIKE '%Study & Work%'").all();
  console.log("Channels found:", channels.length);
  
  for (const c of channels) {
    const orphans = db.prepare(`
      SELECT DISTINCT con.id, con.name, con.phone
      FROM contacts con
      JOIN conversations conv ON conv.contact_id = con.id
      WHERE conv.channel_id = ? AND con.lead_id IS NULL
    `).all({1: c.id});
    console.log(`Found ${orphans.length} orphan contacts for ${c.name}`);
    
    for (const o of orphans) {
      const msgs = db.prepare(`
          SELECT m.content 
          FROM messages m
          JOIN conversations c ON m.conversation_id = c.id
          WHERE c.contact_id = ? AND m.direction = 'in' AND m.type = 'text' AND m.content IS NOT NULL
          ORDER BY m.id ASC
      `).all({1: o.id});
      
      let foundPhone = null;
      const phoneRegex = /(?:\+?88[\s-]*)?01[3-9](?:[\s-]*\d){8}|(?:\+|00)\d{7,14}/; 
      for (const msg of msgs) {
        const match = msg.content.match(phoneRegex);
        if (match) {
          foundPhone = match[0];
          break;
        }
      }
      
      if (foundPhone) {
        console.log(`Contact: ${o.name} | Phone DB: ${o.phone} | Phone Scanned: ${foundPhone}`);
        db.prepare("UPDATE contacts SET phone=? WHERE id=?").run({1: foundPhone, 2: o.id});
      } else {
        // Create lead anyway? The user wants it active for all, but maybe retroactively?
        // Let's just output for now
      }
    }
  }
}
run();
