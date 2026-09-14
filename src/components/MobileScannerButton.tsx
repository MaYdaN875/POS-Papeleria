import { useState } from 'react';
import { Camera, ScanLine, Smartphone } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';

interface MobileScannerButtonProps {
  onScan: (code: string) => void;
  className?: string;
  iconOnly?: boolean;
}

export default function MobileScannerButton({ onScan, className = '', iconOnly = false }: MobileScannerButtonProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [showPrePermission, setShowPrePermission] = useState(false);

  // Solo se muestra si estamos en Android/iOS (Capacitor Nativo)
  if (!Capacitor.isNativePlatform()) {
    return null;
  }

  const checkAndStartScan = async () => {
    try {
      const status = await BarcodeScanner.checkPermissions();
      
      if (status.camera === 'granted' || status.camera === 'limited') {
        // Ya tenemos permiso, iniciamos directo
        await executeNativeScan();
      } else {
        // Mostrar modal estético pidiendo permiso
        setShowPrePermission(true);
      }
    } catch (err) {
      console.error('Error checking permissions:', err);
    }
  };

  const handleGrantPermission = async () => {
    setShowPrePermission(false);
    try {
      const request = await BarcodeScanner.requestPermissions();
      if (request.camera === 'granted' || request.camera === 'limited') {
        await executeNativeScan();
      } else {
        alert('Permiso denegado. Por favor habilita el uso de la cámara desde la configuración de tu celular.');
      }
    } catch (err) {
      console.error('Error requesting permissions:', err);
    }
  };

  const executeNativeScan = async () => {
    try {
      setIsScanning(true);
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
        onClick={checkAndStartScan} 
        className={`flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 transition-colors shadow-sm ${className}`}
        title="Escanear con cámara"
      >
        <Camera size={20} />
        {!iconOnly && <span className="font-medium">Escanear</span>}
      </button>

      {/* Modal Pre-Permisos Estético */}
      {showPrePermission && (
        <div className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Camera className="text-blue-600" size={32} />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">
                Acceso a Cámara Requerido
              </h3>
              <p className="text-slate-600 text-sm mb-6">
                El sistema de Papelería Godart necesita permiso para usar la cámara y poder escanear los códigos de barras de los productos de forma rápida.
              </p>
              
              <div className="flex flex-col gap-3">
                <button 
                  onClick={handleGrantPermission}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-colors"
                >
                  Continuar y Permitir
                </button>
                <button 
                  onClick={() => setShowPrePermission(false)}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-3 rounded-xl transition-colors"
                >
                  Ahora no
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Overlay transparente para cancelar escaneo nativo (por si queda atorado en Android) */}
      {isScanning && (
        <div 
          className="fixed inset-0 z-[9998] bg-black/80 flex items-end justify-center pb-20"
          onClick={() => {
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
