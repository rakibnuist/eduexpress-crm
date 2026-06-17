## Dimension 08: Analytics & Performance Dashboard

### Key Findings

- **Vanity metrics (followers, raw impressions, likes) must not be the primary KPIs** for education consultancies. Actionable metrics—enquiries, lead-to-counselling conversion rate, cost-per-lead, and assisted social conversions—are what justify marketing spend [^1][^6].
- **Higher Education is the top-performing industry on social media**, with Instagram engagement rates at 2.1% (median) and TikTok at 7.36%—the single highest rate across any industry and platform [^2][^3]. This suggests education content naturally resonates on social platforms.
- **Consistency beats frequency**: Buffer’s consistency study found that highly consistent posters (those who posted in at least 20 out of 26 weeks) earned **450% more engagement per post** than sporadic posters, and one missed week resets algorithmic momentum [^1].
- **LinkedIn is the dominant B2B lead platform**, driving up to 85% of all social B2B leads. Optimal posting for education consultancies is 2–5 times per week on weekdays only, with peak engagement at 8–11 AM Tuesdays–Thursdays [^1][^9].
- **Engagement rate formulas vary by platform and methodology**. Rival IQ calculates (interactions ÷ total followers), while Hootsuite uses per-post averages. For LinkedIn, the standard is (reactions + comments + shares) ÷ impressions × 100. Education benchmarks: LinkedIn ~2.8%, Instagram ~2.1–4.2%, Facebook ~2.2% [^2][^3].
- **Content decay (half-life) is the time for a post to reach 50% of its total lifetime engagement**. Education consultancy posts on LinkedIn/Facebook typically have longer half-lives (24–48 hours) than ephemeral TikTok/Instagram Stories content [^8]. Tracking decay helps determine optimal reposting windows.
- **Reach velocity measures how quickly a post gains traction after publishing**. Faster velocity indicates highly resonant content worth replicating. Paired with engagement quality, it helps refine timing and subject matter strategies [^10].
- **Audience growth rate reveals momentum**, not just scale. The formula is ((End Followers – Start Followers) ÷ Start Followers) × 100. Instagram accounts typically grow 1.25–2.5% monthly; LinkedIn B2B accounts grow 2–4% monthly. Churn rate (unfollows ÷ starting followers) should be tracked alongside growth [^13].
- **Week-over-week and month-over-month comparisons are best calculated in SQL using LAG() window functions**, which access the previous row’s value without subqueries. This enables clean percentage-change calculations: (current – previous) ÷ previous × 100 [^12].
- **Lead-to-content correlation requires first-touch attribution locked in the CRM**. Original lead source must never be overwritten. UTM parameters on every social link, hidden form fields capturing source, and landing page tracking are essential technical components [^14].
- **Recharts supports advanced dashboard patterns natively**: `ComposedChart` mixes line, bar, and area layers; `Brush` adds zoom/range selection; `syncId` synchronizes multi-chart dashboards; custom tooltips use the `content` prop receiving `{active, payload, label}` [^7][^11].
- **For education consultancies, the four metrics that genuinely predict growth are**: (1) enquiries attributed to specific content pieces, (2) enquiry-to-meeting conversion rate, (3) meetings to retained business, and (4) client lifetime value from marketing leads [^14].
- **Platform-specific optimal posting windows for education/B2B**: LinkedIn Tue–Thu 8 AM–12 PM; Facebook weekdays 9 AM–noon; Instagram weekdays 10 AM–4 PM and 7 PM–9 PM. Sunday posting yields the lowest engagement across all platforms [^9].
- **SQL window functions like LAG() are supported in SQLite 3.25+**, making them viable for the EduExpress CRM backend. The pattern `LAG(metric, 1) OVER (PARTITION BY pillar ORDER BY week)` enables pillar-specific week-over-week engagement comparisons [^12].
- **Multi-touch attribution is necessary because student enrolment journeys are non-linear**. A prospect might engage with multiple social posts, a blog article, and an email before enquiring. First-touch attribution shows discovery; last-touch shows conversion trigger [^6][^14].

---

### Implementation Approaches

