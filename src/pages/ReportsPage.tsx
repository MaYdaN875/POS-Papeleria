import React, { useState, useEffect } from 'react';
import { getSalesHistory, SalesHistoryResponse } from '../services/dashboardService';
import { Calendar, FileText, Printer, ChevronDown, ChevronUp, DollarSign, Package } from 'lucide-react';
import '../styles/ReportsPage.css';

export function ReportsPage() {
  const [salesData, setSalesData] = useState<SalesHistoryResponse | null>(null);
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
      const data = await getSalesHistory(params);
      
      if (data.ok) {
        setSalesData(data);
      } else {
        setError(data.message || 'Error al obtener el historial');
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
    return new Date(dateString).toLocaleString('es-MX', {
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

      {/* Lista de Ventas */}
      <div className="reports-list-container">
        <h2 className="reports-section-title no-print">Historial de Tickets</h2>
        
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
                    {(expandedSaleId === sale.id || true) && ( // En modo print, idealmente se mostrarían todos o ninguno, pero dejaremos el DOM normal
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
      </div>
    </div>
  );
}
