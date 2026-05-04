/**
 * Servicio del dashboard.
 * Obtiene resumen de ventas POS del día.
 */

import { ENDPOINTS } from '../config';
import { authFetch } from './authService';

export interface DashboardSummary {
  totalRevenue: number;
  totalUnits: number;
  totalOrders: number;
  products: {
    productId: number;
    productName: string;
    totalUnits: number;
    totalRevenue: number;
    totalOrders: number;
  }[];
  low_stock: {
    id: number;
    name: string;
    stock: number;
    category: string;
  }[];
  hourly_sales: {
    hour: number;
    label: string;
    amount: number;
  }[];
  periodStart: string | null;
}

/**
 * Obtiene resumen de ventas POS del día actual.
 */
export async function getPosDashboard(): Promise<DashboardSummary> {
  try {
    const res = await authFetch(ENDPOINTS.POS_DASHBOARD);
    const data = await res.json();

    if (!data.ok) {
      return {
        totalRevenue: 0,
        totalUnits: 0,
        totalOrders: 0,
        products: [],
        low_stock: [],
        hourly_sales: [],
        periodStart: null,
      };
    }

    return {
      totalRevenue: data.summary?.total_revenue ?? 0,
      totalUnits: data.summary?.total_units ?? 0,
      totalOrders: data.summary?.total_orders ?? 0,
      products: (data.products || []).map((p: any) => ({
        productId: p.product_id,
        productName: p.product_name,
        totalUnits: p.total_units,
        totalRevenue: p.total_revenue,
        totalOrders: p.total_orders,
      })),
      low_stock: data.low_stock || [],
      hourly_sales: data.hourly_sales || [],
      periodStart: data.period_start || null,
    };
  } catch (err) {
    console.error('Dashboard fetch error:', err);
    return {
      totalRevenue: 0,
      totalUnits: 0,
      totalOrders: 0,
      products: [],
      low_stock: [],
      hourly_sales: [],
      periodStart: null,
    };
  }
}

/**
 * Cierra la sesión de caja.
 */
export async function closeCashSession(payload: {
  expected_cash: number;
  expected_card: number;
  counted_cash: number;
  counted_card: number;
  difference?: number;
  notes?: string;
}) {
  const res = await authFetch(ENDPOINTS.POS_CASH_CLOSE, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res.json();
}

export interface CashSession {
  id: number;
  cashier_name: string;
  expected_cash: string;
  expected_card: string;
  counted_cash: string;
  counted_card: string;
  difference: string;
  status: 'ok' | 'faltante' | 'sobrante';
  created_at: string;
}

export interface CashHistoryResponse {
  ok: boolean;
  message?: string;
  sessions?: CashSession[];
}

export async function getCashHistory(params: { date_start?: string, date_end?: string, limit?: number } = {}): Promise<CashHistoryResponse> {
  try {
    const query = new URLSearchParams();
    if (params.date_start) query.append('date_start', params.date_start);
    if (params.date_end) query.append('date_end', params.date_end);
    if (params.limit) query.append('limit', params.limit.toString());

    const queryString = query.toString();
    const url = queryString ? `${ENDPOINTS.POS_CASH_HISTORY}?${queryString}` : ENDPOINTS.POS_CASH_HISTORY;
    
    const res = await authFetch(url);
    return await res.json();
  } catch (err: any) {
    console.error('Cash history fetch error:', err);
    return { ok: false, message: err.message };
  }
}

export interface SalesHistoryResponse {
  ok: boolean;
  message?: string;
  sales?: any[];
  summary?: {
    total_revenue: number;
    total_orders: number;
  };
  sale?: any;
}

export async function getSalesHistory(params: { date_start?: string, date_end?: string, limit?: number, sale_id?: number } = {}): Promise<SalesHistoryResponse> {
  try {
    const query = new URLSearchParams();
    if (params.date_start) query.append('date_start', params.date_start);
    if (params.date_end) query.append('date_end', params.date_end);
    if (params.limit) query.append('limit', params.limit.toString());
    if (params.sale_id) query.append('sale_id', params.sale_id.toString());

    const queryString = query.toString();
    const url = queryString ? `${ENDPOINTS.POS_SALES_HISTORY}?${queryString}` : ENDPOINTS.POS_SALES_HISTORY;
    
    const res = await authFetch(url);
    const contentType = res.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      return await res.json();
    } else {
      const text = await res.text();
      console.error("Non-JSON response received:", text);
      return { ok: false, message: "El servidor devolvió un error inesperado (revisa la consola)" };
    }
  } catch (err: any) {
    console.error('Sales history fetch error:', err);
    return { ok: false, message: err.message };
  }
}
