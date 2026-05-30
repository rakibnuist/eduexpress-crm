import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Leads from './pages/Leads';
import Pipeline from './pages/Pipeline';
import Finance from './pages/Finance';
import HR from './pages/HR';
import Settings from './pages/Settings';
import PrivacyPolicy from './pages/PrivacyPolicy';
import Login from './pages/Login';
import { api } from './api';

export default function App() {
  const [user, setUser] = useState(undefined); // undefined = loading, null = logged out

  useEffect(() => {
    api.me().then(u => setUser(u)).catch(() => setUser(null));
  }, []);

  if (user === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-400 text-sm">Loading…</div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Public pages */}
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/login" element={
          user ? <Navigate to="/" replace /> : <Login onSuccess={setUser} />
        } />

        {/* Protected app */}
        <Route path="/*" element={
          !user ? <Navigate to="/login" replace /> :
          <Layout user={user} onLogout={() => setUser(null)}>
            <Routes>
              <Route path="/" element={<Dashboard user={user} />} />
              <Route path="/leads" element={<Leads user={user} />} />
              <Route path="/pipeline" element={<Pipeline user={user} />} />
              {user.role === 'admin' && <Route path="/finance" element={<Finance />} />}
              {user.role === 'admin' && <Route path="/hr" element={<HR />} />}
              {user.role === 'admin' && <Route path="/settings" element={<Settings />} />}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Layout>
        } />
      </Routes>
    </BrowserRouter>
  );
}
