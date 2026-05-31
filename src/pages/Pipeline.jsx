/* Pipeline — sales kanban with drag-and-drop status changes.
   Drag a lead card from one column into another → updates lead_status
   server-side with optimistic UI + toast. KPI strip on top shows
   overall pipeline health at a glance. */
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import Modal from '../components/Modal';
import LeadForm from './LeadForm';
import { useToast } from '../components/Toast';
import { Pencil, Phone, MapPin, User, Calendar, GripVertical, TrendingUp, Users, Bell, DollarSign, AlertCircle } from 'lucide-react';

const STAGES = [
  { status: 'New Lead',       hex: '#0ea5e9', col: 'bg-sky-500',     light: 'bg-sky-50',      ring: 'ring-sky-200' },
  { status: 'No Response',    hex: '#94a3b8', col: 'bg-slate-400',   light: 'bg-slate-50',    ring: 'ring-slate-200' },
  { status: 'Positive',       hex: '#10b981', col: 'bg-emerald-500', light: 'bg-emerald-50',  ring: 'ring-emerald-200' },
  { status: 'Office Visited', hex: '#8b5cf6', col: 'bg-violet-500',  light: 'bg-violet-50',   ring: 'ring-violet-200' },
  { status: 'File Opened',    hex: '#3b82f6', col: 'bg-blue-500',    light: 'bg-blue-50',     ring: 'ring-blue-200' },
  { status: 'Enrolled',       hex: '#16a34a', col: 'bg-green-600',   light: 'bg-green-50',    ring: 'ring-green-200' },
  { status: 'Not Interested', hex: '#f87171', col: 'bg-red-400',     light: 'bg-red-50',      ring: 'ring-red-200' },
];

const todayISO = () => new Date().toISOString().slice(0, 10);
const fmt = (n) => `৳${Number(n || 0).toLocaleString()}`;

