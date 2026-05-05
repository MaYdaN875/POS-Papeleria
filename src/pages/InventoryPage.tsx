import { Check, Edit2, Loader2, Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { API_BASE_URL } from '../config';
import { useBarcodeScanner } from '../hooks/useBarcodeScanner';
import { addProductBarcode, getProducts, removeProductBarcode, updateProduct, type Product } from '../services/productService';
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
  const [newBarcode, setNewBarcode] = useState<string>('');
  const [saving, setSaving] = useState(false);

  // Detectar escáner para buscar o editar rápidamente
  useBarcodeScanner({
    onScan: (code) => {
      setSearchTerm(code);
      
      // Buscar si el código coincide exactamente con un producto
      const matchingProduct = products.find(p => 
        p.id.toString() === code || 
        (p as any).barcode === code || 
        (p as any).sku === code ||
        p.name.toLowerCase() === code.toLowerCase() ||
        (p.barcodes && p.barcodes.includes(code))
      );

      if (matchingProduct) {
        handleEditClick(matchingProduct);
      }
    }
  });

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
    setNewBarcode('');
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

  const handleAddBarcode = async (productId: number) => {
    if (!newBarcode.trim()) return;
    setSaving(true);
    const result = await addProductBarcode(productId, newBarcode.trim());
    if (result.ok) {
      setProducts(products.map(p => 
        p.id === productId 
          ? { ...p, barcodes: [...(p.barcodes || []), newBarcode.trim()] } 
          : p
      ));
      setNewBarcode('');
    } else {
      alert(result.message || 'Error al agregar código de barras');
    }
    setSaving(false);
  };

  const handleRemoveBarcode = async (productId: number, barcode: string) => {
    if (!window.confirm('¿Eliminar este código de barras?')) return;
    setSaving(true);
    const result = await removeProductBarcode(barcode);
    if (result.ok) {
      setProducts(products.map(p => 
        p.id === productId 
          ? { ...p, barcodes: (p.barcodes || []).filter(b => b !== barcode) } 
          : p
      ));
    } else {
      alert(result.message || 'Error al eliminar código de barras');
    }
    setSaving(false);
  };

  const filteredProducts = products.filter((p) => {
    if (searchTerm === '') return true;
    
    const term = searchTerm.toLowerCase();
    return (
      p.name.toLowerCase().includes(term) ||
      p.brand.toLowerCase().includes(term) ||
      p.id.toString() === term ||
      (p as any).barcode === term ||
      ((p as any).sku && (p as any).sku.toLowerCase() === term) ||
      (p.barcodes && p.barcodes.some(b => b.toLowerCase() === term))
    );
  });

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
                          
                          <div className="inv-edit-group" style={{ gridColumn: '1 / -1' }}>
                            <label>Códigos de barras</label>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                              {(product.barcodes || []).map(b => (
                                <span key={b} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'var(--color-bg-secondary)', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' }}>
                                  {b}
                                  <button type="button" onClick={() => handleRemoveBarcode(product.id, b)} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '0', display: 'flex', color: 'var(--color-danger)' }}>
                                    <X size={14} />
                                  </button>
                                </span>
                              ))}
                              {(!product.barcodes || product.barcodes.length === 0) && (
                                <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Sin códigos</span>
                              )}
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <input 
                                type="text"
                                placeholder="Nuevo código..."
                                className="inv-edit-input"
                                value={newBarcode}
                                onChange={(e) => setNewBarcode(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAddBarcode(product.id)}
                              />
                              <button 
                                type="button"
                                className="inv-action-btn"
                                onClick={() => handleAddBarcode(product.id)}
                                disabled={saving || !newBarcode.trim()}
                              >
                                Añadir
                              </button>
                            </div>
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