#### 1. Consistency Score Algorithm
**Approach**: Calculate a weekly posting consistency score based on adherence to a target cadence and gap penalties.
- **Target cadence**: For education consultancies, set target at 3 posts/week (LinkedIn focus) + 2 posts/week (Instagram/Facebook).
- **Score formula**: For each week, score = (actual_posts / target_posts) × 100, capped at 100. For weeks with 0 posts, apply a penalty multiplier (e.g., 0.5) to the rolling average.
- **Rolling window**: 4-week or 8-week rolling average to smooth outliers. Display as 0–100 score with colour coding (≥80 green, 50–79 amber, <50 red).
- **Pros**: Simple to explain, algorithmically fair, directly actionable. **Cons**: Doesn’t account for quality; must be paired with engagement rate to avoid gamification.
- **SQLite pseudocode**:
```sql
WITH weekly_counts AS (
  SELECT strftime('%Y-%W', scheduled_date) AS week,
         COUNT(*) AS post_count
  FROM posts WHERE status = 'published'
  GROUP BY week
),
weekly_score AS (
  SELECT week,
    MIN(post_count / 3.0, 1.0) * 100 AS raw_score
  FROM weekly_counts
)
SELECT AVG(raw_score) AS consistency_score
FROM weekly_score
WHERE week >= strftime('%Y-%W', date('now', '-8 weeks'));
```

#### 2. Engagement Rate by Pillar (Content Theme)
**Approach**: Track weighted engagement rate per content pillar (e.g., “Student Success Stories”, “Visa Tips”, “University Guides”).
- **Weighting**: Assign higher weights to deeper engagement actions: save/bookmark = 4, share = 3, comment = 2, like = 1, click = 1.5. Sum weighted engagements ÷ reach × 100.
- **Dashboard display**: Horizontal bar chart ranking pillars by engagement rate, with a secondary line showing post volume per pillar to detect “quality vs quantity” trade-offs.
- **Pros**: Surfaces which topics resonate, guides editorial calendar. **Cons**: Requires accurate pillar tagging on every post; weights are subjective.
- **SQLite pseudocode**:
```sql
SELECT 
  p.pillar,
  COUNT(*) AS post_count,
  SUM(pm.likes + pm.comments*2 + pm.shares*3 + pm.saves*4 + pm.clicks*1.5) 
    / SUM(pm.reach) * 100.0 AS weighted_engagement_rate
FROM posts p
JOIN post_metrics pm ON p.id = pm.post_id
WHERE p.status = 'published' 
  AND pm.recorded_at >= date('now', '-30 days')
GROUP BY p.pillar
ORDER BY weighted_engagement_rate DESC;
```

#### 3. Content Decay (Half-Life) Analysis
**Approach**: Model the decay curve of each post’s engagement over time to determine its “active lifespan”.
- **Half-life calculation**: For each post, find the timestamp when cumulative engagement reached 50% of its total lifetime engagement. Group by platform and pillar to find average half-life.
- **Dashboard display**: Box plot or violin chart showing half-life distribution by platform. Highlight posts with unusually long half-lives (high “evergreen” potential).
- **Pros**: Reveals optimal reposting windows and evergreen content. **Cons**: Requires daily metric snapshots per post; computationally heavier.
- **SQLite pseudocode**:
```sql
WITH daily_engagement AS (
  SELECT post_id, date, SUM(likes + comments + shares) AS daily_eng
  FROM post_metrics_daily
  GROUP BY post_id, date
),
cumulative AS (
  SELECT post_id, date,
    SUM(daily_eng) OVER (PARTITION BY post_id ORDER BY date) AS cumulative_eng,
    SUM(daily_eng) OVER (PARTITION BY post_id) AS total_eng
  FROM daily_engagement
)
SELECT post_id, MIN(date) AS half_life_date
FROM cumulative
WHERE cumulative_eng >= total_eng * 0.5
GROUP BY post_id;
```

#### 4. Best-Performing Time Slots
**Approach**: Aggregate engagement rate by hour-of-day and day-of-week, then surface optimal posting windows.
- **Heatmap data**: For each (day, hour) bucket, compute average engagement rate per post. Use 2-hour buckets to avoid sparsity.
- **Dashboard display**: Recharts `BarChart` or custom heatmap grid. Add a recommendation banner: “Post on Tuesday 10 AM for +23% expected engagement.”
- **Pros**: Directly actionable for scheduling. **Cons**: Correlation ≠ causation; may reflect existing posting habits rather than true optimal times.
- **SQLite pseudocode**:
```sql
SELECT 
  strftime('%w', scheduled_date) AS day_of_week,
  CAST(strftime('%H', scheduled_date) / 2 AS INTEGER) * 2 AS hour_bucket,
  AVG(pm.likes + pm.comments + pm.shares + pm.clicks) / AVG(pm.reach) * 100.0 AS avg_engagement_rate,
  COUNT(*) AS sample_size
FROM posts p
JOIN post_metrics pm ON p.id = pm.post_id
WHERE p.status = 'published'
GROUP BY day_of_week, hour_bucket
HAVING sample_size >= 3
ORDER BY avg_engagement_rate DESC;
```

