## Dimension 11: Marketing Automation Rules & Triggers

### Key Findings

- EduExpress already has a general-purpose Automation Hub (`Automation.jsx`) with 5 trigger types (keyword, new conversation, no response, lead status change, time-based) and 5 action types (reply, assign, add tag, create lead, send webhook), backed by an `automation_rules` SQLite table and `executeAutomationRules()` engine in `server.js` [^1].
- The marketing side has a separate social-automation schema: `content_posts`, `evergreen_bank`, `competitor_intel`, `kb_scholarships`, etc., managed via the Marketing page tabs (Calendar, Data Center, Brain Pool, Analytics) [^2].
- There is currently **no bridge** between the Automation Hub and the Marketing calendar/evergreen system. Marketing rules must be built as a separate rule engine or as an extension of the existing one.
- JSON-rules-engine is the most widely adopted Node.js library for configurable condition-action logic; it supports async fact lookups, custom operators, priority ordering, and browser/Node compatibility [^3].
- Content gap detection is a standard feature in modern AI schedulers (e.g., Social9, Apaya): the system scans the calendar for empty slots in a given window, compares against a target posting frequency per page/pillar, and either flags the gap or auto-fills it from an evergreen bank [^4].
- Evergreen content fallback systems work by marking top-performing posts as evergreen and recycling them at set intervals with optional cycle gaps (e.g., 5 days) and content variations; SocialBee and ContentStudio both use category-based rotation [^5].
- Deadline-driven automation for scholarships is a well-documented pattern: 40% of scholarship applications are submitted in the final 48 hours before deadlines, making automated reminder posts at T-30, T-14, T-7, and T-1 days highly effective [^6].
- Competitor-move alerts can be built via social monitoring APIs or scrapers (Apify, Mention, Awario) that watch competitor profiles for keyword spikes, new campaigns, or messaging shifts; alerts are delivered via webhooks or Slack with structured payloads [^7].
- Engagement-based triggers use z-score or threshold logic: a post is flagged as viral when its engagement z-score exceeds 3 (Facebook) or 2.5 (YouTube) relative to baseline, or when engagement crosses a configurable threshold (e.g., 3x baseline average within 6 hours) [^8].
- Content quality auto-checks before publishing are typically rule-based pipelines: spell/grammar checks, brand tone scoring, keyword verification, hashtag validity, image aspect ratio checks, and a composite quality score with a configurable pass threshold (e.g., 70%) [^9].
- Smart scheduling algorithms analyze historical engagement per time slot and platform to recommend optimal windows; Sprout Social’s ViralPost and Buffer’s Best Time to Post report 15–30% engagement lifts versus manual scheduling [^10].
- The ECA (Event-Condition-Action) pattern is the dominant architecture for rule engines: events fire triggers, conditions evaluate facts, and actions execute if all conditions pass [^11].
- Node-cron is the standard library for time-based rule execution in Node.js/Express, supporting timezone-aware scheduling, start/stop controls, and async error handling [^12].
- Webhooks are the preferred real-time delivery mechanism for automation alerts, with 60–70% lower integration complexity than polling and 100x better latency for time-sensitive operations [^13].
- The average Instagram engagement rate in 2026 is ~1.8%, TikTok ~5.5%, LinkedIn ~1.2–3%; posts above 3% engagement receive 40% more algorithmic boost [^14].
- 67% of marketers say maintaining a consistent posting schedule is their biggest challenge, which gap-filling automation directly solves [^4].

### Implementation Approaches

#### 1. Extend the existing Automation Hub with marketing-specific triggers & actions

**Details:** Add new trigger types (`content_gap`, `deadline_approaching`, `engagement_threshold`, `competitor_post_detected`) and action types (`schedule_post`, `pull_evergreen`, `send_alert`, `boost_post`) to the existing `automation_rules` table schema. Pros: reuses existing UI, API, and analytics infrastructure. Cons: the current engine is tightly coupled to conversation/message context; refactoring required to support marketing facts. Pseudocode for the extended engine:

