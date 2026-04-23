import { NavLink } from 'react-router-dom';
import {
  ShoppingCart,
  Package,
  Wallet,
  BarChart3,
  FileText,
  Users,
  Settings,
} from 'lucide-react';
import { authService } from '../services/authService';
import '../styles/Sidebar.css';

const navItems = [
  { to: '/dashboard', icon: ShoppingCart, label: 'Ventas', adminOnly: false },
  { to: '/inventory', icon: Package, label: 'Inventario', adminOnly: true },
  { to: '/cash', icon: Wallet, label: 'Caja', adminOnly: false },
  { to: '/reports', icon: BarChart3, label: 'Reportes', adminOnly: true },
  { to: '/billing', icon: FileText, label: 'Facturación', adminOnly: true },
  { to: '/users', icon: Users, label: 'Usuarios', adminOnly: true },
  { to: '/settings', icon: Settings, label: 'Ajustes', adminOnly: true },
];

export default function Sidebar() {
  const isAdmin = authService.isAdmin();

  // Filtrar ítems: si es adminOnly y NO es admin, no se muestra
  const filteredItems = navItems.filter(item => !item.adminOnly || isAdmin);

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
          </svg>
        </div>
        <div className="sidebar-logo-text">
          <span className="sidebar-logo-title">Papelería Godart</span>
          <span className="sidebar-logo-subtitle">PUNTO DE VENTA</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {filteredItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `sidebar-nav-item ${isActive ? 'sidebar-nav-item--active' : ''}`
            }
          >
            <item.icon size={20} strokeWidth={1.8} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
