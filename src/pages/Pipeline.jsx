import { useEffect, useState } from 'react';
import { api } from '../api';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import LeadForm from './LeadForm';
import { Pencil, Phone, MapPin, User, Calendar } from 'lucide-react';

const STAGES = [
  { status: 'New Lead',       color: 'bg-sky-500',     light: 'bg-sky-50 border-sky-200' },
  { status: 'No Response',    color: 'bg-slate-400',   light: 'bg-slate-50 border-slate-200' },
  { status: 'Positive',       color: 'bg-emerald-500', light: 'bg-emerald-50 border-emerald-200' },
  { status: 'Office Visited', color: 'bg-violet-500',  light: 'bg-violet-50 border-violet-200' },
  { status: 'File Opened',    color: 'bg-blue-500',    light: 'bg-blue-50 border-blue-200' },
  { status: 'Enrolled',       color: 'bg-green-600',   light: 'bg-green-50 border-green-200' },
  { status: 'Not Interested', color: 'bg-red-400',     light: 'bg-red-50 border-red-200' },
];

const today = new Date().toISOString().slice(0, 10);

export default function Pipeline() {
  const [byStatus, setByStatus] = useState({});
  const [settings, setSettings] = useState(null);
  const [editing, setEditing] = useState(null);
  const [expanded, setExpanded] = useState({});

  function load() {
    STAGES.forEach(({ status }) => {
      api.leads({ status, limit: 200 }).then(d => {
        setByStatus(prev => ({ ...prev, [status]: d.leads }));
      });
    });
  }

  useEffect(() => { load(); api.settings().then(setSettings); }, []);

  function toggleExpand(status) {
    setExpanded(e => ({ ...e, [status]: !e[status] }));
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Pipeline</h2>
        <p className="text-sm text-slate-500">Kanban view of all lead stages</p>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: '72vh' }}>
        {STAGES.map(({ status, color, light }) => {
          const leads = byStatus[status] || [];
          const dueTodayCount = leads.filter(l => l.next_followup === today).length;
          const isExpanded = expanded[status];
          const visibleLeads = isExpanded ? leads : leads.slice(0, 20);

          return (
            <div key={status} className="flex-shrink-0 w-64 flex flex-col rounded-2xl border border-slate-200 bg-white overflow-hidden">
              {/* Column header */}
              <div className={`${color} px-3 py-2.5`}>
                <div className="flex items-center justify-between">
                  <span className="text-white text-sm font-semibold">{status}</span>
                  <div className="flex items-center gap-1.5">
                    {dueTodayCount > 0 && (
                      <span className="bg-amber-400 text-amber-900 text-xs font-bold rounded-full px-1.5 py-0.5 flex items-center gap-0.5">
                        <Calendar size={10} /> {dueTodayCount}
                      </span>
                    )}
                    <span className="bg-white/25 text-white text-xs font-bold rounded-full px-2 py-0.5">{leads.length}</span>
                  </div>
                </div>
              </div>

              {/* Cards */}
              <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-slate-50/50">
                {visibleLeads.map(l => (
                  <LeadCard key={l.id} lead={l} light={light} onEdit={() => setEditing(l)} />
                ))}
                {leads.length > 20 && (
                  <button onClick={() => toggleExpand(status)}
                    className="w-full py-1.5 text-xs text-slate-400 hover:text-blue-600 transition-colors text-center">
                    {isExpanded ? '▲ Show less' : `▼ Show ${leads.length - 20} more`}
                  </button>
                )}
                {leads.length === 0 && (
                  <div className="py-8 text-center text-xs text-slate-300">No leads in this stage</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {editing && (
        <Modal title={`Edit Lead — ${editing.lead_id}`} onClose={() => setEditing(null)} wide>
          <LeadForm lead={editing} settings={settings} onSave={() => { setEditing(null); load(); }} />
        </Modal>
      )}
    </div>
  );
}

function LeadCard({ lead: l, light, onEdit }) {
  const isDueToday = l.next_followup === today;
  const isPastDue = l.next_followup && l.next_followup < today;

  return (
    <div className={`rounded-xl border p-2.5 transition-all hover:shadow-md hover:-translate-y-0.5 cursor-default
      ${isDueToday ? 'border-amber-300 bg-amber-50' : isPastDue ? 'border-red-200 bg-red-50/50' : `${light} bg-white`}`}>
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm text-slate-800 truncate">{l.client_name}</p>
          <p className="text-xs text-slate-500 font-mono">{l.lead_id}</p>
        </div>
        <button onClick={onEdit} className="p-1 text-slate-300 hover:text-blue-500 flex-shrink-0 rounded-lg hover:bg-blue-50 transition-colors">
          <Pencil size={12} />
        </button>
      </div>

      <div className="mt-2 space-y-1">
        {l.phone && (
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Phone size={11} className="text-slate-300 flex-shrink-0" /> {l.phone}
          </div>
        )}
        {l.destination && (
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <MapPin size={11} className="text-slate-300 flex-shrink-0" /> {l.destination}
            {l.last_education && <span className="text-slate-300">·</span>}
            {l.last_education && <span>{l.last_education}</span>}
          </div>
        )}
        {l.assigned_consultant && (
          <div className="flex items-center gap-1.5 text-xs text-blue-500">
            <User size={11} className="flex-shrink-0" /> {l.assigned_consultant}
          </div>
        )}
      </div>

      {l.service_fee > 0 && (
        <div className="mt-2 flex items-center justify-between text-xs">
          <span className="text-slate-400">৳{l.service_fee.toLocaleString()}</span>
          {l.paid > 0 && <span className="text-emerald-600 font-medium">Paid ৳{l.paid.toLocaleString()}</span>}
        </div>
      )}

      {l.next_followup && (
        <div className={`mt-2 flex items-center gap-1 text-xs font-medium rounded-lg px-2 py-1
          ${isDueToday ? 'bg-amber-100 text-amber-700' : isPastDue ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500'}`}>
          <Calendar size={11} />
          {isDueToday ? '📅 Follow-up TODAY' : isPastDue ? '⚠️ Overdue: ' + l.next_followup : l.next_followup}
        </div>
      )}

      {l.notes && (
        <p className="mt-1.5 text-xs text-slate-400 truncate italic" title={l.notes}>"{l.notes}"</p>
      )}
    </div>
  );
}
