<?php
/**
 * Endpoint: pos_product_create.php
 * Crea un producto nuevo desde el inventario del POS.
 *
 * SUBIR A: api/admin/sales/pos_product_create.php en Hostinger
 */

require_once __DIR__ . '/../../_admin_common.php';
require_once __DIR__ . '/pos_auth.php';

adminHandleCors(['POST']);
adminRequireMethod('POST');

try {
    $pdo = adminGetPdo();
    posValidateSession($pdo);

    $data = posGetJsonBody();
    if ($data === []) {
        $data = adminReadJsonBody();
    }

    $name = trim((string)($data['name'] ?? ''));
    $brand = trim((string)($data['brand'] ?? ''));
    $description = trim((string)($data['description'] ?? ''));
    $webPrice = (float)($data['price'] ?? 0);
    $posPrice = isset($data['pos_price']) && $data['pos_price'] !== '' && $data['pos_price'] !== null
        ? (float)$data['pos_price']
        : null;
    $stock = (int)($data['stock'] ?? 0);
    $categoryId = (int)($data['category_id'] ?? 0);
    $image = trim((string)($data['image'] ?? '/images/boligrafos.jpg'));

    if ($name === '') {
        adminJsonResponse(400, ['ok' => false, 'message' => 'El nombre del producto es obligatorio']);
    }

    if ($webPrice < 0) {
        adminJsonResponse(400, ['ok' => false, 'message' => 'El precio web debe ser mayor o igual a 0']);
    }

    if ($stock < 0) {
        adminJsonResponse(400, ['ok' => false, 'message' => 'El stock debe ser mayor o igual a 0']);
    }

    if ($categoryId <= 0) {
        $catStmt = $pdo->query('SELECT id FROM categories ORDER BY id ASC LIMIT 1');
        $firstCat = $catStmt->fetch(PDO::FETCH_ASSOC);
        $categoryId = $firstCat ? (int)$firstCat['id'] : 1;
    }

    $cols = $pdo->query('SHOW COLUMNS FROM products')->fetchAll(PDO::FETCH_COLUMN);

    $fields = [];
    $placeholders = [];
    $params = [];

    $addField = function (string $col, $value, bool $usePlaceholder = true) use (&$fields, &$placeholders, &$params, $cols) {
        if (!in_array($col, $cols, true)) {
            return;
        }
        $fields[] = $col;
        if ($usePlaceholder) {
            $placeholders[] = ':' . $col;
            $params[$col] = $value;
        } else {
            $placeholders[] = is_numeric($value) ? (string)$value : "'" . addslashes((string)$value) . "'";
        }
    };

    $addField('name', $name);
    $addField('brand', $brand);
    $addField('description', $description);
    $addField('price', $webPrice);

    foreach (['image', 'image_url', 'img', 'photo', 'thumbnail'] as $imageCol) {
        if (in_array($imageCol, $cols, true)) {
            $addField($imageCol, $image ?: '/images/boligrafos.jpg');
            break;
        }
    }

    $addField('category_id', $categoryId);
    $addField('stock', $stock);
    $addField('stock_quantity', $stock);

    if (in_array('pos_price', $cols, true)) {
        $addField('pos_price', $posPrice !== null ? $posPrice : $webPrice);
    }

    if (in_array('is_active', $cols, true)) {
        $fields[] = 'is_active';
        $placeholders[] = '1';
    }

    if (empty($fields)) {
        adminJsonResponse(500, ['ok' => false, 'message' => 'No se encontraron columnas válidas en products']);
    }

    $sql = 'INSERT INTO products (' . implode(', ', $fields) . ') VALUES (' . implode(', ', $placeholders) . ')';
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    $productId = (int)$pdo->lastInsertId();

    $barcode = trim((string)($data['barcode'] ?? ''));
    if ($barcode !== '') {
        try {
            $pdo->prepare('INSERT INTO product_barcodes (product_id, barcode) VALUES (?, ?)')
                ->execute([$productId, $barcode]);
        } catch (Throwable $e) {
            // Tabla opcional
        }
    }

    adminJsonResponse(201, [
        'ok'         => true,
        'product_id' => $productId,
        'message'    => 'Producto creado exitosamente',
    ]);
} catch (PDOException $e) {
    error_log('pos_product_create.php DB error: ' . $e->getMessage());
    adminJsonResponse(500, ['ok' => false, 'message' => 'Error al crear producto. Revisa la base de datos.']);
} catch (Throwable $e) {
    error_log('pos_product_create.php error: ' . $e->getMessage());
    adminJsonResponse(500, ['ok' => false, 'message' => $e->getMessage()]);
}
