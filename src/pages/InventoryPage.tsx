import { Check, Edit2, Loader2, Search, X } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { API_BASE_URL } from '../config';
import { useBarcodeScanner } from '../hooks/useBarcodeScanner';
import {
  addProductBarcode,
  createProduct,
  getProductCategories,
  getProducts,
  removeProductBarcode,
  updateProduct,
  type Category,
  type Product,
} from '../services/productService';
import { getGlobalSettings } from '../services/settingsService';
import '../styles/InventoryPage.css';

const EMPTY_FORM = {
  name: '',
  brand: '',
  description: '',
  webPrice: '',
  posPrice: '',
  stock: '',
  categoryId: '',
  barcode: '',
};

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [lowStockThreshold, setLowStockThreshold] = useState(5);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editPosPrice, setEditPosPrice] = useState<string>('');
  const [editStock, setEditStock] = useState<string>('');
  const [newBarcode, setNewBarcode] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const [showNewModal, setShowNewModal] = useState(false);
  const [newForm, setNewForm] = useState(EMPTY_FORM);
  const [creating, setCreating] = useState(false);

  useBarcodeScanner({
    onScan: (code) => {
      setSearchTerm(code);

      const matchingProduct = products.find(
        (p) =>
          p.id.toString() === code ||
          p.name.toLowerCase() === code.toLowerCase() ||
          (p.barcodes && p.barcodes.includes(code))
      );

      if (matchingProduct) {
        handleEditClick(matchingProduct);
      }
    },
  });

  useEffect(() => {
    loadProducts();
    loadSettings();
    getProductCategories().then(setCategories);
  }, []);

  async function loadSettings() {
    const res = await getGlobalSettings();
    if (res.ok && res.settings) {
      setLowStockThreshold(res.settings.lowStockThreshold);
    }
  }

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
    setEditPosPrice((product.posPrice ?? product.price).toString());
    setEditStock(product.stock.toString());
    setNewBarcode('');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };

  const handleSaveEdit = async (productId: number) => {
    const newPosPrice = parseFloat(editPosPrice);
    const newStock = parseInt(editStock, 10);

    if (isNaN(newPosPrice) || newPosPrice < 0 || isNaN(newStock) || newStock < 0) {
      alert('Valores inválidos. Revisa el precio físico (POS) y el stock.');
      return;
    }

    try {
      setSaving(true);
      const result = await updateProduct(productId, newPosPrice, newStock);

      if (result.ok) {
        setProducts(
          products.map((p) =>
            p.id === productId
              ? { ...p, posPrice: newPosPrice, price: newPosPrice, stock: newStock }
              : p
          )
        );
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
      setProducts(
        products.map((p) =>
          p.id === productId
            ? { ...p, barcodes: [...(p.barcodes || []), newBarcode.trim()] }
            : p
        )
      );
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
      setProducts(
        products.map((p) =>
          p.id === productId
            ? { ...p, barcodes: (p.barcodes || []).filter((b) => b !== barcode) }
            : p
        )
      );
    } else {
      alert(result.message || 'Error al eliminar código de barras');
    }
    setSaving(false);
  };

  const handleCreateProduct = async (e: FormEvent) => {
    e.preventDefault();

    const webPrice = parseFloat(newForm.webPrice);
    const posPrice = newForm.posPrice.trim() ? parseFloat(newForm.posPrice) : null;
    const stock = parseInt(newForm.stock, 10);

    if (!newForm.name.trim()) {
      alert('El nombre es obligatorio');
      return;
    }
    if (isNaN(webPrice) || webPrice < 0) {
      alert('Ingresa un precio web válido');
      return;
    }
    if (posPrice !== null && (isNaN(posPrice) || posPrice < 0)) {
      alert('Ingresa un precio físico (POS) válido');
      return;
    }
    if (isNaN(stock) || stock < 0) {
      alert('Ingresa un stock válido');
      return;
    }

    setCreating(true);
    const result = await createProduct({
      name: newForm.name.trim(),
      brand: newForm.brand.trim(),
      description: newForm.description.trim(),
      price: webPrice,
      pos_price: posPrice ?? webPrice,
      stock,
      category_id: newForm.categoryId ? parseInt(newForm.categoryId, 10) : undefined,
      barcode: newForm.barcode.trim() || undefined,
    });
    setCreating(false);

    if (result.ok) {
      setShowNewModal(false);
      setNewForm(EMPTY_FORM);
      await loadProducts();
      alert('Producto creado exitosamente');
    } else {
      alert(result.message || 'Error al crear el producto');
    }
  };

  const filteredProducts = products.filter((p) => {
    if (searchTerm === '') return true;

    const term = searchTerm.toLowerCase();
    return (
      p.name.toLowerCase().includes(term) ||
      p.brand.toLowerCase().includes(term) ||
      p.id.toString() === term ||
      (p.barcodes && p.barcodes.some((b) => b.toLowerCase() === term))
    );
  });

  const getImageUrl = (imagePath: string) => {
    if (imagePath.startsWith('http')) return imagePath;
    return `https://godart-papelería.com${imagePath}`;
  };

  const getStockBadgeClass = (stock: number) => {
    if (stock <= 0) return 'inv-stock--out';
    if (stock <= lowStockThreshold) return 'inv-stock--low';
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
            onClick={() => setShowNewModal(true)}
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
              const effectivePosPrice = product.posPrice ?? product.price;

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
                          <div className="inv-price-info">
                            <span className="inv-price-web">
                              Precio web: <strong>${product.webPrice.toFixed(2)}</strong>
                            </span>
                          </div>
                          <div className="inv-edit-group">
                            <label>Precio físico (POS) ($)</label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              className="inv-edit-input"
                              value={editPosPrice}
                              onChange={(e) => setEditPosPrice(e.target.value)}
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
                              {(product.barcodes || []).map((b) => (
                                <span
                                  key={b}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    background: 'var(--color-bg-secondary)',
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    fontSize: '12px',
                                  }}
                                >
                                  {b}
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveBarcode(product.id, b)}
                                    style={{
                                      border: 'none',
                                      background: 'none',
                                      cursor: 'pointer',
                                      padding: '0',
                                      display: 'flex',
                                      color: 'var(--color-danger)',
                                    }}
                                  >
                                    <X size={14} />
                                  </button>
                                </span>
                              ))}
                              {(!product.barcodes || product.barcodes.length === 0) && (
                                <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                                  Sin códigos
                                </span>
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
                              {saving ? (
                                <Loader2 size={18} className="inventory-spinner" />
                              ) : (
                                <Check size={18} />
                              )}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="inv-card-footer">
                          <div className="inv-card-prices">
                            <span className="inv-card-price-label">POS físico</span>
                            <span className="inv-card-price">${effectivePosPrice.toFixed(2)}</span>
                            <span className="inv-card-price-web">Web: ${product.webPrice.toFixed(2)}</span>
                          </div>
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
              <div
                style={{
                  gridColumn: '1 / -1',
                  textAlign: 'center',
                  padding: '32px',
                  color: 'var(--color-text-secondary)',
                }}
              >
                No se encontraron productos
              </div>
            )}
          </div>
        )}
      </div>

      {showNewModal && (
        <div className="inv-modal-overlay" onClick={() => !creating && setShowNewModal(false)}>
          <div className="inv-modal" onClick={(e) => e.stopPropagation()}>
            <div className="inv-modal-header">
              <h2>Agregar nuevo producto</h2>
              <button
                className="inv-modal-close"
                onClick={() => !creating && setShowNewModal(false)}
                disabled={creating}
              >
                <X size={20} />
              </button>
            </div>

            <form className="inv-modal-form" onSubmit={handleCreateProduct}>
              <div className="inv-form-group inv-form-group--full">
                <label>Nombre *</label>
                <input
                  type="text"
                  required
                  value={newForm.name}
                  onChange={(e) => setNewForm({ ...newForm, name: e.target.value })}
                  placeholder="Ej. Cuaderno profesional A4"
                />
              </div>

              <div className="inv-form-group">
                <label>Marca</label>
                <input
                  type="text"
                  value={newForm.brand}
                  onChange={(e) => setNewForm({ ...newForm, brand: e.target.value })}
                  placeholder="Ej. Scribe"
                />
              </div>

              <div className="inv-form-group">
                <label>Categoría</label>
                <select
                  value={newForm.categoryId}
                  onChange={(e) => setNewForm({ ...newForm, categoryId: e.target.value })}
                >
                  <option value="">General (automática)</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="inv-form-group">
                <label>Precio web ($) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={newForm.webPrice}
                  onChange={(e) => setNewForm({ ...newForm, webPrice: e.target.value })}
                  placeholder="0.00"
                />
              </div>

              <div className="inv-form-group">
                <label>Precio físico (POS) ($)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={newForm.posPrice}
                  onChange={(e) => setNewForm({ ...newForm, posPrice: e.target.value })}
                  placeholder="Tienda física; vacío = igual al web"
                />
              </div>

              <div className="inv-form-group">
                <label>Stock inicial *</label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  required
                  value={newForm.stock}
                  onChange={(e) => setNewForm({ ...newForm, stock: e.target.value })}
                  placeholder="0"
                />
              </div>

              <div className="inv-form-group">
                <label>Código de barras</label>
                <input
                  type="text"
                  value={newForm.barcode}
                  onChange={(e) => setNewForm({ ...newForm, barcode: e.target.value })}
                  placeholder="Opcional"
                />
              </div>

              <div className="inv-form-group inv-form-group--full">
                <label>Descripción</label>
                <textarea
                  rows={2}
                  value={newForm.description}
                  onChange={(e) => setNewForm({ ...newForm, description: e.target.value })}
                  placeholder="Opcional"
                />
              </div>

              <div className="inv-modal-footer">
                <button
                  type="button"
                  className="inv-modal-btn inv-modal-btn--cancel"
                  onClick={() => setShowNewModal(false)}
                  disabled={creating}
                >
                  Cancelar
                </button>
                <button type="submit" className="inv-modal-btn inv-modal-btn--save" disabled={creating}>
                  {creating ? (
                    <>
                      <Loader2 size={18} className="inventory-spinner" /> Creando...
                    </>
                  ) : (
                    'Crear producto'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
