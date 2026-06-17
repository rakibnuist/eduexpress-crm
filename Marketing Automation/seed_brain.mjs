#!/usr/bin/env node
/**
 * BRAIN INGEST (one-time / re-runnable) — loads the EduExpress Content Brain into the CRM.
 * Writes verified destination facts into kb_universities, kb_scholarships, and kb_sources so the
 * weekly planner cites LIVE CRM facts instead of hardcoded anchors.
 *
 * Same pattern as seed_competitors.mjs: idempotent (skips rows already present by name/topic), retries.
 *
 * Run:      node seed_brain.mjs
 * Preview:  DRY=1 node seed_brain.mjs
 */
const BASE = process.env.BASE || 'https://crm.eduexpressint.com';
const KEY  = process.env.API_KEY || 'eduexpress-n8n-2024';
const DRY  = process.env.DRY === '1';
const H = { 'Content-Type':'application/json','x-api-key':KEY,'Accept':'application/json','User-Agent':'EduExpress-Brain/1.0','Connection':'close' };
const TODAY = new Date().toISOString().slice(0,10);
const sleep = ms => new Promise(r=>setTimeout(r,ms));
const isTransient = e => /ECONNRESET|fetch failed|ETIMEDOUT|EAI_AGAIN|socket hang up|UND_ERR/i.test(`${e.message} ${e.cause?.code||''}`);
async function req(path,opts={},tries=5){ for(let i=1;i<=tries;i++){ try{ const r=await fetch(`${BASE}/api/marketing/${path}`,{headers:H,...opts}); if(!r.ok) throw new Error(`${opts.method||'GET'} ${path} -> ${r.status} ${await r.text()}`); const t=await r.text(); return t?JSON.parse(t):{}; }catch(e){ if(i<tries&&isTransient(e)){ await sleep(700*i); continue;} throw e; } } }