#### 5. Reach Velocity Metric
**Approach**: Measure how fast a post accumulates reach in its first 24 hours compared to the account’s baseline.
- **Velocity score**: (post_24h_reach ÷ account_avg_24h_reach) × 100. Score > 100 = above-average velocity.
- **Trending indicator**: If velocity score > 200, flag as “Trending” and alert the marketing team to boost with paid promotion or follow-up content.
- **Pros**: Early signal of viral/algorithmic success. **Cons**: Sensitive to time-of-posting; requires baseline recalculation weekly.
- **SQLite pseudocode**:
```sql
WITH baseline AS (
  SELECT AVG(first_24h_reach) AS avg_reach
  FROM post_first_day_metrics
  WHERE posted_at >= date('now', '-30 days')
),
post_velocity AS (
  SELECT post_id, first_24h_reach, 
    first_24h_reach / baseline.avg_reach * 100 AS velocity_score
  FROM post_first_day_metrics, baseline
)
SELECT * FROM post_velocity ORDER BY velocity_score DESC;
```

#### 6. Week-over-Week (WoW) and Month-over-Month (MoM) Comparison
**Approach**: Use SQL window functions to compute period-over-period changes for all key metrics.
- **Method**: `LAG()` over an ordered time window to get the previous period’s value. Calculate absolute change, percentage change, and trend direction.
- **Dashboard display**: Dual-axis line chart (current period + previous period) with a difference area fill. Add summary cards showing “+12% WoW” with green/red indicators.
- **Pros**: Clean, performant SQL; no complex application logic. **Cons**: Requires complete data (no missing weeks); handle division-by-zero.
- **SQLite pseudocode**:
```sql
WITH weekly_metrics AS (
  SELECT strftime('%Y-%W', date) AS week,
         SUM(reach) AS total_reach,
         SUM(likes + comments + shares) AS total_engagement,
         COUNT(DISTINCT post_id) AS posts_published
  FROM post_metrics
  GROUP BY week
)
SELECT week, total_reach, total_engagement, posts_published,
  LAG(total_reach, 1) OVER (ORDER BY week) AS prev_week_reach,
  ROUND((total_reach - LAG(total_reach, 1) OVER (ORDER BY week)) 
    * 100.0 / LAG(total_reach, 1) OVER (ORDER BY week), 1) AS wow_change_pct
FROM weekly_metrics
ORDER BY week DESC
LIMIT 12;
```

#### 7. Lead-to-Content Correlation (Attribution)
**Approach**: Link every CRM enquiry/lead to the social post(s) the prospect engaged with before converting.
- **First-touch tracking**: Store `original_source` on the leads table (e.g., “LinkedIn-Organic”, “Instagram-Ad”). Lock this field after first write. Store `landing_page` and `utm_campaign` in separate fields.
- **Correlation query**: For each post, count leads whose first touch occurred within 7 days of that post being published and whose landing page matches the post’s CTA URL.
- **Pros**: Directly connects content to revenue; protects marketing budget. **Cons**: Requires disciplined UTM usage; “dark social” (WhatsApp shares) breaks attribution.
- **SQLite pseudocode**:
```sql
-- Enquiries correlated to posts published within 7 days before enquiry
SELECT 
  p.id AS post_id,
  p.pillar,
  COUNT(l.id) AS attributed_enquiries,
  SUM(l.converted_to_booking) AS attributed_bookings
FROM posts p
LEFT JOIN leads l ON 
  l.source LIKE '%' || p.platform || '%'
  AND l.created_at BETWEEN p.published_at AND datetime(p.published_at, '+7 days')
  AND l.landing_page = p.cta_url
WHERE p.status = 'published'
GROUP BY p.id
ORDER BY attributed_bookings DESC;
```

