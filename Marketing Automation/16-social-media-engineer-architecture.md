# EduExpress Marketing Hub — Social Media Engineer

**Architecture v5** · June 2026 · Built for EduExpress International (Bangladesh)

---

## 1. What This Is

The Marketing Hub is now a **Social Media Engineer** — an AI-powered content intelligence and automation engine that runs deep research before generating content, then tracks, tests, and scales what works.

**Core loop:**

```
RESEARCH → GENERATE → APPROVE → PUBLISH → MEASURE → SCALE → REPEAT
    ↑_______________________________________________________↓
```

---

## 2. System Architecture (5 Layers)

### Layer 1 — Deep Research Engine
Scans the market continuously and feeds intelligence into content generation.

| Component | What it does | Data source |
|---|---|---|
| **Research Intelligence** | Competitor moves, market gaps, policy changes, psych insights | Meta Ad Library API, competitor FB pages, news, government notices |
| **Viral Topics** | Trending/viral topics in the study-abroad space | Platform trend APIs, hashtag monitoring |
| **Psychology Profiles** | Student & parent persona profiles with pain points, fears, aspirations | CRM lead data, consultation notes, survey insights |
| **Hook Library** | Proven hooks with performance data (reach, engagement, conversion) | CRM post analytics |
| **Creative Guidelines** | Brand voice, color, typography, format specs | Drive + manual curation |

**n8n trigger:** `eduexpress-research-engine.json` runs every 6 hours, scans Meta Ad Library + competitor pages, feeds data to Gemini/OpenCode for analysis, writes findings to `research_intelligence` table, alerts via Telegram.

### Layer 2 — Content Generation (LLM-Powered)
Uses your **OpenCode subscriptions** (paid Go tier + free Zen tier) plus Gemini Flash keys for rotation.

**Inputs fed to the LLM prompt:**
1. Research Intelligence (critical/high findings)
2. Viral Topics (trending signals)
3. Winning Hooks (proven performers)
4. Psychology Profiles (audience targeting)
5. Creative Guidelines (design specs)
6. Real University Facts (CRM Data Center)
7. Scholarship Facts (CRM Data Center)
8. Brand Constants (8 years, 2,000+ students, 98% visa, 150+ partners)
9. Season Rules (Admission vs VISA season)
10. Competitor Counter-Positioning

**Planner:** `planner-v5-node-code.js` — n8n Code node that pulls all CRM data, builds the mega-prompt, rotates across your API keys (OpenCode Go → Zen → Gemini), and imports the 7-day plan to the CRM Calendar.

### Layer 3 — Content Calendar & Approval
Two independent calendars (China page + BD page), each with 7 posts/week, plus 3 video slots.

**Status flow:** `Drafted → Approved → Asset Ready → Scheduled → Published`

- **Drafted:** AI-generated, pending review
- **Approved:** You or team approves in the CRM UI
- **Asset Ready:** Designer has built the graphic/video
- **Scheduled:** n8n publishing queue has picked it up
- **Published:** Live on the platform

**Rejection → Redraft:** If you reject a post with a note, the system logs the reason and future drafts improve.

### Layer 4 — Auto-Publishing & Queue
**n8n trigger:** `eduexpress-auto-publish.json` runs every 2 hours.

1. Pulls all `approved`/`asset_ready` posts from CRM where `post_date <= today`
2. Routes by page: `china` → Facebook China page, `bd` → Facebook BD page, `tiktok` → TikTok, `instagram` → Instagram
3. Publishes via Meta Graph API / TikTok API
4. Writes back `published_url`, `reach`, `engagement` to CRM
5. Logs to `publishing_queue` table for audit trail

### Layer 5 — Analytics, A/B Testing & Scale-Up

**Analytics tabs:**
- **Overview:** Total posts, reach, engagement, attributed leads
- **Funnel:** Lead stage funnel (New → Enrolled)
- **Pillar Performance:** Which content pillars drive engagement
- **Consistency Score:** % of target posts met per week
- **Time Slots:** Best posting times by engagement
- **Attribution:** Leads by page, source, campaign
- **Hook Performance:** Which hook types convert best
- **Research Feed:** Live count of research findings, viral topics, winner hooks
- **Scale-Up Signals:** Auto-detected high-performing pillars, pages, hooks, campaign efficiency

**A/B Testing:** Test hooks, body copy, CTAs, images, time slots, hashtag sets. Track reach/engagement/leads per variant. Statistical confidence scoring.

**Scale-Up Recommendations:** AI-generated or manually added recommendations to double down on what works. Approval workflow with expected lead lift %.

---

## 3. Database Tables (New)

