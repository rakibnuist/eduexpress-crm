import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState, lazy, Suspense } from 'react';
import Layout from './components/Layout';
import Login from './pages/Login';
import CommandPalette from './components/CommandPalette';
import { ToastProvider } from './components/Toast';
import { ConfirmProvider } from './components/Confirm';
import { api } from './api';

// Route-level code splitting — each page loads on demand, keeping the
// initial bundle small and first paint fast.
const Dashboard     = lazy(() => import('./pages/Dashboard'));
const Cockpit       = lazy(() => import('./pages/Cockpit'));
const Applications  = lazy(() => import('./pages/Applications'));
const Leads         = lazy(() => import('./pages/Leads'));
const LeadDetail    = lazy(() => import('./pages/LeadDetail'));
const MyDay         = lazy(() => import('./pages/MyDay'));
const Reports       = lazy(() => import('./pages/Reports'));
const Finance       = lazy(() => import('./pages/Finance'));
const HR            = lazy(() => import('./pages/HR'));
const Settings      = lazy(() => import('./pages/Settings'));
const LegalNotice   = lazy(() => import('./pages/LegalNotice'));
const StudentPortal = lazy(() => import('./pages/StudentPortal'));
const Conversations = lazy(() => import('./pages/Conversations'));
const Marketing     = lazy(() => import('./pages/Marketing'));

function PageLoader() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

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
          <Suspense fallback={<PageLoader />}>
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
                    <Suspense fallback={<PageLoader />}>
                      <Routes>
                        <Route path="/" element={<Dashboard user={user} />} />
                        {(user.role === 'admin' || user.role === 'manager') && <Route path="/cockpit" element={<Cockpit />} />}
                        {(user.role === 'admin' || user.role === 'manager') && <Route path="/reports" element={<Reports />} />}
                        <Route path="/leads" element={<Leads user={user} />} />
                        <Route path="/leads/:id" element={<LeadDetail user={user} />} />
                        <Route path="/my-day" element={<MyDay user={user} />} />
                        <Route path="/pipeline" element={<Navigate to="/leads?view=kanban" replace />} />
                        <Route path="/applications" element={<Applications user={user} />} />
                        <Route path="/conversations" element={<Conversations user={user} />} />
                        {(user.role === 'admin' || user.role === 'manager') && <Route path="/marketing" element={<Marketing />} />}
                        {user.role === 'admin' && <Route path="/finance" element={<Finance />} />}
                        {user.role === 'admin' && <Route path="/hr" element={<HR user={user} />} />}
                        {user.role === 'admin' && <Route path="/settings" element={<Settings />} />}
                        <Route path="*" element={<Navigate to="/" replace />} />
                      </Routes>
                    </Suspense>
                  </Layout>
                </>
              } />
            </Routes>
          </Suspense>
        </ConfirmProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
