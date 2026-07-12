/* LeadDetail — one student's full chronological story.
   Three-column modern layout: Profile, Operations, and Timeline.
   Real-time: subscribes to the existing SSE feed and prepends any new activity
   for this lead instantly. */
import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import LeadForm from './LeadForm';
import { useToast } from '../components/Toast';
import { isFullAdmin } from '../lib/roles';
import {
  ArrowLeft, Pencil, Trash2, Phone, Mail, User, Hash,
  GraduationCap, Building2, FileText, DollarSign, Activity, Send, AlertCircle,
  ExternalLink, Globe, CreditCard, CheckCircle2,
  Tag, UserPlus, Receipt, Plane, MessageSquare, Loader2,
  Heart, FolderOpen, HeartPulse, Wallet, BookOpen, Calendar,
  Clock, Check, MapPin, ClipboardList, Stethoscope, Briefcase
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
  const isAgentUser = user?.roles?.includes('agent');
  const { id } = useParams();
  const navigate = useNavigate();
  const [lead, setLead]         = useState(null);

  useEffect(() => {
    if (lead) {
      document.title = `${lead.client_name} - Profile | EduExpress Core`;
    } else {
      document.title = "Client Profile | EduExpress Core";
    }
  }, [lead]);

  const [timeline, setTimeline] = useState([]);
  const [docs, setDocs]         = useState([]);
  const [unis, setUnis]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [editing, setEditing]   = useState(false);
  const [settings, setSettings] = useState(null);
  const [stages, setStages]     = useState([]);
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
  useEffect(() => {
    api.settings().then(setSettings).catch(() => {});
    api.applicationMeta().then(d => setStages(d.stages)).catch(() => {});
  }, []);

  // Real-time: prepend any new activity for this lead as it happens
  useEffect(() => {
    if (!lead?.id) return;
    const es = new EventSource('/api/events', { withCredentials: true });
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
  const [startingChat, setStartingChat] = useState(false);

  const handleStartCRMChat = async () => {
    if (!lead?.phone) {
      toast.error('This lead does not have a phone number.');
      return;
    }
    setStartingChat(true);
    try {
      const activeChannels = await api.channels();
      if (!activeChannels || activeChannels.length === 0) {
        toast.error('No messaging channels configured. Please add one in settings.');
        return;
      }
      // Prefer whatsapp, then messenger, then any
      const channel = activeChannels.find(c => c.type === 'whatsapp') || 
                      activeChannels.find(c => c.type === 'messenger') || 
                      activeChannels[0];
      
      const conv = await api.createConversation({
        channel_id: channel.id,
        phone: lead.phone,
        name: lead.client_name,
        lead_id: lead.id
      });
      
      toast.success('Conversation initiated!');
      navigate(`/conversations?id=${conv.id}`);
    } catch (err) {
      toast.error('Failed to start CRM chat: ' + err.message);
    } finally {
      setStartingChat(false);
    }
  };

  const handleDelete = async () => {
    try { await api.deleteLead(lead.id); toast.success(`${lead.client_name} deleted`); navigate('/leads'); }
    catch (e) { toast.error(e.message || 'Could not delete'); }
  };

  if (loading && !lead) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 size={36} className="text-indigo-500 animate-spin" />
      </div>
    );
  }
  if (error || !lead) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center max-w-xl mx-auto shadow-sm mt-10">
        <AlertCircle size={48} className="text-rose-400 mx-auto mb-4" />
        <p className="text-slate-700 font-bold text-lg mb-2">{error || 'Lead not found'}</p>
        <p className="text-slate-500 text-sm mb-6">The lead you are trying to view doesn't exist or you don't have permission to see it.</p>
        <Link to="/leads" className="inline-flex items-center justify-center gap-2 bg-slate-900 text-white font-semibold px-6 py-3 rounded-xl hover:bg-slate-800 transition-colors">
          <ArrowLeft size={16} /> Back to Leads
        </Link>
      </div>
    );
  }

  const balance = (lead.service_fee || 0) - (lead.paid || 0);
  const docsReceived = docs.filter(d => ['received', 'verified'].includes(d.status)).length;
  const unisAdmitted = unis.filter(u => u.status === 'admitted').length;

  const initials = (lead.client_name || 'C').substring(0, 2).toUpperCase();

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12 px-4 sm:px-6 lg:px-8 xl:px-0">
      
      {/* ── Hero Header ── */}
      <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-50/50 to-indigo-50/30" />
        <div className="relative px-6 py-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          {/* Left: Identity */}
          <div className="flex items-center gap-5 min-w-0">
            <button onClick={() => navigate(-1)} className="p-3 bg-white shadow-sm border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-2xl transition-all active:scale-95" aria-label="Go back">
              <ArrowLeft size={20} />
            </button>
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 shadow-lg shadow-blue-200 flex items-center justify-center text-white text-2xl sm:text-3xl font-black flex-shrink-0">
              {initials}
            </div>
            <div className="min-w-0 flex flex-col gap-1.5">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-800 tracking-tight truncate">{lead.client_name}</h2>
                <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-100 px-2.5 py-1 rounded-lg shadow-sm border border-indigo-200">{lead.lead_id}</span>
                <StatusBadge status={lead.lead_status} />
              </div>
              <div className="flex items-center gap-4 text-sm text-slate-500 font-medium flex-wrap">
                {lead.phone && (
                  <a href={`https://wa.me/${lead.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" 
                     className="flex items-center gap-1.5 hover:text-emerald-600 transition-colors group">
                    <Phone size={14} className="group-hover:scale-110 transition-transform"/> {lead.phone}
                  </a>
                )}
                {lead.email && (
                  <span className="flex items-center gap-1.5"><Mail size={14}/> {lead.email}</span>
                )}
                <span className="flex items-center gap-1.5"><Calendar size={14}/> Added {lead.date_added || 'Unknown'}</span>
              </div>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-3 flex-wrap w-full md:w-auto mt-2 md:mt-0">
            {lead.phone && (
              <button disabled={startingChat} onClick={handleStartCRMChat}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-3 sm:py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 rounded-xl transition-all shadow-sm shadow-indigo-200 active:scale-95">
                {startingChat ? <Loader2 size={18} className="animate-spin" /> : <MessageSquare size={18} />}
                CRM Chat
              </button>
            )}
            {lead.drive_link && (
              <a href={ensureAbsoluteUrl(lead.drive_link)} target="_blank" rel="noreferrer"
                className="flex-1 md:flex-none flex items-center justify-center gap-2 text-sm font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 px-4 py-3 sm:py-2.5 rounded-xl border border-blue-200 shadow-sm transition-all active:scale-95">
                <ExternalLink size={18} /> Drive
              </a>
            )}
            <button onClick={() => setEditing(true)}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 text-sm font-bold text-slate-700 bg-white hover:bg-slate-50 px-4 py-3 sm:py-2.5 rounded-xl border border-slate-200 shadow-sm transition-all active:scale-95">
              <Pencil size={18} /> Edit
            </button>
            {isFullAdmin(user) && (
              <button onClick={() => setDeleteOpen(true)}
                className="flex items-center justify-center p-3 sm:p-2.5 text-rose-600 bg-white hover:bg-rose-50 rounded-xl border border-rose-200 shadow-sm transition-all active:scale-95" aria-label="Delete">
                <Trash2 size={20} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Financial & Operations Summary (Top Stats Row) ── */}
      {!isAgentUser && (
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-4">
          <StatCard label="Service fee" value={fmt(lead.service_fee)} icon={<DollarSign size={22}/>} color="blue" />
          <StatCard label="Total Paid" value={fmt(lead.paid)} icon={<CheckCircle2 size={22}/>} color="emerald"
                    sub={lead.deposit ? `Includes Deposit: ${fmtFull(lead.deposit)}` : 'No deposit'} />
          <StatCard label="Balance Due" value={fmt(balance)} icon={<CreditCard size={22}/>} color={balance > 0 ? 'rose' : 'slate'} />
          <StatCard label="Payment Status" value={lead.payment_status || 'Pending'} icon={<Wallet size={22}/>} 
                    color={lead.payment_status === 'Paid' ? 'emerald' : lead.payment_status === 'Partial' ? 'amber' : 'slate'} 
                    valueClass={lead.payment_status === 'Paid' ? 'text-emerald-600' : lead.payment_status === 'Partial' ? 'text-amber-600' : 'text-slate-600'} />
          <StatCard label="Documents" value={`${docsReceived}/${docs.length}`} icon={<FileText size={22}/>} color="violet" className="col-span-2 md:col-span-4 xl:col-span-1"
                    sub={unis.length > 0 ? `${unisAdmitted}/${unis.length} unis admitted` : 'No applications yet'} />
        </div>
      )}

      {/* ── Main Layout: 3 Columns ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: Profile & Academics */}
        <div className="lg:col-span-4 space-y-6">
          <Card title="Personal Details" icon={<User size={18}/>} color="blue">
             <div className="grid grid-cols-2 gap-4">
               <DataField label="Nationality" value={lead.nationality} />
               <DataField label="Passport Number" value={lead.passport} mono />
             </div>
             <div className="h-px bg-slate-100 my-1" />
             <div className="grid grid-cols-2 gap-4">
               <DataField label="Date of Birth" value={lead.date_of_birth} />
               <DataField label="Age" value={lead.age ? `${lead.age} years` : null} />
             </div>
          </Card>

          <Card title="Academic Background" icon={<GraduationCap size={18}/>} color="orange">
            <div className="grid grid-cols-2 gap-4">
              <DataField label="Last Education" value={lead.last_education} />
              <DataField label="Major/Group" value={lead.last_education_major} />
            </div>
            <div className="h-px bg-slate-100 my-1" />
            <div className="grid grid-cols-2 gap-4">
              <DataField label="GPA / Result" value={lead.gpa} />
              <DataField label="Passing Year" value={lead.passing_year} />
            </div>
            <div className="h-px bg-slate-100 my-1" />
            <div className="grid grid-cols-2 gap-4">
              <DataField label="English Test" value={lead.english_test_type} />
              <DataField label="Test Score" value={lead.english_score} />
            </div>
          </Card>

          <Card title="Medical & Emergency" icon={<Stethoscope size={18}/>} color="rose">
            <div className="grid grid-cols-2 gap-4">
              <DataField label="Blood Group" value={lead.blood_group} />
              <DataField label="Height / Weight" value={lead.height || lead.weight ? `${lead.height || '-'} / ${lead.weight || '-'}` : null} />
            </div>
            <div className="h-px bg-slate-100 my-1" />
            <DataField label="Emergency Contact" value={lead.emergency_contact} />
            {lead.medical_notes && (
              <div className="mt-3 p-4 bg-rose-50/50 rounded-2xl border border-rose-100">
                <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider mb-2 block flex items-center gap-1.5"><AlertCircle size={14}/> Medical Notes</span>
                <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{lead.medical_notes}</p>
              </div>
            )}
          </Card>
        </div>

        {/* CENTER COLUMN: CRM, Target Program, Documents */}
        <div className="lg:col-span-4 space-y-6">
          
          {!isAgentUser && (
            <Card title="Sales & Operations" icon={<Briefcase size={18}/>} color="indigo">
              <div className="bg-indigo-50/80 rounded-2xl p-5 border border-indigo-100 mb-5 shadow-sm">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold text-indigo-500 uppercase tracking-wider">Next Follow-up</span>
                  <Clock size={16} className="text-indigo-500" />
                </div>
                <p className={`text-base font-black ${new Date(lead.next_followup) < new Date() ? 'text-rose-600' : 'text-indigo-900'}`}>
                  {lead.next_followup ? new Date(lead.next_followup).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }) : 'Not scheduled'}
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-y-5 gap-x-4">
                <DataField label="Assigned To" value={lead.assigned_consultant || 'Unassigned'} />
                <DataField label="Referrer / Agent" value={lead.referrer || 'None'} />
              </div>
              <div className="h-px bg-slate-100 my-1" />
              <div className="grid grid-cols-2 gap-y-5 gap-x-4">
                <DataField label="Lead Source" value={lead.lead_source} badge={lead.lead_source === 'WhatsApp' ? 'emerald' : lead.lead_source === 'Messenger' ? 'blue' : 'slate'} />
                <DataField label="Page Name" value={lead.page_name} />
                <DataField label="Lead Market" value={lead.lead_market} />
                <DataField label="Lead Type" value={lead.lead_type} />
              </div>
            </Card>
          )}

          <Card title="Target Program" icon={<Plane size={18}/>} color="violet">
            <div className="grid grid-cols-2 gap-4">
              <DataField label="Destination" value={lead.destination} badge="violet" />
              <DataField label="Intake Term" value={lead.intake_term} />
            </div>
            <div className="h-px bg-slate-100 my-1" />
            <div className="grid grid-cols-2 gap-4">
              <DataField label="Target Degree" value={lead.degree} />
              <DataField label="Target Major" value={lead.major || lead.program} />
            </div>
            <div className="h-px bg-slate-100 my-1" />
            <DataField label="University Pref" value={lead.university} />
          </Card>

          <Card title="Application & File Status" icon={<ClipboardList size={18}/>} color="emerald">
            <div className="mb-5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">Application Stage</span>
              {(lead.lead_status === 'File Opened' || lead.lead_status === 'Enrolled') ? (
                <div className="inline-block" onClick={e => e.stopPropagation()}>
                  <InlineStageSelect
                    value={lead.application_stage}
                    stages={stages}
                    onChange={async (newStage) => {
                      try {
                        await api.updateStage(lead.id, { stage: newStage });
                        toast.success(`Updated stage to ${stages.find(s => s.key === newStage)?.label || newStage}`);
                        load();
                      } catch (e) {
                        toast.error(e.message || 'Could not change stage');
                      }
                    }}
                  />
                </div>
              ) : <span className="text-xs text-slate-500 font-medium bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">Not started yet (Lead status is {lead.lead_status})</span>}
            </div>
            
            <div className="h-px bg-slate-100 my-2" />
            
            <div className="grid grid-cols-2 gap-4 mt-4">
              <DataField label="Payment Agreement" value={lead.payment_agreement} />
              <DataField label="Hardcopy Status" value={lead.hardcopy_status} badge={lead.hardcopy_status === 'Received (In Office)' ? 'emerald' : 'slate'} />
            </div>
            
            {lead.hardcopy_status === 'Received (In Office)' && lead.hardcopy_documents && (
              <div className="mt-4 p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100">
                <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-1 block">Received Documents</span>
                <p className="text-sm text-slate-800 font-medium whitespace-pre-wrap">{lead.hardcopy_documents}</p>
              </div>
            )}
          </Card>

          {unis.length > 0 && (
            <Card title={`Universities (${unis.length})`} icon={<Building2 size={18}/>} color="blue" padding="p-0">
              <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                {unis.map(u => (
                  <div key={u.id} className="p-4 px-5 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div className="min-w-0 flex-1 pr-4">
                      <p className="font-bold text-slate-800 text-sm truncate">{u.university}</p>
                      {u.program && <p className="text-xs font-medium text-slate-500 truncate mt-0.5">{u.program}</p>}
                    </div>
                    <span className={`text-[10px] font-black px-2.5 py-1.5 rounded-lg capitalize whitespace-nowrap border ${UNI_STATUS_CLS[u.status] || ''}`}>
                      {u.status}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {docs.length > 0 && (
            <Card title={`Documents (${docsReceived}/${docs.length})`} icon={<FolderOpen size={18}/>} color="teal" padding="p-0">
              <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                {docs.slice(0, 8).map(d => (
                  <div key={d.id} className="p-3.5 px-5 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <span className="text-sm font-semibold text-slate-700 truncate pr-4">{d.doc_type}</span>
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border capitalize whitespace-nowrap ${DOC_STATUS_CLS[d.status] || ''}`}>
                      {d.status === 'not_required' ? 'N/A' : d.status}
                    </span>
                  </div>
                ))}
                {docs.length > 8 && (
                  <div className="p-4 bg-slate-50 text-center border-t border-slate-100">
                    <Link to="/applications" className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline inline-flex items-center gap-1">
                      View all {docs.length} documents <ArrowLeft size={12} className="rotate-180" />
                    </Link>
                  </div>
                )}
              </div>
            </Card>
          )}
          
          {lead.notes && (
            <Card title="Lead Notes" icon={<MessageSquare size={18}/>} color="amber">
              <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed font-medium">{lead.notes}</p>
            </Card>
          )}
        </div>

        {/* RIGHT COLUMN: Activity Timeline */}
        <div className="lg:col-span-4 h-full min-h-[500px]">
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
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-8 border border-slate-200">
            <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mb-5 mx-auto">
              <AlertCircle size={32} />
            </div>
            <h3 className="text-xl font-bold text-slate-800 text-center mb-2">Delete this lead?</h3>
            <p className="text-sm text-slate-500 text-center mb-8">
              <strong>{lead.client_name}</strong> ({lead.lead_id}) and all its history will be permanently removed. This action cannot be undone.
            </p>
            <div className="flex justify-center gap-3">
              <button onClick={() => setDeleteOpen(false)} className="text-sm font-semibold px-6 py-2.5 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors">Cancel</button>
              <button onClick={handleDelete} className="text-sm font-semibold px-6 py-2.5 rounded-xl bg-rose-600 text-white hover:bg-rose-700 shadow-sm shadow-rose-200 transition-colors">Delete Permanently</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── UI Primitives ─── */

