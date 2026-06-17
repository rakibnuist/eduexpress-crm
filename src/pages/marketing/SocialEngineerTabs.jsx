import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api';
import { useToast } from '../../components/Toast';
import Modal from '../../components/Modal';
import {
  Brain, TrendingUp, Users, Zap, Target, Lightbulb, BookOpen, FlaskConical,
  Rocket, ArrowUpRight, Star, AlertTriangle, Check, X, Pencil, Trash2,
  Plus, RefreshCw, Eye, Heart, Globe, BarChart3, Hash, Megaphone, Sparkles
} from 'lucide-react';

const STATUS_CLS = {
  new: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  approved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  winner: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  tested: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  declined: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
  active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  critical: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
  high: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  normal: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  draft: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  planned: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  running: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  implemented: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  rejected: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
  testing: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
};

function Pill({ value }) {
  return <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CLS[value] || 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>{value || '—'}</span>;
}

// ── Research Engine Tab ───────────────────────────────────
export function ResearchEngineTab() {
  const toast = useToast();
  const [subTab, setSubTab] = useState('research');
  const [research, setResearch] = useState([]);
  const [viral, setViral] = useState([]);
  const [psychology, setPsychology] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.marketing.research(),
      api.marketing.viralTopics(),
      api.marketing.psychology(),
    ]).then(([r, v, p]) => {
      setResearch(r);
      setViral(v);
      setPsychology(p);
      setLoading(false);
    }).catch(e => { toast.error(e.message); setLoading(false); });
  }, [toast]);
  useEffect(() => { load(); }, [load]);

  const save = async (resource, data, id) => {
    try {
      if (id) await api.marketing[`update${resource}`](id, data);
      else await api.marketing[`create${resource}`](data);
      toast.success('Saved'); setModal(null); load();
    } catch (e) { toast.error(e.message); }
  };
  const del = async (resource, id) => {
    try { await api.marketing[`delete${resource}`](id); toast.success('Deleted'); load(); } catch (e) { toast.error(e.message); }
  };

  if (loading) return <div className="py-16 text-center text-slate-400 text-sm">Loading research engine…</div>;

  return (
    <div className="space-y-4">
      <div className="flex gap-1 mb-2">
        {[
          { id: 'research', label: 'Research Intelligence', icon: Brain },
          { id: 'viral', label: 'Viral Topics', icon: TrendingUp },
          { id: 'psychology', label: 'Psychology Profiles', icon: Users },
        ].map(t => (
          <button key={t.id} onClick={() => setSubTab(t.id)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium ${subTab === t.id ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300'}`}>
            <t.icon size={14} />{t.label}
          </button>
        ))}
      </div>

      {subTab === 'research' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700">
            <h3 className="font-semibold text-slate-700 dark:text-slate-200 text-sm flex items-center gap-2"><Brain size={15} />Research Intelligence ({research.length})</h3>
            <button onClick={() => setModal({ type: 'research', data: {} })} className="text-sm flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white"><Plus size={14} />Add</button>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {research.length === 0 ? <p className="py-8 text-center text-sm text-slate-400">No research findings yet. Add competitor moves, market gaps, and policy changes.</p>
              : research.slice(0, 50).map(r => (
                <div key={r.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition">
                  <div className="flex items-center gap-2 mb-1">
                    <Pill value={r.urgency || 'normal'} />
                    <Pill value={r.category || 'insight'} />
                    <span className="text-xs text-slate-400">{r.research_date?.slice(0, 10)}</span>
                    {r.competitor && <span className="text-xs text-rose-500 font-medium">vs {r.competitor}</span>}
                    <div className="flex-1" />
                    <button onClick={() => setModal({ type: 'research', data: r })} className="p-1 text-slate-400 hover:text-blue-600"><Pencil size={13} /></button>
                    <button onClick={() => del('Research', r.id)} className="p-1 text-slate-300 hover:text-rose-500"><Trash2 size={13} /></button>
                  </div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{r.topic}</p>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">{r.insight_summary}</p>
                  {r.recommended_angle && <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">💡 Angle: {r.recommended_angle}</p>}
                </div>
              ))}
          </div>
        </div>
      )}

      {subTab === 'viral' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700">
            <h3 className="font-semibold text-slate-700 dark:text-slate-200 text-sm flex items-center gap-2"><TrendingUp size={15} />Viral Topics ({viral.length})</h3>
            <button onClick={() => setModal({ type: 'viral', data: {} })} className="text-sm flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white"><Plus size={14} />Add</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3">
            {viral.length === 0 ? <p className="py-8 text-center text-sm text-slate-400 col-span-2">No viral topics detected. n8n research workflow will auto-populate this.</p>
              : viral.map(v => (
                <div key={v.id} className="border border-slate-100 dark:border-slate-700 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Pill value={v.platform || 'social'} />
                    <Pill value={v.status || 'new'} />
                    <span className="text-xs text-slate-400">Score: {v.relevance_score}/100</span>
                    <div className="flex-1" />
                    <button onClick={() => setModal({ type: 'viral', data: v })} className="p-1 text-slate-400 hover:text-blue-600"><Pencil size={13} /></button>
                    <button onClick={() => del('ViralTopic', v.id)} className="p-1 text-slate-300 hover:text-rose-500"><Trash2 size={13} /></button>
                  </div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{v.topic}</p>
                  {v.hashtag && <p className="text-xs text-blue-500 mt-0.5">{v.hashtag}</p>}
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">{v.why_viral}</p>
                  {v.recommended_hook && <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">🎯 Hook: {v.recommended_hook}</p>}
                </div>
              ))}
          </div>
        </div>
      )}

      {subTab === 'psychology' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-700 dark:text-slate-200 text-sm flex items-center gap-2"><Users size={15} />Audience Psychology Profiles</h3>
            <button onClick={() => setModal({ type: 'psychology', data: {} })} className="text-sm flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white"><Plus size={14} />Add Profile</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {psychology.length === 0 ? <p className="py-8 text-center text-sm text-slate-400 col-span-2">No psychology profiles yet. Add student and parent personas.</p>
              : psychology.map(p => (
                <div key={p.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{p.segment}</span>
                    <div className="flex gap-1">
                      <button onClick={() => setModal({ type: 'psychology', data: p })} className="p-1 text-slate-400 hover:text-blue-600"><Pencil size={13} /></button>
                      <button onClick={() => del('Psychology', p.id)} className="p-1 text-slate-300 hover:text-rose-500"><Trash2 size={13} /></button>
                    </div>
                  </div>
                  <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
                    {p.pain_points && <div><span className="font-semibold text-rose-500">Pain Points:</span> {p.pain_points}</div>}
                    {p.aspirations && <div><span className="font-semibold text-emerald-500">Aspirations:</span> {p.aspirations}</div>}
                    {p.fears && <div><span className="font-semibold text-amber-500">Fears:</span> {p.fears}</div>}
                    {p.decision_factors && <div><span className="font-semibold text-blue-500">Decision Factors:</span> {p.decision_factors}</div>}
                    {p.content_preferences && <div><span className="font-semibold text-violet-500">Content Pref:</span> {p.content_preferences}</div>}
                    {p.voice_tone && <div><span className="font-semibold text-indigo-500">Voice:</span> {p.voice_tone}</div>}
                    {p.peak_hours && <div><span className="font-semibold text-slate-500">Peak Hours:</span> {p.peak_hours}</div>}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {modal && <ResearchModal modal={modal} onClose={() => setModal(null)} onSave={(d) => save(modal.type === 'research' ? 'Research' : modal.type === 'viral' ? 'ViralTopic' : 'Psychology', d, modal.data?.id)} />}
    </div>
  );
}

function ResearchModal({ modal, onClose, onSave }) {
  const type = modal.type;
  const data = modal.data || {};
  const [f, setF] = useState(data);
  const set = (k, v) => setF(s => ({ ...s, [k]: v }));

  const fields = type === 'research' ? [
    { k: 'topic', l: 'Topic', long: true },
    { k: 'category', l: 'Category', opts: ['competitor_move','market_gap','viral_signal','policy_change','psych_insight'] },
    { k: 'urgency', l: 'Urgency', opts: ['critical','high','normal','low'] },
    { k: 'competitor', l: 'Competitor' },
    { k: 'source_url', l: 'Source URL' },
    { k: 'source_type', l: 'Source Type', opts: ['meta_ad_library','fb_scrape','competitor_page','news','gov_notice','trend_platform'] },
    { k: 'insight_summary', l: 'Insight Summary', long: true },
    { k: 'recommended_angle', l: 'Recommended Angle', long: true },
    { k: 'evidence', l: 'Evidence (JSON)', long: true },
  ] : type === 'viral' ? [
    { k: 'topic', l: 'Topic' },
    { k: 'platform', l: 'Platform', opts: ['facebook','instagram','tiktok','youtube','twitter'] },
    { k: 'hashtag', l: 'Hashtag' },
    { k: 'relevance_score', l: 'Relevance Score (0-100)', num: true },
    { k: 'engagement_velocity', l: 'Engagement Velocity', num: true },
    { k: 'reach_estimate', l: 'Reach Estimate', num: true },
    { k: 'sentiment', l: 'Sentiment', opts: ['positive','neutral','negative','mixed'] },
    { k: 'why_viral', l: 'Why Viral?', long: true },
    { k: 'recommended_hook', l: 'Recommended Hook' },
    { k: 'recommended_cta', l: 'Recommended CTA' },
    { k: 'status', l: 'Status', opts: ['new','approved','used','declined'] },
  ] : [
    { k: 'segment', l: 'Segment' },
    { k: 'pain_points', l: 'Pain Points', long: true },
    { k: 'aspirations', l: 'Aspirations', long: true },
    { k: 'fears', l: 'Fears', long: true },
    { k: 'trusted_sources', l: 'Trusted Sources', long: true },
    { k: 'decision_factors', l: 'Decision Factors', long: true },
    { k: 'content_preferences', l: 'Content Preferences', long: true },
    { k: 'peak_hours', l: 'Peak Hours' },
    { k: 'language_preference', l: 'Language', opts: ['bangla','english','banglish'] },
    { k: 'voice_tone', l: 'Voice Tone', opts: ['empathetic_brother','expert_consultant','success_story','peer_friend'] },
  ];

  return (
    <Modal title={`${data.id ? 'Edit' : 'Add'} ${type === 'research' ? 'Research' : type === 'viral' ? 'Viral Topic' : 'Psychology Profile'}`} onClose={onClose} wide>
      <div className="grid grid-cols-2 gap-3">
        {fields.map(field => (
          <div key={field.k} className={field.long ? 'col-span-2' : ''}>
            <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">{field.l}</label>
            {field.opts
              ? <select className="inp dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200" value={f[field.k] || ''} onChange={e => set(field.k, e.target.value)}>
                  <option value="">Select…</option>
                  {field.opts.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              : field.long
                ? <textarea rows={3} className="inp dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200" value={f[field.k] || ''} onChange={e => set(field.k, e.target.value)} />
                : <input type={field.num ? 'number' : 'text'} className="inp dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200" value={f[field.k] || ''} onChange={e => set(field.k, e.target.value)} />
            }
          </div>
        ))}
      </div>
      <div className="flex justify-end gap-2 pt-4">
        <button onClick={onClose} className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300">Cancel</button>
        <button onClick={() => onSave(f)} className="px-3 py-1.5 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium">Save</button>
      </div>
    </Modal>
  );
}

// ── Scripts Tab ───────────────────────────────────────────
export function ScriptsTab() {
  const toast = useToast();
  const [subTab, setSubTab] = useState('scripts');
  const [scripts, setScripts] = useState([]);
  const [hooks, setHooks] = useState([]);
  const [guidelines, setGuidelines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.marketing.scripts(),
      api.marketing.hooks(),
      api.marketing.creativeGuidelines(),
    ]).then(([s, h, g]) => {
      setScripts(s);
      setHooks(h);
      setGuidelines(g);
      setLoading(false);
    }).catch(e => { toast.error(e.message); setLoading(false); });
  }, [toast]);
  useEffect(() => { load(); }, [load]);

  const save = async (resource, data, id) => {
    try {
      if (id) await api.marketing[`update${resource}`](id, data);
      else await api.marketing[`create${resource}`](data);
      toast.success('Saved'); setModal(null); load();
    } catch (e) { toast.error(e.message); }
  };
  const del = async (resource, id) => {
    try { await api.marketing[`delete${resource}`](id); toast.success('Deleted'); load(); } catch (e) { toast.error(e.message); }
  };

  if (loading) return <div className="py-16 text-center text-slate-400 text-sm">Loading scripts engine…</div>;

  return (
    <div className="space-y-4">
      <div className="flex gap-1 mb-2">
        {[
          { id: 'scripts', label: 'Scripts Library', icon: BookOpen },
          { id: 'hooks', label: 'Hook Library', icon: Zap },
          { id: 'guidelines', label: 'Creative Guidelines', icon: Lightbulb },
        ].map(t => (
          <button key={t.id} onClick={() => setSubTab(t.id)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium ${subTab === t.id ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300'}`}>
            <t.icon size={14} />{t.label}
          </button>
        ))}
      </div>

      {subTab === 'scripts' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700">
            <h3 className="font-semibold text-slate-700 dark:text-slate-200 text-sm flex items-center gap-2"><BookOpen size={15} />Scripts Library ({scripts.length})</h3>
            <button onClick={() => setModal({ type: 'script', data: {} })} className="text-sm flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white"><Plus size={14} />Add Script</button>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {scripts.length === 0 ? <p className="py-8 text-center text-sm text-slate-400">No scripts yet. Add video scripts, carousel copy, ad copy, and DM scripts.</p>
              : scripts.slice(0, 50).map(s => (
                <div key={s.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition">
                  <div className="flex items-center gap-2 mb-1">
                    <Pill value={s.category || 'script'} />
                    <Pill value={s.status || 'draft'} />
                    <span className="text-xs text-slate-400">{s.destination} · {s.format}</span>
                    <span className="text-xs text-slate-400">Score: {s.avg_score || 0} · Used: {s.usage_count || 0}</span>
                    <div className="flex-1" />
                    <button onClick={() => setModal({ type: 'script', data: s })} className="p-1 text-slate-400 hover:text-blue-600"><Pencil size={13} /></button>
                    <button onClick={() => del('Script', s.id)} className="p-1 text-slate-300 hover:text-rose-500"><Trash2 size={13} /></button>
                  </div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{s.script_name}</p>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 line-clamp-3">{s.body}</p>
                  {s.hook && <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">🎯 {s.hook}</p>}
                  {s.cta && <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">📢 {s.cta}</p>}
                </div>
              ))}
          </div>
        </div>
      )}

      {subTab === 'hooks' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700">
            <h3 className="font-semibold text-slate-700 dark:text-slate-200 text-sm flex items-center gap-2"><Zap size={15} />Hook Library ({hooks.length})</h3>
            <button onClick={() => setModal({ type: 'hook', data: {} })} className="text-sm flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white"><Plus size={14} />Add Hook</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3">
            {hooks.length === 0 ? <p className="py-8 text-center text-sm text-slate-400 col-span-2">No hooks yet. Add tested hooks with performance data.</p>
              : hooks.map(h => (
                <div key={h.id} className="border border-slate-100 dark:border-slate-700 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Pill value={h.hook_type || 'hook'} />
                    <Pill value={h.status || 'new'} />
                    <span className="text-xs text-slate-400">Conv: {h.conversion_rate ? (h.conversion_rate * 100).toFixed(1) + '%' : '0%'}</span>
                    <div className="flex-1" />
                    <button onClick={() => setModal({ type: 'hook', data: h })} className="p-1 text-slate-400 hover:text-blue-600"><Pencil size={13} /></button>
                    <button onClick={() => del('Hook', h.id)} className="p-1 text-slate-300 hover:text-rose-500"><Trash2 size={13} /></button>
                  </div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{h.hook_text}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                    <span className="flex items-center gap-1"><Eye size={11} /> {h.avg_reach || 0}</span>
                    <span className="flex items-center gap-1"><Heart size={11} /> {h.avg_engagement || 0}</span>
                    <span className="flex items-center gap-1"><Target size={11} /> {h.usage_count || 0} uses</span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {subTab === 'guidelines' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700">
            <h3 className="font-semibold text-slate-700 dark:text-slate-200 text-sm flex items-center gap-2"><Lightbulb size={15} />Creative Guidelines ({guidelines.length})</h3>
            <button onClick={() => setModal({ type: 'guideline', data: {} })} className="text-sm flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white"><Plus size={14} />Add</button>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {guidelines.length === 0 ? <p className="py-8 text-center text-sm text-slate-400">No guidelines yet. Add brand voice, color, typography, and format specs.</p>
              : guidelines.map(g => (
                <div key={g.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition">
                  <div className="flex items-center gap-2 mb-1">
                    <Pill value={g.category || 'guideline'} />
                    <Pill value={g.platform || 'all'} />
                    <div className="flex-1" />
                    <button onClick={() => setModal({ type: 'guideline', data: g })} className="p-1 text-slate-400 hover:text-blue-600"><Pencil size={13} /></button>
                    <button onClick={() => del('Guideline', g.id)} className="p-1 text-slate-300 hover:text-rose-500"><Trash2 size={13} /></button>
                  </div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{g.guideline_name}</p>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">{g.specification}</p>
                  {g.do_s && <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">✅ {g.do_s}</p>}
                  {g.dont_s && <p className="text-xs text-rose-500 dark:text-rose-400 mt-0.5">❌ {g.dont_s}</p>}
                </div>
              ))}
          </div>
        </div>
      )}

      {modal && <ScriptModal modal={modal} onClose={() => setModal(null)} onSave={(d) => {
        const resource = modal.type === 'script' ? 'Script' : modal.type === 'hook' ? 'Hook' : 'Guideline';
        save(resource, d, modal.data?.id);
      }} />}
    </div>
  );
}

function ScriptModal({ modal, onClose, onSave }) {
  const type = modal.type;
  const data = modal.data || {};
  const [f, setF] = useState(data);
  const set = (k, v) => setF(s => ({ ...s, [k]: v }));

  const fields = type === 'script' ? [
    { k: 'script_name', l: 'Script Name' },
    { k: 'category', l: 'Category', opts: ['hook','video_script','carousel_copy','story','ad_copy','dm_script'] },
    { k: 'destination', l: 'Destination' },
    { k: 'pillar', l: 'Pillar' },
    { k: 'format', l: 'Format', opts: ['Reel','Carousel','Single image','Story','TikTok','Live'] },
    { k: 'hook', l: 'Hook' },
    { k: 'body', l: 'Body / Script', long: true },
    { k: 'cta', l: 'CTA' },
    { k: 'duration_seconds', l: 'Duration (sec)', num: true },
    { k: 'shot_list', l: 'Shot List', long: true },
    { k: 'on_screen_text', l: 'On-Screen Text', long: true },
    { k: 'psychology_notes', l: 'Psychology Notes', long: true },
    { k: 'status', l: 'Status', opts: ['draft','approved','archived','winner'] },
  ] : type === 'hook' ? [
    { k: 'hook_text', l: 'Hook Text', long: true },
    { k: 'hook_type', l: 'Hook Type', opts: ['pain_point','curiosity','number','myth_bust','urgency','story','challenge','social_proof'] },
    { k: 'destination', l: 'Destination' },
    { k: 'pillar', l: 'Pillar' },
    { k: 'format', l: 'Format' },
    { k: 'psychology_target', l: 'Psychology Target' },
    { k: 'usage_count', l: 'Usage Count', num: true },
    { k: 'avg_reach', l: 'Avg Reach', num: true },
    { k: 'avg_engagement', l: 'Avg Engagement', num: true },
    { k: 'conversion_rate', l: 'Conversion Rate', num: true },
    { k: 'status', l: 'Status', opts: ['new','winner','tested','declined'] },
  ] : [
    { k: 'guideline_name', l: 'Guideline Name' },
    { k: 'category', l: 'Category', opts: ['color','typography','imagery','tone','format_spec','brand_voice'] },
    { k: 'platform', l: 'Platform', opts: ['facebook','instagram','tiktok','all'] },
    { k: 'specification', l: 'Specification', long: true },
    { k: 'examples', l: 'Examples', long: true },
    { k: 'do_s', l: "Do's", long: true },
    { k: 'dont_s', l: "Don'ts", long: true },
  ];

  return (
    <Modal title={`${data.id ? 'Edit' : 'Add'} ${type === 'script' ? 'Script' : type === 'hook' ? 'Hook' : 'Guideline'}`} onClose={onClose} wide>
      <div className="grid grid-cols-2 gap-3">
        {fields.map(field => (
          <div key={field.k} className={field.long ? 'col-span-2' : ''}>
            <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">{field.l}</label>
            {field.opts
              ? <select className="inp dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200" value={f[field.k] || ''} onChange={e => set(field.k, e.target.value)}>
                  <option value="">Select…</option>
                  {field.opts.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              : field.long
                ? <textarea rows={3} className="inp dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200" value={f[field.k] || ''} onChange={e => set(field.k, e.target.value)} />
                : <input type={field.num ? 'number' : 'text'} className="inp dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200" value={f[field.k] || ''} onChange={e => set(field.k, e.target.value)} />
            }
          </div>
        ))}
      </div>
      <div className="flex justify-end gap-2 pt-4">
        <button onClick={onClose} className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300">Cancel</button>
        <button onClick={() => onSave(f)} className="px-3 py-1.5 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium">Save</button>
      </div>
    </Modal>
  );
}

// ── A/B Tests Tab ─────────────────────────────────────────
export function AbTestsTab() {
  const toast = useToast();
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    api.marketing.abTests().then(d => { setTests(d); setLoading(false); })
      .catch(e => { toast.error(e.message); setLoading(false); });
  }, [toast]);
  useEffect(() => { load(); }, [load]);

  const save = async (data, id) => {
    try {
      if (id) await api.marketing.updateAbTest(id, data);
      else await api.marketing.createAbTest(data);
      toast.success('Saved'); setModal(null); load();
    } catch (e) { toast.error(e.message); }
  };
  const del = async (id) => {
    try { await api.marketing.deleteAbTest(id); toast.success('Deleted'); load(); } catch (e) { toast.error(e.message); }
  };

  if (loading) return <div className="py-16 text-center text-slate-400 text-sm">Loading A/B tests…</div>;

  const byStatus = { planned: 0, running: 0, completed: 0, cancelled: 0 };
  tests.forEach(t => { byStatus[t.status] = (byStatus[t.status] || 0) + 1; });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <p className="text-xs text-slate-400">Total Tests</p>
          <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{tests.length}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <p className="text-xs text-slate-400">Running</p>
          <p className="text-2xl font-bold text-blue-600">{byStatus.running || 0}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <p className="text-xs text-slate-400">Completed</p>
          <p className="text-2xl font-bold text-emerald-600">{byStatus.completed || 0}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <p className="text-xs text-slate-400">Winners</p>
          <p className="text-2xl font-bold text-violet-600">{tests.filter(t => t.winner).length}</p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400 font-medium">{tests.length} test{tests.length !== 1 ? 's' : ''}</p>
        <button onClick={() => setModal({ data: {} })} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-xl text-xs font-bold shadow-sm transition-colors">
          <Plus size={14} /> New A/B Test
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {tests.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-10 text-center col-span-2">
            <FlaskConical size={28} className="text-slate-200 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-sm font-bold text-slate-600 dark:text-slate-300">No A/B tests yet</p>
            <p className="text-xs text-slate-400 mt-1">Test hooks, CTAs, images, and time slots to find what converts best.</p>
          </div>
        ) : tests.map(t => (
          <div key={t.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <Pill value={t.status} />
                  <span className="text-xs text-slate-400">{t.variable}</span>
                </div>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-1">{t.test_name}</p>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => setModal({ data: t })} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-400 hover:text-blue-600"><Pencil size={13} /></button>
                <button onClick={() => del(t.id)} className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg text-slate-400 hover:text-rose-600"><Trash2 size={13} /></button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-2 text-center">
                <p className="text-[10px] text-slate-400 font-medium uppercase">Variant A</p>
                <p className="text-xs font-bold text-slate-700 dark:text-slate-200 mt-0.5">{t.a_reach || 0} reach</p>
                <p className="text-[10px] text-slate-400">{t.a_engagement || 0} eng · {t.a_leads || 0} leads</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-2 text-center">
                <p className="text-[10px] text-slate-400 font-medium uppercase">Variant B</p>
                <p className="text-xs font-bold text-slate-700 dark:text-slate-200 mt-0.5">{t.b_reach || 0} reach</p>
                <p className="text-[10px] text-slate-400">{t.b_engagement || 0} eng · {t.b_leads || 0} leads</p>
              </div>
              <div className={`rounded-lg p-2 text-center ${t.winner === 'b' ? 'bg-emerald-50 dark:bg-emerald-900/20' : t.winner === 'a' ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-slate-50 dark:bg-slate-700/50'}`}>
                <p className="text-[10px] text-slate-400 font-medium uppercase">Winner</p>
                <p className="text-xs font-bold text-slate-700 dark:text-slate-200 mt-0.5">{t.winner || 'TBD'}</p>
                <p className="text-[10px] text-slate-400">{t.winner_confidence ? t.winner_confidence + '%' : '—'} conf</p>
              </div>
            </div>

            {t.insights && <p className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-700/30 rounded-lg p-2">💡 {t.insights}</p>}
          </div>
        ))}
      </div>

      {modal && <AbTestModal data={modal.data} onClose={() => setModal(null)} onSave={(d) => save(d, modal.data?.id)} />}
    </div>
  );
}

function AbTestModal({ data, onClose, onSave }) {
  const [f, setF] = useState(data || {});
  const set = (k, v) => setF(s => ({ ...s, [k]: v }));
  const fields = [
    { k: 'test_name', l: 'Test Name' },
    { k: 'variable', l: 'Variable', opts: ['hook','body','cta','image','time_slot','hashtag_set'] },
    { k: 'variant_a', l: 'Variant A (Control)', long: true },
    { k: 'variant_b', l: 'Variant B (Test)', long: true },
    { k: 'variant_c', l: 'Variant C (Optional)', long: true },
    { k: 'page', l: 'Page', opts: ['china','bd','instagram','tiktok'] },
    { k: 'start_date', l: 'Start Date' },
    { k: 'end_date', l: 'End Date' },
    { k: 'status', l: 'Status', opts: ['planned','running','completed','cancelled'] },
    { k: 'a_reach', l: 'A Reach', num: true },
    { k: 'a_engagement', l: 'A Engagement', num: true },
    { k: 'a_leads', l: 'A Leads', num: true },
    { k: 'b_reach', l: 'B Reach', num: true },
    { k: 'b_engagement', l: 'B Engagement', num: true },
    { k: 'b_leads', l: 'B Leads', num: true },
    { k: 'c_reach', l: 'C Reach', num: true },
    { k: 'c_engagement', l: 'C Engagement', num: true },
    { k: 'c_leads', l: 'C Leads', num: true },
    { k: 'winner', l: 'Winner', opts: ['','a','b','c','inconclusive'] },
    { k: 'winner_confidence', l: 'Confidence %', num: true },
    { k: 'insights', l: 'Insights', long: true },
  ];
  return (
    <Modal title={`${data.id ? 'Edit' : 'New'} A/B Test`} onClose={onClose} wide>
      <div className="grid grid-cols-2 gap-3">
        {fields.map(field => (
          <div key={field.k} className={field.long ? 'col-span-2' : ''}>
            <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">{field.l}</label>
            {field.opts
              ? <select className="inp dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200" value={f[field.k] || ''} onChange={e => set(field.k, e.target.value)}>
                  {field.opts.map(o => <option key={o} value={o}>{o || '—'}</option>)}
                </select>
              : field.long
                ? <textarea rows={2} className="inp dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200" value={f[field.k] || ''} onChange={e => set(field.k, e.target.value)} />
                : <input type={field.num ? 'number' : 'text'} className="inp dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200" value={f[field.k] || ''} onChange={e => set(field.k, e.target.value)} />
            }
          </div>
        ))}
      </div>
      <div className="flex justify-end gap-2 pt-4">
        <button onClick={onClose} className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300">Cancel</button>
        <button onClick={() => onSave(f)} className="px-3 py-1.5 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium">Save</button>
      </div>
    </Modal>
  );
}

// ── Scale Up Tab ──────────────────────────────────────────
export function ScaleUpTab() {
  const toast = useToast();
  const [subTab, setSubTab] = useState('recommendations');
  const [recommendations, setRecommendations] = useState([]);
  const [signals, setSignals] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.marketing.scaleUp(),
      api.marketing.analyticsScaleUpSignals(30),
    ]).then(([r, s]) => {
      setRecommendations(r);
      setSignals(s);
      setLoading(false);
    }).catch(e => { toast.error(e.message); setLoading(false); });
  }, [toast]);
  useEffect(() => { load(); }, [load]);

  const save = async (data, id) => {
    try {
      if (id) await api.marketing.updateScaleUp(id, data);
      else await api.marketing.createScaleUp(data);
      toast.success('Saved'); setModal(null); load();
    } catch (e) { toast.error(e.message); }
  };
  const del = async (id) => {
    try { await api.marketing.deleteScaleUp(id); toast.success('Deleted'); load(); } catch (e) { toast.error(e.message); }
  };
  const approve = async (id) => {
    try { await api.marketing.updateScaleUp(id, { status: 'approved', approved_by: 'admin' }); toast.success('Approved'); load(); } catch (e) { toast.error(e.message); }
  };

  if (loading) return <div className="py-16 text-center text-slate-400 text-sm">Loading scale-up intelligence…</div>;

  const byStatus = {};
  recommendations.forEach(r => { byStatus[r.status] = (byStatus[r.status] || 0) + 1; });

  return (
    <div className="space-y-4">
      <div className="flex gap-1 mb-2">
        {[
          { id: 'recommendations', label: 'Recommendations', icon: Rocket },
          { id: 'signals', label: 'Performance Signals', icon: BarChart3 },
        ].map(t => (
          <button key={t.id} onClick={() => setSubTab(t.id)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium ${subTab === t.id ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300'}`}>
            <t.icon size={14} />{t.label}
          </button>
        ))}
      </div>

      {subTab === 'recommendations' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
              <p className="text-xs text-slate-400">Total</p>
              <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{recommendations.length}</p>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
              <p className="text-xs text-slate-400">Pending</p>
              <p className="text-2xl font-bold text-amber-600">{byStatus.pending || 0}</p>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
              <p className="text-xs text-slate-400">Approved</p>
              <p className="text-2xl font-bold text-emerald-600">{byStatus.approved || 0}</p>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
              <p className="text-xs text-slate-400">Implemented</p>
              <p className="text-2xl font-bold text-violet-600">{byStatus.implemented || 0}</p>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400 font-medium">{recommendations.length} recommendation{recommendations.length !== 1 ? 's' : ''}</p>
            <button onClick={() => setModal({ data: {} })} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-xl text-xs font-bold shadow-sm transition-colors">
              <Plus size={14} /> Add Recommendation
            </button>
          </div>

          <div className="space-y-3">
            {recommendations.length === 0 ? (
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-10 text-center">
                <Rocket size={28} className="text-slate-200 dark:text-slate-600 mx-auto mb-3" />
                <p className="text-sm font-bold text-slate-600 dark:text-slate-300">No recommendations yet</p>
                <p className="text-xs text-slate-400 mt-1">n8n will auto-generate scale-up recommendations based on performance data. Or add your own.</p>
              </div>
            ) : recommendations.map(r => (
              <div key={r.id} className={`bg-white dark:bg-slate-800 rounded-xl border ${r.status === 'pending' ? 'border-amber-200 dark:border-amber-800' : r.status === 'approved' ? 'border-emerald-200 dark:border-emerald-800' : 'border-slate-200 dark:border-slate-700'} p-4`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Pill value={r.status} />
                      <Pill value={r.recommendation_type} />
                      <span className="text-xs text-slate-400">Confidence: {r.confidence_score || 0}%</span>
                      <span className="text-xs text-slate-400">Impact: {r.expected_impact || '—'}</span>
                    </div>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{r.title}</p>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">{r.description}</p>
                    {r.expected_lead_lift && <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">📈 Expected lead lift: +{r.expected_lead_lift}%</p>}
                    {r.action_items && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">📝 {r.action_items}</p>}
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    {r.status === 'pending' && (
                      <button onClick={() => approve(r.id)} className="px-2 py-1 text-xs rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium">Approve</button>
                    )}
                    <button onClick={() => setModal({ data: r })} className="p-1 text-slate-400 hover:text-blue-600"><Pencil size={13} /></button>
                    <button onClick={() => del(r.id)} className="p-1 text-slate-300 hover:text-rose-500"><Trash2 size={13} /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {subTab === 'signals' && signals && (
        <div className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2"><Hash size={15} />Top Pillars (30d)</h3>
              <div className="space-y-2">
                {signals.pillars?.map((p, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-24 text-xs text-slate-500 dark:text-slate-400 truncate">{p.pillar || '—'}</div>
                    <div className="flex-1 relative h-5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div className="absolute inset-y-0 left-0 rounded-full bg-blue-500" style={{ width: `${Math.min(100, (p.avg_engagement / Math.max(1, (signals.pillars[0]?.avg_engagement || 1))) * 100)}%` }} />
                    </div>
                    <div className="w-16 text-xs text-right font-bold text-slate-700 dark:text-slate-200">{Math.round(p.avg_engagement)}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2"><Globe size={15} />Top Pages (30d)</h3>
              <div className="space-y-2">
                {signals.pages?.map((p, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-24 text-xs text-slate-500 dark:text-slate-400 truncate">{p.page || '—'}</div>
                    <div className="flex-1 relative h-5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div className="absolute inset-y-0 left-0 rounded-full bg-emerald-500" style={{ width: `${Math.min(100, (p.avg_engagement / Math.max(1, (signals.pages[0]?.avg_engagement || 1))) * 100)}%` }} />
                    </div>
                    <div className="w-16 text-xs text-right font-bold text-slate-700 dark:text-slate-200">{Math.round(p.avg_engagement)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2"><Zap size={15} />Top Hook Types (30d)</h3>
              <div className="space-y-2">
                {signals.topHooks?.map((h, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-24 text-xs text-slate-500 dark:text-slate-400 truncate">{h.hook_type || '—'}</div>
                    <div className="flex-1 relative h-5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div className="absolute inset-y-0 left-0 rounded-full bg-violet-500" style={{ width: `${Math.min(100, (h.avg_reach / Math.max(1, (signals.topHooks[0]?.avg_reach || 1))) * 100)}%` }} />
                    </div>
                    <div className="w-16 text-xs text-right font-bold text-slate-700 dark:text-slate-200">{Math.round(h.avg_reach)}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2"><Target size={15} />Campaign Efficiency (30d)</h3>
              <div className="space-y-2">
                {signals.campaigns?.map((c, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="text-slate-600 dark:text-slate-300 truncate max-w-[200px]">{c.name || '—'}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-700 dark:text-slate-200">${c.total_spend || 0}</span>
                      <span className="text-emerald-600 font-medium">{c.total_leads || 0} leads</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {modal && <ScaleUpModal data={modal.data} onClose={() => setModal(null)} onSave={(d) => save(d, modal.data?.id)} />}
    </div>
  );
}

function ScaleUpModal({ data, onClose, onSave }) {
  const [f, setF] = useState(data || {});
  const set = (k, v) => setF(s => ({ ...s, [k]: v }));
  const fields = [
    { k: 'recommendation_type', l: 'Type', opts: ['content_pillar','platform','hook_style','time_slot','campaign','budget','destination','format'] },
    { k: 'title', l: 'Title' },
    { k: 'description', l: 'Description', long: true },
    { k: 'expected_impact', l: 'Expected Impact', opts: ['high','medium','low'] },
    { k: 'expected_lead_lift', l: 'Expected Lead Lift %', num: true },
    { k: 'confidence_score', l: 'Confidence Score (0-100)', num: true },
    { k: 'based_on_data', l: 'Based on Data (JSON)', long: true },
    { k: 'action_items', l: 'Action Items', long: true },
    { k: 'status', l: 'Status', opts: ['pending','approved','implemented','rejected','testing'] },
  ];
  return (
    <Modal title={`${data.id ? 'Edit' : 'Add'} Recommendation`} onClose={onClose} wide>
      <div className="grid grid-cols-2 gap-3">
        {fields.map(field => (
          <div key={field.k} className={field.long ? 'col-span-2' : ''}>
            <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">{field.l}</label>
            {field.opts
              ? <select className="inp dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200" value={f[field.k] || ''} onChange={e => set(field.k, e.target.value)}>
                  <option value="">Select…</option>
                  {field.opts.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              : field.long
                ? <textarea rows={3} className="inp dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200" value={f[field.k] || ''} onChange={e => set(field.k, e.target.value)} />
                : <input type={field.num ? 'number' : 'text'} className="inp dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200" value={f[field.k] || ''} onChange={e => set(field.k, e.target.value)} />
            }
          </div>
        ))}
      </div>
      <div className="flex justify-end gap-2 pt-4">
        <button onClick={onClose} className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300">Cancel</button>
        <button onClick={() => onSave(f)} className="px-3 py-1.5 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium">Save</button>
      </div>
    </Modal>
  );
}
