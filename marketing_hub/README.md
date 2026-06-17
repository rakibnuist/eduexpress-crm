# EduExpress Marketing Hub

## Social Media Engineer for EduExpress International

A fully automated content generation, calendar management, and performance tracking system powered by **OpenCode Go LLM API (GLM-5.1)**.

---

## Features

### 1. Content Generation Engine
- **TikTok/Reels Scripts** — 15-60s video scripts with hooks, CTAs, and visual directions
- **Facebook Posts** — Carousels, videos, text posts with engagement strategies
- **Instagram Content** — Reels, stories, carousels optimized for visual platforms
- **WhatsApp Broadcasts** — Short, urgent messages for direct outreach
- **Email Sequences** — Lead nurture campaigns with A/B test variants
- **Blog Articles** — SEO-optimized long-form content for website traffic
- **Ad Campaign Copy** — Facebook/Instagram ad headlines, primary text, CTAs, targeting
- **Creative Briefs** — Design team briefs with visual direction and brand guidelines

### 2. Content Calendar
- **Weekly Calendar** — 7-day content plans with themes and optimal posting times
- **Monthly Calendar** — Full month with 4 weeks of content slots
- **Auto-population** — Fill calendar slots with LLM-generated content
- **Export** — JSON (for automation) and CSV (for human viewing)
- **Content Split** — 40% Trust/Education, 30% Social Proof, 20% Offers, 10% Brand

### 3. Performance Tracking
- **Post Engagement** — Reach, impressions, likes, comments, shares, saves, video views
- **Lead Funnel** — Inquiry → File Open → Visa Approved conversion tracking
- **Campaign Analytics** — Spend, CPL, CTR, ROAS, performance scoring
- **Weekly Reports** — Automated summaries with recommendations
- **A/B Testing** — Built-in testing framework for creatives

### 4. Scaling Engine
- **Data Analysis** — Analyze 30-day performance trends
- **Auto-Recommendations** — Budget reallocation, audience expansion, creative refresh
- **Growth Roadmap** — Immediate (1 week), medium (30 days), long-term (90 days) actions

---

## Quick Start

### 1. Install Dependencies
```bash
cd marketing_hub
pip install requests
```

### 2. Configure API Key
Edit `config.py` with your OpenCode Go key (already pre-configured).

### 3. Run Full Pipeline
```bash
python main.py --command full_pipeline --month 7 --year 2026 --theme "July Scholarship Results"
```

### 4. Generate TikTok Content
```bash
python main.py --command content --topic "CSCA Free Admission"
```

### 5. Generate Ad Campaign
```bash
python main.py --command campaign --campaign csca_free
```

### 6. Get Weekly Report
```bash
python main.py --command report
```

### 7. Get Scaling Recommendations
```bash
python main.py --command scale
```

---

## Directory Structure

```
marketing_hub/
├── config.py              # Research context + API config + platform specs
├── main.py                # Main orchestrator + CLI interface
├── core/
│   ├── __init__.py
│   ├── llm_engine.py      # OpenCode Go API client + content generators
│   ├── calendar_engine.py # Content calendar generation + export
│   └── tracker.py         # Performance tracking + analytics
├── tracking_data/          # Auto-generated metrics, leads, campaigns
├── calendars/              # Exported content calendars (JSON + CSV)
├── reports/              # Weekly performance reports (Markdown)
├── templates/             # Campaign templates and creative briefs
└── README.md             # This file
```

---

## Campaign Templates (Built-in)

| Campaign Key | Name | Objective | Budget (BDT/day) |
|-------------|------|-----------|-----------------|
| `risk_free` | Payment After Visa | Lead Gen | 5,000-10,000 |
| `csca_free` | CSCA-Free Universities | Lead Gen | 8,000-15,000 |
| `scholarship_rush` | Full Scholarship | Awareness | 10,000-20,000 |
| `korea_pipeline` | South Korea Visa First | Lead Gen | 5,000-10,000 |
| `rejection_recovery` | Europe Rejection → China | Lead Gen | 3,000-8,000 |

---

## Content Calendar Weekly Themes

