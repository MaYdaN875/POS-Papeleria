import { ENDPOINTS } from '../config';

// === Interfaces ===

export interface Supplier {
  id: number;
  name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  rfc: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductSupplier {
  link_id: number;
  product_id: number;
  supplier_sku: string | null;
  cost_price: number;
  is_primary: boolean; // Mapeado desde 0/1 en el backend
  product_name: string;
  product_stock: number;
  product_sku: string | null;
}

export interface PurchaseOrder {
  id: number;
  supplier_id: number;
  admin_user_id: number;
  status: 'pending' | 'partially_received' | 'received' | 'cancelled';
  total_amount: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  supplier_name?: string;
  admin_name?: string;
}

export interface PurchaseOrderItem {
  id: number;
  purchase_order_id: number;
  product_id: number;
  quantity_ordered: number;
  quantity_received: number;
  price_per_unit: number;
  total_price: number;
  product_name?: string;
  product_sku?: string | null;
}

export interface PurchaseSuggestion {
  product_id: number;
  product_name: string;
  current_stock: number;
  low_stock_threshold: number;
  menudeo_min_qty: number;
  supplier_id: number | null;
  supplier_name: string | null;
  cost_price: number | null;
  supplier_sku: string | null;
}

export interface SimpleProduct {
  id: number;
  name: string;
  sku: string | null;
  stock: number;
  price?: number;
  pos_price?: number | null;
}

// === Helpers ===

function getToken(): string {
  return localStorage.getItem('pos_token') || '';
}

async function handleResponse(response: Response) {
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Respuesta inválida del servidor (${response.status})`);
  }

  if (!response.ok || !data.ok) {
    throw new Error(data.message || 'Error en el servidor');
  }
  return data;
}

// === API Calls ===

// --- Proveedores ---

export async function getSuppliers(): Promise<Supplier[]> {
  const token = getToken();
  const response = await fetch(`${ENDPOINTS.POS_SUPPLIERS}?action=list&access_token=${token}`);
  const data = await handleResponse(response);
  return data.suppliers || [];
}

export async function getSupplierProducts(supplierId: number): Promise<ProductSupplier[]> {
  const token = getToken();
  const response = await fetch(`${ENDPOINTS.POS_SUPPLIERS}?action=products&supplier_id=${supplierId}&access_token=${token}`);
  const data = await handleResponse(response);
  return (data.products || []).map((p: any) => ({
    ...p,
    cost_price: Number(p.cost_price),
    is_primary: Boolean(Number(p.is_primary)),
    product_stock: Number(p.product_stock)
  }));
}

export async function getAllProductsForMapping(): Promise<SimpleProduct[]> {
  const token = getToken();
  const response = await fetch(`${ENDPOINTS.POS_SUPPLIERS}?action=all_products&access_token=${token}`);
  const data = await handleResponse(response);
  return data.products || [];
}

export async function createSupplier(payload: Omit<Supplier, 'id' | 'created_at' | 'updated_at'>): Promise<Supplier> {
  const token = getToken();
  const response = await fetch(ENDPOINTS.POS_SUPPLIERS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'create',
      access_token: token,
      ...payload
    })
  });
  const data = await handleResponse(response);
  return {
    id: data.id,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...payload
  };
}

export async function updateSupplier(supplier: Supplier): Promise<void> {
  const token = getToken();
  await fetch(ENDPOINTS.POS_SUPPLIERS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'update',
      access_token: token,
      ...supplier
    })
  });
}

export async function deleteSupplier(id: number): Promise<void> {
  const token = getToken();
  await fetch(ENDPOINTS.POS_SUPPLIERS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'delete',
      access_token: token,
      id
    })
  });
}

export async function linkProductSupplier(
  supplierId: number,
  productId: number,
  costPrice: number,
  supplierSku: string,
  isPrimary: boolean
): Promise<void> {
  const token = getToken();
  await fetch(ENDPOINTS.POS_SUPPLIERS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'link_product',
      access_token: token,
      supplier_id: supplierId,
      product_id: productId,
      cost_price: costPrice,
      supplier_sku: supplierSku,
      is_primary: isPrimary ? 1 : 0
    })
  });
}

export async function unlinkProductSupplier(supplierId: number, productId: number): Promise<void> {
  const token = getToken();
  await fetch(ENDPOINTS.POS_SUPPLIERS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'unlink_product',
      access_token: token,
      supplier_id: supplierId,
      product_id: productId
    })
  });
}

export async function updateProductSupplierLink(
  supplierId: number,
  productId: number,
  costPrice: number,
  supplierSku: string,
  isPrimary: boolean
): Promise<void> {
  const token = getToken();
  await fetch(ENDPOINTS.POS_SUPPLIERS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'update_link',
      access_token: token,
      supplier_id: supplierId,
      product_id: productId,
      cost_price: costPrice,
      supplier_sku: supplierSku,
      is_primary: isPrimary ? 1 : 0
    })
  });
}

// --- Órdenes de Compra ---

export async function getPurchaseOrders(): Promise<PurchaseOrder[]> {
  const token = getToken();
  const response = await fetch(`${ENDPOINTS.POS_PURCHASE_ORDERS}?action=list&access_token=${token}`);
  const data = await handleResponse(response);
  return (data.orders || []).map((o: any) => ({
    ...o,
    total_amount: Number(o.total_amount)
  }));
}

export async function getPurchaseOrderDetail(orderId: number): Promise<{ order: PurchaseOrder; items: PurchaseOrderItem[] }> {
  const token = getToken();
  const response = await fetch(`${ENDPOINTS.POS_PURCHASE_ORDERS}?action=detail&id=${orderId}&access_token=${token}`);
  const data = await handleResponse(response);
  return {
    order: {
      ...data.order,
      total_amount: Number(data.order.total_amount)
    },
    items: (data.items || []).map((i: any) => ({
      ...i,
      quantity_ordered: Number(i.quantity_ordered),
      quantity_received: Number(i.quantity_received),
      price_per_unit: Number(i.price_per_unit),
      total_price: Number(i.total_price)
    }))
  };
}

export async function getPurchaseSuggestions(): Promise<PurchaseSuggestion[]> {
  const token = getToken();
  const response = await fetch(`${ENDPOINTS.POS_PURCHASE_ORDERS}?action=suggestions&access_token=${token}`);
  const data = await handleResponse(response);
  return (data.suggestions || []).map((s: any) => ({
    ...s,
    current_stock: Number(s.current_stock),
    low_stock_threshold: Number(s.low_stock_threshold),
    menudeo_min_qty: Number(s.menudeo_min_qty),
    supplier_id: s.supplier_id ? Number(s.supplier_id) : null,
    cost_price: s.cost_price ? Number(s.cost_price) : null
  }));
}

export async function getSupplierHistory(supplierId: number): Promise<{ history: PurchaseOrder[]; total_spent: number; total_orders: number }> {
  const token = getToken();
  const response = await fetch(`${ENDPOINTS.POS_PURCHASE_ORDERS}?action=history&supplier_id=${supplierId}&access_token=${token}`);
  const data = await handleResponse(response);
  return {
    history: (data.history || []).map((o: any) => ({ ...o, total_amount: Number(o.total_amount) })),
    total_spent: Number(data.total_spent || 0),
    total_orders: Number(data.total_orders || 0)
  };
}

export async function createPurchaseOrder(
  supplierId: number,
  items: Array<{ product_id: number; quantity_ordered: number; price_per_unit: number }>,
  notes: string
): Promise<number> {
  const token = getToken();
  const response = await fetch(ENDPOINTS.POS_PURCHASE_ORDERS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'create',
      access_token: token,
      supplier_id: supplierId,
      items,
      notes
    })
  });
  const data = await handleResponse(response);
  return data.id;
}

export async function receivePurchaseOrderItems(
  purchaseOrderId: number,
  items: Array<{ product_id: number; quantity_received: number }>
): Promise<void> {
  const token = getToken();
  await fetch(ENDPOINTS.POS_PURCHASE_ORDERS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'receive',
      access_token: token,
      purchase_order_id: purchaseOrderId,
      items
    })
  });
}

export async function cancelPurchaseOrder(orderId: number): Promise<void> {
  const token = getToken();
  await fetch(ENDPOINTS.POS_PURCHASE_ORDERS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'cancel',
      access_token: token,
      id: orderId
    })
  });
}
