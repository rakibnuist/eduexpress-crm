import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import LeadForm from './LeadForm';
import { useToast } from '../components/Toast';
import { 
  Plus, Search, Trash2, Pencil, ChevronLeft, ChevronRight, Download, X,
  LayoutGrid, Table as TableIcon, GripVertical, Phone, MapPin, User,
  Calendar, DollarSign, Filter, Globe, CalendarDays, AlertCircle, CheckCircle2, XCircle, Building2, FolderOpen
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

const fmt = (n) => `৳${Number(n || 0).toLocaleString()}`;

export default function Leads({ user }) {
  useEffect(() => { document.title = "Leads & Pipeline | EduExpress Core"; }, []);

  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState({ leads: [], total: 0, pages: 1 });
  const [settings, setSettings] = useState(null);
  const [stages, setStages] = useState([]);
  
  // Kanban board state
  const [byStatus, setByStatus] = useState({});
  const [dragging, setDragging] = useState(null);  // { lead, fromStatus }
  const [overCol, setOverCol]   = useState(null);
  const [expanded, setExpanded] = useState({});

  // View state: table or kanban
  const [view, setView] = useState(() => {
    const urlView = searchParams.get('view');
    if (urlView === 'kanban' || urlView === 'table') return urlView;
    return localStorage.getItem('leads_view') || 'table';
  });

  const [filters, setFilters] = useState({
    search: '',
    status: searchParams.get('status') || '',
    consultant: '',
    destination: '',
    page: 1,
  });

  const [modal, setModal] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const searchRef = useRef();
  const navigate = useNavigate();
  const toast = useToast();
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  useEffect(() => {
    localStorage.setItem('leads_view', view);
    // Sync URL search param
    const currentParams = Object.fromEntries(searchParams);
    if (currentParams.view !== view) {
      setSearchParams({ ...currentParams, view });
    }
  }, [view, searchParams, setSearchParams]);

  // Load Table Leads or Kanban Leads depending on active view
  const load = useCallback(() => {
    if (view === 'table') {
      const p = { limit: 50 };
      if (filters.search) p.search = filters.search;
      if (filters.status) p.status = filters.status;
      if (filters.consultant) p.consultant = filters.consultant;
      if (filters.destination) p.destination = filters.destination;
      p.page = filters.page;
      api.leads(p).then(setData).catch(() => {});
    } else {
      // In Kanban view, fetch a larger subset of leads to populate all columns instantly
      const p = { limit: 500 };
      if (filters.search) p.search = filters.search;
      if (filters.consultant) p.consultant = filters.consultant;
      if (filters.destination) p.destination = filters.destination;
      api.leads(p).then(d => {
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
        // Also update data total for visual count
        setData(prev => ({ ...prev, total: d.total }));
      }).catch(() => {});
    }
  }, [filters, view]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    api.settings().then(setSettings).catch(() => {});
    api.applicationMeta().then(d => setStages(d.stages)).catch(() => {});
  }, []);

  const handleSetView = (v) => {
    setView(v);
    if (v === 'kanban') {
      setFilters(f => ({ ...f, status: '', page: 1 }));
    }
  };

  function setFilter(key, val) {
    setFilters(f => ({ ...f, [key]: val, page: 1 }));
  }

  const activeFilters = [filters.status, filters.consultant, filters.destination].filter(Boolean).length;

  async function handleDelete(id) {
    try {
      await api.deleteLead(id);
      setDeleting(null);
      load();
      toast.success('Lead deleted');
    } catch (e) { toast.error(e.message || 'Could not delete'); }
  }

  function exportCSV() {
    const list = view === 'kanban' ? Object.values(byStatus).flat() : data.leads;
    const headers = ['Lead ID', 'Name', 'Phone', 'Email', 'Destination', 'Education', 'GPA', 'English', 'Program', 'Source', 'Status', 'Consultant', 'Fee', 'Paid', 'Balance', 'Payment', 'Follow-up', 'Notes'];
    const rows = list.map(l => [
      l.lead_id, l.client_name, l.phone, l.email, l.destination, l.last_education, l.gpa, l.english_score,
      l.program, l.lead_source, l.lead_status, l.assigned_consultant, l.service_fee, l.paid, l.balance,
      l.payment_status, l.next_followup, (l.notes || '').replace(/,/g, ';')
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = `leads_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  const stats = useMemo(() => {
    const list = view === 'kanban' ? Object.values(byStatus).flat() : data.leads || [];
    const pageFee = list.reduce((acc, curr) => acc + (curr.service_fee || 0), 0);
    const pagePaid = list.reduce((acc, curr) => acc + (curr.paid || 0), 0);
    const pageBalance = list.reduce((acc, curr) => acc + (curr.balance || 0), 0);
    const dueToday = list.filter(l => l.next_followup === today).length;
    return { pageFee, pagePaid, pageBalance, dueToday };
  }, [data.leads, byStatus, today, view]);

  // ── Drag and Drop columns handlers ─────────────────────────────
  const onDragStart = (lead, fromStatus) => setDragging({ lead, fromStatus });
  const onDragEnd   = () => { setDragging(null); setOverCol(null); };

  const onDrop = async (toStatus) => {
    const d = dragging;
    setDragging(null); setOverCol(null);
    if (!d || d.fromStatus === toStatus) return;
    
    // Optimistic UI updates
    setByStatus(prev => {
      const fromList = (prev[d.fromStatus] || []).filter(x => x.id !== d.lead.id);
      const toList = [{ ...d.lead, lead_status: toStatus }, ...(prev[toStatus] || [])];
      return { ...prev, [d.fromStatus]: fromList, [toStatus]: toList };
    });

    try {
      await api.updateLead(d.lead.id, { ...d.lead, lead_status: toStatus });
      toast.success(`Moved ${d.lead.client_name} → ${toStatus}`);
    } catch (e) {
      toast.error(`Failed to move: ${e.message || ''}`);
      load(); // revert
    }
  };

  const toggleExpand = (status) => setExpanded(e => ({ ...e, [status]: !e[status] }));

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Leads & Sales Pipeline</h2>
          <p className="text-sm text-slate-500">{data.total.toLocaleString()} total active records</p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Visual switcher toggle */}
          <div className="flex gap-1.5 bg-slate-200/60 p-1 rounded-xl shadow-inner">
            <button
              onClick={() => handleSetView('table')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 select-none cursor-pointer ${
                view === 'table' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <TableIcon size={13} /> Table View
            </button>
            <button
              onClick={() => handleSetView('kanban')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 select-none cursor-pointer ${
                view === 'kanban' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <LayoutGrid size={13} /> Pipeline Board
            </button>
          </div>

          <div className="flex gap-2">
            <button onClick={exportCSV} className="flex items-center gap-1.5 px-3.5 py-2 border border-slate-200 bg-white rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors shadow-sm select-none cursor-pointer">
              <Download size={15} /> Export CSV
            </button>
            <button onClick={() => setModal('add')} className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm select-none cursor-pointer">
              <Plus size={15} /> Add Lead
            </button>
          </div>
        </div>
      </div>

      {/* Page-level dynamic summary strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm hover:shadow transition-shadow">
          <p className="text-[11px] uppercase tracking-wider font-bold text-slate-400">Total Fees ({view === 'kanban' ? 'Pipeline' : 'Page'})</p>
          <p className="text-lg font-extrabold text-slate-850 leading-tight mt-1">৳{stats.pageFee.toLocaleString()}</p>
        </div>
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm hover:shadow transition-shadow">
          <p className="text-[11px] uppercase tracking-wider font-bold text-slate-400">Collected ({view === 'kanban' ? 'Pipeline' : 'Page'})</p>
          <p className="text-lg font-extrabold text-emerald-600 leading-tight mt-1">৳{stats.pagePaid.toLocaleString()}</p>
        </div>
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm hover:shadow transition-shadow">
          <p className="text-[11px] uppercase tracking-wider font-bold text-slate-400">Balance Due ({view === 'kanban' ? 'Pipeline' : 'Page'})</p>
          <p className="text-lg font-extrabold text-rose-500 leading-tight mt-1">৳{stats.pageBalance.toLocaleString()}</p>
        </div>
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm hover:shadow transition-shadow">
          <p className="text-[11px] uppercase tracking-wider font-bold text-slate-400">Due Follow-ups ({view === 'kanban' ? 'Pipeline' : 'Page'})</p>
          <p className="text-lg font-extrabold text-amber-650 leading-tight mt-1">{stats.dueToday} leads</p>
        </div>
      </div>

      {/* Search + Filters bar (sticky) */}
      <div className="sticky top-0 z-20 bg-slate-50/95 backdrop-blur-md -mx-4 lg:-mx-6 px-4 lg:px-6 py-2 border-b border-slate-200/80">
        <div className="bg-white border border-slate-200 rounded-2xl p-2.5 shadow-sm flex flex-wrap gap-2.5 items-center">
          <div className="relative flex-1 min-w-48">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input ref={searchRef}
              className="pl-10 pr-9 py-2 bg-slate-50 border border-slate-200/80 rounded-xl text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all placeholder:text-slate-400"
              placeholder="Search leads by name, phone, ID, email..."
              value={filters.search}
              onChange={e => setFilter('search', e.target.value)} />
            {filters.search && (
              <button onClick={() => setFilter('search', '')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-200 transition-all">
                <X size={13} />
              </button>
            )}
          </div>
          {/* Inline filter dropdowns */}
          {settings && (
            <div className="flex flex-wrap gap-2">
              {view === 'table' && (
                <FilterSelect value={filters.status} onChange={v => setFilter('status', v)} options={settings.leadStatuses} placeholder="All Statuses" />
              )}
              <FilterSelect value={filters.consultant} onChange={v => setFilter('consultant', v)} options={settings.consultants} placeholder="All Consultants" />
              <FilterSelect value={filters.destination} onChange={v => setFilter('destination', v)} options={settings.destinations} placeholder="All Destinations" />
            </div>
          )}
          {(activeFilters > 0 || filters.search) && (
            <button onClick={() => setFilters({ search: '', status: '', consultant: '', destination: '', page: 1 })}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-rose-600 px-3 py-2 rounded-xl hover:bg-rose-50 transition-all select-none cursor-pointer">
              <X size={14} /> Clear all
            </button>
          )}
        </div>

        {/* Active-filter chips */}
        {(filters.status || filters.consultant || filters.destination || filters.search) && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {filters.search && <Chip onClear={() => setFilter('search', '')}>Search: <strong>{filters.search}</strong></Chip>}
            {filters.status && <Chip onClear={() => setFilter('status', '')}>Status: <strong>{filters.status}</strong></Chip>}
            {filters.consultant && <Chip onClear={() => setFilter('consultant', '')}>Consultant: <strong>{filters.consultant}</strong></Chip>}
            {filters.destination && <Chip onClear={() => setFilter('destination', '')}>Destination: <strong>{filters.destination}</strong></Chip>}
            <span className="text-xs text-slate-400 self-center ml-1">{data.total.toLocaleString()} match{data.total === 1 ? '' : 'es'}</span>
          </div>
        )}
      </div>

      {view === 'table' ? (
        /* TABLE VIEW VIEW */
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70">
                  {['Lead ID', 'Client', 'Phone', 'Dest.', 'Edu.', 'GPA', 'Source', 'Status (Click to change)', 'Consultant', 'Fee', 'Paid', 'Balance', 'Follow-up', ''].map(h => (
                    <th key={h} className="text-left py-3.5 px-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.leads.map(l => {
                  const isDueToday = l.next_followup === today;
                  const isOverdue = l.next_followup && l.next_followup < today && l.lead_status !== 'Enrolled' && l.lead_status !== 'Not Interested';
                  return (
                    <tr key={l.id} className="hover:bg-blue-50/40 transition-colors group cursor-pointer">
                      <td className="py-3 px-3.5 font-mono text-xs">
                        <Link to={`/leads/${l.id}`} className="text-blue-600 hover:text-blue-800 hover:underline font-bold">
                          {l.lead_id}
                        </Link>
                      </td>
                      <td className="py-3 px-3.5">
                        <Link to={`/leads/${l.id}`} className="font-bold text-slate-800 hover:text-blue-600 transition-colors truncate max-w-[150px] block">
                          {l.client_name}
                        </Link>
                        {(l.lead_status === 'File Opened' || l.lead_status === 'Enrolled') && (
                          <div className="mt-1" onClick={e => e.stopPropagation()}>
                            <InlineStageSelect
                              value={l.application_stage}
                              stages={stages}
                              onChange={async (newStage) => {
                                try {
                                  await api.updateStage(l.id, { stage: newStage });
                                  toast.success(`Updated stage to ${stages.find(s => s.key === newStage)?.label || newStage}`);
                                  load();
                                } catch (err) {
                                  toast.error(`Failed to update stage: ${err.message}`);
                                }
                              }}
                            />
                          </div>
                        )}
                        {l.notes && <div className="text-xs text-slate-400 truncate max-w-[150px] font-medium mt-0.5" title={l.notes}>{l.notes}</div>}
                      </td>
                      <td className="py-3 px-3.5 text-slate-500 whitespace-nowrap text-xs font-medium">
                        {l.phone ? (
                          <a href={`https://wa.me/${l.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" 
                            className="inline-flex items-center gap-1 text-slate-600 hover:text-emerald-600 hover:underline transition-colors" title="Chat on WhatsApp">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0 animate-pulse"></span>
                            {l.phone}
                          </a>
                        ) : '—'}
                      </td>
                      <td className="py-3 px-3.5 text-slate-600 font-semibold">{l.destination || '—'}</td>
                      <td className="py-3 px-3.5 text-slate-500 text-xs font-medium">{l.last_education || '—'}</td>
                      <td className="py-3 px-3.5 text-slate-500 font-medium">{l.gpa ?? '—'}</td>
                      <td className="py-3 px-3.5 text-slate-500 text-xs max-w-[100px] truncate font-medium">{l.lead_source || '—'}</td>
                      
                      {/* Premium Interactive Color-Coded Status Dropdown */}
                      <td className="py-3 px-3.5">
                        <InlineStatusSelect
                          value={l.lead_status}
                          options={settings?.leadStatuses || []}
                          onChange={async (newStatus) => {
                            try {
                              await api.updateLead(l.id, { ...l, lead_status: newStatus });
                              toast.success(`Updated ${l.client_name} → ${newStatus}`);
                              load();
                            } catch (err) {
                              toast.error(`Failed to update status: ${err.message}`);
                            }
                          }}
                        />
                      </td>

                      <td className="py-3 px-3.5 text-slate-500 text-xs font-semibold">{l.assigned_consultant || '—'}</td>
                      <td className="py-3 px-3.5 text-right text-slate-600 text-xs font-semibold tabular-nums">{l.service_fee ? '৳' + l.service_fee.toLocaleString() : '—'}</td>
                      <td className="py-3 px-3.5 text-right text-emerald-600 text-xs font-bold tabular-nums bg-emerald-50/30">{l.paid ? '৳' + l.paid.toLocaleString() : '—'}</td>
                      <td className="py-3 px-3.5 text-right text-xs font-bold tabular-nums">
                        {l.balance > 0 ? <span className="text-rose-600 bg-rose-50 px-2 py-1 rounded-lg border border-rose-100">৳{l.balance.toLocaleString()}</span> : '—'}
                      </td>
                      <td className="py-3 px-3.5 text-xs font-bold whitespace-nowrap">
                        {isDueToday ? (
                          <span className="px-2 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg flex items-center gap-1 w-fit">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" /> Today
                          </span>
                        ) : isOverdue ? (
                          <span className="px-2 py-1 bg-rose-50 text-rose-800 border border-rose-200 rounded-lg block w-fit" title={`Overdue since ${l.next_followup}`}>
                            Overdue
                          </span>
                        ) : l.next_followup ? (
                          <span className="text-slate-500 font-medium">{l.next_followup}</span>
                        ) : (
                          <span className="text-slate-300 font-medium">—</span>
                        )}
                      </td>
                      <td className="py-3 px-3.5">
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => setModal(l)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Pencil size={13} /></button>
                          <button onClick={() => setDeleting(l.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={13} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {data.leads.length === 0 && (
                  <tr>
                    <td colSpan={14} className="py-12">
                      <div className="text-center">
                        <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center mb-2">
                          <Search size={20} />
                        </div>
                        <p className="text-slate-600 font-semibold">No leads match these filters</p>
                        <p className="text-xs text-slate-400 mt-1">Try clearing the search, status or destination filters.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/40">
            <span className="text-xs text-slate-400">
              Showing {Math.min((filters.page - 1) * 50 + 1, data.total)}–{Math.min(filters.page * 50, data.total)} of {data.total.toLocaleString()}
            </span>
            <div className="flex items-center gap-1">
              <button disabled={filters.page <= 1}
                onClick={() => setFilters(f => ({ ...f, page: f.page - 1 }))}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs disabled:opacity-40 hover:bg-white transition-colors cursor-pointer select-none">
                <ChevronLeft size={14} /> Prev
              </button>
              <span className="px-3 py-1.5 text-xs text-slate-600 font-medium">{filters.page} / {data.pages}</span>
              <button disabled={filters.page >= data.pages}
                onClick={() => setFilters(f => ({ ...f, page: f.page + 1 }))}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs disabled:opacity-40 hover:bg-white transition-colors cursor-pointer select-none">
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* KANBAN BOARD VIEW */
        <div className="flex gap-4 overflow-x-auto pb-5 -mx-2 px-2" style={{ minHeight: '66vh' }}>
          {STAGES.map(({ status, col, border, light, ring }) => {
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
                className={`flex-shrink-0 w-[310px] flex flex-col rounded-2xl border bg-slate-50/50 shadow-sm transition-all duration-200
                  ${isOver ? `ring-4 ${ring} ${border} bg-white scale-[1.01] shadow-md` : 'border-slate-200/80'}
                  ${isSource ? 'opacity-50 border-dashed bg-slate-100/50' : ''}`}>
                
                {/* Accent Line */}
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

                {/* Card List Area */}
                <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5 min-h-[140px]">
                  {visible.map(l => (
                    <div key={l.id} draggable
                      onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; onDragStart(l, status); }}
                      onDragEnd={onDragEnd}
                      onClick={() => navigate(`/leads/${l.id}`)}
                      className={`group relative rounded-2xl border p-3.5 transition-all bg-white hover:shadow-md cursor-pointer hover:border-slate-350
                        ${l.next_followup === today ? 'border-amber-300 bg-amber-50/20 ring-1 ring-amber-200'
                          : l.next_followup && l.next_followup < today && l.lead_status !== 'Enrolled' && l.lead_status !== 'Not Interested' ? 'border-rose-200 bg-rose-50/10 ring-1 ring-rose-100'
                          : 'border-slate-100'}
                        ${dragging?.lead?.id === l.id ? 'opacity-30 rotate-1 scale-95 border-dashed border-blue-400' : ''}`}
                      style={{ contentVisibility: 'auto' }}>
                      
                      <div className="absolute top-3.5 right-3 opacity-0 group-hover:opacity-40 text-slate-400 transition-opacity pointer-events-none">
                        <GripVertical size={13} />
                      </div>

                      <div className="flex items-start justify-between gap-1.5">
                        <div className="min-w-0 flex-1 pr-3">
                          <p className="font-bold text-slate-800 text-sm group-hover:text-blue-600 transition-colors truncate">{l.client_name}</p>
                          <p className="text-[10px] text-slate-400 font-mono font-semibold mt-0.5">{l.lead_id}</p>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); setModal(l); }} className="p-1.5 text-slate-400 hover:text-blue-600 flex-shrink-0 rounded-lg hover:bg-blue-50 opacity-0 group-hover:opacity-100 transition-all cursor-pointer">
                          <Pencil size={12}/>
                        </button>
                      </div>

                      <div className="mt-2 space-y-1">
                        {l.phone && (
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
                            <Phone size={11} className="text-slate-400 flex-shrink-0"/>
                            <a href={`https://wa.me/${l.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" 
                              className="text-slate-600 hover:text-emerald-600 hover:underline transition-colors inline-flex items-center gap-1" title="Chat on WhatsApp">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0 animate-pulse"></span>
                              {l.phone}
                            </a>
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
                        {(l.lead_status === 'File Opened' || l.lead_status === 'Enrolled') && (
                          <div className="mt-2" onClick={e => e.stopPropagation()}>
                            <InlineStageSelect
                              value={l.application_stage}
                              stages={stages}
                              onChange={async (newStage) => {
                                try {
                                  await api.updateStage(l.id, { stage: newStage });
                                  toast.success(`Updated stage to ${stages.find(s => s.key === newStage)?.label || newStage}`);
                                  load();
                                } catch (err) {
                                  toast.error(`Failed to update stage: ${err.message}`);
                                }
                              }}
                            />
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
                          ${l.next_followup === today ? 'bg-amber-50 text-amber-800 border-amber-200' : l.next_followup < today ? 'bg-rose-50 text-rose-800 border-rose-200' : 'bg-slate-50 text-slate-600 border-slate-100'}`}>
                          <Calendar size={11} className={l.next_followup === today ? 'text-amber-600 animate-pulse' : l.next_followup < today ? 'text-rose-500' : 'text-slate-400'}/>
                          {l.next_followup === today ? 'Follow-up TODAY' : l.next_followup < today ? `Overdue · ${l.next_followup}` : `Follow-up: ${l.next_followup}`}
                        </div>
                      )}

                      {/* Super Premium Inline Dropdown on Card for Frictionless Actions */}
                      <div className="mt-3 pt-2.5 border-t border-slate-100">
                        <select
                          value={l.lead_status}
                          onClick={e => e.stopPropagation()} // prevent routing click
                          onChange={async (e) => {
                            e.stopPropagation();
                            const newStatus = e.target.value;
                            try {
                              await api.updateLead(l.id, { ...l, lead_status: newStatus });
                              toast.success(`Updated ${l.client_name} → ${newStatus}`);
                              load();
                            } catch (err) {
                              toast.error(`Failed to change status: ${err.message}`);
                            }
                          }}
                          className="w-full text-[10px] font-extrabold py-1 px-2 border border-slate-200 rounded-lg bg-slate-50 hover:bg-slate-150 text-slate-600 hover:text-blue-600 cursor-pointer focus:outline-none transition-all"
                        >
                          {settings?.leadStatuses?.map(st => (
                            <option key={st} value={st} className="bg-white text-slate-800 font-semibold">{st}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                  
                  {leads.length > 20 && (
                    <button onClick={() => toggleExpand(status)}
                      className="w-full py-2 text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors text-center rounded-xl bg-white border border-slate-200/60 hover:border-blue-200 shadow-sm block select-none cursor-pointer">
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
      )}

      {modal && (
        <Modal title={modal === 'add' ? '➕ Add New Lead' : `✏️ Edit Lead — ${modal.lead_id}`} onClose={() => setModal(null)} wide>
          <LeadForm lead={modal === 'add' ? null : modal} settings={settings} onSave={() => { setModal(null); load(); }} />
        </Modal>
      )}

      {deleting && (
        <Modal title="Delete Lead?" onClose={() => setDeleting(null)}>
          <p className="text-slate-600 mb-5">This lead will be permanently removed. This cannot be undone.</p>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setDeleting(null)} className="px-4 py-2 border border-slate-200 rounded-lg text-sm hover:bg-slate-50 cursor-pointer select-none">Cancel</button>
            <button onClick={() => handleDelete(deleting)} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 cursor-pointer select-none">Delete</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function FilterSelect({ value, onChange, options, placeholder }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className={`px-3.5 py-2 border rounded-xl text-sm bg-white transition-all cursor-pointer focus:ring-2 focus:ring-blue-100 focus:outline-none
        ${value ? 'border-blue-300 text-blue-700 font-medium bg-blue-50/20' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
      <option value="">{placeholder}</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function Chip({ children, onClear }) {
  return (
    <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-xs px-2 py-1 rounded-full border border-blue-100">
      {children}
      <button onClick={onClear} className="hover:bg-blue-100 rounded-full p-0.5 cursor-pointer"><X size={11} /></button>
    </span>
  );
}

function InlineStatusSelect({ value, onChange, options }) {
  const colors = {
    'New Lead': 'bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100',
    'No Response': 'bg-slate-50 text-slate-605 border-slate-200 hover:bg-slate-100',
    'Positive': 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100',
    'Office Visited': 'bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100',
    'File Opened': 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100',
    'Enrolled': 'bg-green-50 text-green-755 text-green-700 border-green-200 hover:bg-green-100',
    'Not Interested': 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100',
  };
  const cls = colors[value] || 'bg-slate-50 text-slate-650 border-slate-200 hover:bg-slate-100';
  return (
    <select
      value={value}
      onClick={e => e.stopPropagation()} // prevent row click
      onChange={e => onChange(e.target.value)}
      className={`px-3 py-1 rounded-full text-xs font-bold border transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-100 ${cls}`}
    >
      {options.map(o => (
        <option key={o} value={o} className="bg-white text-slate-800 font-semibold">{o}</option>
      ))}
    </select>
  );
}

const STAGE_COLORS_LIST = [
  { bg: 'bg-slate-50',   border: 'border-slate-200',   text: 'text-slate-700 hover:bg-slate-100' },
  { bg: 'bg-blue-50',    border: 'border-blue-200',    text: 'text-blue-805 text-blue-800 hover:bg-blue-100' },
  { bg: 'bg-violet-50',  border: 'border-violet-200',  text: 'text-violet-850 text-violet-800 hover:bg-violet-100' },
  { bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-850 text-amber-800 hover:bg-amber-100' },
  { bg: 'bg-orange-50',  border: 'border-orange-200',  text: 'text-orange-850 text-orange-800 hover:bg-orange-100' },
  { bg: 'bg-teal-50',    border: 'border-teal-200',    text: 'text-teal-850 text-teal-800 hover:bg-teal-100' },
  { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-850 text-emerald-800 hover:bg-emerald-100' },
  { bg: 'bg-green-50',   border: 'border-green-200',   text: 'text-green-850 text-green-800 hover:bg-green-100' },
  { bg: 'bg-indigo-50',  border: 'border-indigo-200',  text: 'text-indigo-850 text-indigo-800 hover:bg-indigo-100' },
  { bg: 'bg-fuchsia-50', border: 'border-fuchsia-200', text: 'text-fuchsia-850 text-fuchsia-800 hover:bg-fuchsia-100' },
  { bg: 'bg-pink-50',    border: 'border-pink-200',    text: 'text-pink-850 text-pink-800 hover:bg-pink-100' },
  { bg: 'bg-sky-50',     border: 'border-sky-200',     text: 'text-sky-850 text-sky-800 hover:bg-sky-100' },
];

function InlineStageSelect({ value, onChange, stages }) {
  if (!stages || stages.length === 0) return null;
  const idx = stages.findIndex(s => s.key === value);
  const color = STAGE_COLORS_LIST[idx !== -1 ? idx % STAGE_COLORS_LIST.length : 0];
  const selectValue = value || stages[0]?.key || '';
  
  return (
    <select
      value={selectValue}
      onClick={e => e.stopPropagation()} // prevent row click
      onChange={e => onChange(e.target.value)}
      className={`px-3 py-1 rounded-full text-[11px] font-bold border transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-100 ${color.bg} ${color.text} ${color.border}`}
    >
      {stages.map(s => (
        <option key={s.key} value={s.key} className="bg-white text-slate-800 font-semibold">{s.label}</option>
      ))}
    </select>
  );
}
