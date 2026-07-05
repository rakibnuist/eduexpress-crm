import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { api } from '../api';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/Confirm';
import Modal from '../components/Modal';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { toDate } from '../lib/format';
import {
  LayoutDashboard, Kanban, CalendarDays, BarChart3, FolderKanban, Image, BookOpen, Lightbulb, Rocket, Settings,
  Plus, Search, Filter, ChevronRight, Clock, Check, AlertTriangle, X, RefreshCw, Zap, Wand2, Sparkles,
  Heart, MessageCircle, Send, Eye, Hash, Target, Palette, PenTool, Upload, Trash2, Edit3, Move,
  ArrowRight, ArrowLeft, ThumbsUp, ThumbsDown, MessageSquare, FileText, ExternalLink, Download,
  Globe, Camera, Play, Video, Layers, Sliders, MoreHorizontal, User, Calendar, MapPin, Flag, GripVertical,
  LayoutTemplate, CalendarClock, Megaphone, ChevronDown, Copy, ChevronLeft
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════
   SOCIAL MEDIA AUTOMATION ENGINE v3.1
   Calendar-Centric: Content Calendar → Templates → Auto-Schedule → Publish → Analytics
   ═══════════════════════════════════════════════════════════ */

const STATUS_CONFIG = {
  ideation:      { label: 'Ideation',       color: 'bg-slate-100 border-slate-200 text-slate-700',       icon: Lightbulb, desc: 'Idea' },
  brief_ready:   { label: 'Brief Ready',    color: 'bg-indigo-50 border-indigo-200 text-indigo-700',   icon: FileText, desc: 'Brief' },
  writing:       { label: 'Writing',        color: 'bg-blue-50 border-blue-200 text-blue-700',           icon: PenTool, desc: 'Draft' },
  quality_review:{ label: 'Quality Review', color: 'bg-amber-50 border-amber-200 text-amber-700',       icon: AlertTriangle, desc: 'Review' },
  design:        { label: 'Design',         color: 'bg-violet-50 border-violet-200 text-violet-700',   icon: Palette, desc: 'Design' },
  design_review: { label: 'Design Review',  color: 'bg-pink-50 border-pink-200 text-pink-700',           icon: Eye, desc: 'D-Review' },
  approved:      { label: 'Approved',       color: 'bg-emerald-50 border-emerald-200 text-emerald-700', icon: Check, desc: 'Approved' },
  scheduled:     { label: 'Scheduled',      color: 'bg-cyan-50 border-cyan-200 text-cyan-700',           icon: CalendarClock, desc: 'Scheduled' },
  published:     { label: 'Published',      color: 'bg-green-50 border-green-200 text-green-700',     icon: Rocket, desc: 'Live' },
  archived:      { label: 'Archived',       color: 'bg-gray-50 border-gray-200 text-gray-500',        icon: FolderKanban, desc: 'Done' },
};

const PILLAR_COLORS = {
  scholarship: '#10B981', trust: '#3B82F6', career: '#8B5CF6', urgency: '#F59E0B',
  university: '#EC4899', cost: '#06B6D4', success_story: '#84CC16', trending: '#F97316',
  brand: '#6366F1', festival: '#D946EF'
};

const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

export default function Marketing() {
  const toast = useToast();
  const confirm = useConfirm();
  const [activeView, setActiveView] = useState('calendar'); // calendar is default
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState([]);
  const [posts, setPosts] = useState([]);
  const [calendarSlots, setCalendarSlots] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [stats, setStats] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [pageFilter, setPageFilter] = useState('');
  const [pillarFilter, setPillarFilter] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingPost, setEditingPost] = useState(null);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(() => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' }).slice(0, 7));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [camp, postList, cal, tmpl, dash] = await Promise.all([
        api.marketing.campaigns().catch(() => []),
        api.marketing.posts({ status: '', limit: 500 }).catch(() => []),
        api.marketing.calendar({ month: currentMonth }).catch(() => []),
        api.marketing.templates({ active: '1' }).catch(() => []),
        api.marketing.marketingDashboard().catch(() => null)
      ]);
      setCampaigns(camp || []);
      setPosts(postList || []);
      setCalendarSlots(cal || []);
      setTemplates(tmpl || []);
      setStats(dash);
    } catch (e) {
      toast.error('Failed to load: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [currentMonth, toast]);

  useEffect(() => { load(); }, [load]);

  const filteredPosts = useMemo(() => {
    let list = posts;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(p => (p.hook || '').toLowerCase().includes(q) || (p.body || '').toLowerCase().includes(q));
    }
    if (pageFilter) list = list.filter(p => p.page === pageFilter);
    if (pillarFilter) list = list.filter(p => p.pillar === pillarFilter);
    return list;
  }, [posts, searchQuery, pageFilter, pillarFilter]);

  const handleMovePost = async (postId, toStatus) => {
    try {
      await api.marketing.movePost(postId, { to_status: toStatus });
      toast.success(`Moved to ${STATUS_CONFIG[toStatus]?.label || toStatus}`);
      load();
    } catch (e) { toast.error(e.message); }
  };

  const handleDeletePost = async (post) => {
    const ok = await confirm(`Delete post "${post.hook?.slice(0, 40)}..."?`);
    if (!ok) return;
    try { await api.marketing.deletePost(post.id); toast.success('Deleted'); load(); }
    catch (e) { toast.error(e.message); }
  };

  const handleAutoSchedule = async (postId) => {
    try {
      const res = await api.marketing.autoSchedule({ post_id: postId });
      toast.success(`Scheduled for ${res.date} at ${res.time}`);
      load();
    } catch (e) { toast.error(e.message); }
  };

  const views = [
    { id: 'calendar', label: 'Calendar', icon: CalendarDays },
    { id: 'pipeline', label: 'Pipeline', icon: Kanban },
    { id: 'templates', label: 'Templates', icon: LayoutTemplate },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'campaigns', label: 'Campaigns', icon: FolderKanban },
    { id: 'assets', label: 'Assets', icon: Image },
    { id: 'publishing', label: 'Publishing', icon: Rocket },
  ];

  return (
    <div className="h-[calc(100vh-48px)] flex bg-slate-50">
      {/* Sidebar */}
      <aside className="w-16 lg:w-56 bg-white border-r border-slate-200 flex flex-col shrink-0">
        <div className="p-3 lg:p-4 border-b border-slate-100">
          <h1 className="hidden lg:block text-sm font-bold text-slate-800">SMM Automation</h1>
          <p className="hidden lg:block text-[10px] text-slate-400 mt-0.5">Calendar → Template → Schedule → Publish</p>
        </div>
        <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {views.map(v => (
            <button key={v.id} onClick={() => setActiveView(v.id)}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition ${activeView === v.id ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}>
              <v.icon size={16} />
              <span className="hidden lg:inline">{v.label}</span>
              {v.id === 'templates' && templates.length > 0 && <span className="hidden lg:inline ml-auto text-[10px] bg-blue-100 text-blue-700 px-1.5 rounded-full">{templates.length}</span>}
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-slate-100 space-y-2">
          <button onClick={() => { setEditingPost(null); setEditorOpen(true); }}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition">
            <Plus size={14} /> <span className="hidden lg:inline">New Post</span>
          </button>
          <button onClick={() => setTemplateModalOpen(true)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-slate-600 text-xs font-medium hover:bg-slate-50 transition">
            <LayoutTemplate size={14} /> <span className="hidden lg:inline">From Template</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden flex flex-col min-w-0">
        {/* Top Bar */}
        <div className="bg-white border-b border-slate-200 px-4 py-2.5 flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300" placeholder="Search posts by hook or body…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>
            <select className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white" value={pageFilter} onChange={e => setPageFilter(e.target.value)}>
              <option value="">All Pages</option>
              <option value="china">China</option>
              <option value="bd">Bangladesh</option>
            </select>
            <select className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white" value={pillarFilter} onChange={e => setPillarFilter(e.target.value)}>
              <option value="">All Pillars</option>
              {Object.keys(PILLAR_COLORS).map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"><RefreshCw size={14} /></button>
          </div>
        </div>

        {/* View Content */}
        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
              <RefreshCw size={16} className="animate-spin mr-2" /> Loading…
            </div>
          ) : (
            <>
              {activeView === 'calendar' && (
                <CalendarHub
                  month={currentMonth}
                  setMonth={setCurrentMonth}
                  slots={calendarSlots}
                  posts={posts}
                  campaigns={campaigns}
                  templates={templates}
                  onEditPost={(post) => { setEditingPost(post); setEditorOpen(true); }}
                  onDeletePost={handleDeletePost}
                  onAutoSchedule={handleAutoSchedule}
                  onMovePost={handleMovePost}
                  onRefresh={load}
                />
              )}
              {activeView === 'pipeline' && <PipelineBoard posts={filteredPosts} onEditPost={(post) => { setEditingPost(post); setEditorOpen(true); }} onDeletePost={handleDeletePost} onMovePost={handleMovePost} />}
              {activeView === 'templates' && <TemplatesView templates={templates} onRefresh={load} onUseTemplate={(t) => { setSelectedTemplate(t); setTemplateModalOpen(true); }} />}
              {activeView === 'analytics' && <AnalyticsView stats={stats} posts={posts} />}
              {activeView === 'campaigns' && <CampaignsView campaigns={campaigns} onRefresh={load} />}
              {activeView === 'assets' && <AssetsView />}
              {activeView === 'publishing' && <PublishingView />}
            </>
          )}
        </div>
      </main>

      {/* Modals */}
      {editorOpen && <ContentEditorModal post={editingPost} campaigns={campaigns} onClose={() => setEditorOpen(false)} onSaved={() => { setEditorOpen(false); load(); }} />}
      {templateModalOpen && <TemplateUseModal template={selectedTemplate} campaigns={campaigns} onClose={() => { setTemplateModalOpen(false); setSelectedTemplate(null); }} onCreated={() => { setTemplateModalOpen(false); setSelectedTemplate(null); load(); }} />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   CALENDAR HUB — The Main Automation Center
   ═══════════════════════════════════════════════════════════ */
function CalendarHub({ month, setMonth, slots, posts, campaigns, templates, onEditPost, onDeletePost, onAutoSchedule, onMovePost, onRefresh }) {
  const toast = useToast();
  const [selectedDate, setSelectedDate] = useState(null);
  const [dayDetailOpen, setDayDetailOpen] = useState(false);
  const [showBestTimes, setShowBestTimes] = useState(false);
  const [bestTimes, setBestTimes] = useState([]);

  const daysInMonth = new Date(parseInt(month.split('-')[0]), parseInt(month.split('-')[1]), 0).getDate();
  const firstDay = new Date(parseInt(month.split('-')[0]), parseInt(month.split('-')[1]) - 1, 1).getDay();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blanks = Array.from({ length: firstDay }, (_, i) => i);

  const slotsByDay = useMemo(() => {
    const map = {};
    for (const s of slots) {
      const day = s.slot_date;
      if (!map[day]) map[day] = [];
      map[day].push(s);
    }
    return map;
  }, [slots]);

  const postsById = useMemo(() => {
    const map = {};
    for (const p of posts) map[p.id] = p;
    return map;
  }, [posts]);

  const campaignMap = useMemo(() => {
    const m = {};
    for (const c of campaigns) m[c.id] = c;
    return m;
  }, [campaigns]);

  const openDay = (day) => {
    const dateStr = `${month}-${String(day).padStart(2, '0')}`;
    setSelectedDate(dateStr);
    setDayDetailOpen(true);
  };

  const handleCreateSlot = async (date, time) => {
    try {
      await api.marketing.createCalendarSlot({ slot_date: date, slot_time: time, page: 'china' });
      onRefresh();
      toast.success('Slot created');
    } catch (e) { toast.error(e.message); }
  };

  const handleAssignPost = async (slotId, postId) => {
    try {
      await api.marketing.assignCalendarSlot(slotId, { post_id: postId });
      onRefresh();
      toast.success('Post assigned to slot');
    } catch (e) { toast.error(e.message); }
  };

  const loadBestTimes = async () => {
    try {
      const bt = await api.marketing.bestTimes({ page: 'china' });
      setBestTimes(bt);
    } catch (e) { console.error(e); }
  };

  useEffect(() => { loadBestTimes(); }, []);

  // Count stats for the month
  const monthStats = useMemo(() => {
    const planned = slots.filter(s => s.status === 'planned' || s.status === 'scheduled').length;
    const published = slots.filter(s => s.status === 'published').length;
    const empty = daysInMonth - slots.length;
    return { planned, published, empty };
  }, [slots, daysInMonth]);

  return (
    <div className="h-full flex flex-col">
      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-bold text-slate-700">Content Calendar</h2>
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5">
            <button onClick={() => setMonth(m => { const d = new Date(m + '-01'); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 7); })} className="p-1.5 rounded hover:bg-slate-50"><ChevronLeft size={14} /></button>
            <span className="text-sm font-semibold text-slate-700 min-w-[140px] text-center">{new Date(month + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
            <button onClick={() => setMonth(m => { const d = new Date(m + '-01'); d.setMonth(d.getMonth() + 1); return d.toISOString().slice(0, 7); })} className="p-1.5 rounded hover:bg-slate-50"><ChevronRight size={14} /></button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" />{monthStats.planned} Planned</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" />{monthStats.published} Published</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-300" />{monthStats.empty} Empty</span>
          </div>
          <button onClick={() => setShowBestTimes(!showBestTimes)} className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${showBestTimes ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>
            <Clock size={12} className="inline mr-1" /> Best Times
          </button>
        </div>
      </div>

      {/* Best Times Panel */}
      {showBestTimes && (
        <div className="bg-white rounded-xl border border-slate-200 p-3 mb-4">
          <div className="flex items-center gap-4 overflow-x-auto pb-1">
            {DAY_NAMES.map((day, i) => {
              const times = bestTimes.filter(t => t.day_of_week === i).sort((a, b) => b.engagement_score - a.engagement_score).slice(0, 3);
              return (
                <div key={day} className="min-w-[100px]">
                  <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">{day}</p>
                  <div className="space-y-1">
                    {times.map((t, idx) => (
                      <div key={idx} className="text-[10px] flex items-center gap-1">
                        <span className="font-medium text-slate-700">{t.time_slot}</span>
                        <span className="text-emerald-600">{Math.round(t.engagement_score)}%</span>
                      </div>
                    ))}
                    {times.length === 0 && <span className="text-[10px] text-slate-300">No data</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-2 mb-2">
        {DAY_NAMES.map(d => <div key={d} className="text-center text-[10px] font-bold text-slate-400 uppercase py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-2 flex-1">
        {blanks.map(i => <div key={`b-${i}`} className="bg-slate-50 rounded-lg min-h-[120px]" />)}
        {days.map(day => {
          const dateStr = `${month}-${String(day).padStart(2, '0')}`;
          const daySlots = slotsByDay[dateStr] || [];
          const isToday = dateStr === new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' });
          return (
            <div key={day} className={`bg-white rounded-lg border min-h-[120px] p-2 transition hover:shadow-md cursor-pointer ${isToday ? 'border-blue-400 ring-1 ring-blue-100' : 'border-slate-200'}`} onClick={() => openDay(day)}>
              <div className="flex items-center justify-between mb-1">
                <span className={`text-xs font-bold ${isToday ? 'text-blue-600' : daySlots.length ? 'text-slate-700' : 'text-slate-400'}`}>{day}</span>
                {daySlots.length > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${daySlots.some(s => s.status === 'published') ? 'bg-emerald-100 text-emerald-700' : daySlots.some(s => s.status === 'scheduled') ? 'bg-cyan-100 text-cyan-700' : 'bg-blue-100 text-blue-700'}`}>
                    {daySlots.length}
                  </span>
                )}
              </div>
              <div className="space-y-1">
                {daySlots.slice(0, 3).map(s => {
                  const post = postsById[s.post_id];
                  const camp = post?.campaign_id ? campaignMap[post.campaign_id] : null;
                  return (
                    <div key={s.id} className="text-[10px] p-1.5 rounded bg-slate-50 border-l-2 truncate leading-tight" style={{ borderLeftColor: post ? PILLAR_COLORS[post.pillar] || '#ccc' : '#ccc' }}>
                      <div className="flex items-center gap-1">
                        <span className="font-medium text-slate-700">{s.slot_time || '—'}</span>
                        <span className={`px-1 rounded text-[9px] ${s.status === 'published' ? 'bg-emerald-100 text-emerald-700' : s.status === 'scheduled' ? 'bg-cyan-100 text-cyan-700' : 'bg-slate-100 text-slate-500'}`}>{s.status}</span>
                      </div>
                      <span className="text-slate-500 truncate block">{post?.hook?.slice(0, 20) || 'Empty slot'}</span>
                    </div>
                  );
                })}
                {daySlots.length > 3 && <p className="text-[10px] text-slate-400 pl-1">+{daySlots.length - 3} more</p>}
                {daySlots.length === 0 && <button onClick={(e) => { e.stopPropagation(); handleCreateSlot(dateStr, '19:00'); }} className="text-[10px] text-blue-400 hover:text-blue-600 mt-2">+ Add slot</button>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Day Detail Modal */}
      {dayDetailOpen && selectedDate && (
        <DayDetailModal
          date={selectedDate}
          slots={slotsByDay[selectedDate] || []}
          posts={posts}
          unscheduledPosts={posts.filter(p => p.status === 'approved' && !slots.find(s => s.post_id === p.id))}
          onClose={() => setDayDetailOpen(false)}
          onEditPost={onEditPost}
          onAutoSchedule={onAutoSchedule}
          onAssignPost={handleAssignPost}
          onCreateSlot={(time) => handleCreateSlot(selectedDate, time)}
          onRefresh={onRefresh}
        />
      )}
    </div>
  );
}

/* Day Detail Modal */
function DayDetailModal({ date, slots, posts, unscheduledPosts, onClose, onEditPost, onAutoSchedule, onAssignPost, onCreateSlot, onRefresh }) {
  const toast = useToast();
  const postsById = useMemo(() => { const m = {}; for (const p of posts) m[p.id] = p; return m; }, [posts]);
  const [newTime, setNewTime] = useState('19:00');
  const [selectedPostId, setSelectedPostId] = useState('');

  const handleQuickAdd = async () => {
    if (!selectedPostId) { toast.error('Select a post'); return; }
    try {
      await onCreateSlot(newTime);
      onRefresh();
      toast.success('Slot created');
    } catch (e) { toast.error(e.message); }
  };

  return (
    <Modal onClose={onClose} className="max-w-2xl w-full">
      <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-slate-800">{new Date(date + 'T00:00:00Z').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'Asia/Dhaka' })}</h2>
          <p className="text-[10px] text-slate-400">{slots.length} slots · {slots.filter(s => s.post_id).length} filled</p>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X size={16} /></button>
      </div>
      <div className="p-6 space-y-4">
        {/* Quick Add */}
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
          <h3 className="text-xs font-bold text-blue-700 mb-2">Quick Schedule</h3>
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="text-[10px] text-slate-500 mb-1 block">Time</label>
              <input type="time" className="inp w-full" value={newTime} onChange={e => setNewTime(e.target.value)} />
            </div>
            <div className="flex-[2]">
              <label className="text-[10px] text-slate-500 mb-1 block">Approved Post</label>
              <select className="inp w-full" value={selectedPostId} onChange={e => setSelectedPostId(e.target.value)}>
                <option value="">Select an approved post…</option>
                {unscheduledPosts.map(p => <option key={p.id} value={p.id}>{p.hook?.slice(0, 50)}… (Q:{p.quality_score})</option>)}
              </select>
            </div>
            <button onClick={handleQuickAdd} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700">Schedule</button>
          </div>
        </div>

        {/* Slots List */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-slate-700">Scheduled Posts</h3>
          {slots.length === 0 && <p className="text-sm text-slate-400 text-center py-4">No slots for this day.</p>}
          {slots.map(s => {
            const post = postsById[s.post_id];
            return (
              <div key={s.id} className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 bg-white hover:border-blue-300 transition">
                <div className="text-xs font-bold text-slate-500 w-14 shrink-0">{s.slot_time || '—'}</div>
                <div className="w-1 h-8 rounded-full shrink-0" style={{ backgroundColor: post ? PILLAR_COLORS[post.pillar] || '#ccc' : '#e2e8f0' }} />
                <div className="flex-1 min-w-0">
                  {post ? (
                    <>
                      <p className="text-xs font-semibold text-slate-800 truncate">{post.hook}</p>
                      <p className="text-[10px] text-slate-400">{post.page} · {post.pillar} · Q:{post.quality_score}</p>
                    </>
                  ) : (
                    <p className="text-xs text-slate-400 italic">Empty slot</p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {post && (
                    <>
                      <button onClick={() => onEditPost(post)} className="p-1.5 rounded hover:bg-slate-100 text-slate-400"><Edit3 size={12} /></button>
                      <button onClick={() => onAutoSchedule(post.id)} className="px-2 py-1 rounded bg-emerald-50 text-emerald-700 text-[10px] font-bold hover:bg-emerald-100">Auto</button>
                    </>
                  )}
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${s.status === 'published' ? 'bg-emerald-100 text-emerald-700' : s.status === 'scheduled' ? 'bg-cyan-100 text-cyan-700' : 'bg-slate-100 text-slate-500'}`}>{s.status}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}

/* ═══════════════════════════════════════════════════════════
   TEMPLATE USE MODAL — Quick Create from Template
   ═══════════════════════════════════════════════════════════ */
function TemplateUseModal({ template, campaigns, onClose, onCreated }) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    page: 'china', pillar: 'scholarship', format: 'Carousel', language: 'bangla', platform: 'facebook',
    tone: 'expert_consultant', hook: '', body: '', hashtags: '', cta: '', brief: '',
    status: 'ideation', campaign_id: '', post_date: '', post_time: '19:00'
  });
  const [variables, setVariables] = useState({});

  useEffect(() => {
    if (template) {
      setForm(f => ({ ...f, page: template.page, pillar: template.pillar, format: template.format, language: template.language, platform: template.platform, tone: template.tone }));
      // Extract variables from template
      try {
        const vars = JSON.parse(template.variables || '{}');
        const extracted = {};
        const allText = `${template.hook_template} ${template.body_template} ${template.hashtags_template} ${template.cta_template}`;
        const matches = allText.match(/{{\s*(\w+)\s*}}/g) || [];
        matches.forEach(m => {
          const key = m.replace(/[{}\s]/g, '');
          extracted[key] = vars[key] || '';
        });
        setVariables(extracted);
      } catch {}
    }
  }, [template]);

  const applyTemplate = async () => {
    if (!template) return;
    try {
      const res = await api.marketing.useTemplate(template.id, { variables });
      setForm(f => ({ ...f, hook: res.hook, body: res.body, hashtags: res.hashtags, cta: res.cta, brief: res.brief }));
      toast.success('Template applied');
    } catch (e) { toast.error(e.message); }
  };

  const handleSave = async () => {
    if (!form.hook) { toast.error('Hook required'); return; }
    setSaving(true);
    try {
      await api.marketing.createPost(form);
      toast.success('Post created from template');
      onCreated();
    } catch (e) { toast.error(e.message); } finally { setSaving(false); }
  };

  // Show template list if no template selected
  if (!template) {
    return (
      <Modal onClose={onClose} className="max-w-3xl w-full">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800">Template Library</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X size={16} /></button>
        </div>
        <div className="p-6">
          <p className="text-sm text-slate-400 text-center py-8">No template selected. Select a template from the Templates view first.</p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal onClose={onClose} className="max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
      <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-slate-800">Create from Template</h2>
          <p className="text-[10px] text-slate-400">{template.name}</p>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X size={16} /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {/* Variables */}
        {Object.keys(variables).length > 0 && (
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
            <h3 className="text-xs font-bold text-slate-700 mb-2">Template Variables</h3>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(variables).map(([key, val]) => (
                <div key={key}>
                  <label className="text-[10px] text-slate-500 uppercase mb-1 block">{key.replace(/_/g, ' ')}</label>
                  <input className="inp w-full" value={val} onChange={e => setVariables({ ...variables, [key]: e.target.value })} placeholder={`Enter ${key}...`} />
                </div>
              ))}
            </div>
            <button onClick={applyTemplate} className="mt-3 px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700">Apply Variables</button>
          </div>
        )}

        {/* Preview */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Page"><select className="inp" value={form.page} onChange={e => setForm({...form, page: e.target.value})}><option value="china">China</option><option value="bd">Bangladesh</option></select></Field>
              <Field label="Campaign"><select className="inp" value={form.campaign_id} onChange={e => setForm({...form, campaign_id: e.target.value})}><option value="">None</option>{campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
              <Field label="Post Date"><input type="date" className="inp" value={form.post_date} onChange={e => setForm({...form, post_date: e.target.value})} /></Field>
              <Field label="Post Time"><input type="time" className="inp" value={form.post_time} onChange={e => setForm({...form, post_time: e.target.value})} /></Field>
            </div>
            <Field label="Hook"><textarea rows={2} className="inp" value={form.hook} onChange={e => setForm({...form, hook: e.target.value})} /></Field>
            <Field label="Body"><textarea rows={5} className="inp" value={form.body} onChange={e => setForm({...form, body: e.target.value})} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Hashtags"><input className="inp" value={form.hashtags} onChange={e => setForm({...form, hashtags: e.target.value})} /></Field>
              <Field label="CTA"><input className="inp" value={form.cta} onChange={e => setForm({...form, cta: e.target.value})} /></Field>
            </div>
          </div>
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
            <h3 className="text-xs font-bold text-slate-700 mb-2">Preview</h3>
            <div className="bg-white rounded-lg border border-slate-200 p-3">
              {form.hook && <p className="text-xs font-bold text-slate-800 mb-1">{form.hook}</p>}
              {form.body && <p className="text-xs text-slate-600 whitespace-pre-line line-clamp-6">{form.body}</p>}
              {form.cta && <p className="text-xs font-semibold text-blue-600 mt-2">{form.cta}</p>}
              {form.hashtags && <p className="text-xs text-blue-500 mt-1">{form.hashtags}</p>}
            </div>
          </div>
        </div>
      </div>
      <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-2">
        <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-xs font-medium">Cancel</button>
        <button onClick={handleSave} disabled={saving} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 disabled:opacity-50">
          {saving ? <RefreshCw size={12} className="animate-spin inline" /> : 'Create Post'}
        </button>
      </div>
    </Modal>
  );
}

/* ═══════════════════════════════════════════════════════════
   TEMPLATES VIEW
   ═══════════════════════════════════════════════════════════ */
function TemplatesView({ templates, onRefresh, onUseTemplate }) {
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const [newTmpl, setNewTmpl] = useState({ name: '', pillar: 'scholarship', hook_template: '', body_template: '' });

  const handleCreate = async () => {
    if (!newTmpl.name) { toast.error('Name required'); return; }
    try {
      await api.marketing.createTemplate(newTmpl);
      toast.success('Template created');
      setCreating(false);
      setNewTmpl({ name: '', pillar: 'scholarship', hook_template: '', body_template: '' });
      onRefresh();
    } catch (e) { toast.error(e.message); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-700">Template Library</h2>
        <button onClick={() => setCreating(!creating)} className="px-3 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700">
          {creating ? 'Cancel' : 'New Template'}
        </button>
      </div>

      {creating && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <Field label="Name"><input className="inp" value={newTmpl.name} onChange={e => setNewTmpl({...newTmpl, name: e.target.value})} placeholder="Template name" /></Field>
            <Field label="Pillar">
              <select className="inp" value={newTmpl.pillar} onChange={e => setNewTmpl({...newTmpl, pillar: e.target.value})}>
                {Object.keys(PILLAR_COLORS).map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
            <Field label="Page">
              <select className="inp" value={newTmpl.page || 'china'} onChange={e => setNewTmpl({...newTmpl, page: e.target.value})}>
                <option value="china">China</option><option value="bd">Bangladesh</option>
              </select>
            </Field>
          </div>
          <Field label="Hook Template"><input className="inp" value={newTmpl.hook_template} onChange={e => setNewTmpl({...newTmpl, hook_template: e.target.value})} placeholder="Use {{variable_name}} for dynamic content" /></Field>
          <Field label="Body Template"><textarea rows={3} className="inp" value={newTmpl.body_template} onChange={e => setNewTmpl({...newTmpl, body_template: e.target.value})} placeholder="Body with {{variables}}..." /></Field>
          <div className="flex justify-end">
            <button onClick={handleCreate} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700">Create Template</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map(t => (
          <div key={t.id} className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition group">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-3 h-3 rounded-full mt-1 shrink-0" style={{ backgroundColor: PILLAR_COLORS[t.pillar] || '#ccc' }} />
              <div className="flex-1">
                <h3 className="text-sm font-bold text-slate-800">{t.name}</h3>
                <p className="text-[10px] text-slate-400">{t.page} · {t.pillar} · Used {t.usage_count}x</p>
              </div>
            </div>
            <p className="text-xs text-slate-600 line-clamp-2 mb-3">{t.hook_template}</p>
            <div className="flex items-center gap-2">
              <button onClick={() => onUseTemplate(t)} className="flex-1 py-2 rounded-lg bg-blue-50 text-blue-700 text-xs font-bold hover:bg-blue-100">Use Template</button>
              <button onClick={() => onUseTemplate(t)} className="p-2 rounded-lg bg-slate-50 text-slate-400 hover:bg-slate-100"><Copy size={12} /></button>
            </div>
          </div>
        ))}
        {templates.length === 0 && <p className="col-span-full text-center text-sm text-slate-400 py-12">No templates yet. Create one to get started.</p>}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   PIPELINE BOARD (Simplified)
   ═══════════════════════════════════════════════════════════ */
function PipelineBoard({ posts, onEditPost, onDeletePost, onMovePost }) {
  const stages = useMemo(() => {
    const byStatus = {};
    for (const s of Object.keys(STATUS_CONFIG)) byStatus[s] = [];
    for (const p of posts) { const s = p.status || 'ideation'; if (!byStatus[s]) byStatus[s] = []; byStatus[s].push(p); }
    return byStatus;
  }, [posts]);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-slate-700">Content Pipeline</h2>
      </div>
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex gap-3 h-full min-w-max pb-2">
          {Object.keys(STATUS_CONFIG).map(stage => {
            const cfg = STATUS_CONFIG[stage];
            const stagePosts = stages[stage] || [];
            return (
              <div key={stage} className="flex flex-col h-full w-64 shrink-0">
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${cfg.color} mb-2`}>
                  <cfg.icon size={14} />
                  <span className="text-xs font-bold flex-1">{cfg.label}</span>
                  <span className="text-[10px] font-bold bg-white/60 px-1.5 rounded">{stagePosts.length}</span>
                </div>
                <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                  {stagePosts.map(post => (
                    <div key={post.id} className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm hover:shadow-md transition cursor-pointer" onClick={() => onEditPost(post)}>
                      <div className="flex items-start gap-2">
                        <div className="w-2 h-2 rounded-full mt-1 shrink-0" style={{ backgroundColor: PILLAR_COLORS[post.pillar] || '#ccc' }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-slate-800 line-clamp-2">{post.hook || 'Untitled'}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">{post.page} · Q:{post.quality_score}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 mt-2">
                        {Object.keys(STATUS_CONFIG).indexOf(stage) > 0 && (
                          <button onClick={(e) => { e.stopPropagation(); const prev = Object.keys(STATUS_CONFIG)[Object.keys(STATUS_CONFIG).indexOf(stage) - 1]; onMovePost(post.id, prev); }} className="p-1 rounded hover:bg-slate-100 text-slate-400"><ArrowLeft size={10} /></button>
                        )}
                        {Object.keys(STATUS_CONFIG).indexOf(stage) < Object.keys(STATUS_CONFIG).length - 1 && (
                          <button onClick={(e) => { e.stopPropagation(); const next = Object.keys(STATUS_CONFIG)[Object.keys(STATUS_CONFIG).indexOf(stage) + 1]; onMovePost(post.id, next); }} className="p-1 rounded hover:bg-slate-100 text-slate-400"><ArrowRight size={10} /></button>
                        )}
                      </div>
                    </div>
                  ))}
                  {stagePosts.length === 0 && <div className="text-center py-8 text-xs text-slate-300">No posts</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   CONTENT EDITOR MODAL
   ═══════════════════════════════════════════════════════════ */
function ContentEditorModal({ post, campaigns, onClose, onSaved }) {
  const toast = useToast();
  const [tab, setTab] = useState('editor');
  const [saving, setSaving] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [llmConfig, setLlmConfig] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [assets, setAssets] = useState([]);
  const [assetUrl, setAssetUrl] = useState('');
  const [logs, setLogs] = useState([]);

  const [form, setForm] = useState({
    page: 'china', pillar: 'scholarship', format: 'Carousel', language: 'bangla', platform: 'facebook',
    tone: 'expert_consultant', hook: '', body: '', hashtags: '', cta: '', brief: '',
    campaign_id: '', status: 'ideation', priority: 'normal', due_date: '', notes: '', post_date: '', post_time: '19:00',
    assigned_to: '', quality_score: 100, quality_checks: '{}', asset_url: ''
  });
  const [qualityChecks, setQualityChecks] = useState({ fact_check: true, banned_words: [], tone_ok: true, figure_verified: 'pending', severity: [] });

  useEffect(() => {
    if (post) {
      setForm({ ...form, ...post });
      try { setQualityChecks(JSON.parse(post.quality_checks || '{}')); } catch {}
      api.marketing.postComments(post.id).then(c => setComments(c)).catch(() => {});
      api.marketing.assets({ post_id: post.id }).then(a => setAssets(a)).catch(() => {});
      api.marketing.postLogs(post.id).then(l => setLogs(l)).catch(() => {});
    }
    api.marketing.llmConfig().catch(() => null).then(c => setLlmConfig(c));
  }, [post]);

  const BANNED_CRITICAL = ['guaranteed visa','100% visa success','100% admission','guaranteed admission','visa confirmed','no rejection','zero rejection','government registered','licensed by government','official representative','authorized agent','best consultancy','no. 1 consultancy','100% scholarship guaranteed','free education','no cost at all'];
  const BANNED_HIGH = ['csc scholarship','gks scholarship','stipendium hungaricum','turkiye burslari','no ielts','payment after visa','free counselling','5000+ students','99% visa success','$5m revenue'];

  const runQualityCheck = (h, b, tags) => {
    const fullText = `${h} ${b} ${tags}`.toLowerCase();
    const bannedFound = []; const severity = [];
    BANNED_CRITICAL.forEach(w => { if (fullText.includes(w)) { bannedFound.push(w); severity.push('critical'); }});
    BANNED_HIGH.forEach(w => { if (fullText.includes(w)) { bannedFound.push(w); severity.push('high'); }});
    const hasRange = b.includes('10,000') || b.includes('60,000') || b.includes('range') || b.includes('depending') || b.includes('up to');
    let figureVerified = 'pending'; if (b.match(/[৳$€¥]\s*\d+/) && !hasRange) figureVerified = 'unverified'; else if (hasRange) figureVerified = 'verified';
    const factCheck = !b.includes('university') || b.includes('University');
    const toneOk = form.language === 'bangla' ? !/[a-zA-Z]{20,}/.test(b) : true;
    const score = Math.max(0, 100 - severity.filter(s => s === 'critical').length * 50 - severity.filter(s => s === 'high').length * 15 - (factCheck ? 0 : 15) - (figureVerified === 'verified' ? 0 : figureVerified === 'unverified' ? 10 : 5) - (toneOk ? 0 : 10));
    return { score, checks: { fact_check: factCheck, banned_words: bannedFound, tone_ok: toneOk, figure_verified: figureVerified, severity } };
  };

  useEffect(() => {
    const result = runQualityCheck(form.hook, form.body, form.hashtags);
    setQualityChecks(result.checks);
    setForm(f => ({ ...f, quality_score: result.score }));
  }, [form.hook, form.body, form.hashtags, form.language]);

  const generateWithAI = async () => {
    if (!form.page || !form.pillar) { toast.error('Select Page and Pillar'); return; }
    setAiGenerating(true);
    try {
      const res = await fetch('/api/marketing/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page: form.page, pillar: form.pillar, format: form.format, language: form.language, platform: form.platform, tone: form.tone })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'AI generation failed');
      if (data.fallback) throw new Error(data.error || 'No LLM API key');
      setForm(f => ({ ...f, hook: data.hook, body: data.body, hashtags: data.hashtags, cta: data.cta, brief: data.brief || f.brief }));
      setTab('preview');
      toast.success(`AI generated (${data.provider} · ${data.model})`);
    } catch (e) { toast.error(e.message); } finally { setAiGenerating(false); }
  };

  const handleSave = async (status) => {
    setSaving(true);
    try {
      const payload = { ...form, status: status || form.status, quality_checks: JSON.stringify(qualityChecks) };
      if (post) { await api.marketing.updatePost(post.id, payload); toast.success('Post updated'); }
      else { await api.marketing.createPost(payload); toast.success('Post created'); }
      onSaved();
    } catch (e) { toast.error(e.message); } finally { setSaving(false); }
  };

  const addComment = async () => { if (!newComment.trim() || !post) return; try { await api.marketing.addPostComment(post.id, { comment: newComment }); setNewComment(''); const c = await api.marketing.postComments(post.id); setComments(c); toast.success('Comment added'); } catch (e) { toast.error(e.message); } };
  const addAsset = async () => { if (!assetUrl.trim() || !post) return; try { await api.marketing.createAsset({ post_id: post.id, asset_type: 'image', asset_url: assetUrl }); setAssetUrl(''); const a = await api.marketing.assets({ post_id: post.id }); setAssets(a); toast.success('Asset added'); } catch (e) { toast.error(e.message); } };

  const tabs = [
    { id: 'editor', label: 'Editor', icon: PenTool },
    { id: 'preview', label: 'Preview', icon: Eye },
    { id: 'ai', label: 'AI', icon: Sparkles },
    { id: 'comments', label: `Comments (${comments.length})`, icon: MessageSquare },
    { id: 'assets', label: `Assets (${assets.length})`, icon: Image },
    { id: 'history', label: 'History', icon: Clock },
  ];

  return (
    <Modal onClose={onClose} className="max-w-6xl w-full max-h-[92vh] overflow-hidden flex flex-col">
      <div className="flex items-center justify-between px-6 py-3 border-b border-slate-200 shrink-0 bg-white">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-bold text-slate-800">{post ? 'Edit Post' : 'New Post'}</h2>
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition ${tab === t.id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                <t.icon size={12} /> {t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${form.quality_score >= 90 ? 'bg-emerald-100 text-emerald-700' : form.quality_score >= 70 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>Quality: {form.quality_score}</span>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X size={16} /></button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        {tab === 'editor' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Field label="Page"><select className="inp" value={form.page} onChange={e => setForm({...form, page: e.target.value})}><option value="china">China</option><option value="bd">Bangladesh</option></select></Field>
                <Field label="Pillar"><select className="inp" value={form.pillar} onChange={e => setForm({...form, pillar: e.target.value})}>{Object.keys(PILLAR_COLORS).map(p => <option key={p} value={p}>{p}</option>)}</select></Field>
                <Field label="Format"><select className="inp" value={form.format} onChange={e => setForm({...form, format: e.target.value})}><option>Carousel</option><option>Reel</option><option>Single image</option><option>Story</option><option>Video</option><option>Text</option></select></Field>
                <Field label="Platform"><select className="inp" value={form.platform} onChange={e => setForm({...form, platform: e.target.value})}><option value="facebook">Facebook</option><option value="instagram">Instagram</option><option value="tiktok">TikTok</option></select></Field>
                <Field label="Language"><select className="inp" value={form.language} onChange={e => setForm({...form, language: e.target.value})}><option value="bangla">Bangla</option><option value="english">English</option><option value="mixed">Mixed</option></select></Field>
                <Field label="Tone"><select className="inp" value={form.tone} onChange={e => setForm({...form, tone: e.target.value})}><option value="expert_consultant">Expert</option><option value="empathetic_brother">Brother</option><option value="success_story">Story</option><option value="peer_friend">Friend</option></select></Field>
                <Field label="Campaign"><select className="inp" value={form.campaign_id} onChange={e => setForm({...form, campaign_id: e.target.value})}><option value="">None</option>{campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
                <Field label="Stage"><select className="inp" value={form.status} onChange={e => setForm({...form, status: e.target.value})}>{Object.keys(STATUS_CONFIG).map(s => <option key={s} value={s}>{STATUS_CONFIG[s]?.label}</option>)}</select></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Post Date"><input type="date" className="inp" value={form.post_date} onChange={e => setForm({...form, post_date: e.target.value})} /></Field>
                <Field label="Post Time"><input type="time" className="inp" value={form.post_time} onChange={e => setForm({...form, post_time: e.target.value})} /></Field>
              </div>
              <Field label="Hook"><textarea rows={2} className="inp" value={form.hook} onChange={e => setForm({...form, hook: e.target.value})} placeholder="Attention-grabbing hook…" /></Field>
              <Field label="Body"><textarea rows={6} className="inp" value={form.body} onChange={e => setForm({...form, body: e.target.value})} placeholder="Main body copy…" /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Hashtags"><input className="inp" value={form.hashtags} onChange={e => setForm({...form, hashtags: e.target.value})} placeholder="#StudyInChina #EduExpressBD" /></Field>
                <Field label="CTA"><input className="inp" value={form.cta} onChange={e => setForm({...form, cta: e.target.value})} placeholder="DM us for free consultation" /></Field>
              </div>
              <Field label="Design Brief"><textarea rows={2} className="inp" value={form.brief} onChange={e => setForm({...form, brief: e.target.value})} placeholder="Asset instructions for designer…" /></Field>
            </div>
            <div className="space-y-4">
              <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                <h3 className="text-xs font-bold text-slate-700 mb-3">Quality Gate</h3>
                <div className="space-y-2.5">
                  <QCheck pass={qualityChecks.fact_check} label="Fact Check" />
                  <QCheck pass={qualityChecks.tone_ok} label="Tone Check" />
                  <QCheck pass={!qualityChecks.banned_words?.length} label={`Banned Words (${qualityChecks.banned_words?.length || 0})`} />
                  <QCheck pass={qualityChecks.figure_verified === 'verified'} label={`Figures: ${qualityChecks.figure_verified}`} warn />
                </div>
                {qualityChecks.banned_words?.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">{qualityChecks.banned_words.map((w, i) => <span key={i} className="text-[10px] bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded font-medium">{w}</span>)}</div>
                )}
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${form.quality_score}%`, backgroundColor: form.quality_score >= 90 ? '#10B981' : form.quality_score >= 70 ? '#F59E0B' : '#EF4444' }} />
                    </div>
                    <span className="text-xs font-bold text-slate-700">{form.quality_score}</span>
                  </div>
                </div>
              </div>
              <div className="bg-violet-50 rounded-xl p-4 border border-violet-200">
                <h3 className="text-xs font-bold text-violet-700 mb-2">AI Assistant</h3>
                <p className="text-[10px] text-violet-600 mb-3">{llmConfig?.hasKey ? 'Ready · ' + (llmConfig?.provider || 'auto') : 'No key'}</p>
                <button onClick={generateWithAI} disabled={aiGenerating} className="w-full py-2.5 rounded-lg bg-violet-600 text-white text-xs font-bold hover:bg-violet-700 disabled:opacity-50 flex items-center justify-center gap-1.5">
                  {aiGenerating ? <RefreshCw size={12} className="animate-spin" /> : <Sparkles size={12} />}
                  {aiGenerating ? 'Generating…' : 'Generate with AI'}
                </button>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                <h3 className="text-xs font-bold text-slate-700 mb-2">Preview</h3>
                <div className="border border-slate-100 rounded-lg p-3 bg-slate-50">
                  {form.hook && <p className="text-xs font-bold text-slate-800 mb-1">{form.hook}</p>}
                  {form.body && <p className="text-xs text-slate-600 line-clamp-3">{form.body}</p>}
                  {form.cta && <p className="text-xs font-semibold text-blue-600 mt-1">{form.cta}</p>}
                  {form.hashtags && <p className="text-xs text-blue-500 mt-1">{form.hashtags}</p>}
                </div>
              </div>
            </div>
          </div>
        )}
        {tab === 'preview' && (
          <div className="max-w-xl mx-auto">
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 flex items-center gap-2"><Globe size={14} className="text-blue-600" /><span className="text-xs font-semibold text-slate-700">Facebook Preview</span></div>
              <div className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">E</div>
                  <div><p className="text-xs font-bold text-slate-800">EduExpress International</p><p className="text-[10px] text-slate-400">Just now</p></div>
                </div>
                {form.hook && <p className="text-sm font-bold text-slate-800 mb-2">{form.hook}</p>}
                {form.body && <p className="text-sm text-slate-700 whitespace-pre-line mb-3">{form.body}</p>}
                {form.cta && <p className="text-sm font-semibold text-blue-600 mb-2">{form.cta}</p>}
                {form.hashtags && <p className="text-sm text-blue-500">{form.hashtags}</p>}
                <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-100 text-slate-500">
                  <span className="text-xs flex items-center gap-1"><ThumbsUp size={12} /> Like</span>
                  <span className="text-xs flex items-center gap-1"><MessageCircle size={12} /> Comment</span>
                  <span className="text-xs flex items-center gap-1"><Share size={12} /> Share</span>
                </div>
              </div>
            </div>
          </div>
        )}
        {tab === 'ai' && (
          <div className="text-center py-12">
            <Sparkles size={40} className="mx-auto mb-3 text-violet-400" />
            <p className="text-sm text-slate-600 mb-2">AI will generate content based on your settings.</p>
            <p className="text-xs text-slate-400 mb-6">Current: {form.page} · {form.pillar} · {form.format} · {form.language}</p>
            <button onClick={generateWithAI} disabled={aiGenerating} className="px-8 py-3.5 rounded-xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-700 disabled:opacity-50 flex items-center gap-2 mx-auto">
              {aiGenerating ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {aiGenerating ? 'Generating…' : 'Generate Content Now'}
            </button>
          </div>
        )}
        {tab === 'comments' && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h3 className="text-xs font-bold text-slate-700 mb-3">Comments</h3>
              <div className="space-y-3 mb-4 max-h-80 overflow-y-auto">
                {comments.length === 0 ? <p className="text-sm text-slate-400 text-center py-8">No comments yet.</p> : comments.map(c => (
                  <div key={c.id} className="flex gap-3">
                    <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-[10px] font-bold shrink-0">{c.user_name?.charAt(0) || 'U'}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2"><span className="text-xs font-bold text-slate-700">{c.user_name}</span><span className="text-[10px] text-slate-400">{toDate(c.created_at).toLocaleString('en-US', { timeZone: 'Asia/Dhaka' })}</span></div>
                      <p className="text-xs text-slate-600 mt-0.5">{c.comment}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input className="flex-1 inp text-xs" value={newComment} onChange={e => setNewComment(e.target.value)} placeholder="Add a comment…" onKeyDown={e => e.key === 'Enter' && addComment()} />
                <button onClick={addComment} className="px-3 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700">Post</button>
              </div>
            </div>
          </div>
        )}
        {tab === 'assets' && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h3 className="text-xs font-bold text-slate-700 mb-3">Assets</h3>
              <div className="flex gap-2 mb-4">
                <input className="flex-1 inp text-xs" value={assetUrl} onChange={e => setAssetUrl(e.target.value)} placeholder="Paste image URL…" />
                <button onClick={addAsset} className="px-3 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700">Add</button>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {assets.map(a => <div key={a.id} className="aspect-square rounded-lg overflow-hidden border border-slate-200 bg-slate-50"><img src={a.asset_url} alt="" className="w-full h-full object-cover" /></div>)}
                {assets.length === 0 && <p className="col-span-3 text-sm text-slate-400 text-center py-8">No assets.</p>}
              </div>
            </div>
          </div>
        )}
        {tab === 'history' && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h3 className="text-xs font-bold text-slate-700 mb-3">History</h3>
              <div className="space-y-2">
                {logs.length === 0 ? <p className="text-sm text-slate-400 text-center py-8">No history.</p> : logs.map(l => (
                  <div key={l.id} className="flex items-center gap-3 text-xs p-2 rounded-lg bg-slate-50">
                    <Clock size={12} className="text-slate-400" />
                    <span className="text-slate-500">{toDate(l.created_at).toLocaleString('en-US', { timeZone: 'Asia/Dhaka' })}</span>
                    <span className="font-medium text-slate-700">{l.actor}</span>
                    <span className="text-slate-400">moved</span>
                    <span className="font-medium text-blue-600">{STATUS_CONFIG[l.from_status]?.label || l.from_status}</span>
                    <ArrowRight size={10} className="text-slate-400" />
                    <span className="font-medium text-emerald-600">{STATUS_CONFIG[l.to_status]?.label || l.to_status}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between shrink-0 bg-white">
        <div className="flex items-center gap-2">
          <button onClick={() => handleSave('drafted')} disabled={saving} className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-xs font-medium hover:bg-slate-50">Save Draft</button>
          <button onClick={() => handleSave(form.status)} disabled={saving} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700">{saving ? <RefreshCw size={12} className="animate-spin inline" /> : 'Save Post'}</button>
        </div>
        <button onClick={() => handleSave('approved')} disabled={saving} className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700">Approve & Queue</button>
      </div>
    </Modal>
  );
}

function Field({ label, children }) { return (<div><label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">{label}</label>{children}</div>); }
function QCheck({ pass, label, warn }) { return (<div className={`flex items-center gap-2 text-xs ${pass ? 'text-emerald-600' : warn ? 'text-amber-600' : 'text-rose-600'}`}>{pass ? <Check size={12} /> : <AlertTriangle size={12} />}<span>{label}</span></div>); }

/* ═══════════════════════════════════════════════════════════
   ANALYTICS / CAMPAIGNS / ASSETS / PUBLISHING VIEWS (Reused)
   ═══════════════════════════════════════════════════════════ */
function AnalyticsView({ stats, posts }) {
  const [days, setDays] = useState(30);
  const [overview, setOverview] = useState(null);
  useEffect(() => { api.marketing.analyticsOverview(days).catch(() => null).then(o => setOverview(o)); }, [days]);
  const statusData = useMemo(() => { const m = {}; for (const p of posts) { m[p.status] = (m[p.status] || 0) + 1; } return Object.entries(m).map(([s, c]) => ({ name: STATUS_CONFIG[s]?.label || s, value: c, color: PILLAR_COLORS[s] || '#ccc' })); }, [posts]);
  const pillarData = useMemo(() => { const m = {}; for (const p of posts) { m[p.pillar] = (m[p.pillar] || 0) + 1; } return Object.entries(m).map(([p, c]) => ({ name: p, count: c, color: PILLAR_COLORS[p] || '#ccc' })); }, [posts]);
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between"><h2 className="text-sm font-bold text-slate-700">Analytics Dashboard</h2><select className="text-xs border border-slate-200 rounded-lg px-2 py-1" value={days} onChange={e => setDays(parseInt(e.target.value))}><option value={7}>7 days</option><option value={30}>30 days</option><option value={90}>90 days</option></select></div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[{label:'Total Posts',value:stats?.totalPosts||posts.length,color:'bg-blue-50 text-blue-700'},{label:'Published This Month',value:stats?.publishedThisMonth||0,color:'bg-emerald-50 text-emerald-700'},{label:'Active Campaigns',value:stats?.activeCampaigns||0,color:'bg-violet-50 text-violet-700'},{label:'Pending Assets',value:stats?.pendingAssets||0,color:'bg-amber-50 text-amber-700'},{label:'In Queue',value:stats?.queuedPosts||0,color:'bg-cyan-50 text-cyan-700'},{label:'Avg Quality',value:posts.length?Math.round(posts.reduce((a,p)=>a+(p.quality_score||0),0)/posts.length):0,color:'bg-rose-50 text-rose-700'}].map(s => (<div key={s.label} className={`rounded-xl p-3 border ${s.color.split(' ')[0]} border-slate-200`}><p className="text-[10px] text-slate-500 uppercase font-medium">{s.label}</p><p className={`text-2xl font-bold ${s.color.split(' ')[1]}`}>{s.value}</p></div>))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4"><h3 className="text-xs font-bold text-slate-700 mb-3">Posts by Pillar</h3><ResponsiveContainer width="100%" height={200}><BarChart data={pillarData}><CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" /><XAxis dataKey="name" tick={{fontSize:10}} /><YAxis tick={{fontSize:10}} /><Tooltip /><Bar dataKey="count" radius={[4,4,0,0]}>{pillarData.map((e,i)=><Cell key={i} fill={e.color} />)}</Bar></BarChart></ResponsiveContainer></div>
        <div className="bg-white rounded-xl border border-slate-200 p-4"><h3 className="text-xs font-bold text-slate-700 mb-3">Posts by Status</h3><ResponsiveContainer width="100%" height={200}><PieChart><Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({name,value})=>`${value}`} labelStyle={{fontSize:10}}>{statusData.map((e,i)=><Cell key={i} fill={e.color} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div>
        <div className="bg-white rounded-xl border border-slate-200 p-4"><h3 className="text-xs font-bold text-slate-700 mb-3">Publishing Trend</h3><ResponsiveContainer width="100%" height={200}><AreaChart data={overview?.postsByDay||[]}><CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" /><XAxis dataKey="date" tick={{fontSize:10}} /><YAxis tick={{fontSize:10}} /><Tooltip /><Area type="monotone" dataKey="count" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.1} /></AreaChart></ResponsiveContainer></div>
      </div>
    </div>
  );
}

function CampaignsView({ campaigns, onRefresh }) {
  const toast = useToast(); const confirm = useConfirm();
  const handleDelete = async (id) => { const ok = await confirm('Delete campaign?'); if (!ok) return; try { await api.marketing.deleteCampaign(id); toast.success('Deleted'); onRefresh(); } catch (e) { toast.error(e.message); } };
  return (
    <div className="space-y-4">
      <h2 className="text-sm font-bold text-slate-700">Campaigns</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {campaigns.map(c => (
          <div key={c.id} className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-3 h-3 rounded-full mt-1 shrink-0" style={{backgroundColor:c.color||'#3B82F6'}} />
              <div className="flex-1"><h3 className="text-sm font-bold text-slate-800">{c.name}</h3><p className="text-[10px] text-slate-400">{c.start_date} → {c.end_date||'Ongoing'}</p></div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${c.status==='active'?'bg-emerald-100 text-emerald-700':c.status==='paused'?'bg-amber-100 text-amber-700':'bg-slate-100 text-slate-600'}`}>{c.status}</span>
            </div>
            <p className="text-xs text-slate-600 mb-3 line-clamp-2">{c.description}</p>
            <div className="flex items-center justify-between text-xs text-slate-400"><span>{c.post_count} posts</span><button onClick={()=>handleDelete(c.id)} className="p-1 rounded hover:bg-rose-50 text-slate-400 hover:text-rose-600"><Trash2 size={12} /></button></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AssetsView() {
  const [assets, setAssets] = useState([]); const [loading, setLoading] = useState(true); const toast = useToast();
  const load = useCallback(() => { api.marketing.assets().then(a=>{setAssets(a);setLoading(false)}).catch(e=>{toast.error(e.message);setLoading(false)}); }, [toast]);
  useEffect(()=>{load()},[load]); if(loading) return <div className="py-16 text-center text-slate-400 text-sm">Loading…</div>;
  return (<div className="space-y-4"><h2 className="text-sm font-bold text-slate-700">Asset Gallery</h2><div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">{assets.map(a=>(<div key={a.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden group"><div className="aspect-square bg-slate-100 relative">{a.asset_url?<img src={a.asset_url} alt="" className="w-full h-full object-cover" />:<div className="flex items-center justify-center h-full text-slate-300"><Image size={24} /></div>}</div><div className="p-2"><p className="text-[10px] font-medium text-slate-700 truncate">{a.post_title||'Unlinked'}</p><p className="text-[10px] text-slate-400">{a.asset_type} · {a.status}</p></div></div>))}{assets.length===0&&<p className="col-span-full text-center text-sm text-slate-400 py-12">No assets.</p>}</div></div>);
}

function PublishingView() {
  const [config, setConfig] = useState(null); const [duePosts, setDuePosts] = useState([]); const [queue, setQueue] = useState([]); const [loading, setLoading] = useState(true); const toast = useToast();
  const load = useCallback(() => { Promise.all([api.marketing.publishConfig(), api.marketing.postsDue(50), api.marketing.publishingQueueFull({limit:100})]).then(([cfg,posts,q])=>{setConfig(cfg);setDuePosts(posts);setQueue(q);setLoading(false)}).catch(e=>{toast.error(e.message);setLoading(false)}); }, [toast]);
  useEffect(()=>{load()},[load]); if(loading) return <div className="py-16 text-center text-slate-400 text-sm">Loading…</div>;
  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl border border-slate-200 p-4"><h2 className="text-sm font-bold text-slate-700 mb-3">Publishing Config</h2><div className="flex gap-3 flex-wrap"><div className={`px-3 py-1.5 rounded-lg text-xs font-medium ${config?.n8n?'bg-emerald-100 text-emerald-700':'bg-rose-100 text-rose-700'}`}>n8n: {config?.n8n?'Connected':'Not Configured'}</div><div className={`px-3 py-1.5 rounded-lg text-xs font-medium ${config?.facebook?.china?'bg-emerald-100 text-emerald-700':'bg-amber-100 text-amber-700'}`}>Facebook China: {config?.facebook?.china?'Ready':'Missing'}</div><div className={`px-3 py-1.5 rounded-lg text-xs font-medium ${config?.facebook?.bd?'bg-emerald-100 text-emerald-700':'bg-amber-100 text-amber-700'}`}>Facebook BD: {config?.facebook?.bd?'Ready':'Missing'}</div></div></div>
      <div className="bg-white rounded-xl border border-slate-200 p-4"><h2 className="text-sm font-bold text-slate-700 mb-3">Approved Posts ({duePosts.length})</h2>{duePosts.length===0?<p className="text-sm text-slate-400">No approved posts.</p>:(<div className="space-y-2">{duePosts.slice(0,10).map(p=>(<div key={p.id} className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 bg-slate-50"><div className="flex-1 min-w-0"><p className="text-sm font-medium text-slate-700 truncate">{p.title||p.hook||'Untitled'}</p><p className="text-xs text-slate-400">{p.page} · {p.pillar} · Q:{p.quality_score||'—'}</p></div></div>))}</div>)}</div>
      <div className="bg-white rounded-xl border border-slate-200 p-4"><h2 className="text-sm font-bold text-slate-700 mb-3">Publishing Queue ({queue.length})</h2>{queue.length===0?<p className="text-sm text-slate-400">No items.</p>:(<div className="space-y-2">{queue.map(item=>(<div key={item.id} className="flex items-center gap-3 p-3 rounded-lg border border-slate-100"><div className="flex-1 min-w-0"><div className="flex items-center gap-2"><p className="text-sm font-medium text-slate-700 truncate">{item.post_title||`Post #${item.post_id}`}</p><span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${item.status==='published'?'bg-emerald-100 text-emerald-700':item.status==='failed'?'bg-rose-100 text-rose-700':'bg-amber-100 text-amber-700'}`}>{item.status}</span></div><p className="text-xs text-slate-400 mt-0.5">{item.platform} · {item.page}</p>{item.error_message&&<p className="text-xs text-rose-600 mt-1">⚠️ {item.error_message}</p>}</div></div>))}</div>)}</div>
    </div>
  );
}
