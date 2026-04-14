import { Search, Bell, Wifi, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cashierInfo } from '../data/mockData';
import '../styles/TopBar.css';

export default function TopBar() {
  const navigate = useNavigate();

  return (
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
        <button className="topbar-icon-btn topbar-icon-btn--online" title="Conectado">
          <Wifi size={20} />
        </button>
        <button className="topbar-icon-btn" title="Sincronizar">
          <RefreshCw size={20} />
        </button>

        <button
          className="topbar-new-sale-btn"
          onClick={() => navigate('/sales')}
        >
          Nueva Venta
        </button>

        <div className="topbar-profile">
          <div className="topbar-profile-info">
            <span className="topbar-profile-name">{cashierInfo.store}</span>
            <span className="topbar-profile-role">{cashierInfo.role}</span>
          </div>
          <div className="topbar-profile-avatar">
            <span>👤</span>
          </div>
        </div>
      </div>
    </header>
  );
}