```javascript
async function evaluateMarketingRules(fact) {
  const rules = db.prepare("SELECT * FROM automation_rules WHERE active=1 AND domain='marketing' ORDER BY priority DESC").all();
  for (const rule of rules) {
    const triggered = await evaluateCondition(rule.trigger_type, JSON.parse(rule.trigger_config), fact);
    if (!triggered) continue;
    await executeAction(rule.action_type, JSON.parse(rule.action_config), fact);
    logAnalytics(rule.id, 'executed', fact);
  }
}
```

#### 2. Build a dedicated Marketing Rule Engine (recommended)

**Details:** Create a separate `marketing_rules` table with ECA-style columns: `event_type`, `condition_json`, `action_json`, `schedule_cron`, `is_active`. Run a dedicated cron worker (`node-cron`) that checks time-based and event-based rules every 5–15 minutes. Pros: cleaner separation, marketing rules can be more complex (multi-condition, AND/OR logic), no risk of breaking chat automation. Cons: more code to maintain. Pseudocode:

```javascript
const cron = require('node-cron');

cron.schedule('*/15 * * * *', async () => {
  await checkContentGapRules();      // trigger: no post scheduled in next N days for page X
  await checkDeadlineRules();        // trigger: scholarship deadline within T days
  await checkEngagementRules();      // trigger: published post crossed engagement threshold
  await checkCompetitorRules();      // trigger: new competitor intel row added
});
```

#### 3. Evergreen content fallback system

**Details:** When a content gap is detected for a given page and week, query `evergreen_bank` for approved rows matching the page pool and pillar, pick one that hasn’t been used recently (track via `last_used_at` or a usage log), clone it into `content_posts` with `source='evergreen'`, and set status to `drafted` for human approval. Pros: guarantees the calendar never runs empty. Cons: over-reliance on evergreen can make the feed feel repetitive without variation support.

```sql
-- Pseudo query for gap fill
INSERT INTO content_posts (week, post_date, page, pillar, body, hashtags, source, status)
SELECT :target_week, :target_date, page_pool, pillar, body, hashtags, 'evergreen', 'drafted'
FROM evergreen_bank
WHERE page_pool = :page AND status = 'approved'
  AND id NOT IN (SELECT evergreen_id FROM content_posts WHERE week >= :recent_week)
ORDER BY RANDOM() LIMIT 1;
```

#### 4. Deadline-driven content automation

**Details:** Store scholarship deadlines in `kb_scholarships`. A cron job runs daily and selects scholarships with deadlines in 30, 14, 7, or 1 days. For each, it creates a reminder post in `content_posts` with a pre-approved template (e.g., “⏰ Only 7 days left to apply for the CSC Scholarship!”). The rule config specifies which pillars/pages to target and how many reminder posts to create. Pros: highly relevant, timely content that drives leads. Cons: requires accurate, up-to-date deadline data.

```javascript
function createDeadlineReminderPosts() {
  const windows = [30, 14, 7, 1];
  const rules = db.prepare("SELECT * FROM marketing_rules WHERE event_type='deadline_approaching' AND is_active=1").all();
  for (const rule of rules) {
    const cfg = JSON.parse(rule.condition_json);
    const scholarships = db.prepare(`
      SELECT * FROM kb_scholarships
      WHERE deadline BETWEEN date('now', '+${cfg.days} days') AND date('now', '+${cfg.days} days', '+1 day')
        AND status = 'Open'
    `).all();
    for (const s of scholarships) {
      // create post only if not already created for this scholarship+window
      const exists = db.prepare("SELECT 1 FROM content_posts WHERE source='deadline_reminder' AND scholarship_id=? AND days_before=?").get(s.id, cfg.days);
      if (!exists) {
        db.prepare("INSERT INTO content_posts ...").run(...);
      }
    }
  }
}
```

#### 5. Competitor-move alerts

