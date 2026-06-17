## Dimension 06: Campaign Management & Paid Ads Integration

### Key Findings

- Meta Marketing API v18+ provides hierarchical insights via `GET /{object_id}/insights` at campaign, ad set, or ad level, returning 70+ metrics including `spend`, `impressions`, `clicks`, `actions`, `cost_per_action_type`, and `leads` [^1]. For EduExpress’s $250/mo account, the most restrictive limit is the **5 insights requests per minute per ad account** cap, making async jobs essential for daily reporting [^2].
- The CRM already captures paid lead metadata via the existing Meta webhook (`/webhook/meta`): `leads.meta_form_id`, `leads.meta_ad_id`, and `leads.meta_campaign` are stored in the SQLite schema, enabling native join between ad platform identifiers and internal lead records [^3].
- A lightweight CRM integration should **mirror Meta’s hierarchy** in SQL: `meta_campaigns` → `meta_adsets` → `meta_ads` for metadata, plus `meta_insights_daily` for time-series performance facts, joined on `meta_campaign_id` and `date` [^4].
- CPL for education globally averages **$7–$12** (2026), while Bangladesh Facebook Ads CPL for education services typically falls in the **৳100–৳1,000+** range ($0.65–$8.00+). Superads data shows Education CPL ran ~45% below global benchmarks, averaging **$15–$21** across all countries [^5]. EduExpress’s $0.65 estimated CPL is well within the viable Bangladesh band.
- Retargeting campaigns (C3) should be measured by **ROAS (4–10x typical for bottom-funnel SaaS retargeting)**, **CTR**, **conversion rate**, and **frequency** (alarm threshold >3.5) [^6]. Retargeting audiences (video viewers ≥50%, form openers, page engagers) convert at 2–3× the rate of cold traffic at roughly half the CPL [^7].
- Lookalike audience performance follows a **tiered CPL curve**: 1% lookalike delivers the lowest CPL (AdEspresso study: $3.75 CPL vs. $6.36 for 10%), while 5% and 10% tiers sacrifice cost efficiency for scale [^8]. Best practice: start at 1% to establish a baseline, then expand systematically only after validating CPA efficiency [^9].
- Closed-loop attribution requires joining **Meta campaign data (spend, campaign_id)** with **CRM lead data (lead_status, service_fee, assigned_consultant)** using the `meta_campaign` field already present on the `leads` table, plus UTM parameters for non-Lead-Ad traffic [^10]. Platforms optimize for the signals you send back; feeding CRM revenue milestones to Meta via CAPI improves targeting quality [^11].
- UTM governance is critical: use `utm_medium=paid_social` for Meta ads and `utm_medium=social` for organic posts to prevent attribution mixing. Dynamic UTM parameters (`{campaignid}`, `{adsetid}`) eliminate manual errors and should be captured in hidden CRM fields [^12]. Persistent attribution (cookie/localStorage) is recommended for B2B/education sales cycles where decisions span weeks [^13].
- Pixel + CAPI hybrid tracking with deduplication is the **industry-standard redundant setup**. Use matching `event_id` + `event_name` on both Pixel and CAPI payloads; target >90% deduplication rate in Events Manager [^14].
- Campaign management UI best practices include: **budget pacing cards** (green 95–105%, yellow 85–95%/105–115%, red outside), **daily burn rate** vs. target daily budget, **projected month-end spend**, and **CPL/CPA by campaign side-by-side** with organic performance [^15].
- SQL schema should store **daily snapshots** (not just live API reads) because Meta limits historical breakdown data to 13 months and deleted ads lose data permanently [^16].

### Implementation Approaches

