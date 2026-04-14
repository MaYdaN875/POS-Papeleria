import { HashRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import SalesPage from './pages/SalesPage';
import PaymentPage from './pages/PaymentPage';

export default function App() {
  return (
    <HashRouter>
      <Routes>
        {/* Login - sin sidebar/topbar */}
        <Route path="/" element={<LoginPage />} />

        {/* Payment - pantalla completa sin sidebar */}
        <Route path="/payment" element={<PaymentPage />} />

        {/* Rutas con Layout (sidebar + topbar) */}
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/sales" element={<SalesPage />} />
          {/* Rutas futuras */}
          <Route path="/inventory" element={<DashboardPage />} />
          <Route path="/cash" element={<DashboardPage />} />
          <Route path="/reports" element={<DashboardPage />} />
          <Route path="/billing" element={<DashboardPage />} />
          <Route path="/users" element={<DashboardPage />} />
          <Route path="/settings" element={<DashboardPage />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
