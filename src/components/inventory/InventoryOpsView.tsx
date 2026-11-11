import React, { useState } from 'react';
import { 
  ArrowDownLeft, 
  ArrowUpRight, 
  RotateCcw, 
  AlertOctagon, 
  ShieldAlert, 
  History, 
  Download, 
  Plus, 
  CheckCircle2, 
  AlertTriangle,
  User,
  FileText
} from 'lucide-react';
import { MovementType, Product, ProductBatch, StockMovement } from '../../types/inventory';
import { exportToCSV } from '../../utils/export';
import { getProductTotalStock, getTodayDateString } from '../../utils/expiry';
import { playBarcodeBeep, playSuccessChime } from '../../utils/audioAlert';

interface InventoryOpsViewProps {
  products: Product[];
  movements: StockMovement[];
  onSaveProduct: (product: Product) => void;
  onAddMovement: (movement: StockMovement) => void;
}

export const InventoryOpsView: React.FC<InventoryOpsViewProps> = ({
  products,
  movements,
  onSaveProduct,
  onAddMovement,
}) => {
  const activeProducts = products.filter(p => !p.isArchived);
  const todayStr = getTodayDateString();

  const [selectedProductId, setSelectedProductId] = useState<string>(activeProducts[0]?.id || '');
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [movementType, setMovementType] = useState<MovementType>('stock_in');
  const [quantity, setQuantity] = useState<number>(10);
  const [reason, setReason] = useState<string>('');
  const [staffName, setStaffName] = useState<string>('Floor Associate');
  const [referenceDoc, setReferenceDoc] = useState<string>('');

  // For Stock In creating a new batch
  const [isNewBatch, setIsNewBatch] = useState(false);
  const [newBatchNumber, setNewBatchNumber] = useState('LOT-' + Math.floor(1000 + Math.random() * 9000));
  const [newBatchExpiry, setNewBatchExpiry] = useState(new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]);

  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; error?: boolean } | null>(null);

  const selectedProduct = activeProducts.find(p => p.id === selectedProductId);
  const availableBatches = selectedProduct?.batches || [];

  const handleExecuteMovement = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedbackMsg(null);

    if (!selectedProduct) {
      setFeedbackMsg({ text: 'Please select a product.', error: true });
      return;
    }

    if (quantity <= 0) {
      setFeedbackMsg({ text: 'Quantity must be greater than 0.', error: true });
      return;
    }

    const prevStock = getProductTotalStock(selectedProduct);
    let updatedBatches = [...(selectedProduct.batches || [])];
    let targetBatchNumber = '';

    if (movementType === 'stock_in') {
      if (isNewBatch) {
        if (!newBatchNumber.trim()) {
          setFeedbackMsg({ text: 'Please enter a batch/lot number.', error: true });
          return;
        }
        const newBatch: ProductBatch = {
          id: 'batch-' + Math.random().toString(36).substring(2, 8),
          productId: selectedProduct.id,
          batchNumber: newBatchNumber.trim().toUpperCase(),
          quantity: quantity,
          mfgDate: todayStr,
          expiryDate: newBatchExpiry,
          receivedDate: todayStr,
          location: selectedProduct.location,
        };
        updatedBatches.push(newBatch);
        targetBatchNumber = newBatch.batchNumber;
      } else {
        const batch = updatedBatches.find(b => b.id === (selectedBatchId || updatedBatches[0]?.id));
        if (batch) {
          batch.quantity += quantity;
          targetBatchNumber = batch.batchNumber;
        } else {
          setFeedbackMsg({ text: 'Please select an existing batch.', error: true });
          return;
        }
      }
    } else {
      // Stock Out, Damaged, Expired Writeoff, or Adjustment
      const batch = updatedBatches.find(b => b.id === (selectedBatchId || updatedBatches[0]?.id));
      if (!batch) {
        setFeedbackMsg({ text: 'Please select a batch to modify.', error: true });
        return;
      }
      targetBatchNumber = batch.batchNumber;

      if (movementType === 'adjustment') {
        // Direct set or recount adjustment
        batch.quantity = quantity;
      } else {
        // Stock out, damaged, or expired
        if (batch.quantity < quantity) {
          setFeedbackMsg({
            text: `Cannot remove ${quantity} units. Batch ${batch.batchNumber} only has ${batch.quantity} available. Negative stock is prevented.`,
            error: true,
          });
          return;
        }
        batch.quantity -= quantity;
      }
    }

    // Save product
    const updatedProd: Product = {
      ...selectedProduct,
      batches: updatedBatches,
    };
    onSaveProduct(updatedProd);

    // Compute delta for audit log
    const newStock = getProductTotalStock(updatedProd);
    const delta = newStock - prevStock;

    const newMovement: StockMovement = {
      id: 'mov-' + Date.now(),
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      batchId: selectedBatchId || updatedBatches[0]?.id,
      batchNumber: targetBatchNumber,
      type: movementType,
      quantity: delta,
      previousStock: prevStock,
      newStock: newStock,
      reason: reason.trim() || getDefaultReason(movementType),
      staffName: staffName.trim() || 'Store Clerk',
      timestamp: new Date().toISOString(),
      referenceDoc: referenceDoc.trim() || undefined,
    };

    onAddMovement(newMovement);
    playSuccessChime();
    setFeedbackMsg({ text: `Successfully processed ${movementType.replace('_', ' ')} (${delta > 0 ? '+' : ''}${delta} units).` });

    // Reset inputs
    setQuantity(5);
    setReason('');
    setReferenceDoc('');
    setNewBatchNumber('LOT-' + Math.floor(1000 + Math.random() * 9000));
  };

  const getDefaultReason = (type: MovementType): string => {
    switch (type) {
      case 'stock_in': return 'Shipment received and added to inventory';
      case 'stock_out': return 'Customer sale / stock depletion';
      case 'adjustment': return 'Inventory physical recount adjustment';
      case 'damaged': return 'Damaged product scrapped and logged';
      case 'expired_writeoff': return 'Quarantined expired stock write-off';
      case 'return': return 'Return to vendor or restocked customer return';
    }
  };

  const handleExportHistoryCSV = () => {
    const headers = [
      'Timestamp',
      'Product Name',
      'Batch Number',
      'Movement Type',
      'Quantity Change',
      'Previous Stock',
      'New Stock',
      'Reason',
      'Staff',
      'Reference Doc',
    ];
    const rows = movements.map(m => [
      new Date(m.timestamp).toLocaleString(),
      m.productName,
      m.batchNumber || 'N/A',
      m.type,
      m.quantity,
      m.previousStock,
      m.newStock,
      m.reason,
      m.staffName,
      m.referenceDoc || '',
    ]);
    exportToCSV('ShelfGuard_Stock_Movement_History', headers, rows);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white">Inventory Control &amp; Stock Operations</h2>
          <p className="text-xs text-slate-400">
            Process stock in, store checkout, cycle adjustments, damaged write-offs, and expired stock.
          </p>
        </div>
        <button
          onClick={handleExportHistoryCSV}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition"
        >
          <Download className="w-4 h-4 text-emerald-400" />
          <span>Export Movement Audit CSV</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Panel: Record Stock Action */}
        <div className="lg:col-span-1 glass-card rounded-2xl p-5 border border-slate-800">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
              <Plus className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-white">Record Stock Transaction</h3>
          </div>

          {feedbackMsg && (
            <div
              className={`p-3 rounded-xl mb-4 text-xs flex items-center gap-2 ${
                feedbackMsg.error
                  ? 'bg-rose-500/15 border border-rose-500/30 text-rose-300'
                  : 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
              }`}
            >
              {feedbackMsg.error ? <AlertTriangle className="w-4 h-4 flex-shrink-0" /> : <CheckCircle2 className="w-4 h-4 flex-shrink-0" />}
              <span>{feedbackMsg.text}</span>
            </div>
          )}

          <form onSubmit={handleExecuteMovement} className="space-y-4 text-xs">
            {/* Operation Type Selector Buttons */}
            <div>
              <label className="block font-semibold text-slate-300 mb-1.5">Action Type</label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setMovementType('stock_in')}
                  className={`p-2 rounded-xl border text-left flex items-center gap-2 transition ${
                    movementType === 'stock_in'
                      ? 'bg-emerald-600 border-emerald-500 text-white font-bold'
                      : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <ArrowDownLeft className="w-4 h-4 text-emerald-300" />
                  <span>Stock In (+)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMovementType('stock_out')}
                  className={`p-2 rounded-xl border text-left flex items-center gap-2 transition ${
                    movementType === 'stock_out'
                      ? 'bg-blue-600 border-blue-500 text-white font-bold'
                      : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <ArrowUpRight className="w-4 h-4 text-blue-300" />
                  <span>Stock Out (-)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMovementType('damaged')}
                  className={`p-2 rounded-xl border text-left flex items-center gap-2 transition ${
                    movementType === 'damaged'
                      ? 'bg-amber-600 border-amber-500 text-white font-bold'
                      : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <AlertOctagon className="w-4 h-4 text-amber-300" />
                  <span>Damaged</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMovementType('expired_writeoff')}
                  className={`p-2 rounded-xl border text-left flex items-center gap-2 transition ${
                    movementType === 'expired_writeoff'
                      ? 'bg-rose-600 border-rose-500 text-white font-bold'
                      : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <ShieldAlert className="w-4 h-4 text-rose-300" />
                  <span>Expired Stock</span>
                </button>
              </div>
            </div>

            {/* Select Product */}
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Product</label>
              <select
                value={selectedProductId}
                onChange={e => {
                  setSelectedProductId(e.target.value);
                  setSelectedBatchId('');
                }}
                className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
              >
                {activeProducts.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({getProductTotalStock(p)} in stock)
                  </option>
                ))}
              </select>
            </div>

            {/* Batch Selector or New Batch Toggle */}
            {movementType === 'stock_in' ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-slate-300">Batch Assignment</label>
                  <button
                    type="button"
                    onClick={() => setIsNewBatch(!isNewBatch)}
                    className="text-[11px] text-emerald-400 hover:underline font-semibold"
                  >
                    {isNewBatch ? 'Use Existing Batch' : '+ Receive New Batch'}
                  </button>
                </div>

                {isNewBatch ? (
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                    <div>
                      <span className="text-[10px] text-slate-400 block mb-0.5">New Lot / Batch #</span>
                      <input
                        type="text"
                        value={newBatchNumber}
                        onChange={e => setNewBatchNumber(e.target.value)}
                        className="w-full rounded-lg bg-slate-800 border border-slate-700 px-2 py-1.5 text-slate-100 font-mono text-xs focus:outline-none"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-amber-400 block mb-0.5 font-bold">Expiration Date</span>
                      <input
                        type="date"
                        value={newBatchExpiry}
                        onChange={e => setNewBatchExpiry(e.target.value)}
                        className="w-full rounded-lg bg-slate-800 border border-slate-700 px-2 py-1.5 text-slate-100 text-xs focus:outline-none"
                      />
                    </div>
                  </div>
                ) : (
                  <select
                    value={selectedBatchId}
                    onChange={e => setSelectedBatchId(e.target.value)}
                    className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                  >
                    {availableBatches.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.batchNumber} (Expires: {b.expiryDate} • Qty: {b.quantity})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            ) : (
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Select Batch</label>
                <select
                  value={selectedBatchId}
                  onChange={e => setSelectedBatchId(e.target.value)}
                  className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                >
                  {availableBatches.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.batchNumber} (Expires: {b.expiryDate} • Qty: {b.quantity})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Quantity */}
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Quantity (Units)</label>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={e => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-slate-100 font-bold focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Reason */}
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Reason / Notes</label>
              <input
                type="text"
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder={getDefaultReason(movementType)}
                className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Staff & Reference Doc */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Staff Clerk</label>
                <input
                  type="text"
                  value={staffName}
                  onChange={e => setStaffName(e.target.value)}
                  className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Doc / PO # (Opt)</label>
                <input
                  type="text"
                  value={referenceDoc}
                  onChange={e => setReferenceDoc(e.target.value)}
                  placeholder="e.g. PO-9912"
                  className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-lg shadow-emerald-950/50 transition active:scale-95"
            >
              Post Stock Movement
            </button>
          </form>
        </div>

        {/* Audit Log Table: Live Stock Movements */}
        <div className="lg:col-span-2 glass-card rounded-2xl p-5 border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400">
                  <History className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Stock Movement Audit History</h3>
                  <p className="text-xs text-slate-400">Live ledger of all supermarket stock activities</p>
                </div>
              </div>

              <span className="text-xs text-slate-400 bg-slate-800 px-2.5 py-1 rounded-lg">
                {movements.length} logged events
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/60 text-slate-400 font-semibold border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Date &amp; Time</th>
                    <th className="py-2.5 px-3">Product</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3 text-right">Delta</th>
                    <th className="py-2.5 px-3 text-right">Balance</th>
                    <th className="py-2.5 px-3">Reason / Staff</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {movements.slice(0, 15).map(mov => {
                    let badgeClass = 'bg-slate-800 text-slate-300';
                    if (mov.type === 'stock_in') badgeClass = 'bg-emerald-500/15 text-emerald-400';
                    else if (mov.type === 'stock_out') badgeClass = 'bg-blue-500/15 text-blue-400';
                    else if (mov.type === 'damaged') badgeClass = 'bg-amber-500/15 text-amber-400';
                    else if (mov.type === 'expired_writeoff') badgeClass = 'bg-rose-500/15 text-rose-400';

                    const isPositive = mov.quantity > 0;

                    return (
                      <tr key={mov.id} className="hover:bg-slate-800/40 transition">
                        <td className="py-2 px-3 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                          {new Date(mov.timestamp).toLocaleDateString()} {new Date(mov.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="py-2 px-3">
                          <div className="font-semibold text-white truncate max-w-[140px] sm:max-w-[180px]">{mov.productName}</div>
                          {mov.batchNumber && (
                            <div className="text-[10px] text-slate-500 font-mono">{mov.batchNumber}</div>
                          )}
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${badgeClass}`}>
                            {mov.type.replace('_', ' ')}
                          </span>
                        </td>
                        <td className={`py-2 px-3 text-right font-black font-mono ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {isPositive ? `+${mov.quantity}` : mov.quantity}
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-white font-mono">
                          {mov.newStock}
                        </td>
                        <td className="py-2 px-3">
                          <div className="truncate max-w-[150px] sm:max-w-[200px] text-slate-300" title={mov.reason}>
                            {mov.reason}
                          </div>
                          <div className="text-[10px] text-slate-500">{mov.staffName}</div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
