const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

const replacement = `
app.get('/api/admin/debug-leads', async (req, res) => {
  try {
    const leads = db.prepare("SELECT lead_id, client_name, page_name, meta_form_id FROM leads ORDER BY id ASC LIMIT 50").all();
    res.json({ ok: true, leads });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
`;

code = code.replace('// --- STARTING SERVER ---', replacement + '\n// --- STARTING SERVER ---');
fs.writeFileSync('server.js', code);
