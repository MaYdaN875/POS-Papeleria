import { useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { GlobalSettings } from '../services/settingsService';
import { printEscPosTicket } from '../utils/thermalPrint';
import { Printer, X } from 'lucide-react';
import '../styles/TicketPrint.css';

export interface TicketData {
  saleId: number;
  items: { name: string; quantity: number; unitPrice: number; totalPrice: number }[];
  subtotal: number;
  total: number;
  paymentMethod: 'cash' | 'card' | 'transfer';
  cashReceived?: number;
  change?: number;
  cashierName: string;
  date: string;
}

interface TicketPrintProps {
  data: TicketData;
  settings?: GlobalSettings | null;
  onPrintDone: () => void;
}

const STORE_INFO = {
  name: 'Papelería Godart',
  address: '3909 Av Presa de Osorio',
  city: 'Guadalajara, Jalisco',
  phone: '33 1112 4070',
  website: 'godart-papelería.com',
  websiteUrl: 'https://www.godart-papelería.com',
};

function translateMethod(method: string): string {
  switch (method) {
    case 'cash': return 'Efectivo';
    case 'card': return 'Tarjeta';
    case 'transfer': return 'Transferencia';
    default: return method;
  }
}

function formatMoney(amount: number): string {
  return '$' + amount.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function TicketPrint({ data, settings, onPrintDone }: TicketPrintProps) {
  const storeInfo = (settings || STORE_INFO) as GlobalSettings & typeof STORE_INFO;
  const printerSize = settings?.printerSize === '80mm' ? '80mm' : '58mm';
  const printClass = printerSize === '58mm' ? 'print-58mm' : 'print-80mm';
  const dividerLen = printerSize === '58mm' ? 24 : 32;
  const finishingRef = useRef(false);

  useEffect(() => {
    const styleId = 'ticket-dynamic-page-size';
    let el = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement('style');
      el.id = styleId;
      document.head.appendChild(el);
    }
    el.textContent = `@media print { @page { size: ${printerSize} auto; margin: 0; } }`;
    return () => {
      el?.remove();
    };
  }, [printerSize]);

  const finishAndReturn = useCallback(() => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    onPrintDone();
  }, [onPrintDone]);

  const buildEscPosPayload = () => ({
    saleId: data.saleId,
    items: data.items,
    subtotal: data.subtotal,
    total: data.total,
    taxRate: settings?.taxRate,
    paymentMethod: data.paymentMethod,
    cashReceived: data.cashReceived,
    change: data.change,
    cashierName: data.cashierName,
    date: data.date,
    printerName: settings?.printerName?.trim() || undefined,
    printerSize: printerSize as '58mm' | '80mm',
    storeName: storeInfo.storeName || storeInfo.name,
    storeAddress: storeInfo.storeAddress || storeInfo.address,
    storeCity: storeInfo.storeCity || storeInfo.city,
    storePhone: storeInfo.storePhone || storeInfo.phone,
    storeWebsite: storeInfo.storeWebsite || storeInfo.website,
    storeWebsiteUrl: storeInfo.storeWebsiteUrl || storeInfo.websiteUrl,
    ticketThanksMessage: storeInfo.ticketThanksMessage,
  });

  const handlePrint = async () => {
    try {
      const result = await printEscPosTicket(buildEscPosPayload());
      if (!result.ok) {
        alert(result.message || 'No se pudo imprimir el ticket.');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al imprimir. Intenta de nuevo.';
      alert(msg);
    } finally {
      setTimeout(finishAndReturn, 300);
    }
  };

  const dateObj = new Date(data.date);
  const formattedDate = dateObj.toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  const formattedTime = dateObj.toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(storeInfo.storeWebsiteUrl || storeInfo.websiteUrl)}`;
  const ticketClass = printerSize === '58mm' ? 'ticket ticket--58mm' : 'ticket';

  return createPortal(
    <div className="ticket-preview-modal">
      <div className="ticket-preview-overlay" onClick={finishAndReturn} />

      <div className="ticket-preview-container">
        <div className="ticket-preview-header">
          <h3>Vista Previa de Ticket</h3>
          <div className="ticket-preview-actions">
            <button className="btn-print-now" onClick={handlePrint}>
              <Printer size={18} />
              Imprimir
            </button>
            <button className="btn-close-preview" onClick={finishAndReturn}>
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="ticket-preview-content">
          <div className={`ticket-print-overlay ${printClass}`} id="ticket-print-area">
            <div className={ticketClass}>
              <div className="ticket-header">
                <h1 className="ticket-store-name">{storeInfo.storeName || storeInfo.name}</h1>
                <p className="ticket-store-address">{storeInfo.storeAddress || storeInfo.address}</p>
                <p className="ticket-store-city">{storeInfo.storeCity || storeInfo.city}</p>
                <p className="ticket-store-phone">Tel: {storeInfo.storePhone || storeInfo.phone}</p>
              </div>

              <div className="ticket-divider">{'─'.repeat(dividerLen)}</div>

              <div className="ticket-info">
                <p>Ticket: #{data.saleId}</p>
                <p>Fecha: {formattedDate}</p>
                <p>Hora: {formattedTime}</p>
                <p>Cajero: {data.cashierName}</p>
              </div>

              <div className="ticket-divider">{'─'.repeat(dividerLen)}</div>

              <div className="ticket-items">
                {data.items.map((item, idx) => (
                  <div key={idx} className="ticket-item">
                    <div className="ticket-item-line1">
                      <span className="ticket-item-qty">{item.quantity}x</span>
                      <span className="ticket-item-name">{item.name}</span>
                      <span className="ticket-item-price">{formatMoney(item.totalPrice)}</span>
                    </div>
                    <div className="ticket-item-line2">
                      {item.quantity} x {formatMoney(item.unitPrice)}
                    </div>
                  </div>
                ))}
              </div>

              <div className="ticket-divider">{'─'.repeat(dividerLen)}</div>

              <div className="ticket-totals">
                <div className="ticket-total-row">
                  <span>Subtotal:</span>
                  <span>{formatMoney(data.subtotal)}</span>
                </div>
                {settings && settings.taxRate > 0 && (
                  <div className="ticket-total-row">
                    <span>IVA ({settings.taxRate}%):</span>
                    <span>{formatMoney(data.total - data.subtotal)}</span>
                  </div>
                )}
                <div className="ticket-total-row ticket-total-grand">
                  <span>TOTAL:</span>
                  <span>{formatMoney(data.total)}</span>
                </div>
              </div>

              <div className="ticket-divider">{'─'.repeat(dividerLen)}</div>

              <div className="ticket-payment">
                <div className="ticket-total-row">
                  <span>Método:</span>
                  <span>{translateMethod(data.paymentMethod)}</span>
                </div>
                {data.paymentMethod === 'cash' && data.cashReceived && (
                  <>
                    <div className="ticket-total-row">
                      <span>Efectivo:</span>
                      <span>{formatMoney(data.cashReceived)}</span>
                    </div>
                    <div className="ticket-total-row">
                      <span>Cambio:</span>
                      <span>{formatMoney(data.change || 0)}</span>
                    </div>
                  </>
                )}
              </div>

              <div className="ticket-divider">{'─'.repeat(dividerLen)}</div>

              <div className="ticket-footer">
                <p className="thanks-msg">{storeInfo.ticketThanksMessage || '¡Gracias por su compra!'}</p>
                <img
                  className="ticket-qr"
                  src={qrUrl}
                  alt="QR Página Web"
                />
                <p className="ticket-footer-website">{storeInfo.storeWebsite || storeInfo.website}</p>
                <p className="ticket-footer-phone">Atención al cliente: {storeInfo.storePhone || storeInfo.phone}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="ticket-preview-hint">
          Impresion directa ESC/POS ({printerSize}). Si falla, revisa Ajustes y reinicia la app.
        </div>
      </div>
    </div>,
    document.body
  );
}
