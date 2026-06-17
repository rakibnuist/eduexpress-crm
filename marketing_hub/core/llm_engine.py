"""
OpenCode Go LLM API Connector
Handles all LLM interactions for content generation
"""
import json
import requests
import time
from typing import Optional, Dict, Any, List
from config import OPENCODE_CONFIG, RESEARCH_CONTEXT

class OpenCodeClient:
    """Client for OpenCode Go LLM API (GLM-5.1)"""
    
    def __init__(self):
        self.api_key = OPENCODE_CONFIG["key"]
        self.model = OPENCODE_CONFIG["model"]
        self.base_url = OPENCODE_CONFIG["base_url"]
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        self.system_context = self._build_system_context()
    
    def _build_system_context(self) -> str:
        """Build the system prompt with all research context"""
        return f"""You are a Social Media Engineer for EduExpress International, an education consultancy in Bangladesh. 

Your job is to create high-converting, viral content for Bangladeshi students and parents interested in studying abroad (primarily China, South Korea, Malaysia, Europe).

RESEARCH CONTEXT:
{RESEARCH_CONTEXT}

CONTENT RULES:
1. Write primarily in Bangla (Bengali) with English terms where natural
2. Use emotional hooks, not just facts
3. Address student fears directly (scams, visa rejection, money loss)
4. Use strong CTAs (WhatsApp, Call, Apply Now, Book Appointment)
5. Include specific numbers (fees, stipend amounts, university counts)
6. Create urgency with deadlines
7. Always mention "Payment After Visa" as the trust anchor
8. Use power words: ফ্রি, ১০০%, স্কলারশিপ, গ্যারান্টি, নিশ্চয়তা, স্বপ্ন
9. Keep it authentic - no false claims
10. Format for easy reading on mobile screens

OUTPUT FORMAT:
Always return structured JSON with: content, hashtags, cta, target_audience, platform, estimated_engagement
"""
    
    def generate(self, prompt: str, temperature: float = 0.8, max_tokens: int = 2000) -> Dict[str, Any]:
        """Generate content using OpenCode Go API"""
        try:
            payload = {
                "model": self.model,
                "messages": [
                    {"role": "system", "content": self.system_context},
                    {"role": "user", "content": prompt}
                ],
                "temperature": temperature,
                "max_tokens": max_tokens
            }
            
            response = requests.post(
                f"{self.base_url}/chat/completions",
                headers=self.headers,
                json=payload,
                timeout=60
            )
            
            if response.status_code == 200:
                data = response.json()
                content = data["choices"][0]["message"]["content"]
                
                # Try to parse as JSON, fallback to text
                try:
                    return json.loads(content)
                except json.JSONDecodeError:
                    return {"content": content, "raw": True}
                    
            else:
                return {
                    "error": True,
                    "status_code": response.status_code,
                    "message": response.text
                }
                
        except requests.exceptions.RequestException as e:
            return {"error": True, "message": str(e)}
        except Exception as e:
            return {"error": True, "message": str(e)}
    
    def generate_batch(self, prompts: List[str], temperature: float = 0.8) -> List[Dict[str, Any]]:
        """Generate multiple content pieces in batch"""
        results = []
        for prompt in prompts:
            result = self.generate(prompt, temperature)
            results.append(result)
            time.sleep(0.5)  # Rate limiting
        return results


