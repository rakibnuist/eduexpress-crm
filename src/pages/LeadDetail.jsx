/* LeadDetail — Professional CRM Layout with inline "Click-to-Edit".
   All fields are instantly editable, matching the schema of LeadForm. */
import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api';
import StatusBadge from '../components/StatusBadge';
import { useToast } from '../components/Toast';
import { isFullAdmin } from '../lib/roles';
import {
  ArrowLeft, Trash2, Phone, Mail, User, 
  GraduationCap, Building2, FileText, Activity, Send, AlertCircle,
  ExternalLink, CheckCircle2, MessageSquare, Loader2,
  FolderOpen, Wallet, Calendar, Clock, Stethoscope, Briefcase, Pencil, Plane
} from 'lucide-react';

const DEGREES = ['Diploma', 'Bachelor', 'Masters', 'PhD', 'Language', 'Foundation', 'L+Diploma +', 'L + Bachelor', 'F+Bachelor'];
const BLOOD = ['A+','A-','B+','B-','AB+','AB-','O+','O-'];

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
  
  const [lead, setLead] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [docs, setDocs] = useState([]);
  const [unis, setUnis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [settings, setSettings] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [referrerList, setReferrerList] = useState([]);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const toast = useToast();

  const mappedStages = useMemo(() => {
    return (settings?.fileStages || []).map(label => {
      let key = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
      if (key === 'documents_collecting') key = 'documents';
      if (key === 'documents_ready') key = 'ready';
      if (key === 'applied_to_university') key = 'submitted';
      if (key === 'admission_jw_received' || key === 'admission_notice_received' || key === 'offer_letter_received') key = 'admitted';
      return { value: key, label };
    });
  }, [settings]);

  const refOptions = Array.from(new Set([...referrerList, ...(settings?.consultants || [])])).sort();

  const load = useCallback(async () => {
    try {
      const t = await api.leadTimeline(id);
      setLead(t.lead);
      setTimeline(t.timeline);
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
    if (lead) document.title = `${lead.client_name} - CRM | EduExpress Core`;
  }, [lead]);

  useEffect(() => {
    api.settings().then(setSettings).catch(() => {});
    api.employeesActive().then(setEmployees).catch(() => {});
    api.leads({ limit: 2000 }).then(d => {
      const set = new Set();
      (d.leads || []).forEach(l => { if (l.referrer) set.add(l.referrer); });
      setReferrerList(Array.from(set).sort());
    }).catch(() => {});
  }, []);

  // Real-time Activity
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

  const handleFieldSave = async (field, value) => {
    try {
      const payload = { [field]: value };
      
      // Formatting intercepts
      if (field === 'phone' && value) {
        let finalPhone = value.trim();
        const digits = finalPhone.replace(/[^\d]/g, '');
        if (digits.startsWith('01') && digits.length === 11) finalPhone = '+88' + digits;
        else if (digits.startsWith('8801') && digits.length === 13) finalPhone = '+' + digits;
        payload.phone = finalPhone;
      }
      if (field === 'assigned_employee_id') {
        payload.assigned_employee_id = value ? Number(value) : null;
        if (payload.assigned_employee_id) {
          const emp = employees.find(e => e.id === payload.assigned_employee_id);
          if (emp) payload.assigned_consultant = emp.name;
        } else {
          payload.assigned_consultant = '';
        }
      }

      await api.updateLead(lead.id, payload);
      toast.success('Updated');
      load(); // refresh data to ensure sync
    } catch (err) {
      toast.error('Failed to update: ' + err.message);
      throw err; // bubble up so EditableField knows
    }
  };

  const [startingChat, setStartingChat] = useState(false);
  const handleStartCRMChat = async () => {
    if (!lead?.phone) return toast.error('This lead does not have a phone number.');
    setStartingChat(true);
    try {
      const activeChannels = await api.channels();
      if (!activeChannels || activeChannels.length === 0) return toast.error('No messaging channels configured.');
      const channel = activeChannels.find(c => c.type === 'whatsapp') || activeChannels.find(c => c.type === 'messenger') || activeChannels[0];
      const conv = await api.createConversation({ channel_id: channel.id, phone: lead.phone, name: lead.client_name, lead_id: lead.id });
      toast.success('Conversation initiated!');
      navigate(`/conversations?id=${conv.id}`);
    } catch (err) { toast.error('Failed to start chat: ' + err.message); }
    finally { setStartingChat(false); }
  };

  const handleDelete = async () => {
    try { await api.deleteLead(lead.id); toast.success(`${lead.client_name} deleted`); navigate('/leads'); }
    catch (e) { toast.error(e.message || 'Could not delete'); }
  };

  if (loading && !lead) return <div className="flex justify-center mt-20"><Loader2 size={36} className="text-blue-500 animate-spin" /></div>;
  if (error || !lead) return <div className="text-center mt-20 text-slate-500">{error || 'Not found'}</div>;

  const balance = (lead.service_fee || 0) - (lead.paid || 0);

  return (
    <div className="max-w-[1600px] mx-auto pb-12 px-4 sm:px-6 lg:px-8 xl:px-0 space-y-6">
      
      {/* ── Professional Header ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 px-6 py-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2.5 border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-xl transition-all">
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{lead.client_name}</h1>
              <span className="font-mono text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">{lead.lead_id}</span>
              <StatusBadge status={lead.lead_status} />
            </div>
            <div className="flex items-center gap-4 text-sm text-slate-500 font-medium mt-1">
              {lead.phone && <span className="flex items-center gap-1.5"><Phone size={14}/> {lead.phone}</span>}
              {lead.email && <span className="flex items-center gap-1.5"><Mail size={14}/> {lead.email}</span>}
              <span className="flex items-center gap-1.5"><Calendar size={14}/> Added {lead.date_added}</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2 w-full md:w-auto">
          {lead.phone && (
            <button disabled={startingChat} onClick={handleStartCRMChat}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-lg transition-all shadow-sm">
              {startingChat ? <Loader2 size={16} className="animate-spin" /> : <MessageSquare size={16} />}
              CRM Chat
            </button>
          )}
          {lead.drive_link && (
            <a href={ensureAbsoluteUrl(lead.drive_link)} target="_blank" rel="noreferrer"
              className="flex items-center gap-2 text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 px-4 py-2 rounded-lg border border-slate-200 shadow-sm transition-all">
              <ExternalLink size={16} /> Drive
            </a>
          )}
          {isFullAdmin(user) && (
            <button onClick={() => setDeleteOpen(true)} className="flex items-center p-2.5 text-rose-600 bg-white hover:bg-rose-50 rounded-lg border border-slate-200 shadow-sm transition-all">
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>

      {/* ── Main Layout: 2 Columns ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: Details Sections */}
        <div className="lg:col-span-8 space-y-6">
          
          <Section title="Contact Info" icon={<User size={16}/>}>
            <EditableField label="Full Name" field="client_name" value={lead.client_name} onSave={handleFieldSave} />
            <EditableField label="Phone" field="phone" value={lead.phone} type="tel" onSave={handleFieldSave} />
            <EditableField label="Email" field="email" value={lead.email} type="email" onSave={handleFieldSave} />
            <EditableField label="Nationality" field="nationality" value={lead.nationality} list="nat-list" options={['Bangladesh', 'Pakistan', 'India', 'Nepal', 'Sri Lanka', 'Morocco', 'Egypt']} onSave={handleFieldSave} />
            <EditableField label="Passport Number" field="passport" value={lead.passport} mono onSave={handleFieldSave} />
            <EditableField label="Date of Birth" field="date_of_birth" value={lead.date_of_birth} type="date" onSave={handleFieldSave} />
            <EditableField label="Age" field="age" value={lead.age} type="number" onSave={handleFieldSave} />
            <EditableField label="Google Drive Folder" field="drive_link" value={lead.drive_link} mono onSave={handleFieldSave} />
          </Section>

          <Section title="Academic Profile" icon={<GraduationCap size={16}/>}>
            <EditableField label="Last Education" field="last_education" value={lead.last_education} type="select" options={['SSC', 'HSC', 'O Level', 'A Level', 'Dakhil', 'Alim', 'Diploma', 'Degree', 'Bachelor', 'Masters']} onSave={handleFieldSave} />
            <EditableField label="Major / Group" field="last_education_major" value={lead.last_education_major} onSave={handleFieldSave} />
            <EditableField label="GPA / CGPA" field="gpa" value={lead.gpa} type="number" step="0.01" onSave={handleFieldSave} />
            <EditableField label="Passing Year" field="passing_year" value={lead.passing_year} onSave={handleFieldSave} />
            <EditableField label="English Test Type" field="english_test_type" value={lead.english_test_type} type="select" options={['IELTS', 'TOEFL', 'PTE', 'Duolingo', 'MOI', 'OET', 'Oxford ELLT', 'Cambridge', 'LanguageCert', 'EFSET']} onSave={handleFieldSave} />
            <EditableField label="Test Score" field="english_score" value={lead.english_score} onSave={handleFieldSave} />
          </Section>

          <Section title="Target Program" icon={<Plane size={16}/>}>
            <EditableField label="Destination" field="destination" value={lead.destination} type="select" options={settings?.destinations || ['China', 'Malta', 'Hungary', 'Greece', 'Estonia']} onSave={handleFieldSave} />
            <EditableField label="Intake Term" field="intake_term" value={lead.intake_term} list="intake-list" options={['Spring 2026', 'March 2026', 'September 2026', 'Spring 2027', 'September 2027']} onSave={handleFieldSave} />
            <EditableField label="Target Degree" field="degree" value={lead.degree} type="select" options={DEGREES} onSave={handleFieldSave} />
            <EditableField label="Target Major" field="major" value={lead.major || lead.program} onSave={handleFieldSave} />
            <EditableField label="Primary University (Pref)" field="university" value={lead.university} onSave={handleFieldSave} />
          </Section>

          {!isAgentUser && (
            <Section title="Sales & Operations" icon={<Briefcase size={16}/>}>
              <EditableField label="Lead Status" field="lead_status" value={lead.lead_status} type="select" options={settings?.leadStatuses || []} onSave={handleFieldSave} />
              <EditableField label="Assigned Consultant" field="assigned_employee_id" value={lead.assigned_employee_id} type="select" options={employees.map(e => ({value: e.id, label: e.name}))} onSave={handleFieldSave} />
              <EditableField label="Next Follow-up" field="next_followup" value={lead.next_followup} type="date" onSave={handleFieldSave} />
              <EditableField label="Market" field="lead_market" value={lead.lead_market} type="select" options={['Bangladesh', 'China']} onSave={handleFieldSave} />
              <EditableField label="Lead Type" field="lead_type" value={lead.lead_type} type="select" options={['B2C', 'B2B']} onSave={handleFieldSave} />
              <EditableField label="Acquisition Channel" field="lead_source" value={lead.lead_source} type="select" options={settings?.leadSources || []} onSave={handleFieldSave} />
              <EditableField label="Referrer / Agent" field="referrer" value={lead.referrer} list="ref-list" options={refOptions} onSave={handleFieldSave} />
              <EditableField label="Page Name" field="page_name" value={lead.page_name} list="page-list" options={Array.from(new Set([...(settings?.pages || []), 'WhatsApp']))} onSave={handleFieldSave} />
            </Section>
          )}

          {!isAgentUser && (
            <Section title="Financial & Logistics" icon={<Wallet size={16}/>}>
              <EditableField label="Service Fee (৳)" field="service_fee" value={lead.service_fee} type="number" onSave={handleFieldSave} />
              <EditableField label="Paid So Far (৳)" field="paid" value={lead.paid} type="number" onSave={handleFieldSave} />
              <EditableField label="Deposit (৳)" field="deposit" value={lead.deposit} type="number" onSave={handleFieldSave} />
              <div className="flex flex-col gap-1 p-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Balance Due</label>
                <div className={`text-sm font-semibold ${balance > 0 ? 'text-rose-600' : 'text-slate-700'}`}>৳{balance.toLocaleString()}</div>
              </div>
              <EditableField label="Payment Status" field="payment_status" value={lead.payment_status} type="select" options={settings?.paymentStatuses || []} onSave={handleFieldSave} />
              <EditableField label="Application Stage" field="application_stage" value={lead.application_stage} type="select" options={mappedStages} onSave={handleFieldSave} />
              <EditableField label="Payment Agreement" field="payment_agreement" value={lead.payment_agreement} type="select" options={['Standard', 'All Payment After VISA (Hardcopy Required)', 'All Payment After VISA (Deposit Required)']} onSave={handleFieldSave} />
              <EditableField label="Hardcopy Status" field="hardcopy_status" value={lead.hardcopy_status} type="select" options={['Not Received', 'Received (In Office)', 'Returned to Student']} onSave={handleFieldSave} />
            </Section>
          )}

          <Section title="Medical, Notes & Documents" icon={<Stethoscope size={16}/>}>
            <EditableField label="Blood Group" field="blood_group" value={lead.blood_group} type="select" options={BLOOD} onSave={handleFieldSave} />
            <EditableField label="Emergency Contact" field="emergency_contact" value={lead.emergency_contact} onSave={handleFieldSave} />
            <EditableField label="Height" field="height" value={lead.height} onSave={handleFieldSave} />
            <EditableField label="Weight" field="weight" value={lead.weight} onSave={handleFieldSave} />
            <div className="md:col-span-2">
              <EditableField label="Medical History / Notes" field="medical_notes" value={lead.medical_notes} type="textarea" onSave={handleFieldSave} />
            </div>
            <div className="md:col-span-2">
              <EditableField label="General Notes" field="notes" value={lead.notes} type="textarea" onSave={handleFieldSave} />
            </div>
            {lead.hardcopy_status === 'Received (In Office)' && (
              <div className="md:col-span-2">
                <EditableField label="List of Received Hardcopy Documents" field="hardcopy_documents" value={lead.hardcopy_documents} type="textarea" onSave={handleFieldSave} />
              </div>
            )}
          </Section>

          {/* Quick lists for docs/unis */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <h3 className="font-bold text-slate-800 text-sm">Universities ({unis.length})</h3>
              </div>
              <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                {unis.length === 0 ? <p className="p-5 text-sm text-slate-500 text-center">No applications</p> : unis.map(u => (
                  <div key={u.id} className="p-3 px-5 flex items-center justify-between">
                    <div className="min-w-0 flex-1"><p className="font-semibold text-slate-800 text-sm truncate">{u.university}</p></div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase ml-2">{u.status}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <h3 className="font-bold text-slate-800 text-sm">Documents ({docs.length})</h3>
                <Link to="/applications" className="text-xs text-blue-600 hover:underline">View All</Link>
              </div>
              <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                {docs.length === 0 ? <p className="p-5 text-sm text-slate-500 text-center">No documents</p> : docs.map(d => (
                  <div key={d.id} className="p-3 px-5 flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-700 truncate pr-4">{d.doc_type}</span>
                    <span className="text-[10px] font-bold text-slate-500 uppercase">{d.status === 'not_required' ? 'N/A' : d.status}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Activity Timeline */}
        <div className="lg:col-span-4">
          <div className="sticky top-6">
            <Timeline leadId={lead.id} timeline={timeline} onPosted={load} />
          </div>
        </div>
      </div>

      {/* Delete confirm */}
      {deleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 border border-slate-200">
            <h3 className="text-lg font-bold text-slate-800 mb-2">Delete Lead?</h3>
            <p className="text-sm text-slate-600 mb-6">Permanently remove <strong>{lead.client_name}</strong> and all history?</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteOpen(false)} className="text-sm font-semibold px-4 py-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200">Cancel</button>
              <button onClick={handleDelete} className="text-sm font-semibold px-4 py-2 rounded-lg bg-rose-600 text-white hover:bg-rose-700">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Layout Primitives ─── */
function Section({ title, icon, children }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
        <div className="text-slate-400">{icon}</div>
        <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">{title}</h3>
      </div>
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
          {children}
        </div>
      </div>
    </div>
  );
}

/* ─── Inline Editable Field ─── */
function EditableField({ label, field, value, type = 'text', options = [], list, onSave, mono = false, step }) {
  const [isEditing, setIsEditing] = useState(false);
  const [currentValue, setCurrentValue] = useState(value ?? '');
  const [saving, setSaving] = useState(false);
  
  useEffect(() => {
    if (!isEditing) setCurrentValue(value ?? '');
  }, [value, isEditing]);

  const handleSave = async () => {
    let raw = currentValue;
    if (type === 'number') {
      raw = raw === '' ? 0 : Number(raw);
      if (field === 'gpa' && raw === 0) raw = null;
    }
    const oldRaw = (value ?? '');
    
    // loose equality check because empty string vs null vs 0 can be tricky, 
    // but we only skip if they match exactly in string form (for text).
    if (String(raw) === String(oldRaw)) {
      setIsEditing(false);
      return;
    }

    setSaving(true);
    try {
      await onSave(field, raw);
      setIsEditing(false);
    } catch (e) {
      // stay in edit mode if error
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && type !== 'textarea') {
      e.target.blur(); // triggers blur save
    }
    if (e.key === 'Escape') {
      setIsEditing(false);
      setCurrentValue(value ?? '');
    }
  };

  if (isEditing) {
    return (
      <div className="flex flex-col gap-1 relative z-10 bg-white -m-1.5 p-1.5 rounded-lg shadow-md border border-blue-200 ring-2 ring-blue-50/50">
        <label className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">{label}</label>
        
        {type === 'select' ? (
          <select 
            autoFocus
            value={currentValue} 
            onChange={e => setCurrentValue(e.target.value)}
            onBlur={handleSave}
            disabled={saving}
            className="w-full text-sm font-semibold border-b-2 border-blue-500 bg-blue-50/30 p-1 focus:outline-none rounded-sm text-slate-800"
          >
            <option value="">— select —</option>
            {options.map(o => {
              const val = typeof o === 'object' ? o.value : o;
              const lbl = typeof o === 'object' ? o.label : o;
              return <option key={val} value={val}>{lbl}</option>
            })}
          </select>
        ) : type === 'textarea' ? (
           <textarea
             autoFocus
             value={currentValue}
             onChange={e => setCurrentValue(e.target.value)}
             onBlur={handleSave}
             disabled={saving}
             rows={3}
             className="w-full text-sm font-semibold border-2 border-blue-500 bg-blue-50/30 p-2 focus:outline-none rounded-md resize-y text-slate-800"
           />
        ) : (
          <>
            <input 
              autoFocus
              type={type} 
              step={step}
              list={list}
              value={currentValue} 
              onChange={e => setCurrentValue(e.target.value)}
              onBlur={handleSave}
              onKeyDown={handleKeyDown}
              disabled={saving}
              className={`w-full text-sm font-semibold border-b-2 border-blue-500 bg-blue-50/30 p-1 focus:outline-none rounded-sm text-slate-800 ${mono ? 'font-mono' : ''}`}
            />
            {list && options && (
              <datalist id={list}>
                {options.map(o => <option key={o} value={o} />)}
              </datalist>
            )}
          </>
        )}
        {saving && <span className="absolute right-2 top-2 text-blue-500"><Loader2 size={12} className="animate-spin" /></span>}
      </div>
    );
  }

  // Display mode
  let displayValue = value;
  if (type === 'select' && options.length > 0 && typeof options[0] === 'object') {
    const opt = options.find(o => String(o.value) === String(value));
    if (opt) displayValue = opt.label;
  }
  
  return (
    <div 
      className="flex flex-col gap-1 group cursor-text -m-1.5 p-1.5 rounded-lg hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-200"
      onClick={() => setIsEditing(true)}
    >
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</label>
        <Pencil size={12} className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      <div className={`text-sm text-slate-800 ${mono ? 'font-mono tracking-tight text-slate-600' : 'font-semibold'}`}>
        {displayValue ? displayValue : <span className="text-slate-300 italic font-medium">Click to edit...</span>}
      </div>
    </div>
  );
}

/* ─── Timeline ─── */
function Timeline({ leadId, timeline, onPosted }) {
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);
  const [mode, setMode] = useState('note');
  const inputRef = useRef(null);
  const toast = useToast();

  const submit = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setPosting(true);
    try {
      if (mode === 'reply') {
        await api.replyToStudent(leadId, text.trim());
        toast.success('Reply sent');
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
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col max-h-[85vh]">
      <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
        <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider flex items-center gap-2"><Activity size={16} className="text-slate-400"/> Activity Timeline</h3>
        <span className="text-xs font-bold text-slate-500 bg-white border border-slate-200 px-2.5 py-0.5 rounded-md">{timeline.length}</span>
      </div>

      <form onSubmit={submit} className="p-4 border-b border-slate-100 bg-white shadow-sm relative z-10">
        <textarea ref={inputRef} value={text} onChange={e => setText(e.target.value)}
          placeholder={mode === 'reply' ? 'Reply to student...' : 'Add an internal note...'} rows={2}
          onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(e); }}
          className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none transition-colors resize-none 
            ${mode === 'reply' ? 'border-emerald-200 bg-emerald-50 focus:border-emerald-500' : 'border-slate-200 bg-slate-50 focus:border-blue-500'}`} />
        <div className="flex items-center justify-between mt-2">
          <div className="flex gap-1 bg-slate-100 p-0.5 rounded-lg">
            <button type="button" onClick={() => setMode('note')} className={`text-xs font-semibold px-2 py-1 rounded-md ${mode === 'note' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}>Internal</button>
            <button type="button" onClick={() => setMode('reply')} className={`text-xs font-semibold px-2 py-1 rounded-md ${mode === 'reply' ? 'bg-white shadow-sm text-emerald-700' : 'text-slate-500'}`}>To Student</button>
          </div>
          <button type="submit" disabled={posting || !text.trim()} className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg disabled:opacity-50 text-white bg-slate-800 hover:bg-slate-900 transition-colors">
            <Send size={12} /> {posting ? 'Sending…' : 'Post'}
          </button>
        </div>
      </form>

      <div className="flex-1 overflow-y-auto p-2">
        {timeline.length === 0 ? (
          <div className="p-10 text-center text-slate-500 text-sm">No activity yet.</div>
        ) : (
          <div className="space-y-1">
            {timeline.map(a => <TimelineItem key={a.id} a={a} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function TimelineItem({ a }) {
  const meta = describe(a);
  let details = null;
  if (a.details) { try { details = JSON.parse(a.details); } catch { details = a.details; } }
  
  return (
    <div className="flex gap-3 px-3 py-3 hover:bg-slate-50 rounded-xl transition-colors group">
      <div className={`mt-0.5 p-1.5 rounded-lg flex-shrink-0 ${meta.bg}`}>{meta.icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] text-slate-700 leading-snug">
          {a.actor_name && <strong className="text-slate-900 font-semibold">{a.actor_name}</strong>}{' '}{meta.text}
        </p>
        {a.type === 'note' && <div className="mt-1.5 p-2.5 bg-amber-50 rounded-lg text-[13px] text-amber-900 whitespace-pre-wrap">{typeof details === 'string' ? details : a.details}</div>}
        {a.type === 'reply_to_student' && <div className="mt-1.5 p-2.5 bg-emerald-50 rounded-lg text-[13px] text-emerald-900 whitespace-pre-wrap">{typeof details === 'string' ? details : a.details}</div>}
        {a.type !== 'note' && typeof details === 'object' && details && (
          <div className="text-[11px] text-slate-500 mt-1.5 flex flex-wrap gap-1.5">
            {Object.entries(details).filter(([, v]) => v != null && v !== '').slice(0, 4).map(([k, v]) => (
              <span key={k} className="bg-white px-1.5 py-0.5 rounded border border-slate-200 font-medium"><strong className="text-slate-700">{k}:</strong> {String(v).slice(0, 40)}</span>
            ))}
          </div>
        )}
        <p className="text-[10px] font-semibold text-slate-400 mt-1.5 flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
          <Clock size={10} /> {timeAgo(a.created_at)}
        </p>
      </div>
    </div>
  );
}

function describe(a) {
  const v = a.to_value, from = a.from_value;
  switch (a.type) {
    case 'lead_created':              return { icon: <User size={14}/>, bg: 'bg-blue-100 text-blue-700', text: <>added this lead</> };
    case 'lead_status_changed':       return { icon: <Activity size={14}/>, bg: 'bg-violet-100 text-violet-700', text: <>status: <strong>{from || '—'}</strong> → <strong>{v || '—'}</strong></> };
    case 'lead_assigned':             return { icon: <User size={14}/>, bg: 'bg-indigo-100 text-indigo-700', text: <>assigned to <strong className="text-indigo-900">{v || '—'}</strong></> };
    case 'lead_payment':              return { icon: <Wallet size={14}/>, bg: 'bg-emerald-100 text-emerald-700', text: <>recorded payment: <strong>{fmtFull(a.amount)}</strong></> };
    case 'payment_recorded':          return { icon: <Wallet size={14}/>, bg: 'bg-emerald-100 text-emerald-700', text: <>logged income: <strong>{fmtFull(a.amount)}</strong></> };
    case 'application_stage_changed': return { icon: <Plane size={14}/>, bg: 'bg-orange-100 text-orange-700', text: <>advanced app: <strong>{from || '—'}</strong> → <strong>{v || '—'}</strong></> };
    case 'uni_app_status':            return { icon: <Building2 size={14}/>, bg: 'bg-violet-100 text-violet-700', text: <>university status: <strong>{from || '—'}</strong> → <strong>{v || '—'}</strong></> };
    case 'note':                      return { icon: <MessageSquare size={14}/>, bg: 'bg-amber-100 text-amber-700', text: <>added a note</> };
    case 'reply_to_student':          return { icon: <Send size={14}/>, bg: 'bg-emerald-100 text-emerald-700', text: <>replied to student</> };
    case 'student_doc_upload':        return { icon: <FileText size={14}/>, bg: 'bg-blue-100 text-blue-700', text: <>uploaded a document</> };
    default:                          return { icon: <Activity size={14}/>, bg: 'bg-slate-100 text-slate-600', text: <><span className="capitalize">{a.type.replace(/_/g, ' ')}</span></> };
  }
}