**Details:** Monitor `competitor_intel` table (populated by n8n or a scraper). When a new row is inserted, the rule engine evaluates whether it matches configured alert criteria (e.g., competitor = ‘X’, channel = ‘Instagram’, observation contains ‘scholarship’). On match, it sends an alert (Slack/email/webhook) and optionally creates a counter-content post suggestion in `content_posts`. Pros: fast reaction to competitive threats. Cons: false positives if filtering is too broad.

```javascript
async function evaluateCompetitorRules(intelRow) {
  const rules = db.prepare("SELECT * FROM marketing_rules WHERE event_type='competitor_post_detected' AND is_active=1").all();
  for (const rule of rules) {
    const cfg = JSON.parse(rule.condition_json);
    if (cfg.competitor && cfg.competitor !== intelRow.competitor) continue;
    if (cfg.keywords && !cfg.keywords.some(k => intelRow.observation.includes(k))) continue;
    // Trigger action
    if (cfg.action === 'alert') sendWebhook(cfg.webhook_url, intelRow);
    if (cfg.action === 'suggest_counter_post') createDraftPost(cfg.counter_template, intelRow);
  }
}
```

#### 6. Engagement-based triggers

**Details:** After a post is published, periodically fetch its reach/engagement metrics (from platform APIs or manual entry). Compute engagement rate = (engagements / impressions) × 100. If it exceeds a threshold (e.g., 3× baseline for the page), trigger an action: boost the post with paid spend, create a follow-up post, or notify the team. Pros: capitalizes on momentum. Cons: requires platform API access or manual metric updates.

```javascript
function evaluateEngagementRules(post) {
  const baseline = db.prepare("SELECT AVG(engagement*1.0/reach) as rate FROM content_posts WHERE page=? AND status='published' AND published_at > date('now', '-90 days')").get(post.page).rate || 0.02;
  const rate = (post.engagement / Math.max(1, post.reach));
  const rules = db.prepare("SELECT * FROM marketing_rules WHERE event_type='engagement_threshold' AND is_active=1").all();
  for (const rule of rules) {
    const cfg = JSON.parse(rule.condition_json);
    if (rate >= baseline * cfg.multiplier) {
      executeAction(rule.action_type, JSON.parse(rule.action_config), post);
    }
  }
}
```

#### 7. Content quality auto-checks before publishing

**Details:** Implement a `quality_score` function that runs before a post transitions from `drafted` → `approved` (or `scheduled`). Score components: length check (hook ≥ 30 chars, body ≥ 100 chars), hashtag count (3–10), keyword relevance (contains pillar keyword), readability (simple language score), no prohibited terms, asset URL presence for visual formats. Total score 0–100; if below threshold (e.g., 70), block transition and return feedback. Pros: prevents low-quality posts from going live. Cons: rigid thresholds may reject creative content; should be configurable per pillar.

```javascript
function scoreContent(post) {
  let score = 0;
  if (post.hook && post.hook.length >= 30) score += 20;
  if (post.body && post.body.length >= 100) score += 20;
  const hashtags = (post.hashtags || '').split(/\s+/).filter(Boolean);
  if (hashtags.length >= 3 && hashtags.length <= 10) score += 20;
  if (post.pillar && post.body.toLowerCase().includes(post.pillar.toLowerCase())) score += 15;
  if (post.asset_url || post.brief) score += 15;
  if (!post.body.includes('prohibited_term')) score += 10;
  return score;
}
```

#### 8. Smart scheduling based on best-performing time slots

**Details:** Maintain a `post_performance` aggregation table: `page`, `slot_time`, `day_of_week`, `avg_reach`, `avg_engagement`, `sample_size`. When scheduling a new post, query the top 3 slots for that page and pillar, then assign the post to the highest-ranked slot that still has capacity (e.g., max 1 post per slot). Update aggregates weekly. Pros: data-driven, continuously improving. Cons: needs enough historical data to be reliable; cold-start problem for new pages.

```sql
-- Best slot query
SELECT slot_time, day_of_week,
       AVG(engagement*1.0/NULLIF(reach,0)) as rate,
       COUNT(*) as n
FROM content_posts
WHERE page = ? AND status = 'published' AND post_date > date('now', '-90 days')
GROUP BY slot_time, day_of_week
HAVING n >= 3
ORDER BY rate DESC
LIMIT 3;
```

