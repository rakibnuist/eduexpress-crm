/* Applications — the post-enrolment student journey from Inquiry to Arrived.
   Kanban-style: each stage is a column with student cards. Click a card to open
   a side panel that shows stage details, key dates, and the document checklist.
   Admins see every active application; consultants see only their own. */
import { useEffect, useState, useCallback, useMemo } from 'react';
import { api } from '../api';
import {
  GraduationCap, RefreshCw, X, CheckCircle2, Clock, AlertTriangle,
  CalendarClock, MapPin, Save, ArrowRight, Plane, FileText, ChevronRight, Plus, Trash2,
} from 'lucide-react';

const STAGE_COLORS = {
  inquiry:       { bg: 'bg-slate-50',  border: 'border-slate-200',  pill: 'bg-slate-200 text-slate-700' },
  counselling:   { bg: 'bg-blue-50',   border: 'border-blue-200',   pill: 'bg-blue-200 text-blue-800' },
  documents:     { bg: 'bg-indigo-50', border: 'border-indigo-200', pill: 'bg-indigo-200 text-indigo-800' },
  application:   { bg: 'bg-violet-50', border: 'border-violet-200', pill: 'bg-violet-200 text-violet-800' },
  offer:         { bg: 'bg-amber-50',  border: 'border-amber-200',  pill: 'bg-amber-200 text-amber-800' },
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

export default function Applications({ user }) {
  const [stages, setStages] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [filterDest, setFilterDest] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api.applications();
      setStages(d.stages);
      setRows(d.rows);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Group rows by stage; leads with no stage land in 'inquiry'.
  const byStage = useMemo(() => {
    const map = Object.fromEntries(stages.map(s => [s.key, []]));
    for (const r of rows) {
      const key = r.application_stage || 'inquiry';
      if (!map[key]) map[key] = [];
      if (filterDest === 'all' || r.destination === filterDest) map[key].push(r);
    }
    return map;
  }, [rows, stages, filterDest]);

  const destinations = useMemo(() =>
    Array.from(new Set(rows.map(r => r.destination).filter(Boolean))).sort()
  , [rows]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <GraduationCap size={22} className="text-blue-600" /> Application Pipeline
          </h2>
          <p className="text-sm text-slate-500">
            {rows.length} active application{rows.length === 1 ? '' : 's'} · {destinations.length} destination{destinations.length === 1 ? '' : 's'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select value={filterDest} onChange={e => setFilterDest(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white">
            <option value="all">All destinations</option>
            {destinations.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <button onClick={load} disabled={loading}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {loading && rows.length === 0 ? (
        <div className="text-slate-400 text-center py-16">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
          <GraduationCap size={36} className="text-slate-300 mx-auto mb-3" />
          <p className="text-slate-600 font-semibold">No applications yet</p>
          <p className="text-xs text-slate-400 mt-1">
            Mark a lead as <strong>Enrolled</strong> or <strong>File Opened</strong> on the Leads page to start their application.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto pb-2">
          <div className="flex gap-3 min-w-max">
            {stages.map(stage => {
              const items = byStage[stage.key] || [];
              const color = STAGE_COLORS[stage.key] || STAGE_COLORS.inquiry;
              return (
                <div key={stage.key} className={`w-72 flex-shrink-0 rounded-2xl border ${color.border} ${color.bg}`}>
                  <div className="px-3 py-2.5 border-b border-white/60 flex items-center justify-between">
                    <span className="font-semibold text-slate-700 text-sm">{stage.label}</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${color.pill}`}>{items.length}</span>
                  </div>
                  <div className="p-2 space-y-2 max-h-[600px] overflow-y-auto">
                    {items.length === 0 ? (
                      <p className="text-xs text-slate-400 italic text-center py-4">empty</p>
                    ) : items.map(card => (
                      <ApplicationCard key={card.id} card={card} onClick={() => setSelected(card)} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {selected && (
        <ApplicationPanel
          leadId={selected.id}
          stages={stages}
          user={user}
          onClose={() => setSelected(null)}
          onChanged={() => { load(); }}
        />
      )}
    </div>
  );
}

function ApplicationCard({ card, onClick }) {
  const docPct = card.docs_total > 0 ? Math.round((card.docs_received / card.docs_total) * 100) : 0;
  const visaSoon = card.visa_deadline && new Date(card.visa_deadline) - new Date() < 30 * 86400000;

  return (
    <button onClick={onClick} className="w-full text-left bg-white rounded-xl p-3 shadow-sm hover:shadow-md border border-slate-100 hover:border-blue-200 transition-all">
      <div className="flex items-start justify-between gap-2 mb-1">
        <p className="font-semibold text-slate-800 text-sm truncate flex-1">{card.client_name}</p>
        {visaSoon && <span title={`Visa deadline ${card.visa_deadline}`} className="text-rose-500 flex-shrink-0"><CalendarClock size={14} /></span>}
      </div>
      <p className="text-xs text-slate-400 truncate">{card.lead_id}</p>
      {card.destination && (
        <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
          <MapPin size={11} /> {card.destination}{card.university ? ` · ${card.university}` : ''}
        </p>
      )}
      {card.docs_total > 0 && (
        <div className="mt-2">
          <div className="flex justify-between text-[10px] text-slate-400 mb-1">
            <span>Documents</span>
            <span>{card.docs_received}/{card.docs_total} ({docPct}%)</span>
          </div>
          <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${docPct}%` }} />
          </div>
        </div>
      )}
      <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2">
        <span>{card.assigned_consultant || '— unassigned'}</span>
        {card.intake_term && <span>{card.intake_term}</span>}
      </div>
    </button>
  );
}

function ApplicationPanel({ leadId, stages, user, onClose, onChanged }) {
  const [lead, setLead]    = useState(null);
  const [docs, setDocs]    = useState([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm]    = useState({});

  const load = useCallback(async () => {
    const [l, d] = await Promise.all([
      api.getLead(leadId),
      api.documents(leadId),
    ]);
    setLead(l); setDocs(d);
    setForm({
      application_stage: l.application_stage || 'inquiry',
      university:        l.university || '',
      intake_term:       l.intake_term || '',
      visa_deadline:     l.visa_deadline || '',
      departure_date:    l.departure_date || '',
      application_notes: l.application_notes || '',
    });
  }, [leadId]);

  useEffect(() => { load(); }, [load]);

  const updateField = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const saveStageInfo = async () => {
    setSaving(true);
    try { await api.updateStage(leadId, form); await load(); onChanged?.(); }
    catch (e) { alert(e.message); }
    setSaving(false);
  };

  const advance = async () => {
    const idx = stages.findIndex(s => s.key === (form.application_stage || 'inquiry'));
    if (idx === -1 || idx >= stages.length - 1) return;
    const next = stages[idx + 1].key;
    setSaving(true);
    try { await api.updateStage(leadId, { stage: next }); await load(); onChanged?.(); }
    catch (e) { alert(e.message); }
    setSaving(false);
  };

  const setDocStatus = async (doc, status) => {
    setDocs(prev => prev.map(d => d.id === doc.id ? { ...d, status } : d)); // optimistic
    try { await api.updateDocument(doc.id, { status }); }
    catch (e) { alert(e.message); load(); }
  };

  const addDoc = async () => {
    const name = prompt('Document name?');
    if (!name?.trim()) return;
    await api.addDocument(leadId, { doc_type: name.trim() });
    load();
  };

  const removeDoc = async (doc) => {
    if (!confirm(`Remove "${doc.doc_type}"?`)) return;
    await api.deleteDocument(doc.id);
    load();
  };

  if (!lead) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/40 backdrop-blur-sm">
        <div className="bg-white h-full w-full max-w-2xl flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  const currentIdx = stages.findIndex(s => s.key === (form.application_stage || 'inquiry'));
  const received = docs.filter(d => ['received', 'verified'].includes(d.status)).length;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white h-full w-full max-w-2xl overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h3 className="text-lg font-bold text-slate-800">{lead.client_name}</h3>
            <p className="text-xs text-slate-400">{lead.lead_id} · {lead.destination || 'No destination'} · {lead.assigned_consultant || 'Unassigned'}</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"><X size={18} /></button>
        </div>

        {/* Stage progress */}
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

        {/* Application details form */}
        <div className="px-6 py-5 border-b border-slate-100 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="University" value={form.university} onChange={v => updateField('university', v)} placeholder="e.g. Anhui Medical University" />
            <Field label="Intake term" value={form.intake_term} onChange={v => updateField('intake_term', v)} placeholder="e.g. Spring 2026" />
            <Field label="Visa deadline" type="date" value={form.visa_deadline} onChange={v => updateField('visa_deadline', v)} />
            <Field label="Departure date" type="date" value={form.departure_date} onChange={v => updateField('departure_date', v)} />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Application notes</label>
            <textarea rows={2} value={form.application_notes} onChange={e => updateField('application_notes', e.target.value)}
              placeholder="Anything the next person should know — interview booked for…"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm" />
          </div>
          <div className="flex justify-end">
            <button onClick={saveStageInfo} disabled={saving}
              className="text-sm bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 disabled:opacity-60 flex items-center gap-2">
              <Save size={14} /> {saving ? 'Saving…' : 'Save details'}
            </button>
          </div>
        </div>

        {/* Document checklist */}
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

function Field({ label, value, onChange, type = 'text', placeholder }) {
  return (
    <div>
      <label className="text-xs font-semibold text-slate-600 mb-1 block">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm" />
    </div>
  );
}

function DocRow({ doc, onStatus, onRemove }) {
  const current = DOC_STATUSES.find(s => s.key === doc.status) || DOC_STATUSES[0];
  const [open, setOpen] = useState(false);
  return (
    <div className="flex items-center gap-3 p-2.5 rounded-lg border border-slate-100 hover:border-slate-200 bg-white">
      <span className="text-sm text-slate-700 flex-1 truncate">{doc.doc_type}</span>
      {doc.received_on && <span className="text-[11px] text-slate-400">{doc.received_on}</span>}
      <div className="relative">
        <button onClick={() => setOpen(o => !o)}
          className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${current.cls}`}>
          {current.label}
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl z-20 min-w-[120px] py-1">
              {DOC_STATUSES.map(s => (
                <button key={s.key}
                  onClick={() => { onStatus(doc, s.key); setOpen(false); }}
                  className={`w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 ${s.key === current.key ? 'font-bold' : ''}`}>
                  {s.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      <button onClick={onRemove} className="p-1 text-slate-300 hover:text-rose-500 rounded">
        <Trash2 size={13} />
      </button>
    </div>
  );
}
