# EduExpress Quality Gate Configuration
# Version 2.0 — Social Media Engine
# Auto-enforced by n8n Quality Gate workflow + Frontend Content Factory

---

## 1. BANNED WORDS & PHRASES

### 🔴 CRITICAL — Auto-Reject (Score = 0, Block Publication)

These trigger immediate rejection and alert the admin. Using them risks legal action, regulatory fines, or permanent brand damage.

| # | Banned Phrase | Why Banned | Severity |
|---|---|---|---|
| 1 | "guaranteed visa" | Illegal promise. No visa can be guaranteed. Bangladesh govt can blacklist. | CRITICAL |
| 2 | "100% visa success" | Misleading. Past record ≠ future promise. Violates advertising standards. | CRITICAL |
| 3 | "100% admission" | False promise. No university guarantees admission. | CRITICAL |
| 4 | "guaranteed admission" | Illegal. No admission is guaranteed. | CRITICAL |
| 5 | "visa confirmed" | Cannot confirm before embassy decision. | CRITICAL |
| 6 | "no rejection" | False. All consultancies have rejections. | CRITICAL |
| 7 | "zero rejection" | Same as above. | CRITICAL |
| 8 | "government registered" | Without BECA/Govt registration number. Must prove with doc. | CRITICAL |
| 9 | "licensed by government" | Same as above. Must show license. | CRITICAL |
| 10 | "official representative of [University]" | Only true if you have MOU. Must be verifiable. | CRITICAL |
| 11 | "authorized agent of [Country]" | False unless officially appointed. | CRITICAL |
| 12 | "best consultancy in Bangladesh" | Unverifiable superlative. Banned by ASCI. | CRITICAL |
| 13 | "No. 1 consultancy" | Unverifiable claim. | CRITICAL |
| 14 | "100% scholarship guaranteed" | Scholarships are competitive. No guarantee. | CRITICAL |
| 15 | "free education" | Misleading. Even scholarship students pay application/service fees. | CRITICAL |
| 16 | "no cost at all" | False. Travel, medical, visa fees always exist. | CRITICAL |
| 17 | Fake student names | Must use [Student Name] placeholder or real names with consent. | CRITICAL |
| 18 | Fake university names | Must match kb_universities exactly. | CRITICAL |
| 19 | Fake deadlines | Must match kb_scholarships or official sources. | CRITICAL |
| 20 | Fake stipend figures | Must match official university scholarship terms. | CRITICAL |

### 🟠 HIGH — Major Penalty (Score -30, Flag for Review)

| # | Banned Phrase | Why Banned | Penalty |
|---|---|---|---|
| 21 | "CSC scholarship" (Type A/Govt) | We only market university scholarships + CSC Type B. | -30 |
| 22 | "GKS scholarship" / "Korean Government Scholarship" | We don't place GKS students. | -30 |
| 23 | "Stipendium Hungaricum" | We don't place through this program. | -30 |
| 24 | "Turkiye Burslari" | We don't place through this program. | -30 |
| 25 | Success story for Korea/Europe/UK | Alumni claims only valid for China. | -30 |
| 26 | "our students in Korea" / "our alumni in Hungary" | No verified Korea/Europe alumni yet. | -30 |
| 27 | "visa success for Korea" / "visa success for Europe" | No track record for non-China. | -30 |
| 28 | "Korean visa approved" (as "our" student) | Only China visa wins are "ours". | -30 |
| 29 | "No IELTS" without specifying MOI/EFSET/Duolingo | Misleading. Universities require English proof. | -30 |
| 30 | "No CSCA required" without university list | Must specify which universities. | -30 |
| 31 | "Payment After Visa" without qualifying conditions | Must specify "subject to documentation" etc. | -30 |
| 32 | "No file opening charge" if it's not true | Must match actual policy. | -30 |
| 33 | "free counselling" as a hook | Table stakes, not a differentiator. | -30 |
| 34 | "expert guidance" as a hook | Generic, sounds like every other agency. | -30 |
| 35 | "partnered with 500+ universities" | Unverifiable. Use 150+ partners (canonical). | -30 |
| 36 | "5000+ students" | Canonical is 2,000+. Never inflate. | -30 |
| 37 | "99% visa success" | Canonical is 98%. | -30 |
| 38 | "7 years" (if current is 8+) | Canonical is 8+ years. Keep updated. | -30 |
| 39 | "$5M revenue" | Never mention revenue figures. | -30 |
| 40 | Stock photos presented as real students | Must use real student photos with consent. | -30 |
| 41 | Fake university logos on graphics | Must have permission to use logos. | -30 |
| 42 | University rankings without source | Must cite QS/THE/ARWU year. | -30 |
| 43 | "Study in China for free" | Only tuition-free. Living costs exist. | -30 |
| 44 | "All expenses covered" | Rarely true. Usually stipend only. | -30 |
| 45 | Specific stipend without range | Must use "Tk 10,000-60,000/month" range. | -30 |