### Data Points & Statistics

- 40% of scholarship applications are submitted in the final 48 hours before deadlines [^6].
- 67% of marketers say maintaining a consistent posting schedule is their biggest challenge [^4].
- Average Instagram engagement rate in 2026: ~1.8%; TikTok: ~5.5%; LinkedIn: ~1.2–3% [^14].
- Posts with engagement rates above 3% receive 40% more algorithmic boost than lower-performing content [^14].
- Smart scheduling tools report 15–30% engagement lift and 10+ hours/week saved compared to manual scheduling [^10].
- Webhooks reduce integration complexity by 60–70% versus polling and provide 100x better latency [^13].
- Buffer users report ~15% increase in weekend sales after switching to optimal-time scheduling [^10].
- Engagement rate formula: (Total engagement ÷ Reach or Impressions) × 100 [^14].
- Viral detection threshold: z-score > 3 for Facebook, > 2.5 for YouTube [^8].
- Quality validation pass threshold used in n8n content workflows: 70% [^9].
- Evergreen automation minimum: at least 2 posts required to start a recycling campaign [^5].

### Sources

- [^1]: EduExpress CRM codebase. `server.js` (lines 1428–1496, 2332–2531), `src/pages/Automation.jsx`, `src/pages/Marketing.jsx`. June 2026.
- [^2]: EduExpress CRM codebase. `server.js` (lines 1428–1496) — marketing tables: `content_posts`, `evergreen_bank`, `competitor_intel`, `kb_scholarships`. June 2026.
- [^3]: Nected. “Top 10 Node.js Rule Engines for your business decisions.” 4 May 2026. https://www.nected.ai/blog/rule-engine-in-node-js-javascript
- [^4]: Social9. “AI Social Media Content Calendar - Plan & Schedule Smarter.” 18 May 2026. https://social9.com/social-media-content-calendar
- [^5]: ContentStudio. “How to recycle posts using Evergreen automation recipe.” 6 Apr 2026. https://docs.contentstudio.io/article/584-evergreen-automation-campaign
- [^6]: SmartSMS Solutions. “60+ Scholarship Deadline Reminder Messages for Mid-Summer 2025.” 29 Aug 2025. https://smartsmssolutions.com/resources/blog/sms-templates/business-message-templates/60-scholarship-deadline-reminder-messages-for-mid-summer-2025
- [^7]: Apify. “Social Media Analytics & Brand Monitoring with Apify (2026).” 21 Mar 2026. https://use-apify.com/docs/apify-use-cases/social-media-analytics
- [^8]: Sangiorgio et al. “Evaluating the effect of viral posts on social media engagement.” PMC, 2025. https://pmc.ncbi.nlm.nih.gov/articles/PMC11699135/
- [^9]: n8n workflow template. “Generate & schedule social media posts with GPT-4 and Telegram approval workflow.” 11 Dec 2025. https://n8n.io/workflows/5773-generate-and-schedule-social-media-posts-with-gpt-4-and-telegram-approval-workflow/
- [^10]: Sprout Social. “Best times to post on social media in 2026.” 29 May 2026. https://sproutsocial.com/insights/best-times-to-post-on-social-media/
- [^11]: SonicJS. “feat: Rules Engine - Event-Condition-Action Automation System.” 23 Jan 2026. https://github.com/SonicJs-Org/sonicjs/issues/553
- [^12]: OneUptime. “How to Create Cron Jobs in Node.js.” 22 Jan 2026. https://oneuptime.com/blog/post/2026-01-22-nodejs-cron-jobs/view
- [^13]: Saber. “Webhook: Definition, Examples & Use Cases.” 19 May 2026. https://www.saber.app/glossary/webhook
- [^14]: InfluenceFlow. “Engagement Rate and Reach Metrics Guide 2026.” 2 Feb 2026. https://influenceflow.io/resources/engagement-rate-and-reach-metrics-the-complete-2026-guide-to-social-media-success/
