/**
 * Servicio de ventas POS.
 * Registra ventas físicas y descuenta stock.
 */

import { ENDPOINTS } from '../config';
import { authFetch } from './authService';
import type { CartItem } from './productService';

export interface SaleResult {
  ok: boolean;
  message?: string;
  saleId?: number;
  total?: number;
  sessionExpired?: boolean;
}

export interface CreateSalePayload {
  items: {
    product_id: number;
    product_name: string;
    quantity: number;
    unit_price: number;
    presentation_id?: number;
    presentation_name?: string;
    units_per_sale?: number;
  }[];
  payment_method: 'cash' | 'card' | 'transfer';
  subtotal: number;
  total: number;
  cash_received?: number;
  change_amount?: number;
  access_token?: string;
}

/**
 * Envía una venta del POS a la API.
 */
export async function createSale(
  cart: CartItem[],
  paymentMethod: 'cash' | 'card' | 'transfer',
  cashReceived?: number,
  taxRate: number = 0
): Promise<SaleResult> {
  const subtotal = cart.reduce(
    (sum, item) => sum + item.presentation.salePrice * item.quantity,
    0
  );
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;

  const payload: CreateSalePayload = {
    items: cart.map((item) => ({
      product_id: item.product.id,
      product_name: `${item.product.name} - ${item.presentation.name}`,
      quantity: item.quantity,
      unit_price: item.presentation.salePrice,
      presentation_id: item.presentation.id,
      presentation_name: item.presentation.name,
      units_per_sale: item.presentation.unitsPerSale,
    })),
    payment_method: paymentMethod,
    subtotal,
    total,
  };

  if (paymentMethod === 'cash' && cashReceived !== undefined) {
    payload.cash_received = cashReceived;
    payload.change_amount = cashReceived - total;
  }

  // Token también en el cuerpo: Hostinger pierde el header Authorization
  const token = localStorage.getItem('pos_token');
  if (token) {
    payload.access_token = token;
  }

  try {
    const res = await authFetch(ENDPOINTS.POS_SALE_CREATE, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const text = await res.text();

    try {
      const data = JSON.parse(text);
      if (data.ok) {
        return {
          ok: true,
          saleId: data.sale_id,
          total: data.total,
        };
      }
      const msg = data.message || 'Error al registrar la venta';
      const sessionExpired =
        res.status === 401 ||
        msg.toLowerCase().includes('sesión') ||
        msg.toLowerCase().includes('sesion');
      return { ok: false, message: msg, sessionExpired };
    } catch {
      console.error('Server returned non-JSON response:', text);
      const cleanError = text.replace(/<[^>]*>?/gm, '').trim().substring(0, 150);
      return { ok: false, message: 'Error interno del servidor: ' + cleanError };
    }
  } catch (err: unknown) {
    console.error('Sale creation error:', err);
    const message = err instanceof Error ? err.message : 'Desconocido';
    return { ok: false, message: 'Error de red: ' + message };
  }
}
