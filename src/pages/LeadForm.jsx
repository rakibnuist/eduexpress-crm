/* LeadForm — comprehensive create/edit form, sectioned for scannability.
   Captures everything: the original CRM fields + the Excel-aligned fields
   from File Updates 2026 (source, referrer, passport, degree, major,
   nationality, intake, drive link, deposit) + medical/emergency block. */
import { useState, useEffect, useMemo } from 'react';
import { api } from '../api';
import { useToast } from '../components/Toast';
import { User, GraduationCap, Briefcase, Wallet, FolderOpen, Heart, Save, ChevronDown } from 'lucide-react';

const DEGREES   = ['Diploma', 'Bachelor', 'Masters', 'PhD', 'Language', 'Foundation', 'L+Diploma +', 'L + Bachelor', 'F+Bachelor'];
const BLOOD     = ['A+','A-','B+','B-','AB+','AB-','O+','O-'];

const mapStages = (stagesArray) => {
  return (stagesArray || []).map(label => {
    let key = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    if (key === 'documents_collecting') key = 'documents';
    if (key === 'documents_ready') key = 'ready';
    if (key === 'applied_to_university') key = 'submitted';
    if (key === 'admission_jw_received' || key === 'admission_notice_received' || key === 'offer_letter_received') key = 'admitted';
    return { key, label };
  });
};

import { canViewOwnLeadsOnly } from '../lib/roles';

