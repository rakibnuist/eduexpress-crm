#!/usr/bin/env node
/**
 * Seeds the EduExpress CRM Marketing Data Center with verified starter data.
 * Idempotent: skips rows that already exist (matched by a key field).
 *
 * Run:  node seed_marketing.mjs
 * Override target:  BASE=https://crm.eduexpressint.com node seed_marketing.mjs
 */

const BASE = process.env.BASE || 'https://crm.eduexpressint.com';
const KEY  = process.env.API_KEY || 'eduexpress-n8n-2024';
const H = {
  'Content-Type': 'application/json',
  'x-api-key': KEY,
  'Accept': 'application/json',
  'User-Agent': 'EduExpress-Seeder/1.0',
  'Connection': 'close',           // fresh connection each request (avoids keep-alive resets)
};
const TODAY = new Date().toISOString().slice(0, 10);

if (typeof fetch !== 'function') {
  console.error('❌ Your Node is too old — built-in fetch needs Node 18+. Run `node -v`; upgrade if below 18.');
  process.exit(1);
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const isTransient = (e) => /ECONNRESET|fetch failed|ETIMEDOUT|EAI_AGAIN|socket hang up|UND_ERR/i.test(`${e.message} ${e.cause?.code || ''}`);

async function request(path, opts = {}, tries = 5) {
  for (let i = 1; i <= tries; i++) {
    try {
      const r = await fetch(`${BASE}/api/marketing/${path}`, { headers: H, ...opts });
      if (!r.ok) throw new Error(`${opts.method || 'GET'} ${path} → ${r.status} ${await r.text()}`);
      return r.json();
    } catch (e) {
      if (i < tries && isTransient(e)) { await sleep(700 * i); continue; }
      throw e;
    }
  }
}
const get  = (path)       => request(path);
const post = (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) });

// Insert each row only if `field` value isn't already present.
async function seed(resource, rows, field) {
  const existing = await get(resource);
  const have = new Set(existing.map(r => String(r[field] || '').trim().toLowerCase()));
  let added = 0, skipped = 0;
  for (const row of rows) {
    const k = String(row[field] || '').trim().toLowerCase();
    if (have.has(k)) { skipped++; continue; }
    await post(resource, row);
    added++;
    await sleep(150);
  }
  console.log(`  ${resource}: +${added} added, ${skipped} skipped (already present)`);
}

// ── Verified scholarships (figures/dates approximate — re-verify before citing) ──
const scholarships = [
  { name: 'Chinese Govt Scholarship (CSC / CGS)', country: 'China', type: 'Full',
    coverage: 'Tuition free + accommodation + ~৳35k/mo stipend + medical insurance',
    eligibility: 'Bachelor/Master/PhD; criteria vary by university', deadline: '~15 Dec 2025 – 30 Apr 2026',
    source_url: 'https://www.campuschina.org', status: 'Open', last_verified: TODAY,
    notes: 'Apply via university + CSC portal. Re-verify amounts per university.' },
  { name: 'Global Korea Scholarship (GKS)', country: 'South Korea', type: 'Full',
    coverage: 'Tuition + monthly stipend + airfare + 1-year Korean language course',
    eligibility: 'Strong academics; TOPIK helps', deadline: 'Annual (spring) — check NIIED',
    source_url: 'https://www.studyinkorea.go.kr', status: 'Open', last_verified: TODAY,
    notes: 'Embassy track & university track. Confirm yearly dates.' },
  { name: 'Stipendium Hungaricum', country: 'Hungary', type: 'Full',
    coverage: 'Tuition free + monthly stipend + accommodation + medical',
    eligibility: 'Govt-nominated (Bangladesh)', deadline: 'Annual (Jan deadline typical)',
    source_url: 'https://stipendiumhungaricum.hu', status: 'Verify', last_verified: TODAY,
    notes: 'EU degree + Schengen. Confirm BD allocation & dates each cycle.' },
];

// ── Starter universities (placeholders — replace with your real partner list) ──
const universities = [
  { name: 'Nanjing University (example)', country: 'China', city: 'Nanjing', programs: 'Engineering, Business, Chinese', intakes: 'Sep 2026', tuition: 'verify', lang_req: 'HSK / English', admission_url: '', partner: 0, notes: 'Sample row — confirm details', last_verified: TODAY },
  { name: 'Kyungpook National University (example)', country: 'South Korea', city: 'Daegu', programs: 'Undergrad, Master’s', intakes: 'Mar / Sep', tuition: 'verify', lang_req: 'TOPIK 3+ / English', admission_url: '', partner: 0, notes: 'GKS context — sample row', last_verified: TODAY },
  { name: 'University of Debrecen (example)', country: 'Hungary', city: 'Debrecen', programs: 'Medicine, Engineering', intakes: 'Sep 2026', tuition: 'verify', lang_req: 'English (IELTS)', admission_url: '', partner: 0, notes: 'Stipendium Hungaricum host — sample', last_verified: TODAY },
];

