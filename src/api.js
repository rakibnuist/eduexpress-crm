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

  // Dashboard / settings
  dashboard: () => req('/dashboard'),
  settings:  () => req('/settings'),

  // Leads
  leads:       (p = {}) => req('/leads?' + new URLSearchParams(p)),
  getLead:     (id)     => req(`/leads/${id}`),
  createLead:  (d)      => req('/leads',       { method: 'POST', body: JSON.stringify(d) }),
  updateLead:  (id, d)  => req(`/leads/${id}`, { method: 'PUT',  body: JSON.stringify(d) }),
  deleteLead:  (id)     => req(`/leads/${id}`, { method: 'DELETE' }),

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
