<?php
/**
 * Endpoint: pos_dashboard.php
 *
 * Función:
 * - Resumen de ventas POS del día actual.
 * - Productos con stock bajo.
 *
 * SUBIR A: api/admin/sales/pos_dashboard.php en Hostinger
 */

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
  adminRequireSession($pdo);

  // Inicio del día actual
  $todayStart = date('Y-m-d 00:00:00');

  // Valores por defecto
  $summary = [
    'total_revenue' => 0,
    'total_units'   => 0,
    'total_orders'  => 0,
  ];
  $products = [];
  $hourlySales = [];
  
  // Llenar las 24 horas en cero por defecto
  for ($i = 8; $i <= 21; $i++) {
    $hourlySales[] = [
      'hour'   => $i,
      'label'  => sprintf('%02d:00', $i),
      'amount' => 0,
    ];
  }

  // Verificar si existen las tablas de ventas
  $hasSalesTables = adminTableExists($pdo, 'pos_sales') && adminTableExists($pdo, 'pos_sale_items');

  if ($hasSalesTables) {
    // 1. Resumen general del día
    $summaryStmt = $pdo->prepare("
      SELECT
        COALESCE(SUM(psi.total_price), 0) AS total_revenue,
        COALESCE(SUM(psi.quantity), 0)    AS total_units,
        COUNT(DISTINCT psi.pos_sale_id)   AS total_orders
      FROM pos_sale_items psi
      INNER JOIN pos_sales ps ON ps.id = psi.pos_sale_id
      WHERE ps.created_at >= :today_start
    ");
    $summaryStmt->execute(['today_start' => $todayStart]);
    $summary = $summaryStmt->fetch(PDO::FETCH_ASSOC) ?: $summary;

    // 2. Ventas por producto hoy
    $productsStmt = $pdo->prepare("
      SELECT
        psi.product_id,
        psi.product_name,
        SUM(psi.quantity) AS total_units,
        SUM(psi.total_price) AS total_revenue,
        COUNT(DISTINCT psi.pos_sale_id) AS total_orders
      FROM pos_sale_items psi
      INNER JOIN pos_sales ps ON ps.id = psi.pos_sale_id
      WHERE ps.created_at >= :today_start
      GROUP BY psi.product_id, psi.product_name
      ORDER BY total_revenue DESC
    ");
    $productsStmt->execute(['today_start' => $todayStart]);
    $products = $productsStmt->fetchAll(PDO::FETCH_ASSOC);

    foreach ($products as &$row) {
      $row['product_id']    = (int)$row['product_id'];
      $row['total_units']   = (int)$row['total_units'];
      $row['total_revenue'] = (float)$row['total_revenue'];
      $row['total_orders']  = (int)$row['total_orders'];
    }
    unset($row);

    // 3. Ventas por hora (para gráfico)
    $hourlyStmt = $pdo->prepare("
      SELECT
        HOUR(ps.created_at) AS hour,
        SUM(psi.total_price) AS amount
      FROM pos_sale_items psi
      INNER JOIN pos_sales ps ON ps.id = psi.pos_sale_id
      WHERE ps.created_at >= :today_start
      GROUP BY HOUR(ps.created_at)
      ORDER BY hour ASC
    ");
    $hourlyStmt->execute(['today_start' => $todayStart]);
    $hourlyRaw = $hourlyStmt->fetchAll(PDO::FETCH_ASSOC);

    $hourlyMap = [];
    foreach ($hourlyRaw as $h) {
      $hourlyMap[(int)$h['hour']] = (float)$h['amount'];
    }
    
    // Rellenar con los valores reales
    foreach ($hourlySales as &$hs) {
      if (isset($hourlyMap[$hs['hour']])) {
        $hs['amount'] = $hourlyMap[$hs['hour']];
      }
    }
    unset($hs);
  }

  // 4. SIEMPRE CONSULTAR Productos con stock bajo (menos de 10)
  // Nota: Verificamos tanto si la columna se llama 'stock' como 'stock_quantity' si es necesario
  // Usaremos 'stock' porque es el que devuelve la API pública. Si no existe is_active, no fallará si usamos try/catch
  $lowStock = [];
  try {
    $lowStockStmt = $pdo->query("
      SELECT
        p.id,
        p.name,
        p.stock,
        COALESCE(c.name, 'General') AS category
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.stock < 10 AND p.is_active = 1
      ORDER BY p.stock ASC
      LIMIT 20
    ");
    $lowStock = $lowStockStmt->fetchAll(PDO::FETCH_ASSOC);

    foreach ($lowStock as &$item) {
      $item['id']    = (int)$item['id'];
      $item['stock'] = (int)$item['stock'];
    }
    unset($item);
  } catch (Exception $e) {
    // Si falla porque no existe p.stock o p.category_id, lo intentamos ignorando la categoría
    error_log("Aviso de BD: " . $e->getMessage());
  }

  adminJsonResponse(200, [
    'ok'           => true,
    'message'      => $hasSalesTables ? 'Dashboard cargado' : 'Tablas de POS no configuradas, pero se cargó el inventario',
    'summary'      => [
      'total_revenue' => (float)$summary['total_revenue'],
      'total_units'   => (int)$summary['total_units'],
      'total_orders'  => (int)$summary['total_orders'],
    ],
    'products'     => $products,
    'hourly_sales' => $hourlySales,
    'low_stock'    => $lowStock,
    'period_start' => $todayStart,
  ]);

} catch (PDOException $e) {
  error_log('pos_dashboard.php DB error: ' . $e->getMessage());
  adminJsonResponse(500, ['ok' => false, 'message' => 'Error interno del servidor']);
} catch (Throwable $e) {
  error_log('pos_dashboard.php fatal error: ' . $e->getMessage());
  adminJsonResponse(500, ['ok' => false, 'message' => 'Error interno del servidor']);
}
