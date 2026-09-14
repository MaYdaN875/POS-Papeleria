import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Product } from '../services/productService';

interface ShoppingListState {
  items: Product[];
  addItem: (product: Product) => void;
  removeItem: (productId: number) => void;
  clearList: () => void;
}

export const useShoppingListStore = create<ShoppingListState>()(
  persist(
    (set) => ({
      items: [],
      addItem: (product) =>
        set((state) => {
          if (state.items.find((p) => p.id === product.id)) {
            return state;
          }
          return { items: [...state.items, product] };
        }),
      removeItem: (productId) =>
        set((state) => ({
          items: state.items.filter((p) => p.id !== productId),
        })),
      clearList: () => set({ items: [] }),
    }),
    {
      name: 'shopping-list-storage',
    }
  )
);
