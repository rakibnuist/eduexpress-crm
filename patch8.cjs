const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

const endpoint = `
app.get('/api/public/diag', (req, res) => {
  try {
    const nullLeads = db.prepare("SELECT id, lead_id, client_name, page_name, channel_id, meta_form_id FROM leads WHERE page_name IS NULL OR page_name = '' LIMIT 20").all();
    const totalNull = db.prepare("SELECT COUNT(*) as c FROM leads WHERE page_name IS NULL OR page_name = ''").get().c;
    res.json({ totalNull, nullLeads });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
`;

code = code.replace("app.listen(PORT", endpoint + "\napp.listen(PORT");
fs.writeFileSync('server.js', code);
