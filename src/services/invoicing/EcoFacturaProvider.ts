import { InvoiceProvider, InvoiceRequest, InvoiceResponse } from '../../types/invoicing';

export class EcoFacturaProvider implements InvoiceProvider {
  getName(): string {
    return 'EcoFactura';
  }

  async createInvoice(request: InvoiceRequest): Promise<InvoiceResponse> {
    // Para EcoFactura, al ser un flujo manual redirigido, devolvemos una respuesta simulada exitosa.
    // Esto guardará la referencia de la factura en el backend para indicar que se gestionó bajo este esquema.
    const invoiceNumber = `FAC-MANUAL-${request.saleId}`;
    
    return {
      success: true,
      uuid: 'MANUAL-ECOFACTURA',
      invoiceNumber,
      pdfUrl: '',
      xmlUrl: '',
      message: 'Venta marcada para facturación manual en EcoFactura'
    };
  }

  async cancelInvoice(uuid: string, reason: string): Promise<{ success: boolean; message?: string }> {
    // Indicar al usuario que debe ir directamente al panel de EcoFactura
    return {
      success: true,
      message: `Nota: Esta factura se registró de forma manual. Por favor proceda a cancelarla directamente en el portal de EcoFactura (UUID: ${uuid}, Motivo: ${reason}).`
    };
  }

  async checkInvoiceStatus(uuid: string): Promise<{ success: boolean; status?: string; message?: string }> {
    return {
      success: true,
      status: 'Manual',
      message: `Esta factura (${uuid}) fue registrada mediante el esquema manual de EcoFactura. Favor de validar su estado directamente en el portal del PAC.`
    };
  }
}
