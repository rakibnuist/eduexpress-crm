import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState, lazy, Suspense } from 'react';
import Layout from './components/Layout';
import Login from './pages/Login';
import CommandPalette from './components/CommandPalette';
import { ToastProvider } from './components/Toast';
import { ConfirmProvider } from './components/Confirm';
import { api } from './api';
import {
  hasPermission, isFullAdmin, isInvestor, canManageApplications,
  canManageMarketing, canViewReports, canViewAutomation, canViewAllLeads, canViewAllConversations,
  PERMISSIONS, canViewChinaData, normalizeUserRoles
} from './lib/roles';

// Route-level code splitting
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
const AdPerformance = lazy(() => import('./pages/AdPerformance'));
const LegalNotice   = lazy(() => import('./pages/LegalNotice'));
const StudentPortal = lazy(() => import('./pages/StudentPortal'));
const Conversations = lazy(() => import('./pages/Conversations'));
const Marketing     = lazy(() => import('./pages/Marketing'));
const Automation    = lazy(() => import('./pages/Automation'));
const Destinations  = lazy(() => import('./pages/Destinations'));
const DestinationPublic = lazy(() => import('./pages/DestinationPublic'));

const AgentLogin    = lazy(() => import('./pages/AgentLogin'));

function PageLoader() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(undefined);

  useEffect(() => {
    api.me().then(u => setUser(normalizeUserRoles(u))).catch(() => setUser(null));
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
              <Route path="/privacy" element={<LegalNotice />} />
              <Route path="/d/:slug" element={<DestinationPublic />} />
              <Route path="/s/:token" element={<StudentPortal />} />
              <Route path="/login" element={
                user ? <Navigate to="/" replace /> : <Login onSuccess={u => setUser(normalizeUserRoles(u))} />
              } />
              <Route path="/partner" element={
                user ? <Navigate to="/" replace /> : <AgentLogin onSuccess={u => setUser(normalizeUserRoles(u))} />
              } />

              <Route path="/*" element={
                !user ? <Navigate to="/login" replace /> :
                <>
                  <CommandPalette user={user} />
                  <Layout user={user} onLogout={() => setUser(null)}>
                    <Suspense fallback={<PageLoader />}>
                      <Routes>
                        <Route path="/" element={<Dashboard user={user} />} />
                        {hasPermission(user, PERMISSIONS.VIEW_COCKPIT) && <Route path="/cockpit" element={<Cockpit />} />}
                        {canViewReports(user) && <Route path="/reports" element={<Reports />} />}
                        <Route path="/leads" element={<Leads user={user} />} />
                        <Route path="/leads/:id" element={<LeadDetail user={user} />} />
                        {hasPermission(user, PERMISSIONS.VIEW_MY_DAY) && <Route path="/my-day" element={<MyDay user={user} />} />}
                        <Route path="/pipeline" element={<Navigate to="/leads?view=table" replace />} />
                        <Route path="/applications" element={<Applications user={user} />} />
                        {hasPermission(user, PERMISSIONS.VIEW_CHAT_INBOX) && <Route path="/conversations" element={<Conversations user={user} />} />}
                        {canManageMarketing(user) && <Route path="/marketing" element={<Marketing />} />}
                        {canViewAutomation(user) && <Route path="/automation" element={<Automation />} />}
                        {hasPermission(user, PERMISSIONS.VIEW_FINANCE) && <Route path="/finance" element={<Finance />} />}
                        {hasPermission(user, PERMISSIONS.VIEW_HR) && <Route path="/hr" element={<HR user={user} />} />}
                        {hasPermission(user, PERMISSIONS.VIEW_AD_PERFORMANCE) && <Route path="/ad-performance" element={<AdPerformance user={user} />} />}
                        {isFullAdmin(user) && <Route path="/destinations" element={<Destinations />} />}
                        {isFullAdmin(user) && <Route path="/settings" element={<Settings />} />}
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