**Approach A: Lightweight Meta Insights Sync (Recommended for EduExpress)**
- **What it is:** A nightly cron job (or n8n workflow) calls `GET /act_{AD_ACCOUNT_ID}/insights` with `level=campaign` and `time_increment=1`, requesting fields: `campaign_name`, `campaign_id`, `adset_id`, `adset_name`, `spend`, `impressions`, `clicks`, `actions`, `reach`, `frequency`. Data is upserted into `meta_insights_daily` (campaign+date unique key).
- **Pros:** Fits the existing sql.js stack without external data warehouse; minimal API calls (~1 per day); leverages the already-stored `meta_campaign` on leads.
- **Cons:** No real-time ad set / ad level granularity; ad account rate limit requires queuing if scaling beyond ~3 campaigns.
- **Pseudocode:**
```js
const fields = 'campaign_name,campaign_id,adset_name,adset_id,spend,impressions,clicks,actions,reach,frequency';
const url = `https://graph.facebook.com/v18.0/act_${ACT_ID}/insights?level=campaign&fields=${fields}&time_increment=1&date_preset=yesterday&access_token=${TOKEN}`;
// paginate, then upsert into meta_insights_daily using (campaign_id, adset_id, date)
```

**Approach B: Full Hierarchy Sync (Campaign + Ad Set + Ad + Creative)**
- **What it is:** Store dimension tables for `meta_campaigns`, `meta_adsets`, `meta_ads`, and `meta_creatives`, refreshed daily, plus a fact table `meta_insights_daily` at ad-level granularity.
- **Pros:** Enables creative fatigue detection, exact ad-to-lead matching, and full-funnel cost-per-acquisition by individual ad.
- **Cons:** High API volume; for a $250/mo account this is overkill unless the team tests 20+ creatives weekly. Requires careful pagination and async job handling.
- **Pseudocode:**
```sql
-- Dimensions
CREATE TABLE meta_campaigns (id TEXT PRIMARY KEY, name TEXT, objective TEXT, status TEXT, updated_at TEXT);
CREATE TABLE meta_adsets (id TEXT PRIMARY KEY, campaign_id TEXT, name TEXT, daily_budget INTEGER, targeting TEXT, status TEXT);
CREATE TABLE meta_ads (id TEXT PRIMARY KEY, adset_id TEXT, name TEXT, creative_id TEXT, status TEXT);
-- Facts
CREATE TABLE meta_insights_daily (
  date TEXT, campaign_id TEXT, adset_id TEXT, ad_id TEXT,
  spend REAL, impressions INTEGER, clicks INTEGER, leads INTEGER,
  reach INTEGER, frequency REAL,
  PRIMARY KEY (date, campaign_id, adset_id, ad_id)
);
```

**Approach C: Closed-Loop CRM Reporting (Join Spend + Revenue)**
- **What it is:** Build a dashboard query that joins `meta_insights_daily` (spend) with `leads` (meta_campaign → campaign_id, status, service_fee) to calculate true CPL, cost-per-counselling-booking, and cost-per-enrolled-student.
- **SQL pseudocode:**
```sql
SELECT
  i.date,
  i.campaign_id,
  i.campaign_name,
  SUM(i.spend) AS spend,
  COUNT(l.id) AS leads,
  SUM(CASE WHEN l.lead_status = 'Enrolled' THEN 1 ELSE 0 END) AS enrolled,
  SUM(i.spend) / NULLIF(COUNT(l.id), 0) AS cpl,
  SUM(i.spend) / NULLIF(SUM(CASE WHEN l.lead_status = 'Enrolled' THEN 1 ELSE 0 END), 0) AS cpa
FROM meta_insights_daily i
LEFT JOIN leads l ON l.meta_campaign = i.campaign_id
   AND (l.date_added = i.date OR substr(l.created_at, 1, 10) = i.date)
GROUP BY i.date, i.campaign_id;
```
- **Pros:** Answers the north-star question: “What is our cost per qualified counselling booking / enrollment?”—not just raw CPL.
- **Cons:** Attribution window alignment between Meta (7-day click / 1-day view default) and CRM (date_added) requires careful handling; last-touch bias should be acknowledged.

**Approach D: UTM + Lead-Form Hybrid Attribution**
- **What it is:** For non-Lead-Ad traffic (e.g., link clicks, retargeting carousel), append UTM tags (`utm_source=meta`, `utm_medium=paid_social`, `utm_campaign=c1_china_korea`, `utm_content=video_a`) to landing pages. Capture these into `leads` via hidden form fields or webhook payload enrichment, then join back to `content_posts` and `meta_insights_daily`.
- **Pros:** Separates paid from organic Meta traffic; works across link ads, Messenger, and Instagram placements.
- **Cons:** UTM parameters drop on navigation unless persistent attribution cookies are implemented; requires JavaScript snippet on eduexpressint.com.

### Data Points & Statistics

- **Meta Insights API:** Processes 100B+ data points daily; supports 70+ metrics and 20+ breakdown dimensions [^1].
- **Rate limit:** 5 insights requests per minute per ad account is the most restrictive gate for reporting automation [^2].
- **Education CPL (global):** Median ~$21.1; low $15.35 (Jun 2025), high $28.97 (Feb 2026); ~45% below global benchmark [^5].
- **Bangladesh CPC:** ৳5–20 (~$0.06–$0.23); education CPA ৳100–1,000+ (~$0.65–$6.50+) depending on lead quality and destination [^17].
- **Lookalike CPA tiering:** 1% LAL = $3.75 CPL; 10% LAL = $6.36 CPL (70% higher) in AdEspresso’s $1,500 experiment [^8].
- **Retargeting ROAS:** Bottom-funnel SaaS retargeting achieves 4–10x ROAS; hybrid Pixel + CAPI improves event coverage from ~55% to ~90–95% [^6] [^14].
- **Budget pacing thresholds:** 95–105% = on track; 85–95% or 105–115% = warning; <85% or >115% = critical [^15].
- **Closed-loop impact:** Without CRM join, up to 30–40% of ad budget may be allocated to campaigns that generate clicks but not revenue [^10].
- **Frequency fatigue:** CTR declines 15%+ over 3–5 days when frequency exceeds 3.5x; creative refresh recommended [^6].
- **CAPI deduplication:** Target >90% of browser events to have matching server events; 48-hour deduplication window [^14].

### SQL Schema Suggestions (Lightweight, SQLite-compatible)

```sql
-- Dimension: campaigns synced from Meta API
CREATE TABLE IF NOT EXISTS meta_campaigns (
  id TEXT PRIMARY KEY,
  name TEXT,
  objective TEXT,
  status TEXT,
  budget REAL,
  budget_type TEXT, -- daily / lifetime
  created_at TEXT,
  updated_at TEXT
);

