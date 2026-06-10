-- Migración POS: precio independiente para tienda física
-- Ejecutar en phpMyAdmin antes de subir los nuevos endpoints PHP

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS pos_price DECIMAL(10,2) NULL DEFAULT NULL
  COMMENT 'Precio exclusivo del POS; NULL = usar precio web';