// ---- UNIVERSITIES (name,country,city,programs,intakes,tuition,lang_req,partner,notes) ----
const U=(name,country,city,programs,tuition,lang_req,notes,partner=1)=>({name,country,city,programs,intakes:'2026',tuition,lang_req,admission_url:'',brochure_url:'',partner,notes,last_verified:TODAY});
const UNIVERSITIES=[
  // China — Bachelor (Without CSCA sheet)
  U('Jiangxi Institute of Technology','China','Nanchang','Intl Trade & Economics, Computer Science, Business Admin','Yr1 100% tuition free + hostel 3,000 CNY; Yr2+ performance tiers (Top5% 2,400)','MOI/IELTS/Duolingo','HSC 3.00+, age 18-23, ~30 Jun 2026, admission WITHOUT CSCA'),
  U('Lishui University','China','Zhejiang','CS, Nursing, Intl Economics, Civil Eng, Tourism, E-commerce, English','Yr1 100% tuition free + 1,750 RMB dorm; Yr2-4 Top50% total 7,750 CNY','IELTS/Duolingo/MOI','NOC transfer welcome; all countries accepted'),
  U('Hubei Normal University','China','Wuhan','Computer Science, Intl Trade & Economics','tuition + hostel 10,000 CNY/yr; top results +15,000 CNY','MOI/IELTS','HSC 4.00+'),
  U('Wuchang University of Technology','China','Wuhan','CS, Data Science & Big Data, Intelligent Construction, Business Admin','tuition + hostel 15,000 CNY/yr; +15,000 for excellent','MOI/IELTS','HSC 4.00+'),
  U('Beibu Gulf University','China','Qinzhou','Tourism Management','tuition + hostel 10,500 CNY/yr','MOI/IELTS','HSC 3.50+'),
  U('Shandong Agriculture & Engineering University','China','Zibo','Mechanical/Electrical Eng, AI, Remote Sensing','after scholarship tuition 7,300 + hostel 2,600 CNY/yr','EFSET/MOI','HSC 3.50+, age 18-30, ~30 Jul 2026'),
  U('Hechi University','China','Hechi','Business English, Computer Science, Trade Economics','tuition 6,500 + hostel 2,000 CNY/yr; top +4,000','MOI/IELTS','HSC 3.50+'),
  U('Hebei Academy of Fine Arts','China','Shijiazhuang','Architecture, Animation, Film & TV, Digital Media, Design','after 75% scholarship tuition 7,500 CNY/yr','MOI/IELTS','"Harry Potter campus"; Yr2-4 just pass + attend; HSC 3.50+'),
  U('Zibo Polytechnic University','China','Zibo','Electrical/Mechanical Eng, Big Data, IoT','tuition 6,500 + hostel 1,800; +5,000-20,000 scholarship','MOI/IELTS','HSC 3.50+'),
  U('Shenyang Urban Construction University','China','Shenyang','Business Admin, CS, Civil Eng, Architecture','tuition 10,000 + hostel 2,700 CNY/yr','MOI/IELTS','HSC 3.00+, age 16-32'),
  U('Shenyang City University','China','Shenyang','Business Mgmt, CS, AI, Civil Eng','tuition 10,000 + hostel 4,500 CNY/yr','MOI/IELTS','HSC 3.00+'),
  U('China Jiliang University','China','Hangzhou','Intl Economics, Business, CS, Comm Eng, Mechanical, Pharmacy','tuition 15,000-18,000 CNY/yr','English/Chinese','self-paid bachelor; Zhejiang'),
  U('Shandong First Medical University','China','Tai\'an','Clinical Medicine (MBBS), Pharmacy, Stomatology, Nursing, Biotech','prep + clinical; English-taught Pharmacy 15,000 RMB','IELTS 6 (English-taught)','MBBS via prep + HSK; medical lead'),
  U('Nanchang Medical College','China','Nanchang','Pharmacy (English 4yr), Chinese Language','Pharmacy 15,000 RMB/yr; hostel 2,000','IELTS (English-taught)','~20% get NCMC scholarship'),
  // Hungary (self-paid)
  U('University of Debrecen','Hungary','Debrecen','CS, Engineering (many), Pharmacy, Business','Bachelor 6,500-7,500 USD; Pilot 35,000','MOI/IELTS','SELF-PAID; entrance exam; Schengen'),
  U('Wekerle Business School','Hungary','Budapest','Commerce & Marketing, Business Admin, HR, Intl Business, Business Informatics','Bachelor EUR 5,600-6,200; Masters 5,800-8,200','MOI/IELTS/Skype','SELF-PAID; pay 1 sem + EUR 600 deposit'),
  U('University of Gyor','Hungary','Gyor','Bachelor & Masters (business/eng)','Bachelor EUR 3,400-5,200','IELTS ~5-5.5/MOI','SELF-PAID; no interview'),
  // Malta (self-paid)
  U('Learn Key Institute','Malta','Valletta','Business, Accounting & Finance, AI Software, Tourism, Nursing, IT','EUR 6,500-7,500','no IELTS (some 5.5-6.5)','SELF-PAID; Schengen; intakes Jan/Mar/Jun/Oct'),
  U('Malita International College','Malta','Valletta','Business Mgmt, Health & Social Care, Logistics, Tourism, BBA, MBA','EUR 6,500-8,000','no IELTS','SELF-PAID; Schengen'),
  // Croatia (self-paid)
  U('University of Rijeka (and North/Pula/Split/Dubrovnik)','Croatia','Rijeka','Tourism Mgmt, Marketing, IT Mgmt (BA); Economics, Tourism, Media (MA)','Bachelor EUR 2,300; Masters EUR 3,000','IELTS 5/TOEFL 65/MOI + interview','SELF-PAID; Schengen; deadline 31 May 2026; bank 15L'),
  // Cyprus (study & work)
  U('Mesoyios College','Cyprus','Larnaca','Hotel Management, BBA (Study & Work)','Yr1 EUR 5,440; employer-covered from month 7','IELTS 4/5','STUDY & WORK: employer funds tuition+accommodation+pocket money; save ~EUR 15k; 1-4yr work permit'),
  // Azerbaijan (self-paid package)
  U('Baku Business University','Azerbaijan','Baku','Foundation, BBA, IT, MBA','Foundation $2,500; Bachelor/Masters $3,000','no IELTS','SELF-PAID pkg 4,99,000; payment after visa; credit transfer to EU/USA'),
];

