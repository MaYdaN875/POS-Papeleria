import {
  InvoiceProvider,
  InvoiceRequest,
  InvoiceResponse,
  FORMA_PAGO_MAP,
  InvoiceCustomer
} from '../../types/invoicing';

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

  /**
   * Searches for a client by RFC. Returns client UID if found, null otherwise.
   */
  private async checkClientExists(rfc: string): Promise<string | null> {
    try {
      const url = `${this.getBaseUrl()}/v1/clients/rfc/${rfc}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        return null;
      }

      const res = await response.json();
      // Factura.com returns client info in 'data' field, which could be an array or object
      if (res.status === 'success' && res.data) {
        if (Array.isArray(res.data) && res.data.length > 0) {
          return res.data[0].UID || res.data[0].uid || null;
        } else if (typeof res.data === 'object' && !Array.isArray(res.data)) {
          return res.data.UID || res.data.uid || null;
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
      razon_social: customer.razonSocial.trim().toUpperCase(),
      email: customer.email.trim(),
      codigo_postal: customer.codigoPostal.trim(),
      regimen_fiscal: customer.regimenFiscal
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload)
    });

    const res = await response.json();
    if (res.status !== 'success' || !res.data) {
      throw new Error(res.message || 'Error al registrar el cliente en Factura.com');
    }

    const uid = res.data.UID || res.data.uid;
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
        // En CFDI 4.0, ObjetoImp:
        // '01' = No objeto de impuesto
        // '02' = Sí objeto de impuesto (si tiene IVA > 0)
        const hasTaxes = item.taxRate > 0;
        const objetoImp = hasTaxes ? '02' : '01';

        const conceptPayload: any = {
          ClaveProdServ: item.claveProdServ || '01010101', // Genérico por defecto
          Cantidad: item.quantity.toString(),
          ClaveUnidad: item.claveUnidad || 'H87', // Pieza por defecto
          Descripcion: item.name,
          ValorUnitario: item.price.toFixed(6),
          Importe: (item.price * item.quantity).toFixed(6),
          ObjetoImp: objetoImp
        };

        if (hasTaxes) {
          const base = item.price * item.quantity;
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
      const response = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(invoicePayload)
      });

      const res = await response.json();

      if (res.status === 'success' && res.data) {
        return {
          success: true,
          uuid: res.data.uuid,
          invoiceNumber: `${res.data.serie || ''}${res.data.folio || ''}` || 'SAT-CFDI',
          pdfUrl: res.data.pdf || res.data.pdf_url,
          xmlUrl: res.data.xml || res.data.xml_url,
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

  async cancelInvoice(uuid: string, reason: string): Promise<{ success: boolean; message?: string }> {
    try {
      const url = `${this.getBaseUrl()}/v4/cfdi40/${uuid}/cancel`;
      const payload = {
        motivo: reason // SAT cancelation code (e.g. '01', '02')
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload)
      });

      const res = await response.json();
      if (res.status === 'success') {
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
}
