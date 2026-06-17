// EduExpress Weekly Planner v5 — SOCIAL MEDIA ENGINEER
// Integrates: Research Intelligence, Viral Topics, Psychology Profiles, Hook Library, Creative Guidelines
// Feeds OpenCode/Zen/Gemini with real-time CRM data before content generation.
// China page = PDF pillars (Scholarship/Visa/Cost/University/Q&A) + MBBS + "Last Call Without CSCA".
// BD page = markdown pillars (Real Numbers/Student Story/Deadline/Destination/Trust) for Korea/UK/Hungary/Europe.
// Plus: real university facts, competitor counter-angles, rotating lead offers, creative+video mapping, KPIs.
const ENV  = {};
const BASE = (ENV.CRM_BASE || 'https://crm.eduexpressint.com').replace(/\/$/, '');
const KEY  = ENV.CRM_KEY  || 'eduexpress-n8n-2024';
const H = { 'Content-Type': 'application/json', 'x-api-key': KEY };

const doHttp = (opts) => this.helpers.httpRequest(Object.assign({ timeout: 60000 }, opts));
async function jget(p)    { return await doHttp({ method:'GET',  url: BASE + '/api/marketing/' + p, headers: H, json: true }); }
async function jpost(p,b) { return await doHttp({ method:'POST', url: BASE + '/api/marketing/' + p, headers: H, body: b, json: true }); }

/* === BRAND CONSTANTS — single source of truth === */
const BRAND = { years:'8', students:'2,000+', partners:'150+', visa:'98%', phone:'01983-333566', wa:'wa.me/8801983333566', office:'Dhanmondi, Dhaka' };

// Rotating lead offers (replaces generic "free counselling")
const OFFERS = ['Free Profile Assessment', 'Scholarship Eligibility Check', 'Personalized University Shortlist'];

// 1) Trusted facts from CRM (preferred)
const scholarships = await jget('kb/scholarships').catch(()=>[]);
const universities = await jget('kb/universities').catch(()=>[]);

/* === SOCIAL MEDIA ENGINEER: Pull Research Intelligence, Viral Topics, Hooks, Psychology === */
const researchIntel = await jget('research?urgency=critical,high').catch(()=>[]);
const viralTopics   = await jget('viral-topics?status=new,approved').catch(()=>[]);
const winnerHooks   = await jget('hooks?status=winner').catch(()=>[]);
const psychology    = await jget('psychology').catch(()=>[]);
const guidelines    = await jget('creative-guidelines').catch(()=>[]);

/* Build research context for the prompt */
const RESEARCH_CONTEXT = (() => {
  const lines = ['### LIVE RESEARCH INTELLIGENCE (incorporate into content where relevant)'];
  if (Array.isArray(researchIntel) && researchIntel.length) {
    researchIntel.slice(0, 5).forEach(r => {
      lines.push(`- [${r.urgency?.toUpperCase()||'INFO'}] ${r.topic}: ${r.insight_summary?.slice(0, 120)}${r.recommended_angle ? ' → Angle: ' + r.recommended_angle.slice(0, 80) : ''}`);
    });
  } else {
    lines.push('(No critical research findings this week — use evergreen positioning.)');
  }
  lines.push('');
  lines.push('### VIRAL TOPICS / TRENDING SIGNALS');
  if (Array.isArray(viralTopics) && viralTopics.length) {
    viralTopics.slice(0, 3).forEach(v => {
      lines.push(`- ${v.platform||'Social'}: "${v.topic}" (relevance ${v.relevance_score}/100) — ${v.why_viral?.slice(0, 100)}${v.recommended_hook ? ' → Hook: ' + v.recommended_hook : ''}`);
    });
  } else {
    lines.push('(No new viral signals detected this week.)');
  }
  lines.push('');
  lines.push('### WINNING HOOKS (rotate these into content; proven performers)');
  if (Array.isArray(winnerHooks) && winnerHooks.length) {
    winnerHooks.slice(0, 5).forEach(h => {
      lines.push(`- [${h.hook_type}] ${h.hook_text} (conv ${(h.conversion_rate*100||0).toFixed(1)}%, reach ${h.avg_reach||0})`);
    });
  } else {
    lines.push('(No winner hooks logged yet — use the hook variety rules below.)');
  }
  lines.push('');
  lines.push('### AUDIENCE PSYCHOLOGY (target segments)');
  if (Array.isArray(psychology) && psychology.length) {
    psychology.forEach(p => {
      lines.push(`- ${p.segment}: pain=[${p.pain_points?.slice(0,60)}], voice=${p.voice_tone||'empathetic_brother'}, pref=${p.content_preferences||'carousel,video'}`);
    });
  } else {
    lines.push('(Default: Primary = parents 35-55, ROI/safety/visa success. Secondary = students 17-24, MBBS/Engineering/CS/Business, scholarships, campus life.)');
  }
  return lines.join('\n');
})();

