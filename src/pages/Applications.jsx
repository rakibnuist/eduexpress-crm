/* Applications — mirrors the EduExpress "File Updates" workbook.
   Lead Management ends at File Open; from there the Applications module owns
   the workflow: Documents → Ready → Submitted → Admitted → Visa Applied →
   Visa Approved → Departed → Arrived.
   Two views: Kanban (one column per stage) and Table (Excel-style row view).
   Side panel covers: Source (Agent/In-house), Referrer, Nationality, Passport,
   Intake, Degree, Major, Universities (multi-uni per applicant w/ status),
   Drive Link, Deposit, Visa & Departure dates, Notes, Documents checklist.
*/
import { useEffect, useState, useCallback, useMemo } from 'react';
import { api } from '../api';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/Confirm';
import {
  GraduationCap, RefreshCw, X, CheckCircle2, AlertTriangle, ExternalLink,
  CalendarClock, MapPin, Save, ArrowRight, FileText, ChevronRight, Plus, Trash2,
  LayoutGrid, Table as TableIcon, Filter, Building2, User, ChevronDown,
} from 'lucide-react';

const STAGE_COLORS = {
  documents:     { bg: 'bg-slate-50',  border: 'border-slate-200',  pill: 'bg-slate-200 text-slate-700' },
  ready:         { bg: 'bg-blue-50',   border: 'border-blue-200',   pill: 'bg-blue-200 text-blue-800' },
  submitted:     { bg: 'bg-violet-50', border: 'border-violet-200', pill: 'bg-violet-200 text-violet-800' },
  admitted:      { bg: 'bg-amber-50',  border: 'border-amber-200',  pill: 'bg-amber-200 text-amber-800' },
  visa_applied:  { bg: 'bg-orange-50', border: 'border-orange-200', pill: 'bg-orange-200 text-orange-800' },
  visa_approved: { bg: 'bg-teal-50',   border: 'border-teal-200',   pill: 'bg-teal-200 text-teal-800' },
  departed:      { bg: 'bg-emerald-50',border: 'border-emerald-200',pill: 'bg-emerald-200 text-emerald-800' },
  arrived:       { bg: 'bg-green-50',  border: 'border-green-200',  pill: 'bg-green-200 text-green-800' },
};

