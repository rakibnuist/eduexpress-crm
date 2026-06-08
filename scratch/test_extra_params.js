import { initDatabase } from "../sqldb.js";
async function main() {
  const db = await initDatabase("crm.db");
  try {
    const stmt = db.prepare("SELECT count(*) FROM sqlite_master");
    const res = stmt.get({ extra: "value" });
    console.log("Success! Result:", res);
  } catch (err) {
    console.error("Error with extra params:", err.message);
  }
  db.close();
}
main().catch(console.error);
