/// <reference types="vite/client" />

interface EscPosTicketPayload {
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

interface PosPrinterApi {
  getPrinters: () => Promise<Array<{ name: string; isDefault: boolean; status?: number }>>;
  printVisibleWindow: (options: {
    printerName?: string;
    printerSize?: '58mm' | '80mm';
  }) => Promise<{ ok: boolean; message?: string }>;
  printEscPosTicket: (payload: EscPosTicketPayload) => Promise<{ ok: boolean; message?: string }>;
}

interface IpcRendererApi {
  invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
  on: (channel: string, listener: (...args: unknown[]) => void) => void;
  off: (channel: string, listener: (...args: unknown[]) => void) => void;
  send: (channel: string, ...args: unknown[]) => void;
}

interface Window {
  __POS_IS_ELECTRON__?: boolean;
  posPrinter?: PosPrinterApi;
  ipcRenderer?: IpcRendererApi;
}
