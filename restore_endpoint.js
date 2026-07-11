app.get('/api/admin/restore-db', (req, res) => {
  const { execSync } = require('child_process');
  const target = req.query.path;
  if (!target) return res.send('No path');
  try {
    const fs = require('fs');
    fs.copyFileSync(target, '/home/u898266115/crm-data/crm.db');
    res.send('Restored! Restarting server maybe needed, or just reboot.');
  } catch(e) {
    res.send(e.toString());
  }
});
