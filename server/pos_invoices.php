<?php
/**
 * Endpoint: pos_invoices.php
 *
 * Función:
 * - GET: Obtiene los detalles de la factura asociada a un pos_sale_id.
 * - POST: Guarda los datos de una factura timbrada asociada a una venta.
 *
 * SUBIR A: api/admin/sales/pos_invoices.php en Hostinger
 */

require_once __DIR__ . '/../../_admin_common.php';

adminHandleCors(['GET', 'POST']);

try {
  $pdo = adminGetPdo();
  
  // Validación de sesión por Token
  $headers = getallheaders();
  $auth = $headers['Authorization'] ?? '';
  $token = str_replace('Bearer ', '', $auth);
  $session = $pdo->prepare("SELECT admin_user_id FROM admin_sessions WHERE token_hash = ? AND expires_at > NOW() LIMIT 1");
  $session->execute([$token]);
  $sessionData = $session->fetch();
  
  if (!$sessionData) {
      adminJsonResponse(401, ['ok' => false, 'message' => 'Sesión inválida o expirada']);
  }
  
  // 1. Asegurar que la tabla pos_invoices existe
  $pdo->query("
    CREATE TABLE IF NOT EXISTS pos_invoices (
      id INT AUTO_INCREMENT PRIMARY KEY,
      pos_sale_id INT NOT NULL,
      uuid VARCHAR(100) NOT NULL,
      invoice_number VARCHAR(50) NOT NULL,
      customer_rfc VARCHAR(13) NOT NULL,
      customer_name VARCHAR(200) NOT NULL,
      pdf_url VARCHAR(500) NULL,
      xml_url VARCHAR(500) NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'active',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_invoices_sale (pos_sale_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  ");

  // --- PROCESAR SOLICITUD GET ---
  if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $saleId = isset($_GET['sale_id']) ? (int)$_GET['sale_id'] : 0;
    
    if ($saleId <= 0) {
      adminJsonResponse(400, ['ok' => false, 'message' => 'Se requiere un pos_sale_id válido']);
    }

    $stmt = $pdo->prepare("SELECT * FROM pos_invoices WHERE pos_sale_id = ? AND status = 'active' LIMIT 1");
    $stmt->execute([$saleId]);
    $invoice = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($invoice) {
      adminJsonResponse(200, [
        'ok' => true,
        'invoice' => [
          'id' => (int)$invoice['id'],
          'saleId' => (int)$invoice['pos_sale_id'],
          'uuid' => $invoice['uuid'],
          'invoiceNumber' => $invoice['invoice_number'],
          'customerRfc' => $invoice['customer_rfc'],
          'customerName' => $invoice['customer_name'],
          'pdfUrl' => $invoice['pdf_url'],
          'xmlUrl' => $invoice['xml_url'],
          'status' => $invoice['status'],
          'createdAt' => $invoice['created_at']
        ]
      ]);
    } else {
      adminJsonResponse(200, ['ok' => false, 'message' => 'No se encontró factura para esta venta']);
    }
  }

  // --- PROCESAR SOLICITUD POST ---
  if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = adminReadJsonBody();

    $saleId = isset($data['sale_id']) ? (int)$data['sale_id'] : 0;
    $uuid = isset($data['uuid']) ? trim($data['uuid']) : '';
    $invoiceNumber = isset($data['invoice_number']) ? trim($data['invoice_number']) : '';
    $customerRfc = isset($data['customer_rfc']) ? trim($data['customer_rfc']) : '';
    $customerName = isset($data['customer_name']) ? trim($data['customer_name']) : '';
    $pdfUrl = isset($data['pdf_url']) ? trim($data['pdf_url']) : null;
    $xmlUrl = isset($data['xml_url']) ? trim($data['xml_url']) : null;

    if ($saleId <= 0 || empty($uuid) || empty($invoiceNumber) || empty($customerRfc) || empty($customerName)) {
      adminJsonResponse(400, ['ok' => false, 'message' => 'Datos de factura incompletos']);
    }

    // Verificar si la venta existe en pos_sales
    $checkSale = $pdo->prepare("SELECT id FROM pos_sales WHERE id = ?");
    $checkSale->execute([$saleId]);
    if (!$checkSale->fetch()) {
      adminJsonResponse(400, ['ok' => false, 'message' => 'La venta especificada no existe']);
    }

    // Insertar o actualizar factura
    $stmt = $pdo->prepare("
      INSERT INTO pos_invoices (pos_sale_id, uuid, invoice_number, customer_rfc, customer_name, pdf_url, xml_url, status)
      VALUES (:sale_id, :uuid, :invoice_number, :customer_rfc, :customer_name, :pdf_url, :xml_url, 'active')
      ON DUPLICATE KEY UPDATE 
        uuid = VALUES(uuid),
        invoice_number = VALUES(invoice_number),
        customer_rfc = VALUES(customer_rfc),
        customer_name = VALUES(customer_name),
        pdf_url = VALUES(pdf_url),
        xml_url = VALUES(xml_url),
        status = 'active'
    ");

    $stmt->execute([
      'sale_id' => $saleId,
      'uuid' => $uuid,
      'invoice_number' => $invoiceNumber,
      'customer_rfc' => $customerRfc,
      'customer_name' => $customerName,
      'pdf_url' => $pdfUrl,
      'xml_url' => $xmlUrl
    ]);

    adminJsonResponse(200, [
      'ok' => true,
      'message' => 'Factura registrada en base de datos correctamente',
      'invoice_id' => $pdo->lastInsertId()
    ]);
  }

} catch (PDOException $e) {
  error_log('pos_invoices.php DB error: ' . $e->getMessage());
  adminJsonResponse(500, ['ok' => false, 'message' => 'DB Error: ' . $e->getMessage()]);
} catch (Throwable $e) {
  error_log('pos_invoices.php fatal error: ' . $e->getMessage());
  adminJsonResponse(500, ['ok' => false, 'message' => 'Fatal Error: ' . $e->getMessage()]);
}
