import { createRequire } from 'node:module'
import { sendRawToPrinter } from './winRawPrint'

const require = createRequire(import.meta.url)
const { ThermalPrinter, PrinterTypes, CharacterSet, BreakLine } = require('node-thermal-printer')

export interface EscPosTicketPayload {
  saleId: number
  items: { name: string; quantity: number; unitPrice: number; totalPrice: number }[]
  subtotal: number
  total: number
  taxRate?: number
  paymentMethod: 'cash' | 'card' | 'transfer'
  cashReceived?: number
  change?: number
  cashierName: string
  date: string
  printerName?: string
  printerSize: '58mm' | '80mm'
  storeName: string
  storeAddress: string
  storeCity: string
  storePhone: string
  storeWebsite: string
  storeWebsiteUrl: string
  ticketThanksMessage?: string
}

/** Ancho maximo de lineas (separadores de borde a borde). */
const FULL_WIDTH = { '58mm': 32, '80mm': 48 } as const
/** Ancho de texto con margenes laterales. */
const TEXT_WIDTH = { '58mm': 28, '80mm': 40 } as const
const SIDE_MARGIN = { left: 1, right: 3 } as const

function formatMoney(amount: number): string {
  const n = Number.isFinite(amount) ? amount : 0
  return '$' + n.toFixed(2)
}

function sanitize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, '')
    .trim()
}

function truncate(text: string, max: number): string {
  const t = sanitize(text)
  if (t.length <= max) return t
  if (max <= 1) return t.slice(0, max)
  return t.slice(0, max - 1) + '.'
}

