import { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '../api';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/Confirm';
import Modal from '../components/Modal';
import EmptyState from '../components/EmptyState';
import {
  CalendarDays, Database, Cpu, BarChart3, Check, X, Pencil, Trash2,
  Plus, RefreshCw, ThumbsUp, Megaphone,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid,
} from 'recharts';

// ── helpers (month + week-of-month, e.g. "July 1st Week, 2026") ──
const ORD = ['', '1st', '2nd', '3rd', '4th', '5th'];
function weekOfMonth(d = new Date()) { return Math.min(5, Math.ceil(d.getDate() / 7)); }
function curMonth(d = new Date()) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }
function weekKey(ym, w) { return `${ym}-W${w}`; }            // stored value, e.g. 2026-07-W1
function monthName(ym) { const [y, m] = ym.split('-'); return new Date(Number(y), Number(m) - 1, 1).toLocaleString('en-US', { month: 'long' }); }
function weekLabel(ym, w) { return `${monthName(ym)} ${ORD[w]} Week, ${ym.split('-')[0]}`; }
function monthOptions(n = 6, d = new Date()) {
  const out = [];
  for (let i = 0; i < n; i++) { const dt = new Date(d.getFullYear(), d.getMonth() + i, 1); out.push(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`); }
  return out;
}

const PAGE_BADGE = {
  china:     { label: 'China',     cls: 'bg-red-100 text-red-700' },
  bd:        { label: 'Bangladesh',cls: 'bg-green-100 text-green-700' },
  instagram: { label: 'Instagram', cls: 'bg-pink-100 text-pink-700' },
  tiktok:    { label: 'TikTok',    cls: 'bg-slate-200 text-slate-700' },
};
const STATUS_CLS = {
  drafted:     'bg-slate-100 text-slate-600',
  approved:    'bg-emerald-100 text-emerald-700',
  edit:        'bg-amber-100 text-amber-700',
  rejected:    'bg-rose-100 text-rose-700',
  asset_ready: 'bg-blue-100 text-blue-700',
  scheduled:   'bg-indigo-100 text-indigo-700',
  published:   'bg-green-100 text-green-800',
  active:      'bg-emerald-100 text-emerald-700',
  cooling:     'bg-amber-100 text-amber-700',
  exhausted:   'bg-rose-100 text-rose-700',
};
function Pill({ value }) {
  return <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CLS[value] || 'bg-slate-100 text-slate-600'}`}>{value || '—'}</span>;
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
  { id: 'calendar',  label: 'Calendar & Approvals', icon: CalendarDays },
  { id: 'data',      label: 'Data Center',          icon: Database },
  { id: 'brain',     label: 'Brain Pool',           icon: Cpu },
  { id: 'analytics', label: 'Analytics',            icon: BarChart3 },
];

export default function Marketing() {
  const [tab, setTab] = useState('calendar');
  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white"><Megaphone size={18} /></div>
        <div>
          <h1 className="text-lg font-bold text-slate-800">Marketing</h1>
          <p className="text-xs text-slate-400">Social automation control center — content, data, brain & analytics</p>
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
      {tab === 'data'      && <DataCenterTab />}
      {tab === 'brain'     && <BrainTab />}
      {tab === 'analytics' && <AnalyticsTab />}
    </div>
  );
}

