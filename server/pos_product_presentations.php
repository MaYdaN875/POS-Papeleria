<?php
/**
 * Endpoint: pos_product_presentations.php
 * Gestiona CRUD de las presentaciones de venta de un producto.
 *
 * SUBIR A: api/admin/sales/pos_product_presentations.php en Hostinger
 */

require_once __DIR__ . '/../../_admin_common.php';

adminHandleCors(['POST', 'OPTIONS']);
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

if (!function_exists('adminTableExists')) {
    function adminTableExists($pdo, $tableName) {
        try {
            $result = $pdo->query("SELECT 1 FROM {$tableName} LIMIT 1");
            return $result !== false;
        } catch (Throwable $e) {
            return false;
        }
    }
}

try {
    $pdo = adminGetPdo();
    
    // Leer el cuerpo crudo de la petición una sola vez
    $rawBody = file_get_contents('php://input') ?: '';
    $data = json_decode($rawBody, true) ?: [];
    
    // Auth check (resolver token)
    $token = '';
    if (!empty($_GET['access_token'])) {
        $token = trim((string)$_GET['access_token']);
    } elseif (!empty($_POST['access_token'])) {
        $token = trim((string)$_POST['access_token']);
    }
    if ($token === '') {
        if (!empty($data['access_token'])) {
            $token = trim((string)$data['access_token']);
        }
    }
    if ($token === '') {
        adminJsonResponse(401, ['ok' => false, 'message' => 'Sesión inválida o expirada']);
    }
    
    // Validar sesión
    $sessionCols = $pdo->query('SHOW COLUMNS FROM admin_sessions')->fetchAll(PDO::FETCH_COLUMN);
    $colsToTry = [];
    if (in_array('token_hash', $sessionCols, true)) $colsToTry[] = 'token_hash';
    if (in_array('token', $sessionCols, true)) $colsToTry[] = 'token';
    
    $candidates = array_values(array_unique([$token, hash('sha256', $token), hash('sha256', 'pos:' . $token)]));
    $sessionData = false;
    foreach ($colsToTry as $col) {
        foreach ($candidates as $candidate) {
            $stmt = $pdo->prepare("SELECT admin_user_id FROM admin_sessions WHERE {$col} = ? AND expires_at > NOW() LIMIT 1");
            $stmt->execute([$candidate]);
            $sessionData = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($sessionData) break 2;
        }
    }
    
    if (!$sessionData) {
        adminJsonResponse(401, ['ok' => false, 'message' => 'Sesión inválida o expirada']);
    }
    
    $adminId = (int)$sessionData['admin_user_id'];
    
    // Validar rol de administrador
    $userStmt = $pdo->prepare("SELECT role FROM admin_users WHERE id = ? LIMIT 1");
    $userStmt->execute([$adminId]);
    $userRole = strtolower((string)$userStmt->fetchColumn());
    
    if ($userRole !== 'admin') {
        adminJsonResponse(403, ['ok' => false, 'message' => 'Acceso denegado. Se requieren permisos de administrador.']);
    }
    
    $action = isset($data['action']) ? (string)$data['action'] : '';
    
    if ($action === 'save') {
        $id = isset($data['id']) ? (int)$data['id'] : 0;
        $productId = isset($data['product_id']) ? (int)$data['product_id'] : 0;
        $name = trim(isset($data['name']) ? (string)$data['name'] : '');
        $barcode = trim(isset($data['barcode']) ? (string)$data['barcode'] : '');
        $unitsPerSale = isset($data['units_per_sale']) ? (float)$data['units_per_sale'] : 1.0;
        $salePrice = isset($data['sale_price']) ? (float)$data['sale_price'] : 0.0;
        $isDefault = isset($data['is_default']) ? (int)$data['is_default'] : 0;
        $isActive = isset($data['is_active']) ? (int)$data['is_active'] : 1;
        
        if ($productId <= 0 || $name === '' || $unitsPerSale <= 0 || $salePrice < 0) {
            adminJsonResponse(400, ['ok' => false, 'message' => 'Datos de presentación inválidos']);
        }
        
        if ($barcode === '') {
            $barcode = null;
        }
        
        if ($isDefault == 1) {
            // Desmarcar otros por defecto
            $pdo->prepare('UPDATE pos_product_presentations SET is_default = 0 WHERE product_id = ?')
                ->execute([$productId]);
        }
        
        if ($id > 0) {
            // Update
            $stmt = $pdo->prepare('
                UPDATE pos_product_presentations 
                SET name = ?, barcode = ?, units_per_sale = ?, sale_price = ?, is_default = ?, is_active = ?
                WHERE id = ? AND product_id = ?
            ');
            $stmt->execute([$name, $barcode, $unitsPerSale, $salePrice, $isDefault, $isActive, $id, $productId]);
            
            if ($isDefault == 1) {
                $pdo->prepare('UPDATE products SET pos_price = ? WHERE id = ?')
                    ->execute([$salePrice, $productId]);
            }
        } else {
            // Insert
            $stmt = $pdo->prepare('
                INSERT INTO pos_product_presentations (product_id, name, barcode, units_per_sale, sale_price, is_default, is_active)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ');
            $stmt->execute([$productId, $name, $barcode, $unitsPerSale, $salePrice, $isDefault, $isActive]);
            $id = (int)$pdo->lastInsertId();
            
            if ($isDefault == 1) {
                $pdo->prepare('UPDATE products SET pos_price = ? WHERE id = ?')
                    ->execute([$salePrice, $productId]);
            }
        }
        
        // Sincronizar barcodes de la presentación con la tabla product_barcodes para mantener compatibilidad
        if ($barcode !== null) {
            try {
                // Borrar si existía en product_barcodes para este producto y código
                $pdo->prepare('DELETE FROM product_barcodes WHERE product_id = ? AND barcode = ?')
                    ->execute([$productId, $barcode]);
                // Insertar
                $pdo->prepare('INSERT INTO product_barcodes (product_id, barcode) VALUES (?, ?)')
                    ->execute([$productId, $barcode]);
            } catch (Throwable $e) {}
        }
        
        adminJsonResponse(200, ['ok' => true, 'message' => 'Presentación guardada con éxito', 'id' => $id]);
        
    } elseif ($action === 'delete') {
        $id = isset($data['id']) ? (int)$data['id'] : 0;
        $productId = isset($data['product_id']) ? (int)$data['product_id'] : 0;
        
        if ($id <= 0 || $productId <= 0) {
            adminJsonResponse(400, ['ok' => false, 'message' => 'ID inválida']);
        }
        
        // No permitir borrar la presentación por defecto
        $stmtCheck = $pdo->prepare('SELECT is_default, barcode FROM pos_product_presentations WHERE id = ? LIMIT 1');
        $stmtCheck->execute([$id]);
        $row = $stmtCheck->fetch(PDO::FETCH_ASSOC);
        if ($row && $row['is_default'] == 1) {
            adminJsonResponse(400, ['ok' => false, 'message' => 'No se puede eliminar la presentación por defecto del producto']);
        }
        
        $pdo->prepare('DELETE FROM pos_product_presentations WHERE id = ? AND product_id = ?')
            ->execute([$id, $productId]);
            
        if ($row && !empty($row['barcode'])) {
            try {
                $pdo->prepare('DELETE FROM product_barcodes WHERE product_id = ? AND barcode = ?')
                    ->execute([$productId, $row['barcode']]);
            } catch (Throwable $e) {}
        }
        
        adminJsonResponse(200, ['ok' => true, 'message' => 'Presentación eliminada con éxito']);
        
    } else {
        adminJsonResponse(400, ['ok' => false, 'message' => 'Acción no permitida']);
    }
    
} catch (PDOException $e) {
    adminJsonResponse(500, ['ok' => false, 'message' => 'Error de Base de Datos: ' . $e->getMessage()]);
} catch (Throwable $e) {
    adminJsonResponse(500, ['ok' => false, 'message' => 'Error General: ' . $e->getMessage()]);
}
