import { TaecelProduct, TaecelTransaction, TaecelBalance } from '../types/taecel';
import { ENDPOINTS } from '../config';
import { authFetch } from './authService';

const IS_MOCK_MODE = false;

/**
 * Llama al proxy seguro de Taecel en el servidor (pos_taecel.php).
 * Las llaves (KEY/NIP) viven en Hostinger, NO en la app.
 */
async function callTaecel(action: 'balance' | 'products' | 'transaction', params: Record<string, string> = {}): Promise<any> {
  const body = new URLSearchParams();
  body.append('action', action);
  for (const [k, v] of Object.entries(params)) {
    body.append(k, v);
  }

  const response = await authFetch(ENDPOINTS.POS_TAECEL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  let res: any;
  try {
    res = await response.json();
  } catch {
    throw new Error('Respuesta inválida del servidor de recargas');
  }

  return res;
}

/**
 * Consulta el saldo actual disponible
 */
export const getTaecelBalance = async (): Promise<TaecelBalance> => {
  if (IS_MOCK_MODE) {
    return { available: 1500.50, last_updated: new Date().toISOString() };
  }

  const res = await callTaecel('balance');
  if (!res.success) throw new Error(res.message || 'Error al obtener saldo');

  let total = 0;
  if (res.data && Array.isArray(res.data)) {
    for (const b of res.data) {
      total += parseFloat(String(b.Saldo).replace(/,/g, ''));
    }
  }
  return { available: total, last_updated: new Date().toISOString() };
};

/**
 * Ejecuta una recarga o pago de servicio.
 */
export const executeTransaction = async (
  productId: string,
  reference: string,
  amount: number
): Promise<TaecelTransaction> => {
  if (IS_MOCK_MODE) {
    return {
      id: `tx_${Math.random().toString(36).substr(2, 9)}`,
      date: new Date().toISOString(),
      product_id: productId,
      amount: amount,
      reference: reference,
      status: 'success',
      authorization_code: '123456'
    };
  }

  const params: Record<string, string> = {
    producto: productId,
    referencia: reference,
  };
  if (amount > 0) params.monto = amount.toString();

  const res = await callTaecel('transaction', params);
  if (!res.success) {
    throw new Error(`${res.message} (Código: ${res.error})`);
  }

  return {
    id: res.data?.TransID || res.data?.transID || '',
    date: res.data?.Fecha || res.data?.fecha || new Date().toISOString(),
    product_id: productId,
    amount: amount,
    reference: reference,
    status: res.data?.Status || 'En proceso',
    authorization_code: res.data?.Folio || ''
  };
};

/**
 * Obtiene la lista de productos de Taecel
 */
export const getProducts = async (): Promise<TaecelProduct[]> => {
  if (IS_MOCK_MODE) {
    return [
      { id: 'TEL010', name: 'Telcel $10', type: 'recarga', carrier: 'Telcel' }
    ];
  }

  const res = await callTaecel('products');
  if (!res.success) throw new Error(res.message || 'Error al obtener productos');

  // Taecel puede devolver los productos de distintas formas:
  //  - data: [{ productos: [...] }, ...]   (agrupados por categoría)
  //  - data: [ {producto}, {producto}, ... ] (lista plana)
  //  - data: { productos: [...] }
  let productosList: any[] = [];
  const data = res.data;
  if (Array.isArray(data)) {
    if (data.length > 0 && Array.isArray(data[0]?.productos)) {
      productosList = data.flatMap((cat: any) => cat.productos || []);
    } else {
      productosList = data;
    }
  } else if (data && Array.isArray(data.productos)) {
    productosList = data.productos;
  }

  // Mapear al modelo interno del POS (tolerante a distintos nombres de campo)
  return productosList.map((p: any) => {
    const categoria = String(p.Categoria ?? p.categoria ?? p.Bolsa ?? p.bolsa ?? '').toLowerCase();
    const esServicio = categoria.includes('servicio') || categoria.includes('pago');
    const monto = Number.parseFloat(String(p.Monto ?? p.monto ?? '0').replace(/,/g, ''));

    return {
      id: p.Codigo ?? p.codigo ?? p.producto ?? p.id ?? '',
      name: p.Descripcion ?? p.descripcion ?? p.Nombre ?? p.nombre ?? p.name ?? 'Producto',
      type: esServicio ? 'servicio' : 'recarga',
      carrier: p.Carrier ?? p.carrier ?? p.compania ?? '',
      amount: Number.isFinite(monto) && monto > 0 ? monto : undefined,
      logoUrl: p.logo ?? p.Logo ?? undefined,
      raw: p
    } as TaecelProduct;
  });
};
