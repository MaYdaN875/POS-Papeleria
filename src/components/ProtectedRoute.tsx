/**
 * Componente de ruta protegida.
 * Redirige al login si no hay sesión activa.
 */

import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { isAuthenticated, authService } from '../services/authService';

interface Props {
  requireAdmin?: boolean;
}

export default function ProtectedRoute({ requireAdmin = false }: Props) {
  const location = useLocation();

  if (!isAuthenticated()) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  if (requireAdmin && !authService.isAdmin()) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
