<?php
/**
 * Endpoint: pos_product_create.php
 * Crea un producto nuevo desde el inventario del POS.
 *
 * SUBIR A: api/admin/sales/pos_product_create.php en Hostinger
 */

require_once __DIR__ . '/../../_admin_common.php';

adminHandleCors(['POST']);
adminRequireMethod('POST');

try {
    $pdo = adminGetPdo();

    $headers = function_exists('getallheaders') ? getallheaders() : [];
    $auth = $headers['Authorization'] ?? $headers['authorization'] ?? ($_SERVER['HTTP_AUTHORIZATION'] ?? '');
    $token = preg_replace('/^Bearer\s+/i', '', trim($auth));

    if ($token === '') {
        adminJsonResponse(401, ['ok' => false, 'message' => 'Sesión inválida o expirada']);
    }

    $sessionCols = $pdo->query('SHOW COLUMNS FROM admin_sessions')->fetchAll(PDO::FETCH_COLUMN);
    $tokenCol = in_array('token_hash', $sessionCols, true) ? 'token_hash' : 'token';

    $sessionStmt = $pdo->prepare("SELECT admin_user_id FROM admin_sessions WHERE {$tokenCol} = ? AND expires_at > NOW() LIMIT 1");
    $sessionStmt->execute([$token]);
    if (!$sessionStmt->fetch(PDO::FETCH_ASSOC)) {
        adminJsonResponse(401, ['ok' => false, 'message' => 'Sesión inválida o expirada']);
    }

    $data = adminReadJsonBody();

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
    $hasPosPrice = in_array('pos_price', $cols, true);
    $hasStockQty = in_array('stock_quantity', $cols, true);
    $hasIsActive = in_array('is_active', $cols, true);

    $fields = ['name', 'brand', 'description', 'price', 'image', 'category_id'];
    $values = [':name', ':brand', ':description', ':price', ':image', ':category_id'];
    $params = [
        'name'        => $name,
        'brand'       => $brand,
        'description' => $description,
        'price'       => $webPrice,
        'image'       => $image ?: '/images/boligrafos.jpg',
        'category_id' => $categoryId,
    ];

    if (in_array('stock', $cols, true)) {
        $fields[] = 'stock';
        $values[] = ':stock';
        $params['stock'] = $stock;
    }

    if ($hasStockQty) {
        $fields[] = 'stock_quantity';
        $values[] = ':stock_quantity';
        $params['stock_quantity'] = $stock;
    }

    if ($hasPosPrice) {
        $fields[] = 'pos_price';
        $values[] = ':pos_price';
        $params['pos_price'] = $posPrice !== null ? $posPrice : $webPrice;
    }

    if ($hasIsActive) {
        $fields[] = 'is_active';
        $values[] = '1';
    }

    $sql = 'INSERT INTO products (' . implode(', ', $fields) . ') VALUES (' . implode(', ', $values) . ')';
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
    adminJsonResponse(500, ['ok' => false, 'message' => 'DB Error: ' . $e->getMessage()]);
} catch (Throwable $e) {
    error_log('pos_product_create.php error: ' . $e->getMessage());
    adminJsonResponse(500, ['ok' => false, 'message' => $e->getMessage()]);
}
