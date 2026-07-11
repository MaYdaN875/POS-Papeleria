<?php
/**
 * Endpoint: pos_suppliers.php
 * Gestiona el catálogo de proveedores y la relación producto-proveedor.
 *
 * SUBIR A: api/admin/sales/pos_suppliers.php en Hostinger
 */

error_reporting(0);
ini_set('display_errors', 0);

require_once __DIR__ . '/../../_admin_common.php';

// Habilitar CORS para métodos estándar
adminHandleCors(['GET', 'POST', 'OPTIONS']);
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

try {
    $pdo = adminGetPdo();

    // 1. Resolver token de sesión (desde GET, POST, JSON Body o Headers)
    $token = '';
    if (!empty($_GET['access_token'])) {
        $token = trim((string)$_GET['access_token']);
    } elseif (!empty($_POST['access_token'])) {
        $token = trim((string)$_POST['access_token']);
    }
    if ($token === '') {
        $jsonBodyAuth = json_decode(file_get_contents('php://input') ?: '', true);
        if (is_array($jsonBodyAuth) && !empty($jsonBodyAuth['access_token'])) {
            $token = trim((string)$jsonBodyAuth['access_token']);
        }
    }
    if ($token === '') {
        $headersAuth = function_exists('getallheaders') ? getallheaders() : [];
        $auth = $headersAuth['Authorization'] ?? $headersAuth['authorization'] ?? ($_SERVER['HTTP_AUTHORIZATION'] ?? '');
        $token = preg_replace('/^Bearer\s+/i', '', trim($auth));
    }

    if ($token === '') {
        adminJsonResponse(401, ['ok' => false, 'message' => 'Sesión inválida o expirada']);
    }

    // 2. Validar sesión
    $sessionCols = $pdo->query('SHOW COLUMNS FROM admin_sessions')->fetchAll(PDO::FETCH_COLUMN);
    $colsToTry = [];
    if (in_array('token_hash', $sessionCols, true)) $colsToTry[] = 'token_hash';
    if (in_array('token', $sessionCols, true)) $colsToTry[] = 'token';

    $candidates = array_values(array_unique([$token, hash('sha256', $token), hash('sha256', 'pos:' . $token)]));
    $sessionData = false;
    foreach ($colsToTry as $col) {
        foreach ($candidates as $candidate) {
            $stmt = $pdo->prepare("SELECT admin_user_id FROM admin_sessions WHERE {$col} = ? AND expires_at > NOW() LIMIT 1");
            $stmt->execute([$candidate]);
            $sessionData = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($sessionData) break 2;
        }
    }

    if (!$sessionData) {
        adminJsonResponse(401, ['ok' => false, 'message' => 'Sesión inválida o expirada']);
    }

    $adminId = (int)$sessionData['admin_user_id'];

    // 3. Validar rol de administrador
    $userStmt = $pdo->prepare("SELECT role FROM admin_users WHERE id = ? LIMIT 1");
    $userStmt->execute([$adminId]);
    $userRole = strtolower((string)$userStmt->fetchColumn());

    if ($userRole !== 'admin') {
        adminJsonResponse(403, ['ok' => false, 'message' => 'Acceso denegado. Se requieren permisos de administrador.']);
    }

    $method = $_SERVER['REQUEST_METHOD'];

    // === MANEJO DE PETICIONES GET ===
    if ($method === 'GET') {
        $action = $_GET['action'] ?? 'list';

        if ($action === 'list') {
            // Listar todos los proveedores
            $stmt = $pdo->query("SELECT * FROM pos_suppliers ORDER BY name ASC");
            $suppliers = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
            adminJsonResponse(200, ['ok' => true, 'suppliers' => $suppliers]);

        } elseif ($action === 'products') {
            // Listar productos asociados a un proveedor
            $supplierId = isset($_GET['supplier_id']) ? (int)$_GET['supplier_id'] : 0;
            if ($supplierId <= 0) {
                adminJsonResponse(400, ['ok' => false, 'message' => 'Proveedor inválido']);
            }

            $stmt = $pdo->prepare("
                SELECT
                  ps.id AS link_id,
                  ps.product_id,
                  ps.supplier_sku,
                  ps.cost_price,
                  ps.is_primary,
                  p.name AS product_name,
                  p.stock AS product_stock,
                  p.sku AS product_sku
                FROM pos_product_suppliers ps
                INNER JOIN products p ON p.id = ps.product_id
                WHERE ps.supplier_id = ?
                ORDER BY p.name ASC
            ");
            $stmt->execute([$supplierId]);
            $products = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
            adminJsonResponse(200, ['ok' => true, 'products' => $products]);

        } elseif ($action === 'all_products') {
            // Retorna lista simplificada de todos los productos para enlazarlos
            $stmt = $pdo->query("SELECT id, name, sku, stock, price, pos_price FROM products WHERE is_active = 1 ORDER BY name ASC");
            $allProducts = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
            adminJsonResponse(200, ['ok' => true, 'products' => $allProducts]);

        } else {
            adminJsonResponse(400, ['ok' => false, 'message' => 'Acción GET no soportada']);
        }
    }

    // === MANEJO DE PETICIONES POST ===
    if ($method === 'POST') {
        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $action = $data['action'] ?? '';

        if ($action === 'create') {
            $name = trim($data['name'] ?? '');
            if ($name === '') {
                adminJsonResponse(400, ['ok' => false, 'message' => 'El nombre del proveedor es obligatorio']);
            }

            $stmt = $pdo->prepare("
                INSERT INTO pos_suppliers (name, contact_name, phone, email, address, rfc)
                VALUES (?, ?, ?, ?, ?, ?)
            ");
            $stmt->execute([
                $name,
                trim($data['contact_name'] ?? ''),
                trim($data['phone'] ?? ''),
                trim($data['email'] ?? ''),
                trim($data['address'] ?? ''),
                trim($data['rfc'] ?? '')
            ]);

            adminJsonResponse(200, ['ok' => true, 'message' => 'Proveedor registrado con éxito', 'id' => $pdo->lastInsertId()]);

        } elseif ($action === 'update') {
            $id = isset($data['id']) ? (int)$data['id'] : 0;
            $name = trim($data['name'] ?? '');

            if ($id <= 0 || $name === '') {
                adminJsonResponse(400, ['ok' => false, 'message' => 'ID de proveedor o nombre inválidos']);
            }

            $stmt = $pdo->prepare("
                UPDATE pos_suppliers
                SET name = ?, contact_name = ?, phone = ?, email = ?, address = ?, rfc = ?
                WHERE id = ?
            ");
            $stmt->execute([
                $name,
                trim($data['contact_name'] ?? ''),
                trim($data['phone'] ?? ''),
                trim($data['email'] ?? ''),
                trim($data['address'] ?? ''),
                trim($data['rfc'] ?? ''),
                $id
            ]);

            adminJsonResponse(200, ['ok' => true, 'message' => 'Proveedor actualizado con éxito']);

        } elseif ($action === 'delete') {
            $id = isset($data['id']) ? (int)$data['id'] : 0;
            if ($id <= 0) {
                adminJsonResponse(400, ['ok' => false, 'message' => 'ID de proveedor inválido']);
            }

            // Verificar si tiene relaciones activas (OPCIONAL: ON DELETE CASCADE se encarga del enlace producto-proveedor,
            // pero para órdenes de compra podemos restringir o simplemente el FK fallará si no está en CASCADE).
            $stmt = $pdo->prepare("DELETE FROM pos_suppliers WHERE id = ?");
            $stmt->execute([$id]);

            adminJsonResponse(200, ['ok' => true, 'message' => 'Proveedor eliminado con éxito']);

        } elseif ($action === 'link_product') {
            $supplierId = isset($data['supplier_id']) ? (int)$data['supplier_id'] : 0;
            $productId = isset($data['product_id']) ? (int)$data['product_id'] : 0;
            $costPrice = isset($data['cost_price']) ? (float)$data['cost_price'] : 0.00;
            $supplierSku = trim($data['supplier_sku'] ?? '');
            $isPrimary = isset($data['is_primary']) && $data['is_primary'] ? 1 : 0;

            if ($supplierId <= 0 || $productId <= 0) {
                adminJsonResponse(400, ['ok' => false, 'message' => 'Proveedor y producto requeridos']);
            }

            $pdo->beginTransaction();
            try {
                // Si es el principal, desmarcar otros proveedores para este producto
                if ($isPrimary === 1) {
                    $stmt = $pdo->prepare("UPDATE pos_product_suppliers SET is_primary = 0 WHERE product_id = ?");
                    $stmt->execute([$productId]);
                }

                // Insertar (u omitir si ya existe, o hacer UPDATE)
                $stmt = $pdo->prepare("
                    INSERT INTO pos_product_suppliers (product_id, supplier_id, supplier_sku, cost_price, is_primary)
                    VALUES (?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE supplier_sku = VALUES(supplier_sku), cost_price = VALUES(cost_price), is_primary = VALUES(is_primary)
                ");
                $stmt->execute([$productId, $supplierId, $supplierSku, $costPrice, $isPrimary]);
                
                $pdo->commit();
                adminJsonResponse(200, ['ok' => true, 'message' => 'Producto enlazado con éxito']);
            } catch (Throwable $e) {
                $pdo->rollBack();
                adminJsonResponse(500, ['ok' => false, 'message' => 'Error al enlazar producto: ' . $e->getMessage()]);
            }

        } elseif ($action === 'unlink_product') {
            $supplierId = isset($data['supplier_id']) ? (int)$data['supplier_id'] : 0;
            $productId = isset($data['product_id']) ? (int)$data['product_id'] : 0;

            if ($supplierId <= 0 || $productId <= 0) {
                adminJsonResponse(400, ['ok' => false, 'message' => 'Proveedor y producto requeridos']);
            }

            $stmt = $pdo->prepare("DELETE FROM pos_product_suppliers WHERE supplier_id = ? AND product_id = ?");
            $stmt->execute([$supplierId, $productId]);

            adminJsonResponse(200, ['ok' => true, 'message' => 'Enlace removido con éxito']);

        } elseif ($action === 'update_link') {
            $supplierId = isset($data['supplier_id']) ? (int)$data['supplier_id'] : 0;
            $productId = isset($data['product_id']) ? (int)$data['product_id'] : 0;
            $costPrice = isset($data['cost_price']) ? (float)$data['cost_price'] : 0.00;
            $supplierSku = trim($data['supplier_sku'] ?? '');
            $isPrimary = isset($data['is_primary']) && $data['is_primary'] ? 1 : 0;

            if ($supplierId <= 0 || $productId <= 0) {
                adminJsonResponse(400, ['ok' => false, 'message' => 'Proveedor y producto requeridos']);
            }

            $pdo->beginTransaction();
            try {
                if ($isPrimary === 1) {
                    $stmt = $pdo->prepare("UPDATE pos_product_suppliers SET is_primary = 0 WHERE product_id = ?");
                    $stmt->execute([$productId]);
                }

                $stmt = $pdo->prepare("
                    UPDATE pos_product_suppliers
                    SET cost_price = ?, supplier_sku = ?, is_primary = ?
                    WHERE supplier_id = ? AND product_id = ?
                ");
                $stmt->execute([$costPrice, $supplierSku, $isPrimary, $supplierId, $productId]);

                $pdo->commit();
                adminJsonResponse(200, ['ok' => true, 'message' => 'Enlace actualizado con éxito']);
            } catch (Throwable $e) {
                $pdo->rollBack();
                adminJsonResponse(500, ['ok' => false, 'message' => 'Error al actualizar enlace: ' . $e->getMessage()]);
            }

        } else {
            adminJsonResponse(400, ['ok' => false, 'message' => 'Acción POST no soportada']);
        }
    }

} catch (PDOException $e) {
    adminJsonResponse(500, ['ok' => false, 'message' => 'Error de Base de Datos: ' . $e->getMessage()]);
} catch (Throwable $e) {
    adminJsonResponse(500, ['ok' => false, 'message' => 'Error General: ' . $e->getMessage()]);
}
