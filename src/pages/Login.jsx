import { useState } from 'react';
import { GraduationCap, Loader2 } from 'lucide-react';
import { api } from '../api';

export default function Login({ onSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Best-effort geolocation — used by the server's office-geofence auto-attendance.
    // If the user denies or the browser doesn't support it, login still works; the
    // server simply falls back to "no geofence configured = always allow".
    let loc = null;
    if (navigator.geolocation) {
      loc = await new Promise(resolve => {
        navigator.geolocation.getCurrentPosition(
          p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
          () => resolve(null),
          { timeout: 4000, maximumAge: 60000 }
        );
      });
    }

    try {
      const user = await api.login(email.trim(), password, loc);
      // Surface the attendance result before handing off to the app
      const a = user.attendance;
      if (a?.ok && a.created)     sessionStorage.setItem('att_msg', `✓ Checked in at ${a.time}${a.status === 'Late' ? ' (Late)' : ''}`);
      else if (a?.ok && a.alreadyIn) sessionStorage.setItem('att_msg', `Already checked in for today`);
      else if (a?.reason === 'outside_office') sessionStorage.setItem('att_msg', `⚠ You're ${a.distance}m from the office — not checked in`);
      else if (a?.reason === 'no_location')    sessionStorage.setItem('att_msg', `Location not shared — not checked in`);
      onSuccess(user);
    } catch (err) {
      setError(err.message || 'Login failed');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-8">
          <div className="flex items-center justify-center mb-6">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl flex items-center justify-center shadow-md">
              <GraduationCap size={28} className="text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 text-center mb-1">EduExpress CRM</h1>
          <p className="text-sm text-slate-400 text-center mb-8">Sign in to your consultant dashboard</p>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Email</label>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@eduexpressint.com" autoFocus autoComplete="username"
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Password</label>
              <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" autoComplete="current-password"
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</div>
            )}

            <button type="submit" disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-xl shadow-sm transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
              {loading && <Loader2 size={16} className="animate-spin" />}
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="text-center text-xs text-slate-400 mt-6">
            EduExpress International · Student Consultancy
          </p>
        </div>
      </div>
    </div>
  );
}