/* === CREATIVE GUIDELINES (brief for designer) === */
const CREATIVE_GUIDE = (() => {
  if (!Array.isArray(guidelines) || !guidelines.length) return '';
  const lines = ['### CREATIVE GUIDELINES (follow these specs)'];
  guidelines.forEach(g => {
    lines.push(`- ${g.category?.toUpperCase()} (${g.platform||'all'}): ${g.specification?.slice(0,120)}`);
    if (g.do_s) lines.push(`  ✅ DO: ${g.do_s.slice(0,100)}`);
    if (g.dont_s) lines.push(`  ❌ DON'T: ${g.dont_s.slice(0,100)}`);
  });
  return lines.join('\n');
})();

/* === REAL UNIVERSITY FACTS (from EduExpress "Bachelor 2026 Last Call — Without CSCA" sheet) === */
const UNI_FACTS =
  '- Jiangxi Institute of Technology (Nanchang): Yr1 tuition 100% FREE, hostel 3,000 CNY/yr; Yr2+ performance tiers (Top5% only 2,400 CNY). Majors: Intl Trade & Economics, Computer Science, Business Admin. HSC 3.00+. Age 18-23. Deadline ~30 Jun 2026.\n' +
  '- Lishui University (Zhejiang, English-taught): Yr1 100% tuition free + 1,750 RMB/yr dorm (refundable deposit). Yr2-4 Top50% total 7,750 CNY. Majors: CS, Nursing, Intl Economics, Civil Eng, Tourism, E-commerce, English. HSC + IELTS/Duolingo/MOI. NOC transfer welcome.\n' +
  '- Hubei Normal University (Wuhan): tuition + hostel 10,000 CNY/yr; top results +15,000 CNY extra scholarship. Majors: CS, Intl Trade & Economics. HSC 4.00+.\n' +
  '- Wuchang University of Technology (Wuhan): tuition + hostel 15,000 CNY/yr; +15,000 for excellent. Majors: CS, Data Science & Big Data, Intelligent Construction, Business Admin. HSC 4.00+.\n' +
  '- Beibu Gulf University (Guangxi): tuition + hostel 10,500 CNY/yr. Major: Tourism Management. HSC 3.50+.\n' +
  '- Shandong Agriculture & Engineering University (Zibo): after scholarship tuition 7,300 + hostel 2,600 CNY/yr; EFSET or MOI ok. Majors: Mechanical/Electrical Eng, AI, Remote Sensing. HSC 3.50+. Age 18-30. Deadline ~30 Jul 2026.\n' +
  '- Hechi University (Guangxi): tuition 6,500 + hostel 2,000 CNY/yr; top +4,000/yr. Majors: Business English, CS (1+4), Trade Economics. HSC 3.50+.\n' +
  '- Hebei Academy of Fine Arts (Shijiazhuang) "the Harry-Potter-style campus": after 75% scholarship tuition 7,500 + hostel 2-3k; Yr2-4 just pass + attend. Art majors: Architecture, Animation, Film & TV, Digital Media, Design. HSC 3.50+.\n' +
  '- Zibo Polytechnic University (Shandong): tuition 6,500 + hostel 1,800 CNY/yr; all get 1,000-8,000 tuition scholarship + extra 5,000-20,000. Majors: Electrical/Mechanical Eng, Big Data, IoT. HSC 3.50+.\n' +
  '- Shenyang Urban Construction University: tuition 10,000 + hostel 2,700 CNY/yr. Majors: Business Admin, CS, Civil Eng, Architecture. HSC 3.00+. Age 16-32.\n' +
  '- Shenyang City University: tuition 10,000 + hostel 4,500 CNY/yr. Majors: Business Mgmt, CS, AI, Civil Eng. HSC 3.00+.';

const GENERAL_FACTS =
  'POSITIONING (critical): EduExpress markets CHINA UNIVERSITY scholarships (tuition/hostel waivers from the university sheet), sometimes CSC Type B. We do NOT push government scholarships (full CSC / GKS / Stipendium) as the offer. Korea, UK, Hungary, Malta, Croatia, Cyprus, Azerbaijan, Georgia = SELF-PAID study only.\n' +
  'CHINA (flagship): University scholarships = up to 100% tuition + hostel waiver (per the real university sheet); No IELTS (MOI/EFSET/Duolingo accepted); Payment After Visa Approval (signature differentiator); admission often WITHOUT CSCA; Diploma->Bachelor->Master->PhD. Real partner unis incl Chongqing Jiaotong, Nanjing, Fudan, Zhejiang.\n' +
  'MBBS IN CHINA: major lead driver. Do NOT invent MBBS fees — use CRM facts; if absent, keep it general ("MBBS in China at a fraction of local private cost") and drive to counselling for the exact figure.\n' +
  'SELF-PAID PORTFOLIO (Korea, Hungary, Malta, Croatia, Cyprus, Azerbaijan, Germany-via-China, Georgia, UK): do NOT mention government scholarships (GKS/Stipendium etc.). Use the live CRM facts for exact tuition/cost/process per country. Frame as opportunity, never "scholarship", never "our students/alumni". Notable hooks: Korea EAP/E-Visa no-IELTS; Malta no-IELTS Schengen; Croatia cheapest EU (~EUR 2,300, deadline 31 May 2026); Cyprus Study & Work (employer-funded + work permit); Azerbaijan no-IELTS/no-bank/payment-after-visa + credit transfer; Germany via China (skip the 29-month wait).';

