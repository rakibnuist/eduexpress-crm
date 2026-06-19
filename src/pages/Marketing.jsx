import { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '../api';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/Confirm';
import Modal from '../components/Modal';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import {
  LayoutDashboard, Kanban, CalendarDays, BarChart3, FolderKanban, Image, BookOpen, Lightbulb, Rocket, Settings,
  Plus, Search, Filter, ChevronRight, Clock, Check, AlertTriangle, X, RefreshCw, Zap, Wand2, Sparkles,
  Heart, MessageCircle, Send, Eye, Hash, Target, Palette, PenTool, Upload, Trash2, Edit3, Move,
  ArrowRight, ArrowLeft, ThumbsUp, ThumbsDown, MessageSquare, FileText, ExternalLink, Download,
  Globe, Camera, Play, Video, Layers, Sliders, MoreHorizontal, User, Calendar, MapPin, Flag
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════
   PROFESSIONAL SMM PIPELINE v3.0
   Main Marketing Hub with Kanban Pipeline, Calendar,
   Analytics, Campaigns, Assets, KB, Research, Publishing
   ═══════════════════════════════════════════════════════════ */

const STATUS_CONFIG = {
  ideation:      { label: 'Ideation',       color: 'bg-slate-100 border-slate-200 text-slate-700',       icon: Lightbulb },
  brief_ready:   { label: 'Brief Ready',    color: 'bg-indigo-50 border-indigo-200 text-indigo-700',   icon: FileText },
  writing:       { label: 'Writing',        color: 'bg-blue-50 border-blue-200 text-blue-700',           icon: PenTool },
  quality_review:{ label: 'Quality Review', color: 'bg-amber-50 border-amber-200 text-amber-700',       icon: AlertTriangle },
  design:        { label: 'Design',         color: 'bg-violet-50 border-violet-200 text-violet-700',   icon: Palette },
  design_review: { label: 'Design Review',  color: 'bg-pink-50 border-pink-200 text-pink-700',           icon: Eye },
  approved:      { label: 'Approved',       color: 'bg-emerald-50 border-emerald-200 text-emerald-700', icon: Check },
  scheduled:     { label: 'Scheduled',      color: 'bg-cyan-50 border-cyan-200 text-cyan-700',           icon: Calendar },
  published:     { label: 'Published',      color: 'bg-green-50 border-green-200 text-green-700',     icon: Rocket },
  archived:      { label: 'Archived',       color: 'bg-gray-50 border-gray-200 text-gray-500',        icon: FolderKanban },
};

const PIPELINE_STAGES = ['ideation','brief_ready','writing','quality_review','design','design_review','approved','scheduled','published','archived'];

const PILLAR_COLORS = {
  scholarship: '#10B981', trust: '#3B82F6', career: '#8B5CF6', urgency: '#F59E0B',
  university: '#EC4899', cost: '#06B6D4', success_story: '#84CC16', trending: '#F97316',
  brand: '#6366F1', festival: '#D946EF'
};

const PLATFORM_ICONS = { facebook: Globe, instagram: Camera, tiktok: Play };

export default function Marketing() {
  const toast = useToast();
  const confirm = useConfirm();
  const [activeView, setActiveView] = useState('pipeline');
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaign, setSelectedCampaign] = useState('');
  const [pipeline, setPipeline] = useState({});
  const [posts, setPosts] = useState([]);
  const [stats, setStats] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [pageFilter, setPageFilter] = useState('');
  const [pillarFilter, setPillarFilter] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingPost, setEditingPost] = useState(null);
  const [campaignModalOpen, setCampaignModalOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [camp, pipe, postList, dash] = await Promise.all([
        api.marketing.campaigns(),
        api.marketing.pipeline({ campaign_id: selectedCampaign || undefined }),
        api.marketing.posts({ status: '', limit: 200 }),
        api.marketing.marketingDashboard().catch(() => null)
      ]);
      setCampaigns(camp);
      setPipeline(pipe.stages || {});
      setPosts(postList);
      setStats(dash);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [selectedCampaign, toast]);

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

  const views = [
    { id: 'pipeline', label: 'Pipeline', icon: Kanban },
    { id: 'calendar', label: 'Calendar', icon: CalendarDays },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'campaigns', label: 'Campaigns', icon: FolderKanban },
    { id: 'assets', label: 'Assets', icon: Image },
    { id: 'kb', label: 'Knowledge Base', icon: BookOpen },
    { id: 'research', label: 'Research', icon: Lightbulb },
    { id: 'publishing', label: 'Publishing', icon: Rocket },
  ];

  return (
    <div className="h-[calc(100vh-48px)] flex bg-slate-50">
      {/* Sidebar */}
      <aside className="w-16 lg:w-56 bg-white border-r border-slate-200 flex flex-col shrink-0">
        <div className="p-3 lg:p-4 border-b border-slate-100">
          <h1 className="hidden lg:block text-sm font-bold text-slate-800">Social Media Engine</h1>
          <p className="hidden lg:block text-[10px] text-slate-400 mt-0.5">v3.0 Professional Pipeline</p>
        </div>
        <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {views.map(v => (
            <button key={v.id} onClick={() => setActiveView(v.id)}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition ${activeView === v.id ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}>
              <v.icon size={16} />
              <span className="hidden lg:inline">{v.label}</span>
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-slate-100">
          <button onClick={() => { setEditingPost(null); setEditorOpen(true); }}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition">
            <Plus size={14} /> <span className="hidden lg:inline">New Post</span>
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
              <input className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300" placeholder="Search posts…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>
            <select className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white" value={selectedCampaign} onChange={e => setSelectedCampaign(e.target.value)}>
              <option value="">All Campaigns</option>
              {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
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
          {loading && activeView !== 'pipeline' ? (
            <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
              <RefreshCw size={16} className="animate-spin mr-2" /> Loading…
            </div>
          ) : (
            <>
              {activeView === 'pipeline' && (
                <PipelineBoard
                  pipeline={pipeline}
                  filteredPosts={filteredPosts}
                  onMovePost={handleMovePost}
                  onEditPost={(post) => { setEditingPost(post); setEditorOpen(true); }}
                  onDeletePost={handleDeletePost}
                  onRefresh={load}
                  loading={loading}
                />
              )}
              {activeView === 'calendar' && <CalendarView posts={posts} campaigns={campaigns} onEditPost={(post) => { setEditingPost(post); setEditorOpen(true); }} />}
              {activeView === 'analytics' && <AnalyticsView stats={stats} posts={posts} />}
              {activeView === 'campaigns' && <CampaignsView campaigns={campaigns} onRefresh={load} onCreate={() => setCampaignModalOpen(true)} />}
              {activeView === 'assets' && <AssetsView />}
              {activeView === 'kb' && <KBView />}
              {activeView === 'research' && <ResearchView />}
              {activeView === 'publishing' && <PublishingView />}
            </>
          )}
        </div>
      </main>

      {/* Content Editor Modal */}
      {editorOpen && (
        <ContentEditorModal
          post={editingPost}
          campaigns={campaigns}
          onClose={() => setEditorOpen(false)}
          onSaved={() => { setEditorOpen(false); load(); }}
        />
      )}

      {/* Campaign Create Modal */}
      {campaignModalOpen && (
        <CampaignCreateModal
          onClose={() => setCampaignModalOpen(false)}
          onCreated={() => { setCampaignModalOpen(false); load(); }}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   PIPELINE BOARD — Kanban View
   ═══════════════════════════════════════════════════════════ */
function PipelineBoard({ pipeline, filteredPosts, onMovePost, onEditPost, onDeletePost, onRefresh, loading }) {
  // Merge pipeline stages with filtered posts for search
  const mergedStages = useMemo(() => {
    const byStatus = {};
    for (const post of filteredPosts) {
      const s = post.status || 'ideation';
      if (!byStatus[s]) byStatus[s] = [];
      byStatus[s].push(post);
    }
    return byStatus;
  }, [filteredPosts]);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-slate-700">Content Pipeline</h2>
        <div className="flex items-center gap-2">
          {PIPELINE_STAGES.slice(0, 7).map(s => {
            const cfg = STATUS_CONFIG[s];
            const count = (mergedStages[s] || []).length;
            return (
              <div key={s} className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-medium ${cfg.color}`}>
                <cfg.icon size={10} /> {count}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex gap-3 h-full min-w-max pb-2">
          {PIPELINE_STAGES.map(stage => {
            const cfg = STATUS_CONFIG[stage];
            const posts = mergedStages[stage] || [];
            return (
              <PipelineColumn
                key={stage}
                stage={stage}
                config={cfg}
                posts={posts}
                onMovePost={onMovePost}
                onEditPost={onEditPost}
                onDeletePost={onDeletePost}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PipelineColumn({ stage, config, posts, onMovePost, onEditPost, onDeletePost }) {
  const [collapsed, setCollapsed] = useState(false);
  const isEnd = stage === 'published' || stage === 'archived';

  return (
    <div className={`flex flex-col h-full w-72 shrink-0 ${collapsed ? 'w-12' : ''} transition-all`}>
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${config.color} mb-2 cursor-pointer`} onClick={() => setCollapsed(!collapsed)}>
        <config.icon size={14} />
        {!collapsed && (
          <>
            <span className="text-xs font-bold flex-1">{config.label}</span>
            <span className="text-[10px] font-bold bg-white/60 px-1.5 py-0.5 rounded">{posts.length}</span>
          </>
        )}
      </div>
      {!collapsed && (
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {posts.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-300">No posts</div>
          ) : posts.map(post => (
            <PostCard
              key={post.id}
              post={post}
              stage={stage}
              onMovePost={onMovePost}
              onEditPost={onEditPost}
              onDeletePost={onDeletePost}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PostCard({ post, stage, onMovePost, onEditPost, onDeletePost }) {
  const pillColor = PILLAR_COLORS[post.pillar] || '#64748B';
  const PlatformIcon = PLATFORM_ICONS[post.platform] || Facebook;
  const quality = post.quality_score || 0;
  const qualityColor = quality >= 90 ? 'text-emerald-600' : quality >= 70 ? 'text-amber-600' : 'text-rose-600';
  const [menuOpen, setMenuOpen] = useState(false);

  const currentIdx = PIPELINE_STAGES.indexOf(stage);
  const prevStage = currentIdx > 0 ? PIPELINE_STAGES[currentIdx - 1] : null;
  const nextStage = currentIdx < PIPELINE_STAGES.length - 1 ? PIPELINE_STAGES[currentIdx + 1] : null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm hover:shadow-md transition group cursor-pointer" onClick={() => onEditPost(post)}>
      <div className="flex items-start gap-2 mb-2">
        <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: pillColor }} />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-slate-800 leading-tight line-clamp-2">{post.hook || 'Untitled Post'}</p>
          <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-2">{post.body?.slice(0, 80)}…</p>
        </div>
        <div className="relative">
          <button onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }} className="p-1 rounded hover:bg-slate-100 text-slate-400">
            <MoreHorizontal size={12} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-6 w-36 bg-white rounded-lg border border-slate-200 shadow-lg z-20 py-1">
              <button onClick={(e) => { e.stopPropagation(); onEditPost(post); setMenuOpen(false); }} className="w-full text-left px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50">Edit</button>
              <button onClick={(e) => { e.stopPropagation(); onDeletePost(post); setMenuOpen(false); }} className="w-full text-left px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50">Delete</button>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap mb-2">
        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 flex items-center gap-1">
          <PlatformIcon size={9} /> {post.page}
        </span>
        <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: pillColor + '15', color: pillColor }}>
          {post.pillar}
        </span>
        {post.format && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">{post.format}</span>
        )}
      </div>

      {post.asset_url && (
        <div className="mb-2 rounded-lg overflow-hidden border border-slate-100 h-20 bg-slate-50">
          <img src={post.asset_url} alt="" className="w-full h-full object-cover" />
        </div>
      )}

      <div className="flex items-center justify-between text-[10px] text-slate-400">
        <div className="flex items-center gap-2">
          <span className={qualityColor}>Q: {quality}</span>
          <span>· {new Date(post.created_at).toLocaleDateString()}</span>
        </div>
        <div className="flex items-center gap-1">
          {prevStage && (
            <button onClick={(e) => { e.stopPropagation(); onMovePost(post.id, prevStage); }} className="p-1 rounded hover:bg-slate-100" title={`Move to ${STATUS_CONFIG[prevStage]?.label}`}>
              <ArrowLeft size={10} />
            </button>
          )}
          {nextStage && (
            <button onClick={(e) => { e.stopPropagation(); onMovePost(post.id, nextStage); }} className="p-1 rounded hover:bg-slate-100" title={`Move to ${STATUS_CONFIG[nextStage]?.label}`}>
              <ArrowRight size={10} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   CONTENT EDITOR MODAL — AI Generation + Preview + Quality Gate
   ═══════════════════════════════════════════════════════════ */
function ContentEditorModal({ post, campaigns, onClose, onSaved }) {
  const toast = useToast();
  const [tab, setTab] = useState('editor'); // editor | preview | ai
  const [saving, setSaving] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [llmConfig, setLlmConfig] = useState(null);

  // Form state
  const [form, setForm] = useState({
    page: 'china', pillar: 'scholarship', format: 'Carousel', language: 'bangla', platform: 'facebook',
    tone: 'expert_consultant', hook: '', body: '', hashtags: '', cta: '', brief: '',
    campaign_id: '', status: 'ideation', priority: 'normal', due_date: '', notes: '',
    assigned_to: '', quality_score: 100, quality_checks: '{}'
  });

  const [qualityChecks, setQualityChecks] = useState({ fact_check: true, banned_words: [], tone_ok: true, figure_verified: 'pending', severity: [] });

  useEffect(() => {
    if (post) {
      setForm({ ...form, ...post });
      try { setQualityChecks(JSON.parse(post.quality_checks || '{}')); } catch {}
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

  const combined = [form.hook, form.body, form.cta, form.hashtags].filter(Boolean).join('\n\n');

  return (
    <Modal onClose={onClose} className="max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-bold text-slate-800">{post ? 'Edit Post' : 'New Post'}</h2>
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
            {[{id:'editor',label:'Editor',icon:PenTool},{id:'preview',label:'Preview',icon:Eye},{id:'ai',label:'AI',icon:Sparkles}].map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition ${tab === t.id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                <t.icon size={12} /> {t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold px-2 py-1 rounded-lg ${form.quality_score >= 90 ? 'bg-emerald-100 text-emerald-700' : form.quality_score >= 70 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>
            Quality: {form.quality_score}
          </span>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X size={16} /></button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {tab === 'editor' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Form */}
            <div className="lg:col-span-2 space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Field label="Page">
                  <select className="inp" value={form.page} onChange={e => setForm({...form, page: e.target.value})}>
                    <option value="china">China</option><option value="bd">Bangladesh</option>
                    <option value="instagram">Instagram</option><option value="tiktok">TikTok</option>
                  </select>
                </Field>
                <Field label="Pillar">
                  <select className="inp" value={form.pillar} onChange={e => setForm({...form, pillar: e.target.value})}>
                    {Object.keys(PILLAR_COLORS).map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </Field>
                <Field label="Format">
                  <select className="inp" value={form.format} onChange={e => setForm({...form, format: e.target.value})}>
                    <option>Carousel</option><option>Reel</option><option>Single image</option><option>Story</option><option>Video</option><option>Live</option><option>Text</option>
                  </select>
                </Field>
                <Field label="Platform">
                  <select className="inp" value={form.platform} onChange={e => setForm({...form, platform: e.target.value})}>
                    <option value="facebook">Facebook</option><option value="instagram">Instagram</option><option value="tiktok">TikTok</option>
                  </select>
                </Field>
                <Field label="Language">
                  <select className="inp" value={form.language} onChange={e => setForm({...form, language: e.target.value})}>
                    <option value="bangla">Bangla</option><option value="english">English</option><option value="mixed">Mixed</option>
                  </select>
                </Field>
                <Field label="Tone">
                  <select className="inp" value={form.tone} onChange={e => setForm({...form, tone: e.target.value})}>
                    <option value="expert_consultant">Expert Consultant</option>
                    <option value="empathetic_brother">Empathetic Brother</option>
                    <option value="success_story">Success Story</option>
                    <option value="peer_friend">Peer Friend</option>
                  </select>
                </Field>
                <Field label="Campaign">
                  <select className="inp" value={form.campaign_id} onChange={e => setForm({...form, campaign_id: e.target.value})}>
                    <option value="">None</option>
                    {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </Field>
                <Field label="Status">
                  <select className="inp" value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                    {PIPELINE_STAGES.map(s => <option key={s} value={s}>{STATUS_CONFIG[s]?.label || s}</option>)}
                  </select>
                </Field>
              </div>

              <Field label="Hook">
                <textarea rows={2} className="inp" value={form.hook} onChange={e => setForm({...form, hook: e.target.value})} placeholder="Attention-grabbing hook…" />
              </Field>
              <Field label="Body">
                <textarea rows={6} className="inp" value={form.body} onChange={e => setForm({...form, body: e.target.value})} placeholder="Main body copy…" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Hashtags">
                  <input className="inp" value={form.hashtags} onChange={e => setForm({...form, hashtags: e.target.value})} placeholder="#StudyInChina #EduExpressBD" />
                </Field>
                <Field label="CTA">
                  <input className="inp" value={form.cta} onChange={e => setForm({...form, cta: e.target.value})} placeholder="DM us for free consultation" />
                </Field>
              </div>
              <Field label="Design Brief">
                <textarea rows={2} className="inp" value={form.brief} onChange={e => setForm({...form, brief: e.target.value})} placeholder="Asset instructions for designer…" />
              </Field>
              <Field label="Notes">
                <textarea rows={2} className="inp" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Internal notes, references, etc." />
              </Field>
            </div>

            {/* Right: Quality Gate + Meta */}
            <div className="space-y-4">
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <h3 className="text-xs font-bold text-slate-700 mb-3">Quality Gate</h3>
                <div className="space-y-2">
                  <QCheck pass={qualityChecks.fact_check} label="Fact Check" />
                  <QCheck pass={qualityChecks.tone_ok} label="Tone Check" />
                  <QCheck pass={!qualityChecks.banned_words?.length} label={`Banned Words (${qualityChecks.banned_words?.length || 0})`} />
                  <QCheck pass={qualityChecks.figure_verified === 'verified'} label={`Figures: ${qualityChecks.figure_verified}`} warn />
                </div>
                {qualityChecks.banned_words?.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {qualityChecks.banned_words.map((w, i) => (
                      <span key={i} className="text-[10px] bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded">{w}</span>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
                <h3 className="text-xs font-bold text-slate-700">Meta</h3>
                <Field label="Priority">
                  <select className="inp" value={form.priority} onChange={e => setForm({...form, priority: e.target.value})}>
                    <option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option>
                  </select>
                </Field>
                <Field label="Due Date">
                  <input type="date" className="inp" value={form.due_date} onChange={e => setForm({...form, due_date: e.target.value})} />
                </Field>
                <Field label="Assigned To">
                  <input className="inp" value={form.assigned_to} onChange={e => setForm({...form, assigned_to: e.target.value})} placeholder="Name" />
                </Field>
              </div>

              <div className="bg-violet-50 rounded-xl p-4 border border-violet-200">
                <h3 className="text-xs font-bold text-violet-700 mb-2">AI Assistant</h3>
                <p className="text-[10px] text-violet-600 mb-2">{llmConfig?.hasKey ? 'LLM ready' : 'No LLM key configured'}</p>
                <button onClick={generateWithAI} disabled={aiGenerating} className="w-full py-2 rounded-lg bg-violet-600 text-white text-xs font-bold hover:bg-violet-700 disabled:opacity-50 flex items-center justify-center gap-1.5">
                  {aiGenerating ? <RefreshCw size={12} className="animate-spin" /> : <Sparkles size={12} />}
                  {aiGenerating ? 'Generating…' : 'Generate with AI'}
                </button>
              </div>
            </div>
          </div>
        )}

        {tab === 'preview' && (
          <div className="max-w-xl mx-auto">
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 flex items-center gap-2">
                <Facebook size={14} className="text-blue-600" />
                <span className="text-xs font-semibold text-slate-700">Facebook Preview</span>
              </div>
              <div className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">E</div>
                  <div>
                    <p className="text-xs font-bold text-slate-800">EduExpress International</p>
                    <p className="text-[10px] text-slate-400">Just now · {form.platform === 'facebook' ? '🌐' : '📍'}</p>
                  </div>
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
            <Sparkles size={32} className="mx-auto mb-3 text-violet-400" />
            <p className="text-sm text-slate-600 mb-4">Fill in Page, Pillar, Format, and Language on the Editor tab, then click Generate.</p>
            <button onClick={generateWithAI} disabled={aiGenerating} className="px-6 py-3 rounded-xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-700 disabled:opacity-50 flex items-center gap-2 mx-auto">
              {aiGenerating ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {aiGenerating ? 'Generating…' : 'Generate Content Now'}
            </button>
          </div>
        )}
      </div>

      <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between shrink-0 bg-white">
        <div className="flex items-center gap-2">
          <button onClick={() => handleSave('drafted')} disabled={saving} className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-xs font-medium hover:bg-slate-50">
            Save Draft
          </button>
          <button onClick={() => handleSave(form.status)} disabled={saving} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700">
            {saving ? <RefreshCw size={12} className="animate-spin inline" /> : 'Save Post'}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => handleSave('approved')} disabled={saving} className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700">
            Approve & Queue
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">{label}</label>
      {children}
    </div>
  );
}

function QCheck({ pass, label, warn }) {
  return (
    <div className={`flex items-center gap-2 text-xs ${pass ? 'text-emerald-600' : warn ? 'text-amber-600' : 'text-rose-600'}`}>
      {pass ? <Check size={12} /> : <AlertTriangle size={12} />}
      <span>{label}</span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   CALENDAR VIEW
   ═══════════════════════════════════════════════════════════ */
function CalendarView({ posts, campaigns, onEditPost }) {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const daysInMonth = new Date(parseInt(month.split('-')[0]), parseInt(month.split('-')[1]), 0).getDate();
  const firstDay = new Date(parseInt(month.split('-')[0]), parseInt(month.split('-')[1]) - 1, 1).getDay();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blanks = Array.from({ length: firstDay }, (_, i) => i);

  const postsByDay = useMemo(() => {
    const map = {};
    for (const p of posts) {
      const d = p.post_date || p.created_at;
      if (!d) continue;
      const day = d.slice(0, 10);
      if (!map[day]) map[day] = [];
      map[day].push(p);
    }
    return map;
  }, [posts]);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold text-slate-700">Content Calendar</h2>
        <div className="flex items-center gap-2">
          <button onClick={() => setMonth(m => { const d = new Date(m + '-01'); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 7); })} className="p-1.5 rounded-lg hover:bg-slate-100"><ArrowLeft size={14} /></button>
          <span className="text-sm font-semibold text-slate-700 min-w-[120px] text-center">{new Date(month + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
          <button onClick={() => setMonth(m => { const d = new Date(m + '-01'); d.setMonth(d.getMonth() + 1); return d.toISOString().slice(0, 7); })} className="p-1.5 rounded-lg hover:bg-slate-100"><ArrowRight size={14} /></button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-2 mb-2">
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => <div key={d} className="text-center text-[10px] font-bold text-slate-400 uppercase py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-2">
        {blanks.map(i => <div key={`b-${i}`} className="bg-slate-50 rounded-lg min-h-[100px]" />)}
        {days.map(day => {
          const dateStr = `${month}-${String(day).padStart(2, '0')}`;
          const dayPosts = postsByDay[dateStr] || [];
          return (
            <div key={day} className="bg-white rounded-lg border border-slate-200 min-h-[100px] p-2 hover:border-blue-300 transition">
              <div className="flex items-center justify-between mb-1">
                <span className={`text-xs font-bold ${dayPosts.length ? 'text-blue-600' : 'text-slate-400'}`}>{day}</span>
                {dayPosts.length > 0 && <span className="text-[10px] bg-blue-100 text-blue-700 px-1 rounded">{dayPosts.length}</span>}
              </div>
              <div className="space-y-1">
                {dayPosts.slice(0, 3).map(p => (
                  <button key={p.id} onClick={() => onEditPost(p)} className="w-full text-left text-[10px] p-1 rounded bg-slate-50 hover:bg-blue-50 truncate transition" style={{ borderLeft: `2px solid ${PILLAR_COLORS[p.pillar] || '#ccc'}` }}>
                    {p.hook?.slice(0, 25)}…
                  </button>
                ))}
                {dayPosts.length > 3 && <p className="text-[10px] text-slate-400 pl-1">+{dayPosts.length - 3} more</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   ANALYTICS VIEW
   ═══════════════════════════════════════════════════════════ */
function AnalyticsView({ stats, posts }) {
  const [days, setDays] = useState(30);
  const [overview, setOverview] = useState(null);

  useEffect(() => {
    api.marketing.analyticsOverview(days).catch(() => null).then(o => setOverview(o));
  }, [days]);

  const statusData = useMemo(() => {
    const map = {};
    for (const p of posts) { map[p.status] = (map[p.status] || 0) + 1; }
    return Object.entries(map).map(([status, count]) => ({ name: STATUS_CONFIG[status]?.label || status, value: count, color: PILLAR_COLORS[status] || '#ccc' }));
  }, [posts]);

  const pillarData = useMemo(() => {
    const map = {};
    for (const p of posts) { map[p.pillar] = (map[p.pillar] || 0) + 1; }
    return Object.entries(map).map(([pillar, count]) => ({ name: pillar, count, color: PILLAR_COLORS[pillar] || '#ccc' }));
  }, [posts]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-700">Analytics Dashboard</h2>
        <select className="text-xs border border-slate-200 rounded-lg px-2 py-1" value={days} onChange={e => setDays(parseInt(e.target.value))}>
          <option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option>
        </select>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {[
          { label: 'Total Posts', value: stats?.totalPosts || posts.length, color: 'bg-blue-50 text-blue-700' },
          { label: 'Published This Month', value: stats?.publishedThisMonth || 0, color: 'bg-emerald-50 text-emerald-700' },
          { label: 'Active Campaigns', value: stats?.activeCampaigns || 0, color: 'bg-violet-50 text-violet-700' },
          { label: 'Pending Assets', value: stats?.pendingAssets || 0, color: 'bg-amber-50 text-amber-700' },
          { label: 'In Queue', value: stats?.queuedPosts || 0, color: 'bg-cyan-50 text-cyan-700' },
          { label: 'Avg Quality', value: posts.length ? Math.round(posts.reduce((a, p) => a + (p.quality_score || 0), 0) / posts.length) : 0, color: 'bg-rose-50 text-rose-700' },
        ].map(s => (
          <div key={s.label} className={`rounded-xl p-3 border ${s.color.split(' ')[0]} border-slate-200`}>
            <p className="text-[10px] text-slate-500 uppercase font-medium">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color.split(' ')[1]}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-xs font-bold text-slate-700 mb-3">Posts by Pillar</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={pillarData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {pillarData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-xs font-bold text-slate-700 mb-3">Posts by Status</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, value }) => `${name}: ${value}`} labelStyle={{ fontSize: 10 }}>
                {statusData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-xs font-bold text-slate-700 mb-3">Publishing Trend</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={overview?.postsByDay || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Area type="monotone" dataKey="count" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.1} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   CAMPAIGNS VIEW
   ═══════════════════════════════════════════════════════════ */
function CampaignsView({ campaigns, onRefresh, onCreate }) {
  const toast = useToast();
  const confirm = useConfirm();

  const handleDelete = async (id) => {
    const ok = await confirm('Delete this campaign?');
    if (!ok) return;
    try { await api.marketing.deleteCampaign(id); toast.success('Deleted'); onRefresh(); }
    catch (e) { toast.error(e.message); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-700">Campaigns</h2>
        <button onClick={onCreate} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700">
          <Plus size={12} /> New Campaign
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {campaigns.map(c => (
          <div key={c.id} className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-3 h-3 rounded-full mt-1 shrink-0" style={{ backgroundColor: c.color || '#3B82F6' }} />
              <div className="flex-1">
                <h3 className="text-sm font-bold text-slate-800">{c.name}</h3>
                <p className="text-[10px] text-slate-400">{c.start_date} → {c.end_date || 'Ongoing'}</p>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${c.status === 'active' ? 'bg-emerald-100 text-emerald-700' : c.status === 'paused' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{c.status}</span>
            </div>
            <p className="text-xs text-slate-600 mb-3 line-clamp-2">{c.description}</p>
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>{c.post_count} posts</span>
              <div className="flex items-center gap-1">
                <button onClick={() => handleDelete(c.id)} className="p-1 rounded hover:bg-rose-50 text-slate-400 hover:text-rose-600"><Trash2 size={12} /></button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CampaignCreateModal({ onClose, onCreated }) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', page: 'china', pillar: 'scholarship', start_date: '', end_date: '', color: '#3B82F6' });

  const handleSubmit = async () => {
    if (!form.name) { toast.error('Name required'); return; }
    setSaving(true);
    try { await api.marketing.createCampaign(form); toast.success('Campaign created'); onCreated(); }
    catch (e) { toast.error(e.message); } finally { setSaving(false); }
  };

  return (
    <Modal onClose={onClose} className="max-w-lg w-full">
      <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-800">New Campaign</h2>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X size={16} /></button>
      </div>
      <div className="p-6 space-y-3">
        <Field label="Campaign Name"><input className="inp" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Summer 2026 Scholarship Push" /></Field>
        <Field label="Description"><textarea rows={2} className="inp" value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Goal and overview…" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Page">
            <select className="inp" value={form.page} onChange={e => setForm({...form, page: e.target.value})}>
              <option value="china">China</option><option value="bd">Bangladesh</option>
            </select>
          </Field>
          <Field label="Pillar">
            <select className="inp" value={form.pillar} onChange={e => setForm({...form, pillar: e.target.value})}>
              {Object.keys(PILLAR_COLORS).map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start Date"><input type="date" className="inp" value={form.start_date} onChange={e => setForm({...form, start_date: e.target.value})} /></Field>
          <Field label="End Date"><input type="date" className="inp" value={form.end_date} onChange={e => setForm({...form, end_date: e.target.value})} /></Field>
        </div>
        <Field label="Color">
          <div className="flex items-center gap-2">
            <input type="color" value={form.color} onChange={e => setForm({...form, color: e.target.value})} className="w-8 h-8 rounded cursor-pointer" />
            <span className="text-xs text-slate-500">{form.color}</span>
          </div>
        </Field>
      </div>
      <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-2">
        <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-xs font-medium">Cancel</button>
        <button onClick={handleSubmit} disabled={saving} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 disabled:opacity-50">
          {saving ? <RefreshCw size={12} className="animate-spin inline" /> : 'Create Campaign'}
        </button>
      </div>
    </Modal>
  );
}

/* ═══════════════════════════════════════════════════════════
   ASSETS VIEW
   ═══════════════════════════════════════════════════════════ */
function AssetsView() {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const load = useCallback(() => {
    api.marketing.assets().then(a => { setAssets(a); setLoading(false); }).catch(e => { toast.error(e.message); setLoading(false); });
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="py-16 text-center text-slate-400 text-sm">Loading assets…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-700">Asset Gallery</h2>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {assets.map(a => (
          <div key={a.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden group">
            <div className="aspect-square bg-slate-100 relative">
              {a.asset_url ? (
                <img src={a.asset_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="flex items-center justify-center h-full text-slate-300"><Image size={24} /></div>
              )}
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition">
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${a.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : a.status === 'review' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{a.status}</span>
              </div>
            </div>
            <div className="p-2">
              <p className="text-[10px] font-medium text-slate-700 truncate">{a.post_title || 'Unlinked Asset'}</p>
              <p className="text-[10px] text-slate-400">{a.asset_type} · {a.file_size}</p>
            </div>
          </div>
        ))}
        {assets.length === 0 && <p className="col-span-full text-center text-sm text-slate-400 py-12">No assets yet. Upload from the Content Editor.</p>}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   KNOWLEDGE BASE VIEW
   ═══════════════════════════════════════════════════════════ */
function KBView() {
  const [tab, setTab] = useState('universities');
  const [universities, setUniversities] = useState([]);
  const [scholarships, setScholarships] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const searchKB = async () => {
    if (!search.trim()) return;
    setLoading(true);
    try {
      const [u, s] = await Promise.all([
        api.marketing.searchUniversities(search, '', 50),
        api.marketing.searchScholarships(search, '', '', 50)
      ]);
      setUniversities(u); setScholarships(s);
    } catch (e) { toast.error(e.message); } finally { setLoading(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-700">Knowledge Base</h2>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="pl-7 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg w-48" placeholder="Search universities, scholarships…" value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && searchKB()} />
          </div>
          <button onClick={searchKB} className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700">Search</button>
        </div>
      </div>
      <div className="flex gap-1">
        {[{id:'universities',label:'Universities'},{id:'scholarships',label:'Scholarships'}].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${tab === t.id ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>{t.label}</button>
        ))}
      </div>
      {tab === 'universities' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {universities.map(u => (
            <div key={u.id} className="bg-white rounded-xl border border-slate-200 p-4 hover:border-blue-300 transition">
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-sm font-bold text-slate-800">{u.name}</h3>
                {(u.partner || u.partner === 'true') && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Partner</span>}
              </div>
              <p className="text-xs text-slate-500">{u.city}, {u.country}</p>
              <p className="text-xs text-slate-600 mt-1">{u.programs}</p>
              <p className="text-xs text-slate-500 mt-1">💰 {u.tuition}</p>
              {u.lang_req && <p className="text-xs text-slate-500 mt-0.5">📝 {u.lang_req}</p>}
            </div>
          ))}
          {universities.length === 0 && !loading && <p className="col-span-full text-center text-sm text-slate-400 py-12">Search to find universities</p>}
        </div>
      )}
      {tab === 'scholarships' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {scholarships.map(s => (
            <div key={s.id} className="bg-white rounded-xl border border-slate-200 p-4 hover:border-emerald-300 transition">
              <h3 className="text-sm font-bold text-slate-800">{s.name}</h3>
              <p className="text-xs text-slate-600 mt-1">{s.coverage}</p>
              <div className="flex items-center gap-2 mt-2">
                {s.deadline && <span className="text-[10px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded border border-amber-100">⏰ {s.deadline}</span>}
                {s.eligibility && <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-100">✅ {s.eligibility.slice(0, 40)}</span>}
              </div>
            </div>
          ))}
          {scholarships.length === 0 && !loading && <p className="col-span-full text-center text-sm text-slate-400 py-12">Search to find scholarships</p>}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   RESEARCH VIEW
   ═══════════════════════════════════════════════════════════ */
function ResearchView() {
  const [research, setResearch] = useState([]);
  const [hooks, setHooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    Promise.all([api.marketing.research().catch(() => []), api.marketing.hooks().catch(() => [])])
      .then(([r, h]) => { setResearch(r); setHooks(h); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="py-16 text-center text-slate-400 text-sm">Loading research…</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h2 className="text-sm font-bold text-slate-700 mb-3">Research Intelligence</h2>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {research.map(r => (
              <div key={r.id} className={`p-3 rounded-lg border text-xs ${r.urgency === 'critical' ? 'bg-rose-50 border-rose-100' : r.urgency === 'high' ? 'bg-amber-50 border-amber-100' : 'bg-blue-50 border-blue-100'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold">{r.topic}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${r.urgency === 'critical' ? 'bg-rose-200 text-rose-800' : 'bg-slate-200 text-slate-700'}`}>{r.urgency}</span>
                </div>
                <p className="text-slate-600">{r.insight_summary}</p>
              </div>
            ))}
            {research.length === 0 && <p className="text-sm text-slate-400 text-center py-8">No research data</p>}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h2 className="text-sm font-bold text-slate-700 mb-3">Top Performing Hooks</h2>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {hooks.slice(0, 20).map(h => (
              <div key={h.id} className="p-3 rounded-lg border border-slate-100 hover:border-blue-200 transition">
                <p className="text-xs font-medium text-slate-800">{h.hook_text}</p>
                <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400">
                  <span className="bg-blue-50 text-blue-700 px-1 rounded">{h.hook_type}</span>
                  <span>{h.destination}</span>
                  <span>Conv: {h.conversion_rate ? (h.conversion_rate * 100).toFixed(1) + '%' : '0%'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   PUBLISHING VIEW
   ═══════════════════════════════════════════════════════════ */
function PublishingView() {
  const [config, setConfig] = useState(null);
  const [duePosts, setDuePosts] = useState([]);
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const load = useCallback(() => {
    Promise.all([
      api.marketing.publishConfig(),
      api.marketing.postsDue(50),
      api.marketing.publishingQueueFull({ limit: 100 })
    ]).then(([cfg, posts, q]) => {
      setConfig(cfg); setDuePosts(posts); setQueue(q); setLoading(false);
    }).catch(e => { toast.error(e.message); setLoading(false); });
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="py-16 text-center text-slate-400 text-sm">Loading publishing…</div>;

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h2 className="text-sm font-bold text-slate-700 mb-3">Publishing Config</h2>
        <div className="flex gap-3 flex-wrap">
          <div className={`px-3 py-1.5 rounded-lg text-xs font-medium ${config?.n8n ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>n8n: {config?.n8n ? 'Connected' : 'Not Configured'}</div>
          <div className={`px-3 py-1.5 rounded-lg text-xs font-medium ${config?.facebook?.china ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>Facebook China: {config?.facebook?.china ? 'Ready' : 'Missing'}</div>
          <div className={`px-3 py-1.5 rounded-lg text-xs font-medium ${config?.facebook?.bd ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>Facebook BD: {config?.facebook?.bd ? 'Ready' : 'Missing'}</div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h2 className="text-sm font-bold text-slate-700 mb-3">Approved Posts ({duePosts.length})</h2>
        {duePosts.length === 0 ? <p className="text-sm text-slate-400">No approved posts waiting.</p> : (
          <div className="space-y-2">
            {duePosts.slice(0, 10).map(p => (
              <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 bg-slate-50">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">{p.title || p.hook || 'Untitled'}</p>
                  <p className="text-xs text-slate-400">{p.page} · {p.pillar} · Quality: {p.quality_score || '—'}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h2 className="text-sm font-bold text-slate-700 mb-3">Publishing Queue ({queue.length})</h2>
        {queue.length === 0 ? <p className="text-sm text-slate-400">No items in queue.</p> : (
          <div className="space-y-2">
            {queue.map(item => (
              <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg border border-slate-100">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-slate-700 truncate">{item.post_title || `Post #${item.post_id}`}</p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${item.status === 'published' ? 'bg-emerald-100 text-emerald-700' : item.status === 'failed' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>{item.status}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{item.platform} · {item.page}</p>
                  {item.error_message && <p className="text-xs text-rose-600 mt-1">⚠️ {item.error_message}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