### 🟡 MEDIUM — Minor Penalty (Score -10, Suggest Fix)

| # | Banned Phrase | Why Banned | Penalty |
|---|---|---|---|
| 46 | "Apply now and get visa in 7 days" | Visa timelines vary. Don't promise specific days. | -10 |
| 47 | "Last chance" without real deadline | Creates false urgency. | -10 |
| 48 | "Only 2 seats left" without evidence | False scarcity. | -10 |
| 49 | "Limited time offer" without end date | Must specify deadline. | -10 |
| 50 | "Everyone is going to China" | Bandwagon fallacy. | -10 |
| 51 | "Your friends are already there" | Peer pressure, unethical. | -10 |
| 52 | "Don't waste your life in Bangladesh" | Negative framing, offensive. | -10 |
| 53 | "Bangladesh has no future" | Offensive, politically sensitive. | -10 |
| 54 | Comparing with specific competitors by name | Can trigger defamation. | -10 |
| 55 | "Other agencies are frauds" | Defamation risk. | -10 |
| 56 | "We are the only honest agency" | Unverifiable, arrogant. | -10 |
| 57 | Religious references in scholarship posts | Inappropriate for education marketing. | -10 |
| 58 | Political references in posts | Avoid politics entirely. | -10 |
| 59 | "Rich people send kids abroad" | Classist, offensive. | -10 |
| 60 | "Poor people can't study abroad" | False, offensive. | -10 |
| 61 | Misleading before/after photos | Must be genuine, same person. | -10 |
| 62 | "DM for price" — always | Must show transparent pricing when possible. | -10 |
| 63 | "Price is too low to mention" | Must be transparent about service fees. | -10 |
| 64 | Clickbait: "You won't believe..." | Lowers brand quality. | -10 |
| 65 | "This is shocking" without substance | Clickbait. | -10 |
| 66 | ALL CAPS headlines (more than 3 words) | Looks like spam/MLM. | -10 |
| 67 | Excessive emojis (more than 5) | Looks unprofessional. | -10 |
| 68 | Exclamation marks (more than 3 in a row) | Looks desperate. | -10 |
| 69 | "Comment YES below" | Engagement bait, algorithm penalty. | -10 |
| 70 | "Share this to 5 friends" | Engagement bait. | -10 |

---

## 2. REQUIRED FACT-CHECKS

### Scholarship Posts (Must Pass All)

| Check | How | Source |
|---|---|---|
| University name exists | Match against `kb_universities` table | CRM Data Center |
| Scholarship name exists | Match against `kb_scholarships` table | CRM Data Center |
| Deadline is current | Check `kb_scholarships.deadline` >= today | CRM Data Center |
| Stipend figure matches | Use "Tk 10,000-60,000/month" range only | Canonical stats |
| Tuition coverage accurate | Match `kb_scholarships.coverage` | CRM Data Center |
| Eligibility criteria correct | Match `kb_scholarships.eligibility` | CRM Data Center |
| CSCA requirement stated | Verify against university's actual requirement | Official sources |
| IELTS requirement stated | Verify MOI/EFSET/Duolingo accepted | Official sources |
| Service charge disclosed | Match rates in content architecture doc | Internal doc |
| Intake term correct | Match `kb_universities.intakes` | CRM Data Center |

