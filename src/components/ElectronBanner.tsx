import { isBrowserWithoutBridge } from '../utils/thermalPrint';
import './ElectronBanner.css';

export default function ElectronBanner() {
  if (!isBrowserWithoutBridge()) return null;

  return (
    <div className="electron-banner" role="alert">
      Estas en el navegador. Cierra esta pestana y usa la ventana del POS que dice{' '}
      <strong>[Electron]</strong> en el titulo (se abre sola con npm run dev).
    </div>
  );
}
