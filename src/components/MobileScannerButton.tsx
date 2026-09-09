import { useState } from 'react';
import { Camera } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';

interface MobileScannerButtonProps {
  onScan: (code: string) => void;
  className?: string;
  iconOnly?: boolean;
}

export default function MobileScannerButton({ onScan, className = '', iconOnly = false }: MobileScannerButtonProps) {
  const [isScanning, setIsScanning] = useState(false);

  // Solo se muestra si estamos en Android/iOS (Capacitor Nativo)
  if (!Capacitor.isNativePlatform()) {
    return null;
  }

  const startScan = async () => {
    try {
      // Solicitar permisos de cámara si no se tienen
      const { camera } = await BarcodeScanner.requestPermissions();
      if (camera !== 'granted' && camera !== 'limited') {
        alert('Se requiere acceso a la cámara para escanear');
        return;
      }

      setIsScanning(true);
      // Quitar fondo del body para que se vea la cámara (requerido por ML Kit en algunas versiones, 
      // aunque el scan() de @capacitor-mlkit suele abrir su propia UI activity en Android nativo).
      document.querySelector('body')?.classList.add('barcode-scanner-active');

      const result = await BarcodeScanner.scan();
      
      if (result.barcodes.length > 0 && result.barcodes[0].rawValue) {
        onScan(result.barcodes[0].rawValue);
      }
    } catch (error) {
      console.error('Error scanning barcode', error);
    } finally {
      setIsScanning(false);
      document.querySelector('body')?.classList.remove('barcode-scanner-active');
    }
  };

  return (
    <>
      <button 
        onClick={startScan} 
        className={`flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 transition-colors shadow-sm ${className}`}
        title="Escanear con cámara"
      >
        <Camera size={20} />
        {!iconOnly && <span className="font-medium">Escanear</span>}
      </button>

      {/* Overlay transparente para cancelar */}
      {isScanning && (
        <div 
          className="fixed inset-0 z-[9999] bg-black/40 flex items-end justify-center pb-20"
          onClick={() => {
            // Nota: En ML Kit nativo, el scan() abre una pantalla nativa de cámara,
            // por lo que este overlay web podría no verse hasta que se cierre, pero es útil por si acaso.
            setIsScanning(false);
            document.querySelector('body')?.classList.remove('barcode-scanner-active');
          }}
        >
          <button className="bg-red-600 text-white px-8 py-3 rounded-full shadow-lg font-bold">
            Cancelar Escaneo
          </button>
        </div>
      )}
    </>
  );
}
