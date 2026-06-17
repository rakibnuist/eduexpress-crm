## Dimension 05: Competitor Intelligence Dashboard

### Key Findings
- The Meta Ad Library API is free and provides public ad transparency data, but commercial ad coverage is limited primarily to EU/UK and political/issue ads globally. For Bangladesh, this means most local competitor ads may not appear unless they target EU/UK markets [^1].
- The primary Ad Library endpoint is `GET https://graph.facebook.com/v19.0/ads_archive` with required params `access_token`, `ad_reached_countries`, and either `search_terms` or `search_page_ids`. The API returns ad creatives, page names, delivery dates, and publisher platforms but excludes impressions, spend, or targeting data for commercial ads [^1][^2].
- Free social media competitor monitoring tools still exist but are limited: Brand24 (free plan with basic mentions), Mentionlytics (limited searches), Google Alerts, Social Searcher (real-time with sentiment), and Metricool (free plan with competitor tracking). Most robust features require paid tiers starting at $18–$79/month [^3][^4].
- Node.js offers two primary scraping approaches: Cheerio for lightning-fast static HTML parsing (jQuery-like syntax, no browser overhead) and Puppeteer for dynamic JavaScript-rendered pages (SPA scraping, screenshots, form interaction). The hybrid pattern—render once with Puppeteer, then parse with Cheerio—is the production best practice [^5][^6].
- Competitive content analysis should focus on normalized metrics: engagement rate (resonance per audience size), engagements per post (quality vs. volume), and video completion rates. Raw engagement totals favor larger accounts and mislead strategic decisions [^7].
- Content pillars (recurring themes like educational carousels, testimonials, or promotional posts) reveal what competitors have decided to own. Analyzing which pillars generate durable engagement versus one-off spikes is more valuable than copying top posts [^7][^8].
- Bangladesh’s study abroad consultancy market is extremely fragmented with over 2,000 firms operating mainly in Dhaka, making automated intelligence gathering essential for survival. Major players like PFEC Global, IDP Education, BSB Global, and Edumax dominate via scale and brand reputation [^9][^10].
- Social listening for competitor brand mentions uncovers real-time market intelligence, sentiment shifts, and customer pain points. Tools like Alertmouse (free tier: 1 alert, 10 mentions/day) provide a modern alternative to unreliable Google Alerts [^4][^11].
- Building a competitive radar requires change detection at the page level (pricing, messaging, product pages) combined with open-web mention monitoring. Google Alerts alone miss same-URL edits, which are the highest-stakes competitor moves [^12].
- CRM-integrated competitor intelligence dramatically improves sales effectiveness: teams that log competitor mentions in deal records and surface battlecards inside CRM workflows see higher win rates and faster deal velocity. Over 60% of enterprise CI programs run on Salesforce or HubSpot [^13][^14].
- AI-powered competitor analysis saves GTM professionals an average of 12 hours per week on manual research, according to Klue research. Most savings come from automating monitoring; discovery of new entrants remains largely manual without custom pipelines [^15].
- A self-hosted competitive intelligence system can be built using n8n (open-source workflow automation), Cheerio/Puppeteer for scraping, a SQLite/PostgreSQL database for history, and Slack webhooks for alerts. The GitHub repo `Laksh-star/competitive-intelligence` demonstrates a Tavily + DeepSeek LLM extraction pipeline [^16][^17].
- For education consultancies specifically, the most actionable competitive signals are: new destination country offerings, scholarship announcements, visa success rate claims, pricing changes, influencer partnerships, and testimonial video campaigns [^9][^10].
- The "view-source test" is a simple rule for scraping: if competitor data appears in the raw HTML, use Cheerio + axios; if it requires JavaScript rendering, use Puppeteer or Playwright. This determines tool choice and infrastructure cost [^6].
- Competitive gap analysis should examine three layers: content gaps (topics competitors ignore), quality gaps (depth competitors fail to reach), and tone/voice gaps (authenticity opportunities when all rivals sound corporate). AI clustering can auto-identify emerging pillars [^7][^8].

