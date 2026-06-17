#!/usr/bin/env node
/**
 * Seeds CRM Competitor Intel from the "Competitor Analysis: China Study Abroad
 * Market in Bangladesh" doc. Each row = a competitor + our counter-angle.
 * Self-healing: seeds idempotent-by-competitor THEN dedups (keeps lowest id).
 *
 * Run:  node seed_competitors.mjs    |    Preview:  DRY=1 node seed_competitors.mjs
 */
const BASE = process.env.BASE || 'https://crm.eduexpressint.com';
const KEY  = process.env.API_KEY || 'eduexpress-n8n-2024';
const DRY  = process.env.DRY === '1';
const H = { 'Content-Type':'application/json','x-api-key':KEY,'Accept':'application/json','User-Agent':'EduExpress-Seeder/1.0','Connection':'close' };
const TODAY = new Date().toISOString().slice(0,10);
const sleep = ms => new Promise(r=>setTimeout(r,ms));
const isTransient = e => /ECONNRESET|fetch failed|ETIMEDOUT|EAI_AGAIN|socket hang up|UND_ERR/i.test(`${e.message} ${e.cause?.code||''}`);
async function req(path,opts={},tries=5){ for(let i=1;i<=tries;i++){ try{ const r=await fetch(`${BASE}/api/marketing/${path}`,{headers:H,...opts}); if(r.status===404) return {_gone:true}; if(!r.ok) throw new Error(`${opts.method||'GET'} ${path} → ${r.status} ${await r.text()}`); const t=await r.text(); return t?JSON.parse(t):{}; }catch(e){ if(i<tries&&isTransient(e)){ await sleep(700*i); continue;} throw e; } } }

const C = (competitor, channel, observation, our_angle, tier) => ({ log_date:TODAY, competitor, channel, observation:`[${tier}] ${observation}`, link:'', our_angle, added_by:'competitor-analysis' });