| Day | Theme | Platform Focus |
|-----|-------|-----------------|
| Monday | Motivation Monday (Success Stories) | TikTok, Facebook |
| Tuesday | Trust Tuesday (Transparency) | Facebook, Instagram |
| Wednesday | Scholarship Wednesday (Opportunities) | All Platforms |
| Thursday | Think Thursday (Educational/Myth-Busting) | Facebook, TikTok |
| Friday | FAQ Friday (Live Q&A) | Facebook, Instagram |
| Saturday | Urgency Saturday (Deadlines) | All Platforms |
| Sunday | Community Sunday (Alumni) | Facebook, WhatsApp |

---

## Performance Targets (KPIs)

### Engagement
- Reach per post: 5,000+
- Engagement rate: 5%+
- Video views: 10,000+
- Shares: 100+
- Comments: 50+

### Lead Generation
- Inquiries per week: 50+
- File openings per month: 30+
- Conversion (inquiry → file): 20%+
- Conversion (file → visa): 60%+

### Campaign Performance
- Cost per lead (CPL): < 500 BDT
- Cost per acquisition (CPA): < 5,000 BDT
- Return on ad spend (ROAS): 5x+
- Click-through rate (CTR): 3%+

---

## Python API Usage

```python
from main import MarketingHub

# Initialize
hub = MarketingHub()

# Generate TikTok scripts
scripts = hub.generate_tiktok_content("Payment After Visa", count=3)

# Create monthly calendar
calendar = hub.create_monthly_calendar(7, 2026, "July Scholarship Results")

# Generate ad campaign
campaign = hub.generate_facebook_campaign("CSCA-Free University List")

# Create tracking campaign
campaign_id = hub.create_ad_campaign({
    "name": "CSCA-Free Campaign",
    "objective": "lead_generation",
    "budget_bdt": 10000
})

# Record metrics
hub.record_post_performance("post_001", "facebook", {
    "reach": 5000, "engagement": 300, "likes": 200,
    "comments": 50, "shares": 30, "video_views": 10000
})

# Record lead
hub.record_new_lead({
    "name": "Rahim Khan",
    "phone": "01712345678",
    "source": "facebook_ad",
    "platform": "facebook",
    "campaign": "csca_free",
    "destination_interest": "china"
})

# Get weekly report
report = hub.get_weekly_report()

# Get scaling recommendations
scaling = hub.generate_scaling_recommendations()

# Run full pipeline
result = hub.run_full_pipeline(7, 2026, "July Scholarship Results")
```

---

## Automation with Cron

Schedule daily content generation and weekly reporting:

```bash
# Daily content generation at 8:00 AM
0 8 * * * cd /path/to/marketing_hub && python main.py --command content --topic "daily_scholarship"

# Weekly report every Sunday at 9:00 AM
0 9 * * 0 cd /path/to/marketing_hub && python main.py --command report

# Monthly calendar generation on 1st of each month at 6:00 AM
0 6 1 * * cd /path/to/marketing_hub && python main.py --command full_pipeline
```

---

## Advanced: Custom Prompts

Use the LLM engine directly for custom content:

```python
from core.llm_engine import OpenCodeClient

llm = OpenCodeClient()

result = llm.generate("""
Generate a Facebook carousel post about EduExpress's Payment After Visa policy.
Target: Parents in Dhaka, Bangladesh.
Include: 5 slides, primary text, CTA, hashtags.
Return as JSON.
""")

print(result)
```

---

## Competitor Research Integration

The system is pre-loaded with deep research on 15 competitors including:
- MalishaEdu, DreamEdu, Sangen, AR Education, Megamind Plus
- Digi Edu Pro, CSHBD, Doedu, Dream Abroad, Wider World
- Study World, EduMatric, Atlas Study

All content generation uses this competitive intelligence to differentiate EduExpress messaging.

---

## Support & Updates

- OpenCode Go API: [api.opencode-go.com](https://api.opencode-go.com)
- Model: GLM-5.1
- EduExpress Website: [eduexpressint.com](https://eduexpressint.com)

---

*Built for EduExpress International — Turning Bangladeshi student dreams into global reality.*
