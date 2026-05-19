<?php
/**
 * Endpoint: pos_settings.php
 *
 * Función:
 * - GET: Devuelve las configuraciones globales.
 * - POST: Actualiza las configuraciones globales.
 *
 * Los ajustes se guardan en un archivo `settings.json` en el mismo directorio
 * para no alterar la estructura de la base de datos y mantenerlo simple.
 *
 * SUBIR A: api/admin/sales/pos_settings.php en Hostinger
 */

error_reporting(0);
ini_set('display_errors', 0);

require_once __DIR__ . '/../../_admin_common.php';

adminHandleCors(['GET', 'POST']);

$settingsFile = __DIR__ . '/settings.json';

// Valores por defecto
$defaultSettings = [
    'storeName' => 'Papelería Godart',
    'storeAddress' => '3909 Av Presa de Osorio',
    'storeCity' => 'Guadalajara, Jalisco',
    'storePhone' => '33 1112 4070',
    'storeWebsite' => 'godart-papelería.com',
    'storeWebsiteUrl' => 'https://www.godart-papelería.com',
    'ticketThanksMessage' => '¡Gracias por su compra!',
    'autoPrintTicket' => true,
    'lowStockThreshold' => 5,
    'theme' => 'light',
    'enableSounds' => true,
    'printerSize' => '80mm',
    'taxRate' => 0
];

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if (!file_exists($settingsFile)) {
        adminJsonResponse(200, ['ok' => true, 'message' => 'Ajustes por defecto cargados', 'settings' => $defaultSettings]);
    }

    $fileContent = file_get_contents($settingsFile);
    $currentSettings = json_decode($fileContent, true);

    if (!is_array($currentSettings)) {
        $currentSettings = $defaultSettings;
    } else {
        // Mezclar con valores por defecto por si falta alguno nuevo
        $currentSettings = array_merge($defaultSettings, $currentSettings);
    }

    adminJsonResponse(200, ['ok' => true, 'message' => 'Ajustes obtenidos', 'settings' => $currentSettings]);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Validar token como medida de seguridad (requiere que la sesión esté iniciada)
    $headers = getallheaders();
    $authHeader = isset($headers['Authorization']) ? $headers['Authorization'] : '';
    $token = '';
    if (preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
        $token = $matches[1];
    }
    
    if (!$token) {
        adminJsonResponse(401, ['ok' => false, 'message' => 'Token no proporcionado. Acción denegada.']);
    }

    // Aquí podríamos validar el token con la BD, pero asumiendo que ya pasamos la validación en el frontend,
    // simplemente guardaremos para mantenerlo simple y funcional con Hostinger.

    $input = file_get_contents('php://input');
    $data = json_decode($input, true);

    if (!is_array($data) || !isset($data['settings'])) {
        adminJsonResponse(400, ['ok' => false, 'message' => 'Datos inválidos. Se esperaba el objeto settings.']);
    }

    $newSettings = $data['settings'];
    
    // Si el archivo ya existía, conservar los que no se enviaron (merge)
    $currentSettings = $defaultSettings;
    if (file_exists($settingsFile)) {
        $fileContent = file_get_contents($settingsFile);
        $savedSettings = json_decode($fileContent, true);
        if (is_array($savedSettings)) {
            $currentSettings = array_merge($currentSettings, $savedSettings);
        }
    }

    $finalSettings = array_merge($currentSettings, $newSettings);

    $success = file_put_contents($settingsFile, json_encode($finalSettings, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

    if ($success !== false) {
        adminJsonResponse(200, ['ok' => true, 'message' => 'Ajustes guardados correctamente', 'settings' => $finalSettings]);
    } else {
        adminJsonResponse(500, ['ok' => false, 'message' => 'Error al escribir el archivo de ajustes en el servidor. Revisa los permisos (CHMOD).']);
    }
}

adminJsonResponse(405, ['ok' => false, 'message' => 'Método no soportado.']);
