/* Applications Hub — redesigned per EduExpress business model
   ┌─────────────────────────────────────────────┐
   │ Source Markets  │  Bangladesh Channels        │
   │  All │ China* │ Bangladesh  │ Office │ B2B  │
   ├─────────────────────────────────────────────┤
   │ Destination: [All ▼] (syncable across app) │
   ├─────────────────────────────────────────────┤
   │ Kanban / Table view + filters               │
   └─────────────────────────────────────────────┘
   * China tab visible only to Founder & CEO + Application Manager
   * Destinations are where students GO TO (Malaysia, Thailand, China…)
   * Source markets are where students come FROM (China, Bangladesh)
*/
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { api } from '../api';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/Confirm';
import Modal from '../components/Modal';
import {
  GraduationCap, RefreshCw, X, CheckCircle2, ExternalLink,
  CalendarClock, MapPin, Save, ArrowRight, FileText, ChevronRight, ChevronLeft, Plus, Trash2,
  LayoutGrid, Table as TableIcon, Building2, ChevronDown,
  Share2, Copy, QrCode, RotateCw, Search, ArrowUpDown, Download, Filter,
  BarChart3, Clock, DollarSign, CheckCircle, Globe
} from 'lucide-react';
import { fmtCurrency, timeAgo } from '../lib/format';
import { isFullAdmin, userHasRole, canAddChinaApplication, canViewChinaData } from '../lib/roles';

const ensureAbsoluteUrl = (url) => {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  return 'https://' + url;
};

