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
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TicketPrint, { TicketData } from '../components/TicketPrint';
import { useCart } from '../context/CartContext';
import { logout } from '../services/authService';
import { createSale } from '../services/salesService';
import { getGlobalSettings, GlobalSettings } from '../services/settingsService';
import { playCashSound } from '../utils/sounds';
import '../styles/PaymentPage.css';

type PaymentMethod = 'cash' | 'card' | 'transfer';

/** Impresora fisica POS58D — cobro siempre en 58mm */
const PAYMENT_TICKET_SIZE = '58mm' as const;

export default function PaymentPage() {
  const navigate = useNavigate();
  const { cart, subtotal, clearCart } = useCart();
  
  const [settings, setSettings] = useState<GlobalSettings | null>(null);

  const ticketPrintSettings = useMemo(
    () => (settings ? { ...settings, printerSize: PAYMENT_TICKET_SIZE } : null),
    [settings]
  );
  
  const taxRate = settings?.taxRate || 0;
  const total = subtotal + (subtotal * taxRate / 100);
  
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [cashReceived, setCashReceived] = useState('0');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [ticketData, setTicketData] = useState<TicketData | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState<number | null>(null);

  // Inicializar cashReceived con el total SOLO una vez al cargar
  const [initialized, setInitialized] = useState(false);
  useEffect(() => {
    if (!initialized && total > 0) {
      setCashReceived(total.toFixed(2));
      setInitialized(true);
    }
  }, [total, initialized]);

  // Cargar ajustes globales
  useEffect(() => {
    getGlobalSettings().then(res => {
      if (res.ok && res.settings) {
        setSettings(res.settings);
      }
    });
  }, []);

  // Redirigir a ventas si el carrito está vacío
  useEffect(() => {
    if (cart.length === 0) {
      navigate('/sales');
    }
  }, [cart, navigate]);

  const change = parseFloat(cashReceived || '0') - total;

  const handleKeyPress = (key: string) => {
    if (key === 'backspace') {
      setCashReceived((prev) => prev.length <= 1 ? '0' : prev.slice(0, -1));
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

  const handleConfirmPayment = async () => {
    if (paymentMethod === 'cash' && change < 0) {
      setError('El efectivo recibido es menor al total a pagar.');
      return;
    }

    setLoading(true);
    setError('');

    const parsedCash = paymentMethod === 'cash' ? parseFloat(cashReceived) : undefined;
    
    const result = await createSale(cart, paymentMethod, parsedCash, taxRate);
    
    setLoading(false);

    if (result.ok) {
      setPaymentSuccess(result.saleId ?? 0);
      playCashSound();
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
      if (settings && settings.autoPrintTicket === false) {
        setTimeout(() => {
          clearCart();
          navigate('/sales');
        }, 1500);
      } else {
        setTicketData(ticket);
      }
    } else if (result.sessionExpired) {
      const errorMsg = 'Tu sesión expiró. Vuelve a iniciar sesión para cobrar.';
      setError(errorMsg);
      alert(errorMsg);
      await logout();
      navigate('/');
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
      {paymentSuccess !== null && !ticketData && (
        <div className="payment-success-banner">
          ¡Compra realizada con éxito! Ticket #{paymentSuccess}
        </div>
      )}

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
              {taxRate > 0 ? (
                <>Subtotal: ${(subtotal).toFixed(2)} | IVA ({taxRate}%): ${(subtotal * taxRate / 100).toFixed(2)}<br/>{cart.length} artículo(s).</>
              ) : (
                <>Sin IVA. {cart.length} artículo(s).</>
              )}
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
                  <input
                    type="text"
                    className="payment-cash-value-input"
                    value={cashReceived}
                    onChange={(e) => {
                      const val = e.target.value;
                      // Solo permitir números y un punto decimal
                      if (/^\d*\.?\d*$/.test(val)) {
                        setCashReceived(val);
                      }
                    }}
                    onFocus={(e) => {
                      // Al hacer click, si es '0', limpiarlo para que escriba libremente
                      if (e.target.value === '0' || e.target.value === total.toFixed(2)) {
                        setCashReceived('');
                      }
                    }}
                    onBlur={(e) => {
                      if (!e.target.value) setCashReceived('0');
                    }}
                    autoFocus
                  />
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
        <TicketPrint data={ticketData} settings={ticketPrintSettings} onPrintDone={handlePrintDone} />
      )}
    </div>
  );
}
