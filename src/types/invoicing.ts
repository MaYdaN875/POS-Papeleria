export interface InvoiceCustomer {
  rfc: string;
  razonSocial: string;
  regimenFiscal: string; // SAT code (e.g. '601', '626')
  codigoPostal: string;
  email: string;
}

export interface InvoiceItem {
  productId: number;
  name: string;
  quantity: number;
  price: number; // Unit price without VAT
  taxRate: number; // e.g. 16 for 16% VAT
  claveProdServ?: string; // SAT Product/Service code, defaults to '01010101'
  claveUnidad?: string; // SAT Unit code, defaults to 'H87'
}

export interface InvoiceRequest {
  saleId: number;
  paymentMethod: 'cash' | 'card' | 'transfer';
  customer: InvoiceCustomer;
  usoCFDI: string; // SAT code (e.g. 'G03', 'S01')
  items: InvoiceItem[];
  subtotal: number;
  taxAmount: number;
  total: number;
}

export interface InvoiceResponse {
  success: boolean;
  message?: string;
  uuid?: string;
  invoiceNumber?: string;
  pdfUrl?: string;
  xmlUrl?: string;
}

export interface InvoiceProvider {
  getName(): string;
  createInvoice(request: InvoiceRequest): Promise<InvoiceResponse>;
  cancelInvoice(uuid: string, reason: string, substituteUuid?: string): Promise<{ success: boolean; message?: string }>;
  checkInvoiceStatus(uuid: string): Promise<{ success: boolean; status?: string; message?: string }>;
}

export interface Customer {
  id?: number;
  rfc: string;
  razonSocial: string;
  regimenFiscal: string;
  codigoPostal: string;
  email: string;
  createdAt?: string;
}

// SAT Catalogs for CFDI 4.0 in Mexico
export const REGIMENES_FISCALES = [
  { code: '601', description: 'General de Ley Personas Morales' },
  { code: '603', description: 'Personas Morales con Fines no Lucrativos' },
  { code: '605', description: 'Sueldos y Salarios e Ingresos Asimilados a Salarios' },
  { code: '606', description: 'Arrendamiento' },
  { code: '607', description: 'Régimen de Enajenación o Adquisición de Bienes' },
  { code: '608', description: 'Demás ingresos' },
  { code: '611', description: 'Ingresos por Dividendos (socios y accionistas)' },
  { code: '612', description: 'Personas Físicas con Actividades Empresariales y Profesionales' },
  { code: '614', description: 'Ingresos por Intereses' },
  { code: '615', description: 'Régimen de los ingresos por obtención de premios' },
  { code: '616', description: 'Sin obligaciones fiscales' },
  { code: '621', description: 'Incorporación Fiscal' },
  { code: '625', description: 'Régimen de las Actividades Empresariales con ingresos a través de Plataformas Tecnológicas' },
  { code: '626', description: 'Régimen Simplificado de Confianza (RESICO)' }
];

export const USOS_CFDI = [
  { code: 'G01', description: 'Adquisición de mercancías' },
  { code: 'G02', description: 'Devoluciones, descuentos o bonificaciones' },
  { code: 'G03', description: 'Gastos en general' },
  { code: 'I01', description: 'Construcciones' },
  { code: 'I02', description: 'Mobiliario y equipo de oficina por inversiones' },
  { code: 'I03', description: 'Equipo de transporte por inversiones' },
  { code: 'I04', description: 'Equipo de cómputo y accesorios por inversiones' },
  { code: 'I08', description: 'Otras inversiones' },
  { code: 'D01', description: 'Honorarios médicos, dentales y gastos hospitalarios' },
  { code: 'D02', description: 'Gastos médicos por incapacidad o discapacidad' },
  { code: 'D03', description: 'Gastos funerales' },
  { code: 'D04', description: 'Donativos' },
  { code: 'D05', description: 'Intereses reales efectivamente pagados por créditos hipotecarios (casa habitación)' },
  { code: 'D06', description: 'Aportaciones voluntarias al SAR' },
  { code: 'D07', description: 'Primas por seguros de gastos médicos' },
  { code: 'D08', description: 'Gastos de transportación escolar obligatoria' },
  { code: 'D10', description: 'Pagos por servicios educativos (colegiaturas)' },
  { code: 'S01', description: 'Sin efectos fiscales' }
];

// Mapping for Payment Method in CFDI (SAT codes)
export const FORMA_PAGO_MAP = {
  cash: '01',     // Efectivo
  card: '04',     // Tarjeta de crédito (or '28' Tarjeta de débito, defaulting to '04' is standard for card)
  transfer: '03'  // Transferencia electrónica de fondos
};

export const METODO_PAGO_MAP = {
  PUE: 'PUE', // Pago en una sola exhibición
  PPD: 'PPD'  // Pago en parcialidades o diferido
};
