/**
 * Configuración central del POS.
 * La API es la misma que usa la tienda web de Papelería Godart en Hostinger.
 */

export const API_BASE_URL = 'https://godart-papelería.com/api';

// Endpoints existentes (de la tienda web)
export const ENDPOINTS = {
  // Auth
  LOGIN:          `${API_BASE_URL}/admin/auth/pos_login.php`,
  LOGOUT:         `${API_BASE_URL}/admin/auth/logout.php`,

  // Productos (público, sin auth)
  PRODUCTS:       `${API_BASE_URL}/public/products.php`,
  CATEGORIES:     `${API_BASE_URL}/public/categories.php`,

  // Ventas del día (admin, con auth)
  SALES_TODAY:    `${API_BASE_URL}/admin/sales/today.php`,

  // Nuevos endpoints para el POS
  POS_SALE_CREATE:   `${API_BASE_URL}/admin/sales/pos_create.php`,
  POS_DASHBOARD:     `${API_BASE_URL}/admin/sales/pos_dashboard.php`,
  POS_INVENTORY_UPDATE: `${API_BASE_URL}/admin/sales/pos_inventory_update.php`,
  POS_PRODUCT_BARCODES: `${API_BASE_URL}/admin/sales/pos_product_barcodes.php`,
  POS_CASH_CLOSE:    `${API_BASE_URL}/admin/sales/pos_cash_close.php`,
  POS_SALES_HISTORY: `${API_BASE_URL}/admin/sales/pos_sales_history.php`,
  POS_CASH_HISTORY:  `${API_BASE_URL}/admin/sales/pos_cash_history.php`,
  POS_USERS_MANAGER: `${API_BASE_URL}/admin/users/pos_users_manager.php`,
  POS_SETTINGS:      `${API_BASE_URL}/admin/sales/pos_settings.php`,
};
