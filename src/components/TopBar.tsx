import { Wifi, RefreshCw, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { logout } from '../services/authService';
import '../styles/TopBar.css';

export default function TopBar() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    if (window.confirm('¿Estás seguro de que deseas cerrar sesión?')) {
      await logout();
      navigate('/');
    }
  };

  return (
    <header className="topbar" style={{ justifyContent: 'flex-end' }}>
      <div className="topbar-actions">
        <button className="topbar-icon-btn topbar-icon-btn--online" title="Servidor Conectado">
          <Wifi size={20} />
        </button>
        <button className="topbar-icon-btn" title="Recargar y Sincronizar" onClick={() => window.location.reload()}>
          <RefreshCw size={20} />
        </button>

        <div style={{ width: '1px', height: '24px', background: 'var(--color-border)', margin: '0 8px' }}></div>

        <div className="topbar-profile" style={{ display: 'flex', alignItems: 'center', gap: '16px', marginLeft: '8px' }}>
          <div className="topbar-profile-info" style={{ textAlign: 'right' }}>
            <span className="topbar-profile-name">Caja 01</span>
            <span className="topbar-profile-role" style={{ fontSize: '10px', letterSpacing: '1px' }}>ADMINISTRADOR</span>
          </div>
          <button 
            onClick={handleLogout} 
            title="Cerrar Sesión"
            style={{ 
              background: 'transparent', 
              color: 'var(--color-danger)', 
              border: '1px solid rgba(220, 38, 38, 0.3)', 
              borderRadius: '8px', 
              padding: '8px 12px',
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '14px',
              transition: 'all 0.2s ease'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = 'var(--color-danger-bg)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            Salir <LogOut size={16} />
          </button>
        </div>
      </div>
    </header>
  );
}
