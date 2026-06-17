# EduExpress Social Media Automation — Long-Term Master Plan

**Owner:** Abdullah Al Rakib · **Date:** 13 June 2026
**Goal:** A self-running weekly engine that analyzes the market, finds gaps, plans 7 days of content for both pages, gets your one-tap approval on WhatsApp, and publishes automatically — then learns and repeats.
**Budget:** Zero recurring cost (free tiers only) + your existing $200–300/mo ad spend.

---

## 1. The two pages & content routing

| Page / account | Gets which content | Posts to |
|---|---|---|
| **EduExpress International-China** (FB) | **China only** | FB China page |
| **EduExpress International-Bangladesh** (FB) | **China + all destinations** | FB BD page |
| **Instagram** (1 account) | China + all destinations (BD stream) | IG |
| **TikTok** (1 account to start) | China + all destinations (BD stream) | TikTok |

**Routing rule (the key logic):**
- **China content → posted to BOTH** the China page and the BD page (+ IG + TikTok). China is your strongest niche, so it feeds everything.
- **Non-China content (Korea, UK, Hungary, etc.) → BD page + IG + TikTok only.** Never on the China page, so that page stays pure and authoritative on China.

**Two independent daily calendars (not one shared list).** Each page is planned as its own 7-day, 1-post-per-day calendar so neither ever goes dark:
- **China page** = **7 China-only posts/week** (one per day). The engine is *required* to generate ≥7 China items each week so this page is always full.
- **BD page** = 7 posts/week mixing China + Korea/UK/Hungary per the pillar plan.
- The same China item can appear on both pages (the BD page just blends in other destinations). But when the BD page runs, say, a Hungary post on Saturday, the China page runs a *different China* item that day — it never inherits a non-China gap. **Each page fills daily from its own eligible pool.**

---

## 2. The weekly loop (the heart of the system)

A recurring n8n workflow runs once a week and walks through 7 stages. (Bangladesh work week is Sun–Thu; I recommend the loop runs **Thursday night**, plan delivered **Friday morning**, covering the upcoming **Saturday→Friday**.)

```
┌─ 1. LISTEN ──────────────────────────────────────────────┐
│  • Scrape competitor FB pages + Meta Ad Library API (free)│
│    (Sangen, GSC, Edumax, GK, FICC, SCC, Roushan…)         │
│  • Pull OUR last-7-day performance (Meta Graph + TikTok)  │
│  • Scan scholarship deadlines & policy news (CSC, GKS,    │
│    Stipendium Hungaricum, UK intakes)                     │
│  • Pull CRM lead signal: which destinations are hot now   │
└───────────────────────────────────────────────────────────┘
                      ↓
┌─ 2. THINK (Gemini Flash) ────────────────────────────────┐
│  Synthesize → weekly market-gap brief + this week's       │
│  angle priorities (what to push, what competitors missed) │
└───────────────────────────────────────────────────────────┘
                      ↓
┌─ 3. PLAN ────────────────────────────────────────────────┐
│  Generate 7-day calendar per page (pillars + routing +    │
│  cadence + peak times). Write EVERYTHING: post copy        │
│  (Bangla/English), carousel text, video scripts + shot     │
│  lists, hashtags, design briefs. Auto-render Tier-A        │
│  graphics → Drive. Write all rows to Google Sheet.         │
└───────────────────────────────────────────────────────────┘
                      ↓
┌─ 4. APPROVE (WhatsApp) ──────────────────────────────────┐
│  "Week of X ready — N posts. Review & approve: [link]"    │
│  You approve in the Sheet (status column) or reply.        │
└───────────────────────────────────────────────────────────┘
                      ↓
┌─ 5. PRODUCE (designer + editor) ─────────────────────────┐
│  Approved rows show ready briefs. Designer/editor build    │
│  custom assets, drop into Drive, mark "asset ready."       │
└───────────────────────────────────────────────────────────┘
                      ↓
┌─ 6. PUBLISH (auto) ──────────────────────────────────────┐
│  Scheduler checks Sheet each slot; status=Approved +       │
│  asset ready → publish via Meta Graph / TikTok API to the  │
│  correct page(s) per routing rule.                         │
└───────────────────────────────────────────────────────────┘
                      ↓
┌─ 7. LEARN → feeds next week's LISTEN. Closed loop. ──────┘
```

---

## 3. Creative production model (design & video)

The automation removes ~80% of creative *labor* by delivering finished briefs. Humans only execute.

