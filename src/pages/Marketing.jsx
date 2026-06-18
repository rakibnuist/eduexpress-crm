import { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '../api';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/Confirm';
import Modal from '../components/Modal';
import EmptyState from '../components/EmptyState';
import {
  CalendarDays, Database, Cpu, BarChart3, Check, X, Pencil, Trash2,
  Plus, RefreshCw, ThumbsUp, Megaphone, Brain, TrendingUp, Users, Zap,
  Target, Lightbulb, BookOpen, FlaskConical, Rocket, ArrowUpRight, Star,
  AlertTriangle, Eye, Heart, Globe, Hash, Sparkles, Palette, Wand2,
  Settings, Filter, Grid3X3, List, Layout, ChevronLeft, ChevronRight, Send, Search, MessageCircle, Share2
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid,
  LineChart, Line, PieChart, Pie
} from 'recharts';

// Import existing SocialEngineerTabs components
import {
  ResearchEngineTab, ScriptsTab, AbTestsTab, ScaleUpTab
} from './marketing/SocialEngineerTabs';

// ── helpers ──────────────────────────────────────────────
const ORD = ['', '1st', '2nd', '3rd', '4th', '5th'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const FULL_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function weekOfMonth(d = new Date()) { return Math.min(5, Math.ceil(d.getDate() / 7)); }
function curMonth(d = new Date()) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }
function weekKey(ym, w) { return `${ym}-W${w}`; }
function monthName(ym) { const [y, m] = ym.split('-'); return new Date(Number(y), Number(m) - 1, 1).toLocaleString('en-US', { month: 'long' }); }
function weekLabel(ym, w) { return `${monthName(ym)} ${ORD[w]} Week, ${ym.split('-')[0]}`; }
function monthOptions(n = 6, d = new Date()) {
  const out = [];
  for (let i = 0; i < n; i++) { const dt = new Date(d.getFullYear(), d.getMonth() + i, 1); out.push(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`); }
  return out;
}
function getWeekDates(ym, w) {
  const [year, month] = ym.split('-').map(Number);
  const firstDay = new Date(year, month - 1, 1);
  const firstDayOfWeek = firstDay.getDay();
  const startDate = new Date(year, month - 1, 1 + (w - 1) * 7 - firstDayOfWeek);
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    dates.push(d);
  }
  return dates;
}
function formatDateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function formatDisplayDate(d) {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const PAGE_BADGE = {
  china:     { label: 'China',     cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300', border: 'border-red-200' },
  bd:        { label: 'Bangladesh',cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300', border: 'border-green-200' },
  instagram: { label: 'Instagram', cls: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300', border: 'border-pink-200' },
  tiktok:    { label: 'TikTok',    cls: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300', border: 'border-slate-300' },
};

const PILLAR_COLORS = {
  scholarship: 'bg-blue-50 border-blue-200 text-blue-800',
  trust: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  career: 'bg-violet-50 border-violet-200 text-violet-800',
  urgency: 'bg-amber-50 border-amber-200 text-amber-800',
  'faq': 'bg-cyan-50 border-cyan-200 text-cyan-800',
  'success_story': 'bg-rose-50 border-rose-200 text-rose-800',
  university: 'bg-indigo-50 border-indigo-200 text-indigo-800',
  cost: 'bg-orange-50 border-orange-200 text-orange-800',
  'live_qa': 'bg-teal-50 border-teal-200 text-teal-800',
  trending: 'bg-fuchsia-50 border-fuchsia-200 text-fuchsia-800',
};

const STATUS_CLS = {
  research:       'bg-slate-100 text-slate-600',
  drafted:        'bg-slate-100 text-slate-600',
  review:         'bg-blue-100 text-blue-700',
  asset_pending:  'bg-amber-100 text-amber-700',
  asset_ready:    'bg-sky-100 text-sky-700',
  approved:       'bg-emerald-100 text-emerald-700',
  scheduled:      'bg-indigo-100 text-indigo-700',
  published:      'bg-green-100 text-green-800',
  rejected:       'bg-rose-100 text-rose-700',
  evergreen:      'bg-teal-100 text-teal-700',
  edit:           'bg-amber-100 text-amber-700',
};

const STATUS_LABELS = {
  research: 'Research',
  drafted: 'Drafted',
  review: 'Review',
  asset_pending: 'Asset Pending',
  asset_ready: 'Asset Ready',
  approved: 'Approved',
  scheduled: 'Scheduled',
  published: 'Published',
  rejected: 'Rejected',
  evergreen: 'Evergreen',
};

const STATUS_PIPELINE = ['research', 'drafted', 'review', 'asset_pending', 'asset_ready', 'approved', 'scheduled', 'published'];

function Pill({ value }) {
  return <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CLS[value] || 'bg-slate-100 text-slate-600'}`}>{STATUS_LABELS[value] || value || '—'}</span>;
}

function PageBadge({ page }) {
  const b = PAGE_BADGE[page];
  if (!b) return null;
  return <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${b.cls}`}>{b.label}</span>;
}

function PillarBadge({ pillar }) {
  const cls = PILLAR_COLORS[pillar] || 'bg-slate-50 border-slate-200 text-slate-600';
  return <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>{pillar || '—'}</span>;
}

function QualityBadge({ score }) {
  if (!score && score !== 0) return null;
  const color = score >= 80 ? 'text-emerald-600' : score >= 60 ? 'text-amber-600' : 'text-rose-600';
  return <span className={`text-xs font-bold ${color}`}>Q:{score}</span>;
}

function Field({ label, children }) {
  return (
    <div>
      <label className="text-xs text-slate-500 mb-1 block">{label}</label>
      {children}
    </div>
  );
}

const TABS = [
  { id: 'calendar',   label: 'Content Calendar',   icon: CalendarDays },
  { id: 'publish',    label: 'Publishing',         icon: Send },
  { id: 'research',   label: 'Research Engine',    icon: Brain },
  { id: 'factory',    label: 'Content Factory',    icon: Wand2 },
  { id: 'designer',   label: 'Designer Hub',       icon: Palette },
  { id: 'data',       label: 'Data Center',        icon: Database },
  { id: 'brain',      label: 'Brain Pool',         icon: Cpu },
  { id: 'analytics',  label: 'Analytics & Attribution', icon: BarChart3 },
  { id: 'abtests',    label: 'A/B Tests',          icon: FlaskConical },
  { id: 'scaleup',    label: 'Scale Up',           icon: Rocket },
];

export default function Marketing() {
  const [tab, setTab] = useState('calendar');
  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white"><Megaphone size={18} /></div>
        <div>
          <h1 className="text-lg font-bold text-slate-800">Social Media Engine</h1>
          <p className="text-xs text-slate-400">Content intelligence, design pipeline & analytics — 7-day buffer</p>
        </div>
      </div>

      <div className="flex gap-1 mb-5 bg-white rounded-xl border border-slate-200 p-1 w-fit overflow-x-auto">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition
              ${tab === id ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}>
            <Icon size={15} />{label}
          </button>
        ))}
      </div>

      {tab === 'calendar'  && <CalendarTab />}
      {tab === 'publish'   && <PublishingQueueTab />}
      {tab === 'research'  && <ResearchEngineTab />}
      {tab === 'factory'   && <ContentFactoryTab />}
      {tab === 'designer'  && <DesignerHubTab />}
      {tab === 'data'      && <DataCenterTab />}
      {tab === 'brain'     && <BrainTab />}
      {tab === 'analytics' && <AnalyticsTab />}
      {tab === 'abtests'   && <AbTestsTab />}
      {tab === 'scaleup'   && <ScaleUpTab />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  CALENDAR TAB — Visual 7-Day Grid + Kanban + List
// ═══════════════════════════════════════════════════════════
function CalendarTab() {
  const toast = useToast();
  const confirm = useConfirm();
  const [ym, setYm] = useState(curMonth());
  const [wom, setWom] = useState(weekOfMonth());
  const week = weekKey(ym, wom);
  const [pageFilter, setPageFilter] = useState('');
  const [viewMode, setViewMode] = useState('grid'); // grid | kanban | list
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const [selectedPosts, setSelectedPosts] = useState(new Set());
  const [showBulkBar, setShowBulkBar] = useState(false);

  const weekDates = useMemo(() => getWeekDates(ym, wom), [ym, wom]);

  const load = useCallback(() => {
    setLoading(true);
    api.marketing.posts({ week, page: pageFilter })
      .then(setPosts).catch(e => toast.error(e.message)).finally(() => setLoading(false));
  }, [week, pageFilter, toast]);
  useEffect(() => { load(); }, [load]);

  const byDay = useMemo(() => {
    const m = {};
    for (const p of posts) {
      const key = p.post_date || 'undated';
      (m[key] = m[key] || []).push(p);
    }
    return m;
  }, [posts]);

  const byStatus = useMemo(() => {
    const m = {};
    for (const s of STATUS_PIPELINE) m[s] = [];
    for (const p of posts) {
      const status = p.status || 'drafted';
      (m[status] = m[status] || []).push(p);
    }
    return m;
  }, [posts]);

  const setStatus = async (p, status, rejection_reason) => {
    try {
      await api.marketing.setPostStatus(p.id, { status, rejection_reason });
      toast.success(`Post ${status}`);
      load();
    } catch (e) { toast.error(e.message); }
  };
  const approveWeek = async () => {
    if (!await confirm({ title: `Approve all of ${weekLabel(ym, wom)}?`, body: 'Approves every drafted/review/asset_ready post for this week.', confirmLabel: 'Approve week' })) return;
    try { const r = await api.marketing.approveWeek(week); toast.success(`Approved ${r.approved} posts`); load(); }
    catch (e) { toast.error(e.message); }
  };
  const del = async (p) => {
    if (!await confirm({ title: 'Delete this post?', tone: 'danger', confirmLabel: 'Delete' })) return;
    try { await api.marketing.deletePost(p.id); toast.success('Deleted'); load(); } catch (e) { toast.error(e.message); }
  };

  const toggleSelect = (id) => {
    const next = new Set(selectedPosts);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedPosts(next);
    setShowBulkBar(next.size > 0);
  };
  const bulkApprove = async () => {
    const ids = [...selectedPosts];
    await Promise.allSettled(ids.map(id => api.marketing.setPostStatus(id, { status: 'approved' })));
    toast.success(`Approved ${ids.length} posts`);
    setSelectedPosts(new Set());
    setShowBulkBar(false);
    load();
  };
  const bulkDelete = async () => {
    if (!await confirm({ title: `Delete ${selectedPosts.size} posts?`, tone: 'danger', confirmLabel: 'Delete' })) return;
    const ids = [...selectedPosts];
    await Promise.allSettled(ids.map(id => api.marketing.deletePost(id)));
    toast.success(`Deleted ${ids.length} posts`);
    setSelectedPosts(new Set());
    setShowBulkBar(false);
    load();
  };

  const navWeek = (dir) => {
    if (wom + dir >= 1 && wom + dir <= 5) {
      setWom(wom + dir);
    } else if (dir > 0 && wom === 5) {
      const [y, m] = ym.split('-').map(Number);
      const nextDate = new Date(y, m, 1);
      setYm(`${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`);
      setWom(1);
    } else if (dir < 0 && wom === 1) {
      const [y, m] = ym.split('-').map(Number);
      const prevDate = new Date(y, m - 2, 1);
      setYm(`${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`);
      setWom(5);
    }
  };

  const stats = useMemo(() => {
    const total = posts.length;
    const byPage = {};
    for (const p of posts) { byPage[p.page] = (byPage[p.page] || 0) + 1; }
    return { total, byPage };
  }, [posts]);

  const PostCard = ({ p, compact = false }) => {
    const isSelected = selectedPosts.has(p.id);
    return (
      <div className={`bg-white rounded-xl border p-3 transition ${isSelected ? 'border-blue-400 ring-2 ring-blue-100' : 'border-slate-200'} hover:shadow-sm`}>
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(p.id)} className="w-4 h-4 rounded border-slate-300" />
          <PageBadge page={p.page} />
          <PillarBadge pillar={p.pillar} />
          <Pill value={p.status} />
          <QualityBadge score={p.quality_score} />
          <div className="flex-1" />
          <button onClick={() => setEditing(p)} className="p-1 text-slate-400 hover:text-blue-600"><Pencil size={13} /></button>
          <button onClick={() => del(p)} className="p-1 text-slate-300 hover:text-rose-500"><Trash2 size={13} /></button>
        </div>
        {p.hook && <p className="font-semibold text-slate-800 text-sm line-clamp-2">{p.hook}</p>}
        {!compact && p.body && <p className="text-xs text-slate-600 mt-1 line-clamp-3">{p.body}</p>}
        {!compact && p.hashtags && <p className="text-xs text-blue-500 mt-1">{p.hashtags}</p>}
        {!compact && p.brief && <p className="text-xs text-slate-400 mt-1 italic">🎨 {p.brief}</p>}
        {!compact && p.asset_url && (
          <div className="mt-2">
            <img src={p.asset_url} alt="asset" className="w-full h-24 object-cover rounded-lg" loading="lazy" />
          </div>
        )}
        <div className="flex items-center gap-1 mt-2 pt-2 border-t border-slate-50">
          {p.status === 'drafted' && (
            <button onClick={() => setStatus(p, 'review')} className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100">Send to Review</button>
          )}
          {p.status === 'review' && (
            <>
              <button onClick={() => setStatus(p, 'asset_pending')} className="text-xs px-2 py-1 rounded bg-amber-50 text-amber-700 hover:bg-amber-100">Need Asset</button>
              <button onClick={() => setStatus(p, 'approved')} className="text-xs px-2 py-1 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100">Approve</button>
            </>
          )}
          {p.status === 'asset_pending' && (
            <span className="text-xs text-amber-600">🎨 Waiting for designer</span>
          )}
          {p.status === 'asset_ready' && (
            <button onClick={() => setStatus(p, 'approved')} className="text-xs px-2 py-1 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100">Approve</button>
          )}
          {p.status === 'approved' && (
            <button onClick={() => setStatus(p, 'scheduled')} className="text-xs px-2 py-1 rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-100">Schedule</button>
          )}
          <button onClick={() => setRejecting(p)} className="text-xs px-2 py-1 rounded bg-rose-50 text-rose-600 hover:bg-rose-100 ml-auto">Reject</button>
        </div>
      </div>
    );
  };

  return (
    <div className="relative">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex items-center gap-1">
          <button onClick={() => navWeek(-1)} className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50"><ChevronLeft size={16} /></button>
          <select value={ym} onChange={e => setYm(e.target.value)} className="text-sm border border-slate-200 rounded-lg px-2.5 py-1.5">
            {monthOptions().map(m => <option key={m} value={m}>{monthName(m)} {m.split('-')[0]}</option>)}
          </select>
          <select value={wom} onChange={e => setWom(Number(e.target.value))} className="text-sm border border-slate-200 rounded-lg px-2.5 py-1.5">
            {[1, 2, 3, 4, 5].map(w => <option key={w} value={w}>{ORD[w]} Week</option>)}
          </select>
          <button onClick={() => navWeek(1)} className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50"><ChevronRight size={16} /></button>
        </div>
        <select value={pageFilter} onChange={e => setPageFilter(e.target.value)} className="text-sm border border-slate-200 rounded-lg px-2.5 py-1.5">
          <option value="">All pages</option>
          <option value="china">China</option>
          <option value="bd">Bangladesh</option>
          <option value="instagram">Instagram</option>
          <option value="tiktok">TikTok</option>
        </select>
        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5">
          {[
            { id: 'grid', icon: Grid3X3, label: 'Grid' },
            { id: 'kanban', icon: Layout, label: 'Kanban' },
            { id: 'list', icon: List, label: 'List' },
          ].map(v => (
            <button key={v.id} onClick={() => setViewMode(v.id)} title={v.label}
              className={`p-1.5 rounded-md ${viewMode === v.id ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>
              <v.icon size={14} />
            </button>
          ))}
        </div>
        <button onClick={load} className="text-sm flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"><RefreshCw size={13} />Refresh</button>
        <div className="flex-1" />
        <button onClick={() => setEditing({ id: null, hook: '', body: '', hashtags: '', pillar: '', page: 'bd', format: 'Single image', language: 'bangla', post_date: '', slot_time: '', status: 'drafted' })} className="text-sm flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium"><Plus size={14} />New Post</button>
        <button onClick={approveWeek} className="text-sm flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium"><ThumbsUp size={14} />Approve week</button>
      </div>

      {/* Mini stats */}
      <div className="flex gap-3 mb-4">
        <div className="bg-white rounded-lg border border-slate-200 px-3 py-2">
          <span className="text-xs text-slate-400">Total</span>
          <span className="ml-2 text-sm font-bold text-slate-700">{stats.total}</span>
        </div>
        {Object.entries(stats.byPage).map(([page, count]) => (
          <div key={page} className="bg-white rounded-lg border border-slate-200 px-3 py-2">
            <span className="text-xs text-slate-400">{PAGE_BADGE[page]?.label || page}</span>
            <span className="ml-2 text-sm font-bold text-slate-700">{count}</span>
          </div>
        ))}
      </div>

      {/* Views */}
      {loading ? <div className="py-16 text-center text-slate-400 text-sm">Loading…</div>
        : posts.length === 0 ? (
          <EmptyState icon={<CalendarDays size={24} />} title={`No posts for ${weekLabel(ym, wom)}`}
            hint="When n8n imports a weekly plan it appears here. You can also add one manually." />
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-7 gap-3">
            {weekDates.map((date, i) => {
              const dateKey = formatDateKey(date);
              const dayPosts = byDay[dateKey] || [];
              return (
                <div key={dateKey} className="min-h-[400px]">
                  <div className={`text-center py-2 rounded-t-lg border-t border-x ${i === 0 ? 'border-l' : ''} ${i === 6 ? 'border-r' : ''} border-slate-200 bg-slate-50`}>
                    <p className="text-xs font-semibold text-slate-500 uppercase">{DAYS[date.getDay()]}</p>
                    <p className="text-sm font-bold text-slate-700">{formatDisplayDate(date)}</p>
                    <p className="text-xs text-slate-400">{dayPosts.length} posts</p>
                  </div>
                  <div className={`border border-slate-200 rounded-b-lg p-2 space-y-2 min-h-[300px] ${dayPosts.length === 0 ? 'bg-slate-50/50' : 'bg-white'}`}>
                    {dayPosts.length === 0 && (
                      <div className="text-center py-8">
                        <p className="text-xs text-slate-300">Empty</p>
                        <button className="text-xs text-blue-500 mt-1 hover:underline">+ Fill with evergreen</button>
                      </div>
                    )}
                    {dayPosts.map(p => <PostCard key={p.id} p={p} compact={true} />)}
                  </div>
                </div>
              );
            })}
          </div>
        ) : viewMode === 'kanban' ? (
          <div className="flex gap-3 overflow-x-auto pb-4">
            {STATUS_PIPELINE.map(status => (
              <div key={status} className="min-w-[280px] flex-shrink-0">
                <div className="flex items-center justify-between mb-2 px-1">
                  <span className="text-xs font-semibold text-slate-500 uppercase">{STATUS_LABELS[status]}</span>
                  <span className="text-xs text-slate-400">{(byStatus[status] || []).length}</span>
                </div>
                <div className="bg-slate-50 rounded-xl border border-slate-200 p-2 space-y-2 min-h-[200px]">
                  {(byStatus[status] || []).map(p => <PostCard key={p.id} p={p} compact={true} />)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-5">
            {Object.entries(byDay).sort(([a], [b]) => a.localeCompare(b)).map(([date, items]) => (
              <div key={date}>
                <p className="text-xs font-semibold text-slate-500 mb-2">{date}</p>
                <div className="grid gap-3 md:grid-cols-2">
                  {items.map(p => <PostCard key={p.id} p={p} />)}
                </div>
              </div>
            ))}
          </div>
        )}

      {/* Bulk action bar */}
      {showBulkBar && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-slate-900 text-white rounded-full px-4 py-2.5 shadow-lg z-50">
          <span className="text-sm font-medium">{selectedPosts.size} selected</span>
          <div className="w-px h-4 bg-slate-600" />
          <button onClick={bulkApprove} className="text-sm px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700">Approve</button>
          <button onClick={() => { setSelectedPosts(new Set()); setShowBulkBar(false); }} className="text-sm px-3 py-1 rounded-lg bg-slate-700 hover:bg-slate-600">Clear</button>
          <button onClick={bulkDelete} className="text-sm px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-700">Delete</button>
        </div>
      )}

      {editing && <PostEditor post={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
      {rejecting && (
        <RejectModal post={rejecting} onClose={() => setRejecting(null)}
          onReject={async (reason) => { await setStatus(rejecting, 'rejected', reason); setRejecting(null); }} />
      )}
    </div>
  );
}

function PostEditor({ post, onClose, onSaved }) {
  const toast = useToast();
  const isNew = !post.id;
  const [f, setF] = useState({
    hook: post.hook || '', body: post.body || '', hashtags: post.hashtags || '',
    brief: post.brief || '', slot_time: post.slot_time || '', status: post.status || 'drafted',
    page: post.page || 'bd', pillar: post.pillar || '', format: post.format || 'Single image',
    language: post.language || 'bangla', post_date: post.post_date || '',
  });
  const set = (k, v) => setF(s => ({ ...s, [k]: v }));
  const save = async () => {
    try {
      if (isNew) {
        await api.marketing.createPost({ ...f, week: post.week || '' });
        toast.success('Post created');
      } else {
        await api.marketing.updatePost(post.id, f);
        toast.success('Saved');
      }
      onSaved();
    } catch (e) { toast.error(e.message); }
  };
  return (
    <Modal title={isNew ? 'New post' : 'Edit post'} onClose={onClose} wide>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Page">
            <select className="inp" value={f.page} onChange={e => set('page', e.target.value)}>
              <option value="china">China</option>
              <option value="bd">Bangladesh</option>
              <option value="instagram">Instagram</option>
              <option value="tiktok">TikTok</option>
            </select>
          </Field>
          <Field label="Post Date"><input type="date" className="inp" value={f.post_date} onChange={e => set('post_date', e.target.value)} /></Field>
          <Field label="Pillar"><input className="inp" value={f.pillar} onChange={e => set('pillar', e.target.value)} placeholder="e.g. scholarship, trust, career" /></Field>
          <Field label="Format">
            <select className="inp" value={f.format} onChange={e => set('format', e.target.value)}>
              <option>Reel</option><option>Carousel</option><option>Single image</option><option>Story</option><option>Video</option><option>Live</option><option>Text</option>
            </select>
          </Field>
          <Field label="Time"><input className="inp" value={f.slot_time} onChange={e => set('slot_time', e.target.value)} /></Field>
          <Field label="Language">
            <select className="inp" value={f.language} onChange={e => set('language', e.target.value)}>
              <option value="bangla">Bangla</option>
              <option value="english">English</option>
              <option value="mixed">Bangla + English (Mixed)</option>
            </select>
          </Field>
        </div>
        <Field label="Hook"><input className="inp" value={f.hook} onChange={e => set('hook', e.target.value)} /></Field>
        <Field label="Body"><textarea rows={6} className="inp" value={f.body} onChange={e => set('body', e.target.value)} /></Field>
        <Field label="Hashtags"><input className="inp" value={f.hashtags} onChange={e => set('hashtags', e.target.value)} /></Field>
        <Field label="Design/Video brief"><input className="inp" value={f.brief} onChange={e => set('brief', e.target.value)} /></Field>
        <Field label="Status">
          <select className="inp" value={f.status} onChange={e => set('status', e.target.value)}>
            {['research','drafted','review','asset_pending','asset_ready','approved','scheduled','published','rejected','evergreen'].map(s => <option key={s}>{s}</option>)}
          </select>
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 text-slate-600">Cancel</button>
          <button onClick={save} className="px-3 py-1.5 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium">{isNew ? 'Create' : 'Save'}</button>
        </div>
      </div>
    </Modal>
  );
}

function RejectModal({ onClose, onReject }) {
  const [reason, setReason] = useState('');
  return (
    <Modal title="Reject & request a redraft" onClose={onClose}>
      <p className="text-sm text-slate-500 mb-2">Tell the engine what's wrong — it redrafts this post with your note.</p>
      <textarea rows={4} autoFocus className="inp" placeholder="e.g. too generic, wrong stipend figure, make it Bangla, add more urgency…"
        value={reason} onChange={e => setReason(e.target.value)} />
      <div className="flex justify-end gap-2 pt-3">
        <button onClick={onClose} className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 text-slate-600">Cancel</button>
        <button onClick={() => onReject(reason)} className="px-3 py-1.5 text-sm rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-medium">Reject</button>
      </div>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════
//  CONTENT FACTORY TAB — Professional Step-by-Step Builder + Quality Gate + Live Preview
// ═══════════════════════════════════════════════════════════
function ContentFactoryTab() {
  const toast = useToast();

  // ── Builder Steps ──
  const [step, setStep] = useState(1);

  // ── Post Core Data ──
  const [page, setPage] = useState('china');
  const [pillar, setPillar] = useState('scholarship');
  const [format, setFormat] = useState('Carousel');
  const [language, setLanguage] = useState('bangla');
  const [platform, setPlatform] = useState('facebook');
  const [hook, setHook] = useState('');
  const [body, setBody] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [cta, setCta] = useState('');
  const [brief, setBrief] = useState('');

  // ── Selected Items from KB / Hooks ──
  const [selectedHook, setSelectedHook] = useState(null);
  const [selectedUniversity, setSelectedUniversity] = useState(null);
  const [selectedScholarship, setSelectedScholarship] = useState(null);

  // ── AI Generation ──
  const [aiGenerating, setAiGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState('generator'); // generator | kb | hooks
  const [previewTab, setPreviewTab] = useState('facebook');
  const [loading, setLoading] = useState(false);

  // ── Data Sources ──
  const [researchIntel, setResearchIntel] = useState([]);
  const [bestHooks, setBestHooks] = useState([]);
  const [kbUniversities, setKbUniversities] = useState([]);
  const [kbScholarships, setKbScholarships] = useState([]);
  const [kbSearch, setKbSearch] = useState('');
  const [kbCountry, setKbCountry] = useState('');
  const [kbProgramType, setKbProgramType] = useState('');
  const [kbPartnerStatus, setKbPartnerStatus] = useState('');
  const [hooksFilter, setHooksFilter] = useState({ hook_type: '', destination: '', pillar: '', status: '' });

  // ── Quality Gate ──
  const [qualityScore, setQualityScore] = useState(100);
  const [qualityChecks, setQualityChecks] = useState({ fact_check: true, banned_words: [], tone_ok: true, figure_verified: 'pending', severity: [] });

  // Banned words from quality gate config
  const BANNED_CRITICAL = ['guaranteed visa', '100% visa success', '100% admission', 'guaranteed admission', 'visa confirmed', 'no rejection', 'zero rejection', 'government registered', 'licensed by government', 'official representative', 'authorized agent', 'best consultancy', 'no. 1 consultancy', '100% scholarship guaranteed', 'free education', 'no cost at all'];
  const BANNED_HIGH = ['csc scholarship', 'gks scholarship', 'stipendium hungaricum', 'turkiye burslari', 'our students in korea', 'our alumni in hungary', 'visa success for korea', 'visa success for europe', 'no ielts', 'no csca required', 'payment after visa', 'no file opening charge', 'free counselling', 'expert guidance', 'partnered with 500+', '5000+ students', '99% visa success', '7 years', '$5m revenue'];

  const CTA_OPTIONS = [
    { label: 'DM us for free consultation', value: 'DM us for free consultation 📩' },
    { label: 'Click link in bio', value: 'Click link in bio 🔗' },
    { label: "Comment 'INFO' below", value: "Comment 'INFO' below 👇" },
    { label: 'WhatsApp: +8801983333566', value: 'WhatsApp: +8801983333566 📞' },
    { label: 'Visit our Dhanmondi office', value: 'Visit our Dhanmondi office 📍' },
    { label: 'Apply now — limited seats', value: 'Apply now — limited seats 🏃' },
    { label: 'Join our free webinar', value: 'Join our free webinar 🎓' },
    { label: 'Custom…', value: '' },
  ];

  const HASHTAG_SUGGESTIONS = {
    scholarship: ['#Scholarship2026', '#FullScholarship', '#StudyForFree', '#EduExpressBD'],
    trust: ['#TrustedConsultancy', '#EduExpressBD', '#VerifiedInfo', '#StudentFirst'],
    career: ['#CareerAbroad', '#GlobalJobs', '#EduExpressBD', '#WorkAfterStudy'],
    urgency: ['#LimitedSeats', '#ApplyNow', '#DeadlineAlert', '#EduExpressBD'],
    university: ['#TopUniversity', '#WorldRanking', '#EduExpressBD', '#CampusLife'],
    cost: ['#AffordableEducation', '#LowTuition', '#EduExpressBD', '#BudgetStudy'],
    success_story: ['#SuccessStory', '#OurStudents', '#EduExpressBD', '#DreamComeTrue'],
    trending: ['#Trending', '#Viral', '#StudyAbroad', '#EduExpressBD'],
  };

  const PAGE_HASHTAGS = {
    china: ['#StudyInChina', '#ChinaEducation', '#ChineseUniversity', '#CSCScholarship'],
    bd: ['#StudyAbroad', '#BangladeshStudents', '#EducationConsultancy', '#VisaSuccess'],
    instagram: ['#Reels', '#InstaDaily', '#EduExpressBD', '#StudyAbroad'],
    tiktok: ['#StudyTok', '#EduTok', '#EduExpressBD', '#ViralEdu'],
  };

  // ── Effects ──
  useEffect(() => {
    Promise.all([
      api.marketing.activeResearch().catch(() => []),
      api.marketing.bestHooks(page, pillar, page === 'china' ? 'China' : '', 50).catch(() => []),
    ]).then(([ri, bh]) => {
      setResearchIntel(ri);
      setBestHooks(bh);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    api.marketing.bestHooks(page, pillar, page === 'china' ? 'China' : '', 50).catch(() => [])
      .then(bh => setBestHooks(bh)).catch(() => {});
  }, [page, pillar]);

  // Real-time quality gate on every change
  useEffect(() => {
    const result = runQualityCheck(hook, body, hashtags);
    setQualityScore(result.score);
    setQualityChecks(result.checks);
  }, [hook, body, hashtags, language, selectedScholarship, selectedUniversity]);

  // Auto-build brief from selections
  useEffect(() => {
    const parts = [];
    if (format) parts.push(`${format}${platform ? ` for ${platform}` : ''}`);
    if (pillar) parts.push(pillar);
    if (selectedUniversity) parts.push('Include university logo.');
    if (selectedScholarship) parts.push('Include scholarship details.');
    if (language === 'bangla') parts.push('Bangla copy.');
    if (language === 'mixed') parts.push('Mixed Bangla+English copy.');
    setBrief(parts.join(' '));
  }, [format, platform, pillar, selectedUniversity, selectedScholarship, language]);

  const runQualityCheck = (h, b, tags) => {
    const fullText = `${h} ${b} ${tags}`.toLowerCase();
    const bannedFound = [];
    const severity = [];

    BANNED_CRITICAL.forEach(word => {
      if (fullText.includes(word.toLowerCase())) { bannedFound.push(word); severity.push('critical'); }
    });
    BANNED_HIGH.forEach(word => {
      if (fullText.includes(word.toLowerCase())) { bannedFound.push(word); severity.push('high'); }
    });

    const stipendMatch = b.match(/[৳$€¥]\s*\d+/g);
    const hasRange = b.includes('10,000') || b.includes('60,000') || b.includes('range') || b.includes('depending') || b.includes('up to') || b.includes('-');
    let figureVerified = 'pending';
    if (stipendMatch && !hasRange) figureVerified = 'unverified';
    if (selectedScholarship) figureVerified = 'verified';

    let factCheck = true;
    if (b.includes('University') && !selectedUniversity) factCheck = false;
    if (b.includes('university') && !selectedUniversity) factCheck = false;

    const toneOk = language === 'bangla' ? !/[a-zA-Z]{20,}/.test(b) : true;

    const score = 100
      - (severity.filter(s => s === 'critical').length * 50)
      - (severity.filter(s => s === 'high').length * 15)
      - (factCheck ? 0 : 15)
      - (figureVerified === 'verified' ? 0 : figureVerified === 'unverified' ? 10 : 5)
      - (toneOk ? 0 : 10);

    return {
      score: Math.max(0, score),
      checks: { fact_check: factCheck, banned_words: bannedFound, tone_ok: toneOk, figure_verified: figureVerified, severity },
    };
  };

  const searchKB = async () => {
    if (!kbSearch.trim() && !kbCountry) return;
    try {
      const [uni, schol] = await Promise.all([
        api.marketing.searchUniversities(kbSearch, kbCountry || (page === 'china' ? 'China' : ''), 50),
        api.marketing.searchScholarships(kbSearch, kbCountry || (page === 'china' ? 'China' : ''), '', 50),
      ]);
      let filteredUni = uni;
      if (kbProgramType) filteredUni = filteredUni.filter(u => (u.programs || '').toLowerCase().includes(kbProgramType.toLowerCase()));
      if (kbPartnerStatus === 'partner') filteredUni = filteredUni.filter(u => u.partner === true || u.partner === 'true' || u.partner === 1);
      if (kbPartnerStatus === 'non-partner') filteredUni = filteredUni.filter(u => !u.partner || u.partner === 'false' || u.partner === 0);
      setKbUniversities(filteredUni);
      setKbScholarships(schol);
    } catch (e) { toast.error(e.message); }
  };

  const injectKBIntoBody = () => {
    let injection = '';
    if (selectedUniversity) {
      injection += `\n🏫 ${selectedUniversity.name} (${selectedUniversity.city}, ${selectedUniversity.country})`;
      if (selectedUniversity.programs) injection += ` — Programs: ${selectedUniversity.programs}`;
      if (selectedUniversity.tuition) injection += `\n💰 Tuition: ${selectedUniversity.tuition}`;
      if (selectedUniversity.lang_req) injection += `\n📝 Language: ${selectedUniversity.lang_req}`;
    }
    if (selectedScholarship) {
      injection += `\n🎓 ${selectedScholarship.name}`;
      if (selectedScholarship.coverage) injection += `\n💵 Coverage: ${selectedScholarship.coverage}`;
      if (selectedScholarship.deadline) injection += `\n⏰ Deadline: ${selectedScholarship.deadline}`;
      if (selectedScholarship.eligibility) injection += `\n✅ Eligibility: ${selectedScholarship.eligibility}`;
    }
    if (injection) {
      setBody(prev => prev + (prev ? '\n' : '') + injection.trim());
      toast.success('KB data injected into body');
    }
  };

  const addHashtag = (tag) => {
    setHashtags(prev => {
      const existing = prev.split(/\s+/).filter(Boolean);
      if (existing.includes(tag)) return prev;
      return [...existing, tag].join(' ');
    });
  };

  const removeHashtag = (tag) => {
    setHashtags(prev => prev.split(/\s+/).filter(t => t !== tag).join(' '));
  };

  const combinedContent = useMemo(() => {
    const parts = [hook, body];
    if (cta) parts.push(cta);
    if (hashtags) parts.push(hashtags);
    return parts.filter(Boolean).join('\n\n');
  }, [hook, body, cta, hashtags]);

  const platformWarnings = useMemo(() => {
    const warnings = [];
    if (platform === 'facebook' && language === 'bangla') warnings.push('Bangla-only text on Facebook may reduce reach by 30%. Consider Mixed or English.');
    if (platform === 'tiktok' && format !== 'Reel' && format !== 'Video') warnings.push('TikTok performs best with Reel/Video format.');
    if (platform === 'instagram' && format === 'Carousel' && body.length > 300) warnings.push('Instagram Carousel captions over 300 chars get truncated.');
    if (!hook || hook.length < 10) warnings.push('Hook is too short. Aim for 20+ characters for better CTR.');
    if (body.length < 50) warnings.push('Body is very short. Aim for 80+ words for engagement.');
    if (hashtags.split(/\s+/).filter(Boolean).length > 10) warnings.push('More than 10 hashtags may look spammy on this platform.');
    return warnings;
  }, [platform, language, format, hook, body, hashtags]);

  const filteredHooks = useMemo(() => {
    return bestHooks.filter(h => {
      if (hooksFilter.hook_type && h.hook_type !== hooksFilter.hook_type) return false;
      if (hooksFilter.destination && h.destination !== hooksFilter.destination) return false;
      if (hooksFilter.pillar && h.pillar !== hooksFilter.pillar) return false;
      if (hooksFilter.status && h.status !== hooksFilter.status) return false;
      return true;
    });
  }, [bestHooks, hooksFilter]);

  const availableHashtags = useMemo(() => {
    const pillarTags = HASHTAG_SUGGESTIONS[pillar] || [];
    const pageTags = PAGE_HASHTAGS[page] || [];
    return [...new Set([...pillarTags, ...pageTags])];
  }, [pillar, page]);

  // ── Pipeline Actions ──
  const savePost = async (status) => {
    try {
      const payload = {
        page, pillar, format, language, platform,
        hook, body, hashtags, cta, brief,
        status, quality_score: qualityScore,
        quality_checks: JSON.stringify(qualityChecks),
      };
      const post = await api.marketing.createPost(payload);
      toast.success(status === 'drafted' ? 'Saved to drafts' : 'Post created');
      return post;
    } catch (e) { toast.error(e.message); throw e; }
  };

  const handleSaveDraft = async () => {
    setLoading(true);
    try { await savePost('drafted'); } finally { setLoading(false); }
  };

  const handleApproveAndQueue = async () => {
    setLoading(true);
    try {
      const post = await savePost('approved');
      await api.marketing.publishPost(post.id, { platform, page });
      toast.success('Approved & added to publishing queue');
    } catch (e) { /* toast already shown */ } finally { setLoading(false); }
  };

  const handleSendToDesigner = async () => {
    setLoading(true);
    try {
      const post = await savePost('asset_pending');
      await api.marketing.createDesignerQueue({
        post_id: post.id, brief: brief || 'Design asset needed', priority: 'normal', status: 'assigned',
      });
      toast.success('Sent to designer queue');
    } catch (e) { /* toast already shown */ } finally { setLoading(false); }
  };

  const generateWithAI = async () => {
    if (!page || !pillar) {
      toast.error('Select Page and Pillar first');
      return;
    }
    setAiGenerating(true);
    try {
      const res = await fetch('/api/marketing/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          page, pillar, format, language, platform,
          tone: 'expert_consultant',
          topic: researchIntel[0]?.topic || 'Study abroad opportunity',
          hook: selectedHook?.hook_text || '',
          selectedUniversity: selectedUniversity || undefined,
          selectedScholarship: selectedScholarship || undefined,
          researchIntel: researchIntel[0] || undefined,
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'AI generation failed');
      if (data.fallback) throw new Error(data.error || 'No LLM API key configured');
      setHook(data.hook || '');
      setBody(data.body || '');
      setHashtags(data.hashtags || '');
      setCta(data.cta || '');
      setBrief(data.brief || brief);
      setStep(6); // Jump to review
      toast.success(`AI generated content (${data.provider} · ${data.model})`);
    } catch (e) {
      toast.error(e.message || 'AI generation failed');
    } finally {
      setAiGenerating(false);
    }
  };

  // ── Step Renderer ──
  const steps = [
    { id: 1, label: 'Hook', icon: Zap },
    { id: 2, label: 'Body', icon: Pencil },
    { id: 3, label: 'Hashtags', icon: Hash },
    { id: 4, label: 'CTA', icon: Target },
    { id: 5, label: 'Format', icon: Layout },
    { id: 6, label: 'Review', icon: Check },
  ];

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500">Choose from proven hooks or write your own.</p>
              {selectedHook && <button onClick={() => { setSelectedHook(null); setHook(''); }} className="text-xs text-blue-600 hover:underline">Clear selection</button>}
            </div>
            <Field label="Select from Hook Library">
              <select className="inp" value={selectedHook?.id || ''} onChange={e => {
                const h = bestHooks.find(x => String(x.id) === e.target.value);
                if (h) { setSelectedHook(h); setHook(h.hook_text); }
                else { setSelectedHook(null); }
              }}>
                <option value="">— Choose a tested hook —</option>
                {bestHooks.map(h => (
                  <option key={h.id} value={h.id}>{h.hook_text.slice(0, 60)}{h.hook_text.length > 60 ? '…' : ''} (Conv: {h.conversion_rate ? (h.conversion_rate * 100).toFixed(1) + '%' : '0%'})</option>
                ))}
              </select>
            </Field>
            <Field label="Or write custom hook">
              <textarea rows={3} className="inp" value={hook} onChange={e => setHook(e.target.value)} placeholder={language === 'bangla' ? 'e.g. CSCA ছাড়াই চীনে Bachelor! 🎓' : 'e.g. Study in China WITHOUT CSCA! 🎓'} />
            </Field>
            <div className="flex justify-between">
              <div />
              <button onClick={() => setStep(2)} className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium">Next →</button>
            </div>
          </div>
        );
      case 2:
        return (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">Build the body copy. Selected KB items can be injected automatically.</p>
            {(selectedUniversity || selectedScholarship) && (
              <div className="flex items-center gap-2 flex-wrap">
                {selectedUniversity && <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full border border-blue-200">🏫 {selectedUniversity.name}</span>}
                {selectedScholarship && <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-1 rounded-full border border-emerald-200">💰 {selectedScholarship.name}</span>}
                <button onClick={injectKBIntoBody} className="text-xs px-2 py-1 rounded-lg bg-slate-800 text-white hover:bg-slate-700">Inject KB Data</button>
              </div>
            )}
            <Field label="Body Copy">
              <textarea rows={8} className="inp" value={body} onChange={e => setBody(e.target.value)} placeholder={
                language === 'bangla'
                  ? 'আপনি কি জানেন?\n\nচীনে Bachelor করতে CSCA পরীক্ষা দেওয়া বাধ্যতামূলক নয়!\n\n✅ 100% টিউশন ফ্রি\n✅ মাসিক স্টাইপেন্ড ৳১০,০০০-৬০,০০০'
                  : language === 'mixed'
                    ? 'আপনি কি জানেন?\n\nChina তে Bachelor করতে CSCA লাগে না!\n\n✅ 100% Tuition Free'
                    : 'Did you know?\n\nYou can study Bachelor\'s in China WITHOUT the CSCA exam!\n\n✅ 100% Tuition Free\n✅ Monthly Stipend ৳10,000-60,000'
              } />
            </Field>
            <div className="flex justify-between">
              <button onClick={() => setStep(1)} className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-sm">← Back</button>
              <button onClick={() => setStep(3)} className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium">Next →</button>
            </div>
          </div>
        );
      case 3:
        return (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">Click to add suggested hashtags. Edit or type your own.</p>
            <div className="flex flex-wrap gap-1.5">
              {availableHashtags.map(tag => (
                <button key={tag} onClick={() => addHashtag(tag)} className={`text-xs px-2 py-1 rounded-full border transition ${hashtags.includes(tag) ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-white border-slate-200 text-slate-600 hover:border-blue-300'}`}>
                  {tag}
                </button>
              ))}
            </div>
            <Field label="Hashtags">
              <textarea rows={2} className="inp" value={hashtags} onChange={e => setHashtags(e.target.value)} placeholder="#StudyInChina #EduExpressBD #Scholarship2026" />
            </Field>
            {hashtags && (
              <div className="flex flex-wrap gap-1">
                {hashtags.split(/\s+/).filter(Boolean).map(tag => (
                  <span key={tag} className="inline-flex items-center gap-1 text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded-full">
                    {tag} <button onClick={() => removeHashtag(tag)} className="text-slate-400 hover:text-rose-500"><X size={10} /></button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex justify-between">
              <button onClick={() => setStep(2)} className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-sm">← Back</button>
              <button onClick={() => setStep(4)} className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium">Next →</button>
            </div>
          </div>
        );
      case 4:
        return (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">Select a proven CTA or write your own.</p>
            <Field label="Call to Action">
              <select className="inp" value={cta} onChange={e => {
                const opt = CTA_OPTIONS.find(c => c.value === e.target.value);
                setCta(opt ? opt.value : e.target.value);
              }}>
                <option value="">— Select CTA —</option>
                {CTA_OPTIONS.map((c, i) => <option key={i} value={c.value}>{c.label}</option>)}
              </select>
            </Field>
            <Field label="Or custom CTA">
              <input className="inp" value={cta} onChange={e => setCta(e.target.value)} placeholder="Write your own call to action…" />
            </Field>
            <div className="flex justify-between">
              <button onClick={() => setStep(3)} className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-sm">← Back</button>
              <button onClick={() => setStep(5)} className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium">Next →</button>
            </div>
          </div>
        );
      case 5:
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Page">
                <select className="inp" value={page} onChange={e => setPage(e.target.value)}>
                  <option value="china">China</option>
                  <option value="bd">Bangladesh</option>
                  <option value="instagram">Instagram</option>
                  <option value="tiktok">TikTok</option>
                </select>
              </Field>
              <Field label="Pillar">
                <select className="inp" value={pillar} onChange={e => setPillar(e.target.value)}>
                  <option value="scholarship">Scholarship</option>
                  <option value="trust">Trust</option>
                  <option value="career">Career</option>
                  <option value="urgency">Urgency</option>
                  <option value="university">University</option>
                  <option value="cost">Cost</option>
                  <option value="success_story">Success Story</option>
                  <option value="trending">Trending</option>
                </select>
              </Field>
              <Field label="Format">
                <select className="inp" value={format} onChange={e => setFormat(e.target.value)}>
                  <option>Carousel</option><option>Reel</option><option>Single image</option><option>Story</option><option>Video</option><option>Live</option><option>Text</option>
                </select>
              </Field>
              <Field label="Platform">
                <select className="inp" value={platform} onChange={e => { setPlatform(e.target.value); setPreviewTab(e.target.value); }}>
                  <option value="facebook">Facebook</option>
                  <option value="instagram">Instagram</option>
                  <option value="tiktok">TikTok</option>
                </select>
              </Field>
              <Field label="Language">
                <select className="inp" value={language} onChange={e => setLanguage(e.target.value)}>
                  <option value="bangla">Bangla</option>
                  <option value="english">English</option>
                  <option value="mixed">Bangla + English (Mixed)</option>
                </select>
              </Field>
              <Field label="Design Brief">
                <input className="inp" value={brief} onChange={e => setBrief(e.target.value)} placeholder="Asset instructions…" />
              </Field>
            </div>
            <div className="flex justify-between">
              <button onClick={() => setStep(4)} className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-sm">← Back</button>
              <button onClick={() => setStep(6)} className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium">Review →</button>
            </div>
          </div>
        );
      case 6:
        return (
          <div className="space-y-4">
            <div className="bg-slate-50 rounded-lg p-3 space-y-2">
              <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Content Summary</h4>
              <div className="text-xs text-slate-600 space-y-1">
                <p><span className="font-medium text-slate-800">Hook:</span> {hook || <span className="text-rose-500">Missing</span>}</p>
                <p><span className="font-medium text-slate-800">Body:</span> {body ? `${body.slice(0, 120)}…` : <span className="text-rose-500">Missing</span>}</p>
                <p><span className="font-medium text-slate-800">CTA:</span> {cta || <span className="text-slate-400">None</span>}</p>
                <p><span className="font-medium text-slate-800">Hashtags:</span> {hashtags || <span className="text-slate-400">None</span>}</p>
                <p><span className="font-medium text-slate-800">Format:</span> {format} · {platform} · {language}</p>
                <p><span className="font-medium text-slate-800">Page/Pillar:</span> {page} / {pillar}</p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-lg p-3">
              <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">Quality Gate</h4>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <div className={`text-xs p-2 rounded-lg border ${qualityChecks.fact_check ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700'}`}>
                  ✅ Fact Check: {qualityChecks.fact_check ? 'PASS' : 'FAIL'}
                </div>
                <div className={`text-xs p-2 rounded-lg border ${qualityChecks.tone_ok ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700'}`}>
                  ✅ Tone: {qualityChecks.tone_ok ? 'OK' : 'FAIL'}
                </div>
                <div className={`text-xs p-2 rounded-lg border ${(!qualityChecks.banned_words || qualityChecks.banned_words.length === 0) ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700'}`}>
                  ✅ Banned Words: {(!qualityChecks.banned_words || qualityChecks.banned_words.length === 0) ? 'CLEAN' : `${qualityChecks.banned_words.length} found`}
                </div>
                <div className={`text-xs p-2 rounded-lg border ${qualityChecks.figure_verified === 'verified' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
                  ⚠️ Figures: {qualityChecks.figure_verified === 'verified' ? 'VERIFIED' : qualityChecks.figure_verified === 'unverified' ? 'UNVERIFIED' : 'PENDING'}
                </div>
              </div>
              {qualityChecks.banned_words && qualityChecks.banned_words.length > 0 && (
                <div className="bg-rose-50 border border-rose-200 rounded-lg p-2 mb-2">
                  <p className="text-xs font-bold text-rose-700 mb-1">🚫 Banned words found:</p>
                  {qualityChecks.banned_words.map((w, i) => (
                    <span key={i} className="text-xs bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded mr-1">{w}</span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <button onClick={handleSaveDraft} disabled={loading} className="flex-1 text-sm py-2.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 font-medium disabled:opacity-50">
                  {loading ? <RefreshCw size={14} className="animate-spin inline mr-1" /> : null} Save to Draft
                </button>
                <button onClick={handleApproveAndQueue} disabled={loading} className="flex-1 text-sm py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium disabled:opacity-50">
                  {loading ? <RefreshCw size={14} className="animate-spin inline mr-1" /> : <Check size={14} className="inline mr-1" />} Approve & Queue
                </button>
              </div>
              <button onClick={handleSendToDesigner} disabled={loading} className="w-full text-sm py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-medium disabled:opacity-50">
                {loading ? <RefreshCw size={14} className="animate-spin inline mr-1" /> : <Palette size={14} className="inline mr-1" />} Send to Designer
              </button>
            </div>

            <div className="flex justify-between">
              <button onClick={() => setStep(5)} className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-sm">← Back</button>
              <div />
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Left Panel */}
      <div className="space-y-4">
        {/* Tabs */}
        <div className="flex gap-1">
          {[
            { id: 'generator', label: 'Generator', icon: Wand2 },
            { id: 'kb', label: 'Knowledge Base', icon: BookOpen },
            { id: 'hooks', label: 'Hook Library', icon: Zap },
          ].map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition ${activeTab === t.id ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              <t.icon size={14} />{t.label}
            </button>
          ))}
        </div>

        {/* Generator Panel */}
        {activeTab === 'generator' && (
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 mb-4">
              <Wand2 size={15} className="text-blue-600" />
              <h3 className="text-sm font-semibold text-slate-700">Content Builder</h3>
              <div className="flex-1" />
              <button onClick={generateWithAI} disabled={aiGenerating || !page || !pillar} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-medium disabled:opacity-50 transition">
                {aiGenerating ? <RefreshCw size={12} className="animate-spin" /> : <Sparkles size={12} />}
                {aiGenerating ? 'Generating…' : 'Generate with AI'}
              </button>
              <QualityBadge score={qualityScore} />
            </div>

            {/* Stepper */}
            <div className="flex items-center gap-1 mb-4 overflow-x-auto pb-1">
              {steps.map((s, i) => (
                <button key={s.id} onClick={() => setStep(s.id)} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${step === s.id ? 'bg-blue-600 text-white' : step > s.id ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-slate-50 text-slate-500 border border-slate-200'}`}>
                  <s.icon size={12} />
                  <span className="hidden sm:inline">{i + 1}. {s.label}</span>
                  <span className="sm:hidden">{i + 1}</span>
                </button>
              ))}
            </div>

            {/* Step Content */}
            <div className="min-h-[200px]">{renderStepContent()}</div>

            {/* Selected items chips */}
            <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap gap-2">
              {selectedHook && (
                <span className="inline-flex items-center gap-1 text-xs bg-violet-50 text-violet-700 px-2 py-1 rounded-full border border-violet-200">
                  <Zap size={10} /> Hook: {selectedHook.hook_text.slice(0, 30)}… <button onClick={() => { setSelectedHook(null); setHook(''); }} className="text-violet-400 hover:text-violet-600"><X size={10} /></button>
                </span>
              )}
              {selectedUniversity && (
                <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full border border-blue-200">
                  🏫 {selectedUniversity.name} <button onClick={() => setSelectedUniversity(null)} className="text-blue-400 hover:text-blue-600"><X size={10} /></button>
                </span>
              )}
              {selectedScholarship && (
                <span className="inline-flex items-center gap-1 text-xs bg-emerald-50 text-emerald-700 px-2 py-1 rounded-full border border-emerald-200">
                  💰 {selectedScholarship.name} <button onClick={() => setSelectedScholarship(null)} className="text-emerald-400 hover:text-emerald-600"><X size={10} /></button>
                </span>
              )}
            </div>

            {/* Research Intel Feed */}
            <div className="mt-4 pt-3 border-t border-slate-100">
              <h4 className="text-xs font-semibold text-slate-500 mb-2">Active Intelligence ({researchIntel.length})</h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {researchIntel.length === 0 ? (
                  <p className="text-xs text-slate-400">No active intelligence. Add research findings to fuel content.</p>
                ) : researchIntel.slice(0, 5).map(r => (
                  <div key={r.id} className={`p-2 rounded-lg border text-xs ${r.urgency === 'critical' ? 'bg-rose-50 border-rose-100' : r.urgency === 'high' ? 'bg-amber-50 border-amber-100' : 'bg-blue-50 border-blue-100'}`}>
                    <span className={`font-semibold ${r.urgency === 'critical' ? 'text-rose-700' : r.urgency === 'high' ? 'text-amber-700' : 'text-blue-700'}`}>
                      {r.urgency === 'critical' ? '🚨' : r.urgency === 'high' ? '⚠️' : '💡'} {r.category}:
                    </span>
                    <span className="text-slate-700"> {r.topic}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* KB Panel */}
        {activeTab === 'kb' && (
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <BookOpen size={15} className="text-blue-600" />
              <h3 className="text-sm font-semibold text-slate-700">Knowledge Base</h3>
            </div>

            {/* Search & Filters */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <input className="inp col-span-2 md:col-span-1" value={kbSearch} onChange={e => setKbSearch(e.target.value)} placeholder="Search…" />
              <input className="inp" value={kbCountry} onChange={e => setKbCountry(e.target.value)} placeholder="Country filter" />
              <input className="inp" value={kbProgramType} onChange={e => setKbProgramType(e.target.value)} placeholder="Program type" />
              <select className="inp" value={kbPartnerStatus} onChange={e => setKbPartnerStatus(e.target.value)}>
                <option value="">All partners</option>
                <option value="partner">Partner only</option>
                <option value="non-partner">Non-partner</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button onClick={searchKB} className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium flex items-center gap-1"><Search size={14} /> Search</button>
              <button onClick={() => { setKbSearch(''); setKbCountry(''); setKbProgramType(''); setKbPartnerStatus(''); setKbUniversities([]); setKbScholarships([]); }} className="px-3 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm">Reset</button>
            </div>

            {/* Universities Grid */}
            {kbUniversities.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-2">Universities ({kbUniversities.length})</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-80 overflow-y-auto">
                  {kbUniversities.map(u => (
                    <div key={u.id} onClick={() => { setSelectedUniversity(u); setActiveTab('generator'); toast.success(`Selected ${u.name}`); }} className={`p-3 rounded-lg border cursor-pointer transition ${selectedUniversity?.id === u.id ? 'border-blue-400 bg-blue-50 ring-1 ring-blue-100' : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'}`}>
                      <div className="flex items-start justify-between mb-1">
                        <p className="font-semibold text-slate-800 text-sm">{u.name}</p>
                        <div className="flex gap-1">
                          {(u.csca_free || u.csca_free === 'true') && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">CSCA-free</span>}
                          {(u.partner || u.partner === 'true' || u.partner === 1) && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Partner</span>}
                        </div>
                      </div>
                      <p className="text-xs text-slate-500">{u.city}, {u.country} · {u.programs}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{u.tuition}</p>
                      {u.intakes && <p className="text-[10px] text-slate-400 mt-1">Intakes: {u.intakes}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Scholarships Grid */}
            {kbScholarships.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-2">Scholarships ({kbScholarships.length})</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-80 overflow-y-auto">
                  {kbScholarships.map(s => (
                    <div key={s.id} onClick={() => { setSelectedScholarship(s); setActiveTab('generator'); toast.success(`Selected ${s.name}`); }} className={`p-3 rounded-lg border cursor-pointer transition ${selectedScholarship?.id === s.id ? 'border-emerald-400 bg-emerald-50 ring-1 ring-emerald-100' : 'border-slate-200 hover:border-emerald-300 hover:bg-slate-50'}`}>
                      <p className="font-semibold text-slate-800 text-sm">{s.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{s.coverage?.slice(0, 100)}{s.coverage?.length > 100 ? '…' : ''}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        {s.deadline && <span className="text-[10px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded border border-amber-100">⏰ {s.deadline}</span>}
                        {s.eligibility && <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-100">✅ {s.eligibility.slice(0, 40)}{s.eligibility.length > 40 ? '…' : ''}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {kbUniversities.length === 0 && kbScholarships.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-6">Search with filters to find universities and scholarships from your Data Center.</p>
            )}
          </div>
        )}

        {/* Hooks Panel */}
        {activeTab === 'hooks' && (
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Zap size={15} className="text-blue-600" />
              <h3 className="text-sm font-semibold text-slate-700">Hook Library</h3>
              <span className="text-xs text-slate-400 ml-auto">{filteredHooks.length} hooks</span>
            </div>

            {/* Filters */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <input className="inp" placeholder="Hook type" value={hooksFilter.hook_type} onChange={e => setHooksFilter(f => ({ ...f, hook_type: e.target.value }))} />
              <input className="inp" placeholder="Destination" value={hooksFilter.destination} onChange={e => setHooksFilter(f => ({ ...f, destination: e.target.value }))} />
              <input className="inp" placeholder="Pillar" value={hooksFilter.pillar} onChange={e => setHooksFilter(f => ({ ...f, pillar: e.target.value }))} />
              <select className="inp" value={hooksFilter.status} onChange={e => setHooksFilter(f => ({ ...f, status: e.target.value }))}>
                <option value="">All statuses</option>
                <option value="winner">🏆 Winner</option>
                <option value="tested">🧪 Tested</option>
                <option value="loser">❌ Loser</option>
              </select>
            </div>

            {/* Hooks Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-96 overflow-y-auto">
              {filteredHooks.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6 col-span-2">No hooks match your filters. Add tested hooks with performance data.</p>
              ) : filteredHooks.map(h => (
                <div key={h.id} onClick={() => { setSelectedHook(h); setHook(h.hook_text); setActiveTab('generator'); setStep(1); toast.success('Hook selected'); }} className={`p-3 rounded-lg border cursor-pointer transition ${selectedHook?.id === h.id ? 'border-violet-400 bg-violet-50 ring-1 ring-violet-100' : 'border-slate-200 hover:border-violet-300 hover:bg-slate-50'}`}>
                  <div className="flex items-start justify-between mb-1">
                    <p className="font-semibold text-slate-800 text-sm leading-snug">{h.hook_text}</p>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${h.status === 'winner' ? 'bg-emerald-100 text-emerald-700' : h.status === 'tested' ? 'bg-blue-100 text-blue-700' : 'bg-rose-100 text-rose-700'}`}>{h.status || 'tested'}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 mt-1">
                    <span className="bg-slate-100 px-1.5 py-0.5 rounded">{h.hook_type || '—'}</span>
                    <span>{h.destination || '—'}</span>
                    <span>·</span>
                    <span>Conv: <b className="text-slate-700">{h.conversion_rate ? (h.conversion_rate * 100).toFixed(1) + '%' : '0%'}</b></span>
                    <span>·</span>
                    <span>Reach: <b className="text-slate-700">{h.avg_reach?.toLocaleString() || '—'}</b></span>
                    <span>·</span>
                    <span>{h.usage_count || 0} uses</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Right Panel — Always Live Preview */}
      <div className="space-y-4">
        {/* Quality Score Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-700">Live Preview & Quality Gate</h3>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${qualityScore >= 80 ? 'bg-emerald-100 text-emerald-700' : qualityScore >= 60 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>
              Quality: {qualityScore}/100
            </span>
          </div>

          {/* Quality checks mini */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className={`text-xs p-2 rounded-lg border ${qualityChecks.fact_check ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700'}`}>
              ✅ Fact Check: {qualityChecks.fact_check ? 'PASS' : 'FAIL'}
            </div>
            <div className={`text-xs p-2 rounded-lg border ${qualityChecks.tone_ok ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700'}`}>
              ✅ Tone: {qualityChecks.tone_ok ? 'OK' : 'FAIL'}
            </div>
            <div className={`text-xs p-2 rounded-lg border ${(!qualityChecks.banned_words || qualityChecks.banned_words.length === 0) ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700'}`}>
              ✅ Banned: {(!qualityChecks.banned_words || qualityChecks.banned_words.length === 0) ? 'CLEAN' : `${qualityChecks.banned_words.length} found`}
            </div>
            <div className={`text-xs p-2 rounded-lg border ${qualityChecks.figure_verified === 'verified' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
              ⚠️ Figures: {qualityChecks.figure_verified === 'verified' ? 'VERIFIED' : qualityChecks.figure_verified === 'unverified' ? 'UNVERIFIED' : 'PENDING'}
            </div>
          </div>

          {qualityChecks.banned_words && qualityChecks.banned_words.length > 0 && (
            <div className="bg-rose-50 border border-rose-200 rounded-lg p-2 mb-3">
              <p className="text-xs font-bold text-rose-700 mb-1">🚫 Banned words found:</p>
              {qualityChecks.banned_words.map((w, i) => (
                <span key={i} className="text-xs bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded mr-1">{w}</span>
              ))}
            </div>
          )}

          {/* Platform Warnings */}
          {platformWarnings.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 mb-3">
              <p className="text-xs font-bold text-amber-700 mb-1">⚠️ Platform Warnings:</p>
              <ul className="space-y-0.5">
                {platformWarnings.map((w, i) => (
                  <li key={i} className="text-xs text-amber-700">• {w}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Selected chips */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            {selectedHook && <span className="text-[10px] bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">Hook selected</span>}
            {selectedUniversity && <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">🏫 {selectedUniversity.name}</span>}
            {selectedScholarship && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">💰 {selectedScholarship.name}</span>}
          </div>

          {/* Platform Preview Tabs */}
          <div className="flex gap-1 mb-2">
            {[{ id: 'facebook', label: 'Facebook' }, { id: 'instagram', label: 'Instagram' }, { id: 'tiktok', label: 'TikTok' }].map(t => (
              <button key={t.id} onClick={() => setPreviewTab(t.id)} className={`text-xs px-2.5 py-1 rounded-lg font-medium ${previewTab === t.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>{t.label}</button>
            ))}
          </div>

          <div className="border border-slate-200 rounded-lg bg-slate-50 overflow-hidden">
            {previewTab === 'facebook' && (
              <div className="bg-white p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">E</div>
                  <div>
                    <p className="text-xs font-semibold text-slate-800">EduExpress International</p>
                    <p className="text-[10px] text-slate-400">Sponsored · Just now</p>
                  </div>
                </div>
                <p className="text-sm font-bold text-slate-800 mb-1">{hook || <span className="text-slate-300 font-normal">Your hook will appear here…</span>}</p>
                <p className="text-xs text-slate-600 whitespace-pre-line">{body || <span className="text-slate-300">Your body copy will appear here…</span>}</p>
                {cta && <p className="text-xs font-semibold text-blue-600 mt-2">{cta}</p>}
                {hashtags && <p className="text-xs text-blue-500 mt-1">{hashtags}</p>}
                <div className="mt-3 bg-slate-100 rounded-lg h-40 flex items-center justify-center text-xs text-slate-400 border border-slate-200">
                  <div className="text-center">
                    <Layout size={20} className="mx-auto mb-1 text-slate-300" />
                    <span>[{format} Asset]</span>
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                  <span className="flex items-center gap-1"><Heart size={12} /> Like</span>
                  <span className="flex items-center gap-1"><MessageCircle size={12} /> Comment</span>
                  <span className="flex items-center gap-1"><Share2 size={12} /> Share</span>
                </div>
              </div>
            )}
            {previewTab === 'instagram' && (
              <div className="bg-white p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 flex items-center justify-center text-white text-[10px] font-bold">E</div>
                  <p className="text-xs font-semibold text-slate-800">eduexpressint</p>
                  <span className="text-[10px] text-slate-400 ml-auto">{format}</span>
                </div>
                <div className="bg-slate-100 rounded-lg h-56 flex items-center justify-center text-xs text-slate-400 border border-slate-200">
                  <div className="text-center">
                    <Layout size={20} className="mx-auto mb-1 text-slate-300" />
                    <span>[{format} 9:16]</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-2 text-xs text-slate-600">
                  <Heart size={14} />
                  <MessageCircle size={14} />
                  <Send size={14} />
                  <span className="ml-auto text-[10px] text-slate-400">1/5</span>
                </div>
                <p className="text-xs font-bold text-slate-800 mt-2">{hook || <span className="text-slate-300 font-normal">Your hook…</span>}</p>
                <p className="text-xs text-slate-600 whitespace-pre-line mt-0.5">{body || <span className="text-slate-300">Your body copy…</span>}</p>
                {cta && <p className="text-xs font-semibold text-blue-600 mt-1">{cta}</p>}
                {hashtags && <p className="text-xs text-blue-500 mt-1">{hashtags}</p>}
              </div>
            )}
            {previewTab === 'tiktok' && (
              <div className="bg-black p-3 text-white">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-full bg-white text-black flex items-center justify-center text-[10px] font-bold">E</div>
                  <p className="text-xs font-semibold">eduexpressint</p>
                  <span className="text-[10px] text-slate-400 ml-auto">{format}</span>
                </div>
                <div className="bg-slate-800 rounded-lg h-64 flex items-center justify-center text-xs text-slate-400 border border-slate-700">
                  <div className="text-center">
                    <Layout size={20} className="mx-auto mb-1 text-slate-500" />
                    <span>[TikTok 9:16]</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-2 text-xs text-slate-300">
                  <Heart size={14} />
                  <MessageCircle size={14} />
                  <Send size={14} />
                </div>
                <p className="text-sm font-bold mt-2">{hook || <span className="text-slate-500 font-normal">Your hook…</span>}</p>
                <p className="text-xs text-slate-300 whitespace-pre-line mt-0.5">{body || <span className="text-slate-500">Your body copy…</span>}</p>
                {cta && <p className="text-xs font-semibold text-emerald-400 mt-1">{cta}</p>}
                {hashtags && <p className="text-xs text-blue-400 mt-1">{hashtags}</p>}
              </div>
            )}
          </div>

          {/* UTM */}
          <div className="text-xs text-slate-500 mt-2">
            <p>🔗 Campaign: <span className="text-blue-600 font-mono">{pillar}_{page}_{new Date().toISOString().slice(0, 10)}</span></p>
          </div>
        </div>

        {/* Pipeline Legend */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h4 className="text-xs font-semibold text-slate-700 mb-2">Pipeline Legend</h4>
          <div className="flex flex-wrap gap-1.5">
            {STATUS_PIPELINE.map((s, i) => (
              <div key={s} className="flex items-center gap-1">
                <Pill value={s} />
                {i < STATUS_PIPELINE.length - 1 && <span className="text-slate-300 text-xs">→</span>}
              </div>
            ))}
          </div>
          <p className="text-[10px] text-slate-400 mt-2">
            Save = Drafted → Review → Approve & Queue = Approved + Publishing → Send to Designer = Asset Pending → Asset Ready → Scheduled → Published
          </p>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  DESIGNER HUB TAB — Asset Queue, Upload, Review
// ═══════════════════════════════════════════════════════════
function DesignerHubTab() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [editing, setEditing] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.marketing.designerQueue(),
      api.marketing.posts({}),
    ]).then(([queue, allPosts]) => {
      setItems(queue);
      setPosts(allPosts);
      setLoading(false);
    }).catch(e => { toast.error(e.message); setLoading(false); });
  }, [toast]);
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    if (!filter) return items;
    return items.filter(i => i.status === filter);
  }, [items, filter]);

  const getPost = (postId) => posts.find(p => p.id === postId) || {};

  const updateStatus = async (id, status, data = {}) => {
    try {
      await api.marketing.updateDesignerQueue(id, { status, ...data });
      // Also update the post status if designer marks ready
      if (status === 'completed') {
        const item = items.find(i => i.id === id);
        if (item?.post_id) {
          await api.marketing.setPostStatus(item.post_id, { status: 'asset_ready' });
        }
      }
      toast.success('Updated');
      load();
    } catch (e) { toast.error(e.message); }
  };

  const byStatus = useMemo(() => {
    const m = { assigned: [], in_progress: [], review: [], completed: [], rejected: [] };
    for (const i of items) { (m[i.status] = m[i.status] || []).push(i); }
    return m;
  }, [items]);

  if (loading) return <div className="py-16 text-center text-slate-400 text-sm">Loading designer hub…</div>;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {['assigned', 'in_progress', 'review', 'completed', 'rejected'].map(s => (
          <button key={s} onClick={() => setFilter(filter === s ? '' : s)} className={`bg-white rounded-xl border p-3 text-left transition ${filter === s ? 'border-blue-400 ring-2 ring-blue-100' : 'border-slate-200'}`}>
            <p className="text-xs text-slate-400 uppercase">{s.replace('_', ' ')}</p>
            <p className="text-2xl font-bold text-slate-800">{(byStatus[s] || []).length}</p>
          </button>
        ))}
      </div>

      {/* Queue */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <h3 className="font-semibold text-slate-700 text-sm flex items-center gap-2"><Palette size={15} />Designer Queue ({filtered.length})</h3>
          <div className="flex gap-1">
            {['', 'assigned', 'in_progress', 'review'].map(s => (
              <button key={s || 'all'} onClick={() => setFilter(s)} className={`text-xs px-2.5 py-1 rounded-lg ${filter === s ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'}`}>{s || 'All'}</button>
            ))}
          </div>
        </div>
        <div className="divide-y divide-slate-100">
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">No items in queue. Posts marked "Asset Pending" will appear here.</p>
          ) : filtered.map(item => {
            const post = getPost(item.post_id);
            return (
              <div key={item.id} className="p-4 hover:bg-slate-50 transition">
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Pill value={item.status} />
                      <PageBadge page={post.page} />
                      <PillarBadge pillar={post.pillar} />
                      <span className="text-xs text-slate-400">Due: {item.deadline || '—'}</span>
                      <span className={`text-xs font-bold ${item.priority === 'urgent' ? 'text-rose-500' : item.priority === 'normal' ? 'text-amber-500' : 'text-slate-400'}`}>{item.priority}</span>
                    </div>
                    <p className="text-sm font-semibold text-slate-800">{post.hook || 'Untitled'}</p>
                    <p className="text-xs text-slate-600 mt-1">🎨 <span className="font-medium">Brief:</span> {item.brief || post.brief || 'No brief'}</p>
                    {item.final_asset_url && (
                      <div className="mt-2">
                        <img src={item.final_asset_url} alt="asset" className="w-48 h-32 object-cover rounded-lg border" />
                      </div>
                    )}
                    {item.feedback && <p className="text-xs text-amber-600 mt-1">💬 {item.feedback}</p>}
                  </div>
                  <div className="flex flex-col gap-1">
                    {item.status === 'assigned' && (
                      <button onClick={() => updateStatus(item.id, 'in_progress')} className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100">Start</button>
                    )}
                    {item.status === 'in_progress' && (
                      <button onClick={() => setEditing(item)} className="text-xs px-2 py-1 rounded bg-amber-50 text-amber-700 hover:bg-amber-100">Upload</button>
                    )}
                    {item.status === 'review' && (
                      <>
                        <button onClick={() => updateStatus(item.id, 'completed')} className="text-xs px-2 py-1 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100">Approve</button>
                        <button onClick={() => setEditing({ ...item, mode: 'feedback' })} className="text-xs px-2 py-1 rounded bg-rose-50 text-rose-700 hover:bg-rose-100">Feedback</button>
                      </>
                    )}
                    <button onClick={() => setEditing({ ...item, mode: 'upload' })} className="text-xs px-2 py-1 rounded bg-slate-50 text-slate-600 hover:bg-slate-100">Edit</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {editing && <DesignerUploadModal item={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </div>
  );
}

function DesignerUploadModal({ item, onClose, onSaved }) {
  const toast = useToast();
  const [f, setF] = useState({
    draft_asset_url: item.draft_asset_url || '',
    final_asset_url: item.final_asset_url || '',
    feedback: item.feedback || '',
    status: item.status || 'in_progress',
  });
  const set = (k, v) => setF(s => ({ ...s, [k]: v }));

  const save = async () => {
    try {
      await api.marketing.updateDesignerQueue(item.id, f);
      toast.success('Saved');
      onSaved();
    } catch (e) { toast.error(e.message); }
  };

  return (
    <Modal title={item.mode === 'feedback' ? 'Send Feedback' : 'Upload Asset'} onClose={onClose} wide>
      <div className="space-y-3">
        <Field label="Draft Asset URL"><input className="inp" value={f.draft_asset_url} onChange={e => set('draft_asset_url', e.target.value)} placeholder="https://..." /></Field>
        <Field label="Final Asset URL"><input className="inp" value={f.final_asset_url} onChange={e => set('final_asset_url', e.target.value)} placeholder="https://..." /></Field>
        <Field label="Status">
          <select className="inp" value={f.status} onChange={e => set('status', e.target.value)}>
            <option>assigned</option><option>in_progress</option><option>review</option><option>completed</option><option>rejected</option>
          </select>
        </Field>
        <Field label="Feedback / Notes"><textarea rows={3} className="inp" value={f.feedback} onChange={e => set('feedback', e.target.value)} /></Field>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 text-slate-600">Cancel</button>
          <button onClick={save} className="px-3 py-1.5 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium">Save</button>
        </div>
      </div>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════
//  ANALYTICS & ATTRIBUTION TAB — Funnel, ROI, Performance
// ═══════════════════════════════════════════════════════════
function AnalyticsTab() {
  const toast = useToast();
  const [posts, setPosts] = useState([]);
  const [overview, setOverview] = useState(null);
  const [funnel, setFunnel] = useState(null);
  const [pillars, setPillars] = useState([]);
  const [pages, setPages] = useState([]);
  const [attribution, setAttribution] = useState([]);
  const [consistency, setConsistency] = useState([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.marketing.posts({}),
      api.marketing.analyticsOverview(days),
      api.marketing.analyticsFunnel(days),
      api.marketing.analyticsPillars(days),
      api.marketing.analyticsPages(days),
      api.marketing.analyticsAttribution(days),
      api.marketing.analyticsConsistency(),
    ]).then(([p, o, f, pl, pa, a, c]) => {
      setPosts(p); setOverview(o); setFunnel(f); setPillars(pl); setPages(pa); setAttribution(a); setConsistency(c); setLoading(false);
    }).catch(e => { toast.error(e.message); setLoading(false); });
  }, [toast, days]);

  if (loading) return <div className="py-16 text-center text-slate-400 text-sm">Loading analytics…</div>;

  const published = posts.filter(p => p.status === 'published');
  const avgReach = published.length ? Math.round(published.reduce((s, p) => s + (p.reach || 0), 0) / published.length) : 0;

  return (
    <div className="space-y-5">
      {/* Days filter */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-400">Period:</span>
        {[7, 14, 30, 90].map(d => (
          <button key={d} onClick={() => setDays(d)} className={`text-xs px-2.5 py-1 rounded-lg ${days === d ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>{d}d</button>
        ))}
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Posts', value: overview?.total || 0 },
          { label: 'Published', value: overview?.published || 0 },
          { label: 'Leads Generated', value: overview?.totalLeads || 0 },
          { label: 'Avg Reach', value: (overview?.avgReach || 0).toLocaleString() },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-400">{c.label}</p>
            <p className="text-2xl font-bold text-slate-800 mt-1">{c.value}</p>
          </div>
        ))}
      </div>

      {/* Funnel */}
      {funnel && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Lead Funnel (Post → Lead → File → Enrolled)</h3>
          <div className="flex items-center gap-4">
            {[
              { label: 'Reach', value: funnel.reach, color: 'bg-blue-500' },
              { label: 'Leads', value: funnel.leads, color: 'bg-indigo-500' },
              { label: 'Files', value: funnel.files, color: 'bg-violet-500' },
              { label: 'Enrolled', value: funnel.enrolled, color: 'bg-emerald-500' },
            ].map((step, i, arr) => (
              <div key={step.label} className="flex items-center gap-4">
                <div className="text-center">
                  <div className={`w-16 h-16 rounded-full ${step.color} flex items-center justify-center text-white text-sm font-bold`}>
                    {step.value}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{step.label}</p>
                  {i > 0 && (
                    <p className="text-[10px] text-slate-400">
                      {arr[i-1].value ? Math.round((step.value / arr[i-1].value) * 100) : 0}% conv
                    </p>
                  )}
                </div>
                {i < arr.length - 1 && <div className="text-slate-300">→</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Charts Row */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Performance by Pillar</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={pillars}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
              <XAxis dataKey="pillar" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 12 }} /><Tooltip />
              <Bar dataKey="avg_engagement" fill="#6366f1" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Performance by Page</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={pages}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
              <XAxis dataKey="page" tick={{ fontSize: 12 }} /><YAxis tick={{ fontSize: 12 }} /><Tooltip />
              <Bar dataKey="total_leads" radius={[6, 6, 0, 0]}>
                {pages.map((_, i) => <Cell key={i} fill={['#2563eb', '#16a34a', '#db2777', '#64748b'][i % 4]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Attribution Table */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Top Performing Posts (By Leads)</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs">
                <th className="text-left font-medium px-3 py-2">Hook</th>
                <th className="text-left font-medium px-3 py-2">Page</th>
                <th className="text-left font-medium px-3 py-2">Pillar</th>
                <th className="text-right font-medium px-3 py-2">Leads</th>
                <th className="text-right font-medium px-3 py-2">Revenue (৳)</th>
              </tr>
            </thead>
            <tbody>
              {attribution.slice(0, 10).map((row, i) => (
                <tr key={i} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2 text-xs text-slate-700 max-w-[200px] truncate">{row.hook || '—'}</td>
                  <td className="px-3 py-2"><PageBadge page={row.page} /></td>
                  <td className="px-3 py-2"><PillarBadge pillar={row.pillar} /></td>
                  <td className="px-3 py-2 text-right text-xs font-bold text-slate-700">{row.lead_count || 0}</td>
                  <td className="px-3 py-2 text-right text-xs font-bold text-emerald-600">{(row.revenue || 0).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Consistency Score */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Consistency Score (Weekly)</h3>
        <div className="space-y-2">
          {consistency.slice(0, 8).map((c, i) => (
            <div key={c.week} className="flex items-center gap-3">
              <div className="w-24 text-xs text-slate-500">{c.week}</div>
              <div className="flex-1 relative h-4 bg-slate-100 rounded-full overflow-hidden">
                <div className="absolute inset-y-0 left-0 rounded-full bg-blue-500 transition-all" style={{ width: `${Math.min(100, c.score)}%` }} />
              </div>
              <div className="w-16 text-xs text-right font-bold text-slate-700">{c.published}/{c.target}</div>
              <div className="w-12 text-xs text-right font-bold {c.score >= 80 ? 'text-emerald-600' : c.score >= 50 ? 'text-amber-600' : 'text-rose-600'}">{c.score}%</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  EXISTING TABS (Kept from original Marketing.jsx)
// ═══════════════════════════════════════════════════════════

const DATA_RESOURCES = [
  { id: 'kb/universities', label: 'Universities', cols: [
    { k: 'name', l: 'University' }, { k: 'country', l: 'Country' }, { k: 'city', l: 'City' },
    { k: 'programs', l: 'Programs' }, { k: 'intakes', l: 'Intakes' }, { k: 'tuition', l: 'Tuition' },
    { k: 'lang_req', l: 'Language' }, { k: 'admission_url', l: 'Admission URL' }, { k: 'brochure_url', l: 'Brochure' },
    { k: 'partner', l: 'Partner' }, { k: 'notes', l: 'Notes', long: true }, { k: 'last_verified', l: 'Verified' } ] },
  { id: 'kb/scholarships', label: 'Scholarships', cols: [
    { k: 'name', l: 'Scholarship' }, { k: 'country', l: 'Country' }, { k: 'type', l: 'Type' },
    { k: 'coverage', l: 'Coverage', long: true }, { k: 'eligibility', l: 'Eligibility' }, { k: 'deadline', l: 'Deadline' },
    { k: 'source_url', l: 'Official source' }, { k: 'status', l: 'Status' }, { k: 'last_verified', l: 'Verified' }, { k: 'notes', l: 'Notes', long: true } ] },
  { id: 'kb/sources', label: 'Research Library', cols: [
    { k: 'topic', l: 'Topic' }, { k: 'url', l: 'URL' }, { k: 'source_type', l: 'Type' },
    { k: 'use_for', l: 'Use for' }, { k: 'date_added', l: 'Added' }, { k: 'notes', l: 'Notes', long: true } ] },
  { id: 'competitors', label: 'Competitor Intel', cols: [
    { k: 'log_date', l: 'Date' }, { k: 'competitor', l: 'Competitor' }, { k: 'channel', l: 'Channel' },
    { k: 'observation', l: 'What they did', long: true }, { k: 'link', l: 'Link' }, { k: 'our_angle', l: 'Our angle', long: true }, { k: 'added_by', l: 'By' } ] },
  { id: 'evergreen', label: 'Evergreen Bank', cols: [
    { k: 'page_pool', l: 'Page pool' }, { k: 'pillar', l: 'Pillar' }, { k: 'body', l: 'Copy', long: true },
    { k: 'hashtags', l: 'Hashtags' }, { k: 'asset_url', l: 'Asset' }, { k: 'status', l: 'Status' } ] },
  { id: 'kb/docs', label: 'Brochures & Docs', cols: [
    { k: 'name', l: 'Doc' }, { k: 'type', l: 'Type' }, { k: 'destination', l: 'Destination' },
    { k: 'drive_url', l: 'Drive link' }, { k: 'version', l: 'Version' }, { k: 'owner', l: 'Owner' } ] },
];

const DRIVE_FOLDERS = {
  parent:    'https://drive.google.com/drive/folders/1gBY_6WHR_pAgYXYTes_BdCwfteozWtjI',
  brochures: 'https://drive.google.com/drive/folders/19m0Tb3DgTjNDFLoqSCy_KoSWwZ5dOX_F',
  notices:   'https://drive.google.com/drive/folders/1uHMzRdvNjbXPVUgQxtCyoFEkkjuXPAYF',
  sources:   'https://drive.google.com/drive/folders/1CP5pgDEAipMpPZ2rsqfDWAmXluJ7EcUJ',
};

function DataCenterTab() {
  const [sub, setSub] = useState(DATA_RESOURCES[0].id);
  const res = DATA_RESOURCES.find(r => r.id === sub);
  return (
    <div>
      <div className="flex gap-1 mb-4 flex-wrap">
        {DATA_RESOURCES.map(r => (
          <button key={r.id} onClick={() => setSub(r.id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${sub === r.id ? 'bg-slate-800 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            {r.label}
          </button>
        ))}
      </div>
      {sub === 'kb/docs' && (
        <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 text-blue-800 text-xs rounded-xl px-3 py-2.5 mb-4">
          <div className="flex-1">
            <b>To add a brochure or notice:</b> open the Drive folder, drag your file in, then copy its link and paste it into <b>Drive link</b> when you click Add.
          </div>
          <div className="flex gap-1.5 shrink-0">
            <a href={DRIVE_FOLDERS.brochures} target="_blank" rel="noopener noreferrer" className="px-2.5 py-1 rounded-lg bg-white border border-blue-300 text-blue-700 font-medium hover:bg-blue-100 whitespace-nowrap">Brochures ↗</a>
            <a href={DRIVE_FOLDERS.notices} target="_blank" rel="noopener noreferrer" className="px-2.5 py-1 rounded-lg bg-white border border-blue-300 text-blue-700 font-medium hover:bg-blue-100 whitespace-nowrap">Notices ↗</a>
          </div>
        </div>
      )}
      <CrudTable key={res.id} resource={res.id} columns={res.cols} title={res.label} />
    </div>
  );
}

function BrainTab() {
  const cols = [
    { k: 'priority', l: 'Priority' }, { k: 'provider', l: 'Provider' }, { k: 'model', l: 'Model' },
    { k: 'cred_label', l: 'n8n credential' }, { k: 'req_min', l: 'Req/min' }, { k: 'req_day', l: 'Req/day' },
    { k: 'used_today', l: 'Used today' }, { k: 'status', l: 'Status' }, { k: 'cooldown_until', l: 'Cooldown until' }, { k: 'notes', l: 'Notes', long: true },
  ];
  return (
    <div>
      <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-xl px-3 py-2 mb-4">
        Secrets stay in n8n — this only holds the credential <b>label</b>, limits, and live rotation status.
      </div>
      <CrudTable resource="brain" columns={cols} title="Brain API Pool" statusKey="status" />
    </div>
  );
}

// Generic CRUD table (unchanged)
function CrudTable({ resource, columns, title, statusKey }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    api.marketing.list(resource).then(setRows).catch(e => toast.error(e.message)).finally(() => setLoading(false));
  }, [resource, toast]);
  useEffect(() => { load(); }, [load]);

  const save = async (data) => {
    try {
      if (data.id) await api.marketing.update(resource, data.id, data);
      else await api.marketing.create(resource, data);
      toast.success('Saved'); setEditing(null); load();
    } catch (e) { toast.error(e.message); }
  };
  const del = async (row) => {
    if (!await confirm({ title: 'Delete this row?', tone: 'danger', confirmLabel: 'Delete' })) return;
    try { await api.marketing.remove(resource, row.id); toast.success('Deleted'); load(); } catch (e) { toast.error(e.message); }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <h3 className="font-semibold text-slate-700 text-sm">{title} <span className="text-slate-400 font-normal">({rows.length})</span></h3>
        <button onClick={() => setEditing({})} className="text-sm flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white"><Plus size={14} />Add</button>
      </div>
      {loading ? <div className="py-12 text-center text-slate-400 text-sm">Loading…</div>
        : rows.length === 0 ? <div className="py-12 text-center text-slate-400 text-sm">Nothing here yet. Click "Add" or let n8n populate it.</div>
        : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs">
                  {columns.map(c => <th key={c.k} className="text-left font-medium px-3 py-2 whitespace-nowrap">{c.l}</th>)}
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                    {columns.map(c => {
                      const v = String(row[c.k] ?? '');
                      const isUrl = /^https?:\/\//i.test(v);
                      return (
                      <td key={c.k} className="px-3 py-2 align-top text-slate-700">
                        {statusKey === c.k ? <Pill value={row[c.k]} />
                          : isUrl ? <a href={v} target="_blank" rel="noopener noreferrer" title={v} className="block max-w-[200px] truncate text-xs text-blue-600 hover:underline">{v.replace(/^https?:\/\/(www\.)?/, '')}</a>
                          : c.long ? <span className="line-clamp-2 text-xs text-slate-600 block max-w-[280px]">{v}</span>
                          : <span title={v} className="block max-w-[200px] truncate text-xs">{v}</span>}
                      </td>
                    );})}
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <button onClick={() => setEditing(row)} className="p-1 text-slate-400 hover:text-blue-600" aria-label="Edit"><Pencil size={14} /></button>
                      <button onClick={() => del(row)} className="p-1 text-slate-300 hover:text-rose-500" aria-label="Delete"><Trash2 size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      {editing && <RowEditor title={title} columns={columns} row={editing} onClose={() => setEditing(null)} onSave={save} />}
    </div>
  );
}

function PublishingQueueTab() {
  const toast = useToast();
  const [config, setConfig] = useState(null);
  const [duePosts, setDuePosts] = useState([]);
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all | queued | published | failed
  const [platformFilter, setPlatformFilter] = useState('all');
  const [publishingId, setPublishingId] = useState(null); // postId being published

  const [llmConfig, setLlmConfig] = useState(null);
  const [llmEditing, setLlmEditing] = useState(false);
  const [llmTestResult, setLlmTestResult] = useState(null);
  const [llmTesting, setLlmTesting] = useState(false);
  const [llmForm, setLlmForm] = useState({ provider: 'openai', model: 'gpt-4o-mini', apiKey: '' });

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.marketing.publishConfig(),
      api.marketing.postsDue(50),
      api.marketing.publishingQueueFull({ limit: 100 }),
      api.marketing.llmConfig().catch(() => null)
    ]).then(([cfg, posts, q, llm]) => {
      setConfig(cfg);
      setDuePosts(posts);
      setQueue(q);
      if (llm) { setLlmConfig(llm); setLlmForm({ provider: llm.provider, model: llm.model, apiKey: '' }); }
      setLoading(false);
    }).catch(e => {
      toast.error(e.message);
      setLoading(false);
    });
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const handleSaveLlmConfig = async () => {
    try {
      await api.marketing.saveLlmConfig(llmForm);
      toast.success('LLM config saved');
      setLlmEditing(false);
      load();
    } catch (e) { toast.error(e.message); }
  };

  const handleTestLlm = async () => {
    setLlmTesting(true);
    setLlmTestResult(null);
    try {
      const res = await api.marketing.testLlm({ prompt: 'Say hello in Bangla and return a JSON with key "status" set to "ok"' });
      setLlmTestResult(res);
      if (res.error) toast.error('LLM test failed: ' + res.error);
      else if (res.statusCode >= 400) toast.error('LLM returned HTTP ' + res.statusCode);
      else toast.success('LLM connection OK! Provider: ' + res.provider + ', Model: ' + res.model);
    } catch (e) {
      toast.error('Test failed: ' + e.message);
      setLlmTestResult({ error: e.message });
    } finally {
      setLlmTesting(false);
    }
  };

  const filteredQueue = useMemo(() => {
    let rows = queue;
    if (filter !== 'all') rows = rows.filter(r => r.status === filter);
    if (platformFilter !== 'all') rows = rows.filter(r => r.platform === platformFilter || r.publish_platform === platformFilter);
    return rows;
  }, [queue, filter, platformFilter]);

  const handlePublish = async (postId, platform, page) => {
    setPublishingId(postId);
    try {
      const res = await api.marketing.publishPost(postId, { platform, page });
      if (res.success) {
        toast.success(`Post queued for ${platform}`);
      } else {
        toast.error(res.error || 'Failed to queue');
      }
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setPublishingId(null);
    }
  };

  const handleRetry = async (queueId) => {
    try {
      const res = await api.marketing.retryPublish(queueId);
      if (res.success) {
        toast.success('Retry triggered');
        load();
      } else {
        toast.error(res.error || 'Retry failed');
      }
    } catch (e) {
      toast.error(e.message);
    }
  };

  const platformOptions = [
    { id: 'facebook', label: 'Facebook', color: 'bg-blue-100 text-blue-700' },
    { id: 'instagram', label: 'Instagram', color: 'bg-pink-100 text-pink-700' },
    { id: 'tiktok', label: 'TikTok', color: 'bg-slate-900 text-white' },
  ];

  const statusBadge = (s) => {
    const map = {
      queued: 'bg-amber-100 text-amber-700',
      published: 'bg-emerald-100 text-emerald-700',
      failed: 'bg-rose-100 text-rose-700',
      retry: 'bg-orange-100 text-orange-700'
    };
    return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[s] || 'bg-slate-100 text-slate-600'}`}>{s}</span>;
  };

  if (loading) return <div className="py-16 text-center text-slate-400 text-sm">Loading publishing queue…</div>;

  return (
    <div className="space-y-5">
      {/* Config Status Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center gap-3 mb-3">
          <h2 className="text-sm font-bold text-slate-700">Publishing Config</h2>
          <button onClick={load} className="ml-auto text-slate-400 hover:text-slate-600"><RefreshCw size={14} /></button>
        </div>
        <div className="flex gap-3 flex-wrap">
          <div className={`px-3 py-1.5 rounded-lg text-xs font-medium ${config?.n8n ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
            n8n Webhook: {config?.n8n ? 'Connected' : 'Not Configured'}
          </div>
          <div className={`px-3 py-1.5 rounded-lg text-xs font-medium ${config?.facebook?.china ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
            Facebook China: {config?.facebook?.china ? 'Ready' : 'Missing Token'}
          </div>
          <div className={`px-3 py-1.5 rounded-lg text-xs font-medium ${config?.facebook?.bd ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
            Facebook BD: {config?.facebook?.bd ? 'Ready' : 'Missing Token'}
          </div>
        </div>
      </div>

      {/* LLM Config Status Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center gap-3 mb-3">
          <h2 className="text-sm font-bold text-slate-700">AI Content Generator Config</h2>
          <div className="flex-1" />
          <button onClick={() => setLlmEditing(!llmEditing)} className="text-xs px-2.5 py-1 rounded-lg bg-violet-50 text-violet-700 hover:bg-violet-100 font-medium">
            {llmEditing ? 'Cancel' : 'Configure'}
          </button>
          <button onClick={handleTestLlm} disabled={llmTesting} className="text-xs px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-medium disabled:opacity-50">
            {llmTesting ? 'Testing…' : 'Test Connection'}
          </button>
        </div>
        <div className="flex gap-3 flex-wrap">
          <div className={`px-3 py-1.5 rounded-lg text-xs font-medium ${llmConfig?.hasKey ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
            API Key: {llmConfig?.hasKey ? 'Configured' : 'Missing'}
          </div>
          <div className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-50 text-blue-700">
            Provider: {llmConfig?.provider || '—'}
          </div>
          <div className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-50 text-slate-600">
            Model: {llmConfig?.model || '—'}
          </div>
        </div>
        {llmTestResult && (
          <div className={`mt-3 p-3 rounded-lg text-xs font-mono whitespace-pre-wrap ${llmTestResult.error || llmTestResult.statusCode >= 400 ? 'bg-rose-50 border border-rose-200 text-rose-700' : 'bg-emerald-50 border border-emerald-200 text-emerald-700'}`}>
            {llmTestResult.error ? `Error: ${llmTestResult.error}` : `HTTP ${llmTestResult.statusCode} | Provider: ${llmTestResult.provider} | Model: ${llmTestResult.model}`}
            {llmTestResult.rawResponse && <div className="mt-1 text-[10px] opacity-70">Raw: {llmTestResult.rawResponse.slice(0, 300)}…</div>}
          </div>
        )}
        {llmEditing && (
          <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Provider</label>
              <select className="inp w-full" value={llmForm.provider} onChange={e => setLlmForm({ ...llmForm, provider: e.target.value })}>
                <option value="openai">OpenAI</option>
                <option value="gemini">Google Gemini</option>
                <option value="opencode-go">OpenCode GO (GLM-5.1)</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Model</label>
              <input className="inp w-full" value={llmForm.model} onChange={e => setLlmForm({ ...llmForm, model: e.target.value })} placeholder="gpt-4o-mini / gemini-1.5-pro / glm-5.1" />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">API Key</label>
              <input className="inp w-full" type="password" value={llmForm.apiKey} onChange={e => setLlmForm({ ...llmForm, apiKey: e.target.value })} placeholder="sk-... or AIza..." />
            </div>
            <div className="md:col-span-3 flex justify-end">
              <button onClick={handleSaveLlmConfig} className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700">Save LLM Config</button>
            </div>
          </div>
        )}
      </div>

      {/* Approved Posts — Ready to Publish */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h2 className="text-sm font-bold text-slate-700 mb-3">Approved Posts — Ready to Publish ({duePosts.length})</h2>
        {duePosts.length === 0 ? (
          <p className="text-sm text-slate-400">No approved posts waiting. Approve posts in Content Factory first.</p>
        ) : (
          <div className="space-y-2">
            {duePosts.slice(0, 10).map(post => (
              <div key={post.id} className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 bg-slate-50">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">{post.title || post.hook || 'Untitled'}</p>
                  <p className="text-xs text-slate-400">{post.page} · {post.platform} · {post.pillar} · Quality: {post.quality_score || '—'}</p>
                </div>
                <div className="flex items-center gap-2">
                  {post.publish_status ? (
                    <span className="text-xs text-slate-500">{post.publish_status} on {post.publish_platform}</span>
                  ) : (
                    <>
                      <select
                        className="text-xs border border-slate-200 rounded-lg px-2 py-1"
                        defaultValue=""
                        onChange={e => {
                          if (e.target.value) handlePublish(post.id, e.target.value, post.page);
                        }}
                        disabled={publishingId === post.id}
                      >
                        <option value="">Publish to…</option>
                        <option value="facebook">Facebook</option>
                        <option value="instagram">Instagram</option>
                        <option value="tiktok">TikTok</option>
                      </select>
                      {publishingId === post.id && <RefreshCw size={14} className="animate-spin text-blue-600" />}
                    </>
                  )}
                </div>
              </div>
            ))}
            {duePosts.length > 10 && <p className="text-xs text-slate-400 text-center">+{duePosts.length - 10} more approved posts</p>}
          </div>
        )}
      </div>

      {/* Publishing Queue */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center gap-3 mb-3">
          <h2 className="text-sm font-bold text-slate-700">Publishing Queue ({filteredQueue.length})</h2>
          <div className="flex items-center gap-1 ml-auto">
            {['all', 'queued', 'published', 'failed'].map(s => (
              <button key={s} onClick={() => setFilter(s)}
                className={`px-2 py-1 rounded-lg text-xs font-medium capitalize ${filter === s ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                {s}
              </button>
            ))}
          </div>
        </div>

        {filteredQueue.length === 0 ? (
          <p className="text-sm text-slate-400">No items in queue.</p>
        ) : (
          <div className="space-y-2">
            {filteredQueue.map(item => (
              <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg border border-slate-100">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-slate-700 truncate">{item.post_title || `Post #${item.post_id}`}</p>
                    {statusBadge(item.status)}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {item.platform} · {item.page} · {item.pillar}
                    {item.scheduled_at && ` · Scheduled: ${new Date(item.scheduled_at).toLocaleString()}`}
                    {item.published_at && ` · Published: ${new Date(item.published_at).toLocaleString()}`}
                  </p>
                  {item.error_message && (
                    <p className="text-xs text-rose-600 mt-1"><AlertTriangle size={12} className="inline mr-1" />{item.error_message}</p>
                  )}
                  {item.platform_post_url && (
                    <a href={item.platform_post_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline mt-1 inline-block">
                      View on Facebook →
                    </a>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {item.status === 'failed' && (
                    <button onClick={() => handleRetry(item.id)}
                      className="p-1.5 rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100" title="Retry">
                      <RefreshCw size={14} />
                    </button>
                  )}
                  {item.status === 'queued' && (
                    <span className="text-xs text-amber-600">Waiting for n8n…</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  ROW EDITOR (reusable)
// ═══════════════════════════════════════════════════════════
function RowEditor({ title, columns, row, onClose, onSave }) {
  const [f, setF] = useState(() => {
    const o = { ...row };
    for (const c of columns) if (o[c.k] === undefined) o[c.k] = '';
    return o;
  });
  const set = (k, v) => setF(s => ({ ...s, [k]: v }));
  return (
    <Modal title={row.id ? `Edit — ${title}` : `Add — ${title}`} onClose={onClose} wide>
      <div className="grid grid-cols-2 gap-3">
        {columns.map(c => (
          <div key={c.k} className={c.long ? 'col-span-2' : ''}>
            <label className="text-xs text-slate-500 mb-1 block">{c.l}</label>
            {c.long
              ? <textarea rows={3} className="inp" value={f[c.k] ?? ''} onChange={e => set(c.k, e.target.value)} />
              : <input className="inp" value={f[c.k] ?? ''} onChange={e => set(c.k, e.target.value)} />}
          </div>
        ))}
      </div>
      <div className="flex justify-end gap-2 pt-4">
        <button onClick={onClose} className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 text-slate-600">Cancel</button>
        <button onClick={() => onSave(f)} className="px-3 py-1.5 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium">Save</button>
      </div>
    </Modal>
  );
}
