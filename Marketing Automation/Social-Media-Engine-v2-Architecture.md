# EduExpress Social Media Engine — Complete Architecture Redesign

**Version:** 2.0  
**Date:** June 2026  
**For:** EduExpress International (Bangladesh)  
**Prepared by:** AI Systems Architect  

---

## 1. Executive Summary — What's Wrong & What's New

### What You Told Us You Don't Like

| Current Pain Point | Why It Hurts |
|---|---|
| **Disconnected tabs** | Research, Scripts, A/B Tests, Scale Up exist in `SocialEngineerTabs.jsx` but are NOT wired into the main Marketing Hub. You have two separate systems. |
| **List-view calendar** | No visual weekly grid. You can't see 7-day buffer at a glance. No drag-and-drop. |
| **No designer handoff** | Status flow is `drafted → approved → asset_ready → scheduled → published` but there's no designer queue, no asset upload, no "waiting for designer" view. |
| **Manual research only** | Research tab is empty CRUD. No competitor scanning, no trending alerts, no automated intelligence. |
| **No platform previews** | You can't see how a China post looks vs. a Bangladesh post. No Instagram/TikTok preview. |
| **No lead attribution** | Posts go out, leads come in, but you can't connect which post generated which lead. No UTM builder. |
| **No content quality gate** | AI generates posts with no fact-check against KB, no banned-word detection, no Banglish validation. |
| **Static analytics** | Just count of posts and a bar chart. No funnel, no attribution, no consistency score, no "what's working" signals. |
| **No automation rules** | "If post reaches X engagement, alert team" — impossible. "If competitor posts about CSC, draft counter-post" — impossible. |

### The New Vision — "Social Media Engine"

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    EDUEXPRESS SOCIAL MEDIA ENGINE v2.0                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│   │  CHINA PAGE │    │    BD PAGE  │    │  INSTAGRAM  │    │   TIKTOK    │  │
│   │  (China Only│    │ (Mixed Posts│    │ (Mixed/Auto │    │ (Mixed Posts│  │
│   │   Content)  │    │   All Dest) │    │  w/ BD Page)│    │   All Dest) │  │
│   └──────┬──────┘    └──────┬──────┘    └──────┬──────┘    └──────┬──────┘  │
│          │                  │                  │                  │        │
│          └──────────────────┬┴──────────────────┬┴──────────────────┬─┘        │
│                             │                   │                  │        │
│                    ┌────────┴────────┐   ┌─────┴─────┐   ┌────────┴────────┐│
│                    │   7-DAY BUFFER    │   │  DESIGNER  │   │  AUTO-PUBLISH   ││
│                    │  Content Queue    │   │   QUEUE    │   │   & SCHEDULER   ││
│                    │  (Visual Calendar)│   │(Asset Mgmt)│   │  (Meta/TikTok)  ││
│                    └────────┬────────┘   └─────┬─────┘   └────────┬────────┘│
│                             │                   │                  │        │
│          ┌──────────────────┼───────────────────┼──────────────────┼────────┐│
│          │                  │                   │                  │        ││
│   ┌──────┴──────┐  ┌───────┴───────┐  ┌──────┴──────┐  ┌───────┴───────┐││
│   │   RESEARCH   │  │   CONTENT      │  │  ANALYTICS  │  │  AUTOMATION   │││
│   │   ENGINE     │  │   FACTORY      │  │  & ATTRIBUT │  │  RULES ENGINE │││
│   │              │  │                │  │             │  │               │││
│   │• Competitor  │  │• AI Generator  │  │• Lead Funnel│  │• Smart Alerts │││
│   │  Monitoring  │  │• Quality Gate  │  │• Post→Lead  │  │• Auto-fill    │││
│   │• Trend Radar  │  │• Designer Hub  │  │  Attribution│  │  Gaps         │││
│   │• Offer Intel  │  │• UTM Builder   │  │• Consistency│  │• Counter-post│││
│   │• Policy Watch │  │• Platform Spec │  │  Score      │  │  Triggers     │││
│   └─────────────┘  └───────────────┘  └─────────────┘  └───────────────┘││
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                         DATA CENTER (Knowledge Base)                │   │
│   │  Universities · Scholarships · Research Library · Evergreen Bank    │   │
│   │  Competitor Intel · Brochures · Hooks · Scripts · Creative Guide   │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. The 4 Social Media Pages — Content Strategy Matrix

| Page | Channel | Content Mix | Automation | Target Audience |
|---|---|---|---|---|
| **China** | Facebook Page | 100% China-focused (CSC, MBBS, universities, CSCA policy) | AI-generated, manual approval | Parents 35-55 + Students 18-24 |
| **Bangladesh** | Facebook Page | Mixed: China 40%, Korea 20%, Europe 20%, Malaysia/Cyprus/Georgia 20% | AI-generated, manual approval | Parents 35-55 (primary) |
| **Instagram** | Instagram | Mixed: Same as Bangladesh page, auto-synced | **Automated** — pulls from BD page content, auto-formatted for Reels | Students 18-24 (primary) |
| **TikTok** | TikTok | Mixed: Short-form, high-energy, all destinations | AI-generated with trending audio suggestions | Students 17-24 (Gen Z) |

### Content Pillar Distribution (Per Page)

```
CHINA PAGE (7 posts/week):
├── Scholarship Alerts (2) — CSC, Provincial, University-specific
├── Visa Success Stories (2) — Video testimonials, quote graphics
├── University Spotlights (1) — Rankings, facilities, career outcomes
├── Cost Breakdowns (1) — Transparent BDT comparisons
└── Live Q&A / Expert (1) — Counselor insights, policy updates

BANGLADESH PAGE (7 posts/week):
├── China Content (3) — Same as China page but mixed tone
├── Korea/Europe (2) — Hungary, Malta, South Korea, Georgia
├── General Trust (1) — Payment After Visa, office tour, process
└── Trending / Viral (1) — Reactive content from Research Engine

INSTAGRAM (5 Reels/week, auto-synced from BD):
├── All BD posts reformatted as Reels (3)
├── Trending audio + educational (1)
└── Story polls / engagement (1)

TIKTOK (5 videos/week):
├── Fast-paced educational (2) — "How much MBBS REALLY costs"
├── Student testimonials (1) — UGC style
├── Trending format copies (1) — "5 reasons to choose China"
└── Myth-busting (1) — "CSCA required? Not for these!"
```

---

## 3. The 7-Day Buffer Workflow — Visual Pipeline

