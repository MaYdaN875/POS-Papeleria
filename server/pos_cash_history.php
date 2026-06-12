<?php
/**
 * Endpoint: pos_cash_history.php
 *
 * Función:
 * - Devuelve el historial de cortes de caja paginado/filtrado.
 *
 * SUBIR A: api/admin/sales/pos_cash_history.php en Hostinger
 */

error_reporting(0);
ini_set('display_errors', 0);

require_once __DIR__ . '/../../_admin_common.php';

adminHandleCors(['GET']);
adminRequireMethod('GET');

try {
  $pdo = adminGetPdo();
  
  // Validación de sesión: token por URL, cuerpo o header; directo o hasheado
  $token = '';
  if (!empty($_GET['access_token'])) {
    $token = trim((string)$_GET['access_token']);
  } elseif (!empty($_POST['access_token'])) {
    $token = trim((string)$_POST['access_token']);
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

  $dateStart = $_GET['date_start'] ?? null;
  $dateEnd = $_GET['date_end'] ?? null;
  $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 50;

  $query = "
    SELECT 
      id, 
      cashier_name,
      expected_cash,
      expected_card,
      counted_cash,
      counted_card,
      difference,
      status,
      created_at
    FROM pos_cash_sessions
    WHERE 1=1
  ";
  
  $params = [];

  if ($dateStart) {
    $query .= " AND created_at >= :date_start";
    $params['date_start'] = $dateStart . ' 00:00:00';
  }
  
  if ($dateEnd) {
    $query .= " AND created_at <= :date_end";
    $params['date_end'] = $dateEnd . ' 23:59:59';
  }

  $query .= " ORDER BY created_at DESC LIMIT :limit";

  $stmt = $pdo->prepare($query);
  foreach ($params as $key => $val) {
    $stmt->bindValue($key, $val);
  }
  $stmt->bindValue('limit', $limit, PDO::PARAM_INT);
  $stmt->execute();

  $sessions = $stmt->fetchAll(PDO::FETCH_ASSOC);

  adminJsonResponse(200, [
    'ok' => true, 
    'sessions' => $sessions
  ]);

} catch (PDOException $e) {
  // If the table doesn't exist yet, return empty list gracefully
  if (strpos($e->getMessage(), 'Table') !== false && strpos($e->getMessage(), 'doesn\'t exist') !== false) {
    adminJsonResponse(200, ['ok' => true, 'sessions' => []]);
  }
  error_log('pos_cash_history.php DB error: ' . $e->getMessage());
  adminJsonResponse(500, ['ok' => false, 'message' => 'Error al consultar la base de datos']);
} catch (Throwable $e) {
  error_log('pos_cash_history.php fatal error: ' . $e->getMessage());
  adminJsonResponse(500, ['ok' => false, 'message' => 'Error interno del servidor']);
}
