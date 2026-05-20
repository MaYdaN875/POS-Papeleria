import { create } from 'zustand';
import { TaecelProduct, TaecelTransaction, TaecelBalance } from '../types/taecel';
import { getTaecelBalance, executeTransaction, getProducts } from '../services/taecelService';

interface TaecelState {
  balance: TaecelBalance | null;
  products: TaecelProduct[];
  transactions: TaecelTransaction[];
  isLoading: boolean;
  error: string | null;
  
  fetchBalance: () => Promise<void>;
  fetchProducts: () => Promise<void>;
  performTransaction: (productId: string, reference: string, amount: number) => Promise<TaecelTransaction>;
}

export const useTaecelStore = create<TaecelState>((set, get) => ({
  balance: null,
  products: [],
  transactions: [],
  isLoading: false,
  error: null,

  fetchBalance: async () => {
    set({ isLoading: true, error: null });
    try {
      const balance = await getTaecelBalance();
      set({ balance, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  fetchProducts: async () => {
    set({ isLoading: true, error: null });
    try {
      const products = await getProducts();
      set({ products, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  performTransaction: async (productId, reference, amount) => {
    set({ isLoading: true, error: null });
    try {
      const tx = await executeTransaction(productId, reference, amount);
      
      // Actualizamos el historial de transacciones
      set((state) => ({ 
        transactions: [tx, ...state.transactions],
        isLoading: false 
      }));

      // Volvemos a consultar el saldo después de una transacción exitosa
      get().fetchBalance();
      
      return tx;
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  }
}));
