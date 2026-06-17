# Go-Live Runbook — do these in order

A single top-to-bottom checklist to clean the data and switch the content engine on.
Each Terminal block is safe to copy-paste whole. Detailed n8n notes live in `10-n8n-weekly-planner-setup.md`.

---

## 1. Clean up the universities  (~2 min)

Remove the duplicate rows the first seed created, then drop the 3 placeholder rows.

```
cd "/Users/a1/Desktop/webApp/Marketing Automation"
DRY=1 node dedup_universities.mjs
```
Check the preview, then actually remove them:
```
node dedup_universities.mjs
```
Then in the CRM → **Marketing → Data Center → Universities**, delete the three rows ending in **"(example)"** (trash icon). You should end with **11 universities**.

---

## 2. Seed the Research Library  (~1 min)

```
node seed_sources.mjs
```
Adds 4 verified official sources (self-dedups by URL). Confirm under **Data Center → Research Library**.

---

## 3. (Optional, cosmetic) Fix the Brain Pool model label

In **Marketing → Brain Pool**, edit the Gemini row: change model `gemini-flash` → `gemini-2.0-flash`.
This is **display only** — the planner already calls `gemini-2.0-flash` regardless. Skip if short on time.

---

## 4. Turn on the weekly planner  (the big one)

1. **Import** — n8n (https://vibeacademy.cloud) → Workflows → Import from File → `eduexpress-weekly-planner.json` → Save.
2. **Paste keys** — open the "Plan week → import to CRM" node, paste your keys into the `KEYS` array (one per line in quotes). *You do this — I never enter keys.* They auto-route by prefix (`AIza`/`AQ.`→Gemini, `gsk_`→Groq, `sk-or-`→OpenRouter, `sk-`→OpenAI).
3. **Timezone** — Workflow → Settings → timezone **Asia/Dhaka** (schedule fires Thursday 20:00).
4. **Manual test** — click Run manually. Then CRM → **Calendar & Approvals** → pick the upcoming week → expect **14 draft posts** (7 China, 7 BD).
5. **Activate** — toggle the workflow **Active** so the Thursday schedule runs weekly.

Success = Code node returns `imported: 14`. If `key_errors` is listed, fix the named key/model.

### Expected: Gemini 429 on first keys
All 8 `AQ.` Gemini keys share **one** Google Cloud project quota (free tier), so they 429 together — the workflow then **fails over to Groq** automatically (confirmed working). To get more Gemini headroom later, create the keys under **separate Google Cloud projects** (each project = its own free quota).

---

## 5. After it's live
- Approve/edit/reject the drafted week as normal.
- Next builds (see task list): **publish** workflow (auto-post due content) → **competitor LISTEN** → **Telegram** control agent. Publish needs Meta + TikTok access connected.
