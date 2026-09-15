import { LogOut } from 'lucide-react';
import { App as CapApp } from '@capacitor/app';
import { useBackHandler } from '../utils/backButtonManager';

interface ExitConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ExitConfirmModal({ isOpen, onClose }: ExitConfirmModalProps) {
  // Si este modal está abierto y presionan atrás de nuevo, simplemente cerramos el modal
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
    <div className="fixed inset-0 z-[99999] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-sm p-6 shadow-2xl text-center animate-in zoom-in-95 duration-200"
        style={{
          backgroundColor: 'var(--card-bg, #ffffff)',
          color: 'var(--text-color, #1e293b)',
          borderColor: 'var(--border-color, #e2e8f0)',
          borderRadius: '24px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        }}
      >
        <div 
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
          style={{ backgroundColor: 'rgba(239, 68, 68, 0.12)', color: '#ef4444' }}
        >
          <LogOut size={32} />
        </div>

        <h3 className="text-xl font-bold mb-2" style={{ color: 'var(--text-color, #1e293b)' }}>
          ¿Salir de la aplicación?
        </h3>
        
        <p className="text-sm mb-6" style={{ color: 'var(--text-muted, #64748b)' }}>
          ¿Estás seguro de que deseas cerrar el sistema de punto de venta?
        </p>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-xl font-semibold transition-all"
            style={{
              backgroundColor: 'var(--bg-secondary, #f1f5f9)',
              color: 'var(--text-color, #334155)',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            Cancelar
          </button>
          
          <button
            type="button"
            onClick={handleExit}
            className="flex-1 py-3 px-4 rounded-xl font-semibold text-white transition-all shadow-md"
            style={{
              backgroundColor: '#ef4444',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            Salir
          </button>
        </div>
      </div>
    </div>
  );
}
