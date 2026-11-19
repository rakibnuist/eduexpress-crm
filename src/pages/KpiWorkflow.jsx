import { useEffect, useState } from 'react';
import { Activity, Users, User } from 'lucide-react';
import { isFullAdmin, userHasAnyRole } from '../lib/roles';
import { TeamKpiWorkflowView, PersonalKpiWorkflowPanel } from '../components/EmployeeKpiWorkflow';

function dhakaMonth() {
  return new Date(Date.now() + 6 * 3600 * 1000).toISOString().slice(0, 7);
}

export default function KpiWorkflow({ user }) {
  const isManager = isFullAdmin(user) || userHasAnyRole(user, 'application_manager', 'marketing_manager');
  const [month, setMonth] = useState(dhakaMonth);
  const [scope, setScope] = useState(isManager ? 'team' : 'me');

  useEffect(() => {
    document.title = 'Employee KPI & Workflow | EduExpress Core';
  }, []);

  return (
    <div className="space-y-5">
      {/* Header Banner */}
      <div className="bg-slate-900 rounded-2xl p-5 sm:p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute -top-24 -right-20 w-72 h-72 bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-xl border border-white/10">
              <Activity size={20} className="text-blue-400" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">Employee KPI & Workflow Tracer</h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                Trace shift check-ins, lead response SLAs, task directives, CRM & chat output, and daily logs in one live view.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {isManager && (
              <div className="flex items-center bg-white/10 p-0.5 rounded-xl border border-white/10 text-xs">
                <button
                  onClick={() => setScope('team')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    scope === 'team' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <Users size={13} /> Team
                </button>
                <button
                  onClick={() => setScope('me')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    scope === 'me' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <User size={13} /> My KPI
                </button>
              </div>
            )}

            <input
              type="month"
              value={month}
              onChange={e => setMonth(e.target.value)}
              className="px-3 py-1.5 bg-white/10 border border-white/15 rounded-xl text-sm font-semibold text-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-400/40"
            />
          </div>
        </div>
      </div>

      {isManager && scope === 'team' ? (
        <TeamKpiWorkflowView month={month} user={user} />
      ) : (
        <PersonalKpiWorkflowPanel month={month} user={user} />
      )}
    </div>
  );
}
