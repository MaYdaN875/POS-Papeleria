import { ENDPOINTS } from '../config';

export interface GlobalSettings {
  storeName: string;
  storeAddress: string;
  storeCity: string;
  storePhone: string;
  storeWebsite: string;
  storeWebsiteUrl: string;
  ticketThanksMessage: string;
  autoPrintTicket: boolean;
  lowStockThreshold: number;
  theme: 'light' | 'dark';
  enableSounds: boolean;
  printerSize: '80mm' | '58mm';
  taxRate: number;
}

export interface SettingsResponse {
  ok: boolean;
  message?: string;
  settings?: GlobalSettings;
}

const DEFAULT_SETTINGS: GlobalSettings = {
  storeName: 'Papelería Godart',
  storeAddress: '3909 Av Presa de Osorio',
  storeCity: 'Guadalajara, Jalisco',
  storePhone: '33 1112 4070',
  storeWebsite: 'godart-papelería.com',
  storeWebsiteUrl: 'https://www.godart-papelería.com',
  ticketThanksMessage: '¡Gracias por su compra!',
  autoPrintTicket: true,
  lowStockThreshold: 5,
  theme: 'light',
  enableSounds: true,
  printerSize: '80mm',
  taxRate: 0,
};

function getAuthToken(): string {
  return localStorage.getItem('pos_token') || '';
}

/**
 * Obtiene las configuraciones globales desde el servidor.
 * Si falla, retorna las configuraciones por defecto.
 */
export async function getGlobalSettings(): Promise<SettingsResponse> {
  try {
    const token = getAuthToken();
    const res = await fetch(ENDPOINTS.POS_SETTINGS, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!res.ok) {
      throw new Error(`HTTP Error: ${res.status}`);
    }

    const data = await res.json();
    if (data.ok && data.settings) {
      return { ok: true, settings: data.settings };
    }
    
    return { ok: false, message: data.message || 'Error al obtener ajustes' };
  } catch (error: any) {
    console.warn('Falló la carga de ajustes globales, usando por defecto.', error);
    return { ok: true, settings: DEFAULT_SETTINGS };
  }
}

/**
 * Guarda las configuraciones globales en el servidor.
 */
export async function saveGlobalSettings(settings: GlobalSettings): Promise<SettingsResponse> {
  try {
    const token = getAuthToken();
    if (!token) {
      return { ok: false, message: 'No hay sesión activa' };
    }

    const res = await fetch(ENDPOINTS.POS_SETTINGS, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ settings })
    });

    const data = await res.json();
    return data;
  } catch (error: any) {
    console.error('Error al guardar ajustes:', error);
    return { ok: false, message: error.message || 'Error de conexión' };
  }
}
