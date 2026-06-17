# APIs to Enable — EduExpress Automation

Ordered by priority. ✅ = you likely have it · 🔧 = needed for current builds · 🔜 = needed for publishing phase · ➕ = optional.

---

## 1. Content generation (the "brain") — needed now

**🔧 OpenCode Zen / Go** — main writer (GLM-5.1) for the planner + ingest.
- Get key: https://opencode.ai/auth → API Keys. You have **Go** subscribed.
- Use: `provider:'opencode-go'`, model `glm-5.1` (chat/completions). Base `https://opencode.ai/zen/go/v1`.
- Cost: your $10/mo Go plan. Plenty for weekly use.

**🔧 Google Gemini (Generative Language API)** — free backup keys for failover.
- Enable: https://aistudio.google.com/app/apikey → "Create API key" (creates/links a Google Cloud project + enables the Generative Language API automatically).
- Cost: free tier. ⚠️ Quota is **per Google Cloud project**, not per key — make keys in *different projects* if you want more headroom.
- Use: paste `AIza…` / `AQ.…` keys into the planner `KEYS` array.

**➕ Groq / OpenRouter / OpenAI** — extra cheap/free fallbacks (optional).
- Groq (free, fast): https://console.groq.com → keys (`gsk_…`).
- OpenRouter (pay-as-you-go, many models): https://openrouter.ai/keys (`sk-or-…`).

---

## 2. Google APIs (for the Brain Ingest workflow) — needed now

**🔧 Google Drive API** — lets n8n read your Content Brain folder.
Two ways:
- **Easy:** in n8n → Credentials → New → *Google Drive OAuth2* → "Sign in with Google" (uses n8n's built-in app if your n8n is cloud/managed).
- **Self-hosted n8n:** you must create your own OAuth client:
  1. https://console.cloud.google.com → create/select a project.
  2. APIs & Services → **Enable APIs** → enable **Google Drive API** (and **Google Docs API** if you extend to native Docs editing).
  3. OAuth consent screen → External → add yourself as a Test User.
  4. Credentials → Create OAuth client ID → **Web application** → add n8n's redirect URL (shown in the n8n credential screen).
  5. Copy Client ID + Secret into the n8n Google Drive credential.
- Sign in with **the account that owns the brain folder** (or has editor access).

---

## 3. Publishing to social (the publish phase) — 🔜 next

**🔜 Meta Graph API** — auto-publish to your Facebook Page + Instagram.
- Console: https://developers.facebook.com → create an **App** (type: Business).
- Enable products: **Facebook Login**, **Instagram Graph API**.
- Permissions you'll request: `pages_manage_posts`, `pages_read_engagement`, `pages_show_list`, `instagram_basic`, `instagram_content_publish`, `business_management`.
- You'll need: a **Page access token** (long-lived) and your IG account linked to the Page.
- ⚠️ Reality check: publishing permissions require **Business Verification + App Review** by Meta (can take days). Until approved, you can still post manually from the CRM/Telegram approval and only automate once approved. Verify current requirements in Meta's docs — they change.

**🔜 TikTok Content Posting API** — auto-post Reels/videos.
- Console: https://developers.tiktok.com → create app → request **Content Posting API**.
- ⚠️ Requires app audit/approval; stricter than Meta. Until approved, post TikTok manually (your plan is only 2–3/week anyway).

---

## 4. Optional / nice-to-have — ➕

**➕ Telegram Bot API** — free approvals & notifications ("approve this week's posts" in chat).
- Create a bot via **@BotFather** in Telegram → get token. No review needed. Great for your approval step.

**➕ Meta Ad Library API** — competitor ad research (your 15-competitor list).
- https://www.facebook.com/ads/library/api — needs a Meta app + identity confirmation. *Simpler alternative:* just use the **Ad Library website** (free, no API) — I can pull from it for you.

**Not needed:** WhatsApp — you use `wa.me/8801983333566` click-to-chat links, which need **no API**. (Only consider WhatsApp Cloud API if you ever auto-send messages — not required now.)

---

## Setup guidelines (read before enabling)

1. **One Google account** should own the brain folder, the Gemini keys, and the Drive OAuth — keeps it simple.
2. **Keys live in n8n only.** Never commit them to the CRM repo or the workflow JSON you share. The planner/ingest `KEYS` arrays are the only place.
3. **Gemini quota is per-project** — if you hit 429s, make extra keys in separate Google Cloud projects.
4. **Meta & TikTok publishing need review** — don't block on them. Run the system in **draft→approve→manual-post** mode now; flip on auto-publish per platform once approved.
5. **Least privilege** — only request the permissions listed. Don't grant an app more than it needs.
6. **Rotate any key shared in chat/screenshots** (e.g., the OpenCode key you pasted earlier) once you're set up.
7. **Order to enable:** OpenCode ✅ → Gemini backups → Google Drive OAuth (ingest) → Telegram (approvals) → Meta (publish) → TikTok (publish).
