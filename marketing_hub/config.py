# EduExpress Marketing Hub — Social Media Engineer
# Configuration & Research Context
# Auto-loaded by all modules

RESEARCH_CONTEXT = """
# EDUEXPRESS BRAND PROFILE
EduExpress International is an education consultancy based in Dhaka, Bangladesh.
- Founded: 7+ years ago
- Placements: 2000+ successful students
- Destinations: China, South Korea, Malaysia, Hungary, Malta, Cyprus, Georgia, Europe
- Flagship Policy: PAYMENT AFTER VISA (100% risk-free for students)
- Office: Plot-12/1, Road-4/A, Jigatola, Dhanmondi, Dhaka
- Contact: +8801983333566, +8801329663505
- Website: eduexpressint.com
- Social Media: Facebook (EduExpressIntBD: 16K followers, eduexpressint: 13K followers), Instagram: eduexpressint, TikTok: @eduexpressint

# STUDENT & PARENT PSYCHOLOGY (Bangladesh Market)
## Students (Age 18-24):
- Fear: Scams, losing money, visa rejection, being alone in foreign country
- Aspirations: Scholarship, free education, monthly stipend, career in China/tech
- Triggers: "No payment before visa", "100% scholarship", "CSCA not required", "Free air ticket"
- Platforms: TikTok, Instagram Reels, Facebook (groups & pages)
- Language: Bangla (primary), English (secondary)
- Decision factors: Social proof (testimonials), transparency, ease of process

## Parents (Age 40-55):
- Fear: Wasting money, child safety, fake agencies, visa rejection
- Concerns: Total cost, ROI, safety, post-arrival support, university credibility
- Triggers: "Payment After Visa", "Government-registered", "University partnerships", "Airport pickup"
- Platforms: Facebook (primary), WhatsApp
- Language: Bangla (dominant)
- Decision factors: Trust, references, office visit, written agreements

## Key Pain Points:
1. CSCA exam fear (now mandatory for bachelor admissions from Sep 2026)
2. IELTS requirement anxiety
3. Study gap insecurity
4. Average academic profile discouragement
5. Europe/Korea visa rejection trauma
6. Uncertainty about total cost
7. Lack of post-arrival support

## Key Desires:
1. Full scholarship (100% tuition + hostel + stipend)
2. Top-ranked university admission
3. Career in China after graduation
4. English-medium programs
5. Visa guarantee
6. End-to-end support (from Dhaka to hostel)
7. Post-graduation job opportunities

# COMPETITOR LANDSCAPE
## Tier 1 - Dominant (CRITICAL Threat):
1. MalishaEdu (18K followers, Guangzhou-based, 27,000+ students, 250+ universities, BRCC language center, medical tourism, job placement)
2. DreamEdu (211K followers, Chengdu office, 100+ university partnerships, 8+ countries, massive social media)
3. Sangen Edu (18+ years, 300+ universities, Gold Certified, government registered)

## Tier 2 - Strong (HIGH Threat):
4. AR Education (78K followers, NUAA partnership, visa success stories)
5. Megamind Plus (84K followers, HIT exclusive partner, British Council IELTS venue, CSCA prep)
6. Digi Edu Pro (21K followers, 10+ years, 300+ universities, free air ticket, no file opening charge)
7. CSHBD (20K followers, 350+ universities, 4-tier scholarship system, China offices)
8. Doedu (57K followers, bold claims, 100% scholarship, China office Xi'an, no payment before visa)
9. Dream Abroad (34K followers, 4-city Bangladesh presence, middle-class focus, video reviews)
10. Wider World (67K followers, trust-building educational content, warning posts about scams)
11. Study World (70K followers, MBBS + AI focus, 8 direct admission universities)

## Tier 3 - Notable (MEDIUM Threat):
12. EduMatric (29K followers, Greenland Group backing, medical tourism)
13. Atlas Study (10K followers, 7 divisional offices, multi-destination)

# CONTENT PILLARS & HOOKS
## 1. Trust & Safety (40% of content)
- "Payment After Visa" - EduExpress's unique differentiator
- "No file opening charge" - remove barriers
- "Written agreement" - legal protection
- "Government registered" - credibility
- "7+ years track record" - longevity
- "2000+ placements" - social proof

## 2. Scholarship Focus (30% of content)
- "100% Full Scholarship" - ultimate dream
- "Tuition Free + Stipend" - monthly income
- "CSC Scholarship 2026" - trending topic
- "No IELTS required" - accessibility
- "Average profile accepted" - inclusivity
- "Study gap accepted" - second chances

## 3. Career & Future (20% of content)
- "China as Economic Powerhouse" - career angle
- "AI + Tech Education" - future-proofing
- "Internship Opportunities" - practical experience
- "Job in China after graduation" - ROI
- "Gateway to USA/UK/Europe" - strategic stepping stone
- "Global Networking" - 100+ countries on campus

## 4. Urgency & FOMO (10% of content)
- "Limited seats" - scarcity
- "First Come First Served" - competition
- "Deadline approaching" - time pressure
- "CSCA-free last chance" - March 2026 intake
- "Scholarship slots filling fast" - exclusivity

## VIRAL TOPIC CALENDAR (2026)
### January: New Year Scholarship Rush
### February: Valentine's Day + Scholarship Love
### March: Spring Intake Launch - CSCA-Free Last Chance
### April: Ramadan/Eid Content - Family Focus
### May: Summer Prep Season - CSCA Prep
### June: HSC Result Season - Fresh Graduate Targeting
### July: Scholarship Results - Celebration
### August: Pre-Departure - Visa Success Stories
### September: New Semester - Welcome Content
### October: Winter/Early Bird - 2027 Intake
### November: Black Friday / Year-End Special
### December: Year in Review - Success Compilation

## KEY PERFORMANCE INDICATORS (KPIs)
### Engagement Metrics:
- Reach per post (target: 5K+ for organic)
- Engagement rate (target: 5%+)
- Video views (target: 10K+ per video)
- Shares (target: 100+ per post)
- Comments (target: 50+ per post)
- Saves (target: 200+ per post)

### Lead Generation:
- Inquiries per week (target: 50+)
- File openings per month (target: 30+)
- Conversion rate (inquiry -> file open): 20%+
- Conversion rate (file open -> visa): 60%+

### Campaign Performance:
- Cost per lead (CPL) (target: under 500 BDT)
- Cost per acquisition (CPA) (target: under 5,000 BDT)
- Return on ad spend (ROAS) (target: 5x+)
- Click-through rate (CTR) (target: 3%+)
"""

