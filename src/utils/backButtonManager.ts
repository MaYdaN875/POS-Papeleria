import { useEffect, useRef } from 'react';

type BackCallback = () => boolean | void;

interface HandlerEntry {
  id: string;
  handler: BackCallback;
  priority: number;
}

class BackButtonManager {
  private handlers: HandlerEntry[] = [];

  register(id: string, handler: BackCallback, priority = 10) {
    this.handlers = this.handlers.filter((h) => h.id !== id);
    this.handlers.push({ id, handler, priority });
    // Ordenar de mayor a menor prioridad (el más reciente o prioritario primero)
    this.handlers.sort((a, b) => b.priority - a.priority);
  }

  unregister(id: string) {
    this.handlers = this.handlers.filter((h) => h.id !== id);
  }

  handleBack(): boolean {
    if (this.handlers.length > 0) {
      const top = this.handlers[0];
      top.handler();
      return true;
    }
    return false;
  }

  hasHandlers(): boolean {
    return this.handlers.length > 0;
  }
}

export const backButtonManager = new BackButtonManager();

/**
 * Hook para registrar un modal, menú o acción que debe cerrarse al presionar el botón atrás del celular
 * @param isOpen Si el modal/elemento está actualmente visible/abierto
 * @param onBack Función a ejecutar cuando el usuario presiona atrás
 * @param priority Prioridad (por defecto 10, mayor número = se ejecuta primero)
 */
export function useBackHandler(isOpen: boolean, onBack: () => void, priority = 10) {
  const idRef = useRef<string>(`modal_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`);
  const callbackRef = useRef(onBack);
  callbackRef.current = onBack;

  useEffect(() => {
    const id = idRef.current;
    if (!isOpen) {
      backButtonManager.unregister(id);
      return;
    }

    backButtonManager.register(
      id,
      () => {
        callbackRef.current();
      },
      priority
    );

    return () => {
      backButtonManager.unregister(id);
    };
  }, [isOpen, priority]);
}
