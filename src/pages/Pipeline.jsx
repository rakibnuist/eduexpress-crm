/* Pipeline — sales kanban with drag-and-drop status changes.
   Drag a lead card from one column into another → updates lead_status
   server-side with optimistic UI + toast. KPI strip on top shows
   overall pipeline health at a glance. */
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api';
import Modal from '../components/Modal';
import LeadForm from './LeadForm';
import { useToast } from '../components/Toast';
import { Pencil, Phone, MapPin, User, Calendar, GripVertical, TrendingUp, Users, Bell, DollarSign, AlertCircle, Clock, Table as TableIcon, LayoutGrid } from 'lucide-react';
import { bdtToday } from '../lib/format';
import { fmtCreatedAt } from './Leads';
import { formatPhoneDisplay, getWAUrl, WA_TEMPLATES } from '../lib/phone';

const STAGES = [
  { status: 'New Lead',       hex: '#0ea5e9', col: 'bg-sky-500',     light: 'bg-sky-50',      ring: 'ring-sky-200' },
  { status: 'No Response',    hex: '#94a3b8', col: 'bg-slate-400',   light: 'bg-slate-50',    ring: 'ring-slate-200' },
  { status: 'Follow-up',      hex: '#f59e0b', col: 'bg-amber-500',   light: 'bg-amber-50',    ring: 'ring-amber-200' },
  { status: 'Positive',       hex: '#10b981', col: 'bg-emerald-500', light: 'bg-emerald-50',  ring: 'ring-emerald-200' },
  { status: 'Office Visited', hex: '#8b5cf6', col: 'bg-violet-500',  light: 'bg-violet-50',   ring: 'ring-violet-200' },
  { status: 'File Opened',    hex: '#3b82f6', col: 'bg-blue-500',    light: 'bg-blue-50',     ring: 'ring-blue-200' },
  { status: 'Enrolled',       hex: '#16a34a', col: 'bg-green-600',   light: 'bg-green-50',    ring: 'ring-green-200' },
  { status: 'Not Interested', hex: '#f87171', col: 'bg-red-400',     light: 'bg-red-50',      ring: 'ring-red-200' },
  { status: 'Documents Withdraw', hex: '#e11d48', col: 'bg-rose-600', light: 'bg-rose-50',    ring: 'ring-rose-200' },
  { status: 'Application Withdraw', hex: '#dc2626', col: 'bg-red-700', light: 'bg-red-50',    ring: 'ring-red-200' },
];

