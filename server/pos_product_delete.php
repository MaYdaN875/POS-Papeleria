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

    // Intentar HARD DELETE primero
    try {
        // Borrar barras
        try {
            $pdo->prepare('DELETE FROM product_barcodes WHERE product_id = ?')->execute([$productId]);
        } catch (Throwable $e) {}

        // Borrar producto físicamente
        $stmt = $pdo->prepare('DELETE FROM products WHERE id = ?');
        $stmt->execute([$productId]);

        adminJsonResponse(200, ['ok' => true, 'message' => 'Producto eliminado definitivamente de la base de datos']);
    } catch (PDOException $e) {
        // Si hay error de foreign key (ya tiene ventas previas), hacer SOFT DELETE
        if (strpos($e->getMessage(), 'foreign key') !== false || $e->getCode() === '23000') {
            
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
                adminJsonResponse(200, ['ok' => true, 'message' => 'Producto marcado como Inactivo (no se borró totalmente porque tiene ventas en el historial)']);
            } elseif (in_array('deleted_at', $cols, true)) {
                $stmt = $pdo->prepare('UPDATE products SET deleted_at = NOW() WHERE id = ?');
                $stmt->execute([$productId]);
                adminJsonResponse(200, ['ok' => true, 'message' => 'Producto marcado como Inactivo (no se borró totalmente porque tiene ventas en el historial)']);
            } else {
                adminJsonResponse(409, ['ok' => false, 'message' => 'No se puede borrar físicamente porque tiene ventas registradas, y tu tabla no soporta inactivos.']);
            }
        } else {
            // Otro error de base de datos
            error_log('pos_product_delete.php DB error: ' . $e->getMessage());
            adminJsonResponse(500, ['ok' => false, 'message' => 'Error de base de datos']);
        }
    }
} catch (Throwable $e) {
    error_log('pos_product_delete.php error: ' . $e->getMessage());
    adminJsonResponse(500, ['ok' => false, 'message' => $e->getMessage()]);
}
