<?php
/**
 * Endpoint: pos_taecel.php
 *
 * Proxy SEGURO para Taecel. Las llaves (KEY y NIP) viven en el servidor,
 * en el archivo taecel_config.php, y NUNCA viajan dentro de la app.
 *
 * Flujo de recarga (2 pasos, spec probada v2 — commit 520e570):
 *   1) RequestTXN  — solicitar la transacción (timeout 30 s)
 *   2) StatusTXN   — consultar de inmediato; reintentos cada 3 s; máx. 60 s total
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

/** @return array{ok:bool,http:int,body:string,parsed:?array,error:string} */
function posTaecelPost(string $apiUrl, string $endpoint, array $fields, int $timeoutSeconds = 30): array
{
    $ch = curl_init($apiUrl . $endpoint);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => http_build_query($fields),
        CURLOPT_HTTPHEADER     => ['Content-Type: application/x-www-form-urlencoded'],
        CURLOPT_TIMEOUT        => max(5, $timeoutSeconds),
        CURLOPT_CONNECTTIMEOUT => min(15, max(5, $timeoutSeconds)),
    ]);

    $body = curl_exec($ch);
    $http = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err  = curl_error($ch);
    curl_close($ch);

    if ($body === false) {
        return ['ok' => false, 'http' => 0, 'body' => '', 'parsed' => null, 'error' => $err];
    }

    $parsed = json_decode((string)$body, true);

    return [
        'ok'     => true,
        'http'   => $http,
        'body'   => (string)$body,
        'parsed' => is_array($parsed) ? $parsed : null,
        'error'  => '',
    ];
}

function posTaecelExtractTransId(?array $parsed): string
{
    if (!$parsed) {
        return '';
    }

    $data = $parsed['data'] ?? null;
    if (is_array($data)) {
        if (isset($data[0]) && is_array($data[0])) {
            $data = $data[0];
        }
        foreach (['TransID', 'transID', 'transId', 'ID', 'id'] as $key) {
            if (!empty($data[$key])) {
                return trim((string)$data[$key]);
            }
        }
    }

    foreach (['TransID', 'transID', 'transId'] as $key) {
        if (!empty($parsed[$key])) {
            return trim((string)$parsed[$key]);
        }
    }

    return '';
}

function posTaecelExtractStatusText(?array $parsed): string
{
    if (!$parsed) {
        return '';
    }

    $data = $parsed['data'] ?? null;
    if (is_array($data)) {
        if (isset($data[0]) && is_array($data[0])) {
            $data = $data[0];
        }
        foreach (['Status', 'status', 'Estatus', 'estatus'] as $key) {
            if (!empty($data[$key])) {
                return strtolower(trim((string)$data[$key]));
            }
        }
    }

    return '';
}

function posTaecelStatusIsFinal(?array $parsed): bool
{
    if (!$parsed) {
        return false;
    }

    $status = posTaecelExtractStatusText($parsed);

    if ($status !== '') {
        if (
            $status === 'exitosa'
            || str_contains($status, 'fracas')
            || str_contains($status, 'fracaz')
            || str_contains($status, 'rechaz')
        ) {
            return true;
        }

        if (str_contains($status, 'proceso') || str_contains($status, 'procesando')) {
            return false;
        }
    }

    if (($parsed['success'] ?? null) === false) {
        return true;
    }

    if (($parsed['success'] ?? null) === true && $status !== '') {
        return true;
    }

    $blob = json_encode($parsed, JSON_UNESCAPED_UNICODE);
    if ($blob !== false) {
        $text = strtolower($blob);
        if (str_contains($text, 'folio') && !str_contains($text, 'no proces')) {
            return true;
        }
    }

    return false;
}

/**
 * Ciclo StatusTXN según matriz de pruebas v2:
 * - Sin espera inicial (inmediato tras RequestTXN)
 * - Timeout 10 s por consulta
 * - Reintento cada 3 s
 * - Máximo 60 s desde $startedAt
 */
