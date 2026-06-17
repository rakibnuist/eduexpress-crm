#!/usr/bin/env node
/**
 * Seeds EduExpress CRM Data Center with the 11 China partner universities
 * from "Bachelor 2026 Last Call (Without CSCA)".
 * Idempotent: skips a university if its name already exists.
 *
 * Run:  node seed_universities.mjs
 * Override target:  BASE=https://crm.eduexpressint.com node seed_universities.mjs
 */

const BASE = process.env.BASE || 'https://crm.eduexpressint.com';
const KEY  = process.env.API_KEY || 'eduexpress-n8n-2024';
const H = {
  'Content-Type': 'application/json',
  'x-api-key': KEY,
  'Accept': 'application/json',
  'User-Agent': 'EduExpress-Seeder/1.0',
  'Connection': 'close',
};
const TODAY = new Date().toISOString().slice(0, 10);

if (typeof fetch !== 'function') {
  console.error('❌ Node 18+ needed for built-in fetch. Run `node -v`.');
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

// ── 11 China partner universities (Bachelor 2026 Last Call) ──
// tuition field = net annual cost after scholarship. Full fee breakdown,
// requirement, age limit, deadline and deposit kept in notes.
const universities = [
  { name: 'Jiangxi Institute of Technology', country: 'China', city: 'Nanchang, Jiangxi', programs: 'International Trade & Economics, Computer Science & Technology, Business Administration', intakes: 'Fall 2026', tuition: 'Yr1: 100% tuition free + hostel 3,000 CNY; Yr2+ performance-based', lang_req: 'English medium', admission_url: '', brochure_url: '', partner: 1, last_verified: TODAY, notes: 'Bachelor, 4 yrs. Req: HSC 3.00+. Age 18-23. Y2 tiers (tuition+hostel/yr): Top5% 2,400 / next10% 6,200 / 11,000 / 15,800 / 19,000 / 20,600 / 21,200. Actual fees: app 1,000 + reg 1,000 (after pre-adm), tuition 26,000?, accommodation 6,200, books 800, insurance 800, medical 550 (Y1), residence permit 800. Deposit 5,000 CNY after pre-admission notice. Deadline 30 Jun 2026 (depends on seats).' },
  { name: 'Lishui University', country: 'China', city: 'Lishui, Zhejiang', programs: 'Computer Science & Technology, Nursing, International Economics & Trade, Civil Engineering, Tourism Management, E-commerce, English Language & Literature', intakes: 'Fall 2026', tuition: 'Yr1: 100% tuition free + 1,750 RMB dorm; Yr2-4 total 7,750–10,750 CNY (perf.)', lang_req: 'English taught (IELTS / Duolingo / MOI)', admission_url: '', brochure_url: '', partner: 1, last_verified: TODAY, notes: 'Bachelor. 9,400 RMB refundable deposit (refunded from Y2). Y2-4: Type-A top50% 7,750 / Type-B 51-80% 9,250 / Type-C others 10,750 (tuition+dorm). Req: passport, photo, HS transcript+cert, medical, police clearance, English proof, bank stmt $5,000+, 2-min intro video. Age 18-25. NOC transfer students welcome. All countries accepted.' },
  { name: 'Hubei Normal University (HBNU)', country: 'China', city: 'Wuhan, Hubei', programs: 'Computer Science & Technology, International Trade & Economics', intakes: 'Fall 2026', tuition: 'Tuition + hostel 10,000 CNY/yr', lang_req: 'English medium', admission_url: '', brochure_url: '', partner: 1, last_verified: TODAY, notes: 'Bachelor, 4 yrs. Ranking US News 1985. Req: HSC 4.00+. Excellent results get extra 15,000 CNY scholarship. Extra fees: app 500, accommodation 4,000, insurance 800, medical 186 (Y1), residence permit 400. Age 18-25. Deadline 30 Jun (verify 2025/2026).' },
  { name: 'Wuchang University of Technology (WCUT)', country: 'China', city: 'Wuhan, Hubei', programs: 'Computer Science & Technology, Intelligent Science & Technology, Data Science & Big Data Technology, International Economics & Trade, Business Administration, Intelligent Construction', intakes: 'Fall 2026', tuition: 'Tuition + hostel 15,000 CNY/yr', lang_req: 'English medium', admission_url: '', brochure_url: '', partner: 1, last_verified: TODAY, notes: 'Bachelor, 4 yrs. Req: HSC 4.00+. Excellent results get extra 15,000 CNY. Extra fees: app 500, tuition 15,000, accommodation 3,000, insurance 800, medical 186 (Y1), residence permit 400. Age 18-25. Deadline 30 Jun (verify 2025/2026).' },
  { name: 'Beibu Gulf University (BGU)', country: 'China', city: 'Qinzhou, Guangxi', programs: 'Tourism Management', intakes: 'Fall 2026', tuition: 'Tuition + hostel 10,500 CNY/yr', lang_req: 'English medium', admission_url: '', brochure_url: '', partner: 1, last_verified: TODAY, notes: 'Bachelor, 4 yrs. Req: HSC 3.50+. Extra fees: app 500, tuition 8,500, accommodation 2,000, insurance 800, medical 100-500 (Y1), residence permit 400. Age 18-25. Deadline 30 Jun (verify 2025/2026).' },
  { name: 'Shandong Agriculture and Engineering University (SDAEU)', country: 'China', city: 'Zibo, Shandong', programs: 'Mechanical & Electrical Engineering, Artificial Intelligence, Remote Sensing Science & Technology', intakes: 'Fall 2026', tuition: 'After scholarship: tuition 7,300 + hostel 2,600 CNY/yr', lang_req: 'English medium (EFSET or MOI acceptable)', admission_url: '', brochure_url: '', partner: 1, last_verified: TODAY, notes: 'Bachelor, 4 yrs. Req: HSC 3.50+. Actual fees: app 400 (non-refundable), tuition 14,600, hostel 2,600 (double room), insurance 800, medical 400-500 (Y1), residence permit 400. Deposit 7,300 CNY after pre-admission notice. Age 18-30. Deadline 30 Jul 2026.' },
  { name: 'Hechi University (HEU)', country: 'China', city: 'Hechi, Guangxi', programs: 'Business English, Computer Science & Technology (1+4), Trade Economics (1+4)', intakes: 'Fall 2026', tuition: 'Tuition 6,500 + hostel 2,000 CNY/yr', lang_req: 'English medium', admission_url: '', brochure_url: '', partner: 1, last_verified: TODAY, notes: 'Bachelor, 4 yrs. Req: HSC 3.50+. Excellent results get extra 4,000 CNY/yr. Extra fees: reg 400, tuition 6,500, accommodation 2,000, insurance 800, medical 400-500 (Y1), residence permit 400. Age 18-22. Deadline 30 Jun (verify 2025/2026).' },
  { name: 'Hebei Academy of Fine Arts (HAFA)', country: 'China', city: 'Shijiazhuang, Hebei', programs: 'Architecture, Animation, Film & TV Photography & Production, Drawing Painting, Art Education, Product Design, Digital Media Art, Apparel & Accessories Design, Jewelry & Accessory Design', intakes: 'Fall 2026', tuition: 'After 75% scholarship: tuition 7,500 + hostel 2,000-3,000 CNY/yr', lang_req: 'English medium', admission_url: '', brochure_url: '', partner: 1, last_verified: TODAY, notes: 'Bachelor, 4 yrs (arts/design). Req: HSC 3.50+. Y2-4 scholarship: just pass exam & regular attendance. Extra fees: app 500, insurance 800, medical 100-400 (Y1), residence permit 400. Age 18-24. Deadline 30 May 2026. ("Harry Porter School in China").' },
  { name: 'Zibo Polytechnic University (ZPU)', country: 'China', city: 'Zibo, Shandong', programs: 'Electrical Engineering & Automation, Mechanical Engineering, Big Data Engineering, Internet of Things Engineering Technology', intakes: 'Fall 2026', tuition: 'Tuition 6,500 + hostel 1,800 CNY/yr (before scholarship)', lang_req: 'English medium', admission_url: '', brochure_url: '', partner: 1, last_verified: TODAY, notes: 'Bachelor, 4 yrs. Req: HSC 3.50+. Scholarship: all students 1,000-8,000 CNY/yr + additional 5,000-20,000 CNY/yr available (just pass exam & attendance). Extra fees: reg 300, insurance 800, medical 500-600 (Y1), residence permit 400, books 300-500. Age 17-25. Deadline 30 Jun 2026.' },
  { name: 'Shenyang Urban Construction University (SYUCU)', country: 'China', city: 'Shenyang, Liaoning', programs: 'Business Administration, Computer Science & Technology, Civil Engineering, Architecture', intakes: 'Fall 2026', tuition: 'Tuition 10,000 + hostel 2,700 CNY/yr', lang_req: 'English medium', admission_url: '', brochure_url: '', partner: 1, last_verified: TODAY, notes: 'Bachelor, 4 yrs. Req: HSC 3.00+. Extra fees: app 500, insurance 800, medical 100-400 (Y1), residence permit 400. Age 16-32. Deadline 30 Jun (verify 2025/2026).' },
  { name: 'Shenyang City University', country: 'China', city: 'Shenyang, Liaoning', programs: 'Business Management, Computer Science & Technology, Artificial Intelligence, Civil Engineering', intakes: 'Fall 2026', tuition: 'Tuition 10,000 + hostel 4,500 CNY/yr', lang_req: 'English medium', admission_url: '', brochure_url: '', partner: 1, last_verified: TODAY, notes: 'Bachelor, 4 yrs. Req: HSC 3.00+. Extra fees: app 500 (non-refundable), insurance 800, medical 100-400 (Y1), residence permit 500-800, books 500. Deposit 2,800 CNY for getting JW202. Age 16-30. Deadline 30 Jun (verify 2025/2026).' },
];

(async () => {
  console.log(`Node ${process.version} — Seeding ${universities.length} universities → ${BASE}`);
  try {
    await seed('kb/universities', universities, 'name');
    console.log('✅ Done. Open Marketing → Data Center → Universities in the CRM.');
  } catch (e) {
    console.error('❌ Seeding failed:', e.message);
    if (e.cause) console.error('   cause:', e.cause.code || e.cause.message || e.cause);
    process.exit(1);
  }
})();
