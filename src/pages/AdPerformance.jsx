import { useEffect, useState } from 'react';
import { api } from '../api';
import { isFullAdmin } from '../lib/roles';
import { MousePointerClick, X } from 'lucide-react';

function FilterSelect({ value, onChange, options, placeholder, formatOption = x => x }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="h-9 px-3 text-xs border border-slate-200/80 rounded-xl bg-slate-50 text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-100 hover:bg-slate-100 transition-colors shadow-sm"
    >
      <option value="">{placeholder}</option>
      {options.map(opt => {
        const val = typeof opt === 'string' ? opt : opt.value;
        const label = typeof opt === 'string' ? opt : opt.label;
        return <option key={val} value={val}>{formatOption(label)}</option>;
      })}
    </select>
  );
}

export default function AdPerformance({ user }) {
  const isAdmin = user?.role === 'admin' || (user?.roles && (user.roles.includes('founder_ceo') || user.roles.includes('managing_director')));
  
  const [settings, setSettings] = useState(null);
  const [statsDays, setStatsDays] = useState(30);
  const [statsFilters, setStatsFilters] = useState({ source: '', page_name: '', ad_name: '' });
  const [sourceStats, setSourceStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);

  useEffect(() => {
    document.title = "Ad Performance | EduExpress Core";
    api.settings().then(setSettings).catch(console.error);
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    setStatsLoading(true);
    const params = new URLSearchParams({ days: statsDays });
    if (statsFilters.source) params.append('source', statsFilters.source);
    if (statsFilters.page_name) params.append('page_name', statsFilters.page_name);
    if (statsFilters.ad_name) params.append('ad_name', statsFilters.ad_name);
    
    fetch(`/api/leads/source-stats?${params.toString()}`, { credentials: 'include' })
      .then(r => r.json())
      .then(setSourceStats)
      .catch(console.error)
      .finally(() => setStatsLoading(false));
  }, [isAdmin, statsDays, statsFilters]);

  if (!isAdmin) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-20 px-4">
        <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
          <MousePointerClick size={32} className="text-slate-400" />
        </div>
        <h2 className="text-xl font-bold text-slate-700">Access Denied</h2>
        <p className="text-slate-500 mt-2 text-center max-w-sm">
          You don't have permission to view the Ad Performance metrics.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50/50">
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-slate-200 px-6 lg:px-10 py-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 max-w-[1600px] mx-auto w-full">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2.5">
              <MousePointerClick className="text-blue-500" />
              Ad Performance
            </h1>
            <p className="text-slate-500 text-sm mt-1">Analytics for Messenger, Instagram, WhatsApp & Web Leads</p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={statsDays}
              onChange={e => setStatsDays(Number(e.target.value))}
              className="text-sm border border-slate-200 rounded-xl px-3 py-2 bg-white font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100 shadow-sm hover:border-slate-300 transition-colors cursor-pointer"
            >
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
              <option value={365}>Last 1 year</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto px-4 lg:px-10 py-6">
        <div className="max-w-[1600px] mx-auto w-full space-y-6">
          {/* Filters */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-wrap gap-3 items-center">
             <FilterSelect value={statsFilters.source} onChange={v => setStatsFilters(s => ({ ...s, source: v }))} options={settings?.leadSources || []} placeholder="All Sources" />
             <FilterSelect value={statsFilters.page_name} onChange={v => setStatsFilters(s => ({ ...s, page_name: v }))} options={settings?.pages || []} placeholder="All Pages" />
             <FilterSelect value={statsFilters.ad_name} onChange={v => setStatsFilters(s => ({ ...s, ad_name: v }))} options={settings?.ads || []} placeholder="All Ads" />
             {(statsFilters.source || statsFilters.page_name || statsFilters.ad_name) && (
               <button onClick={() => setStatsFilters({ source: '', page_name: '', ad_name: '' })} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-rose-600 bg-rose-50 rounded-xl hover:bg-rose-100 font-medium transition-colors cursor-pointer">
                 <X size={14} /> Clear
               </button>
             )}
          </div>

          {statsLoading ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-10 flex flex-col items-center justify-center">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-sm font-medium text-slate-500">Loading metrics...</p>
            </div>
          ) : !sourceStats || (sourceStats.byPage.length === 0 && sourceStats.byAd.length === 0 && sourceStats.bySource.length === 0) ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm">
              <p className="text-4xl mb-3">📭</p>
              <p className="text-base font-bold text-slate-700">No ad attribution data yet</p>
              <p className="text-sm text-slate-500 mt-1">Data will appear when leads arrive via Facebook/Instagram ad clicks</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* By Source */}
              {sourceStats.bySource?.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                  <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
                    <h4 className="font-bold text-slate-700 flex items-center gap-2">
                      <span className="text-blue-500">📥</span> By Source
                    </h4>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-white text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">
                          <th className="text-left px-5 py-3">Source</th>
                          <th className="text-center px-5 py-3">Leads</th>
                          <th className="text-center px-5 py-3">Active</th>
                          <th className="text-center px-5 py-3">Positive</th>
                          <th className="text-center px-5 py-3">Office Visited</th>
                          <th className="text-center px-5 py-3">File Opened</th>
                          <th className="text-center px-5 py-3">Conv. Rate</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {sourceStats.bySource.map((row, i) => {
                          const rate = row.total_leads > 0 ? ((row.file_opened / row.total_leads) * 100).toFixed(1) : '0.0';
                          return (
                            <tr key={i} className="hover:bg-blue-50/30 transition-colors">
                              <td className="px-5 py-3.5 font-semibold text-slate-700">{row.source || '—'}</td>
                              <td className="px-5 py-3.5 text-center font-bold text-slate-800">{row.total_leads}</td>
                              <td className="px-5 py-3.5 text-center text-emerald-600 font-semibold">{row.active}</td>
                              <td className="px-5 py-3.5 text-center text-cyan-600 font-semibold">{row.positive}</td>
                              <td className="px-5 py-3.5 text-center text-purple-600 font-semibold">{row.office_visited}</td>
                              <td className="px-5 py-3.5 text-center text-indigo-600 font-bold">{row.file_opened}</td>
                              <td className="px-5 py-3.5 text-center">
                                <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                                  parseFloat(rate) >= 20 ? 'bg-emerald-100 text-emerald-700' :
                                  parseFloat(rate) >= 10 ? 'bg-amber-100 text-amber-700' :
                                  'bg-slate-100 text-slate-500'
                                }`}>{rate}%</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* By Page */}
              {sourceStats.byPage.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                  <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
                    <h4 className="font-bold text-slate-700 flex items-center gap-2">
                      <span className="text-blue-500">📘</span> By Facebook Page
                    </h4>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-white text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">
                          <th className="text-left px-5 py-3">Page</th>
                          <th className="text-center px-5 py-3">Leads</th>
                          <th className="text-center px-5 py-3">Active</th>
                          <th className="text-center px-5 py-3">Positive</th>
                          <th className="text-center px-5 py-3">Office Visited</th>
                          <th className="text-center px-5 py-3">File Opened</th>
                          <th className="text-center px-5 py-3">Conv. Rate</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {sourceStats.byPage.map((row, i) => {
                          const rate = row.total_leads > 0 ? ((row.file_opened / row.total_leads) * 100).toFixed(1) : '0.0';
                          return (
                            <tr key={i} className="hover:bg-blue-50/30 transition-colors">
                              <td className="px-5 py-3.5 font-semibold text-slate-700">{row.page_name || '—'}</td>
                              <td className="px-5 py-3.5 text-center font-bold text-slate-800">{row.total_leads}</td>
                              <td className="px-5 py-3.5 text-center text-emerald-600 font-semibold">{row.active}</td>
                              <td className="px-5 py-3.5 text-center text-cyan-600 font-semibold">{row.positive}</td>
                              <td className="px-5 py-3.5 text-center text-purple-600 font-semibold">{row.office_visited}</td>
                              <td className="px-5 py-3.5 text-center text-indigo-600 font-bold">{row.file_opened}</td>
                              <td className="px-5 py-3.5 text-center">
                                <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                                  parseFloat(rate) >= 20 ? 'bg-emerald-100 text-emerald-700' :
                                  parseFloat(rate) >= 10 ? 'bg-amber-100 text-amber-700' :
                                  'bg-slate-100 text-slate-500'
                                }`}>{rate}%</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* By Ad */}
              {sourceStats.byAd.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                  <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
                    <h4 className="font-bold text-slate-700 flex items-center gap-2">
                      <span className="text-blue-500">🎯</span> By Ad
                    </h4>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-white text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">
                          <th className="text-left px-5 py-3">Ad Name</th>
                          <th className="text-left px-5 py-3">Page</th>
                          <th className="text-center px-5 py-3">Leads</th>
                          <th className="text-center px-5 py-3">Active</th>
                          <th className="text-center px-5 py-3">Positive</th>
                          <th className="text-center px-5 py-3">Office Visited</th>
                          <th className="text-center px-5 py-3">File Opened</th>
                          <th className="text-center px-5 py-3">Conv. Rate</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {sourceStats.byAd.map((row, i) => {
                          const rate = row.total_leads > 0 ? ((row.file_opened / row.total_leads) * 100).toFixed(1) : '0.0';
                          return (
                            <tr key={i} className="hover:bg-blue-50/30 transition-colors">
                              <td className="px-5 py-3.5 font-semibold text-slate-700 max-w-[250px] truncate" title={row.ad_name}>
                                {row.ad_name || '—'}
                              </td>
                              <td className="px-5 py-3.5 text-slate-500 text-xs">{row.page_name || '—'}</td>
                              <td className="px-5 py-3.5 text-center font-bold text-slate-800">{row.total_leads}</td>
                              <td className="px-5 py-3.5 text-center text-emerald-600 font-semibold">{row.active}</td>
                              <td className="px-5 py-3.5 text-center text-cyan-600 font-semibold">{row.positive}</td>
                              <td className="px-5 py-3.5 text-center text-purple-600 font-semibold">{row.office_visited}</td>
                              <td className="px-5 py-3.5 text-center text-indigo-600 font-bold">{row.file_opened}</td>
                              <td className="px-5 py-3.5 text-center">
                                <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                                  parseFloat(rate) >= 20 ? 'bg-emerald-100 text-emerald-700' :
                                  parseFloat(rate) >= 10 ? 'bg-amber-100 text-amber-700' :
                                  'bg-slate-100 text-slate-500'
                                }`}>{rate}%</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
