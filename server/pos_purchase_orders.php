<?php
/**
 * Endpoint: pos_purchase_orders.php
 * Gestiona órdenes de compra, recepciones, historial y sugerencias.
 *
 * SUBIR A: api/admin/sales/pos_purchase_orders.php en Hostinger
 */

error_reporting(0);
ini_set('display_errors', 0);

require_once __DIR__ . '/../../_admin_common.php';

// Habilitar CORS
adminHandleCors(['GET', 'POST', 'OPTIONS']);
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

try {
    $pdo = adminGetPdo();

    // 1. Resolver token de sesión
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
            // Listar órdenes de compra activas o todas
            $stmt = $pdo->query("
                SELECT po.*, s.name AS supplier_name, u.full_name AS admin_name
                FROM pos_purchase_orders po
                INNER JOIN pos_suppliers s ON s.id = po.supplier_id
                INNER JOIN admin_users u ON u.id = po.admin_user_id
                ORDER BY po.id DESC
            ");
            $orders = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
            adminJsonResponse(200, ['ok' => true, 'orders' => $orders]);

        } elseif ($action === 'detail') {
            // Detalle de una orden de compra específica
            $id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
            if ($id <= 0) {
                adminJsonResponse(400, ['ok' => false, 'message' => 'ID de orden inválido']);
            }

            // Obtener cabecera
            $stmt = $pdo->prepare("
                SELECT po.*, s.name AS supplier_name, u.full_name AS admin_name
                FROM pos_purchase_orders po
                INNER JOIN pos_suppliers s ON s.id = po.supplier_id
                INNER JOIN admin_users u ON u.id = po.admin_user_id
                WHERE po.id = ?
                LIMIT 1
            ");
            $stmt->execute([$id]);
            $order = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$order) {
                adminJsonResponse(404, ['ok' => false, 'message' => 'Orden de compra no encontrada']);
            }

            // Obtener artículos
            $stmtItems = $pdo->prepare("
                SELECT poi.*, p.name AS product_name, p.sku AS product_sku
                FROM pos_purchase_order_items poi
                INNER JOIN products p ON p.id = poi.product_id
                WHERE poi.purchase_order_id = ?
                ORDER BY p.name ASC
            ");
            $stmtItems->execute([$id]);
            $items = $stmtItems->fetchAll(PDO::FETCH_ASSOC) ?: [];

            adminJsonResponse(200, ['ok' => true, 'order' => $order, 'items' => $items]);

        } elseif ($action === 'suggestions') {
            // Generar sugerencias de reabastecimiento por bajo stock
            // Revisa stock actual vs low_stock_threshold y busca el proveedor principal
            $stmt = $pdo->query("
                SELECT
                  p.id AS product_id,
                  p.name AS product_name,
                  p.stock AS current_stock,
                  p.low_stock_threshold,
                  p.menudeo_min_qty,
                  ps.supplier_id,
                  s.name AS supplier_name,
                  ps.cost_price,
                  ps.supplier_sku
                FROM products p
                LEFT JOIN pos_product_suppliers ps ON ps.product_id = p.id AND ps.is_primary = 1
                LEFT JOIN pos_suppliers s ON s.id = ps.supplier_id
                WHERE p.is_active = 1
                  AND p.stock <= p.low_stock_threshold
                ORDER BY p.name ASC
            ");
            $suggestions = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
            adminJsonResponse(200, ['ok' => true, 'suggestions' => $suggestions]);

        } elseif ($action === 'history') {
            // Historial de compras para un proveedor en particular
            $supplierId = isset($_GET['supplier_id']) ? (int)$_GET['supplier_id'] : 0;
            if ($supplierId <= 0) {
                adminJsonResponse(400, ['ok' => false, 'message' => 'ID de proveedor inválido']);
            }

            $stmt = $pdo->prepare("
                SELECT po.*, u.full_name AS admin_name
                FROM pos_purchase_orders po
                INNER JOIN admin_users u ON u.id = po.admin_user_id
                WHERE po.supplier_id = ?
                ORDER BY po.id DESC
            ");
            $stmt->execute([$supplierId]);
            $history = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

            // Suma del total comprado
            $stmtStats = $pdo->prepare("
                SELECT COALESCE(SUM(total_amount), 0) AS total_spent, COUNT(*) AS total_orders
                FROM pos_purchase_orders
                WHERE supplier_id = ? AND status IN ('received', 'partially_received')
            ");
            $stmtStats->execute([$supplierId]);
            $stats = $stmtStats->fetch(PDO::FETCH_ASSOC);

            adminJsonResponse(200, [
                'ok' => true,
                'history' => $history,
                'total_spent' => (float)$stats['total_spent'],
                'total_orders' => (int)$stats['total_orders']
            ]);

        } else {
            adminJsonResponse(400, ['ok' => false, 'message' => 'Acción GET no soportada']);
        }
    }

    // === MANEJO DE PETICIONES POST ===
    if ($method === 'POST') {
        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $action = $data['action'] ?? '';

        if ($action === 'create') {
            $supplierId = isset($data['supplier_id']) ? (int)$data['supplier_id'] : 0;
            $items = $data['items'] ?? [];
            $notes = trim($data['notes'] ?? '');

            if ($supplierId <= 0 || empty($items)) {
                adminJsonResponse(400, ['ok' => false, 'message' => 'Proveedor y artículos requeridos']);
            }

            $pdo->beginTransaction();
            try {
                // 1. Insertar orden de compra
                $stmtOrder = $pdo->prepare("
                    INSERT INTO pos_purchase_orders (supplier_id, admin_user_id, status, total_amount, notes)
                    VALUES (?, ?, 'pending', 0.00, ?)
                ");
                $stmtOrder->execute([$supplierId, $adminId, $notes]);
                $orderId = (int)$pdo->lastInsertId();

                // 2. Insertar artículos de la orden
                $stmtItem = $pdo->prepare("
                    INSERT INTO pos_purchase_order_items (purchase_order_id, product_id, quantity_ordered, price_per_unit, total_price)
                    VALUES (?, ?, ?, ?, ?)
                ");

                $totalAmount = 0.00;
                foreach ($items as $item) {
                    $productId = (int)($item['product_id'] ?? 0);
                    $qty = (int)($item['quantity_ordered'] ?? 0);
                    $price = (float)($item['price_per_unit'] ?? 0.00);

                    if ($productId <= 0 || $qty <= 0) {
                        continue;
                    }

                    $itemTotal = $qty * $price;
                    $totalAmount += $itemTotal;

                    $stmtItem->execute([$orderId, $productId, $qty, $price, $itemTotal]);
                }

                // 3. Actualizar monto total en la orden
                $stmtUpdateTotal = $pdo->prepare("UPDATE pos_purchase_orders SET total_amount = ? WHERE id = ?");
                $stmtUpdateTotal->execute([$totalAmount, $orderId]);

                $pdo->commit();
                adminJsonResponse(200, ['ok' => true, 'message' => 'Orden de compra creada con éxito', 'id' => $orderId]);
            } catch (Throwable $e) {
                $pdo->rollBack();
                adminJsonResponse(500, ['ok' => false, 'message' => 'Error al crear la orden de compra: ' . $e->getMessage()]);
            }

        } elseif ($action === 'receive') {
            // Confirmar recepción de mercancía (actualiza stock físico y crea bitácora)
            $orderId = isset($data['purchase_order_id']) ? (int)$data['purchase_order_id'] : 0;
            $items = $data['items'] ?? []; // Array de { product_id, quantity_received }

            if ($orderId <= 0 || empty($items)) {
                adminJsonResponse(400, ['ok' => false, 'message' => 'ID de orden y cantidades recibidas requeridos']);
            }

            // Consultar estado actual del orden
            $stmtOrderCheck = $pdo->prepare("SELECT status FROM pos_purchase_orders WHERE id = ? LIMIT 1");
            $stmtOrderCheck->execute([$orderId]);
            $currentStatus = $stmtOrderCheck->fetchColumn();

            if (!$currentStatus) {
                adminJsonResponse(404, ['ok' => false, 'message' => 'Orden de compra no encontrada']);
            }
            if ($currentStatus === 'cancelled') {
                adminJsonResponse(400, ['ok' => false, 'message' => 'No se puede recibir mercancía de una orden cancelada']);
            }

            $pdo->beginTransaction();
            try {
                // Obtener columnas de products para actualizar stock correctamente
                $productCols = $pdo->query('SHOW COLUMNS FROM products')->fetchAll(PDO::FETCH_COLUMN);
                $hasStock = in_array('stock', $productCols, true);
                $hasStockQty = in_array('stock_quantity', $productCols, true);

                foreach ($items as $item) {
                    $productId = (int)($item['product_id'] ?? 0);
                    $newReceived = (int)($item['quantity_received'] ?? 0);

                    if ($productId <= 0 || $newReceived <= 0) {
                        continue;
                    }

                    // 1. Obtener datos actuales del item en la orden
                    $stmtGetItem = $pdo->prepare("
                        SELECT id, quantity_ordered, quantity_received
                        FROM pos_purchase_order_items
                        WHERE purchase_order_id = ? AND product_id = ?
                        LIMIT 1
                    ");
                    $stmtGetItem->execute([$orderId, $productId]);
                    $orderItem = $stmtGetItem->fetch(PDO::FETCH_ASSOC);

                    if (!$orderItem) {
                        continue; // No pertenece a la orden
                    }

                    // 2. Actualizar cantidad recibida en la orden
                    $updatedReceived = (int)$orderItem['quantity_received'] + $newReceived;
                    $stmtUpdateItem = $pdo->prepare("
                        UPDATE pos_purchase_order_items
                        SET quantity_received = ?
                        WHERE id = ?
                    ");
                    $stmtUpdateItem->execute([$updatedReceived, (int)$orderItem['id']]);

                    // 3. Obtener stock actual antes de actualizar para la trazabilidad
                    $stmtStock = $pdo->prepare("SELECT stock FROM products WHERE id = ? LIMIT 1");
                    $stmtStock->execute([$productId]);
                    $previousStock = (int)$stmtStock->fetchColumn();

                    $newStock = $previousStock + $newReceived;

                    // 4. Actualizar stock físico en products
                    $stockSets = [];
                    $stockParams = [$newStock, $productId];
                    if ($hasStock) $stockSets[] = 'stock = ?';
                    if ($hasStockQty) $stockSets[] = 'stock_quantity = ?';

                    if (!empty($stockSets)) {
                        $stmtUpdateStock = $pdo->prepare(
                            "UPDATE products SET " . implode(', ', $stockSets) . " WHERE id = ?"
                        );
                        $stmtUpdateStock->execute($stockParams);
                    }

                    // 5. Registrar la transacción en pos_inventory_transactions para trazabilidad completa
                    $stmtLog = $pdo->prepare("
                        INSERT INTO pos_inventory_transactions (product_id, admin_user_id, purchase_order_id, transaction_type, quantity, previous_stock, new_stock, notes)
                        VALUES (?, ?, ?, 'purchase', ?, ?, ?, ?)
                    ");
                    $notes = "Recepción de mercancía en orden de compra #$orderId";
                    $stmtLog->execute([
                        $productId,
                        $adminId,
                        $orderId,
                        $newReceived,
                        $previousStock,
                        $newStock,
                        $notes
                    ]);
                }

                // 6. Recalcular estado de la orden
                $stmtAllItems = $pdo->prepare("
                    SELECT quantity_ordered, quantity_received
                    FROM pos_purchase_order_items
                    WHERE purchase_order_id = ?
                ");
                $stmtAllItems->execute([$orderId]);
                $allItems = $stmtAllItems->fetchAll(PDO::FETCH_ASSOC);

                $allReceived = true;
                $anyReceived = false;

                foreach ($allItems as $it) {
                    $ordered = (int)$it['quantity_ordered'];
                    $received = (int)$it['quantity_received'];

                    if ($received < $ordered) {
                        $allReceived = false;
                    }
                    if ($received > 0) {
                        $anyReceived = true;
                    }
                }

                $newStatus = 'pending';
                if ($allReceived) {
                    $newStatus = 'received';
                } elseif ($anyReceived) {
                    $newStatus = 'partially_received';
                }

                $stmtUpdateStatus = $pdo->prepare("UPDATE pos_purchase_orders SET status = ? WHERE id = ?");
                $stmtUpdateStatus->execute([$newStatus, $orderId]);

                $pdo->commit();
                adminJsonResponse(200, ['ok' => true, 'message' => 'Mercancía recibida e inventario actualizado']);
            } catch (Throwable $e) {
                $pdo->rollBack();
                adminJsonResponse(500, ['ok' => false, 'message' => 'Error al procesar la recepción: ' . $e->getMessage()]);
            }

        } elseif ($action === 'cancel') {
            $id = isset($data['id']) ? (int)$data['id'] : 0;
            if ($id <= 0) {
                adminJsonResponse(400, ['ok' => false, 'message' => 'ID de orden inválido']);
            }

            // Solo permitir cancelar si está pendiente o parcial
            $stmtCheck = $pdo->prepare("SELECT status FROM pos_purchase_orders WHERE id = ? LIMIT 1");
            $stmtCheck->execute([$id]);
            $status = $stmtCheck->fetchColumn();

            if (!$status) {
                adminJsonResponse(404, ['ok' => false, 'message' => 'Orden de compra no encontrada']);
            }
            if ($status === 'received' || $status === 'cancelled') {
                adminJsonResponse(400, ['ok' => false, 'message' => "No se puede cancelar una orden en estado: $status"]);
            }

            $stmtCancel = $pdo->prepare("UPDATE pos_purchase_orders SET status = 'cancelled' WHERE id = ?");
            $stmtCancel->execute([$id]);

            adminJsonResponse(200, ['ok' => true, 'message' => 'Orden de compra cancelada con éxito']);

        } else {
            adminJsonResponse(400, ['ok' => false, 'message' => 'Acción POST no soportada']);
        }
    }

} catch (PDOException $e) {
    adminJsonResponse(500, ['ok' => false, 'message' => 'Error de Base de Datos: ' . $e->getMessage()]);
} catch (Throwable $e) {
    adminJsonResponse(500, ['ok' => false, 'message' => 'Error General: ' . $e->getMessage()]);
}
