<?php
/**
 * POS Inventory Update Endpoint
 * Actualiza precio POS (sin tocar precio web) y stock.
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

$authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';

if (empty($authHeader) && function_exists('getallheaders')) {
    $headers = getallheaders();
    $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? '';
}

if (empty($authHeader) && function_exists('apache_request_headers')) {
    $headers = apache_request_headers();
    $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? '';
}

if (empty($authHeader) && isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
    $authHeader = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
}

if (empty($authHeader) || strpos($authHeader, 'Bearer pos_auth_') === false) {
    http_response_code(401);
    echo json_encode(["ok" => false, "message" => "No autorizado o token inválido"]);
    exit();
}

require_once __DIR__ . '/../../_admin_common.php';

try {
    $pdo = adminGetPdo();
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["ok" => false, "message" => "Error de conexión: " . $e->getMessage()]);
    exit();
}

$product_id = isset($_POST['product_id']) ? intval($_POST['product_id']) : 0;
$new_pos_price = isset($_POST['pos_price']) ? floatval($_POST['pos_price']) : -1;
$new_stock = isset($_POST['stock']) ? intval($_POST['stock']) : -1;

// Compatibilidad con versiones anteriores que enviaban "price"
if ($new_pos_price < 0 && isset($_POST['price'])) {
    $new_pos_price = floatval($_POST['price']);
}

if ($product_id <= 0 || $new_pos_price < 0 || $new_stock < 0) {
    http_response_code(400);
    echo json_encode(["ok" => false, "message" => "Datos inválidos"]);
    exit();
}

$cols = $pdo->query("SHOW COLUMNS FROM products")->fetchAll(PDO::FETCH_COLUMN);
$hasPosPrice = in_array('pos_price', $cols, true);
$hasStock = in_array('stock', $cols, true);
$hasStockQty = in_array('stock_quantity', $cols, true);

$sets = [];
$params = [];

if ($hasPosPrice) {
    $sets[] = 'pos_price = ?';
    $params[] = $new_pos_price;
} elseif (in_array('price', $cols, true)) {
    // Fallback si aún no existe la columna pos_price
    $sets[] = 'price = ?';
    $params[] = $new_pos_price;
}

if ($hasStock) {
    $sets[] = 'stock = ?';
    $params[] = $new_stock;
}

if ($hasStockQty) {
    $sets[] = 'stock_quantity = ?';
    $params[] = $new_stock;
}

if (empty($sets)) {
    http_response_code(500);
    echo json_encode(["ok" => false, "message" => "No se encontraron columnas actualizables"]);
    exit();
}

$params[] = $product_id;
$sql = 'UPDATE products SET ' . implode(', ', $sets) . ' WHERE id = ?';
$stmt = $pdo->prepare($sql);

if ($stmt->execute($params)) {
    echo json_encode(["ok" => true, "message" => "Producto actualizado"]);
} else {
    http_response_code(500);
    echo json_encode(["ok" => false, "message" => "Error al ejecutar la actualización"]);
}
