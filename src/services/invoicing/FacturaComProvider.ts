import {
  InvoiceProvider,
  InvoiceRequest,
  InvoiceResponse,
  FORMA_PAGO_MAP,
  InvoiceCustomer
} from '../../types/invoicing';
import { ENDPOINTS } from '../../config';
import { authFetch } from '../authService';

export class FacturaComProvider implements InvoiceProvider {
  private apiKey: string;
  private secretKey: string;
  private sandbox: boolean;
  private pluginId: string = '9d4095c8f7ed5785cb14c0e3b033eeb8252416ed';

  constructor(apiKey: string, secretKey: string, sandbox: boolean = true) {
    this.apiKey = apiKey;
    this.secretKey = secretKey;
    this.sandbox = sandbox;
  }

  getName(): string {
    return 'Factura.com API Provider';
  }

  private getBaseUrl(): string {
    return this.sandbox
      ? 'https://sandbox.factura.com/api'
      : 'https://api.factura.com';
  }

  private getHeaders(): HeadersInit {
    return {
      'Content-Type': 'application/json',
      'F-Api-Key': this.apiKey,
      'F-Secret-Key': this.secretKey,
      'F-PLUGIN': this.pluginId
    };
  }

  private async fetchProxy(url: string, options: RequestInit = {}): Promise<Response> {
    const proxyUrl = ENDPOINTS.POS_INVOICES_PROXY;
    const bodyStr = options.body ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body)) : undefined;

    const rawHeaders: Record<string, string> = {};
    if (options.headers) {
      const headersObj = options.headers as Record<string, string>;
      for (const key in headersObj) {
        rawHeaders[key] = headersObj[key];
      }
    }

    const payload = {
      url,
      method: options.method || 'GET',
      headers: rawHeaders,
      body: bodyStr
    };

    const response = await authFetch(proxyUrl, {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    return response;
  }

  /**
   * Searches for a client by RFC. Returns client UID if found, null otherwise.
   */
  private async checkClientExists(rfc: string): Promise<string | null> {
    try {
      const url = `${this.getBaseUrl()}/v1/clients/rfc/${rfc}`;
      const response = await this.fetchProxy(url, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        return null;
      }

      const res = await response.json();
      // Factura.com returns client info in 'data' field, which could be an array or object
      const isSuccess = res.status === 'success' || res.response === 'success';
      const dataPayload = res.Data || res.data;
      if (isSuccess && dataPayload) {
        if (Array.isArray(dataPayload) && dataPayload.length > 0) {
          return dataPayload[0].UID || dataPayload[0].uid || null;
        } else if (typeof dataPayload === 'object' && !Array.isArray(dataPayload)) {
          return dataPayload.UID || dataPayload.uid || null;
        }
      }
      return null;
    } catch (error) {
      console.error('Error checking client in Factura.com:', error);
      return null;
    }
  }

  /**
   * Registers a client in Factura.com catalog and returns their UID.
   */
  private async createClient(customer: InvoiceCustomer): Promise<string> {
    const url = `${this.getBaseUrl()}/v1/clients/create`;
    const payload = {
      rfc: customer.rfc.trim().toUpperCase(),
      razons: customer.razonSocial.trim().toUpperCase(),
      email: customer.email.trim(),
      codpos: customer.codigoPostal.trim(),
      regimen: customer.regimenFiscal
    };

    const response = await this.fetchProxy(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload)
    });

    const res = await response.json();
    const isSuccess = res.status === 'success' || res.response === 'success';
    const dataPayload = res.Data || res.data;
    if (!isSuccess || !dataPayload) {
      console.error('[FacturaComProvider] Error registering client:', res);
      const apiMessage = res.message || (typeof res.response === 'string' ? res.response : '') || (res.errors ? JSON.stringify(res.errors) : '');
      throw new Error(apiMessage || 'Error al registrar el cliente en Factura.com');
    }

    const uid = dataPayload.UID || dataPayload.uid;
    if (!uid) {
      throw new Error('No se recibió el UID del cliente registrado');
    }

    return uid;
  }

  async createInvoice(request: InvoiceRequest): Promise<InvoiceResponse> {
    try {
      // 1. Check if client exists, otherwise create them
      let receptorUid = await this.checkClientExists(request.customer.rfc);
      
      if (!receptorUid) {
        receptorUid = await this.createClient(request.customer);
      }

      // 2. Prepare payload for CFDI 4.0
      const concepts = request.items.map((item) => {
        const priceNum = Number(item.price);
        const hasTaxes = item.taxRate > 0;
        const objetoImp = hasTaxes ? '02' : '01';

        const conceptPayload: any = {
          ClaveProdServ: item.claveProdServ || '01010101', // Genérico por defecto
          Cantidad: item.quantity.toString(),
          ClaveUnidad: item.claveUnidad || 'H87', // Pieza por defecto
          Descripcion: item.name,
          ValorUnitario: priceNum.toFixed(6),
          Importe: (priceNum * item.quantity).toFixed(6),
          ObjetoImp: objetoImp
        };

        if (hasTaxes) {
          const base = priceNum * item.quantity;
          const rate = item.taxRate / 100;
          const taxAmount = base * rate;
          
          conceptPayload.Impuestos = {
            Traslados: [
              {
                Base: base.toFixed(6),
                Impuesto: '002', // IVA
                TipoFactor: 'Tasa',
                TasaOCuota: rate.toFixed(6),
                Importe: taxAmount.toFixed(6)
              }
            ]
          };
        }

        return conceptPayload;
      });

      // We obtain form of payment from map
      const formaPago = FORMA_PAGO_MAP[request.paymentMethod] || '01';

      const invoicePayload = {
        Receptor: {
          UID: receptorUid,
          RegimenFiscalR: request.customer.regimenFiscal
        },
        TipoDocumento: 'factura',
        RegimenFiscal: '601', // Régimen General de Ley Personas Morales para el emisor
        Conceptos: concepts,
        Moneda: 'MXN',
        FormaPago: formaPago,
        MetodoPago: 'PUE', // Pago en una sola exhibición por defecto
        UsoCFDI: request.usoCFDI,
        LugarExpedicion: request.customer.codigoPostal || '44650', // CP emisor/receptor
        EnviarCorreo: true
      };

      const url = `${this.getBaseUrl()}/v4/cfdi40/create`;
      const response = await this.fetchProxy(url, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(invoicePayload)
      });

      const res = await response.json();
      const isSuccess = res.status === 'success' || res.response === 'success';
      const dataPayload = res.Data || res.data;

      if (isSuccess && dataPayload) {
        return {
          success: true,
          uuid: dataPayload.uuid || dataPayload.UUID,
          invoiceNumber: `${dataPayload.serie || ''}${dataPayload.folio || ''}` || 'SAT-CFDI',
          pdfUrl: dataPayload.pdf || dataPayload.pdf_url,
          xmlUrl: dataPayload.xml || dataPayload.xml_url,
          message: res.message || 'Factura timbrada exitosamente.'
        };
      }

      // Handle specific/structured error responses from Factura.com
      const errorMsg = res.message || (res.errors ? JSON.stringify(res.errors) : 'Error en timbrado');
      return {
        success: false,
        message: `Factura.com: ${errorMsg}`
      };

    } catch (error: any) {
      console.error('Error during CFDI creation:', error);
      return {
        success: false,
        message: `Error de integración: ${error.message || 'Desconocido'}`
      };
    }
  }

  async cancelInvoice(uuid: string, reason: string, substituteUuid?: string): Promise<{ success: boolean; message?: string }> {
    try {
      const url = `${this.getBaseUrl()}/v4/cfdi40/${uuid}/cancel`;
      const payload: any = {
        motivo: reason // SAT cancelation code (e.g. '01', '02')
      };
      if (substituteUuid) {
        payload.folioSustituto = substituteUuid;
      }

      const response = await this.fetchProxy(url, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload)
      });

      const res = await response.json();
      const isSuccess = res.status === 'success' || res.response === 'success';
      if (isSuccess) {
        return {
          success: true,
          message: res.message || 'Factura cancelada exitosamente ante el SAT.'
        };
      }

      return {
        success: false,
        message: res.message || 'Error al cancelar la factura.'
      };
    } catch (error: any) {
      console.error('Error during CFDI cancelation:', error);
      return {
        success: false,
        message: `Error de cancelación: ${error.message || 'Desconocido'}`
      };
    }
  }

  async checkInvoiceStatus(uuid: string): Promise<{ success: boolean; status?: string; message?: string }> {
    try {
      const url = `${this.getBaseUrl()}/v4/cfdi40/${uuid}/cancel_status`;
      const response = await this.fetchProxy(url, {
        method: 'GET',
        headers: this.getHeaders()
      });

      const res = await response.json();
      const isSuccess = res.status === 'success' || res.response === 'success';
      const dataPayload = res.Data || res.data;
      if (isSuccess && dataPayload) {
        const satStatus = dataPayload.status || dataPayload.statusSat || dataPayload.estado || 'Desconocido';
        const satMessage = res.message || `Estado SAT: ${satStatus}`;
        return {
          success: true,
          status: satStatus,
          message: satMessage
        };
      }

      return {
        success: false,
        message: res.message || 'Error al obtener el estado de la factura.'
      };
    } catch (error: any) {
      console.error('Error checking CFDI status:', error);
      return {
        success: false,
        message: `Error de consulta: ${error.message || 'Desconocido'}`
      };
    }
  }
}
