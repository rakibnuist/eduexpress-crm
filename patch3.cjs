const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

const endpoint = `
app.get('/api/public/force-fix-pages', async (req, res) => {
  try {
    const leadsToFix = db.prepare("SELECT id, lead_id, client_name FROM leads WHERE page_name IS NULL").all();
    let fixedCount = 0;
    const details = [];
    for (const l of leadsToFix) {
       const throughConv = db.prepare(\`SELECT c.name, c.id FROM channels c JOIN conversations conv ON conv.channel_id = c.id WHERE conv.lead_id = ? LIMIT 1\`).get(l.id);
       const throughContact = db.prepare(\`SELECT c.name, c.id FROM channels c JOIN conversations conv ON conv.channel_id = c.id JOIN contacts con ON conv.contact_id = con.id WHERE con.lead_id = ? LIMIT 1\`).get(l.id);
       
       if (throughConv && throughConv.name) {
         db.prepare("UPDATE leads SET page_name = ?, channel_id = ? WHERE id = ?").run(throughConv.name, throughConv.id, l.id);
         fixedCount++;
         details.push({ lead: l.lead_id, name: l.client_name, page: throughConv.name });
       } else if (throughContact && throughContact.name) {
         db.prepare("UPDATE leads SET page_name = ?, channel_id = ? WHERE id = ?").run(throughContact.name, throughContact.id, l.id);
         fixedCount++;
         details.push({ lead: l.lead_id, name: l.client_name, page: throughContact.name });
       }
    }
    res.json({ ok: true, totalFound: leadsToFix.length, fixedCount, details });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
`;

code = code.replace(endpoint + "\n", "");
fs.writeFileSync('server.js', code);
