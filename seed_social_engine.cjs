const Database = require('better-sqlite3');
const { join } = require('path');

const db = new Database(join(__dirname, 'crm.db'));

console.log('🌱 Seeding Social Media Engine v2.0 data...\n');

// ── Psychology Profiles ──
const psychologyProfiles = [
  {
    segment: 'Student 18-24 (Bangladesh)',
    pain_points: 'Scams, losing money, visa rejection, being alone in foreign country, study gap insecurity, average academic profile discouragement',
    aspirations: 'Scholarship, free education, monthly stipend, career in China/tech, peer validation',
    fears: 'Fake agencies, visa rejection, wasting parents money, language barrier, cultural shock',
    trusted_sources: 'TikTok influencers, Instagram Reels, peer testimonials, Facebook groups',
    decision_factors: 'Social proof, transparency, ease of process, no payment before visa',
    content_preferences: 'Short-form video, fast-paced, authentic, cost breakdowns, myth-busting',
    peak_hours: '8PM-10PM, 1PM-3PM',
    language_preference: 'bangla',
    voice_tone: 'peer_friend',
    primary_platform: 'tiktok',
    secondary_platform: 'instagram'
  },
  {
    segment: 'Parent 35-55 (Bangladesh)',
    pain_points: 'Wasting money, child safety, fake agencies, visa rejection, uncertainty about ROI',
    aspirations: 'Secure future for child, prestigious university, career stability, good ROI on education investment',
    fears: 'Child safety abroad, fraud, losing investment, child not adapting, fake university degrees',
    trusted_sources: 'Facebook community, word of mouth, office visit, written agreements, government registration',
    decision_factors: 'Trust, references, office presence, payment after visa policy, transparency',
    content_preferences: 'Detailed posts, video testimonials, cost breakdowns, official documentation, trust signals',
    peak_hours: '7PM-9PM, early morning 6AM-8AM',
    language_preference: 'bangla',
    voice_tone: 'expert_consultant',
    primary_platform: 'facebook',
    secondary_platform: 'whatsapp'
  },
  {
    segment: 'Student 17-24 (Gen Z)',
    pain_points: 'Pressure to study abroad, FOMO, lack of guidance, information overload, fake promises',
    aspirations: 'Trending lifestyle, viral content, being part of a community, quick success',
    fears: 'Missing out, making wrong choice, being scammed, not fitting in',
    trusted_sources: 'TikTok creators, Instagram influencers, peer networks, viral content',
    decision_factors: 'Trending topics, peer validation, visual appeal, authentic stories',
    content_preferences: 'TikTok videos, Reels, Stories, fast cuts, text overlays, trending audio',
    peak_hours: '7PM-11PM, 12PM-2PM',
    language_preference: 'bangla',
    voice_tone: 'empathetic_brother',
    primary_platform: 'tiktok',
    secondary_platform: 'instagram'
  }
];

