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
  $adminSession = adminRequireSession($pdo);
  
  // Extraemos el ID correcto del cajero.
  // IMPORTANTE: En tu sistema, 'id' es el ID de la sesión, y 'admin_user_id' es el ID del usuario real.
  $adminId = 0;
  if (is_array($adminSession)) {
      $adminId = (int)($adminSession['admin_user_id'] ?? $adminSession['id'] ?? 0);
  } else {
      $adminId = (int)$adminSession;
  }

  if ($adminId === 0) {
      adminJsonResponse(400, ['ok' => false, 'message' => 'No se pudo identificar al usuario de la sesión.']);
  }

  $data = adminReadJsonBody();

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
    $insertItemStmt = $pdo->prepare('
      INSERT INTO pos_sale_items (pos_sale_id, product_id, product_name, quantity, unit_price, total_price)
      VALUES (:sale_id, :product_id, :product_name, :quantity, :unit_price, :total_price)
    ');

    $updateStockStmt = $pdo->prepare('
      UPDATE products SET stock = GREATEST(stock - :qty, 0) WHERE id = :product_id
    ');

    foreach ($items as $item) {
      $productId = (int)($item['product_id'] ?? 0);
      $productName = (string)($item['product_name'] ?? 'Producto');
      $quantity = (int)($item['quantity'] ?? 0);
      $unitPrice = (float)($item['unit_price'] ?? 0);

      if ($productId <= 0 || $quantity <= 0) continue;

      $insertItemStmt->execute([
        'sale_id'      => $saleId,
        'product_id'   => $productId,
        'product_name' => $productName,
        'quantity'     => $quantity,
        'unit_price'   => $unitPrice,
        'total_price'  => $unitPrice * $quantity,
      ]);

      // Descontar stock del producto
      $updateStockStmt->execute([
        'qty'        => $quantity,
        'product_id' => $productId,
      ]);
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
