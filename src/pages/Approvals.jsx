import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ClipboardCheck, Plus, Search, RefreshCw, CheckCircle2, XCircle,
  Clock, AlertTriangle, ChevronRight, FileText, Loader2,
  Banknote, ShieldAlert,
} from 'lucide-react';
import Modal from '../components/Modal';
import { useToast } from '../components/Toast';
import { api } from '../api';
import { fmtCurrency, timeAgo } from '../lib/format';
import { isFullAdmin, hasPermission, PERMISSIONS } from '../lib/roles';

const TYPE_OPTIONS = [
  ['expense', 'Expense'],
  ['refund', 'Refund'],
  ['discount', 'Fee waiver'],
  ['document_release', 'Document release'],
  ['other', 'Other'],
];

const TYPE_LABEL = Object.fromEntries(TYPE_OPTIONS);
const STATUS = {
  pending:   { label: 'Pending',   icon: Clock,        chip: 'bg-amber-50 text-amber-700 border-amber-200' },
  approved:  { label: 'Approved',  icon: CheckCircle2, chip: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  rejected:  { label: 'Rejected',  icon: XCircle,      chip: 'bg-rose-50 text-rose-700 border-rose-200' },
  cancelled: { label: 'Cancelled', icon: XCircle,      chip: 'bg-slate-100 text-slate-500 border-slate-200' },
};
const PRIORITY_CHIP = {
  urgent: 'bg-rose-100 text-rose-700',
  high: 'bg-orange-100 text-orange-700',
  normal: 'bg-slate-100 text-slate-600',
  low: 'bg-slate-100 text-slate-500',
};

function ageLabel(iso) {
  const d = timeAgo(iso);
  return d || 'just now';
}
function daysOpen(iso) {
  if (!iso) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(String(iso).replace(' ', 'T') + 'Z').getTime()) / 86400000));
}

