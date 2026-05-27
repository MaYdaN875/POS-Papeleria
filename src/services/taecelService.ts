import { TaecelProduct, TaecelTransaction, TaecelBalance } from '../types/taecel';

const IS_MOCK_MODE = false; 

// Llaves de Prueba (Cámbialas cuando Taecel te dé las de Producción)
const TAECEL_API_KEY = 'I4NBwuJlqvigHszC5X8gdiDsTa9360415998355b94a36dd5a256ee069X8GIIEqNs2jWLEngXDYpdAvaJLo2pQ'; 
const TAECEL_API_NIP = '07328698c645cd0860372b8efa18be9aVmYC5HgwuJ';
const TAECEL_API_URL = 'https://app.taecel.com/api';

/**
 * Consulta el saldo actual disponible
 */
export const getTaecelBalance = async (): Promise<TaecelBalance> => {
  if (IS_MOCK_MODE) {
    return { available: 1500.50, last_updated: new Date().toISOString() };
  }

  const body = new URLSearchParams();
  body.append('key', TAECEL_API_KEY);
  body.append('nip', TAECEL_API_NIP);

  const response = await fetch(`${TAECEL_API_URL}/getBalance`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  });
  
  const res = await response.json();
  if (!res.success) throw new Error(res.message || 'Error al obtener saldo');
  
  let total = 0;
  if (res.data && Array.isArray(res.data)) {
    for (const b of res.data) {
      total += parseFloat(b.Saldo.replace(/,/g, ''));
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

  const body = new URLSearchParams();
  body.append('key', TAECEL_API_KEY);
  body.append('nip', TAECEL_API_NIP);
  body.append('producto', productId);
  body.append('referencia', reference);
  if (amount > 0) body.append('monto', amount.toString());

  const response = await fetch(`${TAECEL_API_URL}/requestTXN`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  });
  
  const res = await response.json();
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

  const body = new URLSearchParams();
  body.append('key', TAECEL_API_KEY);
  body.append('nip', TAECEL_API_NIP);

  const response = await fetch(`${TAECEL_API_URL}/getProducts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  });
  
  const res = await response.json();
  if (!res.success) throw new Error(res.message || 'Error al obtener productos');

  const productosList = res.data[0]?.productos || [];
  
  // Mapear al modelo interno del POS
  return productosList.map((p: any) => ({
    id: p.codigo,
    name: p.descripcion,
    type: p.bolsa === 1 ? 'recarga' : 'servicio',
    carrier: p.carrier,
    logoUrl: p.logo
  }));
};
