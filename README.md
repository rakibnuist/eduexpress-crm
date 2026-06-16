# EduExpress Core

A unified **Consultancy Operations ERP** and **Client Lifecycle Management Suite** built for international student recruitment agencies. EduExpress Core serves as the central operations platform for **EduExpress International**, integrating lead management, application tracking, multi-channel messaging, HR attendance, and financial controls in a single system.

---

## Modules

### Leads & Pipeline
- **Kanban & Table views** for lead tracking with color-coded status stages
- **Click-to-WhatsApp** — phone numbers link directly to WhatsApp conversations
- **Lead scoring** and automated status transitions

### Multi-Channel Messaging (Chat Inbox)
- **WhatsApp Business API** — send/receive messages, media, documents
- **Facebook Messenger** — page conversations with sync history
- **Instagram DM** — direct message integration
- **TikTok** — channel support (webhook-ready)
- **Unified inbox** — all channels in one view with role-based access

### Automated Lead Capture (Webhooks)
- **Meta Webhooks** — incoming WhatsApp, Messenger, Instagram messages automatically create leads
- **Lead Ads** — Facebook/Instagram Lead Ads ingestion via `leadgen` webhook
- **CAPI Integration** — Conversion API for event tracking

### Applications & Documentation
- **Stage tracker** for university admission workflows
- **Document checklist** with status badges
- **Google Drive link** support for transcripts, recommendations, portfolios
- **Student portal** — public status tracking at `/s/<token>`

### HR & Attendance
- **Wi-Fi SSID + Geofence** auto check-in
- **Manual check-in/out** with distance tolerance warnings
- **Workspace logs** — daily goals, accomplishments, metrics
- **Payroll automation** — monthly calculations with attendance, deductions, bonuses

### Finance
- **Income & expense ledger** with real-time net cash balance
- **PnL analytics** — monthly summaries with charts (Recharts)
- **Cash flow visualization**

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, Vite, Tailwind CSS 4, Lucide React |
| Backend | Node.js, Express |
| Database | SQLite (sql.js) with WAL |
| Real-time | Server-Sent Events (SSE) |
| Charts | Recharts |
| Deployment | Railway (auto-deploy from GitHub) |

---

## Webhook Setup (Meta)

Configure in Meta Developer Dashboard:

| Field | Value |
|-------|-------|
| Callback URL | `https://crm.eduexpressint.com/webhook/meta` |
| Verify Token | `eduexpress_verify_2024` |

**Subscriptions:**
- **Page:** `messages`, `leadgen`
- **WhatsApp:** `messages`

All credentials and sync controls are managed in **Settings → Integrations**.

---

## Development

```bash
# Clone
git clone https://github.com/rakibnuist/eduexpress-crm.git
cd eduexpress-crm

# Install
npm install

# Dev (frontend only)
npm run dev

# Server (backend only)
npm run server

# Both concurrently
npm run start

# Production build
npm run build
```

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default: 3000) |
| `JWT_SECRET` | JWT signing key |
| `RAILWAY_VOLUME_MOUNT_PATH` | SQLite volume path (Railway) |

---

## License

Proprietary — EduExpress International.

---

*Built for scale by the EduExpress Engineering Team.*