export default function Approvals({ user }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [search, setSearch] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [focusId, setFocusId] = useState(null);
  const [decision, setDecision] = useState(null);
  const toast = useToast();

  const canCreate = hasPermission(user, PERMISSIONS.VIEW_APPROVALS);
  const canDecide = isFullAdmin(user) || hasPermission(user, PERMISSIONS.DECIDE_APPROVALS);

  useEffect(() => { document.title = 'Approvals | EduExpress Command'; }, []);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    api.approvals({ limit: 200 })
      .then(d => setRows(Array.isArray(d.rows) ? d.rows : []))
      .catch(e => setError(e.message || 'Could not load approvals'))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (searchParams.get('new') === '1' && canCreate) setShowNew(true);
    const focus = searchParams.get('focus');
    if (focus) setFocusId(Number(focus));
  }, [searchParams, canCreate]);

  const closeParams = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('new'); next.delete('focus');
    setSearchParams(next, { replace: true });
  };

  const counts = useMemo(() => ({
    all: rows.length,
    pending: rows.filter(r => r.status === 'pending').length,
    approved: rows.filter(r => r.status === 'approved').length,
    rejected: rows.filter(r => r.status === 'rejected').length,
    cancelled: rows.filter(r => r.status === 'cancelled').length,
  }), [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter(r => statusFilter === 'all' || r.status === statusFilter)
      .filter(r => !q || [r.title, r.request_no, r.requested_by, r.type, r.description].filter(Boolean).join(' ').toLowerCase().includes(q));
  }, [rows, statusFilter, search]);

  const focused = useMemo(() => rows.find(r => Number(r.id) === Number(focusId)) || null, [rows, focusId]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <section className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-slate-800 to-slate-950 flex items-center justify-center flex-shrink-0">
              <ClipboardCheck size={20} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-slate-800 tracking-tight">Decision Inbox</h1>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-600 border border-blue-100 px-2 py-0.5 rounded-full">Executive control</span>
              </div>
              <p className="text-sm text-slate-500 mt-0.5">Approve spending, refunds, fee waivers and document releases with a written reason and an audit trail.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50" title="Refresh" aria-label="Refresh approvals">
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
            {canCreate && (
              <button onClick={() => setShowNew(true)} className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-xl shadow-sm">
                <Plus size={15} /> New request
              </button>
            )}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2.5">
          <Stat label="Pending" value={counts.pending} tone="amber" />
          <Stat label="Approved" value={counts.approved} tone="emerald" />
          <Stat label="All" value={counts.all} tone="slate" />
        </div>
      </section>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl px-4 py-3 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={load} className="font-semibold underline">Retry</button>
        </div>
      )}

      {/* Filters */}
      <section className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-sm flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="flex items-center gap-1 flex-wrap">
          {[
            ['pending', 'Pending'],
            ['approved', 'Approved'],
            ['rejected', 'Rejected'],
            ['all', 'All'],
          ].map(([id, label]) => (
            <button key={id} onClick={() => setStatusFilter(id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${statusFilter === id ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>
              {label}{counts[id] != null ? ` ${counts[id]}` : ''}
            </button>
          ))}
        </div>
        <div className="relative flex-1 lg:max-w-xs lg:ml-auto">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search title, requester, request no…"
            className="w-full text-xs border border-slate-200 rounded-xl pl-8 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400" />
        </div>
      </section>

      {/* List */}
      {loading ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-slate-400">
          <Loader2 className="animate-spin mx-auto mb-2" size={22} /> Loading decision queue…
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-10 text-center">
          <div className="w-12 h-12 mx-auto rounded-full bg-slate-50 text-slate-400 flex items-center justify-center"><ClipboardCheck size={24} /></div>
          <p className="text-sm font-semibold text-slate-700 mt-3">{statusFilter === 'pending' ? 'No pending decisions' : 'No requests in this view'}</p>
          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
            Create a request when a decision needs a record: an expense, a refund, a fee waiver, a document release, or another exception.
          </p>
          {canCreate && <button onClick={() => setShowNew(true)} className="mt-4 inline-flex items-center gap-1.5 bg-blue-600 text-white text-xs font-semibold px-4 py-2 rounded-xl"><Plus size={14}/> Create request</button>}
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map(r => {
            const s = STATUS[r.status] || STATUS.pending;
            const Icon = s.icon;
            const waiting = r.status === 'pending' ? daysOpen(r.created_at) : null;
            return (
              <button key={r.id} onClick={() => setFocusId(r.id)}
                className="w-full text-left bg-white border border-slate-200 hover:border-blue-300 rounded-2xl p-4 shadow-sm hover:shadow transition-all">
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${r.priority === 'urgent' || r.priority === 'high' ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-600'}`}>
                    {r.type === 'document_release' ? <ShieldAlert size={16} /> : r.type === 'expense' || r.type === 'refund' || r.type === 'partner_commission' || r.type === 'discount' ? <Banknote size={16} /> : <FileText size={16} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-slate-800 truncate">{r.title}</p>
                      <span className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${PRIORITY_CHIP[r.priority] || PRIORITY_CHIP.normal}`}>{r.priority}</span>
                      {waiting != null && waiting >= 2 && <span className="text-[9px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">waiting {waiting}d</span>}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                      <span className="font-mono">{r.request_no || `#${r.id}`}</span> · {TYPE_LABEL[r.type] || r.type} · by {r.requested_by || 'Unknown'} · {ageLabel(r.created_at)}
                    </p>
                    {r.description && <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{r.description}</p>}
                  </div>
                  <div className="text-right flex-shrink-0 hidden sm:block">
                    {r.amount != null && <p className="text-sm font-bold text-slate-800 tabular-nums">{fmtCurrency(r.amount)}</p>}
                    <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full border mt-1 ${s.chip}`}><Icon size={10} /> {s.label}</span>
                  </div>
                  <ChevronRight size={15} className="text-slate-300 flex-shrink-0 mt-1" />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {showNew && (
        <NewApprovalModal
          onClose={() => { setShowNew(false); closeParams(); }}
          onSaved={() => { setShowNew(false); closeParams(); load(); toast.success('Approval request created'); }}
        />
      )}

      {focused && (
        <ApprovalDetail
          approval={focused}
          user={user}
          canDecide={canDecide}
          onClose={() => { setFocusId(null); closeParams(); }}
          onDecide={(action) => { setFocusId(null); setDecision({ approval: focused, action }); }}
        />
      )}

      {decision && (
        <DecisionModal
          approval={decision.approval}
          action={decision.action}
          onClose={() => setDecision(null)}
          onDone={() => { setDecision(null); setFocusId(null); closeParams(); load(); toast.success(decision.action === 'approve' ? 'Request approved' : decision.action === 'reject' ? 'Request rejected' : 'Request cancelled'); }}
        />
      )}
    </div>
  );
}

function Stat({ label, value, tone }) {
  const tones = { amber: 'text-amber-600', emerald: 'text-emerald-600', rose: 'text-rose-600', slate: 'text-slate-800' };
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5">
      <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`text-lg font-extrabold tabular-nums ${tones[tone] || tones.slate}`}>{value}</p>
    </div>
  );
}

function NewApprovalModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ type: 'expense', title: '', description: '', amount: '', priority: 'normal' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.title.trim()) return setError('A title is required.');
    setSaving(true);
    try {
      await api.createApproval({
        ...form,
        amount: form.amount === '' ? null : Number(form.amount),
      });
      onSaved();
    } catch (err) {
      setError(err.message || 'Could not create request');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="New approval request" onClose={onClose} icon={ClipboardCheck}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Request type">
            <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className="inp">
              {TYPE_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
          <Field label="Priority">
            <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} className="inp">
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </Field>
        </div>
        <Field label="Title">
          <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="inp" placeholder="e.g. Refund request — L-00042" autoFocus />
        </Field>
        <Field label="Context / reason">
          <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="inp" rows={4} placeholder="What is being requested, why, and what evidence supports it?" />
        </Field>
        <Field label="Amount (BDT, optional)">
          <input type="number" min="0" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className="inp" placeholder="0" />
        </Field>
        {error && <p className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
          <button type="submit" disabled={saving} className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-4 py-2 rounded-xl text-sm font-semibold">
            {saving && <Loader2 size={14} className="animate-spin" />} Create request
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ApprovalDetail({ approval, user, canDecide, onClose, onDecide }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const isRequester = Number(approval.requested_by_id) === Number(user?.id);
  const pending = approval.status === 'pending';
  const s = STATUS[approval.status] || STATUS.pending;
  const Icon = s.icon;

  useEffect(() => {
    let alive = true;
    api.approval(approval.id)
      .then(d => { if (alive) setEvents(d.events || []); })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [approval.id]);

  return (
    <Modal title={`${approval.request_no || 'Request'} · ${TYPE_LABEL[approval.type] || approval.type}`} onClose={onClose} icon={ClipboardCheck} wide>
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-lg font-bold text-slate-800">{approval.title}</h3>
            <p className="text-xs text-slate-400 mt-1">Requested by {approval.requested_by || 'Unknown'} · {timeAgo(approval.created_at)}</p>
          </div>
          <div className="text-right">
            {approval.amount != null && <p className="text-xl font-extrabold text-slate-800 tabular-nums">{fmtCurrency(approval.amount)}</p>}
            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full border mt-1 ${s.chip}`}><Icon size={11} /> {s.label}</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs">
          <DetailBox label="Priority" value={(approval.priority || 'normal').toUpperCase()} />
          <DetailBox label="Type" value={TYPE_LABEL[approval.type] || approval.type} />
          <DetailBox label="Created" value={String(approval.created_at || '').slice(0, 10)} />
        </div>

        {approval.description && (
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Context</p>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{approval.description}</p>
          </div>
        )}

        {approval.decided_at && (
          <div className={`rounded-xl border p-4 ${approval.status === 'approved' ? 'bg-emerald-50 border-emerald-200' : approval.status === 'rejected' ? 'bg-rose-50 border-rose-200' : 'bg-slate-50 border-slate-200'}`}>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Decision by {approval.decided_by || '—'} · {String(approval.decided_at).slice(0, 16)}</p>
            <p className="text-sm mt-1 text-slate-700 whitespace-pre-wrap">{approval.decision_note || 'No note recorded.'}</p>
          </div>
        )}

        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Audit trail</p>
          {loading ? <p className="text-xs text-slate-400">Loading events…</p> : events.length === 0 ? <p className="text-xs text-slate-400">No events recorded.</p> : (
            <div className="space-y-2">
              {events.map(ev => (
                <div key={ev.id} className="flex items-start gap-2.5">
                  <span className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${ev.action === 'approved' ? 'bg-emerald-500' : ev.action === 'rejected' ? 'bg-rose-500' : 'bg-slate-400'}`} />
                  <div>
                    <p className="text-xs text-slate-700"><strong>{ev.actor_name || 'System'}</strong> · {ev.action} · <span className="text-slate-400">{timeAgo(ev.created_at)}</span></p>
                    {ev.note && <p className="text-[11px] text-slate-500">{ev.note}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap justify-end gap-2 pt-2 border-t border-slate-100">
          {pending && isRequester && (
            <button onClick={() => onDecide('cancel')} className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel request</button>
          )}
          {pending && canDecide && !isRequester && (
            <>
              <button onClick={() => onDecide('reject')} className="px-4 py-2 rounded-xl border border-rose-200 text-rose-600 text-sm font-semibold hover:bg-rose-50">Reject</button>
              <button onClick={() => onDecide('approve')} className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold">Approve</button>
            </>
          )}
          {pending && canDecide && isRequester && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">You cannot approve your own request. Ask the Managing Director or another authorised approver.</p>
          )}
          {pending && !canDecide && !isRequester && (
            <p className="text-xs text-slate-500">Waiting for the CEO or Managing Director to decide.</p>
          )}
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">Close</button>
        </div>
      </div>
    </Modal>
  );
}

function DecisionModal({ approval, action, onClose, onDone }) {
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const isApprove = action === 'approve';
  const isCancel = action === 'cancel';

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!isCancel && !note.trim()) return setError('A decision note is required for the audit trail.');
    setSaving(true);
    try {
      await api.decideApproval(approval.id, { action, note: note.trim() });
      onDone();
    } catch (err) {
      setError(err.message || 'Could not save decision');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={isApprove ? 'Approve request' : action === 'reject' ? 'Reject request' : 'Cancel request'} onClose={onClose} icon={isApprove ? CheckCircle2 : isCancel ? XCircle : AlertTriangle}>
      <form onSubmit={submit} className="space-y-4">
        <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
          <p className="text-xs font-bold text-slate-800">{approval.request_no || `#${approval.id}`} · {approval.title}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Requested by {approval.requested_by} {approval.amount != null ? `· ${fmtCurrency(approval.amount)}` : ''}</p>
        </div>
        <Field label={isCancel ? 'Reason (optional)' : 'Decision note (required)'}>
          <textarea value={note} onChange={e => setNote(e.target.value)} className="inp" rows={4} autoFocus
            placeholder={isApprove ? 'What was approved and under what conditions?' : action === 'reject' ? 'Why is this being rejected, and what should the requester do next?' : 'Why is this request being cancelled?'} />
        </Field>
        {error && <p className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">Back</button>
          <button type="submit" disabled={saving}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm font-semibold disabled:opacity-60 ${isApprove ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}`}>
            {saving && <Loader2 size={14} className="animate-spin" />}
            {isApprove ? 'Approve & record' : action === 'reject' ? 'Reject & record' : 'Cancel request'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function DetailBox({ label, value }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/60 px-2.5 py-2">
      <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="text-xs font-semibold text-slate-700 mt-0.5 truncate">{value}</p>
    </div>
  );
}
