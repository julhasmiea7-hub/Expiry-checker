import React, { useState } from 'react';
import { X, Plus, Trash2, Barcode, Calendar, MapPin, DollarSign, Package, AlertCircle } from 'lucide-react';
import { Product, ProductBatch } from '../../types/inventory';
import { INITIAL_CATEGORIES, INITIAL_LOCATIONS } from '../../db/indexedDB';
import { getTodayDateString } from '../../utils/expiry';

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (product: Product) => void;
  productToEdit?: Product | null;
}

const EMOJI_PRESETS = ['🥛', '🥣', '🍞', '🥐', '🐟', '🥩', '🥗', '🥚', '🥫', '🍾', '🧀', '🍎', '🍗', '🍫', '🧃', '🧼'];

export const ProductModal: React.FC<ProductModalProps> = ({
  isOpen,
  onClose,
  onSave,
  productToEdit,
}) => {
  const isEditing = Boolean(productToEdit);
  const todayStr = getTodayDateString();

  const [name, setName] = useState(productToEdit?.name || '');
  const [sku, setSku] = useState(productToEdit?.sku || '');
  const [barcode, setBarcode] = useState(productToEdit?.barcode || '');
  const [category, setCategory] = useState(productToEdit?.category || INITIAL_CATEGORIES[0]);
  const [brand, setBrand] = useState(productToEdit?.brand || '');
  const [supplier, setSupplier] = useState(productToEdit?.supplier || '');
  const [purchasePrice, setPurchasePrice] = useState(productToEdit?.purchasePrice?.toString() || '0.00');
  const [sellingPrice, setSellingPrice] = useState(productToEdit?.sellingPrice?.toString() || '0.00');
  const [minStockLevel, setMinStockLevel] = useState(productToEdit?.minStockLevel?.toString() || '10');
  const [location, setLocation] = useState(productToEdit?.location || INITIAL_LOCATIONS[0]);
  const [image, setImage] = useState(productToEdit?.image || '📦');
  const [notes, setNotes] = useState(productToEdit?.notes || '');

  // Batches
  const [batches, setBatches] = useState<ProductBatch[]>(
    productToEdit?.batches && productToEdit.batches.length > 0
      ? productToEdit.batches
      : [
          {
            id: 'batch-' + Math.random().toString(36).substring(2, 8),
            productId: productToEdit?.id || '',
            batchNumber: 'LOT-' + Math.floor(1000 + Math.random() * 9000),
            quantity: 20,
            mfgDate: todayStr,
            expiryDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
            receivedDate: todayStr,
            location: productToEdit?.location || INITIAL_LOCATIONS[0],
          },
        ]
  );

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleGenerateSKU = () => {
    const catPrefix = (category.substring(0, 3) || 'PRD').toUpperCase();
    const randNum = Math.floor(100 + Math.random() * 900);
    setSku(`${catPrefix}-${randNum}`);
  };

  const handleGenerateBarcode = () => {
    const randomEAN = '0712' + Math.floor(10000000 + Math.random() * 90000000).toString().substring(0, 8);
    setBarcode(randomEAN);
  };

  const handleAddBatch = () => {
    const newBatch: ProductBatch = {
      id: 'batch-' + Math.random().toString(36).substring(2, 8),
      productId: productToEdit?.id || '',
      batchNumber: 'LOT-' + Math.floor(1000 + Math.random() * 9000),
      quantity: 12,
      mfgDate: todayStr,
      expiryDate: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
      receivedDate: todayStr,
      location: location,
    };
    setBatches([...batches, newBatch]);
  };

  const handleUpdateBatch = (index: number, field: keyof ProductBatch, value: any) => {
    const updated = [...batches];
    updated[index] = { ...updated[index], [field]: value };
    setBatches(updated);
  };

  const handleRemoveBatch = (index: number) => {
    if (batches.length <= 1) {
      alert('A product must have at least one batch. Set quantity to 0 if out of stock.');
      return;
    }
    setBatches(batches.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!name.trim()) {
      setErrorMessage('Product Name is required.');
      return;
    }
    if (!sku.trim()) {
      setErrorMessage('Product Code / SKU is required.');
      return;
    }

    const prodId = productToEdit?.id || 'prod-' + Date.now();
    const finalBatches = batches.map(b => ({
      ...b,
      productId: prodId,
      quantity: Math.max(0, Number(b.quantity) || 0),
    }));

    const newProd: Product = {
      id: prodId,
      name: name.trim(),
      sku: sku.trim().toUpperCase(),
      barcode: barcode.trim() || undefined,
      category,
      brand: brand.trim(),
      supplier: supplier.trim(),
      purchasePrice: Number(purchasePrice) || 0,
      sellingPrice: Number(sellingPrice) || 0,
      minStockLevel: Math.max(0, Number(minStockLevel) || 0),
      location,
      image,
      notes: notes.trim(),
      isArchived: productToEdit?.isArchived || false,
      createdAt: productToEdit?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      batches: finalBatches,
    };

    onSave(newProd);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl rounded-2xl bg-slate-900 border border-slate-700/80 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                {isEditing ? 'Edit Product & Batches' : 'Add New Supermarket Product'}
              </h2>
              <p className="text-xs text-slate-400">Configure catalog information and expiry batches</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-6 flex-1 text-xs">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Section 1: Basic Information */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-1">
              1. Basic Information
            </h3>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">
                Product Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Organic Whole Milk 1 Gallon"
                required
                className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Icon / Emoji selector */}
            <div>
              <label className="block font-semibold text-slate-300 mb-1">
                Product Icon / Visual Tag
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                {EMOJI_PRESETS.map(emoji => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setImage(emoji)}
                    className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg transition ${
                      image === emoji ? 'bg-emerald-600 scale-110 shadow-lg' : 'bg-slate-800 hover:bg-slate-700'
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* SKU */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-slate-300">
                    Product Code / SKU <span className="text-rose-400">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleGenerateSKU}
                    className="text-[10px] text-emerald-400 hover:underline"
                  >
                    Auto-Generate
                  </button>
                </div>
                <input
                  type="text"
                  value={sku}
                  onChange={e => setSku(e.target.value)}
                  placeholder="e.g. DAI-MLK-001"
                  required
                  className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Barcode */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-slate-300">Barcode (UPC / EAN)</label>
                  <button
                    type="button"
                    onClick={handleGenerateBarcode}
                    className="text-[10px] text-emerald-400 hover:underline"
                  >
                    Generate Barcode
                  </button>
                </div>
                <input
                  type="text"
                  value={barcode}
                  onChange={e => setBarcode(e.target.value)}
                  placeholder="e.g. 071234500112"
                  className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Category */}
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Category</label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                >
                  {INITIAL_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Brand */}
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Brand</label>
                <input
                  type="text"
                  value={brand}
                  onChange={e => setBrand(e.target.value)}
                  placeholder="e.g. Clover Valley"
                  className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Supplier */}
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Supplier Name</label>
                <input
                  type="text"
                  value={supplier}
                  onChange={e => setSupplier(e.target.value)}
                  placeholder="e.g. Fresh Valley Dairies"
                  className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Pricing & Stock Location */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-1">
              2. Pricing, Storage &amp; Thresholds
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Purchase Price ($)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={purchasePrice}
                  onChange={e => setPurchasePrice(e.target.value)}
                  className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Selling Price ($)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={sellingPrice}
                  onChange={e => setSellingPrice(e.target.value)}
                  className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Min Stock Alert Level</label>
                <input
                  type="number"
                  min="0"
                  value={minStockLevel}
                  onChange={e => setMinStockLevel(e.target.value)}
                  className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Storage Location / Shelf Number</label>
                <select
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                >
                  {INITIAL_LOCATIONS.map(loc => (
                    <option key={loc} value={loc}>{loc}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Handling Notes</label>
                <input
                  type="text"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="e.g. Keep chilled under 38°F, do not stack"
                  className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Multi-Batch Management */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-1">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  3. Inventory Batches &amp; Expiry Dates
                </h3>
                <p className="text-[11px] text-slate-500">
                  Each batch has its own expiration date and lot number for FEFO tracking.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddBatch}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Another Batch</span>
              </button>
            </div>

            <div className="space-y-3">
              {batches.map((batch, index) => (
                <div
                  key={batch.id}
                  className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-emerald-400">Batch #{index + 1}</span>
                    {batches.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveBatch(index)}
                        className="text-slate-400 hover:text-rose-400 p-1 transition"
                        title="Remove Batch"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div>
                      <label className="block text-[10px] text-slate-400 font-medium mb-1">Batch / Lot #</label>
                      <input
                        type="text"
                        value={batch.batchNumber}
                        onChange={e => handleUpdateBatch(index, 'batchNumber', e.target.value)}
                        required
                        className="w-full rounded-lg bg-slate-800 border border-slate-700 px-2.5 py-1.5 text-slate-100 font-mono text-xs focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-400 font-medium mb-1">Units Quantity</label>
                      <input
                        type="number"
                        min="0"
                        value={batch.quantity}
                        onChange={e => handleUpdateBatch(index, 'quantity', e.target.value)}
                        required
                        className="w-full rounded-lg bg-slate-800 border border-slate-700 px-2.5 py-1.5 text-slate-100 text-xs font-bold focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-400 font-medium mb-1">Mfg Date</label>
                      <input
                        type="date"
                        value={batch.mfgDate}
                        onChange={e => handleUpdateBatch(index, 'mfgDate', e.target.value)}
                        className="w-full rounded-lg bg-slate-800 border border-slate-700 px-2 py-1.5 text-slate-100 text-xs focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-amber-400 font-bold mb-1">Expiry Date *</label>
                      <input
                        type="date"
                        value={batch.expiryDate}
                        onChange={e => handleUpdateBatch(index, 'expiryDate', e.target.value)}
                        required
                        className="w-full rounded-lg bg-slate-800 border border-amber-500/50 px-2 py-1.5 text-slate-100 text-xs font-semibold focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-lg shadow-emerald-950/50 transition active:scale-95"
            >
              {isEditing ? 'Save Product Changes' : 'Create Product Record'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