#### 8. React + Recharts Advanced Dashboard Patterns
**Approach**: Build a composite analytics dashboard using Recharts 3.x primitives.
- **ComposedChart**: Mix `Bar` (post volume), `Area` (cumulative reach), and `Line` (engagement rate) on a single chart with dual Y-axes.
- **Brush**: Add `<Brush dataKey="date" height={30} />` below any time-series chart for draggable zoom/pan. Sync multiple charts via `syncId="analytics"` on parent chart containers.
- **Custom Tooltip**: Pass a custom React component to `<Tooltip content={<CustomTooltip />} />`. The component receives `{active, payload, label}`. Use `payload` array to render pillar-specific colour-coded rows with formatted numbers.
- **ResponsiveContainer**: Wrap every chart in `<ResponsiveContainer width="100%" height={360}>`. Never hardcode width.
- **Pros**: Declarative, React-native, accessible, tree-shakeable. **Cons**: SVG-based; for >10,000 data points consider server-side aggregation or switching to canvas.
- **React pseudocode**:
```jsx
import { ComposedChart, Bar, Line, Area, XAxis, YAxis, 
         Tooltip, Brush, ResponsiveContainer, CartesianGrid } from 'recharts';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload) return null;
  return (
    <div className="custom-tooltip">
      <p className="label">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>
          {p.name}: {p.value.toLocaleString()}
        </p>
      ))}
    </div>
  );
};

<ResponsiveContainer width="100%" height={400}>
  <ComposedChart data={weeklyData} syncId="analytics">
    <CartesianGrid strokeDasharray="3 3" />
    <XAxis dataKey="week" />
    <YAxis yAxisId="left" />
    <YAxis yAxisId="right" orientation="right" />
    <Tooltip content={<CustomTooltip />} />
    <Bar yAxisId="left" dataKey="posts" fill="#82ca9d" />
    <Line yAxisId="right" dataKey="engRate" stroke="#8884d8" />
    <Brush dataKey="week" height={30} />
  </ComposedChart>
</ResponsiveContainer>
```

#### 9. Audience Growth & Churn Dashboard
**Approach**: Track net growth rate alongside churn rate to measure true audience health.
- **Net growth**: ((followers_end – followers_start) ÷ followers_start) × 100.
- **Churn rate**: (unfollows ÷ followers_start) × 100. Normal churn is 1–2% monthly; >3% signals content-audience mismatch.
- **Dashboard display**: Area chart showing gross growth, churn, and net growth stacked. Add a reference line at 0 to highlight negative growth periods.
- **Pros**: Prevents vanity growth from bought/inactive followers. **Cons**: Requires platform APIs to expose unfollow data; manual entry may be needed.
- **SQLite pseudocode**:
```sql
WITH weekly_growth AS (
  SELECT 
    strftime('%Y-%W', date) AS week,
    followers_start,
    followers_end,
    unfollows,
    (followers_end - followers_start) * 100.0 / followers_start AS net_growth_pct,
    unfollows * 100.0 / followers_start AS churn_pct
  FROM audience_snapshots
)
SELECT * FROM weekly_growth ORDER BY week DESC LIMIT 12;
```

---

### Data Points & Statistics

- **Higher Education Instagram engagement rate**: 2.1% median (highest of any industry on Instagram). Sports teams second at 1.3% [^2].
- **Higher Education TikTok engagement rate**: 7.36%—the single highest engagement rate across any industry and any platform in the dataset [^3].
- **LinkedIn B2B lead dominance**: LinkedIn drives up to 85% of all social B2B leads [^1].
- **Consistency premium**: Highly consistent posters (20+ of 26 weeks) earned **450% more engagement per post** than sporadic posters. One missed week resets algorithmic momentum [^1].
- **LinkedIn optimal frequency**: 2–3 posts/week baseline; 3–5/week for aggressive growth. Weekly posting achieves **2× higher engagement and 5.6× more follower growth** than irregular posting [^1].
- **Instagram monthly growth rate benchmark**: 1.25%–2.5% monthly is average for organic growth [^13].
- **LinkedIn B2B monthly growth rate benchmark**: 2%–4% monthly is strong for B2B services [^13].
- **Facebook average CTR**: 0.9% average; 1–2% is consistently achievable with good content [^10].
- **Education Facebook engagement**: 2.2% (Hootsuite methodology), among the highest on Facebook [^3].
- **Content decay half-life**: Social media posts typically reach 50% of lifetime engagement within 24–48 hours on LinkedIn/Facebook, much shorter on Stories/Reels [^8].
- **Optimal LinkedIn posting window**: Tuesdays–Thursdays, 8 AM–12 PM for company pages; early mornings (7–8 AM) for personal profiles [^1][^9].
- **Optimal Instagram posting window**: Weekdays 10 AM–4 PM and 7 PM–9 PM; Reels sweet spot 8 PM–11 PM [^9].
- **Sunday penalty**: Sundays are the least effective day for posting across all major platforms [^9].
- **Only 23% of staffing/education recruitment companies** track all four metrics that genuinely correlate with revenue growth (content-attributed enquiries, enquiry-to-meeting rate, meeting-to-business rate, CLV from marketing leads) [^14].
- **86% of job seekers** say a company’s social media presence influences their decision to apply—making social authority a direct recruitment driver [^1].
- **Churn rate benchmark**: 1–2% monthly unfollow rate is normal; >3% indicates content-audience mismatch [^13].
- **WoW/MoM SQL pattern**: `LAG()` window function is supported in SQLite 3.25+ and is the standard pattern for period-over-period comparisons in embedded databases [^12].

