#!/usr/bin/env node
/**
 * Removes duplicate universities from the CRM Data Center.
 * Keeps the LOWEST id for each university name, deletes the rest.
 * Safe to run multiple times. DELETE is retried only on network errors,
 * and a 404 (already gone) is treated as success — so it can't create new rows.
 *
 * Run:  node dedup_universities.mjs
 * Preview only (no deletes):  DRY=1 node dedup_universities.mjs
 */

const BASE = process.env.BASE || 'https://crm.eduexpressint.com';
const KEY  = process.env.API_KEY || 'eduexpress-n8n-2024';
const DRY  = process.env.DRY === '1';
const H = {
  'Content-Type': 'application/json',
  'x-api-key': KEY,
  'Accept': 'application/json',
  'User-Agent': 'EduExpress-Dedup/1.0',
  'Connection': 'close',
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const isTransient = (e) => /ECONNRESET|fetch failed|ETIMEDOUT|EAI_AGAIN|socket hang up|UND_ERR/i.test(`${e.message} ${e.cause?.code || ''}`);

async function req(path, opts = {}, tries = 5) {
  for (let i = 1; i <= tries; i++) {
    try {
      const r = await fetch(`${BASE}/api/marketing/${path}`, { headers: H, ...opts });
      if (r.status === 404) return { _gone: true };        // already deleted — fine
      if (!r.ok) throw new Error(`${opts.method || 'GET'} ${path} → ${r.status} ${await r.text()}`);
      const t = await r.text();
      return t ? JSON.parse(t) : {};
    } catch (e) {
      if (i < tries && isTransient(e)) { await sleep(700 * i); continue; }
      throw e;
    }
  }
}

(async () => {
  const rows = await req('kb/universities');
  const byName = new Map();
  for (const r of rows) {
    const k = String(r.name || '').trim().toLowerCase();
    if (!byName.has(k)) byName.set(k, []);
    byName.get(k).push(r);
  }
  const toDelete = [];
  for (const [, group] of byName) {
    if (group.length <= 1) continue;
    group.sort((a, b) => a.id - b.id);          // keep lowest id
    toDelete.push(...group.slice(1));
  }
  console.log(`Total rows: ${rows.length} | unique names: ${byName.size} | duplicates to remove: ${toDelete.length}`);
  for (const r of toDelete) console.log(`  ${DRY ? '[dry] would delete' : 'deleting'} id=${r.id}  ${r.name}`);
  if (DRY) { console.log('Dry run — nothing deleted. Re-run without DRY=1 to apply.'); return; }
  for (const r of toDelete) { await req(`kb/universities/${r.id}`, { method: 'DELETE' }); await sleep(150); }
  const after = await req('kb/universities');
  console.log(`✅ Done. Universities now: ${after.length}`);
})().catch(e => { console.error('❌ Dedup failed:', e.message); process.exit(1); });