| Table | Purpose |
|---|---|
| `research_intelligence` | Deep research findings with urgency levels |
| `viral_topics` | Trending topics with relevance scores |
| `psychology_profiles` | Audience personas (students, parents) |
| `content_scripts` | Script library (video, carousel, ad, DM) |
| `content_hooks` | Hook library with performance tracking |
| `ab_tests` | A/B test experiments with variants & results |
| `scale_up_recommendations` | Growth recommendations with confidence scoring |
| `publishing_queue` | Auto-publishing audit log |
| `creative_guidelines` | Brand & design specs |
| `n8n_workflows` | Workflow registry & status tracking |

---

## 4. API Endpoints (New)

All under `/api/marketing/` with `requireMarketing` (admin + marketing_manager roles):

- `GET/POST/PUT/DELETE /research` — Research Intelligence
- `GET/POST/PUT/DELETE /viral-topics` — Viral Topics
- `GET/POST/PUT/DELETE /psychology` — Psychology Profiles
- `GET/POST/PUT/DELETE /scripts` — Content Scripts
- `GET/POST/PUT/DELETE /hooks` — Hook Library
- `GET/POST/PUT/DELETE /ab-tests` — A/B Tests
- `GET/POST/PUT/DELETE /scale-up` — Scale-Up Recommendations
- `GET/POST/PUT/DELETE /publishing-queue` — Publishing Queue
- `GET/POST/PUT/DELETE /creative-guidelines` — Creative Guidelines
- `GET/POST/PUT/DELETE /n8n-workflows` — n8n Workflow Registry
- `GET /analytics/hook-performance` — Hook performance analytics
- `GET /analytics/research-feed` — Research feed summary
- `GET /analytics/scale-up-signals` — Auto-detected performance signals

---

## 5. n8n Workflows

| Workflow | File | Trigger | What it does |
|---|---|---|---|
| **Weekly Planner** | `planner-v5-node-code.js` | Thursday 20:00 | Generates 7-day content plan using LLM + CRM data |
| **Research Engine** | `eduexpress-research-engine.json` | Every 6 hours | Scans competitors, finds viral topics, writes intel to CRM |
| **Auto-Publish** | `eduexpress-auto-publish.json` | Every 2 hours | Publishes approved posts to FB/IG/TikTok, logs results |
| **Brain Ingest** | `eduexpress-brain-ingest.json` | Weekly | Syncs Drive docs → CRM Data Center |

---

## 6. Frontend Tabs

Marketing Hub now has 9 tabs:

1. **Calendar** — Weekly content calendar, approval workflow, quality scoring
2. **Data Center** — Universities, Scholarships, Research Library, Competitor Intel, Evergreen Bank, Brochures
3. **Brain Pool** — API key rotation, usage tracking, cooldown status
4. **Research** — Research Intelligence, Viral Topics, Psychology Profiles
5. **Scripts** — Content Scripts Library, Hook Library, Creative Guidelines
6. **A/B Tests** — Experiment tracking, variant performance, winner selection
7. **Scale Up** — Performance signals, recommendations, approval workflow
8. **Campaigns** — Meta/TikTok/Google ad campaign tracking
9. **Analytics** — Overview, funnel, pillars, consistency, time slots, attribution, week-over-week

---

## 7. OpenCode Integration

Your paid OpenCode Go subscription is **priority #1** in the API rotation.

**Recommended model order:**
1. `opencode-go` → `glm-5.1` or `kimi-k2.6` (fast, high quality)
2. `opencode-zen` → `deepseek-v4-flash-free` (free fallback)
3. `gemini` → `gemini-2.0-flash` (Google free tier)
4. `gemini` → `gemini-2.0-flash-lite` (backup)

**Key rotation rules:**
- Priority order: Go → Zen → Gemini
- Proactive rotation at 85% of daily quota
- Instant failover on 429/5xx errors
- All keys exhausted → queue + retry after cooldown

---

## 8. How to Deploy

1. **Database:** New tables auto-create on next server restart (existing `CREATE TABLE IF NOT EXISTS` block)
2. **Frontend:** Build with `npm run build` (React + Vite)
3. **n8n:** Import the 3 workflow JSON files into your n8n instance
4. **Keys:** Paste your OpenCode Go key + Gemini keys into `planner-v5-node-code.js` KEYS array
5. **CRM_KEY:** Set `CRM_KEY` env var in n8n matching your CRM's `x-api-key` header

---

## 9. Next Steps (Post-Deploy)

1. Seed psychology profiles with your known student/parent segments
2. Run the Research Engine workflow once to populate initial findings
3. Add 5-10 winning hooks from your best-performing posts
4. Set up creative guidelines with your brand colors, fonts, and tone
5. Create your first A/B test (e.g., hook variant on a China-page post)
6. After 2 weeks of data, check Scale Up → Performance Signals for auto-detected recommendations
