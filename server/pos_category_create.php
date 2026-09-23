<?php
/**
 * Endpoint: pos_category_create.php
 * Crea una nueva categoría.
 */

require_once __DIR__ . '/../../_admin_common.php';
require_once __DIR__ . '/pos_auth.php';

adminHandleCors(['POST']);
adminRequireMethod('POST');

function posCategorySlugify(string $text): string
{
    $text = trim($text);
    if (function_exists('iconv')) {
        $converted = @iconv('UTF-8', 'ASCII//TRANSLIT', $text);
        if ($converted !== false) {
            $text = $converted;
        }
    }
    $text = strtolower($text);
    $text = preg_replace('/[^a-z0-9]+/', '-', $text);
    $text = trim($text, '-');
    if ($text === '') {
        $text = 'categoria';
    }
    return substr($text, 0, 80);
}

try {
    $pdo = adminGetPdo();
    posValidateSession($pdo);

    $data = posGetJsonBody();
    if ($data === []) {
        $data = adminReadJsonBody();
    }

    $name = trim((string)($data['name'] ?? ''));

    if ($name === '') {
        adminJsonResponse(400, ['ok' => false, 'message' => 'El nombre de la categoría es obligatorio']);
    }

    $slug = posCategorySlugify($name);

    $columnsInfo = $pdo->query('SHOW COLUMNS FROM categories')->fetchAll(PDO::FETCH_ASSOC);
    $cols = [];
    foreach ($columnsInfo as $info) {
        $cols[] = $info['Field'];
    }

    $params = ['name' => $name];
    if (in_array('slug', $cols, true)) {
        $params['slug'] = $slug;
    }
    if (in_array('parent_id', $cols, true)) {
        $params['parent_id'] = null; // Asumimos que es categoría raíz
    }

    $fields = array_keys($params);
    $placeholders = array_map(fn ($f) => ':' . $f, $fields);

    $sql = 'INSERT INTO categories (' . implode(', ', $fields) . ') VALUES (' . implode(', ', $placeholders) . ')';
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    $categoryId = (int)$pdo->lastInsertId();

    adminJsonResponse(201, [
        'ok'          => true,
        'category_id' => $categoryId,
        'name'        => $name,
        'message'     => 'Categoría creada exitosamente',
    ]);
} catch (PDOException $e) {
    error_log('pos_category_create.php DB error: ' . $e->getMessage());
    adminJsonResponse(500, ['ok' => false, 'message' => 'Error de base de datos al crear categoría']);
} catch (Throwable $e) {
    error_log('pos_category_create.php error: ' . $e->getMessage());
    adminJsonResponse(500, ['ok' => false, 'message' => 'Error interno del servidor']);
}
