import { useEffect, useRef } from 'react';

interface UseBarcodeScannerOptions {
  onScan: (code: string) => void;
  threshold?: number; // tiempo máximo entre teclas en ms
}

/**
 * Hook para detectar la entrada de un lector de código de barras.
 * El lector de código de barras simula un teclado muy rápido, seguido de la tecla Enter.
 */
export function useBarcodeScanner({ onScan, threshold = 50 }: UseBarcodeScannerOptions) {
  const barcode = useRef('');
  const lastKeyTime = useRef(Date.now());
  const savedOnScan = useRef(onScan);

  // Mantener la referencia actualizada de onScan sin re-suscribir el evento
  useEffect(() => {
    savedOnScan.current = onScan;
  }, [onScan]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignorar si se usan teclas modificadoras
      if (e.altKey || e.ctrlKey || e.metaKey) return;

      // Ignorar si el usuario está escribiendo en un input, a menos que queramos capturarlo de todas formas
      // Pero para un escáner suele ser útil capturarlo siempre.

      const currentTime = Date.now();
      
      // Si el tiempo entre teclas es mayor al umbral, asumimos que es tipeo humano
      if (currentTime - lastKeyTime.current > threshold) {
        barcode.current = '';
      }

      if (e.key === 'Enter') {
        if (barcode.current.length > 0) {
          // ¡Es un escaneo!
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
  }, [threshold]);
}