-- Dimension: ad sets (optional for lightweight; can defer to v2)
CREATE TABLE IF NOT EXISTS meta_adsets (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES meta_campaigns(id),
  name TEXT,
  daily_budget REAL,
  targeting_summary TEXT, -- JSON of geo/age/demographic
  status TEXT,
  updated_at TEXT
);

-- Facts: daily performance snapshots (the core reporting table)
CREATE TABLE IF NOT EXISTS meta_insights_daily (
  date TEXT NOT NULL,
  campaign_id TEXT NOT NULL REFERENCES meta_campaigns(id),
  adset_id TEXT,
  ad_id TEXT,
  spend REAL DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  leads INTEGER DEFAULT 0,
  reach INTEGER DEFAULT 0,
  frequency REAL,
  cpm REAL,
  cpc REAL,
  ctr REAL,
  cost_per_lead REAL,
  PRIMARY KEY (date, campaign_id, adset_id, ad_id)
);

-- Index for CRM joins
CREATE INDEX IF NOT EXISTS idx_insights_campaign_date ON meta_insights_daily(campaign_id, date);

-- Campaign-to-CRM mapping (joins to leads.meta_campaign)
-- leads.meta_campaign already exists; add index if not present
CREATE INDEX IF NOT EXISTS idx_leads_meta_campaign ON leads(meta_campaign);
CREATE INDEX IF NOT EXISTS idx_leads_date_added ON leads(date_added);
```

### Sources

- [^1]: Meta Ads API: Step-by-Step Setup Guide (2026). AdManage. 2025-11-10. https://admanage.ai/blog/meta-ads-api
- [^2]: Meta Ads API Insights — Breakdowns and Action Types Reference. Ryze. 2026-05-10. https://www.get-ryze.ai/blog/meta-ads-api-insights-endpoint-campaigns-impressions-clicks-spend-leads
- [^3]: EduExpress CRM server.js schema (existing `leads.meta_campaign`, `leads.meta_ad_id`, `leads.meta_form_id` columns) and `Marketing Automation/03-meta-ad-campaign.md`
- [^4]: How to connect Meta Ads data to Google BigQuery. Renta. 2026-02-27. https://renta.im/blog/connect-meta-ads-to-bigquery/
- [^5]: Facebook Ads Cost Per Lead Benchmarks for Education. SuperAds. 2026. https://www.superads.ai/facebook-ads-costs/cost-per-lead/education
- [^6]: Top Metrics for Ad Set Prioritization in Meta Ads. Adamigo. 2026-06-12. https://www.adamigo.ai/blog/top-metrics-for-ad-set-prioritization-in-meta-ads
- [^7]: Maximizing ROI with Effective Retargeting Ads Strategies. Gimaev. 2025-06-05. https://www.gimaev.com.au/maximizing-roi-with-effective-retargeting-ads-strategies/
- [^8]: The $1,500 Facebook Audience Experiment: 1% vs. 5% vs. 10% Lookalike. AdEspresso. 2017-06-01. https://adespresso.com/blog/adespresso-experiment-facebook-lookalike-audience/
- [^9]: Meta Lookalike Audiences Explained. Pixis. 2025-06-04. https://pixis.ai/blog/meta-lookalike-audiences/
- [^10]: How to Join CRM Data with Ad Data: A Step-by-Step Guide. Cometly. 2026-05-11. https://www.cometly.com/post/crm-ad-data-join
- [^11]: Paid Ads Attribution Problems: Why Your Data Is Misleading You. Cometly. 2026-05-05. https://www.cometly.com/post/paid-ads-attribution-problems
- [^12]: UTM Tracking Best Practices: 8 Tips for Attribution. Cometly. 2026-05-11. https://www.cometly.com/post/utm-tracking-best-practices
- [^13]: UTM Tracking vs Persistent Attribution: Key Differences. Madlitics. 2026. https://www.madlitics.com/articles/utm-tracking-vs-persistent-attribution-key-differences
- [^14]: Meta Conversions API: Complete Guide for 2025. BudIndia. 2026-06-16. https://www.budindia.com/blog/meta-conversion-api-complete-guide-for-2025.php
- [^15]: Google Ads Budget Pacing: How to Track Spend in Real-Time. Insightful Pipe. 2025-11-26. https://insightfulpipe.com/blog/google-ads-budget-pacing-guide
- [^16]: Meta Ads API: Step-by-Step Setup Guide — “Best Practices” section on historical data. AdManage. 2025-11-10. https://admanage.ai/blog/meta-ads-api
- [^17]: Bangladesh Facebook Ads 2025: Cost Benchmarks, CTR/CPA Ranges. Kuiperz. 2026-02-14. https://kuiperz.io/blog/bangladesh-facebook-ads-2025-cost-benchmarks-ctr-cpa-ranges-and-a-simple-budget-calculator/

---
*End of Dimension 06 Research*
