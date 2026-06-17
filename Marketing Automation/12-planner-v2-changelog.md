# Weekly Planner — v4 is the one to use (multi-destination)

`eduexpress-weekly-planner.v4.json` — the full-portfolio content engine.

## v4 — multi-destination, 50/45/5
- **China page (7)** now covers the real segments: University-Scholarship Bachelor · Student Story · Cost Breakdown · Diploma (SSC entry) · MBBS/Medical (self-paid) · Trust/Q&A · Masters/Partial. University scholarships, NOT govt CSC.
- **BD page (7)** rotates the full SELF-PAID portfolio: South Korea · Hungary · Malta · Croatia · Cyprus (Study & Work) · Azerbaijan · Germany-via-China. No scholarship/success claims.
- **Video (3):** 2 China + 1 self-paid Others (rotates Cyprus/Malta/Azerbaijan/Germany).
- Mix lands ~**50% China / ~45% Others / ~5% Trust**.
- Pulls **live CRM facts** for every destination (now that the Brain Ingest populated `kb_*`), so each post cites real tuition/process per country.
- Inherits everything from v3: OpenCode-Go priority + failover, parallel batching (no 300s timeout), creative+video mapping, hook-variety + Banglish rules, format variety, locked stats (98%/8yr/2,000+/150+), season truth rules.

**Use:** re-import `v4.json`, paste your OpenCode Go key in the Code node `KEYS` (first line, `provider:'opencode-go'`), run.

---

# Weekly Planner — v3 (superseded by v4)

## v3.2 — fixes the 300s "Task execution timed out"
The node was generating all 18 posts in **one** giant LLM call — too slow, so n8n's task-runner killed it at 300s. Fixed:
- **Parallel batching:** the 18 slots are split into 3 batches of 6 and generated **concurrently** (`Promise.all`). Wall-time ≈ one 6-post call instead of one 18-post call — finishes in well under 300s. Each batch independently fails over across your keys (OpenCode Go first).
- **Per-request 60s timeout** on every HTTP call, so one slow/hung provider can't eat the whole budget.
- Faster pass-2 backoff (6s, was 15s).
- Run summary now reports `batches` and `used_models`.

Re-import `eduexpress-weekly-planner.v3.json`. Nothing else to change (your `opencode-go` / `glm-5.1` key entry stays as-is).

### If it ever still times out (self-hosted n8n only)
You can also raise the runner limit: set env `N8N_RUNNERS_TASK_TIMEOUT=600` on your n8n host. On n8n Cloud you can't set this — the batching fix is what keeps you under the limit.

### Pattern for your OTHER CRM automations (keep them fast)
1. Never do one massive LLM call in a Code node — **batch + `Promise.all`**, or move the LLM call to an **HTTP Request node inside a Loop** (each item is its own short execution, immune to the 300s Code-node limit).
2. Always set an HTTP **timeout** so a hung call fails fast.
3. For heavy/long jobs, split across **multiple scheduled runs** (e.g. China page Mon, BD page Tue) instead of one big run.
4. `deepseek-v4-flash` (OpenCode Go) is the cheap/fast choice for high-volume jobs; `glm-5.1` for quality.

---


## v3.1 — OpenCode Go fix (provider rotation)
The first OpenCode attempt failed (401/429) for two reasons, both now fixed in the node:
1. **Wrong endpoint** — OpenCode *Go* uses `https://opencode.ai/zen/go/v1`, not the Zen `…/zen/v1`. Added an `opencode-go` provider with the correct base.
2. **Invalid model** — `minimax-m2.5-free` doesn't exist. On Go, MiniMax/Qwen also use the Anthropic `/messages` format (not supported by this node). Use a **chat/completions** Go model instead: `glm-5.1` (default), `glm-5`, `kimi-k2.6`, `deepseek-v4-flash`, or `mimo-v2.5`.

Also: OpenCode is now **tried first** (priority sort) and fails over **fast** (no inter-key delay), so your paid Go sub is used before the free keys.

