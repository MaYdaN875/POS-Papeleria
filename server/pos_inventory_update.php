<?php
/**
 * POS Inventory Update Endpoint
 * Actualiza precio POS (sin tocar precio web) y stock.
 *
 * SUBIR A: api/admin/sales/pos_inventory_update.php en Hostinger
 */

require_once __DIR__ . '/../../_admin_common.php';

adminHandleCors(['POST']);
adminRequireMethod('POST');

function posInventoryResolveToken(): string
{
    if (!empty($_POST['access_token'])) {
        return trim((string)$_POST['access_token']);
    }

    $auth = $_SERVER['HTTP_AUTHORIZATION']
        ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION']
        ?? '';

    if ($auth === '' && function_exists('getallheaders')) {
        $headers = getallheaders();
        $auth = $headers['Authorization'] ?? $headers['authorization'] ?? '';
    }

    return preg_replace('/^Bearer\s+/i', '', trim($auth));
}

function posInventoryValidateSession(PDO $pdo): void
{
    $token = posInventoryResolveToken();

    if ($token === '') {
        adminJsonResponse(401, ['ok' => false, 'message' => 'Sesión inválida o expirada']);
    }

    $sessionCols = $pdo->query('SHOW COLUMNS FROM admin_sessions')->fetchAll(PDO::FETCH_COLUMN);
    $colsToTry = [];

    if (in_array('token_hash', $sessionCols, true)) {
        $colsToTry[] = 'token_hash';
    }
    if (in_array('token', $sessionCols, true)) {
        $colsToTry[] = 'token';
    }

    $candidates = array_values(array_unique([
        $token,
        hash('sha256', $token),
        hash('sha256', 'pos:' . $token),
    ]));

    foreach ($colsToTry as $col) {
        foreach ($candidates as $candidate) {
            $stmt = $pdo->prepare(
                "SELECT admin_user_id FROM admin_sessions WHERE {$col} = ? AND expires_at > NOW() LIMIT 1"
            );
            $stmt->execute([$candidate]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($row) {
                return;
            }
        }
    }

    adminJsonResponse(401, ['ok' => false, 'message' => 'Sesión inválida o expirada']);
}

try {
    $pdo = adminGetPdo();
    posInventoryValidateSession($pdo);

    $productId = isset($_POST['product_id']) ? (int)$_POST['product_id'] : 0;
    $newPosPrice = isset($_POST['pos_price']) ? (float)$_POST['pos_price'] : -1;
    $newStock = isset($_POST['stock']) ? (int)$_POST['stock'] : -1;

    if ($newPosPrice < 0 && isset($_POST['price'])) {
        $newPosPrice = (float)$_POST['price'];
    }

    if ($productId <= 0 || $newPosPrice < 0 || $newStock < 0) {
        adminJsonResponse(400, ['ok' => false, 'message' => 'Datos inválidos']);
    }

    $cols = $pdo->query('SHOW COLUMNS FROM products')->fetchAll(PDO::FETCH_COLUMN);
    $hasPosPrice = in_array('pos_price', $cols, true);

    // Crear la columna pos_price si no existe (evita pisar el precio web)
    if (!$hasPosPrice) {
        try {
            $pdo->exec('ALTER TABLE products ADD COLUMN pos_price DECIMAL(10,2) NULL DEFAULT NULL');
            $hasPosPrice = true;
        } catch (Throwable $e) {
            error_log('pos_inventory_update.php: no se pudo crear pos_price: ' . $e->getMessage());
        }
    }

    $hasStock = in_array('stock', $cols, true);
    $hasStockQty = in_array('stock_quantity', $cols, true);

    $sets = [];
    $params = [];

    if ($hasPosPrice) {
        $sets[] = 'pos_price = ?';
        $params[] = $newPosPrice;
    } elseif (in_array('price', $cols, true)) {
        $sets[] = 'price = ?';
        $params[] = $newPosPrice;
    }

    if ($hasStock) {
        $sets[] = 'stock = ?';
        $params[] = $newStock;
    }

    if ($hasStockQty) {
        $sets[] = 'stock_quantity = ?';
        $params[] = $newStock;
    }

    $baseUnit = isset($_POST['base_unit']) ? trim((string)$_POST['base_unit']) : '';
    if ($baseUnit !== '' && in_array('base_unit', $cols, true)) {
        $sets[] = 'base_unit = ?';
        $params[] = $baseUnit;
    }

    if (empty($sets)) {
        adminJsonResponse(500, ['ok' => false, 'message' => 'No se encontraron columnas actualizables']);
    }

    $params[] = $productId;
    $sql = 'UPDATE products SET ' . implode(', ', $sets) . ' WHERE id = ?';
    $stmt = $pdo->prepare($sql);

    if ($stmt->execute($params)) {
        adminJsonResponse(200, ['ok' => true, 'message' => 'Producto actualizado']);
    }

    adminJsonResponse(500, ['ok' => false, 'message' => 'Error al ejecutar la actualización']);
} catch (PDOException $e) {
    error_log('pos_inventory_update.php DB error: ' . $e->getMessage());
    adminJsonResponse(500, ['ok' => false, 'message' => 'Error de base de datos']);
} catch (Throwable $e) {
    error_log('pos_inventory_update.php error: ' . $e->getMessage());
    adminJsonResponse(500, ['ok' => false, 'message' => $e->getMessage()]);
}
