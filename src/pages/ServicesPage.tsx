import React, { useEffect, useState } from 'react';
import { Smartphone, Zap, CheckCircle, XCircle, Loader2, RefreshCw } from 'lucide-react';
import { useTaecelStore } from '../store/taecelStore';
import { TaecelProduct, TaecelTransaction } from '../types/taecel';
import '../styles/ServicesPage.css';

function formatPhoneDisplay(digits: string): string {
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
  return `${digits.slice(0, 2)} ${digits.slice(2, 6)} ${digits.slice(6, 10)}`;
}

export const ServicesPage: React.FC = () => {
  const {
    balance,
    products,
    fetchBalance,
    fetchProducts,
    performTransaction,
    isLoading,
    balanceLoading,
    error: storeError,
    productsLoading,
    productsError,
  } = useTaecelStore();

  const [selectedProduct, setSelectedProduct] = useState<TaecelProduct | null>(null);
  const [reference, setReference] = useState('');
  const [referenceConfirm, setReferenceConfirm] = useState('');
  const [amount, setAmount] = useState<number | ''>('');
  const [search, setSearch] = useState('');
  const [selectedCarrier, setSelectedCarrier] = useState<string | null>(null);
  const [lastTx, setLastTx] = useState<TaecelTransaction | null>(null);
  const [lastProductName, setLastProductName] = useState('');
  const [localError, setLocalError] = useState('');

  useEffect(() => {
    fetchBalance();
    fetchProducts();
    // Solo al montar Recargas; el store cachea para no spamear a Taecel
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const carriers = Array.from(
    new Set(products.map((p) => p.carrier).filter((c) => !!c))
  ).sort((a, b) => a.localeCompare(b));

  const term = search.trim().toLowerCase();
  const filteredProducts = products.filter((p) => {
    if (selectedCarrier && p.carrier !== selectedCarrier) return false;
    if (term) {
      return (
        p.name.toLowerCase().includes(term) ||
        (p.carrier || '').toLowerCase().includes(term)
      );
    }
    return true;
  });

  const handleProductSelect = (product: TaecelProduct) => {
    setSelectedProduct(product);
    setReference('');
    setReferenceConfirm('');
    setAmount(product.amount && product.amount > 0 ? product.amount : '');
    setLastTx(null);
    setLocalError('');
  };

  const handleNewRecharge = () => {
    setSelectedProduct(null);
    setReference('');
    setReferenceConfirm('');
    setAmount('');
    setLastTx(null);
    setLocalError('');
  };

  const handleSubmit = async () => {
    setLocalError('');
    setLastTx(null);

    if (!selectedProduct) {
      setLocalError('Selecciona una compañía primero.');
      return;
    }

    if (selectedProduct.type === 'recarga' && reference.length !== 10) {
      setLocalError('El celular debe tener exactamente 10 dígitos (sin +52).');
      return;
    }

    if (selectedProduct.type === 'recarga' && reference !== referenceConfirm) {
      setLocalError('Los números no coinciden. Verifica el celular y la confirmación.');
      return;
    }

    if (!amount || amount <= 0) {
      setLocalError('Ingresa un monto válido.');
      return;
    }

    try {
      const tx = await performTransaction(
        selectedProduct.id,
        reference,
        Number(amount)
      );
      setLastTx(tx);
      setLastProductName(selectedProduct.name);
      setReference('');
      setReferenceConfirm('');
    } catch {
      // El error ya se muestra desde el store
    }
  };

  const isRecarga = selectedProduct?.type === 'recarga';
  const showReceipt = !!lastTx;
  const phoneMismatch =
    isRecarga
    && reference.length > 0
    && referenceConfirm.length > 0
    && reference !== referenceConfirm;
  const phoneReady =
    !isRecarga
    || (reference.length === 10 && reference === referenceConfirm);

  return (
    <div className="services-page">
      <div className="services-header">
        <h1>
          <Smartphone size={28} />
          Recargas y Servicios
        </h1>
        <div className="taecel-balance">
          <span>Saldo Disponible Taecel</span>
          <strong>
            {balance ? `$${balance.available.toFixed(2)}` : 'Cargando...'}
          </strong>
          <button
            type="button"
            className="taecel-balance-refresh"
            onClick={() => fetchBalance(true)}
            disabled={balanceLoading}
            title="Actualizar saldo"
            aria-label="Actualizar saldo Taecel"
          >
            <RefreshCw size={16} className={balanceLoading ? 'spinner' : ''} />
          </button>
        </div>
      </div>

      <div className="services-grid">
        <div className="products-container">
          <h2>1. Selecciona Compañía / Servicio</h2>
          <div className="products-body">
          {productsLoading && products.length === 0 ? (
            <p className="products-state">
              <Loader2 className="spinner" size={20} /> Cargando productos...
            </p>
          ) : products.length === 0 ? (
            <div className="message-alert error">
              <XCircle size={20} />
              <div>
                <p style={{ margin: 0 }}>{productsError || 'No se cargaron productos de Taecel.'}</p>
                {productsError && (
                  <button
                    type="button"
                    className="products-retry-btn"
                    onClick={() => fetchProducts(true)}
                    disabled={productsLoading}
                  >
                    {productsLoading ? 'Consultando...' : 'Actualizar productos'}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="products-filters">
                <select
                  className="products-select"
                  value={selectedCarrier ?? ''}
                  onChange={(e) => setSelectedCarrier(e.target.value || null)}
                  aria-label="Filtrar por compañía"
                >
                  <option value="">Todas las compañías ({carriers.length})</option>
                  {carriers.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>

                <input
                  type="text"
                  className="products-search"
                  placeholder="Buscar producto..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              {filteredProducts.length === 0 ? (
                <p className="products-state">Sin resultados.</p>
              ) : (
                <>
                <span className="products-list-count">{filteredProducts.length} productos</span>
                <div className="products-list-wrap">
                  <div className="products-list">
                  {filteredProducts.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={`product-card ${selectedProduct?.id === p.id ? 'selected' : ''}`}
                      onClick={() => handleProductSelect(p)}
                    >
                      <div className="product-card-amount">
                        {p.amount && p.amount > 0 ? (
                          <span className="product-monto">${p.amount.toFixed(2)}</span>
                        ) : (
                          <span className="product-monto product-monto--open">Monto<br/>libre</span>
                        )}
                      </div>
                      <div className="product-card-info">
                        {!selectedCarrier && p.carrier && (
                          <span className="product-carrier">{p.carrier}</span>
                        )}
                        <span className="product-desc">{p.name}</span>
                        {p.raw?.Vigencia && (
                          <span className="product-meta">Vigencia: {p.raw.Vigencia}</span>
                        )}
                      </div>
                    </button>
                  ))}
                  </div>
                </div>
                </>
              )}
            </>
          )}
          </div>
        </div>

        <div className="transaction-panel">
          <h2>2. Detalles del Cobro</h2>
          <div className="transaction-body">
          {!selectedProduct && !showReceipt ? (
            <p className="transaction-empty">
              Selecciona una opción a la izquierda para continuar.
            </p>
          ) : showReceipt && lastTx ? (
            <div className="transaction-receipt">
              <div className={`message-alert ${lastTx.status === 'success' ? 'success' : 'warning'}`}>
                <CheckCircle size={20} />
                {lastTx.status === 'success'
                  ? '¡Recarga exitosa en Taecel!'
                  : 'Solicitud enviada — aún no confirmada en Taecel. Revisa el reporte antes de reintentar.'}
              </div>

              <div className="receipt-details">
                <div className="receipt-row">
                  <span>Producto</span>
                  <strong>{lastProductName}</strong>
                </div>
                <div className="receipt-row">
                  <span>{lastTx.reference.length === 10 ? 'Celular' : 'Referencia'}</span>
                  <strong>{lastTx.reference.length === 10 ? formatPhoneDisplay(lastTx.reference) : lastTx.reference}</strong>
                </div>
                <div className="receipt-row">
                  <span>Monto cobrado</span>
                  <strong>${lastTx.amount.toFixed(2)}</strong>
                </div>
                <div className="receipt-row">
                  <span>Folio Taecel</span>
                  <strong className="receipt-folio">{lastTx.authorization_code || lastTx.id}</strong>
                </div>
              </div>

              <p className="receipt-hint">
                Si el saldo no cambia al instante, pulsa ↻ arriba o revisa movimientos en taecel.com.
              </p>

              <button type="button" className="submit-btn submit-btn--secondary" onClick={handleNewRecharge}>
                Nueva recarga
              </button>
            </div>
          ) : selectedProduct ? (
            <>
              {(localError || storeError) && (
                <div className="message-alert error">
                  <XCircle size={20} />
                  {localError || storeError}
                </div>
              )}

              <div className="transaction-product-summary">
                <span className={`transaction-type-badge ${isRecarga ? 'recarga' : 'servicio'}`}>
                  {isRecarga ? 'Recarga celular' : 'Pago de servicio'}
                </span>
                <strong>{selectedProduct.carrier ? `${selectedProduct.carrier} · ` : ''}{selectedProduct.name}</strong>
                <span className="transaction-product-code">Código: {selectedProduct.id}</span>
              </div>

              <div className="form-group">
                <label htmlFor="taecel-reference">
                  {isRecarga ? 'Celular a recargar (10 dígitos)' : 'Número de referencia del recibo'}
                </label>
                <input
                  id="taecel-reference"
                  type="tel"
                  className={`form-input${phoneMismatch ? ' form-input--error' : ''}`}
                  placeholder={isRecarga ? 'Ej: 5512345678' : 'Referencia del recibo (agua, luz, etc.)'}
                  value={formatPhoneDisplay(reference)}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, '').slice(0, isRecarga ? 10 : 30);
                    setReference(digits);
                    if (localError.includes('no coinciden')) {
                      setLocalError('');
                    }
                  }}
                  autoComplete="off"
                />
                {isRecarga && (
                  <span className="form-hint">Solo el número, sin +52 ni espacios al guardar.</span>
                )}
              </div>

              {isRecarga && (
                <div className="form-group">
                  <label htmlFor="taecel-reference-confirm">
                    Confirmar celular (10 dígitos)
                  </label>
                  <input
                    id="taecel-reference-confirm"
                    type="tel"
                    className={`form-input${phoneMismatch ? ' form-input--error' : ''}`}
                    placeholder="Repite el mismo número"
                    value={formatPhoneDisplay(referenceConfirm)}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                      setReferenceConfirm(digits);
                      if (localError.includes('no coinciden')) {
                        setLocalError('');
                      }
                    }}
                    autoComplete="off"
                  />
                  {phoneMismatch ? (
                    <span className="form-hint form-hint--error">
                      Los números no coinciden. Revisa ambos campos.
                    </span>
                  ) : (
                    <span className="form-hint">Debe ser idéntico al número de arriba.</span>
                  )}
                </div>
              )}

              <div className="form-group">
                <label>Monto a Cobrar ($)</label>
                {selectedProduct.amount && selectedProduct.amount > 0 ? (
                  <div className="fixed-amount">${selectedProduct.amount.toFixed(2)}</div>
                ) : (
                  <input
                    type="text"
                    inputMode="decimal"
                    className="form-input"
                    placeholder="Ej. 250.00"
                    value={amount}
                    onChange={(e) => {
                      const clean = e.target.value.replace(',', '.').replace(/[^0-9.]/g, '');
                      setAmount(clean === '' ? '' : Number(clean));
                    }}
                  />
                )}
              </div>

              <button
                className="submit-btn"
                onClick={handleSubmit}
                disabled={isLoading || !reference || !amount || !phoneReady}
              >
                {isLoading ? <Loader2 className="spinner" size={20} /> : <Zap size={20} />}
                {isLoading ? 'Procesando con Taecel (hasta 1 min)...' : 'Cobrar recarga'}
              </button>
            </>
          ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};
