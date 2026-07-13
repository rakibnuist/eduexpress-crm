const fs = require('fs');
const code = fs.readFileSync('server.js', 'utf8');

const target = `
  for (const row of cacheAds) {
    let match = adMap.get(row.meta_ad_id) || adMap.get(row.ad_name);
    if (match) {
      match.spend = row.spend;
      match.impressions = row.impressions;
      match.clicks = row.clicks;
      if (!match.meta_campaign) match.meta_campaign = row.meta_campaign;
      if (!match.meta_adset_name) match.meta_adset_name = row.meta_adset_name;
    }
  }
`;

const replacement = `
  for (const row of cacheAds) {
    let match = adMap.get(row.meta_ad_id) || adMap.get(row.ad_name);
    if (match) {
      match.spend = row.spend;
      match.impressions = row.impressions;
      match.clicks = row.clicks;
      if (!match.meta_campaign) match.meta_campaign = row.meta_campaign;
      if (!match.meta_adset_name) match.meta_adset_name = row.meta_adset_name;
    } else {
      if (req.query.page_name) continue; 
      if (req.query.source && req.query.source !== 'meta') continue;
      if (req.query.ad_name && req.query.ad_name !== row.ad_name) continue;
      
      adMap.set(row.meta_ad_id || row.ad_name, {
        ad_name: row.ad_name,
        meta_ad_id: row.meta_ad_id,
        page_name: null,
        meta_campaign: row.meta_campaign,
        meta_adset_name: row.meta_adset_name,
        total_leads: 0,
        file_opened: 0,
        office_visited: 0,
        positive: 0,
        active: 0,
        spend: row.spend,
        impressions: row.impressions,
        clicks: row.clicks
      });
    }
  }
`;

if (code.includes(target.trim())) {
  fs.writeFileSync('server.js', code.replace(target.trim(), replacement.trim()));
  console.log("Patched successfully!");
} else {
  console.log("Target not found. Doing manual replace.");
}
