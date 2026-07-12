const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

const newCode = `
app.get('/api/admin/backfill-meta', async (req, res) => {
  try {
    const logs = [];
    const missingLeads = db.prepare("SELECT DISTINCT meta_form_id FROM leads WHERE meta_form_id IS NOT NULL AND page_name IS NULL").all();
    logs.push("Found missing leads: " + missingLeads.length);
    if (missingLeads.length === 0) return res.json({ ok: true, logs });
    
    const channels = db.prepare("SELECT * FROM channels WHERE type IN ('messenger', 'facebook', 'instagram', 'whatsapp') AND access_token IS NOT NULL").all();
    logs.push("Found channels: " + channels.length);
    
    for (const { meta_form_id } of missingLeads) {
      let found = false;
      for (const channel of channels) {
        try {
          const pageToken = await resolvePageAccessToken(channel.page_id, channel.access_token);
          const r = await fetch(\`https://graph.facebook.com/v19.0/\${meta_form_id}?fields=page&access_token=\${pageToken}\`);
          const d = await r.json();
          if (d.error) {
            logs.push(\`Form \${meta_form_id} on Channel \${channel.name}: API Error - \${d.error.message}\`);
          }
          if (d.page && d.page.id) {
            const pageIdStr = String(d.page.id).trim();
            const matchedChannel = db.prepare("SELECT * FROM channels WHERE trim(page_id)=?").get(pageIdStr);
            if (matchedChannel) {
              const fix = db.prepare("UPDATE leads SET page_name=?, channel_id=? WHERE meta_form_id=? AND page_name IS NULL").run(matchedChannel.name, matchedChannel.id, meta_form_id);
              logs.push(\`Backfilled \${fix.changes} leads for form \${meta_form_id} -> Page: \${matchedChannel.name}\`);
              found = true;
              break;
            } else {
               logs.push(\`Found page ID \${pageIdStr} for form \${meta_form_id}, but no matching channel in DB.\`);
            }
          }
        } catch(e) {
          logs.push(\`Exception for form \${meta_form_id} on channel \${channel.name}: \${e.message}\`);
        }
      }
      if (!found) logs.push(\`Could not find page for form \${meta_form_id}\`);
    }
    res.json({ ok: true, logs });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
`;

code = code.replace('// --- STARTING SERVER ---', newCode + '\n// --- STARTING SERVER ---');
fs.writeFileSync('server.js', code);
