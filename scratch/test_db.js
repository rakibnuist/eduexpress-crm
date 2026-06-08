import { initDatabase } from '../sqldb.js';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, '../crm.db');

async function test() {
  console.log('Loading database from:', dbPath);
  const db = await initDatabase(dbPath);

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
      channels.phone_number_id,
      (SELECT direction FROM messages WHERE conversation_id = conversations.id ORDER BY created_at DESC, id DESC LIMIT 1) AS last_message_direction,
      (SELECT status FROM messages WHERE conversation_id = conversations.id ORDER BY created_at DESC, id DESC LIMIT 1) AS last_message_status
    FROM conversations
    LEFT JOIN contacts  ON contacts.id  = conversations.contact_id
    LEFT JOIN channels  ON channels.id  = conversations.channel_id
  `;

  try {
    // 1. Test query with admin role (empty where clause)
    console.log('Testing admin query...');
    const ws1 = '';
    const params1 = {};
    const total1 = db.prepare(`SELECT COUNT(*) as c FROM conversations LEFT JOIN contacts ON contacts.id=conversations.contact_id LEFT JOIN channels ON channels.id=conversations.channel_id ${ws1}`).get(params1).c;
    const convs1 = db.prepare(`${CONV_SELECT} ${ws1} ORDER BY conversations.last_message_at DESC LIMIT 30 OFFSET 0`).all(params1);
    console.log('Admin query success. Total conversations:', total1);

    // 2. Test query with non-admin role (filter active)
    console.log('Testing employee/consultant query...');
    const ws2 = 'WHERE (channels.consultant = @user_consultant OR conversations.assigned_to = @user_id)';
    const params2 = {
      user_consultant: 'Abdullah Al Rakib',
      user_id: 1
    };
    const total2 = db.prepare(`SELECT COUNT(*) as c FROM conversations LEFT JOIN contacts ON contacts.id=conversations.contact_id LEFT JOIN channels ON channels.id=conversations.channel_id ${ws2}`).get(params2).c;
    const convs2 = db.prepare(`${CONV_SELECT} ${ws2} ORDER BY conversations.last_message_at DESC LIMIT 30 OFFSET 0`).all(params2);
    console.log('Employee query success. Total conversations:', total2);

    console.log('All tests passed successfully!');
  } catch (err) {
    console.error('❌ Database query failed:', err.message);
    console.error(err.stack);
  } finally {
    db.close();
  }
}

test();
