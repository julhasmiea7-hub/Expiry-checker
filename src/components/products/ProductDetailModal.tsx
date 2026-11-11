import React, { useState } from 'react';
import { 
  X, 
  Edit, 
  Archive, 
  ArchiveRestore, 
  Trash2, 
  Barcode, 
  Layers, 
  Clock, 
  AlertTriangle, 
  Plus, 
  Minus, 
  Zap, 
  Check, 
  ShieldAlert,
  Calendar
} from 'lucide-react';
import { Product, ProductBatch, StockMovement } from '../../types/inventory';
import { 
  calculateDaysRemaining, 
  formatExpiryRelative, 
  getExpiryStatus, 
  getExpiryStatusConfig, 
  getFEFOSortedBatches, 
  getProductTotalStock 
} from '../../utils/expiry';
import { playBarcodeBeep, playSuccessChime } from '../../utils/audioAlert';

interface ProductDetailModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (product: Product) => void;
  onSaveProduct: (product: Product) => void;
  onAddMovement: (movement: StockMovement) => void;
  onArchiveToggle: (product: Product) => void;
  onDeleteProduct: (productId: string) => void;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product,
  isOpen,
  onClose,
  onEdit,
  onSaveProduct,
  onAddMovement,
  onArchiveToggle,
  onDeleteProduct,
}) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [adjustBatchId, setAdjustBatchId] = useState<string | null>(null);
  const [adjustDelta, setAdjustDelta] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState('Routine shelf cycle recount');

  if (!isOpen || !product) return null;

  const totalStock = getProductTotalStock(product);
  const fefoBatches = getFEFOSortedBatches(product.batches || []);
  const isLowStock = totalStock <= product.minStockLevel && product.minStockLevel > 0;

  const handleQuickAdjust = (batch: ProductBatch, delta: number) => {
    const newQty = Math.max(0, batch.quantity + delta);
    if (newQty === batch.quantity) return;

    playBarcodeBeep();
    const updatedBatches = (product.batches || []).map(b => 
      b.id === batch.id ? { ...b, quantity: newQty } : b
    );

    const prevStock = totalStock;
    const newTotal = prevStock + delta;

    const updatedProduct = {
      ...product,
      batches: updatedBatches,
    };

    onSaveProduct(updatedProduct);

    // Record stock movement audit
    const movement: StockMovement = {
      id: 'mov-' + Date.now(),
      productId: product.id,
      productName: product.name,
      batchId: batch.id,
      batchNumber: batch.batchNumber,
      type: delta > 0 ? 'stock_in' : 'stock_out',
      quantity: delta,
      previousStock: prevStock,
      newStock: newTotal,
      reason: delta > 0 ? 'Quick stock replenishment' : 'Dispensed / Sale check-out',
      staffName: 'Store Employee',
      timestamp: new Date().toISOString(),
    };
    onAddMovement(movement);
  };

  const handleQuarantineExpired = (batch: ProductBatch) => {
    if (confirm(`Quarantine & write-off batch ${batch.batchNumber} (${batch.quantity} units)?`)) {
      const prevStock = totalStock;
      const qtyToRemove = batch.quantity;
      const updatedBatches = (product.batches || []).map(b => 
        b.id === batch.id ? { ...b, quantity: 0, notes: 'Quarantined & written off' } : b
      );

      const updatedProduct = {
        ...product,
        batches: updatedBatches,
      };

      onSaveProduct(updatedProduct);

      onAddMovement({
        id: 'mov-exp-' + Date.now(),
        productId: product.id,
        productName: product.name,
        batchId: batch.id,
        batchNumber: batch.batchNumber,
        type: 'expired_writeoff',
        quantity: -qtyToRemove,
        previousStock: prevStock,
        newStock: prevStock - qtyToRemove,
        reason: 'Expired batch quarantined and written off for store credit / disposal',
        staffName: 'Inventory Supervisor',
        timestamp: new Date().toISOString(),
      });
      playSuccessChime();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl rounded-2xl bg-slate-900 border border-slate-700/80 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header with Title and Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-2xl flex-shrink-0">
              {product.image || '📦'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white leading-tight">{product.name}</h2>
                {product.isArchived && (
                  <span className="px-2 py-0.5 rounded text-[10px] bg-slate-700 text-slate-300 font-semibold">
                    Archived
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 font-mono">
                SKU: {product.sku} {product.barcode && `• Barcode: ${product.barcode}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onEdit(product)}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
              title="Edit Product"
            >
              <Edit className="w-4 h-4" />
            </button>
            <button
              onClick={() => onArchiveToggle(product)}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
              title={product.isArchived ? 'Restore Product' : 'Archive Product'}
            >
              {product.isArchived ? <ArchiveRestore className="w-4 h-4 text-emerald-400" /> : <Archive className="w-4 h-4 text-amber-400" />}
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="p-2 rounded-xl bg-slate-800 hover:bg-rose-900/50 text-slate-400 hover:text-rose-400 border border-slate-700 transition"
              title="Delete Product"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto p-6 space-y-6 flex-1 text-xs">
          {/* Key Product Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Total Stock</span>
              <div className="text-lg font-black text-white mt-0.5">{totalStock} Units</div>
              {isLowStock && (
                <div className="text-[10px] text-rose-400 font-semibold mt-0.5">Below Min ({product.minStockLevel})</div>
              )}
            </div>

            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Retail Selling Price</span>
              <div className="text-lg font-bold text-emerald-400 mt-0.5">${product.sellingPrice?.toFixed(2)}</div>
              <div className="text-[10px] text-slate-500">Cost: ${product.purchasePrice?.toFixed(2)}</div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Category</span>
              <div className="text-xs font-bold text-white mt-1 truncate">{product.category}</div>
              <div className="text-[10px] text-slate-400 truncate">{product.brand || 'Store Brand'}</div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Storage Shelf</span>
              <div className="text-xs font-bold text-slate-200 mt-1 truncate">{product.location}</div>
              <div className="text-[10px] text-slate-400 truncate">Vendor: {product.supplier || 'N/A'}</div>
            </div>
          </div>

          {/* Barcode Graphic Visualization */}
          {product.barcode && (
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">UPC / EAN Barcode</span>
                <span className="text-sm font-mono font-bold text-emerald-400">{product.barcode}</span>
              </div>
              {/* Synthetic barcode lines */}
              <div className="flex items-center gap-0.5 bg-white p-2 rounded">
                {[4, 2, 6, 2, 3, 5, 2, 4, 2, 7, 3, 2, 5, 2, 6].map((w, i) => (
                  <span key={i} style={{ width: `${w}px` }} className="h-6 bg-black inline-block" />
                ))}
              </div>
            </div>
          )}

          {/* Batches and Expiry Table with FEFO Priority */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Active Batches &amp; Expiry Dates
                  </h3>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold border border-emerald-500/30 flex items-center gap-1">
                    <Zap className="w-3 h-3" /> FEFO Sorted
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Batches sorted with earliest expiring items first for supermarket stock rotation.
                </p>
              </div>
            </div>

            <div className="space-y-2.5">
              {fefoBatches.map((batch, index) => {
                const daysRemaining = calculateDaysRemaining(batch.expiryDate);
                const status = getExpiryStatus(daysRemaining);
                const cfg = getExpiryStatusConfig(status);
                const isFirstPick = index === 0 && batch.quantity > 0;

                return (
                  <div
                    key={batch.id}
                    className={`p-3.5 rounded-xl border ${cfg.borderColor} bg-slate-950/50 hover:bg-slate-900 transition relative overflow-hidden`}
                  >
                    {isFirstPick && (
                      <div className="absolute top-0 right-0 bg-emerald-600 text-white text-[9px] font-black uppercase px-2 py-0.5 rounded-bl-lg tracking-wider">
                        ★ FEFO Recommended Next Pick
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-white text-sm">{batch.batchNumber}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${cfg.badgeBg} ${cfg.badgeText}`}>
                            {formatExpiryRelative(daysRemaining)}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1">
                          <span>Expiry: <strong className="text-slate-200 font-mono">{batch.expiryDate}</strong></span>
                          <span>•</span>
                          <span>Mfg: {batch.mfgDate || 'N/A'}</span>
                          {batch.location && (
                            <>
                              <span>•</span>
                              <span>{batch.location}</span>
                            </>
                          )}
                        </div>
                        {batch.notes && (
                          <div className="text-[10px] text-amber-300/80 mt-1 italic">{batch.notes}</div>
                        )}
                      </div>

                      {/* Stock Adjuster / Action */}
                      <div className="flex items-center gap-3 flex-wrap">
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 uppercase block">Units in Batch</span>
                          <span className="text-base font-black text-white">{batch.quantity}</span>
                        </div>

                        {/* Quick +/- buttons */}
                        <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-xl border border-slate-700">
                          <button
                            type="button"
                            onClick={() => handleQuickAdjust(batch, -1)}
                            disabled={batch.quantity <= 0}
                            className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-slate-200 transition"
                            title="Stock Out 1 unit"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleQuickAdjust(batch, +1)}
                            className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 transition"
                            title="Stock In 1 unit"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Quarantine expired button */}
                        {status === 'expired' && batch.quantity > 0 && (
                          <button
                            type="button"
                            onClick={() => handleQuarantineExpired(batch)}
                            className="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-[10px] flex items-center gap-1 transition"
                          >
                            <ShieldAlert className="w-3.5 h-3.5" />
                            <span>Quarantine</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Delete Confirmation Safeguard Modal */}
        {showDeleteConfirm && (
          <div className="absolute inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-6 text-center animate-in fade-in">
            <div className="max-w-sm rounded-2xl bg-slate-900 border border-rose-500/40 p-6 space-y-4 shadow-2xl">
              <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 mx-auto flex items-center justify-center">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white">Permanently Delete Product?</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Are you sure you want to delete <strong className="text-white">{product.name}</strong> ({product.sku}) and all associated batches? To preserve records, consider <strong>Archiving</strong> instead.
              </p>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onDeleteProduct(product.id);
                    setShowDeleteConfirm(false);
                    onClose();
                  }}
                  className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold transition"
                >
                  Confirm Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
