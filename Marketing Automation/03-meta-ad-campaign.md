# Meta Ad Campaign Plan — EduExpress International

**Platforms:** Facebook + Instagram (Meta Ads Manager)
**Budget:** $250/month (within the $200–300 band) ≈ **$8.20/day**
**Goal:** Cheap, qualified counselling leads flowing straight into the CRM pipeline.
**Tracking:** Pixel `1292963899542368` + Conversion API already live (set 12 Jun 2026).

---

## 1. Objective & funnel

We don't have brand-awareness money to burn, so every dollar works for a **lead**. Structure as a simple 2-stage funnel:

```
COLD (Lead Ads)  →  capture name/phone/destination interest  →  CRM "New Lead"
RETARGET (Engagement/Traffic) → re-touch video viewers & form-openers who didn't submit
```

Leads land in the CRM via the existing Meta webhook (`/webhook/meta` handles Facebook Lead Ads automatically) → auto WhatsApp follow-up fires → consultant works the pipeline (New Lead → … → Enrolled).

---

## 2. Budget allocation ($250/mo)

| Campaign | Objective | Daily | Monthly | Share |
|---|---|---|---|---|
| **C1 — Cold Lead Gen (China/Korea)** | Leads (Instant Form) | $4.00 | $120 | 48% |
| **C2 — Cold Lead Gen (Hungary/UK)** | Leads (Instant Form) | $2.20 | $66 | 26% |
| **C3 — Retargeting** | Leads / Traffic | $1.50 | $45 | 18% |
| **Testing reserve** | new creatives/audiences | $0.50 | $19 | 8% |
| **Total** | | **$8.20** | **$250** | 100% |

**Why this split:** China + Korea are your proven demand and lowest-cost leads → biggest share. Hungary/UK is the differentiation play (low competition) → fund it but smaller. Retargeting is always the cheapest conversions → never skip it.

---

## 3. Expected results (planning estimates, BD lead-gen)

Bangladesh Meta lead costs for education are typically low. Conservative planning math:

- Cost per lead (Instant Form): **$0.40–$0.90** → assume **$0.65 avg**
- $231 working spend (ex-testing) ÷ $0.65 ≈ **~355 leads/month**
- If 25% are reachable & relevant, and ~8–12% of those book counselling → **~30–40 counselling conversations/month** from paid alone.

> These are estimates to set expectations, not guarantees. Treat the first 2 weeks as calibration — actual CPL replaces these numbers fast.

---

## 4. Audiences

**C1 — China/Korea (cold)**
- Location: Bangladesh (focus Dhaka, Chattogram, Sylhet)
- Age: 18–28
- Interests: studying abroad, scholarships, Chinese/Korean language, IELTS, universities, HSC/graduation
- Lookalike (once data builds): 1–3% LAL of CRM enrolled students / form submitters

**C2 — Hungary/UK (cold)**
- Same geo/age; interests: study in Europe, UK universities, Schengen, Erasmus, IELTS
- Slightly older skew (20–30) for master's

**C3 — Retargeting (warm)**
- Video viewers (≥50%) from the content engine Reels
- Instant-form openers who didn't submit (last 30 days)
- IG/FB page engagers (last 90 days)
- Website visitors via Pixel (eduexpressint.com)

---

## 5. Ad creative — what to run

Pull straight from the content engine. Best-performing formats for BD education lead ads:

1. **Single-image / short-video Lead Ad** with the "Real Numbers" hook (CSC ৳35k stipend). Strongest cold opener.
2. **Student-story video** (Sample B from the content engine) — proof converts.
3. **Carousel** — destination cost comparison or "6 documents you need."

**Run 3 creatives per ad set**, let Meta optimize, kill anything above target CPL after ~$15 spend.

### Primary text variations (test these)
- **A (urgency + numbers):** "চীনে CSC স্কলারশিপে টিউশন ফ্রি + মাসে ৳৩৫,০০০ ভাতা। ৮ বছরে ২,০০০+ শিক্ষার্থী পাঠিয়েছি। ফ্রি কাউন্সেলিং বুক করুন 👇"
- **B (proof-led):** "৯৮% ভিসা সাকসেস। চীন, কোরিয়া, ইউকে, হাঙ্গেরি — সঠিক গাইডলাইনে স্বপ্ন পূরণ করুন। ফর্ম পূরণ করুন, আমরা কল করব।"
- **C (gap/Hungary, English):** "Fully-funded study in Europe? Hungary's government scholarship covers tuition + stipend. Most agencies won't tell you. We will. Get free counselling →"

### Headlines
- "Free Counselling — China, Korea, UK, Hungary"
- "টিউশন ফ্রি + মাসিক ভাতা"
- "2,000+ Students · 98% Visa Success"

### Instant Form fields (keep short — friction kills CPL)
Name · Phone (WhatsApp) · Preferred destination (dropdown: China/Korea/UK/Hungary/Other) · Education level. **One qualifying question max.**

---

## 6. Measurement & optimization

- **North-star metric:** Cost per *qualified* counselling booking (not raw CPL).
- **Pixel/CAPI events to confirm fire:** Lead, ViewContent, Contact. (CAPI is set — verify dedup in Events Manager.)
- **Weekly review:** CPL by campaign, lead→counselling rate from CRM, best creative/pillar. Shift budget toward the lowest cost-per-booking ad set.
- **Kill rule:** any ad >2× target CPL after $15 spend → pause.
- **Scale rule:** when an ad set holds CPL under $0.65 for 5+ days, raise its budget 20% every 3 days (avoid resetting learning phase).

---

## 7. Launch checklist
- [ ] Confirm Pixel + CAPI events firing & deduplicated in Events Manager
- [ ] Verify Lead Ads → `/webhook/meta` → CRM "New Lead" end-to-end with a test lead
- [ ] Confirm auto WhatsApp follow-up triggers on new paid lead
- [ ] Build C1/C2/C3 with 3 creatives each
- [ ] Set up the 3 retargeting custom audiences
- [ ] Daily budget caps set; payment method confirmed
- [ ] UTM tags on any traffic/link ads for GA attribution

---

**Bottom line:** $250/mo, weighted toward proven China/Korea demand, every lead auto-routed into the CRM and hit with instant WhatsApp follow-up. First two weeks calibrate CPL; after that, money follows the lowest cost-per-booking ad.
