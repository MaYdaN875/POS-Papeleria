import { ENDPOINTS } from '../../config';
import { authFetch } from '../authService';

export interface BackendInvoice {
  id: number;
  saleId: number;
  uuid: string;
  invoiceNumber: string;
  customerRfc: string;
  customerName: string;
  pdfUrl?: string;
  xmlUrl?: string;
  status: string;
  createdAt: string;
}

export interface SaveInvoicePayload {
  sale_id: number;
  uuid: string;
  invoice_number: string;
  customer_rfc: string;
  customer_name: string;
  pdf_url?: string;
  xml_url?: string;
}

/**
 * Saves a generated invoice's details to the backend database.
 */
export async function saveInvoiceToBackend(payload: SaveInvoicePayload): Promise<{ ok: boolean; message?: string }> {
  try {
    const res = await authFetch(ENDPOINTS.POS_INVOICES, {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (data.ok) {
      return { ok: true, message: data.message };
    }
    return { ok: false, message: data.message || 'Error al guardar la factura en el servidor' };
  } catch (error: any) {
    console.error('Error saving invoice to backend:', error);
    return { ok: false, message: error.message || 'Error de conexión' };
  }
}

/**
 * Retrieves the invoice associated with a specific POS sale ID.
 */
export async function getInvoiceBySaleId(saleId: number): Promise<{ ok: boolean; invoice?: BackendInvoice; message?: string }> {
  try {
    const url = `${ENDPOINTS.POS_INVOICES}?sale_id=${saleId}`;
    const res = await authFetch(url, {
      method: 'GET'
    });

    const data = await res.json();
    if (data.ok && data.invoice) {
      return { ok: true, invoice: data.invoice };
    }
    return { ok: false, message: data.message || 'No hay factura para esta venta' };
  } catch (error: any) {
    console.error('Error fetching invoice by sale ID:', error);
    return { ok: false, message: error.message || 'Error de conexión' };
  }
}
