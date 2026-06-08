import { initDatabase } from "../sqldb.js";
async function main() {
  const db = await initDatabase("crm.db");
  const users = db.prepare("SELECT id, name, email, role, consultant_name, active FROM users").all();
  console.log("=== USERS ===");
  console.log(users);
  db.close();
}
main().catch(console.error);
