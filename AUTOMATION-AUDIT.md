# EduExpress CRM — Automation Audit & Score
**System:** crm.eduexpressint.com · Audit date: 21 Jul 2026 · Basis: full codebase review (server.js ~10,200 lines, wa-linked.js, src/pages)

---

## Overall Automation Score: 51 / 100

Your CRM is feature-rich (leads, conversations, pipeline, finance, HR, marketing, student portal) but most workflows still depend on a human clicking a button. The biggest gap: **several automation triggers exist in the UI but are never executed by the server.**

---

## Scorecard by Business Area

| # | Area | Score | Status |
|---|------|-------|--------|
| 1 | Lead capture (webhooks, Meta Lead Ads, WA/Messenger/IG, chat-scan, Excel import) | 8/10 | Strong |
| 2 | Ads & attribution (Meta CAPI events, daily ad-performance sync, backfill) | 7/10 | Good |
| 3 | Auto-replies (keyword / welcome / no-response rules with templates) | 6/10 | Works, limited |
| 4 | Data hygiene (duplicate detect, merge, auto-cleanup) | 6/10 | Exists, manual trigger |
| 5 | Marketing content engine (LLM generate, queue, n8n publish) | 6/10 | Half-automated |
| 6 | Student portal & documents | 6/10 | Portal live, no reminders |
| 7 | Lead assignment & routing | 5/10 | Hardcoded names |
| 8 | Reporting & alerts | 5/10 | Dashboards only, no push |
| 9 | Broadcasts & campaigns | 4/10 | Manual send only |
| 10 | Pipeline / application stage automation | 4/10 | Trigger is a stub |
| 11 | HR / attendance / payroll | 4/10 | Mostly manual |
| 12 | Infrastructure reliability | 4/10 | sql.js fragility |
| 13 | Follow-up & nurture | 3/10 | **Biggest gap** |
| 14 | Finance automation | 3/10 | Manual entry |

---

## Critical Findings (broken or fake automation)

1. **`time_based` trigger does nothing.** The rule type exists in the Automation UI, but server code says "checked separately via cron" — **no such cron exists**. Any time-based rules you've created never fire.
2. **`lead_status_change` trigger does nothing.** Same situation — stub returns `triggered = false`. Stage-change automations (e.g., "send payment info when status → Positive") silently never run.
3. **Scheduled broadcasts never send.** `scheduled_at` is saved to the DB but no process checks it. Broadcasts only go out when an admin clicks Send.
4. **Rule "Test" button is fake** — endpoint returns a placeholder message without executing anything.
5. **Follow-ups have no engine.** `next_followup` is only a filter in Leads/MyDay/Cockpit. Nobody is notified when follow-ups become overdue — a consultant who doesn't open MyDay misses them entirely.
6. **Consultant routing is hardcoded** in the website webhook (Abdullah Al Rakib / Taj Ahmed / Tahmid Imam). Staff changes require a code deploy; no round-robin or load balancing.
7. **Infrastructure risk:** sql.js (WASM SQLite) with in-code OOM workarounds, 15-second Facebook polling loop (because webhooks are in dev mode), and an emergency-reset GET endpoint. Daily backups exist (good) but retention is only 7 days.

---

## What Already Works Well

- Multi-channel inbound: WhatsApp Cloud API + linked-device (Baileys, multi-account), Messenger, Instagram, website webhook, Meta Lead Ads with backfill.
- Auto lead creation from chats, incl. retroactive BD phone-number scan of old conversations.
- Automation engine on inbound messages: keyword/new-conversation/no-response → auto-reply (with variables), assign, tag, create lead. Anti-spam guard (5 min).
- Meta CAPI conversion events fire automatically on lead creation.
- Daily automated DB backup; daily Meta ad-performance sync.
- Cockpit correctly computes idle leads, unassigned, overdue follow-ups, outstanding balances, visa deadlines — it just doesn't *push* any of it.

---

## Roadmap to ~85/100

### Phase 1 — Fix the broken automations (highest ROI, ~1–2 weeks dev)
| Action | Effort | Impact |
|--------|--------|--------|
| Add a 1-minute scheduler loop that executes `time_based` rules | S | High |
| Fire `lead_status_change` rules from the lead-update endpoints | S | High |
| Process `scheduled_at` broadcasts in the same loop | S | High |
| Overdue follow-up auto-nudge: WhatsApp/notification to assigned consultant each morning (data already in Cockpit query) | M | **Very high** |
| Replace hardcoded consultant routing with a rules table + round-robin | M | High |

### Phase 2 — Close the nurture gap (~2–4 weeks)
- Drip sequences: Day 0/1/3/7 template sequence per lead status & destination, with stop-on-reply. (Tables and send functions already exist — only the sequencer is missing.)
- SLA alerts: escalate to manager if a new lead is uncontacted after X hours (avg response time is already computed in `/api/automation/stats`).
- Document checklist reminders via the student portal + WhatsApp ("your passport copy is still missing").
- Payment reminders from `balance > 0` (query already exists in Cockpit).
- Auto-archive/recycle: leads idle 30+ days → re-engagement sequence or "Cold" status.

### Phase 3 — Intelligence & scale
- AI auto-reply for conversations: you already have LLM config (`/api/marketing/llm-*`) — extend it to first-line student Q&A with human handoff.
- AI lead scoring/qualification from chat content (destination, budget, intake) → auto-fill lead fields.
- Weekly owner digest (leads, conversion, revenue, consultant KPIs) auto-sent — data all exists in `/api/reports`.
- Finance: auto-create income record when lead payment marked; monthly P&L snapshot.
- HR: auto-flag missing attendance; payroll auto-calc from attendance (currently manual mark-paid).
- Migrate sql.js → better-sqlite3 or Postgres; move Meta app out of dev mode to kill the polling loop.

> **Update 21 Jul 2026: Phase 1 has been implemented in server.js** — minute scheduler (time_based rules, scheduled broadcasts, 9:30 AM Dhaka follow-up nudges via in-app + WhatsApp), lead_status_change rules wired into all 4 status-update endpoints, DB-driven routing rules with round-robin (`lead_routing_rules` table + `/api/routing-rules` CRUD, seeded with the previous hardcoded behavior), and a real rule Test endpoint. Deploy/restart the server to activate.

### Score projection
| Milestone | Score |
|-----------|-------|
| Today | 51/100 |
| After Phase 1 | ~68/100 |
| After Phase 2 | ~78/100 |
| After Phase 3 | ~85–90/100 |

---

## Quick wins you can do this week without code
1. Delete/disable any `time_based` or `lead_status_change` rules in the Automation page — they don't work and give false confidence.
2. Make MyDay/Cockpit review a mandatory morning ritual until auto-nudges ship.
3. Verify keyword + welcome rules cover your top 10 inbound questions with Bengali + English keywords.
4. Download a DB backup off-server weekly (7-day retention is thin for a business-critical DB).
