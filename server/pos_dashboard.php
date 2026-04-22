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

try {
  $pdo = adminGetPdo();
  adminRequireSession($pdo);

  // Verificar que las tablas POS existen
  if (!adminTableExists($pdo, 'pos_sales') || !adminTableExists($pdo, 'pos_sale_items')) {
    adminJsonResponse(200, [
      'ok' => true,
      'message' => 'Las tablas POS aún no están configuradas.',
      'summary' => [
        'total_revenue' => 0,
        'total_units'   => 0,
        'total_orders'  => 0,
      ],
      'products'       => [],
      'low_stock'      => [],
      'hourly_sales'   => [],
      'period_start'   => null,
    ]);
  }

  // Inicio del día actual
  $todayStart = date('Y-m-d 00:00:00');

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
  $summary = $summaryStmt->fetch(PDO::FETCH_ASSOC) ?: [
    'total_revenue' => 0,
    'total_units'   => 0,
    'total_orders'  => 0,
  ];

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

  // Llenar las 24 horas
  $hourlySales = [];
  $hourlyMap = [];
  foreach ($hourlyRaw as $h) {
    $hourlyMap[(int)$h['hour']] = (float)$h['amount'];
  }
  for ($i = 8; $i <= 21; $i++) {
    $hourlySales[] = [
      'hour'   => $i,
      'label'  => sprintf('%02d:00', $i),
      'amount' => $hourlyMap[$i] ?? 0,
    ];
  }

  // 4. Productos con stock bajo (menos de 10)
  $lowStockStmt = $pdo->query("
    SELECT
      p.id,
      p.name,
      p.stock_quantity AS stock,
      COALESCE(c.name, 'General') AS category
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE p.is_active = 1 AND p.stock_quantity < 10
    ORDER BY p.stock_quantity ASC
    LIMIT 8
  ");
  $lowStock = $lowStockStmt->fetchAll(PDO::FETCH_ASSOC);

  foreach ($lowStock as &$item) {
    $item['id']    = (int)$item['id'];
    $item['stock'] = (int)$item['stock'];
  }
  unset($item);

  adminJsonResponse(200, [
    'ok'           => true,
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
