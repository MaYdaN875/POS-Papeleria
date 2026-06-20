<?php
/**
 * Endpoint: pos_taecel.php
 *
 * Proxy SEGURO para Taecel. Las llaves (KEY y NIP) viven en el servidor,
 * en el archivo taecel_config.php, y NUNCA viajan dentro de la app.
 *
 * La app solo le pide a este endpoint: "consulta saldo", "dame productos"
 * o "haz esta recarga", y el servidor es quien habla con Taecel usando las
 * llaves reales. Así, aunque alguien copie la app, no puede sacar tus llaves
 * ni gastar tu saldo.
 *
 * SUBIR A:  api/admin/sales/pos_taecel.php en Hostinger
 * REQUIERE: api/taecel_config.php con las llaves reales (ver taecel_config.example.php)
 */

require_once __DIR__ . '/../../_admin_common.php';

adminHandleCors(['POST']);
adminRequireMethod('POST');

function posTaecelResolveToken(): string
{
    $token = '';

    if (!empty($_GET['access_token'])) {
        $token = trim((string)$_GET['access_token']);
    } elseif (!empty($_POST['access_token'])) {
        $token = trim((string)$_POST['access_token']);
    }

    if ($token === '') {
        $jsonBody = json_decode(file_get_contents('php://input') ?: '', true);
        if (is_array($jsonBody) && !empty($jsonBody['access_token'])) {
            $token = trim((string)$jsonBody['access_token']);
        }
    }

    if ($token === '') {
        $headers = function_exists('getallheaders') ? getallheaders() : [];
        $auth = $headers['Authorization']
            ?? $headers['authorization']
            ?? ($_SERVER['HTTP_AUTHORIZATION'] ?? '')
            ?? ($_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '');
        $token = preg_replace('/^Bearer\s+/i', '', trim((string)$auth));
    }

    return $token;
}

function posTaecelValidateSession(PDO $pdo): void
{
    $token = posTaecelResolveToken();

    if ($token === '') {
        adminJsonResponse(401, ['success' => false, 'message' => 'Sesión inválida o expirada']);
    }

    $sessionCols = $pdo->query('SHOW COLUMNS FROM admin_sessions')->fetchAll(PDO::FETCH_COLUMN);
    $colsToTry = [];
    if (in_array('token_hash', $sessionCols, true)) $colsToTry[] = 'token_hash';
    if (in_array('token', $sessionCols, true)) $colsToTry[] = 'token';

    $candidates = array_values(array_unique([
        $token,
        hash('sha256', $token),
        hash('sha256', 'pos:' . $token),
    ]));

    foreach ($colsToTry as $col) {
        foreach ($candidates as $candidate) {
            $stmt = $pdo->prepare(
                "SELECT admin_user_id FROM admin_sessions WHERE {$col} = ? AND expires_at > NOW() LIMIT 1"
            );
            $stmt->execute([$candidate]);
            if ($stmt->fetch(PDO::FETCH_ASSOC)) {
                return;
            }
        }
    }

    adminJsonResponse(401, ['success' => false, 'message' => 'Sesión inválida o expirada']);
}

try {
    $pdo = adminGetPdo();
    posTaecelValidateSession($pdo);

    // Cargar las llaves reales desde el archivo de configuración del servidor
    $configPath = __DIR__ . '/../../taecel_config.php';
    if (!is_file($configPath)) {
        adminJsonResponse(500, [
            'success' => false,
            'message' => 'Falta el archivo taecel_config.php en el servidor.',
        ]);
    }

    $config = require $configPath;
    $key    = is_array($config) ? trim((string)($config['key'] ?? '')) : '';
    $nip    = is_array($config) ? trim((string)($config['nip'] ?? '')) : '';
    $apiUrl = is_array($config) ? rtrim((string)($config['api_url'] ?? 'https://app.taecel.com/api'), '/') : '';

    if ($key === '' || $nip === '') {
        adminJsonResponse(500, [
            'success' => false,
            'message' => 'Las llaves de Taecel no están configuradas en el servidor.',
        ]);
    }

    $action = isset($_POST['action']) ? trim((string)$_POST['action']) : '';
    $fields = ['key' => $key, 'nip' => $nip];
    $endpoint = '';

    switch ($action) {
        case 'balance':
            $endpoint = '/getBalance';
            break;

        case 'products':
            $endpoint = '/getProducts';
            break;

        case 'transaction':
            $endpoint = '/requestTXN';
            $producto   = isset($_POST['producto']) ? trim((string)$_POST['producto']) : '';
            $referencia = isset($_POST['referencia']) ? trim((string)$_POST['referencia']) : '';
            $monto      = isset($_POST['monto']) ? (string)$_POST['monto'] : '';

            if ($producto === '' || $referencia === '') {
                adminJsonResponse(400, ['success' => false, 'message' => 'Faltan datos de la recarga (producto o referencia).']);
            }

            $fields['producto']   = $producto;
            $fields['referencia'] = $referencia;
            if ($monto !== '' && (float)$monto > 0) {
                $fields['monto'] = $monto;
            }
            break;

        default:
            adminJsonResponse(400, ['success' => false, 'message' => 'Acción no válida.']);
    }

    // Llamada al servicio de Taecel desde el servidor (con cURL)
    $ch = curl_init($apiUrl . $endpoint);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => http_build_query($fields),
        CURLOPT_HTTPHEADER     => ['Content-Type: application/x-www-form-urlencoded'],
        CURLOPT_TIMEOUT        => 40,
        CURLOPT_CONNECTTIMEOUT => 15,
    ]);

    $response = curl_exec($ch);
    $httpCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlErr  = curl_error($ch);
    curl_close($ch);

    if ($response === false) {
        error_log('pos_taecel.php cURL error: ' . $curlErr);
        adminJsonResponse(502, ['success' => false, 'message' => 'No se pudo contactar a Taecel.']);
    }

    if ($action === 'transaction') {
        error_log(
            'pos_taecel.php requestTXN sent producto=' . ($fields['producto'] ?? '')
            . ' referencia=' . ($fields['referencia'] ?? '')
            . ' monto=' . ($fields['monto'] ?? '(sin monto)')
        );
        error_log('pos_taecel.php requestTXN HTTP ' . $httpCode . ' response: ' . substr((string)$response, 0, 1200));
    }

    // Devolver la respuesta de Taecel tal cual (la app ya sabe interpretarla)
    header('Content-Type: application/json; charset=utf-8');
    http_response_code($httpCode > 0 ? $httpCode : 200);
    echo $response;
    exit;

} catch (PDOException $e) {
    error_log('pos_taecel.php DB error: ' . $e->getMessage());
    adminJsonResponse(500, ['success' => false, 'message' => 'Error de base de datos']);
} catch (Throwable $e) {
    error_log('pos_taecel.php error: ' . $e->getMessage());
    adminJsonResponse(500, ['success' => false, 'message' => 'Error interno del servidor']);
}
