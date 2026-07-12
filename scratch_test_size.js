const fs = require('fs');
const schema = fs.readFileSync('server.js', 'utf8');
let schemaBlock = schema.split('function setupSchema() { db.exec(`')[1].split('`);')[0];
let migrationsMatch = schema.match(/const migrations = \[([\s\S]*?)\];/);
let migrations = eval('[' + migrationsMatch[1] + ']');
let fullSql = schemaBlock + ';\n' + migrations.join(';\n') + ';';
fs.writeFileSync('full_schema.sql', fullSql);
