# CRM Marketing Module — Build Spec

**Goal:** Manage the entire social automation **inside the CRM** (crm.eduexpressint.com) instead of Google Sheets. The CRM becomes your single control panel; n8n runs in the background and talks to it over the existing API.

**Fits your stack as-is:** Express 5 (`server.js`) + sql.js, React 19 + React Router + Tailwind + recharts, JWT-cookie auth, WebSocket `broadcast()`, role-gated nav in `Layout.jsx`. No new frameworks.

---

## 1. What replaces what

| Google Sheets design | Becomes in CRM |
|---|---|
| Command Center → Weekly Calendar | **Marketing → Calendar/Approvals** page |
| Evergreen Bank | table + UI under Marketing |
| Brain API Pool | **Marketing → Brain Pool** page |
| Data Center (Universities, Scholarships, Sources, Competitors, Docs) | **Marketing → Data Center** tabs |
| KPI Dashboard | **Marketing → Analytics** (recharts) |
| WhatsApp/Telegram approvals | in-app approve + Telegram still works via API |

The `.xlsx` files I built stay useful: import your existing data straight in via the CRM's existing **`ExcelImport.jsx`** component (the `xlsx` dep is already installed).

---

## 2. Database (add to the `CREATE TABLE IF NOT EXISTS` block in `server.js`, ~line 828)

```sql
-- Weekly content calendar (the core)
CREATE TABLE IF NOT EXISTS content_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  week TEXT,                 -- e.g. 2026-W27
  post_date TEXT, slot_time TEXT,
  page TEXT,                 -- china | bd | instagram | tiktok
  pillar TEXT, format TEXT,
  hook TEXT, body TEXT, hashtags TEXT,
  brief TEXT, asset_url TEXT,
  status TEXT DEFAULT 'drafted',  -- drafted|approved|edit|rejected|asset_ready|scheduled|published
  rejection_reason TEXT,
  published_url TEXT, reach INTEGER, engagement INTEGER,
  source TEXT DEFAULT 'n8n',      -- n8n | manual | evergreen
  created_at TEXT, updated_at TEXT
);
CREATE TABLE IF NOT EXISTS evergreen_bank (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  page_pool TEXT, pillar TEXT, body TEXT, hashtags TEXT, asset_url TEXT,
  status TEXT DEFAULT 'approved'
);
CREATE TABLE IF NOT EXISTS competitor_intel (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  log_date TEXT, competitor TEXT, channel TEXT, observation TEXT,
  link TEXT, our_angle TEXT, added_by TEXT
);
-- Data Center
CREATE TABLE IF NOT EXISTS kb_universities (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, country TEXT, city TEXT,
  programs TEXT, intakes TEXT, tuition TEXT, lang_req TEXT,
  admission_url TEXT, brochure_url TEXT, partner INTEGER, notes TEXT, last_verified TEXT
);
CREATE TABLE IF NOT EXISTS kb_scholarships (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, country TEXT, type TEXT,
  coverage TEXT, eligibility TEXT, deadline TEXT, source_url TEXT,
  status TEXT, last_verified TEXT, notes TEXT
);
CREATE TABLE IF NOT EXISTS kb_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT, topic TEXT, url TEXT, source_type TEXT,
  use_for TEXT, date_added TEXT, notes TEXT
);
CREATE TABLE IF NOT EXISTS kb_docs (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, type TEXT, destination TEXT,
  drive_url TEXT, version TEXT, owner TEXT, updated_at TEXT
);
-- Brain rotation (NO secrets here — only the n8n credential label)
CREATE TABLE IF NOT EXISTS brain_api_pool (
  id INTEGER PRIMARY KEY AUTOINCREMENT, priority INTEGER, provider TEXT, model TEXT,
  cred_label TEXT, req_min INTEGER, req_day INTEGER,
  used_today INTEGER DEFAULT 0, status TEXT DEFAULT 'active',
  cooldown_until TEXT, notes TEXT
);
```
(Meta/TikTok tokens reuse the existing **`meta_config`** / **`channels`** tables.)

