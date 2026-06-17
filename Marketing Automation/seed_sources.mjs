#!/usr/bin/env node
/**
 * Seeds the CRM Research Library (kb/sources) with VERIFIED official sources
 * (URLs confirmed via web search, June 2026). Additive + idempotent by url.
 * Self-healing: after seeding it removes any duplicate urls (keeps lowest id),
 * so a retried POST can never leave duplicate rows.
 *
 * Run:  node seed_sources.mjs
 * Preview only:  DRY=1 node seed_sources.mjs
 */

const BASE = process.env.BASE || 'https://crm.eduexpressint.com';
const KEY  = process.env.API_KEY || 'eduexpress-n8n-2024';
const DRY  = process.env.DRY === '1';
const H = {
  'Content-Type': 'application/json',
  'x-api-key': KEY,
  'Accept': 'application/json',
  'User-Agent': 'EduExpress-Seeder/1.0',
  'Connection': 'close',
};
const TODAY = new Date().toISOString().slice(0, 10);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const isTransient = (e) => /ECONNRESET|fetch failed|ETIMEDOUT|EAI_AGAIN|socket hang up|UND_ERR/i.test(`${e.message} ${e.cause?.code || ''}`);

async function req(path, opts = {}, tries = 5) {
  for (let i = 1; i <= tries; i++) {
    try {
      const r = await fetch(`${BASE}/api/marketing/${path}`, { headers: H, ...opts });
      if (r.status === 404) return { _gone: true };
      if (!r.ok) throw new Error(`${opts.method || 'GET'} ${path} → ${r.status} ${await r.text()}`);
      const t = await r.text();
      return t ? JSON.parse(t) : {};
    } catch (e) {
      if (i < tries && isTransient(e)) { await sleep(700 * i); continue; }
      throw e;
    }
  }
}

// Verified official sources (June 2026). campuschina.org / studyinkorea.go.kr /
// stipendiumhungaricum.hu / bd.china-embassy.gov.cn were added by the first seed —
// these are additive. Idempotent by url, so re-adds are skipped.
const sources = [
  { topic: 'CSC online application portal (Study in China)', url: 'https://studyinchina.csc.edu.cn', source_type: 'Official', use_for: 'China / Application portal', date_added: TODAY, notes: 'CSC online application system. Official alongside campuschina.org — ignore third-party portals.' },
  { topic: 'Study in Korea — GKS scholarship details', url: 'https://www.studyinkorea.go.kr/in/plan/scholarship.do', source_type: 'Official', use_for: 'Korea / Scholarship details', date_added: TODAY, notes: 'NIIED GKS info. From 2026 GKS-U, apply online only via studyinkorea.go.kr.' },
  { topic: 'Stipendium Hungaricum — online application', url: 'https://apply.stipendiumhungaricum.hu', source_type: 'Official', use_for: 'Hungary / Application portal', date_added: TODAY, notes: 'Tempus Public Foundation apply system. 2026/27 deadline was 15 Jan 2026 14:00 CET — re-verify each cycle.' },
  { topic: 'Study in Hungary (official info portal)', url: 'https://studyinhungary.hu', source_type: 'Official', use_for: 'Hungary / General info', date_added: TODAY, notes: 'Official Hungary study information portal.' },
];

async function seed() {
  const existing = await req('kb/sources');
  const have = new Set(existing.map(r => String(r.url || '').trim().toLowerCase()));
  let added = 0, skipped = 0;
  for (const row of sources) {
    const k = String(row.url || '').trim().toLowerCase();
    if (have.has(k)) { skipped++; continue; }
    if (DRY) { console.log(`  [dry] would add: ${row.url}`); added++; continue; }
    await req('kb/sources', { method: 'POST', body: JSON.stringify(row) });
    have.add(k); added++;
    await sleep(150);
  }
  console.log(`  kb/sources: +${added} ${DRY ? 'would be added' : 'added'}, ${skipped} skipped`);
}

async function dedupeByUrl() {
  const rows = await req('kb/sources');
  const byUrl = new Map();
  for (const r of rows) {
    const k = String(r.url || '').trim().toLowerCase();
    if (!byUrl.has(k)) byUrl.set(k, []);
    byUrl.get(k).push(r);
  }
  const extra = [];
  for (const [, g] of byUrl) { if (g.length > 1) { g.sort((a, b) => a.id - b.id); extra.push(...g.slice(1)); } }
  if (!extra.length) { console.log('  no duplicate urls.'); return; }
  for (const r of extra) {
    console.log(`  ${DRY ? '[dry] would delete' : 'deleting'} dup id=${r.id} ${r.url}`);
    if (!DRY) { await req(`kb/sources/${r.id}`, { method: 'DELETE' }); await sleep(120); }
  }
}

(async () => {
  console.log(`Node ${process.version} — Seeding Research Library → ${BASE}${DRY ? '  (DRY RUN)' : ''}`);
  try {
    await seed();
    await dedupeByUrl();
    const after = await req('kb/sources');
    console.log(`✅ Done. Research Library now has ${after.length} sources.`);
  } catch (e) {
    console.error('❌ Failed:', e.message);
    if (e.cause) console.error('   cause:', e.cause.code || e.cause.message || e.cause);
    process.exit(1);
  }
})();