export default function LeadForm({ user, lead, settings, onSave }) {
  const isAgentUser = user?.roles?.includes('agent');
  const [form, setForm] = useState(initial(lead, user));
  const [saving, setSaving] = useState(false);
  const [referrerList, setReferrerList] = useState([]);
  const [employees, setEmployees] = useState([]);
  const toast = useToast();

  const mappedStages = useMemo(() => mapStages(settings?.fileStages), [settings?.fileStages]);

  // Pre-populate the referrer autocomplete from values already in use.
  useEffect(() => {
    api.leads({ limit: 2000 }).then(d => {
      const set = new Set();
      (d.leads || []).forEach(l => { if (l.referrer) set.add(l.referrer); });
      setReferrerList(Array.from(set).sort());
    }).catch(() => {});
  }, []);

  // Fetch active employees for consultant dropdown
  useEffect(() => {
    api.employeesActive().then(setEmployees).catch(() => setEmployees([]));
  }, []);

  // Pre-fill consultant details if user can view own leads only
  useEffect(() => {
    if (!lead && user && canViewOwnLeadsOnly(user) && employees.length > 0) {
      const meEmp = employees.find(e => String(e.emp_id) === String(user.emp_id));
      if (meEmp) {
        setForm(prev => ({
          ...prev,
          assigned_employee_id: String(meEmp.id),
          assigned_consultant: meEmp.name
        }));
      }
    }
  }, [lead, user, employees]);

  // Auto-balance = fee - paid; show live but don't make it editable.
  const balance = useMemo(() => {
    const fee  = parseFloat(form.service_fee) || 0;
    const paid = parseFloat(form.paid) || 0;
    return Math.max(0, fee - paid);
  }, [form.service_fee, form.paid]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      let finalPhone = form.phone ? form.phone.trim() : '';
      if (finalPhone) {
        const digits = finalPhone.replace(/[^\d]/g, '');
        if (digits.startsWith('01') && digits.length === 11) {
          finalPhone = '+88' + digits;
        } else if (digits.startsWith('8801') && digits.length === 13) {
          finalPhone = '+' + digits;
        }
      }

      const payload = {
        ...form,
        phone:       finalPhone,
        gpa:         form.gpa === '' ? null : Number(form.gpa),
        service_fee: form.service_fee === '' ? 0 : Number(form.service_fee),
        paid:        form.paid        === '' ? 0 : Number(form.paid),
        deposit:     form.deposit     === '' ? 0 : Number(form.deposit),
        assigned_employee_id: form.assigned_employee_id ? Number(form.assigned_employee_id) : null,
      };
      // Keep assigned_consultant in sync if employee selected
      if (payload.assigned_employee_id) {
        const emp = employees.find(e => e.id === payload.assigned_employee_id);
        if (emp?.name) payload.assigned_consultant = emp.name;
      }
      if (lead) { await api.updateLead(lead.id, payload); toast.success(`${form.client_name} updated`); }
      else      { await api.createLead(payload); toast.success(`${form.client_name} added`); }
      onSave?.();
    } catch (err) {
      toast.error(err.message || 'Could not save');
    } finally { setSaving(false); }
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      {/* ── Contact ── */}
      <Section icon={<User size={14}/>} title="Contact" color="blue">
        <Row>
          <Field label="Full name" required value={form.client_name} onChange={v => set('client_name', v)} placeholder="e.g. Md Saiful Haque" />
          <Field label="Phone" required type="tel" value={form.phone} onChange={v => set('phone', v)} placeholder="+8801XXX-XXXXXX" />
        </Row>
        <Row>
          <Field label="Email" type="email" value={form.email} onChange={v => set('email', v)} placeholder="student@example.com" />
          <Field label="Nationality" value={form.nationality} onChange={v => set('nationality', v)} placeholder="Bangladesh" list="nationality-list" />
          <datalist id="nationality-list">
            {['Bangladesh', 'Pakistan', 'India', 'Nepal', 'Sri Lanka', 'Morocco', 'Egypt'].map(n => <option key={n} value={n} />)}
          </datalist>
        </Row>
        <Row>
          <Field label="Passport number" value={form.passport} onChange={v => set('passport', v)} placeholder="A12345678" mono />
          <Field label="Age" type="number" value={form.age} onChange={v => set('age', v)} placeholder="e.g. 21" />
          {!isAgentUser && <Field label="Date added" type="date" value={form.date_added} onChange={v => set('date_added', v)} />}
        </Row>
      </Section>

      {/* ── Plan to study ── */}
      <Section icon={<GraduationCap size={14}/>} title="Plan to study" color="violet">
        <Row>
          <SelectField label="Destination" value={form.destination} onChange={v => set('destination', v)}
            options={settings?.destinations || ['China', 'Malta', 'Hungary', 'Greece', 'Estonia']} placeholder="— pick —" />
          <Field label="Intake term" value={form.intake_term} onChange={v => set('intake_term', v)} placeholder="September 2026" list="intake-list" />
          <datalist id="intake-list">
            {['Spring 2026', 'March 2026', 'September 2026', 'Spring 2027', 'September 2027'].map(n => <option key={n} value={n} />)}
          </datalist>
        </Row>
        <Row>
          <SelectField label="Degree" value={form.degree} onChange={v => set('degree', v)} options={DEGREES} placeholder="— pick —" />
          <Field label="Major / Program" value={form.major || form.program} onChange={v => set('major', v)} placeholder="e.g. Computer Science & Engineering" list="leadform-major-list" />
        </Row>
        <Row>
          <Field label="Primary university (preference)" value={form.university} onChange={v => set('university', v)} placeholder="e.g. Sichuan University" list="leadform-uni-list" />
        </Row>
        <datalist id="leadform-major-list">
          {['Computer Science & Engineering', 'Software Engineering', 'MBBS (General Medicine)', 'Business Administration (BBA)', 'Master of Business Administration (MBA)', 'Civil Engineering', 'Mechanical Engineering', 'Electrical & Electronic Engineering (EEE)', 'International Business & Trade', 'Information Technology', 'Cyber Security', 'Data Science & AI', 'Pharmacy', 'Hospitality & Tourism Management'].map(m => <option key={m} value={m} />)}
        </datalist>
        <datalist id="leadform-uni-list">
          {['Sichuan University', 'Zhejiang University', 'Tsinghua University', 'Peking University', 'Nanjing University', 'Wuhan University', 'Harbin Institute of Technology', 'Xi\'an Jiaotong University', 'Tongji University', 'Fudan University', 'Jiangsu University', 'Guangdong University of Technology', 'Universiti Malaya', 'Universiti Putra Malaysia', 'University of Malta', 'Chulalongkorn University'].map(u => <option key={u} value={u} />)}
        </datalist>
      </Section>

      {/* ── Academic Profile ── */}
      <Section icon={<GraduationCap size={14}/>} title="Academic Profile" color="orange">
        <Row>
          <SelectField label="Last education" value={form.last_education} onChange={v => set('last_education', v)} 
            options={['SSC', 'HSC', 'O Level', 'A Level', 'Dakhil', 'Alim', 'Diploma', 'Degree', 'Bachelor', 'Masters']} 
            placeholder="— pick —" />
          <Field label="Major / Group" value={form.last_education_major} onChange={v => set('last_education_major', v)} placeholder="Science / Business" />
        </Row>
        <Row>
          <Field label="GPA / CGPA" type="number" step="0.01" value={form.gpa} onChange={v => set('gpa', v)} placeholder="4.50" />
          <Field label="Passing Year" value={form.passing_year} onChange={v => set('passing_year', v)} placeholder="e.g. 2024" />
        </Row>
        <Row>
          <SelectField label="English Test" value={form.english_test_type} onChange={v => set('english_test_type', v)}
            options={['IELTS', 'TOEFL', 'PTE', 'Duolingo', 'MOI', 'OET', 'Oxford ELLT', 'Cambridge', 'LanguageCert', 'EFSET']} placeholder="— pick —" />
          <Field label="Score" value={form.english_score} onChange={v => set('english_score', v)} placeholder="6.5" />
        </Row>
      </Section>

      {/* ── Sales & Source ── */}
      {!isAgentUser && (
      <Section icon={<Briefcase size={14}/>} title="Sales & Source" color="indigo">
        <Row>
          <SelectField label="Market" value={form.lead_market} onChange={v => set('lead_market', v)} options={['Bangladesh', 'China']} placeholder="— pick —" />
          <SelectField label="Type" value={form.lead_type} onChange={v => set('lead_type', v)} options={['B2C', 'B2B']} placeholder="— pick —" />
          <SelectField label="Acquisition Channel" value={form.lead_source} onChange={v => set('lead_source', v)}
            options={settings?.leadSources || []} placeholder="— pick —" />
          <div>
            <Field label="Page Name (Source)" value={form.page_name || ''} onChange={v => set('page_name', v)}
              placeholder="e.g. WhatsApp, EduExpress" list="page-list" />
            <datalist id="page-list">
              {(settings?.pages || []).map(p => <option key={p} value={p} />)}
              <option value="WhatsApp" />
            </datalist>
          </div>
        </Row>
        <Row>
          <Field label="Referrer (Referance)" value={form.referrer} onChange={v => set('referrer', v)}
            placeholder="e.g. BheUni, AZ Int, Mahmud, Office (M)" list="referrer-list" />
          <datalist id="referrer-list">
            {referrerList.map(r => <option key={r} value={r} />)}
            {(settings?.consultants || []).map(c => <option key={'c-' + c} value={c} />)}
          </datalist>
          <SelectField label="Lead status" value={form.lead_status} onChange={v => set('lead_status', v)}
            options={settings?.leadStatuses || []} placeholder="— pick —" />
        </Row>
        <Row>
          <EmployeeSelect label="Assigned consultant" value={form.assigned_employee_id || ''} onChange={v => set('assigned_employee_id', v)}
            employees={employees} placeholder="— pick —" disabled={canViewOwnLeadsOnly(user)} />
          <Field label="Next follow-up" type="date" value={form.next_followup} onChange={v => set('next_followup', v)} />
        </Row>
      </Section>
      )}

      {/* ── File & Application Status ── */}
      {!isAgentUser && (
      <Section icon={<FolderOpen size={14}/>} title="File & Application Status" color="indigo">
            <Row cols={1}>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  File Stage (Active Student Profile)
                </label>
                <select
                  value={form.application_stage || mappedStages[0]?.key || ''}
                  onChange={e => set('application_stage', e.target.value)}
                  className="w-full h-10 border border-slate-200 rounded-xl px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white font-semibold text-slate-700 cursor-pointer"
                >
                  <option value="">— pick file stage —</option>
                  {mappedStages.map(s => (
                    <option key={s.key} value={s.key}>{s.label}</option>
                  ))}
                </select>
              </div>
            </Row>
            <Row>
              <SelectField label="Payment Agreement" value={form.payment_agreement} onChange={v => set('payment_agreement', v)}
                options={['Standard', 'All Payment After VISA (Hardcopy Required)', 'All Payment After VISA (Deposit Required)']} placeholder="— pick —" />
              <SelectField label="Hardcopy Status" value={form.hardcopy_status} onChange={v => set('hardcopy_status', v)}
                options={['Not Received', 'Received (In Office)', 'Returned to Student']} placeholder="— pick —" />
            </Row>
            {form.hardcopy_status === 'Received (In Office)' && (
              <Row cols={1}>
                <TextareaField label="List of Received Documents" value={form.hardcopy_documents} onChange={v => set('hardcopy_documents', v)}
                  placeholder="e.g. Original Passport, SSC Certificate, HSC Marksheet..." rows={2} />
              </Row>
            )}
      </Section>
      )}

      {/* ── Financial ── */}
      {!isAgentUser && (
      <Section icon={<Wallet size={14}/>} title="Financial" color="emerald">
        <Row cols={4}>
          <Field label="Service fee (৳)" type="number" value={form.service_fee} onChange={v => set('service_fee', v)} placeholder="0" />
          <Field label="Paid so far (৳)" type="number" value={form.paid} onChange={v => set('paid', v)} placeholder="0" />
          <Field label="Deposit (৳)" type="number" value={form.deposit} onChange={v => set('deposit', v)} placeholder="0" />
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Balance</label>
            <div className="border border-slate-200 bg-slate-50 rounded-xl px-3 py-2 text-sm tabular-nums font-semibold text-slate-700">
              ৳{balance.toLocaleString()}
            </div>
          </div>
        </Row>
        <Row cols={1}>
          <SelectField label="Payment status" value={form.payment_status} onChange={v => set('payment_status', v)}
            options={settings?.paymentStatuses || []} placeholder="— pick —" />
        </Row>
      </Section>
      )}

      {/* ── Files & Notes ── */}
      <Section icon={<FolderOpen size={14}/>} title="Files & Notes" color="amber">
        <Row cols={1}>
          <Field label="Google Drive folder" value={form.drive_link} onChange={v => set('drive_link', v)}
            placeholder="https://drive.google.com/…" mono />
        </Row>
        <Row cols={1}>
          <TextareaField label="Notes" value={form.notes} onChange={v => set('notes', v)}
            placeholder="Anything the next person should know about this student…" rows={3} />
        </Row>
      </Section>

      {/* ── Medical & Emergency (collapsible) ── */}
      <details className="group bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <summary className="cursor-pointer px-5 py-3 flex items-center gap-2 hover:bg-slate-50 list-none">
          <div className="p-1.5 rounded-lg bg-rose-50 text-rose-600"><Heart size={14}/></div>
          <span className="font-semibold text-slate-700 text-sm flex-1">Medical & Emergency</span>
          <ChevronDown size={15} className="text-slate-400 group-open:rotate-180 transition-transform" />
        </summary>
        <div className="p-5 pt-2 space-y-3 border-t border-slate-100">
          <Row>
            <SelectField label="Blood group" value={form.blood_group} onChange={v => set('blood_group', v)}
              options={BLOOD} placeholder="—" />
            <Field label="Date of birth" type="date" value={form.date_of_birth} onChange={v => set('date_of_birth', v)} />
          </Row>
          <Row>
            <Field label="Height" value={form.height} onChange={v => set('height', v)} placeholder="e.g. 5'8&quot;" />
            <Field label="Weight" value={form.weight} onChange={v => set('weight', v)} placeholder="e.g. 70 kg" />
          </Row>
          <Row cols={1}>
            <Field label="Emergency contact" value={form.emergency_contact} onChange={v => set('emergency_contact', v)}
              placeholder="Name + relationship + phone (e.g. Father · +880 1XXX-XXXXXX)" />
          </Row>
          <Row cols={1}>
            <TextareaField label="Medical History / Notes" value={form.medical_notes} onChange={v => set('medical_notes', v)}
              placeholder="Allergies, conditions, past surgeries, medications…" rows={2} />
          </Row>
        </div>
      </details>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-1 sticky bottom-0 bg-white py-3 -mx-6 px-6 border-t border-slate-100">
        <button type="submit" disabled={saving}
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-xl text-sm font-medium disabled:opacity-60 flex items-center gap-2 shadow-sm">
          <Save size={14}/> {saving ? 'Saving…' : (lead ? 'Update lead' : 'Add lead')}
        </button>
      </div>
    </form>
  );
}

