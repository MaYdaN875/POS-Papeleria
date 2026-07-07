<?php
/**
 * Endpoint: pos_invoices_proxy.php
 *
 * Función:
 * - Actúa como proxy seguro entre el frontend y Factura.com.
 * - Evita problemas de CORS en el navegador.
 * - Solo permite peticiones hacia subdominios y dominios de factura.com.
 *
 * SUBIR A: api/admin/sales/pos_invoices_proxy.php en Hostinger
 */

require_once __DIR__ . '/../../_admin_common.php';

adminHandleCors(['POST']);

try {
  $pdo = adminGetPdo();
  
  // Validación de sesión dinámica (por columnas y candidatos)
  $token = '';
  if (isset($_GET['access_token'])) {
    $token = trim((string)$_GET['access_token']);
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

  $sessionColsAuth = $pdo->query('SHOW COLUMNS FROM admin_sessions')->fetchAll(PDO::FETCH_COLUMN);
  $colsToTryAuth = [];
  if (in_array('token_hash', $sessionColsAuth, true)) $colsToTryAuth[] = 'token_hash';
  if (in_array('token', $sessionColsAuth, true)) $colsToTryAuth[] = 'token';

  $candidatesAuth = array_values(array_unique([$token, hash('sha256', $token), hash('sha256', 'pos:' . $token)]));

  $sessionData = false;
  foreach ($colsToTryAuth as $colAuth) {
    foreach ($candidatesAuth as $candidateAuth) {
      $stmtAuth = $pdo->prepare("SELECT admin_user_id FROM admin_sessions WHERE {$colAuth} = ? AND expires_at > NOW() LIMIT 1");
      $stmtAuth->execute([$candidateAuth]);
      $sessionData = $stmtAuth->fetch();
      if ($sessionData) break 2;
    }
  }

  if (!$sessionData) {
      adminJsonResponse(401, ['ok' => false, 'message' => 'Sesión inválida o expirada']);
  }

  // Leer cuerpo JSON de la petición
  $data = adminReadJsonBody();

  $targetUrl = isset($data['url']) ? trim($data['url']) : '';
  $method = isset($data['method']) ? strtoupper(trim($data['method'])) : 'GET';
  $headers = isset($data['headers']) && is_array($data['headers']) ? $data['headers'] : [];
  $body = isset($data['body']) ? $data['body'] : null;

  if (empty($targetUrl)) {
    adminJsonResponse(400, ['ok' => false, 'message' => 'Se requiere URL destino']);
  }

  // Validaciones de seguridad de URL (Solo Factura.com)
  if (strpos($targetUrl, 'https://sandbox.factura.com/api') !== 0 && strpos($targetUrl, 'https://api.factura.com') !== 0) {
    adminJsonResponse(400, ['ok' => false, 'message' => 'URL destino no permitida']);
  }

  // Inicializar cURL
  $ch = curl_init();
  curl_setopt($ch, CURLOPT_URL, $targetUrl);
  curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
  curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
  curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false); // Permitir sandbox local / sin verificar SSL estrictamente

  // Mapear headers recibidos
  $curlHeaders = [];
  foreach ($headers as $key => $value) {
    $curlHeaders[] = "{$key}: {$value}";
  }
  curl_setopt($ch, CURLOPT_HTTPHEADER, $curlHeaders);

  // Mapear cuerpo si aplica
  if (($method === 'POST' || $method === 'PUT' || $method === 'PATCH') && !is_null($body)) {
    // Si $body es array/object lo convertimos a string, de lo contrario lo enviamos como está
    $postFields = is_string($body) ? $body : json_encode($body);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $postFields);
  }

  // Ejecutar petición
  $responseBody = curl_exec($ch);
  $httpStatusCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
  $curlError = curl_error($ch);
  
  curl_close($ch);

  if ($responseBody === false) {
    adminJsonResponse(502, [
      'ok' => false, 
      'message' => 'Error de conexión con el proveedor de facturación: ' . $curlError
    ]);
  }

  // Retornar exactamente el status code y contenido del proveedor
  http_response_code($httpStatusCode);
  header('Content-Type: application/json; charset=utf-8');
  echo $responseBody;
  exit;

} catch (PDOException $e) {
  error_log('pos_invoices_proxy.php DB error: ' . $e->getMessage());
  adminJsonResponse(500, ['ok' => false, 'message' => 'DB Error: ' . $e->getMessage()]);
} catch (Throwable $e) {
  error_log('pos_invoices_proxy.php fatal error: ' . $e->getMessage());
  adminJsonResponse(500, ['ok' => false, 'message' => 'Fatal Error: ' . $e->getMessage()]);
}
