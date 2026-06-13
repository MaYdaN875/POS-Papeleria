import { Calendar, ChevronDown, ChevronUp, DollarSign, FileText, Package, Printer, Vault } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { CashHistoryResponse, SalesHistoryResponse, getCashHistory, getSalesHistory } from '../services/dashboardService';
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
    if (!saleDetails[saleId]) {
      setLoadingDetails(saleId);
      try {
        const data = await getSalesHistory({ sale_id: saleId });
        if (data.ok && data.sale) {
          setSaleDetails(prev => ({ ...prev, [saleId]: data.sale }));
        }
      } catch (err) {
        console.error('Error fetching sale details:', err);
      } finally {
        setLoadingDetails(null);
      }
    }
  };

  const escapeHtml = (value: unknown) =>
    String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const periodLabel =
    dateRange === 'today'
      ? 'Hoy'
      : dateRange === 'week'
        ? 'Últimos 7 días'
        : dateRange === 'month'
          ? 'Último mes'
          : 'Historial completo';

  const buildPrintBody = () => {
    const header = `
      <div class="ph">
        <h1>Papelería Godart</h1>
        <h2>${activeTab === 'sales' ? 'Reporte de Ventas' : 'Reporte de Cortes de Caja'}</h2>
        <p>Periodo: ${escapeHtml(periodLabel)}</p>
        <p>Emisión: ${escapeHtml(new Date().toLocaleString('es-MX'))}</p>
      </div>`;

    if (activeTab === 'sales') {
      const sales = salesData?.sales || [];
      if (sales.length === 0) {
        return header + '<p class="empty">No hay ventas registradas en este periodo.</p>';
      }
      const rows = sales
        .map(
          (s) => `
        <tr>
          <td>#${String(s.id).padStart(6, '0')}</td>
          <td>${escapeHtml(formatDate(s.created_at))}</td>
          <td>${escapeHtml(s.cashier_name || 'Admin')}</td>
          <td>${escapeHtml(translatePaymentMethod(s.payment_method))}</td>
          <td class="right">${escapeHtml(formatCurrency(Number(s.total)))}</td>
        </tr>`
        )
        .join('');
      return `
        ${header}
        <div class="summary">
          <div><span>Ingresos del periodo</span><strong>${escapeHtml(formatCurrency(salesData?.summary?.total_revenue || 0))}</strong></div>
          <div><span>Total de ventas</span><strong>${escapeHtml(String(salesData?.summary?.total_orders || sales.length))}</strong></div>
        </div>
        <table>
          <thead><tr><th>Ticket</th><th>Fecha y hora</th><th>Cajero</th><th>Método</th><th class="right">Total</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>`;
    }

    const sessions = cashData?.sessions || [];
    if (sessions.length === 0) {
      return header + '<p class="empty">No hay cortes de caja registrados en este periodo.</p>';
    }
    const rows = sessions
      .map((session) => {
        const expected =
          (Number.parseFloat(session.expected_cash) || 0) + (Number.parseFloat(session.expected_card) || 0);
        const counted =
          (Number.parseFloat(session.counted_cash) || 0) + (Number.parseFloat(session.counted_card) || 0);
        const difference = Number.parseFloat(session.difference) || 0;
        return `
        <tr>
          <td>${escapeHtml(formatDate(session.created_at))}</td>
          <td>${escapeHtml(session.cashier_name)}</td>
          <td class="right">${escapeHtml(formatCurrency(expected))}</td>
          <td class="right">${escapeHtml(formatCurrency(counted))}</td>
          <td class="right">${difference > 0 ? '+' : ''}${escapeHtml(formatCurrency(difference))}</td>
          <td>${escapeHtml(String(session.status).toUpperCase())}</td>
        </tr>`;
      })
      .join('');
    return `
      ${header}
      <table>
        <thead><tr><th>Fecha y hora</th><th>Cajero</th><th class="right">Esperado</th><th class="right">Contado</th><th class="right">Diferencia</th><th>Estado</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  };

  const handlePrint = () => {
    const styles = `
      * { font-family: Arial, Helvetica, sans-serif; box-sizing: border-box; }
      body { margin: 24px; color: #111; }
      .ph { text-align: center; margin-bottom: 20px; }
      .ph h1 { margin: 0; font-size: 22px; }
      .ph h2 { margin: 4px 0; font-size: 16px; font-weight: 600; color: #444; }
      .ph p { margin: 2px 0; font-size: 12px; color: #555; }
      .summary { display: flex; gap: 16px; margin-bottom: 16px; }
      .summary div { flex: 1; border: 1px solid #ddd; border-radius: 8px; padding: 10px 14px; }
      .summary span { display: block; font-size: 11px; text-transform: uppercase; color: #666; }
      .summary strong { font-size: 18px; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; }
      th, td { border: 1px solid #ddd; padding: 7px 9px; text-align: left; }
      th { background: #f3f4f6; }
      .right { text-align: right; }
      .empty { text-align: center; color: #666; margin-top: 40px; }
      @page { margin: 12mm; }
    `;
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Reporte</title><style>${styles}</style></head><body>${buildPrintBody()}</body></html>`;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      document.body.removeChild(iframe);
      return;
    }
    doc.open();
    doc.write(html);
    doc.close();

    const win = iframe.contentWindow;
    if (!win) {
      document.body.removeChild(iframe);
      return;
    }
    setTimeout(() => {
      win.focus();
      win.print();
      setTimeout(() => document.body.removeChild(iframe), 1500);
    }, 300);
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
            <span>Imprimir {activeTab === 'sales' ? 'ventas' : 'cortes'}</span>
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
    </div>
  );
}