/* ─── Initial form state from an existing lead (or sensible defaults) ─── */
function initial(lead, user) {
  if (!lead) return {
    lead_status: 'New Lead',
    date_added: new Date().toISOString().slice(0, 10),
    nationality: 'Bangladesh',
    service_fee: '', paid: '', deposit: '',
    source: '', lead_source: '', referrer: '',
    destination: '', degree: '', major: '',
    intake_term: '', university: '', last_education: '',
    passport: '', english_score: '',
    drive_link: '',
    blood_group: '', date_of_birth: '',
    medical_notes: '', emergency_contact: '',
    gpa: '',
    assigned_consultant: user ? user.name : '',
    assigned_employee_id: user ? user.id : '',
  };
  return {
    ...lead,
    gpa:         lead.gpa ?? '',
    service_fee: lead.service_fee ?? '',
    paid:        lead.paid ?? '',
    deposit:     lead.deposit ?? '',
    phone:       lead.phone ?? '',
    assigned_employee_id: lead.assigned_employee_id ?? '',
    // ensure all the Excel + medical fields exist on the form even if null in DB
    source: lead.source ?? '', referrer: lead.referrer ?? '',
    nationality: lead.nationality ?? '', passport: lead.passport ?? '',
    degree: lead.degree ?? '', major: lead.major ?? '',
    intake_term: lead.intake_term ?? '', university: lead.university ?? '',
    drive_link: lead.drive_link ?? '',
    blood_group: lead.blood_group ?? '', date_of_birth: lead.date_of_birth ?? '', age: lead.age ?? '',
    medical_notes: lead.medical_notes ?? '', emergency_contact: lead.emergency_contact ?? '',
    passing_year: lead.passing_year ?? '', last_education_major: lead.last_education_major ?? '',
    height: lead.height ?? '', weight: lead.weight ?? '',
    english_test_type: lead.english_test_type ?? '',
    payment_agreement: lead.payment_agreement ?? '',
    hardcopy_status: lead.hardcopy_status ?? '',
    hardcopy_documents: lead.hardcopy_documents ?? '',
  };
}

