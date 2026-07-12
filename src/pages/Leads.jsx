import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import Modal from '../components/Modal';
import LeadDetailsModal from './LeadDetailsModal';
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

import { canViewOwnLeadsOnly, isFullAdmin } from '../lib/roles';
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
    lead_market: '',
    lead_type: '',
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
  const isAdmin = isFullAdmin(user);

  // Ad performance panel state (admin only)
  const [sourceStats, setSourceStats] = useState(null);
  const [statsDays, setStatsDays] = useState(30);
  const [statsOpen, setStatsOpen] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);

  useEffect(() => {
    if (!isAdmin || !statsOpen) return;
    setStatsLoading(true);
    fetch(`/api/leads/source-stats?days=${statsDays}`, { credentials: 'include' })
      .then(r => r.json()).then(setSourceStats).catch(() => {})
      .finally(() => setStatsLoading(false));
  }, [isAdmin, statsOpen, statsDays]);

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
      if (filters.intake) p.intake = filters.intake;
      if (filters.page_name) p.page_name = filters.page_name;
      if (filters.source) p.source = filters.source;
      if (filters.follow_up) p.follow_up = filters.follow_up;
      p.page = filters.page;
      api.leads(p).then(setData).catch(() => {});
    } else {
      // In Kanban view, fetch a larger subset of leads to populate all columns instantly
      const p = { limit: 500 };
      if (filters.search) p.search = filters.search;
      if (filters.status) p.status = filters.status;
      if (filters.consultant) p.consultant = filters.consultant;
      if (filters.destination) p.destination = filters.destination;
      if (filters.intake) p.intake = filters.intake;
      if (filters.page_name) p.page_name = filters.page_name;
      if (filters.source) p.source = filters.source;
      if (filters.follow_up) p.follow_up = filters.follow_up;
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

  const activeFilters = [filters.status, filters.consultant, filters.destination, filters.intake, filters.page_name, filters.follow_up].filter(Boolean).length;

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
    const headers = ['Lead ID', 'Name', 'Phone', 'Email', 'Destination', 'Education', 'GPA', 'English', 'Program', 'Source (Market / Type / Channel)', 'Status', 'Consultant', 'Fee', 'Paid', 'Balance', 'Payment', 'Follow-up', 'Notes'];
    const escape = (v) => {
      const s = v == null ? '' : String(v);
      if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    };
    const rows = list.map(l => [
      l.lead_id, l.client_name, l.phone, l.email, l.destination, l.last_education, l.gpa, l.english_score,
      l.program, `${l.lead_market||''} / ${l.lead_type||''} / ${l.lead_source||''}`, l.lead_status, l.assigned_consultant, l.service_fee, l.paid, l.balance,
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
    if (data.stats) return data.stats;
    const list = view === 'kanban' ? Object.values(byStatus).flat() : data.leads || [];
    const totalInquiries = list.length;
    const consultations = list.filter(l => l.lead_status === 'Office Visited').length;
    const activeFiles = list.filter(l => l.lead_status === 'File Opened' || l.lead_status === 'Enrolled').length;
    const dueToday = list.filter(l => l.next_followup === today).length;
    return { totalInquiries, consultations, activeFiles, dueToday };
  }, [data.leads, byStatus, today, view, data.stats]);

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
              All Leads
            </h2>
          </div>
          <p className="text-sm text-slate-500">
            {`${data.total.toLocaleString()} total active records`}
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

      {/* Ad Performance Panel — admin/CEO only */}
      {isAdmin && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <button
            onClick={() => setStatsOpen(o => !o)}
            className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <span className="text-base">📊</span>
              <span className="font-bold text-slate-700 text-sm">Ad Performance</span>
              <span className="text-[11px] text-slate-400 font-medium">Messenger &amp; Instagram pages only</span>
            </div>
            <div className="flex items-center gap-3">
              {statsOpen && (
                <select
                  value={statsDays}
                  onChange={e => { e.stopPropagation(); setStatsDays(Number(e.target.value)); }}
                  onClick={e => e.stopPropagation()}
                  className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                >
                  <option value={7}>Last 7 days</option>
                  <option value={30}>Last 30 days</option>
                  <option value={90}>Last 90 days</option>
                  <option value={365}>Last 1 year</option>
                </select>
              )}
              <span className={`text-slate-400 transition-transform duration-200 ${statsOpen ? 'rotate-180' : ''}`}>▾</span>
            </div>
          </button>

          {statsOpen && (
            <div className="border-t border-slate-100 p-5 space-y-5">
              {statsLoading ? (
                <p className="text-sm text-slate-400 text-center py-4">Loading...</p>
              ) : !sourceStats || (sourceStats.byPage.length === 0 && sourceStats.byAd.length === 0) ? (
                <div className="text-center py-6">
                  <p className="text-2xl mb-2">📭</p>
                  <p className="text-sm font-semibold text-slate-500">No ad attribution data yet</p>
                  <p className="text-xs text-slate-400 mt-1">Data will appear when leads arrive via Facebook/Instagram ad clicks</p>
                </div>
              ) : (
                <>
                  {/* By Page */}
                  {sourceStats.byPage.length > 0 && (
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">By Facebook Page</h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-400">
                              <th className="text-left px-4 py-2.5 rounded-l-xl">Page</th>
                              <th className="text-center px-4 py-2.5">Leads</th>
                              <th className="text-center px-4 py-2.5">Active</th>
                              <th className="text-center px-4 py-2.5">Enrolled</th>
                              <th className="text-center px-4 py-2.5 rounded-r-xl">Conv. Rate</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {sourceStats.byPage.map((row, i) => {
                              const rate = row.total_leads > 0 ? ((row.enrolled / row.total_leads) * 100).toFixed(1) : '0.0';
                              return (
                                <tr key={i} className="hover:bg-blue-50/30 transition-colors">
                                  <td className="px-4 py-3 font-semibold text-slate-700">
                                    <span className="inline-flex items-center gap-1.5">
                                      <span className="text-blue-500">📘</span>
                                      {row.page_name || '—'}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-center font-bold text-slate-800">{row.total_leads}</td>
                                  <td className="px-4 py-3 text-center text-emerald-600 font-semibold">{row.active}</td>
                                  <td className="px-4 py-3 text-center text-indigo-600 font-bold">{row.enrolled}</td>
                                  <td className="px-4 py-3 text-center">
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                                      parseFloat(rate) >= 20 ? 'bg-emerald-100 text-emerald-700' :
                                      parseFloat(rate) >= 10 ? 'bg-amber-100 text-amber-700' :
                                      'bg-slate-100 text-slate-500'
                                    }`}>{rate}%</span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* By Ad */}
                  {sourceStats.byAd.length > 0 && (
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">By Ad</h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-400">
                              <th className="text-left px-4 py-2.5 rounded-l-xl">Ad Name</th>
                              <th className="text-left px-4 py-2.5">Page</th>
                              <th className="text-center px-4 py-2.5">Leads</th>
                              <th className="text-center px-4 py-2.5">Enrolled</th>
                              <th className="text-center px-4 py-2.5 rounded-r-xl">Conv. Rate</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {sourceStats.byAd.map((row, i) => {
                              const rate = row.total_leads > 0 ? ((row.enrolled / row.total_leads) * 100).toFixed(1) : '0.0';
                              return (
                                <tr key={i} className="hover:bg-blue-50/30 transition-colors">
                                  <td className="px-4 py-3 font-semibold text-slate-700 max-w-[200px] truncate" title={row.ad_name}>
                                    {row.ad_name || '—'}
                                  </td>
                                  <td className="px-4 py-3 text-slate-500 text-xs">{row.page_name || '—'}</td>
                                  <td className="px-4 py-3 text-center font-bold text-slate-800">{row.total_leads}</td>
                                  <td className="px-4 py-3 text-center text-indigo-600 font-bold">{row.enrolled}</td>
                                  <td className="px-4 py-3 text-center">
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                                      parseFloat(rate) >= 20 ? 'bg-emerald-100 text-emerald-700' :
                                      parseFloat(rate) >= 10 ? 'bg-amber-100 text-amber-700' :
                                      'bg-slate-100 text-slate-500'
                                    }`}>{rate}%</span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

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
              <FilterSelect value={filters.destination} onChange={v => setFilter('destination', v)} options={settings.destinations} placeholder="All Destinations" />
              <FilterSelect value={filters.intake} onChange={v => setFilter('intake', v)} options={settings.intakes || []} placeholder="All Intakes" />
              <FilterSelect value={filters.page_name} onChange={v => setFilter('page_name', v)} options={settings.pages || []} placeholder="All Pages" />
              <FilterSelect value={filters.source} onChange={v => setFilter('source', v)} options={settings.leadSources || []} placeholder="All Sources" />
              <FilterSelect value={filters.follow_up} onChange={v => setFilter('follow_up', v)} options={['Today', 'Upcoming', 'Overdue']} placeholder="All Follow-ups" />
              {!canViewOwnLeadsOnly(user) && (
                <FilterSelect value={filters.consultant} onChange={v => setFilter('consultant', v)} options={settings.consultants} placeholder="All Consultants" />
              )}
            </div>
          )}
          {(activeFilters > 0 || filters.search) && (
            <button onClick={() => setFilters({ search: '', status: '', consultant: '', destination: '', intake: '', page_name: '', source: '', follow_up: '', page: 1 })}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-rose-600 px-3 py-2 rounded-xl hover:bg-rose-50 transition-all select-none cursor-pointer">
              <X size={14} /> Clear all
            </button>
          )}
        </div>

        {/* Active-filter chips */}
        {(filters.status || filters.consultant || filters.destination || filters.intake || filters.page_name || filters.source || filters.follow_up || filters.search) && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {filters.search && <Chip onClear={() => setFilter('search', '')}>Search: <strong>{filters.search}</strong></Chip>}
            {filters.status && <Chip onClear={() => setFilter('status', '')}>Status: <strong>{filters.status}</strong></Chip>}
            {filters.destination && <Chip onClear={() => setFilter('destination', '')}>Destination: <strong>{filters.destination}</strong></Chip>}
            {filters.intake && <Chip onClear={() => setFilter('intake', '')}>Intake: <strong>{filters.intake}</strong></Chip>}
            {filters.page_name && <Chip onClear={() => setFilter('page_name', '')}>Page: <strong>{filters.page_name}</strong></Chip>}
            {filters.source && <Chip onClear={() => setFilter('source', '')}>Source: <strong>{filters.source}</strong></Chip>}
            {filters.follow_up && <Chip onClear={() => setFilter('follow_up', '')}>Follow-up: <strong>{filters.follow_up}</strong></Chip>}
            {filters.consultant && <Chip onClear={() => setFilter('consultant', '')}>Consultant: <strong>{filters.consultant}</strong></Chip>}
            <span className="text-xs text-slate-400 self-center ml-1">{data.total.toLocaleString()} match{data.total === 1 ? '' : 'es'}</span>
          </div>
        )}
      </div>

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
                  <th className="py-3.5 px-3.5 text-left text-xs font-bold text-slate-400 uppercase tracking-wider w-10">#</th>
                  {['Lead ID', 'Client', 'Phone', 'Status', 'Destination', 'Degree', 'Major', 'University', 'Intake', 'Page', 'Follow-up', 'Consultant', ''].map(h => (
                    <th key={h} className="text-left py-3.5 px-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.leads.map((l, index) => {
                  const isDueToday = l.next_followup === today;
                  const isOverdue = l.next_followup && l.next_followup < today && l.lead_status !== 'Enrolled' && l.lead_status !== 'Not Interested';
                  return (
                    <tr key={l.id} className="even:bg-slate-50/70 hover:bg-blue-50/60 transition-colors group cursor-pointer">
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
                      <td className="py-3 px-3.5 text-xs text-slate-400 font-semibold tabular-nums text-center">
                        {(filters.page - 1) * 50 + index + 1}
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

                      <td className="py-3 px-3.5 text-slate-600 text-xs font-semibold">{l.destination || '—'}</td>
                      <td className="py-3 px-3.5 text-slate-500 text-xs font-medium">{l.degree || '—'}</td>
                      <td className="py-3 px-3.5 text-slate-500 text-xs font-medium max-w-[120px] truncate" title={l.major || l.program}>{l.major || l.program || '—'}</td>
                      <td className="py-3 px-3.5 text-slate-500 text-xs font-medium max-w-[120px] truncate" title={l.university}>{l.university || '—'}</td>
                      <td className="py-3 px-3.5 text-slate-500 text-xs font-medium whitespace-nowrap">{l.intake_term || '—'}</td>

                      <td className="py-3 px-3.5">
                        <div className="flex flex-col gap-1.5">
                          {/* Page badge */}
                          {l.page_name ? (
                            <div className="flex flex-col gap-1">
                              <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-indigo-50 border border-indigo-100/50 text-indigo-700 font-bold text-xs truncate max-w-[180px] w-fit">
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 flex-shrink-0"></span>
                                <span className="truncate">
                                  {l.page_name === 'EduExpress International Bangladesh' ? 'EduExpress Bangladesh' :
                                   l.page_name === 'EduExpress International China' ? 'EduExpress China' :
                                   l.page_name}
                                </span>
                              </span>
                              {l.ad_name && (
                                <span className="inline-flex items-center text-[10px] text-slate-500 bg-slate-50 border border-slate-200/60 px-1.5 py-0.5 rounded w-fit truncate max-w-[180px]" title={l.ad_name}>
                                  {l.ad_name}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-300 italic text-xs">—</span>
                          )}
                        </div>
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

                      <td className="py-3 px-3.5 text-slate-500 text-xs font-semibold">
                        {l.employee_name ? (
                          <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-blue-400" />
                            {l.employee_name}
                          </span>
                        ) : l.assigned_consultant || '—'}
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
          <div className="flex flex-col sm:flex-row items-center justify-between px-5 py-4 border-t border-slate-100 bg-white gap-4">
            <span className="text-sm text-slate-500 font-medium text-center sm:text-left">
              Showing <span className="text-slate-800 font-bold">{Math.min((filters.page - 1) * 50 + 1, data.total || 0)}</span> to <span className="text-slate-800 font-bold">{Math.min(filters.page * 50, data.total)}</span> of <span className="text-slate-800 font-bold">{data.total.toLocaleString()}</span> leads
            </span>
            <div className="flex items-center gap-2">
              <button disabled={filters.page <= 1}
                onClick={() => setFilters(f => ({ ...f, page: f.page - 1 }))}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 disabled:opacity-40 hover:bg-slate-50 hover:text-slate-900 transition-all cursor-pointer select-none shadow-sm active:scale-95">
                <ChevronLeft size={16} /> Prev
              </button>
              
              <div className="hidden md:flex items-center gap-1.5">
                {Array.from({ length: Math.min(5, data.pages || 1) }, (_, i) => {
                  let pageNum;
                  const totalP = data.pages || 1;
                  if (totalP <= 5) pageNum = i + 1;
                  else if (filters.page <= 3) pageNum = i + 1;
                  else if (filters.page >= totalP - 2) pageNum = totalP - 4 + i;
                  else pageNum = filters.page - 2 + i;
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setFilters(f => ({ ...f, page: pageNum }))}
                      className={`flex items-center justify-center min-w-[36px] h-9 px-2 rounded-xl text-sm font-bold transition-all shadow-sm cursor-pointer select-none active:scale-95 ${
                        filters.page === pageNum
                          ? 'bg-blue-600 text-white border border-blue-600 ring-2 ring-blue-600/20'
                          : 'bg-white border border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-600'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                {data.pages > 5 && filters.page < data.pages - 2 && (
                  <>
                    <span className="px-1 text-slate-400 tracking-widest font-bold">...</span>
                    <button
                      onClick={() => setFilters(f => ({ ...f, page: data.pages }))}
                      className="flex items-center justify-center min-w-[36px] h-9 px-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-600 text-sm font-bold transition-all shadow-sm cursor-pointer select-none active:scale-95"
                    >
                      {data.pages}
                    </button>
                  </>
                )}
              </div>

              <button disabled={filters.page >= (data.pages || 1)}
                onClick={() => setFilters(f => ({ ...f, page: f.page + 1 }))}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 disabled:opacity-40 hover:bg-slate-50 hover:text-slate-900 transition-all cursor-pointer select-none shadow-sm active:scale-95">
                Next <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>

      {modal && (
        <LeadDetailsModal
          user={user}
          lead={modal}
          settings={settings}
          onClose={() => setModal(null)}
          onSave={() => { setModal(null); load(); }}
        />
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
                            <span className="text-xs text-slate-400 ml-2">ID: {lead.lead_id} | Status: {lead.lead_status} | Source: {lead.lead_market} / {lead.lead_type} / {lead.lead_source}</span>
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