---

### Sources

- [^1]: PeopleScout — Beyond Vanity Metrics: How to Measure Social Media Effectiveness for Recruitment. 2025. https://www.peoplescout.com/insights/social-media-metrics-for-recruitment/
- [^2]: Rival IQ — 2024 Social Media Industry Benchmark Report. https://get.rivaliq.com/hubfs/eBooks/2024-Rival-IQ-Social-Media-Industry-Benchmark-Report.pdf
- [^3]: Apaya — Social Media Benchmarks 2026: Engagement Rates by Industry. 2026-06-10. https://apaya.com/blog/social-media-benchmarks
- [^4]: Buffer / PostEverywhere — How Often to Post on Social Media in 2026. 2026-02-19. https://posteverywhere.ai/blog/how-often-to-post-on-social-media
- [^5]: Beamio — LinkedIn Posting Frequency: B2B SaaS Benchmarks and Consistency in 2026. 2026-02-17. https://www.beamio.io/blogs/linkedin-content-frequency-b2b-saas-2026
- [^6]: Sevenoways / ProfileTree — Importance of Social Media Marketing for Business UK. 2026-01-12. https://profiletree.com/importance-of-social-media-marketing-for-business/
- [^7]: KomTech — Recharts: A Practical Guide to React Data Visualization. 2025-10-28. https://komtech.net.pl/recharts-a-practical-guide-to-react-data-visualization-setup-examples/
- [^8]: Scott Graffius / 2POINT Agency — Content Decay: Measuring Social Media Post Lifespan. 2025-2026. https://www.scottgraffius.com/blog/files/tag-content-decay003a-measuring-social-media-post-lifespan.html
- [^9]: UnixCommerce / Sprout Social / Greystone — 7 Best Times for Posting on Social Media Platforms. 2026-02-18. https://www.unixcommerce.com/2026/02/18/7-best-times-for-posting-on-social-media-platforms-for-maximum-engagement/
- [^10]: DMNews / Hennessey Digital — 16 Key Metrics and Strategies from Experts On Social Media Analytics. 2025-01-14. https://www.dmnews.com/16-key-metrics-and-strategies-from-experts-on-social-media-analytics/
- [^11]: Borstch — Creating Custom Tooltip in Recharts. 2024-04-03. https://borstch.com/snippet/creating-custom-tooltip-in-recharts
- [^12]: Irako / DataCamp / SQL Recipes — SQL: Calculating Month over Month Growth / Week over Week Change. 2025-02-11. https://www.irako.io/sql-calculating-month-over-month-growth-week-over-week-change/
- [^13]: CUFinder / TheSocialCat — Follower Growth Rate: The Complete 2026 Guide. 2026-06-09. https://cufinder.io/blog/wiki/marketing-metrics/follower-growth-rate/
- [^14]: Staffing Industry / LeadSources / Madlitics — Lead Source Attribution & The Four Metrics That Predict Recruitment Growth. 2026. https://www.staffingindustry.com/editorial/staffing-stream/the-four-metrics-that-actually-predict-recruitment-agency-growth
- [^15]: Thinkific / Education Dynamics / Sensation CRM — Education Marketing Dashboards & KPIs. 2025-2026. https://support.thinkific.com/hc/en-us/articles/23772050586519-Thinkific-Analytics-Marketing-Dashboards
