/* StudentPortal — the public-facing page a student sees at /s/<token>.
   No login. Designed to feel like a status tracker (think: parcel delivery).
   - Shows their progress through the application stages.
   - Lists the universities they've applied to and the per-university status.
   - Shows the document checklist. Items marked "requested from student"
     get a paste-link box so the student can submit a Google Drive share URL.
   - A simple message box that creates a note on the staff side.
   Polls every 60 seconds so updates appear without a refresh. */
import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api';
import {
  GraduationCap, CheckCircle2, Clock, ExternalLink, AlertCircle, FileText,
  Building2, Send, Plane, MapPin, Calendar, Phone, RefreshCw, Upload, Heart,
  AlertTriangle,
} from 'lucide-react';

const UNI_STATUS_LABEL = {
  documents: 'Collecting documents', ready: 'Ready to submit',
  submitted: 'Application submitted', admitted: 'Admitted — offer letter received',
  returned: 'Returned for correction', rejected: 'Not selected',
};
const UNI_STATUS_CLS = {
  documents: 'bg-slate-100 text-slate-700',
  ready:     'bg-blue-100 text-blue-700',
  submitted: 'bg-violet-100 text-violet-700',
  admitted:  'bg-emerald-100 text-emerald-700',
  returned:  'bg-amber-100 text-amber-700',
  rejected:  'bg-rose-100 text-rose-700',
};
const DOC_STATUS_LABEL = {
  pending:      'Pending',
  received:     'Received',
  verified:     'Verified',
  rejected:     'Needs to be re-sent',
  not_required: 'Not required',
};
const ensureAbsoluteUrl = (url) => {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  return 'https://' + url;
};

