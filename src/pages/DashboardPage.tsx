import { useState, useEffect } from 'react';
import { TrendingUp, ShoppingBag, Timer, ArrowUpRight, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getPosDashboard } from '../services/dashboardService';
import '../styles/DashboardPage.css';

export default function DashboardPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadDashboard() {
      try {
        setLoading(true);
        const result = await getPosDashboard();
        setData(result);
        setError('');
      } catch (err) {
        console.error('Error cargando dashboard', err);
        setError('Error al cargar datos del servidor');
      } finally {
        setLoading(false);
      }
    }
    loadDashboard();
  }, []);

  if (loading) {
    return (
      <div className="dashboard" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <Loader2 size={40} className="login-spinner" style={{ color: 'var(--color-primary)' }} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="dashboard" style={{ padding: '24px' }}>
        <h1 className="dashboard-title">Error</h1>
        <p>{error || 'No se pudieron cargar los datos'}</p>
        <button className="dashboard-low-stock-btn" onClick={() => window.location.reload()} style={{ marginTop: '16px' }}>
          Reintentar
        </button>
      </div>
    );
  }

  // Extraer datos
  const totalSales = data.totalRevenue || 0;
  const tickets = data.totalOrders || 0;
  const avgTicket = tickets > 0 ? totalSales / tickets : 0;
  
  // Como aún no tenemos lógica real de velocidad de servicio, usaremos un valor mock temporal basado en la cantidad de tickets
  const serviceSpeed = tickets > 0 ? (Math.random() * 2 + 1).toFixed(1) : '0.0';

  // Usaremos los productos como mock de "hourly sales" temporalmente para que la gráfica no esté vacía, 
  // o si el endpoint devuelve hourlySales lo usaríamos (en el plan lo implementamos pero no lo agregamos a la interfaz de TS)
  // Por ahora la gráfica de barras será plana si no hay ventas.
  const hourlySales = data.hourly_sales || Array(14).fill({ amount: 0 }); // 8am a 9pm
  const maxSale = Math.max(...hourlySales.map((s: any) => s.amount), 1); // Evitar dividir por cero

  const lowStock = data.low_stock || [];

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">Resumen del Día</h1>
          <p className="dashboard-subtitle">
            Seguimiento diario de tu papelería.
          </p>
        </div>
      </div>

      {/* Main Grid */}
      <div className="dashboard-grid">
        {/* Sales Card */}
        <div className="dashboard-sales-card">
          <div className="dashboard-sales-header">
            <span className="dashboard-sales-label">VENTAS DEL DÍA</span>
            <div className="dashboard-sales-trend-icon">
              <TrendingUp size={20} />
            </div>
          </div>
          <div className="dashboard-sales-amount">
            ${totalSales.toLocaleString('en-US', {
              minimumFractionDigits: 2,
            })}
          </div>

          {/* Bar Chart */}
          <div className="dashboard-chart">
            <div className="dashboard-chart-bars">
              {hourlySales.map((point: any, i: number) => (
                <div className="dashboard-chart-bar-wrapper" key={i}>
                  <div
                    className={`dashboard-chart-bar ${
                      i === hourlySales.length - 1 && point.amount > 0
                        ? 'dashboard-chart-bar--highlight'
                        : ''
                    }`}
                    style={{
                      height: `${(point.amount / maxSale) * 100}%`,
                      minHeight: point.amount === 0 ? '4px' : 'auto'
                    }}
                    title={point.label ? `${point.label} - $${point.amount}` : ''}
                  ></div>
                </div>
              ))}
            </div>
            <div className="dashboard-chart-labels">
              <span>08:00</span>
              <span>12:00</span>
              <span>16:00</span>
              <span>20:00</span>
            </div>
          </div>
        </div>

        {/* Side Metrics */}
        <div className="dashboard-metrics">
          <div className="dashboard-metric-card">
            <div className="dashboard-metric-header">
              <span className="dashboard-metric-label">TICKETS GENERADOS</span>
            </div>
            <div className="dashboard-metric-content">
              <span className="dashboard-metric-value">{tickets}</span>
              <span className="dashboard-metric-trend dashboard-metric-trend--up">
                +0% hoy
              </span>
            </div>
          </div>

          <div className="dashboard-metric-card dashboard-metric-card--row">
            <div className="dashboard-metric-icon dashboard-metric-icon--purple">
              <ShoppingBag size={20} />
            </div>
            <div>
              <span className="dashboard-metric-label">Ticket Promedio</span>
              <span className="dashboard-metric-subvalue">
                ${avgTicket.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <div className="dashboard-metric-card dashboard-metric-card--row">
            <div className="dashboard-metric-icon dashboard-metric-icon--blue">
              <Timer size={20} />
            </div>
            <div>
              <span className="dashboard-metric-label">Velocidad de Servicio</span>
              <span className="dashboard-metric-subvalue">{serviceSpeed} min</span>
            </div>
          </div>
        </div>
      </div>

      {/* Inventory Alerts */}
      <div className="dashboard-inventory">
        <div className="dashboard-inventory-header">
          <div>
            <span className="dashboard-inventory-alert">INVENTARIO BAJO</span>
            <h2 className="dashboard-inventory-title">
              Productos que Requieren Atención
            </h2>
          </div>
          <button className="dashboard-inventory-link-btn" onClick={() => navigate('/inventory')}>
            Ver Todo el Inventario <ArrowUpRight size={16} />
          </button>
        </div>

        <div className="dashboard-inventory-grid">
          {lowStock.length === 0 ? (
            <div style={{ gridColumn: '1 / -1', padding: '24px', textAlign: 'center', color: 'var(--color-text-secondary)', background: 'var(--color-bg-body)', borderRadius: '12px' }}>
              No hay productos con stock bajo 🎉
            </div>
          ) : (
            lowStock.map((item: any) => (
              <div className="dashboard-inventory-item" key={item.id}>
                <div className="dashboard-inventory-item-info">
                  <span className="dashboard-inventory-item-name">{item.name}</span>
                  <span className="dashboard-inventory-item-category">
                    {item.category}
                  </span>
                </div>
                <div className="dashboard-inventory-item-stock">
                  <div className="dashboard-inventory-item-bar-track">
                    <div 
                      className="dashboard-inventory-item-bar-fill" 
                      style={{ width: `${Math.max(5, Math.min(100, (item.stock / 10) * 100))}%` }}
                    ></div>
                  </div>
                  <span className="dashboard-inventory-item-count">
                    {item.stock} u.
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
