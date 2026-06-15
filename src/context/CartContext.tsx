/**
 * Contexto del carrito.
 * Comparte el estado del carrito entre SalesPage y PaymentPage.
 */

import { createContext, useContext, useState, type ReactNode } from 'react';
import type { CartItem, Product } from '../services/productService';

interface CartContextValue {
  cart: CartItem[];
  addToCart: (product: Product) => boolean;
  updateQuantity: (productId: number, delta: number) => boolean;
  removeFromCart: (productId: number) => void;
  clearCart: () => void;
  subtotal: number;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);

  const addToCart = (product: Product): boolean => {
    if (product.stock <= 0) return false;

    // Decidir con el estado actual para devolver un resultado confiable
    const existing = cart.find((item) => item.product.id === product.id);
    const currentQty = existing?.quantity ?? 0;
    if (currentQty >= product.stock) return false;

    setCart((prev) => {
      const ex = prev.find((item) => item.product.id === product.id);
      if (ex) {
        if (ex.quantity >= product.stock) return prev;
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
    return true;
  };

  const updateQuantity = (productId: number, delta: number): boolean => {
    const item = cart.find((i) => i.product.id === productId);
    if (!item) return false;

    const newQty = item.quantity + delta;
    if (newQty > item.product.stock) return false;

    setCart((prev) =>
      prev
        .map((i) =>
          i.product.id === productId
            ? { ...i, quantity: Math.max(0, i.quantity + delta) }
            : i
        )
        .filter((i) => i.quantity > 0)
    );
    return true;
  };

  const removeFromCart = (productId: number) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const clearCart = () => setCart([]);

  const subtotal = cart.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  );

  return (
    <CartContext.Provider
      value={{ cart, addToCart, updateQuantity, removeFromCart, clearCart, subtotal }}
    >
      {children}
    </CartContext.Provider>
  );
}
export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}

