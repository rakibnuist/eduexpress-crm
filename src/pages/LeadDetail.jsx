/* LeadDetail — one student's full chronological story.
   Two-column layout: snapshot/info on the left, live timeline on the right.
   Real-time: subscribes to the existing SSE feed and prepends any new activity
   for this lead instantly. */
import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import LeadForm from './LeadForm';
import { useToast } from '../components/Toast';
import {
  ArrowLeft, Pencil, Trash2, Phone, Mail, MapPin, Calendar, User, Hash,
  GraduationCap, Building2, FileText, DollarSign, Activity, Send, AlertCircle,
  ChevronRight, ExternalLink, Globe, CreditCard, CheckCircle2, Clock,
  Tag, UserPlus, Receipt, Plane, BookOpen, MessageSquare, Loader2,
  Share2, Copy, QrCode, RotateCw, Heart,
} from 'lucide-react';

const fmt = (n) => {
  const v = Number(n || 0);
  if (v >= 100000) return `৳${(v / 100000).toFixed(1)}L`;
  if (v >= 1000)   return `৳${(v / 1000).toFixed(1)}K`;
  return `৳${v.toLocaleString()}`;
};
const fmtFull = (n) => `৳${Number(n || 0).toLocaleString()}`;
const timeAgo = (iso) => {
  if (!iso) return '';
  const d = new Date(iso.endsWith('Z') ? iso : iso.replace(' ', 'T') + 'Z');
  const s = Math.max(0, (Date.now() - d.getTime()) / 1000);
  if (s < 60)    return `${Math.floor(s)}s ago`;
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return d.toLocaleDateString();
};
const fullDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso.endsWith('Z') ? iso : iso.replace(' ', 'T') + 'Z');
  return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};
const ensureAbsoluteUrl = (url) => {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  return 'https://' + url;
};

