/* StudentPortal — the public-facing page a student sees at /s/<token>.
   No login. Designed to feel like a status tracker.
   - Shows their progress through the application stages.
   - Lists the universities they've applied to and the per-university status.
   - Shows the document checklist.
   - QR Code for sharing.
   - No hardcoded branding (White-label). */
import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api';
import {
  GraduationCap, CheckCircle2, ExternalLink, AlertCircle, FileText,
  Building2, Send, Plane, MapPin, RefreshCw, Upload, AlertTriangle, QrCode, X, Share2, Download
} from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';

const UNI_STATUS_LABEL = {
  documents: 'Collecting documents', ready: 'Ready to submit',
  submitted: 'Application submitted', admitted: 'Admitted — offer letter received',
  returned: 'Returned for correction', rejected: 'Not selected',
};
const UNI_STATUS_CLS = {
  documents: 'bg-slate-100 text-slate-700',
  ready:     'bg-blue-100 text-blue-700 border-blue-200',
  submitted: 'bg-violet-100 text-violet-700 border-violet-200',
  admitted:  'bg-emerald-100 text-emerald-700 border-emerald-200',
  returned:  'bg-amber-100 text-amber-700 border-amber-200',
  rejected:  'bg-rose-100 text-rose-700 border-rose-200',
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
  const [showQR, setShowQR] = useState(false);

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

  useEffect(() => {
    if (data?.student?.client_name) {
      document.title = `${data.student.client_name} - Student Portal`;
    } else {
      document.title = "Student Portal";
    }
  }, [data]);

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 flex items-center justify-center p-4 font-sans">
        <div className="bg-white rounded-3xl shadow-xl p-10 max-w-md text-center border border-slate-100">
          <AlertCircle size={40} className="text-rose-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Portal unavailable</h1>
          <p className="text-slate-500">{error}</p>
          <p className="text-sm text-slate-400 mt-6">Please contact your consultant for assistance.</p>
        </div>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-10 h-10 border-4 border-slate-300 border-t-slate-700 rounded-full animate-spin" />
      </div>
    );
  }

  const { student, stages, universities, documents } = data;
  const stageIdx = stages.findIndex(s => s.key === student.application_stage);
  const currentStage = stages[stageIdx] || stages[0];
  const requested = documents.filter(d => d.requested_by_student && d.status !== 'verified');
  const submitted = documents.filter(d => !d.requested_by_student || d.status === 'verified' || d.status === 'received');
  const consultant = student.assigned_consultant;
  
  const portalUrl = window.location.href;

  const downloadQR = () => {
    const canvas = document.getElementById('student-qr-code');
    if (canvas) {
      const pngUrl = canvas.toDataURL('image/png').replace('image/png', 'image/octet-stream');
      const downloadLink = document.createElement('a');
      downloadLink.href = pngUrl;
      downloadLink.download = `${student.name}_Portal_QR.png`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans selection:bg-blue-100 selection:text-blue-900 pb-20">
      {/* Top bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm backdrop-blur-md bg-white/90">
        <div className="max-w-5xl mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center shadow-md">
              <GraduationCap size={20} className="text-white" />
            </div>
            <div>
              <p className="font-bold text-slate-900 text-sm tracking-tight">Application Portal</p>
              <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wider">Status Tracker</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowQR(true)}
              className="flex items-center justify-center w-9 h-9 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
              title="Share Portal">
              <QrCode size={18} />
            </button>
            <button onClick={() => load()} disabled={refreshing}
              className="flex items-center justify-center w-9 h-9 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
              title="Refresh">
              <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-5 py-8 space-y-8">
        
        {/* Profile Card */}
        <section className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden relative">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-slate-700 to-slate-900"></div>
          <div className="p-8">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">Applicant Profile</p>
            <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight">{student.name}</h1>
            
            <div className="flex flex-wrap items-center gap-3 mt-4">
              <span className="font-mono text-sm bg-slate-100 border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg font-medium shadow-sm">
                ID: {student.ref_id}
              </span>
              {student.destination && (
                <span className="text-sm font-medium flex items-center gap-1.5 text-slate-700 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg shadow-sm">
                  <MapPin size={14} className="text-slate-400"/> {student.destination}
                </span>
              )}
              {student.degree && (
                <span className="text-sm font-medium flex items-center gap-1.5 text-slate-700 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg shadow-sm">
                  <GraduationCap size={14} className="text-slate-400"/> {student.degree}
                </span>
              )}
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* LEFT COLUMN: Journey */}
          <div className="lg:col-span-1">
            <section className="bg-white rounded-3xl shadow-sm border border-slate-200 p-7">
              <div className="mb-6">
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Plane size={18} className="text-slate-400" /> Application Journey
                </h2>
              </div>
              
              <div className="relative ml-3 space-y-7">
                <div className="absolute top-2 bottom-2 left-[11px] w-[2px] bg-slate-100 rounded-full" />
                
                {stages.map((s, i) => {
                  const past = i < stageIdx, here = i === stageIdx;
                  
                  // Meaningful descriptions for the 12 stages
                  const descriptions = {
                    'documents': 'Gathering required files',
                    'ready': 'Files verified & ready',
                    'submitted': 'Application sent to universities',
                    'interview': 'University interview phase',
                    'pre_admission': 'Pending conditional offer',
                    'university_initial_deposit': 'Initial tuition deposit',
                    'admitted': 'Unconditional offer & JW202 received',
                    'visa_applied': 'Visa application filed',
                    'passport_collection': 'Visa approved & passport ready',
                    'payment': 'Final settlement clearance',
                    'air_ticket': 'Pre-departure & flight booking',
                    'fly': 'Arrival & university enrollment'
                  };
                  const desc = descriptions[s.key] || 'Stage in progress';
                  
                  return (
                    <div key={s.key} className="relative flex items-start gap-5 group">
                      <div className={`relative z-10 flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ring-4 ring-white transition-all duration-300 mt-0.5
                        ${past ? 'bg-emerald-500 text-white shadow-sm' : here ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 ring-blue-50 scale-110' : 'bg-slate-100 text-slate-400 border border-slate-200'}`}>
                        {past ? <CheckCircle2 size={12} strokeWidth={3} /> : <span className="text-[9px] font-bold">{i + 1}</span>}
                      </div>
                      
                      <div className={`flex-1 min-w-0 transition-all duration-300 ${here ? '-mt-2 p-3.5 bg-gradient-to-br from-blue-50 to-indigo-50/30 rounded-2xl border border-blue-100/60 shadow-sm' : ''}`}>
                        <p className={`text-sm font-bold tracking-tight ${here ? 'text-blue-900' : past ? 'text-slate-800' : 'text-slate-400'}`}>
                          {s.label}
                        </p>
                        <p className={`text-[11px] mt-0.5 font-medium ${here ? 'text-blue-600' : past ? 'text-slate-500' : 'text-slate-300'}`}>
                          {desc}
                        </p>
                        {here && student.visa_deadline && s.key.includes('visa') && (
                          <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-rose-700 bg-rose-50 border border-rose-100 px-2 py-1 rounded-md w-fit">
                            <AlertTriangle size={12} /> Deadline: {student.visa_deadline}
                          </div>
                        )}
                        {here && student.departure_date && s.key === 'fly' && (
                          <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-slate-700 bg-slate-100 border border-slate-200 px-2 py-1 rounded-md w-fit">
                            <Plane size={12} /> Departure: {student.departure_date}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          {/* RIGHT COLUMN: Universities, Docs, Messages */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Universities */}
            {universities.length > 0 && (
              <section className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="border-b border-slate-100 px-7 py-5 bg-slate-50/50">
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Building2 size={18} className="text-slate-400" /> University Applications
                  </h2>
                </div>
                <div className="p-7 space-y-4">
                  {universities.map(u => (
                    <div key={u.id} className="group relative p-5 rounded-2xl border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all duration-200 bg-white">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                        <div className="flex-1">
                          <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-700 transition-colors">{u.university}</h3>
                          <div className="mt-1.5 flex items-center gap-2 text-sm text-slate-600 font-medium bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-lg w-fit">
                            <span className="text-xs text-slate-400 uppercase tracking-wider font-bold">Major:</span>
                            <span>{u.program || student.major || 'General Program'}</span>
                          </div>
                          
                          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
                            {u.application_id && (
                              <div className="flex flex-col">
                                <span className="uppercase tracking-wider text-[10px] font-semibold text-slate-400 mb-0.5">App ID</span>
                                <span className="font-mono text-slate-700">{u.application_id}</span>
                              </div>
                            )}
                            {u.submitted_on && (
                              <div className="flex flex-col">
                                <span className="uppercase tracking-wider text-[10px] font-semibold text-slate-400 mb-0.5">Submitted</span>
                                <span className="text-slate-700">{u.submitted_on}</span>
                              </div>
                            )}
                            {u.decision_on && (
                              <div className="flex flex-col">
                                <span className="uppercase tracking-wider text-[10px] font-semibold text-slate-400 mb-0.5">Decision</span>
                                <span className="text-slate-700">{u.decision_on}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex-shrink-0">
                          <span className={`inline-flex items-center justify-center px-3 py-1.5 rounded-lg text-xs font-bold border ${UNI_STATUS_CLS[u.status] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                            {UNI_STATUS_LABEL[u.status] || u.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Requested Docs */}
            {requested.length > 0 && (
              <section className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-3xl overflow-hidden shadow-sm">
                <div className="px-7 py-5 border-b border-amber-200/60 flex items-center gap-2">
                  <Upload size={18} className="text-amber-600" />
                  <h2 className="text-lg font-bold text-amber-900">Action Required: Documents Needed</h2>
                </div>
                <div className="p-7">
                  <p className="text-sm text-amber-800 mb-6 bg-white/60 p-4 rounded-xl border border-amber-100">
                    Upload each document to your Google Drive, set the sharing permission to <strong>"Anyone with the link"</strong>, and paste the URL below.
                  </p>
                  <div className="space-y-4">
                    {requested.map(d => <RequestedDoc key={d.id} doc={d} token={token} onUpdated={load} />)}
                  </div>
                </div>
              </section>
            )}

            {/* Submitted Docs */}
            {submitted.length > 0 && (
              <section className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="border-b border-slate-100 px-7 py-5 bg-slate-50/50">
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <FileText size={18} className="text-slate-400" /> Document Repository
                  </h2>
                </div>
                <div className="p-7">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {submitted.map(d => (
                      <div key={d.id} className="flex flex-col gap-2 p-4 rounded-2xl border border-slate-100 hover:border-slate-200 bg-slate-50/50 transition-colors">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText size={16} className="text-blue-500 flex-shrink-0" />
                            <span className="text-sm font-semibold text-slate-800 truncate">{d.doc_type}</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-auto pt-2 border-t border-slate-100">
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md
                            ${d.status === 'verified' ? 'bg-emerald-100 text-emerald-700' :
                              d.status === 'received' ? 'bg-blue-100 text-blue-700' :
                                'bg-slate-200 text-slate-600'}`}>
                            {DOC_STATUS_LABEL[d.status] || d.status}
                          </span>
                          {d.student_uploaded_url && (
                            <a href={ensureAbsoluteUrl(d.student_uploaded_url)} target="_blank" rel="noreferrer"
                              className="text-blue-600 hover:text-blue-800 hover:underline text-xs flex items-center gap-1 font-medium">
                              View File <ExternalLink size={10} />
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {/* Thread */}
            <section className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
               <div className="border-b border-slate-100 px-7 py-5 bg-slate-50/50">
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Send size={18} className="text-slate-400" /> Messages
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Communicate directly with {consultant ? <strong className="text-slate-700">{consultant}</strong> : 'the admissions team'}.
                  </p>
                </div>
              
              <div className="p-7">
                <div className="space-y-4 mb-6 max-h-96 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-200">
                  {thread.length === 0 ? (
                    <p className="text-sm text-slate-400 italic text-center py-8">No messages yet.</p>
                  ) : (
                    thread.map(m => {
                      const fromStudent = m.author_type === 'student';
                      return (
                        <div key={m.id} className={`flex ${fromStudent ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[85%] rounded-2xl px-5 py-3 ${fromStudent ? 'bg-slate-800 text-white rounded-tr-sm' : 'bg-slate-100 text-slate-800 rounded-tl-sm'}`}>
                            {!fromStudent && <p className="text-[10px] font-bold opacity-50 mb-1 uppercase tracking-wider">{m.actor_name || 'Admissions Team'}</p>}
                            <p className="text-sm whitespace-pre-wrap leading-relaxed">{m.message}</p>
                            <p className={`text-[10px] mt-2 ${fromStudent ? 'text-slate-400' : 'text-slate-400'}`}>
                              {new Date(m.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
                <ThreadInput token={token} onSent={load} />
              </div>
            </section>

          </div>
        </div>
      </main>

      {/* QR Code Modal */}
      {showQR && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-5 border-b border-slate-100">
              <h3 className="font-bold text-slate-800">Share Portal</h3>
              <button onClick={() => setShowQR(false)} className="text-slate-400 hover:text-slate-700 p-1 rounded-full hover:bg-slate-100">
                <X size={20} />
              </button>
            </div>
            <div className="p-8 flex flex-col items-center">
              <div className="bg-white p-4 rounded-2xl border-2 border-slate-100 shadow-sm mb-6">
                <QRCodeCanvas 
                  id="student-qr-code"
                  value={portalUrl} 
                  size={200} 
                  level="H"
                  includeMargin={true}
                  bgColor="#ffffff"
                  fgColor="#0f172a" 
                />
              </div>
              <h4 className="text-xl font-bold text-slate-900 text-center">{student.name}</h4>
              <p className="text-sm font-medium text-slate-500 mt-1 mb-2 tracking-wide">ID: {student.ref_id}</p>
              {student.destination && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold bg-slate-100 text-slate-600 px-2.5 py-1 rounded-lg">
                  <MapPin size={12}/> {student.destination}
                </span>
              )}
            </div>
            <div className="p-5 bg-slate-50 border-t border-slate-100 flex gap-3">
               <button onClick={() => { navigator.clipboard.writeText(portalUrl); alert('Link copied!'); }}
                  className="flex-1 flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm hover:bg-slate-50 transition-colors">
                  <Share2 size={16} /> Copy Link
               </button>
               <button onClick={downloadQR}
                  className="flex-1 flex items-center justify-center gap-2 bg-slate-800 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm hover:bg-slate-700 transition-colors">
                  <Download size={16} /> Save QR
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RequestedDoc({ doc, token, onUpdated }) {
  const [url, setUrl] = useState(doc.student_uploaded_url || '');
  const [saving, setSaving] = useState(false);
  const done = !!doc.student_uploaded_url && doc.student_uploaded_url === url;

  const save = async () => {
    if (!url || done) return;
    setSaving(true);
    try {
      await api.studentSubmitDoc(token, doc.id, url);
      onUpdated(true);
    } catch (e) {
      alert(e.message);
    }
    setSaving(false);
  };

  return (
    <div className="bg-white p-5 rounded-2xl border border-amber-200 shadow-sm transition-all hover:shadow-md">
      <div className="flex items-center gap-2 mb-3">
        <FileText size={16} className="text-amber-600" />
        <p className="text-sm font-bold text-slate-800">{doc.doc_type}</p>
      </div>
      <div className="flex gap-2">
        <input type="url" placeholder="https://drive.google.com/..."
          value={url} onChange={e => setUrl(e.target.value)}
          className="flex-1 min-w-0 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all placeholder:text-slate-400" />
        <button onClick={save} disabled={saving || !url || done}
          className="bg-amber-600 hover:bg-amber-700 disabled:bg-amber-300 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-colors whitespace-nowrap shadow-sm">
          {saving ? 'Sending…' : done ? 'Update' : 'Submit Link'}
        </button>
      </div>
    </div>
  );
}

function ThreadInput({ token, onSent }) {
  const [msg, setMsg] = useState('');
  const [sending, setSending] = useState(false);

  const send = async (e) => {
    e.preventDefault();
    if (!msg.trim()) return;
    setSending(true);
    try {
      await api.studentSendMessage(token, msg);
      setMsg('');
      onSent(true);
    } catch (err) {
      alert(err.message);
    }
    setSending(false);
  };

  return (
    <form onSubmit={send} className="flex gap-3">
      <input type="text" placeholder="Type a message to the team..."
        value={msg} onChange={e => setMsg(e.target.value)}
        className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-5 py-3 text-sm focus:outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100 transition-all placeholder:text-slate-400" />
      <button type="submit" disabled={sending || !msg.trim()}
        className="bg-slate-800 hover:bg-slate-900 disabled:bg-slate-300 text-white px-6 rounded-xl font-bold transition-all shadow-sm flex items-center justify-center">
        <Send size={18} />
      </button>
    </form>
  );
}
