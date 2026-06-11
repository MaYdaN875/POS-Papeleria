import { app, BrowserWindow, ipcMain, session } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { printEscPosTicket, type EscPosTicketPayload } from './thermalTicket'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '..')

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null

// Evita cierres inesperados al abrir el diálogo de impresión en Windows
app.disableHardwareAcceleration()
app.commandLine.appendSwitch('disable-features', 'PrintCompositorLPAC')

function createWindow() {
  session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: ['https://godart-papelería.com/*', 'https://xn--godart-papelera-ipb.com/*'] },
    (details, callback) => {
      details.requestHeaders['Origin'] = 'http://localhost:5173'
      callback({ requestHeaders: details.requestHeaders })
    }
  )

  win = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'POS Papeleria Godart [Electron]',
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  win.webContents.on('preload-error', (_event, preloadPath, error) => {
    console.error('PRELOAD ERROR:', preloadPath, error)
  })

  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', new Date().toLocaleString())
  })

  win.on('unresponsive', () => {
    console.error('Ventana principal no responde')
  })

  const loadApp = async () => {
    if (VITE_DEV_SERVER_URL) {
      await win!.loadURL(VITE_DEV_SERVER_URL)
    } else {
      await win!.loadFile(path.join(RENDERER_DIST, 'index.html'))
    }
  }

  loadApp().catch((err) => {
    console.error('Error cargando la app:', err)
  })

  win.webContents.on('did-fail-load', (_event, code, description, url) => {
    console.error('did-fail-load', code, description, url)
    if (VITE_DEV_SERVER_URL && win) {
      setTimeout(() => win?.loadURL(VITE_DEV_SERVER_URL), 1500)
    }
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.on('render-process-gone', (_event, _webContents, details) => {
  console.error('Render process gone:', details)
})

app.whenReady().then(() => {
  registerPrinterHandlers()
  createWindow()
})

function registerPrinterHandlers() {
  ipcMain.handle('get-printers', async () => {
    const target = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0]
    if (!target) return []
    try {
      const printers = await target.webContents.getPrintersAsync()
      return printers.map((p) => ({
        name: p.name,
        isDefault: p.isDefault,
        status: p.status,
      }))
    } catch (err) {
      console.error('get-printers error:', err)
      return []
    }
  })

  // Imprime la ventana actual (vista previa del ticket) sin abrir ventana extra
  ipcMain.handle(
    'print-visible-window',
    async (event, options: { printerName?: string; printerSize?: '58mm' | '80mm' }) => {
      const wc = event.sender
      const widthMm = options.printerSize === '80mm' ? 80 : 58

      const printOptions: Electron.WebContentsPrintOptions = {
        silent: false,
        printBackground: true,
        margins: { marginType: 'none' },
        pageSize: {
          width: widthMm * 1000,
          height: 300000,
        },
      }

      if (options.printerName) {
        printOptions.deviceName = options.printerName
      }

      try {
        await new Promise((r) => setTimeout(r, 200))

        const result = await new Promise<{ success: boolean; failureReason?: string }>((resolve) => {
          wc.print(printOptions, (success, failureReason) => {
            resolve({ success, failureReason })
          })
        })

        return {
          ok: result.success,
          message: result.failureReason || (result.success ? undefined : 'No se pudo imprimir'),
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Error de impresión'
        console.error('print-visible-window error:', err)
        return { ok: false, message: msg }
      }
    }
  )

  ipcMain.handle('print-escpos-ticket', async (_event, payload: EscPosTicketPayload) => {
    const target = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0]
    let defaultPrinter: string | undefined
    if (target) {
      try {
        const printers = await target.webContents.getPrintersAsync()
        defaultPrinter = printers.find((p) => p.isDefault)?.name
      } catch {
        /* ignore */
      }
    }
    return printEscPosTicket(payload, defaultPrinter)
  })
}