export default function LeadDetail({ user }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [lead, setLead]         = useState(null);

  useEffect(() => {
    if (lead) {
      document.title = `${lead.client_name} - Profile | EduExpress CRM`;
    } else {
      document.title = "Client Profile | EduExpress CRM";
    }
  }, [lead]);

  const [timeline, setTimeline] = useState([]);
  const [docs, setDocs]         = useState([]);
  const [unis, setUnis]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [editing, setEditing]   = useState(false);
  const [settings, setSettings] = useState(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const t = await api.leadTimeline(id);
      setLead(t.lead);
      setTimeline(t.timeline);
      // Best-effort load of related data; ignore failures (e.g. lead not in
      // application pipeline yet).
      const [d, u] = await Promise.all([
        api.documents(t.lead.id).catch(() => []),
        api.universityApps(t.lead.id).catch(() => []),
      ]);
      setDocs(d || []);
      setUnis(u || []);
    } catch (e) {
      setError(e.message || 'Could not load this lead');
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { api.settings().then(setSettings).catch(() => {}); }, []);

  // Real-time: prepend any new activity for this lead as it happens
  useEffect(() => {
    if (!lead?.id) return;
    const es = new EventSource('/api/events');
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type !== 'activity' || !data.activity) return;
        if (data.activity.lead_id === lead.id) {
          setTimeline(prev => prev.find(a => a.id === data.activity.id) ? prev : [data.activity, ...prev]);
        }
      } catch {}
    };
    return () => { try { es.close(); } catch {} };
  }, [lead?.id]);

  const toast = useToast();

  const handleDelete = async () => {
    try { await api.deleteLead(lead.id); toast.success(`${lead.client_name} deleted`); navigate('/leads'); }
    catch (e) { toast.error(e.message || 'Could not delete'); }
  };

  if (loading && !lead) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={28} className="text-blue-500 animate-spin" />
      </div>
    );
  }
  if (error || !lead) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
        <AlertCircle size={32} className="text-rose-400 mx-auto mb-3" />
        <p className="text-slate-700 font-semibold">{error || 'Lead not found'}</p>
        <Link to="/leads" className="text-sm text-blue-600 hover:underline mt-2 inline-block">← Back to leads</Link>
      </div>
    );
  }

  const balance = (lead.service_fee || 0) - (lead.paid || 0);
  const docsReceived = docs.filter(d => ['received', 'verified'].includes(d.status)).length;
  const unisAdmitted = unis.filter(u => u.status === 'admitted').length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => navigate(-1)} className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg"><ArrowLeft size={18} /></button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-2xl font-bold text-slate-800 truncate">{lead.client_name}</h2>
              <span className="font-mono text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{lead.lead_id}</span>
              <StatusBadge status={lead.lead_status} />
              {lead.source && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase
                  ${lead.source === 'Agent' ? 'bg-violet-100 text-violet-700' : 'bg-emerald-100 text-emerald-700'}`}>
                  {lead.source}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {lead.date_added && <>Added {lead.date_added}</>}
              {lead.assigned_consultant && <> · Assigned to <strong>{lead.assigned_consultant}</strong></>}
              {lead.referrer && <> · Referred by {lead.referrer}</>}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {lead.drive_link && (
            <a href={ensureAbsoluteUrl(lead.drive_link)} target="_blank" rel="noreferrer"
              className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 px-3 py-2 rounded-lg border border-blue-200">
              <ExternalLink size={13} /> Drive folder
            </a>
          )}
          {lead.application_stage && (
            <Link to="/applications"
              className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 px-3 py-2 rounded-lg border border-slate-200">
              <Plane size={13} /> Application
            </Link>
          )}
          <button onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 px-3 py-2 rounded-lg border border-slate-200">
            <Pencil size={13} /> Edit
          </button>
          {user?.role === 'admin' && (
            <button onClick={() => setDeleteOpen(true)}
              className="flex items-center gap-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 px-3 py-2 rounded-lg border border-rose-200">
              <Trash2 size={13} /> Delete
            </button>
          )}
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Service fee"  value={fmt(lead.service_fee)} icon={<DollarSign size={16}/>} color="blue" />
        <StatCard label="Paid"         value={fmt(lead.paid)} icon={<CheckCircle2 size={16}/>} color="emerald"
          sub={`Deposit: ${fmtFull(lead.deposit || 0)}`} />
        <StatCard label="Balance"      value={fmt(balance)} icon={<CreditCard size={16}/>} color={balance > 0 ? 'rose' : 'slate'} />
        <StatCard label="Documents"    value={`${docsReceived}/${docs.length}`} icon={<FileText size={16}/>} color="violet"
          sub={unis.length > 0 ? `${unisAdmitted}/${unis.length} unis admitted` : null} />
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: snapshot panels */}
        <div className="lg:col-span-1 space-y-4">
          <Card title="Contact" icon={<User size={14}/>}>
            <Row icon={<Phone size={12}/>}>
              {lead.phone ? (
                <a href={`https://wa.me/${lead.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" 
                  className="text-slate-700 hover:text-emerald-600 hover:underline inline-flex items-center gap-1.5 transition-colors font-medium" title="Chat on WhatsApp">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0"></span>
                  {lead.phone}
                </a>
              ) : '—'}
            </Row>
            <Row icon={<Mail size={12}/>}>{lead.email || '—'}</Row>
            <Row icon={<Globe size={12}/>}>{lead.nationality || '—'}</Row>
            <Row icon={<Hash size={12}/>} mono>{lead.passport || '—'}</Row>
          </Card>

          <Card title="Academic" icon={<GraduationCap size={14}/>}>
            <Row label="Destination">{lead.destination || '—'}</Row>
            <Row label="University">{lead.university || '—'}</Row>
            <Row label="Degree">{lead.degree || '—'}</Row>
            <Row label="Major / Program">{lead.major || lead.program || '—'}</Row>
            <Row label="Intake">{lead.intake_term || '—'}</Row>
            <Row label="Last education">{lead.last_education || '—'}</Row>
            <Row label="GPA">{lead.gpa ?? '—'}</Row>
            <Row label="English score">{lead.english_score || '—'}</Row>
          </Card>

          <Card title="Application" icon={<Plane size={14}/>}>
            <Row label="Stage">
              {lead.application_stage
                ? <span className="text-xs font-semibold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full capitalize">{lead.application_stage.replace(/_/g, ' ')}</span>
                : <span className="text-slate-400">Not started</span>}
            </Row>
            <Row label="Visa deadline">{lead.visa_deadline || '—'}</Row>
            <Row label="Departure">{lead.departure_date || '—'}</Row>
            <Row label="Source">{lead.source || '—'}</Row>
            <Row label="Referrer">{lead.referrer || '—'}</Row>
            <Row label="Lead source">{lead.lead_source || '—'}</Row>
            <Row label="Follow-up">{lead.next_followup || '—'}</Row>
          </Card>

          {unis.length > 0 && (
            <Card title={`Universities (${unis.length})`} icon={<Building2 size={14}/>}>
              <div className="space-y-1.5">
                {unis.map(u => (
                  <div key={u.id} className="flex items-center justify-between text-xs">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-700 truncate">{u.university}</p>
                      {u.program && <p className="text-[10px] text-slate-400 truncate">{u.program}</p>}
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${UNI_STATUS_CLS[u.status] || ''}`}>
                      {u.status}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {docs.length > 0 && (
            <Card title={`Documents (${docsReceived}/${docs.length})`} icon={<FileText size={14}/>}>
              <div className="space-y-1">
                {docs.slice(0, 8).map(d => (
                  <div key={d.id} className="flex items-center justify-between text-xs">
                    <span className="text-slate-700 truncate">{d.doc_type}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full capitalize ${DOC_STATUS_CLS[d.status] || ''}`}>
                      {d.status === 'not_required' ? 'N/A' : d.status}
                    </span>
                  </div>
                ))}
                {docs.length > 8 && (
                  <Link to="/applications" className="text-[11px] text-blue-600 hover:underline mt-1.5 inline-block">
                    +{docs.length - 8} more · open in Applications →
                  </Link>
                )}
              </div>
            </Card>
          )}

          {/* Medical info — relevant for visas (China MBBS etc.) */}
          {(lead.blood_group || lead.date_of_birth || lead.medical_notes || lead.emergency_contact) && (
            <Card title="Medical & Emergency" icon={<Heart size={14}/>}>
              <Row label="Blood group">{lead.blood_group || '—'}</Row>
              <Row label="Date of birth">{lead.date_of_birth || '—'}</Row>
              <Row label="Emergency contact">{lead.emergency_contact || '—'}</Row>
              {lead.medical_notes && (
                <div className="mt-2 text-xs text-slate-600 whitespace-pre-wrap bg-slate-50 rounded-lg p-2">{lead.medical_notes}</div>
              )}
            </Card>
          )}

          {lead.notes && (
            <Card title="Lead notes" icon={<MessageSquare size={14}/>}>
              <p className="text-xs text-slate-600 whitespace-pre-wrap">{lead.notes}</p>
            </Card>
          )}
        </div>

        {/* Right: timeline */}
        <div className="lg:col-span-2">
          <Timeline leadId={lead.id} timeline={timeline} onPosted={load} />
        </div>
      </div>

      {/* Edit modal — reuses existing LeadForm */}
      {editing && (
        <Modal title={`✏️ Edit Lead — ${lead.lead_id}`} onClose={() => setEditing(false)} wide>
          <LeadForm lead={lead} settings={settings} onSave={() => { setEditing(false); load(); }} />
        </Modal>
      )}

      {/* Delete confirm */}
      {deleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-1">Delete this lead?</h3>
            <p className="text-sm text-slate-500 mb-4">
              <strong>{lead.client_name}</strong> ({lead.lead_id}) and all its history will be permanently removed. This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteOpen(false)} className="text-sm px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50">Cancel</button>
              <button onClick={handleDelete} className="text-sm px-4 py-2 rounded-xl bg-rose-600 text-white hover:bg-rose-700">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Sidebar pieces ─── */
