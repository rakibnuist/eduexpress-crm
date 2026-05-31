/* Pipeline — sales kanban with drag-and-drop status changes.
   Drag a lead card from one column into another → updates lead_status
   server-side with optimistic UI + toast. KPI strip on top shows
   overall pipeline health at a glance. Includes full search, filters,
   and dynamic card value calculations. */
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import Modal from '../components/Modal';
import LeadForm from './LeadForm';
import { useToast } from '../components/Toast';
import { 
  Pencil, Phone, MapPin, User, Calendar, GripVertical, TrendingUp, 
  Users, Bell, DollarSign, AlertCircle, Search, X, Filter, Globe,
  CalendarDays
} from 'lucide-react';

const STAGES = [
  { status: 'New Lead',       hex: '#0ea5e9', col: 'bg-sky-500',     border: 'border-sky-500',     light: 'bg-sky-50',      ring: 'ring-sky-200/50' },
  { status: 'No Response',    hex: '#94a3b8', col: 'bg-slate-400',   border: 'border-slate-400',   light: 'bg-slate-50',    ring: 'ring-slate-200/50' },
  { status: 'Positive',       hex: '#10b981', col: 'bg-emerald-500', border: 'border-emerald-500', light: 'bg-emerald-50',  ring: 'ring-emerald-200/50' },
  { status: 'Office Visited', hex: '#8b5cf6', col: 'bg-violet-500',  border: 'border-violet-500',  light: 'bg-violet-50',   ring: 'ring-violet-200/50' },
  { status: 'File Opened',    hex: '#3b82f6', col: 'bg-blue-500',    border: 'border-blue-500',    light: 'bg-blue-50',     ring: 'ring-blue-200/50' },
  { status: 'Enrolled',       hex: '#16a34a', col: 'bg-green-600',   border: 'border-green-600',   light: 'bg-green-50',    ring: 'ring-green-200/50' },
  { status: 'Not Interested', hex: '#f87171', col: 'bg-red-400',     border: 'border-red-400',     light: 'bg-red-50',      ring: 'ring-red-200/50' },
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

  // Search and Filter States
  const [search, setSearch]           = useState('');
  const [consultant, setConsultant]   = useState('');
  const [destination, setDestination] = useState('');
  const [followup, setFollowup]       = useState('all'); // 'all', 'today', 'overdue'

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

  useEffect(() => {
    load();
    api.settings().then(setSettings).catch(() => {});
  }, [load]);

  const toggleExpand = (status) => setExpanded(e => ({ ...e, [status]: !e[status] }));

  // Dynamic filter function applied in-memory for instant visual responsiveness
  const getFilteredLeads = useCallback((leadsList) => {
    return (leadsList || []).filter(l => {
      if (search) {
        const q = search.toLowerCase();
        const nameMatch = (l.client_name || '').toLowerCase().includes(q);
        const idMatch = (l.lead_id || '').toLowerCase().includes(q);
        const phoneMatch = (l.phone || '').toLowerCase().includes(q);
        const destMatch = (l.destination || '').toLowerCase().includes(q);
        const consultantMatch = (l.assigned_consultant || '').toLowerCase().includes(q);
        if (!nameMatch && !idMatch && !phoneMatch && !destMatch && !consultantMatch) return false;
      }
      if (consultant && l.assigned_consultant !== consultant) return false;
      if (destination && l.destination !== destination) return false;
      
      if (followup === 'today' && l.next_followup !== today) return false;
      if (followup === 'overdue') {
        const isPastDue = l.next_followup && l.next_followup < today && l.lead_status !== 'Enrolled' && l.lead_status !== 'Not Interested';
        if (!isPastDue) return false;
      }
      return true;
    });
  }, [search, consultant, destination, followup, today]);

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

  // Total matching cards across the entire board (for visual feedback)
  const totalFilteredCount = useMemo(() => {
    return Object.values(byStatus).reduce((acc, list) => acc + getFilteredLeads(list).length, 0);
  }, [byStatus, getFilteredLeads]);

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

  const isFilterActive = search || consultant || destination || followup !== 'all';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Sales Pipeline</h2>
          <p className="text-sm text-slate-500">Drag cards between columns to move leads through the sales pipeline</p>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        <Kpi icon={<Users size={18}/>}      label="Active in Funnel" value={stats.open.toLocaleString()} sub={`${stats.total} total leads`} color="blue" />
        <Kpi icon={<TrendingUp size={18}/>} label="Conversion Rate"    value={`${stats.conversionRate}%`}  sub={`${stats.enrolled} enrolled`} color="emerald" />
        <Kpi icon={<DollarSign size={18}/>} label="Pipeline Value"     value={fmt(stats.pipelineValue)} color="violet" />
        <Kpi icon={<Bell size={18}/>}       label="Due Follow-ups"   value={stats.dueToday} color={stats.dueToday > 0 ? 'amber' : 'slate'} />
        <Kpi icon={<AlertCircle size={18}/>} label="Overdue Follow-ups"           value={stats.overdue}  color={stats.overdue > 0 ? 'rose' : 'slate'} />
      </div>

      {/* Advanced Glassmorphic Search & Filters Bar */}
      <div className="sticky top-0 z-20 bg-slate-50/95 backdrop-blur-md -mx-4 lg:-mx-6 px-4 lg:px-6 py-2 border-b border-slate-200/80">
        <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-sm flex flex-wrap gap-2.5 items-center">
          <div className="relative flex-1 min-w-[260px]">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              className="pl-10 pr-9 py-2 bg-slate-50 border border-slate-200/80 rounded-xl text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all placeholder:text-slate-400"
              placeholder="Search leads by name, ID, phone, or destination..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button 
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-200 transition-colors"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            {settings && (
              <>
                {/* Consultant Filter */}
                <div className="relative">
                  <select
                    value={consultant}
                    onChange={e => setConsultant(e.target.value)}
                    className={`pl-8 pr-3 py-2 border rounded-xl text-sm bg-white transition-all cursor-pointer focus:ring-2 focus:ring-blue-100
                      ${consultant ? 'border-blue-300 text-blue-700 font-medium' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}
                  >
                    <option value="">All Consultants</option>
                    {settings.consultants.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <User size={13} className={`absolute left-2.5 top-1/2 -translate-y-1/2 ${consultant ? 'text-blue-500' : 'text-slate-400'}`} />
                </div>

                {/* Destination Filter */}
                <div className="relative">
                  <select
                    value={destination}
                    onChange={e => setDestination(e.target.value)}
                    className={`pl-8 pr-3 py-2 border rounded-xl text-sm bg-white transition-all cursor-pointer focus:ring-2 focus:ring-blue-100
                      ${destination ? 'border-blue-300 text-blue-700 font-medium' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}
                  >
                    <option value="">All Destinations</option>
                    {settings.destinations.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                  <Globe size={13} className={`absolute left-2.5 top-1/2 -translate-y-1/2 ${destination ? 'text-blue-500' : 'text-slate-400'}`} />
                </div>
              </>
            )}

            {/* Follow-up Filter */}
            <div className="relative">
              <select
                value={followup}
                onChange={e => setFollowup(e.target.value)}
                className={`pl-8 pr-3 py-2 border rounded-xl text-sm bg-white transition-all cursor-pointer focus:ring-2 focus:ring-blue-100
                  ${followup !== 'all' ? 'border-amber-400 text-amber-800 font-medium' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}
              >
                <option value="all">All Follow-ups</option>
                <option value="today">Due Today</option>
                <option value="overdue">Overdue Only</option>
              </select>
              <CalendarDays size={13} className={`absolute left-2.5 top-1/2 -translate-y-1/2 ${followup !== 'all' ? 'text-amber-500' : 'text-slate-400'}`} />
            </div>

            {/* Clear All Button */}
            {isFilterActive && (
              <button
                onClick={() => {
                  setSearch('');
                  setConsultant('');
                  setDestination('');
                  setFollowup('all');
                }}
                className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-rose-600 px-3 py-2 rounded-xl hover:bg-rose-50 transition-all font-semibold"
              >
                <X size={14} /> Clear all filters
              </button>
            )}
          </div>
        </div>

        {/* Dynamic results bar */}
        {isFilterActive && (
          <div className="mt-2.5 flex items-center justify-between text-xs text-slate-500 px-1">
            <span>
              Showing <strong>{totalFilteredCount}</strong> matching leads based on active search/filters
            </span>
          </div>
        )}
      </div>

      {/* Kanban Board */}
      <div className="flex gap-4 overflow-x-auto pb-5 -mx-2 px-2" style={{ minHeight: '66vh' }}>
        {STAGES.map(({ status, col, border, light, ring }) => {
          const rawLeads = byStatus[status] || [];
          const leads = getFilteredLeads(rawLeads);
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
              className={`flex-shrink-0 w-[310px] flex flex-col rounded-2xl border bg-slate-50/50 shadow-sm transition-all duration-200
                ${isOver ? `ring-4 ${ring} ${border} bg-white scale-[1.01] shadow-md` : 'border-slate-200/80'}
                ${isSource ? 'opacity-50 border-dashed bg-slate-100/50' : ''}`}>
              
              {/* Column Top Accent Line */}
              <div className={`h-1.5 w-full ${col}`} />

              {/* Column Header */}
              <div className="px-4 py-3 bg-white border-b border-slate-100 flex flex-col">
                <div className="flex items-center justify-between">
                  <span className="text-slate-800 text-[14px] font-bold tracking-tight">{status}</span>
                  <div className="flex items-center gap-1.5">
                    {dueTodayCount > 0 && (
                      <span className="bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-bold rounded-full px-1.5 py-0.5 flex items-center gap-0.5" title="Follow-ups due today">
                        <Calendar size={10} className="text-amber-600"/> {dueTodayCount}
                      </span>
                    )}
                    <span className="bg-slate-100 text-slate-600 border border-slate-200 text-xs font-bold rounded-full px-2 py-0.5">{leads.length}</span>
                  </div>
                </div>
                {totalValue > 0 && (
                  <p className="text-[11px] text-slate-400 font-medium mt-1">Est. Value: <strong className="text-slate-600 font-bold tabular-nums">{fmt(totalValue)}</strong></p>
                )}
              </div>

              {/* Card List area */}
              <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5 min-h-[140px]">
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
                    className="w-full py-2 text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors text-center rounded-xl bg-white border border-slate-200/60 hover:border-blue-200 shadow-sm block">
                    {isExpanded ? '▲ Hide extra cards' : `▼ Show ${leads.length - 20} more`}
                  </button>
                )}

                {leads.length === 0 && (
                  <div className="py-14 text-center text-xs text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl bg-white shadow-sm flex flex-col items-center justify-center p-4">
                    <Filter size={18} className="text-slate-300 mb-2" />
                    <p className="font-semibold text-slate-600">No leads</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Drag cards here or adjust search filters</p>
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
    blue:    'bg-blue-50 text-blue-600 border border-blue-100',
    emerald: 'bg-emerald-50 text-emerald-600 border border-emerald-100',
    violet:  'bg-violet-50 text-violet-600 border border-violet-100',
    amber:   'bg-amber-50 text-amber-600 border border-amber-100',
    rose:    'bg-rose-50 text-rose-600 border border-rose-100',
    slate:   'bg-slate-50 text-slate-500 border border-slate-100',
  };
  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-4 flex items-start gap-3 shadow-sm hover:shadow transition-shadow">
      <div className={`p-2.5 rounded-xl flex-shrink-0 ${palette[color]}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">{label}</p>
        <p className="text-xl font-extrabold text-slate-800 leading-tight mt-0.5">{value}</p>
        {sub && <p className="text-[11px] text-slate-400 mt-0.5 truncate">{sub}</p>}
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
      className={`group relative rounded-2xl border p-3.5 transition-all bg-white hover:shadow-md cursor-pointer hover:border-slate-300
        ${isDueToday ? 'border-amber-300 bg-amber-50/20 ring-1 ring-amber-200'
          : isPastDue ? 'border-rose-200 bg-rose-50/10 ring-1 ring-rose-100'
          : 'border-slate-100'}
        ${isDraggingSelf ? 'opacity-30 rotate-1 scale-95 border-dashed border-blue-400' : ''}`}
      style={{ contentVisibility: 'auto' }}>
      
      {/* Grip handle visual */}
      <div className="absolute top-3.5 right-3 opacity-0 group-hover:opacity-40 text-slate-400 transition-opacity pointer-events-none">
        <GripVertical size={13} />
      </div>

      <div className="flex items-start justify-between gap-1.5">
        <div className="min-w-0 flex-1 pr-3">
          <p className="font-bold text-slate-800 text-sm group-hover:text-blue-600 transition-colors truncate">{l.client_name}</p>
          <p className="text-[10px] text-slate-400 font-mono font-semibold mt-0.5">{l.lead_id}</p>
        </div>
        <button onClick={onEdit} className="p-1.5 text-slate-400 hover:text-blue-600 flex-shrink-0 rounded-lg hover:bg-blue-50 opacity-0 group-hover:opacity-100 transition-all">
          <Pencil size={12}/>
        </button>
      </div>

      <div className="mt-2 space-y-1">
        {l.phone && (
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
            <Phone size={11} className="text-slate-400 flex-shrink-0"/> {l.phone}
          </div>
        )}
        {l.destination && (
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium truncate">
            <MapPin size={11} className="text-slate-400 flex-shrink-0"/> 
            <span>{l.destination}</span>
            {l.last_education && <span className="text-slate-300">·</span>}
            {l.last_education && <span className="text-slate-400 font-semibold">{l.last_education}</span>}
          </div>
        )}
        {l.assigned_consultant && (
          <div className="flex items-center gap-1.5 text-[11px] text-blue-600 font-semibold bg-blue-50/50 px-2 py-0.5 rounded-lg w-fit mt-1 border border-blue-100/50">
            <User size={10} className="flex-shrink-0"/> {l.assigned_consultant}
          </div>
        )}
      </div>

      {l.service_fee > 0 && (
        <div className="mt-2.5 pt-2.5 border-t border-slate-50 flex items-center justify-between text-[11px] font-semibold">
          <span className="text-slate-400 tabular-nums">{fmt(l.service_fee)}</span>
          {l.paid > 0 ? (
            <span className="text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100 tabular-nums">Paid {fmt(l.paid)}</span>
          ) : (
            <span className="text-slate-400 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-100">Unpaid</span>
          )}
        </div>
      )}

      {l.next_followup && (
        <div className={`mt-2 flex items-center gap-1.5 text-[10px] font-bold rounded-lg px-2.5 py-1 border
          ${isDueToday ? 'bg-amber-50 text-amber-800 border-amber-200' : isPastDue ? 'bg-rose-50 text-rose-800 border-rose-200' : 'bg-slate-50 text-slate-600 border-slate-100'}`}>
          <Calendar size={11} className={isDueToday ? 'text-amber-600 animate-pulse' : isPastDue ? 'text-rose-500' : 'text-slate-400'}/>
          {isDueToday ? 'Follow-up TODAY' : isPastDue ? `Overdue · ${l.next_followup}` : `Follow-up: ${l.next_followup}`}
        </div>
      )}
    </div>
  );
}
