<?php
/**
 * POS Inventory Update Endpoint
 * Permite al POS actualizar rápidamente el precio y el stock de un producto.
 */

// Evitar advertencias que rompan el JSON
error_reporting(0);
ini_set('display_errors', 0);

header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Manejar preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// 1. Verificación básica de Token
$headers = apache_request_headers();
$authHeader = isset($headers['Authorization']) ? $headers['Authorization'] : '';

if (empty($authHeader) || strpos($authHeader, 'Bearer pos_auth_') === false) {
    http_response_code(401);
    echo json_encode(["ok" => false, "message" => "No autorizado o token inválido"]);
    exit();
}

// 2. Conexión a la base de datos de Hostinger
$db_host = 'localhost';
$db_user = 'u159958117_xabibi';
$db_pass = '1=V0f5aM>P>u';
$db_name = 'u159958117_godart_store';

$conn = new mysqli($db_host, $db_user, $db_pass, $db_name);

if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode(["ok" => false, "message" => "Error de conexión: " . $conn->connect_error]);
    exit();
}

$conn->set_charset("utf8mb4");

// 3. Validar datos de entrada
$product_id = isset($_POST['product_id']) ? intval($_POST['product_id']) : 0;
$new_price = isset($_POST['price']) ? floatval($_POST['price']) : -1;
$new_stock = isset($_POST['stock']) ? intval($_POST['stock']) : -1;

if ($product_id <= 0 || $new_price < 0 || $new_stock < 0) {
    http_response_code(400);
    echo json_encode(["ok" => false, "message" => "Datos inválidos"]);
    exit();
}

// 4. Actualizar el producto
$stmt = $conn->prepare("UPDATE products SET price = ?, stock_quantity = ? WHERE id = ?");
$stmt->bind_param("dii", $new_price, $new_stock, $product_id);

if ($stmt->execute()) {
    if ($stmt->affected_rows > 0 || $stmt->error == "") {
        // La actualización fue exitosa (o los valores eran los mismos y no hubo cambios)
        echo json_encode(["ok" => true, "message" => "Producto actualizado"]);
    } else {
        echo json_encode(["ok" => false, "message" => "No se pudo actualizar el producto"]);
    }
} else {
    http_response_code(500);
    echo json_encode(["ok" => false, "message" => "Error al ejecutar la actualización"]);
}

$stmt->close();
$conn->close();
?>