const competitors = [
  // Tier 1 — dedicated China specialists (high priority)
  C('Sangen Edu Ltd','Website, Facebook','MBBS in China, CSC scholarships, visa success, top universities. Strong FB presence; significant MBBS player.','Match MBBS focus but out-prove them: verified CSC figures, named consultants, transparent total-cost breakdowns.','Tier 1'),
  C('MalishaEdu','Website, Facebook, Instagram','China MBBS & higher ed. Messaging: university partnerships, scholarships, affordability. Active multi-platform, targets medical students.','Counter with our 100+ MOUs + real alumni visa stories; push non-MBBS bachelor scholarships they under-serve.','Tier 1'),
  C('DreamEdu Consultancy','Website, Facebook','China study abroad; "China dream" narrative, scholarships, admissions support.','Out-proof aspirational fluff with concrete numbers + verified alumni testimonials.','Tier 1'),
  // Tier 2 — strong China presence / multi-destination
  C('AR Education','Facebook (groups + page)','China & Europe general study abroad; "leading consultancy" claims; active social engagement.','Specialise harder on China with named experts; counter vague "leading" claims with verifiable stats.','Tier 2'),
  C('China Education Consultancy (CEC)','Facebook','China specialist run by experienced China/Bangladesh consultants; expert guidance, query handling.','We also have direct China expertise PLUS a Dhanmondi office for in-person trust.','Tier 2'),
  C('GoStudy','Website, directories','China consultancy in Dhaka; appears more as a directory listing, low direct social activity.','Win on social activity + content volume they lack.','Tier 2'),
  C('Roushan Educare','Website','China student visa & admission services; affordable world-class education, scholarships.','Lead with 98% visa success + our document-vetting process.','Tier 2'),
  C('Educarebd','Website','Study in China, full/partial scholarships; positions as top consultancy.','Beat a static website with real social stories + Data Center-backed facts.','Tier 2'),
  // Tier 3 — general w/ China offering / niche
  C('Megamind Plus Study Abroad','Facebook, Instagram, TikTok, LinkedIn','Strong China (diploma + bachelor w/ scholarship); aggressive pricing (~1.3L BDT diploma, ~1.5L bachelor w/ stipend); uses TikTok well; "Edu Expo".','Most aggressive rival: match TikTok + transparent pricing posts; differentiate on partnerships + 98% visa success.','Tier 3'),
  C('Wider World Consultancy','Instagram, Facebook','Europe (Hungary, Malta) + China; post-arrival support; "no fee if rejected"; comprehensive journey.','Counter with our refund transparency + post-arrival support messaging.','Tier 3'),
  C('SK Global Consultancy','Instagram ads','China language programs, fully funded, September intake; direct ads.','Niche language only; we cover full degree programs + broader scholarships.','Tier 3'),
  C('Maxim Study World','Facebook','Generalist study abroad with China as one option; "Unlock your future", trusted partner.','Out-specialise on China depth and proof.','Tier 3'),
  C('Content-Driven Competitor','Website blog, social','CSC scholarship focus; strong on information (requirements, costs) via blog.','Match with Research Library-backed, fact-checked content + our verified figures.','Tier 3'),
  // Niche / regional mentions
  C('Rupkatha Edu World','Social','Fully funded, 100% scholarship, free air-ticket claims for China.','Caution students against over-promises; win trust with realistic, verified numbers.','Niche'),
  C('RM International Study Visa Service','Ads','China bachelor/master ads, visa service.','Lead with named partner universities + transparent process.','Niche'),
  C('Foreign Study Center','Website','China + other destinations.','Specialise on China proof + Dhanmondi presence.','Niche'),
  C('AR Education Rajshahi','Regional','Regional (Rajshahi) focus for China admissions.','Defend regional reach via digital + WhatsApp counselling.','Niche'),
  C('Digital Consulting BD','Website, directory','Lists various consultancies including China-focused ones; aggregator/directory-style presence.','Out-rank a directory aggregator with first-party content + real alumni proof; own the China specialist position.','Niche'),
];

async function seed(){
  const existing = await req('competitors');
  const have = new Set(existing.map(r=>String(r.competitor||'').trim().toLowerCase()));
  let added=0, skipped=0;
  for(const row of competitors){
    const k=String(row.competitor||'').trim().toLowerCase();
    if(have.has(k)){ skipped++; continue; }
    if(DRY){ console.log('  [dry] would add:', row.competitor); added++; continue; }
    await req('competitors',{method:'POST',body:JSON.stringify(row)}); have.add(k); added++; await sleep(150);
  }
  console.log(`  competitors: +${added} ${DRY?'would add':'added'}, ${skipped} skipped`);
}
async function dedupe(){
  const rows = await req('competitors'); const by=new Map();
  for(const r of rows){ const k=String(r.competitor||'').trim().toLowerCase(); if(!by.has(k)) by.set(k,[]); by.get(k).push(r); }
  const extra=[]; for(const [,g] of by){ if(g.length>1){ g.sort((a,b)=>a.id-b.id); extra.push(...g.slice(1)); } }
  for(const r of extra){ console.log(`  ${DRY?'[dry] would delete':'deleting'} dup id=${r.id} ${r.competitor}`); if(!DRY){ await req(`competitors/${r.id}`,{method:'DELETE'}); await sleep(120);} }
  if(!extra.length) console.log('  no duplicates.');
}
(async()=>{
  console.log(`Node ${process.version} — Seeding Competitor Intel → ${BASE}${DRY?'  (DRY RUN)':''}`);
  try{ await seed(); await dedupe(); const after=await req('competitors'); console.log(`✅ Done. Competitor Intel now has ${after.length} rows.`); }
  catch(e){ console.error('❌ Failed:', e.message); if(e.cause) console.error('  cause:', e.cause.code||e.cause.message||e.cause); process.exit(1); }
})();
