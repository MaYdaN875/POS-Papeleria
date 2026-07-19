<?php
/**
 * Endpoint: pos_products.php
 * Devuelve el catálogo para el POS con precio web y precio POS separados.
 *
 * SUBIR A: api/admin/sales/pos_products.php en Hostinger
 */

require_once __DIR__ . '/../../_admin_common.php';

adminHandleCors(['GET']);
adminRequireMethod('GET');

// Catálogo de solo lectura: no requiere sesión.
// Los productos ya son públicos en la tienda web; aquí solo se agrega pos_price.

try {
    $pdo = adminGetPdo();

    $cols = $pdo->query('SHOW COLUMNS FROM products')->fetchAll(PDO::FETCH_COLUMN);

    $catCols = [];
    try {
        $catCols = $pdo->query('SHOW COLUMNS FROM categories')->fetchAll(PDO::FETCH_COLUMN);
    } catch (Throwable $e) {
        // Tabla categories opcional
    }

    // Helper: usa la columna solo si existe
    $col = function (string $name, string $fallbackSql) use ($cols): string {
        return in_array($name, $cols, true) ? "p.$name" : $fallbackSql;
    };

    $imageSelect = "'' ";
    foreach (['image', 'image_url', 'img', 'photo', 'thumbnail'] as $imageCol) {
        if (in_array($imageCol, $cols, true)) {
            $imageSelect = "p.$imageCol";
            break;
        }
    }

    // Stock: solo columnas que existan
    $stockParts = [];
    foreach (['stock', 'stock_quantity', 'quantity', 'qty'] as $stockCol) {
        if (in_array($stockCol, $cols, true)) {
            $stockParts[] = "p.$stockCol";
        }
    }
    $stockSelect = $stockParts
        ? 'COALESCE(' . implode(', ', $stockParts) . ', 0)'
        : '0';

    $selects = [
        'p.id',
        'p.name',
        $col('brand', "''") . ' AS brand',
        $col('description', "''") . ' AS description',
        "$imageSelect AS image",
        'p.price',
        $col('pos_price', 'NULL') . ' AS pos_price',
        "$stockSelect AS stock",
        (in_array('is_offer', $cols, true) ? 'COALESCE(p.is_offer, 0)' : '0') . ' AS is_offer',
        $col('offer_price', 'NULL') . ' AS offer_price',
        $col('discount_percentage', '0') . ' AS discount_percentage',
        $col('is_active', '1') . ' AS is_active',
        $col('base_unit', "'pieza'") . ' AS base_unit',
    ];

    $joins = '';
    $canJoinCategories = in_array('category_id', $cols, true)
        && in_array('id', $catCols, true)
        && in_array('name', $catCols, true);

    if ($canJoinCategories) {
        $selects[] = "COALESCE(c.name, 'General') AS category";
        $selects[] = in_array('slug', $catCols, true)
            ? "COALESCE(c.slug, '') AS category_slug"
            : "'' AS category_slug";
        $joins = ' LEFT JOIN categories c ON c.id = p.category_id ';

        if (in_array('parent_id', $catCols, true)) {
            $selects[] = "COALESCE(pc.name, c.name, 'General') AS parent_category";
            $joins .= ' LEFT JOIN categories pc ON pc.id = c.parent_id ';
        } else {
            $selects[] = "COALESCE(c.name, 'General') AS parent_category";
        }
    } else {
        $selects[] = "'General' AS category";
        $selects[] = "'' AS category_slug";
        $selects[] = "'General' AS parent_category";
    }

    $includeInactive = isset($_GET['include_inactive']) && $_GET['include_inactive'] == 1;
    $where = '';
    if (!$includeInactive) {
        $where = in_array('is_active', $cols, true)
            ? 'WHERE COALESCE(p.is_active, 1) = 1'
            : (in_array('active', $cols, true) ? 'WHERE COALESCE(p.active, 1) = 1' : '');
    }

    $sql = 'SELECT ' . implode(', ', $selects) . ' FROM products p ' . $joins . ' ' . $where . ' ORDER BY p.id DESC';

    $stmt = $pdo->query($sql);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $barcodesByProduct = [];
    try {
        $barcodeStmt = $pdo->query('SELECT product_id, barcode FROM product_barcodes ORDER BY product_id');
        foreach ($barcodeStmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $pid = (int)$row['product_id'];
            if (!isset($barcodesByProduct[$pid])) {
                $barcodesByProduct[$pid] = [];
            }
            $barcodesByProduct[$pid][] = $row['barcode'];
        }
    } catch (Throwable $e) {
        // Tabla opcional
    }

    $presentationsByProduct = [];
    $hasPresentationsTable = adminTableExists($pdo, 'pos_product_presentations');
    if ($hasPresentationsTable) {
        try {
            $presStmt = $pdo->query('
                SELECT id, product_id, name, barcode, units_per_sale, sale_price, is_default, is_active 
                FROM pos_product_presentations 
                ORDER BY product_id, is_default DESC, id ASC
            ');
            foreach ($presStmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
                $pid = (int)$row['product_id'];
                if (!isset($presentationsByProduct[$pid])) {
                    $presentationsByProduct[$pid] = [];
                }
                $presentationsByProduct[$pid][] = [
                    'id' => (int)$row['id'],
                    'product_id' => $pid,
                    'name' => $row['name'],
                    'barcode' => $row['barcode'],
                    'units_per_sale' => (float)$row['units_per_sale'],
                    'sale_price' => (float)$row['sale_price'],
                    'is_default' => (bool)$row['is_default'],
                    'is_active' => (bool)$row['is_active'],
                ];
            }
        } catch (Throwable $e) {
            // Ignorar errores menores
        }
    }

    $products = [];
    foreach ($rows as $p) {
        $basePrice = (float)$p['price'];
        $isOffer = !empty($p['is_offer']);
        $offerPrice = isset($p['offer_price']) ? (float)$p['offer_price'] : null;
        $discount = (int)($p['discount_percentage'] ?? 0);

        $webFinal = $basePrice;
        if ($isOffer && $offerPrice !== null && $offerPrice > 0) {
            $webFinal = $offerPrice;
        } elseif ($discount > 0) {
            $webFinal = round($basePrice * (1 - $discount / 100), 2);
        }

        $posPrice = isset($p['pos_price']) && $p['pos_price'] !== null
            ? (float)$p['pos_price']
            : null;

        $pId = (int)$p['id'];
        $presentations = isset($presentationsByProduct[$pId]) ? $presentationsByProduct[$pId] : [];
        if (empty($presentations)) {
            $firstBarcode = isset($barcodesByProduct[$pId][0]) ? $barcodesByProduct[$pId][0] : null;
            $presentations = [
                [
                    'id' => 0,
                    'product_id' => $pId,
                    'name' => 'Pieza',
                    'barcode' => $firstBarcode,
                    'units_per_sale' => 1.000,
                    'sale_price' => $posPrice !== null ? $posPrice : $basePrice,
                    'is_default' => true,
                    'is_active' => true,
                ]
            ];
        }

        $products[] = [
            'id'                  => $pId,
            'name'                => $p['name'],
            'brand'               => $p['brand'] ?? '',
            'description'         => $p['description'] ?? '',
            'image'               => $p['image'] ?: '/images/boligrafos.jpg',
            'stock'               => (int)$p['stock'],
            'original_price'      => $basePrice,
            'final_price'         => $webFinal,
            'web_final_price'     => $webFinal,
            'pos_price'           => $posPrice,
            'is_offer'            => $isOffer,
            'offer_price'         => $offerPrice,
            'discount_percentage' => $discount,
            'category'            => $p['category'],
            'category_slug'       => $p['category_slug'],
            'parent_category'     => $p['parent_category'],
            'barcodes'            => $barcodesByProduct[$pId] ?? [],
            'is_active'           => isset($p['is_active']) ? (int)$p['is_active'] : 1,
            'base_unit'           => $p['base_unit'] ?? 'pieza',
            'presentations'       => $presentations,
        ];
    }

    adminJsonResponse(200, [
        'ok'       => true,
        'products' => $products,
        'count'    => count($products),
        'version'  => 'v4-publico-dinamico',
    ]);
} catch (PDOException $e) {
    error_log('pos_products.php DB error: ' . $e->getMessage());
    adminJsonResponse(500, ['ok' => false, 'message' => 'DB Error: ' . $e->getMessage()]);
} catch (Throwable $e) {
    error_log('pos_products.php error: ' . $e->getMessage());
    adminJsonResponse(500, ['ok' => false, 'message' => $e->getMessage()]);
}
