# EduExpress CRM — Next Tasks Roadmap
*Updated: 12 June 2026 · after fresh-start wipe + Settings fix deploy*

## ✅ Just completed (this session)
- Fixed Settings → Office & Hours crash (missing `Wifi` icon import)
- Wipe tool now truly resets: leads, applications, documents, activity log, KPI targets, and (optionally) conversations/contacts — finance, employees, attendance, payroll always kept
- "Sync History" enabled for Instagram channels (was Messenger-only)
- Route-level code splitting: first-load bundle 1,076 KB → 282 KB (~4× faster first paint)
- Live wipe executed: 1,622 old leads + all conversations removed
- 5 employees set on live: Abdullah Al Rakib (CEO & Super Admin), Sakib Al Jubaer (MD & Admin), Tahmid Imam (Investor & Admin), Afsana Meme (Consultant), Taj Ahmed (Consultant)

## 🔴 Priority 1 — This week
1. **Re-connect messaging channels** — Settings → Integrations shows no channels. Re-add WhatsApp (Phone Number ID 1164314086764182) and both Messenger pages (BD: 693839983823261, China: 110781585233245), then run "Sync History" on the Messenger/Instagram pages to repopulate the Chat Inbox. *Note: WhatsApp history cannot be re-imported — only new incoming messages are captured.*
2. **Set Tahmid Imam's salary** — added with ৳0 (was not provided). HR → Employees → edit.
3. **Set monthly KPI targets** — HR → Sales KPI → "Set monthly targets" per consultant (all targets were reset in the wipe).
4. **Office config** — Wi-Fi SSID and geofence are currently blank on live; set them in Settings → Office & Hours so auto check-in works.

## 🟠 Priority 2 — Next 2 weeks
5. **Lead automation (Phase 1 of marketing plan)** — n8n (vibeacademy.cloud) workflow: new lead webhook → auto WhatsApp follow-up → status update via CRM API.
6. **User accounts for new staff** — Taj Ahmed has no login; Afsana's user maps to "Afsana Mimi" but employee is "Afsana Meme" — align the consultant name so her leads inbox works.
7. **Employee↔user linking** — link each user to their emp_id (Settings → Users → "Linked employee") to enable auto check-in on login.
8. **Daily report automation** — auto-send the Reports "Copy summary" digest to WhatsApp via n8n on a schedule.

## 🟡 Priority 3 — This month
9. **Content engine (Phase 2)** — Gemini Flash + Meta Graph API posting schedule for FB/IG; TikTok from zero.
10. **Competitor monitoring (Phase 3)** — Facebook Ad Library API watcher → weekly digest.
11. **B2B email outreach** — Brevo free tier for university-partner emails.

## 🔧 Technical debt / efficiency backlog
- ~75 eslint warnings (unused imports, missing useEffect deps) — cosmetic, clean gradually
- `seed_data.json` and `.gitignore` have uncommitted local edits — review & discard (`.gitignore` edit would have exposed `.jwt_secret` to git; reverted this session)
- Consider moving `xlsx`/`recharts` heavy deps into lazy chunks too if first paint needs to be faster
- Add a nightly SQLite backup of `/data/crm.db` on Railway (no backups exist now)
- Conversations page: many unused vars; `setChannelFilter` never used — channel filter UI may be incomplete
