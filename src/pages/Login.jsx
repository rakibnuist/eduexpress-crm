import { useState, useEffect } from 'react';
import { GraduationCap, Loader2 } from 'lucide-react';
import { api } from '../api';

export default function Login({ onSuccess }) {
  useEffect(() => { document.title = "Consultant Login | EduExpress Core"; }, []);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    let loc = null;
    let geoError = null;
    if (navigator.geolocation) {
      const getPosition = (opts) => new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, opts);
      });
      try {
        // Try high accuracy first with a shorter 6-second timeout
        const pos = await getPosition({ timeout: 6000, maximumAge: 60000, enableHighAccuracy: true });
        loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      } catch (err) {
        console.warn('[geolocation] High accuracy failed, retrying with low accuracy:', err.message || err);
        try {
          // Fallback to low accuracy (uses IP-lookup and is much more reliable on desktops/laptops)
          const pos = await getPosition({ timeout: 10000, maximumAge: 60000, enableHighAccuracy: false });
          loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        } catch (err2) {
          console.error('[geolocation] Low accuracy fallback failed:', err2.message || err2);
          geoError = err2;
        }
      }
    }

    if (!loc) {
      let msg = 'Location access is required to log in. ';
      if (geoError) {
        if (geoError.code === 1) {
          msg += 'Please allow location permission in your browser settings and try again.';
        } else if (geoError.code === 2) {
          msg += 'Position unavailable. Windows was unable to determine your physical location. Check if Wi-Fi is enabled.';
        } else if (geoError.code === 3) {
          msg += 'Location request timed out. Please try again.';
        } else {
          msg += `Error: ${geoError.message || 'Unknown error'}`;
        }
      } else {
        msg += 'Please ensure location is enabled and try again.';
      }
      setError(msg);
      setLoading(false);
      return;
    }

    try {
      // ssid is null for browsers (browsers cannot detect Wi-Fi SSID).
      // When a native/PWA client passes it, the server validates it against the office list.
      const user = await api.login(email.trim(), password, loc, null);
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative blurred shapes */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-100px] left-[-80px] w-[400px] h-[400px] bg-blue-300/30 rounded-full blur-3xl" />
        <div className="absolute bottom-[-100px] right-[-80px] w-[400px] h-[400px] bg-indigo-300/30 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative">
        {/* Brand mark above the card */}
        <div className="flex flex-col items-center mb-5">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
            <GraduationCap size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-3">EduExpress International</h1>
          <p className="text-xs text-slate-500">Consultancy Operations Core · Dhanmondi, Dhaka</p>
        </div>

        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl border border-white/60 p-8">
          <h2 className="text-lg font-semibold text-slate-800 text-center mb-1">Welcome back</h2>
          <p className="text-xs text-slate-500 text-center mb-6">Sign in to continue to your dashboard</p>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Name, Email or Consultant ID</label>
              <input type="text" required value={email} onChange={e => setEmail(e.target.value)}
                placeholder="e.g. Rakib, E-02 or email" autoFocus autoComplete="username"
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-slate-50/50 focus:bg-white transition-all font-medium" />
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
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-xl shadow-md shadow-blue-500/20 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
              {loading && <Loader2 size={16} className="animate-spin" />}
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="text-center text-[11px] text-slate-400 mt-6">
            Login requires office Wi-Fi (EduExpress / HTA) and location access.
          </p>
        </div>

        <p className="text-center text-[11px] text-slate-400 mt-4">
          © {new Date().getFullYear()} EduExpress International. All rights reserved.
        </p>
      </div>
    </div>
  );
}
