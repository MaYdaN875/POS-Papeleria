import { ArrowRight, Check, Loader2, Minus, Plus, Search, ShoppingBag, Trash2, X, Layers } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config';
import { useCart } from '../context/CartContext';
import { useBarcodeScanner } from '../hooks/useBarcodeScanner';
import { getCategories, getProducts, type Product, type Presentation } from '../services/productService';
import '../styles/SalesPage.css';
import MobileScannerButton from '../components/MobileScannerButton';
import { useBackHandler } from '../utils/backButtonManager';

export default function SalesPage() {
  const navigate = useNavigate();
  const { cart, addToCart, updateQuantity, setQuantity, removeFromCart, clearCart, subtotal } = useCart();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>(['Todos']);
  const [activeCategory, setActiveCategory] = useState('Todos');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [qtyDrafts, setQtyDrafts] = useState<Record<string, string>>({});

  // Estados para móvil: Carrito flotante, Bottom Sheet y selector de presentaciones
  const [showMobileCart, setShowMobileCart] = useState(false);
  const [presModalProduct, setPresModalProduct] = useState<Product | null>(null);
  const [addedToast, setAddedToast] = useState<string | null>(null);

  // Cerrar modales móviles al presionar el botón atrás
  useBackHandler(showMobileCart, () => setShowMobileCart(false));
  useBackHandler(presModalProduct !== null, () => setPresModalProduct(null));

  const totalUnits = cart.reduce((sum, item) => sum + item.quantity, 0);

  const triggerToast = (msg: string) => {
    setAddedToast(msg);
    setTimeout(() => {
      setAddedToast((curr) => (curr === msg ? null : curr));
    }, 1800);
  };

  const handleProductClick = (product: Product) => {
    if (product.stock <= 0) {
      alert('Producto agotado');
      return;
    }

    // Si tiene más de una presentación activa, abrir modal para que elija
    const activePres = (product.presentations || []).filter((p) => p.isActive !== false);
    if (activePres.length > 1) {
      setPresModalProduct(product);
      return;
    }

    const defaultPres = activePres.find((pr) => pr.isDefault) ?? activePres[0];
    if (addToCart(product, defaultPres)) {
      triggerToast(`+1 ${product.name}`);
    } else {
      alert(`Stock máximo alcanzado para: ${product.name}`);
    }
  };

  const handleSearchAdd = (code: string): boolean => {
    let foundProduct: Product | null = null;
    let foundPresentation: Presentation | null = null;

    // 1. Buscar por código de barras de presentación
    for (const p of products) {
      if (p.presentations) {
        const pr = p.presentations.find((pres) => pres.barcode === code);
        if (pr) {
          foundProduct = p;
          foundPresentation = pr;
          break;
        }
      }
    }

    // 2. Buscar por ID o barcodes heredados del producto
    if (!foundProduct) {
      foundProduct =
        products.find(
          (p) =>
            p.id.toString() === code ||
            p.name.toLowerCase() === code.toLowerCase() ||
            (p.barcodes && p.barcodes.includes(code))
        ) || null;
      if (foundProduct) {
        foundPresentation =
          foundProduct.presentations?.find((pr) => pr.isDefault) ??
          foundProduct.presentations?.[0] ?? {
            id: 0,
            productId: foundProduct.id,
            name: 'Pieza',
            barcode: foundProduct.barcodes?.[0] || null,
            unitsPerSale: 1.0,
            salePrice: foundProduct.price,
            isDefault: true,
            isActive: true,
          };
      }
    }

    if (foundProduct && foundPresentation) {
      if (!addToCart(foundProduct, foundPresentation)) {
        alert(`Sin stock disponible para: ${foundProduct.name} (${foundPresentation.name})`);
      } else {
        setSearchTerm('');
        triggerToast(`+1 ${foundProduct.name}`);
      }
      return true;
    }
    return false;
  };

  // Detectar escáner de código de barras
  useBarcodeScanner({
    onScan: (code) => {
      if (!handleSearchAdd(code)) {
        alert(`Producto no encontrado para el código: ${code}`);
      }
    },
  });

  async function loadProducts() {
    try {
      setLoading(true);
      const prods = await getProducts();
      setProducts(prods);
      setCategories(getCategories(prods));
      setError('');
    } catch (err) {
      console.error(err);
      setError('No se pudieron cargar los productos');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProducts();
  }, []);

  // Refrescar stock al volver de un pago
  useEffect(() => {
    const onFocus = () => loadProducts();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  // Filtrar productos por categoría y búsqueda (solo productos activos)
  const filteredProducts = products.filter((p) => {
    if (p.isActive === false) return false;
    const matchesCategory =
      activeCategory === 'Todos' || p.parentCategory === activeCategory;

    const query = searchTerm.toLowerCase().trim();
    if (query === '') return matchesCategory;

    const matchesSearch =
      p.name.toLowerCase().includes(query) ||
      p.brand.toLowerCase().includes(query) ||
      p.id.toString() === query ||
      (p.barcodes && p.barcodes.includes(query)) ||
      (p.presentations && p.presentations.some((pr) => pr.barcode && pr.barcode.toLowerCase() === query));

    return matchesCategory && matchesSearch;
  });

  const orderNumber = `#${Date.now().toString().slice(-5)}-POS`;

  /**
   * Construye la URL de la imagen del producto.
   */
  const getImageUrl = (imagePath: string) => {
    if (imagePath.startsWith('http')) return imagePath;
    return `https://godart-papelería.com${imagePath}`;
  };

  // Renderizar la lista de artículos del carrito
  const renderCartItemsList = () => {
    if (cart.length === 0) {
      return (
        <div className="sales-cart-empty">
          <p>Agrega productos al carrito</p>
        </div>
      );
    }

    return cart.map((item) => {
      const uniqueKey = `${item.product.id}-${item.presentation.id}`;
      return (
        <div className="sales-cart-item" key={uniqueKey}>
          <div className="sales-cart-item-image">
            <img
              src={getImageUrl(item.product.image)}
              alt={item.product.name}
              className="sales-cart-item-img"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
          <div className="sales-cart-item-info">
            <span className="sales-cart-item-name" style={{ fontWeight: 600 }}>
              {item.product.name}
            </span>

            {/* Selector de Presentación en Carrito */}
            {item.product.presentations && item.product.presentations.length > 1 ? (
              <select
                className="sales-cart-item-presentation-select"
                value={item.presentation.id}
                onChange={(e) => {
                  const presId = parseInt(e.target.value, 10);
                  const nextPres = item.product.presentations?.find((pr) => pr.id === presId);
                  if (nextPres) {
                    removeFromCart(item.product.id, item.presentation.id);
                    if (!addToCart(item.product, nextPres)) {
                      addToCart(item.product, item.presentation);
                      alert(`Stock insuficiente para cambiar a la presentación: ${nextPres.name}`);
                    }
                  }
                }}
                style={{
                  fontSize: '0.8rem',
                  padding: '2px 4px',
                  borderRadius: '4px',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-bg-card)',
                  color: 'var(--color-text-main)',
                  marginTop: '4px',
                  cursor: 'pointer',
                  maxWidth: '150px',
                }}
              >
                {item.product.presentations.map((pr) => (
                  <option key={pr.id} value={pr.id}>
                    {pr.name} (${pr.salePrice.toFixed(2)})
                  </option>
                ))}
              </select>
            ) : (
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                {item.presentation.name} (${item.presentation.salePrice.toFixed(2)})
              </span>
            )}

            <div className="sales-cart-item-controls" style={{ marginTop: '8px' }}>
              <button
                type="button"
                className="sales-cart-qty-btn"
                onClick={() => {
                  updateQuantity(item.product.id, item.presentation.id, -1);
                  setQtyDrafts((prev) => {
                    const next = { ...prev };
                    delete next[`${item.product.id}-${item.presentation.id}`];
                    return next;
                  });
                }}
              >
                <Minus size={14} />
              </button>
              <input
                type="text"
                inputMode="numeric"
                className="sales-cart-qty-input"
                aria-label={`Cantidad de ${item.product.name}`}
                value={
                  qtyDrafts[`${item.product.id}-${item.presentation.id}`] ??
                  String(item.quantity)
                }
                onChange={(e) => {
                  const raw = e.target.value.replace(/\D/g, '');
                  const key = `${item.product.id}-${item.presentation.id}`;
                  setQtyDrafts((prev) => ({ ...prev, [key]: raw }));
                  if (raw === '') return;
                  const qty = Number.parseInt(raw, 10);
                  if (!Number.isFinite(qty)) return;
                  if (!setQuantity(item.product.id, item.presentation.id, qty)) {
                    alert(`Stock máximo alcanzado para: ${item.product.name} (${item.presentation.name})`);
                  }
                }}
                onBlur={() => {
                  const key = `${item.product.id}-${item.presentation.id}`;
                  const draft = qtyDrafts[key];
                  setQtyDrafts((prev) => {
                    const next = { ...prev };
                    delete next[key];
                    return next;
                  });
                  if (draft === undefined) return;
                  if (draft === '') {
                    setQuantity(item.product.id, item.presentation.id, item.quantity);
                    return;
                  }
                  const qty = Number.parseInt(draft, 10);
                  if (!Number.isFinite(qty) || qty <= 0) {
                    setQuantity(item.product.id, item.presentation.id, 1);
                    return;
                  }
                  if (!setQuantity(item.product.id, item.presentation.id, qty)) {
                    alert(`Stock máximo alcanzado para: ${item.product.name} (${item.presentation.name})`);
                  }
                }}
                onFocus={(e) => e.target.select()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    (e.target as HTMLInputElement).blur();
                  }
                }}
              />
              <button
                type="button"
                className="sales-cart-qty-btn"
                onClick={() => {
                  if (!updateQuantity(item.product.id, item.presentation.id, 1)) {
                    alert(`Stock máximo alcanzado para: ${item.product.name} (${item.presentation.name})`);
                  }
                  setQtyDrafts((prev) => {
                    const next = { ...prev };
                    delete next[`${item.product.id}-${item.presentation.id}`];
                    return next;
                  });
                }}
              >
                <Plus size={14} />
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', justifyContent: 'space-between' }}>
            <button
              onClick={() => removeFromCart(item.product.id, item.presentation.id)}
              style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', padding: '4px' }}
              title="Eliminar producto"
            >
              <Trash2 size={16} />
            </button>
            <span className="sales-cart-item-price" style={{ fontWeight: 700 }}>
              ${(item.presentation.salePrice * item.quantity).toFixed(2)}
            </span>
          </div>
        </div>
      );
    });
  };

  return (
    <div className="sales">
      {/* Toast flotante de producto agregado */}
      {addedToast && (
        <div className="sales-toast">
          <Check size={16} className="text-green-400" />
          <span>{addedToast}</span>
        </div>
      )}

      {/* Products Section */}
      <div className="sales-products">
        <div className="sales-products-header">
          <div>
            <h1 className="sales-title">Productos</h1>
            <p className="sales-subtitle">
              {products.filter((p) => p.isActive !== false).length} productos disponibles
            </p>
          </div>
          <div className="sales-categories">
            {categories.map((cat) => (
              <button
                key={cat}
                className={`sales-category-btn ${
                  activeCategory === cat ? 'sales-category-btn--active' : ''
                }`}
                onClick={() => setActiveCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Search bar */}
        <div className="sales-search">
          <Search size={18} className="sales-search-icon" />
          <input
            type="text"
            placeholder="Buscar producto por nombre..."
            className="sales-search-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const term = searchTerm.trim();
                if (term) {
                  handleSearchAdd(term);
                }
              }
            }}
          />
          <MobileScannerButton
            onScan={(code) => {
              if (!handleSearchAdd(code)) {
                alert(`Producto no encontrado para el código: ${code}`);
              }
            }}
            iconOnly={true}
            className="sales-mobile-scan-btn"
          />
        </div>

        {/* Loading / Error / Products */}
        {loading ? (
          <div className="sales-loading">
            <Loader2 size={32} className="sales-spinner" />
            <p>Cargando productos...</p>
          </div>
        ) : error ? (
          <div className="sales-error">
            <p>{error}</p>
            <button onClick={() => window.location.reload()}>Reintentar</button>
          </div>
        ) : (
          <div className="sales-grid">
            {filteredProducts.map((product) => (
              <div
                className="sales-product-card"
                key={product.id}
                onClick={() => handleProductClick(product)}
                style={{ opacity: product.stock <= 0 ? 0.5 : 1, cursor: product.stock <= 0 ? 'not-allowed' : 'pointer' }}
              >
                <div className="sales-product-image">
                  <img
                    src={getImageUrl(product.image)}
                    alt={product.name}
                    className="sales-product-img"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = `${API_BASE_URL}/../images/boligrafos.jpg`;
                    }}
                  />
                </div>
                <div className="sales-product-info">
                  <div className="sales-product-title-group">
                    <span className="sales-product-name" title={product.name}>
                      {product.name}
                    </span>
                    {product.brand && (
                      <span className="sales-product-brand">{product.brand}</span>
                    )}
                  </div>
                  <span className="sales-product-price">
                    ${product.price.toFixed(2)}
                  </span>
                </div>
                {product.isOffer && (
                  <span className="sales-product-offer">
                    -{product.discountPercentage}%
                  </span>
                )}
                <span
                  className={`sales-product-stock ${
                    product.stock < 5 ? 'sales-product-stock--low' : ''
                  }`}
                >
                  {product.stock > 0 ? `EN STOCK: ${product.stock}` : 'AGOTADO'}
                </span>
              </div>
            ))}
          </div>
        )}

        {!loading && filteredProducts.length === 0 && !error && (
          <div className="sales-empty">
            <p>No se encontraron productos</p>
          </div>
        )}
      </div>

      {/* Cart Section para Escritorio */}
      <div className="sales-cart">
        <div className="sales-cart-header">
          <div>
            <h2 className="sales-cart-title">Carrito</h2>
            <span className="sales-cart-order">Orden {orderNumber}</span>
          </div>
          <span className="sales-cart-badge">
            {totalUnits} ARTÍCULOS
          </span>
        </div>

        <div className="sales-cart-items">
          {renderCartItemsList()}
        </div>

        <div className="sales-cart-footer">
          <div className="sales-cart-subtotal">
            <span>Subtotal</span>
            <span className="sales-cart-subtotal-amount">
              ${subtotal.toFixed(2)}
            </span>
          </div>
          <button
            className="sales-checkout-btn"
            onClick={() => navigate('/payment')}
            disabled={cart.length === 0}
          >
            Cobrar
            <ArrowRight size={18} />
          </button>
        </div>
      </div>

      {/* BARRA FLOTANTE DE COBRO MÓVIL (Siempre visible al desplazarse en celular) */}
      {cart.length > 0 && (
        <div className="sales-floating-cart-bar">
          <div 
            className="sales-floating-cart-info"
            onClick={() => setShowMobileCart(true)}
          >
            <div className="sales-floating-cart-icon-badge">
              <ShoppingBag size={20} />
              <span className="sales-floating-cart-badge">{totalUnits}</span>
            </div>
            <div className="sales-floating-cart-text">
              <span className="sales-floating-cart-total">${subtotal.toFixed(2)}</span>
              <span className="sales-floating-cart-action-link">Ver carrito</span>
            </div>
          </div>

          <button
            type="button"
            className="sales-floating-checkout-btn"
            onClick={() => navigate('/payment')}
          >
            Cobrar
            <ArrowRight size={18} />
          </button>
        </div>
      )}

      {/* MODAL / BOTTOM SHEET DE CARRITO EN MÓVILES */}
      {showMobileCart && (
        <div className="sales-cart-sheet-overlay" onClick={() => setShowMobileCart(false)}>
          <div className="sales-cart-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sales-cart-sheet-header">
              <div className="flex items-center gap-2">
                <ShoppingBag size={22} className="text-blue-600" />
                <h3 className="sales-cart-sheet-title">
                  Carrito ({totalUnits} art.)
                </h3>
              </div>
              <button 
                type="button" 
                className="sales-cart-sheet-close"
                onClick={() => setShowMobileCart(false)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="sales-cart-sheet-body">
              {renderCartItemsList()}
            </div>

            <div className="sales-cart-sheet-footer">
              <div className="sales-cart-sheet-subtotal-row">
                <button
                  type="button"
                  onClick={clearCart}
                  className="sales-cart-clear-btn"
                >
                  Vaciar carrito
                </button>
                <div className="sales-cart-sheet-total-box">
                  <span className="sales-cart-sheet-total-label">Total a cobrar:</span>
                  <span className="sales-cart-sheet-total-value">${subtotal.toFixed(2)}</span>
                </div>
              </div>

              <button
                type="button"
                className="sales-checkout-btn"
                onClick={() => {
                  setShowMobileCart(false);
                  navigate('/payment');
                }}
                disabled={cart.length === 0}
              >
                Proceder al Pago
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE ELECCIÓN DE PRESENTACIÓN AL HACER CLICK EN PRODUCTO */}
      {presModalProduct && (
        <div className="sales-pres-modal-overlay" onClick={() => setPresModalProduct(null)}>
          <div className="sales-pres-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="sales-pres-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Layers size={20} color="var(--color-primary)" />
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>
                  Elegir Presentación
                </h3>
              </div>
              <button 
                type="button" 
                onClick={() => setPresModalProduct(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)' }}
              >
                <X size={20} />
              </button>
            </div>
            
            <p style={{ margin: '8px 0 16px 0', fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>
              Selecciona cómo deseas vender <strong>{presModalProduct.name}</strong>:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {(presModalProduct.presentations || [])
                .filter((pr) => pr.isActive !== false)
                .map((pr) => (
                  <button
                    key={pr.id}
                    type="button"
                    onClick={() => {
                      if (addToCart(presModalProduct, pr)) {
                        triggerToast(`+1 ${presModalProduct.name} (${pr.name})`);
                        setPresModalProduct(null);
                      } else {
                        alert(`Stock insuficiente para vender ${pr.name}`);
                      }
                    }}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px 16px',
                      background: 'var(--color-bg-card)',
                      border: '1px solid var(--color-border)',
                      borderRadius: '14px',
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--color-text-primary)' }}>
                        {pr.name}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                        {pr.unitsPerSale} {presModalProduct.baseUnit || 'u.'} por unidad
                      </div>
                    </div>
                    <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--color-primary)' }}>
                      ${pr.salePrice.toFixed(2)}
                    </div>
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
