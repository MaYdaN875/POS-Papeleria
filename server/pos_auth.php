<?php
/**
 * Autenticación POS compatible con Hostinger (token y token_hash).
 * Incluir después de _admin_common.php
 */

function posGetJsonBody(): array
{
    static $body = null;
    if ($body !== null) {
        return $body;
    }

    $raw = file_get_contents('php://input') ?: '';
    $decoded = json_decode($raw, true);
    $body = is_array($decoded) ? $decoded : [];

    return $body;
}

function posGetBearerToken(): string
{
    $auth = $_SERVER['HTTP_AUTHORIZATION']
        ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION']
        ?? '';

    if ($auth === '' && function_exists('getallheaders')) {
        $headers = getallheaders();
        $auth = $headers['Authorization'] ?? $headers['authorization'] ?? '';
    }

    if ($auth === '' && function_exists('apache_request_headers')) {
        $headers = apache_request_headers();
        $auth = $headers['Authorization'] ?? $headers['authorization'] ?? '';
    }

    $token = preg_replace('/^Bearer\s+/i', '', trim($auth));

    // Hostinger suele perder Authorization en POST; aceptar copias del token.
    if ($token === '' && !empty($_POST['access_token'])) {
        $token = trim((string)$_POST['access_token']);
    }

    if ($token === '' && !empty($_SERVER['HTTP_X_ACCESS_TOKEN'])) {
        $token = trim((string)$_SERVER['HTTP_X_ACCESS_TOKEN']);
    }

    if ($token === '') {
        $json = posGetJsonBody();
        if (!empty($json['access_token'])) {
            $token = trim((string)$json['access_token']);
        }
    }

    return $token;
}

function posValidateSession(PDO $pdo): int
{
    $token = posGetBearerToken();

    if ($token === '') {
        adminJsonResponse(401, [
            'ok' => false,
            'message' => 'Sesión inválida o expirada (token no recibido)',
            'code' => 'missing_token',
        ]);
    }

    $sessionCols = $pdo->query('SHOW COLUMNS FROM admin_sessions')->fetchAll(PDO::FETCH_COLUMN);
    $colsToTry = [];

    if (in_array('token_hash', $sessionCols, true)) {
        $colsToTry[] = 'token_hash';
    }
    if (in_array('token', $sessionCols, true)) {
        $colsToTry[] = 'token';
    }

    $tokenCandidates = array_values(array_unique([
        $token,
        hash('sha256', $token),
        hash('sha256', 'pos:' . $token),
    ]));

    foreach ($colsToTry as $col) {
        foreach ($tokenCandidates as $candidate) {
            $stmt = $pdo->prepare(
                "SELECT admin_user_id FROM admin_sessions WHERE {$col} = ? AND expires_at > NOW() LIMIT 1"
            );
            $stmt->execute([$candidate]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($row) {
                return (int)$row['admin_user_id'];
            }
        }
    }

    adminJsonResponse(401, [
        'ok' => false,
        'message' => 'Sesión inválida o expirada',
        'code' => 'invalid_token',
    ]);
}

function posInsertSession(PDO $pdo, int $adminUserId, string $token, string $expiresAt): void
{
    $sessionCols = $pdo->query('SHOW COLUMNS FROM admin_sessions')->fetchAll(PDO::FETCH_COLUMN);

    if (in_array('token_hash', $sessionCols, true)) {
        $pdo->prepare('INSERT INTO admin_sessions (admin_user_id, token_hash, expires_at) VALUES (?, ?, ?)')
            ->execute([$adminUserId, $token, $expiresAt]);
        return;
    }

    if (in_array('token', $sessionCols, true)) {
        $pdo->prepare('INSERT INTO admin_sessions (admin_user_id, token, expires_at) VALUES (?, ?, ?)')
            ->execute([$adminUserId, $token, $expiresAt]);
        return;
    }

    throw new RuntimeException('La tabla admin_sessions no tiene columnas token ni token_hash');
}