---

## 3. API endpoints (same style as existing `app.<verb>('/api/...')`)

**Used by the UI (JWT-cookie auth, admin/manager only):**
- `GET/POST/PUT/DELETE /api/marketing/posts` — `?week=&page=&status=`
- `PUT /api/marketing/posts/:id/status` — approve / edit / reject (+reason)
- `POST /api/marketing/posts/approve-week` — bulk approve
- CRUD `/api/marketing/evergreen`, `/api/marketing/competitors`
- CRUD `/api/marketing/kb/{universities|scholarships|sources|docs}`
- `GET/PUT /api/marketing/brain`

**Used by n8n (separate token header, like the Meta webhook verify-token pattern — no cookie):**
- `POST /api/marketing/plan/import` — n8n writes the generated 7-day plan
- `GET  /api/marketing/posts?status=approved&due=today` — n8n pulls what to publish
- `PUT  /api/marketing/posts/:id/published` — n8n writes back published_url + reach/engagement
- `PUT  /api/marketing/brain/:id` — n8n updates used_today / status / cooldown
- `GET  /api/marketing/kb/*` — n8n reads verified facts before drafting

**Realtime:** fire `broadcast('content_plan_ready', {...})` so the UI + `NotificationBell.jsx` update live (and n8n pings Telegram in parallel).

---

## 4. Frontend (new pages in `src/pages`, routes in `App.jsx`, nav in `Layout.jsx`)

Add one nav item `{ to:'/marketing', icon: Megaphone, label:'Marketing', staffOnly:true }` and a route gated to admin/manager (same pattern as Cockpit/Reports). `Marketing.jsx` with tabs:

1. **Calendar / Approvals** — week view grouped by day; each post card shows page badge (China/BD/IG/TikTok), pillar, hook, body, brief, asset. Inline **Approve / Edit / Reject(+reason)** and a **Approve week** button. Reuse `Modal`, `Confirm`, `StatusBadge`, `Toast`.
2. **Data Center** — sub-tabs (Universities, Scholarships, Research Library, Competitor Intel, Brochures) as editable tables; **Import** button uses existing `ExcelImport.jsx` to load the `.xlsx` files.
3. **Brain Pool** — 8-row table, live status pills, used-today vs limit bars, editable priority/limits.
4. **Analytics** — recharts: reach/engagement by pillar & page, posting consistency %, and **lead attribution by destination** (join `content_posts` ↔ `leads` — a view Sheets could never give you).

---

## 5. How n8n + Telegram now talk to the CRM

```
n8n weekly loop  → POST /api/marketing/plan/import      (writes the week)
You (CRM UI or Telegram) → approve posts                (status -> approved)
n8n scheduler    → GET approved+due → publish → PUT /published
Brain rotation   → PUT /api/marketing/brain/:id         (usage/cooldown)
```
The CRM is the source of truth; n8n is the worker; Telegram is an optional remote that hits the same endpoints. **Google Sheets is no longer in the loop.**

---

## 6. Build phases (incremental, deploys via your `run_deploy.command` → Railway)

- **A — Data layer (1 build):** add tables + n8n token + the `/api/marketing/*` read/write endpoints. n8n can start writing plans immediately.
- **B — Approvals UI:** Calendar/Approvals page + Data Center tabs + xlsx import. You manage everything in-app.
- **C — Brain Pool + Analytics:** status page + recharts dashboards with lead attribution.
- **D — Wire-up:** point n8n + Telegram at the CRM endpoints; retire the Sheets.

Each phase is a normal commit → push → Railway auto-build (~2 min), logged in `NEXT_TASKS.md`.

---

## 7. One decision before I build
- **Access role:** Marketing module visible to **admin + manager** (like Cockpit/Reports), or **admin only** (like Finance/HR/Settings)? Default: admin + manager.
