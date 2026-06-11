import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('__POS_IS_ELECTRON__', true)

contextBridge.exposeInMainWorld('posPrinter', {
  getPrinters: () => ipcRenderer.invoke('get-printers'),
  printVisibleWindow: (options: { printerName?: string; printerSize?: '58mm' | '80mm' }) =>
    ipcRenderer.invoke('print-visible-window', options),
  printEscPosTicket: (payload: Record<string, unknown>) =>
    ipcRenderer.invoke('print-escpos-ticket', payload),
})

contextBridge.exposeInMainWorld('ipcRenderer', {
  on(...args: Parameters<typeof ipcRenderer.on>) {
    const [channel, listener] = args
    return ipcRenderer.on(channel, (event, ...args) => listener(event, ...args))
  },
  off(...args: Parameters<typeof ipcRenderer.off>) {
    const [channel, ...omit] = args
    return ipcRenderer.off(channel, ...omit)
  },
  send(...args: Parameters<typeof ipcRenderer.send>) {
    const [channel, ...omit] = args
    return ipcRenderer.send(channel, ...omit)
  },
  invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
    const [channel, ...omit] = args
    return ipcRenderer.invoke(channel, ...omit)
  },
})
