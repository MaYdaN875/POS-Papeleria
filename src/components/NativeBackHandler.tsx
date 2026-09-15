import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { App as CapApp } from '@capacitor/app';
import { backButtonManager } from '../utils/backButtonManager';
import ExitConfirmModal from './ExitConfirmModal';

export default function NativeBackHandler() {
  const navigate = useNavigate();
  const location = useLocation();
  const [showExitModal, setShowExitModal] = useState(false);

  useEffect(() => {
    let removeListener: (() => void) | null = null;

    const setupListener = async () => {
      try {
        const handler = await CapApp.addListener('backButton', () => {
          // 1. Si hay modales o menús registrados abiertos, cerrarlos primero
          if (backButtonManager.handleBack()) {
            return;
          }

          // 2. Si no hay modales abiertos, revisar la ruta actual
          const currentPath = location.pathname.toLowerCase();
          const isRootPath = currentPath === '/' || currentPath === '/dashboard' || currentPath === '';

          if (isRootPath) {
            // Mostrar modal de confirmación antes de salir
            setShowExitModal(true);
          } else {
            // Regresar a la pantalla anterior
            navigate(-1);
          }
        });

        removeListener = () => {
          handler.remove();
        };
      } catch (err) {
        console.warn('Capacitor App listener no soportado en esta plataforma', err);
      }
    };

    setupListener();

    return () => {
      if (removeListener) {
        removeListener();
      }
    };
  }, [location.pathname, navigate]);

  return <ExitConfirmModal isOpen={showExitModal} onClose={() => setShowExitModal(false)} />;
}