### Implementation Approaches

#### 1. Meta Ad Library API Integration (Node.js)
**Pros:** Free, official, no scraping risk. **Cons:** Limited Bangladesh commercial ad coverage; no performance metrics.
```javascript
// Pseudocode for weekly competitor ad pull
const fetchAds = async (pageId, token) => {
  const url = `https://graph.facebook.com/v19.0/ads_archive?` +
    `access_token=${token}&` +
    `search_page_ids=[${pageId}]&` +
    `ad_reached_countries=["ALL"]&` +
    `ad_active_status=ACTIVE&` +
    `fields=id,ad_creative_bodies,page_name,ad_delivery_start_time,publisher_platforms&` +
    `limit=1000`;
  let allAds = [], next = url;
  while (next) {
    const res = await fetch(next).then(r => r.json());
    allAds.push(...res.data);
    next = res.paging?.next;
    await sleep(300); // polite rate limiting
  }
  // Upsert to DB: new ads get first_seen, existing ads update last_seen
  return db.upsertAds(allAds, source='meta');
};
```
Store a `competitors` table with `meta_page_id`, then poll weekly. Diff new ads against history; long-running ads (>30 days) are likely profitable and deserve deep study [^1][^2].

#### 2. Static + Dynamic Scraping Pipeline (Node.js)
**Pros:** Full control, low cost, works for any public page. **Cons:** Requires maintenance when sites change; anti-bot measures on Instagram/LinkedIn.
```javascript
// Hybrid pattern: Puppeteer render → Cheerio parse
const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const axios = require('axios');

// For static pages (Facebook public pages, blog posts)
const scrapeStatic = async (url) => {
  const { data } = await axios.get(url, { headers: { 'User-Agent': '...' } });
  const $ = cheerio.load(data);
  return { title: $('title').text(), posts: $('.post').length };
};

// For dynamic pages (JavaScript-heavy sites)
const scrapeDynamic = async (url) => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle2' });
  const html = await page.content();
  await browser.close();
  const $ = cheerio.load(html);
  return { title: $('title').text(), posts: $('.post').length };
};
```
Use Rayobyte/ScraperAPI residential proxies for Instagram; 4G/5G mobile proxies are recommended for Instagram to avoid CAPTCHAs [^5][^6].

#### 3. Social Mention & RSS Alert Radar
**Pros:** Zero code for basic setup; can pipe to Slack/Teams. **Cons:** Noisy; misses page-level changes.
- Create Google Alerts per competitor: `"Competitor Name" (launches OR announces)`, `"Competitor Name" pricing`, `"Competitor Name" "EduExpress"` (catches "vs you" content) [^12].
- Route alerts to RSS (not email) and consume via Feedly/Inoreader.
- Layer on Alertmouse (free tier) or BrandMentions free trackers for social-specific mention alerts [^4][^11].
- For CRM integration: parse RSS items via a Node.js cron job, classify with OpenAI/DeepSeek, and write structured intel to the `competitor_intel` table [^15].

#### 4. Competitive Change Detection (Webhook Alerts)
**Pros:** Catches pricing, messaging, and product changes that Google Alerts miss. **Cons:** Requires custom selectors or paid services.
- Use Apify’s "Competitor Content Radar" actor or Browse.ai free plan to watch competitor blog/pricing pages.
- Store snapshots in SQLite; diff with `diff` library or simple string comparison.
- Trigger Slack webhook when change exceeds a threshold:
```javascript
const { IncomingWebhook } = require('@slack/webhook');
const webhook = new IncomingWebhook(process.env.SLACK_WEBHOOK_URL);

