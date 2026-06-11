<?php
/**
 * Endpoint: pos_product_delete.php
 * Elimina (o desactiva) un producto desde el inventario del POS.
 *
 * SUBIR A: api/admin/sales/pos_product_delete.php en Hostinger
 */

require_once __DIR__ . '/../../_admin_common.php';

adminHandleCors(['POST']);
adminRequireMethod('POST');

function posDeleteResolveToken(): string
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

function posDeleteValidateSession(PDO $pdo): void
{
    $token = posDeleteResolveToken();

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
            if ($stmt->fetch(PDO::FETCH_ASSOC)) {
                return;
            }
        }
    }

    adminJsonResponse(401, ['ok' => false, 'message' => 'Sesión inválida o expirada']);
}

try {
    $pdo = adminGetPdo();
    posDeleteValidateSession($pdo);

    $productId = isset($_POST['product_id']) ? (int)$_POST['product_id'] : 0;

    if ($productId <= 0) {
        adminJsonResponse(400, ['ok' => false, 'message' => 'ID de producto inválido']);
    }

    $check = $pdo->prepare('SELECT id FROM products WHERE id = ? LIMIT 1');
    $check->execute([$productId]);
    if (!$check->fetch(PDO::FETCH_ASSOC)) {
        adminJsonResponse(404, ['ok' => false, 'message' => 'El producto no existe']);
    }

    $cols = $pdo->query('SHOW COLUMNS FROM products')->fetchAll(PDO::FETCH_COLUMN);

    // Preferir desactivar (soft delete) para no romper ventas pasadas
    $softDeleteCol = null;
    foreach (['active', 'is_active', 'enabled', 'visible'] as $col) {
        if (in_array($col, $cols, true)) {
            $softDeleteCol = $col;
            break;
        }
    }

    if ($softDeleteCol !== null) {
        $stmt = $pdo->prepare("UPDATE products SET {$softDeleteCol} = 0 WHERE id = ?");
        $stmt->execute([$productId]);
        adminJsonResponse(200, ['ok' => true, 'message' => 'Producto eliminado del catálogo']);
    }

    if (in_array('deleted_at', $cols, true)) {
        $stmt = $pdo->prepare('UPDATE products SET deleted_at = NOW() WHERE id = ?');
        $stmt->execute([$productId]);
        adminJsonResponse(200, ['ok' => true, 'message' => 'Producto eliminado del catálogo']);
    }

    // Sin columna de soft delete: borrar definitivamente (y sus códigos de barras)
    try {
        $pdo->prepare('DELETE FROM product_barcodes WHERE product_id = ?')->execute([$productId]);
    } catch (Throwable $e) {
        // La tabla puede no existir; continuar
    }

    $stmt = $pdo->prepare('DELETE FROM products WHERE id = ?');
    $stmt->execute([$productId]);

    adminJsonResponse(200, ['ok' => true, 'message' => 'Producto eliminado']);
} catch (PDOException $e) {
    error_log('pos_product_delete.php DB error: ' . $e->getMessage());

    // Error típico: FK con ventas pasadas; no se puede borrar físico
    if (strpos($e->getMessage(), 'foreign key') !== false || $e->getCode() === '23000') {
        adminJsonResponse(409, [
            'ok' => false,
            'message' => 'No se puede borrar: el producto tiene ventas registradas.',
        ]);
    }

    adminJsonResponse(500, ['ok' => false, 'message' => 'Error de base de datos']);
} catch (Throwable $e) {
    error_log('pos_product_delete.php error: ' . $e->getMessage());
    adminJsonResponse(500, ['ok' => false, 'message' => $e->getMessage()]);
}
