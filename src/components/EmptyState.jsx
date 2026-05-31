/* EmptyState — a calmer, more inviting "nothing here yet" panel used in
   place of "No data" strings. Optional CTA button.
   Usage:
     <EmptyState
       icon={<Users size={32}/>}
       title="No leads yet"
       hint="Add your first lead with the button above, or import from Excel."
       cta={{ label: 'Add lead', onClick: ... }} />
*/
import { Inbox } from 'lucide-react';

export default function EmptyState({ icon, title, hint, cta, compact = false }) {
  return (
    <div className={`bg-white rounded-2xl border border-slate-200 text-center ${compact ? 'p-6' : 'p-10'}`}>
      <div className={`mx-auto rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center
        ${compact ? 'w-10 h-10 mb-2' : 'w-14 h-14 mb-3'}`}>
        {icon || <Inbox size={compact ? 18 : 24} />}
      </div>
      <p className={`font-semibold text-slate-700 ${compact ? 'text-sm' : 'text-base'}`}>{title}</p>
      {hint && <p className={`text-slate-400 mt-1 ${compact ? 'text-xs' : 'text-sm'}`}>{hint}</p>}
      {cta && (
        <button onClick={cta.onClick}
          className={`mt-4 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl shadow-sm`}>
          {cta.label}
        </button>
      )}
    </div>
  );
}
