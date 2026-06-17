# CRM Marketing Module — Phase A (LIVE-READY)

Added to `server.js`: 9 tables + the `/api/marketing/*` API. Syntax-checked and boot-tested against a throwaway DB copy (live `crm.db` untouched). Access: **admin + manager** (cookie) or **n8n** (`x-api-key: eduexpress-n8n-2024`, already your internal key). Consultants get 401.

## Deploy
Commit + run your usual `run_deploy.command` (→ Railway auto-build ~2 min). On boot, the new tables auto-create via `CREATE TABLE IF NOT EXISTS`. Nothing else to configure.

## Endpoints (base: https://crm.eduexpressint.com)

**Content calendar**
- `GET  /api/marketing/posts?week=&page=&status=` — list
- `POST /api/marketing/posts` — create one (manual)
- `PUT  /api/marketing/posts/:id` — edit fields
- `PUT  /api/marketing/posts/:id/status` — `{status, rejection_reason}`
- `PUT  /api/marketing/posts/:id/published` — `{published_url, reach, engagement}` (n8n after posting)
- `DELETE /api/marketing/posts/:id`
- `POST /api/marketing/posts/approve-week` — `{week}` → approves all drafted/edit
- `GET  /api/marketing/posts/due` — approved/asset_ready posts due today (n8n pulls these to publish)
- `POST /api/marketing/plan/import` — `{week, posts:[…]}` (n8n writes the generated week; only replaces its own untouched drafts, never your edits/approvals)

**Knowledge base / data center** (each supports GET, POST, PUT/:id, DELETE/:id)
- `/api/marketing/kb/universities`
- `/api/marketing/kb/scholarships`
- `/api/marketing/kb/sources`
- `/api/marketing/kb/docs`
- `/api/marketing/evergreen`
- `/api/marketing/competitors`

**Brain pool** — `GET /api/marketing/brain`, `POST`, `PUT/:id`, `DELETE/:id` (n8n updates `used_today`/`status`/`cooldown_until`; secrets stay in n8n)

## Verified in testing
plan/import (2 posts) ✓ · approve-week (2 approved) ✓ · due returns today-due approved post ✓ · published sets status+reach ✓ · brain seed/read ✓ · no-key request → 401 ✓

## Next (Phase B)
The `Marketing.jsx` UI (Calendar/Approvals, Data Center tabs, Brain Pool, Analytics) + nav entry gated to admin+manager. Until then, the data layer is fully usable by n8n and via API.
