<?php
/**
 * Endpoint: pos_products.php
 * Devuelve el catálogo para el POS con precio web y precio POS separados.
 *
 * SUBIR A: api/admin/sales/pos_products.php en Hostinger
 */

require_once __DIR__ . '/../../_admin_common.php';
require_once __DIR__ . '/pos_auth.php';

adminHandleCors(['GET']);
adminRequireMethod('GET');

try {
    $pdo = adminGetPdo();
    posValidateSession($pdo);

    $cols = $pdo->query('SHOW COLUMNS FROM products')->fetchAll(PDO::FETCH_COLUMN);
    $hasPosPrice = in_array('pos_price', $cols, true);

    $imageSelect = "'' AS image";
    foreach (['image', 'image_url', 'img', 'photo', 'thumbnail'] as $imageCol) {
        if (in_array($imageCol, $cols, true)) {
            $imageSelect = "p.$imageCol AS image";
            break;
        }
    }

    $posPriceSelect = $hasPosPrice ? 'p.pos_price' : 'NULL AS pos_price';

    $sql = "
        SELECT
            p.id,
            p.name,
            p.brand,
            p.description,
            $imageSelect,
            p.price,
            $posPriceSelect,
            COALESCE(p.stock, p.stock_quantity, 0) AS stock,
            COALESCE(c.name, 'General') AS category,
            COALESCE(c.slug, '') AS category_slug,
            COALESCE(pc.name, c.name, 'General') AS parent_category,
            COALESCE(p.is_offer, 0) AS is_offer,
            p.offer_price,
            p.discount_percentage
        FROM products p
        LEFT JOIN categories c ON c.id = p.category_id
        LEFT JOIN categories pc ON pc.id = c.parent_id
        WHERE COALESCE(p.is_active, 1) = 1
        ORDER BY p.name ASC
    ";

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

        $products[] = [
            'id'                  => (int)$p['id'],
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
            'barcodes'            => $barcodesByProduct[(int)$p['id']] ?? [],
        ];
    }

    adminJsonResponse(200, [
        'ok'       => true,
        'products' => $products,
        'count'    => count($products),
    ]);
} catch (PDOException $e) {
    error_log('pos_products.php DB error: ' . $e->getMessage());
    adminJsonResponse(500, ['ok' => false, 'message' => 'DB Error: ' . $e->getMessage()]);
} catch (Throwable $e) {
    error_log('pos_products.php error: ' . $e->getMessage());
    adminJsonResponse(500, ['ok' => false, 'message' => $e->getMessage()]);
}
