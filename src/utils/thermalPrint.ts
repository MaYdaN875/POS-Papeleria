export interface PrinterInfo {
  name: string;
  isDefault: boolean;
  status?: number;
}

export interface EscPosTicketPayload {
  saleId: number;
  items: { name: string; quantity: number; unitPrice: number; totalPrice: number }[];
  subtotal: number;
  total: number;
  taxRate?: number;
  paymentMethod: 'cash' | 'card' | 'transfer';
  cashReceived?: number;
  change?: number;
  cashierName: string;
  date: string;
  printerName?: string;
  printerSize: '58mm' | '80mm';
  storeName: string;
  storeAddress: string;
  storeCity: string;
  storePhone: string;
  storeWebsite: string;
  storeWebsiteUrl: string;
  ticketThanksMessage?: string;
}

export function hasPrintBridge(): boolean {
  return !!(
    window.posPrinter?.printEscPosTicket ||
    window.ipcRenderer?.invoke
  );
}

export function isElectronEnv(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.__POS_IS_ELECTRON__) return true;
  if (window.posPrinter || window.ipcRenderer) return true;
  return navigator.userAgent.toLowerCase().includes('electron');
}

export function isBrowserWithoutBridge(): boolean {
  return !hasPrintBridge() && !isElectronEnv();
}

async function ipcInvoke<T>(channel: string, payload?: unknown): Promise<T | null> {
  if (!window.ipcRenderer?.invoke) return null;
  return window.ipcRenderer.invoke(channel, payload) as Promise<T>;
}

export function isWrongLabelDriver(printerName: string): boolean {
  const n = printerName.toLowerCase();
  return n.includes('tsc') || n.includes('bartender') || n.includes('seagull');
}

export async function listPrinters(): Promise<PrinterInfo[]> {
  if (window.posPrinter?.getPrinters) return window.posPrinter.getPrinters();
  const fromIpc = await ipcInvoke<PrinterInfo[]>('get-printers');
  return fromIpc ?? [];
}

export async function printEscPosTicket(
  payload: EscPosTicketPayload
): Promise<{ ok: boolean; message?: string }> {
  if (window.posPrinter?.printEscPosTicket) {
    return window.posPrinter.printEscPosTicket(payload);
  }
  const fromIpc = await ipcInvoke<{ ok: boolean; message?: string }>('print-escpos-ticket', payload);
  if (fromIpc) return fromIpc;

  if (isBrowserWithoutBridge()) {
    return {
      ok: false,
      message:
        'Estas en Chrome/Edge (localhost:5173). NO sirve para imprimir. Cierra el navegador y usa la ventana que dice "[Electron]" en el titulo.',
    };
  }

  return {
    ok: false,
    message:
      'Electron no cargo el modulo de impresion. Cierra todo, corre npm run dev y usa la ventana "[Electron]".',
  };
}
