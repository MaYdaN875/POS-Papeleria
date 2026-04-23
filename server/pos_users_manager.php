<?php
/**
 * SUBIR A: api/admin/users/pos_users_manager.php
 */
error_reporting(0);
ini_set('display_errors', 0);

require_once __DIR__ . '/../../_admin_common.php';

adminHandleCors(['GET', 'POST', 'PUT', 'DELETE']);

try {
  $pdo = adminGetPdo();
  $adminId = adminRequireSession($pdo);
  $method = $_SERVER['REQUEST_METHOD'];

  // Columnas exactas tras el ALTER TABLE
  $colEmail = 'email';
  $colPassword = 'password_hash';
  $colName = 'full_name';
  $colRole = 'role';

  if ($method === 'GET') {
    $stmt = $pdo->query("SELECT id, $colName as name, $colEmail as identifier, $colRole as role FROM admin_users ORDER BY id ASC");
    $users = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $user) {
      // Si el nombre está vacío, usar el email
      if (empty($user['name'])) $user['name'] = $user['identifier'];
      // Asegurar que el rol sea minúsculas para el frontend
      $user['role'] = strtolower((string)$user['role']);
      if (empty($user['role'])) $user['role'] = 'cashier';
      $users[] = $user;
    }
    adminJsonResponse(200, ['ok' => true, 'users' => $users]);

  } elseif ($method === 'POST' || $method === 'PUT') {
    $data = json_decode(file_get_contents('php://input'), true);
    $name = $data['name'] ?? '';
    $email = $data['identifier'] ?? '';
    $password = $data['password'] ?? '';
    $role = $data['role'] ?? 'cashier';
    
    if ($method === 'POST') {
      $hashedPass = password_hash($password, PASSWORD_DEFAULT);
      $sql = "INSERT INTO admin_users ($colName, $colEmail, $colPassword, $colRole) VALUES (?, ?, ?, ?)";
      $params = [$name, $email, $hashedPass, $role];
    } else {
      $id = (int)$data['id'];
      $updates = ["$colName = ?", "$colEmail = ?", "$colRole = ?"];
      $params = [$name, $email, $role];
      
      if (!empty($password)) {
        $updates[] = "$colPassword = ?";
        $params[] = password_hash($password, PASSWORD_DEFAULT);
      }
      
      $params[] = $id;
      $sql = "UPDATE admin_users SET " . implode(', ', $updates) . " WHERE id = ?";
    }

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    adminJsonResponse(200, ['ok' => true, 'message' => 'Exito']);

  } elseif ($method === 'DELETE') {
    $id = (int)$_GET['id'];
    if ($id === $adminId) adminJsonResponse(403, ['ok' => false, 'message' => 'No puedes borrarte a ti mismo']);
    $pdo->prepare("DELETE FROM admin_users WHERE id = ?")->execute([$id]);
    adminJsonResponse(200, ['ok' => true, 'message' => 'Eliminado']);
  }

} catch (Exception $e) {
  adminJsonResponse(500, ['ok' => false, 'message' => "Error: " . $e->getMessage()]);
}