export default function StudentPortal() {
  const { token } = useParams();
  const [data, setData]       = useState(null);
  const [thread, setThread]   = useState([]);
  const [error, setError]     = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const [d, t] = await Promise.all([
        api.studentPortal(token),
        api.studentThread(token).catch(() => []),
      ]);
      setData(d); setThread(t || []); setError(null);
    }
    catch (e) { setError(e.message || 'This portal link is no longer active.'); }
    if (!silent) setRefreshing(false);
  };

  useEffect(() => { load(); }, [token]);
  useEffect(() => {
    const t = setInterval(() => { if (!document.hidden) load(true); }, 60000);
    return () => clearInterval(t);
  }, [token]);

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-10 max-w-md text-center">
          <AlertCircle size={36} className="text-rose-400 mx-auto mb-3" />
          <h1 className="text-xl font-bold text-slate-800 mb-1">Portal unavailable</h1>
          <p className="text-sm text-slate-500">{error}</p>
          <p className="text-xs text-slate-400 mt-4">Please contact your EduExpress consultant for help.</p>
        </div>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const { student, stages, universities, documents } = data;
  const stageIdx = stages.findIndex(s => s.key === student.application_stage);
  const currentStage = stages[stageIdx] || stages[0];
  const requested = documents.filter(d => d.requested_by_student && d.status !== 'verified');
  const submitted = documents.filter(d => !d.requested_by_student || d.status === 'verified' || d.status === 'received');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Top bar */}
      <header className="bg-white border-b border-slate-100 shadow-sm">
        <div className="max-w-4xl mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-blue-700 rounded-lg flex items-center justify-center shadow-sm">
              <GraduationCap size={18} className="text-white" />
            </div>
            <div>
              <p className="font-bold text-slate-800 text-sm">EduExpress International</p>
              <p className="text-xs text-slate-400">Student Application Portal</p>
            </div>
          </div>
          <button onClick={() => load()} disabled={refreshing}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50">
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-5 py-8 space-y-6">
        {/* Greeting */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Welcome</p>
              <h1 className="text-2xl font-bold text-slate-800">{student.name}</h1>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className="font-mono text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded">Ref: {student.ref_id}</span>
                {student.destination && (
                  <span className="text-xs flex items-center gap-1 text-slate-600">
                    <MapPin size={12} /> Study in {student.destination}
                  </span>
                )}
                {student.degree && <span className="text-xs text-slate-600">· {student.degree}</span>}
                {student.intake_term && <span className="text-xs text-slate-600">· {student.intake_term} intake</span>}
              </div>
            </div>
            {student.drive_link && (
              <a href={ensureAbsoluteUrl(student.drive_link)} target="_blank" rel="noreferrer"
                className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 px-3 py-2 rounded-lg border border-blue-200">
                <ExternalLink size={13} /> Your file folder
              </a>
            )}
          </div>
        </section>

        {/* Stage progress */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-800 flex items-center gap-2">
              <Plane size={16} /> Where you are in the journey
            </h2>
            <span className="text-xs font-bold bg-blue-50 text-blue-700 px-2 py-1 rounded-full">
              Current: {currentStage?.label || '—'}
            </span>
          </div>
          <ol className="space-y-3">
            {stages.map((s, i) => {
              const past = i < stageIdx, here = i === stageIdx;
              return (
                <li key={s.key} className="flex items-start gap-3">
                  <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center
                    ${past ? 'bg-emerald-500 text-white' : here ? 'bg-blue-600 text-white ring-4 ring-blue-100' : 'bg-slate-200 text-slate-400'}`}>
                    {past ? <CheckCircle2 size={14} /> : <span className="text-xs font-bold">{i + 1}</span>}
                  </div>
                  <div className="flex-1 pt-0.5">
                    <p className={`text-sm font-medium ${here ? 'text-blue-700' : past ? 'text-slate-600' : 'text-slate-400'}`}>
                      {s.label}
                    </p>
                    {here && student.visa_deadline && s.key.includes('visa') && (
                      <p className="text-xs text-rose-600 mt-0.5"><AlertTriangle size={11} className="inline mr-0.5" /> Visa deadline: {student.visa_deadline}</p>
                    )}
                    {here && student.departure_date && s.key === 'departed' && (
                      <p className="text-xs text-slate-500 mt-0.5">Departure: {student.departure_date}</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        {/* Universities */}
        {universities.length > 0 && (
          <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <h2 className="font-semibold text-slate-800 flex items-center gap-2 mb-4">
              <Building2 size={16} /> Your university applications ({universities.length})
            </h2>
            <div className="space-y-2">
              {universities.map(u => (
                <div key={u.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-100">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-800 text-sm truncate">{u.university}</p>
                    <p className="text-xs text-slate-500">
                      {u.program ? `${u.program}` : ''}
                      {u.application_id && (<> · App ID: <span className="font-mono">{u.application_id}</span></>)}
                      {u.submitted_on && (<> · Submitted {u.submitted_on}</>)}
                      {u.decision_on && (<> · Decided {u.decision_on}</>)}
                    </p>
                  </div>
                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${UNI_STATUS_CLS[u.status] || ''}`}>
                    {UNI_STATUS_LABEL[u.status] || u.status}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Documents requested */}
        {requested.length > 0 && (
          <section className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
            <h2 className="font-semibold text-amber-900 flex items-center gap-2 mb-1">
              <Upload size={16} /> Please send these documents ({requested.length})
            </h2>
            <p className="text-xs text-amber-800 mb-4">
              Upload each one to your own Google Drive (or any file host), set the share to "anyone with the link", then paste the link below.
            </p>
            <div className="space-y-3">
              {requested.map(d => <RequestedDoc key={d.id} doc={d} token={token} onUpdated={load} />)}
            </div>
          </section>
        )}

        {/* Submitted documents */}
        {submitted.length > 0 && (
          <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <h2 className="font-semibold text-slate-800 flex items-center gap-2 mb-3">
              <FileText size={16} /> All documents
            </h2>
            <div className="space-y-1.5">
              {submitted.map(d => (
                <div key={d.id} className="flex items-center justify-between gap-3 p-2.5 rounded-lg hover:bg-slate-50 text-sm">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <FileText size={14} className="text-slate-400 flex-shrink-0" />
                    <span className="text-slate-700 truncate">{d.doc_type}</span>
                    {d.student_uploaded_url && (
                      <a href={ensureAbsoluteUrl(d.student_uploaded_url)} target="_blank" rel="noreferrer"
                        className="text-blue-600 hover:underline text-xs flex items-center gap-0.5">
                        <ExternalLink size={11} /> link
                      </a>
                    )}
                  </div>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${d.status === 'verified' ? 'bg-emerald-100 text-emerald-700' : d.status === 'received' ? 'bg-blue-100 text-blue-700' : d.status === 'rejected' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'}`}>
                    {DOC_STATUS_LABEL[d.status] || d.status}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Conversation thread with staff */}
        <ConversationThread token={token} consultant={student.assigned_consultant} studentName={student.name} thread={thread} onSent={() => load(true)} />

        <p className="text-center text-xs text-slate-400 pb-6">
          Updates live · Last refreshed {new Date(data.updated_at).toLocaleTimeString()} ·
          For urgent matters, contact your consultant{student.assigned_consultant ? ` ${student.assigned_consultant}` : ''}.
        </p>
      </main>
    </div>
  );
}

function RequestedDoc({ doc, token, onUpdated }) {
  const [url, setUrl]       = useState(doc.student_uploaded_url || '');
  const [notes, setNotes]   = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');
  const [done, setDone]     = useState(!!doc.student_uploaded_url);

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setSaving(true);
    try { await api.studentUploadDoc(token, doc.id, url, notes || null); setDone(true); onUpdated?.(); }
    catch (err) { setError(err.message || 'Could not save'); }
    setSaving(false);
  };

  return (
    <div className="bg-white border border-amber-100 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="font-medium text-slate-800 text-sm">{doc.doc_type}</p>
        {done && <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">SENT</span>}
      </div>
      {doc.notes && <p className="text-xs text-slate-500 mb-2 italic">"{doc.notes}"</p>}
      <form onSubmit={submit} className="space-y-2">
        <input type="url" required value={url} onChange={e => setUrl(e.target.value)}
          placeholder="https://drive.google.com/…"
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
        <input value={notes} onChange={e => setNotes(e.target.value)}
          placeholder="Anything we should know about this file? (optional)"
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs" />
        {error && <div className="text-xs text-rose-600">{error}</div>}
        <div className="flex justify-end">
          <button type="submit" disabled={saving || !url.trim()}
            className="text-xs font-medium bg-amber-600 text-white px-3 py-1.5 rounded-lg hover:bg-amber-700 disabled:opacity-50 flex items-center gap-1.5">
            {saving ? 'Sending…' : done ? 'Update link' : 'Send to EduExpress'}
          </button>
        </div>
      </form>
    </div>
  );
}

function ConversationThread({ token, consultant, studentName, thread, onSent }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const [error, setError] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true); setError('');
    try { await api.studentMessage(token, text.trim()); setText(''); onSent?.(); }
    catch (err) { setError(err.message || 'Could not send. Please try again.'); }
    setSending(false);
  };

  // Only show real conversation entries (notes + replies). Skip auto doc-upload
  // logs which already appear in the documents section.
  const messages = thread.filter(m => m.type === 'note' || m.type === 'reply_to_student');

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
      <h2 className="font-semibold text-slate-800 flex items-center gap-2 mb-1">
        <Send size={16} /> Conversation
      </h2>
      <p className="text-xs text-slate-500 mb-4">
        Messages with {consultant ? <strong>{consultant}</strong> : 'your EduExpress team'}.
      </p>

      {messages.length === 0 ? (
        <p className="text-sm text-slate-400 italic text-center py-4">No messages yet — start the conversation below.</p>
      ) : (
        <div className="space-y-2.5 mb-4 max-h-[400px] overflow-y-auto">
          {messages.map(m => {
            const fromStudent = m.type === 'note' && m.actor_name?.includes('(Student)');
            const detail = parseDetail(m.details);
            const cleaned = fromStudent && typeof detail === 'string'
              ? detail.replace(/^\[via student portal\]\s*/, '')
              : detail;
            return (
              <div key={m.id} className={`flex ${fromStudent ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] px-3.5 py-2 rounded-2xl text-sm whitespace-pre-wrap
                  ${fromStudent ? 'bg-blue-500 text-white rounded-br-md' : 'bg-slate-100 text-slate-800 rounded-bl-md'}`}>
                  {!fromStudent && <p className="text-[10px] font-bold opacity-70 mb-0.5">{m.actor_name || 'EduExpress'}</p>}
                  <p>{typeof cleaned === 'string' ? cleaned : JSON.stringify(cleaned)}</p>
                  <p className={`text-[10px] mt-1 ${fromStudent ? 'text-blue-100' : 'text-slate-400'}`}>{new Date(m.created_at.endsWith('Z') ? m.created_at : m.created_at.replace(' ', 'T') + 'Z').toLocaleString()}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <form onSubmit={submit} className="space-y-2 border-t border-slate-100 pt-4">
        <textarea rows={2} value={text} onChange={e => setText(e.target.value)}
          placeholder="Type a message…"
          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        {error && <p className="text-xs text-rose-600">{error}</p>}
        <div className="flex justify-end">
          <button type="submit" disabled={sending || !text.trim()}
            className="text-xs font-medium bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5">
            <Send size={11} /> {sending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </form>
    </section>
  );
}

function parseDetail(d) {
  if (!d) return '';
  try { return JSON.parse(d); } catch { return d; }
}
