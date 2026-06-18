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
  Settings, Filter, Grid3X3, List, Layout, ChevronLeft, ChevronRight, Send
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
  const [f, setF] = useState({
    hook: post.hook || '', body: post.body || '', hashtags: post.hashtags || '',
    brief: post.brief || '', slot_time: post.slot_time || '', status: post.status || 'drafted',
    page: post.page || 'bd', pillar: post.pillar || '', format: post.format || 'Single image',
    language: post.language || 'bangla', post_date: post.post_date || '',
  });
  const set = (k, v) => setF(s => ({ ...s, [k]: v }));
  const save = async () => {
    try { await api.marketing.updatePost(post.id, f); toast.success('Saved'); onSaved(); }
    catch (e) { toast.error(e.message); }
  };
  return (
    <Modal title="Edit post" onClose={onClose} wide>
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
          <button onClick={save} className="px-3 py-1.5 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium">Save</button>
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
//  CONTENT FACTORY TAB — AI Generator + Quality Gate + Real Data
// ═══════════════════════════════════════════════════════════
function ContentFactoryTab() {
  const toast = useToast();
  const [page, setPage] = useState('china');
  const [pillar, setPillar] = useState('scholarship');
  const [format, setFormat] = useState('Carousel');
  const [language, setLanguage] = useState('bangla');
  const [topic, setTopic] = useState('');
  const [tone, setTone] = useState('expert_consultant');
  const [generated, setGenerated] = useState(null);
  const [loading, setLoading] = useState(false);
  const [previewTab, setPreviewTab] = useState('facebook');

  // Real data sources
  const [researchIntel, setResearchIntel] = useState([]);
  const [bestHooks, setBestHooks] = useState([]);
  const [kbUniversities, setKbUniversities] = useState([]);
  const [kbScholarships, setKbScholarships] = useState([]);
  const [kbSearch, setKbSearch] = useState('');
  const [selectedUniversity, setSelectedUniversity] = useState(null);
  const [selectedScholarship, setSelectedScholarship] = useState(null);
  const [activeTab, setActiveTab] = useState('generator'); // generator | kb | hooks

  // Banned words from quality gate config
  const BANNED_CRITICAL = ['guaranteed visa', '100% visa success', '100% admission', 'guaranteed admission', 'visa confirmed', 'no rejection', 'zero rejection', 'government registered', 'licensed by government', 'official representative', 'authorized agent', 'best consultancy', 'no. 1 consultancy', '100% scholarship guaranteed', 'free education', 'no cost at all'];
  const BANNED_HIGH = ['csc scholarship', 'gks scholarship', 'stipendium hungaricum', 'turkiye burslari', 'our students in korea', 'our alumni in hungary', 'visa success for korea', 'visa success for europe', 'no ielts', 'no csca required', 'payment after visa', 'no file opening charge', 'free counselling', 'expert guidance', 'partnered with 500+', '5000+ students', '99% visa success', '7 years', '$5m revenue'];

  useEffect(() => {
    // Load active research intel and best hooks on mount
    Promise.all([
      api.marketing.activeResearch().catch(() => []),
      api.marketing.bestHooks(page, pillar, page === 'china' ? 'China' : '').catch(() => []),
    ]).then(([ri, bh]) => {
      setResearchIntel(ri);
      setBestHooks(bh);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    // Refresh hooks when page/pillar changes
    api.marketing.bestHooks(page, pillar, page === 'china' ? 'China' : '').catch(() => [])
      .then(bh => setBestHooks(bh)).catch(() => {});
  }, [page, pillar]);

  const searchKB = async () => {
    if (!kbSearch.trim()) return;
    try {
      const [uni, schol] = await Promise.all([
        api.marketing.searchUniversities(kbSearch, page === 'china' ? 'China' : ''),
        api.marketing.searchScholarships(kbSearch, page === 'china' ? 'China' : ''),
      ]);
      setKbUniversities(uni);
      setKbScholarships(schol);
    } catch (e) { toast.error(e.message); }
  };

  const runQualityCheck = (hook, body, hashtags) => {
    const fullText = `${hook} ${body} ${hashtags}`.toLowerCase();
    const bannedFound = [];
    const severity = [];

    BANNED_CRITICAL.forEach(word => {
      if (fullText.includes(word.toLowerCase())) {
        bannedFound.push(word);
        severity.push('critical');
      }
    });
    BANNED_HIGH.forEach(word => {
      if (fullText.includes(word.toLowerCase())) {
        bannedFound.push(word);
        severity.push('high');
      }
    });

    // Check for fake figures (stipend claims without range)
    const stipendMatch = body.match(/[৳$€¥]\s*\d+/g);
    const hasRange = body.includes('10,000') || body.includes('60,000') || body.includes('range') || body.includes('depending');
    let figureVerified = 'pending';
    if (stipendMatch && !hasRange) figureVerified = 'unverified';
    if (selectedScholarship) figureVerified = 'verified';

    // Check for university name in KB
    let factCheck = true;
    if (body.includes('University') && !selectedUniversity) {
      factCheck = false; // Mentioned university but not selected from KB
    }

    // Check tone
    const toneOk = language === 'bangla' ? !/[a-zA-Z]{20,}/.test(body) : true; // Bangla posts shouldn't have long English sentences

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

  const generate = async () => {
    setLoading(true);
    try {
      await new Promise(r => setTimeout(r, 1000));

      // Build prompt context from real data
      const intelContext = researchIntel.slice(0, 3).map(r => `${r.topic}: ${r.insight_summary}`).join('\n');
      const hookSuggestion = bestHooks.length > 0 ? bestHooks[0].hook_text : '';
      const uniContext = selectedUniversity ? `${selectedUniversity.name} (${selectedUniversity.city}, ${selectedUniversity.country}) — ${selectedUniversity.programs}` : '';
      const scholContext = selectedScholarship ? `${selectedScholarship.name}: ${selectedScholarship.coverage}` : '';

      // Generate content based on inputs + real data
      const generatedHook = hookSuggestion || (language === 'bangla'
        ? `CSCA ছাড়াই ${page === 'china' ? 'চীনে' : 'বিদেশে'} Bachelor! 🎓`
        : `Study ${page === 'china' ? 'in China' : 'Abroad'} WITHOUT CSCA! 🎓`);

      const generatedBody = language === 'bangla'
        ? `আপনি কি জানেন?

${page === 'china' ? 'চীনে' : 'বিদেশে'} Bachelor করতে CSCA পরীক্ষা দেওয়া বাধ্যতামূলক নয়!

${uniContext ? `🏫 ${uniContext}\n` : ''}${scholContext ? `💰 ${scholContext}\n` : ''}✅ 100% টিউশন ফ্রি
✅ মাসিক স্টাইপেন্ড ৳১০,০০০-৬০,০০০
✅ হোস্টেল ফ্রি
✅ English Medium Program

${intelContext ? `📌 ${intelContext.split('\n')[0]}\n` : ''}📍 EduExpress International
📞 +8801983333566
📍 Dhanmondi, Dhaka
${page === 'bd' ? '💬 Payment After Visa — শর্ত প্রযোজ্য' : ''}`
        : `Did you know?

You can study Bachelor's ${page === 'china' ? 'in China' : 'abroad'} WITHOUT the CSCA exam!

${uniContext ? `🏫 ${uniContext}\n` : ''}${scholContext ? `💰 ${scholContext}\n` : ''}✅ 100% Tuition Free
✅ Monthly Stipend ৳10,000-60,000
✅ Free Hostel
✅ English Medium Programs

${intelContext ? `📌 ${intelContext.split('\n')[0]}\n` : ''}📍 EduExpress International
📞 +8801983333566
📍 Dhanmondi, Dhaka
${page === 'bd' ? '💬 Payment After Visa — subject to conditions' : ''}`;

      const generatedHashtags = page === 'china'
        ? '#StudyInChina #CSCScholarship #EduExpressBD #ChinaEducation #BangladeshStudents #Scholarship2026'
        : '#StudyAbroad #EduExpressBD #BangladeshStudents #EducationConsultancy #VisaSuccess';

      const quality = runQualityCheck(generatedHook, generatedBody, generatedHashtags);

      setGenerated({
        hook: generatedHook,
        body: generatedBody,
        hashtags: generatedHashtags,
        quality_score: quality.score,
        quality_checks: JSON.stringify(quality.checks),
        brief: `${format === 'Carousel' ? 'Red carousel, 5 slides.' : format === 'Reel' ? 'Reel, 30-60s.' : format === 'Video' ? 'Video, 60-90s.' : 'Single image.'} ${pillar}. ${selectedUniversity ? 'Include university logo.' : ''} ${selectedScholarship ? 'Include scholarship details.' : ''}`,
        utm_source: page === 'tiktok' ? 'tiktok' : page === 'instagram' ? 'instagram' : 'facebook',
        utm_medium: 'social',
        utm_campaign: `${pillar}_${page}_${new Date().toISOString().slice(0, 10)}`,
      });
    } catch (e) { toast.error(e.message); }
    setLoading(false);
  };

  const saveToDraft = async () => {
    if (!generated) return;
    try {
      await api.marketing.createPost({
        page, pillar, format, hook: generated.hook, body: generated.body,
        hashtags: generated.hashtags, brief: generated.brief, language,
        status: 'drafted', quality_score: generated.quality_score, quality_checks: generated.quality_checks,
      });
      toast.success('Saved to drafts');
      setGenerated(null);
    } catch (e) { toast.error(e.message); }
  };

  const sendToDesigner = async () => {
    if (!generated) return;
    try {
      const post = await api.marketing.createPost({
        page, pillar, format, hook: generated.hook, body: generated.body,
        hashtags: generated.hashtags, brief: generated.brief, language,
        status: 'asset_pending', quality_score: generated.quality_score, quality_checks: generated.quality_checks,
      });
      await api.marketing.createDesignerQueue({
        post_id: post.id, brief: generated.brief, priority: 'normal', status: 'assigned',
      });
      toast.success('Sent to designer queue');
      setGenerated(null);
    } catch (e) { toast.error(e.message); }
  };

  const qualityChecks = generated ? JSON.parse(generated.quality_checks || '{}') : {};

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
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium ${activeTab === t.id ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>
              <t.icon size={14} />{t.label}
            </button>
          ))}
        </div>

        {/* Generator Panel */}
        {activeTab === 'generator' && (
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2"><Wand2 size={15} />Content Generator</h3>
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
                <Field label="Language">
                  <select className="inp" value={language} onChange={e => setLanguage(e.target.value)}>
                    <option value="bangla">Bangla</option>
                    <option value="english">English</option>
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
                <Field label="Tone">
                  <select className="inp" value={tone} onChange={e => setTone(e.target.value)}>
                    <option value="expert_consultant">Expert Consultant</option>
                    <option value="empathetic_brother">Empathetic Brother</option>
                    <option value="success_story">Success Story</option>
                    <option value="peer_friend">Peer Friend</option>
                  </select>
                </Field>
                <Field label="Topic"><input className="inp" value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g. CSCA-free, Korea visa" /></Field>
              </div>

              {/* Selected KB items */}
              {(selectedUniversity || selectedScholarship) && (
                <div className="bg-blue-50 rounded-lg p-2 text-xs space-y-1">
                  {selectedUniversity && (
                    <div className="flex items-center justify-between">
                      <span className="text-blue-700">🏫 {selectedUniversity.name}</span>
                      <button onClick={() => setSelectedUniversity(null)} className="text-blue-400 hover:text-blue-600"><X size={12} /></button>
                    </div>
                  )}
                  {selectedScholarship && (
                    <div className="flex items-center justify-between">
                      <span className="text-blue-700">💰 {selectedScholarship.name}</span>
                      <button onClick={() => setSelectedScholarship(null)} className="text-blue-400 hover:text-blue-600"><X size={12} /></button>
                    </div>
                  )}
                </div>
              )}

              <button onClick={generate} disabled={loading} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm disabled:opacity-50">
                {loading ? <RefreshCw size={16} className="animate-spin" /> : <Sparkles size={16} />}
                {loading ? 'Generating...' : 'Generate Post'}
              </button>
            </div>

            {/* Research Intel Feed */}
            <div className="mt-4 pt-4 border-t border-slate-100">
              <h4 className="text-xs font-semibold text-slate-500 mb-2">Active Intelligence ({researchIntel.length})</h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {researchIntel.length === 0 ? (
                  <p className="text-xs text-slate-400">No active intelligence. Add research findings to fuel content generation.</p>
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
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2"><BookOpen size={15} />Knowledge Base</h3>
            <div className="flex gap-2 mb-3">
              <input className="inp flex-1" value={kbSearch} onChange={e => setKbSearch(e.target.value)} placeholder="Search universities or scholarships..." />
              <button onClick={searchKB} className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm"><Search size={14} /></button>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {kbUniversities.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 mb-1">Universities ({kbUniversities.length})</p>
                  {kbUniversities.slice(0, 5).map(u => (
                    <div key={u.id} onClick={() => setSelectedUniversity(u)} className={`p-2 rounded-lg border cursor-pointer text-xs ${selectedUniversity?.id === u.id ? 'border-blue-400 bg-blue-50' : 'border-slate-100 hover:bg-slate-50'}`}>
                      <p className="font-semibold text-slate-700">{u.name} <span className="text-slate-400">({u.city}, {u.country})</span></p>
                      <p className="text-slate-500">{u.programs} · {u.tuition}</p>
                    </div>
                  ))}
                </div>
              )}
              {kbScholarships.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 mb-1">Scholarships ({kbScholarships.length})</p>
                  {kbScholarships.slice(0, 5).map(s => (
                    <div key={s.id} onClick={() => setSelectedScholarship(s)} className={`p-2 rounded-lg border cursor-pointer text-xs ${selectedScholarship?.id === s.id ? 'border-blue-400 bg-blue-50' : 'border-slate-100 hover:bg-slate-50'}`}>
                      <p className="font-semibold text-slate-700">{s.name}</p>
                      <p className="text-slate-500">{s.coverage?.slice(0, 80)} · {s.deadline}</p>
                    </div>
                  ))}
                </div>
              )}
              {kbUniversities.length === 0 && kbScholarships.length === 0 && (
                <p className="text-xs text-slate-400 text-center py-4">Search to find universities and scholarships from your Data Center.</p>
              )}
            </div>
          </div>
        )}

        {/* Hooks Panel */}
        {activeTab === 'hooks' && (
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2"><Zap size={15} />Best Hooks for {page === 'china' ? 'China' : 'BD'}</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {bestHooks.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">No hooks yet. Add tested hooks with performance data.</p>
              ) : bestHooks.map(h => (
                <div key={h.id} onClick={() => setTopic(h.hook_text)} className="p-2 rounded-lg border border-slate-100 hover:bg-slate-50 cursor-pointer text-xs">
                  <p className="font-semibold text-slate-800">{h.hook_text}</p>
                  <div className="flex items-center gap-2 mt-1 text-slate-400">
                    <span>{h.hook_type}</span>
                    <span>·</span>
                    <span>Conv: {h.conversion_rate ? (h.conversion_rate * 100).toFixed(1) + '%' : '0%'}</span>
                    <span>·</span>
                    <span>{h.usage_count} uses</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Right Panel — Output */}
      {generated ? (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-700">Generated Content</h3>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold px-2 py-1 rounded ${generated.quality_score >= 80 ? 'bg-emerald-100 text-emerald-700' : generated.quality_score >= 60 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>
                Quality: {generated.quality_score}/100
              </span>
            </div>
          </div>

          {/* Quality Checks */}
          <div className="grid grid-cols-2 gap-2 mb-3">
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
            <div className="bg-rose-50 border border-rose-200 rounded-lg p-2 mb-3">
              <p className="text-xs font-bold text-rose-700 mb-1">🚫 Banned words found:</p>
              {qualityChecks.banned_words.map((w, i) => (
                <span key={i} className="text-xs bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded mr-1">{w}</span>
              ))}
            </div>
          )}

          {/* Content */}
          <div className="bg-slate-50 rounded-lg p-3 mb-3">
            <p className="text-sm font-bold text-slate-800 mb-1">{generated.hook}</p>
            <p className="text-xs text-slate-600 whitespace-pre-line">{generated.body}</p>
            <p className="text-xs text-blue-500 mt-2">{generated.hashtags}</p>
          </div>

          {/* Platform Preview */}
          <div className="flex gap-1 mb-2">
            {[{ id: 'facebook', label: 'Facebook' }, { id: 'instagram', label: 'Instagram' }, { id: 'tiktok', label: 'TikTok' }].map(t => (
              <button key={t.id} onClick={() => setPreviewTab(t.id)} className={`text-xs px-2.5 py-1 rounded-lg ${previewTab === t.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>{t.label}</button>
            ))}
          </div>
          <div className="border border-slate-200 rounded-lg p-3 mb-3 bg-slate-50">
            {previewTab === 'facebook' && (
              <div className="bg-white rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">E</div>
                  <div><p className="text-xs font-semibold">EduExpress International</p><p className="text-[10px] text-slate-400">Sponsored</p></div>
                </div>
                <p className="text-sm font-bold mb-1">{generated.hook}</p>
                <p className="text-xs text-slate-600">{generated.body.slice(0, 200)}...</p>
                <div className="mt-2 bg-slate-100 rounded-lg h-32 flex items-center justify-center text-xs text-slate-400">[Asset]</div>
              </div>
            )}
            {previewTab === 'instagram' && (
              <div className="bg-white rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-full bg-pink-500 flex items-center justify-center text-white text-[10px] font-bold">E</div>
                  <p className="text-xs font-semibold">eduexpressint</p>
                </div>
                <div className="bg-slate-100 rounded-lg h-48 flex items-center justify-center text-xs text-slate-400">[Reel 9:16]</div>
                <p className="text-xs font-bold mt-2">{generated.hook}</p>
                <p className="text-xs text-slate-600">{generated.body.slice(0, 100)}...</p>
              </div>
            )}
            {previewTab === 'tiktok' && (
              <div className="bg-black rounded-lg p-3 text-white">
                <div className="bg-slate-700 rounded-lg h-56 flex items-center justify-center text-xs text-slate-400 mb-2">[TikTok 9:16]</div>
                <p className="text-sm font-bold">{generated.hook}</p>
                <p className="text-xs text-slate-300">{generated.body.slice(0, 80)}...</p>
              </div>
            )}
          </div>

          {/* UTM */}
          <div className="text-xs text-slate-500 mb-3">
            <p>🔗 Short Link: <span className="text-blue-600 font-mono">eduexpress.link/{generated.utm_campaign}</span></p>
          </div>

          <div className="flex gap-2">
            <button onClick={saveToDraft} className="flex-1 text-sm py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 font-medium">Save to Draft</button>
            <button onClick={sendToDesigner} className="flex-1 text-sm py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-medium">🎨 Send to Designer</button>
          </div>
        </div>
      ) : (
        <div className="bg-slate-50 rounded-xl border border-dashed border-slate-300 p-8 flex flex-col items-center justify-center text-center">
          <Sparkles size={32} className="text-slate-300 mb-2" />
          <p className="text-sm font-semibold text-slate-500">Generate a Post</p>
          <p className="text-xs text-slate-400 mt-1">Select page, pillar, format, and click Generate. Or search KB to include real university data.</p>
        </div>
      )}
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

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.marketing.publishConfig(),
      api.marketing.postsDue(50),
      api.marketing.publishingQueueFull({ limit: 100 })
    ]).then(([cfg, posts, q]) => {
      setConfig(cfg);
      setDuePosts(posts);
      setQueue(q);
      setLoading(false);
    }).catch(e => {
      toast.error(e.message);
      setLoading(false);
    });
  }, [toast]);

  useEffect(() => { load(); }, [load]);

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
