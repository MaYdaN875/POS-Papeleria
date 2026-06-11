<?php
/**
 * DEPRECATED: El POS usa api/admin/auth/login.php (mismo login que la web).
 * Este archivo redirige la petición para no romper instalaciones viejas.
 *
 * SUBIR A: api/admin/auth/pos_login.php en Hostinger (opcional)
 */

require_once __DIR__ . '/../../_admin_common.php';

adminHandleCors(['POST']);
adminRequireMethod('POST');

$loginScript = __DIR__ . '/login.php';
if (is_file($loginScript)) {
    require $loginScript;
    exit;
}

adminJsonResponse(500, [
    'ok' => false,
    'message' => 'Usa api/admin/auth/login.php para iniciar sesión en el POS',
]);
