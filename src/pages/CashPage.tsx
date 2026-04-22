import { useState, useEffect } from 'react';
import { Calculator, Lock, Loader2, CheckCircle2 } from 'lucide-react';
import { getPosDashboard, closeCashSession } from '../services/dashboardService';
import '../styles/CashPage.css';

export default function CashPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  // Datos del sistema (Ventas)
  const [systemCash, setSystemCash] = useState(0);
  const [systemCard, setSystemCard] = useState(0);

  // Entradas del usuario
  const [countedCash, setCountedCash] = useState('');
  const [countedCard, setCountedCard] = useState('');

  useEffect(() => {
    loadSalesData();
  }, []);

  async function loadSalesData() {
    try {
      setLoading(true);
      const data = await getPosDashboard();
      // Por ahora, asumimos que todas las ventas (totalRevenue) fueron en efectivo 
      // En un futuro, el dashboardService debería devolver efectivo y tarjeta separados
      setSystemCash(data.totalRevenue || 0);
      setSystemCard(0);
      setError('');
    } catch (err) {
      console.error(err);
      setError('Error al cargar ventas del día');
    } finally {
      setLoading(false);
    }
  }

  const handleCloseCash = async () => {
    const cash = parseFloat(countedCash) || 0;
    const card = parseFloat(countedCard) || 0;
    const difference = (cash + card) - (systemCash + systemCard);

    if (!window.confirm(`¿Confirmar corte de caja con una diferencia de $${difference.toFixed(2)}?`)) {
      return;
    }

    setSaving(true);
    try {
      const result = await closeCashSession({
        expected_cash: systemCash,
        expected_card: systemCard,
        counted_cash: cash,
        counted_card: card
      });
      
      if (result.ok) {
        setSuccess(true);
      } else {
        alert(result.message || 'Error al cerrar caja');
      }
    } catch (err) {
      alert('Error de conexión al cerrar caja');
    } finally {
      setSaving(false);
    }
  };

  if (success) {
    return (
      <div className="cash-page" style={{ textAlign: 'center', paddingTop: '64px' }}>
        <CheckCircle2 size={80} color="var(--color-success)" style={{ margin: '0 auto 24px' }} />
        <h1 className="cash-title">Caja Cerrada Exitosamente</h1>
        <p className="cash-subtitle">El corte de caja se ha guardado en el sistema.</p>
        <button 
          className="cash-submit-btn" 
          style={{ margin: '32px auto 0' }}
          onClick={() => window.location.reload()}
        >
          Volver
        </button>
      </div>
    );
  }

  const expectedTotal = systemCash + systemCard;
  const countedTotal = (parseFloat(countedCash) || 0) + (parseFloat(countedCard) || 0);
  const difference = countedTotal - expectedTotal;

  return (
    <div className="cash-page">
      <div className="cash-header">
        <h1 className="cash-title">Corte de Caja</h1>
        <p className="cash-subtitle">Verifica el dinero físico contra las ventas registradas en el sistema.</p>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '64px' }}>
          <Loader2 size={32} className="login-spinner" color="var(--color-primary)" />
        </div>
      ) : error ? (
        <div style={{ color: 'var(--color-danger)', padding: '24px' }}>{error}</div>
      ) : (
        <>
          <div className="cash-grid">
            {/* Panel Izquierdo: Sistema */}
            <div className="cash-panel cash-panel--blue">
              <h2 className="cash-panel-title">
                <Calculator size={20} /> Según Sistema
              </h2>

              <div className="cash-summary-row">
                <span className="cash-summary-label">Ventas en Efectivo</span>
                <span className="cash-summary-value">${systemCash.toFixed(2)}</span>
              </div>
              <div className="cash-summary-row">
                <span className="cash-summary-label">Ventas con Tarjeta</span>
                <span className="cash-summary-value">${systemCard.toFixed(2)}</span>
              </div>
              <div className="cash-summary-row cash-summary-row--total">
                <span className="cash-summary-label">Total Esperado</span>
                <span className="cash-summary-value">${expectedTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* Panel Derecho: Ingreso del Cajero */}
            <div className="cash-panel">
              <h2 className="cash-panel-title">Físico Contado</h2>

              <div className="cash-form-group">
                <label className="cash-form-label">Efectivo en Cajón ($)</label>
                <div className="cash-input-wrapper">
                  <span className="cash-currency-symbol">$</span>
                  <input
                    type="number"
                    className="cash-input"
                    value={countedCash}
                    onChange={(e) => setCountedCash(e.target.value)}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>

              <div className="cash-form-group">
                <label className="cash-form-label">Vouchers / Tarjeta ($)</label>
                <div className="cash-input-wrapper">
                  <span className="cash-currency-symbol">$</span>
                  <input
                    type="number"
                    className="cash-input"
                    value={countedCard}
                    onChange={(e) => setCountedCard(e.target.value)}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>

              <div className={`cash-difference ${difference === 0 ? 'cash-difference--ok' : difference < 0 ? 'cash-difference--warning' : 'cash-difference--neutral'}`}>
                <span className="cash-diff-label">
                  {difference === 0 ? 'Caja Cuadrada' : difference > 0 ? 'Sobrante' : 'Faltante'}
                </span>
                <span className="cash-diff-value">
                  ${Math.abs(difference).toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          <div className="cash-action-area">
            <button 
              className="cash-submit-btn" 
              onClick={handleCloseCash}
              disabled={saving}
            >
              {saving ? <Loader2 size={20} className="login-spinner" /> : <Lock size={20} />}
              Confirmar y Cerrar Caja
            </button>
          </div>
        </>
      )}
    </div>
  );
}
