
  CREATE TABLE IF NOT EXISTS leads (
    lead_market TEXT DEFAULT 'Bangladesh',
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id TEXT UNIQUE,
    date_added TEXT,
    client_name TEXT,
    phone TEXT,
    email TEXT,
    destination TEXT,
    last_education TEXT,
    gpa REAL,
    english_score TEXT,
    program TEXT,
    lead_source TEXT,
    lead_status TEXT DEFAULT 'New Lead',
    assigned_consultant TEXT,
    assigned_employee_id INTEGER,
    service_fee REAL DEFAULT 0,
    paid REAL DEFAULT 0,
    balance REAL DEFAULT 0,
    payment_status TEXT,
    next_followup TEXT,
    notes TEXT,
    meta_lead_id TEXT,
    meta_form_id TEXT,
    meta_ad_id TEXT,
    meta_campaign TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS partner_agencies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agency_name TEXT NOT NULL,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    commission_rate REAL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS income (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT, month TEXT, category TEXT, lead_id TEXT,
    client_name TEXT, reference TEXT, amount REAL DEFAULT 0, notes TEXT,
    employee_id INTEGER,
    exclude_from_cash INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT, month TEXT, category TEXT, paid_to TEXT,
    reference TEXT, amount REAL DEFAULT 0, notes TEXT,
    employee_id INTEGER
  );

  CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    emp_id TEXT, name TEXT, role TEXT, email TEXT, phone TEXT,
    device_id TEXT, salary REAL DEFAULT 0, active TEXT DEFAULT 'Yes',
    join_date TEXT
  );

  CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    emp_id TEXT, name TEXT, date TEXT,
    check_in TEXT, check_out TEXT, hours_worked REAL,
    status TEXT DEFAULT 'Present', device_id TEXT, ssid TEXT,
    source TEXT DEFAULT 'manual', notes TEXT
  );

  CREATE TABLE IF NOT EXISTS kpi_targets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    consultant TEXT NOT NULL, month TEXT NOT NULL,
    target_leads INTEGER DEFAULT 0,
    target_enrolled INTEGER DEFAULT 0,
    target_revenue REAL DEFAULT 0,
    UNIQUE(consultant, month)
  );

  CREATE TABLE IF NOT EXISTS destinations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE,
    name TEXT UNIQUE,
    requirements TEXT,
    programs TEXT,
    fees TEXT,
    embassy_documents TEXT,
    application_processing TEXT,
    other_details TEXT,
    is_public INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS meta_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE, value TEXT
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'consultant',
    consultant_name TEXT,
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    last_login TEXT
  );

  -- RBAC: Multi-role support (one employee can have 2-3 roles)
  CREATE TABLE IF NOT EXISTS user_roles (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    PRIMARY KEY (user_id, role)
  );
  CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);

  -- RBAC: Channel access per user (many-to-many, for consultants)
  CREATE TABLE IF NOT EXISTS channel_access (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    access_type TEXT DEFAULT 'reply', -- reply | view_only | admin
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(channel_id, user_id)
  );
  CREATE INDEX IF NOT EXISTS idx_channel_access_user ON channel_access(user_id);
  CREATE INDEX IF NOT EXISTS idx_channel_access_channel ON channel_access(channel_id);

  CREATE TABLE IF NOT EXISTS daily_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    emp_id TEXT NOT NULL,
    user_id INTEGER,
    date TEXT NOT NULL,
    accomplishments TEXT,
    challenges TEXT,
    tomorrow_plan TEXT,
    metrics_json TEXT,
    submitted_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(emp_id, date)
  );
  CREATE INDEX IF NOT EXISTS idx_daily_logs_emp_date ON daily_logs(emp_id, date);

  CREATE TABLE IF NOT EXISTS broadcasts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message TEXT NOT NULL,
    author_id INTEGER,
    author_name TEXT,
    color TEXT DEFAULT 'amber',
    pinned INTEGER DEFAULT 1,
    expires_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS broadcast_dismissals (
    broadcast_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    dismissed_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (broadcast_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS lead_university_applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    university TEXT NOT NULL,
    program TEXT,
    status TEXT NOT NULL DEFAULT 'documents', -- documents | ready | submitted | admitted | returned | rejected
    application_id TEXT,         -- university's reference / file number
    submitted_on TEXT,
    decision_on TEXT,
    notes TEXT,
    updated_by TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_uniapp_lead ON lead_university_applications(lead_id);

  CREATE TABLE IF NOT EXISTS lead_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    doc_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',  -- pending | received | verified | rejected | not_required
    notes TEXT,
    file_url TEXT,
    received_on TEXT,
    updated_by TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_docs_lead ON lead_documents(lead_id);

  CREATE TABLE IF NOT EXISTS activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    actor_user_id INTEGER,
    actor_name TEXT,
    lead_id INTEGER,
    lead_name TEXT,
    amount REAL,
    from_value TEXT,
    to_value TEXT,
    details TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_log(created_at);
  CREATE INDEX IF NOT EXISTS idx_activity_lead    ON activity_log(lead_id);
  CREATE INDEX IF NOT EXISTS idx_activity_actor   ON activity_log(actor_user_id);

  CREATE TABLE IF NOT EXISTS payroll (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    month TEXT NOT NULL,                  -- YYYY-MM
    emp_id TEXT NOT NULL,
    name TEXT,
    base_salary REAL DEFAULT 0,
    days_worked INTEGER DEFAULT 0,
    working_days INTEGER DEFAULT 0,
    bonus REAL DEFAULT 0,
    deductions REAL DEFAULT 0,
    net_pay REAL DEFAULT 0,
    paid_on TEXT,
    status TEXT DEFAULT 'pending',
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(month, emp_id, name)
  );

  -- ── MESSAGING ──────────────────────────────────────────

  CREATE TABLE IF NOT EXISTS channels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    phone_number_id TEXT,
    waba_id TEXT,
    page_id TEXT,
    ig_account_id TEXT,
    access_token TEXT,
    webhook_verify_token TEXT DEFAULT 'eduexpress_verify_2024',
    status TEXT DEFAULT 'active',
    color TEXT DEFAULT '#3b82f6',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    phone TEXT,
    email TEXT,
    wa_id TEXT UNIQUE,
    messenger_id TEXT,
    instagram_id TEXT,
    tiktok_id TEXT,
    lead_id INTEGER REFERENCES leads(id) ON DELETE SET NULL,
    avatar_url TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contact_id INTEGER REFERENCES contacts(id),
    channel_id INTEGER REFERENCES channels(id),
    channel_type TEXT,
    status TEXT DEFAULT 'open',
    assigned_to TEXT,
    unread_count INTEGER DEFAULT 0,
    last_message TEXT,
    last_message_at TEXT,
    lead_id INTEGER REFERENCES leads(id) ON DELETE SET NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
    direction TEXT NOT NULL,
    type TEXT DEFAULT 'text',
    content TEXT,
    media_url TEXT,
    media_mime TEXT,
    caption TEXT,
    wa_message_id TEXT UNIQUE,
    status TEXT DEFAULT 'sent',
    sent_by TEXT,
    error_msg TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS quick_replies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_leads_status       ON leads(lead_status);
  CREATE INDEX IF NOT EXISTS idx_leads_consultant   ON leads(assigned_consultant);
  CREATE INDEX IF NOT EXISTS idx_attendance_emp     ON attendance(emp_id, date);
  CREATE INDEX IF NOT EXISTS idx_messages_conv      ON messages(conversation_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_conv_contact       ON conversations(contact_id);
  CREATE INDEX IF NOT EXISTS idx_conv_status        ON conversations(status, last_message_at);

  -- ── MARKETING / SOCIAL AUTOMATION ──────────────────────
  CREATE TABLE IF NOT EXISTS content_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    week TEXT,
    post_date TEXT,
    slot_time TEXT,
    page TEXT,                              -- china | bd | instagram | tiktok
    pillar TEXT,
    format TEXT,
    hook TEXT,
    body TEXT,
    hashtags TEXT,
    brief TEXT,
    asset_url TEXT,
    status TEXT DEFAULT 'drafted',          -- drafted|approved|edit|rejected|asset_ready|scheduled|published
    rejection_reason TEXT,
    published_url TEXT,
    reach INTEGER,
    engagement INTEGER,
    source TEXT DEFAULT 'n8n',              -- n8n | manual | evergreen
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_content_week ON content_posts(week, page);
  CREATE INDEX IF NOT EXISTS idx_content_status ON content_posts(status);

  CREATE TABLE IF NOT EXISTS evergreen_bank (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    page_pool TEXT, pillar TEXT, body TEXT, hashtags TEXT, asset_url TEXT,
    status TEXT DEFAULT 'approved',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS competitor_intel (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    log_date TEXT, competitor TEXT, channel TEXT, observation TEXT,
    link TEXT, our_angle TEXT, added_by TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS kb_universities (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, country TEXT, city TEXT,
    programs TEXT, intakes TEXT, tuition TEXT, lang_req TEXT,
    admission_url TEXT, brochure_url TEXT, partner INTEGER DEFAULT 0,
    notes TEXT, last_verified TEXT
  );

  CREATE TABLE IF NOT EXISTS kb_scholarships (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, country TEXT, type TEXT,
    coverage TEXT, eligibility TEXT, deadline TEXT, source_url TEXT,
    status TEXT DEFAULT 'Open', last_verified TEXT, notes TEXT
  );

  CREATE TABLE IF NOT EXISTS kb_sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT, topic TEXT, url TEXT, source_type TEXT,
    use_for TEXT, date_added TEXT, notes TEXT
  );

  CREATE TABLE IF NOT EXISTS kb_docs (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, type TEXT, destination TEXT,
    drive_url TEXT, version TEXT, owner TEXT, updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS brain_api_pool (
    id INTEGER PRIMARY KEY AUTOINCREMENT, priority INTEGER, provider TEXT, model TEXT,
    cred_label TEXT, req_min INTEGER, req_day INTEGER,
    used_today INTEGER DEFAULT 0, status TEXT DEFAULT 'active',
    cooldown_until TEXT, notes TEXT
  );

  -- ── SOCIAL MEDIA ENGINE v2.0 ────────────────────────────
  CREATE TABLE IF NOT EXISTS research_intelligence (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    topic TEXT NOT NULL,
    category TEXT CHECK(category IN ('competitor_move','market_gap','viral_signal','policy_change','psych_insight','offer_alert','trending_topic')),
    urgency TEXT CHECK(urgency IN ('critical','high','normal','low')),
    competitor TEXT,
    source_url TEXT,
    source_type TEXT CHECK(source_type IN ('meta_ad_library','fb_scrape','competitor_page','news','gov_notice','trend_platform','internal')),
    insight_summary TEXT,
    recommended_angle TEXT,
    evidence TEXT,
    status TEXT CHECK(status IN ('new','reviewed','used','archived')) DEFAULT 'new',
    used_in_post_id INTEGER,
    research_date TEXT DEFAULT (datetime('now')),
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_research_urgency ON research_intelligence(urgency, status);
  CREATE INDEX IF NOT EXISTS idx_research_competitor ON research_intelligence(competitor, research_date);

  CREATE TABLE IF NOT EXISTS viral_topics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    topic TEXT NOT NULL,
    platform TEXT CHECK(platform IN ('facebook','instagram','tiktok','youtube','twitter')),
    hashtag TEXT,
    relevance_score INTEGER CHECK(relevance_score BETWEEN 0 AND 100),
    engagement_velocity REAL,
    reach_estimate INTEGER,
    sentiment TEXT CHECK(sentiment IN ('positive','neutral','negative','mixed')),
    why_viral TEXT,
    recommended_hook TEXT,
    recommended_cta TEXT,
    recommended_pillar TEXT,
    status TEXT CHECK(status IN ('new','approved','used','declined')) DEFAULT 'new',
    used_in_post_id INTEGER,
    discovered_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_viral_relevance ON viral_topics(relevance_score, status);

  CREATE TABLE IF NOT EXISTS psychology_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    segment TEXT NOT NULL,
    pain_points TEXT,
    aspirations TEXT,
    fears TEXT,
    trusted_sources TEXT,
    decision_factors TEXT,
    content_preferences TEXT,
    peak_hours TEXT,
    language_preference TEXT CHECK(language_preference IN ('bangla','english','banglish')),
    voice_tone TEXT CHECK(voice_tone IN ('empathetic_brother','expert_consultant','success_story','peer_friend')),
    primary_platform TEXT,
    secondary_platform TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS content_scripts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    script_name TEXT NOT NULL,
    category TEXT CHECK(category IN ('hook','video_script','carousel_copy','story','ad_copy','dm_script','reel_script','tiktok_script')),
    destination TEXT,
    pillar TEXT,
    format TEXT CHECK(format IN ('Reel','Carousel','Single image','Story','TikTok','Live')),
    hook TEXT,
    body TEXT,
    cta TEXT,
    duration_seconds INTEGER,
    shot_list TEXT,
    on_screen_text TEXT,
    psychology_target TEXT,
    avg_score REAL,
    usage_count INTEGER DEFAULT 0,
    status TEXT CHECK(status IN ('draft','approved','archived','winner')) DEFAULT 'draft',
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_scripts_status ON content_scripts(status, category);

  CREATE TABLE IF NOT EXISTS content_hooks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hook_text TEXT NOT NULL,
    hook_type TEXT CHECK(hook_type IN ('pain_point','curiosity','number','myth_bust','urgency','story','challenge','social_proof','fomo','trust')),
    destination TEXT,
    pillar TEXT,
    format TEXT,
    psychology_target TEXT,
    usage_count INTEGER DEFAULT 0,
    avg_reach INTEGER,
    avg_engagement INTEGER,
    conversion_rate REAL,
    status TEXT CHECK(status IN ('new','winner','tested','declined')) DEFAULT 'new',
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_hooks_status ON content_hooks(status, hook_type);

  CREATE TABLE IF NOT EXISTS ab_tests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    test_name TEXT NOT NULL,
    variable TEXT CHECK(variable IN ('hook','body','cta','image','time_slot','hashtag_set','platform')),
    variant_a TEXT,
    variant_b TEXT,
    variant_c TEXT,
    page TEXT CHECK(page IN ('china','bd','instagram','tiktok')),
    start_date TEXT,
    end_date TEXT,
    status TEXT CHECK(status IN ('planned','running','completed','cancelled')) DEFAULT 'planned',
    a_reach INTEGER, a_engagement INTEGER, a_leads INTEGER,
    b_reach INTEGER, b_engagement INTEGER, b_leads INTEGER,
    c_reach INTEGER, c_engagement INTEGER, c_leads INTEGER,
    winner TEXT CHECK(winner IN ('a','b','c','inconclusive')),
    winner_confidence INTEGER,
    insights TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS scale_up_recommendations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recommendation_type TEXT CHECK(recommendation_type IN ('content_pillar','platform','hook_style','time_slot','campaign','budget','destination','format','audience_segment')),
    title TEXT NOT NULL,
    description TEXT,
    expected_impact TEXT CHECK(expected_impact IN ('high','medium','low')),
    expected_lead_lift REAL,
    confidence_score INTEGER,
    based_on_data TEXT,
    action_items TEXT,
    status TEXT CHECK(status IN ('pending','approved','implemented','rejected','testing')) DEFAULT 'pending',
    approved_by TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS publishing_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER,
    page TEXT,
    platform TEXT,
    scheduled_at TEXT,
    published_at TEXT,
    status TEXT CHECK(status IN ('queued','published','failed','retry')) DEFAULT 'queued',
    error_message TEXT,
    platform_post_id TEXT,
    platform_post_url TEXT,
    reach INTEGER,
    engagement INTEGER,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_publishing_status ON publishing_queue(status, scheduled_at);

  CREATE TABLE IF NOT EXISTS creative_guidelines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guideline_name TEXT NOT NULL,
    category TEXT CHECK(category IN ('color','typography','imagery','tone','format_spec','brand_voice','asset_size','video_spec')),
    platform TEXT CHECK(platform IN ('facebook','instagram','tiktok','all')),
    specification TEXT,
    examples TEXT,
    do_s TEXT,
    dont_s TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- ═══════════════════════════════════════════════════════════
  --  PROFESSIONAL SMM PIPELINE v3.0 — Campaigns, Assets, Comments, Performance
  -- ═══════════════════════════════════════════════════════════
  CREATE TABLE IF NOT EXISTS campaigns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT CHECK(status IN ('draft','active','paused','completed','archived')) DEFAULT 'draft',
    page TEXT CHECK(page IN ('china','bd','instagram','tiktok','all')) DEFAULT 'china',
    pillar TEXT CHECK(pillar IN ('scholarship','trust','career','urgency','university','cost','success_story','trending','brand','festival')),
    start_date TEXT,
    end_date TEXT,
    budget TEXT,
    target_audience TEXT,
    goals TEXT,
    color TEXT DEFAULT '#3B82F6',
    created_by TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status, start_date);

  CREATE TABLE IF NOT EXISTS content_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    pillar TEXT CHECK(pillar IN ('scholarship','trust','career','urgency','university','cost','success_story','trending','brand','festival')),
    page TEXT CHECK(page IN ('china','bd','instagram','tiktok','all')) DEFAULT 'china',
    format TEXT CHECK(format IN ('Carousel','Reel','Single image','Story','Video','Live','Text')) DEFAULT 'Carousel',
    language TEXT CHECK(language IN ('bangla','english','mixed')) DEFAULT 'bangla',
    platform TEXT CHECK(platform IN ('facebook','instagram','tiktok')) DEFAULT 'facebook',
    tone TEXT CHECK(tone IN ('expert_consultant','empathetic_brother','success_story','peer_friend')) DEFAULT 'expert_consultant',
    hook_template TEXT,
    body_template TEXT,
    hashtags_template TEXT,
    cta_template TEXT,
    brief_template TEXT,
    variables TEXT, -- JSON: { "university_name": "string", "stipend_range": "string" }
    is_active INTEGER DEFAULT 1,
    usage_count INTEGER DEFAULT 0,
    created_by TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS content_calendar_slots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slot_date TEXT NOT NULL, -- YYYY-MM-DD
    slot_time TEXT, -- HH:MM
    page TEXT,
    pillar TEXT,
    post_id INTEGER,
    status TEXT CHECK(status IN ('empty','planned','writing','review','approved','scheduled','published','skipped')) DEFAULT 'empty',
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_calendar_slots_date ON content_calendar_slots(slot_date, page, status);
  CREATE INDEX IF NOT EXISTS idx_calendar_slots_post ON content_calendar_slots(post_id);

  CREATE TABLE IF NOT EXISTS publishing_schedule (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    page TEXT,
    platform TEXT,
    scheduled_date TEXT,
    scheduled_time TEXT,
    timezone TEXT DEFAULT 'Asia/Dhaka',
    status TEXT CHECK(status IN ('pending','queued','published','failed','cancelled')) DEFAULT 'pending',
    published_at TEXT,
    platform_post_id TEXT,
    platform_post_url TEXT,
    error_message TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_publish_schedule ON publishing_schedule(status, scheduled_date, scheduled_time);

  CREATE TABLE IF NOT EXISTS best_time_slots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    page TEXT,
    platform TEXT,
    day_of_week INTEGER, -- 0=Sunday, 6=Saturday
    time_slot TEXT, -- HH:MM
    engagement_score REAL DEFAULT 0,
    based_on_posts INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(page, platform, day_of_week, time_slot)
  );

  CREATE TABLE IF NOT EXISTS post_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    user_name TEXT,
    user_role TEXT,
    comment TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_post_comments_post ON post_comments(post_id);

  CREATE TABLE IF NOT EXISTS post_performance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    platform TEXT,
    impressions INTEGER DEFAULT 0,
    reach INTEGER DEFAULT 0,
    engagement INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    shares INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    cta_clicks INTEGER DEFAULT 0,
    video_views INTEGER DEFAULT 0,
    saves INTEGER DEFAULT 0,
    cost_per_result TEXT,
    recorded_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_post_perf_post ON post_performance(post_id);

  CREATE TABLE IF NOT EXISTS content_assets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER,
    campaign_id INTEGER,
    asset_type TEXT CHECK(asset_type IN ('image','video','carousel','reel','story','thumbnail','raw')),
    asset_url TEXT,
    thumbnail_url TEXT,
    file_name TEXT,
    file_size TEXT,
    status TEXT CHECK(status IN ('pending','in_progress','review','approved','rejected','archived')) DEFAULT 'pending',
    uploaded_by TEXT,
    feedback TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_assets_post ON content_assets(post_id);

  CREATE TABLE IF NOT EXISTS content_briefs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER,
    title TEXT NOT NULL,
    description TEXT,
    target_platforms TEXT,
    target_audience TEXT,
    key_messages TEXT,
    tone TEXT,
    reference_links TEXT,
    due_date TEXT,
    status TEXT CHECK(status IN ('pending','approved','in_progress','completed','cancelled')) DEFAULT 'pending',
    assigned_to TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS pipeline_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER,
    from_status TEXT,
    to_status TEXT,
    actor TEXT,
    note TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_pipeline_logs_post ON pipeline_logs(post_id);

  CREATE TABLE IF NOT EXISTS lead_attribution (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id INTEGER,
    first_touch_at TEXT DEFAULT (datetime('now')),
    first_touch_source TEXT,
    first_touch_campaign TEXT,
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    utm_content TEXT,
    utm_term TEXT,
    meta_campaign_id TEXT,
    meta_adset_id TEXT,
    meta_ad_id TEXT,
    meta_form_id TEXT,
    meta_is_organic INTEGER DEFAULT 0,
    content_post_id INTEGER,
    enrollment_value REAL,
    enrolled_at TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_attr_lead ON lead_attribution(lead_id);
  CREATE INDEX IF NOT EXISTS idx_attr_post ON lead_attribution(content_post_id);

  CREATE TABLE IF NOT EXISTS campaign_spend (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id TEXT,
    campaign_name TEXT,
    date TEXT,
    spend REAL,
    channel TEXT,
    platform TEXT,
    destination TEXT,
    impressions INTEGER,
    clicks INTEGER,
    leads INTEGER,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_campaign_spend_date ON campaign_spend(date, campaign_id);

  CREATE TABLE IF NOT EXISTS designer_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER,
    designer_id TEXT,
    brief TEXT,
    priority TEXT CHECK(priority IN ('urgent','normal','low')) DEFAULT 'normal',
    deadline TEXT,
    status TEXT CHECK(status IN ('assigned','in_progress','review','completed','rejected')) DEFAULT 'assigned',
    draft_asset_url TEXT,
    final_asset_url TEXT,
    feedback TEXT,
    assigned_at TEXT DEFAULT (datetime('now')),
    completed_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_designer_status ON designer_queue(status, designer_id);

  CREATE TABLE IF NOT EXISTS offer_sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    url TEXT,
    source_type TEXT CHECK(source_type IN ('government','university','competitor','internal','news','drive')),
    description TEXT,
    drive_folder_url TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );


  -- ── AUTOMATION HUB ──────────────────────────────────────
  CREATE TABLE IF NOT EXISTS automation_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    trigger_type TEXT NOT NULL,
    trigger_config TEXT,
    action_type TEXT NOT NULL,
    action_config TEXT,
    priority INTEGER DEFAULT 0,
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS message_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT DEFAULT 'general',
    language TEXT DEFAULT 'en',
    content TEXT NOT NULL,
    variables TEXT,
    approved INTEGER DEFAULT 0,
    usage_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS contact_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    color TEXT DEFAULT '#3b82f6',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS contact_tag_assignments (
    contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES contact_tags(id) ON DELETE CASCADE,
    assigned_by TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (contact_id, tag_id)
  );

  CREATE TABLE IF NOT EXISTS conversation_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    note TEXT NOT NULL,
    author_id INTEGER,
    author_name TEXT,
    is_internal INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS conversation_tags (
    conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES contact_tags(id) ON DELETE CASCADE,
    PRIMARY KEY (conversation_id, tag_id)
  );

  CREATE TABLE IF NOT EXISTS broadcast_campaigns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    segment_type TEXT,
    segment_config TEXT,
    template_id INTEGER REFERENCES message_templates(id),
    content TEXT,
    status TEXT DEFAULT 'draft',
    scheduled_at TEXT,
    sent_count INTEGER DEFAULT 0,
    delivered_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    created_by TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS broadcast_recipients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER NOT NULL REFERENCES broadcast_campaigns(id) ON DELETE CASCADE,
    contact_id INTEGER NOT NULL REFERENCES contacts(id),
    status TEXT DEFAULT 'pending',
    sent_at TEXT,
    error TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS automation_analytics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rule_id INTEGER REFERENCES automation_rules(id),
    event_type TEXT NOT NULL,
    conversation_id INTEGER,
    details TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_automation_rules_active ON automation_rules(active, trigger_type);
  CREATE INDEX IF NOT EXISTS idx_conversation_notes_conv ON conversation_notes(conversation_id);
  CREATE INDEX IF NOT EXISTS idx_broadcast_recipients_campaign ON broadcast_recipients(campaign_id);
  CREATE INDEX IF NOT EXISTS idx_broadcast_recipients_contact ON broadcast_recipients(contact_id);
  CREATE INDEX IF NOT EXISTS idx_automation_analytics_rule ON automation_analytics(rule_id, created_at);
;
ALTER TABLE attendance ADD COLUMN check_in TEXT;
ALTER TABLE attendance ADD COLUMN check_out TEXT;
ALTER TABLE attendance ADD COLUMN hours_worked REAL;
ALTER TABLE attendance ADD COLUMN source TEXT DEFAULT 'manual';
ALTER TABLE attendance ADD COLUMN notes TEXT;
ALTER TABLE employees  ADD COLUMN join_date TEXT;
ALTER TABLE leads      ADD COLUMN meta_lead_id TEXT;
ALTER TABLE leads      ADD COLUMN meta_form_id TEXT;
ALTER TABLE leads      ADD COLUMN meta_ad_id TEXT;
ALTER TABLE leads      ADD COLUMN meta_campaign TEXT;
ALTER TABLE channels   ADD COLUMN active INTEGER DEFAULT 1;
ALTER TABLE channels   ADD COLUMN consultant TEXT;
ALTER TABLE channels   ADD COLUMN avatar_url TEXT;
ALTER TABLE users      ADD COLUMN emp_id TEXT;
ALTER TABLE leads      ADD COLUMN application_stage TEXT;
ALTER TABLE leads      ADD COLUMN visa_deadline TEXT;
ALTER TABLE leads      ADD COLUMN departure_date TEXT;
ALTER TABLE leads      ADD COLUMN intake_term TEXT;
ALTER TABLE leads      ADD COLUMN university TEXT;
ALTER TABLE leads      ADD COLUMN application_notes TEXT;
ALTER TABLE leads      ADD COLUMN source TEXT;
ALTER TABLE leads      ADD COLUMN referrer TEXT;
ALTER TABLE leads      ADD COLUMN nationality TEXT;
ALTER TABLE leads      ADD COLUMN passport TEXT;
ALTER TABLE leads      ADD COLUMN degree TEXT;
ALTER TABLE leads      ADD COLUMN major TEXT;
ALTER TABLE leads      ADD COLUMN drive_link TEXT;
ALTER TABLE leads      ADD COLUMN deposit REAL DEFAULT 0;
ALTER TABLE users      ADD COLUMN agency_id INTEGER;
ALTER TABLE leads      ADD COLUMN agency_id INTEGER;
ALTER TABLE leads      ADD COLUMN lead_type TEXT DEFAULT 'B2C';
ALTER TABLE leads      ADD COLUMN public_token TEXT;
ALTER TABLE leads      ADD COLUMN public_enabled INTEGER DEFAULT 1;
ALTER TABLE leads      ADD COLUMN blood_group TEXT;
ALTER TABLE leads      ADD COLUMN date_of_birth TEXT;
ALTER TABLE leads      ADD COLUMN medical_notes TEXT;
ALTER TABLE leads      ADD COLUMN emergency_contact TEXT;
ALTER TABLE lead_documents ADD COLUMN requested_by_student INTEGER DEFAULT 0;
ALTER TABLE lead_documents ADD COLUMN student_uploaded_url TEXT;
ALTER TABLE lead_documents ADD COLUMN student_uploaded_at TEXT;
ALTER TABLE leads      ADD COLUMN passing_year TEXT;
ALTER TABLE leads      ADD COLUMN last_education_major TEXT;
ALTER TABLE leads      ADD COLUMN height TEXT;
ALTER TABLE leads      ADD COLUMN weight TEXT;
ALTER TABLE leads      ADD COLUMN english_test_type TEXT;
ALTER TABLE leads      ADD COLUMN payment_agreement TEXT;
ALTER TABLE leads      ADD COLUMN hardcopy_status TEXT;
ALTER TABLE leads      ADD COLUMN hardcopy_documents TEXT;
ALTER TABLE leads      ADD COLUMN age INTEGER;
CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_public_token ON leads(public_token);
CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_wa_id ON messages(wa_message_id);
ALTER TABLE income ADD COLUMN exclude_from_cash INTEGER DEFAULT 0;
ALTER TABLE contacts ADD COLUMN tiktok_id TEXT;
ALTER TABLE leads ADD COLUMN assigned_employee_id INTEGER;
ALTER TABLE income ADD COLUMN employee_id INTEGER;
ALTER TABLE expenses ADD COLUMN employee_id INTEGER;
ALTER TABLE content_posts ADD COLUMN quality_score INTEGER;
ALTER TABLE content_posts ADD COLUMN quality_checks TEXT;
ALTER TABLE content_posts ADD COLUMN asset_type TEXT;
ALTER TABLE content_posts ADD COLUMN asset_uploaded_by TEXT;
ALTER TABLE content_posts ADD COLUMN asset_uploaded_at TEXT;
ALTER TABLE content_posts ADD COLUMN utm_source TEXT;
ALTER TABLE content_posts ADD COLUMN utm_medium TEXT;
ALTER TABLE content_posts ADD COLUMN utm_campaign TEXT;
ALTER TABLE content_posts ADD COLUMN utm_content TEXT;
ALTER TABLE content_posts ADD COLUMN short_link TEXT;
ALTER TABLE content_posts ADD COLUMN redraft_count INTEGER DEFAULT 0;
ALTER TABLE content_posts ADD COLUMN research_intel_id INTEGER;
ALTER TABLE content_posts ADD COLUMN shares INTEGER;
ALTER TABLE content_posts ADD COLUMN comments INTEGER;
ALTER TABLE content_posts ADD COLUMN saves INTEGER;
ALTER TABLE content_posts ADD COLUMN video_views INTEGER;
ALTER TABLE content_posts ADD COLUMN leads INTEGER;
ALTER TABLE content_posts ADD COLUMN published_at TEXT;
ALTER TABLE content_posts ADD COLUMN published_by TEXT;
ALTER TABLE content_posts ADD COLUMN language TEXT DEFAULT 'bangla';
ALTER TABLE publishing_queue ADD COLUMN page TEXT;
ALTER TABLE publishing_queue ADD COLUMN platform_post_id TEXT;
ALTER TABLE publishing_queue ADD COLUMN platform_post_url TEXT;
ALTER TABLE publishing_queue ADD COLUMN error_message TEXT;
ALTER TABLE publishing_queue ADD COLUMN reach INTEGER;
ALTER TABLE publishing_queue ADD COLUMN engagement INTEGER;
ALTER TABLE publishing_queue ADD COLUMN created_at TEXT;
UPDATE publishing_queue SET created_at = datetime('now') WHERE created_at IS NULL;
ALTER TABLE content_posts ADD COLUMN campaign_id INTEGER;
ALTER TABLE content_posts ADD COLUMN assigned_to TEXT;
ALTER TABLE content_posts ADD COLUMN reviewed_by TEXT;
ALTER TABLE content_posts ADD COLUMN reviewed_at TEXT;
ALTER TABLE content_posts ADD COLUMN rejection_reason TEXT;
ALTER TABLE content_posts ADD COLUMN due_date TEXT;
ALTER TABLE content_posts ADD COLUMN priority TEXT CHECK(priority IN ('low','normal','high','urgent')) DEFAULT 'normal';
ALTER TABLE content_posts ADD COLUMN notes TEXT;
ALTER TABLE content_posts ADD COLUMN tags TEXT;
ALTER TABLE conversations ADD COLUMN assigned_to_id INTEGER;
DELETE FROM conversations WHERE id NOT IN (SELECT MAX(id) FROM conversations GROUP BY contact_id, channel_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_contact_channel ON conversations(contact_id, channel_id);
ALTER TABLE leads ADD COLUMN ad_name TEXT;
ALTER TABLE leads ADD COLUMN page_name TEXT;
ALTER TABLE leads ADD COLUMN channel_id INTEGER;
ALTER TABLE contacts ADD COLUMN referral_data TEXT;