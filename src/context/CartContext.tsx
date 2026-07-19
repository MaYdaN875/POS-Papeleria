/**
 * Contexto del carrito.
 * Comparte el estado del carrito entre SalesPage y PaymentPage.
 */

import { createContext, useContext, useState, type ReactNode } from 'react';
import type { CartItem, Product, Presentation } from '../services/productService';

interface CartContextValue {
  cart: CartItem[];
  addToCart: (product: Product, presentation?: Presentation) => boolean;
  updateQuantity: (productId: number, presentationId: number, delta: number) => boolean;
  removeFromCart: (productId: number, presentationId: number) => void;
  clearCart: () => void;
  subtotal: number;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);

  const addToCart = (product: Product, presentation?: Presentation): boolean => {
    const defaultPres: Presentation = {
      id: 0,
      productId: product.id,
      name: 'Pieza',
      barcode: product.barcodes?.[0] || null,
      unitsPerSale: 1.0,
      salePrice: product.price,
      isDefault: true,
      isActive: true
    };
    const pres = presentation ?? product.presentations?.find(pr => pr.isDefault) ?? product.presentations?.[0] ?? defaultPres;

    // Check stock by summing up base units for this product in cart
    const currentUsed = cart
      .filter((item) => item.product.id === product.id)
      .reduce((sum, item) => sum + item.quantity * item.presentation.unitsPerSale, 0);

    if (currentUsed + pres.unitsPerSale > product.stock) {
      return false;
    }

    setCart((prev) => {
      const ex = prev.find(
        (item) => item.product.id === product.id && item.presentation.id === pres.id
      );
      if (ex) {
        // Double check stock limits
        const totalUsed = prev
          .filter((item) => item.product.id === product.id)
          .reduce((sum, item) => sum + item.quantity * item.presentation.unitsPerSale, 0);
        if (totalUsed + pres.unitsPerSale > product.stock) return prev;

        return prev.map((item) =>
          item.product.id === product.id && item.presentation.id === pres.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, presentation: pres, quantity: 1 }];
    });
    return true;
  };

  const updateQuantity = (productId: number, presentationId: number, delta: number): boolean => {
    const item = cart.find((i) => i.product.id === productId && i.presentation.id === presentationId);
    if (!item) return false;

    // Check stock if adding
    if (delta > 0) {
      const totalUsed = cart
        .filter((i) => i.product.id === productId)
        .reduce((sum, i) => sum + i.quantity * i.presentation.unitsPerSale, 0);
      if (totalUsed + item.presentation.unitsPerSale > item.product.stock) {
        return false;
      }
    }

    setCart((prev) =>
      prev
        .map((i) =>
          i.product.id === productId && i.presentation.id === presentationId
            ? { ...i, quantity: Math.max(0, i.quantity + delta) }
            : i
        )
        .filter((i) => i.quantity > 0)
    );
    return true;
  };

  const removeFromCart = (productId: number, presentationId: number) => {
    setCart((prev) => prev.filter((item) => !(item.product.id === productId && item.presentation.id === presentationId)));
  };

  const clearCart = () => setCart([]);

  const subtotal = cart.reduce(
    (sum, item) => sum + item.presentation.salePrice * item.quantity,
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

