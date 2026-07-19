-- =============================================================================
-- Migración para Sistema de Presentaciones con Inventario Base
-- Ejecutar en phpMyAdmin → SQL en Hostinger
-- =============================================================================

-- 1. Agregar columna base_unit a products si no existe
ALTER TABLE products ADD COLUMN IF NOT EXISTS base_unit VARCHAR(50) DEFAULT 'pieza';

-- 2. Crear tabla de presentaciones de producto
CREATE TABLE IF NOT EXISTS pos_product_presentations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  barcode VARCHAR(100) NULL,
  units_per_sale DECIMAL(12,3) NOT NULL DEFAULT 1.000,
  sale_price DECIMAL(10,2) NOT NULL,
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_presentation_barcode (barcode),
  INDEX idx_presentation_product (product_id),
  CONSTRAINT fk_presentation_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Crear una presentación default inicial para todos los productos existentes:
--    Se toma el primer código de barras registrado de cada producto, y su precio pos/web.
INSERT INTO pos_product_presentations (product_id, name, barcode, units_per_sale, sale_price, is_default, is_active)
SELECT 
  p.id, 
  'Pieza', 
  (SELECT barcode FROM product_barcodes WHERE product_id = p.id LIMIT 1), 
  1.000, 
  COALESCE(p.pos_price, p.price), 
  1, 
  1
FROM products p
ON DUPLICATE KEY UPDATE barcode = VALUES(barcode);

-- 4. Modificar la tabla pos_sale_items para guardar qué presentación se vendió
ALTER TABLE pos_sale_items
  ADD COLUMN IF NOT EXISTS presentation_id INT NULL,
  ADD COLUMN IF NOT EXISTS presentation_name VARCHAR(100) NULL,
  ADD COLUMN IF NOT EXISTS units_per_sale DECIMAL(12,3) NOT NULL DEFAULT 1.000,
  ADD COLUMN IF NOT EXISTS inventory_units DECIMAL(12,3) NOT NULL DEFAULT 1.000;