This is the core of your daily operation. Every post moves through a **kanban-style pipeline** with a 7-day forward-looking buffer.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    WEEKLY CONTENT PIPELINE (7-Day Buffer)                    │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   DAY 1        DAY 2        DAY 3        DAY 4        DAY 5        DAY 6     │
│   (Research)   (Generate)    (Quality)     (Design)      (Review)    (Schedule)│
│                                                                              │
│   ┌────────┐   ┌────────┐   ┌────────┐   ┌────────┐   ┌────────┐   ┌────────┐ │
│   │Research│   │ AI     │   │Quality │   │Designer│   │You     │   │n8n     │ │
│   │Engine  │ → │Generate│ → │Gate    │ → │Creates │ → │Approve │ → │Publish │ │
│   │runs    │   │Drafts  │   │Checks  │   │Asset   │   │or Reject│   │or Queue│ │
│   │        │   │        │   │        │   │        │   │        │   │        │ │
│   │•Compet │   │•Hook   │   │•Fact  │   │•Canva  │   │•One-click│   │•Meta   │ │
│   │ itor   │   │ selected│   │ check  │   │/PSD   │   │ approve│   │ API    │ │
│   │•Trend  │   │•Body   │   │•Banned │   │•Video  │   │•Redraft│   │•TikTok │ │
│   │ ing    │   │ written │   │ words  │   │ edit   │   │ note  │   │ API    │ │
│   │•Offer  │   │•Hashtags│   │•Bangla│   │        │   │        │   │        │ │
│   │ scan   │   │ added  │   │ tone  │   │        │   │        │   │        │ │
│   └────────┘   └────────┘   └────────┘   └────────┘   └────────┘   └────────┘ │
│                                                                              │
│   STATUS FLOW:                                                              │
│   ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐     │
│   │ RESEARCH│ → │ DRAFTED │ → │ REVIEW  │ → │ ASSET   │ → │APPROVED │     │
│   │         │   │         │   │         │   │ PENDING │   │         │     │
│   └─────────┘   └─────────┘   └─────────┘   └─────────┘   └─────────┘     │
│                              ↓                                              │
│                         ┌─────────┐   ┌─────────┐   ┌─────────┐          │
│                         │ REJECTED│   │ SCHEDULE│ → │PUBLISHED│          │
│                         │(redraft) │   │         │   │         │          │
│                         └─────────┘   └─────────┘   └─────────┘          │
│                                                                              │
│   DESIGNER HANDOFF:                                                          │
│   When post reaches "Asset Pending":                                         │
│   • Notification sent to designer (WhatsApp / Telegram / CRM notification)   │
│   • Designer uploads asset to post (image/video URL)                          │
│   • Designer marks "Asset Ready"                                              │
│   • Post moves to "Approved" or stays for your final approval                  │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Status Definitions (New)

| Status | Who | Action | Next |
|---|---|---|---|
| `research` | AI Engine | Topic identified, not yet drafted | → `drafted` |
| `drafted` | AI Engine | Content generated, needs quality check | → `review` |
| `review` | Quality Gate | Fact-checking, banned words, tone check | → `asset_pending` or `rejected` |
| `asset_pending` | Designer | Waiting for graphic/video asset | → `asset_ready` |
| `asset_ready` | Designer | Asset uploaded, ready for approval | → `approved` or `rejected` |
| `approved` | You/Team | Final sign-off | → `scheduled` |
| `scheduled` | Auto-Publisher | In queue, will publish on `post_date` + `slot_time` | → `published` |
| `published` | System | Live on platform. Metrics tracked. | — |
| `rejected` | You/Team | Redraft requested with note | → `drafted` (AI regenerates) |
| `evergreen` | System | Pre-approved fallback content | → `scheduled` (gap filler) |

---

## 4. Database Schema (Redesigned)

### New Tables

