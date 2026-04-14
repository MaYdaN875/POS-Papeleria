import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Minus, Plus, ArrowRight } from 'lucide-react';
import { products, sampleCart, type CartItem, type Product } from '../data/mockData';
import '../styles/SalesPage.css';

const categories = ['Todos', 'Papel', 'Escritura', 'Arte'];

export default function SalesPage() {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState('Todos');
  const [cart, setCart] = useState<CartItem[]>(sampleCart);

  const featured = products.find((p) => p.featured);

  const filteredProducts = products.filter((p) => {
    if (activeCategory === 'Todos') return !p.featured;
    const categoryMap: Record<string, string> = {
      'Papel': 'paper',
      'Escritura': 'writing',
      'Arte': 'art',
    };
    return p.category === categoryMap[activeCategory] && !p.featured;
  });

  const orderNumber = '#22094-AT';
  const subtotal = cart.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  );

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateQuantity = (productId: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item.product.id === productId
            ? { ...item, quantity: Math.max(0, item.quantity + delta) }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  return (
    <div className="sales">
      {/* Products Section */}
      <div className="sales-products">
        <div className="sales-products-header">
          <div>
            <h1 className="sales-title">Productos rápidos</h1>
            <p className="sales-subtitle">
              Artículos más vendidos de tu papelería
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

        <div className="sales-products-grid">
          {/* Featured Product */}
          {featured && activeCategory === 'Todos' && (
            <div
              className="sales-featured-card"
              onClick={() => addToCart(featured)}
            >
              <div className="sales-featured-image">
                <span className="sales-featured-emoji">{featured.image}</span>
              </div>
              <div className="sales-featured-overlay">
                <span className="sales-featured-badge">DESTACADO</span>
                <h3 className="sales-featured-name">{featured.name}</h3>
                <p className="sales-featured-sub">{featured.subtitle}</p>
                <span className="sales-featured-price">
                  ${featured.price.toFixed(2)}
                </span>
              </div>
            </div>
          )}

          {/* Product Grid */}
          <div className="sales-grid">
            {filteredProducts.slice(0, 4).map((product) => (
              <div
                className="sales-product-card"
                key={product.id}
                onClick={() => addToCart(product)}
              >
                <div className="sales-product-image">
                  <span className="sales-product-emoji">{product.image}</span>
                </div>
                <div className="sales-product-info">
                  <span className="sales-product-name">{product.name}</span>
                  <span className="sales-product-price">
                    ${product.price.toFixed(2)}
                  </span>
                </div>
                <span className="sales-product-stock">
                  EN STOCK: {product.stock}
                </span>
              </div>
            ))}
          </div>
        </div>

        <button className="sales-browse-btn">
          Ver Catálogo Completo
          <ArrowRight size={16} />
        </button>
      </div>

      {/* Cart Section */}
      <div className="sales-cart">
        <div className="sales-cart-header">
          <div>
            <h2 className="sales-cart-title">Carrito</h2>
            <span className="sales-cart-order">Orden {orderNumber}</span>
          </div>
          <span className="sales-cart-badge">{cart.length} ARTÍCULOS</span>
        </div>

        <div className="sales-cart-items">
          {cart.map((item) => (
            <div className="sales-cart-item" key={item.product.id}>
              <div className="sales-cart-item-image">
                <span>{item.product.image}</span>
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
              <span className="sales-cart-item-price">
                ${(item.product.price * item.quantity).toFixed(2)}
              </span>
            </div>
          ))}
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
          >
            Cobrar
            <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
