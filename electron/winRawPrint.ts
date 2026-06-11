import { execFile } from 'node:child_process'
import { writeFile, unlink } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const require = createRequire(import.meta.url)

type PrintDirectFn = (opts: {
  data: Buffer
  printer: string
  type?: string
  success?: (jobID: string) => void
  error?: (err: Error) => void
}) => void

let nodePrinter: { printDirect: PrintDirectFn } | null = null
try {
  nodePrinter = require('@grandchef/node-printer')
} catch {
  nodePrinter = null
}

const RAW_PRINT_PS = `
param(
  [Parameter(Mandatory=$true)][string]$PrinterName,
  [Parameter(Mandatory=$true)][string]$FilePath
)

$code = @'
using System;
using System.Runtime.InteropServices;
public class RawPrinterHelper
{
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
  public class DOCINFOA
  {
    [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
    [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
    [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
  }
  [DllImport("winspool.drv", EntryPoint = "OpenPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true)]
  public static extern bool OpenPrinter([MarshalAs(UnmanagedType.LPStr)] string szPrinter, out IntPtr hPrinter, IntPtr pd);
  [DllImport("winspool.drv", EntryPoint = "ClosePrinter", SetLastError = true, ExactSpelling = true)]
  public static extern bool ClosePrinter(IntPtr hPrinter);
  [DllImport("winspool.drv", EntryPoint = "StartDocPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true)]
  public static extern bool StartDocPrinter(IntPtr hPrinter, int level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);
  [DllImport("winspool.drv", EntryPoint = "EndDocPrinter", SetLastError = true, ExactSpelling = true)]
  public static extern bool EndDocPrinter(IntPtr hPrinter);
  [DllImport("winspool.drv", EntryPoint = "StartPagePrinter", SetLastError = true, ExactSpelling = true)]
  public static extern bool StartPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.drv", EntryPoint = "EndPagePrinter", SetLastError = true, ExactSpelling = true)]
  public static extern bool EndPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.drv", EntryPoint = "WritePrinter", SetLastError = true, ExactSpelling = true)]
  public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);

  public static bool SendBytesToPrinter(string szPrinterName, byte[] pBytes)
  {
    IntPtr hPrinter = IntPtr.Zero;
    DOCINFOA di = new DOCINFOA();
    di.pDocName = "POS Ticket";
    di.pDataType = "RAW";
    if (!OpenPrinter(szPrinterName.Normalize(), out hPrinter, IntPtr.Zero)) return false;
    try
    {
      if (!StartDocPrinter(hPrinter, 1, di)) return false;
      try
      {
        if (!StartPagePrinter(hPrinter)) return false;
        IntPtr pUnmanagedBytes = Marshal.AllocCoTaskMem(pBytes.Length);
        try
        {
          Marshal.Copy(pBytes, 0, pUnmanagedBytes, pBytes.Length);
          int dwWritten = 0;
          bool ok = WritePrinter(hPrinter, pUnmanagedBytes, pBytes.Length, out dwWritten);
          EndPagePrinter(hPrinter);
          return ok && dwWritten == pBytes.Length;
        }
        finally { Marshal.FreeCoTaskMem(pUnmanagedBytes); }
      }
      finally { EndDocPrinter(hPrinter); }
    }
    finally { ClosePrinter(hPrinter); }
  }
}
'@

Add-Type -TypeDefinition $code -Language CSharp
$bytes = [System.IO.File]::ReadAllBytes($FilePath)
$ok = [RawPrinterHelper]::SendBytesToPrinter($PrinterName, $bytes)
if (-not $ok) { throw "WritePrinter fallo para $PrinterName" }
`

function sendViaNodePrinter(printerName: string, data: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!nodePrinter) {
      reject(new Error('node-printer no disponible'))
      return
    }
    nodePrinter.printDirect({
      data,
      printer: printerName,
      type: 'RAW',
      success: () => resolve(),
      error: (err) => reject(err),
    })
  })
}

async function sendViaPowerShell(printerName: string, data: Buffer): Promise<void> {
  const stamp = Date.now()
  const tmpFile = path.join(tmpdir(), `pos-ticket-${stamp}.bin`)
  const psFile = path.join(tmpdir(), `pos-print-${stamp}.ps1`)
  await writeFile(tmpFile, data)
  await writeFile(psFile, RAW_PRINT_PS)

  try {
    await execFileAsync(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        psFile,
        '-PrinterName',
        printerName,
        '-FilePath',
        tmpFile,
      ],
      { windowsHide: true, timeout: 30000 }
    )
  } finally {
    await Promise.all([unlink(tmpFile).catch(() => {}), unlink(psFile).catch(() => {})])
  }
}

export async function sendRawToPrinter(printerName: string, data: Buffer): Promise<void> {
  if (process.platform !== 'win32') {
    throw new Error('Impresion RAW solo disponible en Windows')
  }

  if (nodePrinter) {
    try {
      await sendViaNodePrinter(printerName, data)
      console.log(`[RAW] Enviado via node-printer a "${printerName}" (${data.length} bytes)`)
      return
    } catch (err) {
      console.warn('[RAW] node-printer fallo, intentando PowerShell:', err)
    }
  }

  await sendViaPowerShell(printerName, data)
  console.log(`[RAW] Enviado via PowerShell a "${printerName}" (${data.length} bytes)`)
}
