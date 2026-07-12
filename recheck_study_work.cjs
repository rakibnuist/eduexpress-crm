const Database = require('better-sqlite3');
const db = new Database('crm.db');

const channels = db.prepare("SELECT * FROM channels WHERE name LIKE '%Study & Work%'").all();
console.log("Channels found:", channels);

for (const c of channels) {
  const orphans = db.prepare(`
    SELECT DISTINCT con.id, con.name, con.phone
    FROM contacts con
    JOIN conversations conv ON conv.contact_id = con.id
    WHERE conv.channel_id = ? AND con.lead_id IS NULL
  `).all(c.id);
  console.log(`Found ${orphans.length} orphan contacts for ${c.name}`);
  
  for (const o of orphans) {
    const msgs = db.prepare(`
        SELECT m.content 
        FROM messages m
        JOIN conversations c ON m.conversation_id = c.id
        WHERE c.contact_id = ? AND m.direction = 'in' AND m.type = 'text' AND m.content IS NOT NULL
        ORDER BY m.id ASC
    `).all(o.id);
    
    let foundPhone = null;
    const phoneRegex = /(?:\+?88[\s-]*)?01[3-9](?:[\s-]*\d){8}|(?:\+|00)\d{7,14}/; // added generic international
    for (const msg of msgs) {
      const match = msg.content.match(phoneRegex);
      if (match) {
        foundPhone = match[0];
        break;
      }
    }
    
    console.log(`Contact: ${o.name} | Phone DB: ${o.phone} | Phone Scanned: ${foundPhone}`);
    
    let finalPhone = o.phone || foundPhone;
    if (finalPhone && !o.phone) {
        db.prepare("UPDATE contacts SET phone=? WHERE id=?").run(finalPhone, o.id);
    }
  }
}
