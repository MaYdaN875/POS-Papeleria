<?php
/**
 * PLANTILLA de configuración de Taecel.
 *
 * 1. Copia este archivo y renómbralo a:  taecel_config.php
 * 2. Pega tus llaves REALES (KEY y NIP) de Taecel en su lugar.
 * 3. Sube SOLO taecel_config.php a Hostinger, en la carpeta:  api/taecel_config.php
 *    (al mismo nivel que _admin_common.php)
 *
 * IMPORTANTE: el archivo taecel_config.php NO se sube a git (está en .gitignore)
 * para que tus llaves reales nunca queden guardadas en el repositorio.
 *
 * Tiempos validados en matriz de pruebas v2 (RequestTXN + StatusTXN, mayo 2026).
 */

return [
    'key'     => 'PON_AQUI_TU_KEY_DE_TAECEL',
    'nip'     => 'PON_AQUI_TU_NIP_DE_TAECEL',
    'api_url' => 'https://app.taecel.com/api',

    // RequestTXN: timeout por petición (segundos)
    'request_txn_timeout_seconds'      => 30,
    // StatusTXN: consulta inmediata tras transID; reintento cada N segundos
    'status_poll_interval_seconds'     => 3,
    // StatusTXN: timeout por consulta individual
    'status_request_timeout_seconds'   => 10,
    // Ventana total desde el inicio de RequestTXN
    'status_max_total_seconds'         => 60,
];