const todayISO = () => bdtToday();
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
    api.leads({ limit: 1000 }).then(d => {
      const grouped = {};
      STAGES.forEach(({ status }) => { grouped[status] = []; });
      (d.leads || []).forEach(l => {
        if (grouped[l.lead_status]) {
          grouped[l.lead_status].push(l);
        } else {
          grouped['New Lead'] = grouped['New Lead'] || [];
          grouped['New Lead'].push(l);
        }
      });
      setByStatus(grouped);
    }).catch(() => {});
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
      <div className="flex items-center justify-between flex-wrap gap-4 border-b border-slate-200/60 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-4 flex-wrap">
            <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">Sales Pipeline</h2>
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200/50 shadow-inner">
              <Link
                to="/leads"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold select-none text-slate-500 hover:text-slate-800 transition-colors"
              >
                <TableIcon size={13} />
                All Leads (Table)
              </Link>
              <Link
                to="/pipeline"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold select-none bg-white text-blue-600 shadow-sm font-bold scale-[1.02]"
              >
                <LayoutGrid size={13} />
                Pipeline (Kanban)
              </Link>
            </div>
          </div>
          <p className="text-sm text-slate-500">Drag cards between columns to move leads through the funnel</p>
        </div>
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
  const toast = useToast();
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
        <button onClick={onEdit} className="p-1 text-slate-300 hover:text-blue-500 flex-shrink-0 rounded-lg hover:bg-blue-50 opacity-0 group-hover:opacity-100 transition-opacity" aria-label="Edit">
          <Pencil size={12}/>
        </button>
      </div>

      <div className="mt-1.5 space-y-1">
        {l.phone && (
          <div className="flex items-center gap-1.5 text-[11px] text-slate-600 font-medium">
            <Phone size={11} className="text-slate-400 flex-shrink-0"/> {formatPhoneDisplay(l.phone, l.nationality)}
          </div>
        )}
        {l.destination && (
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <MapPin size={11} className="text-slate-400 flex-shrink-0"/> {l.destination}
          </div>
        )}

        {/* Academic Profile Badges */}
        {(l.last_education || l.degree || l.gpa || l.english_score) && (
          <div className="pt-0.5 flex flex-wrap items-center gap-1">
            {(l.last_education || l.degree) && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 capitalize">
                🎓 {(l.last_education || l.degree).replace(/_/g, ' ')}
              </span>
            )}
            {l.gpa && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                GPA {l.gpa}
              </span>
            )}
            {l.english_score && l.english_score !== 'optional' && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                🗣️ {l.english_score}
              </span>
            )}
          </div>
        )}

        {l.assigned_consultant && (
          <div className="flex items-center gap-1.5 text-[11px] text-blue-600 font-medium">
            <User size={11} className="flex-shrink-0"/> {l.assigned_consultant}
          </div>
        )}
        {(() => { const c = fmtCreatedAt(l); return c.date !== '—' && (
          <div className="flex items-center gap-1.5 text-[10px] text-slate-400" title="Lead created">
            <Clock size={10} className="text-slate-300 flex-shrink-0"/> {c.date}{c.time ? ` · ${c.time}` : ''}
          </div>
        ); })()}

        {/* 1-Click WhatsApp Quick Actions */}
        {l.phone && (
          <div className="pt-1.5 flex items-center justify-between gap-1.5 border-t border-slate-100/80 mt-1" onClick={e => e.stopPropagation()}>
            <a
              href={getWAUrl(l.phone, l.nationality, WA_TEMPLATES.initial(l))}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-[10.5px] border border-emerald-200 shadow-2xs transition-colors"
              title="1-Click WhatsApp greeting template"
            >
              <svg className="w-3 h-3 text-emerald-600 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
              </svg>
              <span>WA Chat</span>
            </a>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(WA_TEMPLATES.initial(l));
                  toast.success('WhatsApp greeting template copied!');
                }}
                className="text-[10px] text-slate-500 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 border border-slate-200/60 px-2 py-0.5 rounded font-medium transition-colors cursor-pointer"
                title="Copy greeting message to clipboard"
              >
                📋 Copy
              </button>
              <Link
                to={`/conversations?search=${encodeURIComponent(formatPhoneDisplay(l.phone, l.nationality).replace(/\D/g, ''))}`}
                className="text-[10px] text-blue-600 hover:underline font-semibold"
              >
                Inbox
              </Link>
            </div>
          </div>
        )}
      </div>

      {l.service_fee > 0 && (
        <div className="mt-2 flex items-center justify-between text-[11px]">
          <span className="text-slate-400 tabular-nums">{fmt(l.service_fee)}</span>
          {l.paid > 0 && <span className="text-emerald-600 font-medium tabular-nums">Paid {fmt(l.paid)}</span>}
        </div>
      )}

      {/* Call Notes / Status Notes Display */}
      {l.notes ? (
        <div className="mt-2 text-[11px] font-semibold text-slate-700 bg-amber-50/80 border border-amber-200/80 rounded-lg p-2 leading-relaxed" title={l.notes}>
          <span className="font-extrabold text-amber-800 mr-1">💬 Call Note:</span>
          {l.notes}
        </div>
      ) : (
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(e); }}
          className="mt-2 w-full text-left text-[10px] font-semibold text-slate-400 hover:text-blue-600 bg-slate-50 hover:bg-blue-50/60 border border-dashed border-slate-200 hover:border-blue-300 rounded-lg px-2 py-1 transition-all"
        >
          + Add call / status note...
        </button>
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
