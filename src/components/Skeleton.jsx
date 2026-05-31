/* Skeleton — placeholder blocks for loading states.
   Variants:
     <Skeleton lines={3} />                  paragraph
     <Skeleton.Card />                       full card shell
     <Skeleton.Table cols={5} rows={5} />    table placeholder
*/
export default function Skeleton({ lines = 1, className = '' }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-3 bg-slate-100 rounded animate-pulse" style={{ width: `${100 - (i * 12)}%` }} />
      ))}
    </div>
  );
}

Skeleton.Card = function SkeletonCard() {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 animate-pulse">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 bg-slate-100 rounded-full" />
        <div className="flex-1 space-y-2">
          <div className="h-3 bg-slate-100 rounded w-1/2" />
          <div className="h-2 bg-slate-100 rounded w-1/3" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="h-2.5 bg-slate-100 rounded w-full" />
        <div className="h-2.5 bg-slate-100 rounded w-4/5" />
        <div className="h-2.5 bg-slate-100 rounded w-3/5" />
      </div>
    </div>
  );
};

Skeleton.Table = function SkeletonTable({ cols = 5, rows = 5 }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      <div className="border-b border-slate-100 p-3 flex gap-3 animate-pulse">
        {Array.from({ length: cols }).map((_, i) => <div key={i} className="h-3 bg-slate-100 rounded flex-1" />)}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="border-b border-slate-50 p-3 flex gap-3 animate-pulse">
          {Array.from({ length: cols }).map((_, c) => <div key={c} className="h-3 bg-slate-100/80 rounded flex-1" />)}
        </div>
      ))}
    </div>
  );
};

Skeleton.KpiRow = function SkeletonKpiRow({ count = 4 }) {
  return (
    <div className={`grid grid-cols-2 lg:grid-cols-${count} gap-3`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white border border-slate-200 rounded-2xl p-4 animate-pulse">
          <div className="w-10 h-10 bg-slate-100 rounded-lg mb-3" />
          <div className="h-3 bg-slate-100 rounded w-1/3 mb-2" />
          <div className="h-6 bg-slate-100 rounded w-1/2" />
        </div>
      ))}
    </div>
  );
};
