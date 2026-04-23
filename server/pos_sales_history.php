<?php
/**
 * Endpoint: pos_sales_history.php
 *
 * Función:
 * - Devuelve el historial de ventas paginado/filtrado.
 * - Si se pasa un `sale_id`, devuelve el detalle de esa venta (incluyendo productos).
 *
 * SUBIR A: api/admin/sales/pos_sales_history.php en Hostinger
 */

error_reporting(0);
ini_set('display_errors', 0);

require_once __DIR__ . '/../../_admin_common.php';

adminHandleCors(['GET']);
adminRequireMethod('GET');

if (!function_exists('adminTableExists')) {
  function adminTableExists($pdo, $tableName) {
    try {
      $result = $pdo->query("SELECT 1 FROM {$tableName} LIMIT 1");
      return $result !== false;
    } catch (Exception $e) {
      return false;
    }
  }
}

try {
  $pdo = adminGetPdo();
  $adminId = adminRequireSession($pdo);

  // 1. AUTO-CREACIÓN DE TABLAS (Para que no tengas que entrar a la BD manualmente)
  $pdo->exec("
    CREATE TABLE IF NOT EXISTS pos_sales (
      id INT AUTO_INCREMENT PRIMARY KEY,
      admin_user_id INT NOT NULL,
      payment_method ENUM('cash','card','transfer') NOT NULL,
      subtotal DECIMAL(10,2) NOT NULL,
      total DECIMAL(10,2) NOT NULL,
      cash_received DECIMAL(10,2) NULL,
      change_amount DECIMAL(10,2) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_pos_sales_admin (admin_user_id),
      INDEX idx_pos_sales_date (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

    CREATE TABLE IF NOT EXISTS pos_sale_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      pos_sale_id INT NOT NULL,
      product_id INT NOT NULL,
      product_name VARCHAR(200) NOT NULL,
      quantity INT NOT NULL,
      unit_price DECIMAL(10,2) NOT NULL,
      total_price DECIMAL(10,2) NOT NULL,
      INDEX idx_pos_sale_items_sale (pos_sale_id),
      INDEX idx_pos_sale_items_product (product_id),
      CONSTRAINT fk_history_sale_items_sale FOREIGN KEY (pos_sale_id)
        REFERENCES pos_sales(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  ");

  $saleId = isset($_GET['sale_id']) ? (int)$_GET['sale_id'] : 0;

  if ($saleId > 0) {
    // 1. Obtener detalles de UNA venta específica
    $stmtSale = $pdo->prepare("
      SELECT 
        ps.id, 
        ps.admin_user_id, 
        ps.payment_method, 
        ps.subtotal, 
        ps.total, 
        ps.cash_received, 
        ps.change_amount, 
        ps.created_at
      FROM pos_sales ps
      WHERE ps.id = :sale_id
    ");
    $stmtSale->execute(['sale_id' => $saleId]);
    $sale = $stmtSale->fetch(PDO::FETCH_ASSOC);

    if (!$sale) {
      adminJsonResponse(404, ['ok' => false, 'message' => 'Venta no encontrada']);
    }

    $stmtItems = $pdo->prepare("
      SELECT id, product_id, product_name, quantity, unit_price, total_price
      FROM pos_sale_items
      WHERE pos_sale_id = :sale_id
    ");
    $stmtItems->execute(['sale_id' => $saleId]);
    $items = $stmtItems->fetchAll(PDO::FETCH_ASSOC);

    $sale['items'] = $items;

    adminJsonResponse(200, ['ok' => true, 'sale' => $sale]);

  } else {
    // 2. Obtener lista de ventas (con filtros opcionales)
    $dateStart = $_GET['date_start'] ?? null;
    $dateEnd = $_GET['date_end'] ?? null;
    $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 50;

    $query = "
      SELECT 
        ps.id, 
        ps.admin_user_id as cashier_name,
        ps.payment_method, 
        ps.total, 
        ps.created_at
      FROM pos_sales ps
      WHERE 1=1
    ";
    
    $params = [];

    if ($dateStart) {
      $query .= " AND ps.created_at >= :date_start";
      $params['date_start'] = $dateStart . ' 00:00:00';
    }
    
    if ($dateEnd) {
      $query .= " AND ps.created_at <= :date_end";
      $params['date_end'] = $dateEnd . ' 23:59:59';
    }

    $query .= " ORDER BY ps.created_at DESC LIMIT :limit";

    $stmt = $pdo->prepare($query);
    foreach ($params as $key => $val) {
      $stmt->bindValue($key, $val);
    }
    $stmt->bindValue('limit', $limit, PDO::PARAM_INT);
    $stmt->execute();

    $sales = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Sumario del rango
    $summaryQuery = "SELECT COALESCE(SUM(total), 0) as total_revenue, COUNT(id) as total_orders FROM pos_sales WHERE 1=1";
    if ($dateStart) $summaryQuery .= " AND created_at >= :date_start";
    if ($dateEnd)   $summaryQuery .= " AND created_at <= :date_end";
    
    $sumStmt = $pdo->prepare($summaryQuery);
    foreach ($params as $key => $val) {
      $sumStmt->bindValue($key, $val);
    }
    $sumStmt->execute();
    $summary = $sumStmt->fetch(PDO::FETCH_ASSOC);

    adminJsonResponse(200, [
      'ok' => true, 
      'sales' => $sales,
      'summary' => [
        'total_revenue' => (float)$summary['total_revenue'],
        'total_orders' => (int)$summary['total_orders']
      ]
    ]);
  }

} catch (PDOException $e) {
  error_log('pos_sales_history.php DB error: ' . $e->getMessage());
  adminJsonResponse(500, ['ok' => false, 'message' => 'Error al consultar la base de datos']);
} catch (Throwable $e) {
  error_log('pos_sales_history.php fatal error: ' . $e->getMessage());
  adminJsonResponse(500, ['ok' => false, 'message' => 'Error interno del servidor']);
}
