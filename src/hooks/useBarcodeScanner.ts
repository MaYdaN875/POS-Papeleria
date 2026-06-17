import { useEffect, useRef } from 'react';
import { playBeep } from '../utils/sounds';

interface UseBarcodeScannerOptions {
  onScan: (code: string) => void;
  threshold?: number;
  enabled?: boolean;
}

/**
 * Hook para detectar la entrada de un lector de código de barras.
 * El lector simula teclado rápido + Enter. No intercepta cuando escribes en inputs.
 */
export function useBarcodeScanner({ onScan, threshold = 50, enabled = true }: UseBarcodeScannerOptions) {
  const barcode = useRef('');
  const lastKeyTime = useRef(Date.now());
  const savedOnScan = useRef(onScan);

  // Mantener la referencia actualizada de onScan sin re-suscribir el evento
  useEffect(() => {
    savedOnScan.current = onScan;
  }, [onScan]);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;

      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) {
          return;
        }
      }

      const currentTime = Date.now();
      
      // Si el tiempo entre teclas es mayor al umbral, asumimos que es tipeo humano
      if (currentTime - lastKeyTime.current > threshold) {
        barcode.current = '';
      }

      if (e.key === 'Enter') {
        if (barcode.current.length > 0) {
          // ¡Es un escaneo!
          playBeep();
          savedOnScan.current(barcode.current);
          barcode.current = '';
          
          // Prevenir comportamiento por defecto (como envío de formularios)
          e.preventDefault();
        }
      } else if (e.key.length === 1) { // Solo caracteres normales
        barcode.current += e.key;
      }

      lastKeyTime.current = currentTime;
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [threshold, enabled]);
}
