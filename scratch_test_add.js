const Database = require('better-sqlite3');
const db = new Database('crm.db');

const contact = db.prepare("SELECT * FROM contacts WHERE phone IS NOT NULL AND lead_id IS NULL LIMIT 1").get();
if (!contact) {
  console.log("No contact found");
  process.exit();
}

const convChannel = db.prepare(`
  SELECT c.id, c.name, c.type 
  FROM conversations conv 
  JOIN channels c ON conv.channel_id = c.id 
  WHERE conv.contact_id = ? 
  ORDER BY conv.last_message_at DESC LIMIT 1
`).get(contact.id);

console.log("Contact:", contact);
console.log("ConvChannel:", convChannel);
