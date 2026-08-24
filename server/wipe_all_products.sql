-- =============================================================================
-- BORRAR TODOS LOS PRODUCTOS (borrado físico) — Hostinger phpMyAdmin
-- Script completo: Papeleria-store\api\scripts\wipe_all_products.sql
-- =============================================================================

START TRANSACTION;

SET FOREIGN_KEY_CHECKS = 0;

DELETE FROM customer_cart_items;
DELETE FROM order_items;
DELETE FROM pos_sale_items;
DELETE FROM product_barcodes;
DELETE FROM product_images;
DELETE FROM product_offers;
DELETE FROM home_carousel_assignments;

DELETE FROM products;

SET FOREIGN_KEY_CHECKS = 1;

COMMIT;

SELECT COUNT(*) AS productos_restantes FROM products;
SELECT COUNT(*) AS categorias_intactas FROM categories;
