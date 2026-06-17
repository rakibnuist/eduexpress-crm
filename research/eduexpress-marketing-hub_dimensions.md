# Dimension Decomposition — EduExpress Marketing Hub

**Date:** 2026-06-17
**Route:** D (File-Augmented + External Search)
**Dimensions:** 12 (meets ≥10 minimum)
**Overlap target:** ≥30% conceptual overlap between related dimensions

---

## Dimension 01: Lead Attribution & Marketing ROI
**Angle:** Revenue-focused analytics — connecting every marketing touchpoint to pipeline and enrollment revenue.
**Scope:** How to implement lightweight UTM tracking, first-touch/last-touch attribution, and cost-per-enrollment calculation in the existing CRM. Join `content_posts` ↔ `leads` via UTM/content_id. Connect $250/mo ad spend to actual service revenue.
**Expected sources:** CRM schema analysis, file spec (08), external research on attribution models (Search 3, 7), Oktopost best practices.
**File context:** 08-crm-marketing-module-spec mentions "lead attribution by destination" but no implementation exists. 03-meta-ad-campaign has budget data but no CRM tracking.

## Dimension 02: Marketing Funnel Visualization
**Angle:** Stage-aware funnel dashboard for education consultancy operations.
**Scope:** Design a funnel view (Awareness → Interest → Counselling → Application → Enrolled) with conversion rates at each stage, drop-off analysis, and cohort tracking. Integrate with existing recharts setup. Show lead source contribution at each stage.
**Expected sources:** File specs (08, 14), external research on funnel dashboards (Search 7), Meritto/SmartX CRM features (Search 2, 8), Improvado funnel design principles.
**File context:** 08 mentions analytics tab but only has basic reach/engagement charts. No funnel view exists.

## Dimension 03: Content Quality & Approval Workflow
**Angle:** Brand voice compliance and automated pre-approval scoring.
**Scope:** Build a content quality score (hook strength, Banglish compliance, fact-checking against kb_universities/kb_scholarships, banned word detection). Implement tiered approval: auto-approve evergreen/low-risk → review required for deadline-sensitive/high-risk. Rejection redraft workflow with reason tracking.
**Expected sources:** File specs (02, 13, 14), external research on approval workflows (Search 6), AI content quality scoring (Search 6).
**File context:** 13-content-voice-guide has truth rules and banned hooks. 02-content-engine has pillar framework. Current CRM has status flow (drafted→approved→edit→rejected) but no automated checks.

## Dimension 04: Customer Psychology & Audience Segmentation
**Angle:** Bangladesh student + parent decision journey and content personalization.
**Scope:** Map the psychological triggers for Bangladeshi students (aspiration, peer proof, cost anxiety) vs. parents (safety, ROI, transparency). Design content segmentation by audience type. Implement lead tagging by psychographic profile (e.g., "cost-focused", "prestige-focused", "scholarship hunter"). Best posting times by audience.
**Expected sources:** File specs (01, 02, 13), external research on parent psychology (Search 4), TikTok behavior (Search 5), competitor analysis.
**File context:** 01-competitor-analysis identifies "real numbers" as the trust gap. 02-content-engine targets parents on Facebook, students on TikTok/IG. No formal segmentation exists in CRM.

## Dimension 05: Competitor Intelligence Dashboard
**Angle:** From CRUD table to automated competitive insights and gap detection.
**Scope:** Enhance the competitor_intel table with trend analysis (what competitors are posting, which pillars they use, frequency analysis). Add a "competitive gap radar" showing what EduExpress posts that rivals don't. Automated alerts when competitors post about new destinations or scholarships.
**Expected sources:** File specs (01, 08), external research on competitive intelligence tools, Meta Ad Library API (mentioned in 15-apis-to-enable).
**File context:** 01 maps 15 competitors. 08 has competitor_intel CRUD table. No analytics or insights layer exists.

## Dimension 06: Campaign Management & Paid Ads Integration
**Angle:** Meta ad campaign tracking inside the CRM marketing hub.
**Scope:** Build a campaign management tab to track C1 (China/Korea), C2 (Hungary/UK), C3 (Retargeting) campaigns. Store CPL, budget, reach, leads generated per campaign. Connect to Meta webhook data. Show paid vs. organic performance side-by-side.
**Expected sources:** File spec (03), external research on Facebook attribution (Search 3), HubSpot ad management features (Search 5).
**File context:** 03-meta-ad-campaign has full campaign plan but no CRM UI. Meta webhook `/webhook/meta` already exists in server.js. Pixel + CAPI configured.

## Dimension 07: Multi-Channel Publishing & Content Calendar
**Angle:** Professional content calendar with drag-and-drop, visual scheduling, and cross-platform management.
**Scope:** Redesign the calendar view as a visual weekly grid (not just a list). Add drag-and-drop rescheduling. Show platform icons (FB, IG, TikTok) per post. Color-code by pillar. Batch operations (approve week, reschedule multiple). Buffer/queue view for evergreen fallback.
**Expected sources:** File specs (02, 04, 08), external research on social media management tools (Search 1), best practices for content calendars.
**File context:** 04-automation-master-plan describes 7-stage weekly loop. 08 has basic calendar list view. Current Marketing.jsx has a simple grouped list.

