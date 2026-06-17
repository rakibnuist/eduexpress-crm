## Dimension 02: Marketing Funnel Visualization

### Key Findings
- Education consultancy funnels are **stage-aware pipelines**, not generic sales funnels: Lead Capture → Personalized Counseling → Document Collection → Application Processing → Follow-ups → Visa Assistance → Enrollment [^1][^2][^3].
- Recharts provides a native `<FunnelChart>` + `<Funnel>` component, but **customization is very limited** compared to Bar/Line/Pie charts; custom shapes require workarounds [^4][^5][^6].
- **Recharts does NOT have a native Sankey diagram**; for lead-source flow visualizations, Nivo (`@nivo/sankey`) or MUI X Pro (`<SankeyChart>`) are the practical React options [^7][^8].
- Stage-to-stage conversion rate is calculated as: `(Next Stage Volume ÷ Current Stage Volume) × 100`. The biggest revenue leaks almost always hide in the **middle and bottom** of the funnel, not the top [^9][^10].
- **Drop-off analysis** should identify not just *where* leads stall, but *why*: low engagement score, missing contact info, counselor didn't follow up, or lead requested "not now" [^11][^12].
- **Cohort-based tracking** (grouping leads by creation month and tracking progression) is the recommended method for education CRM funnel analysis because it handles long decision cycles and stage skipping [^13][^14].
- **Lead source rankings flip at every funnel stage**: Google Ads may lead in volume at the top, but LinkedIn and Word-of-Mouth often lead at Closed-Won. Multi-stage attribution makes this visible [^11][^14].
- A funnel dashboard needs **two views**: an executive summary (funnel health at a glance) and an operational drill-down (filterable by channel, campaign, cohort, and counselor) [^11][^17].
- Education admissions benchmarks: **inquiry-to-application 15–25%**, **application-to-admission 50–70%**, **admission-to-enrollment (yield) 20–40%** [^19][^20].
- **70% of student inquiries never receive a direct human response**; responding within 5 minutes is up to **21× more effective** at converting leads [^20][^23].
- The study abroad enrollment funnel specifically has 6 stages: **Awareness → Interest → Consideration → Intent → Application → Enrollment**, with the parent often acting as the primary decision-maker or veto-holder [^21][^22].
- A **horizontal bar chart** with center-aligned bars and conversion-rate labels between stages is often more readable than a traditional triangular funnel, because triangular areas distort the perception of drop-off magnitude [^25].

### Implementation Approaches

#### Approach A: Recharts `<FunnelChart>` (Native, Simple)
- Use the built-in `<FunnelChart>` + `<Funnel>` for a classic vertical funnel showing lead volume at each stage.
- **Pros**: Zero extra dependencies, works with existing recharts setup, animations supported.
- **Cons**: Limited customization (cannot easily add conversion-rate labels between stages, custom shapes are hacky), no lead-source segmentation inside the funnel [^4][^5][^6].
- **Pseudocode**:
```jsx
import { FunnelChart, Funnel, Tooltip, LabelList, ResponsiveContainer } from 'recharts';
const data = [
  { name: 'New Lead', value: 1000, fill: '#3b82f6' },
  { name: 'Contacted', value: 620, fill: '#6366f1' },
  { name: 'Interested', value: 410, fill: '#8b5cf6' },
  { name: 'Applied', value: 180, fill: '#a855f7' },
  { name: 'Documents Ready', value: 95, fill: '#d946ef' },
  { name: 'Enrolled', value: 42, fill: '#10b981' },
];
<ResponsiveContainer width="100%" height={300}>
  <FunnelChart>
    <Tooltip />
    <Funnel data={data} dataKey="value" nameKey="name">
      <LabelList position="inside" fill="#fff" stroke="none" dataKey="name" />
    </Funnel>
  </FunnelChart>
</ResponsiveContainer>
```

#### Approach B: Custom Horizontal Funnel (CSS + Recharts BarChart)
- Build a horizontal bar chart where each bar is centered, and overlay conversion-rate labels between bars using absolute positioning or a custom `<LabelList>`.
- **Pros**: Full design control, easy to add drop-off callouts, responsive, works with Tailwind.
- **Cons**: Requires custom SVG/JSX math for bar widths and label placement.
- **Pseudocode**:
```jsx
import { BarChart, Bar, XAxis, YAxis, Tooltip, Cell, LabelList, ResponsiveContainer } from 'recharts';
const funnel = [
  { stage: 'New Lead', count: 1000, color: '#3b82f6' },
  { stage: 'Contacted', count: 620, color: '#6366f1' },
  { stage: 'Interested', count: 410, color: '#8b5cf6' },
  { stage: 'Applied', count: 180, color: '#a855f7' },
  { stage: 'Enrolled', count: 42, color: '#10b981' },
];
const max = Math.max(...funnel.map(d => d.count));
const withWidth = funnel.map(d => ({ ...d, widthPct: (d.count / max) * 100 }));

// Render: map each row as a centered horizontal bar with a conversion label between rows
// Conversion label = (next.count / current.count) * 100
```
- A shadcn-style animated block uses `framer-motion` bars with `layoutId` for smooth transitions [^24].

