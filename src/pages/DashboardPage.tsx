import { TrendingUp, ShoppingBag, Timer, ArrowUpRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { salesByHour, dashboardData, lowStockItems } from '../data/mockData';
import '../styles/DashboardPage.css';

export default function DashboardPage() {
  const navigate = useNavigate();
  const maxSale = Math.max(...salesByHour.map((s) => s.amount));

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
            ${dashboardData.totalSales.toLocaleString('en-US', {
              minimumFractionDigits: 2,
            })}
          </div>

          {/* Bar Chart */}
          <div className="dashboard-chart">
            <div className="dashboard-chart-bars">
              {salesByHour.map((point, i) => (
                <div className="dashboard-chart-bar-wrapper" key={i}>
                  <div
                    className={`dashboard-chart-bar ${
                      i === salesByHour.length - 1
                        ? 'dashboard-chart-bar--highlight'
                        : ''
                    }`}
                    style={{
                      height: `${(point.amount / maxSale) * 100}%`,
                    }}
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

        {/* Stats Panel */}
        <div className="dashboard-stats">
          <div className="dashboard-stat-card dashboard-stat-card--tickets">
            <span className="dashboard-stat-label">TICKETS GENERADOS</span>
            <div className="dashboard-stat-big-row">
              <span className="dashboard-stat-big-number">
                {dashboardData.ticketsGenerated}
              </span>
              <span className="dashboard-stat-badge">
                +{dashboardData.ticketsGrowth}% hoy
              </span>
            </div>
          </div>

          <div className="dashboard-stat-card dashboard-stat-card--small">
            <div className="dashboard-stat-icon dashboard-stat-icon--green">
              <ShoppingBag size={18} />
            </div>
            <div>
              <span className="dashboard-stat-small-label">
                Ticket Promedio
              </span>
              <span className="dashboard-stat-small-value">
                ${dashboardData.avgTicketValue.toFixed(2)}
              </span>
            </div>
          </div>

          <div className="dashboard-stat-card dashboard-stat-card--small">
            <div className="dashboard-stat-icon dashboard-stat-icon--blue">
              <Timer size={18} />
            </div>
            <div>
              <span className="dashboard-stat-small-label">Velocidad de Servicio</span>
              <span className="dashboard-stat-small-value">
                {dashboardData.serviceSpeed} min
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Low Inventory Section */}
      <div className="dashboard-inventory">
        <div className="dashboard-inventory-header">
          <div>
            <span className="dashboard-inventory-alert">INVENTARIO BAJO</span>
            <h2 className="dashboard-inventory-title">
              Productos que Requieren Atención
            </h2>
          </div>
          <button
            className="dashboard-inventory-link"
            onClick={() => navigate('/inventory')}
          >
            Ver Todo el Inventario
            <ArrowUpRight size={16} />
          </button>
        </div>

        <div className="dashboard-inventory-grid">
          {lowStockItems.map((item, i) => (
            <div className="dashboard-inventory-item" key={i}>
              <div className="dashboard-inventory-item-info">
                <span className="dashboard-inventory-item-name">
                  {item.name}
                </span>
                <span className="dashboard-inventory-item-category">
                  {item.category}
                </span>
              </div>
              <div className="dashboard-inventory-item-stock">
                <div className="dashboard-inventory-item-bar-track">
                  <div
                    className="dashboard-inventory-item-bar-fill"
                    style={{
                      width: `${(item.stock / item.minStock) * 100}%`,
                    }}
                  ></div>
                </div>
                <span className="dashboard-inventory-item-count">
                  {item.stock} / {item.minStock}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