**What to change in your n8n node:** your pasted key line currently reads
`{ key:'sk-…', provider:'opencode', model:'minimax-m2.5-free' }` — change it to:
`{ key:'sk-…', provider:'opencode-go', model:'glm-5.1' },`
(You don't need to move it — the node sorts OpenCode Go to the front automatically.)

---


**Use `eduexpress-weekly-planner.v3.json`.** (v2 below is kept for history; v3 supersedes it.)

## v3 — merged strategy + your real data (after reading both PDFs)
After reading `Competitor Analysis & Social Media Strategy ... .pdf` and `Bachelor 2026 Last Call (Without CSCA).pdf`, I reconciled the two strategies you had:

- **Per-page merge:** the **China page** now follows your *PDF* model (Scholarship Alert · Visa Success · Cost Breakdown · University Spotlight · Live Q&A/Trust) with MBBS/CSC focus; the **BD page** keeps the *markdown* model (Real Numbers · Student Story · Deadline · Destination · Trust) for Korea/UK/Hungary.
- **"Bachelor 2026 — Last Call (Without CSCA)" campaign baked in.** 2 China slots/week push it. The prompt now carries **11 real partner universities with exact CNY fees, majors, HSC requirements and deadlines** pulled from your sheet (Jiangxi Inst. of Tech, Lishui, Hubei Normal, Wuchang, Beibu Gulf, Shandong Ag&Eng, Hechi, Hebei Fine Arts, Zibo Poly, Shenyang Urban/City). This is the single biggest "real numbers" upgrade.
- **Competitor counter-positioning:** out-positions rivals' "no fee if rejected" / aggressive pricing using your Payment-After-Visa + admission-without-CSCA + No-IELTS + exact transparent fees (never naming rivals).
- **MBBS angles + concrete hooks** ("চীনে Bachelor/MBBS-এ আসলে কত খরচ?", Top-3-unis, Without-CSCA myth-bust) and set hashtags (#StudyInChina #MBBSinChina #CSCScholarship #EduExpressBD).
- **Rotating lead offers** replace generic "free counselling": Free Profile Assessment / Scholarship Eligibility Check / Personalized University Shortlist.
- **KPIs** (CPL, Lead Verification Rate, Enrolled Conversion) returned in the run summary for your Analytics tab.
- Keeps everything from v2: real voice, creative+video mapping, 4 TikTok/Reel slots, 18 posts/week.

### Two data flags to verify (a "real numbers" brand can't get these wrong)
1. **Deadlines:** several rows in the Last Call sheet read "June 30th, **2025**" inside a 2026 doc — almost certainly typos. Confirm they're **2026** before these posts go out. Today is mid-June 2026, so the 30-June unis are ~2 weeks out — genuinely urgent.
2. **Stats:** website says 3,000+/7yr/$5M+; planner is locked to your chosen 2,000+/8yr/150+. Reconcile site vs posts.

### To make Student Stories truly real
Your real success posts are image-based (visa/acceptance photos), so the planner references them as "[student name] + real photo from /Student Assets/". Drop 5–10 actual alumni photos into that folder (or point me to specific posts) and they become real, on-brand, no invented names.

---

# Weekly Planner v2 — what changed and why it stops being generic

**File:** `eduexpress-weekly-planner.v2.json` (your original is untouched as a fallback.)
Re-import it into n8n, paste your API keys into the `KEYS` array (same as before), run manually to test.

## Why the old output read generic
The Code-node prompt had drifted away from your own strategy:
- It ran a **different pillar set** ("Scholarship Alert / Visa Success Story / Cost Breakdown / University Spotlight / Trust") — which is almost exactly the *sea-of-sameness* template your competitor analysis warned against. So it was generic by construction.
- The `brief` always described a **static graphic**, even for Reels — no video script, no template names, no link to your asset folders.
- The plan had **zero video slots** despite TikTok being your "open field."
- Stats drifted (3,000+/7yr vs your docs' 2,000+/8yr).

## What v2 does
1. **5 real pillars** from your content engine: Real Numbers (30%) · Student Story (25%) · Deadline & How-To (20%) · Destination (15%) · Trust/BTS (10%).
2. **Anti-generic guardrail** baked in: the prompt explicitly bans opening with "free counselling / X% success / N partners / expert guidance," and forces a specific number, real student, real deadline, or real university in line one.
3. **Real voice injected** — three of your *actual* live FB captions are in the prompt as style anchors (the "❌ বাধাগুলো / ✨ benefits" pattern, the CSCA scoring post, the rejection-empathy hook).
4. **Real numbers** pulled from your own posts: 100% tuition+hostel free, **No IELTS (MOI)**, **Payment After Visa** (a differentiator that wasn't even in your strategy), stipend ৳10,000–৳60,000, Diploma→PhD, real unis (Chongqing Jiaotong, Nanjing, Fudan…). These live in an `ANCHOR_FACTS` block used only when the CRM Data Center is thin.
5. **Creative + video mapping (the gap you flagged):** every slot now returns a structured `creative` object that the code flattens into a designer-ready `brief`:
   - **Static** → named template (RealNumbersCarousel, DeadlineCountdown, etc.) + headline-with-RED-keyword + badge + footer bar + which asset folder to pull.
   - **Video** → a **timed shot-list** (Hook 0–3s → Body → Proof → CTA) + burned-in on-screen text + end card + what to shoot. No CRM schema change needed — it all renders in the existing brief field.
6. **TikTok/Reel slots added:** 4 Bangla on-camera videos/week (student story, consultant Q&A, how-to, destination), cross-posted TikTok + Reels. Total plan now **18 posts/week** (7 China + 7 BD + 4 video).

## One thing you must decide
Your **public website says 3,000+ students / 7 years / 150+ / $5M+**, but you asked to lock **2,000+ / 8 years / 150+**. A "real numbers" brand can't have posts and the website disagree. The numbers live in ONE place — the `BRAND` constant at the top of the Code node. Either update the website, or flip the constant. Right now it's set to your chosen 2,000+/8yr.

## Optional next steps
- Add real rows to **Data Center → Scholarships/Universities** so the prompt cites live CRM facts over the anchor set.
- Wire **competitor LISTEN** (Meta Ad Library + Competitor Intel) into the prompt for weekly fresh angles.
- If you want the creative mapping as structured DB columns (not just brief text), add `template`, `asset_hint`, `video_script` columns to `content_posts` and surface them in the Approvals card.
