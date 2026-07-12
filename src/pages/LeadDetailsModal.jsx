import { useState } from 'react';
import Modal from '../components/Modal';
import LeadForm from './LeadForm';
import { Pencil, User, Phone, Mail, MapPin, Calendar, Globe, Building2, GraduationCap, FolderOpen, Wallet, HeartPulse, BookOpen } from 'lucide-react';
import StatusBadge from '../components/StatusBadge';

const formatCurrency = (val) => {
  const num = parseFloat(val);
  return isNaN(num) ? '৳ 0' : `৳ ${num.toLocaleString('en-IN')}`;
};

const DataField = ({ label, value, colSpan = 1 }) => (
  <div className={`flex flex-col gap-1 ${colSpan > 1 ? `col-span-${colSpan}` : ''}`}>
    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{label}</span>
    <span className="text-sm text-slate-700 font-medium whitespace-pre-wrap">{value || <span className="text-slate-300 italic">Not provided</span>}</span>
  </div>
);

const Section = ({ title, icon: Icon, children }) => (
  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-5">
    <div className="bg-slate-50 border-b border-slate-100 px-4 py-3 flex items-center gap-2">
      <Icon size={16} className="text-slate-500" />
      <h3 className="text-sm font-bold text-slate-700">{title}</h3>
    </div>
    <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {children}
    </div>
  </div>
);

export default function LeadDetailsModal({ user, lead, settings, onClose, onSave }) {
  // If 'add' is passed as lead, immediately start in edit mode
  const [isEditing, setIsEditing] = useState(lead === 'add');

  if (isEditing) {
    return (
      <Modal title={lead === 'add' ? '➕ Add New Lead' : `✏️ Edit Lead — ${lead.lead_id}`} onClose={onClose} wide>
        <LeadForm user={user} lead={lead === 'add' ? null : lead} settings={settings} onSave={onSave} onCancel={() => {
          if (lead === 'add') onClose();
          else setIsEditing(false);
        }} />
      </Modal>
    );
  }

  const balance = (parseFloat(lead.service_fee) || 0) - (parseFloat(lead.paid) || 0);

  return (
    <Modal title={`Lead Details — ${lead.lead_id}`} onClose={onClose} wide>
      {/* Header Actions */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
        <div>
          <h2 className="text-2xl font-black text-slate-800">{lead.client_name || 'Unnamed Client'}</h2>
          <div className="flex items-center gap-3 mt-2">
            <StatusBadge status={lead.lead_status} />
            <span className="text-sm font-medium text-slate-500 flex items-center gap-1.5">
              <User size={14} /> {lead.assigned_consultant || 'Unassigned'}
            </span>
          </div>
        </div>
        <button
          onClick={() => setIsEditing(true)}
          className="flex items-center gap-2 bg-amber-500 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-amber-600 transition-colors shadow-sm cursor-pointer"
        >
          <Pencil size={14} /> Edit Lead
        </button>
      </div>

      <div className="max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
        {/* Contact & Profile */}
        <Section title="Contact & Profile" icon={User}>
          <DataField label="Phone Number" value={lead.phone} />
          <DataField label="Email Address" value={lead.email} />
          <DataField label="Date of Birth" value={lead.date_of_birth} />
          <DataField label="Nationality" value={lead.nationality} />
          <DataField label="Passport Number" value={lead.passport} />
        </Section>

        {/* Academic Background */}
        <Section title="Academic Background" icon={GraduationCap}>
          <DataField label="Last Education" value={lead.last_education} />
          <DataField label="Major/Background" value={lead.last_education_major} />
          <DataField label="Passing Year" value={lead.passing_year} />
          <DataField label="GPA / Result" value={lead.gpa} />
          <DataField label="English Test" value={lead.english_test_type} />
          <DataField label="English Score" value={lead.english_score} />
        </Section>

        {/* Target Program */}
        <Section title="Target Program" icon={Globe}>
          <DataField label="Destination" value={lead.destination} />
          <DataField label="University" value={lead.university} />
          <DataField label="Target Degree" value={lead.degree} />
          <DataField label="Target Major" value={lead.major} />
          <DataField label="Intake Term" value={lead.intake_term} />
        </Section>

        {/* Lead & Sales Info */}
        <Section title="Sales & Attribution" icon={Building2}>
          <DataField label="Lead Source" value={lead.lead_source} />
          <DataField label="Referrer / Agent" value={lead.referrer} />
          <DataField label="Page Name" value={lead.page_name} />
          <DataField label="Ad Name" value={lead.ad_name} />
          <DataField label="Lead Market" value={lead.lead_market} />
          <DataField label="Lead Type" value={lead.lead_type} />
        </Section>

        {/* Application Status */}
        <Section title="Application & Documents" icon={FolderOpen}>
          <DataField label="Application Stage" value={lead.application_stage} />
          <DataField label="Hardcopy Status" value={lead.hardcopy_status} />
          <DataField label="Hardcopy Docs" value={lead.hardcopy_documents} colSpan={3} />
        </Section>

        {/* Financials */}
        <Section title="Financials" icon={Wallet}>
          <DataField label="Service Fee" value={formatCurrency(lead.service_fee)} />
          <DataField label="Paid" value={formatCurrency(lead.paid)} />
          <DataField label="Balance" value={formatCurrency(balance)} />
          <DataField label="Deposit" value={lead.deposit ? formatCurrency(lead.deposit) : ''} />
          <DataField label="Payment Status" value={lead.payment_status} />
          <DataField label="Payment Agreement" value={lead.payment_agreement} colSpan={3} />
        </Section>

        {/* Medical & Emergency */}
        <Section title="Medical & Emergency" icon={HeartPulse}>
          <DataField label="Blood Group" value={lead.blood_group} />
          <DataField label="Height / Weight" value={lead.height || lead.weight ? `${lead.height || '-'} / ${lead.weight || '-'}` : ''} />
          <DataField label="Emergency Contact" value={lead.emergency_contact} />
          <DataField label="Medical Notes" value={lead.medical_notes} colSpan={3} />
        </Section>

        {/* Notes */}
        <Section title="Notes & Follow-up" icon={BookOpen}>
          <DataField label="Next Follow-up" value={lead.next_followup} />
          <DataField label="Internal Notes" value={lead.notes} colSpan={3} />
        </Section>
      </div>
    </Modal>
  );
}