```sql
-- ── Content Posts (Enhanced) ──
CREATE TABLE IF NOT EXISTS content_posts (
  id INTEGER PRIMARY KEY,
  week TEXT,                    -- e.g. "2026-06-W3"
  post_date TEXT,               -- YYYY-MM-DD
  slot_time TEXT,               -- HH:MM
  page TEXT CHECK(page IN ('china','bd','instagram','tiktok')),
  pillar TEXT,                  -- e.g. "scholarship", "trust", "career", "urgency"
  format TEXT CHECK(format IN ('Reel','Carousel','Single image','Story','Video','Live','Text')),
  
  -- Content fields
  hook TEXT,                    -- The grabber (first line)
  body TEXT,                    -- Full copy
  hashtags TEXT,                -- Comma-separated
  brief TEXT,                    -- Design brief for designer
  
  -- Assets
  asset_url TEXT,               -- Link to image/video
  asset_type TEXT CHECK(asset_type IN ('image','video','carousel','none')),
  asset_uploaded_by TEXT,       -- Designer who uploaded
  asset_uploaded_at TEXT,       -- Timestamp
  
  -- Quality gate
  quality_score INTEGER,        -- 0-100 auto-calculated
  quality_checks TEXT,          -- JSON: {fact_check: true, banned_words: [], tone_ok: true}
  
  -- Status & workflow
  status TEXT CHECK(status IN ('research','drafted','review','asset_pending','asset_ready','approved','scheduled','published','rejected','evergreen')),
  rejection_reason TEXT,        -- Why it was rejected
  redraft_count INTEGER DEFAULT 0,
  
  -- UTM / Attribution
  utm_source TEXT,              -- e.g. "facebook"
  utm_medium TEXT,              -- e.g. "social"
  utm_campaign TEXT,            -- e.g. "csca_free_june_2026"
  utm_content TEXT,             -- stores content_posts.id
  short_link TEXT,              -- CRM-generated short link
  
  -- Publishing
  published_url TEXT,           -- Live post URL
  published_at TEXT,            -- When it went live
  published_by TEXT,            -- "n8n" or manual
  
  -- Performance (auto-filled by n8n)
  reach INTEGER,
  engagement INTEGER,
  shares INTEGER,
  comments INTEGER,
  saves INTEGER,
  video_views INTEGER,
  leads INTEGER,                -- Leads attributed to this post
  
  -- Source tracking
  source TEXT DEFAULT 'manual', -- "n8n", "manual", "evergreen", "reactive"
  research_intel_id INTEGER,    -- Link to research_intelligence
  
  -- Meta
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ── Research Intelligence (Auto-populated) ──
CREATE TABLE IF NOT EXISTS research_intelligence (
  id INTEGER PRIMARY KEY,
  topic TEXT NOT NULL,
  category TEXT CHECK(category IN ('competitor_move','market_gap','viral_signal','policy_change','psych_insight','offer_alert','trending_topic')),
  urgency TEXT CHECK(urgency IN ('critical','high','normal','low')),
  
  -- Source
  competitor TEXT,              -- e.g. "MalishaEdu", "DreamEdu"
  source_url TEXT,
  source_type TEXT CHECK(source_type IN ('meta_ad_library','fb_scrape','competitor_page','news','gov_notice','trend_platform','internal')),
  
  -- Content
  insight_summary TEXT,         -- What we found
  recommended_angle TEXT,       -- How EduExpress should respond
  evidence TEXT,                -- JSON: screenshots, links, metrics
  
  -- Status
  status TEXT CHECK(status IN ('new','reviewed','used','archived')),
  used_in_post_id INTEGER,      -- FK to content_posts
  
  -- Meta
  research_date TEXT DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ── Viral Topics ──
CREATE TABLE IF NOT EXISTS viral_topics (
  id INTEGER PRIMARY KEY,
  topic TEXT NOT NULL,
  platform TEXT CHECK(platform IN ('facebook','instagram','tiktok','youtube','twitter')),
  hashtag TEXT,
  
  -- Scoring
  relevance_score INTEGER CHECK(relevance_score BETWEEN 0 AND 100),
  engagement_velocity REAL,       -- Growth rate
  reach_estimate INTEGER,
  sentiment TEXT CHECK(sentiment IN ('positive','neutral','negative','mixed')),
  
  -- Content guidance
  why_viral TEXT,               -- Analysis
  recommended_hook TEXT,        -- Suggested hook
  recommended_cta TEXT,         -- Suggested CTA
  recommended_pillar TEXT,        -- Which pillar fits
  
  -- Status
  status TEXT CHECK(status IN ('new','approved','used','declined')),
  used_in_post_id INTEGER,
  
  discovered_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ── Psychology Profiles ──
CREATE TABLE IF NOT EXISTS psychology_profiles (
  id INTEGER PRIMARY KEY,
  segment TEXT NOT NULL,        -- e.g. "Student 18-24", "Parent 35-55"
  
  -- Psychographics
  pain_points TEXT,
  aspirations TEXT,
  fears TEXT,
  trusted_sources TEXT,
  decision_factors TEXT,
  content_preferences TEXT,
  
  -- Technical
  peak_hours TEXT,              -- e.g. "8PM-10PM, 1PM-3PM"
  language_preference TEXT CHECK(language_preference IN ('bangla','english','banglish')),
  voice_tone TEXT CHECK(voice_tone IN ('empathetic_brother','expert_consultant','success_story','peer_friend')),
  
  -- Platform
  primary_platform TEXT,
  secondary_platform TEXT,
  
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ── Content Scripts Library ──
CREATE TABLE IF NOT EXISTS content_scripts (
  id INTEGER PRIMARY KEY,
  script_name TEXT NOT NULL,
  category TEXT CHECK(category IN ('hook','video_script','carousel_copy','story','ad_copy','dm_script','reel_script','tiktok_script')),
  
  -- Targeting
  destination TEXT,             -- e.g. "China", "Korea", "Hungary"
  pillar TEXT,
  format TEXT CHECK(format IN ('Reel','Carousel','Single image','Story','TikTok','Live')),
  
  -- Content
  hook TEXT,
  body TEXT,                    -- Full script/copy
  cta TEXT,
  duration_seconds INTEGER,
  shot_list TEXT,               -- For video
  on_screen_text TEXT,          -- For video
  
  -- Psychology
  psychology_target TEXT,       -- e.g. "cost_anxiety", "trust_gap"
  
  -- Performance
  avg_score REAL,
  usage_count INTEGER DEFAULT 0,
  
  status TEXT CHECK(status IN ('draft','approved','archived','winner')),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ── Hook Library ──
CREATE TABLE IF NOT EXISTS content_hooks (
  id INTEGER PRIMARY KEY,
  hook_text TEXT NOT NULL,
  hook_type TEXT CHECK(hook_type IN ('pain_point','curiosity','number','myth_bust','urgency','story','challenge','social_proof','fomo','trust')),
  
  -- Targeting
  destination TEXT,
  pillar TEXT,
  format TEXT,
  psychology_target TEXT,
  
  -- Performance
  usage_count INTEGER DEFAULT 0,
  avg_reach INTEGER,
  avg_engagement INTEGER,
  conversion_rate REAL,         -- 0.0 - 1.0
  
  status TEXT CHECK(status IN ('new','winner','tested','declined')),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ── A/B Tests ──
CREATE TABLE IF NOT EXISTS ab_tests (
  id INTEGER PRIMARY KEY,
  test_name TEXT NOT NULL,
  variable TEXT CHECK(variable IN ('hook','body','cta','image','time_slot','hashtag_set','platform')),
  
  -- Variants
  variant_a TEXT,               -- Control
  variant_b TEXT,               -- Test
  variant_c TEXT,               -- Optional
  
  -- Targeting
  page TEXT CHECK(page IN ('china','bd','instagram','tiktok')),
  start_date TEXT,
  end_date TEXT,
  
  -- Status
  status TEXT CHECK(status IN ('planned','running','completed','cancelled')),
  
  -- Results
  a_reach INTEGER, a_engagement INTEGER, a_leads INTEGER,
  b_reach INTEGER, b_engagement INTEGER, b_leads INTEGER,
  c_reach INTEGER, c_engagement INTEGER, c_leads INTEGER,
  
  winner TEXT CHECK(winner IN ('a','b','c','inconclusive')),
  winner_confidence INTEGER,    -- 0-100
  insights TEXT,
  
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ── Scale Up Recommendations ──
CREATE TABLE IF NOT EXISTS scale_up_recommendations (
  id INTEGER PRIMARY KEY,
  recommendation_type TEXT CHECK(recommendation_type IN ('content_pillar','platform','hook_style','time_slot','campaign','budget','destination','format','audience_segment')),
  title TEXT NOT NULL,
  description TEXT,
  
  expected_impact TEXT CHECK(expected_impact IN ('high','medium','low')),
  expected_lead_lift REAL,      -- Percentage
  confidence_score INTEGER,       -- 0-100
  
  based_on_data TEXT,           -- JSON evidence
  action_items TEXT,
  
  status TEXT CHECK(status IN ('pending','approved','implemented','rejected','testing')),
  approved_by TEXT,
  
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ── Publishing Queue (Audit Log) ──
CREATE TABLE IF NOT EXISTS publishing_queue (
  id INTEGER PRIMARY KEY,
  post_id INTEGER,
  page TEXT,
  platform TEXT,                -- "facebook", "instagram", "tiktok"
  
  -- Scheduling
  scheduled_at TEXT,
  published_at TEXT,
  
  -- Result
  status TEXT CHECK(status IN ('queued','published','failed','retry')),
  error_message TEXT,
  platform_post_id TEXT,          -- ID from Meta/TikTok API
  platform_post_url TEXT,
  
  -- Metrics (filled after publish)
  reach INTEGER,
  engagement INTEGER,
  
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ── Creative Guidelines ──
CREATE TABLE IF NOT EXISTS creative_guidelines (
  id INTEGER PRIMARY KEY,
  guideline_name TEXT NOT NULL,
  category TEXT CHECK(category IN ('color','typography','imagery','tone','format_spec','brand_voice','asset_size','video_spec')),
  platform TEXT CHECK(platform IN ('facebook','instagram','tiktok','all')),
  
  specification TEXT,
  examples TEXT,
  do_s TEXT,
  dont_s TEXT,
  
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ── Lead Attribution (NEW — Critical) ──
CREATE TABLE IF NOT EXISTS lead_attribution (
  id INTEGER PRIMARY KEY,
  lead_id INTEGER,
  
  -- First touch
  first_touch_at TEXT DEFAULT CURRENT_TIMESTAMP,
  first_touch_source TEXT,
  first_touch_campaign TEXT,
  
  -- UTM parameters
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,             -- Links to content_posts.id
  utm_term TEXT,
  
  -- Meta-specific
  meta_campaign_id TEXT,
  meta_adset_id TEXT,
  meta_ad_id TEXT,
  meta_form_id TEXT,
  meta_is_organic INTEGER DEFAULT 0,
  
  -- Content attribution
  content_post_id INTEGER,      -- FK to content_posts
  
  -- Revenue
  enrollment_value REAL,        -- Service fee received
  enrolled_at TEXT,
  
  FOREIGN KEY (lead_id) REFERENCES leads(id)
);

-- ── Campaign Spend (NEW) ──
CREATE TABLE IF NOT EXISTS campaign_spend (
  id INTEGER PRIMARY KEY,
  campaign_id TEXT,
  campaign_name TEXT,
  date TEXT,
  spend REAL,
  channel TEXT,
  platform TEXT,
  destination TEXT,
  
  -- Performance
  impressions INTEGER,
  clicks INTEGER,
  leads INTEGER,
  
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ── Automation Rules (NEW) ──
CREATE TABLE IF NOT EXISTS automation_rules (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  trigger_type TEXT CHECK(trigger_type IN ('engagement_threshold','competitor_post','deadline_approach','no_posts_tomorrow','gap_detected','post_performance','schedule_conflict')),
  
  trigger_condition TEXT,       -- JSON: e.g. {"engagement": 100, "operator": ">"}
  action_type TEXT CHECK(action_type IN ('alert','draft_counter_post','auto_schedule','fill_from_evergreen','notify_designer','escalate')),
  action_config TEXT,           -- JSON config
  
  is_active INTEGER DEFAULT 1,
  last_triggered_at TEXT,
  trigger_count INTEGER DEFAULT 0,
  
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ── Designer Queue (NEW) ──
CREATE TABLE IF NOT EXISTS designer_queue (
  id INTEGER PRIMARY KEY,
  post_id INTEGER,
  designer_id TEXT,             -- User ID or external designer
  
  -- Request
  brief TEXT,
  priority TEXT CHECK(priority IN ('urgent','normal','low')),
  deadline TEXT,
  
  -- Status
  status TEXT CHECK(status IN ('assigned','in_progress','review','completed','rejected')),
  
  -- Assets
  draft_asset_url TEXT,
  final_asset_url TEXT,
  feedback TEXT,
  
  -- Meta
  assigned_at TEXT,
  completed_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

---

## 5. Frontend Architecture (React Component Hierarchy)

```
Marketing.jsx (Main Hub)
│
├── Tab Navigation (8 tabs)
│   ├── 📅 Content Calendar    ← NEW: Visual weekly grid + Kanban pipeline
│   ├── 🔬 Research Engine     ← NEW: Competitor radar, Trending alerts
│   ├── 🏭 Content Factory     ← NEW: AI generator, Quality gate, UTM builder
│   ├── 🎨 Designer Hub        ← NEW: Asset queue, Upload, Review
│   ├── 📊 Analytics & Attribution  ← NEW: Funnel, Lead attribution, ROI
│   ├── 🧪 A/B Tests           ← Existing, enhanced
│   ├── 🚀 Scale Up            ← Existing, enhanced
│   └── ⚙️ Automation Rules   ← NEW: Trigger engine, Smart alerts
│
└── Shared Components
    ├── PostCard (platform-aware preview)
    ├── PlatformPreview (FB/IG/TikTok mockup frames)
    ├── UTMBuilder (short link generator)
    ├── QualityScoreBadge (0-100 with color)
    ├── StatusBadge (pipeline status)
    ├── PillarColorDot (color-coded pillars)
    ├── BatchActionBar (multi-select floating bar)
    └── ContentPipeline (kanban columns)