// ── Calendar & Approvals ─────────────────────────────────
function CalendarTab() {
  const toast = useToast();
  const confirm = useConfirm();
  const [ym, setYm] = useState(curMonth());
  const [wom, setWom] = useState(weekOfMonth());
  const week = weekKey(ym, wom);
  const [pageFilter, setPageFilter] = useState('');
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);     // post being edited
  const [rejecting, setRejecting] = useState(null);  // post being rejected

  const load = useCallback(() => {
    setLoading(true);
    api.marketing.posts({ week, page: pageFilter })
      .then(setPosts).catch(e => toast.error(e.message)).finally(() => setLoading(false));
  }, [week, pageFilter, toast]);
  useEffect(() => { load(); }, [load]);

  const byDay = useMemo(() => {
    const m = {};
    for (const p of posts) (m[p.post_date] = m[p.post_date] || []).push(p);
    return Object.entries(m).sort(([a], [b]) => (a || '').localeCompare(b || ''));
  }, [posts]);

  const setStatus = async (p, status, rejection_reason) => {
    try {
      await api.marketing.setPostStatus(p.id, { status, rejection_reason });
      toast.success(`Post ${status}`);
      load();
    } catch (e) { toast.error(e.message); }
  };
  const approveWeek = async () => {
    if (!await confirm({ title: `Approve all of ${weekLabel(ym, wom)}?`, body: 'Approves every drafted/edited post for this week.', confirmLabel: 'Approve week' })) return;
    try { const r = await api.marketing.approveWeek(week); toast.success(`Approved ${r.approved} posts`); load(); }
    catch (e) { toast.error(e.message); }
  };
  const del = async (p) => {
    if (!await confirm({ title: 'Delete this post?', tone: 'danger', confirmLabel: 'Delete' })) return;
    try { await api.marketing.deletePost(p.id); toast.success('Deleted'); load(); } catch (e) { toast.error(e.message); }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <label className="text-xs text-slate-500">Week</label>
        <select value={ym} onChange={e => setYm(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-2.5 py-1.5">
          {monthOptions().map(m => <option key={m} value={m}>{monthName(m)} {m.split('-')[0]}</option>)}
        </select>
        <select value={wom} onChange={e => setWom(Number(e.target.value))}
          className="text-sm border border-slate-200 rounded-lg px-2.5 py-1.5">
          {[1, 2, 3, 4, 5].map(w => <option key={w} value={w}>{ORD[w]} Week</option>)}
        </select>
        <select value={pageFilter} onChange={e => setPageFilter(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-2.5 py-1.5">
          <option value="">All pages</option>
          <option value="china">China page</option>
          <option value="bd">Bangladesh page</option>
          <option value="instagram">Instagram</option>
          <option value="tiktok">TikTok</option>
        </select>
        <button onClick={load} className="text-sm flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"><RefreshCw size={13} />Refresh</button>
        <div className="flex-1" />
        <button onClick={approveWeek} className="text-sm flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium"><ThumbsUp size={14} />Approve week</button>
      </div>

      {loading ? <div className="py-16 text-center text-slate-400 text-sm">Loading…</div>
        : posts.length === 0 ? (
          <EmptyState icon={<CalendarDays size={24} />} title={`No posts for ${weekLabel(ym, wom)}`}
            hint="When n8n imports a weekly plan it appears here for approval. You can also add one manually." />
        ) : (
          <div className="space-y-5">
            {byDay.map(([date, items]) => (
              <div key={date}>
                <p className="text-xs font-semibold text-slate-500 mb-2">{date || 'Undated'}</p>
                <div className="grid gap-3 md:grid-cols-2">
                  {items.map(p => (
                    <div key={p.id} className="bg-white rounded-xl border border-slate-200 p-3.5">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        {PAGE_BADGE[p.page] && <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PAGE_BADGE[p.page].cls}`}>{PAGE_BADGE[p.page].label}</span>}
                        {p.pillar && <span className="text-xs text-slate-500">{p.pillar}</span>}
                        {p.format && <span className="text-xs text-slate-400">· {p.format}</span>}
                        {p.slot_time && <span className="text-xs text-slate-400">· {p.slot_time}</span>}
                        <div className="flex-1" />
                        <Pill value={p.status} />
                      </div>
                      {p.hook && <p className="font-semibold text-slate-800 text-sm">{p.hook}</p>}
                      {p.body && <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap line-clamp-4">{p.body}</p>}
                      {p.hashtags && <p className="text-xs text-blue-500 mt-1.5">{p.hashtags}</p>}
                      {p.brief && <p className="text-xs text-slate-400 mt-1.5 italic">Brief: {p.brief}</p>}
                      {p.rejection_reason && <p className="text-xs text-rose-500 mt-1.5">Rejected: {p.rejection_reason}</p>}
                      <div className="flex items-center gap-1.5 mt-3 pt-2.5 border-t border-slate-100">
                        <button onClick={() => setStatus(p, 'approved')} title="Approve"
                          className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100"><Check size={13} />Approve</button>
                        <button onClick={() => setEditing(p)} title="Edit"
                          className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-slate-50 text-slate-600 hover:bg-slate-100"><Pencil size={13} />Edit</button>
                        <button onClick={() => setRejecting(p)} title="Reject"
                          className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100"><X size={13} />Reject</button>
                        <div className="flex-1" />
                        <button onClick={() => del(p)} title="Delete" className="p-1 text-slate-300 hover:text-rose-500"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
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
  const [f, setF] = useState({ hook: post.hook || '', body: post.body || '', hashtags: post.hashtags || '', brief: post.brief || '', slot_time: post.slot_time || '', status: post.status || 'drafted' });
  const set = (k, v) => setF(s => ({ ...s, [k]: v }));
  const save = async () => {
    try { await api.marketing.updatePost(post.id, f); toast.success('Saved'); onSaved(); }
    catch (e) { toast.error(e.message); }
  };
  return (
    <Modal title="Edit post" onClose={onClose} wide>
      <div className="space-y-3">
        <Field label="Hook"><input className="inp" value={f.hook} onChange={e => set('hook', e.target.value)} /></Field>
        <Field label="Body"><textarea rows={6} className="inp" value={f.body} onChange={e => set('body', e.target.value)} /></Field>
        <Field label="Hashtags"><input className="inp" value={f.hashtags} onChange={e => set('hashtags', e.target.value)} /></Field>
        <Field label="Design/Video brief"><input className="inp" value={f.brief} onChange={e => set('brief', e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Time"><input className="inp" value={f.slot_time} onChange={e => set('slot_time', e.target.value)} /></Field>
          <Field label="Status">
            <select className="inp" value={f.status} onChange={e => set('status', e.target.value)}>
              {['drafted','approved','edit','rejected','asset_ready','scheduled','published'].map(s => <option key={s}>{s}</option>)}
            </select>
          </Field>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 text-slate-600">Cancel</button>
          <button onClick={save} className="px-3 py-1.5 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium">Save</button>
        </div>
      </div>
    </Modal>
  );
}

function RejectModal({ post, onClose, onReject }) {
  const [reason, setReason] = useState('');
  return (
    <Modal title="Reject & request a redraft" onClose={onClose}>
      <p className="text-sm text-slate-500 mb-2">Tell the engine what's wrong — it redrafts this post with your note.</p>
      <textarea rows={4} autoFocus className="inp" placeholder="e.g. too generic, wrong stipend figure, make it Bangla…"
        value={reason} onChange={e => setReason(e.target.value)} />
      <div className="flex justify-end gap-2 pt-3">
        <button onClick={onClose} className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 text-slate-600">Cancel</button>
        <button onClick={() => onReject(reason)} className="px-3 py-1.5 text-sm rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-medium">Reject</button>
      </div>
    </Modal>
  );
}

// ── Data Center ──────────────────────────────────────────
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
      <CrudTable key={res.id} resource={res.id} columns={res.cols} title={res.label} />
    </div>
  );
}

// ── Brain Pool ───────────────────────────────────────────
function BrainTab() {
  const cols = [
    { k: 'priority', l: 'Priority' }, { k: 'provider', l: 'Provider' }, { k: 'model', l: 'Model' },
    { k: 'cred_label', l: 'n8n credential' }, { k: 'req_min', l: 'Req/min' }, { k: 'req_day', l: 'Req/day' },
    { k: 'used_today', l: 'Used today' }, { k: 'status', l: 'Status' }, { k: 'cooldown_until', l: 'Cooldown until' }, { k: 'notes', l: 'Notes', long: true },
  ];
  return (
    <div>
      <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-xl px-3 py-2 mb-4">
        Secrets stay in n8n — this only holds the credential <b>label</b>, limits, and live rotation status. n8n updates “Used today”, “Status”, and “Cooldown” automatically.
      </div>
      <CrudTable resource="brain" columns={cols} title="Brain API Pool" statusKey="status" />
    </div>
  );
}

// ── Generic CRUD table ───────────────────────────────────
function CrudTable({ resource, columns, title, statusKey }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // row object or {} for new

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
        : rows.length === 0 ? <div className="py-12 text-center text-slate-400 text-sm">Nothing here yet. Click “Add” or let n8n / import populate it.</div>
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
                    {columns.map(c => (
                      <td key={c.k} className="px-3 py-2 align-top text-slate-700 max-w-[220px]">
                        {statusKey === c.k ? <Pill value={row[c.k]} />
                          : c.long ? <span className="line-clamp-2 text-xs text-slate-600">{row[c.k]}</span>
                          : <span className="whitespace-nowrap text-xs">{String(row[c.k] ?? '')}</span>}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <button onClick={() => setEditing(row)} className="p-1 text-slate-400 hover:text-blue-600"><Pencil size={14} /></button>
                      <button onClick={() => del(row)} className="p-1 text-slate-300 hover:text-rose-500"><Trash2 size={14} /></button>
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

// ── Analytics ────────────────────────────────────────────
function AnalyticsTab() {
  const toast = useToast();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.marketing.posts({}).then(setPosts).catch(e => toast.error(e.message)).finally(() => setLoading(false));
  }, [toast]);

  const stats = useMemo(() => {
    const total = posts.length;
    const published = posts.filter(p => p.status === 'published');
    const approved = posts.filter(p => p.status === 'approved').length;
    const drafted = posts.filter(p => p.status === 'drafted').length;
    const avgReach = published.length ? Math.round(published.reduce((s, p) => s + (p.reach || 0), 0) / published.length) : 0;
    const byPage = {};
    for (const p of posts) { byPage[p.page] = byPage[p.page] || { page: PAGE_BADGE[p.page]?.label || p.page || '—', reach: 0, engagement: 0, posts: 0 }; byPage[p.page].posts++; byPage[p.page].reach += p.reach || 0; byPage[p.page].engagement += p.engagement || 0; }
    const byPillar = {};
    for (const p of posts) { const k = p.pillar || '—'; byPillar[k] = (byPillar[k] || 0) + 1; }
    return {
      total, approved, drafted, publishedCount: published.length, avgReach,
      pageData: Object.values(byPage),
      pillarData: Object.entries(byPillar).map(([pillar, count]) => ({ pillar, count })),
    };
  }, [posts]);

  if (loading) return <div className="py-16 text-center text-slate-400 text-sm">Loading…</div>;
  if (!posts.length) return <EmptyState icon={<BarChart3 size={24} />} title="No data yet" hint="Analytics populate once posts are planned and published." />;

  const cards = [
    { label: 'Total posts', value: stats.total },
    { label: 'Awaiting approval', value: stats.drafted },
    { label: 'Approved', value: stats.approved },
    { label: 'Published', value: stats.publishedCount },
    { label: 'Avg reach', value: stats.avgReach.toLocaleString() },
  ];
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {cards.map(c => (
          <div key={c.label} className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-400">{c.label}</p>
            <p className="text-2xl font-bold text-slate-800 mt-1">{c.value}</p>
          </div>
        ))}
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Reach by page (published)</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={stats.pageData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
              <XAxis dataKey="page" tick={{ fontSize: 12 }} /><YAxis tick={{ fontSize: 12 }} /><Tooltip />
              <Bar dataKey="reach" radius={[6, 6, 0, 0]}>
                {stats.pageData.map((_, i) => <Cell key={i} fill={['#2563eb', '#16a34a', '#db2777', '#64748b'][i % 4]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Posts by pillar</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={stats.pillarData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
              <XAxis dataKey="pillar" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 12 }} allowDecimals={false} /><Tooltip />
              <Bar dataKey="count" fill="#6366f1" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
