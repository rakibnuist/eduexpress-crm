const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

const endpoint = `
app.get('/api/public/diag3', (req, res) => {
  try {
    const c = db.prepare("SELECT * FROM channels WHERE id = 9").get();
    res.json(c || { error: 'Channel 9 not found' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
`;

code = code.replace("app.listen(PORT", endpoint + "\napp.listen(PORT");
fs.writeFileSync('server.js', code);
