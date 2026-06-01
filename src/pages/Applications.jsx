/* Applications — mirrors the EduExpress "File Updates" workbook.
   Lead Management ends at File Open; from there the Applications module owns
   the workflow: Documents → Ready → Submitted → Admitted → Visa Applied →
   Visa Approved → Departed → Arrived.
   Two views: Kanban (one column per stage) and Table (Excel-style row view).
   Side panel covers: Source (Agent/In-house), Referrer, Nationality, Passport,
   Intake, Degree, Major, Universities (multi-uni per applicant w/ status),
   Drive Link, Deposit, Visa & Departure dates, Notes, Documents checklist.
*/
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { api } from '../api';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/Confirm';
import Modal from '../components/Modal';
import {
  GraduationCap, RefreshCw, X, CheckCircle2, AlertTriangle, ExternalLink,
  CalendarClock, MapPin, Save, ArrowRight, FileText, ChevronRight, Plus, Trash2,
  LayoutGrid, Table as TableIcon, Filter, Building2, User, ChevronDown,
  Share2, Copy, QrCode, RotateCw, Search,
} from 'lucide-react';

const ensureAbsoluteUrl = (url) => {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  return 'https://' + url;
};

const STAGE_COLORS = {
  documents:          { bg: 'bg-slate-50 text-slate-700',  border: 'border-slate-200',   pill: 'bg-slate-200 text-slate-700' },
  ready:              { bg: 'bg-blue-50 text-blue-800',    border: 'border-blue-200',    pill: 'bg-blue-200 text-blue-800' },
  submitted:          { bg: 'bg-violet-50 text-violet-850',border: 'border-violet-200',  pill: 'bg-violet-200 text-violet-800' },
  interview:          { bg: 'bg-indigo-50 text-indigo-800',border: 'border-indigo-200',  pill: 'bg-indigo-200 text-indigo-800' },
  in_review:          { bg: 'bg-sky-50 text-sky-800',      border: 'border-sky-200',     pill: 'bg-sky-200 text-sky-800' },
  pre_admission:      { bg: 'bg-cyan-50 text-cyan-800',    border: 'border-cyan-200',    pill: 'bg-cyan-200 text-cyan-800' },
  deposit:            { bg: 'bg-amber-50 text-amber-800',  border: 'border-amber-200',   pill: 'bg-amber-200 text-amber-800' },
  admitted:           { bg: 'bg-emerald-50 text-emerald-800', border: 'border-emerald-200', pill: 'bg-emerald-200 text-emerald-800' },
  jw202:              { bg: 'bg-teal-50 text-teal-800',    border: 'border-teal-200',    pill: 'bg-teal-200 text-teal-800' },
  rejected:           { bg: 'bg-rose-50 text-rose-800',    border: 'border-rose-200',    pill: 'bg-rose-200 text-rose-800' },
  visa_applied:       { bg: 'bg-orange-50 text-orange-800',border: 'border-orange-200',  pill: 'bg-orange-200 text-orange-800' },
  visa_approved:      { bg: 'bg-green-50 text-green-800',  border: 'border-green-200',   pill: 'bg-green-200 text-green-800' },
  payment_complete:   { bg: 'bg-fuchsia-50 text-fuchsia-800', border: 'border-fuchsia-200', pill: 'bg-fuchsia-200 text-fuchsia-800' },
  visa_rejected:      { bg: 'bg-red-50 text-red-800',      border: 'border-red-200',     pill: 'bg-red-200 text-red-800' },
  enrolled:           { bg: 'bg-emerald-100 text-emerald-800', border: 'border-emerald-350', pill: 'bg-emerald-600 text-white font-bold' },
  cancelled:          { bg: 'bg-slate-100 text-slate-600', border: 'border-slate-300',   pill: 'bg-slate-550 text-white' },
  withdraw:           { bg: 'bg-orange-100 text-orange-800', border: 'border-orange-350', pill: 'bg-orange-600 text-white font-bold' },
};

const STAGE_COLORS_LIST = [
  { bg: 'bg-slate-50',   border: 'border-slate-200',   pill: 'bg-slate-200 text-slate-700' },
  { bg: 'bg-blue-50',    border: 'border-blue-200',    pill: 'bg-blue-200 text-blue-800' },
  { bg: 'bg-violet-50',  border: 'border-violet-200',  pill: 'bg-violet-200 text-violet-800' },
  { bg: 'bg-amber-50',   border: 'border-amber-200',   pill: 'bg-amber-200 text-amber-800' },
  { bg: 'bg-orange-50',  border: 'border-orange-200',  pill: 'bg-orange-200 text-orange-800' },
  { bg: 'bg-teal-50',    border: 'border-teal-200',    pill: 'bg-teal-200 text-teal-800' },
  { bg: 'bg-emerald-50', border: 'border-emerald-200', pill: 'bg-emerald-200 text-emerald-800' },
  { bg: 'bg-green-50',   border: 'border-green-200',   pill: 'bg-green-200 text-green-800' },
  { bg: 'bg-indigo-50',  border: 'border-indigo-200',  pill: 'bg-indigo-200 text-indigo-800' },
  { bg: 'bg-fuchsia-50', border: 'border-fuchsia-200', pill: 'bg-fuchsia-200 text-fuchsia-800' },
  { bg: 'bg-pink-50',    border: 'border-pink-200',    pill: 'bg-pink-200 text-pink-800' },
  { bg: 'bg-sky-50',     border: 'border-sky-200',     pill: 'bg-sky-200 text-sky-800' },
];

