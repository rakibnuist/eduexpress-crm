const BASE = '/api';

// Auto-retry on 503 (server restarting) so a transient OOM recovery is
// invisible to the user. Up to 3 retries with exponential backoff.
async function req(path, opts = {}, attempt = 1) {
  const r = await fetch(BASE + path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (r.status === 401) {
    if (!path.startsWith('/auth/') && window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
    throw new Error('Unauthorized');
  }
  // Server is restarting or warming up — wait and retry transparently.
  if (r.status === 503 && attempt <= 3) {
    await new Promise(res => setTimeout(res, 800 * attempt));
    return req(path, opts, attempt + 1);
  }
  if (!r.ok) {
    // Try to extract a friendlier error message from a JSON body
    let msg = '';
    try { const j = await r.clone().json(); msg = j.error || j.message || ''; } catch {}
    if (!msg) {
      try {
        msg = await r.text();
        const trimmed = msg.trim();
        const isFirewall = trimmed.includes('hcdn-cgi') || 
                           trimmed.includes('jschallenge') || 
                           trimmed.includes('cloudflare') || 
                           trimmed.includes('security check');
        if (isFirewall) {
          msg = 'Request blocked by security firewall (Hostinger CDN). Please refresh the page or solve the challenge in your browser.';
        } else if (trimmed.startsWith('<')) {
          const titleMatch = trimmed.match(/<title>([\s\S]*?)<\/title>/i);
          const title = titleMatch ? titleMatch[1].trim() : '';
          msg = `Server HTML Error (${r.status})${title ? `: ${title}` : ''}`;
        } else {
          msg = trimmed.substring(0, 150) || `Request failed (${r.status})`;
        }
      } catch {}
    }
    throw new Error(msg || `Request failed (${r.status})`);
  }
  return r.json();
}

function toQuery(p) {
  const filtered = {};
  for (const k in p) {
    if (p[k] !== undefined && p[k] !== null && p[k] !== '') {
      filtered[k] = p[k];
    }
  }
  return new URLSearchParams(filtered).toString();
}

export const api = {
  // Auth
  me:     ()                              => req('/auth/me'),
  login:  (email, password, loc = null, ssid = null) => req('/auth/login', { method: 'POST', body: JSON.stringify({ email, password, lat: loc?.lat, lng: loc?.lng, ssid }) }),
  logout: ()                              => req('/auth/logout', { method: 'POST' }),

  // Office config
  officeConfig:     ()  => req('/office-config'),
  saveOfficeConfig: (d) => req('/office-config', { method: 'POST', body: JSON.stringify(d) }),

  // Owner's Cockpit
  cockpit:  ()       => req('/cockpit'),
  activity: (p = {}) => req('/activity?' + toQuery(p)),

  // Application pipeline
  applicationMeta: ()        => req('/application/meta'),
  applications:    (p = {})  => req('/applications?' + toQuery(p)),
  updateStage:     (id, d)   => req(`/leads/${id}/stage`, { method: 'PUT', body: JSON.stringify(d) }),
  documents:       (leadId)  => req(`/leads/${leadId}/documents`),
  addDocument:     (leadId, d) => req(`/leads/${leadId}/documents`, { method: 'POST', body: JSON.stringify(d) }),
  updateDocument:  (id, d)   => req(`/documents/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
  deleteDocument:  (id)      => req(`/documents/${id}`, { method: 'DELETE' }),

  // Per-university applications (mirrors the NJTech/SUES/SXU columns)
  universityApps:       (leadId)    => req(`/leads/${leadId}/university-applications`),
  addUniversityApp:     (leadId, d) => req(`/leads/${leadId}/university-applications`, { method: 'POST', body: JSON.stringify(d) }),
  updateUniversityApp:  (id, d)     => req(`/university-applications/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
  deleteUniversityApp:  (id)        => req(`/university-applications/${id}`, { method: 'DELETE' }),

  // Dashboard / settings
  dashboard: () => req('/dashboard'),
  settings:  () => req('/settings'),
  saveSettings: (key, value) => req('/settings', { method: 'POST', body: JSON.stringify({ key, value }) }),

  // Leads
  leads:        (p = {}) => req('/leads?' + toQuery(p)),
  getLead:      (id)     => req(`/leads/${id}`),
  createLead:   (d)      => req('/leads',       { method: 'POST', body: JSON.stringify(d) }),
  updateLead:   (id, d)  => req(`/leads/${id}`, { method: 'PUT',  body: JSON.stringify(d) }),
  deleteLead:   (id)     => req(`/leads/${id}`, { method: 'DELETE' }),
  bulkAssignLeads: (ids, consultant) => req('/leads/bulk-assign', { method: 'POST', body: JSON.stringify({ ids, consultant }) }),
  leadTimeline: (id)     => req(`/leads/${id}/timeline`),
  addNote:      (id, t)  => req(`/leads/${id}/notes`, { method: 'POST', body: JSON.stringify({ text: t }) }),

  // Student portal (admin/manager side)
  regenerateToken: (id)  => req(`/leads/${id}/regenerate-token`, { method: 'POST' }),
  setPublic:    (id, on) => req(`/leads/${id}/public`, { method: 'PUT', body: JSON.stringify({ enabled: on }) }),
  qrUrl:        (id)     => `/api/leads/${id}/qr?size=240`,

  // Student portal (public — no auth, never goes through req())
  studentPortal:        (token)        => fetch(`/api/public/student/${token}`).then(r => r.ok ? r.json() : Promise.reject(new Error(r.statusText))),
  studentUploadDoc:     (token, docId, url, notes) =>
    fetch(`/api/public/student/${token}/documents/${docId}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, notes }),
    }).then(r => r.ok ? r.json() : r.text().then(t => Promise.reject(new Error(t)))),
  studentMessage:       (token, text)  =>
    fetch(`/api/public/student/${token}/message`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    }).then(r => r.ok ? r.json() : r.text().then(t => Promise.reject(new Error(t)))),

  // Finance
  income:        (p = {}) => req('/income?' + toQuery(p)),
  createIncome:  (d)      => req('/income',       { method: 'POST', body: JSON.stringify(d) }),
  updateIncome:  (id, d)  => req(`/income/${id}`, { method: 'PUT',  body: JSON.stringify(d) }),
  deleteIncome:  (id)     => req(`/income/${id}`, { method: 'DELETE' }),
  expenses:      (p = {}) => req('/expenses?' + toQuery(p)),
  createExpense: (d)      => req('/expenses',       { method: 'POST', body: JSON.stringify(d) }),
  updateExpense: (id, d)  => req(`/expenses/${id}`, { method: 'PUT',  body: JSON.stringify(d) }),
  deleteExpense: (id)     => req(`/expenses/${id}`, { method: 'DELETE' }),
  pnl: () => req('/pnl'),

  // Cashflow
  cashflow:           (month)  => req('/cashflow?' + toQuery({ month })),
  cashflowYear:       (year)   => req('/cashflow/year?' + toQuery({ year })),
  cashflowCategories: ()       => req('/cashflow/categories'),
  cashflowInvestors:  ()       => req('/cashflow/investors'),
  setInitialCash:     (amount) => req('/cashflow/initial', { method: 'PUT', body: JSON.stringify({ amount }) }),

  // Broadcasts (owner sticky notes)
  broadcasts:        ()        => req('/broadcasts'),
  createBroadcast:   (d)       => req('/broadcasts', { method: 'POST', body: JSON.stringify(d) }),
  deleteBroadcast:   (id)      => req(`/broadcasts/${id}`, { method: 'DELETE' }),
  dismissBroadcast:  (id)      => req(`/broadcasts/${id}/dismiss`, { method: 'POST' }),

  // Excel import (rows are pre-parsed in the browser)
  importCashflow:    (rows)    => req('/import/cashflow', { method: 'POST', body: JSON.stringify({ rows }) }),
  importApplications:(rows)    => req('/import/applications', { method: 'POST', body: JSON.stringify({ rows }) }),

  // Admin: wipe all leads + cascaded data (opts: { conversations: true } also wipes chats)
  wipeLeads: (opts = {}) => req('/admin/wipe-leads', { method: 'DELETE', body: JSON.stringify(opts) }),

  // Staff↔student thread
  replyToStudent:    (id, t)   => req(`/leads/${id}/reply-to-student`, { method: 'POST', body: JSON.stringify({ text: t }) }),
  studentThread:     (token)   => fetch(`/api/public/student/${token}/thread`).then(r => r.ok ? r.json() : Promise.reject(new Error(r.statusText))),

  // Auto-link current user to an HR employee record
  autoLinkEmployee: () => req('/employees/auto-link', { method: 'POST' }),
  employees:      ()      => req('/employees'),
  employeesActive: ()    => req('/employees/active'),
  createEmployee: (d)     => req('/employees',       { method: 'POST', body: JSON.stringify(d) }),
  updateEmployee: (id, d) => req(`/employees/${id}`, { method: 'PUT',  body: JSON.stringify(d) }),
  deleteEmployee: (id)    => req(`/employees/${id}`, { method: 'DELETE' }),

  // Attendance
  attendance:        (p = {}) => req('/attendance?' + toQuery(p)),
  attendanceSummary: (month)  => req(`/attendance/summary/${month}`),
  checkIn:           (d)      => req('/attendance/checkin', { method: 'POST', body: JSON.stringify(d) }),
  checkOut:          (id, t)  => req(`/attendance/${id}/checkout`, { method: 'PUT', body: JSON.stringify({ time: t }) }),
  createAttendance:  (d)      => req('/attendance',       { method: 'POST', body: JSON.stringify(d) }),
  updateAttendance:  (id, d)  => req(`/attendance/${id}`, { method: 'PUT',  body: JSON.stringify(d) }),
  deleteAttendance:  (id)     => req(`/attendance/${id}`, { method: 'DELETE' }),

  // KPI
  kpi:           (month) => req(`/kpi/${month}`),
  setKpiTargets: (d)     => req('/kpi/targets', { method: 'PUT', body: JSON.stringify(d) }),

  // Payroll
  payroll:        (month) => req('/payroll?' + toQuery({ month })),
  updatePayroll:  (id, d) => req(`/payroll/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
  markPayrollPaid:(id)    => req(`/payroll/${id}/mark-paid`, { method: 'POST' }),

  // Reports (weekly/monthly digest)
  report:         (period, date) => req('/reports?' + toQuery({ period, date })),

  // Employee performance
  employeeKpi:    (month) => req('/employee-kpi?' + toQuery({ month })),
  employeeKpiOne: (emp_id, month) => req(`/employee-kpi/${emp_id}?` + toQuery({ month })),
  dailyLogs:      (params = {}) => req('/daily-logs?' + toQuery(params)),
  dailyLogsToday: ()         => req('/daily-logs/me/today'),
  submitDailyLog: (d)        => req('/daily-logs', { method: 'POST', body: JSON.stringify(d) }),

  // Users (admin)
  users:      ()       => req('/users'),
  createUser: (d)      => req('/users',       { method: 'POST', body: JSON.stringify(d) }),
  updateUser: (id, d)  => req(`/users/${id}`, { method: 'PUT',  body: JSON.stringify(d) }),
  deleteUser: (id)     => req(`/users/${id}`, { method: 'DELETE' }),

  // Meta Config & Channels (automated lead capture configurations)
  getMetaConfig:  ()  => req('/meta/config'),
  saveMetaConfig: (d) => req('/meta/config', { method: 'POST', body: JSON.stringify(d) }),
  getMetaStats:   ()  => req('/meta/stats'),

  channels:       ()     => req('/channels'),
  createChannel:  (d)    => req('/channels',       { method: 'POST', body: JSON.stringify(d) }),
  updateChannel:  (id, d)=> req(`/channels/${id}`, { method: 'PUT',  body: JSON.stringify(d) }),
  deleteChannel:  (id)   => req(`/channels/${id}`, { method: 'DELETE' }),
  syncChannel:    (id)   => req(`/channels/${id}/load-history`, { method: 'POST' }),

  // Conversations & Live Chat
  conversations:   (p = {})  => req('/conversations?' + toQuery(p)),
  getConversation: (id)      => req(`/conversations/${id}`),
  updateConversation:(id, d) => req(`/conversations/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
  markConversationAsRead:(id) => req(`/conversations/${id}/read`, { method: 'POST' }),
  createConversation:(d)     => req('/conversations', { method: 'POST', body: JSON.stringify(d) }),
  deleteConversation:(id)    => req(`/conversations/${id}`, { method: 'DELETE' }),
  messages:        (convId)  => req(`/conversations/${convId}/messages`),
  sendMessage:     (convId, d)=> req(`/conversations/${convId}/messages`, { method: 'POST', body: JSON.stringify(d) }),
  quickReplies:    ()        => req('/quick-replies'),
  convertLead:     (convId, d)=> req(`/conversations/${convId}/convert-lead`, { method: 'POST', body: JSON.stringify(d) }),

  // Marketing / social automation
  marketing: {
    posts:         (p = {})  => req('/marketing/posts?' + toQuery(p)),
    createPost:    (d)       => req('/marketing/posts', { method: 'POST', body: JSON.stringify(d) }),
    updatePost:    (id, d)   => req(`/marketing/posts/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
    setPostStatus: (id, d)   => req(`/marketing/posts/${id}/status`, { method: 'PUT', body: JSON.stringify(d) }),
    deletePost:    (id)      => req(`/marketing/posts/${id}`, { method: 'DELETE' }),
    approveWeek:   (week)    => req('/marketing/posts/approve-week', { method: 'POST', body: JSON.stringify({ week }) }),
    // Generic list/CRUD for: evergreen, competitors, kb/universities, kb/scholarships, kb/sources, kb/docs, brain
    list:   (res)        => req(`/marketing/${res}`),
    create: (res, d)     => req(`/marketing/${res}`, { method: 'POST', body: JSON.stringify(d) }),
    update: (res, id, d) => req(`/marketing/${res}/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
    remove: (res, id)    => req(`/marketing/${res}/${id}`, { method: 'DELETE' }),
    // ── v2.0 endpoints ──
    research:        ()    => req('/marketing/research'),
    updateResearch:   (id, d) => req(`/marketing/research/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
    createResearch:   (d) => req('/marketing/research', { method: 'POST', body: JSON.stringify(d) }),
    deleteResearch:   (id) => req(`/marketing/research/${id}`, { method: 'DELETE' }),
    viralTopics:      ()    => req('/marketing/viral-topics'),
    updateViralTopic: (id, d) => req(`/marketing/viral-topics/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
    createViralTopic: (d) => req('/marketing/viral-topics', { method: 'POST', body: JSON.stringify(d) }),
    deleteViralTopic: (id) => req(`/marketing/viral-topics/${id}`, { method: 'DELETE' }),
    psychology:       ()    => req('/marketing/psychology'),
    updatePsychology: (id, d) => req(`/marketing/psychology/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
    createPsychology: (d) => req('/marketing/psychology', { method: 'POST', body: JSON.stringify(d) }),
    deletePsychology: (id) => req(`/marketing/psychology/${id}`, { method: 'DELETE' }),
    scripts:          ()    => req('/marketing/scripts'),
    updateScript:     (id, d) => req(`/marketing/scripts/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
    createScript:     (d) => req('/marketing/scripts', { method: 'POST', body: JSON.stringify(d) }),
    deleteScript:     (id) => req(`/marketing/scripts/${id}`, { method: 'DELETE' }),
    hooks:            ()    => req('/marketing/hooks'),
    updateHook:       (id, d) => req(`/marketing/hooks/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
    createHook:       (d) => req('/marketing/hooks', { method: 'POST', body: JSON.stringify(d) }),
    deleteHook:       (id) => req(`/marketing/hooks/${id}`, { method: 'DELETE' }),
    creativeGuidelines: ()    => req('/marketing/creative-guidelines'),
    updateCreativeGuideline: (id, d) => req(`/marketing/creative-guidelines/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
    createCreativeGuideline: (d) => req('/marketing/creative-guidelines', { method: 'POST', body: JSON.stringify(d) }),
    deleteCreativeGuideline: (id) => req(`/marketing/creative-guidelines/${id}`, { method: 'DELETE' }),
    abTests:          ()    => req('/marketing/ab-tests'),
    updateAbTest:     (id, d) => req(`/marketing/ab-tests/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
    createAbTest:     (d) => req('/marketing/ab-tests', { method: 'POST', body: JSON.stringify(d) }),
    deleteAbTest:     (id) => req(`/marketing/ab-tests/${id}`, { method: 'DELETE' }),
    scaleUp:          ()    => req('/marketing/scale-up'),
    updateScaleUp:    (id, d) => req(`/marketing/scale-up/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
    createScaleUp:    (d) => req('/marketing/scale-up', { method: 'POST', body: JSON.stringify(d) }),
    deleteScaleUp:    (id) => req(`/marketing/scale-up/${id}`, { method: 'DELETE' }),
    // Analytics
    analyticsOverview: (days) => req('/marketing/analytics/overview?days=' + days),
    analyticsFunnel:   (days) => req('/marketing/analytics/funnel?days=' + days),
    analyticsPillars:    (days) => req('/marketing/analytics/pillars?days=' + days),
    analyticsPages:      (days) => req('/marketing/analytics/pages?days=' + days),
    analyticsConsistency: () => req('/marketing/analytics/consistency'),
    analyticsAttribution: (days) => req('/marketing/analytics/attribution?days=' + days),
    analyticsHookPerformance: (days) => req('/marketing/analytics/hook-performance?days=' + days),
    analyticsScaleUpSignals: (days) => req('/marketing/analytics/scale-up-signals?days=' + days),
    // Attribution
    attributionSummary: (days) => req('/marketing/attribution/summary?days=' + days),
    // Designer
    designerQueue:     (p = {}) => req('/marketing/designer-queue?' + toQuery(p)),
    createDesignerQueue: (d) => req('/marketing/designer-queue', { method: 'POST', body: JSON.stringify(d) }),
    updateDesignerQueue: (id, d) => req(`/marketing/designer-queue/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
    deleteDesignerQueue: (id) => req(`/marketing/designer-queue/${id}`, { method: 'DELETE' }),
    // Publishing
    publishingQueue:   () => req('/marketing/publishing-queue'),
    publishingQueueFull: (p = {}) => req('/marketing/publishing-queue/full?' + toQuery(p)),
    publishingQueueDue: () => req('/marketing/publishing-queue/due'),
    postsDue:          (limit) => req('/marketing/posts/due?limit=' + (limit || 20)),
    publishPost:       (postId, d) => req(`/marketing/publish/${postId}`, { method: 'POST', body: JSON.stringify(d) }),
    retryPublish:      (queueId) => req(`/marketing/publish/retry/${queueId}`, { method: 'POST' }),
    publishConfig:     () => req('/marketing/publish/config'),
    // Quality
    postQuality:       (id) => req(`/marketing/posts/${id}/quality`),
    updatePostQuality: (id, d) => req(`/marketing/posts/${id}/quality`, { method: 'PUT', body: JSON.stringify(d) }),
    // Content Factory Data Sources
    searchUniversities: (q, country, limit) => req(`/marketing/kb/universities/search?q=${q||''}&country=${country||''}&limit=${limit||20}`),
    searchScholarships: (q, country, status, limit) => req(`/marketing/kb/scholarships/search?q=${q||''}&country=${country||''}&status=${status||''}&limit=${limit||20}`),
    bestHooks: (page, pillar, destination, limit) => req(`/marketing/hooks/best?page=${page||''}&pillar=${pillar||''}&destination=${destination||''}&limit=${limit||10}`),
    activeResearch: () => req('/marketing/research/active'),
    // Research Analytics
    researchFeed:        (limit) => req('/marketing/research/feed?limit=' + limit),
    researchCompetitorSummary: (days) => req('/marketing/research/competitor-summary?days=' + days),
    researchGapAnalysis: () => req('/marketing/research/gap-analysis'),
    llmConfig:      () => req('/marketing/llm-config'),
    saveLlmConfig:  (d) => req('/marketing/llm-config', { method: 'POST', body: JSON.stringify(d) }),
    testLlm:        (d) => req('/marketing/llm-test', { method: 'POST', body: JSON.stringify(d) }),
    // Professional SMM Pipeline v3.0
    campaigns:        () => req('/marketing/campaigns'),
    campaign:         (id) => req('/marketing/campaigns/' + id),
    createCampaign:   (d) => req('/marketing/campaigns', { method: 'POST', body: JSON.stringify(d) }),
    updateCampaign:   (id, d) => req('/marketing/campaigns/' + id, { method: 'PUT', body: JSON.stringify(d) }),
    deleteCampaign:   (id) => req('/marketing/campaigns/' + id, { method: 'DELETE' }),
    pipeline:         (p = {}) => req('/marketing/pipeline?' + toQuery(p)),
    movePost:         (id, d) => req('/marketing/posts/' + id + '/move', { method: 'POST', body: JSON.stringify(d) }),
    postComments:     (id) => req('/marketing/posts/' + id + '/comments'),
    addPostComment:   (id, d) => req('/marketing/posts/' + id + '/comments', { method: 'POST', body: JSON.stringify(d) }),
    deletePostComment:(id) => req('/marketing/posts/comments/' + id, { method: 'DELETE' }),
    postPerformance:  (id) => req('/marketing/posts/' + id + '/performance'),
    addPostPerformance:(id, d) => req('/marketing/posts/' + id + '/performance', { method: 'POST', body: JSON.stringify(d) }),
    assets:           (p = {}) => req('/marketing/assets?' + toQuery(p)),
    createAsset:      (d) => req('/marketing/assets', { method: 'POST', body: JSON.stringify(d) }),
    updateAsset:      (id, d) => req('/marketing/assets/' + id, { method: 'PUT', body: JSON.stringify(d) }),
    deleteAsset:      (id) => req('/marketing/assets/' + id, { method: 'DELETE' }),
    postLogs:         (id) => req('/marketing/posts/' + id + '/logs'),
    marketingDashboard: () => req('/marketing/dashboard'),
    // Content Calendar Automation
    templates:         (p = {}) => req('/marketing/templates?' + toQuery(p)),
    template:          (id) => req('/marketing/templates/' + id),
    createTemplate:    (d) => req('/marketing/templates', { method: 'POST', body: JSON.stringify(d) }),
    updateTemplate:    (id, d) => req('/marketing/templates/' + id, { method: 'PUT', body: JSON.stringify(d) }),
    deleteTemplate:    (id) => req('/marketing/templates/' + id, { method: 'DELETE' }),
    useTemplate:       (id, d) => req('/marketing/templates/' + id + '/use', { method: 'POST', body: JSON.stringify(d) }),
    calendar:          (p = {}) => req('/marketing/calendar?' + toQuery(p)),
    createCalendarSlot:(d) => req('/marketing/calendar', { method: 'POST', body: JSON.stringify(d) }),
    updateCalendarSlot:(id, d) => req('/marketing/calendar/' + id, { method: 'PUT', body: JSON.stringify(d) }),
    deleteCalendarSlot:(id) => req('/marketing/calendar/' + id, { method: 'DELETE' }),
    assignCalendarSlot:(id, d) => req('/marketing/calendar/' + id + '/assign', { method: 'POST', body: JSON.stringify(d) }),
    autoSchedule:      (d) => req('/marketing/auto-schedule', { method: 'POST', body: JSON.stringify(d) }),
    bestTimes:         (p = {}) => req('/marketing/best-times?' + toQuery(p)),
    createBestTime:    (d) => req('/marketing/best-times', { method: 'POST', body: JSON.stringify(d) }),
    // Offer Sources
    offerSources:      () => req('/marketing/offer-sources'),
    createOfferSource: (d) => req('/marketing/offer-sources', { method: 'POST', body: JSON.stringify(d) }),
    updateOfferSource: (id, d) => req(`/marketing/offer-sources/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
    deleteOfferSource: (id) => req(`/marketing/offer-sources/${id}`, { method: 'DELETE' }),
  },

  // Automation Hub
  automationRules: () => req('/automation/rules'),
  createAutomationRule: (d) => req('/automation/rules', { method: 'POST', body: JSON.stringify(d) }),
  updateAutomationRule: (id, d) => req(`/automation/rules/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
  deleteAutomationRule: (id) => req(`/automation/rules/${id}`, { method: 'DELETE' }),
  testAutomationRule: (id) => req(`/automation/rules/${id}/test`, { method: 'POST' }),

  templates: () => req('/templates'),
  createTemplate: (d) => req('/templates', { method: 'POST', body: JSON.stringify(d) }),
  updateTemplate: (id, d) => req(`/templates/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
  deleteTemplate: (id) => req(`/templates/${id}`, { method: 'DELETE' }),

  tags: () => req('/tags'),
  createTag: (d) => req('/tags', { method: 'POST', body: JSON.stringify(d) }),
  deleteTag: (id) => req(`/tags/${id}`, { method: 'DELETE' }),
  tagContacts: (id) => req(`/tags/${id}/contacts`),

  broadcastCampaigns: () => req('/broadcast-campaigns'),
  createBroadcastCampaign: (d) => req('/broadcast-campaigns', { method: 'POST', body: JSON.stringify(d) }),
  sendBroadcastCampaign: (id) => req(`/broadcast-campaigns/${id}/send`, { method: 'POST' }),
  pauseBroadcast: (id) => req(`/broadcast-campaigns/${id}/pause`, { method: 'POST' }),
  resumeBroadcast: (id) => req(`/broadcast-campaigns/${id}/resume`, { method: 'POST' }),
  deleteBroadcastCampaign: (id) => req(`/broadcast-campaigns/${id}`, { method: 'DELETE' }),

  conversationNotes: (id) => req(`/conversations/${id}/notes`),
  addConversationNote: (id, d) => req(`/conversations/${id}/notes`, { method: 'POST', body: JSON.stringify(d) }),
  addConversationTag: (id, d) => req(`/conversations/${id}/tags`, { method: 'POST', body: JSON.stringify(d) }),
  removeConversationTag: (id, tagId) => req(`/conversations/${id}/tags/${tagId}`, { method: 'DELETE' }),
  assignConversation: (id, d) => req(`/conversations/${id}/assign`, { method: 'PUT', body: JSON.stringify(d) }),

  // Convert conversation to lead
  convertConversationToLead: (id, d) => req(`/conversations/${id}/convert-to-lead`, { method: 'POST', body: JSON.stringify(d) }),
  convertLeadToApplication: (id) => req(`/leads/${id}/convert-to-application`, { method: 'POST' }),

  automationStats: () => req('/automation/stats'),
};