// 2) Upcoming Saturday->Friday week
const pad = n => String(n).padStart(2,'0');
const now = new Date();
const daysUntilSat = ((6 - now.getDay()) + 7) % 7 || 7;
const start = new Date(now); start.setDate(now.getDate() + daysUntilSat);
const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const dates = Array.from({length:7}, (_,i) => { const d = new Date(start); d.setDate(start.getDate()+i); return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()); });
const wom  = Math.min(5, Math.ceil(start.getDate()/7));
const week = start.getFullYear() + '-' + pad(start.getMonth()+1) + '-W' + wom;

/* === SLOTS: per-page MERGED pillar models === */
const CN = { SA:'Scholarship Alert', VS:'Visa Success Story', CB:'Cost Breakdown', US:'University Spotlight', QA:'Live Q&A / Trust', LC:'Last Call — Without CSCA' };
const BD = { RN:'Real Numbers', SS:'Student Story', DH:'Deadline & How-To', DS:'Destination Spotlight', TB:'Trust & BTS' };

// SEASON: Jun–Jul = ADMISSION push (China admission/scholarship wins only); Aug+ = VISA success of current year.
const month = now.getMonth() + 1;
const PHASE = (month === 6 || month === 7) ? 'ADMISSION' : (month >= 8 ? 'VISA' : 'GENERAL');
const chinaWin = PHASE === 'VISA'
  ? 'Real CHINA visa-approval success (current year): [student name] + [university], real photo/clip from /Student Assets/.'
  : 'Real CHINA ADMISSION win: got admission / scholarship / pre-admission to [university]. [student name] + real photo from /Student Assets/. NO visa-approval claim this season.';

/* ===== CHINA PAGE (7) — ~50% of output. Covers the REAL China segments. ===== */
const chinaPlan = [
  { pillar:CN.LC, segment:'Bachelor — University Scholarship', format:'Carousel',     note:'Full/partial university scholarship Bachelor (admission often WITHOUT CSCA, No IELTS/MOI). Name 2-3 real unis + lowest real cost. De-hype govt CSC.' },
  { pillar:CN.VS, segment:'Student Story',                      format:'Single image', note:chinaWin },
  { pillar:CN.CB, segment:'Cost Breakdown',                     format:'Infographic',  note:'Transparent total cost: "চীনে Bachelor-এ আসলে কত খরচ?" a real uni vs local private. Honest real numbers.' },
  { pillar:CN.US, segment:'Diploma (SSC entry)',                format:'Carousel',     note:'Diploma for SSC pass / gap-year: 3yr diploma (tuition+hostel free + stipend) -> 2yr Bachelor. Age <=25.' },
  { pillar:CN.SA, segment:'MBBS / Medical (self-paid)',         format:'Infographic',  note:'MBBS/Pharmacy in China — BMDC-listed, no CSCA exam, fraction of BD private medical cost. SELF-PAID (use CRM facts; do not invent fees).' },
  { pillar:CN.QA, segment:'Trust / Q&A',                        format:'Single image', note:'Payment After Visa, No IELTS, ' + BRAND.visa + ' visa success, Dhanmondi office. Out-position "no fee if rejected" rivals.' },
  { pillar:CN.LC, segment:'Masters / Partial',                  format:'Carousel',     note:'Either Masters (full-funded + stipend, limited, apply MOI) OR Partial-scholarship Bachelor for low-GPA/study-gap students (cheaper than BD private, no IELTS).' },
];
/* ===== BD PAGE (7) — ~45% of output. Rotates the SELF-PAID portfolio. ===== */
const bdPlan = [
  { pillar:BD.RN, destination:'South Korea', format:'Carousel',     note:'Korea SELF-PAID: EAP (no IELTS), Bachelor (K-culture, Electrical/Mechanical), Masters E-Visa (study-gap ok). Real cost + process. NO GKS/govt scholarship.' },
  { pillar:BD.RN, destination:'Hungary',     format:'Infographic',  note:'Hungary SELF-PAID (Schengen, MOI): real tuition (~EUR 5,600) + living + EU degree. NO Stipendium. Opportunity framing.' },
  { pillar:BD.DS, destination:'Malta',       format:'Single image', note:'Malta SELF-PAID (Schengen, NO IELTS): EUR 6,500-8,000, English-speaking, part-time work. Opportunity.' },
  { pillar:BD.RN, destination:'Croatia',     format:'Carousel',     note:'Croatia SELF-PAID (Schengen, IELTS5/MOI): cheapest EU tuition EUR 2,300-3,000. Deadline 31 May 2026. Urgency.' },
  { pillar:BD.DS, destination:'Cyprus',      format:'Single image', note:'Cyprus STUDY & WORK (Mesoyios): employer funds tuition from month 7 + accommodation + pocket money; graduate with savings + 1-4yr work permit. Strong hook.' },
  { pillar:BD.RN, destination:'Azerbaijan',  format:'Infographic',  note:'Azerbaijan SELF-PAID: no IELTS, no bank statement, Payment After Visa, admission 24h, credit-transfer to EU/USA. Package ~4,99,000.' },
  { pillar:BD.DH, destination:'Germany',     format:'Single image', note:'Germany via China pathway: skip the 29-month BD embassy wait — start China (fully-funded) then move to Germany, no IELTS. Smart-route angle.' },
];
// Video (3/week) — TikTok + Reels, Bangla on-camera. 2 China + 1 self-paid Others (rotate).
const videoPlan = [
  { pillar:CN.VS, destination:'China',  topic: PHASE==='VISA' ? 'Current-year visa-approval story on camera (real /Student Assets/ clip).' : 'China ADMISSION win on camera: "[student] just got admission to [university]" (real clip; no visa claim yet).' },
  { pillar:CN.QA, destination:'China',  topic:'Consultant on camera: "CSCA ছাড়াও চীনে Bachelor-এ পড়া যায়?" (Without-CSCA / No-IELTS myth-bust).' },
  { pillar:BD.DS, destination:'Cyprus', topic:'Self-paid spotlight on camera: "ইউরোপে Study + Work — Cyprus-এ পড়ার পাশাপাশি ইনকাম" (rotate weekly: Cyprus / Malta / Azerbaijan / Germany-via-China).' },
];

