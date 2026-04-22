/**
 * Servicio de productos.
 * Obtiene los productos de la misma API pública que la tienda web.
 */

import { ENDPOINTS } from '../config';

export interface Product {
  id: number;
  name: string;
  category: string;
  categorySlug: string;
  parentCategory: string;
  description: string;
  brand: string;
  image: string;
  stock: number;
  price: number;          // precio final (con oferta si tiene)
  originalPrice: number;  // precio original
  isOffer: boolean;
  offerPrice: number | null;
  discountPercentage: number;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

/**
 * Obtiene todos los productos activos de la API.
 */
export async function getProducts(): Promise<Product[]> {
  const res = await fetch(ENDPOINTS.PRODUCTS);
  const data = await res.json();

  if (!data.ok || !data.products) {
    throw new Error(data.message || 'Error al cargar productos');
  }

  return data.products.map((p: any) => ({
    id: p.id,
    name: p.name,
    category: p.category || 'General',
    categorySlug: p.category_slug || '',
    parentCategory: p.parent_category || p.category || 'General',
    description: p.description || '',
    brand: p.brand || '',
    image: p.image || '/images/boligrafos.jpg',
    stock: p.stock,
    price: p.final_price,
    originalPrice: p.original_price,
    isOffer: !!p.is_offer,
    offerPrice: p.offer_price,
    discountPercentage: p.discount_percentage || 0,
  }));
}

/**
 * Obtiene las categorías únicas de los productos.
 */
export function getCategories(products: Product[]): string[] {
  const cats = new Set(products.map((p) => p.parentCategory));
  return ['Todos', ...Array.from(cats).sort()];
}
