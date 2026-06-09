import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Cockpit from './pages/Cockpit';
import Applications from './pages/Applications';
import Leads from './pages/Leads';
import LeadDetail from './pages/LeadDetail';
import MyDay from './pages/MyDay';
import Reports from './pages/Reports';
import Finance from './pages/Finance';
import HR from './pages/HR';
import Settings from './pages/Settings';
import LegalNotice from './pages/LegalNotice';
import Login from './pages/Login';
import StudentPortal from './pages/StudentPortal';
import Conversations from './pages/Conversations';
import CommandPalette from './components/CommandPalette';
import { ToastProvider } from './components/Toast';
import { ConfirmProvider } from './components/Confirm';
import { api } from './api';

export default function App() {
  const [user, setUser] = useState(undefined); // undefined = loading, null = logged out

  useEffect(() => {
    api.me().then(u => setUser(u)).catch(() => setUser(null));
  }, []);

  if (user === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 text-sm">Loading EduExpress Core…</p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <ToastProvider>
        <ConfirmProvider>
          <Routes>
            {/* Public pages */}
            <Route path="/privacy" element={<LegalNotice />} />
            <Route path="/s/:token" element={<StudentPortal />} />
            <Route path="/login" element={
              user ? <Navigate to="/" replace /> : <Login onSuccess={setUser} />
            } />

            {/* Protected app */}
            <Route path="/*" element={
              !user ? <Navigate to="/login" replace /> :
              <>
                <CommandPalette user={user} />
                <Layout user={user} onLogout={() => setUser(null)}>
                  <Routes>
                    <Route path="/" element={<Dashboard user={user} />} />
                    {(user.role === 'admin' || user.role === 'manager') && <Route path="/cockpit" element={<Cockpit />} />}
                    {(user.role === 'admin' || user.role === 'manager') && <Route path="/reports" element={<Reports />} />}
                    <Route path="/leads" element={<Leads user={user} />} />
                    <Route path="/leads/:id" element={<LeadDetail user={user} />} />
                    <Route path="/my-day" element={<MyDay user={user} />} />
                    <Route path="/pipeline" element={<Leads user={user} />} />
                    <Route path="/applications" element={<Applications user={user} />} />
                    <Route path="/conversations" element={<Conversations user={user} />} />
                    {user.role === 'admin' && <Route path="/finance" element={<Finance />} />}
                    {user.role === 'admin' && <Route path="/hr" element={<HR user={user} />} />}
                    {user.role === 'admin' && <Route path="/settings" element={<Settings />} />}
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </Layout>
              </>
            } />
          </Routes>
        </ConfirmProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
