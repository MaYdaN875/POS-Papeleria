import { TaecelProduct, TaecelTransaction, TaecelBalance } from '../types/taecel';

// MODO SIMULADO: Pon esto en "false" cuando tengas tus llaves reales de Taecel.
const IS_MOCK_MODE = true; 

// TODO: Reemplazar con tus credenciales reales cuando Taecel te las envíe.
const TAECEL_API_KEY = 'TU_API_KEY_AQUI'; 
const TAECEL_API_URL = 'https://taecel.com/api/v2';

/**
 * Consulta el saldo actual disponible para hacer recargas.
 */
export const getTaecelBalance = async (): Promise<TaecelBalance> => {
  if (IS_MOCK_MODE) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          available: 1500.50, // Saldo simulado
          last_updated: new Date().toISOString()
        });
      }, 500);
    });
  }

  // Código real de producción
  const response = await fetch(`${TAECEL_API_URL}/balance`, {
    headers: { 'Authorization': `Bearer ${TAECEL_API_KEY}` }
  });
  return response.json();
};

/**
 * Ejecuta una recarga o pago de servicio.
 */
export const executeTransaction = async (
  productId: string,
  reference: string, // Teléfono o número de servicio
  amount: number
): Promise<TaecelTransaction> => {
  
  if (IS_MOCK_MODE) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        // Simulamos un error si el teléfono empieza con 0000
        if (reference.startsWith('0000')) {
          reject(new Error('Número inválido o saldo insuficiente en Taecel.'));
          return;
        }

        resolve({
          id: `tx_${Math.random().toString(36).substr(2, 9)}`,
          date: new Date().toISOString(),
          product_id: productId,
          amount: amount,
          reference: reference,
          status: 'success',
          authorization_code: Math.floor(100000 + Math.random() * 900000).toString()
        });
      }, 1500); // Simulamos 1.5 segundos de procesamiento
    });
  }

  // Código real de producción
  const response = await fetch(`${TAECEL_API_URL}/transaction`, {
    method: 'POST',
    headers: { 
      'Authorization': `Bearer ${TAECEL_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ product_id: productId, reference, amount })
  });
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || 'Error en la transacción con Taecel');
  }
  
  return response.json();
};

/**
 * Obtiene la lista de compañías (Telcel, Movistar, CFE, etc.)
 * En un escenario real, esto se consulta a la API. Aquí ponemos los principales.
 */
export const getProducts = async (): Promise<TaecelProduct[]> => {
  return [
    { id: 'telcel', name: 'Telcel', type: 'recarga', carrier: 'Telcel', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/e/e0/Telcel_logo.png' },
    { id: 'movistar', name: 'Movistar', type: 'recarga', carrier: 'Movistar' },
    { id: 'atnt', name: 'AT&T', type: 'recarga', carrier: 'AT&T' },
    { id: 'cfe', name: 'CFE', type: 'servicio', carrier: 'CFE' },
    { id: 'megacable', name: 'Megacable', type: 'servicio', carrier: 'Megacable' },
  ];
};
