const BASE = '/api';

async function req(path, opts = {}) {
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
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export const api = {
  // Auth
  me:     ()                              => req('/auth/me'),
  login:  (email, password, loc = null)   => req('/auth/login', { method: 'POST', body: JSON.stringify({ email, password, lat: loc?.lat, lng: loc?.lng }) }),
  logout: ()                              => req('/auth/logout', { method: 'POST' }),

  // Office config
  officeConfig:     ()  => req('/office-config'),
  saveOfficeConfig: (d) => req('/office-config', { method: 'POST', body: JSON.stringify(d) }),

  // Owner's Cockpit
  cockpit:  ()       => req('/cockpit'),
  activity: (p = {}) => req('/activity?' + new URLSearchParams(p)),

  // Application pipeline
  applicationMeta: ()        => req('/application/meta'),
  applications:    (p = {})  => req('/applications?' + new URLSearchParams(p)),
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

  // Leads
  leads:        (p = {}) => req('/leads?' + new URLSearchParams(p)),
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
  income:        (p = {}) => req('/income?' + new URLSearchParams(p)),
  createIncome:  (d)      => req('/income',       { method: 'POST', body: JSON.stringify(d) }),
  updateIncome:  (id, d)  => req(`/income/${id}`, { method: 'PUT',  body: JSON.stringify(d) }),
  deleteIncome:  (id)     => req(`/income/${id}`, { method: 'DELETE' }),
  expenses:      (p = {}) => req('/expenses?' + new URLSearchParams(p)),
  createExpense: (d)      => req('/expenses',       { method: 'POST', body: JSON.stringify(d) }),
  updateExpense: (id, d)  => req(`/expenses/${id}`, { method: 'PUT',  body: JSON.stringify(d) }),
  deleteExpense: (id)     => req(`/expenses/${id}`, { method: 'DELETE' }),
  pnl: () => req('/pnl'),

  // Employees
  employees:      ()      => req('/employees'),
  createEmployee: (d)     => req('/employees',       { method: 'POST', body: JSON.stringify(d) }),
  updateEmployee: (id, d) => req(`/employees/${id}`, { method: 'PUT',  body: JSON.stringify(d) }),
  deleteEmployee: (id)    => req(`/employees/${id}`, { method: 'DELETE' }),

  // Attendance
  attendance:        (p = {}) => req('/attendance?' + new URLSearchParams(p)),
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
  payroll:        (month) => req('/payroll?' + new URLSearchParams({ month })),
  updatePayroll:  (id, d) => req(`/payroll/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
  markPayrollPaid:(id)    => req(`/payroll/${id}/mark-paid`, { method: 'POST' }),

  // Users (admin)
  users:      ()       => req('/users'),
  createUser: (d)      => req('/users',       { method: 'POST', body: JSON.stringify(d) }),
  updateUser: (id, d)  => req(`/users/${id}`, { method: 'PUT',  body: JSON.stringify(d) }),
  deleteUser: (id)     => req(`/users/${id}`, { method: 'DELETE' }),
};
