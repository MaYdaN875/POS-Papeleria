import { ArrowRight, Loader2, Minus, Plus, Search, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config';
import { useCart } from '../context/CartContext';
import { useBarcodeScanner } from '../hooks/useBarcodeScanner';
import { getCategories, getProducts, type Product } from '../services/productService';
import '../styles/SalesPage.css';

export default function SalesPage() {
  const navigate = useNavigate();
  const { cart, addToCart, updateQuantity, removeFromCart, subtotal } = useCart();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>(['Todos']);
  const [activeCategory, setActiveCategory] = useState('Todos');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Detectar escáner de código de barras
  useBarcodeScanner({
    onScan: (code) => {
      // Buscar el producto por código de barras, id, sku o nombre exacto
      const product = products.find(
        (p) =>
          p.id.toString() === code ||
          p.name.toLowerCase() === code.toLowerCase() ||
          (p as any).barcode === code ||
          (p as any).sku === code ||
          (p.barcodes && p.barcodes.includes(code))
      );

      if (product) {
        addToCart(product);
        // Limpiamos el buscador si el usuario estaba escribiendo
        setSearchTerm('');
      } else {
        alert(`Producto no encontrado para el código: ${code}`);
      }
    },
  });

  // Cargar productos de la API
  useEffect(() => {
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
    loadProducts();
  }, []);

  // Filtrar productos por categoría y búsqueda
  const filteredProducts = products.filter((p) => {
    const matchesCategory =
      activeCategory === 'Todos' || p.parentCategory === activeCategory;
    const matchesSearch =
      searchTerm === '' ||
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.brand.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const orderNumber = `#${Date.now().toString().slice(-5)}-POS`;

  /**
   * Construye la URL de la imagen del producto.
   */
  const getImageUrl = (imagePath: string) => {
    if (imagePath.startsWith('http')) return imagePath;
    // Las imágenes están en Hostinger
    return `https://godart-papelería.com${imagePath}`;
  };

  return (
    <div className="sales">
      {/* Products Section */}
      <div className="sales-products">
        <div className="sales-products-header">
          <div>
            <h1 className="sales-title">Productos</h1>
            <p className="sales-subtitle">
              {products.length} productos disponibles
            </p>
          </div>
          <div className="sales-categories">
            {categories.slice(0, 6).map((cat) => (
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
            <button onClick={() => window.location.reload()}>
              Reintentar
            </button>
          </div>
        ) : (
          <div className="sales-grid">
            {filteredProducts.map((product) => (
              <div
                className="sales-product-card"
                key={product.id}
                onClick={() => addToCart(product)}
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
                  <span className="sales-product-name">{product.name}</span>
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
                  {product.stock > 0
                    ? `EN STOCK: ${product.stock}`
                    : 'AGOTADO'}
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

      {/* Cart Section */}
      <div className="sales-cart">
        <div className="sales-cart-header">
          <div>
            <h2 className="sales-cart-title">Carrito</h2>
            <span className="sales-cart-order">Orden {orderNumber}</span>
          </div>
          <span className="sales-cart-badge">
            {cart.length} ARTÍCULOS
          </span>
        </div>

        <div className="sales-cart-items">
          {cart.length === 0 ? (
            <div className="sales-cart-empty">
              <p>Agrega productos al carrito</p>
            </div>
          ) : (
            cart.map((item) => (
              <div className="sales-cart-item" key={item.product.id}>
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
                  <span className="sales-cart-item-name">
                    {item.product.name}
                  </span>
                  <div className="sales-cart-item-controls">
                    <button
                      className="sales-cart-qty-btn"
                      onClick={() => updateQuantity(item.product.id, -1)}
                    >
                      <Minus size={14} />
                    </button>
                    <span className="sales-cart-qty">
                      {String(item.quantity).padStart(2, '0')}
                    </span>
                    <button
                      className="sales-cart-qty-btn"
                      onClick={() => updateQuantity(item.product.id, 1)}
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                  <button 
                    onClick={() => removeFromCart(item.product.id)}
                    style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', padding: '4px' }}
                    title="Eliminar producto"
                  >
                    <Trash2 size={16} />
                  </button>
                  <span className="sales-cart-item-price">
                    ${(item.product.price * item.quantity).toFixed(2)}
                  </span>
                </div>
              </div>
            ))
          )}
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
    </div>
  );
}