function StatCard({ icon, label, value, sub, color }) {
  const colors = {
    blue:    'bg-blue-50 text-blue-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    violet:  'bg-violet-50 text-violet-600',
    rose:    'bg-rose-50 text-rose-600',
    slate:   'bg-slate-50 text-slate-500',
  };
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-start gap-3">
      <div className={`p-2 rounded-lg ${colors[color]}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wide">{label}</p>
        <p className="text-xl font-bold text-slate-800 leading-tight">{value}</p>
        {sub && <p className="text-[11px] text-slate-400 truncate">{sub}</p>}
      </div>
    </div>
  );
}

function Card({ title, icon, children }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/60 flex items-center gap-2">
        <span className="text-slate-400">{icon}</span>
        <p className="font-semibold text-slate-700 text-xs uppercase tracking-wide">{title}</p>
      </div>
      <div className="p-4 space-y-1.5">{children}</div>
    </div>
  );
}

function Row({ label, icon, children, mono }) {
  return (
    <div className="flex items-start gap-2 text-xs">
      {icon && <span className="text-slate-400 mt-0.5 flex-shrink-0">{icon}</span>}
      {label && <span className="text-slate-400 font-medium min-w-[100px]">{label}</span>}
      <span className={`text-slate-700 break-all ${mono ? 'font-mono' : ''}`}>{children}</span>
    </div>
  );
}

const DOC_STATUS_CLS = {
  pending:      'bg-slate-100 text-slate-600',
  received:     'bg-blue-100 text-blue-700',
  verified:     'bg-emerald-100 text-emerald-700',
  rejected:     'bg-rose-100 text-rose-700',
  not_required: 'bg-slate-50 text-slate-400',
};
const UNI_STATUS_CLS = {
  documents: 'bg-slate-100 text-slate-700',
  ready:     'bg-blue-100 text-blue-700',
  submitted: 'bg-violet-100 text-violet-700',
  admitted:  'bg-emerald-100 text-emerald-700',
  returned:  'bg-amber-100 text-amber-700',
  rejected:  'bg-rose-100 text-rose-700',
};

/* ─── Timeline ─── */
function Timeline({ leadId, timeline, onPosted }) {
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);
  const [mode, setMode] = useState('note'); // 'note' (internal) | 'reply' (to student)
  const inputRef = useRef(null);
  const toast = useToast();

  const submit = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setPosting(true);
    try {
      if (mode === 'reply') {
        await api.replyToStudent(leadId, text.trim());
        toast.success('Reply sent — the student will see it on their portal');
      } else {
        await api.addNote(leadId, text.trim());
        toast.success('Note saved');
      }
      setText(''); onPosted?.();
    }
    catch (err) { toast.error(err.message || 'Could not save'); }
    setPosting(false);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity size={16} className="text-slate-400" />
          <h3 className="font-semibold text-slate-700 text-sm">Activity Timeline</h3>
        </div>
        <span className="text-xs text-slate-400">{timeline.length} {timeline.length === 1 ? 'event' : 'events'}</span>
      </div>

      {/* Compose note */}
      <form onSubmit={submit} className="px-5 pt-4 pb-2 border-b border-slate-100">
        <div className="flex items-start gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            <MessageSquare size={13} />
          </div>
          <div className="flex-1">
            <textarea ref={inputRef} value={text} onChange={e => setText(e.target.value)}
              placeholder={mode === 'reply'
                ? 'Reply to the student — they will see this on their portal'
                : 'Add a note — what happened, what’s next, what the next person should know…'}
              rows={2}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(e); }}
              className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 resize-none
                ${mode === 'reply' ? 'border-emerald-200 bg-emerald-50/30 focus:ring-emerald-400' : 'border-slate-200 focus:ring-blue-500'}`} />
            <div className="flex items-center justify-between mt-1.5">
              <div className="flex gap-1 bg-slate-100 p-0.5 rounded-lg">
                <button type="button" onClick={() => setMode('note')}
                  className={`text-[11px] font-medium px-2 py-1 rounded ${mode === 'note' ? 'bg-white shadow-sm text-slate-700' : 'text-slate-500'}`}>
                  Internal note
                </button>
                <button type="button" onClick={() => setMode('reply')}
                  className={`text-[11px] font-medium px-2 py-1 rounded ${mode === 'reply' ? 'bg-white shadow-sm text-emerald-700' : 'text-slate-500'}`}>
                  Reply to student
                </button>
              </div>
              <button type="submit" disabled={posting || !text.trim()}
                className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg disabled:opacity-50 text-white
                  ${mode === 'reply' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
                <Send size={12} /> {posting ? 'Sending…' : (mode === 'reply' ? 'Send to student' : 'Post note')}
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* Feed */}
      {timeline.length === 0 ? (
        <div className="py-10 px-5 text-center">
          <Activity size={28} className="text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">No activity yet</p>
          <p className="text-xs text-slate-400 mt-1">Any change to this lead will appear here</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-50 max-h-[640px] overflow-y-auto">
          {timeline.map(a => <TimelineItem key={a.id} a={a} />)}
        </div>
      )}
    </div>
  );
}

