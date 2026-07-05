import { initDatabase } from './sqldb.js';

(async () => {
  try {
    const db = await initDatabase('/home/u898266115/crm.db');
    const channels = db.prepare("SELECT id, type, name, page_id, active, status FROM channels").all();
    console.log("CHANNELS:", JSON.stringify(channels, null, 2));
    const recentConvs = db.prepare("SELECT id, contact_id, channel_id, channel_type, last_message_at, last_message FROM conversations ORDER BY id DESC LIMIT 15").all();
    console.log("CONVERSATIONS:", JSON.stringify(recentConvs, null, 2));
    const recentMessages = db.prepare("SELECT id, conversation_id, direction, content, created_at FROM messages ORDER BY id DESC LIMIT 20").all();
    console.log("MESSAGES:", JSON.stringify(recentMessages, null, 2));
  } catch (err) {
    console.error("ERROR:", err.message);
  }
})();
