import { ENDPOINTS } from '../../config';
import { authFetch } from '../authService';
import { Customer } from '../../types/invoicing';

/**
 * Retrieves the list of all frequent customers.
 */
export async function getAllCustomers(): Promise<Customer[]> {
  try {
    const res = await authFetch(ENDPOINTS.POS_CUSTOMERS, {
      method: 'GET'
    });

    const data = await res.json();
    if (data.ok && Array.isArray(data.customers)) {
      return data.customers;
    }
    return [];
  } catch (error) {
    console.error('Error fetching customers:', error);
    return [];
  }
}

/**
 * Searches for a customer profile by RFC.
 */
export async function getCustomerByRfc(rfc: string): Promise<Customer | null> {
  try {
    const url = `${ENDPOINTS.POS_CUSTOMERS}?rfc=${encodeURIComponent(rfc)}`;
    const res = await authFetch(url, {
      method: 'GET'
    });

    const data = await res.json();
    if (data.ok && data.customer) {
      return data.customer;
    }
    return null;
  } catch (error) {
    console.error(`Error fetching customer with RFC ${rfc}:`, error);
    return null;
  }
}

/**
 * Saves (creates or updates) a frequent customer profile.
 */
export async function saveCustomer(customer: Customer): Promise<{ ok: boolean; message?: string }> {
  try {
    const payload = {
      rfc: customer.rfc.trim().toUpperCase(),
      razon_social: customer.razonSocial.trim().toUpperCase(),
      regimen_fiscal: customer.regimenFiscal.trim(),
      codigo_postal: customer.codigoPostal.trim(),
      email: customer.email.trim()
    };

    const res = await authFetch(ENDPOINTS.POS_CUSTOMERS, {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    return {
      ok: data.ok,
      message: data.message || (data.ok ? 'Cliente guardado correctamente' : 'Error al guardar cliente')
    };
  } catch (error: any) {
    console.error('Error saving customer:', error);
    return {
      ok: false,
      message: error.message || 'Error de conexión'
    };
  }
}

/**
 * Deletes a frequent customer profile by RFC.
 */
export async function deleteCustomer(rfc: string): Promise<{ ok: boolean; message?: string }> {
  try {
    const url = `${ENDPOINTS.POS_CUSTOMERS}?rfc=${encodeURIComponent(rfc)}`;
    const res = await authFetch(url, {
      method: 'DELETE'
    });

    const data = await res.json();
    return {
      ok: data.ok,
      message: data.message || (data.ok ? 'Cliente eliminado correctamente' : 'Error al eliminar cliente')
    };
  } catch (error: any) {
    console.error('Error deleting customer:', error);
    return {
      ok: false,
      message: error.message || 'Error de conexión'
    };
  }
}
