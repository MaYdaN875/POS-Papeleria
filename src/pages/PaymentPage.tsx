import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Bell,
  Wifi,
  RefreshCw,
  Banknote,
  CreditCard,
  Building2,
  Delete,
} from 'lucide-react';
import '../styles/PaymentPage.css';

type PaymentMethod = 'cash' | 'card' | 'transfer';

export default function PaymentPage() {
  const navigate = useNavigate();
  const total = 1452.50;
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [cashReceived, setCashReceived] = useState('2000.00');

  const change = parseFloat(cashReceived || '0') - total;

  const handleKeyPress = (key: string) => {
    if (key === 'backspace') {
      setCashReceived((prev) => prev.slice(0, -1) || '0');
    } else if (key === '.') {
      if (!cashReceived.includes('.')) {
        setCashReceived((prev) => prev + '.');
      }
    } else if (key === 'clear') {
      setCashReceived('0');
    } else {
      setCashReceived((prev) => (prev === '0' ? key : prev + key));
    }
  };

  const handleConfirmPayment = () => {
    // TODO: Procesar pago
    alert('¡Pago procesado exitosamente!');
    navigate('/sales');
  };

  return (
    <div className="payment-page">
      {/* Header */}
      <header className="payment-header">
        <button className="payment-back-btn" onClick={() => navigate('/sales')}>
          <ArrowLeft size={20} />
          <span className="payment-header-title">Digital Atelier</span>
        </button>

        <div className="payment-header-actions">
          <button className="payment-header-icon">
            <Bell size={20} />
          </button>
          <button className="payment-header-icon payment-header-icon--online">
            <Wifi size={20} />
          </button>
          <button className="payment-header-icon">
            <RefreshCw size={20} />
          </button>

          <div className="payment-header-profile">
            <div className="payment-header-profile-info">
              <span className="payment-header-profile-name">
                Caja Principal
              </span>
              <span className="payment-header-profile-station">
                ESTACIÓN 04
              </span>
            </div>
            <div className="payment-header-avatar">👤</div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="payment-content">
        {/* Left Column - Total & Payment Method */}
        <div className="payment-left">
          <div className="payment-total-card">
            <span className="payment-total-label">TOTAL A PAGAR</span>
            <div className="payment-total-amount">
              ${total.toLocaleString('en-US', {
                minimumFractionDigits: 2,
              })}
            </div>
            <span className="payment-total-note">
              Incluye IVA (16%) y descuentos aplicados.
            </span>
          </div>

          <div className="payment-methods">
            <span className="payment-methods-label">MÉTODO DE PAGO</span>
            <div className="payment-methods-grid">
              <button
                className={`payment-method-btn ${
                  paymentMethod === 'cash' ? 'payment-method-btn--active' : ''
                }`}
                onClick={() => setPaymentMethod('cash')}
              >
                <Banknote size={28} />
                <span>Efectivo</span>
              </button>
              <button
                className={`payment-method-btn ${
                  paymentMethod === 'card' ? 'payment-method-btn--active' : ''
                }`}
                onClick={() => setPaymentMethod('card')}
              >
                <CreditCard size={28} />
                <span>Tarjeta</span>
              </button>
              <button
                className={`payment-method-btn ${
                  paymentMethod === 'transfer'
                    ? 'payment-method-btn--active'
                    : ''
                }`}
                onClick={() => setPaymentMethod('transfer')}
              >
                <Building2 size={28} />
                <span>Transferencia</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column - Cash Input & Change */}
        <div className="payment-right">
          {paymentMethod === 'cash' && (
            <>
              <div className="payment-cash-section">
                <span className="payment-cash-label">EFECTIVO RECIBIDO</span>
                <div className="payment-cash-input">
                  <span className="payment-cash-symbol">$</span>
                  <span className="payment-cash-value">
                    {parseFloat(cashReceived || '0').toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </div>

              <div
                className={`payment-change-card ${
                  change >= 0 ? 'payment-change-card--positive' : 'payment-change-card--negative'
                }`}
              >
                <span className="payment-change-label">CÁLCULO DE CAMBIO</span>
                <span className="payment-change-amount">
                  ${Math.abs(change).toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                  })}
                </span>
              </div>

              {/* Numpad */}
              <div className="payment-numpad">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'backspace'].map(
                  (key) => (
                    <button
                      key={key}
                      className={`payment-numpad-btn ${
                        key === 'backspace' ? 'payment-numpad-btn--delete' : ''
                      }`}
                      onClick={() => handleKeyPress(key)}
                    >
                      {key === 'backspace' ? <Delete size={20} /> : key}
                    </button>
                  )
                )}
              </div>
            </>
          )}

          {paymentMethod !== 'cash' && (
            <div className="payment-other-method">
              <p className="payment-other-method-text">
                {paymentMethod === 'card'
                  ? 'Pase la tarjeta por el terminal'
                  : 'Esperando confirmación de transferencia'}
              </p>
            </div>
          )}

          <button
            className="payment-confirm-btn"
            onClick={handleConfirmPayment}
          >
            Confirmar Pago
          </button>
        </div>
      </div>
    </div>
  );
}
