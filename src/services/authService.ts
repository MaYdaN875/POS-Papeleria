/**
 * Servicio de autenticación.
 * Usa el mismo endpoint de login admin que la tienda web.
 */

import { ENDPOINTS, API_BASE_URL } from '../config';

const TOKEN_KEY = 'pos_token';
const ADMIN_ID_KEY = 'pos_admin_id';
const EXPIRES_KEY = 'pos_expires_at';

export interface LoginResult {
  ok: boolean;
  message?: string;
  token?: string;
  adminId?: number;
}

/**
 * Intenta hacer login con email/usuario y contraseña.
 */
export async function login(identifier: string, password: string): Promise<LoginResult> {
  try {
    const res = await fetch(ENDPOINTS.LOGIN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: identifier, password }),
    });

    const data = await res.json();

    if (data.ok && data.token) {
      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(ADMIN_ID_KEY, String(data.adminId));
      localStorage.setItem(EXPIRES_KEY, data.expiresAt);
      return { ok: true, token: data.token, adminId: data.adminId };
    }

    return { ok: false, message: data.message || 'Credenciales incorrectas' };
  } catch (err) {
    console.error('Login error:', err);
    return { ok: false, message: 'No se pudo conectar con el servidor' };
  }
}

/**
 * Cierra sesión y limpia tokens.
 */
export async function logout(): Promise<void> {
  const token = getToken();
  if (token) {
    try {
      await fetch(ENDPOINTS.LOGOUT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
    } catch {
      // Ignorar error de red al hacer logout
    }
  }
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ADMIN_ID_KEY);
  localStorage.removeItem(EXPIRES_KEY);
}

/**
 * Devuelve el token guardado o null.
 */
export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

/**
 * Verifica si hay una sesión activa (token no expirado).
 */
export function isAuthenticated(): boolean {
  const token = getToken();
  const expires = localStorage.getItem(EXPIRES_KEY);
  if (!token || !expires) return false;

  return new Date(expires) > new Date();
}

/**
 * Devuelve el ID del admin logueado.
 */
export function getAdminId(): number | null {
  const id = localStorage.getItem(ADMIN_ID_KEY);
  return id ? parseInt(id, 10) : null;
}

/**
 * Helper para hacer fetch autenticado (con Bearer token).
 */
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return fetch(url, { ...options, headers });
}

/**
 * Verifica si el servidor está disponible.
 */
export async function checkServerStatus(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/public/products.php`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