const insertPsych = db.prepare(`INSERT INTO psychology_profiles (segment, pain_points, aspirations, fears, trusted_sources, decision_factors, content_preferences, peak_hours, language_preference, voice_tone, primary_platform, secondary_platform) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
for (const p of psychologyProfiles) {
  insertPsych.run(p.segment, p.pain_points, p.aspirations, p.fears, p.trusted_sources, p.decision_factors, p.content_preferences, p.peak_hours, p.language_preference, p.voice_tone, p.primary_platform, p.secondary_platform);
}
console.log(`✅ Seeded ${psychologyProfiles.length} psychology profiles`);

// ── Research Intelligence ──
const researchIntel = [
  {
    topic: 'MalishaEdu launches new CSCA-free university list campaign',
    category: 'competitor_move',
    urgency: 'critical',
    competitor: 'MalishaEdu',
    source_type: 'competitor_page',
    insight_summary: 'MalishaEdu posted a carousel with 10 CSCA-free universities targeting HSC 2026 graduates. Engagement: 2.3K. Their angle: "No CSCA = No Stress". This directly competes with our core differentiator.',
    recommended_angle: 'Counter with our verified university list + "Payment After Visa" edge. Add real student testimonials.',
    status: 'new'
  },
  {
    topic: 'DreamEdu claims "100% scholarship guarantee" in new ad',
    category: 'competitor_move',
    urgency: 'critical',
    competitor: 'DreamEdu',
    source_type: 'meta_ad_library',
    insight_summary: 'DreamEdu is running Facebook ads with "100% scholarship guaranteed" claim. This is misleading and violates advertising standards. We should NOT copy this approach but can position ourselves as the honest alternative.',
    recommended_angle: '"Honest Scholarship Talk — No Guarantees, Just Real Numbers" campaign. Show our 98% visa track record with transparent cost breakdowns.',
    status: 'new'
  },
  {
    topic: '#CSCScholarship2026 trending +300% on TikTok',
    category: 'viral_signal',
    urgency: 'high',
    competitor: '',
    source_type: 'trend_platform',
    insight_summary: 'TikTok Bangladesh: #CSCScholarship2026 has 45K posts, +300% week-over-week. Students are creating UGC about CSC scholarship application process. High engagement on "how to apply" content.',
    recommended_angle: 'Create educational Reel/TikTok: "CSC Scholarship 2026 — Real Requirements vs Myths". Use our consultant on camera.',
    status: 'new'
  },
  {
    topic: 'CSCA exam mandatory from September 2026 for Bachelor admissions',
    category: 'policy_change',
    urgency: 'high',
    competitor: '',
    source_type: 'gov_notice',
    insight_summary: 'Chinese Ministry of Education confirmed: CSCA (Chinese Standardized College Admission) exam mandatory for all Bachelor-level international students from September 2026 intake. This is a MAJOR policy shift. Our CSCA-free university list becomes even more valuable.',
    recommended_angle: 'Urgent carousel: "CSCA Mandatory from Sep 2026 — But These 15 Universities Still Accept Without It!" Add deadline countdown.',
    status: 'new'
  },
  {
    topic: 'Megamind Plus offers "1.3L BDT for diploma" — aggressive pricing',
    category: 'competitor_move',
    urgency: 'high',
    competitor: 'Megamind Plus',
    source_type: 'competitor_page',
    insight_summary: 'Megamind Plus posted aggressive pricing: 1.3L BDT for diploma, 1.5L for bachelor with stipend. They claim "100% scholarship" and "visa success". Their TikTok has 84K followers and strong engagement.',
    recommended_angle: '"Real Numbers, No Hidden Costs" carousel. Show our transparent fee breakdown including service charge, visa, travel, medical. Contrast with their vague claims.',
    status: 'new'
  },
  {
    topic: 'Bangladesh students increasingly interested in South Korea E-Visa',
    category: 'market_gap',
    urgency: 'normal',
    competitor: '',
    source_type: 'internal',
    insight_summary: 'Internal CRM data shows 23% increase in Korea inquiries in last 30 days. Students rejected from Europe/UK are pivoting to Korea. E-Visa pathway (no IELTS, study gap ok) is the main draw.',
    recommended_angle: 'Korea E-Visa series: "Rejected from Europe? Korea is Your Answer". Target rejected Europe applicants with cost comparison.',
    status: 'new'
  },
  {
    topic: 'European destinations (Hungary, Malta, Croatia) gaining traction',
    category: 'market_gap',
    urgency: 'normal',
    competitor: '',
    source_type: 'internal',
    insight_summary: 'Post-Brexit, Bangladesh students are exploring EU alternatives. Hungary Stipendium, Malta Schengen, Croatia low-cost options trending in search. Our competitors have minimal EU content.',
    recommended_angle: 'EU Destination Spotlight series: Hungary, Malta, Croatia, Cyprus. "Schengen on a Budget" angle. Cost comparison with UK.',
    status: 'new'
  },
  {
    topic: 'Parent anxiety about "Payment After Visa" legitimacy increasing',
    category: 'psych_insight',
    urgency: 'normal',
    competitor: '',
    source_type: 'internal',
    insight_summary: 'Consultation notes show parents asking "Is Payment After Visa real?" and "What if they charge hidden fees later?". Trust gap exists despite our policy being genuine. Need more proof.',
    recommended_angle: 'Trust Tuesday series: Video testimonials from parents who used Payment After Visa. Show written agreement. Walk through the process step-by-step.',
    status: 'new'
  }
];

const insertResearch = db.prepare(`INSERT INTO research_intelligence (topic, category, urgency, competitor, source_type, insight_summary, recommended_angle, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
for (const r of researchIntel) {
  insertResearch.run(r.topic, r.category, r.urgency, r.competitor, r.source_type, r.insight_summary, r.recommended_angle, r.status);
}
console.log(`✅ Seeded ${researchIntel.length} research intelligence findings`);

// ── Viral Topics ──
const viralTopics = [
  {
    topic: 'CSC Scholarship 2026 Application Guide',
    platform: 'tiktok',
    hashtag: '#CSCScholarship2026',
    relevance_score: 95,
    engagement_velocity: 3.2,
    reach_estimate: 45000,
    sentiment: 'positive',
    why_viral: 'Students are creating UGC about CSC application process. High demand for "how-to" content. Educational + aspirational.',
    recommended_hook: 'CSC Scholarship 2026 — আবেদন করতে হলে কী কী লাগে?',
    recommended_cta: 'DM us for free CSC application checklist',
    recommended_pillar: 'scholarship',
    status: 'approved'
  },
  {
    topic: 'Study in China vs Private University in Bangladesh',
    platform: 'facebook',
    hashtag: '#StudyInChina',
    relevance_score: 88,
    engagement_velocity: 2.1,
    reach_estimate: 28000,
    sentiment: 'mixed',
    why_viral: 'Cost comparison posts are highly engaging. Parents debating China vs BD private. Opportunity for transparent cost breakdown.',
    recommended_hook: 'চীনে Bachelor vs প্রাইভেট — আসলে কোনটা ভালো?',
    recommended_cta: 'Book free consultation for cost comparison',
    recommended_pillar: 'cost',
    status: 'approved'
  },
  {
    topic: 'Visa Success Story — From Dhaka to Beijing',
    platform: 'instagram',
    hashtag: '#VisaSuccess',
    relevance_score: 82,
    engagement_velocity: 1.8,
    reach_estimate: 15000,
    sentiment: 'positive',
    why_viral: 'Student journey content performs well on Reels. Visual proof of success. High save rate.',
    recommended_hook: '৬ মাস আগে আমি Dhaka তেই ছিলাম। আজ Beijing!',
    recommended_cta: 'Want the same? Start your journey',
    recommended_pillar: 'success_story',
    status: 'approved'
  },
  {
    topic: 'No IELTS Required for China — MOI Certificate Alternative',
    platform: 'tiktok',
    hashtag: '#NoIELTS',
    relevance_score: 78,
    engagement_velocity: 2.5,
    reach_estimate: 22000,
    sentiment: 'positive',
    why_viral: 'Myth-busting content performs well. Students relieved to know IELTS is not mandatory. High share rate.',
    recommended_hook: 'IELTS ছাড়াই চীনে পড়া যায়! কীভাবে?',
    recommended_cta: 'Get free MOI certificate guide',
    recommended_pillar: 'trust',
    status: 'approved'
  }
];

const insertViral = db.prepare(`INSERT INTO viral_topics (topic, platform, hashtag, relevance_score, engagement_velocity, reach_estimate, sentiment, why_viral, recommended_hook, recommended_cta, recommended_pillar, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
for (const v of viralTopics) {
  insertViral.run(v.topic, v.platform, v.hashtag, v.relevance_score, v.engagement_velocity, v.reach_estimate, v.sentiment, v.why_viral, v.recommended_hook, v.recommended_cta, v.recommended_pillar, v.status);
}
console.log(`✅ Seeded ${viralTopics.length} viral topics`);

// ── Content Hooks ──
const hooks = [
  {
    hook_text: 'CSCA ছাড়াই চীনে Bachelor! 🎓🇨🇳',
    hook_type: 'myth_bust',
    destination: 'China',
    pillar: 'scholarship',
    format: 'Carousel',
    psychology_target: 'csca_anxiety',
    usage_count: 12,
    avg_reach: 5200,
    avg_engagement: 340,
    conversion_rate: 0.08,
    status: 'winner'
  },
  {
    hook_text: 'Study in China WITHOUT CSCA! 🎓🇨🇳',
    hook_type: 'myth_bust',
    destination: 'China',
    pillar: 'scholarship',
    format: 'Carousel',
    psychology_target: 'csca_anxiety',
    usage_count: 8,
    avg_reach: 4100,
    avg_engagement: 280,
    conversion_rate: 0.06,
    status: 'winner'
  },
  {
    hook_text: 'ভিসা রিফিউজড? বছরটা নষ্ট ভাবছেন?',
    hook_type: 'pain_point',
    destination: 'China',
    pillar: 'trust',
    format: 'Reel',
    psychology_target: 'rejection_trauma',
    usage_count: 15,
    avg_reach: 7800,
    avg_engagement: 520,
    conversion_rate: 0.12,
    status: 'winner'
  },
  {
    hook_text: 'চীনে Bachelor — Year 1 টিউশন ০ টাকা।',
    hook_type: 'number',
    destination: 'China',
    pillar: 'cost',
    format: 'Carousel',
    psychology_target: 'cost_anxiety',
    usage_count: 10,
    avg_reach: 6100,
    avg_engagement: 420,
    conversion_rate: 0.09,
    status: 'winner'
  },
  {
    hook_text: '৩০ জুন শেষ — সিট সীমিত।',
    hook_type: 'urgency',
    destination: 'China',
    pillar: 'urgency',
    format: 'Story',
    psychology_target: 'fomo',
    usage_count: 20,
    avg_reach: 4500,
    avg_engagement: 380,
    conversion_rate: 0.15,
    status: 'winner'
  },
  {
    hook_text: '৬ মাস আগে [student] টেনশনে ছিল। আজ admission letter হাতে।',
    hook_type: 'story',
    destination: 'China',
    pillar: 'success_story',
    format: 'Reel',
    psychology_target: 'social_proof',
    usage_count: 6,
    avg_reach: 8900,
    avg_engagement: 650,
    conversion_rate: 0.11,
    status: 'winner'
  },
  {
    hook_text: 'লাখ টাকা গুনছেন প্রাইভেটে? দাঁড়ান।',
    hook_type: 'challenge',
    destination: 'China',
    pillar: 'cost',
    format: 'Carousel',
    psychology_target: 'cost_anxiety',
    usage_count: 9,
    avg_reach: 5400,
    avg_engagement: 310,
    conversion_rate: 0.07,
    status: 'tested'
  },
  {
    hook_text: 'Payment After Visa — শর্ত প্রযোজ্য।',
    hook_type: 'trust',
    destination: 'China',
    pillar: 'trust',
    format: 'Single image',
    psychology_target: 'trust_gap',
    usage_count: 25,
    avg_reach: 12000,
    avg_engagement: 890,
    conversion_rate: 0.14,
    status: 'winner'
  }
];

const insertHook = db.prepare(`INSERT INTO content_hooks (hook_text, hook_type, destination, pillar, format, psychology_target, usage_count, avg_reach, avg_engagement, conversion_rate, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
for (const h of hooks) {
  insertHook.run(h.hook_text, h.hook_type, h.destination, h.pillar, h.format, h.psychology_target, h.usage_count, h.avg_reach, h.avg_engagement, h.conversion_rate, h.status);
}
console.log(`✅ Seeded ${hooks.length} content hooks`);

// ── Creative Guidelines ──
const guidelines = [
  {
    guideline_name: 'Brand Primary Color',
    category: 'color',
    platform: 'all',
    specification: 'Deep Navy #1F4E79 for primary backgrounds and headers.',
    examples: 'Facebook page cover, carousel header, video end card',
    do_s: 'Use consistently across all platforms. Ensure good contrast with white text.',
    dont_s: 'Do not use light/bright blues that look like Facebook default. Do not use gradients on navy.'
  },
  {
    guideline_name: 'China Page Accent Color',
    category: 'color',
    platform: 'facebook',
    specification: 'China Red #C00000 for China-specific posts and CTAs.',
    examples: 'China page posts, CSC-related content, China university spotlights',
    do_s: 'Use for China page only. Red = urgency + China cultural association.',
    dont_s: 'Do not use on BD/mixed page. Do not use for non-China destinations.'
  },
  {
    guideline_name: 'BD Page Accent Color',
    category: 'color',
    platform: 'facebook',
    specification: 'Green #548235 for Bangladesh/mixed destination posts.',
    examples: 'BD page posts, Korea/Europe content, trust/success posts',
    do_s: 'Use for BD page and mixed destinations. Green = growth + trust.',
    dont_s: 'Do not use on China page. Do not use for urgent/deadline content.'
  },
  {
    guideline_name: 'Bangla Font Rendering',
    category: 'typography',
    platform: 'all',
    specification: 'Use Unicode Bangla fonts (Noto Sans Bengali, SolaimanLipi, or similar). Minimum 16px for body text.',
    examples: 'All Bangla posts, carousel slides, video captions',
    do_s: 'Test rendering on mobile before publishing. Ensure characters display correctly.',
    dont_s: 'Do not use broken/jali fonts. Do not use image-based Bangla text (not searchable).'
  },
  {
    guideline_name: 'Reel/TikTok Safe Zones',
    category: 'format_spec',
    platform: 'instagram',
    specification: 'Keep all text within top 70% of frame. Bottom 15% and right side are covered by UI elements.',
    examples: 'Reel captions, TikTok text overlays, story stickers',
    do_s: 'Place hook text in top third. CTA in bottom-left (visible area).',
    dont_s: 'Do not place critical text in bottom 15% or right edge. Do not use small text (<24px).'
  },
  {
    guideline_name: 'Asset Resolution Standards',
    category: 'asset_size',
    platform: 'all',
    specification: 'Square: 1080x1080 | Portrait: 1080x1350 | Reel/TikTok: 1080x1920 | Stories: 1080x1920',
    examples: 'All image/video exports from Canva/Photoshop',
    do_s: 'Export at minimum 1080px wide. Use 300 DPI for print-quality digital.',
    dont_s: 'Do not upload low-res images (<720px). Do not stretch or distort aspect ratios.'
  },
  {
    guideline_name: 'Video Duration by Platform',
    category: 'video_spec',
    platform: 'all',
    specification: 'Facebook: 60-90s max | Instagram Reel: 30-60s | TikTok: 15-60s | Story: 15s per slide',
    examples: 'Testimonial videos, cost breakdowns, myth-busting',
    do_s: 'Hook in first 3 seconds. Add captions for silent viewing. End with CTA + logo.',
    dont_s: 'Do not exceed platform limits. Do not use copyrighted music without license.'
  },
  {
    guideline_name: 'Student Photo Consent',
    category: 'imagery',
    platform: 'all',
    specification: 'All student photos must have signed consent form. Use real faces, never stock photos.',
    examples: 'Visa success photos, testimonial videos, campus b-roll',
    do_s: 'Get written consent before using. Blur faces if consent not obtained. Use authentic moments.',
    dont_s: 'Do not use stock photos as student photos. Do not use photos without consent. Do not Photoshop fake scenarios.'
  }
];

const insertGuideline = db.prepare(`INSERT INTO creative_guidelines (guideline_name, category, platform, specification, examples, do_s, dont_s) VALUES (?, ?, ?, ?, ?, ?, ?)`);
for (const g of guidelines) {
  insertGuideline.run(g.guideline_name, g.category, g.platform, g.specification, g.examples, g.do_s, g.dont_s);
}
console.log(`✅ Seeded ${guidelines.length} creative guidelines`);

// ── Offer Sources ──
const offerSources = [
  {
    name: 'CSC Official Website',
    url: 'https://www.csc.edu.cn',
    source_type: 'government',
    description: 'Chinese Government Scholarship official portal. Check for policy updates and application windows.',
    drive_folder_url: '',
    is_active: 1
  },
  {
    name: 'MOE China Notices',
    url: 'http://www.moe.gov.cn',
    source_type: 'government',
    description: 'Ministry of Education China — official policy changes, CSCA requirements, admission rules.',
    drive_folder_url: '',
    is_active: 1
  },
  {
    name: 'EduExpress Drive — Brochures',
    url: 'https://drive.google.com/drive/folders/19m0Tb3DgTjNDFLoqSCy_KoSWwZ5dOX_F',
    source_type: 'drive',
    description: 'Internal brochure and notice storage. Upload new university brochures, scholarship notices here.',
    drive_folder_url: 'https://drive.google.com/drive/folders/19m0Tb3DgTjNDFLoqSCy_KoSWwZ5dOX_F',
    is_active: 1
  },
  {
    name: 'EduExpress Drive — Notices',
    url: 'https://drive.google.com/drive/folders/1uHMzRdvNjbXPVUgQxtCyoFEkkjuXPAYF',
    source_type: 'drive',
    description: 'Admission notices, deadline reminders, policy change documents from partners.',
    drive_folder_url: 'https://drive.google.com/drive/folders/1uHMzRdvNjbXPVUgQxtCyoFEkkjuXPAYF',
    is_active: 1
  }
];

const insertSource = db.prepare(`INSERT INTO offer_sources (name, url, source_type, description, drive_folder_url, is_active) VALUES (?, ?, ?, ?, ?, ?)`);
for (const s of offerSources) {
  insertSource.run(s.name, s.url, s.source_type, s.description, s.drive_folder_url, s.is_active);
}
console.log(`✅ Seeded ${offerSources.length} offer sources`);

console.log('\n🎉 Seeding complete! All Social Media Engine v2.0 tables populated.');
console.log('Run: node seed_social_engine.mjs');
