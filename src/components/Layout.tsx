import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import '../styles/Layout.css';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import { useBackHandler } from '../utils/backButtonManager';

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Cerrar sidebar en móviles al presionar botón atrás
  useBackHandler(sidebarOpen, () => setSidebarOpen(false));

  return (
    <div className="layout">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="layout-main">
        <TopBar onToggleSidebar={() => setSidebarOpen(prev => !prev)} />
        <main className="layout-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