const slots = [];
dates.forEach((d,i) => { const p=chinaPlan[i]; slots.push({ i:slots.length, page:'china', stream:'static', post_date:d, day:dayNames[new Date(d).getDay()], pillar:p.pillar, segment:p.segment, format:p.format, destination:'China', note:p.note, slot_time:'13:30' }); });
dates.forEach((d,i) => { const p=bdPlan[i];    slots.push({ i:slots.length, page:'bd',    stream:'static', post_date:d, day:dayNames[new Date(d).getDay()], pillar:p.pillar, format:p.format, destination:p.destination, note:p.note, slot_time:'21:00' }); });
// 3 videos spread across the week (Sun, Wed, Fri).
[1,4,6].forEach((di,k) => { const d=dates[di]; const v=videoPlan[k]; if(!v) return; slots.push({ i:slots.length, page:'tiktok', stream:'video', post_date:d, day:dayNames[new Date(d).getDay()], pillar:v.pillar, format:'Reel', destination:v.destination, note:v.topic, slot_time:'20:00' }); });

// Build CRM facts text
const facts = (scholarships||[]).map(s => '- ' + s.name + ' (' + s.country + '): ' + s.coverage + '. Deadline: ' + s.deadline + '. Source: ' + s.source_url).join('\n') || '(CRM scholarship table empty — use UNI_FACTS + GENERAL_FACTS, verify before publishing.)';
const unis  = (universities||[]).map(u => '- ' + u.name + ' (' + (u.city||'') + '): ' + (u.tuition||'') + (u.programs ? '. Majors: ' + String(u.programs).slice(0,80) : '')).join('\n') || '(CRM university table empty — use the real unis in UNI_FACTS.)';

const TEMPLATES = 'RealNumbersCarousel | DeadlineCountdown | StudentTestimonialCard | DocChecklist | CostComparisonCarousel | UniversitySpotlightCard | ReelEndCard';