/** URL canonica para QR (conserva idn / punycode, sin quitar acentos). */
function resolveWebsiteUrl(raw: string): string {
  let value = raw.trim()
  if (!value) value = 'https://www.godart-papelería.com'
  try {
    if (!/^https?:\/\//i.test(value)) value = `https://${value}`
    return new URL(value).href
  } catch {
    return 'https://xn--godart-papelera-ipb.com'
  }
}

function fullLine(char: string, size: '58mm' | '80mm'): string {
  return char.repeat(FULL_WIDTH[size])
}

function printFullLine(printer: InstanceType<typeof ThermalPrinter>, char: string, size: '58mm' | '80mm') {
  printer.alignLeft()
  printer.setTextNormal()
  printer.bold(false)
  printer.println(fullLine(char, size))
}

/** Centra texto manualmente (mas fiable que alignCenter en 58mm). */
function centerText(text: string, size: '58mm' | '80mm'): string {
  const clean = sanitize(text)
  const max = FULL_WIDTH[size]
  const t = clean.length > max ? clean.slice(0, max - 1) + '.' : clean
  const pad = Math.max(0, Math.floor((max - t.length) / 2))
  return ' '.repeat(pad) + t
}

function printCenterLine(printer: InstanceType<typeof ThermalPrinter>, text: string, size: '58mm' | '80mm') {
  printer.alignLeft()
  printer.setTextNormal()
  printer.bold(false)
  printer.println(centerText(text, size))
}

function printCenterLineUtf8(printer: InstanceType<typeof ThermalPrinter>, text: string, size: '58mm' | '80mm') {
  const max = FULL_WIDTH[size]
  const t = text.trim()
  const trimmed = t.length > max ? t.slice(0, max - 1) + '.' : t
  const pad = Math.max(0, Math.floor((max - trimmed.length) / 2))
  printer.alignLeft()
  printer.setTextNormal()
  printer.bold(false)
  printer.println(' '.repeat(pad) + trimmed)
}

function lineLR(left: string, right: string, size: '58mm' | '80mm'): string {
  const width = TEXT_WIDTH[size]
  const inner = width - SIDE_MARGIN.left - SIDE_MARGIN.right
  const r = sanitize(right)
  const maxLeft = Math.max(1, inner - r.length - 1)
  const l = truncate(left, maxLeft)
  const spaces = Math.max(1, inner - l.length - r.length)
  return (
    ' '.repeat(SIDE_MARGIN.left) +
    l +
    ' '.repeat(spaces) +
    r +
    ' '.repeat(SIDE_MARGIN.right)
  )
}

function padLeft(text: string, size: '58mm' | '80mm'): string {
  const max = TEXT_WIDTH[size] - SIDE_MARGIN.left - SIDE_MARGIN.right
  return ' '.repeat(SIDE_MARGIN.left) + truncate(text, max)
}

function translateMethod(method: string): string {
  switch (method) {
    case 'cash':
      return 'Efectivo'
    case 'card':
      return 'Tarjeta'
    case 'transfer':
      return 'Transferencia'
    default:
      return method
  }
}

function createRawDriver() {
  return {
    getPrinters() {
      return []
    },
    getPrinter(name: string) {
      return { name, status: '' }
    },
    printDirect({
      data,
      printer,
      success,
      error,
    }: {
      data: Buffer
      printer: string
      success?: (jobID: string) => void
      error?: (err: Error) => void
    }) {
      sendRawToPrinter(printer, data)
        .then(() => success?.(''))
        .catch((err: Error) => error?.(err))
    },
  }
}

/** Inicializa area de impresion y oscuridad para RPP02N / POS58 */
function initPrinterHardware(printer: InstanceType<typeof ThermalPrinter>, size: '58mm' | '80mm') {
  printer.add(Buffer.from([0x1b, 0x40])) // ESC @ reset
  printer.add(Buffer.from([0x1d, 0x4c, 0x00, 0x00])) // GS L - margen izq 0
  const dots = size === '80mm' ? 576 : 384 // area util en dots (203 dpi)
  printer.add(Buffer.from([0x1d, 0x57, dots & 0xff, (dots >> 8) & 0xff])) // GS W ancho
  printer.add(Buffer.from([0x1b, 0x37, 7, 80, 7])) // ESC 7 calor suave (evita manchas/encimado)
  printer.resetLineSpacing()
  printer.setTypeFontA()
  printer.setTextNormal()
  printer.bold(false)
}

export async function printEscPosTicket(
  payload: EscPosTicketPayload,
  fallbackPrinterName?: string
): Promise<{ ok: boolean; message?: string }> {
  const printerName = payload.printerName?.trim() || fallbackPrinterName
  if (!printerName) {
    return { ok: false, message: 'Selecciona una impresora en Ajustes -> Ticket' }
  }

  const size = payload.printerSize === '80mm' ? '80mm' : '58mm'
  const dateObj = new Date(payload.date)
  const formattedDate = dateObj.toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
  const formattedTime = dateObj.toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
  })

  const printer = new ThermalPrinter({
    type: PrinterTypes.EPSON,
    interface: `printer:${printerName}`,
    width: TEXT_WIDTH[size],
    characterSet: CharacterSet.PC437_USA,
    removeSpecialCharacters: true,
    breakLine: BreakLine.NONE,
    driver: createRawDriver(),
  })

  try {
    initPrinterHardware(printer, size)
    // Salta posible logo/caracteres basura del driver al inicio
    printer.newLine()
    printer.newLine()

    printCenterLine(printer, payload.storeName, size)
    printCenterLine(printer, payload.storeAddress, size)
    printCenterLine(printer, payload.storeCity, size)
    printCenterLine(printer, `Tel: ${payload.storePhone}`, size)

    printFullLine(printer, '-', size)
    printer.alignLeft()
    printer.setTextNormal()
    printer.println(padLeft(`Ticket: #${payload.saleId}`, size))
    printer.println(padLeft(`Fecha: ${sanitize(formattedDate)}`, size))
    printer.println(padLeft(`Hora: ${formattedTime}`, size))
    printer.println(padLeft(`Cajero: ${sanitize(payload.cashierName)}`, size))

    printFullLine(printer, '-', size)

    for (let i = 0; i < payload.items.length; i++) {
      const item = payload.items[i]
      const qtyLabel = `${item.quantity}x ${item.name}`
      printer.println(lineLR(qtyLabel, formatMoney(item.totalPrice), size))
      printer.println(padLeft(`${item.quantity} x ${formatMoney(item.unitPrice)}`, size))
      if (i < payload.items.length - 1) {
        printer.newLine()
      }
    }

    printFullLine(printer, '-', size)

    printer.setTextNormal()
    printer.println(lineLR('Subtotal:', formatMoney(payload.subtotal), size))
    if (payload.taxRate && payload.taxRate > 0) {
      const tax = payload.total - payload.subtotal
      printer.println(lineLR(`IVA (${payload.taxRate}%):`, formatMoney(tax), size))
    }
    printer.println(lineLR('TOTAL:', formatMoney(payload.total), size))

    printFullLine(printer, '-', size)

    printer.setTextNormal()
    printer.println(lineLR('Metodo:', translateMethod(payload.paymentMethod), size))
    if (payload.paymentMethod === 'cash' && payload.cashReceived != null) {
      printer.println(lineLR('Efectivo:', formatMoney(payload.cashReceived), size))
      printer.println(lineLR('Cambio:', formatMoney(payload.change ?? 0), size))
    }

    printFullLine(printer, '-', size)

    printCenterLine(printer, payload.ticketThanksMessage || 'Gracias por su compra!', size)
    printer.newLine()

    const qrUrl = resolveWebsiteUrl(payload.storeWebsiteUrl || payload.storeWebsite)
    printer.alignCenter()
    printer.setTextNormal()
    printer.printQR(qrUrl, { cellSize: size === '80mm' ? 5 : 4, correction: 'M' })
    printer.newLine()
    printer.alignLeft()
    printer.setCharacterSet(CharacterSet.PC850_MULTILINGUAL)
    printCenterLineUtf8(printer, payload.storeWebsite, size)
    printCenterLine(printer, `Atencion: ${payload.storePhone}`, size)

    printer.alignLeft()
    printer.newLine()
    printer.newLine()
    printer.cut()

    await printer.execute()
    console.log(`[ESC/POS] Ticket impreso en "${printerName}" (${size})`)
    return { ok: true }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error al imprimir ticket ESC/POS'
    console.error('printEscPosTicket error:', err)
    return { ok: false, message: msg }
  }
}