const alertCompetitorMove = async (competitor, changeType, summary) => {
  await webhook.send({
    text: `🚨 ${competitor} ${changeType} detected`,
    blocks: [
      { type: 'section', text: { type: 'mrkdwn', text: `*${competitor}* — ${changeType}` } },
      { type: 'section', text: { type: 'mrkdwn', text: summary } }
    ]
  });
};
```
- Weekly summary brief: market temperature, top opportunities, threats, three-tier action list (DO NOW, THIS WEEK, WHEN READY) [^12][^17].

#### 5. Content Pillar & Engagement Analysis Engine
**Pros:** Transforms raw posts into strategic intelligence. **Cons:** Requires AI tagging or manual labeling.
- Schema extension: `content_pillar` (enum: scholarship, testimonial, destination_guide, promotional, educational, event), `post_format` (video, carousel, image, text), `engagement_rate`, `saves`, `shares`.
- Automated tagging: use OpenAI GPT-4o-mini or DeepSeek to classify post captions into pillars and extract sentiment. Cost-effective at ~$0.15/1K posts.
- Benchmarking queries (SQLite):
```sql
-- Competitor posting frequency by week
SELECT competitor, strftime('%Y-%W', post_date) as week, COUNT(*) as posts
FROM competitor_posts GROUP BY competitor, week;

-- Engagement rate by content pillar
SELECT competitor, content_pillar,
  AVG((likes + comments + shares) / followers * 100) as engagement_rate
FROM competitor_posts WHERE post_date > date('now', '-90 days')
GROUP BY competitor, content_pillar;

