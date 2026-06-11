import type { TicketData } from '../components/TicketPrint';
import type { GlobalSettings } from '../services/settingsService';

const STORE = {
  name: 'Papelería Godart',
  address: '3909 Av Presa de Osorio',
  city: 'Guadalajara, Jalisco',
  phone: '33 1112 4070',
  website: 'godart-papelería.com',
};

function money(n: number): string {
  return '$' + n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function methodLabel(m: string): string {
  if (m === 'cash') return 'Efectivo';
  if (m === 'card') return 'Tarjeta';
  return 'Transferencia';
}

export function buildTicketHtml(
  data: TicketData,
  settings?: GlobalSettings | null,
  qrDataUrl?: string
): string {
  const s = settings || ({} as GlobalSettings);
  const widthMm = s.printerSize === '58mm' ? 58 : 80;
  const fontPx = widthMm === 58 ? 11 : 12;

  const dateObj = new Date(data.date);
  const date = dateObj.toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' });
  const time = dateObj.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

  const storeName = s.storeName || STORE.name;
  const storeAddress = s.storeAddress || STORE.address;
  const storeCity = s.storeCity || STORE.city;
  const storePhone = s.storePhone || STORE.phone;
  const thanks = s.ticketThanksMessage || '¡Gracias por su compra!';
  const website = s.storeWebsite || STORE.website;

  const itemsHtml = data.items
    .map(
      (item) => `
      <tr>
        <td class="qty">${item.quantity}</td>
        <td class="desc">${escapeHtml(item.name)}<br><small>${item.quantity} x ${money(item.unitPrice)}</small></td>
        <td class="total">${money(item.totalPrice)}</td>
      </tr>`
    )
    .join('');

  const taxHtml =
    settings && settings.taxRate > 0
      ? `<div class="row"><span>IVA (${settings.taxRate}%):</span><span>${money(data.total - data.subtotal)}</span></div>`
      : '';

  const cashHtml =
    data.paymentMethod === 'cash' && data.cashReceived
      ? `<div class="row"><span>Efectivo:</span><span>${money(data.cashReceived)}</span></div>
         <div class="row"><span>Cambio:</span><span>${money(data.change || 0)}</span></div>`
      : '';

  const qrHtml = qrDataUrl
    ? `<img class="qr" src="${qrDataUrl}" alt="QR" width="120" height="120" />`
    : `<p class="web">${escapeHtml(website)}</p>`;

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Ticket #${data.saleId}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @page { size: ${widthMm}mm auto; margin: 0; }
  html, body {
    width: ${widthMm}mm;
    background: #fff;
    color: #000;
    font-family: 'Courier New', Courier, monospace;
    font-size: ${fontPx}px;
    line-height: 1.25;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .ticket { width: ${widthMm}mm; padding: 2mm 3mm 4mm; }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .title { font-size: ${fontPx + 3}px; font-weight: bold; margin-bottom: 2px; }
  .divider { text-align: center; margin: 4px 0; letter-spacing: -1px; overflow: hidden; white-space: nowrap; }
  .row { display: flex; justify-content: space-between; gap: 4px; margin: 1px 0; }
  .row.grand { font-size: ${fontPx + 2}px; font-weight: bold; border-top: 1px dashed #000; margin-top: 4px; padding-top: 4px; }
  table { width: 100%; border-collapse: collapse; margin: 4px 0; }
  th, td { vertical-align: top; padding: 2px 0; }
  th { border-bottom: 1px solid #000; text-align: left; font-size: ${fontPx - 1}px; }
  .qty { width: 8mm; }
  .desc { word-break: break-word; }
  .total { width: 18mm; text-align: right; white-space: nowrap; }
  .qr { display: block; margin: 6px auto; width: 28mm; height: 28mm; }
  .thanks { margin: 6px 0 4px; font-weight: bold; }
  .web { margin-top: 4px; font-size: ${fontPx - 1}px; }
</style></head>
<body>
<div class="ticket">
  <div class="center">
    <div class="title">${escapeHtml(storeName)}</div>
    <div>${escapeHtml(storeAddress)}</div>
    <div>${escapeHtml(storeCity)}</div>
    <div>Tel: ${escapeHtml(storePhone)}</div>
  </div>
  <div class="divider">${'─'.repeat(32)}</div>
  <div class="row"><span>Ticket:</span><span>#${data.saleId}</span></div>
  <div class="row"><span>Fecha:</span><span>${date}</span></div>
  <div class="row"><span>Hora:</span><span>${time}</span></div>
  <div class="row"><span>Cajero:</span><span>${escapeHtml(data.cashierName)}</span></div>
  <div class="divider">${'─'.repeat(32)}</div>
  <table>
    <thead><tr><th>Cant</th><th>Descripción</th><th class="total">Total</th></tr></thead>
    <tbody>${itemsHtml}</tbody>
  </table>
  <div class="divider">${'─'.repeat(32)}</div>
  <div class="row"><span>Subtotal:</span><span>${money(data.subtotal)}</span></div>
  ${taxHtml}
  <div class="row grand"><span>TOTAL:</span><span>${money(data.total)}</span></div>
  <div class="divider">${'─'.repeat(32)}</div>
  <div class="row"><span>Método:</span><span>${methodLabel(data.paymentMethod)}</span></div>
  ${cashHtml}
  <div class="divider">${'─'.repeat(32)}</div>
  <div class="center">
    <p class="thanks">${escapeHtml(thanks)}</p>
    ${qrHtml}
    <p class="web">Atención: ${escapeHtml(storePhone)}</p>
  </div>
</div>
</body></html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function fetchQrAsDataUrl(url: string): Promise<string | undefined> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return undefined;
  }
}