function StatCard({ icon, label, value, sub, color, className = '', valueClass = '' }) {
  const colors = {
    blue:    'bg-blue-50 text-blue-600 ring-blue-100 from-blue-50 to-blue-100/50',
    emerald: 'bg-emerald-50 text-emerald-600 ring-emerald-100 from-emerald-50 to-emerald-100/50',
    violet:  'bg-violet-50 text-violet-600 ring-violet-100 from-violet-50 to-violet-100/50',
    rose:    'bg-rose-50 text-rose-600 ring-rose-100 from-rose-50 to-rose-100/50',
    slate:   'bg-slate-50 text-slate-500 ring-slate-200 from-slate-50 to-slate-100/50',
    amber:   'bg-amber-50 text-amber-600 ring-amber-100 from-amber-50 to-amber-100/50',
  };
  return (
    <div className={`bg-white rounded-3xl p-6 flex flex-col justify-between shadow-sm border border-slate-200 hover:shadow-md transition-all relative overflow-hidden group ${className}`}>
      <div className={`absolute -right-6 -top-6 w-32 h-32 rounded-full opacity-30 bg-gradient-to-br group-hover:scale-125 transition-transform duration-500 ${colors[color].split(' ').slice(-2).join(' ')}`} />
      
      <div className="flex items-start gap-4 relative z-10">
        <div className={`p-3.5 rounded-2xl ring-1 shadow-sm bg-white bg-opacity-60 backdrop-blur-sm ${colors[color].split(' ').slice(0, 3).join(' ')}`}>
          {icon}
        </div>
        <div className="min-w-0 pt-0.5">
          <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider mb-1">{label}</p>
          <p className={`text-2xl sm:text-3xl font-black leading-tight tracking-tight ${valueClass || 'text-slate-800'}`}>{value}</p>
          {sub && <p className="text-[11px] text-slate-500 font-medium mt-1 truncate">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

function Card({ title, icon, children, color = 'blue', glass = false, padding = 'p-6' }) {
  const palettes = {
    blue:   'bg-blue-50/80 text-blue-700 border-blue-100',
    orange: 'bg-orange-50/80 text-orange-700 border-orange-100',
    rose:   'bg-rose-50/80 text-rose-700 border-rose-100',
    indigo: 'bg-indigo-50/80 text-indigo-700 border-indigo-100',
    violet: 'bg-violet-50/80 text-violet-700 border-violet-100',
    emerald:'bg-emerald-50/80 text-emerald-700 border-emerald-100',
    teal:   'bg-teal-50/80 text-teal-700 border-teal-100',
    amber:  'bg-amber-50/80 text-amber-700 border-amber-100',
  };
  const headerColor = palettes[color] || palettes.blue;

  return (
    <div className={`border border-slate-200 rounded-[2rem] overflow-hidden shadow-sm ${glass ? 'bg-white/80 backdrop-blur-xl' : 'bg-white'} hover:shadow-md transition-shadow`}>
      <div className={`px-6 py-4 border-b flex items-center gap-3 ${headerColor}`}>
        <div className="opacity-80">{icon}</div>
        <h3 className="font-extrabold text-sm tracking-wide uppercase">{title}</h3>
      </div>
      <div className={`${padding}`}>
        {children}
      </div>
    </div>
  );
}

const DataField = ({ label, value, sub, mono, icon, badge }) => {
  const badgeClasses = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    blue:    'bg-blue-50 text-blue-700 border-blue-200',
    violet:  'bg-violet-50 text-violet-700 border-violet-200',
    slate:   'bg-slate-50 text-slate-600 border-slate-200',
  };

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
        {icon}
        {label}
      </span>
      <div className={`text-sm text-slate-800 font-bold whitespace-pre-wrap ${mono ? 'font-mono tracking-tight text-slate-600' : ''}`}>
        {value ? (
          badge ? (
            <span className={`inline-block px-2.5 py-1 rounded-lg text-[11px] font-black border shadow-sm ${badgeClasses[badge] || badgeClasses.slate}`}>
              {value}
            </span>
          ) : value
        ) : (
          <span className="text-slate-300 font-medium italic">—</span>
        )}
      </div>
      {sub && <span className="text-[11px] text-slate-500 font-semibold mt-0.5">{sub}</span>}
    </div>
  );
};

const DOC_STATUS_CLS = {
  pending:      'bg-slate-50 text-slate-600 border-slate-200',
  received:     'bg-blue-50 text-blue-700 border-blue-200',
  verified:     'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected:     'bg-rose-50 text-rose-700 border-rose-200',
  not_required: 'bg-slate-50 text-slate-400 border-slate-200',
};
const UNI_STATUS_CLS = {
  ready:               'bg-sky-50 text-sky-700 border-sky-200',
  submitted:           'bg-blue-50 text-blue-700 border-blue-200',
  pending:             'bg-slate-50 text-slate-700 border-slate-200',
  processing:          'bg-indigo-50 text-indigo-700 border-indigo-200',
  initial_review_pass: 'bg-teal-50 text-teal-700 border-teal-200',
  interview:           'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200',
  pre_admission:       'bg-purple-50 text-purple-700 border-purple-200',
  admitted:            'bg-emerald-50 text-emerald-700 border-emerald-200',
  returned:            'bg-amber-50 text-amber-700 border-amber-200',
  rejected:            'bg-rose-50 text-rose-700 border-rose-200',
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
    <div className="bg-white border border-slate-200 rounded-[2rem] shadow-sm hover:shadow-md transition-shadow flex flex-col h-full max-h-[900px] overflow-hidden">
      <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 text-blue-600 rounded-xl shadow-sm">
            <Activity size={18} />
          </div>
          <h3 className="font-extrabold text-slate-800 text-sm uppercase tracking-wide">Activity Timeline</h3>
        </div>
        <span className="text-xs font-bold text-slate-500 bg-white border border-slate-200 px-3 py-1 rounded-full shadow-sm">{timeline.length} events</span>
      </div>

      {/* Compose note */}
      <form onSubmit={submit} className="p-6 pb-5 border-b border-slate-100 bg-white z-10 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.02)]">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-md shadow-blue-200">
            <MessageSquare size={16} />
          </div>
          <div className="flex-1">
            <textarea ref={inputRef} value={text} onChange={e => setText(e.target.value)}
              placeholder={mode === 'reply'
                ? 'Reply to the student — they will see this on their portal...'
                : 'Add a note — what happened, what’s next, what the next person should know…'}
              rows={2}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(e); }}
              className={`w-full border-2 rounded-2xl px-4 py-3 text-sm font-medium focus:outline-none transition-colors resize-none placeholder-slate-400
                ${mode === 'reply' ? 'border-emerald-100 bg-emerald-50/50 focus:border-emerald-400 focus:bg-white' : 'border-slate-200 bg-slate-50/50 focus:border-blue-500 focus:bg-white'}`} />
            
            <div className="flex items-center justify-between mt-3">
              <div className="flex gap-1.5 bg-slate-100 p-1 rounded-xl">
                <button type="button" onClick={() => setMode('note')}
                  className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${mode === 'note' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}>
                  Internal note
                </button>
                <button type="button" onClick={() => setMode('reply')}
                  className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${mode === 'reply' ? 'bg-white shadow-sm text-emerald-700' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}>
                  Reply to student
                </button>
              </div>
              <button type="submit" disabled={posting || !text.trim()}
                className={`flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-xl disabled:opacity-50 text-white shadow-sm transition-transform active:scale-95
                  ${mode === 'reply' ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'}`}>
                <Send size={14} /> {posting ? 'Sending…' : (mode === 'reply' ? 'Send Reply' : 'Post Note')}
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* Feed */}
      {timeline.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-slate-50/50">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
            <Activity size={32} className="text-slate-300" />
          </div>
          <p className="text-base font-bold text-slate-700">No activity yet</p>
          <p className="text-sm text-slate-500 mt-1 max-w-[200px]">Any updates, notes, or status changes will appear here.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto bg-slate-50/30 p-2">
          <div className="space-y-2">
            {timeline.map(a => <TimelineItem key={a.id} a={a} />)}
          </div>
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
    <div className="flex items-start gap-4 px-4 py-4 hover:bg-white rounded-2xl transition-colors group">
      <div className={`p-2.5 rounded-2xl flex-shrink-0 shadow-sm border border-white ${meta.bg}`}>{meta.icon}</div>
      <div className="flex-1 min-w-0 pt-0.5">
        <p className="text-sm text-slate-700 leading-snug">
          {a.actor_name && <strong className="text-slate-900 font-bold">{a.actor_name}</strong>}{' '}{meta.text}
        </p>
        {a.type === 'note' && (
          <div className="mt-2 p-3.5 bg-amber-50/80 border border-amber-100 rounded-2xl text-sm font-medium text-amber-900 whitespace-pre-wrap shadow-sm">
            {typeof details === 'string' ? details : a.details}
          </div>
        )}
        {a.type === 'reply_to_student' && (
          <div className="mt-2 p-3.5 bg-emerald-50/80 border border-emerald-100 rounded-2xl text-sm font-medium text-emerald-900 whitespace-pre-wrap shadow-sm">
            {typeof details === 'string' ? details : a.details}
          </div>
        )}
        {a.type !== 'note' && typeof details === 'object' && details && (
          <div className="text-[11px] font-medium text-slate-500 mt-2 flex flex-wrap gap-x-3 gap-y-1.5 bg-slate-100/50 p-2.5 rounded-xl border border-slate-100">
            {Object.entries(details).filter(([, v]) => v != null && v !== '').slice(0, 4).map(([k, v]) => (
              <span key={k} className="bg-white px-2 py-1 rounded-md shadow-sm border border-slate-100"><strong className="text-slate-700">{k}:</strong> {String(v).slice(0, 60)}</span>
            ))}
          </div>
        )}
        <p className="text-[11px] font-bold text-slate-400 mt-2 flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity" title={fullDate(a.created_at)}>
          <Clock size={10} /> {timeAgo(a.created_at)}
        </p>
      </div>
    </div>
  );
}