class ContentEngine:
    """Main content generation engine using LLM"""
    
    def __init__(self):
        self.llm = OpenCodeClient()
    
    def generate_tiktok_script(self, topic: str, hook_type: str, duration: int = 30) -> Dict[str, Any]:
        """Generate a TikTok/Reels script"""
        prompt = f"""Generate a {duration}-second TikTok/Reels script for EduExpress about: {topic}
        
Hook Type: {hook_type}
Structure:
- 0-3s: Attention-grabbing hook (text overlay + visual direction)
- 3-10s: Problem identification (relatable pain point)
- 10-20s: Solution presentation (EduExpress value)
- 20-25s: Proof/social proof (numbers, testimonials)
- 25-30s: CTA (WhatsApp, call, apply)

Include:
- Exact Bangla dialogue for voiceover
- Text overlay suggestions
- Visual direction notes
- Background music/mood suggestion
- Hashtags (5 tags)
- Caption text

Return as JSON: {{
    "title": "...",
    "hook_text": "...",
    "script_segments": [{{"time": "0-3s", "voiceover": "...", "text_overlay": "...", "visual": "..."}}],
    "hashtags": ["..."],
    "caption": "...",
    "cta": "...",
    "music_suggestion": "..."
}}"""
        return self.llm.generate(prompt, temperature=0.9)
    
    def generate_facebook_post(self, theme: str, post_type: str = "carousel", target: str = "students") -> Dict[str, Any]:
        """Generate a Facebook post"""
        prompt = f"""Generate a Facebook {post_type} post for EduExpress.
        
Theme: {theme}
Target Audience: {target}

Include:
1. Primary text (Bangla, 200-300 words, emotional but factual)
2. Headline (if applicable)
3. 3-5 slide descriptions (for carousel)
4. Image description for each slide
5. CTA button text
6. Comments reply strategy (3 common questions + answers)
7. Hashtags (3 tags)

Return as JSON: {{
    "primary_text": "...",
    "headline": "...",
    "slides": [{{"slide_number": 1, "text": "...", "image_desc": "..."}}],
    "cta_button": "...",
    "reply_strategy": [{{"question": "...", "answer": "..."}}],
    "hashtags": ["..."]
}}"""
        return self.llm.generate(prompt, temperature=0.8)
    
    def generate_ad_copy(self, campaign_name: str, platform: str = "facebook") -> Dict[str, Any]:
        """Generate ad copy for paid campaigns"""
        prompt = f"""Generate complete ad copy for EduExpress campaign: {campaign_name}
        
Platform: {platform}

Create:
1. 3 headline variations (max 40 chars each, Bangla)
2. 3 primary text variations (max 125 chars each, Bangla)
3. 2 description variations (max 30 chars each)
4. CTA options (Book Now, WhatsApp, Apply Now, Learn More)
5. Target audience definition (age, location, interests, behaviors)
6. Budget recommendation (daily)
7. Expected CPL (Cost Per Lead) estimate
8. A/B testing strategy (what to test first)

Return as JSON: {{
    "headlines": ["...", "...", "..."],
    "primary_texts": ["...", "...", "..."],
    "descriptions": ["...", "..."],
    "ctas": ["..."],
    "target_audience": {{"age": "...", "location": "...", "interests": ["..."]}},
    "budget_bdt": "...",
    "expected_cpl_bdt": "...",
    "ab_test_strategy": "..."
}}"""
        return self.llm.generate(prompt, temperature=0.7)
    
    def generate_whatsapp_broadcast(self, message_type: str = "scholarship_alert") -> Dict[str, Any]:
        """Generate WhatsApp broadcast message"""
        prompt = f"""Generate a WhatsApp broadcast message for EduExpress.
        
Type: {message_type}

Requirements:
- Max 100 words
- Bangla with English terms
- Urgent but not spammy
- Personal tone ("আপনি" not generic)
- Include WhatsApp number: +8801983333566
- One clear CTA
- Emoji usage (3-5 max)

Return as JSON: {{
    "message": "...",
    "cta": "...",
    "follow_up": "..."
}}"""
        return self.llm.generate(prompt, temperature=0.8)
    
    def generate_email_sequence(self, sequence_name: str, emails_count: int = 3) -> Dict[str, Any]:
        """Generate email sequence for lead nurturing"""
        prompt = f"""Generate a {emails_count}-email nurture sequence for EduExpress.
        
Sequence: {sequence_name}

For each email:
1. Subject line (2 variations for A/B test)
2. Preview text
3. Body (150-200 words, Bangla)
4. CTA
5. Send timing (Day X, Time)
6. Personalization tokens

Return as JSON: {{
    "emails": [
        {{
            "day": 1,
            "subject_lines": ["...", "..."],
            "preview": "...",
            "body": "...",
            "cta": "...",
            "send_time": "..."
        }}
    ]
}}"""
        return self.llm.generate(prompt, temperature=0.7)
    
    def generate_blog_article(self, topic: str, word_count: int = 800) -> Dict[str, Any]:
        """Generate SEO blog article"""
        prompt = f"""Generate a {word_count}-word SEO blog article for EduExpress.
        
Topic: {topic}

Structure:
1. Title (SEO optimized, includes primary keyword)
2. Meta description (160 chars)
3. Introduction (hook + problem + promise)
4. 3-5 main sections with H2 headings
5. Conclusion with CTA
6. Internal link suggestions (2-3)
7. Primary keyword + 3 secondary keywords
8. FAQ section (3 questions)

Tone: Professional but warm, Bangla mixed with English terms
Target: Parents and students researching study abroad options

Return as JSON: {{
    "title": "...",
    "meta_description": "...",
    "content": "...",
    "keywords": ["..."],
    "faq": [{{"question": "...", "answer": "..."}}]
}}"""
        return self.llm.generate(prompt, temperature=0.7)
    
    def generate_creative_brief(self, campaign_name: str) -> Dict[str, Any]:
        """Generate comprehensive creative brief for design team"""
        prompt = f"""Generate a creative brief for EduExpress campaign: {campaign_name}
        
Include:
1. Campaign objective (1 sentence)
2. Target audience profile (demographics, psychographics, pain points)
3. Key message (1 sentence)
4. Visual direction (colors, imagery, style, mood)
5. Design assets needed (list with specs)
6. Copy requirements (headlines, body, CTA)
7. Brand guidelines (colors, fonts, logo placement)
8. Platform specs (Facebook, Instagram, TikTok dimensions)
9. Timeline
10. Success metrics

Return as JSON: {{
    "objective": "...",
    "target_audience": {{"demographics": "...", "psychographics": "..."}},
    "key_message": "...",
    "visual_direction": "...",
    "assets": [{{"name": "...", "specs": "..."}}],
    "copy": {{"headlines": ["..."], "body": "...", "cta": "..."}},
    "brand_guidelines": "...",
    "platform_specs": "...",
    "timeline": "...",
    "success_metrics": ["..."]
}}"""
        return self.llm.generate(prompt, temperature=0.7)
