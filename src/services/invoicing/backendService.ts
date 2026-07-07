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
  saleTotal?: number;
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

/**
 * Retrieves all invoices in the system.
 */
export async function getAllInvoices(): Promise<BackendInvoice[]> {
  try {
    const res = await authFetch(ENDPOINTS.POS_INVOICES, {
      method: 'GET'
    });

    const data = await res.json();
    if (data.ok && Array.isArray(data.invoices)) {
      return data.invoices;
    }
    return [];
  } catch (error) {
    console.error('Error fetching all invoices:', error);
    return [];
  }
}

/**
 * Updates an invoice status (e.g. cancelled) in the backend.
 */
export async function updateInvoiceStatus(saleId: number, status: string): Promise<{ ok: boolean; message?: string }> {
  try {
    const res = await authFetch(ENDPOINTS.POS_INVOICES, {
      method: 'POST',
      body: JSON.stringify({ sale_id: saleId, status })
    });

    const data = await res.json();
    return { ok: data.ok, message: data.message };
  } catch (error: any) {
    console.error('Error updating invoice status:', error);
    return { ok: false, message: error.message || 'Error de conexión' };
  }
}
