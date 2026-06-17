"""
Main Orchestrator - The Marketing Hub Engine
Coordinates all components: content generation, calendar, tracking, analytics
"""
import json
import sys
from datetime import datetime, timedelta
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from core.llm_engine import ContentEngine, OpenCodeClient
from core.calendar_engine import ContentCalendar
from core.tracker import PerformanceTracker
from config import CAMPAIGN_TEMPLATES, PLATFORM_SPECS

class MarketingHub:
    """
    The Social Media Engineer for EduExpress International.
    
    Features:
    - Content Generation (TikTok, Facebook, Instagram, WhatsApp, Email, Blog)
    - Content Calendar (Weekly/Monthly auto-generation)
    - Performance Tracking (Engagement, Leads, Conversions, Campaigns)
    - Analytics Reports (Weekly summaries, recommendations)
    - Campaign Management (Create, monitor, optimize)
    - Scaling Engine (Auto-recommendations for growth)
    """
    
    def __init__(self):
        self.engine = ContentEngine()
        self.calendar = ContentCalendar()
        self.tracker = PerformanceTracker(data_dir="./tracking_data")
        self.llm = OpenCodeClient()
        print("✅ Marketing Hub initialized successfully")
    
    # === CONTENT GENERATION ===
    
    def generate_tiktok_content(self, topic: str, count: int = 3) -> list:
        """Generate multiple TikTok scripts"""
        print(f"🎬 Generating {count} TikTok scripts about: {topic}")
        scripts = []
        for i in range(count):
            hook_types = ["trust", "urgency", "social_proof", "education", "fomo"]
            hook = hook_types[i % len(hook_types)]
            result = self.engine.generate_tiktok_script(topic, hook, duration=30)
            scripts.append(result)
        return scripts
    
    def generate_facebook_campaign(self, campaign_name: str) -> dict:
        """Generate complete Facebook ad campaign"""
        print(f"📘 Generating Facebook campaign: {campaign_name}")
        return self.engine.generate_ad_copy(campaign_name, platform="facebook")
    
    def generate_instagram_content(self, theme: str, count: int = 3) -> list:
        """Generate Instagram posts and reels"""
        print(f"📸 Generating {count} Instagram contents for theme: {theme}")
        posts = []
        for i in range(count):
            post_type = "reel" if i == 0 else "carousel"
            result = self.engine.generate_facebook_post(theme, post_type, target="students")
            posts.append(result)
        return posts
    
    def generate_whatsapp_campaign(self, message_type: str = "scholarship_alert") -> dict:
        """Generate WhatsApp broadcast campaign"""
        print(f"💬 Generating WhatsApp campaign: {message_type}")
        return self.engine.generate_whatsapp_broadcast(message_type)
    
    def generate_email_sequence(self, sequence_name: str, count: int = 3) -> dict:
        """Generate email nurture sequence"""
        print(f"📧 Generating email sequence: {sequence_name}")
        return self.engine.generate_email_sequence(sequence_name, count)
    
    def generate_blog_post(self, topic: str) -> dict:
        """Generate SEO blog article"""
        print(f"📝 Generating blog post: {topic}")
        return self.engine.generate_blog_article(topic, word_count=800)
    
    def generate_creative_brief(self, campaign_name: str) -> dict:
        """Generate creative brief for design team"""
        print(f"🎨 Generating creative brief: {campaign_name}")
        return self.engine.generate_creative_brief(campaign_name)
    
    # === CALENDAR MANAGEMENT ===
    
    def create_monthly_calendar(self, month: int, year: int, theme: str) -> dict:
        """Create full month content calendar"""
        print(f"📅 Creating calendar for {month}/{year}: {theme}")
        calendar = self.calendar.generate_monthly_calendar(month, year, theme)
        return calendar
    
    def populate_calendar_with_content(self, calendar: dict) -> dict:
        """Fill calendar slots with generated content"""
        print("🤖 Generating content for all calendar slots...")
        populated = self.calendar.populate_content(calendar)
        return populated
    
    def export_calendar(self, calendar: dict, format: str = "json") -> str:
        """Export calendar to file"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        if format == "json":
            filepath = f"./calendars/calendar_{timestamp}.json"
            Path("./calendars").mkdir(parents=True, exist_ok=True)
            self.calendar.export_to_json(calendar, filepath)
        elif format == "csv":
            filepath = f"./calendars/calendar_{timestamp}.csv"
            Path("./calendars").mkdir(parents=True, exist_ok=True)
            self.calendar.export_to_csv(calendar, filepath)
        
        print(f"📁 Calendar exported to: {filepath}")
        return filepath
    
    # === TRACKING & ANALYTICS ===
    
    def record_post_performance(self, post_id: str, platform: str, metrics: dict) -> None:
        """Record post engagement metrics"""
        self.tracker.record_post_metrics(post_id, platform, metrics)
        print(f"📊 Recorded metrics for {post_id} on {platform}")
    
    def record_new_lead(self, lead_data: dict) -> None:
        """Record a new lead"""
        self.tracker.record_lead(lead_data)
        print(f"👤 New lead recorded: {lead_data.get('name', 'Unknown')}")
    
    def create_ad_campaign(self, campaign_data: dict) -> str:
        """Create and track a new ad campaign"""
        campaign_id = self.tracker.create_campaign(campaign_data)
        print(f"🚀 Campaign created: {campaign_id}")
        return campaign_id
    
    def update_campaign(self, campaign_id: str, metrics: dict) -> None:
        """Update campaign performance metrics"""
        self.tracker.update_campaign_metrics(campaign_id, metrics)
        print(f"📈 Updated campaign: {campaign_id}")
    
    def get_weekly_report(self, week_start: str = None) -> dict:
        """Generate weekly performance report"""
        if week_start is None:
            week_start = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d")
        
        report = self.tracker.generate_weekly_report(week_start)
        print(f"📋 Weekly report generated for {week_start}")
        return report
    
    def export_weekly_report(self, week_start: str = None, output_path: str = None) -> str:
        """Export weekly report to file"""
        if week_start is None:
            week_start = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d")
        
        if output_path is None:
            Path("./reports").mkdir(parents=True, exist_ok=True)
            output_path = f"./reports/weekly_report_{week_start}.md"
        
        self.tracker.export_weekly_report(week_start, output_path)
        print(f"📄 Report exported to: {output_path}")
        return output_path
    
    # === SCALING ENGINE ===
    
    def generate_scaling_recommendations(self) -> dict:
        """Analyze data and generate scaling recommendations"""
        print("🔍 Analyzing performance data for scaling recommendations...")
        
        # Get recent lead data
        funnel = self.tracker.get_lead_funnel(days=30)
        
        # Get campaign data
        campaigns_data = self.tracker._load_json(self.tracker.campaigns_file)
        active_campaigns = [c for c in campaigns_data.get("campaigns", []) if c["status"] == "active"]
        
        # Build prompt for LLM
        prompt = f"""Based on the following performance data, generate scaling recommendations for EduExpress marketing:
        