function posTaecelPollStatusTxn(
    string $apiUrl,
    string $key,
    string $nip,
    string $transId,
    float $startedAt,
    int $pollInterval,
    int $maxTotalSeconds,
    int $statusTimeout
): array {
    $fields = [
        'key'     => $key,
        'nip'     => $nip,
        'transID' => $transId,
        'TransID' => $transId,
    ];

    $last = null;
    $attempt = 0;

    while (true) {
        $elapsed = microtime(true) - $startedAt;
        if ($elapsed >= $maxTotalSeconds) {
            error_log(
                'pos_taecel.php statusTXN: agotados ' . $maxTotalSeconds
                . 's para transID ' . $transId
            );
            break;
        }

        $attempt++;
        $last = posTaecelPost($apiUrl, '/StatusTXN', $fields, $statusTimeout);

        if (!$last['ok']) {
            error_log(
                'pos_taecel.php statusTXN attempt ' . $attempt
                . ' transID=' . $transId
                . ' error: ' . $last['error']
            );
        } else {
            error_log(
                'pos_taecel.php statusTXN attempt ' . $attempt
                . ' transID=' . $transId
                . ' HTTP ' . $last['http']
                . ' (' . round($elapsed) . 's) response: ' . substr($last['body'], 0, 1200)
            );

            if (posTaecelStatusIsFinal($last['parsed'])) {
                break;
            }
        }

        $remaining = $maxTotalSeconds - (microtime(true) - $startedAt);
        if ($remaining <= $pollInterval) {
            break;
        }

        sleep($pollInterval);
    }

    return $last ?? [
        'ok'     => false,
        'http'   => 0,
        'body'   => '',
        'parsed' => null,
        'error'  => 'Sin respuesta statusTXN',
    ];
}

try {
    $pdo = adminGetPdo();
    posTaecelValidateSession($pdo);

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

    $requestTimeout = is_array($config) ? (int)($config['request_txn_timeout_seconds'] ?? 30) : 30;
    $statusPoll     = is_array($config) ? (int)($config['status_poll_interval_seconds'] ?? 3) : 3;
    $maxTotal       = is_array($config) ? (int)($config['status_max_total_seconds'] ?? 60) : 60;
    $statusTimeout  = is_array($config) ? (int)($config['status_request_timeout_seconds'] ?? 10) : 10;

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
            $endpoint = '/RequestTXN';
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

    $txnStartedAt = microtime(true);
    $curlTimeout  = $action === 'transaction' ? $requestTimeout : 40;
    $result       = posTaecelPost($apiUrl, $endpoint, $fields, $curlTimeout);

    if (!$result['ok']) {
        error_log('pos_taecel.php cURL error: ' . $result['error']);
        adminJsonResponse(502, ['success' => false, 'message' => 'No se pudo contactar a Taecel.']);
    }

    $response = $result['body'];
    $httpCode = $result['http'];

    if ($action === 'transaction') {
        error_log(
            'pos_taecel.php RequestTXN sent producto=' . ($fields['producto'] ?? '')
            . ' referencia=' . ($fields['referencia'] ?? '')
            . ' monto=' . ($fields['monto'] ?? '(sin monto)')
        );
        error_log('pos_taecel.php RequestTXN HTTP ' . $httpCode . ' response: ' . substr($response, 0, 1200));

        $transId = posTaecelExtractTransId($result['parsed']);
        if ($transId !== '') {
            $statusResult = posTaecelPollStatusTxn(
                $apiUrl,
                $key,
                $nip,
                $transId,
                $txnStartedAt,
                max(1, min($statusPoll, 15)),
                max(15, min($maxTotal, 120)),
                max(5, min($statusTimeout, 30))
            );

            if ($statusResult['ok'] && $statusResult['body'] !== '') {
                $response = $statusResult['body'];
                $httpCode = $statusResult['http'];
            }
        } else {
            error_log('pos_taecel.php RequestTXN sin TransID; no se ejecutó StatusTXN');
        }
    }

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
