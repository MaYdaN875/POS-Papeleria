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

  // Recarga: el servidor puede tardar hasta ~60 s (RequestTXN + ciclo StatusTXN).
  const response = await authFetch(ENDPOINTS.POS_TAECEL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
    signal: action === 'transaction' ? AbortSignal.timeout(90000) : undefined,
  });

  let res: any;
  try {
    res = await response.json();
  } catch {
    throw new Error('Respuesta inválida del servidor de recargas');
  }

  return res;
}

/** Taecel puede devolver la transacción en distintas formas según producto/estado. */
function extractTaecelPayload(res: any): Record<string, any> {
  let data = res?.data;

  if (Array.isArray(data) && data.length > 0) {
    data = data[0];
  }

  if (typeof data === 'string' && data.trim()) {
    return { Folio: data.trim() };
  }

  if (data && typeof data === 'object') {
    const nested = (data as Record<string, any>).transaccion
      ?? (data as Record<string, any>).Transaccion
      ?? (data as Record<string, any>).txn
      ?? (data as Record<string, any>).result;

    if (nested && typeof nested === 'object') {
      return { ...(data as Record<string, any>), ...(nested as Record<string, any>) };
    }

    return data as Record<string, any>;
  }

  if (res?.TransID || res?.Folio || res?.transID || res?.folio) {
    return res as Record<string, any>;
  }

  return {};
}

function pickTaecelField(payload: Record<string, any>, keys: string[]): string {
  for (const key of keys) {
    const value = payload[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value).trim();
    }
  }
  return '';
}

function normalizeTaecelText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** Solo "Exitosa" cuenta como cobro real; "No Procesada" y "Fracasada" no. */
function resolveTaecelTransactionStatus(statusRaw: string, resMessage: string): 'success' | 'pending' | 'failed' {
  const text = normalizeTaecelText(`${statusRaw} ${resMessage}`);

  if (
    text.includes('fracas')
    || text.includes('fallid')
    || text.includes('rechaz')
    || text.includes('cancel')
    || text.includes('no proces')
    || text.includes('sin proces')
    || text.includes('invalid')
    || (text.includes('error') && !text.includes('sin error'))
  ) {
    return 'failed';
  }

  if (text.includes('exitos') || text.includes('aprobada') || text.includes('aprobado')) {
    return 'success';
  }

  if (text.includes('proceso') || text.includes('pend') || text.includes('espera')) {
    return 'pending';
  }

  return 'pending';
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
  // Igual que la integración original: siempre enviar monto cuando aplique.
  if (amount > 0) {
    params.monto = Number.isInteger(amount) ? amount.toFixed(2) : amount.toFixed(2);
  }

  const res = await callTaecel('transaction', params);
  const ok = res.success === true || res.success === 1 || res.success === '1';
  if (!ok) {
    const detail = pickTaecelField(extractTaecelPayload(res), ['Mensaje', 'mensaje', 'Message', 'message']);
    throw new Error(
      detail
        || res.message
        || `Recarga rechazada (Código: ${res.error ?? '?'})`
    );
  }

  const payload = extractTaecelPayload(res);
  const id = pickTaecelField(payload, ['TransID', 'transID', 'transId', 'ID', 'id', 'TransaccionID']);
  const folio = pickTaecelField(payload, [
    'Folio',
    'folio',
    'Autorizacion',
    'autorizacion',
    'Authorization',
    'authorization',
    'NumAutorizacion',
  ]);
  const statusRaw = pickTaecelField(payload, ['Status', 'status', 'Estatus', 'estatus', 'Estado', 'estado'])
    || String(res.message || '');
  const detailMessage = pickTaecelField(payload, ['Mensaje', 'mensaje', 'Message', 'message', 'Descripcion', 'descripcion']);
  const txStatus = resolveTaecelTransactionStatus(statusRaw, `${res.message || ''} ${detailMessage}`);

  // Folio corto de autorización = recarga real. TransID largo sin folio NO es éxito.
  const hasAuthFolio = !!folio;
  const debugInfo = [
    statusRaw && `Estado: ${statusRaw}`,
    folio && `Folio: ${folio}`,
    id && `TransID: ${id}`,
    detailMessage && `Detalle: ${detailMessage}`,
  ].filter(Boolean).join(' · ');

  if (txStatus === 'failed' || (!hasAuthFolio && txStatus !== 'success')) {
    throw new Error(
      debugInfo
        || res.message
        || 'Taecel registró la petición pero no autorizó la recarga (No Procesada / Fracasada).'
    );
  }

  if (!hasAuthFolio && txStatus !== 'success') {
    throw new Error(
      debugInfo
        || 'Taecel devolvió ID de solicitud pero sin folio de autorización. La recarga no se completó.'
    );
  }

  return {
    id: id || folio,
    date: pickTaecelField(payload, ['Fecha', 'fecha', 'Date', 'date']) || new Date().toISOString(),
    product_id: productId,
    amount: amount,
    reference: reference,
    status: 'success',
    authorization_code: folio || id,
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
    const bolsaId = String(p.BolsaID ?? p.bolsaID ?? p.BolsaId ?? '');
    const esServicio =
      bolsaId === '2'
      || bolsaId === '99'
      || categoria.includes('servicio')
      || categoria.includes('pago');
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
