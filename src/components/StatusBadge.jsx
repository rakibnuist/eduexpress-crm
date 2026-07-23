const colors = {
  'New Lead': 'bg-sky-100 text-sky-700',
  'No Response': 'bg-slate-100 text-slate-600',
  'Positive': 'bg-emerald-100 text-emerald-700',
  'Office Visited': 'bg-purple-100 text-purple-700',
  'File Opened': 'bg-blue-100 text-blue-700',
  'Enrolled': 'bg-green-100 text-green-800',
  'Not Interested': 'bg-red-100 text-red-600',
  'Documents Withdraw': 'bg-rose-100 text-rose-800 border border-rose-200',
  'documents_withdraw': 'bg-rose-100 text-rose-800 border border-rose-200',
  'Application Withdraw': 'bg-red-100 text-red-800 border border-red-200',
  'application_withdraw': 'bg-red-100 text-red-800 border border-red-200',
  'Follow-up': 'bg-amber-100 text-amber-700',
  'Pending': 'bg-amber-100 text-amber-700',
  'Partial': 'bg-orange-100 text-orange-700',
  'Paid': 'bg-green-100 text-green-700',
  'Refunded': 'bg-pink-100 text-pink-700',
};

export default function StatusBadge({ status }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] || 'bg-slate-100 text-slate-600'}`}>
      {status || '—'}
    </span>
  );
}