## Dimension 08: Analytics & Performance Dashboard
**Angle:** Advanced marketing analytics beyond basic reach/engagement.
**Scope:** Add consistency score (% of planned posts published on time), engagement rate by pillar, best-performing time slots, reach velocity, content decay rate, audience growth trends. Comparison charts (this week vs. last week). Lead-to-content correlation.
**Expected sources:** File specs (04, 08), external research on marketing analytics (Search 3, 7), HubSpot analytics features.
**File context:** 04 sets success metrics (consistency, growth, engagement, pipeline, efficiency). 08 has basic recharts. No advanced metrics implemented.

## Dimension 09: Knowledge Management & Data Center Enhancement
**Angle:** Making the Data Center a true competitive intelligence and content fuel source.
**Scope:** Enhance kb_universities, kb_scholarships, kb_sources with verification status, expiration alerts (deadline approaching), and content generation links ("generate post about this scholarship"). Add a "Content Brain" view showing which facts are being used in current posts. Cross-reference fact usage with post performance.
**Expected sources:** File specs (06, 14), external research on knowledge management for content teams.
**File context:** 06-data-center-and-google-setup defines the Data Center. 14-content-architecture describes 3-layer knowledge architecture. Current Data Center is basic CRUD tables.

## Dimension 10: Brain Pool & API Rotation UX
**Angle:** Professional API management with usage analytics and predictive alerting.
**Scope:** Enhance Brain Pool with usage charts (requests per key over time), cost estimation, predictive exhaustion alerts ("Gemini_1 will exhaust in 3 hours at current rate"), automatic fallback visualization. Health status with color coding. Add a "Test Brain" feature to verify all keys are working.
**Expected sources:** File spec (07), external research on API management dashboards.
**File context:** 07-brain-api-rotation has full logic but basic UI. Current BrainTab is a simple CRUD table.

## Dimension 11: Marketing Automation Rules & Triggers
**Angle:** Marketing-specific automation beyond general conversation rules.
**Scope:** Add automation rules specific to marketing: "if post reaches X engagement, alert team", "if competitor posts about CSC, draft counter-post", "if deadline approaching in 7 days, auto-schedule reminder post", "if no posts planned for tomorrow, pull from evergreen bank". Integrate with existing Automation.jsx rules engine.
**Expected sources:** File specs (04, 08), external research on marketing automation (Search 2, 8).
**File context:** Automation.jsx has general rules (keyword, no_response, time_based). No marketing-specific triggers exist.

## Dimension 12: Brand Safety & Risk Management
**Angle:** Automated guardrails to prevent brand-damaging content from publishing.
**Scope:** Implement pre-publish checks: fact verification against kb_sources, banned word detection ("guaranteed visa", "100% success"), image/asset URL validation, scholarship figure verification, student consent check for stories. Add an "Emergency Pause" button to halt all publishing. Content rollback capability.
**Expected sources:** File specs (13, 14), external research on content approval workflows (Search 6), brand protection tools.
**File context:** 13-content-voice-guide has truth rules and banned hooks. 14 has hard rules about success stories. No automated enforcement exists.

---

## Dimension Clustering & Overlap Map

| Dimension | Overlaps with | Overlap % | Shared concepts |
|---|---|---|---|
| 01 Lead Attribution | 02 Funnel, 06 Campaigns, 08 Analytics | 35% | Pipeline tracking, conversion rates, revenue connection |
| 02 Funnel | 01 Attribution, 04 Psychology, 08 Analytics | 40% | Stage progression, drop-off analysis, cohort tracking |
| 03 Content Quality | 12 Brand Safety, 07 Calendar, 11 Automation | 35% | Approval workflow, pre-checks, brand compliance |
| 04 Psychology | 02 Funnel, 07 Calendar, 09 Knowledge | 30% | Audience segmentation, content personalization, timing |
| 05 Competitor Intel | 09 Knowledge, 11 Automation, 08 Analytics | 30% | Intelligence gathering, automated alerts, gap analysis |
| 06 Campaigns | 01 Attribution, 08 Analytics, 11 Automation | 35% | Paid tracking, budget management, ROI calculation |
| 07 Calendar | 03 Quality, 11 Automation, 08 Analytics | 40% | Scheduling, batch ops, visual management, consistency |
| 08 Analytics | 01 Attribution, 02 Funnel, 06 Campaigns | 45% | Metrics, charts, trends, performance comparison |
| 09 Knowledge | 05 Competitor, 03 Quality, 04 Psychology | 30% | Data verification, content fuel, fact accuracy |
| 10 Brain Pool | 11 Automation, 03 Quality, 08 Analytics | 25% | API health, AI content generation, usage optimization |
| 11 Automation | 07 Calendar, 05 Competitor, 06 Campaigns | 35% | Trigger-based actions, smart scheduling, gap filling |
| 12 Brand Safety | 03 Quality, 09 Knowledge, 11 Automation | 35% | Pre-publish checks, banned content, emergency controls |

**Average overlap:** ~34% — meets the ≥30% requirement for cross-verification pressure.