# OpenCode Go API Configuration
OPENCODE_CONFIG = {
    "key": "sk-KF63PVImS4EsF2iaEvwTNHcFNqNVzEoIHJZ8K01poqEM97qZ8smo52DEye5g9KaL",
    "provider": "opencode-go",
    "model": "minimax-m3",  # Working model: produces great Bangla content
    "fallback_models": ["glm-5.1", "deepseek-v4-pro"],
    "base_url": "https://opencode.ai/zen/go/v1"
}

# Platform-Specific Content Specs
PLATFORM_SPECS = {
    "tiktok": {
        "max_length": 150,
        "hashtag_count": 5,
        "video_length": "15-60s",
        "hook_time": "0-3s",
        "cta_time": "last 3s",
        "optimal_times": ["7PM-9PM", "12PM-2PM"],
        "frequency": "2-3 per day"
    },
    "facebook": {
        "max_length": 300,
        "hashtag_count": 3,
        "post_types": ["carousel", "video", "image", "text"],
        "optimal_times": ["6PM-9PM", "12PM-2PM", "9AM-11AM"],
        "frequency": "2-3 per day",
        "ad_creatives_per_campaign": 4
    },
    "instagram": {
        "max_length": 150,
        "hashtag_count": 10,
        "post_types": ["reel", "carousel", "story", "static"],
        "optimal_times": ["7PM-9PM", "11AM-1PM"],
        "frequency": "1-2 per day"
    },
    "whatsapp": {
        "max_length": 100,
        "frequency": "3-5 per day",
        "types": ["status", "broadcast", "group"]
    }
}

# Weekly Content Themes
WEEKLY_THEMES = {
    "Monday": "Motivation Monday (Success Stories)",
    "Tuesday": "Trust Tuesday (Transparency/Process)",
    "Wednesday": "Scholarship Wednesday (New Opportunities)",
    "Thursday": "Think Thursday (Educational/Myth-Busting)",
    "Friday": "FAQ Friday (Live Q&A/Questions)",
    "Saturday": "Urgency Saturday (Deadlines/Limited Seats)",
    "Sunday": "Community Sunday (Alumni/Student Network)"
}

# Content Split (percentages)
CONTENT_SPLIT = {
    "education_trust": 40,
    "social_proof": 30,
    "offers_urgency": 20,
    "brand_culture": 10
}

# Campaign Templates
CAMPAIGN_TEMPLATES = {
    "risk_free": {
        "name": "Payment After Visa - Trust Builder",
        "objective": "Lead Generation",
        "audience": "Parents + Risk-averse students",
        "hook": "ভিসা না হলে ১ টাকাও দিতে হবে না",
        "headline": "No Visa, No Service Charge!",
        "cta": "WhatsApp Now",
        "platforms": ["facebook", "instagram"],
        "budget_recommendation": "5000-10000 BDT/day"
    },
    "csca_free": {
        "name": "CSCA-Free University List",
        "objective": "Lead Generation",
        "audience": "CSCA-fearful bachelor students",
        "hook": "CSCA ছাড়াই চীনে Bachelor!",
        "headline": "Study in China Without CSCA Exam!",
        "cta": "Get Free University List",
        "platforms": ["facebook", "tiktok", "instagram"],
        "budget_recommendation": "8000-15000 BDT/day"
    },
    "scholarship_rush": {
        "name": "Full Scholarship Mass Appeal",
        "objective": "Reach + Awareness",
        "audience": "SSC/HSC graduates + Diploma holders",
        "hook": "100% টিউশন ফ্রি + মাসিক স্টাইপেন্ড",
        "headline": "100% Full Scholarship in China!",
        "cta": "Apply Now",
        "platforms": ["facebook", "tiktok"],
        "budget_recommendation": "10000-20000 BDT/day"
    },
    "korea_pipeline": {
        "name": "South Korea Visa First",
        "objective": "Lead Generation",
        "audience": "Korea aspirants + rejected Europe applicants",
        "hook": "ভিসা আগে, টাকা পরে - South Korea!",
        "headline": "Visa First, Pay Later for Korea!",
        "cta": "Book Appointment",
        "platforms": ["facebook", "instagram"],
        "budget_recommendation": "5000-10000 BDT/day"
    },
    "rejection_recovery": {
        "name": "Europe/Korea Rejection -> China",
        "objective": "Lead Generation",
        "audience": "Rejected Europe/Korea applicants",
        "hook": "Europe visa reject? China is your answer!",
        "headline": "Rejected? Don't Give Up - China Awaits!",
        "cta": "Get Free Assessment",
        "platforms": ["facebook", "instagram"],
        "budget_recommendation": "3000-8000 BDT/day"
    }
}
