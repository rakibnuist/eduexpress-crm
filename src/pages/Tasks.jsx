import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ListChecks, Plus, RefreshCw, Search, CalendarDays,
  Loader2, Pencil, Trash2, UserRound,
} from 'lucide-react';
import Modal from '../components/Modal';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/Confirm';
import { api } from '../api';
import { timeAgo } from '../lib/format';
import { isFullAdmin, hasPermission, PERMISSIONS } from '../lib/roles';

const STATUS = {
  open:        { label: 'Open',        chip: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' },
  in_progress: { label: 'In progress', chip: 'bg-blue-50 text-blue-700',    dot: 'bg-blue-500' },
  blocked:     { label: 'Blocked',     chip: 'bg-rose-50 text-rose-700',    dot: 'bg-rose-500' },
  done:        { label: 'Done',        chip: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
  cancelled:   { label: 'Cancelled',   chip: 'bg-slate-100 text-slate-400', dot: 'bg-slate-300' },
};
const PRIORITY = {
  urgent: 'bg-rose-100 text-rose-700',
  high: 'bg-orange-100 text-orange-700',
  normal: 'bg-slate-100 text-slate-600',
  low: 'bg-slate-100 text-slate-500',
};

function todayIso() {
  return new Date(Date.now() + 6 * 3600 * 1000).toISOString().slice(0, 10);
}
function isOverdue(t) {
  return t.due_date && t.status !== 'done' && t.status !== 'cancelled' && t.due_date < todayIso();
}

export default function Tasks({ user }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [rows, setRows] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('open');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [focusedId, setFocusedId] = useState(null);
  const toast = useToast();
  const confirm = useConfirm();

  const canManage = isFullAdmin(user) || hasPermission(user, PERMISSIONS.MANAGE_TASKS);

  useEffect(() => { document.title = 'Tasks & Directives | EduExpress Command'; }, []);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    Promise.all([
      api.tasks({ limit: 300 }),
      canManage ? api.employeesActive().catch(() => []) : Promise.resolve([]),
    ])
      .then(([taskData, employeeData]) => {
        setRows(Array.isArray(taskData.rows) ? taskData.rows : []);
        setEmployees(Array.isArray(employeeData) ? employeeData : []);
      })
      .catch(e => setError(e.message || 'Could not load tasks'))
      .finally(() => setLoading(false));
  }, [canManage]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (searchParams.get('new') === '1' && canManage) setShowModal(true);
    const f = searchParams.get('focus');
    if (f) setFocusedId(Number(f));
  }, [searchParams, canManage]);

  const closeParams = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('new'); next.delete('focus');
    setSearchParams(next, { replace: true });
  };

  const counts = useMemo(() => ({
    all: rows.length,
    open: rows.filter(t => t.status === 'open').length,
    in_progress: rows.filter(t => t.status === 'in_progress').length,
    blocked: rows.filter(t => t.status === 'blocked').length,
    done: rows.filter(t => t.status === 'done').length,
    cancelled: rows.filter(t => t.status === 'cancelled').length,
    overdue: rows.filter(t => isOverdue(t)).length,
  }), [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter(t => tab === 'all' || (tab === 'open' ? ['open', 'in_progress', 'blocked'].includes(t.status) : t.status === tab))
      .filter(t => !q || [t.title, t.details, t.assigned_to, t.assigned_by, t.category].filter(Boolean).join(' ').toLowerCase().includes(q));
  }, [rows, tab, search]);

  const setStatus = async (task, status) => {
    try {
      await api.updateTask(task.id, { status });
      setRows(prev => prev.map(t => t.id === task.id ? { ...t, status, completed_at: status === 'done' ? new Date().toISOString() : null } : t));
      toast.success(status === 'done' ? 'Task marked done' : `Task moved to ${STATUS[status]?.label || status}`);
    } catch (e) { toast.error(e.message || 'Could not update task'); }
  };

  const remove = async (task) => {
    const ok = await confirm({ title: 'Delete task?', body: `"${task.title}" will be removed from the task log. This cannot be undone.`, confirmLabel: 'Delete', tone: 'danger' });
    if (!ok) return;
    try { await api.deleteTask(task.id); setRows(prev => prev.filter(t => t.id !== task.id)); toast.success('Task deleted'); }
    catch (e) { toast.error(e.message || 'Could not delete task'); }
  };

  return (
    <div className="space-y-5">
      <section className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-slate-800 to-slate-950 flex items-center justify-center flex-shrink-0">
              <ListChecks size={20} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-slate-800 tracking-tight">Tasks & Directives</h1>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-violet-50 text-violet-600 border border-violet-100 px-2 py-0.5 rounded-full">{canManage ? 'All owners' : 'Assigned to you'}</span>
              </div>
              <p className="text-sm text-slate-500 mt-0.5">Put an owner and a due date behind every next action. No task, no follow-through.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50" title="Refresh" aria-label="Refresh tasks">
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
            {canManage && (
              <button onClick={() => { setEditing(null); setShowModal(true); }} className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-xl shadow-sm">
                <Plus size={15} /> New task
              </button>
            )}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2.5">
          <Stat label="Active" value={counts.open + counts.in_progress + counts.blocked} tone="blue" />
          <Stat label="Overdue" value={counts.overdue} tone="rose" />
          <Stat label="Done" value={counts.done} tone="emerald" />
        </div>
      </section>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl px-4 py-3 flex items-center justify-between">
          <span>{error}</span><button onClick={load} className="font-semibold underline">Retry</button>
        </div>
      )}

      <section className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-sm flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="flex items-center gap-1 flex-wrap">
          {[['open', 'Active'], ['done', 'Done'], ['all', 'All']].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${tab === id ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>
              {label}{counts[id] != null ? ` ${counts[id]}` : ''}
            </button>
          ))}
        </div>
        <div className="relative flex-1 lg:max-w-xs lg:ml-auto">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search task or owner…"
            className="w-full text-xs border border-slate-200 rounded-xl pl-8 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400" />
        </div>
      </section>

      {loading ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-slate-400">
          <Loader2 className="animate-spin mx-auto mb-2" size={22} /> Loading task log…
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-10 text-center">
          <div className="w-12 h-12 mx-auto rounded-full bg-slate-50 text-slate-400 flex items-center justify-center"><ListChecks size={24} /></div>
          <p className="text-sm font-semibold text-slate-700 mt-3">{tab === 'open' ? 'No active tasks' : 'No tasks in this view'}</p>
          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">Assign the next action with an owner and a due date so it does not live only in a chat message.</p>
          {canManage && <button onClick={() => { setEditing(null); setShowModal(true); }} className="mt-4 inline-flex items-center gap-1.5 bg-blue-600 text-white text-xs font-semibold px-4 py-2 rounded-xl"><Plus size={14}/> Assign a task</button>}
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map(t => {
            const s = STATUS[t.status] || STATUS.open;
            const overdue = isOverdue(t);
            const focused = Number(focusedId) === Number(t.id);
            const canEdit = canManage;
            const canUpdate = canManage || String(t.assigned_to || '').toLowerCase() === String(user?.name || '').toLowerCase() || Number(t.assigned_user_id) === Number(user?.id);
            return (
              <div key={t.id} className={`bg-white border rounded-2xl p-4 shadow-sm ${focused ? 'border-blue-400 ring-2 ring-blue-100' : overdue ? 'border-amber-200' : 'border-slate-200'}`}>
                <div className="flex items-start gap-3">
                  <span className={`mt-1.5 w-2.5 h-2.5 rounded-full flex-shrink-0 ${s.dot}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-slate-800">{t.title}</p>
                      <span className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${PRIORITY[t.priority] || PRIORITY.normal}`}>{t.priority}</span>
                      {overdue && <span className="text-[9px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">overdue {t.due_date}</span>}
                    </div>
                    {t.details && <p className="text-[11px] text-slate-500 mt-1 whitespace-pre-wrap">{t.details}</p>}
                    <p className="text-[10px] text-slate-400 mt-1.5 flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1"><UserRound size={10} /> {t.assigned_to || 'Unassigned'}</span>
                      <span>·</span>
                      <span>by {t.assigned_by || '—'}</span>
                      {t.due_date && <><span>·</span><span className="inline-flex items-center gap-1"><CalendarDays size={10} /> due {t.due_date}</span></>}
                    </p>
                    <p className="text-[10px] text-slate-300 mt-1">created {timeAgo(t.created_at)}{t.completed_at ? ` · completed ${timeAgo(t.completed_at)}` : ''}</p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {canUpdate ? (
                      <select value={t.status} onChange={e => setStatus(t, e.target.value)} aria-label={`Status for ${t.title}`}
                        className={`text-[10px] font-bold rounded-lg border-0 px-2 py-1.5 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-100 ${s.chip}`}>
                        <option value="open">Open</option>
                        <option value="in_progress">In progress</option>
                        <option value="done">Done</option>
                      </select>
                    ) : <span className={`text-[10px] font-bold px-2 py-1 rounded-lg ${s.chip}`}>{s.label}</span>}
                    {canEdit && <button onClick={() => { setEditing(t); setShowModal(true); }} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" aria-label="Edit task"><Pencil size={13} /></button>}
                    {isFullAdmin(user) && <button onClick={() => remove(t)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg" aria-label="Delete task"><Trash2 size={13} /></button>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && canManage && (
        <TaskModal
          task={editing}
          employees={employees}
          onClose={() => { setShowModal(false); setEditing(null); closeParams(); }}
          onSaved={() => { setShowModal(false); setEditing(null); closeParams(); load(); toast.success(editing ? 'Task updated' : 'Task assigned'); }}
        />
      )}
    </div>
  );
}

function Stat({ label, value, tone }) {
  const tones = { blue: 'text-blue-600', rose: 'text-rose-600', amber: 'text-amber-600', emerald: 'text-emerald-600', slate: 'text-slate-800' };
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5">
      <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`text-lg font-extrabold tabular-nums ${tones[tone] || tones.slate}`}>{value}</p>
    </div>
  );
}

function TaskModal({ task, employees, onClose, onSaved }) {
  const [form, setForm] = useState({
    title: task?.title || '',
    details: task?.details || '',
    assigned_to: task?.assigned_to || '',
    due_date: task?.due_date || '',
    priority: task?.priority || 'normal',
    status: task?.status || 'open',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const isEdit = !!task;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.title.trim()) return setError('A title is required.');
    setSaving(true);
    try {
      const payload = { ...form, assigned_to: form.assigned_to || null, due_date: form.due_date || null };
      if (isEdit) await api.updateTask(task.id, payload);
      else await api.createTask(payload);
      onSaved();
    } catch (err) {
      setError(err.message || 'Could not save task');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={isEdit ? 'Edit task' : 'Assign a task'} onClose={onClose} icon={ListChecks}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Task">
          <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="inp" placeholder="e.g. Call the 5 oldest New Leads before 4pm" autoFocus />
        </Field>
        <Field label="Details / expected output">
          <textarea value={form.details} onChange={e => setForm(f => ({ ...f, details: e.target.value }))} className="inp" rows={3} placeholder="What exactly is expected, and what evidence proves it is done?" />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Owner">
            <select value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))} className="inp">
              <option value="">— Unassigned —</option>
              {employees.map(e => <option key={e.emp_id + e.name} value={e.name}>{e.name} · {e.emp_id}</option>)}
            </select>
          </Field>
          <Field label="Due date">
            <input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} className="inp" />
          </Field>
        </div>
        <Field label="Priority">
          <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} className="inp">
            <option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option>
          </select>
        </Field>
        {isEdit && (
          <Field label="Status">
            <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className="inp">
              <option value="open">Open</option><option value="in_progress">In progress</option><option value="done">Done</option>
            </select>
          </Field>
        )}
        {error && <p className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
          <button type="submit" disabled={saving} className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-4 py-2 rounded-xl text-sm font-semibold">
            {saving && <Loader2 size={14} className="animate-spin" />} {isEdit ? 'Save task' : 'Assign task'}
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