#### Approach C: Cohort Retention Grid (Heatmap)
- Rows = monthly lead cohorts (e.g., "2026-01", "2026-02"). Columns = weeks or months since acquisition. Cell color = % of that cohort reaching a given stage (e.g., "Applied" or "Enrolled").
- **Pros**: Reveals if recent cohorts convert faster/slower than older ones. Ideal for education consultancies with long cycles.
- **Cons**: Not a single-chart solution; requires a custom heatmap component or Nivo (`@nivo/heatmap`) because Recharts does not support heatmaps [^7].
- **Data structure**:
```js
const cohortGrid = [
  { cohort: '2026-01', month0: 100, month1: 62, month2: 41, month3: 18, month6: 4 },
  { cohort: '2026-02', month0: 100, month1: 58, month2: 38, month3: 15, month6: 3 },
];
```

#### Approach D: Sankey Diagram (Lead Source → Stage Flow)
- Shows how leads from each source (organic, paid, referral, WhatsApp) flow into each funnel stage, with link width proportional to volume.
- **Pros**: Best for visualizing lead-source contribution at each stage. Makes channel-ranking flips visible [^14].
- **Cons**: Recharts does not support Sankey. Recommended libraries: **Nivo** (`@nivo/sankey`) or **MUI X Charts Pro** (`<SankeyChart>`) [^7][^8].
- **Data structure**:
```js
const sankeyData = {
  nodes: [
    { id: 'Organic FB' }, { id: 'Paid Meta' }, { id: 'Referral' }, { id: 'WhatsApp' },
    { id: 'New Lead' }, { id: 'Contacted' }, { id: 'Interested' }, { id: 'Applied' }, { id: 'Enrolled' }
  ],
  links: [
    { source: 'Organic FB', target: 'New Lead', value: 340 },
    { source: 'Paid Meta', target: 'New Lead', value: 420 },
    { source: 'Referral', target: 'New Lead', value: 120 },
    { source: 'New Lead', target: 'Contacted', value: 620 },
    // ... etc
  ]
};
```

#### Approach E: Backend SQL for Funnel Stats (SQLite/Node.js)
- The CRM already uses `better-sqlite3` via `sqldb.js`. Funnel queries should run server-side and return pre-aggregated data to the frontend.
- **Stage-to-stage counts**:
```sql
SELECT
  lead_status,
  COUNT(*) as count
FROM leads
WHERE date_added >= date('now', '-90 days')
GROUP BY lead_status
ORDER BY CASE lead_status
  WHEN 'New Lead' THEN 1
  WHEN 'Contacted' THEN 2
  WHEN 'Interested' THEN 3
  WHEN 'Applied' THEN 4
  WHEN 'Documents Collecting' THEN 5
  WHEN 'Documents Ready' THEN 6
  WHEN 'Applied to University' THEN 7
  WHEN 'Interview' THEN 8
  WHEN 'Pre-Admission' THEN 9
  WHEN 'Deposit' THEN 10
  WHEN 'Admission/JW Received' THEN 11
  WHEN 'Visa Applied' THEN 12
  WHEN 'Visa Approved' THEN 13
  WHEN 'Enrolled' THEN 14
  ELSE 99
END;
```
- **Cohort progression** (what % of January leads reached "Enrolled" by month 6):
```sql
SELECT
  strftime('%Y-%m', date_added) as cohort,
  COUNT(*) as total,
  SUM(CASE WHEN lead_status = 'Enrolled' THEN 1 ELSE 0 END) as enrolled,
  ROUND(SUM(CASE WHEN lead_status = 'Enrolled' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 1) as enrolled_pct
FROM leads
GROUP BY cohort
ORDER BY cohort DESC;
```
- **Lead source contribution by stage**:
```sql
SELECT
  lead_source,
  lead_status,
  COUNT(*) as count
FROM leads
WHERE date_added >= date('now', '-90 days')
GROUP BY lead_source, lead_status
ORDER BY lead_source, CASE lead_status /* same ordering as above */ END;
```
- **Drop-off / velocity** (days spent in each stage using activity_log):
```sql
SELECT
  from_value as stage,
  AVG(julianday(created_at) - julianday(prev.created_at)) as avg_days_in_stage
FROM activity_log al
JOIN (
  SELECT lead_id, created_at, lead_status as from_value,
         LAG(created_at) OVER (PARTITION BY lead_id ORDER BY created_at) as prev_created_at
  FROM activity_log WHERE type = 'lead_status_changed'
) prev ON al.lead_id = prev.lead_id
WHERE al.type = 'lead_status_changed'
GROUP BY from_value;
```

