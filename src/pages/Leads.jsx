import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import Modal from '../components/Modal';
import LeadForm from './LeadForm';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/Confirm';
import { 
  Plus, Search, Trash2, Pencil, ChevronLeft, ChevronRight, Download, X,
  LayoutGrid, Table as TableIcon, GripVertical, Phone, MapPin, User, Users, CheckCircle2,
  Calendar, Filter, CalendarDays, Building2, FolderOpen, ArrowRight, MessageSquare
} from 'lucide-react';

const STAGES = [
  { status: 'New Lead',       hex: '#0ea5e9', col: 'bg-sky-500',     border: 'border-sky-500',     light: 'bg-sky-50',      ring: 'ring-sky-200/50' },
  { status: 'No Response',    hex: '#94a3b8', col: 'bg-slate-400',   border: 'border-slate-400',   light: 'bg-slate-50',    ring: 'ring-slate-200/50' },
  { status: 'Follow-up',      hex: '#f59e0b', col: 'bg-amber-500',   border: 'border-amber-500',   light: 'bg-amber-50',    ring: 'ring-amber-200/50' },
  { status: 'Positive',       hex: '#10b981', col: 'bg-emerald-500', border: 'border-emerald-500', light: 'bg-emerald-50',  ring: 'ring-emerald-200/50' },
  { status: 'Office Visited', hex: '#8b5cf6', col: 'bg-violet-500',  border: 'border-violet-500',  light: 'bg-violet-50',   ring: 'ring-violet-200/50' },
  { status: 'File Opened',    hex: '#3b82f6', col: 'bg-blue-500',    border: 'border-blue-500',    light: 'bg-blue-50',     ring: 'ring-blue-200/50' },
  { status: 'Enrolled',       hex: '#16a34a', col: 'bg-green-600',   border: 'border-green-600',   light: 'bg-green-50',    ring: 'ring-green-200/50' },
  { status: 'Not Interested', hex: '#f87171', col: 'bg-red-400',     border: 'border-red-400',     light: 'bg-red-50',      ring: 'ring-red-200/50' },
];

import { canViewOwnLeadsOnly } from '../lib/roles';
import { formatPhoneDisplay, getWAUrl } from '../lib/phone';

const fmt = (n) => `৳${Number(n || 0).toLocaleString()}`;

