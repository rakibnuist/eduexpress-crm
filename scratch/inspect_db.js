import { initDatabase } from "../sqldb.js";

async function main() {
  const db = await initDatabase("crm.db");
  const CONV_SELECT = `
    SELECT conversations.*,
      contacts.name  AS contact_name,
      contacts.phone AS contact_phone,
      contacts.avatar_url AS contact_avatar,
      contacts.wa_id, contacts.messenger_id, contacts.instagram_id,
      contacts.lead_id AS contact_lead_id,
      channels.name  AS channel_name,
      channels.type  AS channel_type,
      channels.color AS channel_color,
      channels.consultant AS channel_consultant,
      channels.phone_number_id
    FROM conversations
    LEFT JOIN contacts  ON contacts.id  = conversations.contact_id
    LEFT JOIN channels  ON channels.id  = conversations.channel_id
  `;
  
  console.log("=== query 1: without filters ===");
  const res = db.prepare(CONV_SELECT).all();
  console.log(res);
  
  console.log("=== query 2: with WHERE clause ===");
  const ws = "";
  const limit = 30;
  const page = 1;
  const convs = db.prepare(`${CONV_SELECT} ${ws} ORDER BY conversations.last_message_at DESC LIMIT ${limit} OFFSET ${(page-1)*limit}`).all();
  console.log(convs);
}

main().catch(console.error);
