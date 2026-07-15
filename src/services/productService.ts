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
  isActive?: boolean;
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
    isActive: p.is_active !== undefined ? !!p.is_active : true,
  };
}

/**
 * Obtiene todos los productos activos.
 * Usa el endpoint POS si hay sesión, con fallback a la API pública.
 */
export async function getProducts(): Promise<Product[]> {
  // POS: precios físicos, stock y códigos de barras.
  // Pública: imágenes y categorías (las guarda en otra tabla que el POS no ve).
  const [posData, pubData] = await Promise.all([
    fetch(`${ENDPOINTS.POS_PRODUCTS}?include_inactive=1&t=${Date.now()}`)
      .then((r) => r.json())
      .catch(() => null),
    fetch(`${ENDPOINTS.PRODUCTS}?include_inactive=1`)
      .then((r) => r.json())
      .catch(() => null),
  ]);

  const pubProducts: Record<string, unknown>[] =
    pubData?.ok && Array.isArray(pubData.products) ? pubData.products : [];

  if (posData?.ok && Array.isArray(posData.products)) {
    const pubById = new Map<number, Record<string, unknown>>();
    for (const p of pubProducts) {
      pubById.set(Number(p.id), p);
    }

    const mergedProducts: Product[] = posData.products.map((p: Record<string, unknown>) => {
      const pub = pubById.get(Number(p.id));
      if (!pub) return mapProduct(p);

      const merged = { ...p };
      const posImage = String(p.image || '');
      if (!posImage || posImage === '/images/boligrafos.jpg') {
        merged.image = pub.image;
      }
      if (!p.category || p.category === 'General') {
        merged.category = pub.category ?? p.category;
        merged.category_slug = pub.category_slug ?? p.category_slug;
        merged.parent_category = pub.parent_category ?? p.parent_category;
      }
      return mapProduct(merged);
    });

    // Mismo orden que siempre: productos más recientes primero
    return mergedProducts.sort((a, b) => b.id - a.id);
  }

  if (pubProducts.length > 0) {
    return pubProducts.map(mapProduct);
  }

  throw new Error('Error al cargar productos');
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
): Promise<{ ok: boolean; message?: string; sessionExpired?: boolean }> {
  try {
    const token = localStorage.getItem('pos_token');

    if (!token) {
      return { ok: false, message: 'No hay sesión iniciada' };
    }

    const formData = new URLSearchParams();
    formData.append('product_id', id.toString());
    formData.append('pos_price', posPrice.toString());
    formData.append('stock', stock.toString());
    formData.append('access_token', token);

    // Sin header Authorization: evita bloqueo CORS en Hostinger.
    // El token va en access_token dentro del formulario POST.
    const response = await fetch(ENDPOINTS.POS_INVENTORY_UPDATE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    const rawText = await response.text();
    let data: Record<string, unknown> = {};
    try {
      data = rawText ? JSON.parse(rawText) : {};
    } catch {
      return {
        ok: false,
        message: `Respuesta inválida del servidor (${response.status}). Revisa pos_inventory_update.php en Hostinger.`,
      };
    }

    if (!response.ok || !data.ok) {
      return {
        ok: false,
        message: String(data.message || `Error al actualizar (${response.status})`),
        sessionExpired: response.status === 401,
      };
    }

    return { ok: true, message: String(data.message || '') };
  } catch (error) {
    console.error('Error updating product:', error);
    const detail = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      message: `No se pudo contactar al servidor: ${detail}. Sube pos_inventory_update.php actualizado a Hostinger.`,
    };
  }
}

/**
 * Elimina (o desactiva) un producto del inventario.
 */
export async function deleteProduct(
  id: number
): Promise<{ ok: boolean; message?: string; sessionExpired?: boolean }> {
  try {
    const token = localStorage.getItem('pos_token');
    if (!token) return { ok: false, message: 'No hay sesión iniciada' };

    const formData = new URLSearchParams();
    formData.append('product_id', id.toString());
    formData.append('access_token', token);

    // Token en el cuerpo (sin header Authorization) para evitar bloqueo CORS en Hostinger
    const response = await fetch(ENDPOINTS.POS_PRODUCT_DELETE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
    });

    const rawText = await response.text();
    let data: Record<string, unknown> = {};
    try {
      data = rawText ? JSON.parse(rawText) : {};
    } catch {
      return {
        ok: false,
        message: `Respuesta inválida del servidor (${response.status}). Sube pos_product_delete.php a Hostinger.`,
      };
    }

    if (!response.ok || !data.ok) {
      return {
        ok: false,
        message: String(data.message || `Error al eliminar (${response.status})`),
        sessionExpired: response.status === 401,
      };
    }

    return { ok: true, message: String(data.message || '') };
  } catch (error) {
    console.error('Error deleting product:', error);
    const detail = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      message: `No se pudo contactar al servidor: ${detail}. Sube pos_product_delete.php a Hostinger.`,
    };
  }
}

/**
 * Crea un producto nuevo desde el inventario del POS.
 */
export async function createProduct(
  payload: CreateProductPayload
): Promise<{ ok: boolean; message?: string; productId?: number; sessionExpired?: boolean }> {
  try {
    const token = localStorage.getItem('pos_token');
    if (!token) return { ok: false, message: 'No hay sesión iniciada' };

    const res = await fetch(ENDPOINTS.POS_PRODUCT_CREATE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ ...payload, access_token: token }),
    });

    const data = await res.json();
    if (data.ok) {
      return { ok: true, productId: data.product_id, message: data.message };
    }
    return {
      ok: false,
      message: data.message || 'Error al crear producto',
      sessionExpired: res.status === 401,
    };
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
