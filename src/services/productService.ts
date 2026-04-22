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

/**
 * Actualiza el precio y stock de un producto
 */
export async function updateProduct(id: number, price: number, stock: number): Promise<{ ok: boolean; message?: string }> {
  try {
    const token = localStorage.getItem('pos_token');
    
    if (!token) {
      return { ok: false, message: 'No hay sesión iniciada' };
    }

    const formData = new URLSearchParams();
    formData.append('product_id', id.toString());
    formData.append('price', price.toString());
    formData.append('stock', stock.toString());

    // Nota: El endpoint debe estar en /admin/sales/ o el directorio adecuado del servidor
    const response = await fetch(`${ENDPOINTS.POS_INVENTORY_UPDATE}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Bearer ${token}`
      },
      body: formData.toString()
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error updating product:', error);
    return { ok: false, message: 'Error de red al actualizar' };
  }
}
