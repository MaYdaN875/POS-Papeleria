import { X, FileDown, Trash2 } from 'lucide-react';
import { useShoppingListStore } from '../store/shoppingListStore';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import type { Product } from '../services/productService';

interface Props {
  onClose: () => void;
}

export default function ShoppingListModal({ onClose }: Props) {
  const { items, removeItem, clearList } = useShoppingListStore();

  const handleDownloadPdf = async (product?: Product) => {
    try {
      const doc = new jsPDF();
      doc.setFontSize(18);
      doc.text(product ? 'Detalle de Producto' : 'Lista de Compras', 14, 20);

      const tableData = product 
        ? [[product.name, product.brand || 'N/A', product.stock.toString(), '']]
        : items.map(p => [p.name, p.brand || 'N/A', p.stock.toString(), '']);

      autoTable(doc, {
        startY: 30,
        head: [['Producto', 'Marca', 'Stock Actual', 'Cantidad a comprar']],
        body: tableData,
      });

      const pdfBase64 = doc.output('datauristring').split(',')[1];
      const fileName = product ? `compra_${product.id}.pdf` : 'lista_compras.pdf';

      if (Capacitor.isNativePlatform()) {
        const savedFile = await Filesystem.writeFile({
          path: fileName,
          data: pdfBase64,
          directory: Directory.Cache
        });

        await Share.share({
          title: 'Lista de Compras',
          url: savedFile.uri,
          dialogTitle: 'Compartir PDF'
        });
      } else {
        doc.save(fileName);
      }
    } catch (e) {
      console.error('Error generating PDF', e);
      alert('Error al generar el PDF');
    }
  };

  return (
    <div className="inv-modal-overlay" onClick={onClose}>
      <div className="inv-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px', width: '90%' }}>
        <div className="inv-modal-header">
          <h2>Lista de Compras ({items.length})</h2>
          <button className="inv-modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="inv-modal-body" style={{ padding: '20px', maxHeight: '60vh', overflowY: 'auto' }}>
          {items.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--color-text-secondary)', padding: '2rem 0' }}>
              No hay productos en la lista de compras.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {items.map(item => (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'var(--color-bg-body)', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 600 }}>{item.name}</span>
                    <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Stock: {item.stock} u.</span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                      onClick={() => handleDownloadPdf(item)}
                      style={{ padding: '6px 12px', borderRadius: '6px', background: 'var(--color-primary-bg)', color: 'var(--color-primary)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <FileDown size={16} /> PDF
                    </button>
                    <button 
                      onClick={() => removeItem(item.id)}
                      style={{ padding: '6px 8px', borderRadius: '6px', background: 'var(--color-danger-bg)', color: 'var(--color-danger)', border: 'none', cursor: 'pointer' }}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="inv-modal-footer" style={{ justifyContent: 'space-between' }}>
          {items.length > 0 && (
            <button
              onClick={() => clearList()}
              className="inv-modal-btn inv-modal-btn--cancel"
            >
              Limpiar Lista
            </button>
          )}
          <button
            onClick={() => handleDownloadPdf()}
            disabled={items.length === 0}
            className="inv-modal-btn inv-modal-btn--submit"
            style={{ marginLeft: 'auto' }}
          >
            Descargar PDF de Todos
          </button>
        </div>
      </div>
    </div>
  );
}
