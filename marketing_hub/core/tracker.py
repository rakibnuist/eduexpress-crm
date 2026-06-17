"""
Analytics & Performance Tracker
Tracks engagement, leads, conversions, and campaign performance
"""
import json
import csv
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from pathlib import Path

class PerformanceTracker:
    """Track all marketing performance metrics"""
    
    def __init__(self, data_dir: str = "./tracking_data"):
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.metrics_file = self.data_dir / "metrics.json"
        self.campaigns_file = self.data_dir / "campaigns.json"
        self.leads_file = self.data_dir / "leads.csv"
        
        # Initialize files if not exist
        self._init_files()
    
    def _init_files(self):
        """Initialize tracking files"""
        if not self.metrics_file.exists():
            self._save_json(self.metrics_file, {"daily_metrics": [], "weekly_summaries": []})
        
        if not self.campaigns_file.exists():
            self._save_json(self.campaigns_file, {"campaigns": []})
        
        if not self.leads_file.exists():
            with open(self.leads_file, 'w', newline='', encoding='utf-8') as f:
                writer = csv.writer(f)
                writer.writerow([
                    "date", "source", "platform", "campaign", "lead_type",
                    "name", "phone", "email", "destination_interest",
                    "status", "converted_to_file", "converted_to_visa", "notes"
                ])
    
    def _save_json(self, filepath: Path, data: Dict[str, Any]):
        """Save JSON data"""
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    
    def _load_json(self, filepath: Path) -> Dict[str, Any]:
        """Load JSON data"""
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    
    # === POST ENGAGEMENT TRACKING ===
    
    def record_post_metrics(self, post_id: str, platform: str, metrics: Dict[str, Any]) -> None:
        """Record engagement metrics for a post"""
        data = self._load_json(self.metrics_file)
        
        entry = {
            "date": datetime.now().isoformat(),
            "post_id": post_id,
            "platform": platform,
            "reach": metrics.get("reach", 0),
            "impressions": metrics.get("impressions", 0),
            "engagement": metrics.get("engagement", 0),
            "likes": metrics.get("likes", 0),
            "comments": metrics.get("comments", 0),
            "shares": metrics.get("shares", 0),
            "saves": metrics.get("saves", 0),
            "video_views": metrics.get("video_views", 0),
            "link_clicks": metrics.get("link_clicks", 0),
            "profile_visits": metrics.get("profile_visits", 0),
            "follower_growth": metrics.get("follower_growth", 0)
        }
        
        data["daily_metrics"].append(entry)
        self._save_json(self.metrics_file, data)
    
    def get_post_performance(self, post_id: str) -> Dict[str, Any]:
        """Get performance data for a specific post"""
        data = self._load_json(self.metrics_file)
        
        metrics = [m for m in data["daily_metrics"] if m["post_id"] == post_id]
        
        if not metrics:
            return {"error": "Post not found"}
        
        # Calculate engagement rate
        total_engagement = sum(m["engagement"] for m in metrics)
        total_reach = sum(m["reach"] for m in metrics)
        engagement_rate = (total_engagement / total_reach * 100) if total_reach > 0 else 0
        
        return {
            "post_id": post_id,
            "total_reach": total_reach,
            "total_engagement": total_engagement,
            "engagement_rate": round(engagement_rate, 2),
            "total_likes": sum(m["likes"] for m in metrics),
            "total_comments": sum(m["comments"] for m in metrics),
            "total_shares": sum(m["shares"] for m in metrics),
            "total_saves": sum(m["saves"] for m in metrics),
            "total_video_views": sum(m["video_views"] for m in metrics),
            "total_link_clicks": sum(m["link_clicks"] for m in metrics),
            "performance_rating": self._rate_performance(engagement_rate)
        }
    
    def _rate_performance(self, engagement_rate: float) -> str:
        """Rate performance based on engagement rate"""
        if engagement_rate >= 8:
            return "Excellent"
        elif engagement_rate >= 5:
            return "Good"
        elif engagement_rate >= 3:
            return "Average"
        elif engagement_rate >= 1:
            return "Below Average"
        else:
            return "Poor"
    
    # === LEAD TRACKING ===
    
    def record_lead(self, lead_data: Dict[str, Any]) -> None:
        """Record a new lead"""
        with open(self.leads_file, 'a', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow([
                lead_data.get("date", datetime.now().strftime("%Y-%m-%d")),
                lead_data.get("source", "organic"),
                lead_data.get("platform", "facebook"),
                lead_data.get("campaign", "none"),
                lead_data.get("lead_type", "inquiry"),
                lead_data.get("name", ""),
                lead_data.get("phone", ""),
                lead_data.get("email", ""),
                lead_data.get("destination_interest", "china"),
                lead_data.get("status", "new"),
                lead_data.get("converted_to_file", False),
                lead_data.get("converted_to_visa", False),
                lead_data.get("notes", "")
            ])
    
    def get_lead_funnel(self, days: int = 30) -> Dict[str, Any]:
        """Get lead funnel metrics"""
        cutoff = datetime.now() - timedelta(days=days)
        
        leads = []
        with open(self.leads_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                lead_date = datetime.strptime(row["date"], "%Y-%m-%d")
                if lead_date >= cutoff:
                    leads.append(row)
        
        total = len(leads)
        new_leads = sum(1 for l in leads if l["status"] == "new")
        contacted = sum(1 for l in leads if l["status"] == "contacted")
        qualified = sum(1 for l in leads if l["status"] == "qualified")
        file_opened = sum(1 for l in leads if l["converted_to_file"] == "True")
        visa_approved = sum(1 for l in leads if l["converted_to_visa"] == "True")
        
        conversion_to_file = (file_opened / total * 100) if total > 0 else 0
        conversion_to_visa = (visa_approved / total * 100) if total > 0 else 0
        
        return {
            "period_days": days,
            "total_leads": total,
            "new_leads": new_leads,
            "contacted": contacted,
            "qualified": qualified,
            "file_opened": file_opened,
            "visa_approved": visa_approved,
            "conversion_to_file": round(conversion_to_file, 2),
            "conversion_to_visa": round(conversion_to_visa, 2),
            "top_sources": self._get_top_sources(leads),
            "top_platforms": self._get_top_platforms(leads)
        }
    
    def _get_top_sources(self, leads: List[Dict[str, Any]], top_n: int = 3) -> List[Dict[str, Any]]:
        """Get top lead sources"""
        source_counts = {}
        for lead in leads:
            source = lead.get("source", "unknown")
            source_counts[source] = source_counts.get(source, 0) + 1
        
        sorted_sources = sorted(source_counts.items(), key=lambda x: x[1], reverse=True)
        return [{"source": s, "count": c} for s, c in sorted_sources[:top_n]]
    
    def _get_top_platforms(self, leads: List[Dict[str, Any]], top_n: int = 3) -> List[Dict[str, Any]]:
        """Get top lead platforms"""
        platform_counts = {}
        for lead in leads:
            platform = lead.get("platform", "unknown")
            platform_counts[platform] = platform_counts.get(platform, 0) + 1
        
        sorted_platforms = sorted(platform_counts.items(), key=lambda x: x[1], reverse=True)
        return [{"platform": p, "count": c} for p, c in sorted_platforms[:top_n]]
    
    # === CAMPAIGN TRACKING ===
    
    def create_campaign(self, campaign_data: Dict[str, Any]) -> str:
        """Create a new campaign tracking entry"""
        data = self._load_json(self.campaigns_file)
        
        campaign_id = f"camp_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        campaign = {
            "id": campaign_id,
            "created": datetime.now().isoformat(),
            "name": campaign_data.get("name", "Untitled"),
            "objective": campaign_data.get("objective", "awareness"),
            "platforms": campaign_data.get("platforms", ["facebook"]),
            "budget_bdt": campaign_data.get("budget_bdt", 0),
            "status": "active",
            "metrics": {
                "spend": 0,
                "impressions": 0,
                "clicks": 0,
                "leads": 0,
                "cost_per_lead": 0,
                "cost_per_click": 0,
                "ctr": 0,
                "roas": 0
            },
            "ads": []
        }
        
        data["campaigns"].append(campaign)
        self._save_json(self.campaigns_file, data)
        
        return campaign_id
    
    def update_campaign_metrics(self, campaign_id: str, metrics: Dict[str, Any]) -> None:
        """Update campaign metrics"""
        data = self._load_json(self.campaigns_file)
        
        for campaign in data["campaigns"]:
            if campaign["id"] == campaign_id:
                campaign["metrics"].update(metrics)
                
                # Calculate derived metrics
                if metrics.get("leads", 0) > 0 and metrics.get("spend", 0) > 0:
                    campaign["metrics"]["cost_per_lead"] = round(
                        metrics["spend"] / metrics["leads"], 2
                    )
                
                if metrics.get("clicks", 0) > 0 and metrics.get("spend", 0) > 0:
                    campaign["metrics"]["cost_per_click"] = round(
                        metrics["spend"] / metrics["clicks"], 2
                    )
                
                if metrics.get("impressions", 0) > 0:
                    campaign["metrics"]["ctr"] = round(
                        metrics.get("clicks", 0) / metrics["impressions"] * 100, 2
                    )
                
                break
        
        self._save_json(self.campaigns_file, data)
    
    def get_campaign_report(self, campaign_id: str) -> Dict[str, Any]:
        """Get full campaign performance report"""
        data = self._load_json(self.campaigns_file)
        
        for campaign in data["campaigns"]:
            if campaign["id"] == campaign_id:
                metrics = campaign["metrics"]
                
                # Generate recommendations
                recommendations = []
                if metrics.get("cost_per_lead", 0) > 500:
                    recommendations.append("CPL is above target. Consider audience refinement or creative refresh.")
                if metrics.get("ctr", 0) < 2:
                    recommendations.append("CTR is below 2%. Test new headlines and primary text.")
                if metrics.get("roas", 0) < 3:
                    recommendations.append("ROAS is below 3x. Review landing page conversion or offer.")
                
                return {
                    "campaign": campaign,
                    "recommendations": recommendations,
                    "performance_score": self._calculate_campaign_score(metrics)
                }
        
        return {"error": "Campaign not found"}
    
    def _calculate_campaign_score(self, metrics: Dict[str, Any]) -> int:
        """Calculate overall campaign performance score (0-100)"""
        score = 0
        
        # CTR scoring (30 points)
        ctr = metrics.get("ctr", 0)
        if ctr >= 3: score += 30
        elif ctr >= 2: score += 20
        elif ctr >= 1: score += 10
        
        # CPL scoring (30 points)
        cpl = metrics.get("cost_per_lead", 9999)
        if cpl <= 300: score += 30
        elif cpl <= 500: score += 20
        elif cpl <= 800: score += 10
        
        # ROAS scoring (40 points)
        roas = metrics.get("roas", 0)
        if roas >= 5: score += 40
        elif roas >= 3: score += 30
        elif roas >= 2: score += 20
        elif roas >= 1: score += 10
        
        return score
    
    # === WEEKLY & MONTHLY REPORTS ===
    
    def generate_weekly_report(self, week_start: str) -> Dict[str, Any]:
        """Generate comprehensive weekly report"""
        # Get lead funnel for last 7 days
        funnel = self.get_lead_funnel(days=7)
        
        # Get campaign performance
        data = self._load_json(self.campaigns_file)
        active_campaigns = [c for c in data["campaigns"] if c["status"] == "active"]
        
        total_spend = sum(c["metrics"].get("spend", 0) for c in active_campaigns)
        total_leads = sum(c["metrics"].get("leads", 0) for c in active_campaigns)
        avg_cpl = (total_spend / total_leads) if total_leads > 0 else 0
        
        # Get top performing posts
        metrics_data = self._load_json(self.metrics_file)
        recent_posts = [m for m in metrics_data["daily_metrics"] 
                       if m["date"] >= week_start]
        
        top_posts = sorted(
            recent_posts,
            key=lambda x: x["engagement"],
            reverse=True
        )[:5]
        
        return {
            "week": week_start,
            "lead_funnel": funnel,
            "campaign_summary": {
                "active_campaigns": len(active_campaigns),
                "total_spend_bdt": total_spend,
                "total_leads": total_leads,
                "avg_cpl_bdt": round(avg_cpl, 2)
            },
            "top_posts": top_posts,
            "recommendations": self._generate_weekly_recommendations(funnel, avg_cpl)
        }
    
    def _generate_weekly_recommendations(self, funnel: Dict[str, Any], avg_cpl: float) -> List[str]:
        """Generate actionable recommendations based on weekly data"""
        recommendations = []
        
        if funnel["conversion_to_file"] < 20:
            recommendations.append(
                "File opening conversion is below 20%. Review follow-up process and offer clarity."
            )
        
        if avg_cpl > 500:
            recommendations.append(
                "CPL is above target. Pause underperforming ads and test new creatives."
            )
        
        if funnel["total_leads"] < 50:
            recommendations.append(
                "Lead volume is below target. Increase ad spend or expand audience targeting."
            )
        
        return recommendations
    
    def export_weekly_report(self, week_start: str, output_path: str) -> None:
        """Export weekly report as formatted text"""
        report = self.generate_weekly_report(week_start)
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(f"# EduExpress Weekly Marketing Report\n")
            f.write(f"Week: {week_start}\n")
            f.write(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}\n\n")
            
            f.write(f"## Lead Funnel\n")
            f.write(f"- Total Leads: {report['lead_funnel']['total_leads']}\n")
            f.write(f"- File Opened: {report['lead_funnel']['file_opened']}\n")
            f.write(f"- Visa Approved: {report['lead_funnel']['visa_approved']}\n")
            f.write(f"- Conversion to File: {report['lead_funnel']['conversion_to_file']}%\n\n")
            
            f.write(f"## Campaign Summary\n")
            f.write(f"- Active Campaigns: {report['campaign_summary']['active_campaigns']}\n")
            f.write(f"- Total Spend: {report['campaign_summary']['total_spend_bdt']} BDT\n")
            f.write(f"- Avg CPL: {report['campaign_summary']['avg_cpl_bdt']} BDT\n\n")
            
            f.write(f"## Recommendations\n")
            for rec in report['recommendations']:
                f.write(f"- {rec}\n")
