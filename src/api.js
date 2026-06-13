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
    if (!msg) { try { msg = await r.text(); } catch {} }
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

  // Employees
  employees:      ()      => req('/employees'),
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
  syncChannel:    (id)   => req(`/channels/${id}/sync`, { method: 'POST' }),

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
};
