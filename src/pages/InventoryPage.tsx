import { Check, Edit2, Loader2, Search, Trash2, X, Layers } from 'lucide-react';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config';
import { logout } from '../services/authService';
import { useBarcodeScanner } from '../hooks/useBarcodeScanner';
import {
  addProductBarcode,
  createProduct,
  deleteProduct,
  getProductCategories,
  getProducts,
  removeProductBarcode,
  updateProduct,
  saveProductPresentation,
  deleteProductPresentation,
  type Category,
  type Product,
  type Presentation,
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
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [lowStockThreshold, setLowStockThreshold] = useState(5);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editPosPrice, setEditPosPrice] = useState<string>('');
  const [editStock, setEditStock] = useState<string>('');
  const [editBaseUnit, setEditBaseUnit] = useState<string>('');
  const [newBarcode, setNewBarcode] = useState<string>('');
  const [editBarcodes, setEditBarcodes] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const editPriceInputRef = useRef<HTMLInputElement>(null);

  // Estados del modal de Presentaciones
  const [selectedProductForPresentations, setSelectedProductForPresentations] = useState<Product | null>(null);
  const [showPresentationsModal, setShowPresentationsModal] = useState(false);
  const [presentationsList, setPresentationsList] = useState<Presentation[]>([]);
  const [loadingPresentations, setLoadingPresentations] = useState(false);

  // Formulario de nueva/editar presentación
  const [presForm, setPresForm] = useState({
    id: 0,
    name: '',
    barcode: '',
    unitsPerSale: '1',
    salePrice: '',
    isDefault: false,
    isActive: true
  });

  // Al entrar en modo edición, enfocar el campo de precio.
  // Esto evita el bug de Electron donde el teclado no responde hasta cambiar de ventana.
  useEffect(() => {
    if (editingId === null) return;
    const focusInput = () => {
      const input = editPriceInputRef.current;
      if (!input) return;
      input.focus();
      input.select();
    };
    const t1 = setTimeout(focusInput, 60);
    const t2 = setTimeout(focusInput, 250);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [editingId]);

  const [showNewModal, setShowNewModal] = useState(false);
  const [newForm, setNewForm] = useState(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [showInactive, setShowInactive] = useState(false);

  useBarcodeScanner({
    enabled: !showNewModal && editingId === null,
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

  async function handleSessionExpired(message?: string) {
    alert(message || 'Tu sesión expiró. Vuelve a iniciar sesión.');
    await logout();
    navigate('/');
  }

  const handleEditClick = (product: Product) => {
    setEditingId(product.id);
    setEditPosPrice((product.posPrice ?? product.price).toString());
    setEditStock(product.stock.toString());
    setEditBaseUnit(product.baseUnit ?? 'pieza');
    setEditBarcodes([...(product.barcodes || [])]);
    setNewBarcode('');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditBarcodes([]);
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

      const result = await updateProduct(productId, newPosPrice, newStock, editBaseUnit);
      if (!result.ok) {
        if (result.sessionExpired) {
          await handleSessionExpired(result.message);
          return;
        }
        alert(result.message || 'Error al guardar cambios de precio y stock');
        setSaving(false);
        return;
      }

      const originalProduct = products.find((p) => p.id === productId);
      const originalBarcodes = originalProduct?.barcodes || [];

      const toAdd = editBarcodes.filter((b) => !originalBarcodes.includes(b));
      const toRemove = originalBarcodes.filter((b) => !editBarcodes.includes(b));

      const barcodeErrors: string[] = [];

      for (const barcode of toAdd) {
        const addResult = await addProductBarcode(productId, barcode);
        if (!addResult.ok) {
          barcodeErrors.push(`No se pudo agregar "${barcode}": ${addResult.message || 'Error'}`);
        }
      }

      for (const barcode of toRemove) {
        const removeResult = await removeProductBarcode(barcode);
        if (!removeResult.ok) {
          barcodeErrors.push(`No se pudo eliminar "${barcode}": ${removeResult.message || 'Error'}`);
        }
      }

      if (barcodeErrors.length > 0) {
        alert(
          'Se actualizó el producto, pero ocurrieron algunos problemas con los códigos de barras:\n' +
            barcodeErrors.join('\n')
        );
      }

      await loadProducts();
      setEditingId(null);
      setEditBarcodes([]);
    } catch (err) {
      console.error(err);
      alert('Error de conexión al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenPresentationsModal = (product: Product) => {
    setSelectedProductForPresentations(product);
    setPresentationsList(product.presentations || []);
    setPresForm({
      id: 0,
      name: '',
      barcode: '',
      unitsPerSale: '1',
      salePrice: (product.posPrice ?? product.price).toString(),
      isDefault: false,
      isActive: true
    });
    setShowPresentationsModal(true);
  };

  const handleSavePresentation = async () => {
    if (!selectedProductForPresentations) return;
    const { id, name, barcode, unitsPerSale, salePrice, isDefault, isActive } = presForm;
    const factor = parseFloat(unitsPerSale);
    const priceVal = parseFloat(salePrice);

    if (!name.trim() || isNaN(factor) || factor <= 0 || isNaN(priceVal) || priceVal < 0) {
      alert('Por favor completa todos los campos de forma válida.');
      return;
    }

    try {
      setLoadingPresentations(true);
      const res = await saveProductPresentation({
        id: id > 0 ? id : undefined,
        productId: selectedProductForPresentations.id,
        name: name.trim(),
        barcode: barcode.trim() !== '' ? barcode.trim() : null,
        unitsPerSale: factor,
        salePrice: priceVal,
        isDefault,
        isActive
      });

      if (res.ok) {
        // Recargar productos
        await loadProducts();
        
        // Recargar el producto actual en modal
        const prods = await getProducts();
        const updatedProd = prods.find(p => p.id === selectedProductForPresentations.id);
        if (updatedProd) {
          setSelectedProductForPresentations(updatedProd);
          setPresentationsList(updatedProd.presentations || []);
        }

        // Resetear formulario
        setPresForm({
          id: 0,
          name: '',
          barcode: '',
          unitsPerSale: '1',
          salePrice: (selectedProductForPresentations.posPrice ?? selectedProductForPresentations.price).toString(),
          isDefault: false,
          isActive: true
        });
      } else {
        alert(res.message || 'Error al guardar la presentación');
      }
    } catch (err) {
      console.error(err);
      alert('Error de conexión');
    } finally {
      setLoadingPresentations(false);
    }
  };

  const handleDeletePresentation = async (presId: number) => {
    if (!selectedProductForPresentations) return;
    if (presId <= 0) return;
    const confirmed = window.confirm('¿Seguro que deseas eliminar esta presentación?');
    if (!confirmed) return;

    try {
      setLoadingPresentations(true);
      const res = await deleteProductPresentation(presId, selectedProductForPresentations.id);
      if (res.ok) {
        await loadProducts();
        const prods = await getProducts();
        const updatedProd = prods.find(p => p.id === selectedProductForPresentations.id);
        if (updatedProd) {
          setSelectedProductForPresentations(updatedProd);
          setPresentationsList(updatedProd.presentations || []);
        }
      } else {
        alert(res.message || 'Error al eliminar la presentación');
      }
    } catch (err) {
      console.error(err);
      alert('Error de conexión');
    } finally {
      setLoadingPresentations(false);
    }
  };

  const handleDeleteProduct = async (product: Product) => {
    const confirmed = window.confirm(
      `¿Eliminar "${product.name}" del inventario?\n\nEsta acción no se puede deshacer.`
    );
    if (!confirmed) return;

    try {
      setDeleting(true);
      const result = await deleteProduct(product.id);

      if (!result.ok) {
        if (result.sessionExpired) {
          await handleSessionExpired(result.message);
          return;
        }
        alert(result.message || 'Error al eliminar el producto');
        return;
      }

      setEditingId(null);
      setEditBarcodes([]);
      await loadProducts();
      alert(result.message || 'Producto eliminado');
    } finally {
      setDeleting(false);
    }
  };

  const handleAddBarcodeTemp = () => {
    const trimmed = newBarcode.trim();
    if (!trimmed) return;
    if (editBarcodes.includes(trimmed)) {
      alert('Este código de barras ya está en la lista');
      return;
    }
    setEditBarcodes([...editBarcodes, trimmed]);
    setNewBarcode('');
  };

  const handleRemoveBarcodeTemp = (barcode: string) => {
    setEditBarcodes(editBarcodes.filter((b) => b !== barcode));
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
    } else if (result.sessionExpired) {
      await handleSessionExpired(result.message);
    } else {
      alert(result.message || 'Error al crear el producto');
    }
  };

  const filteredProducts = products.filter((p) => {
    if (p.isActive === false && !showInactive) {
      return false;
    }
    if (searchTerm === '') return true;

    const term = searchTerm.toLowerCase();
    return (
      p.name.toLowerCase().includes(term) ||
      p.brand.toLowerCase().includes(term) ||
      p.id.toString() === term ||
      (p.barcodes && p.barcodes.some((b) => b.toLowerCase().includes(term)))
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
          <span className="inventory-count-badge">{filteredProducts.length} productos</span>
        </div>

        <div className="inventory-header-right">
          <label className="inventory-toggle-inactive">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
            />
            <span>Mostrar inactivos</span>
          </label>
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
                <div className={`inventory-card ${product.isActive === false ? 'inv-card--inactive' : ''}`} key={product.id}>
                  <div className="inv-card-image-wrapper">
                    <img
                      src={getImageUrl(product.image)}
                      alt={product.name}
                      className="inv-card-image"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = `${API_BASE_URL}/../images/boligrafos.jpg`;
                      }}
                    />
                    {product.isActive === false && (
                      <span className="inv-inactive-badge">
                        Inactivo
                      </span>
                    )}
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

                    <div className="inv-card-barcodes">
                      {(product.barcodes || []).map((b) => (
                        <span key={b} className="inv-barcode-badge">
                          {b}
                        </span>
                      ))}
                    </div>

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
                              ref={editPriceInputRef}
                              type="text"
                              inputMode="decimal"
                              className="inv-edit-input"
                              value={editPosPrice}
                              onChange={(e) => {
                                const val = e.target.value.replace(',', '.');
                                if (/^\d*\.?\d*$/.test(val)) setEditPosPrice(val);
                              }}
                            />
                          </div>
                          <div className="inv-edit-group">
                            <label>Stock ({product.baseUnit || 'pieza'})</label>
                            <input
                              type="text"
                              inputMode="numeric"
                              className="inv-edit-input"
                              value={editStock}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (/^\d*$/.test(val)) setEditStock(val);
                              }}
                            />
                          </div>
                          <div className="inv-edit-group">
                            <label>Unidad Base</label>
                            <input
                              type="text"
                              className="inv-edit-input"
                              value={editBaseUnit}
                              onChange={(e) => setEditBaseUnit(e.target.value)}
                              placeholder="Ej. pieza"
                            />
                          </div>

                          <div className="inv-edit-group inv-edit-group--barcodes">
                            <label>Códigos de barras</label>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                              {editBarcodes.map((b) => (
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
                                    onClick={() => handleRemoveBarcodeTemp(b)}
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
                              {editBarcodes.length === 0 && (
                                <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                                  Sin códigos
                                </span>
                              )}
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <input
                                type="text"
                                placeholder="Nuevo código..."
                                className="inv-barcode-add-input"
                                value={newBarcode}
                                onChange={(e) => setNewBarcode(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAddBarcodeTemp()}
                              />
                              <button
                                type="button"
                                className="inv-action-btn"
                                onClick={handleAddBarcodeTemp}
                                disabled={saving || !newBarcode.trim()}
                              >
                                Añadir
                              </button>
                            </div>
                          </div>

                          <div className="inv-edit-buttons">
                            <button
                              className="inv-action-btn inv-action-btn--delete"
                              title="Eliminar producto"
                              onClick={() => handleDeleteProduct(product)}
                              disabled={saving || deleting}
                              style={{
                                marginRight: 'auto',
                                background: '#fee2e2',
                                color: '#dc2626',
                                borderColor: '#fecaca',
                              }}
                            >
                              {deleting ? (
                                <Loader2 size={18} className="inventory-spinner" />
                              ) : (
                                <Trash2 size={18} />
                              )}
                            </button>
                            <button
                              className="inv-action-btn inv-action-btn--cancel"
                              title="Cancelar"
                              onClick={handleCancelEdit}
                              disabled={saving || deleting}
                            >
                              <X size={18} />
                            </button>
                            <button
                              className="inv-action-btn inv-action-btn--save"
                              title="Guardar"
                              onClick={() => handleSaveEdit(product.id)}
                              disabled={saving || deleting}
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
                          <div style={{ display: 'flex', gap: '4px', marginLeft: 'auto' }}>
                            <button
                              className="inv-action-btn"
                              title="Editar Inventario"
                              onClick={() => handleEditClick(product)}
                            >
                              <Edit2 size={16} /> Editar
                            </button>
                            <button
                              className="inv-action-btn"
                              title="Ver Presentaciones comerciales"
                              onClick={() => handleOpenPresentationsModal(product)}
                            >
                              <Layers size={16} /> Pres.
                            </button>
                          </div>
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
                  type="text"
                  inputMode="decimal"
                  required
                  value={newForm.webPrice}
                  onChange={(e) => {
                    const val = e.target.value.replace(',', '.');
                    if (/^\d*\.?\d*$/.test(val)) setNewForm({ ...newForm, webPrice: val });
                  }}
                  placeholder="0.00"
                />
              </div>

              <div className="inv-form-group">
                <label>Precio físico (POS) ($)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={newForm.posPrice}
                  onChange={(e) => {
                    const val = e.target.value.replace(',', '.');
                    if (/^\d*\.?\d*$/.test(val)) setNewForm({ ...newForm, posPrice: val });
                  }}
                  placeholder="Tienda física; vacío = igual al web"
                />
              </div>

              <div className="inv-form-group">
                <label>Stock inicial *</label>
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  value={newForm.stock}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (/^\d*$/.test(val)) setNewForm({ ...newForm, stock: val });
                  }}
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

      {showPresentationsModal && selectedProductForPresentations && (
        <div className="inv-modal-overlay" onClick={() => !loadingPresentations && setShowPresentationsModal(false)}>
          <div className="inv-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '750px', width: '90%' }}>
            <div className="inv-modal-header">
              <h2>Presentaciones de venta: {selectedProductForPresentations.name}</h2>
              <button
                className="inv-modal-close"
                onClick={() => !loadingPresentations && setShowPresentationsModal(false)}
                disabled={loadingPresentations}
              >
                <X size={20} />
              </button>
            </div>

            <div className="inv-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '20px', maxHeight: '70vh', overflowY: 'auto' }}>
              <div style={{ background: 'var(--color-bg-main)', padding: '12px', borderRadius: '6px', border: '1px solid var(--color-border)', fontSize: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong>Stock físico base:</strong> {selectedProductForPresentations.stock} {selectedProductForPresentations.baseUnit || 'pieza'}(s)
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600 }}>Unidad Base:</label>
                  <input
                    type="text"
                    value={selectedProductForPresentations.baseUnit || 'pieza'}
                    onChange={async (e) => {
                      const val = e.target.value.trim();
                      if (val) {
                        try {
                          await updateProduct(
                            selectedProductForPresentations.id,
                            selectedProductForPresentations.posPrice ?? selectedProductForPresentations.price,
                            selectedProductForPresentations.stock,
                            val
                          );
                          await loadProducts();
                          const prods = await getProducts();
                          const updated = prods.find(p => p.id === selectedProductForPresentations.id);
                          if (updated) setSelectedProductForPresentations(updated);
                        } catch (err) {
                          console.error(err);
                        }
                      }
                    }}
                    style={{
                      width: '100px',
                      padding: '4px 8px',
                      fontSize: '13px',
                      border: '1px solid var(--color-border)',
                      borderRadius: '4px',
                      background: 'var(--color-bg-card)',
                      color: 'var(--color-text-main)'
                    }}
                  />
                </div>
              </div>

              {/* Formulario para agregar / editar presentación */}
              <div style={{ background: 'var(--color-bg-card)', padding: '16px', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                <h3 style={{ margin: '0 0 12px 0', fontSize: '15px' }}>
                  {presForm.id > 0 ? 'Editar Presentación' : 'Agregar Presentación'}
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px' }}>
                  <div className="inv-form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '12px' }}>Nombre *</label>
                    <input
                      type="text"
                      placeholder="Ej. Caja c/12"
                      value={presForm.name}
                      onChange={(e) => setPresForm({ ...presForm, name: e.target.value })}
                      style={{ padding: '6px', fontSize: '13px' }}
                    />
                  </div>
                  <div className="inv-form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '12px' }}>Código barras</label>
                    <input
                      type="text"
                      placeholder="Opcional"
                      value={presForm.barcode}
                      onChange={(e) => setPresForm({ ...presForm, barcode: e.target.value })}
                      style={{ padding: '6px', fontSize: '13px' }}
                    />
                  </div>
                  <div className="inv-form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '12px' }}>Contenido (factor)</label>
                    <input
                      type="number"
                      min="0.001"
                      step="any"
                      placeholder="1"
                      value={presForm.unitsPerSale}
                      onChange={(e) => setPresForm({ ...presForm, unitsPerSale: e.target.value })}
                      style={{ padding: '6px', fontSize: '13px' }}
                    />
                  </div>
                  <div className="inv-form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '12px' }}>Precio ($) *</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={presForm.salePrice}
                      onChange={(e) => {
                        const val = e.target.value.replace(',', '.');
                        if (/^\d*\.?\d*$/.test(val)) setPresForm({ ...presForm, salePrice: val });
                      }}
                      style={{ padding: '6px', fontSize: '13px' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '16px', marginTop: '12px', alignItems: 'center' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={presForm.isDefault}
                      onChange={(e) => setPresForm({ ...presForm, isDefault: e.target.checked })}
                    />
                    Presentación por defecto
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={presForm.isActive}
                      onChange={(e) => setPresForm({ ...presForm, isActive: e.target.checked })}
                    />
                    Activo
                  </label>

                  <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
                    {presForm.id > 0 && (
                      <button
                        type="button"
                        className="inv-modal-btn inv-modal-btn--cancel"
                        onClick={() => setPresForm({
                          id: 0,
                          name: '',
                          barcode: '',
                          unitsPerSale: '1',
                          salePrice: (selectedProductForPresentations.posPrice ?? selectedProductForPresentations.price).toString(),
                          isDefault: false,
                          isActive: true
                        })}
                        style={{ padding: '6px 12px', fontSize: '13px' }}
                      >
                        Cancelar
                      </button>
                    )}
                    <button
                      type="button"
                      className="inv-modal-btn inv-modal-btn--save"
                      onClick={handleSavePresentation}
                      disabled={loadingPresentations}
                      style={{ padding: '6px 12px', fontSize: '13px' }}
                    >
                      {loadingPresentations ? <Loader2 size={16} className="inventory-spinner" /> : 'Guardar'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Tabla de presentaciones actuales */}
              <div>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '15px' }}>Presentaciones Configuradas</h3>
                <div style={{ border: '1px solid var(--color-border)', borderRadius: '6px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ background: 'var(--color-bg-secondary)', borderBottom: '1px solid var(--color-border)' }}>
                        <th style={{ padding: '10px' }}>Nombre</th>
                        <th style={{ padding: '10px' }}>Código de barras</th>
                        <th style={{ padding: '10px' }}>Multiplicador</th>
                        <th style={{ padding: '10px' }}>Precio</th>
                        <th style={{ padding: '10px' }}>Por defecto</th>
                        <th style={{ padding: '10px' }}>Estado</th>
                        <th style={{ padding: '10px', textAlign: 'right' }}>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {presentationsList.map((pres) => (
                        <tr key={pres.id} style={{ borderBottom: '1px solid var(--color-border)', background: pres.id === presForm.id ? 'var(--color-bg-secondary)' : 'transparent' }}>
                          <td style={{ padding: '10px', fontWeight: 600 }}>{pres.name}</td>
                          <td style={{ padding: '10px', color: 'var(--color-text-secondary)' }}>{pres.barcode || '(Sin código)'}</td>
                          <td style={{ padding: '10px' }}>{pres.unitsPerSale} {selectedProductForPresentations.baseUnit || 'pieza'}(s)</td>
                          <td style={{ padding: '10px', fontWeight: 600 }}>${pres.salePrice.toFixed(2)}</td>
                          <td style={{ padding: '10px' }}>{pres.isDefault ? 'Sí' : 'No'}</td>
                          <td style={{ padding: '10px' }}>
                            <span style={{
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              background: pres.isActive ? '#dcfce7' : '#fee2e2',
                              color: pres.isActive ? '#15803d' : '#b91c1c'
                            }}>
                              {pres.isActive ? 'Activo' : 'Inactivo'}
                            </span>
                          </td>
                          <td style={{ padding: '10px', textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                              <button
                                type="button"
                                onClick={() => setPresForm({
                                  id: pres.id,
                                  name: pres.name,
                                  barcode: pres.barcode || '',
                                  unitsPerSale: pres.unitsPerSale.toString(),
                                  salePrice: pres.salePrice.toString(),
                                  isDefault: pres.isDefault,
                                  isActive: pres.isActive
                                })}
                                style={{
                                  border: '1px solid var(--color-border)',
                                  background: 'var(--color-bg-card)',
                                  padding: '4px 8px',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontSize: '12px'
                                }}
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeletePresentation(pres.id)}
                                disabled={pres.isDefault}
                                style={{
                                  border: '1px solid #fecaca',
                                  background: '#fee2e2',
                                  color: '#dc2626',
                                  padding: '4px 8px',
                                  borderRadius: '4px',
                                  cursor: pres.isDefault ? 'not-allowed' : 'pointer',
                                  fontSize: '12px'
                                }}
                                title={pres.isDefault ? "No se puede eliminar la presentación por defecto" : "Eliminar presentación"}
                              >
                                Eliminar
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {presentationsList.length === 0 && (
                        <tr>
                          <td colSpan={7} style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                            No hay presentaciones configuradas aún.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            
            <div className="inv-modal-footer">
              <button
                type="button"
                className="inv-modal-btn inv-modal-btn--cancel"
                onClick={() => setShowPresentationsModal(false)}
                disabled={loadingPresentations}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
