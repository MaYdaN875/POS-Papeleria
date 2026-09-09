import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  ShoppingCart,
  Package,
  Wallet,
  BarChart3,
  FileText,
  Users,
  Settings,
  Smartphone,
  Truck,
  LogOut,
  AlertTriangle,
  X
} from 'lucide-react';
import { authService, logout } from '../services/authService';
import '../styles/Sidebar.css';

const navItems = [
  { to: '/dashboard', icon: ShoppingCart, label: 'Ventas', adminOnly: false },
  { to: '/services', icon: Smartphone, label: 'Recargas', adminOnly: false },
  { to: '/inventory', icon: Package, label: 'Inventario', adminOnly: true },
  { to: '/purchases', icon: Truck, label: 'Compras', adminOnly: true },
  { to: '/cash', icon: Wallet, label: 'Caja', adminOnly: false },
  { to: '/reports', icon: BarChart3, label: 'Reportes', adminOnly: true },
  { to: '/billing', icon: FileText, label: 'Facturación', adminOnly: true },
  { to: '/users', icon: Users, label: 'Usuarios', adminOnly: true },
  { to: '/settings', icon: Settings, label: 'Ajustes', adminOnly: true },
];

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ isOpen = false, onClose }: SidebarProps) {
  const navigate = useNavigate();
  const isAdmin = authService.isAdmin();
  const userName = authService.getName();
  const userRole = authService.getRole() === 'admin' ? 'ADMINISTRADOR' : 'CAJERO';
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // Filtrar ítems: si es adminOnly y NO es admin, no se muestra
  const filteredItems = navItems.filter(item => !item.adminOnly || isAdmin);

  const confirmLogout = async () => {
    if (onClose) onClose();
    await logout();
    navigate('/');
  };

  return (
    <>
      {/* Backdrop overlay para móvil */}
      {isOpen && <div className="sidebar-backdrop" onClick={onClose} />}

      <aside className={`sidebar ${isOpen ? 'sidebar--open' : ''}`}>
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
              onClick={() => {
                if (onClose) onClose();
              }}
              className={({ isActive }) =>
                `sidebar-nav-item ${isActive ? 'sidebar-nav-item--active' : ''}`
              }
            >
              <item.icon size={20} strokeWidth={1.8} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Footer del Sidebar con Usuario y Salir */}
        <div className="sidebar-footer">
          <div className="sidebar-user-info">
            <div className="sidebar-user-avatar">
              {userName ? userName.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="sidebar-user-details">
              <span className="sidebar-user-name">{userName || 'Usuario'}</span>
              <span className="sidebar-user-role">{userRole}</span>
            </div>
          </div>
          <button 
            onClick={() => setShowLogoutModal(true)} 
            className="sidebar-logout-btn"
            title="Cerrar Sesión"
          >
            <LogOut size={18} />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <div className="logout-modal-overlay">
          <div className="logout-modal">
            <button 
              className="logout-modal-close" 
              onClick={() => setShowLogoutModal(false)}
              title="Cerrar"
            >
              <X size={20} />
            </button>
            
            <div className="logout-modal-icon">
              <AlertTriangle size={32} />
            </div>
            
            <h2 className="logout-modal-title">Cerrar Sesión</h2>
            <p className="logout-modal-text">
              ¿Estás seguro de que deseas salir del sistema? 
              Se cerrará tu turno actual y tendrás que ingresar tus credenciales nuevamente.
            </p>
            
            <div className="logout-modal-footer">
              <button 
                className="logout-modal-btn logout-modal-btn--cancel" 
                onClick={() => setShowLogoutModal(false)}
              >
                Cancelar
              </button>
              <button 
                className="logout-modal-btn logout-modal-btn--confirm" 
                onClick={confirmLogout}
              >
                Cerrar Sesión
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

