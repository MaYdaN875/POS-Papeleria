import {
    ArrowLeft,
    Banknote,
    Bell,
    Building2,
    CreditCard,
    Delete,
    Loader2,
    RefreshCw,
    Wifi,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TicketPrint, { TicketData } from '../components/TicketPrint';
import { useCart } from '../context/CartContext';
import { createSale } from '../services/salesService';
import '../styles/PaymentPage.css';

type PaymentMethod = 'cash' | 'card' | 'transfer';

export default function PaymentPage() {
  const navigate = useNavigate();
  const { cart, subtotal, clearCart } = useCart();
  
  // En este punto, como no hay IVA en este proyecto, total = subtotal
  const total = subtotal;
  
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [cashReceived, setCashReceived] = useState(total > 0 ? total.toString() : '0');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [ticketData, setTicketData] = useState<TicketData | null>(null);

  // Redirigir a ventas si el carrito está vacío
  useEffect(() => {
    if (cart.length === 0) {
      navigate('/sales');
    }
  }, [cart, navigate]);

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
      setCashReceived((prev) => (prev === '0' && key !== '.' ? key : prev + key));
    }
  };

  const handleConfirmPayment = async () => {
    if (paymentMethod === 'cash' && change < 0) {
      setError('El efectivo recibido es menor al total a pagar.');
      return;
    }

    setLoading(true);
    setError('');

    const parsedCash = paymentMethod === 'cash' ? parseFloat(cashReceived) : undefined;
    
    const result = await createSale(cart, paymentMethod, parsedCash);
    
    setLoading(false);

    if (result.ok) {
      // Preparar los datos del ticket para impresión
      const cashierName = localStorage.getItem('pos_user_name') || 'Cajero';
      const ticket: TicketData = {
        saleId: result.saleId || 0,
        items: cart.map(item => ({
          name: item.product.name,
          quantity: item.quantity,
          unitPrice: item.product.price,
          totalPrice: item.product.price * item.quantity,
        })),
        subtotal: subtotal,
        total: total,
        paymentMethod: paymentMethod,
        cashReceived: parsedCash,
        change: paymentMethod === 'cash' ? change : undefined,
        cashierName: cashierName,
        date: new Date().toISOString(),
      };
      setTicketData(ticket);
      // El componente TicketPrint se encargará de llamar a window.print()
    } else {
      const errorMsg = result.message || 'Error al procesar el pago';
      setError(errorMsg);
      alert(errorMsg);
    }
  };

  // Callback que se ejecuta cuando termina la impresión (o se cancela)
  const handlePrintDone = useCallback(() => {
    setTicketData(null);
    clearCart();
    navigate('/sales');
  }, [clearCart, navigate]);

  if (cart.length === 0) return null; // Prevenir renderizado fugaz antes del redirect

  return (
    <div className="payment-page">
      {/* Header */}
      <header className="payment-header">
        <button className="payment-back-btn" onClick={() => navigate('/sales')} disabled={loading}>
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
          <button className="payment-header-icon" onClick={() => window.location.reload()}>
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
              No incluye IVA. {cart.length} artículo(s).
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
                disabled={loading}
              >
                <Banknote size={28} />
                <span>Efectivo</span>
              </button>
              <button
                className={`payment-method-btn ${
                  paymentMethod === 'card' ? 'payment-method-btn--active' : ''
                }`}
                onClick={() => setPaymentMethod('card')}
                disabled={loading}
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
                disabled={loading}
              >
                <Building2 size={28} />
                <span>Transferencia</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column - Cash Input & Change */}
        <div className="payment-right">
          {error && (
            <div style={{ backgroundColor: 'var(--color-danger-bg)', color: 'var(--color-danger)', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px', fontWeight: 500, border: '1px solid rgba(220,38,38,0.2)' }}>
              {error}
            </div>
          )}

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
                      disabled={loading}
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
            disabled={loading || (paymentMethod === 'cash' && change < 0)}
            style={{ opacity: (loading || (paymentMethod === 'cash' && change < 0)) ? 0.7 : 1 }}
          >
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Loader2 size={20} className="login-spinner" /> Procesando...
              </span>
            ) : (
              'Confirmar Pago'
            )}
          </button>
        </div>
      </div>

      {/* Componente de Ticket (invisible en pantalla, visible al imprimir) */}
      {ticketData && (
        <TicketPrint data={ticketData} onPrintDone={handlePrintDone} />
      )}
    </div>
  );
}
