import { create } from 'zustand';
import { TaecelProduct, TaecelTransaction, TaecelBalance } from '../types/taecel';
import { getTaecelBalance, executeTransaction, getProducts } from '../services/taecelService';

const PRODUCTS_CACHE_MS = 6 * 60 * 60 * 1000; // 6 horas — getProducts es pesado
const BALANCE_CACHE_MS = 45 * 1000; // 45 seg — evita spam a getBalance
const PRODUCTS_CACHE_KEY = 'pos_taecel_products_cache';

interface ProductsCachePayload {
  fetchedAt: number;
  products: TaecelProduct[];
}

function readProductsCache(): ProductsCachePayload | null {
  try {
    const raw = localStorage.getItem(PRODUCTS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ProductsCachePayload;
    if (!parsed?.fetchedAt || !Array.isArray(parsed.products)) return null;
    if (Date.now() - parsed.fetchedAt > PRODUCTS_CACHE_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeProductsCache(products: TaecelProduct[]): void {
  try {
    localStorage.setItem(
      PRODUCTS_CACHE_KEY,
      JSON.stringify({ fetchedAt: Date.now(), products })
    );
  } catch {
    // Ignorar si localStorage está lleno
  }
}

interface TaecelState {
  balance: TaecelBalance | null;
  products: TaecelProduct[];
  transactions: TaecelTransaction[];
  isLoading: boolean;
  balanceLoading: boolean;
  error: string | null;
  productsLoading: boolean;
  productsError: string | null;
  productsFetchedAt: number | null;
  balanceFetchedAt: number | null;

  fetchBalance: (force?: boolean) => Promise<void>;
  fetchProducts: (force?: boolean) => Promise<void>;
  performTransaction: (productId: string, reference: string, amount: number) => Promise<TaecelTransaction>;
}

export const useTaecelStore = create<TaecelState>((set, get) => ({
  balance: null,
  products: [],
  transactions: [],
  isLoading: false,
  balanceLoading: false,
  error: null,
  productsLoading: false,
  productsError: null,
  productsFetchedAt: null,
  balanceFetchedAt: null,

  fetchBalance: async (force = false) => {
    const { balanceFetchedAt, balanceLoading } = get();
    if (balanceLoading) return;

    if (!force && balanceFetchedAt && Date.now() - balanceFetchedAt < BALANCE_CACHE_MS) {
      return;
    }

    set({ balanceLoading: true, error: null });
    try {
      const balance = await getTaecelBalance();
      set({ balance, balanceLoading: false, balanceFetchedAt: Date.now() });
    } catch (error: any) {
      set({ error: error.message, balanceLoading: false });
    }
  },

  fetchProducts: async (force = false) => {
    const { products, productsFetchedAt, productsLoading } = get();
    if (productsLoading) return;

    if (
      !force
      && products.length > 0
      && productsFetchedAt
      && Date.now() - productsFetchedAt < PRODUCTS_CACHE_MS
    ) {
      return;
    }

    if (!force && products.length === 0) {
      const cached = readProductsCache();
      if (cached && cached.products.length > 0) {
        set({
          products: cached.products,
          productsFetchedAt: cached.fetchedAt,
          productsError: null,
        });
        return;
      }
    }

    set({ productsLoading: true, productsError: null });
    try {
      const nextProducts = await getProducts();
      writeProductsCache(nextProducts);
      set({
        products: nextProducts,
        productsLoading: false,
        productsFetchedAt: Date.now(),
      });
    } catch (error: any) {
      const msg = String(error.message || '');
      const friendly = msg.toLowerCase().includes('abuso')
        ? 'Taecel bloqueó consultas por exceso de peticiones. Espera 10-15 minutos y pulsa "Actualizar productos". Evita recargar la pestaña muchas veces seguidas.'
        : msg;
      set({ productsError: friendly, productsLoading: false });
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

      // Solo actualizar saldo tras cobrar (forzado)
      get().fetchBalance(true);
      
      return tx;
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  }
}));
