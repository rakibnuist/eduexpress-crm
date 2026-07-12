const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

code = code.replace("app.get('/api/admin/fix-leads-final'", "app.get('/api/public/fix-leads-final'");
fs.writeFileSync('server.js', code);