/* ===================== THE PROMPT (built per batch of slots) ===================== */
function buildPrompt(slotSet) { return (
'You are the senior social media manager for EduExpress International — a trusted Bangladesh study-abroad consultancy in ' + BRAND.office + '. ' +
BRAND.years + ' years, ' + BRAND.students + ' students placed, ' + BRAND.partners + ' university partners, ' + BRAND.visa + ' visa success. FLAGSHIP = CHINA (Bachelor, MBBS, university scholarships; sometimes CSC Type B). Korea, UK, Hungary, Malta, Croatia, Cyprus, Azerbaijan, Georgia = self-paid study options.\n\n' +

'POSITIONING: "The China, Korea & Europe specialists who show you the REAL numbers." Win on transparency + specialization, not on shouting.\n\n' +

'### ANTI-GENERIC GUARDRAIL (this is why old output failed)\n' +
'Every BD rival says the SAME four things — "free counselling", "X% visa success", "partnered with N universities", "expert guidance". These are table-stakes, NEVER hooks. NEVER open with them. Line one of every post MUST contain a specific number, a real student, a real deadline, or a real university name. If a draft could belong to any random consultancy, rewrite it.\n\n' +

'### COMPETITOR COUNTER-POSITIONING (never name rivals)\n' +
'Rivals copy our angles ("no fee if rejected", aggressive pricing). Out-position them with what they cannot match credibly: PAYMENT AFTER VISA APPROVAL, admission WITHOUT the CSCA exam, No IELTS (MOI/EFSET/Duolingo), and exact transparent fees from the real university list. Show the actual CNY numbers — rivals stay vague; we do not.\n\n' +

'### LIVE CAMPAIGN — "BACHELOR 2026: LAST CALL (WITHOUT CSCA)"\n' +
'Many students wrongly believe "no CSCA = no China." WRONG. The partner universities below admit on HSC GPA alone, English via IELTS/Duolingo/MOI/EFSET, Payment After Visa. Deadlines cluster around 30 June 2026 (it is now mid-June 2026 — push REAL urgency: "হাতে আর মাত্র কয়েকদিন"). China-page Last Call + Scholarship + Cost slots should lead with this. Always tell readers to verify the exact current deadline.\n\n' +

'### BRAND VOICE\n' +
'A knowledgeable boro bhai/apu who has done this — warm, direct, proof-driven, never salesy, never robotic. Real students, real faces, real numbers.\n\n' +

'### REAL VOICE EXAMPLES (ACTUAL EduExpress posts — match this STYLE, do not copy verbatim)\n' +
'1) "বিদেশে পড়ার স্বপ্ন আছে, কিন্তু এই বাধাগুলো থামিয়ে দিচ্ছে? 🚨\n❌ লক্ষ টাকা টিউশন ফি\n❌ IELTS টেনশন\n❌ ভিসার আগেই কনসালটেনসি ফি\n❌ Visa rejection-এর ভয়\nGood news! 💡 চায়নায় এসব সমস্যা নেই 🇨🇳\n✨ ১০০% টিউশন + হোস্টেল ফ্রি\n✨ Visa Approval-এর পরেই পেমেন্ট\n✨ No IELTS Required\n✨ মাসিক স্টাইপেন্ড ৳১০,০০০–৳৬০,০০০\n✨ Diploma থেকে PhD"\n' +
'2) "🎓 CSCA স্কোর ভিত্তিক স্কলারশিপ পলিসি ... 📌 Chongqing Jiaotong University-এর নমুনা ... ⭐ ৯০+ → First-Class ⭐ ৮০+ → Second-Class ⭐ ৬০+ → Third-Class"\n' +
'3) "কোনো দেশে ভিসা পাননি বা রিফিউজড হয়েছেন? ভাবছেন আপনার একটি বছর নষ্ট হয়ে গেল?"\n' +
'PATTERN: empathetic Bangla pain-point question -> "Good news!/সমাধান" pivot -> ✨ benefit list with REAL numbers -> simple CTA. English keywords inline in Bangla (China, Bachelor, CSCA, No IELTS, MOI, Payment After Visa, university names).\n\n' +

'### AUDIENCE\n' +
'Primary = parents 35-55 (ROI, safety, prestige, visa success, testimonials). Secondary = students 17-24 (MBBS/Engineering/CS/Business, scholarships, campus life, peer proof). Speak to both.\n\n' +

'### LANGUAGE RULES\n' +
'- Natural Banglish, code-switch within sentences like real BD study-abroad pages. Not pure Bangla, not pure English. Never machine-translation.\n' +
'- Vary the blend across the week. Keep proper nouns, scholarship & university names, and ALL figures in English.\n' +
'- NEVER print internal labels ("pillar", "Real Numbers", "Last Call", "statement") in a caption.\n\n' +

'### HARD RULES\n' +
'- Use ONLY verified facts (CRM first, then UNI_FACTS/GENERAL_FACTS) for any number, fee, deadline, university, scholarship. NEVER invent figures, dates, student names or testimonials. For Student/Visa stories use [student name] + [university] placeholders and tell the designer to use a REAL alumni photo from /Student Assets/.\n' +
'- End every post with a lead CTA that ROTATES across these offers (not generic "free counselling"): ' + OFFERS.join(' / ') + ' — via WhatsApp/Call ' + BRAND.phone + ' (' + BRAND.wa + '), ' + BRAND.office + '. No other numbers.\n' +
'- Never promise/guarantee a visa or admission. "' + BRAND.visa + ' visa success" = past record.\n' +
'- Vary hook, structure, emoji across the week. Correct Bangla (e.g. "' + BRAND.visa + ' ভিসা সাফল্যের হার").\n\n' +

'### SEASON & TRUTH RULES (current month=' + month + ', phase=' + PHASE + ')\n' +
'- EduExpress has REAL student success/experience for CHINA ONLY. For EVERY non-China destination (South Korea, Hungary, Malta, Croatia, Cyprus, Azerbaijan, Germany, Georgia, UK): NEVER claim or imply student success, visa approvals, alumni, or "students we sent", AND never mention government scholarships (these are SELF-PAID, except Cyprus which is an employer-funded Study & Work model). Those = INFORMATIONAL only (real self-paid cost, how-to, destination info, "applications now open"), framed as OPPORTUNITY — never track record.\n' +
'- CONTENT MIX target: ~50% China (china page) / ~45% self-paid Others (bd page) / ~5% Trust. China = university scholarships (NOT govt CSC) + self-paid MBBS.\n' +
'- Any Student Story / Visa Success / testimonial = CHINA only.\n' +
(PHASE === 'ADMISSION'
  ? '- ADMISSION season (Jun–Jul): China success = ADMISSION / scholarship / pre-admission wins ONLY. Do NOT post visa-approval success yet.\n'
  : PHASE === 'VISA'
  ? '- VISA season (Aug+): China visa-approval success of the CURRENT year is now available — use it.\n'
  : '- Use China admission/scholarship proof; avoid time-specific visa claims unless verified.\n') +

'### HOOK VARIETY (fixes boring/repetitive openings)\n' +
'Rotate hook TYPES across the week — no two posts in the same batch may open the same way. Pull from: (a) empathetic pain-point question ("ভিসা রিফিউজড? বছরটা নষ্ট ভাবছেন?"); (b) shocking real number ("চীনে Bachelor — Year 1 টিউশন ০ টাকা।"); (c) myth-bust ("CSCA নাই? তাও চীনে Bachelor হয়।"); (d) countdown/urgency ("৩০ জুন শেষ — সিট সীমিত।"); (e) mini-story ("৬ মাস আগে [student] টেনশনে ছিল। আজ admission letter হাতে।"); (f) direct challenge ("লাখ টাকা গুনছেন প্রাইভেটে? দাঁড়ান।"). First line must hit in under 8 words.\n' +
'### NATURAL BANGLISH (fixes machine-feel)\n' +
'Write like a real Dhaka study-abroad page admin texting a student — use natural particles (তো, কিন্তু, না?, একটু), contractions, and inline English the way people actually speak (admission, scholarship, intake, visa, seat). NEVER translate English→Bangla literally. Read it aloud test: if a Bangladeshi 20-year-old wouldn\'t say it, rewrite it. Vary sentence length; short punchy lines beat long formal ones.\n\n' +

RESEARCH_CONTEXT + '\n\n' +

CREATIVE_GUIDE + '\n\n' +

'### CRM SCHOLARSHIP FACTS:\n' + facts + '\n\n### CRM UNIVERSITIES:\n' + unis + '\n\n' +
'### REAL UNIVERSITY FACTS — Bachelor 2026 Without CSCA (use exact CNY numbers):\n' + UNI_FACTS + '\n\n' +
'### GENERAL VERIFIED FACTS:\n' + GENERAL_FACTS + '\n\n' +

'### CREATIVE & VIDEO MAPPING (return a "creative" object per slot)\n' +
'- stream="static": creative.type="static"; creative.template from [' + TEMPLATES + ']; creative.brief = bold Bangla headline as text-on-image with the key WORD/NUMBER in RED, the model/photo, a badge (Apply Now / Admission Open 2026 / Without CSCA / Last Call), and footer bar "EduExpress International | ' + BRAND.office + ' | Contact for Your Seat ' + BRAND.phone + '"; for carousels list each slide. creative.asset_hint = folder/asset to pull.\n' +
'- stream="video" (TikTok + Reels, Bangla on-camera): creative.type="video"; creative.template="ReelEndCard"; creative.shotlist = array of timed beats "MM:SS-MM:SS — on-screen + spoken" covering HOOK (0-3s), BODY, PROOF (acceptance letter/visa page/dorm b-roll), CTA; creative.on_screen_text = burned-in text; creative.asset_hint = "shoot on phone with [consultant/student]" or "/Student Assets/ alumni clip".\n\n' +

'### OUTPUT — ONLY a JSON array of ' + slotSet.length + ' objects IN ORDER, each EXACTLY:\n' +
'{"i":<slot i>,"format":"Carousel|Reel|Single image|Infographic|TikTok","hook":"","body":"","hashtags":"","creative":{"type":"static|video","template":"","brief":"","shotlist":[],"on_screen_text":"","asset_hint":""}}\n' +
'"china" page = China only (use UNI_FACTS real unis + figures). "bd" page = use slot destination + that country facts. "tiktok" = short Bangla on-camera video. hashtags 4-7 (mix EN+BN incl #StudyInChina #MBBSinChina #CSCScholarship #EduExpressBD where relevant), no spam. Use each slot\'s "note" as the angle, and for china slots the "segment" tells you which product to write about (Diploma / University-Scholarship Bachelor / Partial / MBBS-self-paid / Masters). COPY the slot\'s assigned "format" into your output.format EXACTLY — do not change it (the week is deliberately mixed). Keep fields tight to avoid truncation. No markdown, no commentary.\n\n' +

'### HOOK INTEGRATION RULE\n' +
'If a winning hook exists in the WINNING HOOKS list above, ROTATE it in naturally. Do NOT force-fit — match the hook type to the slot segment (e.g., use a pain-point hook for Cost Breakdown, a myth-bust for Last Call, a number hook for Scholarship Alert).\n\n' +

'SLOTS:\n' + JSON.stringify(slotSet.map(s => ({ i:s.i, page:s.page, stream:s.stream, format:s.format, date:s.post_date, day:s.day, pillar:s.pillar, segment:s.segment||'', destination:s.destination, note:s.note })))
); }

