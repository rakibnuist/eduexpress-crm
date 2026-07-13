const { readFileSync } = require('fs');

const serverjs = readFileSync('server.js', 'utf8');

const match = serverjs.match(/const LEAD_INSERT_SQL = `INSERT INTO leads \(([\s\S]+?)\) VALUES \(([\s\S]+?)\)`/);
if (!match) {
  console.log("Could not parse LEAD_INSERT_SQL");
  process.exit(1);
}

const cols = match[1].split(',').map(s => s.trim().replace(/\n/g, '')).filter(Boolean);
const vals = match[2].split(',').map(s => s.trim().replace(/\n/g, '').replace('@', '')).filter(Boolean);

console.log("Columns length:", cols.length);
console.log("Values length:", vals.length);

for (let i = 0; i < cols.length; i++) {
  if (cols[i] !== vals[i]) {
    console.log("Mismatch at index", i, ":", cols[i], "!==", vals[i]);
  }
}