function describe(a) {
  const v = a.to_value, from = a.from_value;
  switch (a.type) {
    case 'lead_created':
      return { icon: <UserPlus size={16}/>, bg: 'bg-blue-100 text-blue-700',
               text: <>added this lead</> };
    case 'lead_status_changed':
      return { icon: <Tag size={16}/>, bg: 'bg-violet-100 text-violet-700',
               text: <>moved status: <strong>{from || '—'}</strong> → <strong>{v || '—'}</strong></> };
    case 'lead_assigned':
      return { icon: <User size={16}/>, bg: 'bg-indigo-100 text-indigo-700',
               text: <>assigned to <strong className="text-indigo-900">{v || '—'}</strong>{from ? <> (was {from})</> : null}</> };
    case 'lead_payment':
      return { icon: <DollarSign size={16}/>, bg: 'bg-emerald-100 text-emerald-700',
               text: <>recorded a payment of <strong className="text-emerald-900">{fmtFull(a.amount)}</strong></> };
    case 'payment_recorded':
      return { icon: <Receipt size={16}/>, bg: 'bg-emerald-100 text-emerald-700',
               text: <>logged income of <strong className="text-emerald-900">{fmtFull(a.amount)}</strong></> };
    case 'application_stage_changed':
      return { icon: <Plane size={16}/>, bg: 'bg-orange-100 text-orange-700',
               text: <>advanced application: <strong>{from || '—'}</strong> → <strong>{v || '—'}</strong></> };
    case 'uni_app_status':
      return { icon: <Building2 size={16}/>, bg: 'bg-violet-100 text-violet-700',
               text: <>updated a university application: <strong>{from || '—'}</strong> → <strong>{v || '—'}</strong></> };
    case 'note':
      return { icon: <MessageSquare size={16}/>, bg: 'bg-amber-100 text-amber-700',
               text: <>added a note</> };
    case 'reply_to_student':
      return { icon: <Send size={16}/>, bg: 'bg-emerald-100 text-emerald-700',
               text: <>replied to the student</> };
    case 'student_doc_upload':
      return { icon: <Receipt size={16}/>, bg: 'bg-blue-100 text-blue-700',
               text: <>uploaded a document via the portal</> };
    default:
      return { icon: <Activity size={16}/>, bg: 'bg-slate-200 text-slate-600',
               text: <><span className="capitalize">{a.type.replace(/_/g, ' ')}</span></> };
  }
}

