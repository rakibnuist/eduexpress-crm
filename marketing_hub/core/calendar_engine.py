"""
Content Calendar Generator
Auto-generates weekly and monthly content calendars
"""
import json
from datetime import datetime, timedelta
from typing import List, Dict, Any
from core.llm_engine import ContentEngine
from config import WEEKLY_THEMES, CONTENT_SPLIT, PLATFORM_SPECS

class ContentCalendar:
    """Generate and manage content calendars"""
    
    def __init__(self):
        self.engine = ContentEngine()
        self.weekly_themes = WEEKLY_THEMES
        self.content_split = CONTENT_SPLIT
    
    def generate_weekly_calendar(self, week_start: str, month_theme: str) -> Dict[str, Any]:
        """Generate a full week of content"""
        calendar = {
            "week_start": week_start,
            "month_theme": month_theme,
            "posts": []
        }
        
        days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        
        for day in days:
            theme = self.weekly_themes[day]
            
            # Generate 2-3 posts per day across platforms
            if day in ["Monday", "Wednesday", "Saturday"]:
                # High-engagement days: more posts
                posts = self._generate_day_posts(day, theme, 3, month_theme)
            else:
                posts = self._generate_day_posts(day, theme, 2, month_theme)
            
            calendar["posts"].extend(posts)
        
        return calendar
    
    def _generate_day_posts(self, day: str, theme: str, count: int, month_theme: str) -> List[Dict[str, Any]]:
        """Generate posts for a single day"""
        posts = []
        
        platforms = ["facebook", "tiktok", "instagram"]
        
        for i in range(count):
            platform = platforms[i % len(platforms)]
            
            # Determine content type based on content split
            content_type = self._pick_content_type()
            
            post = {
                "day": day,
                "platform": platform,
                "theme": theme,
                "month_theme": month_theme,
                "content_type": content_type,
                "optimal_time": PLATFORM_SPECS[platform]["optimal_times"][0] if platform in PLATFORM_SPECS else "6PM-9PM",
                "status": "pending_generation",
                "generated_content": None,
                "scheduled": False,
                "posted": False,
                "engagement": None
            }
            posts.append(post)
        
        return posts
    
    def _pick_content_type(self) -> str:
        """Pick content type based on split percentages"""
        import random
        weights = [
            ("education_trust", self.content_split["education_trust"]),
            ("social_proof", self.content_split["social_proof"]),
            ("offers_urgency", self.content_split["offers_urgency"]),
            ("brand_culture", self.content_split["brand_culture"])
        ]
        
        total = sum(w[1] for w in weights)
        r = random.randint(1, total)
        cumulative = 0
        for content_type, weight in weights:
            cumulative += weight
            if r <= cumulative:
                return content_type
        return "education_trust"
    
    def generate_monthly_calendar(self, month: int, year: int, theme: str) -> Dict[str, Any]:
        """Generate full month calendar"""
        from calendar import monthrange
        
        _, days_in_month = monthrange(year, month)
        
        calendar = {
            "month": month,
            "year": year,
            "theme": theme,
            "weeks": []
        }
        
        # Generate 4 weeks
        for week in range(1, 5):
            week_start = f"{year}-{month:02d}-{(week-1)*7+1:02d}"
            weekly = self.generate_weekly_calendar(week_start, theme)
            calendar["weeks"].append(weekly)
        
        return calendar
    
    def populate_content(self, calendar: Dict[str, Any]) -> Dict[str, Any]:
        """Use LLM to generate actual content for each post slot"""
        for week in calendar.get("weeks", []):
            for post in week.get("posts", []):
                if post["status"] == "pending_generation":
                    content = self._generate_post_content(post)
                    post["generated_content"] = content
                    post["status"] = "generated"
        
        return calendar
    
    def _generate_post_content(self, post: Dict[str, Any]) -> Dict[str, Any]:
        """Generate content for a specific post slot"""
        platform = post["platform"]
        theme = post["theme"]
        content_type = post["content_type"]
        
        if platform == "tiktok":
            return self.engine.generate_tiktok_script(
                topic=f"{theme} - {content_type}",
                hook_type=content_type,
                duration=30
            )
        elif platform == "facebook":
            return self.engine.generate_facebook_post(
                theme=f"{theme} - {content_type}",
                post_type="carousel" if content_type == "education_trust" else "video"
            )
        elif platform == "instagram":
            return self.engine.generate_facebook_post(
                theme=f"{theme} - {content_type}",
                post_type="reel"
            )
        else:
            return {"content": "Platform not supported", "error": True}
    
    def export_to_json(self, calendar: Dict[str, Any], filepath: str) -> None:
        """Export calendar to JSON file"""
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(calendar, f, ensure_ascii=False, indent=2)
    
    def export_to_csv(self, calendar: Dict[str, Any], filepath: str) -> None:
        """Export calendar to CSV for easy viewing"""
        import csv
        
        with open(filepath, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow([
                "Week", "Day", "Platform", "Theme", "Content Type", 
                "Optimal Time", "Status", "Content Preview"
            ])
            
            for week_idx, week in enumerate(calendar.get("weeks", []), 1):
                for post in week.get("posts", []):
                    content_preview = ""
                    if post.get("generated_content"):
                        content = post["generated_content"]
                        if isinstance(content, dict) and "content" in content:
                            content_preview = content["content"][:100] + "..."
                    
                    writer.writerow([
                        week_idx,
                        post["day"],
                        post["platform"],
                        post["theme"],
                        post["content_type"],
                        post["optimal_time"],
                        post["status"],
                        content_preview
                    ])
    
    def get_weekly_summary(self, calendar: Dict[str, Any]) -> Dict[str, Any]:
        """Get summary stats for the calendar"""
        total_posts = 0
        platform_counts = {}
        content_type_counts = {}
        
        for week in calendar.get("weeks", []):
            for post in week.get("posts", []):
                total_posts += 1
                platform_counts[post["platform"]] = platform_counts.get(post["platform"], 0) + 1
                content_type_counts[post["content_type"]] = content_type_counts.get(post["content_type"], 0) + 1
        
        return {
            "total_posts": total_posts,
            "platform_distribution": platform_counts,
            "content_type_distribution": content_type_counts,
            "estimated_generation_time": f"{total_posts * 2} minutes"
        }
