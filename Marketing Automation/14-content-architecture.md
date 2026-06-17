# EduExpress — Content & Automation Architecture

*Designed from: the Content & Script doc, the Europe doc, the China brochures, the live FB page, and the v3 planner. This is the master blueprint that ties everything together.*

---

## 0. What this solves
You have a **large multi-country portfolio**, a rich **script/caption library**, country **brochures**, and a weekly **auto-planner**. Without one source of truth, the AI goes generic or wrong. This architecture connects: your reference material (Drive) → structured facts (CRM) → weekly content (planner) → approval & publish.

---

## 1. Portfolio & Segmentation Map (the foundation everything reads from)

**CHINA — flagship (~60% of content)**
| Product | Who it's for | Scholarship vs Self-paid |
|---|---|---|
| Diploma (SSC entry → 2-yr Bachelor) | SSC pass / gap-year, lower-middle | Full scholarship |
| Bachelor — University Scholarship (full free + stipend) | Scholarship-oriented, lower-middle | Scholarship (CSCA-waiver options) |
| Bachelor — Partial Scholarship | Low GPA / study gap, vs BD private | Partial (no IELTS needed) |
| Bachelor — Top-Ranked / MBBS / Aerospace | Upper-middle, good profile | **Self-paid** |
| Masters (full funded + stipend, limited, April) | Good GPA | Scholarship (MOI) |

China angle: **Payment After Visa · No IELTS (MOI/Duolingo) · English-medium · admission without CSCA · honest "real numbers"** (your newest "reality-based" scripts — de-hype CSC).

**SOUTH KOREA — secondary** (self-paid): EAP (no IELTS) · Bachelor Regional Visa (K-culture, Electrical/Mechanical) · Masters E-Visa (no IELTS / study-gap ok).

**EUROPE & OTHERS — self-paid, opportunity framing, NO alumni claims yet**
| Country | Key facts | Service charge |
|---|---|---|
| Hungary | Schengen, MOI, ~€5,600+, Debrecen/Wekerle/Gyor | 1,20,000 |
| Malta | Schengen, no IELTS, €6,500–8,000, bank 30L | 1,20,000 |
| Croatia | Schengen, IELTS 5/MOI, €2,300–3,000, deadline 31 May 2026 | 1,20,000 |
| Cyprus | Mesoyios **Study & Work** (employer-funded from month 7, hotel mgmt/BBA, save ~€15k) | — |
| Germany via China | Pathway: China first → Germany, skips 29-month wait | China 2,00,000 |
| Azerbaijan | No IELTS, no bank statement, payment after visa, credit-transfer to EU/USA | pkg 4,99,000 |
| Georgia | No IELTS, study gap ok | — |
| UK | Document-heavy, premium | — |

**HARD RULE:** real student **success stories = CHINA only** (Jun–Jul = admission wins; Aug+ = visa success). Every other country = process/opportunity, never "our students/alumni."

---

## 2. Three-layer architecture

```
LAYER 1 — KNOWLEDGE (Google Drive "Content Brain")   ← you edit this
        reference docs, brochures, scripts, best posts
                     │  (Brain Ingest workflow, weekly)
                     ▼
LAYER 2 — STRUCTURED FACTS (CRM kb_* + voice_examples + competitor_intel)
        condensed, queryable truth
                     │  (planner reads)
                     ▼
LAYER 3 — GENERATION (n8n weekly planner)
        segment- & destination-aware drafts → CRM Approvals → publish (FB/IG/TikTok) → metrics back
```

You only ever maintain **Layer 1**. Everything downstream updates itself.

---

## 3. Drive "Content Brain" — final structure
```
EduExpress Content Brain/
  ★ ARCHITECTURE (this doc)
  00_Positioning & Voice/
       Master Positioning & Segments
       Voice Guide
       Locked Stats        ← single source of truth for the numbers
  01_Destinations/
       China/        (= your University Brochures: sheets, MBBS, diploma)
       South Korea/  (EAP, E-Visa)
       Europe/       (Hungary, Malta, Croatia, Cyprus, Germany-via-China)
       Others/       (Azerbaijan, Georgia, UK)
  02_Poster Copy/   (approved headlines, taglines, "No Visa No Payment" blocks)
  03_Scripts/       (Khaled 1–17 + Reality-based scripts)
  04_Past Posts (best)/  (winning captions + the Tanveer testimonial)
  05_Notices & Deadlines/ (live intakes/deadlines)
  06_Content Calendar/   (your day-by-day reference plan, Nov–Mar)
```

---

## 4. Positioning rules the model must obey
- China = **university scholarships** (+ CSC Type B sometimes). **De-hype CSC**; lead with honest "reality-based" angle (matches your newest scripts).
- **Self-paid** for: China top-ranked/MBBS/aerospace + **all** Korea/Europe/Others.
- Differentiators: Payment After Visa · No IELTS · admission without CSCA · transparent fees · **no file-opening charge** · end-to-end support.
- **Banned hooks:** generic "free counselling / X% success / N partners / expert guidance."
- Success/testimonials = China only.
- Offers rotate: Free Profile Assessment / Scholarship Eligibility Check / Personalized University Shortlist.
- Voice: real Dhaka boro-bhai Banglish; rotate hook types; honest, not over-promising.

---

## 5. Recommended content mix (per week, across both pages)
- **China 60%** (lead engine) · **Korea 15%** · **Europe/Others 20%** · **Trust/BTS 5%**
- Video **2–3/week**, China-focused.
- **Page split:** *China page* = China only. *BD page* (EduExpress International – Bangladesh) = Korea + Europe + Others + cross-promote China.

---

## 6. ✅ Decisions — LOCKED (2026-06-14)
1. **STATS (canonical, use everywhere; purge the rest):** **98% visa · 8 yrs · 2,000+ students · 150+ partners.** Update the website if it still shows 99%/7yr/5,000+/$5M/100+.
2. **STIPEND:** "Tk 10,000–60,000 per month depending on scholarship class."
3. **CSC framing:** honest / university-scholarship / don't-chase-CSC is canonical.
4. **Content mix (weekly):** **50% China · 45% Others (Korea + Europe + Azerbaijan/Georgia/UK) · 5% Trust.** "Others" is now ~half of all content — rotate across all self-paid destinations.
5. **Pages:** China page = China only; BD page = Korea + Europe + Others + cross-promote China.

---

## 7. Build order (next)
1. **Lock the decisions above** (Section 6).
2. **Brain Ingest workflow** (Drive → CRM facts + voice examples).
3. **Upgrade planner** to multi-destination / multi-segment (currently China+BD only).
4. **Competitor Ad Library research** (your 15-page list) → angles + competitor_intel.
5. **Self-critique pass** for quality.