const STAGE_COLORS = {
  documents:          { bg: 'bg-slate-50 text-slate-700',  border: 'border-slate-200',   pill: 'bg-slate-200 text-slate-700' },
  ready:              { bg: 'bg-blue-50 text-blue-800',    border: 'border-blue-200',    pill: 'bg-blue-200 text-blue-800' },
  submitted:          { bg: 'bg-violet-50 text-violet-800',border: 'border-violet-200',  pill: 'bg-violet-200 text-violet-800' },
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
  enrolled:           { bg: 'bg-emerald-100 text-emerald-800', border: 'border-emerald-300', pill: 'bg-emerald-600 text-white font-bold' },
  cancelled:          { bg: 'bg-slate-100 text-slate-600', border: 'border-slate-300',   pill: 'bg-slate-500 text-white' },
  withdraw:           { bg: 'bg-orange-100 text-orange-800', border: 'border-orange-300', pill: 'bg-orange-600 text-white font-bold' },
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

const COUNTRY_EMOJIS = {
  china: '🇨🇳',
  malta: '🇲🇹',
  thailand: '🇹🇭',
  hungary: '🇭🇺',
  greece: '🇬🇷',
  estonia: '🇪🇪',
  georgia: '🇬🇪',
  malaysia: '🇲🇾',
  uk: '🇬🇧',
  'united kingdom': '🇬🇧',
  croatia: '🇭🇷',
  cyprus: '🇨🇾',
  finland: '🇫🇮',
  'south korea': '🇰🇷',
  korea: '🇰🇷',
  bangladesh: '🇧🇩',
  usa: '🇺🇸',
  canada: '🇨🇦',
  australia: '🇦🇺',
  germany: '🇩🇪',
  france: '🇫🇷'
};

const getCountryEmoji = (dest) => {
  if (!dest) return '🎓';
  const key = dest.toLowerCase().trim();
  return COUNTRY_EMOJIS[key] || '📍';
};

const getAvatarGradient = (name) => {
  if (!name) return 'from-blue-600 to-indigo-700';
  const char = name.charCodeAt(0) || 0;
  const gradients = [
    'from-blue-600 to-indigo-700',
    'from-emerald-600 to-teal-700',
    'from-violet-600 to-purple-700',
    'from-amber-500 to-orange-600',
    'from-rose-500 to-pink-600',
    'from-sky-600 to-cyan-700'
  ];
  return gradients[char % gradients.length];
};

const getInitials = (name) => {
  if (!name) return 'ST';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

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
  { key: 'pending',             label: 'Pending',             cls: 'bg-slate-100 text-slate-600' },
  { key: 'processing',          label: 'Processing',          cls: 'bg-indigo-100 text-indigo-700' },
  { key: 'initial_review_pass', label: 'Initial Review Pass', cls: 'bg-sky-100 text-sky-700' },
  { key: 'interview',           label: 'Interview',           cls: 'bg-amber-100 text-amber-700' },
  { key: 'pre_admission',       label: 'Pre-Admission',       cls: 'bg-cyan-100 text-cyan-700' },
  { key: 'admitted',            label: 'Admitted',            cls: 'bg-emerald-100 text-emerald-700 font-bold' },
  { key: 'returned',            label: 'Returned',            cls: 'bg-orange-100 text-orange-700 font-medium' },
  { key: 'rejected',            label: 'Rejected',            cls: 'bg-rose-100 text-rose-700 font-medium' },
];

const DEGREES = ['Diploma', 'Bachelor', 'Masters', 'PhD', 'L+Bachelor', 'L+Diploma'];

function unique(arr) { return Array.from(new Set(arr.filter(Boolean))).sort(); }

export default function Applications({ user }) {
  const isAgentUser = user?.roles?.includes('agent');
  useEffect(() => { document.title = 'Applications Hub | EduExpress Core'; }, []);
  const toast = useToast();
  const confirm = useConfirm();

  const [meta, setMeta] = useState({ stages: [], destinations: [], sources: [], bdChannels: [] });
  const [settings, setSettings] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [stages, setStages] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  // ── Source Market (business model) ──
  const [sourceMarket, setSourceMarket] = useState(() => {
    const saved = localStorage.getItem('app_source_market');
    if (saved === 'china' && !canViewChinaData(user)) return 'all';
    return saved || 'all';
  });
  const [bdChannel, setBdChannel] = useState(() => localStorage.getItem('app_bd_channel') || 'office');

  // ── Destination (where students GO TO — syncable across app) ──
  const [destinationFilter, setDestinationFilter] = useState(() => {
    return localStorage.getItem('global_destination') || 'all';
  });

  const [view, setView] = useState(() => localStorage.getItem('app_view') || 'kanban');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStage, setFilterStage] = useState('all');
  const [filterUniversity, setFilterUniversity] = useState('all');
  const [filterConsultant, setFilterConsultant] = useState('all');
  const [filterSource, setFilterSource] = useState('all');
  const [sortConfig, setSortConfig] = useState({ key: null, dir: 'asc' });
  const [hideEmptyColumns, setHideEmptyColumns] = useState(() => localStorage.getItem('hide_empty_cols') === 'true');

  const [newApp, setNewApp] = useState({
    client_name: '', phone: '', nationality: 'Bangladesh', destination: '', degree: 'Bachelor', major: '',
    university: '', source: '', referrer: '', assigned_employee_id: '',
  });

  // Load meta + settings + employees once on mount
  useEffect(() => {
    api.settings().then(s => {
      setSettings(s);
      if (s && s.employees) setEmployees(s.employees);
    }).catch(() => {});

    api.applicationMeta().then(m => {
      setMeta(m || { stages: [], destinations: [], sources: [], bdChannels: [] });
      setStages(m?.stages || []);
      // Validate saved source market against permissions
      setSourceMarket(prev => {
        if (prev === 'china' && !canViewChinaData(user)) return 'all';
        return prev;
      });
    }).catch(() => {});
  }, [user]);

  useEffect(() => { localStorage.setItem('app_source_market', sourceMarket); }, [sourceMarket]);
  useEffect(() => { localStorage.setItem('app_bd_channel', bdChannel); }, [bdChannel]);
  useEffect(() => { localStorage.setItem('global_destination', destinationFilter); }, [destinationFilter]);
  useEffect(() => { localStorage.setItem('app_view', view); }, [view]);
  useEffect(() => { localStorage.setItem('hide_empty_cols', hideEmptyColumns); }, [hideEmptyColumns]);
  useEffect(() => { setSelectedIds([]); }, [sourceMarket, bdChannel, destinationFilter, view, filterStage, filterUniversity, filterConsultant, filterSource, searchQuery]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (sourceMarket && sourceMarket !== 'all') params.source_market = sourceMarket;
      if (sourceMarket === 'bangladesh' && bdChannel && bdChannel !== 'all') params.bd_channel = bdChannel;
      if (destinationFilter && destinationFilter !== 'all') params.destination = destinationFilter;
      const d = await api.applications(params);
      setStages(d.stages || []);
      setRows(d.rows || []);
    } finally { setLoading(false); }
  }, [sourceMarket, bdChannel, destinationFilter]);
  useEffect(() => { load(); }, [load]);

  // ── Client-side filtering (on top of server-side) ──
  const filtered = useMemo(() => {
    let list = [...rows];
    if (filterStage !== 'all') {
      list = list.filter(r => (r.application_stage || stages[0]?.key || 'documents') === filterStage);
    }
    if (filterUniversity !== 'all') {
      list = list.filter(r => (r.university || '').toLowerCase().includes(filterUniversity.toLowerCase()) || (r.uni_list || '').toLowerCase().includes(filterUniversity.toLowerCase()));
    }
    if (filterConsultant !== 'all') {
      list = list.filter(r => String(r.assigned_employee_id || r.assigned_consultant || '') === filterConsultant);
    }
    if (filterSource !== 'all') {
      list = list.filter(r => r.source === filterSource);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(r =>
        (r.client_name || '').toLowerCase().includes(q) ||
        (r.phone || '').toLowerCase().includes(q) ||
        (r.passport || '').toLowerCase().includes(q) ||
        (r.university || '').toLowerCase().includes(q) ||
        (r.lead_id || '').toLowerCase().includes(q)
      );
    }
    if (sortConfig.key) {
      list.sort((a, b) => {
        const av = a[sortConfig.key] || '';
        const bv = b[sortConfig.key] || '';
        if (typeof av === 'number' && typeof bv === 'number') return sortConfig.dir === 'asc' ? av - bv : bv - av;
        return sortConfig.dir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
      });
    }
    return list;
  }, [rows, filterStage, filterUniversity, filterConsultant, filterSource, searchQuery, sortConfig, stages]);

  const stageCounts = useMemo(() => {
    const m = Object.fromEntries(stages.map(s => [s.key, 0]));
    const defaultStage = stages[0]?.key || 'documents';
    rows.forEach(r => {
      const k = stages.some(s => s.key === r.application_stage) ? r.application_stage : defaultStage;
      m[k] = (m[k] || 0) + 1;
    });
    return m;
  }, [rows, stages]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const docs = filtered.filter(r => r.docs_received > 0).length;
    const submitted = filtered.filter(r => ['submitted','interview','in_review','pre_admission','admitted','jw202','visa_applied','visa_approved','enrolled'].includes(r.application_stage)).length;
    const admitted = filtered.filter(r => ['admitted','jw202','visa_applied','visa_approved','enrolled'].includes(r.application_stage)).length;
    const visa = filtered.filter(r => ['visa_approved','enrolled'].includes(r.application_stage)).length;
    const enrolled = filtered.filter(r => r.application_stage === 'enrolled').length;
    return { total, docs, submitted, admitted, visa, enrolled };
  }, [filtered]);

  const universities = useMemo(() => {
    const fromRows = rows.map(r => r.university).concat(rows.flatMap(r => (r.uni_list || '').split(', '))).filter(Boolean);
    const defaults = [
      'Sichuan University', 'Zhejiang University', 'Tsinghua University', 'Peking University',
      'Nanjing University', 'Wuhan University', 'Harbin Institute of Technology', 'Xi\'an Jiaotong University',
      'Tongji University', 'Fudan University', 'Jiangsu University', 'Guangdong University of Technology',
      'Universiti Malaya', 'Universiti Putra Malaysia', 'University of Malta', 'Chulalongkorn University'
    ];
    return unique([...fromRows, ...defaults]);
  }, [rows]);

  const majors = useMemo(() => {
    const fromRows = rows.map(r => r.major).concat(rows.map(r => r.program)).filter(Boolean);
    const defaults = [
      'Computer Science & Engineering', 'Software Engineering', 'MBBS (General Medicine)',
      'Business Administration (BBA)', 'Master of Business Administration (MBA)',
      'Civil Engineering', 'Mechanical Engineering', 'Electrical & Electronic Engineering (EEE)',
      'International Business & Trade', 'Information Technology', 'Cyber Security',
      'Data Science & AI', 'Pharmacy', 'Hospitality & Tourism Management'
    ];
    return unique([...fromRows, ...defaults]);
  }, [rows]);

  const consultants = useMemo(() => {
    // Use settings.consultants (same source as Leads & Settings) for consistent filter list
    const list = (settings?.consultants || []).map(name => ({ value: name, label: name }));
    // Add legacy consultants from current rows that are not in the settings list
    const legacy = new Set();
    rows.forEach(r => {
      if (r.assigned_consultant && !settings?.consultants?.includes(r.assigned_consultant)) {
        legacy.add(r.assigned_consultant);
      }
    });
    legacy.forEach(name => list.push({ value: name, label: `${name} (legacy)` }));
    return list.sort((a, b) => a.label.localeCompare(b.label));
  }, [rows, settings]);

  const isFilterActive = filterStage !== 'all' || filterUniversity !== 'all' || filterConsultant !== 'all' || filterSource !== 'all' || searchQuery || destinationFilter !== 'all';

  const handleBulkDelete = async () => {
    try {
      await Promise.all(selectedIds.map(id => api.deleteLead(id)));
      setSelectedIds([]); setBulkDeleting(false); load();
      toast.success(`${selectedIds.length} applications deleted`);
    } catch (err) { toast.error(err.message || 'Could not delete'); }
  };

  const handleCreateApplication = async (e) => {
    e.preventDefault();
    if (!newApp.client_name || !newApp.phone) { toast.error('Name and phone required'); return; }
    try {
      const payload = { ...newApp, lead_status: 'File Opened', application_stage: 'documents' };
      if (payload.assigned_employee_id) {
        payload.assigned_employee_id = Number(payload.assigned_employee_id);
      }
      await api.createLead(payload);
      toast.success(`Application for ${newApp.client_name} created`);
      setShowAddModal(false);

      // Auto-align active filters so the newly created application is GUARANTEED to show!
      if (destinationFilter !== 'all' && destinationFilter !== payload.destination) {
        setDestinationFilter('all');
      }
      if (sourceMarket !== 'all') {
        const pMarket = (payload.lead_market || '').toLowerCase();
        if (pMarket && pMarket !== sourceMarket.toLowerCase()) {
          setSourceMarket('all');
        }
      }
      if (filterStage !== 'all') setFilterStage('all');
      if (searchQuery) setSearchQuery('');

      setNewApp({
        client_name: '', phone: '', nationality: 'Bangladesh', destination: settings?.destinations?.[0] || '', degree: 'Bachelor', major: '',
        university: '', source: meta.sources?.[0]?.key || '', lead_market: 'Bangladesh', lead_type: 'B2C', referrer: '', assigned_employee_id: '',
      });
      load();
    } catch (err) { toast.error(err.message || 'Could not create'); }
  };

  const handleExportExcel = () => {
    const data = filtered.map(r => ({
      'Lead ID': r.lead_id, 'Name': r.client_name, 'Phone': r.phone, 'Destination': r.destination,
      'Market': r.lead_market, 'Type': r.lead_type, 'Channel': r.source, 'Stage': stages.find(s => s.key === r.application_stage)?.label || r.application_stage,
      'University': r.university, 'Degree': r.degree, 'Major': r.major, 'Consultant': r.employee_name || r.assigned_consultant,
      'Deposit': r.deposit, 'Balance': r.balance, 'Passport': r.passport, 'Nationality': r.nationality,
    }));
    if (!data.length) { toast.info('No data to export'); return; }
    import('xlsx').then(XLSX => {
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Applications');
      const regionLabel = sourceMarket === 'all' ? 'all' : sourceMarket.toLowerCase().replace(/\s+/g, '_');
      XLSX.writeFile(wb, `applications_${regionLabel}_${new Date().toISOString().slice(0,10)}.xlsx`);
      toast.success('Exported to Excel');
    }).catch(() => toast.error('Excel export failed'));
  };

  // ── Helpers for add-modal defaults based on current tab ──
  const getDefaultSourceForTab = () => {
    if (sourceMarket === 'china') return 'China';
    if (sourceMarket === 'bangladesh') {
      if (bdChannel === 'b2b') return 'B2B';
      return 'In-House';
    }
    return meta.sources?.[0]?.key || '';
  };

  const getDefaultDestinationForTab = () => {
    if (destinationFilter && destinationFilter !== 'all') return destinationFilter;
    return settings?.destinations?.[0] || '';
  };

  return (
    <div className="space-y-5">
      {/* Executive Banner Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden">
        <div className="bg-blue-500/10 blur-3xl rounded-full absolute -right-10 -top-10 w-72 h-72 pointer-events-none" />
        <div className="bg-indigo-500/10 blur-3xl rounded-full absolute -left-10 -bottom-10 w-72 h-72 pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="w-13 h-13 rounded-2xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400 shadow-inner flex-shrink-0">
              <GraduationCap size={28} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-2xl font-black text-white tracking-tight">Applications Hub</h2>
                <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 uppercase tracking-wider">
                  {filtered.length} Active
                </span>
              </div>
              <p className="text-xs text-slate-300/80 mt-1 flex items-center gap-2 flex-wrap font-medium">
                <span>{sourceMarket === 'all' ? '🌐 All Markets' : sourceMarket === 'china' ? '🇨🇳 China Market' : '🇧🇩 Bangladesh Market'}</span>
                {sourceMarket === 'bangladesh' && <span className="opacity-75">· {bdChannel === 'office' ? '🏢 Office (In-House)' : '🤝 B2B / Partner Agent'}</span>}
                {destinationFilter !== 'all' && <span className="opacity-90 font-semibold text-blue-300">· Destination: {getCountryEmoji(destinationFilter)} {destinationFilter}</span>}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button onClick={load} disabled={loading} title="Refresh data"
              className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white transition-all active:scale-95 cursor-pointer backdrop-blur-md">
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>

            {selectedIds.length > 0 && isFullAdmin(user) && (
              <button onClick={() => setBulkDeleting(true)}
                className="flex items-center gap-2 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-lg shadow-rose-600/30 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer">
                <Trash2 size={15} /> Delete ({selectedIds.length})
              </button>
            )}

            {(isFullAdmin(user) || userHasRole(user, 'application_manager')) && (
              <button onClick={handleExportExcel}
                className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-lg shadow-emerald-600/25 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer">
                <Download size={15} /> Export Excel
              </button>
            )}

            {!isAgentUser && (sourceMarket !== 'china' || canAddChinaApplication(user)) && (
              <button onClick={() => {
                setNewApp(prev => ({
                  ...prev,
                  destination: getDefaultDestinationForTab(),
                  source: getDefaultSourceForTab()
                }));
                setShowAddModal(true);
              }} className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-lg shadow-blue-500/30 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer">
                <Plus size={16} /> Add Application
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Source Market Segmented Tabs & Destination Filter Bar */}
      {!isAgentUser && (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-3 shadow-sm space-y-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Market Tabs */}
            <div className="bg-slate-100/90 p-1 rounded-2xl border border-slate-200/80 inline-flex flex-wrap gap-1">
              <button onClick={() => { setSourceMarket('all'); setBdChannel('all'); }}
                className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 ${sourceMarket === 'all' ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20' : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'}`}>
                🌐 All Markets
              </button>

              {canViewChinaData(user) && (
                <button onClick={() => { setSourceMarket('china'); setBdChannel('all'); }}
                  className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 ${sourceMarket === 'china' ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-md shadow-amber-500/20' : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'}`}>
                  🇨🇳 China Market <span className="text-[10px] opacity-80">(Source)</span>
                </button>
              )}

              <button onClick={() => { setSourceMarket('bangladesh'); setBdChannel('all'); }}
                className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 ${sourceMarket === 'bangladesh' ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-500/20' : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'}`}>
                🇧🇩 Bangladesh Market <span className="text-[10px] opacity-80">(Source)</span>
              </button>
            </div>

            {/* Bangladesh Channel Sub-tabs */}
            {sourceMarket === 'bangladesh' && (
              <div className="bg-slate-50 p-1 rounded-xl border border-slate-200/70 inline-flex gap-1 flex-wrap">
                <button onClick={() => setBdChannel('all')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${bdChannel === 'all' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200/60'}`}>
                  🌐 All Channels
                </button>
                <button onClick={() => setBdChannel('office')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${bdChannel === 'office' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200/60'}`}>
                  🏢 Office (In-House)
                </button>
                <button onClick={() => setBdChannel('b2b')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${bdChannel === 'b2b' ? 'bg-violet-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200/60'}`}>
                  🤝 B2B / Agent
                </button>
              </div>
            )}
          </div>

          {/* Quick Destination Pills */}
          <div className="pt-2 border-t border-slate-100 flex items-center gap-2 overflow-x-auto pb-1">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1 flex-shrink-0 mr-1">
              <Globe size={13} className="text-blue-500" /> Destination:
            </span>
            <button onClick={() => setDestinationFilter('all')}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all flex-shrink-0 ${destinationFilter === 'all' ? 'bg-blue-50 text-blue-700 border-blue-300 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}>
              🌐 All Destinations
            </button>
            {settings?.destinations?.map(dest => {
              const active = destinationFilter === dest;
              const flag = getCountryEmoji(dest);
              return (
                <button key={dest} onClick={() => setDestinationFilter(active ? 'all' : dest)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all flex items-center gap-1.5 flex-shrink-0 ${active ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-blue-600 shadow-md shadow-blue-500/20 scale-[1.02]' : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300'}`}>
                  <span>{flag}</span> {dest}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Total Apps', value: stats.total, icon: BarChart3, border: 'border-blue-200', bg: 'from-blue-50/80 to-white', color: 'text-blue-600', iconBg: 'bg-blue-500/10' },
          { label: 'Docs Ready', value: stats.docs, icon: FileText, border: 'border-slate-200', bg: 'from-slate-50/80 to-white', color: 'text-slate-700', iconBg: 'bg-slate-500/10' },
          { label: 'Submitted', value: stats.submitted, icon: ArrowRight, border: 'border-violet-200', bg: 'from-violet-50/80 to-white', color: 'text-violet-600', iconBg: 'bg-violet-500/10' },
          { label: 'Admitted', value: stats.admitted, icon: CheckCircle, border: 'border-emerald-200', bg: 'from-emerald-50/80 to-white', color: 'text-emerald-600', iconBg: 'bg-emerald-500/10' },
          { label: 'Visa Approved', value: stats.visa, icon: CheckCircle2, border: 'border-green-200', bg: 'from-green-50/80 to-white', color: 'text-green-600', iconBg: 'bg-green-500/10' },
          { label: 'Enrolled', value: stats.enrolled, icon: GraduationCap, border: 'border-indigo-200', bg: 'from-indigo-50/80 to-white', color: 'text-indigo-600', iconBg: 'bg-indigo-500/10' },
        ].map(s => (
          <div key={s.label} className={`bg-gradient-to-br ${s.bg} rounded-2xl border ${s.border} p-3.5 shadow-sm hover:shadow-md transition-all flex items-center justify-between`}>
            <div>
              <p className="text-2xl font-black text-slate-900 tracking-tight leading-tight">{s.value}</p>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">{s.label}</p>
            </div>
            <div className={`w-10 h-10 rounded-xl ${s.iconBg} ${s.color} flex items-center justify-center flex-shrink-0`}>
              <s.icon size={20} />
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar Filters */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 shadow-sm flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" className="pl-10 pr-9 h-10 bg-slate-50 border border-slate-200/90 rounded-xl text-xs font-medium w-full focus:outline-none focus:ring-2 focus:ring-blue-400/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
            placeholder="Search student, phone, passport, university…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-200 transition-colors"><X size={14} /></button>
          )}
        </div>
        
        <select value={filterStage} onChange={e => setFilterStage(e.target.value)}
          className={`h-10 min-w-[140px] px-3 py-2 border rounded-xl text-xs font-semibold bg-white transition-all cursor-pointer focus:ring-2 focus:ring-blue-100 ${filterStage !== 'all' ? 'border-blue-500 text-blue-700 bg-blue-50/50' : 'border-slate-200 text-slate-700 hover:border-slate-300'}`}>
          <option value="all">All Stages</option>
          {stages.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        
        <select value={filterUniversity} onChange={e => setFilterUniversity(e.target.value)}
          className={`h-10 min-w-[150px] px-3 py-2 border rounded-xl text-xs font-semibold bg-white transition-all cursor-pointer focus:ring-2 focus:ring-blue-100 max-w-[180px] ${filterUniversity !== 'all' ? 'border-blue-500 text-blue-700 bg-blue-50/50' : 'border-slate-200 text-slate-700 hover:border-slate-300'}`}>
          <option value="all">All Universities</option>
          {universities.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
        
        <select value={filterSource} onChange={e => setFilterSource(e.target.value)}
          className={`h-10 min-w-[140px] px-3 py-2 border rounded-xl text-xs font-semibold bg-white transition-all cursor-pointer focus:ring-2 focus:ring-blue-100 max-w-[180px] ${filterSource !== 'all' ? 'border-blue-500 text-blue-700 bg-blue-50/50' : 'border-slate-200 text-slate-700 hover:border-slate-300'}`}>
          <option value="all">All Sources</option>
          {meta.sources?.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        
        <select value={filterConsultant} onChange={e => setFilterConsultant(e.target.value)}
          className={`h-10 min-w-[150px] px-3 py-2 border rounded-xl text-xs font-semibold bg-white transition-all cursor-pointer focus:ring-2 focus:ring-blue-100 ${filterConsultant !== 'all' ? 'border-blue-500 text-blue-700 bg-blue-50/50' : 'border-slate-200 text-slate-700 hover:border-slate-300'}`}>
          <option value="all">All Consultants</option>
          {consultants.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>

        {isFilterActive && (
          <button onClick={() => { setSearchQuery(''); setFilterStage('all'); setFilterUniversity('all'); setFilterSource('all'); setFilterConsultant('all'); setDestinationFilter('all'); }}
            className="flex items-center gap-1.5 h-10 text-xs font-bold text-rose-600 px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 transition-all border border-rose-200">
            <X size={14} /> Clear Filters
          </button>
        )}
      </div>

      {/* Stage Pipeline Buttons */}
      {stages.length > 0 && rows.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          <button onClick={() => setFilterStage('all')}
            className={`flex-shrink-0 text-xs font-bold px-3.5 py-2 rounded-xl border transition-all ${filterStage === 'all' ? 'bg-slate-900 text-white border-slate-900 shadow-md' : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300'}`}>
            All Stages <span className="ml-1 opacity-75">({rows.length})</span>
          </button>
          {stages.map((s, index) => {
            const n = stageCounts[s.key] || 0;
            const active = filterStage === s.key;
            const color = STAGE_COLORS[s.key] || STAGE_COLORS_LIST[index % STAGE_COLORS_LIST.length];
            return (
              <button key={s.key} onClick={() => setFilterStage(active ? 'all' : s.key)} disabled={n === 0}
                className={`flex-shrink-0 flex items-center gap-2 text-xs font-bold px-3.5 py-2 rounded-xl border transition-all
                  ${active ? `${color.bg} border-blue-500 shadow-md scale-[1.02] text-slate-900` : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300 disabled:opacity-40 disabled:cursor-not-allowed'}`}>
                <span className={`w-2 h-2 rounded-full ${color.pill.split(' ')[0]}`} />
                {s.label}
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${active ? 'bg-white shadow-sm' : 'bg-slate-100'}`}>{n}</span>
              </button>
            );
          })}
        </div>
      )}

      {loading && rows.length === 0 ? (
        <div className="text-slate-400 text-center py-16">Loading…</div>
      ) : filtered.length === 0 ? (
        <EmptyState />
      ) : (
        <TableView rows={filtered} onPick={setSelected} stages={stages} selectedIds={selectedIds} setSelectedIds={setSelectedIds} user={user} sortConfig={sortConfig} setSortConfig={setSortConfig} />
      )}

      {selected && <ApplicationPanel leadId={selected.id} stages={stages} onClose={() => setSelected(null)} onChanged={load} user={user} employees={employees} settings={settings} />}

      {bulkDeleting && (
        <Modal title="Delete Applications" icon={Trash2} onClose={() => setBulkDeleting(false)}>
          <div className="space-y-5">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-rose-50 text-rose-600 flex-shrink-0">
                <Trash2 size={20} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">Permanently delete {selectedIds.length} selected records?</p>
                <p className="text-sm text-slate-500 mt-1">This action cannot be undone. Student portal links and all associated data will be removed.</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button onClick={() => setBulkDeleting(false)} className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
              <button onClick={handleBulkDelete} className="px-4 py-2 bg-rose-600 text-white rounded-xl text-sm font-semibold hover:bg-rose-700 transition-colors flex items-center gap-1.5">
                <Trash2 size={14} /> Delete All
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showAddModal && (
        <Modal title="Add Application" icon={Plus} onClose={() => setShowAddModal(false)}>
          <form onSubmit={handleCreateApplication} className="space-y-5">
            {/* Student Identity */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Student Identity</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Full Name <span className="text-red-500">*</span></label>
                  <input type="text" required value={newApp.client_name} onChange={e => setNewApp({ ...newApp, client_name: e.target.value })} placeholder="e.g. Md Saiful Haque"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Phone Number <span className="text-red-500">*</span></label>
                  <input type="tel" required value={newApp.phone} onChange={e => setNewApp({ ...newApp, phone: e.target.value })} placeholder="e.g. +88017XXXXXXXX"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all" />
                </div>
              </div>
            </div>

            {/* Program & Destination */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Program & Destination</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Destination <span className="text-slate-400">(where they go)</span></label>
                  <select value={newApp.destination} onChange={e => setNewApp({ ...newApp, destination: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all cursor-pointer">
                    {settings?.destinations?.map(dest => <option key={dest} value={dest}>{dest}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Degree</label>
                  <select value={newApp.degree} onChange={e => setNewApp({ ...newApp, degree: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all cursor-pointer">
                    {DEGREES.map(deg => <option key={deg} value={deg}>{deg}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Major / Program</label>
                  <input type="text" list="app-major-list" value={newApp.major} onChange={e => setNewApp({ ...newApp, major: e.target.value })} placeholder="e.g. Computer Science & Engineering"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all" />
                  <datalist id="app-major-list">
                    {majors.map(m => <option key={m} value={m} />)}
                  </datalist>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Primary University</label>
                  <input type="text" list="app-uni-list" value={newApp.university} onChange={e => setNewApp({ ...newApp, university: e.target.value })} placeholder="e.g. Sichuan University"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all" />
                  <datalist id="app-uni-list">
                    {universities.map(u => <option key={u} value={u} />)}
                  </datalist>
                </div>
              </div>
            </div>

            {/* Source & Assignment */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Source & Assignment</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Market & Type</label>
                  <div className="flex gap-2">
                    <select value={newApp.lead_market} onChange={e => setNewApp({ ...newApp, lead_market: e.target.value })}
                      className="w-1/2 px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all cursor-pointer">
                      <option value="Bangladesh">Bangladesh</option>
                      <option value="China">China</option>
                    </select>
                    <select value={newApp.lead_type} onChange={e => setNewApp({ ...newApp, lead_type: e.target.value })}
                      className="w-1/2 px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all cursor-pointer">
                      <option value="B2C">B2C</option>
                      <option value="B2B">B2B</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Acquisition Channel</label>
                  <select value={newApp.source} onChange={e => setNewApp({ ...newApp, source: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all cursor-pointer">
                    {meta.sources?.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Referrer</label>
                  <input type="text" value={newApp.referrer} onChange={e => setNewApp({ ...newApp, referrer: e.target.value })} placeholder="e.g. BheUni, Mahmud"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all" />
                </div>
              </div>
              <div className="mt-3">
                <label className="block text-xs font-semibold text-slate-600 mb-1">Assigned Consultant</label>
                <select value={newApp.assigned_employee_id} onChange={e => setNewApp({ ...newApp, assigned_employee_id: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all cursor-pointer">
                  <option value="">Unassigned</option>
                  {employees.map(e => <option key={e.id} value={String(e.id)}>{e.name}</option>)}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
              <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
              <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors flex items-center gap-1.5">
                <Save size={14} /> Create Application
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
      <GraduationCap size={36} className="text-slate-300 mx-auto mb-3" />
      <p className="text-slate-600 font-semibold">No applications match the current filters</p>
      <p className="text-xs text-slate-400 mt-1">Mark a lead as <strong>File Opened</strong> to start its application.</p>
    </div>
  );
}



/* ───────────────────────────── TABLE ───────────────────────────── */
function TableView({ rows, onPick, stages, selectedIds, setSelectedIds, user, sortConfig, setSortConfig }) {
  const stageLabel = (key) => stages.find(s => s.key === key)?.label || '—';
  const toggleSort = (key) => {
    setSortConfig(prev => ({ key, dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc' }));
  };
  const SortIcon = ({ col }) => {
    if (sortConfig.key !== col) return <ArrowUpDown size={10} className="text-slate-300 ml-1" />;
    return <ArrowUpDown size={10} className={sortConfig.dir === 'asc' ? 'text-blue-600 ml-1' : 'text-blue-600 ml-1 rotate-180'} />;
  };

  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [rows]);
  
  const pageSize = 50;
  const total = rows.length;
  const pages = Math.ceil(total / pageSize) || 1;
  const paginatedRows = rows.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <Th><input type="checkbox" checked={rows.length > 0 && rows.every(r => selectedIds.includes(r.id))}
                onChange={(e) => { if (e.target.checked) { setSelectedIds(prev => Array.from(new Set([...prev, ...rows.map(r => r.id)]))); } else { setSelectedIds(prev => prev.filter(id => !rows.map(r => r.id).includes(id))); } }}
                onClick={e => e.stopPropagation()} className="rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer" /></Th>
              <Th onClick={() => toggleSort('client_name')}>Name <SortIcon col="client_name" /></Th>
              <Th>Market / Type / Channel</Th>
              <Th onClick={() => toggleSort('destination')}>Destination <SortIcon col="destination" /></Th>
              <Th onClick={() => toggleSort('nationality')}>Nationality <SortIcon col="nationality" /></Th>
              <Th>Passport</Th>
              <Th>Intake</Th>
              <Th>Degree</Th>
              <Th>Major</Th>
              <Th onClick={() => toggleSort('application_stage')}>Stage <SortIcon col="application_stage" /></Th>
              <Th>Universities</Th>
              <Th>Consultant</Th>
              <Th>Deposit</Th>
              <Th>Balance</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginatedRows.map((r) => {
              const flag = getCountryEmoji(r.destination);
              const stageInfo = STAGE_COLORS[r.application_stage] || { bg: 'bg-slate-100 text-slate-700', border: 'border-slate-200', pill: 'bg-slate-500' };
              const initials = getInitials(r.client_name);
              const avatarGrad = getAvatarGradient(r.client_name);

              return (
                <tr key={r.id} onClick={() => onPick(r)}
                  className="even:bg-slate-50/50 hover:bg-blue-50/80 transition-all cursor-pointer group border-l-4 border-l-transparent hover:border-l-blue-600">
                  <Td onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={selectedIds.includes(r.id)} onChange={(e) => { if (e.target.checked) setSelectedIds(prev => [...prev, r.id]); else setSelectedIds(prev => prev.filter(id => id !== r.id)); }}
                      className="rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer" />
                  </Td>
                  <Td>
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${avatarGrad} text-white font-extrabold text-xs flex items-center justify-center shadow-sm flex-shrink-0`}>
                        {initials}
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors text-xs sm:text-sm">{r.client_name}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 text-slate-500 font-semibold">{r.lead_id}</span>
                          {r.phone && <span className="text-[10px] text-slate-400 font-medium">{r.phone}</span>}
                        </div>
                      </div>
                    </div>
                  </Td>
                  <Td>
                    <div className="flex flex-col gap-1">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md border w-max
                        ${r.lead_market === 'China' ? 'bg-amber-50 text-amber-800 border-amber-200 shadow-2xs' : (r.lead_type === 'B2B') ? 'bg-violet-50 text-violet-800 border-violet-200 shadow-2xs' : 'bg-emerald-50 text-emerald-800 border-emerald-200 shadow-2xs'}`}>
                        {r.lead_market === 'China' ? '🇨🇳 China' : '🇧🇩 BD'} · {r.lead_type || 'B2C'}
                      </span>
                      {r.source && <span className="text-[10px] text-slate-400 font-medium truncate max-w-[120px]">{r.source}</span>}
                    </div>
                  </Td>
                  <Td>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100/90 text-slate-800 font-bold text-xs border border-slate-200/70 shadow-2xs">
                      <span>{flag}</span> {r.destination || 'Unspecified'}
                    </span>
                  </Td>
                  <Td className="text-xs text-slate-600 font-medium">{r.nationality || '—'}</Td>
                  <Td className="font-mono text-xs text-slate-700 bg-slate-50 px-2 py-1 rounded border border-slate-200/50 w-max">{r.passport || '—'}</Td>
                  <Td className="text-xs font-semibold text-slate-700">{r.intake_term || '—'}</Td>
                  <Td><span className="text-xs font-semibold text-slate-700 px-2 py-0.5 rounded bg-slate-100">{r.degree || '—'}</span></Td>
                  <Td className="max-w-[180px] truncate text-xs text-slate-700 font-medium" title={r.major || r.program || r.university}>{r.major || r.program || r.university || '—'}</Td>
                  <Td>
                    <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-xl border shadow-2xs ${stageInfo.bg} ${stageInfo.border}`}>
                      <span className={`w-2 h-2 rounded-full ${stageInfo.pill.split(' ')[0]} animate-pulse`} />
                      {stageLabel(r.application_stage)}
                    </span>
                  </Td>
                  <Td className="max-w-[200px] truncate text-xs text-slate-600 font-medium" title={r.uni_list}>{r.uni_list || '—'}</Td>
                  <Td className="text-xs font-medium text-slate-700">{r.employee_name || r.assigned_consultant || '—'}</Td>
                  <Td className="font-bold text-xs text-emerald-700">{r.deposit ? fmtCurrency(r.deposit) : '—'}</Td>
                  <Td className="font-bold text-xs text-amber-700">{r.balance > 0 ? fmtCurrency(r.balance) : '—'}</Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      {/* Pagination */}
      <div className="flex flex-col sm:flex-row items-center justify-between px-5 py-4 border-t border-slate-100 bg-white gap-4">
        <span className="text-sm text-slate-500 font-medium text-center sm:text-left">
          Showing <span className="text-slate-800 font-bold">{Math.min((page - 1) * pageSize + 1, total || 0)}</span> to <span className="text-slate-800 font-bold">{Math.min(page * pageSize, total)}</span> of <span className="text-slate-800 font-bold">{total.toLocaleString()}</span> applications
        </span>
        <div className="flex items-center gap-2">
          <button disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 disabled:opacity-40 hover:bg-slate-50 hover:text-slate-900 transition-all cursor-pointer select-none shadow-sm active:scale-95">
            <ChevronLeft size={16} /> Prev
          </button>
          
          <div className="hidden md:flex items-center gap-1.5">
            {Array.from({ length: Math.min(5, pages) }, (_, i) => {
              let pageNum;
              if (pages <= 5) pageNum = i + 1;
              else if (page <= 3) pageNum = i + 1;
              else if (page >= pages - 2) pageNum = pages - 4 + i;
              else pageNum = page - 2 + i;
              
              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={`flex items-center justify-center min-w-[36px] h-9 px-2 rounded-xl text-sm font-bold transition-all shadow-sm cursor-pointer select-none active:scale-95 ${
                    page === pageNum
                      ? 'bg-blue-600 text-white border border-blue-600 ring-2 ring-blue-600/20'
                      : 'bg-white border border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-600'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
            {pages > 5 && page < pages - 2 && (
              <>
                <span className="px-1 text-slate-400 tracking-widest font-bold">...</span>
                <button
                  onClick={() => setPage(pages)}
                  className="flex items-center justify-center min-w-[36px] h-9 px-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-600 text-sm font-bold transition-all shadow-sm cursor-pointer select-none active:scale-95"
                >
                  {pages}
                </button>
              </>
            )}
          </div>

          <button disabled={page >= pages}
            onClick={() => setPage(p => p + 1)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 disabled:opacity-40 hover:bg-slate-50 hover:text-slate-900 transition-all cursor-pointer select-none shadow-sm active:scale-95">
            Next <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
function Th({ children, right, onClick }) { return <th className={`px-3 py-2.5 font-semibold whitespace-nowrap cursor-pointer select-none hover:text-slate-700 transition-colors ${right ? 'text-right' : 'text-left'}`} onClick={onClick}>{children}</th>; }
function Td({ children, right, className = '', onClick }) { return <td className={`px-3 py-2.5 align-middle whitespace-nowrap ${right ? 'text-right' : ''} ${className}`} onClick={onClick}>{children}</td>; }

/* ───────────────────────────── PANEL ───────────────────────────── */
function ApplicationPanel({ leadId, stages = [], onClose, onChanged, user, employees = [], settings = null }) {
  const [lead, setLead] = useState(null);
  const [docs, setDocs] = useState([]);
  const [unis, setUnis] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [notes, setNotes] = useState([]);
  const [newNoteText, setNewNoteText] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({});
  const [editMode, setEditMode] = useState(false);
  const toast = useToast();
  const confirm = useConfirm();

  const onCloseRef = useRef(onClose);
  const toastRef = useRef(toast);
  const stagesRef = useRef(stages);

  useEffect(() => { onCloseRef.current = onClose; toastRef.current = toast; stagesRef.current = stages; });

  const load = useCallback(async () => {
    try {
      const [l, d, u, t, n] = await Promise.all([
        api.getLead(leadId), api.documents(leadId), api.universityApps(leadId),
        api.leadTimeline(leadId).catch(() => ({ events: [] })),
        api.leadTimeline(leadId).catch(() => ({ notes: [] })),
      ]);
      if (!l) { toastRef.current?.error('Lead not found'); onCloseRef.current?.(); return; }
      setLead(l); setDocs(d || []); setUnis(u || []);
      setTimeline(t.events || []);
      setNotes(n.notes || []);
      const curStages = stagesRef.current || [];
      setForm({
        application_stage: l.application_stage || (curStages[0]?.key || 'documents'),
        destination: l.destination || '',
        source: l.source || '', referrer: l.referrer || '', nationality: l.nationality || '',
        passport: l.passport || '', degree: l.degree || '', major: l.major || l.program || '',
        intake_term: l.intake_term || '', university: l.university || '', drive_link: l.drive_link || '',
        deposit: l.deposit || '', visa_deadline: l.visa_deadline || '', departure_date: l.departure_date || '',
        application_notes: l.application_notes || '', blood_group: l.blood_group || '',
        date_of_birth: l.date_of_birth || '', medical_notes: l.medical_notes || '',
        emergency_contact: l.emergency_contact || '',
        assigned_consultant: l.assigned_consultant || '', assigned_employee_id: l.assigned_employee_id || '',
        lead_source: l.lead_source || '', english_score: l.english_score || '',
        next_followup: l.next_followup || '', client_name: l.client_name || '',
        phone: l.phone || '', email: l.email || '', program: l.program || '', notes: l.notes || '',
        lead_status: l.lead_status || '', service_fee: l.service_fee || '', paid: l.paid || '',
        last_education: l.last_education || '',
      });
    } catch (err) { toastRef.current?.error(err.message || 'Failed to load'); onCloseRef.current?.(); }
  }, [leadId]);

  useEffect(() => { load(); }, [load]);
  const updateField = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const saveAll = async () => {
    setSaving(true);
    try {
      const payload = { ...form };
      if (payload.major || payload.program) {
        const m = payload.major || payload.program;
        payload.major = m;
        payload.program = m;
      }
      // Sync assigned_consultant with assigned_employee_id
      if (payload.assigned_employee_id) {
        const emp = employees.find(e => e.id === Number(payload.assigned_employee_id));
        if (emp?.name) payload.assigned_consultant = emp.name;
      } else if (payload.assigned_employee_id === '' || payload.assigned_employee_id == null) {
        payload.assigned_consultant = null;
        payload.assigned_employee_id = null;
      }
      // Convert numeric fields
      payload.deposit = (payload.deposit === '' || payload.deposit == null) ? null : Number(payload.deposit);
      payload.service_fee = (payload.service_fee === '' || payload.service_fee == null) ? null : Number(payload.service_fee);
      payload.paid = (payload.paid === '' || payload.paid == null) ? null : Number(payload.paid);
      payload.assigned_employee_id = (payload.assigned_employee_id === '' || payload.assigned_employee_id == null) ? null : Number(payload.assigned_employee_id);
      await api.updateLead(leadId, payload);
      await load();
      onChanged?.();
      toast.success('Saved details');
    }
    catch (e) { toast.error(e.message || 'Could not save'); }
    setSaving(false);
  };

  const changeStage = async (newStage) => {
    if (newStage === form.application_stage) return;
    const previous = form.application_stage;
    setForm(f => ({ ...f, application_stage: newStage }));
    try { await api.updateStage(leadId, { stage: newStage }); await load(); onChanged?.(); toast.success(`Moved to ${stages.find(s => s.key === newStage)?.label || newStage}`); }
    catch (e) { setForm(f => ({ ...f, application_stage: previous })); toast.error(e.message || 'Could not change stage'); }
  };

  const advance = () => {
    const idx = stages.findIndex(s => s.key === (form.application_stage || stages[0]?.key || 'documents'));
    if (idx === -1 || idx >= stages.length - 1) return;
    return changeStage(stages[idx + 1].key);
  };

  const deleteLead = async () => {
    const ok = await confirm({ title: `Delete ${lead.client_name}?`, body: 'This will permanently remove this student. The portal link will stop working.', tone: 'danger', confirmLabel: 'Delete student' });
    if (!ok) return;
    try { await api.deleteLead(leadId); toast.success(`${lead.client_name} deleted`); onChanged?.(); onClose?.(); }
    catch (e) { toast.error(e.message || 'Could not delete'); }
  };

  const setDocStatus = async (doc, status) => {
    setDocs(prev => prev.map(d => d.id === doc.id ? { ...d, status } : d));
    try { await api.updateDocument(doc.id, { status }); } catch (e) { toast.error(e.message || 'Failed'); load(); }
  };
  const addDoc = async () => {
    const name = prompt('Document name?'); if (!name?.trim()) return;
    try { await api.addDocument(leadId, { doc_type: name.trim() }); load(); toast.success(`Added ${name.trim()}`); }
    catch (e) { toast.error(e.message); }
  };
  const removeDoc = async (doc) => {
    if (!await confirm({ title: `Remove "${doc.doc_type}"?`, tone: 'danger', confirmLabel: 'Remove' })) return;
    try { await api.deleteDocument(doc.id); load(); toast.info('Document removed'); } catch (e) { toast.error(e.message); }
  };

  const addUni = async () => {
    const name = prompt('University name? (e.g. NJTech)'); if (!name?.trim()) return;
    try { await api.addUniversityApp(leadId, { university: name.trim(), status: 'ready' }); load(); toast.success(`Added ${name.trim()}`); }
    catch (e) { toast.error(e.message); }
  };
  const setUniStatus = async (uni, status) => {
    setUnis(prev => prev.map(u => u.id === uni.id ? { ...u, status } : u));
    try { await api.updateUniversityApp(uni.id, { status }); onChanged?.(); } catch (e) { toast.error(e.message || 'Failed'); load(); }
  };
  const removeUni = async (uni) => {
    if (!await confirm({ title: `Remove ${uni.university}?`, tone: 'danger', confirmLabel: 'Remove' })) return;
    try { await api.deleteUniversityApp(uni.id); load(); toast.info('Removed'); } catch (e) { toast.error(e.message); }
  };

  const addTimelineNote = async () => {
    if (!newNoteText.trim()) return;
    try { await api.addNote(leadId, newNoteText.trim()); setNewNoteText(''); load(); toast.success('Note added'); }
    catch (e) { toast.error(e.message); }
  };

  if (!lead) {
    return <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/50 backdrop-blur-sm">
      <div className="bg-white h-full w-full max-w-2xl flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    </div>;
  }

  const currentIdx = (stages || []).findIndex(s => s.key === (form.application_stage || stages?.[0]?.key || 'documents'));
  const received = (docs || []).filter(d => d && ['received', 'verified'].includes(d.status)).length;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white h-full w-full max-w-2xl overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-slate-900 text-white px-6 py-4 flex items-center justify-between z-10 shadow-md">
          <div className="min-w-0">
            <h3 className="text-lg font-bold truncate">{lead.client_name}</h3>
            <p className="text-xs text-slate-400 truncate">{lead.lead_id} · {lead.destination || 'No destination'} · {lead.employee_name || lead.assigned_consultant || 'Unassigned'}</p>
          </div>
          <div className="flex items-center gap-2">
            {form.drive_link && (
              <a href={ensureAbsoluteUrl(form.drive_link)} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs font-medium text-blue-400 hover:text-blue-300 hover:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700 transition-colors">
                <ExternalLink size={12} /> Drive
              </a>
            )}
            <button onClick={() => { if (editMode) saveAll(); setEditMode(e => !e); }} className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${editMode ? 'bg-blue-600 text-white border-blue-500' : 'border-slate-600 text-slate-300 hover:bg-slate-800'}`}>
              {editMode ? 'Done' : 'Edit'}
            </button>
            <button onClick={deleteLead} className="flex items-center gap-1.5 text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 px-3 py-1.5 rounded-lg border border-rose-800/50 transition-colors">
              <Trash2 size={12} /> Delete
            </button>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"><X size={18} /></button>
          </div>
        </div>

        {/* Stage strip */}
        <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center justify-between mb-3">
            <p className="font-bold text-slate-800 text-sm uppercase tracking-wider">Application Stage</p>
            {currentIdx >= 0 && currentIdx < stages.length - 1 && stages[currentIdx + 1] && (
              <button onClick={advance} disabled={saving} className="text-xs font-semibold px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 flex items-center gap-1.5 shadow-sm transition-all">
                Advance to {stages[currentIdx + 1]?.label || 'Next'} <ArrowRight size={13} />
              </button>
            )}
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2">
            {(stages || []).map((s, i) => (
              <div key={s.key} className="flex items-center gap-1.5">
                <button onClick={() => changeStage(s.key)} disabled={saving}
                  className={`text-xs whitespace-nowrap px-2.5 py-1.5 rounded-lg border transition-all disabled:opacity-50
                    ${i === currentIdx ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : i < currentIdx ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-white text-slate-500 border-slate-200 hover:border-blue-300'}`}>
                  {i < currentIdx ? <CheckCircle2 size={11} className="inline mr-1" /> : ''}{s.label}
                </button>
                {i < stages.length - 1 && <ChevronRight size={12} className="text-slate-300" />}
              </div>
            ))}
          </div>
        </div>

        {/* Student Info Card */}
        <div className="px-6 py-5 border-b border-slate-100">
          <div className="flex items-start gap-4">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-md bg-gradient-to-br from-blue-500 to-indigo-600 flex-shrink-0 ring-2 ring-blue-100`}>
              {lead.client_name?.split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase() || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-bold text-slate-800">{lead.client_name}</h4>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${lead.source === 'B2B' || lead.source === 'Agent' ? 'bg-violet-50 text-violet-700 border-violet-200' : lead.source === 'China' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                  {lead.source || 'In-House'}
                </span>
                {lead.destination && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-50 text-slate-600 border border-slate-200">
                    → {lead.destination}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">{lead.destination} · {lead.degree} · {lead.major || '—'} · {lead.intake_term || '—'}</p>
              <p className="text-xs text-slate-400 mt-0.5">Consultant: {lead.employee_name || lead.assigned_consultant || '—'}</p>
            </div>
          </div>
        </div>

        {/* Student Details */}
        <div className="px-6 py-5 border-b border-slate-100 space-y-4">
          <h4 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Student Details</h4>

          {/* Contact Identity */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Full name" value={form.client_name} onChange={v => updateField('client_name', v)} placeholder="e.g. Md Saiful Haque" disabled={!editMode} />
            <Field label="Phone" value={form.phone} onChange={v => updateField('phone', v)} placeholder="+8801XXX-XXXXXX" disabled={!editMode} />
            <Field label="Email" value={form.email} onChange={v => updateField('email', v)} placeholder="student@example.com" type="email" disabled={!editMode} />
            <Field label="Nationality" value={form.nationality} onChange={v => updateField('nationality', v)} placeholder="Bangladesh" disabled={!editMode} />
            <Field label="Passport number" value={form.passport} onChange={v => updateField('passport', v)} placeholder="A12345678" mono disabled={!editMode} />
          </div>

          {/* Academic & Program */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Destination" type="select" value={form.destination} onChange={v => updateField('destination', v)} options={['', ...(settings?.destinations || ['China', 'Malta', 'Hungary', 'Greece', 'Estonia'])]} disabled={!editMode} />
            <Field label="Intake" value={form.intake_term} onChange={v => updateField('intake_term', v)} placeholder="September 2026" disabled={!editMode} />
            <Field label="Degree" type="select" value={form.degree} onChange={v => updateField('degree', v)} options={['', ...DEGREES]} disabled={!editMode} />
            <Field label="Major / Program" value={form.major} onChange={v => updateField('major', v)} placeholder="International Economy" disabled={!editMode} list="app-major-list" />
            <Field label="Primary university" value={form.university} onChange={v => updateField('university', v)} placeholder="e.g. Sichuan University" disabled={!editMode} list="app-uni-list" />
            <Field label="English score" value={form.english_score} onChange={v => updateField('english_score', v)} placeholder="IELTS 6.5 / MOI" disabled={!editMode} />
            <Field label="Last education" value={form.last_education} onChange={v => updateField('last_education', v)} placeholder="HSC · Science" disabled={!editMode} />
          </div>

          {/* Source & Assignment */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Source (Remark)" type="select" value={form.source} onChange={v => updateField('source', v)} options={['', 'In-House', 'B2B', 'China', 'Agent']} disabled={!editMode} />
            <Field label="Referrer" value={form.referrer} onChange={v => updateField('referrer', v)} placeholder="e.g. BheUni, Mahmud" disabled={!editMode} />
            <Field label="Lead source" type="select" value={form.lead_source} onChange={v => updateField('lead_source', v)} options={['', ...(settings?.leadSources || [])]} disabled={!editMode} />
            <Field label="Next follow-up" type="date" value={form.next_followup} onChange={v => updateField('next_followup', v)} disabled={!editMode} />
          </div>

          {/* Financial & Travel */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Service fee (৳)" type="number" value={form.service_fee} onChange={v => updateField('service_fee', v)} placeholder="0" disabled={!editMode} />
            <Field label="Paid so far (৳)" type="number" value={form.paid} onChange={v => updateField('paid', v)} placeholder="0" disabled={!editMode} />
            <Field label="Deposit (৳)" type="number" value={form.deposit} onChange={v => updateField('deposit', v)} placeholder="0" disabled={!editMode} />
            <Field label="Lead status" type="select" value={form.lead_status} onChange={v => updateField('lead_status', v)} options={['', ...(settings?.leadStatuses || [])]} disabled={!editMode} />
          </div>

          {/* Travel & Files */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Visa deadline" type="date" value={form.visa_deadline} onChange={v => updateField('visa_deadline', v)} disabled={!editMode} />
            <Field label="Departure date" type="date" value={form.departure_date} onChange={v => updateField('departure_date', v)} disabled={!editMode} />
            <Field label="Drive folder link" value={form.drive_link} onChange={v => updateField('drive_link', v)} placeholder="https://drive.google.com/…" mono disabled={!editMode} />
          </div>

          {/* Assigned Consultant — Employee Dropdown */}
          <div className="grid grid-cols-1 gap-3">
            <EmployeeSelect label="Assigned Consultant" value={form.assigned_employee_id || ''} onChange={v => updateField('assigned_employee_id', v)} employees={employees} placeholder="— Unassigned —" disabled={!editMode} />
          </div>

          <div>
            <label className={`text-xs font-semibold mb-1 block ${!editMode ? 'text-slate-400' : 'text-slate-600'}`}>Notes</label>
            <textarea rows={2} value={form.application_notes} onChange={e => updateField('application_notes', e.target.value)} placeholder="Anything the next person should know…"
              className={`w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all bg-slate-50 ${!editMode ? 'opacity-70 cursor-not-allowed bg-slate-100' : ''}`}
              disabled={!editMode} readOnly={!editMode} />
          </div>
          <details className="mt-1 group">
            <summary className={`text-xs font-semibold cursor-pointer hover:text-slate-800 list-none flex items-center gap-1 ${!editMode ? 'text-slate-400' : 'text-slate-600'}`}>
              <span className="group-open:rotate-90 transition-transform inline-block">▸</span> Medical & Emergency contact
            </summary>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <Field label="Blood group" type="select" value={form.blood_group} onChange={v => updateField('blood_group', v)} options={['', 'A+','A-','B+','B-','AB+','AB-','O+','O-']} disabled={!editMode} />
              <Field label="Date of birth" type="date" value={form.date_of_birth} onChange={v => updateField('date_of_birth', v)} disabled={!editMode} />
              <div className="col-span-2">
                <label className={`text-xs font-semibold mb-1 block ${!editMode ? 'text-slate-400' : 'text-slate-600'}`}>Emergency contact</label>
                <input value={form.emergency_contact} onChange={e => updateField('emergency_contact', e.target.value)} placeholder="Name + phone"
                  className={`w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all bg-slate-50 ${!editMode ? 'opacity-70 cursor-not-allowed bg-slate-100' : ''}`}
                  disabled={!editMode} readOnly={!editMode} />
              </div>
              <div className="col-span-2">
                <label className={`text-xs font-semibold mb-1 block ${!editMode ? 'text-slate-400' : 'text-slate-600'}`}>Medical notes</label>
                <textarea rows={2} value={form.medical_notes} onChange={e => updateField('medical_notes', e.target.value)} placeholder="Allergies, conditions…"
                  className={`w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all bg-slate-50 ${!editMode ? 'opacity-70 cursor-not-allowed bg-slate-100' : ''}`}
                  disabled={!editMode} readOnly={!editMode} />
              </div>
            </div>
          </details>
          <div className="flex justify-end">
            {editMode && (
              <button onClick={saveAll} disabled={saving} className="text-sm bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 disabled:opacity-60 flex items-center gap-2 shadow-sm transition-all">
                <Save size={14} /> {saving ? 'Saving…' : 'Save details'}
              </button>
            )}
          </div>
        </div>

        {/* Share with student portal */}
        <ShareCard lead={lead} onChanged={load} />

        {/* University applications */}
        <div className="px-6 py-5 border-b border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="font-bold text-slate-800 text-sm uppercase tracking-wider flex items-center gap-2"><Building2 size={14} /> University Applications</p>
              <p className="text-xs text-slate-400">Track status per uni</p>
            </div>
            <button onClick={addUni} className="text-xs font-semibold px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 flex items-center gap-1.5 transition-all"><Plus size={13} /> Add university</button>
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
        <div className="px-6 py-5 border-b border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="font-bold text-slate-800 text-sm uppercase tracking-wider flex items-center gap-2"><FileText size={14} /> Document Checklist</p>
              <p className="text-xs text-slate-400">{received} of {docs.length} received</p>
            </div>
            <button onClick={addDoc} className="text-xs font-semibold px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 flex items-center gap-1.5 transition-all"><Plus size={13} /> Add document</button>
          </div>
          {docs.length === 0 ? (
            <p className="text-sm text-slate-400 italic text-center py-6">No documents yet</p>
          ) : (
            <div className="space-y-1.5">
              {docs.map(d => <DocRow key={d.id} doc={d} onStatus={setDocStatus} onRemove={() => removeDoc(d)} />)}
            </div>
          )}
        </div>

        {/* Timeline */}
        <div className="px-6 py-5 border-b border-slate-100">
          <p className="font-bold text-slate-800 text-sm uppercase tracking-wider mb-3 flex items-center gap-2"><Clock size={14} /> Timeline</p>
          {timeline.length === 0 ? (
            <p className="text-sm text-slate-400 italic">No timeline events yet</p>
          ) : (
            <div className="space-y-3">
              {timeline.map((ev, i) => (
                <div key={i} className="flex gap-3">
                  <div className="w-2 h-2 rounded-full bg-blue-400 mt-1.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-slate-700">{ev.description || ev.event}</p>
                    <p className="text-[10px] text-slate-400">{timeAgo(ev.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="px-6 py-5">
          <p className="font-bold text-slate-800 text-sm uppercase tracking-wider mb-3 flex items-center gap-2"><FileText size={14} /> Notes</p>
          <div className="space-y-2 mb-3">
            {notes.length === 0 ? (
              <p className="text-sm text-slate-400 italic">No notes yet</p>
            ) : notes.map((n, i) => (
              <div key={i} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                <p className="text-xs text-slate-700">{n.text || n.note}</p>
                <p className="text-[10px] text-slate-400 mt-1">{n.author || 'Team'} · {timeAgo(n.created_at)}</p>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <textarea value={newNoteText} onChange={e => setNewNoteText(e.target.value)} rows={2} placeholder="Add a note…"
              className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all bg-slate-50" />
            <button onClick={addTimelineNote} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-semibold transition-colors shadow-sm">Add</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ──── small inputs ──── */
function Field({ label, value, onChange, type = 'text', placeholder, options, list, mono, disabled }) {
  const cls = `w-full h-10 border border-slate-200 rounded-xl px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all bg-slate-50 ${mono ? 'font-mono' : ''} ${disabled ? 'opacity-70 cursor-not-allowed bg-slate-100' : ''}`;
  return (
    <div>
      <label className={`text-xs font-semibold mb-1 block ${disabled ? 'text-slate-400' : 'text-slate-600'}`}>{label}</label>
      {type === 'select' ? (
        <select value={value} onChange={e => onChange(e.target.value)} disabled={disabled} className={cls}>
          {(options || []).map(o => <option key={o} value={o}>{o || '—'}</option>)}
        </select>
      ) : (
        <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} list={list} disabled={disabled} readOnly={disabled} className={cls} />
      )}
    </div>
  );
}

function EmployeeSelect({ label, value = '', onChange, employees = [], placeholder = '— select —', disabled }) {
  const cls = `w-full h-10 border border-slate-200 rounded-xl px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all bg-slate-50 cursor-pointer ${disabled ? 'opacity-70 cursor-not-allowed bg-slate-100' : ''}`;
  return (
    <div>
      <label className={`text-xs font-semibold mb-1 block ${disabled ? 'text-slate-400' : 'text-slate-600'}`}>{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)} disabled={disabled} className={cls}>
        <option value="">{placeholder}</option>
        {employees.map(e => <option key={e.id} value={String(e.id)}>{e.name}</option>)}
      </select>
    </div>
  );
}

function StatusDropdown({ statuses, current, onPick }) {
  const [open, setOpen] = useState(false);
  const cur = statuses.find(s => s.key === current) || statuses[0];
  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)} className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${cur.cls} flex items-center gap-1 transition-all hover:shadow-sm`}>
        {cur.label} <ChevronDown size={10} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl z-20 min-w-[130px] py-1">
            {statuses.map(s => (
              <button key={s.key} onClick={() => { onPick(s.key); setOpen(false); }} className={`w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 transition-colors ${s.key === cur.key ? 'font-bold' : ''}`}>
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
    <div className="flex items-center gap-3 p-2.5 rounded-lg border border-slate-100 hover:border-slate-200 bg-white transition-all hover:shadow-sm">
      <span className="text-sm text-slate-700 flex-1 truncate">{doc.doc_type}</span>
      {doc.received_on && <span className="text-[11px] text-slate-400">{doc.received_on}</span>}
      <StatusDropdown statuses={DOC_STATUSES} current={doc.status} onPick={s => onStatus(doc, s)} />
      <button onClick={onRemove} className="p-1 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded transition-colors" aria-label="Remove"><Trash2 size={13} /></button>
    </div>
  );
}

function UniRow({ uni, onStatus, onRemove }) {
  const [editing, setEditing] = useState(false);
  const [program, setProgram] = useState(uni.program || '');
  const [appId, setAppId] = useState(uni.application_id || '');
  const [notes, setNotes] = useState(uni.notes || '');
  const toast = useToast();
  const save = async () => {
    try { await api.updateUniversityApp(uni.id, { program, application_id: appId, notes }); setEditing(false); toast.success(`${uni.university} updated`); }
    catch (e) { toast.error(e.message); }
  };
  return (
    <div className="rounded-lg border border-slate-100 hover:border-slate-200 bg-white transition-all hover:shadow-sm">
      <div className="flex items-center gap-3 p-2.5">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-slate-700 truncate font-medium">{uni.university}</p>
          {uni.program && <p className="text-[11px] text-slate-400 truncate">{uni.program}</p>}
          {uni.application_id && <p className="text-[11px] text-slate-500"><span className="font-mono bg-slate-50 px-1.5 py-0.5 rounded">App ID: {uni.application_id}</span></p>}
          {(uni.submitted_on || uni.decision_on) && (
            <p className="text-[10px] text-slate-400 mt-0.5">
              {uni.submitted_on && <>submitted {uni.submitted_on}</>}
              {uni.submitted_on && uni.decision_on && ' · '}
              {uni.decision_on && <>decided {uni.decision_on}</>}
            </p>
          )}
        </div>
        <StatusDropdown statuses={UNI_STATUSES} current={uni.status} onPick={s => onStatus(uni, s)} />
        <button onClick={() => setEditing(e => !e)} title="Edit details" className="p-1 text-slate-300 hover:text-blue-500 hover:bg-blue-50 rounded transition-colors text-[11px] font-medium">{editing ? '×' : 'edit'}</button>
        <button onClick={onRemove} className="p-1 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded transition-colors" aria-label="Remove"><Trash2 size={13} /></button>
      </div>
      {editing && (
        <div className="px-2.5 pb-2.5 border-t border-slate-100 pt-2 space-y-1.5">
          <input value={program} onChange={e => setProgram(e.target.value)} placeholder="Program (e.g. MBBS)" className="w-full border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all bg-slate-50" />
          <input value={appId} onChange={e => setAppId(e.target.value)} placeholder="University application ID" className="w-full border border-slate-200 rounded-lg px-2 py-1 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all bg-slate-50" />
          <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (optional)" className="w-full border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all bg-slate-50" />
          <div className="flex justify-end">
            <button onClick={save} className="text-[11px] font-semibold bg-blue-600 text-white px-2.5 py-1 rounded-lg hover:bg-blue-700 transition-colors shadow-sm">Save</button>
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

  const generateCompositeQR = () => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 400; canvas.height = 480;
        const ctx = canvas.getContext('2d');
        
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 400, 480);
        ctx.fillStyle = '#2563eb'; ctx.fillRect(0, 0, 400, 80);
        
        ctx.fillStyle = '#ffffff'; ctx.font = 'bold 22px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('Student Portal Access', 200, 38);
        ctx.font = '13px sans-serif'; ctx.fillText('Scan to view application progress', 200, 60);
        
        ctx.drawImage(img, 80, 110, 240, 240);
        
        ctx.fillStyle = '#1e293b'; ctx.font = 'bold 20px sans-serif';
        ctx.fillText(lead.client_name || 'Student', 200, 390);
        
        ctx.fillStyle = '#64748b'; ctx.font = '14px monospace';
        ctx.fillText(`ID: ${lead.lead_id}`, 200, 415);
        
        ctx.fillStyle = '#94a3b8'; ctx.font = '11px sans-serif';
        ctx.fillText('Keep this code secure. Do not share publicly.', 200, 455);
        
        canvas.toBlob((blob) => {
          if (blob) resolve(blob); else reject(new Error('Canvas failed'));
        }, 'image/png');
      };
      img.onerror = () => reject(new Error('Failed to load QR image'));
      img.src = api.qrUrl(lead.id);
    });
  };

  const handleDownload = async () => {
    try {
      const blob = await generateCompositeQR();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = objUrl;
      a.download = `Student-Portal-${lead.client_name?.replace(/\\s+/g, '-') || lead.id}.png`;
      a.click(); URL.revokeObjectURL(objUrl);
    } catch (e) { toast.error('Could not generate QR code card'); }
  };

  const handleShare = async () => {
    try {
      const blob = await generateCompositeQR();
      const file = new File([blob], `Student-Portal-${lead.lead_id}.png`, { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ title: 'Student Portal QR', files: [file] });
      } else {
        await navigator.share({ title: 'Student Portal', url: url });
      }
    } catch (e) { /* ignored */ }
  };

  const generate = async () => {
    setBusy(true);
    try { const r = await api.regenerateToken(lead.id); setToken(r.public_token); setEnabled(true); onChanged?.(); toast.success('New share link generated'); }
    catch (e) { toast.error(e.message); } setBusy(false);
  };
  const toggle = async () => {
    setBusy(true);
    try { await api.setPublic(lead.id, !enabled); setEnabled(!enabled); onChanged?.(); toast.info(enabled ? 'Student link disabled' : 'Student link enabled'); }
    catch (e) { toast.error(e.message); } setBusy(false);
  };
  const copy = async () => { if (!url) return; try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {} };

  return (
    <div className="px-6 py-5 border-b border-slate-100">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="font-bold text-slate-800 text-sm uppercase tracking-wider flex items-center gap-2"><Share2 size={14} className="text-slate-400" /> Student portal</p>
          <p className="text-xs text-slate-400">Give the student access to their progress tracker</p>
        </div>
      </div>
      {!token ? (
        <div className="text-center py-2 bg-slate-50 border border-dashed border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500 mb-3">No share link yet. Generate one to give the student access to their progress.</p>
          <button onClick={generate} disabled={busy} className="text-xs font-semibold bg-blue-600 text-white px-3.5 py-2 rounded-xl hover:bg-blue-700 disabled:opacity-50 inline-flex items-center gap-1.5 shadow-sm transition-all cursor-pointer">
            <Share2 size={12} /> {busy ? 'Generating…' : 'Generate share link'}
          </button>
        </div>
      ) : (
        <div className="space-y-2.5 bg-slate-50 border border-slate-200/60 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>{enabled ? 'Active' : 'Disabled'}</span>
            <button onClick={toggle} disabled={busy} className="text-xs font-semibold text-slate-500 hover:text-slate-700 underline cursor-pointer transition-colors">{enabled ? 'Disable link' : 'Enable link'}</button>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-2 flex items-center gap-2">
            <code className="text-[11px] flex-1 truncate text-slate-600 font-mono">{url}</code>
            <button onClick={copy} title="Copy" aria-label="Copy" className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all cursor-pointer">
              {copied ? <CheckCircle2 size={13} className="text-emerald-500" /> : <Copy size={13} />}
            </button>
          </div>
          <div className="flex gap-1.5">
            <a href={url} target="_blank" rel="noreferrer" className="flex-1 text-xs font-semibold text-center text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all">
              <ExternalLink size={12} /> Open
            </a>
            <button onClick={() => setShowQR(s => !s)} className="flex-1 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 px-3 py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer">
              <QrCode size={12} /> {showQR ? 'Hide QR' : 'Show QR'}
            </button>
            <button onClick={generate} disabled={busy} title="Regenerate (invalidates old link)" aria-label="Regenerate link" className="text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 px-3 py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer">
              <RotateCw size={12} />
            </button>
          </div>
          {showQR && (
            <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col items-center mt-2 shadow-sm">
              <img src={api.qrUrl(lead.id)} alt="Student portal QR" width={200} height={200} className="rounded" loading="lazy" />
              <p className="text-[10px] text-slate-400 mt-2 text-center">Student scans → opens portal · works without login</p>
              
              <div className="flex gap-2 w-full mt-3">
                <button onClick={handleDownload} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 text-[11px] font-semibold py-1.5 rounded-lg flex justify-center items-center gap-1.5 transition-colors cursor-pointer">
                  <Download size={13} /> Download QR
                </button>
                {!!navigator.share && (
                  <button onClick={handleShare} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 text-[11px] font-semibold py-1.5 rounded-lg flex justify-center items-center gap-1.5 transition-colors cursor-pointer">
                    <Share2 size={13} /> Share QR
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
