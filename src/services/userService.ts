import { ENDPOINTS } from '../config';
import { authFetch } from './authService';

export interface AdminUser {
  id: number;
  name: string;
  identifier: string; // Email o Username
  role?: string;
}

export interface UserResponse {
  ok: boolean;
  message?: string;
  users?: AdminUser[];
}

/**
 * Obtiene la lista completa de usuarios administrativos.
 */
export async function getUsers(): Promise<UserResponse> {
  try {
    const res = await authFetch(ENDPOINTS.POS_USERS_MANAGER);
    return res.json();
  } catch (err) {
    console.error('Error fetching users:', err);
    return { ok: false, message: 'No se pudo cargar la lista de usuarios' };
  }
}

/**
 * Crea un nuevo usuario administrativo.
 */
export async function createUser(user: Omit<AdminUser, 'id'> & { password?: string }): Promise<UserResponse> {
  try {
    const res = await authFetch(ENDPOINTS.POS_USERS_MANAGER, {
      method: 'POST',
      body: JSON.stringify(user)
    });
    return res.json();
  } catch (err) {
    console.error('Error creating user:', err);
    return { ok: false, message: 'No se pudo crear el usuario' };
  }
}

/**
 * Actualiza los datos de un usuario existente.
 */
export async function updateUser(user: AdminUser & { password?: string }): Promise<UserResponse> {
  try {
    const res = await authFetch(ENDPOINTS.POS_USERS_MANAGER, {
      method: 'PUT',
      body: JSON.stringify(user)
    });
    return res.json();
  } catch (err) {
    console.error('Error updating user:', err);
    return { ok: false, message: 'No se pudo actualizar el usuario' };
  }
}

/**
 * Elimina un usuario administrativo por su ID.
 */
export async function deleteUser(id: number): Promise<UserResponse> {
  try {
    const res = await authFetch(`${ENDPOINTS.POS_USERS_MANAGER}?id=${id}`, {
      method: 'DELETE'
    });
    return res.json();
  } catch (err) {
    console.error('Error deleting user:', err);
    return { ok: false, message: 'No se pudo eliminar el usuario' };
  }
}
