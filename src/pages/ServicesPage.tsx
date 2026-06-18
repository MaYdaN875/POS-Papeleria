import React, { useEffect, useState } from 'react';
import { Smartphone, Zap, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { useTaecelStore } from '../store/taecelStore';
import { TaecelProduct } from '../types/taecel';
import '../styles/ServicesPage.css';

export const ServicesPage: React.FC = () => {
  const { balance, products, fetchBalance, fetchProducts, performTransaction, isLoading, error: storeError, productsLoading, productsError } = useTaecelStore();
  
  const [selectedProduct, setSelectedProduct] = useState<TaecelProduct | null>(null);
  const [reference, setReference] = useState('');
  const [amount, setAmount] = useState<number | ''>('');
  const [search, setSearch] = useState('');
  const [selectedCarrier, setSelectedCarrier] = useState<string | null>(null);
  
  const [successMsg, setSuccessMsg] = useState('');
  const [localError, setLocalError] = useState('');

  useEffect(() => {
    fetchBalance();
    fetchProducts();
  }, [fetchBalance, fetchProducts]);

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
    // Si el producto tiene monto fijo, se pone solo y queda bloqueado
    setAmount(product.amount && product.amount > 0 ? product.amount : '');
    setSuccessMsg('');
    setLocalError('');
  };

  const handleSubmit = async () => {
    setLocalError('');
    setSuccessMsg('');
    
    if (!selectedProduct) {
      setLocalError('Selecciona una compañía primero.');
      return;
    }
    
    if (selectedProduct.type === 'recarga' && reference.length !== 10) {
      setLocalError('El número de celular debe tener 10 dígitos.');
      return;
    }

    if (!amount || amount <= 0) {
      setLocalError('Ingresa un monto válido.');
      return;
    }

    try {
      const tx = await performTransaction(selectedProduct.id, reference, Number(amount));
      setSuccessMsg(`¡Exitosa! Folio: ${tx.authorization_code}`);
      setReference('');
      setAmount('');
    } catch (err: any) {
      // El error ya se maneja en el store, pero lo cachamos aquí si queremos
    }
  };

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
        </div>
      </div>

      <div className="services-grid">
        <div className="products-container">
          <h2>1. Selecciona Compañía / Servicio</h2>
          {productsLoading && products.length === 0 ? (
            <p className="products-state">
              <Loader2 className="spinner" size={20} /> Cargando productos...
            </p>
          ) : products.length === 0 ? (
            <div className="message-alert error">
              <XCircle size={20} />
              {productsError || 'No se cargaron productos de Taecel. Revisa que el archivo taecel_config.php tenga las llaves correctas.'}
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
                </>
              )}
            </>
          )}
        </div>

        <div className="transaction-panel">
          <h2>2. Detalles del Cobro</h2>
          
          {!selectedProduct ? (
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', marginTop: '2rem' }}>
              Selecciona una opción a la izquierda para continuar.
            </p>
          ) : (
            <>
              {successMsg && (
                <div className="message-alert success">
                  <CheckCircle size={20} />
                  {successMsg}
                </div>
              )}
              {(localError || storeError) && (
                <div className="message-alert error">
                  <XCircle size={20} />
                  {localError || storeError}
                </div>
              )}

              <div className="form-group">
                <label>
                  {selectedProduct.type === 'recarga' ? 'Número de Celular a 10 dígitos' : 'Número de Referencia'}
                </label>
                <input 
                  type="text" 
                  className="form-input"
                  placeholder={selectedProduct.type === 'recarga' ? "55 1234 5678" : "0000000000"}
                  value={reference}
                  onChange={(e) => setReference(e.target.value.replace(/\D/g, '').slice(0, selectedProduct.type === 'recarga' ? 10 : 30))}
                />
              </div>

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
                disabled={isLoading || !reference || !amount}
              >
                {isLoading ? <Loader2 className="spinner" size={20} /> : <Zap size={20} />}
                {isLoading ? 'Procesando...' : `Cobrar e Imprimir Ticket`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