LEAD FUNNEL (Last 30 days):
- Total Leads: {funnel['total_leads']}
- File Opened: {funnel['file_opened']} ({funnel['conversion_to_file']}%)
- Visa Approved: {funnel['visa_approved']} ({funnel['conversion_to_visa']}%)
- Top Sources: {funnel['top_sources']}
- Top Platforms: {funnel['top_platforms']}

ACTIVE CAMPAIGNS: {len(active_campaigns)}

Generate:
1. 3 immediate scaling actions (what to do this week)
2. 3 medium-term scaling strategies (next 30 days)
3. 3 long-term growth initiatives (next 90 days)
4. Budget reallocation recommendations
5. New audience/targeting suggestions
6. Content strategy pivots based on data

Return as JSON with actionable items."""
        
        result = self.llm.generate(prompt, temperature=0.8)
        return result
    
    def run_full_pipeline(self, month: int, year: int, theme: str) -> dict:
        """Run the complete pipeline: calendar + content + tracking setup"""
        print("=" * 60)
        print("🚀 RUNNING FULL MARKETING HUB PIPELINE")
        print("=" * 60)
        
        # Step 1: Create calendar
        calendar = self.create_monthly_calendar(month, year, theme)
        
        # Step 2: Generate content (sample - first week only for speed)
        print("\n⚡ Generating sample content for first week...")
        if calendar.get("weeks"):
            first_week = calendar["weeks"][0]
            for post in first_week.get("posts", [])[:3]:  # Generate first 3 posts
                content = self._generate_sample_content(post)
                post["generated_content"] = content
                post["status"] = "generated"
        
        # Step 3: Export calendar
        json_path = self.export_calendar(calendar, format="json")
        csv_path = self.export_calendar(calendar, format="csv")
        
        # Step 4: Generate campaign materials
        print("\n🎯 Generating campaign materials...")
        campaigns = {}
        for campaign_key, template in CAMPAIGN_TEMPLATES.items():
            campaign = self.generate_facebook_campaign(template["name"])
            campaigns[campaign_key] = campaign
        
        # Step 5: Setup tracking
        print("\n📊 Setting up tracking infrastructure...")
        for campaign_key, template in CAMPAIGN_TEMPLATES.items():
            campaign_id = self.create_ad_campaign({
                "name": template["name"],
                "objective": template["objective"],
                "platforms": template["platforms"],
                "budget_bdt": template["budget_recommendation"]
            })
        
        print("\n" + "=" * 60)
        print("✅ PIPELINE COMPLETE")
        print("=" * 60)
        
        return {
            "calendar_json": json_path,
            "calendar_csv": csv_path,
            "campaigns": campaigns,
            "tracking_ready": True,
            "summary": {
                "total_posts": sum(len(w.get("posts", [])) for w in calendar.get("weeks", [])),
                "campaigns_generated": len(campaigns),
                "tracking_campaigns": len(CAMPAIGN_TEMPLATES)
            }
        }
    
    def _generate_sample_content(self, post: dict) -> dict:
        """Generate sample content for a post slot"""
        platform = post["platform"]
        theme = post["theme"]
        
        if platform == "tiktok":
            return self.engine.generate_tiktok_script(theme, "trust", 30)
        elif platform in ["facebook", "instagram"]:
            return self.engine.generate_facebook_post(theme, "carousel", "students")
        else:
            return {"content": "Sample content", "platform": platform}


# === CLI INTERFACE ===

def main():
    """CLI entry point for the Marketing Hub"""
    import argparse
    
    parser = argparse.ArgumentParser(description="EduExpress Marketing Hub - Social Media Engineer")
    parser.add_argument("--command", choices=[
        "full_pipeline", "calendar", "content", "campaign", "report", "scale", "help"
    ], default="help", help="Command to execute")
    parser.add_argument("--month", type=int, default=datetime.now().month, help="Month (1-12)")
    parser.add_argument("--year", type=int, default=datetime.now().year, help="Year")
    parser.add_argument("--theme", default="Scholarship Rush 2026", help="Monthly theme")
    parser.add_argument("--topic", default="CSCA Free Admission", help="Content topic")
    parser.add_argument("--campaign", default="risk_free", help="Campaign template key")
    
    args = parser.parse_args()
    
    hub = MarketingHub()
    
    if args.command == "full_pipeline":
        result = hub.run_full_pipeline(args.month, args.year, args.theme)
        print(json.dumps(result, indent=2, ensure_ascii=False))
    
    elif args.command == "calendar":
        calendar = hub.create_monthly_calendar(args.month, args.year, args.theme)
        hub.export_calendar(calendar, "json")
        hub.export_calendar(calendar, "csv")
    
    elif args.command == "content":
        content = hub.generate_tiktok_content(args.topic, count=3)
        print(json.dumps(content, indent=2, ensure_ascii=False))
    
    elif args.command == "campaign":
        campaign = hub.generate_facebook_campaign(args.campaign)
        print(json.dumps(campaign, indent=2, ensure_ascii=False))
    
    elif args.command == "report":
        report = hub.get_weekly_report()
        hub.export_weekly_report()
    
    elif args.command == "scale":
        recommendations = hub.generate_scaling_recommendations()
        print(json.dumps(recommendations, indent=2, ensure_ascii=False))
    
    elif args.command == "help":
        print("""
EduExpress Marketing Hub - Social Media Engineer

Commands:
  --command full_pipeline  Run complete pipeline (calendar + content + tracking)
  --command calendar       Generate monthly content calendar
  --command content        Generate TikTok content for a topic
  --command campaign       Generate Facebook ad campaign
  --command report         Generate weekly performance report
  --command scale          Generate scaling recommendations

Examples:
  python main.py --command full_pipeline --month 7 --year 2026 --theme "July Scholarship Results"
  python main.py --command content --topic "CSCA Free Admission"
  python main.py --command campaign --campaign csca_free
  python main.py --command scale
        """)


if __name__ == "__main__":
    main()
