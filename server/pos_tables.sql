-- =============================================================================
-- Tablas para ventas del POS (punto de venta físico).
-- Ejecuta esto en phpMyAdmin → SQL
-- =============================================================================

-- Tabla principal de ventas POS
CREATE TABLE IF NOT EXISTS pos_sales (
  id INT AUTO_INCREMENT PRIMARY KEY,
  admin_user_id INT NOT NULL,
  payment_method ENUM('cash','card','transfer') NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  total DECIMAL(10,2) NOT NULL,
  cash_received DECIMAL(10,2) NULL,
  change_amount DECIMAL(10,2) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_pos_sales_admin (admin_user_id),
  INDEX idx_pos_sales_date (created_at),
  CONSTRAINT fk_pos_sales_admin FOREIGN KEY (admin_user_id)
    REFERENCES admin_users(id)
);

-- Detalle de cada venta POS
CREATE TABLE IF NOT EXISTS pos_sale_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  pos_sale_id INT NOT NULL,
  product_id INT NOT NULL,
  product_name VARCHAR(200) NOT NULL,
  quantity INT NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  INDEX idx_pos_sale_items_sale (pos_sale_id),
  INDEX idx_pos_sale_items_product (product_id),
  CONSTRAINT fk_pos_sale_items_sale FOREIGN KEY (pos_sale_id)
    REFERENCES pos_sales(id) ON DELETE CASCADE,
  CONSTRAINT fk_pos_sale_items_product FOREIGN KEY (product_id)
    REFERENCES products(id)
);