### University Spotlight Posts (Must Pass All)

| Check | How | Source |
|---|---|---|
| University name correct | Exact match `kb_universities.name` | CRM Data Center |
| City correct | Match `kb_universities.city` | CRM Data Center |
| Programs listed exist | Match `kb_universities.programs` | CRM Data Center |
| Rankings cited with source | QS/THE/ARWU + year | Official ranking |
| Tuition figures accurate | Match `kb_universities.tuition` | CRM Data Center |
| Language requirement correct | Match `kb_universities.lang_req` | CRM Data Center |
| Admission URL works | Link validation | Live check |
| Partner status correct | Match `kb_universities.partner` | CRM Data Center |

### Cost Breakdown Posts (Must Pass All)

| Check | How | Source |
|---|---|---|
| Tuition in CNY accurate | Match `kb_universities.tuition` | CRM Data Center |
| BDT conversion rate current | Use latest exchange rate | Google/official |
| Living cost realistic | China: ~Tk 15,000-25,000/month | Market research |
| Stipend range correct | "Tk 10,000-60,000/month" | Canonical |
| Service charge disclosed | Match architecture doc rates | Internal doc |
| Hidden fees mentioned | Application, medical, travel, visa | Standard practice |
| Comparison fair | Compare with BD private uni costs | Market research |

### Visa Success Posts (Must Pass All — Seasonal)

| Check | How | Source |
|---|---|---|
| Season correct | June-July = admission wins, Aug+ = visa success | Season rules |
| Country is China only | Never claim visa success for Korea/Europe | Hard rule |
| Student photo has consent | Signed release form | Student Assets |
| Student name is real | Match CRM student records | CRM |
| Visa photo is authentic | Real visa, not template | Verification |
| 98% claim is past record | "Our track record: 98% visa success" | Canonical |
| No future guarantee | Never say "you will get visa" | Truth rule |

---

## 3. REQUIRED DISCLAIMERS & QUALIFIERS

### For "Payment After Visa" Posts
```
✅ CORRECT: "Payment After Visa — you pay our service fee only after your visa is approved."
✅ CORRECT: "Pay after visa: Subject to complete documentation submission."
❌ WRONG: "Pay after visa — 100% guaranteed."
❌ WRONG: "No payment until visa — no conditions."
```

### For "98% Visa Success" Posts
```
✅ CORRECT: "Track record: 98% of our students received visas in the last 8 years."
✅ CORRECT: "Historical visa success rate: 98% (based on 2,000+ students)."
❌ WRONG: "98% visa success — you will get it too."
❌ WRONG: "Guaranteed 98% visa success."
```

### For Scholarship Posts
```
✅ CORRECT: "University scholarships available — coverage varies by program."
✅ CORRECT: "Full/partial scholarships based on merit and program availability."
❌ WRONG: "100% scholarship guaranteed for everyone."
❌ WRONG: "All students get full scholarships."
```

### For "No CSCA" Posts
```
✅ CORRECT: "These universities accept students without CSCA for Bachelor programs."
✅ CORRECT: "CSCA-free admission options available — see university list."
❌ WRONG: "No CSCA needed for any Chinese university."
❌ WRONG: "CSCA is completely abolished."
```

### For "No IELTS" Posts
```
✅ CORRECT: "No IELTS required — MOI (Medium of Instruction) certificate accepted."
✅ CORRECT: "English proficiency via MOI/EFSET/Duolingo — no IELTS needed."
❌ WRONG: "No English test required at all."
❌ WRONG: "No English needed for China."
```

### For Non-China Destinations (Korea, Europe, etc.)
```
✅ CORRECT: "South Korea — applications now open for self-funded study."
✅ CORRECT: "Hungary — explore your options with transparent cost breakdown."
❌ WRONG: "Our students are already in Korea!"
❌ WRONG: "Hungary visa success rate 95%!"
❌ WRONG: "Korean alumni share their experience."
```

---

## 4. LANGUAGE & TONE RULES

