import { Search, Bell, Wifi, RefreshCw, LogOut, AlertTriangle, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { logout } from '../services/authService';
import { useState } from 'react';
import '../styles/TopBar.css';

export default function TopBar() {
  const navigate = useNavigate();
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const confirmLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <>
      <header className="topbar">
        <div className="topbar-search">
          <Search size={18} className="topbar-search-icon" />
          <input
            type="text"
            placeholder="Buscar productos, órdenes..."
            className="topbar-search-input"
          />
        </div>

        <div className="topbar-actions">
          <button className="topbar-icon-btn" title="Notificaciones">
            <Bell size={20} />
          </button>
          <button className="topbar-icon-btn topbar-icon-btn--online" title="Servidor Conectado">
            <Wifi size={20} />
          </button>
          <button className="topbar-icon-btn" title="Recargar y Sincronizar" onClick={() => window.location.reload()}>
            <RefreshCw size={20} />
          </button>

          <button
            className="topbar-new-sale-btn"
            onClick={() => navigate('/sales')}
          >
            Nueva Venta
          </button>

          <div className="topbar-divider"></div>

          <div className="topbar-profile">
            <div className="topbar-profile-info">
              <span className="topbar-profile-name">Caja 01</span>
              <span className="topbar-profile-role">ADMINISTRADOR</span>
            </div>
            <button 
              onClick={() => setShowLogoutModal(true)} 
              className="topbar-logout-btn"
              title="Cerrar Sesión"
            >
              Salir <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <div className="logout-modal-overlay">
          <div className="logout-modal">
            <button className="logout-modal-close" onClick={() => setShowLogoutModal(false)}>
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