// ── Research sources (official) ──
const sources = [
  { topic: 'CSC scholarship official', url: 'https://www.campuschina.org', source_type: 'Official', use_for: 'China / Real Numbers', date_added: TODAY, notes: 'Master source for CSC' },
  { topic: 'Study in Korea (NIIED)', url: 'https://www.studyinkorea.go.kr', source_type: 'Official', use_for: 'Korea / Real Numbers', date_added: TODAY, notes: 'GKS authoritative source' },
  { topic: 'Stipendium Hungaricum', url: 'https://stipendiumhungaricum.hu', source_type: 'Official', use_for: 'Hungary / Real Numbers', date_added: TODAY, notes: 'Hungary govt scholarship' },
  { topic: 'China Embassy Dhaka — CGS notices', url: 'https://bd.china-embassy.gov.cn', source_type: 'Embassy', use_for: 'China / Deadline', date_added: TODAY, notes: 'Annual CGS announcements' },
];

// ── Evergreen safety-net posts ──
const evergreen = [
  { page_pool: 'China', pillar: 'P1', body: 'CSC scholarship = tuition free + ~৳35k/mo stipend. Ask us how. Free counselling.', hashtags: '#StudyInChina #CSCScholarship #EduExpress', status: 'approved' },
  { page_pool: 'China', pillar: 'P5', body: '8 years. 2,000+ students placed. 98% visa success. Your China journey starts with one message.', hashtags: '#StudyInChina #EduExpress', status: 'approved' },
  { page_pool: 'BD (all)', pillar: 'P4', body: 'Hungary = fully-funded EU education most agencies won’t mention. Ask us.', hashtags: '#StudyInEurope #StipendiumHungaricum #EduExpress', status: 'approved' },
  { page_pool: 'BD (all)', pillar: 'P1', body: 'Korea GKS covers tuition + stipend + airfare + language year. Full list inside.', hashtags: '#StudyInKorea #GKS #EduExpress', status: 'approved' },
  { page_pool: 'BD (all)', pillar: 'P5', body: 'China, Korea, UK, Hungary — one trusted team, 98% visa success. Book free counselling.', hashtags: '#StudyAbroadBD #EduExpress', status: 'approved' },
];

// ── Sample competitor intel ──
const competitors = [
  { log_date: TODAY, competitor: 'GK Consultancy', channel: 'Web', observation: 'Positions as “leading Korea consultancy”, claims 99% visa success', link: 'https://gkconsultancys.com', our_angle: 'Counter with named consultants + real student stories', added_by: 'seed' },
  { log_date: TODAY, competitor: 'FICC', channel: 'Web', observation: '“100% scholarship China” landing page', link: 'https://ficc.com.bd/china', our_angle: 'Own transparency: show actual CSC numbers & limits', added_by: 'seed' },
];

// ── Brain pool: first free key (add paid keys later as higher-priority rows) ──
const brain = [
  { priority: 1, provider: 'Google Gemini', model: 'gemini-flash', cred_label: 'brain_gemini_1', req_min: null, req_day: null, used_today: 0, status: 'active', notes: 'Free tier. Add more keys (free or paid) as extra rows; lower priority number = used first.' },
];

(async () => {
  console.log(`Node ${process.version} — Seeding Marketing Data Center → ${BASE}`);
  try {
    await seed('kb/scholarships', scholarships, 'name');
    await seed('kb/universities', universities, 'name');
    await seed('kb/sources',      sources,      'url');
    await seed('evergreen',       evergreen,    'body');
    await seed('competitors',     competitors,  'observation');
    await seed('brain',           brain,        'cred_label');
    console.log('✅ Done. Open Marketing → Data Center / Brain Pool in the CRM.');
  } catch (e) {
    console.error('❌ Seeding failed:', e.message);
    if (e.cause) console.error('   underlying cause:', e.cause.code || e.cause.message || e.cause);
    console.error('   Tips: confirm the CRM is reachable in your browser, and try the IPv4 workaround below.');
    process.exit(1);
  }
})();
