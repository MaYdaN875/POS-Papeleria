<?php
/**
 * Endpoint: pos_login.php
 *
 * Login dedicado para el POS.
 * Auto-detecta la estructura de la tabla admin_users.
 *
 * SUBIR A: api/admin/auth/pos_login.php en Hostinger
 */

error_reporting(0);
ini_set('display_errors', 0);

require_once __DIR__ . '/../../_admin_common.php';

adminHandleCors(['POST']);
adminRequireMethod('POST');

try {
    $pdo = adminGetPdo();
    $data = adminReadJsonBody();

    $email = trim($data['email'] ?? '');
    $password = $data['password'] ?? '';

    if (empty($email) || empty($password)) {
        adminJsonResponse(400, ['ok' => false, 'message' => 'Email y contraseña son requeridos']);
    }

    // Auto-detectar columnas de la tabla admin_users
    $columns = $pdo->query("SHOW COLUMNS FROM admin_users")->fetchAll(PDO::FETCH_COLUMN);

    // Detectar columna de email/usuario
    $colEmail = 'email';
    if (in_array('username', $columns) && !in_array('email', $columns)) $colEmail = 'username';

    // Detectar columna de contraseña
    $colPass = 'password_hash';
    if (!in_array('password_hash', $columns)) {
        if (in_array('password', $columns)) $colPass = 'password';
        elseif (in_array('pass', $columns)) $colPass = 'pass';
    }

    // Detectar columna de nombre
    $colName = 'full_name';
    if (!in_array('full_name', $columns)) {
        if (in_array('name', $columns)) $colName = 'name';
        elseif (in_array('nombre', $columns)) $colName = 'nombre';
        else $colName = $colEmail; // fallback: usar email como nombre
    }

    // Detectar columna de rol
    $hasRole = in_array('role', $columns);

    // Construir SELECT dinámico
    $selectCols = "id, $colEmail, $colPass";
    if ($colName !== $colEmail) $selectCols .= ", $colName";
    if ($hasRole) $selectCols .= ", role";

    // Buscar usuario por email/username
    $stmt = $pdo->prepare("SELECT $selectCols FROM admin_users WHERE $colEmail = ? LIMIT 1");
    $stmt->execute([$email]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        adminJsonResponse(401, ['ok' => false, 'message' => 'Credenciales incorrectas']);
    }

    $storedHash = $user[$colPass] ?? '';
    $passwordValid = false;

    // Verificar contraseña con múltiples métodos
    // 1. bcrypt (password_hash de PHP)
    if (!$passwordValid && password_verify($password, $storedHash)) {
        $passwordValid = true;
    }
    // 2. MD5
    if (!$passwordValid && $storedHash === md5($password)) {
        $passwordValid = true;
        // Upgrade a bcrypt
        $newHash = password_hash($password, PASSWORD_DEFAULT);
        $pdo->prepare("UPDATE admin_users SET $colPass = ? WHERE id = ?")->execute([$newHash, $user['id']]);
    }
    // 3. SHA256
    if (!$passwordValid && $storedHash === hash('sha256', $password)) {
        $passwordValid = true;
        $newHash = password_hash($password, PASSWORD_DEFAULT);
        $pdo->prepare("UPDATE admin_users SET $colPass = ? WHERE id = ?")->execute([$newHash, $user['id']]);
    }
    // 4. Texto plano (no debería usarse, pero por si acaso)
    if (!$passwordValid && $storedHash === $password) {
        $passwordValid = true;
        $newHash = password_hash($password, PASSWORD_DEFAULT);
        $pdo->prepare("UPDATE admin_users SET $colPass = ? WHERE id = ?")->execute([$newHash, $user['id']]);
    }

    if (!$passwordValid) {
        adminJsonResponse(401, ['ok' => false, 'message' => 'Credenciales incorrectas']);
    }

    // Generar token de sesión
    $token = 'pos_auth_' . bin2hex(random_bytes(32));
    $expiresAt = date('Y-m-d H:i:s', strtotime('+24 hours'));

    // Insertar sesión — auto-detectar tabla de sesiones
    $sessionInserted = false;
    $sessionTables = ['admin_sessions', 'sessions'];
    foreach ($sessionTables as $sessionTable) {
        try {
            $sessionCols = $pdo->query("SHOW COLUMNS FROM $sessionTable")->fetchAll(PDO::FETCH_COLUMN);

            if (in_array('admin_user_id', $sessionCols)) {
                $pdo->prepare("INSERT INTO $sessionTable (admin_user_id, token, expires_at) VALUES (?, ?, ?)")
                    ->execute([$user['id'], $token, $expiresAt]);
                $sessionInserted = true;
            } elseif (in_array('user_id', $sessionCols)) {
                $pdo->prepare("INSERT INTO $sessionTable (user_id, token, expires_at) VALUES (?, ?, ?)")
                    ->execute([$user['id'], $token, $expiresAt]);
                $sessionInserted = true;
            }

            if ($sessionInserted) break;
        } catch (Exception $e) {
            continue;
        }
    }

    if (!$sessionInserted) {
        // Crear tabla de sesiones si no existe
        $pdo->exec("CREATE TABLE IF NOT EXISTS admin_sessions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            admin_user_id INT NOT NULL,
            token VARCHAR(255) NOT NULL,
            expires_at DATETIME NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_token (token)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

        $pdo->prepare("INSERT INTO admin_sessions (admin_user_id, token, expires_at) VALUES (?, ?, ?)")
            ->execute([$user['id'], $token, $expiresAt]);
    }

    // Determinar rol
    $role = $hasRole ? strtolower($user['role'] ?? 'cashier') : 'admin';
    if (empty($role)) $role = ($user['id'] == 1) ? 'admin' : 'cashier';

    $userName = ($colName !== $colEmail) ? ($user[$colName] ?? $user[$colEmail]) : $user[$colEmail];

    adminJsonResponse(200, [
        'ok'        => true,
        'token'     => $token,
        'adminId'   => (int)$user['id'],
        'expiresAt' => $expiresAt,
        'role'      => $role,
        'name'      => $userName,
        'message'   => 'Login exitoso'
    ]);

} catch (PDOException $e) {
    error_log('pos_login.php DB error: ' . $e->getMessage());
    adminJsonResponse(500, ['ok' => false, 'message' => 'Error de base de datos: ' . $e->getMessage()]);
} catch (Throwable $e) {
    error_log('pos_login.php error: ' . $e->getMessage());
    adminJsonResponse(500, ['ok' => false, 'message' => 'Error: ' . $e->getMessage()]);
}
