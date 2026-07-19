<?php
/**
 * Endpoint: pos_product_create.php
 * Crea un producto nuevo desde el inventario del POS.
 *
 * SUBIR A: api/admin/sales/pos_product_create.php en Hostinger
 */

require_once __DIR__ . '/../../_admin_common.php';
require_once __DIR__ . '/pos_auth.php';

adminHandleCors(['POST']);
adminRequireMethod('POST');

function posSlugify(string $text): string
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
        $text = 'producto';
    }
    return substr($text, 0, 80) . '-' . substr(uniqid(), -6);
}

try {
    $pdo = adminGetPdo();
    posValidateSession($pdo);

    $data = posGetJsonBody();
    if ($data === []) {
        $data = adminReadJsonBody();
    }

    $name = trim((string)($data['name'] ?? ''));
    $brand = trim((string)($data['brand'] ?? ''));
    $description = trim((string)($data['description'] ?? ''));
    $webPrice = (float)($data['price'] ?? 0);
    $posPrice = isset($data['pos_price']) && $data['pos_price'] !== '' && $data['pos_price'] !== null
        ? (float)$data['pos_price']
        : null;
    $stock = (int)($data['stock'] ?? 0);
    $categoryId = (int)($data['category_id'] ?? 0);
    $image = trim((string)($data['image'] ?? '/images/boligrafos.jpg'));

    if ($name === '') {
        adminJsonResponse(400, ['ok' => false, 'message' => 'El nombre del producto es obligatorio']);
    }
    if ($webPrice < 0) {
        adminJsonResponse(400, ['ok' => false, 'message' => 'El precio web debe ser mayor o igual a 0']);
    }
    if ($stock < 0) {
        adminJsonResponse(400, ['ok' => false, 'message' => 'El stock debe ser mayor o igual a 0']);
    }

    // Información completa de columnas: Field, Type, Null, Key, Default, Extra
    $columnsInfo = $pdo->query('SHOW COLUMNS FROM products')->fetchAll(PDO::FETCH_ASSOC);
    $cols = [];
    $colMeta = [];
    foreach ($columnsInfo as $info) {
        $cols[] = $info['Field'];
        $colMeta[$info['Field']] = $info;
    }

    // Categoría válida (si la tabla la requiere)
    if ($categoryId <= 0 && in_array('category_id', $cols, true)) {
        try {
            $catStmt = $pdo->query('SELECT id FROM categories ORDER BY id ASC LIMIT 1');
            $firstCat = $catStmt->fetch(PDO::FETCH_ASSOC);
            $categoryId = $firstCat ? (int)$firstCat['id'] : 1;
        } catch (Throwable $e) {
            $categoryId = 1;
        }
    }

    $params = [];

    $setField = function (string $col, $value) use (&$params, $cols) {
        if (in_array($col, $cols, true) && !array_key_exists($col, $params)) {
            $params[$col] = $value;
        }
    };

    $setField('name', $name);
    $setField('brand', $brand);
    $setField('description', $description);
    $setField('price', $webPrice);
    $setField('category_id', $categoryId);
    $setField('stock', $stock);
    $setField('stock_quantity', $stock);

    foreach (['image', 'image_url', 'img', 'photo', 'thumbnail'] as $imageCol) {
        if (in_array($imageCol, $cols, true)) {
            $setField($imageCol, $image !== '' ? $image : '/images/boligrafos.jpg');
            break;
        }
    }

    if (in_array('pos_price', $cols, true)) {
        $setField('pos_price', $posPrice !== null ? $posPrice : $webPrice);
    }
    if (in_array('slug', $cols, true)) {
        $setField('slug', posSlugify($name));
    }
    if (in_array('is_active', $cols, true)) {
        $setField('is_active', 1);
    }
    if (in_array('active', $cols, true)) {
        $setField('active', 1);
    }

    // Rellenar columnas NOT NULL sin valor por defecto que aún no tengan valor
    foreach ($columnsInfo as $info) {
        $field = $info['Field'];
        $isAutoIncrement = stripos($info['Extra'] ?? '', 'auto_increment') !== false;
        $allowsNull = ($info['Null'] ?? 'YES') === 'YES';
        $hasDefault = $info['Default'] !== null;
        $isGenerated = stripos($info['Extra'] ?? '', 'GENERATED') !== false;

        if ($isAutoIncrement || $isGenerated || array_key_exists($field, $params)) {
            continue;
        }
        if ($allowsNull || $hasDefault) {
            continue;
        }

        // Columna obligatoria sin valor: asignar un valor seguro según el tipo
        $type = strtolower($info['Type'] ?? '');
        if (preg_match('/int|decimal|float|double|numeric|bit/', $type)) {
            $params[$field] = 0;
        } elseif (preg_match('/datetime|timestamp/', $type)) {
            $params[$field] = date('Y-m-d H:i:s');
        } elseif (preg_match('/date/', $type)) {
            $params[$field] = date('Y-m-d');
        } elseif (strpos($field, 'slug') !== false) {
            $params[$field] = posSlugify($name);
        } else {
            $params[$field] = '';
        }
    }

    if (empty($params)) {
        adminJsonResponse(500, ['ok' => false, 'message' => 'No se encontraron columnas válidas en products']);
    }

    $fields = array_keys($params);
    $placeholders = array_map(fn ($f) => ':' . $f, $fields);

    $sql = 'INSERT INTO products (' . implode(', ', $fields) . ') VALUES (' . implode(', ', $placeholders) . ')';
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    $productId = (int)$pdo->lastInsertId();

    $barcode = trim((string)($data['barcode'] ?? ''));
    if ($barcode !== '') {
        try {
            $pdo->prepare('INSERT INTO product_barcodes (product_id, barcode) VALUES (?, ?)')
                ->execute([$productId, $barcode]);
        } catch (Throwable $e) {
            // Tabla opcional
        }
    }

    $hasPresentationsTable = adminTableExists($pdo, 'pos_product_presentations');
    if ($hasPresentationsTable) {
        try {
            $priceVal = isset($params['pos_price']) && $params['pos_price'] !== null && $params['pos_price'] !== ''
                ? (float)$params['pos_price']
                : (float)($params['price'] ?? 0.0);
            
            $pdo->prepare('
                INSERT INTO pos_product_presentations (product_id, name, barcode, units_per_sale, sale_price, is_default, is_active)
                VALUES (?, ?, ?, 1.000, ?, 1, 1)
            ')->execute([
                $productId,
                'Pieza',
                $barcode !== '' ? $barcode : null,
                $priceVal
            ]);
        } catch (Throwable $e) {
            // Ignorar fallos de presentación por defecto
        }
    }

    adminJsonResponse(201, [
        'ok'         => true,
        'product_id' => $productId,
        'message'    => 'Producto creado exitosamente',
    ]);
} catch (PDOException $e) {
    error_log('pos_product_create.php DB error: ' . $e->getMessage());
    // Mostrar el error real ayuda a diagnosticar columnas faltantes
    adminJsonResponse(500, ['ok' => false, 'message' => 'Error de base de datos: ' . $e->getMessage()]);
} catch (Throwable $e) {
    error_log('pos_product_create.php error: ' . $e->getMessage());
    adminJsonResponse(500, ['ok' => false, 'message' => $e->getMessage()]);
}
