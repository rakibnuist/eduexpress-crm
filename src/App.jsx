import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Leads from './pages/Leads';
import Pipeline from './pages/Pipeline';
import Finance from './pages/Finance';
import HR from './pages/HR';
import Meta from './pages/Meta';
import Settings from './pages/Settings';
import Inbox from './pages/Inbox';
import Channels from './pages/Channels';

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/leads" element={<Leads />} />
          <Route path="/pipeline" element={<Pipeline />} />
          <Route path="/finance" element={<Finance />} />
          <Route path="/hr" element={<HR />} />
          <Route path="/inbox" element={<Inbox />} />
          <Route path="/channels" element={<Channels />} />
          <Route path="/meta" element={<Meta />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
