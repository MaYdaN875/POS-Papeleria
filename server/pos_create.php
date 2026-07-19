<?php
/**
 * Endpoint: pos_create.php
 *
 * Función:
 * - Registra una venta del POS (punto de venta físico).
 * - Descuenta stock de la tabla products.
 * - Guarda en pos_sales y pos_sale_items.
 *
 * SUBIR A: api/admin/sales/pos_create.php en Hostinger
 */

require_once __DIR__ . '/../../_admin_common.php';

adminHandleCors(['POST']);
adminRequireMethod('POST');

try {
  $pdo = adminGetPdo();

  $rawBody = file_get_contents('php://input') ?: '';
  $data = json_decode($rawBody, true);
  if (!is_array($data)) {
    $data = [];
  }

  // Token: del cuerpo JSON (Hostinger pierde el header Authorization) o del header
  $token = '';
  if (!empty($data['access_token'])) {
    $token = trim((string)$data['access_token']);
  }

  if ($token === '') {
    $headers = function_exists('getallheaders') ? getallheaders() : [];
    $auth = $headers['Authorization'] ?? $headers['authorization'] ?? ($_SERVER['HTTP_AUTHORIZATION'] ?? '');
    $token = preg_replace('/^Bearer\s+/i', '', trim($auth));
  }

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

  // El login de la web puede guardar el token directo o hasheado
  $candidates = array_values(array_unique([
    $token,
    hash('sha256', $token),
    hash('sha256', 'pos:' . $token),
  ]));

  $sessionData = false;
  foreach ($colsToTry as $tokenCol) {
    foreach ($candidates as $candidate) {
      $sessionStmt = $pdo->prepare("SELECT admin_user_id FROM admin_sessions WHERE {$tokenCol} = ? AND expires_at > NOW() LIMIT 1");
      $sessionStmt->execute([$candidate]);
      $sessionData = $sessionStmt->fetch(PDO::FETCH_ASSOC);
      if ($sessionData) {
        break 2;
      }
    }
  }

  if (!$sessionData) {
    adminJsonResponse(401, ['ok' => false, 'message' => 'Sesión inválida o expirada']);
  }

  $adminId = (int)$sessionData['admin_user_id'];

  if ($adminId === 0) {
    adminJsonResponse(400, ['ok' => false, 'message' => 'No se pudo identificar al usuario de la sesión.']);
  }

  // Validar datos requeridos
  $items = $data['items'] ?? [];
  $paymentMethod = $data['payment_method'] ?? '';
  $subtotal = (float)($data['subtotal'] ?? 0);
  $total = (float)($data['total'] ?? 0);
  $cashReceived = isset($data['cash_received']) ? (float)$data['cash_received'] : null;
  $changeAmount = isset($data['change_amount']) ? (float)$data['change_amount'] : null;

  if (empty($items)) {
    adminJsonResponse(400, ['ok' => false, 'message' => 'El carrito está vacío']);
  }

  if (!in_array($paymentMethod, ['cash', 'card', 'transfer'], true)) {
    adminJsonResponse(400, ['ok' => false, 'message' => 'Método de pago inválido']);
  }

  if ($total <= 0) {
    adminJsonResponse(400, ['ok' => false, 'message' => 'El total debe ser mayor a 0']);
  }

  // Iniciar transacción
  $pdo->beginTransaction();

  try {
    // 1. Crear registro en pos_sales
    $stmt = $pdo->prepare('
      INSERT INTO pos_sales (admin_user_id, payment_method, subtotal, total, cash_received, change_amount)
      VALUES (:admin_id, :payment_method, :subtotal, :total, :cash_received, :change_amount)
    ');
    $stmt->execute([
      'admin_id'       => $adminId,
      'payment_method' => $paymentMethod,
      'subtotal'       => $subtotal,
      'total'          => $total,
      'cash_received'  => $cashReceived,
      'change_amount'  => $changeAmount,
    ]);

    $saleId = (int)$pdo->lastInsertId();

    // 2. Insertar items y descontar stock
    $saleItemCols = $pdo->query('SHOW COLUMNS FROM pos_sale_items')->fetchAll(PDO::FETCH_COLUMN);
    $hasPresCols = in_array('presentation_id', $saleItemCols, true);

    if ($hasPresCols) {
      $insertItemStmt = $pdo->prepare('
        INSERT INTO pos_sale_items (pos_sale_id, product_id, product_name, quantity, unit_price, total_price, presentation_id, presentation_name, units_per_sale, inventory_units)
        VALUES (:sale_id, :product_id, :product_name, :quantity, :unit_price, :total_price, :presentation_id, :presentation_name, :units_per_sale, :inventory_units)
      ');
    } else {
      $insertItemStmt = $pdo->prepare('
        INSERT INTO pos_sale_items (pos_sale_id, product_id, product_name, quantity, unit_price, total_price)
        VALUES (:sale_id, :product_id, :product_name, :quantity, :unit_price, :total_price)
      ');
    }

    // Descontar stock en todas las columnas que existan
    $productCols = $pdo->query('SHOW COLUMNS FROM products')->fetchAll(PDO::FETCH_COLUMN);
    $hasStock = in_array('stock', $productCols, true);
    $hasStockQty = in_array('stock_quantity', $productCols, true);

    $stockSets = [];
    if ($hasStock) $stockSets[] = 'stock = GREATEST(COALESCE(stock, 0) - :qty, 0)';
    if ($hasStockQty) $stockSets[] = 'stock_quantity = GREATEST(COALESCE(stock_quantity, 0) - :qty, 0)';

    $updateStockStmt = null;
    if (!empty($stockSets)) {
      $updateStockStmt = $pdo->prepare(
        'UPDATE products SET ' . implode(', ', $stockSets) . ' WHERE id = :product_id'
      );
    }

    foreach ($items as $item) {
      $productId = (int)($item['product_id'] ?? 0);
      $productName = (string)($item['product_name'] ?? 'Producto');
      $quantity = (int)($item['quantity'] ?? 0);
      $unitPrice = (float)($item['unit_price'] ?? 0);

      if ($productId <= 0 || $quantity <= 0) continue;

      $presentationId = isset($item['presentation_id']) ? (int)$item['presentation_id'] : null;
      $presentationName = isset($item['presentation_name']) ? (string)$item['presentation_name'] : null;
      $unitsPerSale = isset($item['units_per_sale']) ? (float)$item['units_per_sale'] : 1.000;
      
      // Recalcular unidades de inventario de forma segura en el servidor
      $inventoryUnits = $quantity * $unitsPerSale;

      $bindParams = [
        'sale_id'      => $saleId,
        'product_id'   => $productId,
        'product_name' => $productName,
        'quantity'     => $quantity,
        'unit_price'   => $unitPrice,
        'total_price'  => $unitPrice * $quantity,
      ];

      if ($hasPresCols) {
        $bindParams['presentation_id'] = $presentationId;
        $bindParams['presentation_name'] = $presentationName;
        $bindParams['units_per_sale'] = $unitsPerSale;
        $bindParams['inventory_units'] = $inventoryUnits;
      }

      $insertItemStmt->execute($bindParams);

      // Obtener stock previo para bitácora
      $prevStock = 0.0;
      try {
        $stockQuery = $pdo->prepare('SELECT stock FROM products WHERE id = ?');
        $stockQuery->execute([$productId]);
        $prevStock = (float)$stockQuery->fetchColumn();
      } catch (Throwable $e) {}

      $newStock = max(0.0, $prevStock - $inventoryUnits);

      // Descontar stock del producto usando $inventoryUnits en lugar de $quantity
      if ($updateStockStmt) {
        $updateStockStmt->execute([
          'qty'        => $inventoryUnits,
          'product_id' => $productId,
        ]);
      }

      // Registrar en la bitácora pos_inventory_transactions
      if (adminTableExists($pdo, 'pos_inventory_transactions')) {
        try {
          $stmtTrans = $pdo->prepare('
              INSERT INTO pos_inventory_transactions (product_id, admin_user_id, transaction_type, quantity, previous_stock, new_stock, notes)
              VALUES (?, ?, \'sale\', ?, ?, ?, ?)
          ');
          $stmtTrans->execute([
              $productId,
              $adminId,
              -$inventoryUnits,
              $prevStock,
              $newStock,
              "Venta POS. Venta de la presentación: " . ($presentationName ?: 'Pieza/Unidad') . " (Venta #" . $saleId . ")"
          ]);
        } catch (Throwable $e) {
          // Ignorar fallos menores de bitácora
        }
      }
    }

    $pdo->commit();

    adminJsonResponse(200, [
      'ok'      => true,
      'sale_id' => $saleId,
      'total'   => $total,
      'message' => 'Venta registrada exitosamente',
    ]);

  } catch (Throwable $e) {
    $pdo->rollBack();
    throw $e;
  }

} catch (PDOException $e) {
  error_log('pos_create.php DB error: ' . $e->getMessage());
  adminJsonResponse(500, ['ok' => false, 'message' => 'DB Error: ' . $e->getMessage()]);
} catch (Throwable $e) {
  error_log('pos_create.php fatal error: ' . $e->getMessage());
  adminJsonResponse(500, ['ok' => false, 'message' => 'Fatal Error: ' . $e->getMessage()]);
}
