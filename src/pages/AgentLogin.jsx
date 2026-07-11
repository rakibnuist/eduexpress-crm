import { useState, useEffect } from 'react';
import { Briefcase, Loader2 } from 'lucide-react';
import { api } from '../api';

export default function AgentLogin({ onSuccess }) {
  useEffect(() => { document.title = "Partner Portal Login | EduExpress"; }, []);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Agents skip the geolocation requirements in the backend. 
      // We pass null for lat/lng to avoid prompting for browser location.
      const user = await api.login(email.trim(), password, null, null);
      onSuccess(user);
    } catch (err) {
      setError(err.message || 'Login failed');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50 to-emerald-100 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative blurred shapes tailored for partners (teal/emerald) */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-100px] left-[-80px] w-[400px] h-[400px] bg-teal-300/30 rounded-full blur-3xl" />
        <div className="absolute bottom-[-100px] right-[-80px] w-[400px] h-[400px] bg-emerald-300/30 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative">
        <div className="flex flex-col items-center mb-5">
          <div className="w-16 h-16 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-teal-500/20">
            <Briefcase size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-3">Partner Agency Portal</h1>
          <p className="text-xs text-slate-500">EduExpress International Partnerships</p>
        </div>

        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl border border-white/60 p-8">
          <h2 className="text-lg font-semibold text-slate-800 text-center mb-1">Welcome Partner</h2>
          <p className="text-xs text-slate-500 text-center mb-6">Sign in to manage your students</p>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Email Address</label>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                placeholder="agency@example.com" autoFocus autoComplete="username"
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-slate-50/50 focus:bg-white transition-all font-medium" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Password</label>
              <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" autoComplete="current-password"
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent" />
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</div>
            )}

            <button type="submit" disabled={loading}
              className="w-full bg-teal-600 hover:bg-teal-700 text-white font-medium py-2.5 rounded-xl shadow-md shadow-teal-500/20 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
              {loading && <Loader2 size={16} className="animate-spin" />}
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="text-center text-[11px] text-slate-400 mt-4">
          © {new Date().getFullYear()} EduExpress International. All rights reserved.
        </p>
      </div>
    </div>
  );
}