function TimelineItem({ a }) {
  const meta = describe(a);
  let details = null;
  if (a.details) {
    try { const j = JSON.parse(a.details); details = j; }
    catch { details = a.details; }
  }
  return (
    <div className="flex items-start gap-3 px-5 py-4 hover:bg-slate-50/60">
      <div className={`p-2 rounded-lg flex-shrink-0 ${meta.bg}`}>{meta.icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-700 leading-snug">
          {a.actor_name && <strong className="text-slate-800">{a.actor_name}</strong>}{' '}{meta.text}
        </p>
        {a.type === 'note' && (
          <div className="mt-1 p-3 bg-amber-50 border border-amber-100 rounded-lg text-sm text-amber-900 whitespace-pre-wrap">
            {typeof details === 'string' ? details : a.details}
          </div>
        )}
        {a.type === 'reply_to_student' && (
          <div className="mt-1 p-3 bg-emerald-50 border border-emerald-100 rounded-lg text-sm text-emerald-900 whitespace-pre-wrap">
            {typeof details === 'string' ? details : a.details}
          </div>
        )}
        {a.type !== 'note' && typeof details === 'object' && details && (
          <div className="text-[11px] text-slate-400 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
            {Object.entries(details).filter(([k, v]) => v != null && v !== '').slice(0, 4).map(([k, v]) => (
              <span key={k}><strong className="text-slate-500">{k}:</strong> {String(v).slice(0, 60)}</span>
            ))}
          </div>
        )}
        <p className="text-[11px] text-slate-400 mt-1" title={fullDate(a.created_at)}>{timeAgo(a.created_at)}</p>
      </div>
    </div>
  );
}

function describe(a) {
  const v = a.to_value, from = a.from_value;
  switch (a.type) {
    case 'lead_created':
      return { icon: <UserPlus size={14}/>, bg: 'bg-blue-50 text-blue-600',
               text: <>added this lead</> };
    case 'lead_status_changed':
      return { icon: <Tag size={14}/>, bg: 'bg-violet-50 text-violet-600',
               text: <>moved status: <strong>{from || '—'}</strong> → <strong>{v || '—'}</strong></> };
    case 'lead_assigned':
      return { icon: <User size={14}/>, bg: 'bg-indigo-50 text-indigo-600',
               text: <>assigned to <strong>{v || '—'}</strong>{from ? <> (was {from})</> : null}</> };
    case 'lead_payment':
      return { icon: <DollarSign size={14}/>, bg: 'bg-emerald-50 text-emerald-600',
               text: <>recorded a payment of <strong>{fmtFull(a.amount)}</strong></> };
    case 'payment_recorded':
      return { icon: <Receipt size={14}/>, bg: 'bg-emerald-50 text-emerald-600',
               text: <>logged income of <strong>{fmtFull(a.amount)}</strong></> };
    case 'application_stage_changed':
      return { icon: <Plane size={14}/>, bg: 'bg-orange-50 text-orange-600',
               text: <>advanced application: <strong>{from || '—'}</strong> → <strong>{v || '—'}</strong></> };
    case 'uni_app_status':
      return { icon: <Building2 size={14}/>, bg: 'bg-violet-50 text-violet-600',
               text: <>updated a university application: <strong>{from || '—'}</strong> → <strong>{v || '—'}</strong></> };
    case 'note':
      return { icon: <MessageSquare size={14}/>, bg: 'bg-amber-50 text-amber-600',
               text: <>added a note</> };
    case 'reply_to_student':
      return { icon: <Send size={14}/>, bg: 'bg-emerald-50 text-emerald-600',
               text: <>replied to the student</> };
    case 'student_doc_upload':
      return { icon: <Receipt size={14}/>, bg: 'bg-violet-50 text-violet-600',
               text: <>uploaded a document via the portal</> };
    default:
      return { icon: <Activity size={14}/>, bg: 'bg-slate-100 text-slate-500',
               text: <>{a.type.replace(/_/g, ' ')}</> };
  }
}