export default function Pipeline() {
  const [byStatus, setByStatus] = useState({});
  const [settings, setSettings] = useState(null);
  const [editing, setEditing]   = useState(null);
  const [expanded, setExpanded] = useState({});
  const [dragging, setDragging] = useState(null);  // { lead, fromStatus }
  const [overCol, setOverCol]   = useState(null);
  const navigate = useNavigate();
  const toast = useToast();
  const today = todayISO();

  const load = useCallback(() => {
    STAGES.forEach(({ status }) => {
      api.leads({ status, limit: 200 })
        .then(d => setByStatus(prev => ({ ...prev, [status]: d.leads })))
        .catch(() => {});
    });
  }, []);
  useEffect(() => { load(); api.settings().then(setSettings).catch(() => {}); }, [load]);

  const toggleExpand = (status) => setExpanded(e => ({ ...e, [status]: !e[status] }));

  // ── KPIs across all stages ────────────────────────────────────
  const stats = useMemo(() => {
    const all = Object.values(byStatus).flat();
    const dueToday   = all.filter(l => l.next_followup === today).length;
    const overdue    = all.filter(l => l.next_followup && l.next_followup < today
                          && l.lead_status !== 'Enrolled' && l.lead_status !== 'Not Interested').length;
    const enrolled   = (byStatus['Enrolled'] || []).length;
    const total      = all.length;
    const open       = total - enrolled - (byStatus['Not Interested']||[]).length;
    const pipelineValue = all.reduce((s, l) => s + (l.service_fee || 0), 0);
    const conversionRate = total > 0 ? Math.round((enrolled / total) * 100) : 0;
    return { total, open, enrolled, dueToday, overdue, pipelineValue, conversionRate };
  }, [byStatus, today]);

  // ── Drag handlers ────────────────────────────────────────────
  const onDragStart = (lead, fromStatus) => setDragging({ lead, fromStatus });
  const onDragEnd   = () => { setDragging(null); setOverCol(null); };

  const onDrop = async (toStatus) => {
    const d = dragging;
    setDragging(null); setOverCol(null);
    if (!d || d.fromStatus === toStatus) return;
    // Optimistic UI: move the card immediately
    setByStatus(prev => {
      const fromList = (prev[d.fromStatus] || []).filter(x => x.id !== d.lead.id);
      const toList = [{ ...d.lead, lead_status: toStatus }, ...(prev[toStatus] || [])];
      return { ...prev, [d.fromStatus]: fromList, [toStatus]: toList };
    });
    try {
      await api.updateLead(d.lead.id, { ...d.lead, lead_status: toStatus });
      toast.success(`${d.lead.client_name} → ${toStatus}`);
    } catch (e) {
      toast.error(`Could not move: ${e.message || ''}`);
      load(); // revert by reloading
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Sales Pipeline</h2>
        <p className="text-sm text-slate-500">Drag cards between columns to move leads through the funnel</p>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Kpi icon={<Users size={16}/>}      label="Active in pipeline" value={stats.open.toLocaleString()} sub={`${stats.total} total`} color="blue" />
        <Kpi icon={<TrendingUp size={16}/>} label="Conversion rate"    value={`${stats.conversionRate}%`}  sub={`${stats.enrolled} enrolled`} color="emerald" />
        <Kpi icon={<DollarSign size={16}/>} label="Pipeline value"     value={fmt(stats.pipelineValue)} color="violet" />
        <Kpi icon={<Bell size={16}/>}       label="Follow-ups today"   value={stats.dueToday} color={stats.dueToday > 0 ? 'amber' : 'slate'} />
        <Kpi icon={<AlertCircle size={16}/>} label="Overdue"           value={stats.overdue}  color={stats.overdue > 0 ? 'rose' : 'slate'} />
      </div>

      {/* Kanban */}
      <div className="flex gap-3 overflow-x-auto pb-4 -mx-2 px-2" style={{ minHeight: '64vh' }}>
        {STAGES.map(({ status, col, light, ring }) => {
          const leads = byStatus[status] || [];
          const dueTodayCount = leads.filter(l => l.next_followup === today).length;
          const totalValue   = leads.reduce((s, l) => s + (l.service_fee || 0), 0);
          const isExpanded = expanded[status];
          const visible = isExpanded ? leads : leads.slice(0, 20);
          const isOver = overCol === status;
          const isSource = dragging?.fromStatus === status;

          return (
            <div key={status}
              onDragOver={(e) => { e.preventDefault(); setOverCol(status); }}
              onDragLeave={() => setOverCol(p => p === status ? null : p)}
              onDrop={() => onDrop(status)}
              className={`flex-shrink-0 w-72 flex flex-col rounded-2xl border bg-white overflow-hidden transition-all
                ${isOver ? `ring-4 ${ring} border-current scale-[1.01]` : 'border-slate-200'}
                ${isSource ? 'opacity-60' : ''}`}>
              {/* Column header — colored bar */}
              <div className={`${col} px-3 py-2.5`}>
                <div className="flex items-center justify-between">
                  <span className="text-white text-sm font-semibold">{status}</span>
                  <div className="flex items-center gap-1.5">
                    {dueTodayCount > 0 && (
                      <span className="bg-amber-400 text-amber-900 text-[10px] font-bold rounded-full px-1.5 py-0.5 flex items-center gap-0.5">
                        <Calendar size={10}/> {dueTodayCount}
                      </span>
                    )}
                    <span className="bg-white/25 text-white text-xs font-bold rounded-full px-2 py-0.5">{leads.length}</span>
                  </div>
                </div>
                {totalValue > 0 && (
                  <p className="text-[10px] text-white/80 mt-0.5">Value: <strong>{fmt(totalValue)}</strong></p>
                )}
              </div>

              {/* Card column */}
              <div className={`flex-1 overflow-y-auto p-2 space-y-2 ${light}/30 min-h-[120px]`}>
                {visible.map(l => (
                  <LeadCard key={l.id} lead={l}
                    onEdit={(e) => { e.stopPropagation(); setEditing(l); }}
                    onOpen={() => navigate(`/leads/${l.id}`)}
                    onDragStart={() => onDragStart(l, status)}
                    onDragEnd={onDragEnd}
                    isDraggingSelf={dragging?.lead?.id === l.id} />
                ))}
                {leads.length > 20 && (
                  <button onClick={() => toggleExpand(status)}
                    className="w-full py-1.5 text-xs text-slate-500 hover:text-blue-600 transition-colors text-center rounded-lg hover:bg-white">
                    {isExpanded ? '▲ Show less' : `▼ Show ${leads.length - 20} more`}
                  </button>
                )}
                {leads.length === 0 && !dragging && (
                  <div className="py-10 text-center text-xs text-slate-300 border-2 border-dashed border-slate-200 rounded-xl">
                    Drag a lead here
                  </div>
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

function Kpi({ icon, label, value, sub, color }) {
  const palette = {
    blue:    'bg-blue-50 text-blue-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    violet:  'bg-violet-50 text-violet-600',
    amber:   'bg-amber-50 text-amber-600',
    rose:    'bg-rose-50 text-rose-600',
    slate:   'bg-slate-50 text-slate-500',
  };
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-3.5 flex items-start gap-2.5">
      <div className={`p-2 rounded-lg ${palette[color]}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-slate-500 font-medium">{label}</p>
        <p className="text-xl font-bold text-slate-800 leading-tight">{value}</p>
        {sub && <p className="text-[11px] text-slate-400">{sub}</p>}
      </div>
    </div>
  );
}

function LeadCard({ lead: l, onEdit, onOpen, onDragStart, onDragEnd, isDraggingSelf }) {
  const today = todayISO();
  const isDueToday = l.next_followup === today;
  const isPastDue  = l.next_followup && l.next_followup < today;

  return (
    <div draggable
      onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; onDragStart(); }}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      className={`group relative rounded-xl border p-2.5 transition-all bg-white hover:shadow-md hover:-translate-y-0.5 cursor-pointer
        ${isDueToday ? 'border-amber-300 bg-amber-50/50'
          : isPastDue ? 'border-red-200 bg-red-50/30'
          : 'border-slate-100 hover:border-blue-200'}
        ${isDraggingSelf ? 'opacity-40 rotate-1 scale-95' : ''}`}>
      {/* Grip handle visual */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-30 text-slate-400 pointer-events-none">
        <GripVertical size={12} />
      </div>

      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0 flex-1 pr-4">
          <p className="font-semibold text-sm text-slate-800 truncate">{l.client_name}</p>
          <p className="text-[11px] text-slate-400 font-mono">{l.lead_id}</p>
        </div>
        <button onClick={onEdit} className="p-1 text-slate-300 hover:text-blue-500 flex-shrink-0 rounded-lg hover:bg-blue-50 opacity-0 group-hover:opacity-100 transition-opacity">
          <Pencil size={12}/>
        </button>
      </div>

      <div className="mt-1.5 space-y-0.5">
        {l.phone && (
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <Phone size={10} className="text-slate-300 flex-shrink-0"/> {l.phone}
          </div>
        )}
        {l.destination && (
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <MapPin size={10} className="text-slate-300 flex-shrink-0"/> {l.destination}
            {l.last_education && <span className="text-slate-300">·</span>}
            {l.last_education && <span className="truncate">{l.last_education}</span>}
          </div>
        )}
        {l.assigned_consultant && (
          <div className="flex items-center gap-1.5 text-[11px] text-blue-500">
            <User size={10} className="flex-shrink-0"/> {l.assigned_consultant}
          </div>
        )}
      </div>

      {l.service_fee > 0 && (
        <div className="mt-2 flex items-center justify-between text-[11px]">
          <span className="text-slate-400 tabular-nums">{fmt(l.service_fee)}</span>
          {l.paid > 0 && <span className="text-emerald-600 font-medium tabular-nums">Paid {fmt(l.paid)}</span>}
        </div>
      )}

      {l.next_followup && (
        <div className={`mt-1.5 flex items-center gap-1 text-[10px] font-semibold rounded-md px-2 py-0.5
          ${isDueToday ? 'bg-amber-100 text-amber-700' : isPastDue ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500'}`}>
          <Calendar size={10}/>
          {isDueToday ? 'Follow-up TODAY' : isPastDue ? `Overdue · ${l.next_followup}` : l.next_followup}
        </div>
      )}
    </div>
  );
}
