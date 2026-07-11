app.get('/api/admin/find-dbs', (req, res) => {
  const { execSync } = require('child_process');
  const sqlite3 = require('better-sqlite3');
  try {
    const paths = execSync('find /home/u898266115 -name "crm.db" -o -name "database.sqlite"').toString().split('\n').filter(Boolean);
    let results = [];
    for (const p of paths) {
      try {
        const db = new sqlite3(p, { readonly: true });
        const leads = db.prepare('SELECT count(*) as c FROM leads').get().c;
        const financials = db.prepare('SELECT count(*) as c FROM financial_data').get().c;
        const users = db.prepare('SELECT count(*) as c FROM users').get().c;
        const conversations = db.prepare('SELECT count(*) as c FROM conversations').get().c;
        results.push({ path: p, leads, financials, users, conversations });
        db.close();
      } catch (e) {
        results.push({ path: p, error: e.message });
      }
    }
    results.sort((a, b) => (b.leads || 0) - (a.leads || 0));
    res.json(results);
  } catch(e) {
    res.json({ error: e.toString() });
  }
});
