import React, { useMemo, useState } from 'react';
import { 
  Search, 
  Filter, 
  ArrowUpDown, 
  Plus, 
  Barcode, 
  Layers, 
  AlertTriangle, 
  Clock, 
  ShieldAlert, 
  CheckCircle2, 
  ChevronRight,
  TrendingDown,
  Archive,
  Eye,
  SlidersHorizontal
} from 'lucide-react';
import { Product } from '../../types/inventory';
import { 
  calculateDaysRemaining, 
  formatExpiryRelative, 
  getExpiryStatus, 
  getExpiryStatusConfig, 
  getProductEarliestBatch, 
  getProductTotalStock 
} from '../../utils/expiry';

interface ProductListViewProps {
  products: Product[];
  activeFilter: string;
  onFilterChange: (filter: string) => void;
  onSelectProduct: (product: Product) => void;
  onOpenAddModal: () => void;
  onOpenScanner: () => void;
}

export const ProductListView: React.FC<ProductListViewProps> = ({
  products,
  activeFilter,
  onFilterChange,
  onSelectProduct,
  onOpenAddModal,
  onOpenScanner,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'expiry_asc' | 'expiry_desc' | 'name_asc' | 'name_desc' | 'stock_asc' | 'stock_desc'>('expiry_asc');

  // Available unique categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set).sort();
  }, [products]);

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      // Archive handling
      if (activeFilter === 'archived') {
        if (!product.isArchived) return false;
      } else {
        if (product.isArchived) return false;
      }

      // Category filter
      if (selectedCategory !== 'all' && product.category !== selectedCategory) {
        return false;
      }

      // Search query across name, sku, barcode, batch numbers, location
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = product.name.toLowerCase().includes(q);
        const skuMatch = product.sku.toLowerCase().includes(q);
        const barcodeMatch = product.barcode?.toLowerCase().includes(q);
        const locationMatch = product.location?.toLowerCase().includes(q);
        const brandMatch = product.brand?.toLowerCase().includes(q);
        const batchMatch = (product.batches || []).some(b => b.batchNumber.toLowerCase().includes(q));

        if (!nameMatch && !skuMatch && !barcodeMatch && !locationMatch && !brandMatch && !batchMatch) {
          return false;
        }
      }

      // Expiry / Stock status filters
      const totalStock = getProductTotalStock(product);
      const earliest = getProductEarliestBatch(product);
      const days = earliest.daysRemaining;

      switch (activeFilter) {
        case 'expired':
          return days < 0;
        case 'today':
          return days === 0;
        case '7days':
          return days >= 0 && days <= 6;
        case '15days':
          return days >= 0 && days <= 14;
        case '30days':
          return days >= 0 && days <= 30;
        case 'safe':
          return days > 30;
        case 'lowstock':
          return totalStock <= product.minStockLevel && product.minStockLevel > 0;
        case 'archived':
          return true;
        case 'all':
        default:
          return true;
      }
    }).sort((a, b) => {
      if (sortBy === 'expiry_asc' || sortBy === 'expiry_desc') {
        const aDays = getProductEarliestBatch(a).daysRemaining;
        const bDays = getProductEarliestBatch(b).daysRemaining;
        return sortBy === 'expiry_asc' ? aDays - bDays : bDays - aDays;
      }
      if (sortBy === 'name_asc') {
        return a.name.localeCompare(b.name);
      }
      if (sortBy === 'name_desc') {
        return b.name.localeCompare(a.name);
      }
      if (sortBy === 'stock_asc') {
        return getProductTotalStock(a) - getProductTotalStock(b);
      }
      if (sortBy === 'stock_desc') {
        return getProductTotalStock(b) - getProductTotalStock(a);
      }
      return 0;
    });
  }, [products, activeFilter, selectedCategory, searchQuery, sortBy]);

  // Counts for filter pills
  const counts = useMemo(() => {
    let expired = 0, today = 0, d7 = 0, d15 = 0, d30 = 0, safe = 0, low = 0, arch = 0;
    products.forEach(p => {
      if (p.isArchived) {
        arch++;
        return;
      }
      const stock = getProductTotalStock(p);
      if (stock <= p.minStockLevel && p.minStockLevel > 0) low++;
      const earliest = getProductEarliestBatch(p);
      const d = earliest.daysRemaining;
      if (d < 0) expired++;
      else if (d === 0) today++;
      else if (d <= 6) d7++;
      else if (d <= 14) d15++;
      else if (d <= 30) d30++;
      else safe++;
    });
    return {
      all: products.filter(p => !p.isArchived).length,
      expired,
      today,
      d7,
      d15: d7 + d15,
      d30: d7 + d15 + d30,
      safe,
      low,
      archived: arch,
    };
  }, [products]);

  const filterTabs = [
    { id: 'all', label: 'All Products', count: counts.all },
    { id: 'expired', label: 'Expired', count: counts.expired, highlight: 'text-rose-400 bg-rose-500/10' },
    { id: 'today', label: 'Expires Today', count: counts.today, highlight: 'text-red-400 bg-red-500/10' },
    { id: '7days', label: '≤ 7 Days', count: counts.d7, highlight: 'text-amber-400 bg-amber-500/10' },
    { id: '15days', label: '≤ 15 Days', count: counts.d15 },
    { id: '30days', label: '≤ 30 Days', count: counts.d30 },
    { id: 'safe', label: 'Safe (>30d)', count: counts.safe },
    { id: 'lowstock', label: 'Low Stock', count: counts.low },
    { id: 'archived', label: 'Archived', count: counts.archived },
  ];

  return (
    <div className="space-y-4 pb-12">
      {/* Top Search & Action Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search Box */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by product name, SKU, barcode, batch #, or shelf..."
            className="w-full rounded-2xl bg-slate-900 border border-slate-700/80 pl-10 pr-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition shadow-inner"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-2.5 text-xs text-slate-400 hover:text-white"
            >
              Clear
            </button>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenScanner}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold shadow transition active:scale-95"
            title="Scan Barcode"
          >
            <Barcode className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">Scan</span>
          </button>

          <button
            onClick={onOpenAddModal}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-950/40 transition active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs Scrollable Row */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
        {filterTabs.map(tab => {
          const isActive = activeFilter === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onFilterChange(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium whitespace-nowrap transition active:scale-95 ${
                isActive
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/40 font-bold'
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 border border-slate-700/60'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  isActive ? 'bg-emerald-700 text-emerald-100 font-bold' : tab.highlight || 'bg-slate-700 text-slate-300'
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Sorting & Category Selector Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1 text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-slate-400 font-medium">Category:</span>
          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            className="rounded-lg bg-slate-900 border border-slate-700 px-2.5 py-1 text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
          >
            <option value="all">All Categories ({products.length})</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-medium">Sort by:</span>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as any)}
            className="rounded-lg bg-slate-900 border border-slate-700 px-2.5 py-1 text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
          >
            <option value="expiry_asc">Earliest Expiry First (FEFO)</option>
            <option value="expiry_desc">Latest Expiry First</option>
            <option value="name_asc">Product Name (A &rarr; Z)</option>
            <option value="name_desc">Product Name (Z &rarr; A)</option>
            <option value="stock_asc">Stock Qty (Low &rarr; High)</option>
            <option value="stock_desc">Stock Qty (High &rarr; Low)</option>
          </select>
        </div>
      </div>

      {/* Product Cards List */}
      {filteredProducts.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center border border-slate-800">
          <Layers className="w-10 h-10 text-slate-500 mx-auto mb-2" />
          <h4 className="text-sm font-bold text-white">No Matching Products Found</h4>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Try adjusting your search terms or filter selection. You can also add a new product or scan a barcode.
          </p>
          <button
            onClick={onOpenAddModal}
            className="mt-4 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition"
          >
            Add New Product
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredProducts.map(product => {
            const totalStock = getProductTotalStock(product);
            const earliest = getProductEarliestBatch(product);
            const daysRemaining = earliest.daysRemaining;
            const cfg = getExpiryStatusConfig(earliest.status);
            const isLowStock = totalStock <= product.minStockLevel && product.minStockLevel > 0;
            const batchCount = product.batches?.length || 0;

            return (
              <div
                key={product.id}
                onClick={() => onSelectProduct(product)}
                className={`glass-card rounded-2xl p-4 border ${cfg.borderColor} hover:border-slate-500 hover:bg-slate-800/80 transition cursor-pointer flex flex-col justify-between group relative overflow-hidden`}
              >
                <div>
                  {/* Top Row: Icon, Title, Expiry Badge */}
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-2xl flex-shrink-0 group-hover:scale-105 transition">
                        {product.image || '📦'}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-xs font-bold text-white truncate group-hover:text-emerald-400 transition">
                          {product.name}
                        </h3>
                        <p className="text-[11px] text-slate-400 truncate">
                          {product.category} • {product.brand || 'Store Brand'}
                        </p>
                      </div>
                    </div>

                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${cfg.badgeBg} ${cfg.badgeText} border ${cfg.borderColor} flex-shrink-0`}>
                      {formatExpiryRelative(daysRemaining)}
                    </span>
                  </div>

                  {/* Middle Info: Location and SKU */}
                  <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
                    <span className="truncate max-w-[170px]">{product.location}</span>
                    <span className="font-mono text-slate-300 font-medium">SKU: {product.sku}</span>
                  </div>

                  {/* Earliest Batch Callout */}
                  {earliest.batch && (
                    <div className="mt-2.5 p-2 rounded-xl bg-slate-950/40 border border-slate-800/80 text-[11px] flex items-center justify-between">
                      <div className="text-slate-300">
                        <span className="text-slate-500 text-[10px] block">Earliest Batch</span>
                        <span className="font-mono font-semibold text-white">{earliest.batch.batchNumber}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-500 text-[10px] block">Batch Expiry</span>
                        <span className="font-mono font-semibold text-slate-200">{earliest.batch.expiryDate}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Bottom Row: Total Stock & Price */}
                <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase tracking-wider">
                      Stock ({batchCount} {batchCount === 1 ? 'batch' : 'batches'})
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-black text-white">{totalStock} Units</span>
                      {isLowStock && (
                        <span className="px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 text-[9px] font-bold">
                          Low
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 block uppercase tracking-wider">Retail</span>
                    <span className="text-sm font-bold text-emerald-400">
                      ${product.sellingPrice?.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
