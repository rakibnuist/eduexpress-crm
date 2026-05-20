import { useState } from 'react';
import { api } from '../api';

const FIELDS = [
  ['client_name', 'Client Name', 'text', true],
  ['phone', 'Phone', 'text', true],
  ['email', 'Email', 'email'],
  ['date_added', 'Date Added', 'date'],
  ['destination', 'Destination', 'select:destinations'],
  ['last_education', 'Last Education', 'text'],
  ['gpa', 'GPA/CGPA', 'number'],
  ['english_score', 'English Score', 'text'],
  ['program', 'Program', 'text'],
  ['lead_source', 'Lead Source', 'select:leadSources'],
  ['lead_status', 'Lead Status', 'select:leadStatuses'],
  ['assigned_consultant', 'Consultant', 'select:consultants'],
  ['service_fee', 'Service Fee (BDT)', 'number'],
  ['paid', 'Paid (BDT)', 'number'],
  ['payment_status', 'Payment Status', 'select:paymentStatuses'],
  ['next_followup', 'Next Follow-up', 'date'],
  ['notes', 'Notes', 'textarea'],
];

export default function LeadForm({ lead, settings, onSave }) {
  const [form, setForm] = useState(lead ? {
    ...lead, gpa: lead.gpa || '', service_fee: lead.service_fee || '',
    paid: lead.paid || '', phone: lead.phone || ''
  } : { lead_status: 'New Lead', date_added: new Date().toISOString().slice(0, 10) });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (lead) await api.updateLead(lead.id, form);
      else await api.createLead(form);
      onSave();
    } finally { setSaving(false); }
  }

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {FIELDS.map(([key, label, type, required]) => {
        const val = form[key] ?? '';
        if (type === 'textarea') return (
          <div key={key} className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
            <textarea className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none" rows={3}
              value={val} onChange={e => set(key, e.target.value)} />
          </div>
        );
        if (type.startsWith('select:')) {
          const optKey = type.replace('select:', '');
          const opts = settings?.[optKey] || [];
          return (
            <div key={key}>
              <label className="block text-xs font-medium text-slate-600 mb-1">{label}{required && ' *'}</label>
              <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white" value={val} onChange={e => set(key, e.target.value)} required={required}>
                <option value="">— select —</option>
                {opts.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
          );
        }
        return (
          <div key={key}>
            <label className="block text-xs font-medium text-slate-600 mb-1">{label}{required && ' *'}</label>
            <input type={type} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" value={val}
              onChange={e => set(key, e.target.value)} required={required} step={type === 'number' ? 'any' : undefined} />
          </div>
        );
      })}
      <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
        <button type="submit" disabled={saving}
          className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-60">
          {saving ? 'Saving…' : lead ? 'Update Lead' : 'Add Lead'}
        </button>
      </div>
    </form>
  );
}
