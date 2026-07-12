const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

const endpoint = `
app.get('/api/public/diag4', (req, res) => {
  try {
    const channels = db.prepare("SELECT * FROM channels").all();
    res.json(channels);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
`;

code = code.replace("app.listen(PORT", endpoint + "\napp.listen(PORT");
fs.writeFileSync('server.js', code);
