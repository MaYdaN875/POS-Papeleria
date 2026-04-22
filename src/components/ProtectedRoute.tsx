/**
 * Componente de ruta protegida.
 * Redirige al login si no hay sesión activa.
 */

import { Navigate, Outlet } from 'react-router-dom';
import { isAuthenticated } from '../services/authService';

export default function ProtectedRoute() {
  if (!isAuthenticated()) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}
