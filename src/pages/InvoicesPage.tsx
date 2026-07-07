import { useState, useEffect } from 'react';
import { 
  Search, 
  FileText, 
  CheckCircle2, 
  Printer, 
  Download, 
  RefreshCw, 
  Trash2, 
  Plus, 
  Edit, 
  AlertTriangle, 
  Users
} from 'lucide-react';
import { 
  getAllInvoices, 
  updateInvoiceStatus, 
  saveInvoiceToBackend, 
  getInvoiceBySaleId,
  BackendInvoice 
} from '../services/invoicing/backendService';
import { 
  getAllCustomers, 
  saveCustomer, 
  deleteCustomer 
} from '../services/invoicing/customerService';
import { InvoiceService } from '../services/invoicing/InvoiceService';
import { getSalesHistory } from '../services/dashboardService';
import { getGlobalSettings, GlobalSettings } from '../services/settingsService';
import { 
  REGIMENES_FISCALES, 
  USOS_CFDI, 
  Customer, 
  InvoiceCustomer 
} from '../types/invoicing';
import '../styles/ReportsPage.css'; // Reutilizar estilos de reportes para consistencia

export default function InvoicesPage() {
  const [activeTab, setActiveTab] = useState<'history' | 'billing' | 'customers'>('history');
  const [settings, setSettings] = useState<GlobalSettings | null>(null);

  // Historial de Facturas
  const [invoicesList, setInvoicesList] = useState<BackendInvoice[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Cancelación SAT Modal
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [invoiceToCancel, setInvoiceToCancel] = useState<BackendInvoice | null>(null);
  const [cancelMotive, setCancelMotive] = useState('02');
  const [substituteUuid, setSubstituteUuid] = useState('');
  const [cancellingLoading, setCancellingLoading] = useState(false);
  const [cancelError, setCancelError] = useState('');

  // Clientes Frecuentes
  const [customersList, setCustomersList] = useState<Customer[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  
  // Cliente Add/Edit Modal
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [customerForm, setCustomerForm] = useState<Customer>({
    rfc: '',
    razonSocial: '',
    regimenFiscal: '601',
    codigoPostal: '',
    email: ''
  });
  const [customerModalError, setCustomerModalError] = useState('');
  const [customerSaving, setCustomerSaving] = useState(false);

  // Facturar Venta Anterior
  const [searchSaleId, setSearchSaleId] = useState('');
  const [searchedSale, setSearchedSale] = useState<any | null>(null);
  const [searchedInvoice, setSearchedInvoice] = useState<BackendInvoice | null>(null);
  const [searchingSale, setSearchingSale] = useState(false);
  const [searchError, setSearchError] = useState('');
  
  // Formulario Facturación Retroactiva
  const [billingCustomer, setBillingCustomer] = useState<InvoiceCustomer>({
    rfc: '',
    razonSocial: '',
    regimenFiscal: '601',
    codigoPostal: '',
    email: ''
  });
  const [billingUsoCFDI, setBillingUsoCFDI] = useState('G03');
  const [retroBillingLoading, setRetroBillingLoading] = useState(false);
  const [retroBillingError, setRetroBillingError] = useState('');

  // Autocomplete cliente frecuente en Factura Retroactiva
  const [selectedFrequentClientId, setSelectedFrequentClientId] = useState('');

  // Carga inicial
  useEffect(() => {
    getGlobalSettings().then(res => {
      if (res.ok && res.settings) {
        setSettings(res.settings);
      }
    });
    fetchInvoices();
    fetchCustomers();
  }, []);

  const fetchInvoices = async () => {
    setLoadingHistory(true);
    try {
      const list = await getAllInvoices();
      setInvoicesList(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingHistory(false);
    }
  };

  const fetchCustomers = async () => {
    setLoadingCustomers(true);
    try {
      const list = await getAllCustomers();
      setCustomersList(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingCustomers(false);
    }
  };

  // --- CONSULTA ESTATUS SAT ---
  const handleCheckStatus = async (invoice: BackendInvoice) => {
    try {
      alert(`Consultando estado SAT para la factura ${invoice.invoiceNumber}...`);
      const res = await InvoiceService.checkInvoiceStatus(invoice.uuid);
      if (res.success) {
        alert(`Estatus SAT obtenido: ${res.status}\n\nDetalle:\n${res.message}`);
        // Si el estatus en el SAT es cancelado pero localmente no, lo actualizamos en la BD
        const satStatusLower = String(res.status).toLowerCase();
        if (satStatusLower.includes('cancelado') && invoice.status !== 'cancelled') {
          await updateInvoiceStatus(invoice.saleId, 'cancelled');
          fetchInvoices();
        }
      } else {
        alert(`No se pudo verificar el estatus: ${res.message}`);
      }
    } catch (err: any) {
      alert(`Error al conectar con el SAT: ${err.message || 'Desconocido'}`);
    }
  };

  // --- CANCELACIÓN FACTURA ---
  const handleOpenCancelModal = (invoice: BackendInvoice) => {
    setInvoiceToCancel(invoice);
    setCancelMotive('02');
    setSubstituteUuid('');
    setCancelError('');
    setShowCancelModal(true);
  };

  const handleCancelInvoiceConfirm = async () => {
    if (!invoiceToCancel) return;
    
    if (cancelMotive === '01' && !substituteUuid.trim()) {
      setCancelError('Para el motivo 01, debe ingresar el UUID de sustitución fiscal.');
      return;
    }

    setCancellingLoading(true);
    setCancelError('');
    try {
      const res = await InvoiceService.cancelInvoice(
        invoiceToCancel.uuid, 
        cancelMotive, 
        cancelMotive === '01' ? substituteUuid.trim() : undefined
      );

      if (res.success) {
        // Actualizar base de datos local
        const updateRes = await updateInvoiceStatus(invoiceToCancel.saleId, 'cancelled');
        if (updateRes.ok) {
          alert('La factura ha sido cancelada exitosamente ante el SAT y marcada como cancelada en el POS.');
        } else {
          alert('La factura se canceló ante el SAT, pero ocurrió un error al actualizar el estatus local.');
        }
        setShowCancelModal(false);
        fetchInvoices();
      } else {
        setCancelError(res.message || 'Error al cancelar la factura en el proveedor.');
      }
    } catch (err: any) {
      setCancelError(err.message || 'Error al procesar la cancelación.');
    } finally {
      setCancellingLoading(false);
    }
  };

  // --- BUSCAR VENTA ANTERIOR ---
  const handleSearchSale = async () => {
    if (!searchSaleId.trim()) {
      setSearchError('Ingrese un ID de Ticket');
      return;
    }

    const saleId = parseInt(searchSaleId.trim());
    if (isNaN(saleId)) {
      setSearchError('El ID del ticket debe ser un valor numérico');
      return;
    }

    setSearchingSale(true);
    setSearchError('');
    setSearchedSale(null);
    setSearchedInvoice(null);
    setSelectedFrequentClientId('');
    setBillingCustomer({
      rfc: '',
      razonSocial: '',
      regimenFiscal: '601',
      codigoPostal: '',
      email: ''
    });

    try {
      const res = await getSalesHistory({ sale_id: saleId });
      if (res.ok && res.sale) {
        setSearchedSale(res.sale);
        
        // Consultar si ya tiene factura asociada
        const invRes = await getInvoiceBySaleId(saleId);
        if (invRes.ok && invRes.invoice) {
          setSearchedInvoice(invRes.invoice);
        }
      } else {
        setSearchError(res.message || 'No se encontró venta registrada con ese número de ticket.');
      }
    } catch (e: any) {
      setSearchError(e.message || 'Error de red al buscar el ticket.');
    } finally {
      setSearchingSale(false);
    }
  };

  // --- EMITIR FACTURA RETROACTIVA ---
  const handleRetroBilling = async () => {
    if (!searchedSale) return;

    const { rfc, razonSocial, codigoPostal, email } = billingCustomer;
    if (!rfc || !razonSocial || !codigoPostal || !email) {
      setRetroBillingError('Complete todos los campos fiscales del cliente.');
      return;
    }

    const rfcRegex = /^[A-Z&Ñ]{3,4}\d{6}[A-Z\d]{3}$/i;
    if (!rfcRegex.test(rfc)) {
      setRetroBillingError('El RFC ingresado no tiene un formato válido.');
      return;
    }

    if (codigoPostal.length !== 5) {
      setRetroBillingError('El Código Postal debe ser de 5 dígitos.');
      return;
    }

    setRetroBillingLoading(true);
    setRetroBillingError('');

    try {
      const items = searchedSale.items.map((item: any) => ({
        productId: item.product_id,
        name: item.product_name,
        quantity: item.quantity,
        price: item.unit_price,
        taxRate: settings?.taxRate || 0,
        claveProdServ: '01010101',
        claveUnidad: 'H87'
      }));

      const taxRate = settings?.taxRate || 0;
      const subtotalVal = parseFloat(searchedSale.subtotal);
      const totalVal = parseFloat(searchedSale.total);
      const taxVal = subtotalVal * taxRate / 100;

      const res = await InvoiceService.createInvoice({
        saleId: searchedSale.id,
        paymentMethod: searchedSale.payment_method,
        customer: billingCustomer,
        usoCFDI: billingUsoCFDI,
        items,
        subtotal: subtotalVal,
        taxAmount: taxVal,
        total: totalVal
      });

      if (res.success && res.uuid) {
        const backendPayload = {
          sale_id: searchedSale.id,
          uuid: res.uuid,
          invoice_number: res.invoiceNumber || 'CFDI',
          customer_rfc: billingCustomer.rfc,
          customer_name: billingCustomer.razonSocial,
          pdf_url: res.pdfUrl,
          xml_url: res.xmlUrl
        };

        await saveInvoiceToBackend(backendPayload);

        // Si es cliente nuevo y se desea guardar en clientes frecuentes
        // Se puede sugerir por confirm
        const existsCustomer = customersList.some(c => c.rfc === billingCustomer.rfc);
        if (!existsCustomer) {
          const saveToFrequent = window.confirm('¿Desea agregar este cliente a su catálogo de Clientes Frecuentes?');
          if (saveToFrequent) {
            await saveCustomer({
              rfc: billingCustomer.rfc,
              razonSocial: billingCustomer.razonSocial,
              regimenFiscal: billingCustomer.regimenFiscal,
              codigoPostal: billingCustomer.codigoPostal,
              email: billingCustomer.email
            });
            fetchCustomers();
          }
        }

        setSearchedInvoice({
          id: 0,
          saleId: searchedSale.id,
          uuid: res.uuid,
          invoiceNumber: res.invoiceNumber || 'CFDI',
          customerRfc: billingCustomer.rfc,
          customerName: billingCustomer.razonSocial,
          pdfUrl: res.pdfUrl,
          xmlUrl: res.xmlUrl,
          status: 'active',
          createdAt: new Date().toISOString()
        });

        fetchInvoices();
      } else {
        setRetroBillingError(res.message || 'Ocurrió un error al timbrar en Factura.com.');
      }
    } catch (e: any) {
      setRetroBillingError(e.message || 'Error de conexión.');
    } finally {
      setRetroBillingLoading(false);
    }
  };

  const handleSelectFrequentClient = (idStr: string) => {
    setSelectedFrequentClientId(idStr);
    if (!idStr) {
      setBillingCustomer({
        rfc: '',
        razonSocial: '',
        regimenFiscal: '601',
        codigoPostal: '',
        email: ''
      });
      return;
    }

    const c = customersList.find(cust => cust.id === parseInt(idStr));
    if (c) {
      setBillingCustomer({
        rfc: c.rfc,
        razonSocial: c.razonSocial,
        regimenFiscal: c.regimenFiscal,
        codigoPostal: c.codigoPostal,
        email: c.email
      });
    }
  };

  // --- CRUD CLIENTES FRECUENTES ---
  const handleOpenCustomerModal = (customer: Customer | null = null) => {
    setEditingCustomer(customer);
    setCustomerModalError('');
    setCustomerSaving(false);
    
    if (customer) {
      setCustomerForm({
        rfc: customer.rfc,
        razonSocial: customer.razonSocial,
        regimenFiscal: customer.regimenFiscal,
        codigoPostal: customer.codigoPostal,
        email: customer.email
      });
    } else {
      setCustomerForm({
        rfc: '',
        razonSocial: '',
        regimenFiscal: '601',
        codigoPostal: '',
        email: ''
      });
    }
    
    setShowCustomerModal(true);
  };

  const handleSaveCustomerSubmit = async () => {
    const { rfc, razonSocial, codigoPostal, email } = customerForm;

    if (!rfc || !razonSocial || !codigoPostal || !email) {
      setCustomerModalError('Complete todos los campos del formulario');
      return;
    }

    const rfcRegex = /^[A-Z&Ñ]{3,4}\d{6}[A-Z\d]{3}$/i;
    if (!rfcRegex.test(rfc)) {
      setCustomerModalError('Formato de RFC no válido');
      return;
    }

    if (codigoPostal.length !== 5) {
      setCustomerModalError('Código Postal debe tener 5 dígitos');
      return;
    }

    setCustomerSaving(true);
    setCustomerModalError('');
    try {
      const res = await saveCustomer(customerForm);
      if (res.ok) {
        setShowCustomerModal(false);
        fetchCustomers();
      } else {
        setCustomerModalError(res.message || 'Error al guardar el cliente');
      }
    } catch (err: any) {
      setCustomerModalError(err.message || 'Error al conectar con el POS.');
    } finally {
      setCustomerSaving(false);
    }
  };

  const handleDeleteCustomerClick = async (customer: Customer) => {
    const confirmDelete = window.confirm(`¿Seguro que desea eliminar a "${customer.razonSocial}" (${customer.rfc}) del catálogo de clientes frecuentes?`);
    if (!confirmDelete) return;

    try {
      const res = await deleteCustomer(customer.rfc);
      if (res.ok) {
        fetchCustomers();
      } else {
        alert(res.message || 'Error al eliminar el cliente');
      }
    } catch (err: any) {
      alert(err.message || 'Error de conexión');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    const safeDate = dateString.includes('T') ? dateString : dateString.replace(' ', 'T');
    const utcDate = safeDate.includes('Z') ? safeDate : `${safeDate}Z`;
    return new Date(utcDate).toLocaleString('es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="reports-page">
      <div className="reports-header no-print">
        <div>
          <h1 className="reports-title">Módulo de Facturación</h1>
          <p className="reports-subtitle">Administra tus CFDIs, timbra tickets de compras anteriores y gestiona perfiles fiscales.</p>
        </div>
        
        <div className="reports-actions">
          {activeTab === 'history' && (
            <button className="reports-print-btn" onClick={fetchInvoices} disabled={loadingHistory}>
              <RefreshCw size={18} className={loadingHistory ? "settings-spinner" : ""} />
              <span>Sincronizar</span>
            </button>
          )}
          {activeTab === 'customers' && (
            <button className="reports-print-btn" onClick={() => handleOpenCustomerModal(null)} style={{ background: 'var(--color-primary)', color: '#fff' }}>
              <Plus size={18} />
              <span>Agregar Cliente</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="reports-tabs no-print" style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button 
          className={`payment-method-btn ${activeTab === 'history' ? 'payment-method-btn--active' : ''}`}
          style={{ padding: '10px 18px', borderRadius: '8px', border: '1px solid var(--border-light)', background: activeTab === 'history' ? 'var(--color-primary-light)' : 'transparent', color: activeTab === 'history' ? 'var(--color-primary)' : 'inherit', fontWeight: activeTab === 'history' ? 'bold' : 'normal', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
          onClick={() => setActiveTab('history')}
        >
          <FileText size={18} /> Historial de Facturas
        </button>
        <button 
          className={`payment-method-btn ${activeTab === 'billing' ? 'payment-method-btn--active' : ''}`}
          style={{ padding: '10px 18px', borderRadius: '8px', border: '1px solid var(--border-light)', background: activeTab === 'billing' ? 'var(--color-primary-light)' : 'transparent', color: activeTab === 'billing' ? 'var(--color-primary)' : 'inherit', fontWeight: activeTab === 'billing' ? 'bold' : 'normal', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
          onClick={() => setActiveTab('billing')}
        >
          <Printer size={18} /> Facturar Venta Anterior
        </button>
        <button 
          className={`payment-method-btn ${activeTab === 'customers' ? 'payment-method-btn--active' : ''}`}
          style={{ padding: '10px 18px', borderRadius: '8px', border: '1px solid var(--border-light)', background: activeTab === 'customers' ? 'var(--color-primary-light)' : 'transparent', color: activeTab === 'customers' ? 'var(--color-primary)' : 'inherit', fontWeight: activeTab === 'customers' ? 'bold' : 'normal', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
          onClick={() => setActiveTab('customers')}
        >
          <Users size={18} /> Clientes Frecuentes
        </button>
      </div>

      {/* CONTENIDO TAB: HISTORIAL */}
      {activeTab === 'history' && (
        <div className="reports-list-container">
          <h2 className="reports-section-title">Historial de CFDIs Emitidos</h2>
          {loadingHistory ? (
            <div className="reports-loading">Cargando facturas...</div>
          ) : invoicesList.length === 0 ? (
            <div className="reports-empty">
              <FileText size={48} />
              <p>No se han encontrado facturas timbradas en este sistema POS.</p>
            </div>
          ) : (
            <div className="reports-table-wrapper">
              <table className="reports-table">
                <thead>
                  <tr>
                    <th>Folio</th>
                    <th>RFC Cliente / Razón Social</th>
                    <th>Venta Total</th>
                    <th>Fecha Emisión</th>
                    <th>Estatus SAT</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {invoicesList.map((invoice) => (
                    <tr key={invoice.id} className="reports-row">
                      <td className="reports-col-id" style={{ fontWeight: 'bold' }}>{invoice.invoiceNumber}</td>
                      <td>
                        <div style={{ fontSize: '13px', fontWeight: 600 }}>{invoice.customerName}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{invoice.customerRfc}</div>
                      </td>
                      <td style={{ color: 'var(--color-primary)', fontWeight: 600 }}>{formatCurrency(invoice.saleTotal || 0)}</td>
                      <td style={{ fontSize: '12px' }}>{formatDate(invoice.createdAt)}</td>
                      <td>
                        <span className={`reports-badge reports-badge--${invoice.status === 'active' ? 'cash' : 'transfer'}`} style={{ textTransform: 'uppercase', fontSize: '10px', background: invoice.status === 'cancelled' ? '#fee2e2' : '#dcfce7', color: invoice.status === 'cancelled' ? '#991b1b' : '#166534' }}>
                          {invoice.status === 'active' ? 'VIGENTE' : 'CANCELADA'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          {invoice.pdfUrl && (
                            <a href={invoice.pdfUrl} target="_blank" rel="noreferrer" className="reports-print-btn" title="Descargar PDF" style={{ padding: '6px', height: 'auto', display: 'flex', background: 'rgba(0,0,0,0.03)', border: '1px solid var(--border-light)' }}>
                              <Download size={14} style={{ color: '#0369a1' }} />
                            </a>
                          )}
                          {invoice.xmlUrl && (
                            <a href={invoice.xmlUrl} target="_blank" rel="noreferrer" className="reports-print-btn" title="Descargar XML" style={{ padding: '6px', height: 'auto', display: 'flex', background: 'rgba(0,0,0,0.03)', border: '1px solid var(--border-light)' }}>
                              <FileText size={14} style={{ color: '#b45309' }} />
                            </a>
                          )}
                          <button onClick={() => handleCheckStatus(invoice)} className="reports-print-btn" title="Verificar Estatus SAT" style={{ padding: '6px', height: 'auto', display: 'flex', background: 'rgba(0,0,0,0.03)', border: '1px solid var(--border-light)' }}>
                            <RefreshCw size={14} style={{ color: '#166534' }} />
                          </button>
                          {invoice.status === 'active' && (
                            <button onClick={() => handleOpenCancelModal(invoice)} className="reports-print-btn" title="Cancelar Factura" style={{ padding: '6px', height: 'auto', display: 'flex', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                              <Trash2 size={14} style={{ color: '#ef4444' }} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* CONTENIDO TAB: FACTURAR VENTA ANTERIOR */}
      {activeTab === 'billing' && (
        <div className="reports-list-container" style={{ padding: '24px' }}>
          <h2 className="reports-section-title" style={{ marginBottom: '16px' }}>Facturar Ticket Anterior</h2>
          
          {/* Buscador de venta */}
          <div style={{ display: 'flex', gap: '10px', maxWidth: '500px', marginBottom: '24px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <input 
                type="text" 
                placeholder="Ingrese Folio o ID de ticket (ej. 142)"
                value={searchSaleId}
                onChange={(e) => setSearchSaleId(e.target.value)}
                style={{ width: '100%', padding: '10px 12px 10px 38px', borderRadius: '8px', border: '1px solid var(--border-light)', fontSize: '14px', background: 'var(--color-bg-card)', color: 'inherit' }}
                onKeyDown={(e) => e.key === 'Enter' && handleSearchSale()}
              />
              <Search size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
            </div>
            <button 
              className="reports-print-btn" 
              onClick={handleSearchSale}
              disabled={searchingSale}
              style={{ background: 'var(--color-primary)', color: '#fff', height: 'auto', padding: '10px 20px', borderRadius: '8px' }}
            >
              {searchingSale ? 'Buscando...' : 'Buscar Venta'}
            </button>
          </div>

          {searchError && (
            <div style={{ backgroundColor: 'var(--color-danger-bg)', color: 'var(--color-danger)', padding: '14px', borderRadius: '8px', marginBottom: '20px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={16} />
              <span>{searchError}</span>
            </div>
          )}

          {/* Venta encontrada */}
          {searchedSale && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'start' }} className="animate-fade-in">
              {/* Resumen Ticket */}
              <div style={{ background: 'var(--color-bg-card)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 600, borderBottom: '1px solid var(--border-light)', paddingBottom: '10px', marginBottom: '14px' }}>Detalles del Ticket #{searchedSale.id}</h3>
                <div style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px' }}>
                  <div><strong>Fecha y Hora:</strong> {formatDate(searchedSale.created_at)}</div>
                  <div><strong>Cajero:</strong> {searchedSale.cashier_name || 'Admin'}</div>
                  <div><strong>Método de pago:</strong> <span style={{ textTransform: 'capitalize' }}>{searchedSale.payment_method}</span></div>
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginBottom: '14px' }}>
                  <thead>
                    <tr style={{ background: 'rgba(0,0,0,0.02)', textAlign: 'left' }}>
                      <th style={{ padding: '6px' }}>Cant</th>
                      <th style={{ padding: '6px' }}>Producto</th>
                      <th style={{ padding: '6px', textAlign: 'right' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {searchedSale.items.map((item: any, idx: number) => (
                      <tr key={idx} style={{ borderBottom: '1px solid rgba(0,0,0,0.02)' }}>
                        <td style={{ padding: '6px' }}>{item.quantity}x</td>
                        <td style={{ padding: '6px' }}>{item.product_name}</td>
                        <td style={{ padding: '6px', textAlign: 'right' }}>{formatCurrency(Number(item.total_price))}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={2} style={{ padding: '6px', textAlign: 'right' }}><strong>Subtotal:</strong></td>
                      <td style={{ padding: '6px', textAlign: 'right' }}>{formatCurrency(Number(searchedSale.subtotal))}</td>
                    </tr>
                    <tr>
                      <td colSpan={2} style={{ padding: '6px', textAlign: 'right' }}><strong>Total:</strong></td>
                      <td style={{ padding: '6px', textAlign: 'right', fontSize: '14px', fontWeight: 'bold', color: 'var(--color-primary)' }}>{formatCurrency(Number(searchedSale.total))}</td>
                    </tr>
                  </tfoot>
                </table>

                {searchedInvoice && (
                  <div style={{ background: '#dcfce7', border: '1px solid #166534', borderRadius: '8px', padding: '12px', color: '#166534', fontSize: '13px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <CheckCircle2 size={16} />
                      <strong>Esta venta ya cuenta con factura: {searchedInvoice.invoiceNumber}</strong>
                    </div>
                    <div style={{ fontSize: '11px', fontFamily: 'monospace', wordBreak: 'break-all', marginBottom: '8px' }}>UUID: {searchedInvoice.uuid}</div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      {searchedInvoice.pdfUrl && <a href={searchedInvoice.pdfUrl} target="_blank" rel="noreferrer" style={{ background: '#166534', color: '#fff', padding: '4px 8px', borderRadius: '4px', textDecoration: 'none', fontSize: '11px' }}>Descargar PDF</a>}
                      {searchedInvoice.xmlUrl && <a href={searchedInvoice.xmlUrl} target="_blank" rel="noreferrer" style={{ background: '#166534', color: '#fff', padding: '4px 8px', borderRadius: '4px', textDecoration: 'none', fontSize: '11px' }}>Descargar XML</a>}
                    </div>
                  </div>
                )}
              </div>

              {/* Formulario de facturación fiscal */}
              {!searchedInvoice && (
                <div style={{ background: 'var(--color-bg-card)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 600, borderBottom: '1px solid var(--border-light)', paddingBottom: '10px', marginBottom: '14px' }}>Datos Fiscales del Cliente</h3>
                  
                  {retroBillingError && (
                    <div style={{ backgroundColor: 'var(--color-danger-bg)', color: 'var(--color-danger)', padding: '10px', borderRadius: '6px', marginBottom: '14px', fontSize: '13px' }}>
                      {retroBillingError}
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {/* Autocomplete de clientes frecuentes */}
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Seleccionar Cliente Frecuente</label>
                      <select 
                        value={selectedFrequentClientId}
                        onChange={(e) => handleSelectFrequentClient(e.target.value)}
                        style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-light)', fontSize: '13px', background: 'var(--color-bg-card)', color: 'inherit' }}
                      >
                        <option value="">-- Cliente Nuevo --</option>
                        {customersList.map((c) => (
                          <option key={c.id} value={c.id}>{c.razonSocial} ({c.rfc})</option>
                        ))}
                      </select>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div>
                        <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>RFC</label>
                        <input 
                          type="text" 
                          placeholder="XAXX010101000" 
                          value={billingCustomer.rfc} 
                          onChange={(e) => setBillingCustomer({ ...billingCustomer, rfc: e.target.value.toUpperCase() })} 
                          style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-light)', fontSize: '13px', textTransform: 'uppercase', background: 'var(--color-bg-card)' }}
                          disabled={!!selectedFrequentClientId}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Código Postal</label>
                        <input 
                          type="text" 
                          placeholder="Código Postal" 
                          maxLength={5}
                          value={billingCustomer.codigoPostal} 
                          onChange={(e) => setBillingCustomer({ ...billingCustomer, codigoPostal: e.target.value.replace(/\D/g, '') })} 
                          style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-light)', fontSize: '13px', background: 'var(--color-bg-card)' }}
                          disabled={!!selectedFrequentClientId}
                        />
                      </div>
                    </div>

                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Nombre o Razón Social</label>
                      <input 
                        type="text" 
                        placeholder="TAL CUAL APARECE EN CONSTANCIA SAT" 
                        value={billingCustomer.razonSocial} 
                        onChange={(e) => setBillingCustomer({ ...billingCustomer, razonSocial: e.target.value.toUpperCase() })} 
                        style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-light)', fontSize: '13px', textTransform: 'uppercase', background: 'var(--color-bg-card)' }}
                        disabled={!!selectedFrequentClientId}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Correo Electrónico (Envío)</label>
                      <input 
                        type="email" 
                        placeholder="correo@cliente.com" 
                        value={billingCustomer.email} 
                        onChange={(e) => setBillingCustomer({ ...billingCustomer, email: e.target.value })} 
                        style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-light)', fontSize: '13px', background: 'var(--color-bg-card)' }}
                        disabled={!!selectedFrequentClientId}
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div>
                        <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Régimen Fiscal</label>
                        <select 
                          value={billingCustomer.regimenFiscal} 
                          onChange={(e) => setBillingCustomer({ ...billingCustomer, regimenFiscal: e.target.value })}
                          style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-light)', fontSize: '12px', background: 'var(--color-bg-card)', color: 'inherit' }}
                          disabled={!!selectedFrequentClientId}
                        >
                          {REGIMENES_FISCALES.map((r) => (
                            <option key={r.code} value={r.code}>{r.code} - {r.description}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Uso CFDI</label>
                        <select 
                          value={billingUsoCFDI} 
                          onChange={(e) => setBillingUsoCFDI(e.target.value)}
                          style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-light)', fontSize: '12px', background: 'var(--color-bg-card)', color: 'inherit' }}
                        >
                          {USOS_CFDI.map((u) => (
                            <option key={u.code} value={u.code}>{u.code} - {u.description}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <button 
                      className="reports-print-btn" 
                      onClick={handleRetroBilling}
                      disabled={retroBillingLoading}
                      style={{ background: 'var(--color-primary)', color: '#fff', marginTop: '14px', width: '100%', height: 'auto', padding: '12px', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      {retroBillingLoading ? 'Timbrando Factura ante el SAT...' : 'Emitir Factura (Timbrar)'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* CONTENIDO TAB: CLIENTES FRECUENTES */}
      {activeTab === 'customers' && (
        <div className="reports-list-container">
          <h2 className="reports-section-title">Catálogo de Clientes Frecuentes</h2>
          {loadingCustomers ? (
            <div className="reports-loading">Cargando clientes frecuentes...</div>
          ) : customersList.length === 0 ? (
            <div className="reports-empty">
              <Users size={48} />
              <p>No has registrado ningún cliente frecuente. Comienza agregando uno.</p>
            </div>
          ) : (
            <div className="reports-table-wrapper">
              <table className="reports-table">
                <thead>
                  <tr>
                    <th>Razón Social</th>
                    <th>RFC</th>
                    <th>Régimen Fiscal</th>
                    <th>C.P.</th>
                    <th>Correo de envío</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {customersList.map((c) => (
                    <tr key={c.id} className="reports-row">
                      <td style={{ fontWeight: 'bold' }}>{c.razonSocial}</td>
                      <td><span style={{ fontFamily: 'monospace' }}>{c.rfc}</span></td>
                      <td>
                        {c.regimenFiscal} - {REGIMENES_FISCALES.find(rf => rf.code === c.regimenFiscal)?.description || 'Desconocido'}
                      </td>
                      <td>{c.codigoPostal}</td>
                      <td>{c.email}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button onClick={() => handleOpenCustomerModal(c)} className="reports-print-btn" title="Editar Cliente" style={{ padding: '6px', height: 'auto', display: 'flex', background: 'rgba(0,0,0,0.03)', border: '1px solid var(--border-light)' }}>
                            <Edit size={14} style={{ color: 'var(--color-primary)' }} />
                          </button>
                          <button onClick={() => handleDeleteCustomerClick(c)} className="reports-print-btn" title="Eliminar Cliente" style={{ padding: '6px', height: 'auto', display: 'flex', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                            <Trash2 size={14} style={{ color: '#ef4444' }} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODAL: REGISTRAR / EDITAR CLIENTE FRECUENTE */}
      {showCustomerModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: 'var(--color-bg-card)', padding: '30px', borderRadius: '12px', maxWidth: '500px', width: '90%', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', border: '1px solid var(--border-light)' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 600 }}>{editingCustomer ? 'Editar Cliente' : 'Agregar Nuevo Cliente'}</h3>
            
            {customerModalError && (
              <div style={{ backgroundColor: 'var(--color-danger-bg)', color: 'var(--color-danger)', padding: '10px', borderRadius: '6px', marginBottom: '14px', fontSize: '13px' }}>
                {customerModalError}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>RFC</label>
                  <input 
                    type="text" 
                    placeholder="XAXX010101000" 
                    value={customerForm.rfc} 
                    onChange={(e) => setCustomerForm({ ...customerForm, rfc: e.target.value.toUpperCase() })} 
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-light)', fontSize: '13px', textTransform: 'uppercase', background: 'var(--color-bg-card)', color: 'inherit' }}
                    disabled={!!editingCustomer}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Código Postal</label>
                  <input 
                    type="text" 
                    placeholder="C.P." 
                    maxLength={5}
                    value={customerForm.codigoPostal} 
                    onChange={(e) => setCustomerForm({ ...customerForm, codigoPostal: e.target.value.replace(/\D/g, '') })} 
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-light)', fontSize: '13px', background: 'var(--color-bg-card)', color: 'inherit' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Nombre o Razón Social</label>
                <input 
                  type="text" 
                  placeholder="TAL CUAL APARECE EN CONSTANCIA FISCAL" 
                  value={customerForm.razonSocial} 
                  onChange={(e) => setCustomerForm({ ...customerForm, razonSocial: e.target.value.toUpperCase() })} 
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-light)', fontSize: '13px', textTransform: 'uppercase', background: 'var(--color-bg-card)', color: 'inherit' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Correo de Envío</label>
                <input 
                  type="email" 
                  placeholder="correo@ejemplo.com" 
                  value={customerForm.email} 
                  onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })} 
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-light)', fontSize: '13px', background: 'var(--color-bg-card)', color: 'inherit' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Régimen Fiscal</label>
                <select 
                  value={customerForm.regimenFiscal} 
                  onChange={(e) => setCustomerForm({ ...customerForm, regimenFiscal: e.target.value })}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-light)', fontSize: '12px', background: 'var(--color-bg-card)', color: 'inherit' }}
                >
                  {REGIMENES_FISCALES.map((r) => (
                    <option key={r.code} value={r.code}>{r.code} - {r.description}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
              <button 
                className="reports-print-btn" 
                onClick={() => setShowCustomerModal(false)}
                disabled={customerSaving}
                style={{ background: 'rgba(0,0,0,0.05)', color: 'inherit', border: '1px solid var(--border-light)', height: 'auto', padding: '8px 16px' }}
              >
                Cancelar
              </button>
              <button 
                className="reports-print-btn" 
                disabled={customerSaving}
                onClick={handleSaveCustomerSubmit}
                style={{ background: 'var(--color-primary)', color: '#fff', height: 'auto', padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                {customerSaving ? 'Guardando...' : 'Guardar Cliente'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: MOTIVO CANCELACIÓN SAT */}
      {showCancelModal && invoiceToCancel && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: 'var(--color-bg-card)', padding: '30px', borderRadius: '12px', maxWidth: '500px', width: '90%', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', border: '1px solid var(--border-light)' }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '18px', fontWeight: 600 }}>Solicitud de Cancelación Fiscal</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Se solicitará la cancelación del folio <strong>{invoiceToCancel.invoiceNumber}</strong> ante el SAT.
            </p>

            {cancelError && (
              <div style={{ backgroundColor: 'var(--color-danger-bg)', color: 'var(--color-danger)', padding: '10px', borderRadius: '6px', marginBottom: '14px', fontSize: '13px' }}>
                {cancelError}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Motivo de Cancelación SAT</label>
                <select 
                  value={cancelMotive} 
                  onChange={(e) => setCancelMotive(e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-light)', fontSize: '13px', background: 'var(--color-bg-card)', color: 'inherit' }}
                >
                  <option value="01">01 - Comprobante emitido con errores con relación</option>
                  <option value="02">02 - Comprobante emitido con errores sin relación</option>
                  <option value="03">03 - No se llevó a cabo la operación</option>
                  <option value="04">04 - Operación nominativa relacionada en una factura global</option>
                </select>
              </div>

              {cancelMotive === '01' && (
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>UUID Sustituto (Folio Fiscal del comprobante que lo reemplaza)</label>
                  <input 
                    type="text" 
                    placeholder="Ingrese UUID del CFDI sustituto" 
                    value={substituteUuid} 
                    onChange={(e) => setSubstituteUuid(e.target.value)} 
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-light)', fontSize: '13px', background: 'var(--color-bg-card)', color: 'inherit' }}
                  />
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
              <button 
                className="reports-print-btn" 
                onClick={() => setShowCancelModal(false)}
                disabled={cancellingLoading}
                style={{ background: 'rgba(0,0,0,0.05)', color: 'inherit', border: '1px solid var(--border-light)', height: 'auto', padding: '8px 16px' }}
              >
                Cerrar
              </button>
              <button 
                className="reports-print-btn" 
                disabled={cancellingLoading}
                onClick={handleCancelInvoiceConfirm}
                style={{ background: '#ef4444', color: '#fff', height: 'auto', padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                {cancellingLoading ? 'Cancelando...' : 'Confirmar Cancelación'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
