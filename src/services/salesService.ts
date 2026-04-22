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
}

export interface CreateSalePayload {
  items: {
    product_id: number;
    product_name: string;
    quantity: number;
    unit_price: number;
  }[];
  payment_method: 'cash' | 'card' | 'transfer';
  subtotal: number;
  total: number;
  cash_received?: number;
  change_amount?: number;
}

/**
 * Envía una venta del POS a la API.
 */
export async function createSale(
  cart: CartItem[],
  paymentMethod: 'cash' | 'card' | 'transfer',
  cashReceived?: number
): Promise<SaleResult> {
  const subtotal = cart.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  );
  const total = subtotal; // Sin IVA, lo manejan los jefes

  const payload: CreateSalePayload = {
    items: cart.map((item) => ({
      product_id: item.product.id,
      product_name: item.product.name,
      quantity: item.quantity,
      unit_price: item.product.price,
    })),
    payment_method: paymentMethod,
    subtotal,
    total,
  };

  if (paymentMethod === 'cash' && cashReceived !== undefined) {
    payload.cash_received = cashReceived;
    payload.change_amount = cashReceived - total;
  }

  try {
    const res = await authFetch(ENDPOINTS.POS_SALE_CREATE, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (data.ok) {
      return {
        ok: true,
        saleId: data.sale_id,
        total: data.total,
      };
    }

    return { ok: false, message: data.message || 'Error al registrar la venta' };
  } catch (err) {
    console.error('Sale creation error:', err);
    return { ok: false, message: 'No se pudo conectar con el servidor' };
  }
}