/* ===================== INFRA (unchanged) ===================== */
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
function safeBody(e) { try { return JSON.stringify((e && e.response && e.response.body) || (e && e.error) || (e && e.cause) || ''); } catch (_) { return ''; } }
function detail(e) { const b = safeBody(e); return (String((e && e.message) || e) + (b && b !== '""' ? ' :: ' + b : '')).slice(0, 220); }
function is429(e) { return /(\b429\b|too many requests|rate|exhaust|quota|resource_exhausted)/i.test(String((e && e.message) || '') + ' ' + safeBody(e)); }

async function callGemini(model, key, prompt) {
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + key;
  const j = await doHttp({ method:'POST', url, headers:{'Content-Type':'application/json'}, body:{ contents:[{ parts:[{ text: prompt }]}], generationConfig:{ temperature:0.85, maxOutputTokens:8192, responseMimeType:'application/json' } }, json:true });
  const cand = j && j.candidates && j.candidates[0];
  const txt = (cand && cand.content && cand.content.parts && cand.content.parts.map(function(p){ return p.text || ''; }).join('')) || '';
  if (!txt) throw new Error('empty Gemini output (finishReason=' + ((cand && cand.finishReason) || 'none') + ')');
  return txt;
}
async function callOpenAICompat(provider, model, key, prompt, baseOverride) {
  const bases = { groq:'https://api.groq.com/openai/v1', mistral:'https://api.mistral.ai/v1', openrouter:'https://openrouter.ai/api/v1', together:'https://api.together.xyz/v1', cerebras:'https://api.cerebras.ai/v1', openai:'https://api.openai.com/v1', opencode:'https://opencode.ai/zen/v1', 'opencode-go':'https://opencode.ai/zen/go/v1' };
  const base = baseOverride || bases[provider] || bases.openai;
  const j = await doHttp({ method:'POST', url: base + '/chat/completions', headers:{'Content-Type':'application/json','Authorization':'Bearer ' + key}, body:{ model: model, messages:[{ role:'user', content: prompt }], temperature:0.85, max_tokens:8000 }, json:true });
  return (j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '';
}

// ⬇⬇⬇  PASTE YOUR API KEYS HERE (one per line, in quotes). They stay inside n8n.  ⬇⬇⬇
const KEYS = [
  // { key:'YOUR-OPENCODE-KEY-HERE', provider:'opencode-go', model:'glm-5.1' },
  // 'AIzaSy...your-first-gemini-key',
  // 'AIzaSy...your-second-gemini-key',
  // { key:'sk-...', provider:'opencode', model:'deepseek-v4-flash-free' }, // Free Zen fallback
];
// ⬆⬆⬆  (paste all your keys above)  ⬆⬆⬆
if (KEYS.length === 0) throw new Error('No API keys set. Paste your Gemini/OpenCode keys into the KEYS array in this node.');

function providerFor(key) {
  if (/^AIza/.test(key))   return { provider:'gemini',     model:'gemini-2.0-flash' };
  if (/^AQ\./.test(key))   return { provider:'gemini',     model:'gemini-2.0-flash' };
  if (/^gsk_/.test(key))   return { provider:'groq',       model:'llama-3.3-70b-versatile' };
  if (/^sk-or-/.test(key)) return { provider:'openrouter', model:'meta-llama/llama-3.1-8b-instruct' };
  if (/^sk-/.test(key))    return { provider:'openai',     model:'gpt-4o-mini' };
  return { provider:'gemini', model:'gemini-2.0-flash' };
}

const GEMINI_MODELS = ['gemini-2.0-flash', 'gemini-2.0-flash-lite'];
const ENTRIES = KEYS.map(e => {
  if (typeof e === 'string') { const d = providerFor(e); return { key:e, provider:d.provider, model:d.model, base:null }; }
  const d = providerFor(e.key || ''); return { key:e.key, provider:e.provider || d.provider, model:e.model || d.model, base:e.base || null };
});
function prio(p){ return p === 'opencode-go' ? 0 : p === 'opencode' ? 1 : 9; }
ENTRIES.sort((a, b) => prio(a.provider) - prio(b.provider));
const errors = [];

function parseArr(t) {
  var FENCE = String.fromCharCode(96,96,96), Q = String.fromCharCode(34), BS = String.fromCharCode(92);
  let s = String(t).trim().split(FENCE).join('').trim();
  if (s.slice(0,4).toLowerCase() === 'json') s = s.slice(4).trim();
  const a = s.indexOf('['); if (a >= 0) s = s.slice(a);
  const b = s.lastIndexOf(']'); const core = (b > 0) ? s.slice(0, b+1) : s;
  try { return JSON.parse(core); } catch (e) {}
  const objs = []; let depth = 0, st = -1, inStr = false, esc = false;
  for (let k = 0; k < s.length; k++) { const c = s[k];
    if (inStr) { if (esc) esc = false; else if (c === BS) esc = true; else if (c === Q) inStr = false; continue; }
    if (c === Q) { inStr = true; continue; }
    if (c === '{') { if (depth === 0) st = k; depth++; }
    else if (c === '}') { depth--; if (depth === 0 && st >= 0) { try { objs.push(JSON.parse(s.slice(st, k+1))); } catch (_) {} st = -1; } } }
  if (objs.length) return objs;
  throw new Error('no JSON array or complete objects found');
}

async function genBatch(slotSet, tag) {
  const p = buildPrompt(slotSet);
  for (let pass = 0; pass < 2; pass++) {
    if (pass > 0) await sleep(6000);
    for (let idx = 0; idx < ENTRIES.length; idx++) {
      const ent = ENTRIES[idx];
      if (ent.provider === 'gemini') {
        const models = ent.model ? [ent.model] : GEMINI_MODELS;
        for (let m = 0; m < models.length; m++) {
          try { return { raw: await callGemini(models[m], ent.key, p), model: models[m] }; }
          catch (e) { errors.push(tag + ' ' + models[m] + ': ' + detail(e)); if (!is429(e)) break; }
        }
      } else {
        try { return { raw: await callOpenAICompat(ent.provider, ent.model, ent.key, p, ent.base), model: ent.provider + ':' + ent.model }; }
        catch (e) {
          errors.push(tag + ' ' + ent.provider + ':' + ent.model + ' ' + detail(e));
          if (is429(e) && (ent.provider === 'opencode-go' || ent.provider === 'opencode')) {
            await sleep(10000);
            try { return { raw: await callOpenAICompat(ent.provider, ent.model, ent.key, p, ent.base), model: ent.provider + ':' + ent.model + ' (retry)' }; }
            catch (e2) { errors.push(tag + ' ' + ent.provider + ' retry: ' + detail(e2)); }
          }
        }
      }
    }
  }
  throw new Error(tag + ' failed on all keys');
}

const BATCH = 6;
const batches = [];
for (let b = 0; b < slots.length; b += BATCH) batches.push(slots.slice(b, b + BATCH));
const settled = [];
for (let bi = 0; bi < batches.length; bi++) {
  if (bi > 0) await sleep(2000);
  settled.push(await genBatch(batches[bi], 'batch' + (bi + 1)).catch(e => ({ error: (e && e.message) || String(e) })));
}

const byI = {}; const usedModels = [];
settled.forEach(s => {
  if (s && s.raw) { usedModels.push(s.model); let arr = []; try { arr = parseArr(s.raw); } catch (_) {} for (const g of arr) if (g && g.i != null) byI[g.i] = g; }
  else if (s && s.error) errors.push(s.error);
});
if (Object.keys(byI).length === 0) {
  const oc = errors.filter(x => /opencode/.test(x)).slice(-3);
  throw new Error('All batches failed. OpenCode errors: ' + (oc.join(' | ') || 'none') + ' :: recent: ' + errors.slice(-4).join(' | '));
}

function buildBrief(g, s) {
  const c = (g && g.creative) || {};
  const L = [];
  if (s.stream === 'video' || c.type === 'video') {
    L.push('🎬 VIDEO (TikTok + Reel) — Bangla on-camera. Template: ' + (c.template || 'ReelEndCard'));
    const shots = Array.isArray(c.shotlist) ? c.shotlist : [];
    if (shots.length) { L.push('SHOT LIST:'); shots.forEach(x => L.push('  • ' + x)); }
    if (c.on_screen_text) L.push('ON-SCREEN TEXT: ' + c.on_screen_text);
    L.push('END CARD: logo + ' + BRAND.students + ' students · ' + BRAND.visa + ' visa success');
    L.push('ASSET: ' + (c.asset_hint || 'shoot on phone / pull alumni clip from /Student Assets/'));
  } else {
    L.push('🖼 STATIC. Template: ' + (c.template || 'RealNumbersCarousel'));
    if (c.brief) L.push(c.brief);
    L.push('BADGES: Apply Now / Admission Open 2026 / Without CSCA / Last Call (pick what fits)');
    L.push('FOOTER BAR: EduExpress International | ' + BRAND.office + ' | Contact for Your Seat ' + BRAND.phone);
    L.push('ASSET: ' + (c.asset_hint || '/Templates/ + /Student Assets/'));
  }
  return L.join('\n');
}

const posts = slots.map(s => { const g = byI[s.i] || {}; return {
  post_date: s.post_date, slot_time: s.slot_time, page: s.page, pillar: s.pillar,
  format: g.format || s.format || (s.stream === 'video' ? 'Reel' : ''),
  hook: g.hook || '', body: g.body || '', hashtags: g.hashtags || '',
  brief: buildBrief(g, s), asset_url: '', status: 'drafted'
};});

const res = await jpost('plan/import', { week, posts });
return [{ json: {
  ok:true, week, slots: slots.length, generated: Object.keys(byI).length, imported: (res && res.inserted),
  batches: batches.length, used_models: usedModels, key_errors: errors.slice(-8),
  research_loaded: (researchIntel||[]).length, viral_loaded: (viralTopics||[]).length, hooks_loaded: (winnerHooks||[]).length, psych_loaded: (psychology||[]).length,
  kpis_to_watch: ['CPL (cost per lead)','Lead Verification Rate','Enrolled-Student Conversion','Engagement','Reach','Hook Performance','Content Consistency']
} }];
