import { LogOut } from 'lucide-react';
import { App as CapApp } from '@capacitor/app';
import { useBackHandler } from '../utils/backButtonManager';
import '../styles/ExitConfirmModal.css';

interface ExitConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ExitConfirmModal({ isOpen, onClose }: ExitConfirmModalProps) {
  // Si este modal está abierto y presionan atrás de nuevo, se cierra el modal
  useBackHandler(isOpen, onClose, 100);

  if (!isOpen) return null;

  const handleExit = () => {
    try {
      CapApp.exitApp();
    } catch {
      // Fallback si no está en entorno móvil nativo
      window.close();
    }
  };

  return (
    <div className="exit-modal-overlay" onClick={onClose}>
      <div className="exit-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="exit-modal-icon-wrapper">
          <LogOut size={32} />
        </div>

        <h3 className="exit-modal-title">
          ¿Salir de la aplicación?
        </h3>
        
        <p className="exit-modal-desc">
          ¿Estás seguro de que deseas cerrar el sistema de punto de venta?
        </p>

        <div className="exit-modal-actions">
          <button
            type="button"
            onClick={onClose}
            className="exit-modal-btn exit-modal-btn--cancel"
          >
            Cancelar
          </button>
          
          <button
            type="button"
            onClick={handleExit}
            className="exit-modal-btn exit-modal-btn--exit"
          >
            Salir
          </button>
        </div>
      </div>
    </div>
  );
}