| Content type | Who makes it | How |
|---|---|---|
| Text/link posts | 🤖 Auto | Gemini writes, scheduler posts |
| "Real numbers" / deadline / quote graphics | 🤖 Auto | Rendered from branded templates → Drive |
| Carousels (text-on-template) | 🤖 Auto | Template engine, designer optional polish |
| Custom/branded graphics | 🎨 Designer | From AI-written design brief (you already have a designer) |
| Short video (Reels/TikTok talking-head) | 🎬 Human shoot + edit | From AI script + shot list + caption file |
| Student-story video | 🎬 Human | AI writes script; consultant/student shoots on phone |

**The video-editor gap — 3 phased options (don't hire day one):**
1. **Phase-in (recommended start):** Lean carousel/graphic-heavy (Tier A) for FB/IG. Run TikTok as simple talking-head clips — a consultant films on a phone against the AI script, edited free in **CapCut** (auto-captions, templates). Almost no editing skill needed.
2. **Light freelancer:** Once volume justifies it, a part-time editor (~3–4 short videos/week) on a fixed monthly retainer cuts from the AI shot lists. Low cost, predictable.
3. **AI-assisted:** Free tools for auto-subtitles and template reels keep editing minutes-not-hours. The script, hook, and on-screen text all arrive pre-written.

**Recommendation:** Start with #1 (phone + CapCut), graduate to #2 when TikTok traction proves out. The system makes either cheap because nobody is *thinking up* content — they're just executing finished briefs.

---

## 4. Command center — Google Sheets + Drive

**Google Sheet (one tab per week + a dashboard tab).** Columns:
`Date | Day | Slot/Time | Page(s) | Pillar | Format | Hook | Full copy | Hashtags | Design/Video brief | Asset link | Status | Published link | Reach | Engagement`

`Status` flow: `Drafted → Approved → Asset Ready → Scheduled → Published`. This single column drives the whole approval + publish gate.

**Google Drive folder structure:**
```
/EduExpress Social/
  /Templates/        ← branded graphic templates
  /Student Assets/   ← photos, testimonial clips (your library)
  /2026-W25/         ← per-week rendered + custom assets
  /Brand/            ← logo, fonts, colors, voice guide
```

---

## 4b. Operational safeguards (rejections, asset delays, daily fill)

These three mechanisms keep the system running daily without gaps or rushed approvals.

**A. You don't like a post — three actions, not two:**
- **Approve** → proceeds.
- **Edit** → change the copy in the Sheet; publishes as written.
- **Reject + note** → type a one-line reason; n8n re-runs Gemini with your note and returns v2 in minutes. Rejection notes are logged so future drafts improve.

**B. Designer/editor needs more time — buffer + fallback ladder + work one week ahead:**
- Next week's plan is approved while *this* week is still publishing → assets get a full week of lead time, never same-day pressure.
- If a custom asset isn't ready by its slot, the scheduler auto-swaps in either (1) an auto-rendered **Tier-A graphic** (no human needed) or (2) an **evergreen bank** post (pre-approved timeless content). The custom post slides to the next open slot.
- **Evergreen content bank:** maintain 15–20 pre-approved timeless posts per page ("why China," "98% visa success," student quotes) as the always-available safety net.

**C. Both pages post daily — handled by the two-independent-calendars rule (Section 1).** The China page always has ≥7 China items/week of its own; it never depends on, or inherits gaps from, the BD page's mix.

---

## 4c. Control Agent (conversational command layer)

A chatbot that *is your interface* to the whole system — you message it in plain Bangla/English and it adjusts the plan, drafts, schedule, and data on your behalf. Built because **plans change.**

**Recommended channel: Telegram** (private control room). WhatsApp stays customer-facing for leads; Telegram is free, button-rich, unrestricted, and locked to your chat ID only.

**It messages you:** weekly plan ready / approve prompts, asset-late alerts, deadline reminders, competitor-move flags.

**You message it → it acts:**
| You say | It does |
|---|---|
| "Approve the whole week" | Sets all rows Status = Approved |
| "Drop Saturday's Hungary post, do Korea GKS instead" | Edits the row, regenerates copy, shows v2 |
| "Add a CSC-deadline post tomorrow" | Inserts + drafts a new row |
| "What's going out today?" | Reads the calendar, replies |
| "Pause the China page this week" | Flags those rows, holds publishing |
| "Competitor X ran this ad [link]" | Logs to Competitor Intel + suggests a counter |

**Why it feels 'like you':** it carries your brand voice, the Data Center facts, and the current plan, so it makes the call you'd make — and **always confirms before anything publishes or is deleted.**

**Flow (all free):** Telegram → n8n webhook → Gemini parses intent → action on Command Center Sheet / scheduler → reply. Guardrails: only your chat ID can command it; destructive/publish actions need a "yes" confirm.

**Rollout (phased — you command from day one):**
- **Phase 1 (basic):** Telegram agent delivers the weekly plan, takes Approve / Reject / "what's planned today?" — so you control the system even while it's draft-only.
- **Phase 2:** adds Edit + reschedule + "add a post" commands tied to the live Sheet + auto-publish.
- **Phase 3 (full):** ad-hoc drafting, "pause the China page," competitor-move logging, full natural-language control — the friendly front door to everything.

Channel confirmed: **Telegram** (WhatsApp stays customer-facing).

---

## 5. Zero-cost tool stack

| Job | Tool | Cost |
|---|---|---|
| Orchestration | n8n (live @ vibeacademy.cloud) | Free |
| AI writing & analysis | Google Gemini Flash API | Free tier |
| Competitor data | Meta Ad Library API + light scraping | Free |
| Auto graphics | Template render (Canva / HTML-to-image free tier) | Free tier* |
| Command center | Google Sheets + Drive | Free |
| Approval & delivery | WhatsApp Business API (live) | Free |
| Publishing | Meta Graph API + TikTok API | Free |
| Performance data | Meta Graph insights + TikTok API | Free |

\* *Free-tier render caps will be checked before committing (per project rule). If caps are too low, we fall back to designer-made templates the engine fills with text.*

---

## 6. Phased rollout (build → trust → automate)

This also answers the approval question: **start draft-only to calibrate quality, then graduate to approve-then-auto-post.**

- **Phase 0 — Foundations (Week 1):** Build the Sheet schema + Drive structure + brand templates. Connect Gemini, Google, WhatsApp, Meta, TikTok to n8n. Confirm all free-tier limits.
- **Phase 1 — Brain online + basic Telegram agent (Weeks 2–3):** Weekly LISTEN→THINK→PLAN runs; full 7-day plan + all copy/scripts/briefs delivered to the Sheet and to you via the **Telegram control agent** (Approve / Reject / "what's planned"). **Draft-only — you post manually.** Goal: trust the quality and command it from day one.
- **Phase 2 — Auto-graphics + auto-publish FB (Weeks 4–5):** Tier-A graphics auto-render; approve-then-auto-post goes live for **Facebook (both pages)** with the WhatsApp approval gate.
- **Phase 3 — IG + TikTok + full control agent (Weeks 6–8):** Add IG + TikTok publishing and the video brief workflow; upgrade the Telegram agent to full natural-language control (ad-hoc posts, reschedule, pause a page, competitor logging); close the performance-feedback loop.
- **Phase 4 — Optimize (ongoing):** A/B angles, shift toward pillars that drive counselling bookings, scale what works.

---

## 7. Success metrics

- **Consistency:** % of planned posts published on time (target 95%+).
- **Growth:** follower + reach growth per page — especially China page and TikTok (from zero).
- **Engagement:** engagement rate by pillar (find the winners).
- **Pipeline:** leads + counselling bookings attributed by destination (via CRM).
- **Efficiency:** human hours/week (target: design + film only, ~0 hours of "what should we post").

---

## 8. Risks & guardrails

- **Brand safety:** WhatsApp approval gate before anything publishes (Phases 2+); draft-only in Phase 1.
- **API limits:** Meta/TikTok rate limits + content review; Gemini & graphic-render free-tier quotas — verified in Phase 0, with manual fallback paths.
- **Accuracy:** scholarship amounts/deadlines are auto-pulled but **human-verified** before publishing — wrong numbers damage trust.
- **TikTok video:** API needs finished files; that's why video stays human-produced (Tier B) early on.

---

## 9. Open decisions before we execute
1. **Approval model:** confirm "draft-only first (Phase 1) → approve-then-auto-post (Phase 2+)." (Recommended.)
2. **Video production:** confirm "phone + CapCut to start, freelancer later." (Recommended.)
3. **Which IG & TikTok account** the BD stream feeds (name/handle).
4. **Weekly loop day:** Thursday-night analysis / Friday-morning plan for a Sat→Fri week — or your preferred day.

Once these are confirmed, we start **Phase 0** and build the command center first.