// ---- SCHOLARSHIPS / PROGRAMS (name,country,type,coverage,eligibility,deadline,notes) ----
const S=(name,country,type,coverage,eligibility,deadline,notes)=>({name,country,type,coverage,eligibility,deadline,source_url:'',status:'active',last_verified:TODAY,notes});
const SCHOLARSHIPS=[
  S('China University Scholarship (Bachelor)','China','University','Up to 100% tuition + hostel waiver; stipend Tk 10,000-60,000/mo by class','HSC; IELTS/Duolingo/MOI; often WITHOUT CSCA','Intake-based (~Jun/Sep 2026)','Scholarship-oriented segment. De-hype govt CSC.'),
  S('China Partial Scholarship (Bachelor)','China','University','Partial waiver; cheaper than BD private universities','Low GPA / study gap; no IELTS needed','Intake-based','For weaker profiles'),
  S('China Diploma','China','University','100% tuition + hostel free + stipend; 3yr diploma -> 2yr Bachelor','SSC pass; age <=25','Intake-based','Gap-year / SSC segment'),
  S('China MBBS / Top-Ranked / Aerospace','China','Self-paid','Self-paid (premium)','Good profile; upper-middle','Intake-based','BMDC-listed (e.g. ZZU). Self-paid segment.'),
  S('China Masters','China','University','Full funded + stipend (limited)','Good GPA; apply with MOI','April','Stipend seats limited (500-1500 CNY)'),
  S('South Korea EAP','South Korea','Self-paid','Language/academic pathway','No IELTS','Rolling','Secondary focus'),
  S('South Korea Bachelor (Regional Visa)','South Korea','Self-paid','Self-funded study','K-culture/Electrical/Mechanical interest','Rolling','Verify cost from EAP/EVISA Korea PDFs'),
  S('South Korea Masters (E-Visa)','South Korea','Self-paid','Self-funded study','No IELTS / study gap ok','Rolling','Secondary focus'),
  S('Hungary (Self-paid)','Hungary','Self-paid','Self-funded; ~EUR 5,600 tuition; Schengen','MOI/IELTS; study gap ok','Sep intake','NOT a govt scholarship. Service 1,20,000'),
  S('Malta (Self-paid)','Malta','Self-paid','Self-funded; EUR 6,500-8,000; Schengen','No IELTS','Jan/Mar/Jun/Oct','Bank 30L; service 1,20,000'),
  S('Croatia (Self-paid)','Croatia','Self-paid','Self-funded; EUR 2,300-3,000 (cheapest EU); Schengen','IELTS5/MOI + interview','31 May 2026','Bank 15L; service 1,20,000'),
  S('Cyprus Study & Work (Mesoyios)','Cyprus','Study & Work','Employer covers tuition from month 7 + accommodation + meals + pocket money; save ~EUR 15k','IELTS 4/5; hotel mgmt/BBA','Foundation 15 May / Major 30 May','1-4yr work permit after graduation'),
  S('Germany via China (Pathway)','Germany','Pathway','Start China (fully-funded Bachelor) -> German visa from China; skips 29-month wait','HSC 4.0+; blocked EUR 11,904 (refundable)','Sep 2025 China start','China pkg 1.8-2L; payment after visa'),
  S('Azerbaijan (Self-paid pkg)','Azerbaijan','Self-paid','Package 4,99,000 incl 1yr tuition + air ticket','No IELTS; no bank statement; payment after visa','Sep 2025','Credit transfer to EU/USA ~95% visa'),
  S('Georgia (Self-paid)','Georgia','Self-paid','Self-funded Bachelor/Masters','No IELTS; study gap ok','Rolling','Other product'),
  S('UK (Self-paid)','UK','Self-paid','Self-funded, premium','IELTS/MOI/Duolingo; 2 ref letters + SOP','Jan/Sep','Document-heavy; CAS letter'),
];

// ---- SOURCES (topic,url,source_type,use_for,notes) ----
const SRC=(topic,url,source_type,use_for,notes)=>({topic,url,source_type,use_for,date_added:TODAY,notes});
const SOURCES=[
  SRC('Architecture','https://docs.google.com/document/d/1LjL1c2A8iu6LGBIdb2bU2PImof9qywa8AVfPKzmPHj8/edit','reference','system design','Content Brain architecture'),
  SRC('Master Positioning & Segments','https://docs.google.com/document/d/1o0P6OUz6L0iEaJ0S4f8oF4d-nADLmY65DxAXDTvichM/edit','positioning','segment rules','China/Korea/Europe segmentation'),
  SRC('Locked Stats & Decisions','https://docs.google.com/document/d/1b4wTacHFkCn1ITQmZZ5ZlXXSMhYRBI7pm5nAh7keA40/edit','positioning','stats + rules','98%/8yr/2,000+/150+; 50/45/5 mix'),
  SRC('Content & Script doc','https://docs.google.com/document/d/1T8ZY5qdLkMC5AzoHnePwIfnYOl5usW2_N3x_sAE8aSs/edit','voice_example','scripts + captions + calendar','Khaled scripts, real captions, day-by-day plan'),
  SRC('Europe doc','https://docs.google.com/document/d/1jvfH1-qh2QknayYK6dbTeCB8ExlQmql5f7FBBrCaowQ/edit','reference','Europe facts','Malta/Croatia/Hungary/Cyprus/Azerbaijan/Germany'),
];

(async () => {
  console.log(`Brain Ingest -> ${BASE}${DRY?'  (DRY RUN)':''}`);
  const sets = [
    { path:'kb/universities', key:'name',  rows:UNIVERSITIES },
    { path:'kb/scholarships', key:'name',  rows:SCHOLARSHIPS },
    { path:'kb/sources',      key:'topic', rows:SOURCES },
  ];
  for (const set of sets) {
    let existing = [];
    try { existing = await req(set.path); } catch (e) { console.error(`Read ${set.path} failed:`, e.message); continue; }
    const have = new Set((existing||[]).map(r => String(r[set.key]||'').trim().toLowerCase()));
    let added=0, skipped=0;
    for (const row of set.rows) {
      const id = String(row[set.key]||'').trim().toLowerCase();
      if (have.has(id)) { skipped++; continue; }
      if (DRY) { console.log(`  WOULD ADD [${set.path}]`, row[set.key]); added++; have.add(id); continue; }
      try { await req(set.path, { method:'POST', body: JSON.stringify(row) }); have.add(id); added++; }
      catch (e) { console.error(`  FAILED [${set.path}] ${row[set.key]}:`, e.message); }
    }
    console.log(`${set.path}: added ${added}, skipped ${skipped} (already present).`);
  }
  console.log('Done. The weekly planner will now cite these live CRM facts (it prefers CRM over hardcoded anchors).');
})();