-- Gap detection: topics we post on that competitors ignore
SELECT DISTINCT content_pillar FROM our_posts
EXCEPT
SELECT DISTINCT content_pillar FROM competitor_posts;
```

#### 6. CRM Dashboard Integration (React + Node.js)
**Pros:** Intel appears where teams already work. **Cons:** Requires schema and UI changes.
- Extend the existing `competitor_intel` table: add `pillar`, `engagement_rate`, `post_count`, `follower_delta`, `ad_spend_estimate`, `sentiment`, `alert_level` (low/medium/high).
- React dashboard widgets:
  - **Radar Feed:** chronological list of competitor moves with severity badges.
  - **Benchmark Grid:** side-by-side comparison of posting frequency, engagement rate, and pillar mix across 5–10 competitors.
  - **Gap Map:** matrix showing content topics (rows) vs. competitors (columns), with empty cells = opportunities.
  - **Win/Loss Tracker:** bar chart of close rate by competitor, with drill-down to objection notes.
- API endpoints: `GET /api/competitors/radar`, `GET /api/competitors/benchmark`, `POST /api/competitors/intel` (for sales reps to log field observations).

### Data Points & Statistics
- Bangladesh study abroad market: **2,000+ consultancy firms** operating primarily in Dhaka, with intense rivalry among established players (IDP, PFEC, BSB Global, Edumax) and thousands of smaller firms [^9].
- Meta Ad Library API: **max 1,000 results per call**; pagination via `paging.cursors.after`; token lifespan ~60 days for long-lived tokens; Graph API versions deprecated annually [^1][^2].
- Social media monitoring: **50.4%** of users research brands and products online before buying, making real-time competitor intelligence a conversion factor [^3].
- Engagement benchmarking: **video content consistently outperforms static posts by 40%** in education/social sectors, and educational carousel posts receive **3× more saves** than promotional content [^7].
- AI automation savings: GTM professionals save an average of **12 hours per week** using AI-powered competitor monitoring tools [^15].
- Node.js scraping performance: Cheerio can parse **10× to 100× more pages** in parallel than Puppeteer because it has no browser overhead [^6].
- Bangladesh social media: Facebook dominates with **45–47M users** (~90% of social media users); Instagram has **8–10M** affluent urban users; TikTok has **15–18M** Gen Z users [^18].
- CRM integration ROI: Over **60%** of enterprise competitive intelligence programs run on Salesforce or HubSpot, with battlecard access inside deal records correlating to higher win rates [^13][^14].
- Free scraping tiers: Phantombuster offers **3 scrapers + 1,000 requests/month** free; Apify offers **$5/month** compute free; ScraperAPI offers **5,000 requests** 7-day trial; Dexi.io starts at **$9/month** [^5].
- Alert fatigue reduction: Monitoring **5–10 direct competitors** plus **2–3 aspirational benchmarks** is the recommended scope to avoid data overload while maintaining strategic relevance [^7][^8].

### Sources
- [^1]: HyperFX. "Meta Ad Library API and Scraping: A Developer's Guide for 2026." 2025. https://www.hyperfx.ai/blog/meta-ad-library-api-scraper-guide
- [^2]: AdManage AI. "Facebook Ads Library API: Pull Any Competitor's Ads." 2025. https://admanage.ai/blog/facebook-ads-library-api
- [^3]: HubSpot. "I tested the 7 best free social media monitoring tools." 2026. https://blog.hubspot.com/blog/tabid/6307/bid/29437/20-free-social-media-and-brand-monitoring-tools-that-rock.aspx
- [^4]: Gumloop. "8 best brand mention tools I'm using in 2026 (free + paid)." 2025. https://www.gumloop.com/blog/brand-mentions-tool
- [^5]: Sociavault. "The Ultimate Guide to the Best Social Media Scraping APIs in 2026." 2026. https://sociavault.com/blog/best-social-media-scraping-apis-2026
- [^6]: Scrapfly. "How to Scrape Social Media with Python in 2026." 2026. https://scrapfly.io/blog/posts/social-media-scraping
- [^7]: Socialinsider. "10 Best Practices for Benchmarking Social Media Competitors." 2026. https://www.socialinsider.io/blog/best-practices-for-benchmarking-social-media-competitors/
- [^8]: Socialinsider. "How to Create a Social Media Platform Strategy: Data & Tips." 2026. https://www.socialinsider.io/blog/social-media-platform-strategy/
- [^9]: BRAC University DSpace. "STS Global Education: Strategic Analysis of Bangladesh Study Abroad Market." 2025. https://dspace.bracu.ac.bd/xmlui/bitstream/handle/10361/27231/21104104_BBS.pdf
- [^10]: BRAC University DSpace. "Eduvisors Study Abroad Consultancy: Competitive Analysis." 2024. https://dspace.bracu.ac.bd/xmlui/bitstream/handle/10361/23532/18104157_BBS.pdf
- [^11]: AIM Technologies. "Social Listening for Competitor Brand Mentions: Gain the Edge." 2025. https://www.aimtechnologies.co/2025/05/06/social-listening-for-competitor-brand-mentions-gain-the-edge/
- [^12]: Industry Lens. "How to Set Up Google Alerts for Competitor Monitoring." 2026. https://industry-lens.com/resources/google-alerts-competitor-monitoring
- [^13]: Debriefing. "Competitive Intelligence for B2B SaaS Founders: Salesforce Integration." 2026. https://debriefing.io/guides/competitive-intelligence-tools-salesforce-integration
- [^14]: SuperAGI. "How to Choose the Right AI Competitor Analysis Tool for Your Business." 2025. https://superagi.com/how-to-choose-the-right-ai-competitor-analysis-tool-for-your-business-a-step-by-step-guide/
- [^15]: Parallel AI. "How to automate competitor analysis with AI agents." 2026. https://parallel.ai/articles/how-to-automate-competitor-analysis-with-ai-agents
- [^16]: Klue. "How to Automate Competitor Monitoring with AI." 2025. https://klue.com/blog/how-to-automate-competitor-monitoring
- [^17]: Daily Dev. "Self hosted tool for AI powered competitive analysis (MIT license)." 2026. https://app.daily.dev/posts/self-hosted-tool-for-ai-powered-competitive-analysis-mit-license--hntgqmwkq
- [^18]: Dimension 04 research (internal). "EduExpress Marketing Hub — Bangladesh Social Media Landscape." 2026. /Users/a1/Desktop/webApp/crm-webapp/research/eduexpress-marketing-hub_dim04.md
