-- =============================================================================
-- Migración para el Módulo de Proveedores y Compras
-- Ejecutar en phpMyAdmin → SQL
-- =============================================================================

-- 1. Tabla de Proveedores
CREATE TABLE IF NOT EXISTS pos_suppliers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  contact_name VARCHAR(150) NULL,
  phone VARCHAR(20) NULL,
  email VARCHAR(150) NULL,
  address TEXT NULL,
  rfc VARCHAR(13) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_suppliers_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Tabla de relación Producto - Proveedor (Muchos a Muchos)
CREATE TABLE IF NOT EXISTS pos_product_suppliers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  supplier_id INT NOT NULL,
  supplier_sku VARCHAR(100) NULL,
  cost_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  is_primary TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_product_supplier (product_id, supplier_id),
  INDEX idx_prod_supp_prod (product_id),
  INDEX idx_prod_supp_supp (supplier_id),
  CONSTRAINT fk_prod_supp_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT fk_prod_supp_supplier FOREIGN KEY (supplier_id) REFERENCES pos_suppliers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Tabla de Órdenes de Compra
CREATE TABLE IF NOT EXISTS pos_purchase_orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  supplier_id INT NOT NULL,
  admin_user_id INT NOT NULL,
  status ENUM('pending', 'partially_received', 'received', 'cancelled') NOT NULL DEFAULT 'pending',
  total_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  notes TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_purchase_orders_supplier (supplier_id),
  INDEX idx_purchase_orders_status (status),
  INDEX idx_purchase_orders_created (created_at),
  CONSTRAINT fk_purchase_orders_supplier FOREIGN KEY (supplier_id) REFERENCES pos_suppliers(id),
  CONSTRAINT fk_purchase_orders_admin FOREIGN KEY (admin_user_id) REFERENCES admin_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Detalle de artículos de la Orden de Compra
CREATE TABLE IF NOT EXISTS pos_purchase_order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  purchase_order_id INT NOT NULL,
  product_id INT NOT NULL,
  quantity_ordered INT NOT NULL,
  quantity_received INT NOT NULL DEFAULT 0,
  price_per_unit DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  INDEX idx_po_items_po (purchase_order_id),
  INDEX idx_po_items_product (product_id),
  CONSTRAINT fk_po_items_po FOREIGN KEY (purchase_order_id) REFERENCES pos_purchase_orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_po_items_product FOREIGN KEY (product_id) REFERENCES products(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Bitácora de Transacciones de Inventario para Trazabilidad
CREATE TABLE IF NOT EXISTS pos_inventory_transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  admin_user_id INT NOT NULL,
  purchase_order_id INT NULL,
  transaction_type ENUM('purchase', 'sale', 'adjustment') NOT NULL,
  quantity INT NOT NULL, -- Positivo para entradas, Negativo para salidas
  previous_stock INT NOT NULL,
  new_stock INT NOT NULL,
  notes TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_inv_trans_product (product_id),
  INDEX idx_inv_trans_user (admin_user_id),
  INDEX idx_inv_trans_type (transaction_type),
  INDEX idx_inv_trans_created (created_at),
  CONSTRAINT fk_inv_trans_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT fk_inv_trans_admin FOREIGN KEY (admin_user_id) REFERENCES admin_users(id),
  CONSTRAINT fk_inv_trans_po FOREIGN KEY (purchase_order_id) REFERENCES pos_purchase_orders(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
