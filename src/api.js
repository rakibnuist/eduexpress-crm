const BASE = '/api';

async function req(path, opts = {}) {
  const r = await fetch(BASE + path, { headers: { 'Content-Type': 'application/json' }, ...opts });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export const api = {
  dashboard: () => req('/dashboard'),
  settings: () => req('/settings'),

  // Leads
  leads: (p = {}) => req('/leads?' + new URLSearchParams(p)),
  getLead: (id) => req(`/leads/${id}`),
  createLead: (d) => req('/leads', { method: 'POST', body: JSON.stringify(d) }),
  updateLead: (id, d) => req(`/leads/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
  deleteLead: (id) => req(`/leads/${id}`, { method: 'DELETE' }),

  // Finance
  income: (p = {}) => req('/income?' + new URLSearchParams(p)),
  createIncome: (d) => req('/income', { method: 'POST', body: JSON.stringify(d) }),
  updateIncome: (id, d) => req(`/income/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
  deleteIncome: (id) => req(`/income/${id}`, { method: 'DELETE' }),
  expenses: (p = {}) => req('/expenses?' + new URLSearchParams(p)),
  createExpense: (d) => req('/expenses', { method: 'POST', body: JSON.stringify(d) }),
  updateExpense: (id, d) => req(`/expenses/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
  deleteExpense: (id) => req(`/expenses/${id}`, { method: 'DELETE' }),
  pnl: () => req('/pnl'),

  // Employees
  employees: () => req('/employees'),
  createEmployee: (d) => req('/employees', { method: 'POST', body: JSON.stringify(d) }),
  updateEmployee: (id, d) => req(`/employees/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
  deleteEmployee: (id) => req(`/employees/${id}`, { method: 'DELETE' }),

  // Attendance
  attendance: (p = {}) => req('/attendance?' + new URLSearchParams(p)),
  attendanceSummary: (month) => req(`/attendance/summary/${month}`),
  checkIn: (d) => req('/attendance/checkin', { method: 'POST', body: JSON.stringify(d) }),
  checkOut: (id, time) => req(`/attendance/${id}/checkout`, { method: 'PUT', body: JSON.stringify({ time }) }),
  createAttendance: (d) => req('/attendance', { method: 'POST', body: JSON.stringify(d) }),
  updateAttendance: (id, d) => req(`/attendance/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
  deleteAttendance: (id) => req(`/attendance/${id}`, { method: 'DELETE' }),

  // KPI
  kpi: (month) => req(`/kpi/${month}`),
  setKpiTargets: (d) => req('/kpi/targets', { method: 'PUT', body: JSON.stringify(d) }),

  // Meta
  metaConfig: () => req('/meta/config'),
  saveMetaConfig: (d) => req('/meta/config', { method: 'POST', body: JSON.stringify(d) }),
  metaStats: () => req('/meta/stats'),
  testCapi: (event_name) => req('/meta/test-capi', { method: 'POST', body: JSON.stringify({ event_name }) }),

  // Channels
  channels: () => req('/channels'),
  createChannel: (d) => req('/channels', { method: 'POST', body: JSON.stringify(d) }),
  updateChannel: (id, d) => req(`/channels/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
  deleteChannel: (id) => req(`/channels/${id}`, { method: 'DELETE' }),

  // Contacts
  contacts: (p = {}) => req('/contacts?' + new URLSearchParams(p)),

  // Conversations
  conversations: (p = {}) => req('/conversations?' + new URLSearchParams(p)).then(d => d.conversations || d),
  getConversation: (id) => req(`/conversations/${id}`),
  updateConversation: (id, d) => req(`/conversations/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
  createConversation: (d) => req('/conversations', { method: 'POST', body: JSON.stringify(d) }),
  deleteConversation: (id) => req(`/conversations/${id}`, { method: 'DELETE' }),
  syncChannel: (id) => req(`/channels/${id}/sync`, { method: 'POST' }),
  markRead: (id) => req(`/conversations/${id}/read`, { method: 'POST' }),

  // Messages
  messages: (convId) => req(`/conversations/${convId}/messages`),
  sendMessage: (convId, d) => req(`/conversations/${convId}/messages`, { method: 'POST', body: JSON.stringify(d) }),
  deleteMessage: (id) => req(`/messages/${id}`, { method: 'DELETE' }),

  // Quick Replies
  quickReplies: () => req('/quick-replies'),
  createQuickReply: (d) => req('/quick-replies', { method: 'POST', body: JSON.stringify(d) }),
  updateQuickReply: (id, d) => req(`/quick-replies/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
  deleteQuickReply: (id) => req(`/quick-replies/${id}`, { method: 'DELETE' }),
};
