<?php
require_once __DIR__ . '/../../_admin_common.php';

try {
    $pdo = adminGetPdo();
    $columns = $pdo->query('SHOW COLUMNS FROM products')->fetchAll(PDO::FETCH_ASSOC);
    echo "<h1>Columnas de la tabla products:</h1><pre>";
    foreach ($columns as $col) {
        echo $col['Field'] . "\n";
    }
    echo "</pre>";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
