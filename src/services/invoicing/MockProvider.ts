import { InvoiceProvider, InvoiceRequest, InvoiceResponse } from '../../types/invoicing';

export class MockProvider implements InvoiceProvider {
  getName(): string {
    return 'Mock Invoice Provider';
  }

  async createInvoice(request: InvoiceRequest): Promise<InvoiceResponse> {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const randomId = Math.random().toString(36).substring(2, 11).toUpperCase();
    const uuid = `550E8400-E29B-41D4-A716-44665544${randomId}`;
    const invoiceNumber = `FAC-${String(request.saleId).padStart(6, '0')}`;

    return {
      success: true,
      uuid,
      invoiceNumber,
      // Generic mock URLs that resemble a real invoice
      pdfUrl: `https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf`,
      xmlUrl: `https://raw.githubusercontent.com/w3c/xml-schema-xml/master/schema.xml`,
      message: 'Factura simulada timbrada con éxito'
    };
  }

  async cancelInvoice(uuid: string, reason: string): Promise<{ success: boolean; message?: string }> {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return {
      success: true,
      message: `Factura ${uuid} cancelada con éxito (Motivo: ${reason})`
    };
  }
}
