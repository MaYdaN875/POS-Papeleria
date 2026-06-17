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
    FileText,
    CheckCircle2
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { REGIMENES_FISCALES, USOS_CFDI, InvoiceCustomer, InvoiceResponse } from '../types/invoicing';
import { InvoiceService } from '../services/invoicing/InvoiceService';
import { saveInvoiceToBackend } from '../services/invoicing/backendService';
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

  // Invoicing states
  const [wantsInvoice, setWantsInvoice] = useState(false);
  const [invoiceCustomer, setInvoiceCustomer] = useState<InvoiceCustomer>({
    rfc: '',
    razonSocial: '',
    regimenFiscal: '601',
    codigoPostal: '',
    email: '',
  });
  const [usoCFDI, setUsoCFDI] = useState('G03');
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoiceResult, setInvoiceResult] = useState<InvoiceResponse | null>(null);

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

    if (wantsInvoice) {
      // Validate customer fields
      const { rfc, razonSocial, codigoPostal, email } = invoiceCustomer;
      if (!rfc || !razonSocial || !codigoPostal || !email) {
        setError('Complete todos los campos fiscales del cliente.');
        return;
      }
      const rfcRegex = /^[A-Z&Ñ]{3,4}\d{6}[A-Z\d]{3}$/i;
      if (!rfcRegex.test(rfc)) {
        setError('El RFC ingresado no tiene un formato válido.');
        return;
      }
      if (codigoPostal.length !== 5) {
        setError('El Código Postal debe ser de 5 dígitos.');
        return;
      }
    }

    setLoading(true);
    setError('');

    const parsedCash = paymentMethod === 'cash' ? parseFloat(cashReceived) : undefined;
    
    const result = await createSale(cart, paymentMethod, parsedCash, taxRate);
    
    setLoading(false);

    if (result.ok) {
      setPaymentSuccess(result.saleId ?? 0);
      playCashSound();
      const saleId = result.saleId || 0;
      
      let invoiceCreatedSuccessfully = false;
      let tempInvoiceResult: InvoiceResponse | null = null;

      if (wantsInvoice) {
        setInvoiceLoading(true);
        try {
          const reqItems = cart.map(item => ({
            productId: item.product.id,
            name: item.product.name,
            quantity: item.quantity,
            price: item.product.price,
            taxRate: settings?.taxRate || 0,
            claveProdServ: '01010101', // Genérico por defecto
            claveUnidad: 'H87' // Pieza por defecto
          }));

          const taxRate = settings?.taxRate || 0;
          const taxAmount = subtotal * taxRate / 100;

          const invoiceRes = await InvoiceService.createInvoice({
            saleId,
            paymentMethod,
            customer: invoiceCustomer,
            usoCFDI,
            items: reqItems,
            subtotal,
            taxAmount,
            total
          });

          if (invoiceRes.success && invoiceRes.uuid) {
            tempInvoiceResult = invoiceRes;
            // Guardar factura en el backend
            await saveInvoiceToBackend({
              sale_id: saleId,
              uuid: invoiceRes.uuid,
              invoice_number: invoiceRes.invoiceNumber || 'CFDI',
              customer_rfc: invoiceCustomer.rfc,
              customer_name: invoiceCustomer.razonSocial,
              pdf_url: invoiceRes.pdfUrl,
              xml_url: invoiceRes.xmlUrl
            });
            invoiceCreatedSuccessfully = true;
          } else {
            alert(`Venta registrada exitosamente (Ticket #${saleId}), pero falló el timbrado fiscal:\n${invoiceRes.message || 'Error desconocido'}.\n\nPuede intentar timbrar este ticket más tarde desde el panel de Reportes.`);
          }
        } catch (invoiceErr: any) {
          console.error('Error durante el timbrado de la factura:', invoiceErr);
          alert(`Venta registrada exitosamente (Ticket #${saleId}), pero ocurrió un error durante el proceso de facturación:\n${invoiceErr.message || 'Error de conexión'}.\n\nPuede intentar timbrar desde Reportes.`);
        } finally {
          setInvoiceLoading(false);
        }
      }

      // Preparar los datos del ticket para impresión
      const cashierName = localStorage.getItem('pos_user_name') || 'Cajero';
      const ticket: TicketData = {
        saleId: saleId,
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
      if (invoiceCreatedSuccessfully && tempInvoiceResult) {
        setInvoiceResult(tempInvoiceResult);
      } else {
        if (settings && settings.autoPrintTicket === false) {
          setTimeout(() => {
            clearCart();
            navigate('/sales');
          }, 1500);
        } else {
          setTicketData(ticket);
        }
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

  if (invoiceResult) {
    return (
      <div className="payment-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--color-bg-app)' }}>
        <div style={{ background: 'var(--color-bg-card)', padding: '40px', borderRadius: '16px', maxWidth: '500px', width: '90%', textAlign: 'center', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)', border: '1px solid var(--border-light)' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#dcfce7', color: '#166534', width: '64px', height: '64px', borderRadius: '50%', marginBottom: '20px' }}>
            <CheckCircle2 size={36} />
          </div>
          <h2 style={{ fontSize: '24px', fontWeight: 700, margin: '0 0 10px 0', color: 'var(--text-main)' }}>¡Venta y Factura Completadas!</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: '0 0 20px 0' }}>
            La venta se registró correctamente y la factura fiscal ha sido timbrada por el SAT con el proveedor: <strong>{InvoiceService.getProviderName()}</strong>.
          </p>

          <div style={{ background: 'rgba(0,0,0,0.02)', padding: '16px', borderRadius: '12px', textAlign: 'left', marginBottom: '20px', border: '1px solid var(--border-light)', fontSize: '13px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><span style={{ color: 'var(--text-muted)' }}>Ticket ID:</span><strong>#{String(invoiceResult.invoiceNumber).replace('FAC-', '')}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><span style={{ color: 'var(--text-muted)' }}>Folio Fiscal:</span><strong style={{ fontSize: '11px', fontFamily: 'monospace', wordBreak: 'break-all' }}>{invoiceResult.uuid}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><span style={{ color: 'var(--text-muted)' }}>Receptor RFC:</span><strong>{invoiceCustomer.rfc}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Total CFDI:</span><strong>${total.toFixed(2)} MXN</strong></div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
            {invoiceResult.pdfUrl && (
              <a href={invoiceResult.pdfUrl} target="_blank" rel="noreferrer" className="payment-confirm-btn" style={{ background: '#e0f2fe', color: '#0369a1', border: '1px solid rgba(3,105,161,0.2)', padding: '12px', borderRadius: '8px', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '14px', fontWeight: 600 }}>
                Descargar PDF
              </a>
            )}
            {invoiceResult.xmlUrl && (
              <a href={invoiceResult.xmlUrl} target="_blank" rel="noreferrer" className="payment-confirm-btn" style={{ background: '#fef3c7', color: '#b45309', border: '1px solid rgba(180,83,9,0.2)', padding: '12px', borderRadius: '8px', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '14px', fontWeight: 600 }}>
                Descargar XML
              </a>
            )}
          </div>

          <button 
            className="payment-confirm-btn" 
            onClick={() => {
              if (settings?.autoPrintTicket !== false) {
                const cashierName = localStorage.getItem('pos_user_name') || 'Cajero';
                const ticket: TicketData = {
                  saleId: invoiceResult.invoiceNumber ? parseInt(invoiceResult.invoiceNumber.replace('FAC-', '').replace('SAT-CFDI', '')) || 9999 : 9999,
                  items: cart.map(item => ({
                    name: item.product.name,
                    quantity: item.quantity,
                    unitPrice: item.product.price,
                    totalPrice: item.product.price * item.quantity,
                  })),
                  subtotal: subtotal,
                  total: total,
                  paymentMethod: paymentMethod,
                  cashReceived: paymentMethod === 'cash' ? parseFloat(cashReceived) : undefined,
                  change: paymentMethod === 'cash' ? change : undefined,
                  cashierName: cashierName,
                  date: new Date().toISOString(),
                };
                setTicketData(ticket);
                setInvoiceResult(null);
              } else {
                clearCart();
                navigate('/sales');
              }
            }}
            style={{ width: '100%', padding: '14px' }}
          >
            Finalizar Operación
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="payment-page">
      {invoiceLoading && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 9999, color: '#fff' }}>
          <Loader2 size={48} className="settings-spinner" style={{ animation: 'spin 1.5s linear infinite', marginBottom: '16px' }} />
          <h3 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>Timbrando factura ante el SAT...</h3>
          <p style={{ fontSize: '14px', opacity: 0.8, marginTop: '8px' }}>Por favor espere, esto puede tomar unos segundos.</p>
        </div>
      )}
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

          {settings?.invoiceEnabled && (
            <div className="payment-invoice-section" style={{ marginTop: '24px', background: 'var(--color-bg-card)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: wantsInvoice ? '16px' : '0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <FileText size={20} style={{ color: 'var(--pos-primary)' }} />
                  <span style={{ fontWeight: 600, fontSize: '15px' }}>¿Requiere Factura Fiscal?</span>
                </div>
                <label className="settings-switch">
                  <input 
                    type="checkbox" 
                    checked={wantsInvoice} 
                    onChange={(e) => setWantsInvoice(e.target.checked)} 
                  />
                  <span className="settings-slider"></span>
                </label>
              </div>

              {wantsInvoice && (
                <div className="payment-invoice-form animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>RFC</label>
                      <input 
                        type="text" 
                        placeholder="XAXX010101000" 
                        value={invoiceCustomer.rfc} 
                        onChange={(e) => setInvoiceCustomer({ ...invoiceCustomer, rfc: e.target.value.toUpperCase() })} 
                        style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-light)', fontSize: '13px', textTransform: 'uppercase' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>Código Postal</label>
                      <input 
                        type="text" 
                        placeholder="Código Postal" 
                        maxLength={5}
                        value={invoiceCustomer.codigoPostal} 
                        onChange={(e) => setInvoiceCustomer({ ...invoiceCustomer, codigoPostal: e.target.value.replace(/\D/g, '') })} 
                        style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-light)', fontSize: '13px' }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>Nombre o Razón Social</label>
                    <input 
                      type="text" 
                      placeholder="Tal cual aparece en Constancia Fiscal" 
                      value={invoiceCustomer.razonSocial} 
                      onChange={(e) => setInvoiceCustomer({ ...invoiceCustomer, razonSocial: e.target.value.toUpperCase() })} 
                      style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-light)', fontSize: '13px', textTransform: 'uppercase' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>Correo Electrónico (Envío)</label>
                    <input 
                      type="email" 
                      placeholder="correo@cliente.com" 
                      value={invoiceCustomer.email} 
                      onChange={(e) => setInvoiceCustomer({ ...invoiceCustomer, email: e.target.value })} 
                      style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-light)', fontSize: '13px' }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>Régimen Fiscal</label>
                      <select 
                        value={invoiceCustomer.regimenFiscal} 
                        onChange={(e) => setInvoiceCustomer({ ...invoiceCustomer, regimenFiscal: e.target.value })}
                        style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-light)', fontSize: '12px', background: 'var(--color-bg-card)' }}
                      >
                        {REGIMENES_FISCALES.map((r) => (
                          <option key={r.code} value={r.code}>{r.code} - {r.description}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>Uso CFDI</label>
                      <select 
                        value={usoCFDI} 
                        onChange={(e) => setUsoCFDI(e.target.value)}
                        style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-light)', fontSize: '12px', background: 'var(--color-bg-card)' }}
                      >
                        {USOS_CFDI.map((u) => (
                          <option key={u.code} value={u.code}>{u.code} - {u.description}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
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
                  : 'Verifica la transferencia y pulsa Confirmar Pago: se registra la venta y se imprime el ticket.'}
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
