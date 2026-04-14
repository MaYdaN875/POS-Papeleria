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
import '../styles/Sidebar.css';

const navItems = [
  { to: '/dashboard', icon: ShoppingCart, label: 'Ventas' },
  { to: '/inventory', icon: Package, label: 'Inventario' },
  { to: '/cash', icon: Wallet, label: 'Caja' },
  { to: '/reports', icon: BarChart3, label: 'Reportes' },
  { to: '/billing', icon: FileText, label: 'Facturación' },
  { to: '/users', icon: Users, label: 'Usuarios' },
  { to: '/settings', icon: Settings, label: 'Ajustes' },
];

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14,2 14,8 20,8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10,9 9,9 8,9" />
          </svg>
        </div>
        <div className="sidebar-logo-text">
          <span className="sidebar-logo-title">Digital Atelier</span>
          <span className="sidebar-logo-subtitle">STATIONERY POS</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => (
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
