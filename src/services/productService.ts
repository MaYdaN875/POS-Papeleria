/**
 * Servicio de productos.
 * Obtiene productos del endpoint POS (con precio separado) o de la API pública.
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
  price: number;           // precio efectivo en POS
  webPrice: number;        // precio web (con oferta si aplica)
  posPrice: number | null; // precio POS personalizado (null = usar web)
  originalPrice: number;
  isOffer: boolean;
  offerPrice: number | null;
  discountPercentage: number;
  barcodes?: string[];
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface CreateProductPayload {
  name: string;
  brand?: string;
  description?: string;
  price: number;
  pos_price?: number | null;
  stock: number;
  category_id?: number;
  barcode?: string;
}

export interface Category {
  id: number;
  name: string;
}

function mapProduct(p: Record<string, unknown>): Product {
  const webPrice = Number(p.web_final_price ?? p.final_price ?? p.price ?? 0);
  const rawPosPrice = p.pos_price;
  const posPrice =
    rawPosPrice !== null && rawPosPrice !== undefined && rawPosPrice !== ''
      ? Number(rawPosPrice)
      : null;

  return {
    id: Number(p.id),
    name: String(p.name ?? ''),
    category: String(p.category || 'General'),
    categorySlug: String(p.category_slug || ''),
    parentCategory: String(p.parent_category || p.category || 'General'),
    description: String(p.description || ''),
    brand: String(p.brand || ''),
    image: String(p.image || '/images/boligrafos.jpg'),
    stock: Number(p.stock ?? 0),
    webPrice,
    posPrice,
    price: posPrice !== null && posPrice >= 0 ? posPrice : webPrice,
    originalPrice: Number(p.original_price ?? p.price ?? webPrice),
    isOffer: !!p.is_offer,
    offerPrice: p.offer_price != null ? Number(p.offer_price) : null,
    discountPercentage: Number(p.discount_percentage || 0),
    barcodes: Array.isArray(p.barcodes) ? p.barcodes.map(String) : [],
  };
}

/**
 * Obtiene todos los productos activos.
 * Usa el endpoint POS si hay sesión, con fallback a la API pública.
 */
export async function getProducts(): Promise<Product[]> {
  const token = localStorage.getItem('pos_token');

  if (token) {
    try {
      const res = await fetch(ENDPOINTS.POS_PRODUCTS, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok && data.products) {
        return data.products.map(mapProduct);
      }
    } catch (err) {
      console.warn('POS products endpoint no disponible, usando API pública:', err);
    }
  }

  const res = await fetch(ENDPOINTS.PRODUCTS);
  const data = await res.json();

  if (!data.ok || !data.products) {
    throw new Error(data.message || 'Error al cargar productos');
  }

  return data.products.map(mapProduct);
}

/**
 * Obtiene las categorías de la tienda web.
 */
export async function getProductCategories(): Promise<Category[]> {
  try {
    const res = await fetch(ENDPOINTS.CATEGORIES);
    const data = await res.json();
    if (data.ok && Array.isArray(data.categories)) {
      return data.categories.map((c: Record<string, unknown>) => ({
        id: Number(c.id),
        name: String(c.name),
      }));
    }
  } catch (err) {
    console.warn('No se pudieron cargar categorías:', err);
  }
  return [];
}

/**
 * Obtiene las categorías únicas de los productos.
 */
export function getCategories(products: Product[]): string[] {
  const cats = new Set(products.map((p) => p.parentCategory));
  return ['Todos', ...Array.from(cats).sort()];
}

/**
 * Actualiza el precio POS y stock de un producto (no modifica precio web).
 */
export async function updateProduct(
  id: number,
  posPrice: number,
  stock: number
): Promise<{ ok: boolean; message?: string }> {
  try {
    const token = localStorage.getItem('pos_token');

    if (!token) {
      return { ok: false, message: 'No hay sesión iniciada' };
    }

    const formData = new URLSearchParams();
    formData.append('product_id', id.toString());
    formData.append('pos_price', posPrice.toString());
    formData.append('stock', stock.toString());

    const response = await fetch(ENDPOINTS.POS_INVENTORY_UPDATE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Bearer ${token}`,
      },
      body: formData.toString(),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error updating product:', error);
    return { ok: false, message: 'Error de red al actualizar' };
  }
}

/**
 * Crea un producto nuevo desde el inventario del POS.
 */
export async function createProduct(
  payload: CreateProductPayload
): Promise<{ ok: boolean; message?: string; productId?: number }> {
  try {
    const token = localStorage.getItem('pos_token');
    if (!token) return { ok: false, message: 'No hay sesión iniciada' };

    const res = await fetch(ENDPOINTS.POS_PRODUCT_CREATE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (data.ok) {
      return { ok: true, productId: data.product_id, message: data.message };
    }
    return { ok: false, message: data.message || 'Error al crear producto' };
  } catch (error) {
    console.error('Error creating product:', error);
    return { ok: false, message: 'Error de red al crear producto' };
  }
}

/**
 * Agrega un código de barras a un producto.
 */
export async function addProductBarcode(
  productId: number,
  barcode: string
): Promise<{ ok: boolean; message?: string }> {
  try {
    const token = localStorage.getItem('pos_token');
    if (!token) return { ok: false, message: 'No hay sesión iniciada' };

    const res = await fetch(ENDPOINTS.POS_PRODUCT_BARCODES, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ product_id: productId, barcode }),
    });
    return await res.json();
  } catch (error) {
    console.error(error);
    return { ok: false, message: 'Error de red' };
  }
}

/**
 * Elimina un código de barras.
 */
export async function removeProductBarcode(
  barcode: string
): Promise<{ ok: boolean; message?: string }> {
  try {
    const token = localStorage.getItem('pos_token');
    if (!token) return { ok: false, message: 'No hay sesión iniciada' };

    const res = await fetch(ENDPOINTS.POS_PRODUCT_BARCODES, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ barcode }),
    });
    return await res.json();
  } catch (error) {
    console.error(error);
    return { ok: false, message: 'Error de red' };
  }
}