```

### Tab 1: Content Calendar (The 7-Day Buffer)

```
┌─────────────────────────────────────────────────────────────────┐
│  Content Calendar — 7-Day Buffer    [Week selector] [Today]     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  View: [Grid ▼] [Kanban ▼] [List ▼]      Filter: [All ▼]     │
│                                                                 │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐  │
│  │ MON 23  │ │ TUE 24  │ │ WED 25  │ │ THU 26  │ │ FRI 27  │  │
│  │─────────│ │─────────│ │─────────│ │─────────│ │─────────│  │
│  │ [China] │ │ [China] │ │ [BD]    │ │ [IG]    │ │ [TikTok]│  │
│  │ Scholarship│ │ Visa    │ │ Korea   │ │ Reel    │ │ Myth    │  │
│  │ Alert   │ │ Story   │ │ Promo   │ │ (auto)  │ │ Bust    │  │
│  │ APPROVED│ │ASSET_PEN│ │ DRAFTED │ │APPROVED │ │ REVIEW  │  │
│  │ ✅      │ │ 🎨      │ │ 📝      │ │ ✅      │ │ 🔍      │  │
│  │─────────│ │─────────│ │─────────│ │─────────│ │─────────│  │
│  │ [BD]    │ │ [TikTok]│ │ [China] │ │ [BD]    │ │ [China] │  │
│  │ Trust   │ │ Cost    │ │ Univ    │ │ Europe  │ │ FAQ     │  │
│  │ APPROVED│ │ APPROVED│ │ DRAFTED │ │ASSET_PEN│ │ SCHEDULE│  │
│  │ ✅      │ │ ✅      │ │ 📝      │ │ 🎨      │ │ ⏰      │  │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘  │
│                                                                 │
│  Legend: 📝 Drafted │ 🔍 Review │ 🎨 Asset Pending │ ✅ Approved │
│          ⏰ Scheduled │ 🚀 Published │ ❌ Rejected              │
│                                                                 │
│  [Batch Actions: Approve 3] [Reschedule] [Delete]  ← floating  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Key Features:**
- **Visual Grid**: 7-day weekly view with day columns
- **Kanban View**: Pipeline columns (Research → Drafted → Review → Asset Pending → Asset Ready → Approved → Scheduled → Published)
- **Drag & Drop**: Move posts between days and statuses using `@dnd-kit`
- **Batch Actions**: Multi-select posts → bulk approve, reschedule, delete
- **Platform Preview**: Click any post → see Facebook/Instagram/TikTok preview frame
- **Evergreen Fill**: Empty slot → "Fill with evergreen" button pulls from bank

### Tab 2: Research Engine (Intelligence Center)

