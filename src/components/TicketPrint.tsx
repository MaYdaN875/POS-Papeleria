import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { GlobalSettings } from '../services/settingsService';
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
  const storeInfo = (settings || STORE_INFO) as any;

  // Manejar impresión real
  const handlePrint = () => {
    window.print();
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
  const printerClass = storeInfo.printerSize === '58mm' ? 'ticket ticket--58mm' : 'ticket';

  return createPortal(
    <div className="ticket-preview-modal">
      <div className="ticket-preview-overlay" onClick={onPrintDone} />
      
      <div className="ticket-preview-container">
        <div className="ticket-preview-header">
          <h3>Vista Previa de Ticket</h3>
          <div className="ticket-preview-actions">
            <button className="btn-print-now" onClick={handlePrint}>
              <Printer size={18} />
              Imprimir
            </button>
            <button className="btn-close-preview" onClick={onPrintDone}>
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="ticket-preview-content">
          <div className="ticket-print-overlay" id="ticket-print-area">
            <div className={printerClass}>
              <div className="ticket-header">
                <h1 className="ticket-store-name">{storeInfo.storeName || storeInfo.name}</h1>
                <p className="ticket-store-address">{storeInfo.storeAddress || storeInfo.address}</p>
                <p className="ticket-store-city">{storeInfo.storeCity || storeInfo.city}</p>
                <p className="ticket-store-phone">Tel: {storeInfo.storePhone || storeInfo.phone}</p>
              </div>

              <div className="ticket-divider">{'━'.repeat(32)}</div>

              <div className="ticket-info">
                <p>Ticket: #{data.saleId}</p>
                <p>Fecha: {formattedDate}</p>
                <p>Hora: {formattedTime}</p>
                <p>Cajero: {data.cashierName}</p>
              </div>

              <div className="ticket-divider">{'━'.repeat(32)}</div>

              <div className="ticket-items">
                <div className="ticket-item-header">
                  <span className="col-qty">Cant</span>
                  <span className="col-desc">Descripción</span>
                  <span className="col-total">Total</span>
                </div>
                {data.items.map((item, idx) => (
                  <div key={idx} className="ticket-item">
                    <div className="ticket-item-row">
                      <span className="col-qty">{item.quantity}</span>
                      <span className="col-desc">{item.name}</span>
                      <span className="col-total">{formatMoney(item.totalPrice)}</span>
                    </div>
                    <div className="ticket-item-details">
                      {item.quantity} x {formatMoney(item.unitPrice)}
                    </div>
                  </div>
                ))}
              </div>

              <div className="ticket-divider">{'━'.repeat(32)}</div>

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

              <div className="ticket-divider">{'━'.repeat(32)}</div>

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

              <div className="ticket-divider">{'━'.repeat(32)}</div>

              <div className="ticket-footer">
                <p className="thanks-msg">{storeInfo.ticketThanksMessage || '¡Gracias por su compra!'}</p>
                <img 
                  className="ticket-qr"
                  src={qrUrl}
                  alt="QR Página Web"
                  width={120}
                  height={120}
                />
                <p className="ticket-footer-website">{storeInfo.storeWebsite || storeInfo.website}</p>
                <p className="ticket-footer-phone">Atención al cliente: {storeInfo.storePhone || storeInfo.phone}</p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="ticket-preview-hint">
          * Esta es una vista previa visual. Presiona "Imprimir" para enviarlo a la impresora.
        </div>
      </div>
    </div>,
    document.body
  );
}