export default function Leads({ user }) {
  const isAgentUser = user?.roles?.includes('agent');
  const [searchParams, setSearchParams] = useSearchParams();
  const urlView = searchParams.get('view');

  // View state: table or kanban
  const [view, setView] = useState(() => {
    if (urlView === 'kanban' || urlView === 'table') return urlView;
    return localStorage.getItem('leads_view') || 'table';
  });

  // Sync view state when urlView changes (e.g. from redirect, command palette, or back/forward)
  useEffect(() => {
    if (urlView === 'kanban' || urlView === 'table') {
      setView(urlView);
    } else if (!urlView) {
      const savedView = localStorage.getItem('leads_view');
      if (savedView === 'kanban' || savedView === 'table') {
        setView(savedView);
      } else {
        setView('table');
      }
    }
  }, [urlView]);

  useEffect(() => {
    document.title = view === 'kanban'
      ? "Sales Pipeline | EduExpress Core"
      : "All Leads | EduExpress Core";
  }, [view]);

  const [data, setData] = useState({ leads: [], total: 0, pages: 1 });
  const [settings, setSettings] = useState(null);
  const [stages, setStages] = useState([]);
  
  // Kanban board state
  const [byStatus, setByStatus] = useState({});
  const [dragging, setDragging] = useState(null);  // { lead, fromStatus }
  const [overCol, setOverCol]   = useState(null);
  const [expanded, setExpanded] = useState({});

  const [filters, setFilters] = useState({
    search: '',
    status: searchParams.get('status') || '',
    consultant: '',
    destination: '',
    source: '',
    page: 1,
  });

  const [modal, setModal] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkAssigning, setBulkAssigning] = useState(false);
  const [bulkAssignConsultant, setBulkAssignConsultant] = useState('');
  const [bulkStatusModal, setBulkStatusModal] = useState(false);
  const [bulkStatusValue, setBulkStatusValue] = useState('');
  const [duplicatesModal, setDuplicatesModal] = useState(false);
  const [duplicateGroups, setDuplicateGroups] = useState([]);
  const searchRef = useRef();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  useEffect(() => {
    localStorage.setItem('leads_view', view);
    // Sync URL search param
    const currentParams = Object.fromEntries(searchParams);
    if (currentParams.view !== view) {
      setSearchParams({ ...currentParams, view }, { replace: true });
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
      if (filters.source) p.source = filters.source;
      p.page = filters.page;
      api.leads(p).then(setData).catch(() => {});
    } else {
      // In Kanban view, fetch a larger subset of leads to populate all columns instantly
      const p = { limit: 500 };
      if (filters.search) p.search = filters.search;
      if (filters.consultant) p.consultant = filters.consultant;
      if (filters.destination) p.destination = filters.destination;
      if (filters.source) p.source = filters.source;
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

  function setFilter(key, val) {
    setFilters(f => ({ ...f, [key]: val, page: 1 }));
  }

  const activeFilters = [filters.status, filters.consultant, filters.destination, filters.source].filter(Boolean).length;

  async function handleBulkStatus() {
    if (!bulkStatusValue) { toast.error('Please select a status'); return; }
    try {
      const res = await api.bulkUpdateStatus(selectedIds, bulkStatusValue);
      setSelectedIds([]);
      setBulkStatusModal(false);
      setBulkStatusValue('');
      load();
      toast.success(`Updated ${res.updated} leads to ${bulkStatusValue}`);
    } catch (e) { toast.error(e.message || 'Could not update status'); }
  }

  async function loadDuplicates() {
    try {
      const res = await api.findDuplicates();
      setDuplicateGroups(res.groups || []);
      setDuplicatesModal(true);
    } catch (e) { toast.error(e.message || 'Failed to load duplicates'); }
  }

  async function handleMerge(primary_id, secondary_ids) {
    if (!await confirm('Merge Leads', 'Are you sure you want to merge these leads? The secondary leads will be deleted permanently. This cannot be undone.', 'Merge', 'rose')) return;
    try {
      await api.mergeLeads(primary_id, secondary_ids);
      toast.success('Leads merged successfully');
      loadDuplicates();
      load();
    } catch (e) { toast.error(e.message || 'Merge failed'); }
  }

  async function handleDelete(id) {
    try {
      await api.deleteLead(id);
      setDeleting(null);
      load();
      toast.success('Lead deleted');
    } catch (e) { toast.error(e.message || 'Could not delete'); }
  }

  useEffect(() => {
    setSelectedIds([]);
  }, [filters, view]);

  async function handleBulkDelete() {
    try {
      await Promise.all(selectedIds.map(id => api.deleteLead(id)));
      setSelectedIds([]);
      setBulkDeleting(false);
      load();
      toast.success(`${selectedIds.length} leads deleted successfully`);
    } catch (e) {
      toast.error(e.message || 'Could not delete some leads');
    }
  }

  async function handleBulkAssign() {
    if (!bulkAssignConsultant) {
      toast.error('Please select a consultant');
      return;
    }
    try {
      const res = await api.bulkAssignLeads(selectedIds, bulkAssignConsultant);
      setSelectedIds([]);
      setBulkAssigning(false);
      setBulkAssignConsultant('');
      load();
      toast.success(`Assigned ${res.updated} leads to ${bulkAssignConsultant}`);
    } catch (e) {
      toast.error(e.message || 'Could not assign leads');
    }
  }

  function exportCSV() {
    const list = view === 'kanban' ? Object.values(byStatus).flat() : data.leads;
    if (!list.length) { toast.info('No leads to export'); return; }
    const headers = ['Lead ID', 'Name', 'Phone', 'Email', 'Destination', 'Education', 'GPA', 'English', 'Program', 'Source', 'Status', 'Consultant', 'Fee', 'Paid', 'Balance', 'Payment', 'Follow-up', 'Notes'];
    const escape = (v) => {
      const s = v == null ? '' : String(v);
      if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    };
    const rows = list.map(l => [
      l.lead_id, l.client_name, l.phone, l.email, l.destination, l.last_education, l.gpa, l.english_score,
      l.program, l.lead_source, l.lead_status, l.assigned_consultant, l.service_fee, l.paid, l.balance,
      l.payment_status, l.next_followup, l.notes
    ].map(escape));
    const csv = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${list.length} leads to CSV`);
  }

  const stats = useMemo(() => {
    const list = view === 'kanban' ? Object.values(byStatus).flat() : data.leads || [];
    const totalInquiries = list.length;
    const consultations = list.filter(l => l.lead_status === 'Office Visited').length;
    const activeFiles = list.filter(l => l.lead_status === 'File Opened' || l.lead_status === 'Enrolled').length;
    const dueToday = list.filter(l => l.next_followup === today).length;
    return { totalInquiries, consultations, activeFiles, dueToday };
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
      <div className="flex items-center justify-between flex-wrap gap-4 border-b border-slate-200/60 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-4 flex-wrap">
            <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">
              {view === 'kanban' ? 'Sales Pipeline' : 'All Leads'}
            </h2>
            
            {/* View Switcher Toggle */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200/50 shadow-inner">
              <button
                onClick={() => setView('table')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold select-none cursor-pointer transition-all duration-200 ${
                  view === 'table'
                    ? 'bg-white text-blue-600 shadow-sm font-bold scale-[1.02]'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <TableIcon size={13} />
                All Leads
              </button>
              <button
                onClick={() => setView('kanban')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold select-none cursor-pointer transition-all duration-200 ${
                  view === 'kanban'
                    ? 'bg-white text-blue-600 shadow-sm font-bold scale-[1.02]'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <LayoutGrid size={13} />
                Pipeline Board
              </button>
            </div>
          </div>
          <p className="text-sm text-slate-500">
            {view === 'kanban' 
              ? `${Object.values(byStatus).flat().length} active prospects on board`
              : `${data.total.toLocaleString()} total active records`
            }
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex gap-2">
            {selectedIds.length > 0 && (
              <>
                <button onClick={() => setBulkAssigning(true)} className="flex items-center gap-1.5 bg-blue-50 text-blue-700 border border-blue-200 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-100 transition-colors shadow-sm select-none cursor-pointer">
                  <User size={15} /> Assign Consultant ({selectedIds.length})
                </button>
                <button onClick={() => setBulkStatusModal(true)} className="flex items-center gap-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-indigo-100 transition-colors shadow-sm select-none cursor-pointer">
                  <CheckCircle2 size={15} /> Update Status ({selectedIds.length})
                </button>
                <button onClick={() => setBulkDeleting(true)} className="flex items-center gap-1.5 bg-rose-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-rose-700 transition-colors shadow-sm select-none cursor-pointer">
                  <Trash2 size={15} /> Delete Selected ({selectedIds.length})
                </button>
              </>
            )}
            {!isAgentUser && (
              <>
                <button onClick={loadDuplicates} className="flex items-center gap-1.5 px-3.5 py-2 border border-slate-200 bg-white rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors shadow-sm select-none cursor-pointer">
                  <Users size={15} /> Find Duplicates
                </button>
                <button onClick={exportCSV} className="flex items-center gap-1.5 px-3.5 py-2 border border-slate-200 bg-white rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors shadow-sm select-none cursor-pointer">
                  <Download size={15} /> Export CSV
                </button>
              </>
            )}
            <button onClick={() => setModal('add')} className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm select-none cursor-pointer">
              <Plus size={15} /> {isAgentUser ? 'Add Student' : 'Add Lead'}
            </button>
          </div>
        </div>
      </div>

      {/* Page-level dynamic summary strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm hover:shadow transition-shadow flex items-start justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-wider font-bold text-slate-400">Total Inquiries</p>
            <p className="text-2xl font-extrabold text-slate-800 leading-tight mt-1">{stats.totalInquiries.toLocaleString()}</p>
            <p className="text-[10px] text-slate-400 mt-1">Active prospects on {view === 'kanban' ? 'board' : 'page'}</p>
          </div>
          <div className="p-2 bg-sky-50 rounded-xl text-sky-600">
            <User size={18} />
          </div>
        </div>
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm hover:shadow transition-shadow flex items-start justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-wider font-bold text-slate-400">Consultations</p>
            <p className="text-2xl font-extrabold text-violet-600 leading-tight mt-1">{stats.consultations.toLocaleString()}</p>
            <p className="text-[10px] text-slate-400 mt-1">Office counseling done</p>
          </div>
          <div className="p-2 bg-violet-50 rounded-xl text-violet-600">
            <Building2 size={18} />
          </div>
        </div>
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm hover:shadow transition-shadow flex items-start justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-wider font-bold text-slate-400">Active Files</p>
            <p className="text-2xl font-extrabold text-emerald-600 leading-tight mt-1">{stats.activeFiles.toLocaleString()}</p>
            <p className="text-[10px] text-slate-400 mt-1">File Opened / Enrolled</p>
          </div>
          <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600">
            <FolderOpen size={18} />
          </div>
        </div>
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm hover:shadow transition-shadow flex items-start justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-wider font-bold text-slate-400">Due Follow-ups</p>
            <p className={`text-2xl font-extrabold leading-tight mt-1 ${stats.dueToday > 0 ? 'text-rose-500' : 'text-slate-600'}`}>{stats.dueToday.toLocaleString()}</p>
            <p className="text-[10px] text-slate-400 mt-1">Actions scheduled today</p>
          </div>
          <div className={`p-2 rounded-xl ${stats.dueToday > 0 ? 'bg-rose-50 text-rose-500' : 'bg-slate-50 text-slate-500'}`}>
            <CalendarDays size={18} />
          </div>
        </div>
      </div>

      {/* Search + Filters bar (sticky) */}
      <div className="sticky top-0 z-20 bg-slate-50/95 backdrop-blur-md -mx-4 lg:-mx-6 px-4 lg:px-6 py-2 border-b border-slate-200/80">
        <div className="bg-white border border-slate-200 rounded-2xl p-2.5 shadow-sm flex flex-wrap gap-2.5 items-center">
          <div className="relative flex-1 min-w-48">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input ref={searchRef}
              className="pl-10 pr-9 h-10 bg-slate-50 border border-slate-200/80 rounded-xl text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all placeholder:text-slate-400"
              placeholder="Search leads by name, phone, ID, email..."
              value={filters.search}
              onChange={e => setFilter('search', e.target.value)} />
            {filters.search && (
              <button onClick={() => setFilter('search', '')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-200 transition-all" aria-label="Clear search">
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
              {!canViewOwnLeadsOnly(user) && (
                <FilterSelect value={filters.consultant} onChange={v => setFilter('consultant', v)} options={settings.consultants} placeholder="All Consultants" />
              )}
              <FilterSelect value={filters.destination} onChange={v => setFilter('destination', v)} options={settings.destinations} placeholder="All Destinations" />
              <FilterSelect value={filters.source} onChange={v => setFilter('source', v)} options={settings.leadSources} placeholder="All Sources" />
            </div>
          )}
          {(activeFilters > 0 || filters.search) && (
            <button onClick={() => setFilters({ search: '', status: '', consultant: '', destination: '', source: '', page: 1 })}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-rose-600 px-3 py-2 rounded-xl hover:bg-rose-50 transition-all select-none cursor-pointer">
              <X size={14} /> Clear all
            </button>
          )}
        </div>

        {/* Active-filter chips */}
        {(filters.status || filters.consultant || filters.destination || filters.source || filters.search) && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {filters.search && <Chip onClear={() => setFilter('search', '')}>Search: <strong>{filters.search}</strong></Chip>}
            {filters.status && <Chip onClear={() => setFilter('status', '')}>Status: <strong>{filters.status}</strong></Chip>}
            {filters.consultant && <Chip onClear={() => setFilter('consultant', '')}>Consultant: <strong>{filters.consultant}</strong></Chip>}
            {filters.destination && <Chip onClear={() => setFilter('destination', '')}>Destination: <strong>{filters.destination}</strong></Chip>}
            {filters.source && <Chip onClear={() => setFilter('source', '')}>Source: <strong>{filters.source}</strong></Chip>}
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
                  <th className="py-3.5 px-3.5 text-left text-xs">
                    <input
                      type="checkbox"
                      checked={data.leads.length > 0 && data.leads.every(l => selectedIds.includes(l.id))}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedIds(prev => {
                            const pageIds = data.leads.map(l => l.id);
                            const union = Array.from(new Set([...prev, ...pageIds]));
                            return union;
                          });
                        } else {
                          setSelectedIds(prev => {
                            const pageIds = data.leads.map(l => l.id);
                            return prev.filter(id => !pageIds.includes(id));
                          });
                        }
                      }}
                      className="rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                    />
                  </th>
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
                      <td className="py-3 px-3.5 text-left" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(l.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedIds(prev => [...prev, l.id]);
                            } else {
                              setSelectedIds(prev => prev.filter(id => id !== l.id));
                            }
                          }}
                          className="rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                        />
                      </td>
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
                          <div className="flex flex-col gap-1">
                            <a href={getWAUrl(l.phone, l.nationality)} target="_blank" rel="noopener noreferrer" 
                              className="inline-flex items-center gap-1 text-slate-600 hover:text-emerald-600 hover:underline transition-colors" title="Chat on WhatsApp">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0 animate-pulse"></span>
                              {formatPhoneDisplay(l.phone, l.nationality)}
                            </a>
                            <Link to={`/conversations?search=${encodeURIComponent(formatPhoneDisplay(l.phone, l.nationality).replace(/\D/g, ''))}`} 
                              className="inline-flex items-center gap-1 text-[10px] text-blue-600 hover:underline font-semibold w-fit">
                              Open Inbox
                            </Link>
                          </div>
                        ) : '—'}
                      </td>
                      <td className="py-3 px-3.5 text-slate-600 font-semibold">{l.destination || '—'}</td>
                      <td className="py-3 px-3.5 text-slate-500 text-xs font-medium">{l.last_education || '—'}</td>
                      <td className="py-3 px-3.5 text-slate-500 font-medium">{l.gpa ?? '—'}</td>
                      <td className="py-3 px-3.5 text-slate-500 text-xs max-w-[120px] truncate font-medium">
                        {l.lead_source === 'WhatsApp' ? (
                          <div className="flex items-center gap-1">
                            <a href={getWAUrl(l.phone, l.nationality)} target="_blank" rel="noopener noreferrer" 
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-100 hover:bg-emerald-100 transition-colors" title="Message on WhatsApp">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse flex-shrink-0"></span>
                              <span>WhatsApp</span>
                            </a>
                            <Link to={`/conversations?search=${encodeURIComponent(formatPhoneDisplay(l.phone, l.nationality).replace(/\D/g, ''))}`}
                              className="inline-flex items-center justify-center p-1 rounded-md text-blue-600 hover:bg-blue-50 transition-colors bg-white border border-blue-100" title="Open in CRM Inbox">
                              <MessageSquare size={13} />
                            </Link>
                          </div>
                        ) : l.lead_source === 'Messenger' ? (
                          <a href="https://business.facebook.com/latest/inbox/all" target="_blank" rel="noopener noreferrer" 
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-bold border border-blue-100 hover:bg-blue-100 transition-colors" title="Message on Messenger">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse flex-shrink-0"></span>
                            <span>Messenger</span>
                          </a>
                        ) : (
                          l.lead_source || '—'
                        )}
                      </td>
                      
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

                      <td className="py-3 px-3.5 text-slate-500 text-xs font-semibold">
                        {l.employee_name ? (
                          <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-blue-400" />
                            {l.employee_name}
                          </span>
                        ) : l.assigned_consultant || '—'}
                      </td>
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
                          <button onClick={() => setModal(l)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" aria-label="Edit lead"><Pencil size={13} /></button>
                          {l.lead_status === 'File Opened' || l.lead_status === 'Enrolled' ? (
                            <Link to={`/applications?search=${l.lead_id}`} className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="View in Applications"><FolderOpen size={13} /></Link>
                          ) : (
                            <button onClick={async () => {
                              try {
                                await api.updateLead(l.id, { ...l, lead_status: 'File Opened', application_stage: 'documents' });
                                toast.success(`${l.client_name} moved to Applications`);
                                load();
                              } catch (err) { toast.error(err.message || 'Could not convert'); }
                            }} className="p-1.5 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors" title="Convert to Application"><ArrowRight size={13} /></button>
                          )}
                          <button onClick={() => setDeleting(l.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" aria-label="Delete lead"><Trash2 size={13} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {data.leads.length === 0 && (
                  <tr>
                    <td colSpan={15} className="py-12">
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
          {STAGES.map(({ status, col, border, ring }) => {
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
                      className={`group relative rounded-2xl border p-3.5 transition-all bg-white hover:shadow-md cursor-pointer hover:border-slate-300
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
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="font-bold text-slate-800 text-sm group-hover:text-blue-600 transition-colors truncate">{l.client_name}</p>
                            {l.lead_source === 'WhatsApp' && (
                              <div className="flex items-center gap-1">
                                <a href={getWAUrl(l.phone, l.nationality)} target="_blank" rel="noopener noreferrer" 
                                  onClick={e => e.stopPropagation()}
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-100 hover:bg-emerald-100 transition-colors flex-shrink-0" title="Message on WhatsApp">
                                  <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse"></span>
                                  WA
                                </a>
                                <Link to={`/conversations?search=${encodeURIComponent(formatPhoneDisplay(l.phone, l.nationality).replace(/\D/g, ''))}`}
                                  onClick={e => e.stopPropagation()}
                                  className="inline-flex items-center justify-center p-0.5 rounded text-blue-600 hover:bg-blue-50 transition-colors border border-blue-100" title="Open in CRM Inbox">
                                  <MessageSquare size={11} />
                                </Link>
                              </div>
                            )}
                            {l.lead_source === 'Messenger' && (
                              <a href="https://business.facebook.com/latest/inbox/all" target="_blank" rel="noopener noreferrer" 
                                onClick={e => e.stopPropagation()}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[10px] font-bold border border-blue-100 hover:bg-blue-100 transition-colors flex-shrink-0" title="Message on Messenger">
                                <span className="w-1 h-1 rounded-full bg-blue-500 animate-pulse"></span>
                                Msg
                              </a>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-400 font-mono font-semibold mt-0.5">{l.lead_id}</p>
                        </div>
                        <div className="flex gap-0.5" onClick={e => e.stopPropagation()}>
                          <button onClick={() => setModal(l)} className="p-1.5 text-slate-400 hover:text-blue-600 flex-shrink-0 rounded-lg hover:bg-blue-50 opacity-0 group-hover:opacity-100 transition-all cursor-pointer" aria-label="Edit lead">
                            <Pencil size={12}/>
                          </button>
                          <button onClick={() => setDeleting(l.id)} className="p-1.5 text-slate-400 hover:text-rose-600 flex-shrink-0 rounded-lg hover:bg-rose-50 opacity-0 group-hover:opacity-100 transition-all cursor-pointer" aria-label="Delete lead">
                            <Trash2 size={12}/>
                          </button>
                        </div>
                      </div>

                      <div className="mt-2 space-y-1">
                        {l.phone && (
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
                            <Phone size={11} className="text-slate-400 flex-shrink-0"/>
                            <a href={getWAUrl(l.phone, l.nationality)} target="_blank" rel="noopener noreferrer" 
                              className="text-slate-600 hover:text-emerald-600 hover:underline transition-colors inline-flex items-center gap-1" title="Chat on WhatsApp">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0 animate-pulse"></span>
                              {formatPhoneDisplay(l.phone, l.nationality)}
                            </a>
                            <Link to={`/conversations?search=${encodeURIComponent(formatPhoneDisplay(l.phone, l.nationality).replace(/\D/g, ''))}`}
                              className="ml-1 text-blue-500 hover:text-blue-700 transition-colors" title="Open in CRM Inbox">
                              <MessageSquare size={11} />
                            </Link>
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
                          className="w-full text-[10px] font-extrabold py-1 px-2 border border-slate-200 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-blue-600 cursor-pointer focus:outline-none transition-all"
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
          <LeadForm user={user} lead={modal === 'add' ? null : modal} settings={settings} onSave={() => { setModal(null); load(); }} />
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

      {bulkDeleting && (
        <Modal title="Delete Selected Leads?" onClose={() => setBulkDeleting(false)}>
          <div className="p-4 space-y-4">
            <p className="text-sm text-slate-600">
              Are you sure you want to permanently delete the <strong>{selectedIds.length}</strong> selected lead records? This action will remove them from all pipeline views and cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setBulkDeleting(false)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm cursor-pointer select-none">Cancel</button>
              <button onClick={handleBulkDelete} className="px-4 py-2 bg-rose-600 text-white rounded-lg text-sm hover:bg-rose-700 cursor-pointer select-none">Delete All</button>
            </div>
          </div>
        </Modal>
      )}
      {duplicatesModal && (
        <Modal title="Duplicate Leads Found" onClose={() => setDuplicatesModal(false)} maxWidth="max-w-4xl">
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
            {duplicateGroups.length === 0 ? (
              <div className="text-center py-8 text-slate-500">No duplicates found based on phone or email.</div>
            ) : (
              duplicateGroups.map((group, idx) => {
                const primary = group[0];
                const secondaries = group.slice(1);
                return (
                  <div key={idx} className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <h3 className="font-semibold text-slate-800 mb-2">Match: {primary.phone || primary.email}</h3>
                    <div className="space-y-2">
                      {group.map((lead, i) => (
                        <div key={lead.id} className="flex items-center justify-between bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
                          <div>
                            <span className="font-medium text-slate-700">{lead.client_name || 'Unnamed'}</span>
                            <span className="text-xs text-slate-400 ml-2">ID: {lead.lead_id} | Status: {lead.lead_status} | Source: {lead.lead_source}</span>
                          </div>
                          {i === 0 ? (
                            <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-bold rounded">Primary Record</span>
                          ) : (
                            <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs rounded">Will be merged</span>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 flex justify-end">
                      <button onClick={() => handleMerge(primary.id, secondaries.map(s => s.id))} className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 cursor-pointer">
                        Merge into Primary
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
          <div className="flex justify-end pt-4 border-t border-slate-100 mt-4">
            <button onClick={() => setDuplicatesModal(false)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium cursor-pointer">Close</button>
          </div>
        </Modal>
      )}

      {bulkStatusModal && (
        <Modal title="Update Status for Selected Leads" onClose={() => setBulkStatusModal(false)}>
          <div className="space-y-4">
            <p className="text-sm text-slate-600">Select a new status for {selectedIds.length} leads:</p>
            <select
              className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-xl focus:ring-blue-500 focus:border-blue-500 p-2.5"
              value={bulkStatusValue}
              onChange={e => setBulkStatusValue(e.target.value)}
            >
              <option value="">Select Status...</option>
              {STAGES.map(s => <option key={s.status} value={s.status}>{s.status}</option>)}
            </select>
            <div className="flex justify-end gap-2 pt-4">
              <button onClick={() => setBulkStatusModal(false)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm cursor-pointer">Cancel</button>
              <button onClick={handleBulkStatus} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 cursor-pointer">Update Status</button>
            </div>
          </div>
        </Modal>
      )}

      {bulkAssigning && (
        <Modal title="Assign Consultant to Selected Leads" onClose={() => setBulkAssigning(false)}>
          <div className="p-4 space-y-4">
            <p className="text-sm text-slate-600">
              Choose a consultant to assign to <strong>{selectedIds.length}</strong> selected leads.
            </p>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Consultant</label>
              <select
                value={bulkAssignConsultant}
                onChange={e => setBulkAssignConsultant(e.target.value)}
                className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-blue-100 focus:outline-none cursor-pointer"
              >
                <option value="">Select a consultant...</option>
                {settings?.consultants?.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setBulkAssigning(false)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm cursor-pointer select-none">Cancel</button>
              <button onClick={handleBulkAssign} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 cursor-pointer select-none">Assign</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function FilterSelect({ value, onChange, options, placeholder }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className={`h-10 min-w-[140px] px-3.5 py-2 border rounded-xl text-sm bg-white transition-all cursor-pointer focus:ring-2 focus:ring-blue-100 focus:outline-none
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
      <button onClick={onClear} className="hover:bg-blue-100 rounded-full p-0.5 cursor-pointer" aria-label="Clear search"><X size={11} /></button>
    </span>
  );
}

function InlineStatusSelect({ value, onChange, options }) {
  const colors = {
    'New Lead': 'bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100',
    'No Response': 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100',
    'Follow-up': 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100',
    'Positive': 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100',
    'Office Visited': 'bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100',
    'File Opened': 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100',
    'Enrolled': 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100',
    'Not Interested': 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100',
  };
  const cls = colors[value] || 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100';
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
  { bg: 'bg-blue-50',    border: 'border-blue-200',    text: 'text-blue-800 hover:bg-blue-100' },
  { bg: 'bg-violet-50',  border: 'border-violet-200',  text: 'text-violet-800 hover:bg-violet-100' },
  { bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-800 hover:bg-amber-100' },
  { bg: 'bg-orange-50',  border: 'border-orange-200',  text: 'text-orange-800 hover:bg-orange-100' },
  { bg: 'bg-teal-50',    border: 'border-teal-200',    text: 'text-teal-800 hover:bg-teal-100' },
  { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800 hover:bg-emerald-100' },
  { bg: 'bg-green-50',   border: 'border-green-200',   text: 'text-green-800 hover:bg-green-100' },
  { bg: 'bg-indigo-50',  border: 'border-indigo-200',  text: 'text-indigo-800 hover:bg-indigo-100' },
  { bg: 'bg-fuchsia-50', border: 'border-fuchsia-200', text: 'text-fuchsia-800 hover:bg-fuchsia-100' },
  { bg: 'bg-pink-50',    border: 'border-pink-200',    text: 'text-pink-800 hover:bg-pink-100' },
  { bg: 'bg-sky-50',     border: 'border-sky-200',     text: 'text-sky-800 hover:bg-sky-100' },
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
