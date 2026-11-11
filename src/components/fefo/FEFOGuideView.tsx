import React, { useState } from 'react';
import { 
  Zap, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  ArrowRight, 
  Package, 
  Minus, 
  Plus, 
  Barcode, 
  ShieldCheck,
  TrendingUp,
  MapPin
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

interface FEFOGuideViewProps {
  products: Product[];
  onSaveProduct: (product: Product) => void;
  onAddMovement: (movement: StockMovement) => void;
  onOpenScanner: () => void;
}

export const FEFOGuideView: React.FC<FEFOGuideViewProps> = ({
  products,
  onSaveProduct,
  onAddMovement,
  onOpenScanner,
}) => {
  const activeProducts = products.filter(p => !p.isArchived);
  const [selectedProductId, setSelectedProductId] = useState<string>(activeProducts[0]?.id || '');
  const [dispenseQty, setDispenseQty] = useState<number>(1);
  const [feedback, setFeedback] = useState<string | null>(null);

  const selectedProduct = activeProducts.find(p => p.id === selectedProductId);
  const fefoBatches = selectedProduct ? getFEFOSortedBatches(selectedProduct.batches || []) : [];
  const recommendedBatch = fefoBatches.find(b => b.quantity > 0);

  const handleDispenseFEFO = () => {
    if (!selectedProduct || !recommendedBatch) return;

    if (recommendedBatch.quantity < dispenseQty) {
      alert(`Batch only has ${recommendedBatch.quantity} units available.`);
      return;
    }

    playBarcodeBeep();
    const prevStock = getProductTotalStock(selectedProduct);
    const updatedBatches = selectedProduct.batches.map(b => 
      b.id === recommendedBatch.id ? { ...b, quantity: b.quantity - dispenseQty } : b
    );

    const updatedProduct = {
      ...selectedProduct,
      batches: updatedBatches,
    };
    onSaveProduct(updatedProduct);

    onAddMovement({
      id: 'mov-fefo-' + Date.now(),
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      batchId: recommendedBatch.id,
      batchNumber: recommendedBatch.batchNumber,
      type: 'stock_out',
      quantity: -dispenseQty,
      previousStock: prevStock,
      newStock: prevStock - dispenseQty,
      reason: `FEFO Automated Dispensing (Oldest Expiry: ${recommendedBatch.expiryDate})`,
      staffName: 'FEFO Shelf Stocker',
      timestamp: new Date().toISOString(),
    });

    playSuccessChime();
    setFeedback(`Dispensed ${dispenseQty} unit(s) from recommended batch ${recommendedBatch.batchNumber}.`);
    setTimeout(() => setFeedback(null), 4000);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-emerald-950 via-slate-900 to-indigo-950 border border-emerald-500/30 p-5 sm:p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400 mb-1">
              <Zap className="w-4 h-4" />
              <span>First-Expiry-First-Out (FEFO) Engine</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Supermarket Stock Rotation Assistant
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl">
              Prevents stock spoilage by ensuring products with earliest expiry dates are placed in front of supermarket shelves and sold first.
            </p>
          </div>

          <button
            onClick={onOpenScanner}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 text-xs font-bold shadow transition active:scale-95 self-start sm:self-auto"
          >
            <Barcode className="w-4 h-4 text-emerald-400" />
            <span>Scan Shelf Barcode</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div className="p-3.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-2 animate-in zoom-in-95">
          <CheckCircle2 className="w-4 h-4" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Product Selector Bar */}
      <div className="glass-card rounded-2xl p-4 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 flex-1">
          <span className="font-semibold text-slate-300 whitespace-nowrap">Select Product for FEFO:</span>
          <select
            value={selectedProductId}
            onChange={e => setSelectedProductId(e.target.value)}
            className="w-full sm:max-w-md rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
          >
            {activeProducts.map(p => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.batches?.length || 0} batches • {getProductTotalStock(p)} units)
              </option>
            ))}
          </select>
        </div>

        {selectedProduct && (
          <div className="flex items-center gap-3 text-slate-300 bg-slate-900/60 px-3 py-1.5 rounded-xl border border-slate-800">
            <MapPin className="w-4 h-4 text-emerald-400" />
            <span>Shelf: <strong>{selectedProduct.location}</strong></span>
          </div>
        )}
      </div>

      {selectedProduct && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main FEFO Recommendation Box */}
          <div className="lg:col-span-1 glass-card rounded-2xl p-5 border border-emerald-500/40 bg-gradient-to-b from-emerald-950/20 to-slate-900 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-500/15 px-2.5 py-1 rounded-full border border-emerald-500/30">
                  Recommended Pick (Front Facing)
                </span>
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
              </div>

              {recommendedBatch ? (
                <>
                  <div className="mt-2">
                    <h3 className="text-xl font-black text-white">{selectedProduct.name}</h3>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">
                      Batch #{recommendedBatch.batchNumber}
                    </p>
                  </div>

                  <div className="mt-4 p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400">Expiration Date:</span>
                      <span className="font-mono font-bold text-amber-400 text-sm">{recommendedBatch.expiryDate}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400">Shelf Life Left:</span>
                      <span className="font-bold text-white">
                        {formatExpiryRelative(calculateDaysRemaining(recommendedBatch.expiryDate))}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400">Available in Batch:</span>
                      <span className="font-black text-emerald-400 text-base">{recommendedBatch.quantity} Units</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400">Store Shelf:</span>
                      <span className="font-semibold text-slate-200">{recommendedBatch.location || selectedProduct.location}</span>
                    </div>
                  </div>

                  {/* Rotation rule banner */}
                  <div className="mt-4 p-3 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-slate-300 space-y-1">
                    <strong className="text-white block font-semibold">Stocker Protocol:</strong>
                    <p>
                      Pull this batch to the front of the shelf display. Push newer batches behind it.
                    </p>
                  </div>
                </>
              ) : (
                <div className="p-6 text-center text-slate-400 text-xs">
                  No active stock in any batch. Restock required.
                </div>
              )}
            </div>

            {recommendedBatch && (
              <div className="mt-6 pt-4 border-t border-slate-800 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300 font-semibold">Dispense / Sell Quantity:</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setDispenseQty(Math.max(1, dispenseQty - 1))}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="font-bold text-white px-2 text-sm">{dispenseQty}</span>
                    <button
                      type="button"
                      onClick={() => setDispenseQty(Math.min(recommendedBatch.quantity, dispenseQty + 1))}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleDispenseFEFO}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-lg shadow-emerald-950/50 transition active:scale-95 flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Dispense from Recommended Batch</span>
                </button>
              </div>
            )}
          </div>

          {/* Batch Timeline & Comparison */}
          <div className="lg:col-span-2 glass-card rounded-2xl p-5 border border-slate-800 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-white">Batch Expiry Timeline &amp; Shelf Rotation</h3>
                  <p className="text-xs text-slate-400">Chronological shelf life order from earliest to newest</p>
                </div>
                <span className="text-xs text-slate-400 bg-slate-800 px-2.5 py-1 rounded-lg">
                  {fefoBatches.length} Batches Total
                </span>
              </div>

              {/* Timeline Sequence */}
              <div className="space-y-3">
                {fefoBatches.map((batch, idx) => {
                  const daysRemaining = calculateDaysRemaining(batch.expiryDate);
                  const status = getExpiryStatus(daysRemaining);
                  const cfg = getExpiryStatusConfig(status);
                  const isCurrentPick = batch.id === recommendedBatch?.id;

                  return (
                    <div
                      key={batch.id}
                      className={`p-3.5 rounded-xl border ${
                        isCurrentPick ? 'border-emerald-500/80 bg-emerald-950/20' : 'border-slate-800 bg-slate-900/50'
                      } text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black ${
                          isCurrentPick ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-300'
                        }`}>
                          {idx + 1}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-white">{batch.batchNumber}</span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${cfg.badgeBg} ${cfg.badgeText}`}>
                              {formatExpiryRelative(daysRemaining)}
                            </span>
                            {isCurrentPick && (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[9px] font-bold">
                                FRONT OF SHELF
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-3">
                            <span>Expiry: <strong className="text-slate-200 font-mono">{batch.expiryDate}</strong></span>
                            <span>•</span>
                            <span>Mfg: {batch.mfgDate || 'N/A'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 self-end sm:self-center">
                        <div className="text-right">
                          <span className="text-[10px] text-slate-500 block uppercase">Stock</span>
                          <span className="text-base font-bold text-white">{batch.quantity}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Rotation Verification Warning */}
            <div className="mt-6 p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex items-start gap-3 text-xs text-slate-300">
              <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <strong className="text-white block font-semibold">Inventory Auditor Tip:</strong>
                <p className="mt-0.5 text-slate-400 leading-relaxed">
                  Always inspect physical display shelves. If batch #{fefoBatches[1]?.batchNumber} is sitting in front of batch #{fefoBatches[0]?.batchNumber}, rotate the older batch to the front immediately to protect shelf freshness.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