```
┌─────────────────────────────────────────────────────────────────┐
│  Research Engine                                                │
├─────────────────────────────────────────────────────────────────┤
│  Sub-tabs: [Competitor Radar] [Viral Topics] [Policy Watch] [Offers]│
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  COMPETITOR RADAR (Live Feed)                            │   │
│  │  ─────────────────────────────────────────────────────   │   │
│  │  🚨 CRITICAL: DreamEdu posted "CSCA Free Universities"   │   │
│  │     yesterday → 2.3K engagement. Counter-post ready. │   │
│  │     [View] [Draft Counter-Post] [Dismiss]               │   │
│  │                                                          │   │
│  │  ⚠️ HIGH: MalishaEdu launched new Korea campaign        │   │
│  │     "Visa in 7 days" — investigate if true.             │   │
│  │     [View] [Add to Intel] [Draft Response]              │   │
│  │                                                          │   │
│  │  📈 TRENDING: #CSCScholarship2026 trending on TikTok     │   │
│  │     45K posts, +300% this week. Recommended: Reel.        │   │
│  │     [View Trend] [Create Post] [Save to Viral]            │   │
│  │                                                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Competitor Performance (Last 30 Days):                         │
│  ┌──────────┬─────────┬──────────┬─────────┬──────────┐      │
│  │ Competitor│ Posts   │ Avg Eng  │ Top Pillar│ Our Gap  │      │
│  ├──────────┼─────────┼──────────┼─────────┼──────────┤      │
│  │ MalishaEdu│ 42      │ 1.2K     │ Scholarship│ ❌ We're │      │
│  │ DreamEdu  │ 38      │ 2.1K     │ Visa Success│ ✅ Leading│     │
│  │ AR Edu    │ 28      │ 890      │ Cost Breakdown│ ⚠️ Behind│    │
│  └──────────┴─────────┴──────────┴─────────┴──────────┘      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Key Features:**
- **Auto-scraping**: n8n workflows scan competitor pages every 6 hours
- **Competitor Performance Table**: Posts count, engagement, top pillar, gap analysis
- **Viral Topic Radar**: Trending hashtags, relevance scores, recommended hooks
- **Policy Watch**: CSCA updates, visa rule changes, scholarship deadlines
- **Offer Intel**: What competitors are offering (price, terms, guarantees)
- **One-click actions**: "Draft Counter-Post" creates a pre-populated draft

### Tab 3: Content Factory (AI Generator + Quality Gate)

```
┌─────────────────────────────────────────────────────────────────┐
│  Content Factory                                                │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────────────────────────┐│
│  │ INPUT PANEL     │  │ OUTPUT PANEL + PREVIEW             ││
│  │ ───────────────  │  │ ─────────────────────────────────── ││
│  │ Page: [China ▼]  │  │                                     ││
│  │ Pillar: [Schol ▼]│  │  ┌─────────────────────────────┐   ││
│  │ Format: [Reel ▼] │  │  │  QUALITY SCORE: 87/100      │   ││
│  │ Topic: [CSCA...] │  │  │  ✅ Fact check: PASS         │   ││
│  │ Tone: [Banglish ▼]│  │  │  ✅ Banned words: CLEAN      │   ││
│  │                  │  │  │  ✅ Tone: Banglish OK        │   ││
│  │ [Generate Post]  │  │  │  ⚠️ Scholarship figure: VERIFY│  ││
│  │                  │  │  └─────────────────────────────┘   ││
│  │ Research Intel:  │  │                                     ││
│  │ [Viral topic #3] │  │  Hook: "CSCA ছাড়াই চীনে..."      ││
│  │ [Competitor move]│  │  Body: [Full copy...]              ││
│  │ [Winning hook]  │  │  Hashtags: #CSC #China...          ││
│  │                  │  │  UTM: eduexpress.link/csca-jun-23  ││
│  │                  │  │                                     ││
│  │                  │  │  [Platform Preview Tabs]           ││
│  │                  │  │  [Facebook] [Instagram] [TikTok]   ││
│  │                  │  │                                     ││
│  │                  │  │  ┌─────────────────────────┐      ││
│  │                  │  │  │ [Facebook Preview]      │      ││
│  │                  │  │  │ ┌───────────────────┐  │      ││
│  │                  │  │  │ │ 📸 [Image]          │  │      ││
│  │                  │  │  │ │                     │  │      ││
│  │                  │  │  │ │ CSCA ছাড়াই চীনে... │  │      ││
│  │                  │  │  │ │ Apply Now →         │  │      ││
│  │                  │  │  │ └───────────────────┘  │      ││
│  │                  │  │  └─────────────────────────┘      ││
│  │                  │  │                                     ││
│  │                  │  │  [Save to Draft] [Send to Designer]││
│  └─────────────────┘  └─────────────────────────────────────┘│
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Key Features:**
- **AI Generator**: Pulls from Research Intel, Viral Topics, Hook Library, KB
- **Quality Gate (Auto)**: Fact-check vs. KB, banned word detection, Banglish tone check, scholarship figure verification
- **Quality Score**: 0-100 badge with breakdown
- **UTM Builder**: Auto-generates short links with tracking parameters
- **Platform Preview**: Facebook feed, Instagram Reel, TikTok FYP mockups
- **Designer Handoff**: One-click "Send to Designer" creates queue entry

### Tab 4: Designer Hub (Asset Management)

```
┌─────────────────────────────────────────────────────────────────┐
│  Designer Hub                                                   │
├─────────────────────────────────────────────────────────────────┤
│  Sub-tabs: [Pending Queue] [In Progress] [Review] [Completed]   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  PENDING (4 posts waiting)                              │   │
│  │  ─────────────────────────────────────────────────────  │   │
│  │  #1 [China] Scholarship Alert — Due: Tomorrow 9PM      │   │
│  │     Brief: "Red carousel, 5 slides, CSC logo, BDT figures"│  │
│  │     [Upload Asset] [View Brief] [Mark In Progress]     │   │
│  │                                                          │   │
│  │  #2 [BD] Korea Visa Success — Due: Friday 8PM          │   │
│  │     Brief: "Video testimonial, 30s, student in Seoul"    │   │
│  │     [Upload Asset] [View Brief] [Mark In Progress]     │   │
│  │                                                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Upload Asset Modal:                                            │
│  ┌─────────────────────────────────────────┐                   │
│  │ Post: #1 Scholarship Alert              │                   │
│  │ Asset URL: [________________] [Browse]   │                   │
│  │ Type: [Image ▼] [Video ▼] [Carousel ▼] │                   │
│  │ Notes: [________________]              │                   │
│  │ [Upload & Mark Ready]                   │                   │
│  └─────────────────────────────────────────┘                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Key Features:**
- **Designer Queue**: Posts assigned to designers with deadlines
- **Asset Upload**: Direct upload or URL paste
- **Review Workflow**: Designer uploads → you review → approve or request changes
- **Version History**: Multiple drafts per post
- **Notification**: WhatsApp/Telegram alert to designer when assigned

### Tab 5: Analytics & Attribution (ROI Dashboard)

```
┌─────────────────────────────────────────────────────────────────┐
│  Analytics & Attribution                                        │
├─────────────────────────────────────────────────────────────────┤
│  Sub-tabs: [Overview] [Funnel] [Content] [Attribution] [Campaign]│
│                                                                 │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐  │
│  │ Total Posts│ │ Published  │ │ Leads Gen  │ │ Avg Reach  │  │
│  │    156     │ │    142     │ │    89      │ │   4,320    │  │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘  │
│                                                                 │
│  LEAD FUNNEL (Post → Lead → File → Visa → Enrolled)            │
│  ┌────────┐    ┌────────┐    ┌────────┐    ┌────────┐        │
│  │ 1,200  │ →  │  340   │ →  │  180   │ →  │  89    │        │
│  │ Reach  │    │ Leads  │    │ Files  │    │ Enrolled│        │
│  └────────┘    └────────┘    └────────┘    └────────┘        │
│     28%          53%           49%                              │
│                                                                 │
│  TOP PERFORMING POSTS (By Leads Generated)                     │
│  ┌────────────────────────────────────────────────────────┐   │
│  │ #1 "CSCA ছাড়াই" — 23 leads, 5.2K reach, 12% conv      │   │
│  │ #2 "Payment After Visa" — 18 leads, 8.1K reach, 8% conv│   │
│  │ #3 "Korea Stipend" — 15 leads, 3.4K reach, 15% conv     │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ATTRIBUTION BY PAGE                                            │
│  ┌──────────┬────────┬────────┬────────┬─────────┐           │
│  │ Page     │ Leads  │ Files  │ Enrolled│ Revenue │           │
│  ├──────────┼────────┼────────┼────────┼─────────┤           │
│  │ China    │ 45     │ 22     │ 12      │ ৳360K   │           │
│  │ Bangladesh│ 28    │ 15     │ 8       │ ৳240K   │           │
│  │ Instagram│ 12     │ 6      │ 3       │ ৳90K    │           │
│  │ TikTok   │ 4      │ 2      │ 1       │ ৳30K    │           │
│  └──────────┴────────┴────────┴────────┴─────────┘           │
│                                                                 │
│  CONSISTENCY SCORE: 87% (26/30 target posts this month)       │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  ████████████████████████████████████████████████████░░░░░░░░  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Key Features:**
- **Lead Funnel**: Awareness → Interest → Desire → Action (AIDA)
- **Post Attribution**: Which posts generated which leads (via UTM)
- **Revenue Attribution**: Service fee revenue per page/channel
- **Consistency Score**: % of target posts published on time
- **Campaign ROI**: Cost per lead, cost per enrollment, ROAS
- **Pillar Performance**: Which content pillars drive the most leads

### Tab 6: A/B Tests (Enhanced)

- **Running Tests**: Active experiments with live metrics
- **Test History**: Completed tests with winners
- **Recommendation Engine**: "Test this hook vs. that hook" suggestions
- **Statistical Confidence**: Auto-calculated with color coding

### Tab 7: Scale Up (Enhanced)

- **Performance Signals**: Auto-detected patterns ("China page posts at 8PM get 2x engagement")
- **Growth Recommendations**: AI-generated suggestions with expected impact
- **Approval Workflow**: Review → Approve → Implement
- **Budget Optimizer**: "Shift ৳5K from BD to TikTok" recommendations

### Tab 8: Automation Rules (NEW)

```
┌─────────────────────────────────────────────────────────────────┐
│  Automation Rules                                               │
├─────────────────────────────────────────────────────────────────┤
│  [+ New Rule]                                                   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Rule #1: Competitor Counter-Post                        │   │
│  │ Trigger: Competitor posts about "CSCA Free"            │   │
│  │ Action: Draft counter-post within 2 hours                │   │
│  │ Status: ✅ Active  |  Last triggered: Yesterday          │   │
│  │ [Edit] [Pause] [Delete]                                  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Rule #2: Gap Filler                                       │   │
│  │ Trigger: No posts scheduled for tomorrow                 │   │
│  │ Action: Pull from evergreen bank and schedule            │   │
│  │ Status: ✅ Active  |  Last triggered: Never              │   │
│  │ [Edit] [Pause] [Delete]                                  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Rule #3: High Engagement Alert                          │   │
│  │ Trigger: Post reaches 5K engagement in 2 hours         │   │
│  │ Action: Alert team + boost with ৳1K ad spend           │   │
│  │ Status: ⏸️ Paused                                       │   │
│  │ [Edit] [Resume] [Delete]                                 │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Rule Types:**
- **Competitor Alert**: When competitor posts X, draft Y
- **Gap Filler**: Auto-fill empty calendar slots from evergreen bank
- **Engagement Booster**: High-performing posts → auto-boost suggestion
- **Deadline Alert**: Scholarship deadline approaching → auto-reminder post
- **Designer Nudge**: Asset pending > 24h → notify designer
- **Quality Fail**: Post fails quality gate → alert + skip

---

## 6. Backend API Architecture

### Existing Endpoints (Keep + Enhance)

```
GET/POST/PUT/DELETE  /api/marketing/posts          ← Enhanced with quality_score, UTM fields
GET/POST/PUT/DELETE  /api/marketing/evergreen        ← Keep
GET/POST/PUT/DELETE  /api/marketing/competitors      ← Keep
GET/POST/PUT/DELETE  /api/marketing/brain            ← Keep
GET/POST/PUT/DELETE  /api/marketing/kb/universities  ← Keep
GET/POST/PUT/DELETE  /api/marketing/kb/scholarships  ← Keep
GET/POST/PUT/DELETE  /api/marketing/kb/sources       ← Keep
GET/POST/PUT/DELETE  /api/marketing/kb/docs          ← Keep
```

### New Endpoints

```
# ── Research Engine ──
GET    /api/marketing/research              ← research_intelligence
POST   /api/marketing/research
PUT    /api/marketing/research/:id
DELETE /api/marketing/research/:id
GET    /api/marketing/research/feed         ← Live feed (last 50)
GET    /api/marketing/research/competitors  ← Competitor performance summary

GET    /api/marketing/viral-topics          ← viral_topics
POST   /api/marketing/viral-topics
PUT    /api/marketing/viral-topics/:id
DELETE /api/marketing/viral-topics/:id

GET    /api/marketing/psychology            ← psychology_profiles
POST   /api/marketing/psychology
PUT    /api/marketing/psychology/:id
DELETE /api/marketing/psychology/:id

# ── Content Factory ──
GET    /api/marketing/scripts               ← content_scripts
POST   /api/marketing/scripts
PUT    /api/marketing/scripts/:id
DELETE /api/marketing/scripts/:id

GET    /api/marketing/hooks                 ← content_hooks
POST   /api/marketing/hooks
PUT    /api/marketing/hooks/:id
DELETE /api/marketing/hooks/:id

GET    /api/marketing/creative-guidelines   ← creative_guidelines
POST   /api/marketing/creative-guidelines
PUT    /api/marketing/creative-guidelines/:id
DELETE /api/marketing/creative-guidelines/:id

# ── Quality Gate ──
POST   /api/marketing/posts/:id/quality-check    ← Run fact-check, banned words, tone
GET    /api/marketing/posts/:id/quality-score    ← Get quality score breakdown

# ── UTM & Short Links ──
POST   /api/marketing/utm/build                ← Generate UTM parameters + short link
GET    /api/marketing/utm/:post_id             ← Get UTM for post

# ── Designer Queue ──
GET    /api/marketing/designer-queue           ← All queue items
POST   /api/marketing/designer-queue           ← Assign to designer
PUT    /api/marketing/designer-queue/:id       ← Update status/upload asset
DELETE /api/marketing/designer-queue/:id

# ── A/B Tests ──
GET    /api/marketing/ab-tests                ← ab_tests
POST   /api/marketing/ab-tests
PUT    /api/marketing/ab-tests/:id
DELETE /api/marketing/ab-tests/:id
GET    /api/marketing/ab-tests/:id/results     ← Get live results

# ── Scale Up ──
GET    /api/marketing/scale-up                ← scale_up_recommendations
POST   /api/marketing/scale-up
PUT    /api/marketing/scale-up/:id
DELETE /api/marketing/scale-up/:id

GET    /api/marketing/analytics/scale-up-signals   ← Auto-detected signals
GET    /api/marketing/analytics/hook-performance    ← Hook performance leaderboard
GET    /api/marketing/analytics/research-feed       ← Research feed summary

# ── Attribution & Analytics ──
GET    /api/marketing/analytics/overview      ← Overview stats
GET    /api/marketing/analytics/funnel        ← Lead funnel data
GET    /api/marketing/analytics/content         ← Content performance by post
GET    /api/marketing/analytics/attribution     ← Lead attribution by post/page
GET    /api/marketing/analytics/campaigns       ← Campaign performance
GET    /api/marketing/analytics/consistency     ← Consistency score
GET    /api/marketing/analytics/pillars         ← Pillar performance
GET    /api/marketing/analytics/time-slots      ← Best posting times

# ── Publishing Queue ──
GET    /api/marketing/publishing-queue          ← publishing_queue
POST   /api/marketing/publishing-queue
PUT    /api/marketing/publishing-queue/:id
GET    /api/marketing/publishing-queue/due      ← Posts due now (for n8n)

# ── Automation Rules ──
GET    /api/marketing/automation-rules          ← automation_rules
POST   /api/marketing/automation-rules
PUT    /api/marketing/automation-rules/:id
DELETE /api/marketing/automation-rules/:id
POST   /api/marketing/automation-rules/:id/trigger ← Manual trigger

# ── Lead Attribution ──
GET    /api/marketing/attribution/:lead_id    ← Get attribution for lead
POST   /api/marketing/attribution               ← Create attribution record
GET    /api/marketing/attribution/summary       ← Summary by source/campaign
```

---

## 7. n8n Workflow Architecture

### Workflow 1: Research Engine (Every 6 hours)

```
┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│  Trigger    │ → │  Scrape     │ → │  Analyze    │ → │  Write to   │
│  (6 hours)  │   │  Competitor │   │  with LLM   │   │  CRM        │
│             │   │  Pages      │   │             │   │             │
└─────────────┘   └─────────────┘   └─────────────┘   └─────────────┘
                           ↓
                   ┌─────────────┐
                   │  Meta Ad    │
                   │  Library    │
                   │  API        │
                   └─────────────┘
                           ↓
                   ┌─────────────┐
                   │  Trending   │
                   │  Hashtags   │
                   │  (TikTok/IG)│
                   └─────────────┘
```

**Output:**
- Writes to `research_intelligence` table
- Writes to `viral_topics` table
- Sends Telegram alert for CRITICAL/HIGH findings

### Workflow 2: Weekly Content Planner (Every Thursday 20:00)

```
┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│  Trigger    │ → │  Pull CRM   │ → │  Generate   │ → │  Import to  │
│  (Thu 8PM)  │   │  Data       │   │  7-Day Plan │   │  CRM        │
│             │   │  (KB,Hooks, │   │  (LLM)      │   │  Calendar   │
│             │   │  Research)  │   │             │   │             │
└─────────────┘   └─────────────┘   └─────────────┘   └─────────────┘
```

**Input:**
1. Research Intelligence (critical/high findings)
2. Viral Topics (trending signals)
3. Winning Hooks (proven performers)
4. Psychology Profiles (audience targeting)
5. Creative Guidelines (design specs)
6. University Facts (CRM Data Center)
7. Scholarship Facts (CRM Data Center)
8. Brand Constants (8 years, 2,000+ students, 98% visa, 150+ partners)
9. Season Rules (Admission vs VISA season)
10. Competitor Counter-Positioning

**Output:**
- 7-day content plan for each page
- Writes to `content_posts` via `/api/marketing/plan/import`
- Status: `drafted` (ready for quality gate)

### Workflow 3: Quality Gate (Every 2 hours)

```
┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│  Trigger    │ → │  Pull       │ → │  Run Checks │ → │  Update     │
│  (2 hours)  │   │  Drafted    │   │  (Fact,Ban,│   │  Status     │
│             │   │  Posts      │   │  Tone,Fig)  │   │  + Score    │
└─────────────┘   └─────────────┘   └─────────────┘   └─────────────┘
```

**Checks:**
1. **Fact Check**: Verify scholarship figures, university names, deadlines against `kb_universities` + `kb_scholarships`
2. **Banned Words**: "guaranteed visa", "100% success", "no rejection" → auto-reject
3. **Tone Check**: Ensure Bangla/Banglish compliance per `psychology_profiles`
4. **Figure Verification**: Scholarship amounts, stipend figures must match KB
5. **Quality Score**: 0-100 based on hook strength, body completeness, CTA clarity

**Output:**
- Pass → Status: `review` (ready for designer)
- Fail → Status: `rejected` with reason → AI redrafts

### Workflow 4: Designer Assignment (Every 2 hours)

```
┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│  Trigger    │ → │  Pull       │ → │  Create     │ → │  Notify     │
│  (2 hours)  │   │  Review     │   │  Designer   │   │  Designer   │
│             │   │  Posts      │   │  Queue      │   │  (WhatsApp) │
└─────────────┘   └─────────────┘   └─────────────┘   └─────────────┘
```

**Output:**
- Creates `designer_queue` entry
- Sends WhatsApp/Telegram: "New design request: [Brief] — Due: [Date]"

### Workflow 5: Auto-Publish (Every 2 hours)

```
┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│  Trigger    │ → │  Pull       │ → │  Publish    │ → │  Write Back │
│  (2 hours)  │   │  Approved   │   │  to Meta/   │   │  Metrics    │
│             │   │  + Due      │   │  TikTok     │   │  to CRM     │
└─────────────┘   └─────────────┘   └─────────────┘   └─────────────┘
```

**Routing:**
- `page=china` → Facebook China page (Meta Graph API)
- `page=bd` → Facebook Bangladesh page (Meta Graph API)
- `page=instagram` → Instagram (Meta Graph API, auto-formatted from BD)
- `page=tiktok` → TikTok (TikTok API)

**Output:**
- Updates `content_posts` status → `published`
- Writes `published_url`, `published_at`
- Creates `publishing_queue` entry

### Workflow 6: Performance Sync (Daily at 6AM)

```
┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│  Trigger    │ → │  Pull Meta  │ → │  Pull TikTok│ → │  Update CRM │
│  (Daily 6AM)│   │  Insights   │   │  Analytics  │   │  Posts      │
└─────────────┘   └─────────────┘   └─────────────┘   └─────────────┘
```

**Output:**
- Updates `reach`, `engagement`, `shares`, `comments`, `saves`, `video_views`
- Triggers `scale_up_recommendations` if performance thresholds met

### Workflow 7: Lead Attribution (Real-time)

```
┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│  Webhook    │ → │  Parse UTM  │ → │  Match to   │ → │  Write      │
│  (Meta/Form)│   │  Parameters │   │  Content    │   │  Attribution│
│             │   │             │   │  Post       │   │             │
└─────────────┘   └─────────────┘   └─────────────┘   └─────────────┘
```

**Output:**
- Creates `lead_attribution` entry
- Links lead to `content_post_id` via `utm_content`
- Updates post's `leads` count

---

## 8. Implementation Phases (Recommended)

### Phase 1: Foundation (Week 1-2) — "Database + Calendar Redesign"

**Goal:** Fix the core data model and make the calendar usable.

**Tasks:**
1. **Database Migration**
   - Add new tables: `research_intelligence`, `viral_topics`, `psychology_profiles`, `content_scripts`, `content_hooks`, `ab_tests`, `scale_up_recommendations`, `publishing_queue`, `creative_guidelines`, `lead_attribution`, `campaign_spend`, `automation_rules`, `designer_queue`
   - Add columns to `content_posts`: `quality_score`, `quality_checks`, `asset_type`, `asset_uploaded_by`, `asset_uploaded_at`, `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `short_link`, `redraft_count`, `research_intel_id`, `shares`, `comments`, `saves`, `video_views`, `leads`
   - Update `status` enum to include `research`, `review`, `asset_pending`, `asset_ready`, `evergreen`

2. **Frontend Tab Restructure**
   - Merge `SocialEngineerTabs.jsx` into `Marketing.jsx`
   - Reorganize to 8 tabs: Calendar, Research, Content Factory, Designer Hub, Analytics, A/B Tests, Scale Up, Automation
   - Create shared component library: `PostCard`, `StatusBadge`, `PillarColorDot`, `PlatformPreview`

3. **Calendar Visual Grid**
   - Build 7-day weekly grid view (7 columns, platform rows)
   - Implement Kanban pipeline view (8 columns: Research → Published)
   - Add drag-and-drop with `@dnd-kit`
   - Add batch operations (multi-select + bulk approve/reschedule/delete)

4. **Designer Queue (Basic)**
   - Table view of posts needing assets
   - Upload asset URL input
   - Status change: `asset_pending` → `asset_ready`

**Deliverable:** You can see a 7-day visual calendar, move posts around, and upload assets.

---

### Phase 2: Intelligence (Week 3-4) — "Research + Quality Gate"

**Goal:** Automate research and protect brand quality.

**Tasks:**
1. **Research Engine Tab**
   - Competitor Radar: CRUD for research_intelligence with urgency colors
   - Viral Topics: Grid of trending topics with relevance scores
   - Policy Watch: Manual entry + alert feed
   - One-click "Create Post from Research" button

2. **Content Factory Tab**
   - AI Generator UI: Input panel with page/pillar/format/topic
   - Quality Gate: Auto-run checks when generating
   - Quality Score Badge: 0-100 with color coding
   - Platform Preview: Facebook/Instagram/TikTok mockup frames
   - UTM Builder: Auto-generate short links

3. **Quality Gate n8n Workflow**
   - Fact-check against `kb_universities` + `kb_scholarships`
   - Banned word detection (list from `config.py` + `13-content-voice-guide`)
   - Banglish tone validation
   - Scholarship figure verification

4. **Hook & Script Library**
   - UI for browsing hooks by performance (usage count, conversion rate)
   - Script library with filtering by format/destination

**Deliverable:** AI generates posts with quality scores, you can preview on all platforms, and research feeds the generator.

---

### Phase 3: Attribution (Week 5-6) — "Analytics + Lead Tracking"

**Goal:** Connect posts to revenue. Know what's working.

**Tasks:**
1. **Lead Attribution System**
   - `lead_attribution` table + API endpoints
   - UTM parameter builder for every post
   - Webhook handler for Meta Lead Ads (`/webhook/meta`) enhanced to store campaign IDs
   - First-touch vs. last-touch attribution queries

2. **Analytics Dashboard (Redesigned)**
   - Overview: Total posts, published, leads, avg reach
   - Funnel: Awareness → Interest → Desire → Action (with conversion rates)
   - Content Performance: Top posts by leads, reach, engagement
   - Attribution by Page: Leads, files, enrolled, revenue per page
   - Consistency Score: % of target posts met
   - Pillar Performance: Which pillars drive leads
   - Time Slots: Best posting times by engagement

3. **Campaign Spend Tracking**
   - `campaign_spend` table + manual entry UI
   - Cost per lead, cost per enrollment, ROAS calculation

4. **A/B Tests + Scale Up (Wired)**
   - Connect existing `SocialEngineerTabs` A/B test UI to main hub
   - Scale Up recommendations with approval workflow
   - Performance Signals (auto-detected from analytics)

**Deliverable:** You can see exactly which posts generated leads, how much revenue each page drives, and which content pillars work.

---

### Phase 4: Automation (Week 7-8) — "Smart Rules + Publishing"

**Goal:** The system runs itself. You just approve.

**Tasks:**
1. **Automation Rules Engine**
   - CRUD for `automation_rules`
   - Rule types: competitor alert, gap filler, engagement booster, deadline alert, designer nudge, quality fail
   - Trigger evaluation engine (runs every hour)
   - Action execution: alerts, draft creation, auto-schedule, evergreen fill

2. **Publishing Engine (n8n)**
   - Auto-publish workflow: pulls `approved` posts due today
   - Meta Graph API integration (Facebook + Instagram)
   - TikTok API integration
   - Error handling + retry logic
   - Publishing queue audit log

3. **Designer Notifications**
   - WhatsApp/Telegram integration for designer alerts
   - Deadline reminders (24h, 4h before)
   - Asset upload confirmation

4. **Performance Sync (n8n)**
   - Daily pull from Meta Insights + TikTok Analytics
   - Auto-update post metrics
   - Auto-generate scale-up recommendations

**Deliverable:** Posts publish automatically, designer gets notified, gaps auto-fill, and you get daily performance reports.

---

### Phase 5: Optimization (Week 9+) — "AI-Assisted Optimization"

**Goal:** The system gets smarter over time.

**Tasks:**
1. **Content Performance Learning**
   - Hook performance leaderboard (which hooks convert best)
   - Pillar performance trends (month-over-month)
   - Page performance comparison
   - Time slot optimization (auto-suggest best times)

2. **Competitor Intelligence Deepening**
   - Post frequency analysis (how often each competitor posts)
   - Engagement rate benchmarking
   - Content gap analysis (what they post that you don't)
   - Ad spend estimation (from Meta Ad Library)

3. **Predictive Scheduling**
   - ML-based best posting time prediction per page
   - Seasonal content recommendations
   - Scholarship deadline alerts with auto-drafting

4. **Advanced Attribution**
   - Multi-touch attribution (first + last + linear)
   - Cohort analysis (students who applied in June vs. December)
   - Lifetime value tracking per channel

**Deliverable:** The system tells you "Post this type of content on Tuesday at 8PM for 2x more leads."

---

## 9. Tech Stack & Dependencies

### Frontend (Existing + New)

| Tech | Purpose | Status |
|---|---|---|
| React 18 | UI framework | ✅ Existing |
| Tailwind CSS | Styling | ✅ Existing |
| Vite | Build tool | ✅ Existing |
| Recharts | Charts | ✅ Existing |
| `@dnd-kit/core` + `sortable` | Drag & drop calendar | 🆕 New |
| `date-fns` | Date math | 🆕 New (lightweight) |
| `clsx` + `tailwind-merge` | Conditional classes | 🆕 New |
| `lucide-react` | Icons | ✅ Existing |

### Backend (Existing + New)

| Tech | Purpose | Status |
|---|---|---|
| Express.js | API server | ✅ Existing |
| SQLite (better-sqlite3) | Database | ✅ Existing |
| n8n | Workflow automation | ✅ Existing |
| Meta Graph API | FB/IG publishing | 🆕 Need keys |
| TikTok API | TikTok publishing | 🆕 Need keys |
| OpenCode / Gemini | LLM generation | ✅ Existing |

### n8n Workflows (New + Existing)

| Workflow | File | Trigger | Phase |
|---|---|---|---|
| Research Engine | `eduexpress-research-engine.json` | Every 6 hours | Phase 2 |
| Weekly Planner | `planner-v2-node-code.js` | Thursday 20:00 | Phase 2 |
| Quality Gate | `eduexpress-quality-gate.json` | Every 2 hours | Phase 2 |
| Designer Assignment | `eduexpress-designer-assign.json` | Every 2 hours | Phase 1 |
| Auto-Publish | `eduexpress-auto-publish.json` | Every 2 hours | Phase 4 |
| Performance Sync | `eduexpress-performance-sync.json` | Daily 6AM | Phase 4 |
| Lead Attribution | `eduexpress-lead-attribution.json` | Webhook (real-time) | Phase 3 |
| Automation Engine | `eduexpress-automation-engine.json` | Every hour | Phase 4 |
| Brain Ingest | `eduexpress-brain-ingest.json` | Weekly | ✅ Existing |

---

## 10. Open Questions for You (Before We Build)

Before we start implementation, we need your input on these decisions:

### A. Designer Workflow
1. **Who is your designer?** Internal team member or external freelancer?
2. **How do they receive briefs now?** WhatsApp, email, or other?
3. **Do you want the designer to log into the CRM, or should we send them a no-login link?**
4. **What design tools do they use?** Canva, Photoshop, CapCut?

### B. Publishing Automation
5. **Do you have Meta Business Suite API access?** (We need `pages_read_engagement`, `pages_manage_posts`, `instagram_basic`, `instagram_content_publish` permissions)
6. **Do you have TikTok API access?** (TikTok for Business account required)
7. **Are you comfortable with auto-publishing, or do you want "approve then publish" (manual final trigger)?**

### C. Content Generation
8. **How many posts per week per page?** Current plan: China 7, BD 7, Instagram 5, TikTok 5 = 24/week. Is this right?
9. **What language mix?** 70% Banglish, 20% Bangla, 10% English? Or different per page?
10. **Do you want AI to generate all posts, or should some be manually written?** (e.g., success stories need real student photos)

### D. Competitor Monitoring
11. **Which 5 competitors should we prioritize for automated monitoring?** (From your list of 15+)
12. **Do you want us to screenshot competitor posts, or just text analysis?**

### E. Offers & Intelligence
13. **Where do you discover new offers/scholarships?** Government websites, university portals, WeChat groups, competitor pages?
14. **Should the system auto-detect when a competitor changes their offer (e.g., "no file opening charge" → "৳5,000 fee")?**

---

## 11. Quick Win: What We Can Ship in 48 Hours

While we discuss the full architecture, here's the **minimum viable redesign** we can implement immediately:

1. **Merge SocialEngineerTabs into Marketing.jsx** — Stop having two disconnected systems
2. **Add Visual Calendar Grid** — 7-day view with color-coded pillars and status badges
3. **Add Designer Queue** — Simple table: "Posts waiting for design" with brief + upload button
4. **Add Quality Score Badge** — Even if manual at first, show 0-100 on each post
5. **Add Platform Badges** — China/BD/Instagram/TikTok color-coded on every post card
6. **Fix the Reject/Redraft Flow** — Rejection with reason → AI auto-redrafts (n8n)

**This gives you immediate control over the 7-day buffer and designer handoff.**

---

**Let's discuss this architecture. What do you like? What do you want to change? Which phase should we start with?**
