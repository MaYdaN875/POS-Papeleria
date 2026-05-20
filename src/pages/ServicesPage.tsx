import React, { useEffect, useState } from 'react';
import { Smartphone, Zap, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { useTaecelStore } from '../store/taecelStore';
import { TaecelProduct } from '../types/taecel';
import '../styles/ServicesPage.css';

const RECARGA_AMOUNTS = [10, 20, 30, 50, 100, 200, 500];

export const ServicesPage: React.FC = () => {
  const { balance, products, fetchBalance, fetchProducts, performTransaction, isLoading, error: storeError } = useTaecelStore();
  
  const [selectedProduct, setSelectedProduct] = useState<TaecelProduct | null>(null);
  const [reference, setReference] = useState('');
  const [amount, setAmount] = useState<number | ''>('');
  
  const [successMsg, setSuccessMsg] = useState('');
  const [localError, setLocalError] = useState('');

  useEffect(() => {
    fetchBalance();
    fetchProducts();
  }, [fetchBalance, fetchProducts]);

  const handleProductSelect = (product: TaecelProduct) => {
    setSelectedProduct(product);
    setReference('');
    setAmount('');
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
          <div className="products-list">
            {products.map((p) => (
              <div 
                key={p.id} 
                className={`product-card ${selectedProduct?.id === p.id ? 'selected' : ''}`}
                onClick={() => handleProductSelect(p)}
              >
                <div className="product-icon">
                  {p.type === 'servicio' ? <Zap size={24} /> : <Smartphone size={24} />}
                </div>
                <span>{p.name}</span>
              </div>
            ))}
          </div>
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
                {selectedProduct.type === 'recarga' ? (
                  <div className="amounts-grid">
                    {RECARGA_AMOUNTS.map(amt => (
                      <button 
                        key={amt}
                        className={`amount-btn ${amount === amt ? 'selected' : ''}`}
                        onClick={() => setAmount(amt)}
                      >
                        ${amt}
                      </button>
                    ))}
                  </div>
                ) : (
                  <input 
                    type="number" 
                    className="form-input"
                    placeholder="Ej. 250.00"
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
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