### Language Split (Enforced)
- **50% Bangla, 50% English** — no Banglish posts
- Each post must be in ONE language (either Bangla OR English, not mixed)
- Exception: Technical terms (CSCA, IELTS, MOI, admission, visa, scholarship) can remain in English inside Bangla posts
- Exception: Brand name "EduExpress" stays in English in Bangla posts

### Tone by Audience
| Audience | Tone | Language |
|---|---|---|
| Parents 35-55 | Formal, respectful, reassuring | Bangla (primary), English (secondary) |
| Students 18-24 | Friendly, direct, peer-to-peer | Bangla or English |
| TikTok/Gen Z | Energetic, fast-paced, authentic | Bangla or English |

### Platform-Specific Rules
| Platform | Max Hashtags | Caption Style | Video Rules |
|---|---|---|---|
| Facebook China | 3 | Detailed, parent-focused | 1-2 min max |
| Facebook BD | 3 | Mixed audience, detailed | 1-2 min max |
| Instagram | 10 | Reel caption, short | 30-60s, trending audio |
| TikTok | 5 | Punchy, text-overlay heavy | 15-60s, fast cuts |

---

## 5. IMAGE & ASSET RULES

### Design Requirements
| Rule | Enforcement |
|---|---|
| Real student photos only | No stock photos. Signed consent required. |
| Real visa documents | No templates. Authentic visa stamps only. |
| University logos with permission | Must have MOU or usage rights. |
| Brand colors consistent | Navy #1F4E79, Accent #2E75B6, China #C00000, BD #548235 |
| Bangla font renders correctly | Unicode Bangla, no broken characters. |
| No misleading before/after | Same person, real transformation. |
| No fake screenshots | No Photoshopped chat screenshots, DM proofs. |
| No competitor logos | Never use competitor branding. |
| Safe zones for Reels | Keep text away from bottom 15%, right side. |
| Resolution minimum | 1080x1080 (square), 1080x1350 (portrait), 1080x1920 (Reels/TikTok) |

### Asset Naming Convention
```
Format: W{week}_{page}_{day}_{pillar}_v{version}.{ext}
Example: W25_china_Mon_Scholarship_v1.png
```

---

## 6. SEASONAL RULES

| Season | Date Range | Content Focus | What NOT to Claim |
|---|---|---|---|
| Admission Season | June–July | Admission wins, scholarship alerts, university spotlights | No visa success claims |
| Visa Season | August–September | Visa success stories, pre-departure, welcome | No admission guarantees |
| CSCA Prep | May | CSCA exam prep, last-minute applications | No CSCA-free claims for Sep 2026+ |
| HSC Result | June | Fresh graduate targeting, first-time applicants | No inflated success rates |
| Winter/Early Bird | October–November | 2027 intake prep, early applications | No urgent deadlines if not real |
| Year-End | December | Year in review, success compilation | No false 2027 predictions |
| Ramadan/Eid | April | Family-focused, respectful tone | No promotional urgency during Ramadan |

---

## 7. COMPETITOR COMPARISON RULES

### What You CAN Say
- "We offer Payment After Visa — a policy most agencies don't provide."
- "Transparent fee structure — no hidden charges."
- "8+ years of China-focused experience."
- "2,000+ students placed with 98% visa success."

### What You CANNOT Say
- "MalishaEdu charges hidden fees." (defamation)
- "DreamEdu is a fraud." (defamation)
- "Other agencies are liars." (general defamation)
- "Don't trust anyone else." (unprofessional)
- Named competitor comparisons without evidence

---

## 8. QUALITY SCORING ALGORITHM

```
Base Score: 100

CRITICAL banned word found:     -100 (auto-reject)
HIGH banned word found:         -30 per occurrence
MEDIUM banned word found:       -10 per occurrence

Fact-check failures:
  University name not in KB:    -20
  Scholarship figure wrong:     -20
  Deadline incorrect:           -20
  Fake student name:            -20

Missing required elements:
  No CTA:                       -10
  No hashtag:                   -5
  No brief for asset:           -10
  No UTM/short link:            -5

Positive bonuses:
  Strong hook (under 8 words):  +5
  Specific numbers included:    +5
  Real student story:           +5
  Clear CTA with contact:       +5

Final Score = 100 + sum of all penalties + sum of all bonuses

Grading:
  90-100:  🟢 Excellent — auto-approve
  70-89:   🟡 Good — minor fixes suggested
  50-69:   🟠 Needs work — flag for review
  0-49:    🔴 Poor — reject and redraft
  <0:      ⛔ Auto-reject — critical violation
```

