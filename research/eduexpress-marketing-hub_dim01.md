## Dimension 01: Lead Attribution & Marketing ROI

### Key Findings

- **UTM parameters are the minimum-viable attribution layer** for a small CRM. Adding `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, and `utm_term` to every social post and landing-page link lets you trace a lead back to the exact post or ad variant that drove it, without paid tools [^1][^2]. For organic social, `utm_medium=social` and `utm_source=facebook|instagram` are the standard; `utm_content` can hold the `content_post.id` from the CRM’s own `content_posts` table [^2][^3].

- **Meta Lead Ads webhooks can transmit campaign-level IDs** (`campaign_id`, `adset_id`, `ad_id`, `form_id`) directly into the CRM, but only if the webhook handler stores them immediately. Many small CRMs drop this data because they only map contact fields (name, email, phone) and ignore the `field_data` envelope [^4][^18]. The Frappe CRM community explicitly lists `page_id`, `form_id`, `ad_id`, `adset_id`, `campaign_id` as “must-store” attribution fields for any Meta Lead Ads integration [^19].

- **First-touch and last-touch attribution can be implemented in pure SQLite** with simple window functions or self-joins. First-touch uses `MIN(created_at)` per lead; last-touch uses the most recent `campaign_id` before a conversion event. These models are computationally cheap and require no external BI tool [^5][^6].

- **Cost-per-enrollment (CPE) is the north-star metric** for education consultancies. Higher-ed benchmarks show an average Cost Per Inquiry (CPI) of **$140** and an average Cost Per Enrolled Student of **$2,849** (UPCEA × Search Influence 2024 study) [^7][^8]. For a small consultancy like EduExpress, tracking CPE by destination country (China, Korea, UK, Hungary, Malta, Cyprus, Georgia) and by campaign tier (C1, C2, C3) is more actionable than aggregate CPL.

- **Revenue attribution = attributed enrollment revenue ÷ total campaign spend**. In a services business (consultancy fees, not tuition), the “revenue” per enrollment is the net service fee received. A lightweight CRM should store `enrollment_value` on the `leads` table once a student confirms, then join that back to the `source_campaign` captured at lead creation [^9][^13].

- **Attribution windows matter for education**. A 7-day window is too short for study-abroad decisions; 30–60 days is more realistic because students research for weeks before applying [^12]. The CRM should therefore store the original `first_touch_date` and allow revenue to be credited back to the first touch even if the enrollment happens 45+ days later.

- **WhatsApp, walk-ins, and referrals are “dark” sources** that lack automatic UTM or click-IDs. Best practice is to require the counselor to select a source from a controlled dropdown (e.g., `whatsapp_organic`, `walk_in`, `referral_agent`) or to generate a unique QR code / short link per offline event that carries UTM parameters into the landing page [^16][^20].

- **Dashboards should be role-specific and under 10 tiles**. Research shows that small teams abandon dashboards with >10 metrics; the effective set for an education consultancy is: (1) Cost per enrollment by campaign, (2) Inquiry-to-application rate, (3) Application-to-enrollment rate, (4) Lead volume by source, (5) Revenue attributed to marketing, (6) Response time to leads [^14][^15].

- **sql.js (SQLite in the browser / Node.js)** is powerful for lightweight CRMs but in-memory by default. Marketing analytics queries (group-by campaign, spend joins, attribution windows) run fast in SQLite, yet the database must be serialized to disk or IndexedDB after each write so attribution data survives a reload [^17].

- **UTM inconsistency is the #1 cause of attribution failure**. Using `facebook`, `fb`, `FB`, and `meta` interchangeably fragments reporting into phantom channels. A single “UTM builder” page inside the CRM—where marketers pick from dropdowns rather than typing free text—prevents this [^6][^11].

---

### Implementation Approaches

#### 1. “UTM + Content ID” Join for Social Posts
**Approach:** Add a `content_id` UTM parameter to every link shared from the CRM’s `content_posts` table. When a lead arrives, store the full UTM set in a `lead_attribution` table.

**Schema pseudocode:**
```sql
CREATE TABLE lead_attribution (
  lead_id INTEGER PRIMARY KEY,
  first_touch_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,        -- stores content_posts.id
  utm_term TEXT,
  meta_campaign_id TEXT,
  meta_adset_id TEXT,
  meta_ad_id TEXT,
  meta_form_id TEXT,
  FOREIGN KEY (lead_id) REFERENCES leads(id)
);
```
**Pros:** Zero external cost; works for organic and paid.  
**Cons:** Requires discipline—every link must be tagged; counselors must not strip parameters when copying links into WhatsApp.  
[^1][^2][^3]

#### 2. Meta Lead Ads Webhook Attribution
**Approach:** Extend the existing `/webhook/meta` endpoint to read the `ad_id`, `adset_id`, `campaign_id`, and `form_id` fields from the payload (or from the Graph API if the token has `ads_read` + `leads_retrieval`). Map them to the `lead_attribution` table at creation time.

**Pseudocode (Node.js/Express):**
```js
app.post('/webhook/meta', async (req, res) => {
  const lead = req.body;
  const leadId = await db.run(
    `INSERT INTO leads (name, email, phone, status) VALUES (?, ?, ?, 'new')`,
    [lead.name, lead.email, lead.phone]
  );
  await db.run(
    `INSERT INTO lead_attribution (lead_id, meta_campaign_id, meta_adset_id, meta_ad_id, meta_form_id, utm_source, utm_medium)
     VALUES (?, ?, ?, ?, ?, 'facebook', 'paid_social')`,
    [leadId.lastID, lead.campaign_id, lead.adset_id, lead.ad_id, lead.form_id]
  );
  res.sendStatus(200);
});
```
**Pros:** Fully automated; no manual tagging needed for Lead Ads.  
**Cons:** The API sometimes omits `ad_id`/`campaign_id` for organic leads or when the page lacks ad-account permissions; you need a fallback to `is_organic` flagging [^4][^18][^19].

#### 3. First-Touch vs. Last-Touch Attribution in SQLite
**Approach:** Add a `touchpoints` table to record every interaction (click, form open, message). Run two simple queries to compute attribution.

**First-touch query:**
```sql
SELECT t.channel, t.campaign, SUM(l.enrollment_value) AS attributed_revenue
FROM leads l
JOIN (
  SELECT lead_id, MIN(touched_at) AS first_at
  FROM touchpoints
  GROUP BY lead_id
) ft ON l.id = ft.lead_id
JOIN touchpoints t ON ft.lead_id = t.lead_id AND ft.first_at = t.touched_at
WHERE l.status = 'enrolled'
GROUP BY t.channel, t.campaign;
```

**Last-touch query:**
```sql
SELECT t.channel, t.campaign, SUM(l.enrollment_value) AS attributed_revenue
FROM leads l
JOIN (
  SELECT lead_id, MAX(touched_at) AS last_at
  FROM touchpoints
  WHERE touched_at <= l.enrolled_at
  GROUP BY lead_id
) lt ON l.id = lt.lead_id
JOIN touchpoints t ON lt.lead_id = t.lead_id AND lt.last_at = t.touched_at
WHERE l.status = 'enrolled'
GROUP BY t.channel, t.campaign;
```
**Pros:** No extra software; works in sql.js.  
**Cons:** Single-touch models undervalue nurture channels (e.g., WhatsApp follow-up). For a small consultancy, starting with first-touch is recommended because it credits the channel that introduced the student [^5][^6].

#### 4. Cost-Per-Enrollment Tracking
**Approach:** Maintain a `campaign_spend` table (daily or weekly) and join it to enrolled leads by campaign name or ID.

```sql
CREATE TABLE campaign_spend (
  id INTEGER PRIMARY KEY,
  campaign_id TEXT,
  campaign_name TEXT,
  date TEXT,
  spend DECIMAL(10,2),
  channel TEXT
);

