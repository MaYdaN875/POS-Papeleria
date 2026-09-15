import { useState } from 'react';
import { Camera } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import { useBackHandler } from '../utils/backButtonManager';

interface MobileScannerButtonProps {
  onScan: (code: string) => void;
  className?: string;
  iconOnly?: boolean;
}

export default function MobileScannerButton({ onScan, className = '', iconOnly = false }: MobileScannerButtonProps) {
  const [isScanning, setIsScanning] = useState(false);

  // Cancelar escaneo activo con el botón atrás
  useBackHandler(isScanning, () => {
    setIsScanning(false);
    document.querySelector('body')?.classList.remove('barcode-scanner-active');
  }, 20);

  // Solo se muestra si estamos en Android/iOS (Capacitor Nativo)
  if (!Capacitor.isNativePlatform()) {
    return null;
  }

  const checkAndStartScan = async () => {
    try {
      const status = await BarcodeScanner.checkPermissions();
      
      if (status.camera === 'granted' || status.camera === 'limited') {
        await executeNativeScan();
      } else {
        // Pedir permiso directo del sistema operativo
        const request = await BarcodeScanner.requestPermissions();
        if (request.camera === 'granted' || request.camera === 'limited') {
          await executeNativeScan();
        } else {
          alert('Permiso de cámara denegado. Por favor habilítalo desde los ajustes de tu celular.');
        }
      }
    } catch (err) {
      console.error('Error al verificar permisos de escaneo:', err);
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
      console.error('Error durante el escaneo:', error);
    } finally {
      setIsScanning(false);
      document.querySelector('body')?.classList.remove('barcode-scanner-active');
    }
  };

  return (
    <>
      <button 
        type="button"
        onClick={checkAndStartScan} 
        className={`sales-scan-trigger-btn ${className}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          background: 'var(--color-primary, #2563eb)',
          color: '#ffffff',
          borderRadius: '12px',
          padding: iconOnly ? '10px' : '10px 16px',
          border: 'none',
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)',
          transition: 'all 0.15s ease'
        }}
        title="Escanear código de barras con cámara"
      >
        <Camera size={20} />
        {!iconOnly && <span style={{ fontWeight: 600, fontSize: '13px' }}>Escanear</span>}
      </button>

      {/* Overlay para cancelar escaneo nativo */}
      {isScanning && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999999,
            background: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            paddingBottom: '40px'
          }}
          onClick={() => {
            setIsScanning(false);
            document.querySelector('body')?.classList.remove('barcode-scanner-active');
          }}
        >
          <button 
            type="button"
            style={{
              background: '#ef4444',
              color: '#ffffff',
              padding: '14px 28px',
              borderRadius: '9999px',
              fontSize: '15px',
              fontWeight: 700,
              boxShadow: '0 10px 25px rgba(239, 68, 68, 0.5)',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            Cancelar Escaneo
          </button>
        </div>
      )}
    </>
  );
}
