import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import '../styles/Layout.css';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
