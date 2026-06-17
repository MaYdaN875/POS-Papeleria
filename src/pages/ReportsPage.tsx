import { Calendar, ChevronDown, ChevronUp, DollarSign, FileText, Package, Printer, Vault } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { CashHistoryResponse, SalesHistoryResponse, getCashHistory, getSalesHistory } from '../services/dashboardService';
import { getGlobalSettings, GlobalSettings } from '../services/settingsService';
import { REGIMENES_FISCALES, USOS_CFDI, InvoiceCustomer } from '../types/invoicing';
import { InvoiceService } from '../services/invoicing/InvoiceService';
import { saveInvoiceToBackend, getInvoiceBySaleId, BackendInvoice } from '../services/invoicing/backendService';
import '../styles/ReportsPage.css';

export function ReportsPage() {
  const [activeTab, setActiveTab] = useState<'sales' | 'cash'>('sales');
  const [salesData, setSalesData] = useState<SalesHistoryResponse | null>(null);
  const [cashData, setCashData] = useState<CashHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'all'>('today');
  const [expandedSaleId, setExpandedSaleId] = useState<number | null>(null);
  const [saleDetails, setSaleDetails] = useState<Record<number, any>>({});
  const [loadingDetails, setLoadingDetails] = useState<number | null>(null);

  const [settings, setSettings] = useState<GlobalSettings | null>(null);
  const [invoices, setInvoices] = useState<Record<number, BackendInvoice | null>>({});
  const [loadingInvoices, setLoadingInvoices] = useState<Record<number, boolean>>({});
  
  // Modal states for billing a past sale
  const [showBillingModal, setShowBillingModal] = useState(false);
  const [billingSale, setBillingSale] = useState<any | null>(null);
  const [billingSaleDetails, setBillingSaleDetails] = useState<any | null>(null);
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingCustomer, setBillingCustomer] = useState<InvoiceCustomer>({
    rfc: '',
    razonSocial: '',
    regimenFiscal: '601',
    codigoPostal: '',
    email: ''
  });
  const [billingUsoCFDI, setBillingUsoCFDI] = useState('G03');
  const [billingError, setBillingError] = useState('');

  useEffect(() => {
    getGlobalSettings().then(res => {
      if (res.ok && res.settings) {
        setSettings(res.settings);
      }
    });
  }, []);

  useEffect(() => {
    fetchSales();
  }, [dateRange]);

  const fetchSales = async () => {
    setLoading(true);
    setError(null);
    try {
      const today = new Date();
      let startStr = '';
      let endStr = today.toISOString().split('T')[0];

      if (dateRange === 'today') {
        startStr = endStr;
      } else if (dateRange === 'week') {
        const lastWeek = new Date(today);
        lastWeek.setDate(lastWeek.getDate() - 7);
        startStr = lastWeek.toISOString().split('T')[0];
      } else if (dateRange === 'month') {
        const lastMonth = new Date(today);
        lastMonth.setMonth(lastMonth.getMonth() - 1);
        startStr = lastMonth.toISOString().split('T')[0];
      }

      const params = startStr ? { date_start: startStr, date_end: endStr } : {};
      
      const [salesRes, cashRes] = await Promise.all([
        getSalesHistory(params),
        getCashHistory(params)
      ]);
      
      if (salesRes.ok) {
        setSalesData(salesRes);
      } else {
        setError(salesRes.message || 'Error al obtener el historial de ventas');
      }

      if (cashRes.ok) {
        setCashData(cashRes);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleSaleDetails = async (saleId: number) => {
    if (expandedSaleId === saleId) {
      setExpandedSaleId(null);
      return;
    }

    setExpandedSaleId(saleId);

    // If we haven't fetched details yet
    let currentDetails = saleDetails[saleId];
    if (!currentDetails) {
      setLoadingDetails(saleId);
      try {
        const data = await getSalesHistory({ sale_id: saleId });
        if (data.ok && data.sale) {
          currentDetails = data.sale;
          setSaleDetails(prev => ({ ...prev, [saleId]: data.sale }));
        }
      } catch (err) {
        console.error('Error fetching sale details:', err);
      } finally {
        setLoadingDetails(null);
      }
    }

    // Fetch invoice details if enabled
    if (settings?.invoiceEnabled && !invoices[saleId] && loadingInvoices[saleId] !== true) {
      setLoadingInvoices(prev => ({ ...prev, [saleId]: true }));
      try {
        const res = await getInvoiceBySaleId(saleId);
        if (res.ok && res.invoice) {
          setInvoices(prev => {
            const next = { ...prev };
            next[saleId] = res.invoice!;
            return next;
          });
        } else {
          setInvoices(prev => {
            const next = { ...prev };
            next[saleId] = null;
            return next;
          });
        }
      } catch (err) {
        console.error('Error fetching invoice details:', err);
      } finally {
        setLoadingInvoices(prev => ({ ...prev, [saleId]: false }));
      }
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    // Si la fecha viene de MySQL sin formato de zona horaria (ej: 2026-04-29 16:14:00)
    // la convertimos a formato UTC estándar para que el navegador haga la resta de horas automáticamente.
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

  const translatePaymentMethod = (method: string) => {
    switch(method) {
      case 'cash': return 'Efectivo';
      case 'card': return 'Tarjeta';
      case 'transfer': return 'Transferencia';
      default: return method;
    }
  };

  return (
    <div className="reports-page">
      <div className="reports-header no-print">
        <div>
          <h1 className="reports-title">Reportes e Historial</h1>
          <p className="reports-subtitle">Consulta y exporta el registro de tus ventas</p>
        </div>
        <div className="reports-actions">
          <div className="reports-filter-group">
            <Calendar size={18} />
            <select 
              value={dateRange} 
              onChange={(e) => setDateRange(e.target.value as any)}
              className="reports-select"
            >
              <option value="today">Hoy</option>
              <option value="week">Últimos 7 días</option>
              <option value="month">Último mes</option>
              <option value="all">Todo el historial</option>
            </select>
          </div>
          <button className="reports-print-btn" onClick={handlePrint}>
            <Printer size={18} />
            <span>Imprimir PDF</span>
          </button>
        </div>
      </div>

      {error && <div className="reports-error no-print">{error}</div>}

      {/* Resumen del Periodo */}
      <div className="reports-summary-cards">
        <div className="reports-card reports-card--revenue">
          <div className="reports-card-icon"><DollarSign size={24} /></div>
          <div className="reports-card-content">
            <h3>Ingresos del Periodo</h3>
            <p className="reports-card-value">
              {loading ? '...' : formatCurrency(salesData?.summary?.total_revenue || 0)}
            </p>
          </div>
        </div>
        <div className="reports-card reports-card--orders">
          <div className="reports-card-icon"><Package size={24} /></div>
          <div className="reports-card-content">
            <h3>Total de Ventas</h3>
            <p className="reports-card-value">
              {loading ? '...' : (salesData?.summary?.total_orders || 0)}
            </p>
          </div>
        </div>
      </div>

      {/* Título de Impresión (Solo visible al imprimir) */}
      <div className="print-only print-header">
        <h2>Reporte de Ventas - Papelería Godart</h2>
        <p>Periodo: {dateRange === 'today' ? 'Hoy' : dateRange === 'week' ? 'Última Semana' : dateRange === 'month' ? 'Último Mes' : 'Historial Completo'}</p>
        <p>Fecha de emisión: {new Date().toLocaleString()}</p>
        <hr />
      </div>

      {/* Lista de Ventas o Cortes */}
      <div className="reports-list-container">
        <div className="reports-tabs no-print" style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
          <button 
            className={`payment-method-btn ${activeTab === 'sales' ? 'payment-method-btn--active' : ''}`}
            style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border-light)', background: activeTab === 'sales' ? 'var(--color-primary-light)' : 'transparent', color: activeTab === 'sales' ? 'var(--color-primary)' : 'inherit', fontWeight: activeTab === 'sales' ? 'bold' : 'normal', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
            onClick={() => setActiveTab('sales')}
          >
            <FileText size={18} /> Historial de Tickets
          </button>
          <button 
            className={`payment-method-btn ${activeTab === 'cash' ? 'payment-method-btn--active' : ''}`}
            style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border-light)', background: activeTab === 'cash' ? 'var(--color-primary-light)' : 'transparent', color: activeTab === 'cash' ? 'var(--color-primary)' : 'inherit', fontWeight: activeTab === 'cash' ? 'bold' : 'normal', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
            onClick={() => setActiveTab('cash')}
          >
            <Vault size={18} /> Cortes de Caja
          </button>
        </div>

        {activeTab === 'sales' && (
          <>
            <h2 className="reports-section-title no-print print-only">Historial de Tickets</h2>
            {loading && !salesData ? (
              <div className="reports-loading">Cargando historial...</div>
            ) : salesData?.sales?.length === 0 ? (
              <div className="reports-empty">
                <FileText size={48} />
                <p>No hay ventas registradas en este periodo.</p>
              </div>
            ) : (
              <div className="reports-table-wrapper">
                <table className="reports-table">
                  <thead>
                    <tr>
                      <th>Ticket</th>
                      <th>Fecha y Hora</th>
                      <th>Cajero</th>
                      <th>Método</th>
                      <th>Total</th>
                      <th className="no-print">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salesData?.sales?.map((sale) => (
                      <React.Fragment key={sale.id}>
                        <tr className={`reports-row ${expandedSaleId === sale.id ? 'reports-row--expanded' : ''}`}>
                          <td className="reports-col-id">#{String(sale.id).padStart(6, '0')}</td>
                          <td>{formatDate(sale.created_at)}</td>
                          <td>{sale.cashier_name || 'Admin'}</td>
                          <td>
                            <span className={`reports-badge reports-badge--${sale.payment_method}`}>
                              {translatePaymentMethod(sale.payment_method)}
                            </span>
                          </td>
                          <td className="reports-col-total">{formatCurrency(sale.total)}</td>
                          <td className="no-print">
                            <button 
                              className="reports-expand-btn"
                              onClick={() => toggleSaleDetails(sale.id)}
                            >
                              {expandedSaleId === sale.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                            </button>
                          </td>
                        </tr>
                        
                        {/* Detalle Expandible */}
                        {(expandedSaleId === sale.id || true) && (
                          <tr className={`reports-detail-row ${expandedSaleId === sale.id ? 'is-open' : ''}`}>
                            <td colSpan={6}>
                              <div className="reports-detail-content">
                                {loadingDetails === sale.id ? (
                                  <p>Cargando detalle...</p>
                                ) : saleDetails[sale.id] ? (
                                  <div className="reports-ticket">
                                    <h4>Detalle de Productos</h4>
                                    <table className="reports-ticket-table">
                                      <thead>
                                        <tr>
                                          <th>Cant.</th>
                                          <th>Producto</th>
                                          <th>P. Unitario</th>
                                          <th>Importe</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {saleDetails[sale.id].items.map((item: any) => (
                                          <tr key={item.id}>
                                            <td>{item.quantity}</td>
                                            <td>{item.product_name}</td>
                                            <td>{formatCurrency(item.unit_price)}</td>
                                            <td>{formatCurrency(item.total_price)}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                      <tfoot>
                                        <tr>
                                          <td colSpan={3} className="text-right"><strong>Subtotal:</strong></td>
                                          <td>{formatCurrency(saleDetails[sale.id].subtotal)}</td>
                                        </tr>
                                        <tr>
                                          <td colSpan={3} className="text-right"><strong>Total:</strong></td>
                                          <td className="reports-ticket-total">{formatCurrency(saleDetails[sale.id].total)}</td>
                                        </tr>
                                        {saleDetails[sale.id].payment_method === 'cash' && (
                                          <>
                                            <tr>
                                              <td colSpan={3} className="text-right">Efectivo Recibido:</td>
                                              <td>{formatCurrency(saleDetails[sale.id].cash_received || 0)}</td>
                                            </tr>
                                            <tr>
                                              <td colSpan={3} className="text-right">Cambio:</td>
                                              <td>{formatCurrency(saleDetails[sale.id].change_amount || 0)}</td>
                                            </tr>
                                          </>
                                        )}
                                      </tfoot>
                                    </table>
                                  </div>
                                ) : null}

                                {/* Invoice info block */}
                                {settings?.invoiceEnabled && saleDetails[sale.id] && (
                                  <div style={{ marginTop: '16px', borderTop: '1px solid var(--border-light)', paddingTop: '16px', display: 'flex', flexDirection: 'column' }} className="no-print">
                                    {loadingInvoices[sale.id] ? (
                                      <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>Buscando factura asociada...</p>
                                    ) : invoices[sale.id] ? (
                                      <div style={{ padding: '16px', background: 'rgba(0,0,0,0.02)', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                                        <h5 style={{ margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                                          <FileText size={18} style={{ color: 'var(--pos-primary)' }} /> Factura Fiscal Emitida
                                        </h5>
                                        <p style={{ margin: '4px 0', fontSize: '13px' }}><strong>UUID SAT:</strong> <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>{invoices[sale.id]?.uuid}</span></p>
                                        <p style={{ margin: '4px 0', fontSize: '13px' }}><strong>Cliente:</strong> {invoices[sale.id]?.customerRfc} - {invoices[sale.id]?.customerName}</p>
                                        <p style={{ margin: '4px 0', fontSize: '13px' }}><strong>Folio Factura:</strong> {invoices[sale.id]?.invoiceNumber}</p>
                                        <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                                          {invoices[sale.id]?.pdfUrl && (
                                            <a href={invoices[sale.id]?.pdfUrl} target="_blank" rel="noreferrer" className="reports-print-btn" style={{ padding: '6px 12px', fontSize: '13px', background: '#e0f2fe', color: '#0369a1', border: '1px solid rgba(3,105,161,0.2)', textDecoration: 'none', borderRadius: '6px', height: 'auto', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                                              Descargar PDF
                                            </a>
                                          )}
                                          {invoices[sale.id]?.xmlUrl && (
                                            <a href={invoices[sale.id]?.xmlUrl} target="_blank" rel="noreferrer" className="reports-print-btn" style={{ padding: '6px 12px', fontSize: '13px', background: '#fef3c7', color: '#b45309', border: '1px solid rgba(180,83,9,0.2)', textDecoration: 'none', borderRadius: '6px', height: 'auto', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                                              Descargar XML
                                            </a>
                                          )}
                                        </div>
                                      </div>
                                    ) : (
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'rgba(0,0,0,0.01)', borderRadius: '8px', border: '1px dotted var(--border-light)' }}>
                                        <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Esta venta no cuenta con factura emitida.</span>
                                        <button 
                                          className="reports-print-btn"
                                          onClick={() => {
                                            setBillingSale(sale);
                                            setBillingSaleDetails(saleDetails[sale.id]);
                                            setBillingError('');
                                            setShowBillingModal(true);
                                          }}
                                          style={{ background: 'var(--pos-primary)', color: '#fff', padding: '6px 12px', fontSize: '12px', height: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }}
                                        >
                                          <FileText size={14} />
                                          <span>Facturar Ticket</span>
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {activeTab === 'cash' && (
          <>
            <h2 className="reports-section-title no-print print-only">Historial de Cortes de Caja</h2>
            {loading && !cashData ? (
              <div className="reports-loading">Cargando historial de cortes...</div>
            ) : cashData?.sessions?.length === 0 ? (
              <div className="reports-empty">
                <Vault size={48} />
                <p>No hay cortes de caja registrados en este periodo.</p>
              </div>
            ) : (
              <div className="reports-table-wrapper">
                <table className="reports-table">
                  <thead>
                    <tr>
                      <th>Fecha y Hora</th>
                      <th>Cajero</th>
                      <th>Esperado en Caja</th>
                      <th>Físico Contado</th>
                      <th>Diferencia</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cashData?.sessions?.map((session) => {
                      const expected = parseFloat(session.expected_cash) + parseFloat(session.expected_card);
                      const counted = parseFloat(session.counted_cash) + parseFloat(session.counted_card);
                      const difference = parseFloat(session.difference);
                      
                      return (
                        <tr key={session.id} className="reports-row">
                          <td>{formatDate(session.created_at)}</td>
                          <td>{session.cashier_name}</td>
                          <td>{formatCurrency(expected)}</td>
                          <td>{formatCurrency(counted)}</td>
                          <td style={{ color: difference < 0 ? 'var(--color-danger)' : difference > 0 ? 'var(--color-warning)' : 'inherit', fontWeight: difference !== 0 ? 'bold' : 'normal' }}>
                            {difference > 0 ? '+' : ''}{formatCurrency(difference)}
                          </td>
                          <td>
                            <span className={`reports-badge reports-badge--${session.status === 'ok' ? 'cash' : session.status === 'faltante' ? 'transfer' : 'card'}`} style={{ backgroundColor: session.status === 'faltante' ? '#fee2e2' : session.status === 'sobrante' ? '#fef3c7' : '#dcfce7', color: session.status === 'faltante' ? '#991b1b' : session.status === 'sobrante' ? '#92400e' : '#166534' }}>
                              {session.status.toUpperCase()}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* MODAL DE FACTURACIÓN POST-VENTA */}
      {showBillingModal && billingSale && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: 'var(--color-bg-card)', padding: '30px', borderRadius: '12px', maxWidth: '500px', width: '90%', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', border: '1px solid var(--border-light)' }} className="no-print">
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 600 }}>Facturar Ticket #{String(billingSale.id).padStart(6, '0')}</h3>
            
            {billingError && (
              <div style={{ backgroundColor: 'var(--color-danger-bg)', color: 'var(--color-danger)', padding: '10px', borderRadius: '6px', marginBottom: '14px', fontSize: '13px' }}>
                {billingError}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>RFC</label>
                  <input 
                    type="text" 
                    placeholder="XAXX010101000" 
                    value={billingCustomer.rfc} 
                    onChange={(e) => setBillingCustomer({ ...billingCustomer, rfc: e.target.value.toUpperCase() })} 
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-light)', fontSize: '13px', textTransform: 'uppercase', background: 'var(--color-bg-card)' }}
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
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Nombre o Razón Social</label>
                <input 
                  type="text" 
                  placeholder="Tal cual aparece en Constancia Fiscal" 
                  value={billingCustomer.razonSocial} 
                  onChange={(e) => setBillingCustomer({ ...billingCustomer, razonSocial: e.target.value.toUpperCase() })} 
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-light)', fontSize: '13px', textTransform: 'uppercase', background: 'var(--color-bg-card)' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Correo Electrónico</label>
                <input 
                  type="email" 
                  placeholder="correo@cliente.com" 
                  value={billingCustomer.email} 
                  onChange={(e) => setBillingCustomer({ ...billingCustomer, email: e.target.value })} 
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-light)', fontSize: '13px', background: 'var(--color-bg-card)' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Régimen Fiscal</label>
                  <select 
                    value={billingCustomer.regimenFiscal} 
                    onChange={(e) => setBillingCustomer({ ...billingCustomer, regimenFiscal: e.target.value })}
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-light)', fontSize: '12px', background: 'var(--color-bg-card)', color: 'inherit' }}
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
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
              <button 
                className="reports-print-btn" 
                onClick={() => setShowBillingModal(false)}
                disabled={billingLoading}
                style={{ background: 'rgba(0,0,0,0.05)', color: 'inherit', border: '1px solid var(--border-light)', height: 'auto', padding: '8px 16px' }}
              >
                Cancelar
              </button>
              <button 
                className="reports-print-btn" 
                disabled={billingLoading}
                onClick={async () => {
                  const { rfc, razonSocial, codigoPostal, email } = billingCustomer;
                  if (!rfc || !razonSocial || !codigoPostal || !email) {
                    setBillingError('Complete todos los campos fiscales del cliente.');
                    return;
                  }
                  const rfcRegex = /^[A-Z&Ñ]{3,4}\d{6}[A-Z\d]{3}$/i;
                  if (!rfcRegex.test(rfc)) {
                    setBillingError('Formato de RFC inválido.');
                    return;
                  }
                  if (codigoPostal.length !== 5) {
                    setBillingError('El código postal debe ser de 5 dígitos.');
                    return;
                  }

                  setBillingLoading(true);
                  setBillingError('');
                  try {
                    const items = billingSaleDetails.items.map((item: any) => ({
                      productId: item.product_id,
                      name: item.product_name,
                      quantity: item.quantity,
                      price: item.unit_price,
                      taxRate: settings?.taxRate || 0,
                      claveProdServ: '01010101',
                      claveUnidad: 'H87'
                    }));

                    const taxRate = settings?.taxRate || 0;
                    const subtotalVal = parseFloat(billingSale.subtotal);
                    const totalVal = parseFloat(billingSale.total);
                    const taxVal = subtotalVal * taxRate / 100;

                    const res = await InvoiceService.createInvoice({
                      saleId: billingSale.id,
                      paymentMethod: billingSale.payment_method,
                      customer: billingCustomer,
                      usoCFDI: billingUsoCFDI,
                      items,
                      subtotal: subtotalVal,
                      taxAmount: taxVal,
                      total: totalVal
                    });

                    if (res.success && res.uuid) {
                      const backendPayload = {
                        sale_id: billingSale.id,
                        uuid: res.uuid,
                        invoice_number: res.invoiceNumber || 'CFDI',
                        customer_rfc: billingCustomer.rfc,
                        customer_name: billingCustomer.razonSocial,
                        pdf_url: res.pdfUrl,
                        xml_url: res.xmlUrl
                      };

                      await saveInvoiceToBackend(backendPayload);

                      // Actualizar el estado local
                      setInvoices(prev => {
                        const next = { ...prev };
                        next[billingSale.id] = {
                          id: 0,
                          saleId: billingSale.id,
                          uuid: res.uuid!,
                          invoiceNumber: res.invoiceNumber || 'CFDI',
                          customerRfc: billingCustomer.rfc,
                          customerName: billingCustomer.razonSocial,
                          pdfUrl: res.pdfUrl,
                          xmlUrl: res.xmlUrl,
                          status: 'active',
                          createdAt: new Date().toISOString()
                        };
                        return next;
                      });

                      alert('Factura emitida y registrada correctamente.');
                      setShowBillingModal(false);
                    } else {
                      setBillingError(res.message || 'Error en timbrado.');
                    }
                  } catch (err: any) {
                    setBillingError(err.message || 'Error al conectar.');
                  } finally {
                    setBillingLoading(false);
                  }
                }}
                style={{ background: 'var(--pos-primary)', color: '#fff', height: 'auto', padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                {billingLoading ? 'Timbrando...' : 'Emitir Factura'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