const DOC_STATUSES = [
  { key: 'pending',      label: 'Pending',      cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  { key: 'received',     label: 'Received',     cls: 'bg-blue-100 text-blue-700 border-blue-200' },
  { key: 'verified',     label: 'Verified',     cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { key: 'rejected',     label: 'Rejected',     cls: 'bg-rose-100 text-rose-700 border-rose-200' },
  { key: 'not_required', label: 'N/A',          cls: 'bg-slate-50 text-slate-400 border-slate-200' },
];

const UNI_STATUSES = [
  { key: 'ready',               label: 'Ready',               cls: 'bg-blue-100 text-blue-700' },
  { key: 'submitted',           label: 'Submitted',           cls: 'bg-violet-100 text-violet-700' },
  { key: 'pending',             label: 'Pending',             cls: 'bg-slate-100 text-slate-650' },
  { key: 'processing',          label: 'Processing',          cls: 'bg-indigo-100 text-indigo-700' },
  { key: 'initial_review_pass', label: 'Initial Review Pass', cls: 'bg-sky-100 text-sky-700' },
  { key: 'interview',           label: 'Interview',           cls: 'bg-amber-100 text-amber-700' },
  { key: 'pre_admission',       label: 'Pre-Admission',       cls: 'bg-cyan-100 text-cyan-700' },
  { key: 'admitted',            label: 'Admitted',            cls: 'bg-emerald-100 text-emerald-750 font-bold' },
  { key: 'returned',            label: 'Returned',            cls: 'bg-orange-100 text-orange-700 font-medium' },
  { key: 'rejected',            label: 'Rejected',            cls: 'bg-rose-100 text-rose-700 font-medium' },
];

const SOURCES = ['In-House', 'B2B', 'China'];
const DEGREES = ['Diploma', 'Bachelor', 'Masters', 'PhD', 'L+Bachelor', 'L+Diploma'];

export default function Applications({ user }) {
  useEffect(() => { document.title = "Application Hub | EduExpress Core"; }, []);

  const toast = useToast();
  const [stages, setStages]   = useState([]);
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [filterStage, setFilterStage]     = useState('all');
  const [filterDest, setFilterDest]       = useState('all');
  const [filterSource, setFilterSource]   = useState('all');
  const [filterReferrer, setFilterReferrer] = useState('all');
  const [searchQuery, setSearchQuery]     = useState('');
  const [view, setView] = useState(() => localStorage.getItem('app_view') || 'kanban');

  const [settings, setSettings] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newApp, setNewApp] = useState({
    client_name: '',
    phone: '',
    destination: 'China',
    degree: 'Bachelor',
    major: '',
    university: '',
    source: 'In-House',
    referrer: '',
    assigned_consultant: '',
  });

  const isAuthorized = user?.role === 'admin' || user?.role === 'manager';
  const visibleSources = isAuthorized ? SOURCES : SOURCES.filter(s => s !== 'China');

  const [hideEmptyColumns, setHideEmptyColumns] = useState(() => localStorage.getItem('hide_empty_cols') === 'true');
  useEffect(() => { localStorage.setItem('hide_empty_cols', hideEmptyColumns); }, [hideEmptyColumns]);

  useEffect(() => {
    api.settings().then(setSettings).catch(() => {});
  }, []);

  useEffect(() => {
    setSelectedIds([]);
  }, [view, filterStage, filterDest, filterSource, filterReferrer, searchQuery]);

  const handleBulkDelete = async () => {
    try {
      await Promise.all(selectedIds.map(id => api.deleteLead(id)));
      setSelectedIds([]);
      setBulkDeleting(false);
      load();
      toast.success(`${selectedIds.length} applications deleted successfully`);
    } catch (err) {
      toast.error(err.message || 'Could not delete some applications');
    }
  };

  const handleCreateApplication = async (e) => {
    e.preventDefault();
    if (!newApp.client_name || !newApp.phone) {
      toast.error("Full name and Phone number are required");
      return;
    }
    try {
      const payload = {
        ...newApp,
        isChinaApp: true,
        lead_status: 'File Opened',
        application_stage: 'documents',
      };
      await api.createLead(payload);
      toast.success(`Application for ${newApp.client_name} created successfully`);
      setShowAddModal(false);
      setNewApp({
        client_name: '',
        phone: '',
        destination: 'China',
        degree: 'Bachelor',
        major: '',
        university: '',
        source: 'In-House',
        referrer: '',
        assigned_consultant: '',
      });
      load();
    } catch (err) {
      toast.error(err.message || 'Could not create application');
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try { const d = await api.applications(); setStages(d.stages); setRows(d.rows); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  useEffect(() => { localStorage.setItem('app_view', view); }, [view]);

  const filtered = useMemo(() => rows.filter(r => {
    const defaultStage = stages[0]?.key || 'documents';
    if (filterStage    !== 'all' && (r.application_stage || defaultStage) !== filterStage) return false;
    if (filterDest     !== 'all' && r.destination !== filterDest)     return false;
    if (filterSource   !== 'all' && r.source !== filterSource)        return false;
    if (filterReferrer !== 'all' && r.referrer !== filterReferrer)    return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const nameMatch = (r.client_name || '').toLowerCase().includes(q);
      const idMatch = (r.lead_id || '').toLowerCase().includes(q);
      const destMatch = (r.destination || '').toLowerCase().includes(q);
      const majorMatch = (r.major || '').toLowerCase().includes(q);
      const universityMatch = (r.university || '').toLowerCase().includes(q);
      const consultantMatch = (r.assigned_consultant || '').toLowerCase().includes(q);
      const degreeMatch = (r.degree || '').toLowerCase().includes(q);
      const referrerMatch = (r.referrer || '').toLowerCase().includes(q);
      if (!nameMatch && !idMatch && !destMatch && !majorMatch && !universityMatch && !consultantMatch && !degreeMatch && !referrerMatch) return false;
    }
    return true;
  }), [rows, stages, filterStage, filterDest, filterSource, filterReferrer, searchQuery]);

  // Per-stage counts (across all rows, not filtered, so the strip is stable)
  const stageCounts = useMemo(() => {
    const m = Object.fromEntries(stages.map(s => [s.key, 0]));
    const defaultStage = stages[0]?.key || 'documents';
    rows.forEach(r => {
      const k = stages.some(s => s.key === r.application_stage) ? r.application_stage : defaultStage;
      m[k] = (m[k] || 0) + 1;
    });
    return m;
  }, [rows, stages]);

  const destinations = useMemo(() => unique(rows.map(r => r.destination)), [rows]);
  const referrers    = useMemo(() => unique(rows.map(r => r.referrer)), [rows]);

  // Stats by source (B2B vs In-House) — matches the Excel's "Remark" column
  const sourceSplit = useMemo(() => {
    const m = { 'In-House': 0, 'B2B': 0, 'Unknown': 0 };
    filtered.forEach(r => {
      const s = r.source || '';
      if (s.toLowerCase() === 'in-house') m['In-House']++;
      else if (s === 'B2B' || s === 'Agent') m['B2B']++;
      else m['Unknown']++;
    });
    return m;
  }, [filtered]);

  const isFilterActive = filterSource !== 'all' || filterDest !== 'all' || filterReferrer !== 'all' || searchQuery;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <GraduationCap size={22} className="text-blue-600" /> Application Pipeline
          </h2>
          <p className="text-sm text-slate-500">
            {filtered.length} active{rows.length !== filtered.length ? ` of ${rows.length}` : ''} ·
            <strong className="text-emerald-600 ml-1">{sourceSplit['In-House']}</strong> in-house ·
            <strong className="text-violet-600 ml-1">{sourceSplit['B2B']}</strong> B2B
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* View toggle */}
          <div className="flex gap-0.5 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <button onClick={() => setView('kanban')}
              className={`flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-md ${view === 'kanban' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              <LayoutGrid size={13} /> Kanban
            </button>
            <button onClick={() => setView('table')}
              className={`flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-md ${view === 'table' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              <TableIcon size={13} /> Table
            </button>
          </div>
          <button onClick={load} disabled={loading}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          {selectedIds.length > 0 && (
            <button onClick={() => setBulkDeleting(true)}
              className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold px-4 py-2 rounded-lg shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer">
              <Trash2 size={16} /> Delete Selected ({selectedIds.length})
            </button>
          )}
          <button onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg shadow-sm shadow-blue-100 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer">
            <Plus size={16} /> Add Application
          </button>
        </div>
      </div>

      {/* Advanced Sticky Filter & Search Bar */}
      <div className="sticky top-0 z-20 bg-slate-50/95 backdrop-blur-md -mx-4 lg:-mx-6 px-4 lg:px-6 py-2 border-b border-slate-200/80">
        <div className="bg-white border border-slate-200 rounded-2xl p-2.5 shadow-sm flex flex-wrap gap-2.5 items-center">
          <div className="relative flex-1 min-w-[240px]">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              className="pl-10 pr-9 py-2 bg-slate-50 border border-slate-200/80 rounded-xl text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all placeholder:text-slate-400"
              placeholder="Search by name, ID, major, university, degree, consultant..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-200 transition-colors"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <select value={filterSource} onChange={e => setFilterSource(e.target.value)}
              className={`px-3 py-2 border rounded-xl text-sm bg-white transition-all cursor-pointer focus:ring-2 focus:ring-blue-100
                ${filterSource !== 'all' ? 'border-blue-300 text-blue-700 font-medium' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
              <option value="all">All Sources</option>
              {visibleSources.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            
            <select value={filterDest} onChange={e => setFilterDest(e.target.value)}
              className={`px-3 py-2 border rounded-xl text-sm bg-white transition-all cursor-pointer focus:ring-2 focus:ring-blue-100
                ${filterDest !== 'all' ? 'border-blue-300 text-blue-700 font-medium' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
              <option value="all">All Destinations</option>
              {destinations.map(d => <option key={d} value={d}>{d}</option>)}
            </select>

            <select value={filterReferrer} onChange={e => setFilterReferrer(e.target.value)}
              className={`px-3 py-2 border rounded-xl text-sm bg-white transition-all cursor-pointer focus:ring-2 focus:ring-blue-100 max-w-[160px]
                ${filterReferrer !== 'all' ? 'border-blue-300 text-blue-700 font-medium' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
              <option value="all">All Referrers</option>
              {referrers.map(r => <option key={r} value={r}>{r}</option>)}
            </select>

            {view === 'kanban' && (
              <label className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white cursor-pointer select-none hover:bg-slate-50 transition-colors">
                <input type="checkbox" checked={hideEmptyColumns} onChange={e => setHideEmptyColumns(e.target.checked)}
                  className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer" />
                <span className="text-slate-600 font-semibold">Hide empty columns</span>
              </label>
            )}

            {isFilterActive && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setFilterSource('all');
                  setFilterDest('all');
                  setFilterReferrer('all');
                }}
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-rose-600 px-3 py-2 rounded-xl hover:bg-rose-50 transition-all font-semibold"
              >
                <X size={14} /> Clear all filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Stage pill strip — click to filter, click again to clear */}
      {stages.length > 0 && rows.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          <button onClick={() => setFilterStage('all')}
            className={`flex-shrink-0 text-xs font-semibold px-3 py-2 rounded-xl border transition-all
              ${filterStage === 'all' ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'}`}>
            All <span className="ml-1 opacity-75">{rows.length}</span>
          </button>
          {stages.map((s, index) => {
            const n = stageCounts[s.key] || 0;
            const active = filterStage === s.key;
            const color = STAGE_COLORS[s.key] || STAGE_COLORS_LIST[index % STAGE_COLORS_LIST.length];
            return (
              <button key={s.key} onClick={() => setFilterStage(active ? 'all' : s.key)}
                disabled={n === 0}
                className={`flex-shrink-0 flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-xl border transition-all
                  ${active ? `${color.bg} border-current shadow-sm scale-[1.02]`
                    : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300 disabled:opacity-50 disabled:cursor-not-allowed'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${color.pill.split(' ')[0]}`}/>
                {s.label}
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${active ? 'bg-white/60' : 'bg-slate-100'}`}>{n}</span>
              </button>
            );
          })}
        </div>
      )}

      {loading && rows.length === 0 ? (
        <div className="text-slate-400 text-center py-16">Loading…</div>
      ) : filtered.length === 0 ? (
        <EmptyState />
      ) : view === 'kanban' ? (
        <KanbanView stages={stages} rows={filtered} onPick={setSelected} hideEmptyColumns={hideEmptyColumns} />
      ) : (
        <TableView rows={filtered} onPick={setSelected} stages={stages} selectedIds={selectedIds} setSelectedIds={setSelectedIds} />
      )}

      {selected && (
        <ApplicationPanel
          leadId={selected.id}
          stages={stages}
          referrers={referrers}
          onClose={() => setSelected(null)}
          onChanged={load}
          user={user}
        />
      )}

      {bulkDeleting && (
        <Modal title="Delete Selected Applications?" onClose={() => setBulkDeleting(false)}>
          <div className="p-4 space-y-4">
            <p className="text-sm text-slate-650">
              Are you sure you want to permanently delete the <strong>{selectedIds.length}</strong> selected student records? This action will remove them from the database and cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setBulkDeleting(false)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm cursor-pointer select-none">Cancel</button>
              <button onClick={handleBulkDelete} className="px-4 py-2 bg-rose-600 text-white rounded-lg text-sm hover:bg-rose-700 cursor-pointer select-none">Delete All</button>
            </div>
          </div>
        </Modal>
      )}

      {showAddModal && (
        <Modal title="Add Direct China Application" onClose={() => setShowAddModal(false)}>
          <form onSubmit={handleCreateApplication} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Full Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  value={newApp.client_name}
                  onChange={e => setNewApp({ ...newApp, client_name: e.target.value })}
                  placeholder="e.g. Md Saiful Haque"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Phone Number <span className="text-red-500">*</span></label>
                <input
                  type="tel"
                  required
                  value={newApp.phone}
                  onChange={e => setNewApp({ ...newApp, phone: e.target.value })}
                  placeholder="e.g. +88017XXXXXXXX"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Destination</label>
                <select
                  value={newApp.destination}
                  onChange={e => setNewApp({ ...newApp, destination: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all cursor-pointer"
                >
                  {(settings?.destinations || ['China', 'Malta', 'Hungary', 'Greece', 'Estonia']).map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Degree</label>
                <select
                  value={newApp.degree}
                  onChange={e => setNewApp({ ...newApp, degree: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all cursor-pointer"
                >
                  {DEGREES.map(deg => (
                    <option key={deg} value={deg}>{deg}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Major</label>
                <input
                  type="text"
                  value={newApp.major}
                  onChange={e => setNewApp({ ...newApp, major: e.target.value })}
                  placeholder="e.g. Computer Science"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Primary University</label>
                <input
                  type="text"
                  value={newApp.university}
                  onChange={e => setNewApp({ ...newApp, university: e.target.value })}
                  placeholder="e.g. Sichuan University"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Source (Remark)</label>
                <select
                  value={newApp.source}
                  onChange={e => setNewApp({ ...newApp, source: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all cursor-pointer"
                >
                  {visibleSources.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Referrer</label>
                <input
                  type="text"
                  value={newApp.referrer}
                  onChange={e => setNewApp({ ...newApp, referrer: e.target.value })}
                  placeholder="e.g. BheUni, Mahmud"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Assigned Consultant</label>
              <select
                value={newApp.assigned_consultant}
                onChange={e => setNewApp({ ...newApp, assigned_consultant: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all cursor-pointer"
              >
                <option value="">— pick —</option>
                {(settings?.consultants || []).map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 transition-colors flex items-center gap-1.5"
              >
                <Save size={13} /> Create Application
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function unique(arr) { return Array.from(new Set(arr.filter(Boolean))).sort(); }

function EmptyState() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
      <GraduationCap size={36} className="text-slate-300 mx-auto mb-3" />
      <p className="text-slate-600 font-semibold">No applications match the current filters</p>
      <p className="text-xs text-slate-400 mt-1">
        Mark a lead as <strong>Enrolled</strong> or <strong>File Opened</strong> to start its application.
      </p>
    </div>
  );
}

/* ───────────────────────────── KANBAN ───────────────────────────── */
function KanbanView({ stages, rows, onPick, hideEmptyColumns }) {
  const byStage = useMemo(() => {
    const map = Object.fromEntries(stages.map(s => [s.key, []]));
    const defaultStage = stages[0]?.key || 'documents';
    for (const r of rows) {
      const key = stages.some(s => s.key === r.application_stage) ? r.application_stage : defaultStage;
      (map[key] ||= []).push(r);
    }
    return map;
  }, [rows, stages]);

  const visibleStages = useMemo(() => {
    if (!hideEmptyColumns) return stages;
    return stages.filter(s => (byStage[s.key] || []).length > 0);
  }, [stages, byStage, hideEmptyColumns]);

  return (
    <div className="overflow-x-auto pb-3">
      <div className="flex gap-4 min-w-max">
        {visibleStages.map((stage, index) => {
          const items = byStage[stage.key] || [];
          const color = STAGE_COLORS[stage.key] || STAGE_COLORS_LIST[index % STAGE_COLORS_LIST.length];
          return (
            <div key={stage.key} className={`w-[290px] flex-shrink-0 rounded-2xl border ${color.border} ${color.bg} shadow-sm transition-all duration-200 flex flex-col`}>
              {/* Colored top band */}
              <div className={`h-1.5 w-full ${color.pill.split(' ')[0]}`} />
              
              <div className="px-3.5 py-3 border-b border-white/60 flex items-center justify-between">
                <span className="font-bold text-slate-800 text-sm tracking-tight">{stage.label}</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${color.pill}`}>{items.length}</span>
              </div>
              
              <div className="p-2.5 space-y-2.5 max-h-[640px] overflow-y-auto min-h-[140px] flex-1">
                {items.length === 0 ? (
                  <div className="py-12 px-3 text-center text-xs text-slate-400 border border-dashed border-slate-200/80 rounded-2xl bg-white shadow-sm flex flex-col items-center justify-center">
                    <FileText size={18} className="text-slate-300 mb-1.5" />
                    <p className="font-semibold text-slate-500">No student files</p>
                  </div>
                ) : items.map(card => (
                  <ApplicationCard key={card.id} card={card} onClick={() => onPick(card)} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ApplicationCard({ card, onClick }) {
  const docPct = card.docs_total > 0 ? Math.round((card.docs_received / card.docs_total) * 100) : 0;
  const visaSoon = card.visa_deadline && (new Date(card.visa_deadline) - new Date() < 30 * 86400000);
  const isB2B = card.source === 'B2B' || card.source === 'Agent';
  const isChina = card.source === 'China';

  return (
    <button onClick={onClick} className="w-full text-left bg-white rounded-xl p-3 shadow-sm hover:shadow-md border border-slate-100 hover:border-blue-200 transition-all">
      <div className="flex items-start justify-between gap-2 mb-1">
        <p className="font-semibold text-slate-800 text-sm truncate flex-1">{card.client_name}</p>
        {visaSoon && <span title={`Visa deadline ${card.visa_deadline}`} className="text-rose-500 flex-shrink-0"><CalendarClock size={14} /></span>}
      </div>
      <p className="text-[11px] text-slate-400 truncate">{card.lead_id}</p>
      <div className="flex items-center gap-1.5 flex-wrap mt-1">
        {card.source && (
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border
            ${isChina 
              ? 'bg-amber-50 text-amber-700 border-amber-200 shadow-sm' 
              : isB2B 
              ? 'bg-violet-50 text-violet-700 border-violet-200 shadow-sm' 
              : 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-sm'}`}>
            {card.source}
          </span>
        )}
        {card.destination && (
          <span className="text-[10px] text-slate-500 flex items-center gap-0.5"><MapPin size={9}/> {card.destination}</span>
        )}
        {card.degree && (<span className="text-[10px] text-slate-500">{card.degree}</span>)}
      </div>
      {card.uni_list && (
        <p className="text-[11px] text-slate-500 mt-1.5 truncate" title={card.uni_list}>
          <Building2 size={9} className="inline mr-0.5"/>{card.uni_list}
          {card.uni_admitted > 0 && <span className="ml-1 text-emerald-600 font-semibold">· {card.uni_admitted} admit</span>}
        </p>
      )}
      {card.docs_total > 0 && (
        <div className="mt-2">
          <div className="flex justify-between text-[10px] text-slate-400 mb-0.5">
            <span>Docs</span><span>{card.docs_received}/{card.docs_total}</span>
          </div>
          <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${docPct}%` }} />
          </div>
        </div>
      )}
      <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2">
        <span className="truncate">{card.referrer || card.assigned_consultant || '—'}</span>
        {card.intake_term && <span>{card.intake_term}</span>}
      </div>
    </button>
  );
}

/* ───────────────────────────── TABLE (Excel-style) ───────────────────────────── */
function TableView({ rows, onPick, stages, selectedIds, setSelectedIds }) {
  const stageLabel = (key) => stages.find(s => s.key === key)?.label || '—';
  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <Th>
                <input
                  type="checkbox"
                  checked={rows.length > 0 && rows.every(r => selectedIds.includes(r.id))}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedIds(prev => {
                        const rowIds = rows.map(r => r.id);
                        const union = Array.from(new Set([...prev, ...rowIds]));
                        return union;
                      });
                    } else {
                      setSelectedIds(prev => {
                        const rowIds = rows.map(r => r.id);
                        return prev.filter(id => !rowIds.includes(id));
                      });
                    }
                  }}
                  onClick={e => e.stopPropagation()}
                  className="rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                />
              </Th>
              <Th>#</Th>
              <Th>Source</Th>
              <Th>Name</Th>
              <Th>Nationality</Th>
              <Th>Passport</Th>
              <Th>Intake</Th>
              <Th>Degree</Th>
              <Th>Major</Th>
              <Th>Status</Th>
              <Th>Universities</Th>
              <Th>Referrer</Th>
              <Th>Drive</Th>
              <Th right>Deposit</Th>
              <Th right>Balance</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r, i) => (
              <tr key={r.id} onClick={() => onPick(r)} className="hover:bg-blue-50/40 cursor-pointer">
                <Td onClick={e => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(r.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedIds(prev => [...prev, r.id]);
                      } else {
                        setSelectedIds(prev => prev.filter(id => id !== r.id));
                      }
                    }}
                    className="rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                  />
                </Td>
                <Td>{i + 1}</Td>
                <Td>{r.source && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border
                    ${r.source === 'China'
                      ? 'bg-amber-50 text-amber-700 border-amber-200 shadow-sm'
                      : (r.source === 'B2B' || r.source === 'Agent')
                      ? 'bg-violet-50 text-violet-700 border-violet-200 shadow-sm'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-sm'}`}>
                    {r.source}
                  </span>
                )}</Td>
                <Td><div className="font-medium text-slate-800">{r.client_name}</div>
                    <div className="text-[11px] text-slate-400">{r.lead_id}</div></Td>
                <Td>{r.nationality || '—'}</Td>
                <Td className="font-mono text-[12px]">{r.passport || '—'}</Td>
                <Td>{r.intake_term || '—'}</Td>
                <Td>{r.degree || '—'}</Td>
                <Td className="max-w-[180px] truncate">{r.major || r.university || '—'}</Td>
                <Td><span className="text-[11px] font-semibold text-slate-700">{stageLabel(r.application_stage)}</span></Td>
                <Td className="max-w-[200px] truncate" title={r.uni_list}>{r.uni_list || '—'}</Td>
                <Td>{r.referrer || r.assigned_consultant || '—'}</Td>
                <Td>{r.drive_link
                  ? <a href={ensureAbsoluteUrl(r.drive_link)} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                      className="inline-flex items-center gap-1 text-blue-600 hover:underline text-xs">
                      Open <ExternalLink size={11} />
                    </a>
                  : <span className="text-slate-300 text-xs">—</span>}</Td>
                <Td right>{r.deposit ? `৳${Number(r.deposit).toLocaleString()}` : '—'}</Td>
                <Td right>{r.balance > 0 ? `৳${Number(r.balance).toLocaleString()}` : '—'}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
function Th({ children, right }) { return <th className={`px-3 py-2.5 font-semibold whitespace-nowrap ${right ? 'text-right' : 'text-left'}`}>{children}</th>; }
function Td({ children, right, className = '' }) { return <td className={`px-3 py-2.5 align-middle whitespace-nowrap ${right ? 'text-right' : ''} ${className}`}>{children}</td>; }

/* ───────────────────────────── PANEL ───────────────────────────── */
function ApplicationPanel({ leadId, stages = [], referrers, onClose, onChanged, user }) {
  const [lead, setLead]     = useState(null);
  const [docs, setDocs]     = useState([]);
  const [unis, setUnis]     = useState([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm]     = useState({});
  const toast = useToast();
  const confirm = useConfirm();

  const isAuthorized = user?.role === 'admin' || user?.role === 'manager';
  const visibleSources = isAuthorized ? SOURCES : SOURCES.filter(s => s !== 'China');

  const onCloseRef = useRef(onClose);
  const toastRef = useRef(toast);
  const stagesRef = useRef(stages);

  useEffect(() => {
    onCloseRef.current = onClose;
    toastRef.current = toast;
    stagesRef.current = stages;
  });

  const load = useCallback(async () => {
    try {
      const [l, d, u] = await Promise.all([
        api.getLead(leadId),
        api.documents(leadId),
        api.universityApps(leadId),
      ]);
      if (!l) {
        toastRef.current?.error("Lead not found or access denied");
        onCloseRef.current?.();
        return;
      }
      setLead(l); 
      setDocs(d || []); 
      setUnis(u || []);
      const curStages = stagesRef.current || [];
      setForm({
        application_stage: l.application_stage || (curStages[0]?.key || 'documents'),
        source:            l.source || '',
        referrer:          l.referrer || '',
        nationality:       l.nationality || '',
        passport:          l.passport || '',
        degree:            l.degree || '',
        major:             l.major || l.program || '',
        intake_term:       l.intake_term || '',
        university:        l.university || '',
        drive_link:        l.drive_link || '',
        deposit:           l.deposit || '',
        visa_deadline:     l.visa_deadline || '',
        departure_date:    l.departure_date || '',
        application_notes: l.application_notes || '',
        blood_group:       l.blood_group || '',
        date_of_birth:     l.date_of_birth || '',
        medical_notes:     l.medical_notes || '',
        emergency_contact: l.emergency_contact || '',
      });
    } catch (err) {
      console.error("Error loading application detail panel:", err);
      toastRef.current?.error(err.message || "Failed to load application details");
      onCloseRef.current?.();
    }
  }, [leadId]);

  useEffect(() => { load(); }, [load]);

  const updateField = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const saveAll = async () => {
    setSaving(true);
    try { await api.updateStage(leadId, form); await load(); onChanged?.(); toast.success('Saved'); }
    catch (e) { toast.error(e.message || 'Could not save'); }
    setSaving(false);
  };

  // Click a stage chip → save immediately AND move the card on the kanban.
  // Previously this only changed local form state, so consultants had to
  // click 'Save details' for the column to update.
  const changeStage = async (newStage) => {
    if (newStage === form.application_stage) return;
    const previous = form.application_stage;
    setForm(f => ({ ...f, application_stage: newStage })); // optimistic
    try {
      await api.updateStage(leadId, { stage: newStage });
      await load();
      onChanged?.();
      const label = stages.find(s => s.key === newStage)?.label || newStage;
      toast.success(`Moved to ${label}`);
    } catch (e) {
      // Roll back local state on failure
      setForm(f => ({ ...f, application_stage: previous }));
      toast.error(e.message || 'Could not change stage');
    }
  };

  const advance = () => {
    const idx = stages.findIndex(s => s.key === (form.application_stage || stages[0]?.key || 'documents'));
    if (idx === -1 || idx >= stages.length - 1) return;
    return changeStage(stages[idx + 1].key);
  };

  const deleteLead = async () => {
    const ok = await confirm({
      title: `Delete ${lead.client_name}?`,
      body: `This will permanently remove this student from Applications and All Leads. The student portal link will stop working.`,
      tone: 'danger', confirmLabel: 'Delete student',
    });
    if (!ok) return;
    try {
      await api.deleteLead(leadId);
      toast.success(`${lead.client_name} deleted`);
      onChanged?.();
      onClose?.();
    } catch (e) { toast.error(e.message || 'Could not delete'); }
  };

  const setDocStatus = async (doc, status) => {
    setDocs(prev => prev.map(d => d.id === doc.id ? { ...d, status } : d));
    try { await api.updateDocument(doc.id, { status }); }
    catch (e) { toast.error(e.message || 'Failed'); load(); }
  };
  const addDoc = async () => {
    const name = prompt('Document name?');
    if (!name?.trim()) return;
    try { await api.addDocument(leadId, { doc_type: name.trim() }); load(); toast.success(`Added ${name.trim()}`); }
    catch (e) { toast.error(e.message); }
  };
  const removeDoc = async (doc) => {
    if (!await confirm({ title: `Remove "${doc.doc_type}"?`, tone: 'danger', confirmLabel: 'Remove' })) return;
    try { await api.deleteDocument(doc.id); load(); toast.info('Document removed'); }
    catch (e) { toast.error(e.message); }
  };

  const addUni = async () => {
    const name = prompt('University name? (e.g. NJTech)');
    if (!name?.trim()) return;
    try { await api.addUniversityApp(leadId, { university: name.trim(), status: 'ready' });
          load(); toast.success(`Added ${name.trim()}`); }
    catch (e) { toast.error(e.message); }
  };
  const setUniStatus = async (uni, status) => {
    setUnis(prev => prev.map(u => u.id === uni.id ? { ...u, status } : u));
    try { await api.updateUniversityApp(uni.id, { status }); onChanged?.(); }
    catch (e) { toast.error(e.message || 'Failed'); load(); }
  };
  const removeUni = async (uni) => {
    if (!await confirm({ title: `Remove ${uni.university}?`, tone: 'danger', confirmLabel: 'Remove' })) return;
    try { await api.deleteUniversityApp(uni.id); load(); toast.info('Removed'); }
    catch (e) { toast.error(e.message); }
  };

  if (!lead) {
    return <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/40 backdrop-blur-sm">
      <div className="bg-white h-full w-full max-w-2xl flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    </div>;
  }

  const currentIdx = (stages || []).findIndex(s => s.key === (form.application_stage || stages?.[0]?.key || 'documents'));
  const received = (docs || []).filter(d => d && ['received','verified'].includes(d.status)).length;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white h-full w-full max-w-2xl overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between z-10">
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-slate-800 truncate">{lead.client_name}</h3>
            <p className="text-xs text-slate-400 truncate">
              {lead.lead_id} · {lead.destination || 'No destination'} · {lead.assigned_consultant || 'Unassigned'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {form.drive_link && (
              <a href={ensureAbsoluteUrl(form.drive_link)} target="_blank" rel="noreferrer"
                className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200">
                <ExternalLink size={12} /> Drive folder
              </a>
            )}
            <button onClick={deleteLead}
              className="flex items-center gap-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-200">
              <Trash2 size={12} /> Delete
            </button>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"><X size={18} /></button>
          </div>
        </div>

        {/* Stage strip */}
        <div className="px-6 py-5 border-b border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <p className="font-semibold text-slate-700 text-sm">Application Stage</p>
            {currentIdx >= 0 && currentIdx < stages.length - 1 && stages[currentIdx + 1] && (
              <button onClick={advance} disabled={saving}
                className="text-xs font-medium px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 flex items-center gap-1.5">
                Advance to {stages[currentIdx + 1]?.label || 'Next Stage'} <ArrowRight size={13} />
              </button>
            )}
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2">
            {(stages || []).map((s, i) => (
              <div key={s.key} className="flex items-center gap-1.5">
                <button onClick={() => changeStage(s.key)} disabled={saving}
                  className={`text-xs whitespace-nowrap px-2.5 py-1.5 rounded-lg border transition-all disabled:opacity-50
                    ${i === currentIdx
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : i < currentIdx
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-white text-slate-500 border-slate-200 hover:border-blue-300'}`}>
                  {i < currentIdx ? <CheckCircle2 size={11} className="inline mr-1" /> : ''}{s.label}
                </button>
                {i < stages.length - 1 && <ChevronRight size={12} className="text-slate-300" />}
              </div>
            ))}
          </div>
        </div>

        {/* Excel-aligned student data */}
        <div className="px-6 py-5 border-b border-slate-100 space-y-3">
          <h4 className="font-semibold text-slate-700 text-sm">Student Details</h4>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Source (Remark)" type="select" value={form.source} onChange={v => updateField('source', v)}
              options={['', ...visibleSources]} />
            <Field label="Referrer (Referance)" value={form.referrer} onChange={v => updateField('referrer', v)}
              placeholder="e.g. BheUni, Mahmud, Office (M)" list="ref-list" />
            <datalist id="ref-list">{(referrers || []).map(r => <option key={r} value={r} />)}</datalist>

            <Field label="Nationality" value={form.nationality} onChange={v => updateField('nationality', v)} placeholder="Bangladesh" />
            <Field label="Passport" value={form.passport} onChange={v => updateField('passport', v)} placeholder="A12345678" mono />

            <Field label="Intake" value={form.intake_term} onChange={v => updateField('intake_term', v)} placeholder="September 2026" />
            <Field label="Degree" type="select" value={form.degree} onChange={v => updateField('degree', v)} options={['', ...DEGREES]} />

            <Field label="Major" value={form.major} onChange={v => updateField('major', v)} placeholder="International Economy" />
            <Field label="Primary university" value={form.university} onChange={v => updateField('university', v)} placeholder="e.g. NJTech" />

            <Field label="Visa deadline" type="date" value={form.visa_deadline} onChange={v => updateField('visa_deadline', v)} />
            <Field label="Departure date" type="date" value={form.departure_date} onChange={v => updateField('departure_date', v)} />

            <Field label="Drive folder link" value={form.drive_link} onChange={v => updateField('drive_link', v)} placeholder="https://drive.google.com/…" mono />
            <Field label="Deposit (৳)" type="number" value={form.deposit} onChange={v => updateField('deposit', v)} placeholder="0" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Notes</label>
            <textarea rows={2} value={form.application_notes} onChange={e => updateField('application_notes', e.target.value)}
              placeholder="Anything the next person should know…"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm" />
          </div>

          {/* Medical + emergency — needed for some destinations (China MBBS etc.) */}
          <details className="mt-1 group">
            <summary className="text-xs font-semibold text-slate-600 cursor-pointer hover:text-slate-800 list-none flex items-center gap-1">
              <span className="group-open:rotate-90 transition-transform inline-block">▸</span>
              Medical & Emergency contact
            </summary>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <Field label="Blood group" type="select" value={form.blood_group} onChange={v => updateField('blood_group', v)}
                options={['', 'A+','A-','B+','B-','AB+','AB-','O+','O-']} />
              <Field label="Date of birth" type="date" value={form.date_of_birth} onChange={v => updateField('date_of_birth', v)} />
              <div className="col-span-2">
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Emergency contact</label>
                <input value={form.emergency_contact} onChange={e => updateField('emergency_contact', e.target.value)}
                  placeholder="Name + phone, e.g. Father · +880 1XXX-XXXXXX"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm" />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Medical notes</label>
                <textarea rows={2} value={form.medical_notes} onChange={e => updateField('medical_notes', e.target.value)}
                  placeholder="Allergies, conditions, medications…"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm" />
              </div>
            </div>
          </details>

          <div className="flex justify-end">
            <button onClick={saveAll} disabled={saving}
              className="text-sm bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 disabled:opacity-60 flex items-center gap-2">
              <Save size={14} /> {saving ? 'Saving…' : 'Save details'}
            </button>
          </div>
        </div>

        {/* Share with student portal */}
        <ShareCard lead={lead} onChanged={load} />

        {/* University applications */}
        <div className="px-6 py-5 border-b border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="font-semibold text-slate-700 text-sm flex items-center gap-2">
                <Building2 size={14} /> University Applications
              </p>
              <p className="text-xs text-slate-400">Track status per uni — same idea as the NJTech / SUES / SXU columns</p>
            </div>
            <button onClick={addUni} className="text-xs font-medium px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 flex items-center gap-1.5">
              <Plus size={13} /> Add university
            </button>
          </div>
          {unis.length === 0 ? (
            <p className="text-sm text-slate-400 italic text-center py-6">No universities yet</p>
          ) : (
            <div className="space-y-1.5">
              {unis.map(u => <UniRow key={u.id} uni={u} onStatus={setUniStatus} onRemove={() => removeUni(u)} />)}
            </div>
          )}
        </div>

        {/* Documents */}
        <div className="px-6 py-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="font-semibold text-slate-700 text-sm flex items-center gap-2">
                <FileText size={14} /> Document Checklist
              </p>
              <p className="text-xs text-slate-400">{received} of {docs.length} received</p>
            </div>
            <button onClick={addDoc} className="text-xs font-medium px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 flex items-center gap-1.5">
              <Plus size={13} /> Add document
            </button>
          </div>
          {docs.length === 0 ? (
            <p className="text-sm text-slate-400 italic text-center py-6">No documents yet — set the destination to auto-seed the checklist.</p>
          ) : (
            <div className="space-y-1.5">
              {docs.map(d => <DocRow key={d.id} doc={d} onStatus={setDocStatus} onRemove={() => removeDoc(d)} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ──── small inputs ──── */
function Field({ label, value, onChange, type = 'text', placeholder, options, list, mono }) {
  const cls = `w-full border border-slate-200 rounded-xl px-3 py-2 text-sm ${mono ? 'font-mono' : ''}`;
  return (
    <div>
      <label className="text-xs font-semibold text-slate-600 mb-1 block">{label}</label>
      {type === 'select' ? (
        <select value={value} onChange={e => onChange(e.target.value)} className={cls}>
          {(options || []).map(o => <option key={o} value={o}>{o || '—'}</option>)}
        </select>
      ) : (
        <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} list={list} className={cls} />
      )}
    </div>
  );
}

function StatusDropdown({ statuses, current, onPick }) {
  const [open, setOpen] = useState(false);
  const cur = statuses.find(s => s.key === current) || statuses[0];
  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)} className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${cur.cls} flex items-center gap-1`}>
        {cur.label} <ChevronDown size={10} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl z-20 min-w-[130px] py-1">
            {statuses.map(s => (
              <button key={s.key} onClick={() => { onPick(s.key); setOpen(false); }}
                className={`w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 ${s.key === cur.key ? 'font-bold' : ''}`}>
                {s.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function DocRow({ doc, onStatus, onRemove }) {
  return (
    <div className="flex items-center gap-3 p-2.5 rounded-lg border border-slate-100 hover:border-slate-200 bg-white">
      <span className="text-sm text-slate-700 flex-1 truncate">{doc.doc_type}</span>
      {doc.received_on && <span className="text-[11px] text-slate-400">{doc.received_on}</span>}
      <StatusDropdown statuses={DOC_STATUSES} current={doc.status} onPick={s => onStatus(doc, s)} />
      <button onClick={onRemove} className="p-1 text-slate-300 hover:text-rose-500 rounded"><Trash2 size={13} /></button>
    </div>
  );
}

function UniRow({ uni, onStatus, onRemove }) {
  const [editing, setEditing] = useState(false);
  const [program, setProgram] = useState(uni.program || '');
  const [appId, setAppId]     = useState(uni.application_id || '');
  const [notes, setNotes]     = useState(uni.notes || '');

  const toast = useToast();
  const save = async () => {
    try { await api.updateUniversityApp(uni.id, { program, application_id: appId, notes });
          setEditing(false); toast.success(`${uni.university} updated`); }
    catch (e) { toast.error(e.message); }
  };

  return (
    <div className="rounded-lg border border-slate-100 hover:border-slate-200 bg-white">
      <div className="flex items-center gap-3 p-2.5">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-slate-700 truncate font-medium">{uni.university}</p>
          {uni.program && <p className="text-[11px] text-slate-400 truncate">{uni.program}</p>}
          {uni.application_id && (
            <p className="text-[11px] text-slate-500"><span className="font-mono bg-slate-50 px-1.5 py-0.5 rounded">App ID: {uni.application_id}</span></p>
          )}
          {(uni.submitted_on || uni.decision_on) && (
            <p className="text-[10px] text-slate-400 mt-0.5">
              {uni.submitted_on && <>submitted {uni.submitted_on}</>}
              {uni.submitted_on && uni.decision_on && ' · '}
              {uni.decision_on && <>decided {uni.decision_on}</>}
            </p>
          )}
        </div>
        <StatusDropdown statuses={UNI_STATUSES} current={uni.status} onPick={s => onStatus(uni, s)} />
        <button onClick={() => setEditing(e => !e)} title="Edit details"
          className="p-1 text-slate-300 hover:text-blue-500 rounded text-[11px] font-medium">
          {editing ? '×' : 'edit'}
        </button>
        <button onClick={onRemove} className="p-1 text-slate-300 hover:text-rose-500 rounded"><Trash2 size={13} /></button>
      </div>
      {editing && (
        <div className="px-2.5 pb-2.5 border-t border-slate-100 pt-2 space-y-1.5">
          <input value={program} onChange={e => setProgram(e.target.value)} placeholder="Program (e.g. MBBS)"
            className="w-full border border-slate-200 rounded-lg px-2 py-1 text-xs" />
          <input value={appId} onChange={e => setAppId(e.target.value)} placeholder="University application ID / file number"
            className="w-full border border-slate-200 rounded-lg px-2 py-1 text-xs font-mono" />
          <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (optional)"
            className="w-full border border-slate-200 rounded-lg px-2 py-1 text-xs" />
          <div className="flex justify-end">
            <button onClick={save} className="text-[11px] font-medium bg-blue-600 text-white px-2.5 py-1 rounded-lg hover:bg-blue-700">Save</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Share-with-student card ─── */
function ShareCard({ lead, onChanged }) {
  const [token, setToken] = useState(lead.public_token);
  const [enabled, setEnabled] = useState(!!lead.public_enabled);
  const [showQR, setShowQR] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  useEffect(() => { setToken(lead.public_token); setEnabled(!!lead.public_enabled); }, [lead.public_token, lead.public_enabled]);

  const url = token ? `${window.location.origin}/s/${token}` : null;

  const generate = async () => {
    setBusy(true);
    try {
      const r = await api.regenerateToken(lead.id);
      setToken(r.public_token); setEnabled(true);
      onChanged?.();
      toast.success('New share link generated');
    } catch (e) { toast.error(e.message); }
    setBusy(false);
  };

  const toggle = async () => {
    setBusy(true);
    try { await api.setPublic(lead.id, !enabled); setEnabled(!enabled); onChanged?.();
          toast.info(enabled ? 'Student link disabled' : 'Student link enabled'); }
    catch (e) { toast.error(e.message); }
    setBusy(false);
  };

  const copy = async () => {
    if (!url) return;
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {}
  };

  return (
    <div className="px-6 py-5 border-b border-slate-100">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="font-semibold text-slate-700 text-sm flex items-center gap-2">
            <Share2 size={14} className="text-slate-400" /> Student portal
          </p>
          <p className="text-xs text-slate-400">Give the student access to their progress tracker</p>
        </div>
      </div>
      
      {!token ? (
        <div className="text-center py-2 bg-slate-50 border border-dashed border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500 mb-3">No share link yet. Generate one to give the student access to their progress.</p>
          <button onClick={generate} disabled={busy}
            className="text-xs font-semibold bg-blue-600 text-white px-3.5 py-2 rounded-xl hover:bg-blue-700 disabled:opacity-50 inline-flex items-center gap-1.5 shadow-sm transition-all cursor-pointer">
            <Share2 size={12} /> {busy ? 'Generating…' : 'Generate share link'}
          </button>
        </div>
      ) : (
        <div className="space-y-2.5 bg-slate-50 border border-slate-200/60 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
              {enabled ? 'Active' : 'Disabled'}
            </span>
            <button onClick={toggle} disabled={busy}
              className="text-xs text-slate-500 hover:text-slate-700 underline cursor-pointer">
              {enabled ? 'Disable link' : 'Enable link'}
            </button>
          </div>
          
          <div className="bg-white border border-slate-200 rounded-xl p-2 flex items-center gap-2">
            <code className="text-[11px] flex-1 truncate text-slate-600 font-mono">{url}</code>
            <button onClick={copy} title="Copy"
              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all cursor-pointer">
              {copied ? <CheckCircle2 size={13} className="text-emerald-500" /> : <Copy size={13} />}
            </button>
          </div>
          
          <div className="flex gap-1.5">
            <a href={url} target="_blank" rel="noreferrer"
              className="flex-1 text-xs font-medium text-center text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all">
              <ExternalLink size={12} /> Open
            </a>
            <button onClick={() => setShowQR(s => !s)}
              className="flex-1 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 px-3 py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer">
              <QrCode size={12} /> {showQR ? 'Hide QR' : 'Show QR'}
            </button>
            <button onClick={generate} disabled={busy} title="Regenerate (invalidates old link)"
              className="text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 px-3 py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer">
              <RotateCw size={12} />
            </button>
          </div>
          
          {showQR && (
            <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col items-center mt-2 shadow-sm">
              <img src={api.qrUrl(lead.id)} alt="Student portal QR" width={200} height={200}
                className="rounded" loading="lazy" />
              <p className="text-[10px] text-slate-400 mt-2 text-center">Student scans → opens portal · works without login</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
