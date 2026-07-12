const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

const endpoint = `
app.get('/api/public/check-lead', async (req, res) => {
  try {
    const lead = db.prepare("SELECT * FROM leads WHERE lead_id = 'L260283'").get();
    res.json(lead);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
`;

code = code.replace("app.listen(PORT", endpoint + "\napp.listen(PORT");
fs.writeFileSync('server.js', code);
