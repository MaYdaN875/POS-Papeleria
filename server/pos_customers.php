<?php
/**
 * Endpoint: pos_customers.php
 *
 * Función:
 * - GET: Obtiene la lista de todos los clientes frecuentes o busca por RFC.
 * - POST: Crea o actualiza la información fiscal de un cliente.
 * - DELETE: Elimina un cliente por su RFC o ID.
 *
 * SUBIR A: api/admin/sales/pos_customers.php en Hostinger
 */

require_once __DIR__ . '/../../_admin_common.php';

adminHandleCors(['GET', 'POST', 'DELETE']);

try {
  $pdo = adminGetPdo();
  
  // Validación de sesión por Token (dinámica por columnas y candidatos)
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

  $adminId = (int)$sessionData['admin_user_id'];
  
  // 1. Asegurar que la tabla pos_customers existe
  $pdo->query("
    CREATE TABLE IF NOT EXISTS pos_customers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      rfc VARCHAR(13) NOT NULL UNIQUE,
      razon_social VARCHAR(200) NOT NULL,
      regimen_fiscal VARCHAR(3) NOT NULL,
      codigo_postal VARCHAR(5) NOT NULL,
      email VARCHAR(150) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_customers_rfc (rfc)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  ");

  // --- PROCESAR SOLICITUD GET ---
  if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $rfc = isset($_GET['rfc']) ? trim($_GET['rfc']) : '';
    
    if (!empty($rfc)) {
      $stmt = $pdo->prepare("SELECT * FROM pos_customers WHERE rfc = ? LIMIT 1");
      $stmt->execute([$rfc]);
      $customer = $stmt->fetch(PDO::FETCH_ASSOC);

      if ($customer) {
        adminJsonResponse(200, [
          'ok' => true,
          'customer' => [
            'id' => (int)$customer['id'],
            'rfc' => $customer['rfc'],
            'razonSocial' => $customer['razon_social'],
            'regimenFiscal' => $customer['regimen_fiscal'],
            'codigoPostal' => $customer['codigo_postal'],
            'email' => $customer['email'],
            'createdAt' => $customer['created_at']
          ]
        ]);
      } else {
        adminJsonResponse(200, ['ok' => false, 'message' => 'Cliente no encontrado']);
      }
    } else {
      // Retornar lista completa
      $stmt = $pdo->query("SELECT * FROM pos_customers ORDER BY razon_social ASC");
      $customers = $stmt->fetchAll(PDO::FETCH_ASSOC);
      
      $mapped = array_map(function($c) {
        return [
          'id' => (int)$c['id'],
          'rfc' => $c['rfc'],
          'razonSocial' => $c['razon_social'],
          'regimenFiscal' => $c['regimen_fiscal'],
          'codigoPostal' => $c['codigo_postal'],
          'email' => $c['email'],
          'createdAt' => $c['created_at']
        ];
      }, $customers);

      adminJsonResponse(200, [
        'ok' => true,
        'customers' => $mapped
      ]);
    }
  }

  // --- PROCESAR SOLICITUD POST ---
  if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = adminReadJsonBody();

    $rfc = isset($data['rfc']) ? trim(strtoupper($data['rfc'])) : '';
    $razonSocial = isset($data['razon_social']) ? trim(strtoupper($data['razon_social'])) : '';
    $regimenFiscal = isset($data['regimen_fiscal']) ? trim($data['regimen_fiscal']) : '';
    $codigoPostal = isset($data['codigo_postal']) ? trim($data['codigo_postal']) : '';
    $email = isset($data['email']) ? trim($data['email']) : '';

    if (empty($rfc) || empty($razonSocial) || empty($regimenFiscal) || empty($codigoPostal) || empty($email)) {
      adminJsonResponse(400, ['ok' => false, 'message' => 'Datos de cliente incompletos']);
    }

    // Insertar o actualizar
    $stmt = $pdo->prepare("
      INSERT INTO pos_customers (rfc, razon_social, regimen_fiscal, codigo_postal, email)
      VALUES (:rfc, :razon_social, :regimen_fiscal, :codigo_postal, :email)
      ON DUPLICATE KEY UPDATE 
        razon_social = VALUES(razon_social),
        regimen_fiscal = VALUES(regimen_fiscal),
        codigo_postal = VALUES(codigo_postal),
        email = VALUES(email)
    ");

    $stmt->execute([
      'rfc' => $rfc,
      'razon_social' => $razonSocial,
      'regimen_fiscal' => $regimenFiscal,
      'codigo_postal' => $codigoPostal,
      'email' => $email
    ]);

    adminJsonResponse(200, [
      'ok' => true,
      'message' => 'Cliente guardado correctamente'
    ]);
  }

  // --- PROCESAR SOLICITUD DELETE ---
  if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    $rfc = isset($_GET['rfc']) ? trim($_GET['rfc']) : '';
    $id = isset($_GET['id']) ? (int)$_GET['id'] : 0;

    if (empty($rfc) && $id <= 0) {
      adminJsonResponse(400, ['ok' => false, 'message' => 'Se requiere ID o RFC para eliminar']);
    }

    if ($id > 0) {
      $stmt = $pdo->prepare("DELETE FROM pos_customers WHERE id = ?");
      $stmt->execute([$id]);
    } else {
      $stmt = $pdo->prepare("DELETE FROM pos_customers WHERE rfc = ?");
      $stmt->execute([$rfc]);
    }

    adminJsonResponse(200, [
      'ok' => true,
      'message' => 'Cliente eliminado correctamente'
    ]);
  }

} catch (PDOException $e) {
  error_log('pos_customers.php DB error: ' . $e->getMessage());
  adminJsonResponse(500, ['ok' => false, 'message' => 'DB Error: ' . $e->getMessage()]);
} catch (Throwable $e) {
  error_log('pos_customers.php fatal error: ' . $e->getMessage());
  adminJsonResponse(500, ['ok' => false, 'message' => 'Fatal Error: ' . $e->getMessage()]);
}