/* ─── small UI primitives ─── */
function Section({ icon, title, color, children }) {
  const palette = {
    blue:    'bg-blue-50 text-blue-600 border-blue-200',
    violet:  'bg-violet-50 text-violet-600 border-violet-200',
    indigo:  'bg-indigo-50 text-indigo-600 border-indigo-200',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    amber:   'bg-amber-50 text-amber-600 border-amber-200',
    rose:    'bg-rose-50 text-rose-600 border-rose-200',
    orange:  'bg-amber-50 text-amber-700 border-amber-200',
  };
  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-2xs">
      <div className="flex items-center gap-2.5 px-5 py-3 border-b border-slate-100 bg-slate-50/60">
        <div className={`p-1.5 rounded-xl border ${palette[color] || palette.blue}`}>{icon}</div>
        <span className="font-extrabold text-slate-800 text-sm tracking-tight">{title}</span>
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </div>
  );
}

function Row({ cols = 2, children }) {
  const cls = { 1: 'grid-cols-1', 2: 'grid-cols-1 sm:grid-cols-2', 3: 'grid-cols-1 sm:grid-cols-3', 4: 'grid-cols-2 sm:grid-cols-4' }[cols];
  return <div className={`grid ${cls} gap-4`}>{children}</div>;
}

function Field({ label, value = '', onChange, type = 'text', placeholder, required, list, mono, step }) {
  return (
    <div>
      <label className="block text-xs font-extrabold text-slate-700 mb-1.5 uppercase tracking-wider">
        {label}{required && <span className="text-rose-500"> *</span>}
      </label>
      <input type={type} required={required} value={value ?? ''} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} list={list} step={step}
        className={`w-full h-10 bg-slate-50/50 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-xl px-3.5 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all ${mono ? 'font-mono' : ''}`} />
    </div>
  );
}

