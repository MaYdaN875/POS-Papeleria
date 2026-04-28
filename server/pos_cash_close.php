<?php
/**
 * POS Cash Close Endpoint
 * Registra el corte de caja al final del turno.
 *
 * SUBIR A: api/admin/sales/pos_cash_close.php en Hostinger
 */

error_reporting(0);
ini_set('display_errors', 0);

header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$headers = apache_request_headers();
$authHeader = isset($headers['Authorization']) ? $headers['Authorization'] : '';

if (empty($authHeader) || strpos($authHeader, 'Bearer pos_auth_') === false) {
    http_response_code(401);
    echo json_encode(["ok" => false, "message" => "No autorizado o token inválido"]);
    exit();
}

// Extraer el username del token simple (pos_auth_user_admin)
$token_parts = explode('_', $authHeader);
$cashier_name = isset($token_parts[2]) ? $token_parts[2] : 'Desconocido';

require_once __DIR__ . '/../../_admin_common.php';

try {
    $pdo = adminGetPdo();
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["ok" => false, "message" => "Error de conexión: " . $e->getMessage()]);
    exit();
}

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

$expected_cash = isset($_POST['expected_cash']) ? floatval($_POST['expected_cash']) : 0;
$expected_card = isset($_POST['expected_card']) ? floatval($_POST['expected_card']) : 0;
$counted_cash = isset($_POST['counted_cash']) ? floatval($_POST['counted_cash']) : 0;
$counted_card = isset($_POST['counted_card']) ? floatval($_POST['counted_card']) : 0;

$expected_total = $expected_cash + $expected_card;
$counted_total = $counted_cash + $counted_card;
$difference = $counted_total - $expected_total;

$status = 'ok';
if ($difference < 0) $status = 'faltante';
if ($difference > 0) $status = 'sobrante';

$stmt = $pdo->prepare("INSERT INTO pos_cash_sessions (cashier_name, expected_cash, expected_card, counted_cash, counted_card, difference, status) VALUES (?, ?, ?, ?, ?, ?, ?)");

if ($stmt->execute([$cashier_name, $expected_cash, $expected_card, $counted_cash, $counted_card, $difference, $status])) {
    echo json_encode(["ok" => true, "message" => "Caja cerrada exitosamente"]);
} else {
    http_response_code(500);
    echo json_encode(["ok" => false, "message" => "Error al guardar sesión de caja"]);
}
?>
