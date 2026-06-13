import { initDatabase } from '../sqldb.js';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '../crm.db');

async function run() {
  try {
    const db = await initDatabase(DB_PATH);
    const rows = db.prepare("SELECT id, unread_count, status, channel_id, last_message FROM conversations WHERE unread_count > 0").all();
    console.log("Conversations with unread_count > 0:", rows);
    db.close();
  } catch (err) {
    console.error("Error inspecting database:", err);
  }
}
run();
