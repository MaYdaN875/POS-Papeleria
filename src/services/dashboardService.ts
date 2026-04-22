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