function SelectField({ label, value = '', onChange, options = [], placeholder = '— Select Option —', required }) {
  return (
    <div>
      <label className="block text-xs font-extrabold text-slate-700 mb-1.5 uppercase tracking-wider">
        {label}{required && <span className="text-rose-500"> *</span>}
      </label>
      <select value={value ?? ''} onChange={e => onChange(e.target.value)} required={required}
        className="w-full h-10 bg-slate-50/50 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-xl px-3.5 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all cursor-pointer">
        <option value="">{placeholder}</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function TextareaField({ label, value = '', onChange, placeholder, rows = 3 }) {
  return (
    <div>
      <label className="block text-xs font-extrabold text-slate-700 mb-1.5 uppercase tracking-wider">{label}</label>
      <textarea rows={rows} value={value ?? ''} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full bg-slate-50/50 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-xl p-3.5 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all resize-none" />
    </div>
  );
}

function EmployeeSelect({ label, value = '', onChange, employees = [], placeholder = '— select —', required, disabled }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1">
        {label}{required && <span className="text-rose-500"> *</span>}
      </label>
      <select value={value ?? ''} onChange={e => onChange(e.target.value)} required={required} disabled={disabled}
        className="w-full h-10 border border-slate-200 rounded-xl px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white cursor-pointer disabled:bg-slate-50 disabled:text-slate-500">
        <option value="">{placeholder}</option>
        {employees.map(e => <option key={e.id} value={String(e.id)}>{e.name}</option>)}
      </select>
    </div>
  );
}