---

## 9. AUTOMATION RULES (n8n Quality Gate Workflow)

### Trigger: Every 2 hours
### Action: Scan all `drafted` posts

```
FOR EACH post IN drafted_posts:
  1. Run banned word scan (regex matching)
  2. Run fact-check against KB (university, scholarship, deadline)
  3. Check for required disclaimer presence
  4. Calculate quality score
  5. IF score < 0:
       → status = 'rejected'
       → rejection_reason = 'Critical violation: [word]'
       → alert admin via Telegram
  6. ELSE IF score < 50:
       → status = 'review' (with quality score)
       → flag issues for manual review
  7. ELSE IF score >= 70:
       → status = 'review' (auto-promoted, ready for designer)
       → quality_score = score
  8. Write quality_checks JSON to post
```

---

## 10. OFFER & SCHOLARSHIP SOURCE RULES

### Where New Offers Come From (Manual Addition)
1. **Government portals** — e.g., CSC official site, MOE China
2. **University official websites** — direct from admission offices
3. **Competitor posts** (for monitoring, not copying)
4. **WeChat groups** — China university agents
5. **Email newsletters** — university partnerships
6. **Drive documents** — brochures, PDFs, notices uploaded by team

### Source Verification Levels
| Level | Meaning | Action Required |
|---|---|---|
| ⭐⭐⭐ Verified | Checked against official source | Can publish immediately |
| ⭐⭐ Likely | From trusted partner, not yet verified | Publish with "subject to confirmation" |
| ⭐ Unverified | From competitor or social media | Do NOT publish until verified |

### When Adding a New Source in UI
- Must provide: URL, source type, description, verification status
- Optional: Drive folder link for document storage
- Default status: Unverified (⭐)
- Admin must verify before content can be generated from it

---

## 11. CANONICAL STATS (Single Source of Truth)

These are the ONLY numbers that should appear in any content. Never deviate.

| Stat | Value | Context |
|---|---|---|
| Visa success rate | 98% | Past record, 8+ years |
| Years in operation | 8+ | Founded 2017+ |
| Students placed | 2,000+ | Cumulative |
| University partners | 150+ | Direct + indirect |
| Stipend range | Tk 10,000-60,000/month | Depending on scholarship class |
| Service charge China | 2,00,000 BDT | Standard package |
| Service charge Korea | 1,50,000 BDT | Standard package |
| Service charge Hungary/Malta | 1,20,000 BDT | Standard package |
| Service charge Cyprus | Package varies | Contact for details |
| Service charge Azerbaijan | 4,99,000 BDT | Package deal |
| China tuition | 0 BDT (scholarship) / varies (self-paid) | University-dependent |
| Korea tuition | Self-paid only | EAP, Regional Visa, E-Visa |
| Europe tuition | Self-paid only | Hungary, Malta, Croatia, Cyprus |

---

## 12. EMERGENCY PAUSE RULES

When to immediately halt all publishing:

1. **Regulatory change**: Bangladesh govt announces new consultancy licensing rules
2. **Visa policy change**: China/Korea/Europe changes visa requirements
3. **University scandal**: Partner university involved in fraud/scandal
4. **Competitor lawsuit**: If a competitor sues EduExpress for any claim
5. **Data breach**: Student data leak
6. **Negative viral**: Post goes viral for wrong reasons
7. **Admin request**: You say "stop everything"

**Emergency Pause Button**: Sets all `scheduled` posts to `approved` (stops auto-publish) and sends alerts to all admins.

---

*Last updated: June 2026*
*Next review: Monthly (first Monday of each month)*
*Owner: Marketing Manager + Founder*
*Enforced by: n8n Quality Gate workflow + Frontend Content Factory*
