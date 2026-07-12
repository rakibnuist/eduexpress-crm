const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

const endpoint = `
app.get('/api/public/diag2', (req, res) => {
  try {
    const l = db.prepare("SELECT * FROM leads WHERE lead_id = 'L260023'").get();
    const conv = db.prepare("SELECT * FROM conversations WHERE lead_id = ?").all(l.id);
    const cont = db.prepare("SELECT * FROM contacts WHERE lead_id = ?").all(l.id);
    res.json({ lead: l, conv, cont });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
`;

code = code.replace("app.listen(PORT", endpoint + "\napp.listen(PORT");
fs.writeFileSync('server.js', code);
