import React, { useState, useEffect } from 'react';
import {
  Truck,
  FilePlus,
  Inbox,
  AlertTriangle,
  History,
  Search,
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  Loader2,
  TrendingUp,
  DollarSign,
  Package,
  Calendar,
  ShoppingBag
} from 'lucide-react';
import {
  Supplier,
  ProductSupplier,
  PurchaseOrder,
  PurchaseOrderItem,
  PurchaseSuggestion,
  SimpleProduct,
  getSuppliers,
  getSupplierProducts,
  getAllProductsForMapping,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  linkProductSupplier,
  unlinkProductSupplier,
  updateProductSupplierLink,
  getPurchaseOrders,
  getPurchaseOrderDetail,
  getPurchaseSuggestions,
  getSupplierHistory,
  createPurchaseOrder,
  receivePurchaseOrderItems,
  cancelPurchaseOrder
} from '../services/purchaseService';
import '../styles/PurchasesPage.css';

export default function PurchasesPage() {
  const [activeTab, setActiveTab] = useState<'suppliers' | 'create_order' | 'active_orders' | 'suggestions' | 'history'>('suppliers');
  
  // --- Estados de Carga y Error ---
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // --- Estado de Proveedores ---
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [supplierProducts, setSupplierProducts] = useState<ProductSupplier[]>([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [searchSupplier, setSearchSupplier] = useState('');
  
  // Modal Proveedor
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [supplierForm, setSupplierForm] = useState({
    name: '',
    contact_name: '',
    phone: '',
    email: '',
    address: '',
    rfc: ''
  });

  // Modal Enlace Producto
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [allProducts, setAllProducts] = useState<SimpleProduct[]>([]);
  const [searchProductLink, setSearchProductLink] = useState('');
  const [selectedProductId, setSelectedProductId] = useState<number>(0);
  const [linkForm, setLinkForm] = useState({
    cost_price: '',
    supplier_sku: '',
    is_primary: false
  });
  const [linkingProduct, setLinkingProduct] = useState(false);

  // --- Estado de Crear Orden ---
  const [orderSupplierId, setOrderSupplierId] = useState<number>(0);
  const [orderItems, setOrderItems] = useState<Array<{
    product_id: number;
    name: string;
    sku: string | null;
    cost_price: number;
    quantity_ordered: number;
  }>>([]);
  const [orderNotes, setOrderNotes] = useState('');
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [showAddProductToOrderModal, setShowAddProductToOrderModal] = useState(false);
  const [searchProductForOrder, setSearchProductForOrder] = useState('');

  // --- Estado de Órdenes Activas ---
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);
  const [selectedOrderItems, setSelectedOrderItems] = useState<PurchaseOrderItem[]>([]);
  const [loadingOrderDetail, setLoadingOrderDetail] = useState(false);
  
  // Recepción de Mercancía
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [receiveQuantities, setReceiveQuantities] = useState<Record<number, number>>({});
  const [receivingOrder, setReceivingOrder] = useState(false);

  // --- Estado de Sugerencias ---
  const [suggestions, setSuggestions] = useState<PurchaseSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [selectedSuggestions, setSelectedSuggestions] = useState<Record<number, boolean>>({});
  const [generatingOrders, setGeneratingOrders] = useState(false);

  // --- Estado de Historial ---
  const [historyOrders, setHistoryOrders] = useState<PurchaseOrder[]>([]);
  const [historySupplierId, setHistorySupplierId] = useState<number>(0);
  const [historyStats, setHistoryStats] = useState({ total_spent: 0, total_orders: 0 });
  const [loadingHistory, setLoadingHistory] = useState(false);

  // === Efectos Iniciales ===
  useEffect(() => {
    loadSuppliers();
  }, []);

  useEffect(() => {
    if (activeTab === 'active_orders') {
      loadPurchaseOrders();
    } else if (activeTab === 'suggestions') {
      loadSuggestions();
    } else if (activeTab === 'history') {
      loadHistory();
    }
  }, [activeTab]);

  useEffect(() => {
    if (selectedSupplier) {
      loadSupplierProducts(selectedSupplier.id);
    } else {
      setSupplierProducts([]);
    }
  }, [selectedSupplier]);

  // === Funciones de Notificación ===
  function showSuccess(msg: string) {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 4000);
  }

  function showError(msg: string) {
    setError(msg);
    setTimeout(() => setError(''), 4000);
  }

  // === Carga de Datos ===
  async function loadSuppliers() {
    setLoadingSuppliers(true);
    try {
      const data = await getSuppliers();
      setSuppliers(data);
      if (data.length > 0 && !selectedSupplier) {
        setSelectedSupplier(data[0]);
      }
    } catch (err: any) {
      showError(err.message || 'Error al cargar proveedores');
    } finally {
      setLoadingSuppliers(false);
    }
  }

  async function loadSupplierProducts(supplierId: number) {
    setLoadingProducts(true);
    try {
      const data = await getSupplierProducts(supplierId);
      setSupplierProducts(data);
    } catch (err: any) {
      showError(err.message || 'Error al cargar productos del proveedor');
    } finally {
      setLoadingProducts(false);
    }
  }

  async function loadPurchaseOrders() {
    setLoadingOrders(true);
    try {
      const data = await getPurchaseOrders();
      setPurchaseOrders(data);
    } catch (err: any) {
      showError(err.message || 'Error al cargar órdenes de compra');
    } finally {
      setLoadingOrders(false);
    }
  }

  async function loadSuggestions() {
    setLoadingSuggestions(true);
    try {
      const data = await getPurchaseSuggestions();
      setSuggestions(data);
      // Seleccionar todas por defecto
      const initialSelected: Record<number, boolean> = {};
      data.forEach(s => {
        if (s.supplier_id) {
          initialSelected[s.product_id] = true;
        }
      });
      setSelectedSuggestions(initialSelected);
    } catch (err: any) {
      showError(err.message || 'Error al cargar sugerencias de compra');
    } finally {
      setLoadingSuggestions(false);
    }
  }

  async function loadHistory() {
    if (historySupplierId <= 0) {
      setHistoryOrders([]);
      setHistoryStats({ total_spent: 0, total_orders: 0 });
      return;
    }
    setLoadingHistory(true);
    try {
      const res = await getSupplierHistory(historySupplierId);
      setHistoryOrders(res.history);
      setHistoryStats({ total_spent: res.total_spent, total_orders: res.total_orders });
    } catch (err: any) {
      showError(err.message || 'Error al cargar historial del proveedor');
    } finally {
      setLoadingHistory(false);
    }
  }

  // === Operaciones CRUD Proveedores ===
  function handleOpenSupplierModal(supplier: Supplier | null = null) {
    setEditingSupplier(supplier);
    if (supplier) {
      setSupplierForm({
        name: supplier.name,
        contact_name: supplier.contact_name || '',
        phone: supplier.phone || '',
        email: supplier.email || '',
        address: supplier.address || '',
        rfc: supplier.rfc || ''
      });
    } else {
      setSupplierForm({
        name: '',
        contact_name: '',
        phone: '',
        email: '',
        address: '',
        rfc: ''
      });
    }
    setShowSupplierModal(true);
  }

  async function handleSaveSupplier(e: React.FormEvent) {
    e.preventDefault();
    if (!supplierForm.name.trim()) return;

    try {
      if (editingSupplier) {
        const updated = { ...editingSupplier, ...supplierForm };
        await updateSupplier(updated);
        showSuccess('Proveedor actualizado con éxito');
        setSelectedSupplier(updated);
      } else {
        const created = await createSupplier(supplierForm);
        showSuccess('Proveedor registrado con éxito');
        setSelectedSupplier(created);
      }
      setShowSupplierModal(false);
      loadSuppliers();
    } catch (err: any) {
      showError(err.message || 'Error al guardar proveedor');
    }
  }

  async function handleDeleteSupplier(id: number) {
    if (!window.confirm('¿Estás seguro de que deseas eliminar este proveedor? Esto removerá también todas sus asociaciones de productos.')) {
      return;
    }
    try {
      await deleteSupplier(id);
      showSuccess('Proveedor eliminado con éxito');
      setSelectedSupplier(null);
      loadSuppliers();
    } catch (err: any) {
      showError(err.message || 'Error al eliminar proveedor');
    }
  }

  // === Operaciones Enlace de Productos ===
  async function handleOpenLinkModal() {
    setLinkForm({ cost_price: '', supplier_sku: '', is_primary: false });
    setSelectedProductId(0);
    setShowLinkModal(true);
    try {
      const data = await getAllProductsForMapping();
      setAllProducts(data);
    } catch (err: any) {
      showError(err.message || 'Error al obtener catálogo de productos');
    }
  }

  async function handleSaveLink(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSupplier || selectedProductId <= 0 || !linkForm.cost_price) return;

    setLinkingProduct(true);
    try {
      const cost = parseFloat(linkForm.cost_price);
      await linkProductSupplier(
        selectedSupplier.id,
        selectedProductId,
        cost,
        linkForm.supplier_sku,
        linkForm.is_primary
      );
      showSuccess('Producto enlazado con éxito');
      setShowLinkModal(false);
      loadSupplierProducts(selectedSupplier.id);
    } catch (err: any) {
      showError(err.message || 'Error al enlazar producto');
    } finally {
      setLinkingProduct(false);
    }
  }

  async function handleUnlinkProduct(productId: number) {
    if (!selectedSupplier) return;
    if (!window.confirm('¿Deseas desasociar este producto de este proveedor?')) return;

    try {
      await unlinkProductSupplier(selectedSupplier.id, productId);
      showSuccess('Producto desasociado con éxito');
      loadSupplierProducts(selectedSupplier.id);
    } catch (err: any) {
      showError(err.message || 'Error al desasociar producto');
    }
  }

  async function handleTogglePrimary(p: ProductSupplier) {
    if (!selectedSupplier) return;
    try {
      await updateProductSupplierLink(
        selectedSupplier.id,
        p.product_id,
        p.cost_price,
        p.supplier_sku || '',
        !p.is_primary
      );
      showSuccess(p.is_primary ? 'Marcado como proveedor secundario' : 'Establecido como proveedor principal');
      loadSupplierProducts(selectedSupplier.id);
    } catch (err: any) {
      showError(err.message || 'Error al actualizar enlace');
    }
  }

  // === Operaciones Crear Orden ===
  useEffect(() => {
    // Al cambiar de proveedor en la orden, limpiar los ítems cargados
    if (orderSupplierId > 0) {
      setOrderItems([]);
      // Cargar productos de ese proveedor sugeridos para rellenar rápido si se desea
      getSupplierProducts(orderSupplierId).then(prods => {
        // Opcional: auto-agregar productos principales con stock bajo
        const lowStockProds = prods
          .filter(p => p.product_stock <= 5) // stock crítico
          .map(p => ({
            product_id: p.product_id,
            name: p.product_name,
            sku: p.product_sku,
            cost_price: p.cost_price,
            quantity_ordered: 30 // cantidad sugerida por defecto
          }));
        setOrderItems(lowStockProds);
      }).catch(() => {});
    } else {
      setOrderItems([]);
    }
  }, [orderSupplierId]);

  async function handleOpenAddProductToOrder() {
    if (orderSupplierId <= 0) return;
    setShowAddProductToOrderModal(true);
    try {
      const data = await getSupplierProducts(orderSupplierId);
      setAllProducts(data.map(d => ({
        id: d.product_id,
        name: d.product_name,
        sku: d.product_sku,
        stock: d.product_stock
      })));
    } catch (err: any) {
      showError(err.message || 'Error al cargar productos del proveedor');
    }
  }

  function handleAddProductToOrder(p: SimpleProduct) {
    // Buscar si ya está en la orden
    const exists = orderItems.find(item => item.product_id === p.id);
    if (exists) {
      showError('El producto ya se encuentra en la orden');
      return;
    }

    // Buscar costo de la relación
    getSupplierProducts(orderSupplierId).then(prods => {
      const rel = prods.find(pr => pr.product_id === p.id);
      const cost = rel ? rel.cost_price : 0;
      setOrderItems([...orderItems, {
        product_id: p.id,
        name: p.name,
        sku: p.sku,
        cost_price: cost,
        quantity_ordered: 10
      }]);
      setShowAddProductToOrderModal(false);
    }).catch(() => {
      setOrderItems([...orderItems, {
        product_id: p.id,
        name: p.name,
        sku: p.sku,
        cost_price: 0,
        quantity_ordered: 10
      }]);
      setShowAddProductToOrderModal(false);
    });
  }

  function handleRemoveItemFromOrder(productId: number) {
    setOrderItems(orderItems.filter(it => it.product_id !== productId));
  }

  function handleUpdateOrderItemQty(productId: number, qty: number) {
    if (qty < 1) return;
    setOrderItems(orderItems.map(it => 
      it.product_id === productId ? { ...it, quantity_ordered: qty } : it
    ));
  }

  function handleUpdateOrderItemPrice(productId: number, price: number) {
    if (price < 0) return;
    setOrderItems(orderItems.map(it => 
      it.product_id === productId ? { ...it, cost_price: price } : it
    ));
  }

  async function handleCreateOrder() {
    if (orderSupplierId <= 0 || orderItems.length === 0) return;

    setCreatingOrder(true);
    try {
      const itemsPayload = orderItems.map(it => ({
        product_id: it.product_id,
        quantity_ordered: it.quantity_ordered,
        price_per_unit: it.cost_price
      }));
      const orderId = await createPurchaseOrder(orderSupplierId, itemsPayload, orderNotes);
      showSuccess(`Orden de compra #${orderId} creada con éxito`);
      setOrderItems([]);
      setOrderNotes('');
      setOrderSupplierId(0);
      setActiveTab('active_orders');
    } catch (err: any) {
      showError(err.message || 'Error al crear orden de compra');
    } finally {
      setCreatingOrder(false);
    }
  }

  // === Operaciones Órdenes Activas ===
  async function handleSelectOrder(order: PurchaseOrder) {
    setSelectedOrder(order);
    setLoadingOrderDetail(true);
    try {
      const res = await getPurchaseOrderDetail(order.id);
      setSelectedOrderItems(res.items);
      
      // Rellenar cantidades de recepción sugeridas
      const recs: Record<number, number> = {};
      res.items.forEach(it => {
        const remaining = it.quantity_ordered - it.quantity_received;
        recs[it.product_id] = remaining > 0 ? remaining : 0;
      });
      setReceiveQuantities(recs);
    } catch (err: any) {
      showError(err.message || 'Error al cargar detalles de la orden');
    } finally {
      setLoadingOrderDetail(false);
    }
  }

  async function handleCancelOrder(id: number) {
    if (!window.confirm('¿Estás seguro de cancelar esta orden de compra? No se modificará el stock de ningún producto.')) {
      return;
    }

    try {
      await cancelPurchaseOrder(id);
      showSuccess('Orden de compra cancelada');
      setSelectedOrder(null);
      loadPurchaseOrders();
    } catch (err: any) {
      showError(err.message || 'Error al cancelar orden');
    }
  }

  function handleUpdateReceiveQty(productId: number, qty: number) {
    if (qty < 0) return;
    setReceiveQuantities({ ...receiveQuantities, [productId]: qty });
  }

  async function handleConfirmReceipt() {
    if (!selectedOrder) return;

    // Filtrar sólo cantidades mayores a 0
    const itemsPayload = Object.entries(receiveQuantities)
      .map(([prodId, qty]) => ({
        product_id: parseInt(prodId),
        quantity_received: qty
      }))
      .filter(it => it.quantity_received > 0);

    if (itemsPayload.length === 0) {
      showError('Debe ingresar al menos una cantidad recibida mayor a cero');
      return;
    }

    setReceivingOrder(true);
    try {
      await receivePurchaseOrderItems(selectedOrder.id, itemsPayload);
      showSuccess('Mercancía recibida e inventario actualizado con éxito');
      setShowReceiveModal(false);
      // Recargar detalles y lista
      const res = await getPurchaseOrderDetail(selectedOrder.id);
      setSelectedOrderItems(res.items);
      setSelectedOrder(res.order);
      loadPurchaseOrders();
    } catch (err: any) {
      showError(err.message || 'Error al registrar mercancía');
    } finally {
      setReceivingOrder(false);
    }
  }

  // === Operaciones Sugerencias ===
  function handleToggleSuggestion(productId: number) {
    setSelectedSuggestions({
      ...selectedSuggestions,
      [productId]: !selectedSuggestions[productId]
    });
  }

  function handleToggleAllSuggestions() {
    const allSelected = Object.values(selectedSuggestions).every(v => v);
    const updated: Record<number, boolean> = {};
    suggestions.forEach(s => {
      if (s.supplier_id) {
        updated[s.product_id] = !allSelected;
      }
    });
    setSelectedSuggestions(updated);
  }

  async function handleGenerateAutomaticOrders() {
    const selectedProds = Object.keys(selectedSuggestions).filter(k => selectedSuggestions[parseInt(k)]);
    if (selectedProds.length === 0) {
      showError('Debe seleccionar al menos una sugerencia');
      return;
    }

    setGeneratingOrders(true);
    try {
      // 1. Agrupar productos seleccionados por proveedor
      const groups: Record<number, Array<PurchaseSuggestion>> = {};
      selectedProds.forEach(pidStr => {
        const pid = parseInt(pidStr);
        const sug = suggestions.find(s => s.product_id === pid);
        if (sug && sug.supplier_id) {
          if (!groups[sug.supplier_id]) {
            groups[sug.supplier_id] = [];
          }
          groups[sug.supplier_id].push(sug);
        }
      });

      // 2. Crear una orden de compra para cada grupo
      const supplierKeys = Object.keys(groups);
      if (supplierKeys.length === 0) {
        showError('Ninguno de los productos seleccionados tiene un proveedor principal asignado');
        setGeneratingOrders(false);
        return;
      }

      let ordersCreatedCount = 0;
      for (const sidStr of supplierKeys) {
        const sid = parseInt(sidStr);
        const sugsForSupplier = groups[sid];
        
        const itemsPayload = sugsForSupplier.map(s => {
          // Fórmula sugerida: comprar el triple del stock mínimo (threshold * 3) menos el stock actual,
          // o por defecto comprar 30 unidades si no tiene una lógica clara.
          const quantity = Math.max(10, (s.low_stock_threshold * 3) - s.current_stock);
          return {
            product_id: s.product_id,
            quantity_ordered: quantity,
            price_per_unit: s.cost_price || 0.00
          };
        });

        await createPurchaseOrder(
          sid,
          itemsPayload,
          'Orden generada automáticamente por alerta de stock mínimo en el POS.'
        );
        ordersCreatedCount++;
      }

      showSuccess(`Se crearon ${ordersCreatedCount} órdenes de compra automáticas con éxito.`);
      loadSuggestions();
      loadPurchaseOrders();
    } catch (err: any) {
      showError(err.message || 'Error al generar órdenes de compra');
    } finally {
      setGeneratingOrders(false);
    }
  }

  // === Filtrar Proveedores ===
  const filteredSuppliers = suppliers.filter(s =>
    s.name.toLowerCase().includes(searchSupplier.toLowerCase()) ||
    (s.contact_name && s.contact_name.toLowerCase().includes(searchSupplier.toLowerCase())) ||
    (s.phone && s.phone.includes(searchSupplier))
  );

  // === Totales de la Orden Actual ===
  const orderTotalItems = orderItems.reduce((acc, it) => acc + it.quantity_ordered, 0);
  const orderTotalCost = orderItems.reduce((acc, it) => acc + (it.quantity_ordered * it.cost_price), 0);

  // === RENDER ===
  return (
    <div className="purchases-container">
      <div className="purchases-header">
        <h1 className="purchases-title">Proveedores y Compras</h1>
        
        {/* Banner de mensajes */}
        {successMsg && <div className="status-pill received" style={{ padding: '8px 16px' }}><Check size={16} /> {successMsg}</div>}
        {error && <div className="status-pill cancelled" style={{ padding: '8px 16px', background: 'var(--color-danger-bg)', color: 'var(--color-danger)' }}><AlertTriangle size={16} /> {error}</div>}
      </div>

      {/* Selector de Pestañas */}
      <div className="purchases-tabs">
        <button
          className={`purchases-tab-btn ${activeTab === 'suppliers' ? 'active' : ''}`}
          onClick={() => setActiveTab('suppliers')}
        >
          <Truck size={18} /> Proveedores
        </button>
        <button
          className={`purchases-tab-btn ${activeTab === 'create_order' ? 'active' : ''}`}
          onClick={() => setActiveTab('create_order')}
        >
          <FilePlus size={18} /> Crear Orden
        </button>
        <button
          className={`purchases-tab-btn ${activeTab === 'active_orders' ? 'active' : ''}`}
          onClick={() => setActiveTab('active_orders')}
        >
          <Inbox size={18} /> Recepción de Pedidos
        </button>
        <button
          className={`purchases-tab-btn ${activeTab === 'suggestions' ? 'active' : ''}`}
          onClick={() => setActiveTab('suggestions')}
        >
          <AlertTriangle size={18} /> Sugerencias de Compra
        </button>
        <button
          className={`purchases-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('history');
            if (suppliers.length > 0 && historySupplierId === 0) {
              setHistorySupplierId(suppliers[0].id);
            }
          }}
        >
          <History size={18} /> Historial
        </button>
      </div>

      <div className="purchases-tab-content">
        
        {/* =====================================================================
            1. PESTAÑA: PROVEEDORES (Split Layout)
            ===================================================================== */}
        {activeTab === 'suppliers' && (
          <div className="purchases-split-layout">
            
            {/* Panel Izquierdo: Lista de Proveedores */}
            <div className="purchases-left-panel">
              <div className="panel-header">
                <span className="panel-title"><Truck size={16} /> Proveedores</span>
                <button className="btn-icon" onClick={() => handleOpenSupplierModal()} title="Registrar Proveedor">
                  <Plus size={20} />
                </button>
              </div>

              <div className="panel-search-box">
                <Search size={16} />
                <input
                  type="text"
                  placeholder="Buscar proveedor..."
                  className="panel-search-input"
                  value={searchSupplier}
                  onChange={(e) => setSearchSupplier(e.target.value)}
                />
              </div>

              {loadingSuppliers ? (
                <div className="loading-container"><Loader2 className="loading-spinner" /> Cargando...</div>
              ) : filteredSuppliers.length === 0 ? (
                <div className="empty-container">No se encontraron proveedores.</div>
              ) : (
                <div className="panel-list">
                  {filteredSuppliers.map(s => (
                    <div
                      key={s.id}
                      className={`panel-list-item ${selectedSupplier?.id === s.id ? 'selected' : ''}`}
                      onClick={() => setSelectedSupplier(s)}
                    >
                      <span className="panel-list-item-title">{s.name}</span>
                      <span className="panel-list-item-subtitle">
                        RFC: {s.rfc || 'N/A'} {s.phone && `• Tel: ${s.phone}`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Panel Derecho: Detalle de Proveedor y Enlaces */}
            <div className="purchases-right-panel">
              {selectedSupplier ? (
                <>
                  <div className="panel-header">
                    <span className="panel-title">{selectedSupplier.name}</span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button className="btn-secondary" onClick={() => handleOpenSupplierModal(selectedSupplier)}>
                        <Edit2 size={16} /> Editar
                      </button>
                      <button className="btn-danger" onClick={() => handleDeleteSupplier(selectedSupplier.id)}>
                        <Trash2 size={16} /> Eliminar
                      </button>
                    </div>
                  </div>

                  <div className="scrollable-content">
                    {/* Campos de Detalle */}
                    <div className="supplier-detail-info">
                      <div className="detail-field">
                        <span className="detail-label">Contacto</span>
                        <span className="detail-value">{selectedSupplier.contact_name || 'Sin especificar'}</span>
                      </div>
                      <div className="detail-field">
                        <span className="detail-label">Teléfono</span>
                        <span className="detail-value">{selectedSupplier.phone || 'Sin especificar'}</span>
                      </div>
                      <div className="detail-field">
                        <span className="detail-label">Email</span>
                        <span className="detail-value">{selectedSupplier.email || 'Sin especificar'}</span>
                      </div>
                      <div className="detail-field">
                        <span className="detail-label">RFC</span>
                        <span className="detail-value">{selectedSupplier.rfc || 'N/A'}</span>
                      </div>
                      <div className="detail-field" style={{ gridColumn: 'span 2' }}>
                        <span className="detail-label">Dirección</span>
                        <span className="detail-value">{selectedSupplier.address || 'Sin especificar'}</span>
                      </div>
                    </div>

                    {/* Tabla de Productos Relacionados */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Productos que surte</h3>
                      <button className="btn-primary" onClick={handleOpenLinkModal}>
                        <Plus size={16} /> Enlazar Producto
                      </button>
                    </div>

                    {loadingProducts ? (
                      <div className="loading-container"><Loader2 className="loading-spinner" /> Cargando productos...</div>
                    ) : supplierProducts.length === 0 ? (
                      <div className="empty-container">
                        <Package size={32} />
                        Este proveedor no tiene productos asociados todavía.
                      </div>
                    ) : (
                      <div className="purchases-table-container">
                        <table className="purchases-table">
                          <thead>
                            <tr>
                              <th>Producto</th>
                              <th>SKU Sistema</th>
                              <th>SKU Proveedor</th>
                              <th>Costo</th>
                              <th>Stock</th>
                              <th>Principal</th>
                              <th>Acciones</th>
                            </tr>
                          </thead>
                          <tbody>
                            {supplierProducts.map(p => (
                              <tr key={p.product_id}>
                                <td style={{ fontWeight: 600 }}>{p.product_name}</td>
                                <td>{p.product_sku || 'N/A'}</td>
                                <td>{p.supplier_sku || 'N/A'}</td>
                                <td style={{ fontWeight: 'bold', color: 'var(--color-primary)' }}>
                                  ${p.cost_price.toFixed(2)}
                                </td>
                                <td>
                                  <span className={`status-pill ${p.product_stock <= 5 ? 'cancelled' : 'received'}`} style={{ padding: '2px 8px' }}>
                                    {p.product_stock} uds
                                  </span>
                                </td>
                                <td>
                                  <button
                                    onClick={() => handleTogglePrimary(p)}
                                    className={`status-pill ${p.is_primary ? 'received' : 'pending'}`}
                                    style={{ border: 'none', cursor: 'pointer' }}
                                  >
                                    {p.is_primary ? 'Sí (Principal)' : 'No (Secundario)'}
                                  </button>
                                </td>
                                <td>
                                  <button
                                    className="btn-icon danger"
                                    onClick={() => handleUnlinkProduct(p.product_id)}
                                    title="Desasociar producto"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="empty-container">
                  <Truck size={48} />
                  Seleccione un proveedor de la lista o registre uno nuevo.
                </div>
              )}
            </div>
          </div>
        )}

        {/* =====================================================================
            2. PESTAÑA: CREAR ORDEN DE COMPRA
            ===================================================================== */}
        {activeTab === 'create_order' && (
          <div className="create-order-layout">
            
            {/* Panel Principal: Artículos en la Orden */}
            <div className="order-form-panel">
              <div className="panel-header">
                <span className="panel-title"><FilePlus size={16} /> Artículos en el Pedido</span>
                {orderSupplierId > 0 && (
                  <button className="btn-primary" onClick={handleOpenAddProductToOrder}>
                    <Plus size={16} /> Agregar Producto
                  </button>
                )}
              </div>

              {orderSupplierId === 0 ? (
                <div className="empty-container">
                  <Truck size={48} />
                  Por favor, seleccione un proveedor en el menú de la derecha para comenzar.
                </div>
              ) : orderItems.length === 0 ? (
                <div className="empty-container">
                  <Package size={48} />
                  La orden está vacía. Añada productos haciendo clic en "Agregar Producto".
                </div>
              ) : (
                <div className="scrollable-content" style={{ padding: 0 }}>
                  <div className="purchases-table-container">
                    <table className="purchases-table">
                      <thead>
                        <tr>
                          <th>Producto</th>
                          <th>SKU</th>
                          <th>Costo Unitario</th>
                          <th>Cantidad</th>
                          <th>Subtotal</th>
                          <th>Quitar</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orderItems.map(it => (
                          <tr key={it.product_id}>
                            <td style={{ fontWeight: 600 }}>{it.name}</td>
                            <td>{it.sku || 'N/A'}</td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <span>$</span>
                                <input
                                  type="number"
                                  className="inline-input"
                                  value={it.cost_price}
                                  onChange={(e) => handleUpdateOrderItemPrice(it.product_id, parseFloat(e.target.value) || 0)}
                                  step="0.01"
                                  min="0"
                                />
                              </div>
                            </td>
                            <td>
                              <input
                                type="number"
                                className="inline-input"
                                value={it.quantity_ordered}
                                onChange={(e) => handleUpdateOrderItemQty(it.product_id, parseInt(e.target.value) || 0)}
                                min="1"
                              />
                            </td>
                            <td style={{ fontWeight: 'bold' }}>
                              ${(it.cost_price * it.quantity_ordered).toFixed(2)}
                            </td>
                            <td>
                              <button className="btn-icon danger" onClick={() => handleRemoveItemFromOrder(it.product_id)}>
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Panel Derecho: Configuración y Totales */}
            <div className="order-summary-panel">
              <h3 style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '8px' }}>Detalles del Pedido</h3>
              
              <div className="form-group">
                <label className="form-label">Proveedor</label>
                <select
                  className="form-select"
                  value={orderSupplierId}
                  onChange={(e) => setOrderSupplierId(parseInt(e.target.value) || 0)}
                >
                  <option value="0">-- Seleccionar Proveedor --</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Notas / Instrucciones</label>
                <textarea
                  className="form-textarea"
                  rows={4}
                  placeholder="Instrucciones especiales para el pedido (ej. pago contra entrega, envío por cobrar)..."
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                />
              </div>

              <div style={{ marginTop: 'auto' }}>
                <div className="summary-row">
                  <span>Productos Únicos:</span>
                  <span style={{ fontWeight: 600 }}>{orderItems.length}</span>
                </div>
                <div className="summary-row">
                  <span>Unidades Totales:</span>
                  <span style={{ fontWeight: 600 }}>{orderTotalItems}</span>
                </div>
                <div className="summary-row total">
                  <span>Total estimado:</span>
                  <span>${orderTotalCost.toFixed(2)}</span>
                </div>

                <button
                  className="btn-primary"
                  style={{ width: '100%', justifyContent: 'center', marginTop: '16px', padding: '12px' }}
                  onClick={handleCreateOrder}
                  disabled={creatingOrder || orderSupplierId === 0 || orderItems.length === 0}
                >
                  {creatingOrder ? <Loader2 className="loading-spinner" /> : <Check size={18} />}
                  Confirmar Orden de Compra
                </button>
              </div>
            </div>

          </div>
        )}

        {/* =====================================================================
            3. PESTAÑA: RECEPCIÓN DE MERCANCÍA (Active Orders)
            ===================================================================== */}
        {activeTab === 'active_orders' && (
          <div className="purchases-split-layout">
            
            {/* Panel Izquierdo: Órdenes Pendientes */}
            <div className="purchases-left-panel">
              <div className="panel-header">
                <span className="panel-title"><Inbox size={16} /> Pedidos Activos</span>
              </div>

              {loadingOrders ? (
                <div className="loading-container"><Loader2 className="loading-spinner" /> Cargando...</div>
              ) : purchaseOrders.filter(o => o.status === 'pending' || o.status === 'partially_received').length === 0 ? (
                <div className="empty-container">No hay pedidos pendientes por recibir.</div>
              ) : (
                <div className="panel-list">
                  {purchaseOrders
                    .filter(o => o.status === 'pending' || o.status === 'partially_received')
                    .map(o => (
                      <div
                        key={o.id}
                        className={`panel-list-item ${selectedOrder?.id === o.id ? 'selected' : ''}`}
                        onClick={() => handleSelectOrder(o)}
                      >
                        <span className="panel-list-item-title">Pedido #{o.id}</span>
                        <span className="panel-list-item-subtitle" style={{ fontWeight: 600, color: 'var(--color-primary)' }}>
                          {o.supplier_name}
                        </span>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                          <span className={`status-pill ${o.status}`}>{o.status === 'pending' ? 'Pendiente' : 'Parcial'}</span>
                          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                            ${o.total_amount.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Panel Derecho: Recepción del Pedido Seleccionado */}
            <div className="purchases-right-panel">
              {selectedOrder ? (
                <>
                  <div className="panel-header">
                    <div>
                      <span className="panel-title">Pedido #{selectedOrder.id} - {selectedOrder.supplier_name}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', display: 'block', marginTop: '4px' }}>
                        Creado el {new Date(selectedOrder.created_at).toLocaleDateString()} por {selectedOrder.admin_name || 'Admin'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button className="btn-primary" onClick={() => setShowReceiveModal(true)}>
                        <Inbox size={16} /> Recibir Mercancía
                      </button>
                      <button className="btn-danger" onClick={() => handleCancelOrder(selectedOrder.id)}>
                        <X size={16} /> Cancelar Orden
                      </button>
                    </div>
                  </div>

                  <div className="scrollable-content">
                    {selectedOrder.notes && (
                      <div style={{ background: 'var(--color-bg-main)', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.85rem' }}>
                        <strong>Notas:</strong> {selectedOrder.notes}
                      </div>
                    )}

                    <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '12px' }}>Detalles del Pedido</h3>
                    
                    {loadingOrderDetail ? (
                      <div className="loading-container"><Loader2 className="loading-spinner" /> Cargando artículos...</div>
                    ) : (
                      <div className="purchases-table-container">
                        <table className="purchases-table">
                          <thead>
                            <tr>
                              <th>Producto</th>
                              <th>SKU</th>
                              <th>Costo Unitario</th>
                              <th>Cant. Solicitada</th>
                              <th>Cant. Recibida</th>
                              <th>Pendiente</th>
                              <th>Subtotal</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedOrderItems.map(it => {
                              const pendingQty = it.quantity_ordered - it.quantity_received;
                              return (
                                <tr key={it.id}>
                                  <td style={{ fontWeight: 600 }}>{it.product_name}</td>
                                  <td>{it.product_sku || 'N/A'}</td>
                                  <td>${it.price_per_unit.toFixed(2)}</td>
                                  <td style={{ fontWeight: 600 }}>{it.quantity_ordered}</td>
                                  <td style={{ color: 'var(--color-success-dark)', fontWeight: 600 }}>
                                    {it.quantity_received}
                                  </td>
                                  <td>
                                    <span className={`status-pill ${pendingQty > 0 ? 'pending' : 'received'}`}>
                                      {pendingQty}
                                    </span>
                                  </td>
                                  <td style={{ fontWeight: 'bold' }}>${it.total_price.toFixed(2)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="empty-container">
                  <Inbox size={48} />
                  Seleccione una orden de compra pendiente de la lista izquierda para ingresar mercancía.
                </div>
              )}
            </div>

          </div>
        )}

        {/* =====================================================================
            4. PESTAÑA: SUGERENCIAS DE COMPRA (Critical Stock)
            ===================================================================== */}
        {activeTab === 'suggestions' && (
          <div className="scrollable-content" style={{ padding: 'var(--space-md)' }}>
            
            <div className="suggestion-alert">
              <AlertTriangle className="suggestion-alert-icon" size={24} />
              <div>
                <strong>Alerta de Reabastecimiento:</strong> El sistema ha detectado los siguientes productos con stock por debajo del límite mínimo.
                Puedes generar órdenes de compra automáticamente agrupando los artículos por su proveedor principal asignado.
              </div>
            </div>

            <div className="suggestion-actions">
              <div className="suggestion-group-info">
                {suggestions.filter(s => selectedSuggestions[s.product_id]).length} sugerencias seleccionadas
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button className="btn-secondary" onClick={handleToggleAllSuggestions}>
                  {Object.values(selectedSuggestions).every(v => v) ? 'Deseleccionar Todos' : 'Seleccionar Todos'}
                </button>
                <button
                  className="btn-primary"
                  onClick={handleGenerateAutomaticOrders}
                  disabled={generatingOrders || suggestions.filter(s => selectedSuggestions[s.product_id]).length === 0}
                >
                  {generatingOrders ? <Loader2 className="loading-spinner" /> : <ShoppingBag size={18} />}
                  Generar Pedidos Automáticos
                </button>
              </div>
            </div>

            {loadingSuggestions ? (
              <div className="loading-container"><Loader2 className="loading-spinner" /> Generando sugerencias...</div>
            ) : suggestions.length === 0 ? (
              <div className="empty-container" style={{ background: 'var(--color-bg-card)', borderRadius: '8px' }}>
                <Check size={48} style={{ color: 'var(--color-success)' }} />
                ¡Inventario al día! Ningún producto está por debajo de su stock mínimo.
              </div>
            ) : (
              <div className="purchases-table-container">
                <table className="purchases-table" style={{ background: 'var(--color-bg-card)' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '40px' }}></th>
                      <th>Producto</th>
                      <th>Stock Actual</th>
                      <th>Stock Mínimo</th>
                      <th>Proveedor Principal</th>
                      <th>Costo Proveedor</th>
                      <th>Sugerencia de Compra</th>
                    </tr>
                  </thead>
                  <tbody>
                    {suggestions.map(s => {
                      const qtyToOrder = Math.max(10, (s.low_stock_threshold * 3) - s.current_stock);
                      return (
                        <tr key={s.product_id}>
                          <td>
                            {s.supplier_id ? (
                              <input
                                type="checkbox"
                                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                checked={!!selectedSuggestions[s.product_id]}
                                onChange={() => handleToggleSuggestion(s.product_id)}
                              />
                            ) : (
                              <span title="Sin proveedor principal asignado" style={{ color: 'var(--color-text-muted)' }}>-</span>
                            )}
                          </td>
                          <td style={{ fontWeight: 600 }}>{s.product_name}</td>
                          <td>
                            <span className="status-pill cancelled" style={{ fontWeight: 700 }}>
                              {s.current_stock}
                            </span>
                          </td>
                          <td>{s.low_stock_threshold}</td>
                          <td style={{ fontWeight: 600, color: s.supplier_name ? 'var(--color-primary)' : 'var(--color-danger)' }}>
                            {s.supplier_name || 'Sin proveedor asignado'}
                          </td>
                          <td>{s.cost_price ? `$${s.cost_price.toFixed(2)}` : 'N/A'}</td>
                          <td>
                            {s.supplier_id ? (
                              <span style={{ fontWeight: 700, color: 'var(--color-success-dark)' }}>
                                Comprar {qtyToOrder} unidades
                              </span>
                            ) : (
                              <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
                                Enlace a un proveedor primero en la pestaña "Proveedores"
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

          </div>
        )}

        {/* =====================================================================
            5. PESTAÑA: HISTORIAL Y REPORTES
            ===================================================================== */}
        {activeTab === 'history' && (
          <div className="scrollable-content" style={{ padding: 'var(--space-md)' }}>
            
            {/* Cabecera del Historial */}
            <div style={{ background: 'var(--color-bg-card)', padding: '16px', borderRadius: '8px', border: '1px solid var(--color-border)', marginBottom: '16px', display: 'flex', gap: '24px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div className="form-group" style={{ margin: 0, minWidth: '250px' }}>
                <label className="form-label">Filtrar Historial por Proveedor</label>
                <select
                  className="form-select"
                  value={historySupplierId}
                  onChange={(e) => setHistorySupplierId(parseInt(e.target.value) || 0)}
                >
                  <option value="0">-- Seleccionar Proveedor --</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <button className="btn-primary" onClick={loadHistory} disabled={historySupplierId <= 0 || loadingHistory}>
                {loadingHistory ? <Loader2 className="loading-spinner" /> : <Search size={16} />}
                Consultar
              </button>
            </div>

            {/* Estadísticas rápidas del proveedor */}
            {historySupplierId > 0 && !loadingHistory && (
              <div className="purchases-stats-grid">
                <div className="purchases-stat-card">
                  <div className="purchases-stat-icon success">
                    <DollarSign size={24} />
                  </div>
                  <div className="purchases-stat-info">
                    <span className="purchases-stat-value">${historyStats.total_spent.toFixed(2)}</span>
                    <span className="purchases-stat-label">Total Comprado (Recibido)</span>
                  </div>
                </div>

                <div className="purchases-stat-card">
                  <div className="purchases-stat-icon">
                    <TrendingUp size={24} />
                  </div>
                  <div className="purchases-stat-info">
                    <span className="purchases-stat-value">{historyStats.total_orders}</span>
                    <span className="purchases-stat-label">Pedidos Completados / Parciales</span>
                  </div>
                </div>
              </div>
            )}

            {/* Tabla de Historial */}
            {loadingHistory ? (
              <div className="loading-container"><Loader2 className="loading-spinner" /> Cargando historial...</div>
            ) : historySupplierId === 0 ? (
              <div className="empty-container" style={{ background: 'var(--color-bg-card)', borderRadius: '8px' }}>
                <Truck size={48} />
                Seleccione un proveedor arriba para cargar su historial de órdenes de compra.
              </div>
            ) : historyOrders.length === 0 ? (
              <div className="empty-container" style={{ background: 'var(--color-bg-card)', borderRadius: '8px' }}>
                <History size={48} />
                Este proveedor no tiene transacciones registradas.
              </div>
            ) : (
              <div className="purchases-table-container">
                <table className="purchases-table" style={{ background: 'var(--color-bg-card)' }}>
                  <thead>
                    <tr>
                      <th>Pedido ID</th>
                      <th>Fecha de Creación</th>
                      <th>Registrado Por</th>
                      <th>Monto Total</th>
                      <th>Estado</th>
                      <th>Notas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyOrders.map(o => (
                      <tr key={o.id}>
                        <td style={{ fontWeight: 700 }}>#{o.id}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Calendar size={14} className="text-secondary" />
                            {new Date(o.created_at).toLocaleString()}
                          </div>
                        </td>
                        <td>{o.admin_name || 'Admin'}</td>
                        <td style={{ fontWeight: 'bold' }}>${o.total_amount.toFixed(2)}</td>
                        <td>
                          <span className={`status-pill ${o.status}`}>
                            {o.status === 'received' && 'Recibido'}
                            {o.status === 'partially_received' && 'Recepción Parcial'}
                            {o.status === 'pending' && 'Pendiente'}
                            {o.status === 'cancelled' && 'Cancelado'}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                          {o.notes || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

          </div>
        )}

      </div>

      {/* =====================================================================
          MÓDULO: MODALES DE DIÁLOGO
          ===================================================================== */}
      
      {/* 1. Modal: Agregar/Editar Proveedor */}
      {showSupplierModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <span className="modal-title">{editingSupplier ? 'Editar Proveedor' : 'Registrar Proveedor'}</span>
              <button className="btn-icon" onClick={() => setShowSupplierModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSaveSupplier}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Nombre del Proveedor *</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    value={supplierForm.name}
                    onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                    placeholder="Ej. Distribuidora Lumen"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Nombre del Contacto</label>
                  <input
                    type="text"
                    className="form-input"
                    value={supplierForm.contact_name}
                    onChange={(e) => setSupplierForm({ ...supplierForm, contact_name: e.target.value })}
                    placeholder="Ej. Juan Pérez"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Teléfono</label>
                  <input
                    type="text"
                    className="form-input"
                    value={supplierForm.phone}
                    onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                    placeholder="Ej. 3317178243"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Correo Electrónico</label>
                  <input
                    type="email"
                    className="form-input"
                    value={supplierForm.email}
                    onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })}
                    placeholder="Ej. contacto@proveedor.com"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">RFC</label>
                  <input
                    type="text"
                    maxLength={13}
                    className="form-input"
                    value={supplierForm.rfc}
                    onChange={(e) => setSupplierForm({ ...supplierForm, rfc: e.target.value.toUpperCase() })}
                    placeholder="Ej. LUM901201ABC"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Dirección Física</label>
                  <textarea
                    className="form-textarea"
                    rows={2}
                    value={supplierForm.address}
                    onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })}
                    placeholder="Calle, Número, Colonia, C.P., Ciudad"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowSupplierModal(false)}>Cancelar</button>
                <button type="submit" className="btn-primary">Guardar Proveedor</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Modal: Enlazar Producto a Proveedor */}
      {showLinkModal && selectedSupplier && (
        <div className="modal-overlay">
          <div className="modal-content large">
            <div className="modal-header">
              <span className="modal-title">Asociar Producto a {selectedSupplier.name}</span>
              <button className="btn-icon" onClick={() => setShowLinkModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSaveLink}>
              <div className="modal-body" style={{ display: 'flex', gap: '16px' }}>
                
                {/* Lado izquierdo: Seleccionar producto */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '350px', overflow: 'hidden' }}>
                  <label className="form-label">Seleccionar Producto *</label>
                  <div className="panel-search-box" style={{ margin: '8px 0' }}>
                    <Search size={16} />
                    <input
                      type="text"
                      placeholder="Buscar producto..."
                      className="panel-search-input"
                      value={searchProductLink}
                      onChange={(e) => setSearchProductLink(e.target.value)}
                    />
                  </div>

                  <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: '4px', padding: '4px' }}>
                    {allProducts
                      .filter(p => p.name.toLowerCase().includes(searchProductLink.toLowerCase()) || (p.sku && p.sku.includes(searchProductLink)))
                      .map(p => (
                        <div
                          key={p.id}
                          onClick={() => setSelectedProductId(p.id)}
                          style={{
                            padding: '8px',
                            cursor: 'pointer',
                            borderRadius: '4px',
                            background: selectedProductId === p.id ? 'var(--color-primary-bg)' : 'transparent',
                            fontWeight: selectedProductId === p.id ? 'bold' : 'normal',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                        >
                          <span>{p.name}</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Stock: {p.stock}</span>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Lado derecho: Configurar costo y sku */}
                <div style={{ width: '250px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {(() => {
                    const selectedProductForLink = allProducts.find(p => p.id === selectedProductId);
                    if (!selectedProductForLink) return null;
                    return (
                      <div style={{ background: 'var(--color-bg-main)', padding: '12px', borderRadius: '6px', fontSize: '0.85rem', border: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ fontWeight: 700, color: 'var(--color-primary)', marginBottom: '4px' }}>Producto Seleccionado</div>
                        <div><strong>SKU:</strong> {selectedProductForLink.sku || 'Sin SKU'}</div>
                        <div><strong>Precio Web:</strong> ${Number(selectedProductForLink.price ?? 0).toFixed(2)}</div>
                        {selectedProductForLink.pos_price !== null && selectedProductForLink.pos_price !== undefined && (
                          <div><strong>Precio POS:</strong> ${Number(selectedProductForLink.pos_price).toFixed(2)}</div>
                        )}
                        <div><strong>Stock Actual:</strong> {selectedProductForLink.stock} uds</div>
                      </div>
                    );
                  })()}

                  <div className="form-group">
                    <label className="form-label">Precio de Costo ($) *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      min="0"
                      className="form-input"
                      value={linkForm.cost_price}
                      onChange={(e) => setLinkForm({ ...linkForm, cost_price: e.target.value })}
                      placeholder="Ej. 12.50"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Código de Proveedor (SKU)</label>
                    <input
                      type="text"
                      className="form-input"
                      value={linkForm.supplier_sku}
                      onChange={(e) => setLinkForm({ ...linkForm, supplier_sku: e.target.value })}
                      placeholder="Ej. PROV-BLU-10"
                    />
                  </div>

                  <div className="form-group" style={{ marginTop: '8px' }}>
                    <label className="checkbox-container">
                      <input
                        type="checkbox"
                        checked={linkForm.is_primary}
                        onChange={(e) => setLinkForm({ ...linkForm, is_primary: e.target.checked })}
                      />
                      ¿Es Proveedor Principal?
                    </label>
                  </div>
                </div>

              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowLinkModal(false)}>Cancelar</button>
                <button type="submit" className="btn-primary" disabled={linkingProduct || selectedProductId === 0}>
                  {linkingProduct ? <Loader2 className="loading-spinner" /> : <Check size={16} />}
                  Enlazar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Modal: Agregar Producto Manual a la Orden de Compra */}
      {showAddProductToOrderModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <span className="modal-title">Agregar Producto al Pedido</span>
              <button className="btn-icon" onClick={() => setShowAddProductToOrderModal(false)}><X size={20} /></button>
            </div>
            <div className="modal-body" style={{ height: '350px', display: 'flex', flexDirection: 'column' }}>
              <div className="panel-search-box" style={{ margin: '0 0 12px 0' }}>
                <Search size={16} />
                <input
                  type="text"
                  placeholder="Buscar producto de este proveedor..."
                  className="panel-search-input"
                  value={searchProductForOrder}
                  onChange={(e) => setSearchProductForOrder(e.target.value)}
                />
              </div>

              <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: '4px', padding: '4px' }}>
                {allProducts
                  .filter(p => p.name.toLowerCase().includes(searchProductForOrder.toLowerCase()))
                  .map(p => (
                    <div
                      key={p.id}
                      onClick={() => handleAddProductToOrder(p)}
                      style={{
                        padding: '10px',
                        cursor: 'pointer',
                        borderRadius: '4px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        borderBottom: '1px solid var(--color-border-light)'
                      }}
                      className="panel-list-item"
                    >
                      <span style={{ fontWeight: 600 }}>{p.name}</span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>Stock: {p.stock}</span>
                    </div>
                  ))}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowAddProductToOrderModal(false)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Modal: Registrar Recepción de Mercancía */}
      {showReceiveModal && selectedOrder && (
        <div className="modal-overlay">
          <div className="modal-content large">
            <div className="modal-header">
              <span className="modal-title">Confirmar Entrada de Mercancía - Pedido #{selectedOrder.id}</span>
              <button className="btn-icon" onClick={() => setShowReceiveModal(false)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '16px' }}>
                Ingrese la cantidad de unidades que acaban de llegar al negocio. El stock físico del producto se incrementará automáticamente.
              </p>

              <div className="purchases-table-container">
                <table className="purchases-table">
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th>Pedido</th>
                      <th>Recibido Prev.</th>
                      <th>Pendiente</th>
                      <th>Llegaron Hoy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedOrderItems.map(it => {
                      const pendingQty = it.quantity_ordered - it.quantity_received;
                      return (
                        <tr key={it.id}>
                          <td style={{ fontWeight: 600 }}>{it.product_name}</td>
                          <td>{it.quantity_ordered}</td>
                          <td style={{ color: 'var(--color-text-secondary)' }}>{it.quantity_received}</td>
                          <td>
                            <span className="status-pill pending" style={{ fontWeight: 700 }}>
                              {pendingQty}
                            </span>
                          </td>
                          <td>
                            <input
                              type="number"
                              className="inline-input"
                              value={receiveQuantities[it.product_id] ?? 0}
                              onChange={(e) => handleUpdateReceiveQty(it.product_id, parseInt(e.target.value) || 0)}
                              min="0"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowReceiveModal(false)}>Cancelar</button>
              <button className="btn-primary" onClick={handleConfirmReceipt} disabled={receivingOrder}>
                {receivingOrder ? <Loader2 className="loading-spinner" /> : <Check size={16} />}
                Cargar al Inventario (Entrada)
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
