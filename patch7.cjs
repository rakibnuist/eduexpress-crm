const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

code = code.replace(/app\.get\('\/api\/public\/fix-leads-final', async \(req, res\) => \{[\s\S]*?\}\);/g, '');
code = code.replace(/app\.get\('\/api\/public\/check-lead', async \(req, res\) => \{[\s\S]*?\}\);/g, '');

fs.writeFileSync('server.js', code);