-- Cost per enrollment by campaign (last 90 days)
SELECT
  a.meta_campaign_id,
  c.campaign_name,
  SUM(c.spend) AS total_spend,
  COUNT(DISTINCT l.id) AS enrollments,
  ROUND(SUM(c.spend) / NULLIF(COUNT(DISTINCT l.id), 0), 2) AS cost_per_enrollment,
  SUM(l.enrollment_value) AS attributed_revenue,
  ROUND(SUM(l.enrollment_value) / NULLIF(SUM(c.spend), 0), 2) AS roas
FROM leads l
JOIN lead_attribution a ON l.id = a.lead_id
JOIN campaign_spend c ON a.meta_campaign_id = c.campaign_id
WHERE l.status = 'enrolled'
  AND l.enrolled_at >= date('now', '-90 days')
GROUP BY a.meta_campaign_id, c.campaign_name;
```
**Pros:** Directly answers “Is this $4/day China campaign profitable?”  
**Cons:** Requires manual or API-driven import of Meta spend; offline sources (walk-ins) have no digital spend to join.  
[^7][^8][^13]

#### 5. Lightweight Marketing ROI Dashboard (React + SQLite)
**Approach:** Build a single-page dashboard inside the existing React app with six tiles, querying the SQLite backend via the existing API layer.

**Recommended tiles:**
1. **Total attributed revenue** (this month vs. last month)
2. **Cost per enrollment** by campaign tier (C1, C2, C3)
3. **Lead volume by source** (pie/bar chart)
4. **Funnel conversion rates** (Inquiry → Application → Enrollment)
5. **Average response time** (hours from lead creation to first counselor contact)
6. **Top-performing content posts** (leads attributed per post via `utm_content`)

**Pros:** Uses the same stack (React + sql.js/Express); no third-party BI cost.  
**Cons:** Requires frontend charting library (e.g., Recharts or Tremor blocks).  
[^14][^15][^17]

#### 6. Offline / WhatsApp Source Tagging
**Approach:** Create a controlled `lead_source` picklist with values such as `meta_lead_ad`, `meta_organic`, `google_ads`, `whatsapp_organic`, `walk_in`, `referral_agent`, `education_fair`. Store it in `lead_attribution.source` and enforce it at the point of lead creation (webhook, form, or manual entry).

For education fairs, generate a short link or QR code per event that points to a landing page with `utm_source=education_fair&utm_campaign=dhaka_feb_2026`. Scanning the code pre-fills the attribution fields.

**Pros:** Captures dark-social/offline sources that UTM alone cannot.  
**Cons:** Manual entry is error-prone; the CRM UI should disable free-text entry.  
[^16][^20]

---

### Data Points & Statistics

| Stat | Value | Source |
|------|-------|--------|
| Average Cost Per Inquiry (higher ed) | **$140** (median $106) | Search Influence / UPCEA 2024 [^7][^8] |
| Average Cost Per Enrolled Student (higher ed) | **$2,849** | UPCEA × Search Influence 2024 [^8] |
| % of higher-ed marketers tracking CPI | **46%** | Search Influence study [^8] |
| % tracking cost per enrolled student | **43%** | Search Influence study [^8] |
| Inquiry-to-application conversion (strong) | **15–25%** | Edvisorly / Carnegie [^9][^24] |
| Application-to-enrollment yield | **20–40%** | Edvisorly / Carnegie [^9][^24] |
| Meta Ads default click window | **7-day** (was 28-day pre-iOS 14.5) | Meta / Ryze AI [^12] |
| Google Ads default click window | **30-day** | Google Ads Help [^12] |
| Recommended window for education consultancies | **30–60 days** | Pedowitz Group / attribution best practices [^9][^12] |
| CRM-driven enrollment growth (education consultancy case) | **+30%** year-one | SmartX CRM case study [^16] |
| Lead-to-enrollment lift after CRM implementation | **22% → 38%** | SmartX CRM case study [^16] |
| Dashboard adoption jump with role-specific views | **23% → 87%** | Dataslayer best-practices report [^14] |
| WhatsApp / walk-in / manual lead leakage without CRM | **>30%** lost | Trevion CRM / industry reports [^16] |
| sql.js WASM payload | ~**1.5 MB** | sql.js documentation [^17] |

---

### Sources

- [^1]: What are UTM Parameters and How to Use Them. TemplateToaster. 2023-07-12. https://blog.templatetoaster.com/utm-parameters-ultimate-guide/
- [^2]: How to Use UTM Parameters to Track Organic Social Media Posts. Attributer. 2025-03-25. https://attributer.io/blog/utm-parameters-organic-social-posts
- [^3]: How to Track UTM Parameters in your CRM: A Complete Guide. TerminusApp. 2023-03-23. https://www.terminusapp.com/blog/utm-parameters-in-your-crm/
- [^4]: What CRM Integrations Streamline Meta Lead Management? ROASPIG. 2026-01-15. https://roaspig.com/blog/crm-integrations-streamline-meta-leads
- [^5]: First and Last Touch Attribution Models in SQL. Snowplow. 2024-11-13. https://snowplow.io/blog/first-and-last-touch-attribution-models-in-sql-a-comprehensive-tutorial
- [^6]: Modeling marketing attribution. dbt (Fishtown Analytics). 2020-03-16. https://www.getdbt.com/blog/modeling-marketing-attribution
- [^7]: Track and Report the Right Higher Ed Marketing Analytics. Search Influence. 2026-06-04. https://www.searchinfluence.com/blog/track-and-report-the-right-higher-ed-marketing-analytics-to-improve-your-strategy/
- [^8]: How Higher Education Marketing Metrics Help You Boost Enrollment. UPCEA / Search Influence. 2024-10-08. https://upcea.edu/how-higher-education-marketing-metrics-help-you-boost-enrollment/
- [^9]: How do universities measure ROI of demand gen for degree programs? The Pedowitz Group. https://www.pedowitzgroup.com/universities-measure-roi-of-demand-gen-for-degree-programs
- [^10]: Multichannel Marketing Attribution Modeling · Advanced SQL. Silota. 2017-09-22. http://www.silota.com/docs/recipes/sql-multichannel-marketing-attribution-models-reporting.html
- [^11]: SQL Dashboard Tools for Small Teams in 2026. Draxlr. 2026-03-23. https://www.draxlr.com/blogs/sql-dashboard-tools-for-small-teams/
- [^12]: Attribution Windows Guide 2026. AdBid. 2026-06-02. https://adbid.me/blog/attribution-windows-guide-2026
- [^13]: 14 Higher Education Metrics You Should Be Tracking. Collegis Education. 2025-09-25. https://collegiseducation.com/insights/higher-education-metrics-data-tracking/
- [^14]: Marketing Dashboard: 15 Best Practices with Free Templates (2026). Dataslayer. 2026-04-20. https://www.dataslayer.ai/blog/marketing-dashboard-best-practices-2025
- [^15]: How to Build an Industrial Marketing Dashboard That Proves ROI. ContentDrive. 2026-03-10. https://blog.contentdrive.app/how-to-build-an-industrial-marketing-dashboard-that-proves-roi-p-20260310762956/
- [^16]: CRM for Education Consultants: Why SmartX CRM Is the #1 Choice. SmartX CRM. 2026-04-06. https://smartxcrm.com/crm-for-education-consultants-why-smartx-crm-is-the-1-choice-for-overseas-education-consultancies-in-india/
- [^17]: Run SQLite in the Browser with sql.js: A Complete Guide. Recca0120. 2026-03-04. https://recca0120.github.io/en/2026/03/04/sql-js-browser-sqlite/
- [^18]: How to Track Full Funnel B2B Facebook Ad Conversions. SaaSHero. 2026-02-16. https://www.saashero.net/strategy/full-funnel-b2b-facebook-tracking/
- [^19]: [Feature Request] Native Meta Lead Ads Integration for automatic lead capture. Frappe CRM (GitHub). 2025-07-26. https://github.com/frappe/crm/issues/1075
- [^20]: How to Fix iOS Tracking Issues: A Step-by-Step Guide for Marketers. Cometly. 2026-05-11. https://www.cometly.com/post/how-to-fix-ios-tracking-issues
- [^21]: How to Build an Effective Marketing Attribution Dashboard. HockeyStack. 2025-12-26. https://www.hockeystack.com/blog-posts/marketing-attribution-dashboard
- [^22]: ROI Dashboard: How to Build, Use, and Optimize Marketing ROI Reporting in 2026. Improvado. 2024-03-27. https://improvado.io/blog/roi-dashboard
- [^23]: Marketing SQL Generator - Campaign Analytics Queries. AI2sql. 2026-04-02. https://ai2sql.io/ai-blog/marketing-sql-generator-campaign-analytics-queries-ai2sql
- [^24]: Enrollment and Admissions Funnel Stages and Best Practices. Edvisorly. https://www.edvisorly.com/university-insights/admissions-enrollment-funnel
