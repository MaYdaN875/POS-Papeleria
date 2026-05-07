import { HashRouter, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import { CartProvider } from './context/CartContext';
import CashPage from './pages/CashPage';
import DashboardPage from './pages/DashboardPage';
import InventoryPage from './pages/InventoryPage';
import LoginPage from './pages/LoginPage';
import PaymentPage from './pages/PaymentPage';
import { ReportsPage } from './pages/ReportsPage';
import SalesPage from './pages/SalesPage';
import UsersPage from './pages/UsersPage';
import SettingsPage from './pages/SettingsPage';
import { useEffect } from 'react';
import { getGlobalSettings } from './services/settingsService';

export default function App() {
  useEffect(() => {
    // 1. Aplicar tema local de inmediato para evitar el "flash" blanco
    const localTheme = localStorage.getItem('pos_theme');
    if (localTheme) {
      document.documentElement.setAttribute('data-theme', localTheme);
    }

    // 2. Sincronizar con el servidor para obtener el resto de los ajustes
    getGlobalSettings().then(res => {
      if (res.ok && res.settings) {
        const serverTheme = res.settings.theme || 'light';
        document.documentElement.setAttribute('data-theme', serverTheme);
        localStorage.setItem('pos_theme', serverTheme);
      }
    });
  }, []);

  return (
    <HashRouter>
      <CartProvider>
        <Routes>
          {/* Login - sin sidebar/topbar */}
          <Route path="/" element={<LoginPage />} />

          {/* Rutas Protegidas */}
          <Route element={<ProtectedRoute />}>
            {/* Payment - pantalla completa sin sidebar */}
            <Route path="/payment" element={<PaymentPage />} />

            {/* Rutas con Layout (sidebar + topbar) */}
            <Route element={<Layout />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/sales" element={<SalesPage />} />
              <Route path="/cash" element={<CashPage />} />
              
              {/* Rutas SOLO para Administradores */}
              <Route element={<ProtectedRoute requireAdmin={true} />}>
                <Route path="/inventory" element={<InventoryPage />} />
                <Route path="/reports" element={<ReportsPage />} />
                <Route path="/users" element={<UsersPage />} />
                <Route path="/billing" element={<DashboardPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Route>
            </Route>
          </Route>
        </Routes>
      </CartProvider>
    </HashRouter>
  );
}
