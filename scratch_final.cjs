const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

const replacement = `
app.get('/api/admin/fix-leads-final', async (req, res) => {
  try {
    const leadsToFix = db.prepare("SELECT id FROM leads WHERE page_name IS NULL").all();
    let fixedCount = 0;
    const details = [];
    for (const l of leadsToFix) {
       const throughConv = db.prepare(\`SELECT c.name, c.id FROM channels c JOIN conversations conv ON conv.channel_id = c.id WHERE conv.lead_id = ? LIMIT 1\`).get(l.id);
       const throughContact = db.prepare(\`SELECT c.name, c.id FROM channels c JOIN conversations conv ON conv.channel_id = c.id JOIN contacts con ON conv.contact_id = con.id WHERE con.lead_id = ? LIMIT 1\`).get(l.id);
       
       if (throughConv && throughConv.name) {
         db.prepare("UPDATE leads SET page_name = ?, channel_id = ? WHERE id = ?").run(throughConv.name, throughConv.id, l.id);
         fixedCount++;
         details.push({ id: l.id, page: throughConv.name });
       } else if (throughContact && throughContact.name) {
         db.prepare("UPDATE leads SET page_name = ?, channel_id = ? WHERE id = ?").run(throughContact.name, throughContact.id, l.id);
         fixedCount++;
         details.push({ id: l.id, page: throughContact.name });
       } else {
         details.push({ id: l.id, page: null });
       }
    }
    res.json({ ok: true, fixedCount, details });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
`;

code = code.replace('// Start HTTP server IMMEDIATELY so Hostinger health check passes', replacement + '\n// Start HTTP server IMMEDIATELY so Hostinger health check passes');
fs.writeFileSync('server.js', code);
