import { useState, useEffect } from 'react';
import { Search, Loader2, Edit2, X, Check } from 'lucide-react';
import { getProducts, updateProduct, type Product } from '../services/productService';
import { API_BASE_URL } from '../config';
import '../styles/InventoryPage.css';

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Estado para la edición en línea
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editPrice, setEditPrice] = useState<string>('');
  const [editStock, setEditStock] = useState<string>('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    try {
      setLoading(true);
      const prods = await getProducts();
      setProducts(prods);
      setError('');
    } catch (err) {
      console.error(err);
      setError('Error al cargar el inventario');
    } finally {
      setLoading(false);
    }
  }

  const handleEditClick = (product: Product) => {
    setEditingId(product.id);
    setEditPrice(product.price.toString());
    setEditStock(product.stock.toString());
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };

  const handleSaveEdit = async (productId: number) => {
    const newPrice = parseFloat(editPrice);
    const newStock = parseInt(editStock, 10);

    if (isNaN(newPrice) || newPrice < 0 || isNaN(newStock) || newStock < 0) {
      alert('Valores inválidos. Revisa el precio y el stock.');
      return;
    }

    try {
      setSaving(true);
      const result = await updateProduct(productId, newPrice, newStock);
      
      if (result.ok) {
        // Actualizar el estado local sin recargar todo
        setProducts(products.map(p => 
          p.id === productId ? { ...p, price: newPrice, stock: newStock } : p
        ));
        setEditingId(null);
      } else {
        alert(result.message || 'Error al guardar');
      }
    } catch (err) {
      console.error(err);
      alert('Error de conexión al guardar');
    } finally {
      setSaving(false);
    }
  };

  const filteredProducts = products.filter((p) =>
    searchTerm === '' ||
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.brand.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getImageUrl = (imagePath: string) => {
    if (imagePath.startsWith('http')) return imagePath;
    return `https://godart-papelería.com${imagePath}`;
  };

  const getStockBadgeClass = (stock: number) => {
    if (stock <= 0) return 'inv-stock--out';
    if (stock < 5) return 'inv-stock--low';
    return 'inv-stock--good';
  };

  return (
    <div className="inventory-page">
      <div className="inventory-header">
        <div className="inventory-header-left">
          <h1 className="inventory-title">Inventario</h1>
          <span className="inventory-count-badge">{products.length} productos</span>
        </div>
        
        <div className="inventory-header-right">
          <div className="inventory-search">
            <Search size={18} className="inventory-search-icon" />
            <input
              type="text"
              placeholder="Buscar producto o marca..."
              className="inventory-search-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button 
            className="topbar-new-sale-btn" 
            style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
            onClick={() => alert('Función para agregar nuevo producto próximamente')}
          >
            <span>+</span> Nuevo
          </button>
        </div>
      </div>

      <div className="inventory-table-container">
        {loading ? (
          <div className="inventory-loading">
            <Loader2 size={32} className="inventory-spinner" />
            <p>Cargando catálogo...</p>
          </div>
        ) : error ? (
          <div className="inventory-error">
            <p>{error}</p>
            <button onClick={loadProducts}>Reintentar</button>
          </div>
        ) : (
          <div className="inventory-grid">
            {filteredProducts.map((product) => {
              const isEditing = editingId === product.id;

              return (
                <div className="inventory-card" key={product.id}>
                  <div className="inv-card-image-wrapper">
                    <img
                      src={getImageUrl(product.image)}
                      alt={product.name}
                      className="inv-card-image"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = `${API_BASE_URL}/../images/boligrafos.jpg`;
                      }}
                    />
                    {!isEditing && (
                      <span className={`inv-stock-badge-corner ${getStockBadgeClass(product.stock)}`}>
                        {product.stock} u.
                      </span>
                    )}
                  </div>
                  
                  <div className="inv-card-content">
                    <div className="inv-card-header">
                      <span className="inv-card-brand">{product.brand}</span>
                      <span className="inv-card-sku">Ref: {product.id}</span>
                    </div>
                    <h3 className="inv-card-name">{product.name}</h3>
                    
                    <div className="inv-card-actions">
                      {isEditing ? (
                        <div className="inv-edit-form">
                          <div className="inv-edit-group">
                            <label>Precio ($)</label>
                            <input 
                              type="number" 
                              step="0.01" 
                              min="0"
                              className="inv-edit-input"
                              value={editPrice}
                              onChange={(e) => setEditPrice(e.target.value)}
                            />
                          </div>
                          <div className="inv-edit-group">
                            <label>Stock (u.)</label>
                            <input 
                              type="number" 
                              step="1" 
                              min="0"
                              className="inv-edit-input"
                              value={editStock}
                              onChange={(e) => setEditStock(e.target.value)}
                            />
                          </div>
                          <div className="inv-edit-buttons">
                            <button 
                              className="inv-action-btn inv-action-btn--cancel" 
                              title="Cancelar"
                              onClick={handleCancelEdit}
                              disabled={saving}
                            >
                              <X size={18} />
                            </button>
                            <button 
                              className="inv-action-btn inv-action-btn--save" 
                              title="Guardar"
                              onClick={() => handleSaveEdit(product.id)}
                              disabled={saving}
                            >
                              {saving ? <Loader2 size={18} className="inventory-spinner" /> : <Check size={18} />}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="inv-card-footer">
                          <span className="inv-card-price">${product.price.toFixed(2)}</span>
                          <button 
                            className="inv-action-btn" 
                            title="Editar Inventario"
                            onClick={() => handleEditClick(product)}
                          >
                            <Edit2 size={18} /> Editar
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {filteredProducts.length === 0 && (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '32px', color: 'var(--color-text-secondary)' }}>
                No se encontraron productos
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
