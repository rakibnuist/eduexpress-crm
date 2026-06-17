# n8n Weekly Planner — Setup Guide

The file `eduexpress-weekly-planner.json` is an importable n8n workflow. It's the **core pipe**: on a schedule it reads your CRM Data Center + Brain Pool, drafts a 7-day plan for both pages using your mixed LLM keys (with rotation/failover), and imports it into the CRM Calendar as **drafts** for your approval.

```
Trigger (manual / Thursday 20:00)
   → Code: "Plan week → import to CRM"
        • GET /api/marketing/kb/scholarships   (verified facts)
        • GET /api/marketing/brain             (key pool + priority)
        • builds 14 slots: China page ×7 (China only) + BD page ×7 (mixed destinations)
        • rotates across active keys by priority; fails over on error
        • POST /api/marketing/plan/import      (week = e.g. 2026-07-W1)
```

---

## 1. Import the workflow
n8n → **Workflows → Import from File** → choose `eduexpress-weekly-planner.json`. Save.

## 2. Paste your API keys (one spot, you do this — Claude won't enter keys)
Open the **"Plan week → import to CRM"** node. Near the top is a `KEYS` array:

```js
const KEYS = [
  // 'YOUR-API-KEY-HERE',
  // 'AIzaSy...your-first-gemini-key',
  // 'AIzaSy...your-second-gemini-key',
];
```

Paste your keys there, one per line in quotes, and save. They live only inside n8n.

**Provider auto-detection** — you do NOT label them. The workflow reads each key's prefix:
- `AIza…` → Gemini (classic) · `AQ.…` → Gemini (newer AI Studio format) · `gsk_…` → Groq · `sk-or-…` → OpenRouter · `sk-…` → OpenAI

So you can mix providers freely later; just paste the key and it routes itself. Rotation goes top-to-bottom and fails over to the next key on any error (incl. 429 quota).

> ✅ Gemini keys from https://aistudio.google.com/app/apikey come in two formats: classic `AIza…` and the newer `AQ.…`. **Both are valid API keys** and both auto-route to Gemini here.

*Prefer environment variables instead of pasting?* Leave `KEYS` empty and set any `BRAIN_*` env vars on the n8n host — the workflow falls back to those automatically.

Optional env (defaults already baked in): `CRM_BASE` (https://crm.eduexpressint.com), `CRM_KEY` (eduexpress-n8n-2024).

## 4. Set the timezone & schedule
The schedule node fires **Thursday 20:00** (cron `0 20 * * 4`). In **Workflow → Settings**, set timezone to **Asia/Dhaka** so it fires at Bangladesh time. Adjust the cron if you prefer another day/time.

## 5. Test it
Open the workflow → click **Run manually (test)** on the manual trigger. Then in the CRM open **Marketing → Calendar & Approvals**, pick the **upcoming week** (the next Saturday's month + week) — you should see **14 draft posts** (7 China, 7 BD). Approve/edit/reject as normal.

The Code node returns a summary: `{ week, imported, used_key, key_errors }`. If `imported` is 14 you're done; if `key_errors` lists problems, fix the env var or model id named there.

---

## Troubleshooting
- **"No API keys set" / "All N keys failed"** → the `KEYS` array is empty, or the keys are invalid (e.g. `AQ.` OAuth tokens instead of `AIza` API keys). Check `key_errors` in the node output for the per-key reason.
- **Model 404 / 400** → fix the `model` field in the Brain Pool row to a current id for that provider.
- The node uses n8n's native HTTP client (`this.helpers.httpRequest`) and does **not** use `fetch` or `$env` — so the "fetch is not defined" and "access to env vars denied" errors don't apply to this version.
- **Posts land in the wrong week** → the planner targets the *next* Saturday→Friday week by design; change the date logic if you want the current week.

---

## What's next after this works
1. Add **competitor LISTEN** (Meta Ad Library + your Competitor Intel) to enrich the prompt.
2. Add the **Telegram control agent** (deliver plan + approve/commands).
3. Add the **publish** workflow: read `GET /posts/due`, post to FB/IG/TikTok, write back `PUT /posts/:id/published`.