const DOC_STATUSES = [
  { key: 'pending',      label: 'Pending',      cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  { key: 'received',     label: 'Received',     cls: 'bg-blue-100 text-blue-700 border-blue-200' },
  { key: 'verified',     label: 'Verified',     cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { key: 'rejected',     label: 'Rejected',     cls: 'bg-rose-100 text-rose-700 border-rose-200' },
  { key: 'not_required', label: 'N/A',          cls: 'bg-slate-50 text-slate-400 border-slate-200' },
];

const UNI_STATUSES = [
  { key: 'documents', label: 'Documents', cls: 'bg-slate-100 text-slate-700' },
  { key: 'ready',     label: 'Ready',     cls: 'bg-blue-100 text-blue-700' },
  { key: 'submitted', label: 'Submitted', cls: 'bg-violet-100 text-violet-700' },
  { key: 'admitted',  label: 'Admitted',  cls: 'bg-emerald-100 text-emerald-700' },
  { key: 'returned',  label: 'Returned',  cls: 'bg-amber-100 text-amber-700' },
  { key: 'rejected',  label: 'Rejected',  cls: 'bg-rose-100 text-rose-700' },
];

const SOURCES = ['In-house', 'Agent'];
const DEGREES = ['Diploma', 'Bachelor', 'Masters', 'PhD', 'L+Bachelor', 'L+Diploma'];

export default function Applications({ user }) {
  const [stages, setStages]   = useState([]);
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [filterStage, setFilterStage]     = useState('all');
  const [filterDest, setFilterDest]       = useState('all');
  const [filterSource, setFilterSource]   = useState('all');
  const [filterReferrer, setFilterReferrer] = useState('all');
  const [view, setView] = useState(() => localStorage.getItem('app_view') || 'kanban');

  const load = useCallback(async () => {
    setLoading(true);
    try { const d = await api.applications(); setStages(d.stages); setRows(d.rows); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  useEffect(() => { localStorage.setItem('app_view', view); }, [view]);

  const filtered = useMemo(() => rows.filter(r => {
    if (filterStage    !== 'all' && (r.application_stage || 'documents') !== filterStage) return false;
    if (filterDest     !== 'all' && r.destination !== filterDest)     return false;
    if (filterSource   !== 'all' && r.source !== filterSource)        return false;
    if (filterReferrer !== 'all' && r.referrer !== filterReferrer)    return false;
    return true;
  }), [rows, filterStage, filterDest, filterSource, filterReferrer]);

  // Per-stage counts (across all rows, not filtered, so the strip is stable)
  const stageCounts = useMemo(() => {
    const m = Object.fromEntries(stages.map(s => [s.key, 0]));
    rows.forEach(r => {
      const k = stages.some(s => s.key === r.application_stage) ? r.application_stage : 'documents';
      m[k] = (m[k] || 0) + 1;
    });
    return m;
  }, [rows, stages]);

  const destinations = useMemo(() => unique(rows.map(r => r.destination)), [rows]);
  const referrers    = useMemo(() => unique(rows.map(r => r.referrer)), [rows]);

  // Stats by source (Agent vs In-house) — matches the Excel's "Remark" column
  const sourceSplit = useMemo(() => {
    const m = { 'In-house': 0, 'Agent': 0, 'Unknown': 0 };
    filtered.forEach(r => {
      if (r.source === 'In-house') m['In-house']++;
      else if (r.source === 'Agent') m['Agent']++;
      else m['Unknown']++;
    });
    return m;
  }, [filtered]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <GraduationCap size={22} className="text-blue-600" /> Application Pipeline
          </h2>
          <p className="text-sm text-slate-500">
            {filtered.length} active{rows.length !== filtered.length ? ` of ${rows.length}` : ''} ·
            <strong className="text-emerald-600 ml-1">{sourceSplit['In-house']}</strong> in-house ·
            <strong className="text-violet-600 ml-1">{sourceSplit['Agent']}</strong> agent
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* View toggle */}
          <div className="flex gap-0.5 bg-slate-100 p-0.5 rounded-lg">
            <button onClick={() => setView('kanban')}
              className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-md ${view === 'kanban' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              <LayoutGrid size={13} /> Kanban
            </button>
            <button onClick={() => setView('table')}
              className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-md ${view === 'table' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              <TableIcon size={13} /> Table
            </button>
          </div>
          {/* Filters */}
          <select value={filterSource} onChange={e => setFilterSource(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white">
            <option value="all">All sources</option>
            {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={filterDest} onChange={e => setFilterDest(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white">
            <option value="all">All destinations</option>
            {destinations.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <select value={filterReferrer} onChange={e => setFilterReferrer(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white max-w-[160px]">
            <option value="all">All referrers</option>
            {referrers.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <button onClick={load} disabled={loading}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
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
          {stages.map(s => {
            const n = stageCounts[s.key] || 0;
            const active = filterStage === s.key;
            const color = STAGE_COLORS[s.key] || STAGE_COLORS.documents;
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
        <KanbanView stages={stages} rows={filtered} onPick={setSelected} />
      ) : (
        <TableView rows={filtered} onPick={setSelected} stages={stages} />
      )}

      {selected && (
        <ApplicationPanel
          leadId={selected.id}
          stages={stages}
          referrers={referrers}
          onClose={() => setSelected(null)}
          onChanged={load}
        />
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
function KanbanView({ stages, rows, onPick }) {
  const byStage = useMemo(() => {
    const map = Object.fromEntries(stages.map(s => [s.key, []]));
    for (const r of rows) {
      const key = stages.some(s => s.key === r.application_stage) ? r.application_stage : 'documents';
      (map[key] ||= []).push(r);
    }
    return map;
  }, [rows, stages]);

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex gap-3 min-w-max">
        {stages.map(stage => {
          const items = byStage[stage.key] || [];
          const color = STAGE_COLORS[stage.key] || STAGE_COLORS.documents;
          return (
            <div key={stage.key} className={`w-72 flex-shrink-0 rounded-2xl border ${color.border} ${color.bg}`}>
              <div className="px-3 py-2.5 border-b border-white/60 flex items-center justify-between">
                <span className="font-semibold text-slate-700 text-sm">{stage.label}</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${color.pill}`}>{items.length}</span>
              </div>
              <div className="p-2 space-y-2 max-h-[640px] overflow-y-auto">
                {items.length === 0 ? (
                  <p className="text-xs text-slate-400 italic text-center py-4">empty</p>
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
  const isAgent = card.source === 'Agent';

  return (
    <button onClick={onClick} className="w-full text-left bg-white rounded-xl p-3 shadow-sm hover:shadow-md border border-slate-100 hover:border-blue-200 transition-all">
      <div className="flex items-start justify-between gap-2 mb-1">
        <p className="font-semibold text-slate-800 text-sm truncate flex-1">{card.client_name}</p>
        {visaSoon && <span title={`Visa deadline ${card.visa_deadline}`} className="text-rose-500 flex-shrink-0"><CalendarClock size={14} /></span>}
      </div>
      <p className="text-[11px] text-slate-400 truncate">{card.lead_id}</p>
      <div className="flex items-center gap-1.5 flex-wrap mt-1">
        {card.source && (
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isAgent ? 'bg-violet-100 text-violet-700' : 'bg-emerald-100 text-emerald-700'}`}>
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
function TableView({ rows, onPick, stages }) {
  const stageLabel = (key) => stages.find(s => s.key === key)?.label || '—';
  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr>
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
                <Td>{i + 1}</Td>
                <Td>{r.source && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full
                    ${r.source === 'Agent' ? 'bg-violet-100 text-violet-700' : 'bg-emerald-100 text-emerald-700'}`}>
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
                  ? <a href={r.drive_link} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
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
function ApplicationPanel({ leadId, stages, referrers, onClose, onChanged }) {
  const [lead, setLead]     = useState(null);
  const [docs, setDocs]     = useState([]);
  const [unis, setUnis]     = useState([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm]     = useState({});
  const toast = useToast();
  const confirm = useConfirm();

  const load = useCallback(async () => {
    const [l, d, u] = await Promise.all([
      api.getLead(leadId),
      api.documents(leadId),
      api.universityApps(leadId),
    ]);
    setLead(l); setDocs(d); setUnis(u);
    setForm({
      application_stage: l.application_stage || 'documents',
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
  }, [leadId]);

  useEffect(() => { load(); }, [load]);

  const updateField = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const saveAll = async () => {
    setSaving(true);
    try { await api.updateStage(leadId, form); await load(); onChanged?.(); toast.success('Saved'); }
    catch (e) { toast.error(e.message || 'Could not save'); }
    setSaving(false);
  };

  const advance = async () => {
    const idx = stages.findIndex(s => s.key === (form.application_stage || 'documents'));
    if (idx === -1 || idx >= stages.length - 1) return;
    const next = stages[idx + 1].key;
    setSaving(true);
    try { await api.updateStage(leadId, { stage: next }); await load(); onChanged?.();
          toast.success(`Advanced to ${stages[idx + 1].label}`); }
    catch (e) { toast.error(e.message || 'Could not advance'); }
    setSaving(false);
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
    try { await api.addUniversityApp(leadId, { university: name.trim(), status: 'documents' });
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

  const currentIdx = stages.findIndex(s => s.key === (form.application_stage || 'documents'));
  const received = docs.filter(d => ['received','verified'].includes(d.status)).length;

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
              <a href={form.drive_link} target="_blank" rel="noreferrer"
                className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200">
                <ExternalLink size={12} /> Drive folder
              </a>
            )}
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"><X size={18} /></button>
          </div>
        </div>

        {/* Stage strip */}
        <div className="px-6 py-5 border-b border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <p className="font-semibold text-slate-700 text-sm">Application Stage</p>
            {currentIdx < stages.length - 1 && (
              <button onClick={advance} disabled={saving}
                className="text-xs font-medium px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 flex items-center gap-1.5">
                Advance to {stages[currentIdx + 1].label} <ArrowRight size={13} />
              </button>
            )}
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2">
            {stages.map((s, i) => (
              <div key={s.key} className="flex items-center gap-1.5">
                <button onClick={() => updateField('application_stage', s.key)}
                  className={`text-xs whitespace-nowrap px-2.5 py-1.5 rounded-lg border transition-all
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
              options={['', ...SOURCES]} />
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