### Data Points & Statistics
- Education admissions **inquiry-to-application** conversion benchmark: **15–25%** [^19].
- Education admissions **application-to-admission** rate: **50–70%** (varies by selectivity) [^19].
- Education admissions **admission-to-enrollment yield**: **20–40%** for most institutions [^19][^20].
- **End-to-end** lead-to-enrollment conversion in education: **3–5%** [^20].
- **70% of student inquiries** never receive a direct human response [^20].
- Responding within **5 minutes** is **21× more effective** than responding after an hour [^20].
- A study abroad CRM case study showed **30% increase in enrollments** after implementing funnel automation and personalized follow-ups [^22].
- Multi-segment funnels (by channel, persona, deal size) drive **23% higher revenue per lead** [^11].
- Institutions with higher conversion rates enjoy **lower customer acquisition cost (CAC)**; average CAC is **12% of unit revenue** in education admissions [^20].
- B2B SaaS comparison: Lead→MQL 20–25%, MQL→SQL 12–18%, SQL→Opportunity 10–12%, Opportunity→Closed-Won 6–9% [^10].
- Inquiries in **September and October** convert at the highest rates; January and February inquiries convert at lower rates (reactive-mode families) [^21].

### Sources
- [^1]: Ticlick CRM. "Best CRM Designed for Study Abroad Agencies." Dec 2025. https://ticlickcrm.com/crm-designed-for-study-abroad-agencies/
- [^2]: Meritto. "How Study Abroad CRM Empowers Global Education Consultants." Feb 2025. https://www.meritto.com/blog/how-study-abroad-crm-empowers-global-education-consultants/
- [^3]: SmartAgentic. "Stages of Pipeline Management in Overseas Education Consulting." Feb 2025. https://www.smartagentic.com/blog/stages-of-pipeline-management-in-education-consulting/
- [^4]: Recharts. "FunnelChart API Documentation." https://recharts.github.io/en-US/api/FunnelChart/
- [^5]: Recharts. "Funnel API Documentation." https://recharts.github.io/en-US/api/Funnel/
- [^6]: GitHub recharts/recharts. "Issue #3832: Support for custom-shaped Funnel components." Oct 2023. https://github.com/recharts/recharts/issues/3832
- [^7]: PkgPulse. "Recharts v3 vs Tremor vs Nivo: React Charts 2026." Mar 2026. https://www.pkgpulse.com/guides/recharts-v3-vs-tremor-vs-nivo-react-charting-2026
- [^8]: MUI X. "React Sankey chart." https://mui.com/x/react-charts/sankey/
- [^9]: PetaVue. "Funnel Conversion Rates Breakdown." Jul 2025. https://www.petavue.com/glossary/funnel-conversion-rates-visitor-lead-mql-sql-customer
- [^10]: Articos. "What Is a Good Funnel Conversion Rate? Benchmarks by Stage, Industry, and Channel (2026)." May 2026. https://www.articos.com/blog/funnel-conversion-rate
- [^11]: Improvado. "Marketing Funnel Dashboard Guide for Data Analysts 2026." Jun 2026. https://improvado.io/blog/marketing-funnel-dashboard
- [^12]: Count.co. "Sales Funnel Analysis: Optimize Conversions." Mar 2026. https://count.co/metric/sales-funnel-analysis
- [^13]: Marqeu. "Demand Waterfall Conversion Rates: The B2B Framework Guide." Feb 2026. https://www.marqeu.com/demand-waterfall-conversion-rates
- [^14]: SegmentStream. "CRM Funnel Attribution for B2B Pipeline Tracking." https://segmentstream.com/measurement-engine/crm-funnel-attribution
- [^15]: Improvado (same as [^11]). Lead source contribution analysis section.
- [^16]: ActiveProspect. "A practical guide to lead source tracking." Mar 2026. https://activeprospect.com/blog/lead-source-tracking/
- [^17]: Improvado (same as [^11]). Dashboard layout and visualizations section.
- [^18]: Excited Agency. "Effective Dashboard UX: Design Principles & Best Practices." Aug 2025. https://excited.agency/blog/dashboard-ux-design
- [^19]: Edvisorly. "Admissions Conversion Rate Strategies for 2026." https://www.edvisorly.com/university-insights/admissions-conversion-rate-strategies
- [^20]: ReshapeOS. "Average conversion rate in education admissions (and how to improve it)." Jun 2026. https://reshapeos.com/blog/average-conversion-rate-in-education-admissions-and-how-to-improve-it
- [^21]: Archer Education. "Enrollment and Admissions Funnel: The Student Journey from Inquiry to Enrollment." Sep 2024. https://www.archeredu.com/student-journey-enrollment-funnel/
- [^22]: EduCtrl. "Why Your Enrollment Funnel Needs a Study Abroad CRM." https://www.eductrl.com/blog/why-your-enrollment-funnel-needs-a-study-abroad-crm
- [^23]: ReshapeOS (same as [^20]). Response time and inquiry statistics section.
- [^24]: shadcn.io. "React Sales Pipeline Dashboard Block." https://www.shadcn.io/blocks/dashboard-sales-pipeline
- [^25]: Atlassian. "A Complete Guide to Funnel Charts." Jan 2026. https://www.atlassian.com/data/charts/funnel-chart-complete-guide
