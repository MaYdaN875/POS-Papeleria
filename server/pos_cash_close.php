<?php
/**
 * POS Cash Close Endpoint
 * Registra el corte de caja al final del turno.
 *
 * SUBIR A: api/admin/sales/pos_cash_close.php en Hostinger
 */

require_once __DIR__ . '/../../_admin_common.php';

adminHandleCors(['POST']);
adminRequireMethod('POST');

try {
  $pdo = adminGetPdo();
  $adminSession = adminRequireSession($pdo);
  
  $adminId = 0;
  if (is_array($adminSession)) {
      $adminId = (int)($adminSession['admin_user_id'] ?? $adminSession['id'] ?? 0);
  } else {
      $adminId = (int)$adminSession;
  }

  if ($adminId === 0) {
      adminJsonResponse(400, ['ok' => false, 'message' => 'No se pudo identificar al usuario de la sesión.']);
  }

  // Obtener nombre del cajero
  $stmtUser = $pdo->prepare("SELECT full_name FROM admin_users WHERE id = ?");
  $stmtUser->execute([$adminId]);
  $cashierName = $stmtUser->fetchColumn() ?: ('Admin ID ' . $adminId);

  // Leer cuerpo JSON
  $data = adminReadJsonBody();

  // Crear tabla si no existe (para asegurar compatibilidad)
  $pdo->query("
  CREATE TABLE IF NOT EXISTS pos_cash_sessions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      cashier_name VARCHAR(100),
      expected_cash DECIMAL(10,2),
      expected_card DECIMAL(10,2),
      counted_cash DECIMAL(10,2),
      counted_card DECIMAL(10,2),
      difference DECIMAL(10,2),
      status ENUM('ok', 'faltante', 'sobrante'),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  ");

  $expected_cash = isset($data['expected_cash']) ? floatval($data['expected_cash']) : 0;
  $expected_card = isset($data['expected_card']) ? floatval($data['expected_card']) : 0;
  $counted_cash = isset($data['counted_cash']) ? floatval($data['counted_cash']) : 0;
  $counted_card = isset($data['counted_card']) ? floatval($data['counted_card']) : 0;

  $expected_total = $expected_cash + $expected_card;
  $counted_total = $counted_cash + $counted_card;
  $difference = $counted_total - $expected_total;

  $status = 'ok';
  if ($difference < -0.01) $status = 'faltante';
  if ($difference > 0.01) $status = 'sobrante';

  $stmt = $pdo->prepare("INSERT INTO pos_cash_sessions (cashier_name, expected_cash, expected_card, counted_cash, counted_card, difference, status) VALUES (?, ?, ?, ?, ?, ?, ?)");

  if ($stmt->execute([$cashierName, $expected_cash, $expected_card, $counted_cash, $counted_card, $difference, $status])) {
      adminJsonResponse(200, ["ok" => true, "message" => "Caja cerrada exitosamente"]);
  } else {
      adminJsonResponse(500, ["ok" => false, "message" => "Error al guardar sesión de caja"]);
  }

} catch (Exception $e) {
  error_log('pos_cash_close.php error: ' . $e->getMessage());
  adminJsonResponse(500, ['ok' => false, 'message' => 'Error de servidor: ' . $e->getMessage()]);
}
