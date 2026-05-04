import { useEffect, useRef } from 'react';
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

export default function TicketPrint({ data, onPrintDone }: TicketPrintProps) {
  const hasPrinted = useRef(false);

  useEffect(() => {
    if (hasPrinted.current) return;
    hasPrinted.current = true;

    // Pequeña pausa para asegurar que el DOM del ticket se renderice
    const timer = setTimeout(() => {
      window.print();
    }, 400);

    // Detectar cuando el diálogo de impresión se cierra
    const handleAfterPrint = () => {
      onPrintDone();
    };
    window.addEventListener('afterprint', handleAfterPrint);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, [onPrintDone]);

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

  // Generar URL para QR usando una API pública gratuita
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(STORE_INFO.websiteUrl)}`;

  return (
    <div className="ticket-print-overlay" id="ticket-print-area">
      <div className="ticket">
        {/* ---- Encabezado ---- */}
        <div className="ticket-header">
          <h1 className="ticket-store-name">{STORE_INFO.name}</h1>
          <p className="ticket-store-address">{STORE_INFO.address}</p>
          <p className="ticket-store-city">{STORE_INFO.city}</p>
          <p className="ticket-store-phone">Tel: {STORE_INFO.phone}</p>
        </div>

        <div className="ticket-divider">{'━'.repeat(32)}</div>

        {/* ---- Info de Venta ---- */}
        <div className="ticket-sale-info">
          <div className="ticket-row">
            <span>Ticket:</span>
            <span>#{String(data.saleId).padStart(6, '0')}</span>
          </div>
          <div className="ticket-row">
            <span>Fecha:</span>
            <span>{formattedDate}</span>
          </div>
          <div className="ticket-row">
            <span>Hora:</span>
            <span>{formattedTime}</span>
          </div>
          <div className="ticket-row">
            <span>Cajero:</span>
            <span>{data.cashierName}</span>
          </div>
        </div>

        <div className="ticket-divider">{'━'.repeat(32)}</div>

        {/* ---- Productos ---- */}
        <table className="ticket-items">
          <thead>
            <tr>
              <th className="ticket-th-qty">Cant</th>
              <th className="ticket-th-desc">Descripción</th>
              <th className="ticket-th-price">Precio</th>
              <th className="ticket-th-total">Importe</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item, idx) => (
              <tr key={idx}>
                <td className="ticket-td-qty">{item.quantity}</td>
                <td className="ticket-td-desc">{item.name}</td>
                <td className="ticket-td-price">{formatMoney(item.unitPrice)}</td>
                <td className="ticket-td-total">{formatMoney(item.totalPrice)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="ticket-divider">{'━'.repeat(32)}</div>

        {/* ---- Totales ---- */}
        <div className="ticket-totals">
          <div className="ticket-row">
            <span>Subtotal:</span>
            <span>{formatMoney(data.subtotal)}</span>
          </div>
          <div className="ticket-row ticket-row--grand-total">
            <span>TOTAL:</span>
            <span>{formatMoney(data.total)}</span>
          </div>
          <div className="ticket-row">
            <span>Método:</span>
            <span>{translateMethod(data.paymentMethod)}</span>
          </div>
          {data.paymentMethod === 'cash' && (
            <>
              <div className="ticket-row">
                <span>Efectivo:</span>
                <span>{formatMoney(data.cashReceived || 0)}</span>
              </div>
              <div className="ticket-row ticket-row--change">
                <span>Cambio:</span>
                <span>{formatMoney(data.change || 0)}</span>
              </div>
            </>
          )}
        </div>

        <div className="ticket-divider">{'━'.repeat(32)}</div>

        {/* ---- Pie: Contacto y QR ---- */}
        <div className="ticket-footer">
          <p className="ticket-thanks">¡Gracias por su compra!</p>
          <p className="ticket-visit">Visítanos en:</p>
          <p className="ticket-website">{STORE_INFO.website}</p>
          <img
            className="ticket-qr"
            src={qrUrl}
            alt="QR Página Web"
            width={120}
            height={120}
          />
          <p className="ticket-footer-phone">Atención al cliente: {STORE_INFO.phone}</p>
        </div>
      </div>
    </div>
  );
}