const STAGE_COLORS_LIST = [
  { bg: 'bg-slate-50',   border: 'border-slate-200',   text: 'text-slate-700 hover:bg-slate-100' },
  { bg: 'bg-blue-50',    border: 'border-blue-200',    text: 'text-blue-800 hover:bg-blue-100' },
  { bg: 'bg-violet-50',  border: 'border-violet-200',  text: 'text-violet-800 hover:bg-violet-100' },
  { bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-800 hover:bg-amber-100' },
  { bg: 'bg-orange-50',  border: 'border-orange-200',  text: 'text-orange-800 hover:bg-orange-100' },
  { bg: 'bg-teal-50',    border: 'border-teal-200',    text: 'text-teal-800 hover:bg-teal-100' },
  { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800 hover:bg-emerald-100' },
  { bg: 'bg-green-50',   border: 'border-green-200',   text: 'text-green-800 hover:bg-green-100' },
  { bg: 'bg-indigo-50',  border: 'border-indigo-200',  text: 'text-indigo-800 hover:bg-indigo-100' },
  { bg: 'bg-fuchsia-50', border: 'border-fuchsia-200', text: 'text-fuchsia-800 hover:bg-fuchsia-100' },
  { bg: 'bg-pink-50',    border: 'border-pink-200',    text: 'text-pink-800 hover:bg-pink-100' },
  { bg: 'bg-sky-50',     border: 'border-sky-200',     text: 'text-sky-800 hover:bg-sky-100' },
];

function InlineStageSelect({ value, onChange, stages }) {
  if (!stages || stages.length === 0) return null;
  const idx = stages.findIndex(s => s.key === value);
  const color = STAGE_COLORS_LIST[idx !== -1 ? idx % STAGE_COLORS_LIST.length : 0];
  const selectValue = value || stages[0]?.key || '';
  
  return (
    <select
      value={selectValue}
      onClick={e => e.stopPropagation()} // prevent click
      onChange={e => onChange(e.target.value)}
      className={`px-3.5 py-1.5 rounded-lg text-[11px] font-black border transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-100 shadow-sm ${color.bg} ${color.text} ${color.border}`}
    >
      {stages.map(s => (
        <option key={s.key} value={s.key} className="bg-white text-slate-800 font-bold">{s.label}</option>
      ))}
    </select>
  );
}
