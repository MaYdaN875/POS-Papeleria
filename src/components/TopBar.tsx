import { Search, Menu } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import '../styles/TopBar.css';

interface TopBarProps {
  onToggleSidebar?: () => void;
}

export default function TopBar({ onToggleSidebar }: TopBarProps) {
  const navigate = useNavigate();
  const { clearCart } = useCart();

  return (
    <header className="topbar">
      <div className="topbar-left">
        {onToggleSidebar && (
          <button 
            className="topbar-menu-btn" 
            onClick={onToggleSidebar}
            title="Abrir Menú"
            aria-label="Abrir Menú"
          >
            <Menu size={24} />
          </button>
        )}

        <span className="topbar-mobile-brand">Papelería Godart</span>

        <div className="topbar-search">
          <Search size={18} className="topbar-search-icon" />
          <input
            type="text"
            placeholder="Buscar productos, órdenes..."
            className="topbar-search-input"
          />
        </div>
      </div>

      <div className="topbar-actions">
        <button
          className="topbar-new-sale-btn"
          onClick={() => {
            clearCart();
            navigate('/sales');
          }}
        >
          + Nueva Venta
        </button>
      </div>
    </header>
  );
}
