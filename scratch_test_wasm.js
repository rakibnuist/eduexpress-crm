import { createRequire } from 'module';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

async function run() {
  const initSqlJs = require(join(__dirname, 'node_modules/sql.js/dist/sql-wasm.js'));
  const wasmBinary = readFileSync(join(__dirname, 'node_modules/sql.js/dist/sql-wasm.wasm'));
  const SQL = await initSqlJs({ wasmBinary });
  const db = new SQL.Database();
  db.exec("CREATE TABLE hello (a int, b char);");
  db.exec("INSERT INTO hello VALUES (0, 'hello');");
  console.log(db.exec("SELECT * FROM hello;"));
}
run().catch(console.error);
