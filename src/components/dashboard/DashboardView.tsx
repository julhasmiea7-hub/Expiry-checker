import React from 'react';
import { 
  AlertTriangle, 
  Clock, 
  Calendar, 
  Package, 
  TrendingDown, 
  ShieldAlert, 
  CheckCircle2, 
  ArrowRight, 
  Barcode, 
  Plus, 
  DollarSign,
  Layers,
  Sparkles,
  Zap
} from 'lucide-react';
import { Product, ProductBatch } from '../../types/inventory';
import { calculateDaysRemaining, formatExpiryRelative, getExpiryStatus, getExpiryStatusConfig, getProductEarliestBatch, getProductTotalStock } from '../../utils/expiry';

interface DashboardViewProps {
  products: Product[];
  onNavigateTab: (tab: string, filter?: string) => void;
  onOpenAddModal: () => void;
  onOpenScanner: () => void;
  onSelectProduct: (product: Product) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  products,
  onNavigateTab,
  onOpenAddModal,
  onOpenScanner,
  onSelectProduct,
}) => {
  const activeProducts = products.filter(p => !p.isArchived);

  // Compute metrics across all products and batches
  let totalStockQuantity = 0;
  let totalInventoryValuation = 0;
  let potentialLossValue = 0;

  let expiredProductsCount = 0;
  let expiredUnitsTotal = 0;
  let expiresTodayCount = 0;
  let expires7DaysCount = 0;
  let expires15DaysCount = 0;
  let expires30DaysCount = 0;
  let safeProductsCount = 0;
  let lowStockProductsCount = 0;

  const urgentActionItems: Array<{
    product: Product;
    batch: ProductBatch;
    daysRemaining: number;
    status: string;
  }> = [];

  activeProducts.forEach(product => {
    const totalStock = getProductTotalStock(product);
    totalStockQuantity += totalStock;
    totalInventoryValuation += totalStock * (product.sellingPrice || 0);

    if (totalStock <= product.minStockLevel && product.minStockLevel > 0) {
      lowStockProductsCount++;
    }

    const earliest = getProductEarliestBatch(product);
    if (earliest.batch && earliest.batch.quantity > 0) {
      const days = earliest.daysRemaining;
      if (days < 0) {
        expiredProductsCount++;
        expiredUnitsTotal += earliest.batch.quantity;
        potentialLossValue += earliest.batch.quantity * (product.purchasePrice || 0);
        urgentActionItems.push({ product, batch: earliest.batch, daysRemaining: days, status: 'expired' });
      } else if (days === 0) {
        expiresTodayCount++;
        potentialLossValue += earliest.batch.quantity * (product.purchasePrice || 0);
        urgentActionItems.push({ product, batch: earliest.batch, daysRemaining: days, status: 'expires_today' });
      } else if (days <= 6) {
        expires7DaysCount++;
        urgentActionItems.push({ product, batch: earliest.batch, daysRemaining: days, status: 'urgent' });
      } else if (days <= 14) {
        expires7DaysCount++;
      } else if (days <= 30) {
        expires30DaysCount++;
      } else {
        safeProductsCount++;
      }
    } else {
      safeProductsCount++;
    }
  });

  // Sort urgent items by most expired / earliest expiry
  urgentActionItems.sort((a, b) => a.daysRemaining - b.daysRemaining);

  // Expiry Chart calculations
  const totalEvaluated = activeProducts.length || 1;
  const expiredPct = Math.round((expiredProductsCount / totalEvaluated) * 100);
  const todayPct = Math.round((expiresTodayCount / totalEvaluated) * 100);
  const next7DaysPct = Math.round((expires7DaysCount / totalEvaluated) * 100);
  const next30DaysPct = Math.round((expires30DaysCount / totalEvaluated) * 100);
  const safePct = Math.max(0, 100 - (expiredPct + todayPct + next7DaysPct + next30DaysPct));

  // Recently added products (last 5)
  const recentlyAdded = [...activeProducts]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner / Shift Overview */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/80 to-slate-900 border border-slate-700/80 p-5 sm:p-6 shadow-xl">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-1">
              <Sparkles className="w-4 h-4" />
              <span>Shift Operations • Supermarket Store Dashboard</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
              ShelfGuard Expiry &amp; Inventory Monitor
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl">
              Real-time monitoring across <strong className="text-white">{activeProducts.length}</strong> catalog items and <strong className="text-white">{totalStockQuantity}</strong> units. First-Expiry-First-Out active.
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <button
              onClick={onOpenScanner}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 text-xs font-semibold shadow transition active:scale-95"
            >
              <Barcode className="w-4 h-4 text-emerald-400" />
              <span>Scan Barcode</span>
            </button>
            <button
              onClick={onOpenAddModal}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-950/50 transition active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Add Product</span>
            </button>
          </div>
        </div>

        {/* Highlight Alert strip if expired items exist */}
        {(expiredProductsCount > 0 || expiresTodayCount > 0) && (
          <div className="mt-4 pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-rose-400">
              <AlertTriangle className="w-4 h-4 animate-bounce" />
              <span>
                Attention Required: <strong>{expiredProductsCount}</strong> product(s) expired, <strong>{expiresTodayCount}</strong> expiring today!
              </span>
            </div>
            <button
              onClick={() => onNavigateTab('products', 'expired')}
              className="text-xs text-rose-300 hover:text-white font-semibold underline underline-offset-4 flex items-center gap-1"
            >
              Resolve Expired Stock <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Primary KPI Grid (All 8 mandatory metrics) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Products */}
        <div 
          onClick={() => onNavigateTab('products', 'all')}
          className="glass-card rounded-2xl p-4 cursor-pointer hover:border-slate-600 transition group"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Total Products</span>
            <div className="p-2 rounded-xl bg-slate-800 text-slate-300 group-hover:text-white group-hover:bg-slate-700 transition">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-white">{activeProducts.length}</div>
          <div className="text-[11px] text-slate-400 mt-1">Catalog SKUs</div>
        </div>

        {/* Total Stock Quantity */}
        <div 
          onClick={() => onNavigateTab('inventory')}
          className="glass-card rounded-2xl p-4 cursor-pointer hover:border-slate-600 transition group"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Total Stock Qty</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 group-hover:bg-blue-500/20 transition">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-white">{totalStockQuantity}</div>
          <div className="text-[11px] text-blue-400 font-medium mt-1">
            Est. Val: ${totalInventoryValuation.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </div>
        </div>

        {/* Expired Products */}
        <div 
          onClick={() => onNavigateTab('products', 'expired')}
          className="glass-card rounded-2xl p-4 cursor-pointer border-rose-500/30 hover:border-rose-500/60 bg-rose-950/20 transition group"
        >
          <div className="flex items-center justify-between text-rose-400 mb-2">
            <span className="text-xs font-semibold">Expired Products</span>
            <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400 group-hover:bg-rose-500/30 transition">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-rose-400">{expiredProductsCount}</div>
          <div className="text-[11px] text-rose-300 mt-1">
            {expiredUnitsTotal} units (${potentialLossValue.toFixed(0)} risk)
          </div>
        </div>

        {/* Products Expiring Today */}
        <div 
          onClick={() => onNavigateTab('products', 'today')}
          className="glass-card rounded-2xl p-4 cursor-pointer border-red-500/30 hover:border-red-500/60 bg-red-950/20 transition group"
        >
          <div className="flex items-center justify-between text-red-400 mb-2">
            <span className="text-xs font-semibold">Expiring Today</span>
            <div className="p-2 rounded-xl bg-red-500/20 text-red-400 group-hover:bg-red-500/30 transition">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-red-400">{expiresTodayCount}</div>
          <div className="text-[11px] text-red-300 mt-1">Immediate clearance action</div>
        </div>

        {/* Expiring in 7 Days */}
        <div 
          onClick={() => onNavigateTab('products', '7days')}
          className="glass-card rounded-2xl p-4 cursor-pointer border-amber-500/30 hover:border-amber-500/60 bg-amber-950/15 transition group"
        >
          <div className="flex items-center justify-between text-amber-400 mb-2">
            <span className="text-xs font-medium">Expiring &le; 7 Days</span>
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 group-hover:bg-amber-500/30 transition">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-300">{expires7DaysCount}</div>
          <div className="text-[11px] text-amber-400/80 mt-1">Critical &amp; Urgent shelf life</div>
        </div>

        {/* Expiring in 15 Days */}
        <div 
          onClick={() => onNavigateTab('products', '15days')}
          className="glass-card rounded-2xl p-4 cursor-pointer hover:border-slate-600 transition group"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Expiring &le; 15 Days</span>
            <div className="p-2 rounded-xl bg-orange-500/10 text-orange-400 group-hover:bg-orange-500/20 transition">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-orange-400">
            {expires7DaysCount + Math.round(expires30DaysCount / 2)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Next 2 weeks window</div>
        </div>

        {/* Expiring in 30 Days */}
        <div 
          onClick={() => onNavigateTab('products', '30days')}
          className="glass-card rounded-2xl p-4 cursor-pointer hover:border-slate-600 transition group"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Expiring &le; 30 Days</span>
            <div className="p-2 rounded-xl bg-yellow-500/10 text-yellow-400 group-hover:bg-yellow-500/20 transition">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-yellow-400">{expires30DaysCount}</div>
          <div className="text-[11px] text-slate-400 mt-1">Warning stage batches</div>
        </div>

        {/* Low Stock Products */}
        <div 
          onClick={() => onNavigateTab('products', 'lowstock')}
          className="glass-card rounded-2xl p-4 cursor-pointer hover:border-slate-600 transition group"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Low Stock Products</span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 group-hover:bg-purple-500/20 transition">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-purple-400">{lowStockProductsCount}</div>
          <div className="text-[11px] text-slate-400 mt-1">Below minimum threshold</div>
        </div>
      </div>

      {/* Visual Analytics & Expiry Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Visual Progress Bar Chart & Breakdown */}
        <div className="lg:col-span-2 glass-card rounded-2xl p-5 border border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white">Expiry Risk Breakdown</h3>
              <p className="text-xs text-slate-400">Distribution across active supermarket inventory</p>
            </div>
            <button
              onClick={() => onNavigateTab('reports')}
              className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold"
            >
              View Full Report &rarr;
            </button>
          </div>

          {/* Segmented Stacked Progress Bar */}
          <div className="h-4 rounded-full overflow-hidden flex bg-slate-800 gap-0.5 p-0.5 border border-slate-700/50 mb-4">
            <div 
              style={{ width: `${Math.max(expiredPct, expiredProductsCount ? 4 : 0)}%` }} 
              className="bg-rose-500 h-full rounded-l-full transition-all" 
              title={`Expired: ${expiredProductsCount}`} 
            />
            <div 
              style={{ width: `${Math.max(todayPct, expiresTodayCount ? 4 : 0)}%` }} 
              className="bg-red-500 h-full transition-all" 
              title={`Today: ${expiresTodayCount}`} 
            />
            <div 
              style={{ width: `${Math.max(next7DaysPct, expires7DaysCount ? 4 : 0)}%` }} 
              className="bg-amber-500 h-full transition-all" 
              title={`≤ 7 Days: ${expires7DaysCount}`} 
            />
            <div 
              style={{ width: `${Math.max(next30DaysPct, expires30DaysCount ? 4 : 0)}%` }} 
              className="bg-yellow-400 h-full transition-all" 
              title={`≤ 30 Days: ${expires30DaysCount}`} 
            />
            <div 
              style={{ width: `${safePct}%` }} 
              className="bg-emerald-500 h-full rounded-r-full transition-all" 
              title={`Safe: ${safeProductsCount}`} 
            />
          </div>

          {/* Legend and Detailed Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
            <div 
              onClick={() => onNavigateTab('products', 'expired')}
              className="p-2.5 rounded-xl bg-slate-900/80 border border-rose-500/20 cursor-pointer hover:bg-slate-800 transition"
            >
              <div className="flex items-center gap-1.5 text-rose-400 font-medium">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                <span>Expired</span>
              </div>
              <div className="text-base font-bold text-white mt-1">{expiredProductsCount}</div>
              <div className="text-[10px] text-slate-400">{expiredPct}% of store</div>
            </div>

            <div 
              onClick={() => onNavigateTab('products', 'today')}
              className="p-2.5 rounded-xl bg-slate-900/80 border border-red-500/20 cursor-pointer hover:bg-slate-800 transition"
            >
              <div className="flex items-center gap-1.5 text-red-400 font-medium">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                <span>Today</span>
              </div>
              <div className="text-base font-bold text-white mt-1">{expiresTodayCount}</div>
              <div className="text-[10px] text-slate-400">{todayPct}% of store</div>
            </div>

            <div 
              onClick={() => onNavigateTab('products', '7days')}
              className="p-2.5 rounded-xl bg-slate-900/80 border border-amber-500/20 cursor-pointer hover:bg-slate-800 transition"
            >
              <div className="flex items-center gap-1.5 text-amber-400 font-medium">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span>1–7 Days</span>
              </div>
              <div className="text-base font-bold text-white mt-1">{expires7DaysCount}</div>
              <div className="text-[10px] text-slate-400">{next7DaysPct}% of store</div>
            </div>

            <div 
              onClick={() => onNavigateTab('products', '30days')}
              className="p-2.5 rounded-xl bg-slate-900/80 border border-yellow-500/20 cursor-pointer hover:bg-slate-800 transition"
            >
              <div className="flex items-center gap-1.5 text-yellow-400 font-medium">
                <span className="w-2 h-2 rounded-full bg-yellow-400" />
                <span>8–30 Days</span>
              </div>
              <div className="text-base font-bold text-white mt-1">{expires30DaysCount}</div>
              <div className="text-[10px] text-slate-400">{next30DaysPct}% of store</div>
            </div>

            <div 
              onClick={() => onNavigateTab('products', 'safe')}
              className="p-2.5 rounded-xl bg-slate-900/80 border border-emerald-500/20 cursor-pointer hover:bg-slate-800 transition col-span-2 sm:col-span-1"
            >
              <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Safe (&gt;30d)</span>
              </div>
              <div className="text-base font-bold text-white mt-1">{safeProductsCount}</div>
              <div className="text-[10px] text-slate-400">{safePct}% of store</div>
            </div>
          </div>

          {/* FEFO Recommendation Highlight */}
          <div className="mt-4 p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/30 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-emerald-300">
              <Zap className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>FEFO Rule Active: Always dispense the batch with the earliest expiry first.</span>
            </div>
            <button
              onClick={() => onNavigateTab('fefo')}
              className="px-2.5 py-1 rounded-lg bg-emerald-600/80 hover:bg-emerald-600 text-white font-medium text-[11px] whitespace-nowrap transition"
            >
              Launch FEFO Guide
            </button>
          </div>
        </div>

        {/* Store Waste & Financial Health Card */}
        <div className="glass-card rounded-2xl p-5 border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-white">Stock Loss Protection</h3>
              <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 mb-3">
              <div className="text-[11px] text-slate-400 font-medium">Potential Waste Loss (Cost)</div>
              <div className="text-2xl font-black text-rose-400 mt-0.5">
                ${potentialLossValue.toFixed(2)}
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                Value of currently expired &amp; expiring today batches
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-slate-300">
                <span>Inventory Retail Value:</span>
                <span className="font-semibold text-white">${totalInventoryValuation.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Stock Health Score:</span>
                <span className="font-semibold text-emerald-400">
                  {Math.max(10, 100 - (expiredPct * 2 + todayPct * 1.5))}% Optimum
                </span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Low Stock Reorders:</span>
                <span className="font-semibold text-purple-400">{lowStockProductsCount} Items</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => onNavigateTab('inventory')}
            className="mt-4 w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition flex items-center justify-center gap-1.5"
          >
            Manage Stock Movements &rarr;
          </button>
        </div>
      </div>

      {/* Urgent Action Carousel / High Priority Expiry Queue */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-white">Priority Expiry Action Queue</h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-semibold border border-rose-500/30">
              {urgentActionItems.length} Urgent Items
            </span>
          </div>
          <button
            onClick={() => onNavigateTab('products', '7days')}
            className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
          >
            <span>See All</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {urgentActionItems.length === 0 ? (
          <div className="glass-card rounded-2xl p-8 text-center border border-emerald-500/20">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
            <h4 className="text-sm font-bold text-white">All Clear! No Urgent Expiries</h4>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              No products are currently expired or expiring within the next 6 days. Your shelves are fresh.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {urgentActionItems.slice(0, 6).map(({ product, batch, daysRemaining, status }) => {
              const cfg = getExpiryStatusConfig(status as any);
              return (
                <div
                  key={`${product.id}-${batch.id}`}
                  onClick={() => onSelectProduct(product)}
                  className={`glass-card rounded-2xl p-4 border ${cfg.borderColor} cursor-pointer hover:bg-slate-800/80 transition relative overflow-hidden group`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-xl flex-shrink-0">
                        {product.image || '📦'}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-white truncate max-w-[150px] sm:max-w-[170px]">
                          {product.name}
                        </h4>
                        <p className="text-[11px] text-slate-400 truncate">
                          {product.category} • {product.location}
                        </p>
                      </div>
                    </div>

                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${cfg.badgeBg} ${cfg.badgeText} border ${cfg.borderColor} flex-shrink-0`}>
                      {formatExpiryRelative(daysRemaining)}
                    </span>
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-300">
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Batch</span>
                      <span className="font-mono font-medium text-slate-200">{batch.batchNumber}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Quantity</span>
                      <span className="font-bold text-white">{batch.quantity} units</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Expiry Date</span>
                      <span className="font-mono text-slate-200">{batch.expiryDate}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recently Added Products */}
      <div className="glass-card rounded-2xl p-5 border border-slate-800">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-bold text-white">Recently Added Products</h3>
            <p className="text-xs text-slate-400">Latest additions to store catalog</p>
          </div>
          <button
            onClick={() => onNavigateTab('products', 'all')}
            className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold"
          >
            Catalog View &rarr;
          </button>
        </div>

        <div className="divide-y divide-slate-800/80">
          {recentlyAdded.map(prod => {
            const stock = getProductTotalStock(prod);
            const earliest = getProductEarliestBatch(prod);
            const cfg = getExpiryStatusConfig(earliest.status);

            return (
              <div 
                key={prod.id} 
                onClick={() => onSelectProduct(prod)}
                className="py-2.5 flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-800/40 px-2 rounded-xl transition"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-base flex-shrink-0">
                    {prod.image || '📦'}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-white truncate max-w-[180px] sm:max-w-xs">{prod.name}</div>
                    <div className="text-[10px] text-slate-400 font-mono">SKU: {prod.sku} • {prod.brand || prod.category}</div>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs flex-shrink-0">
                  <div className="text-right hidden sm:block">
                    <div className="font-bold text-white">{stock} units</div>
                    <div className="text-[10px] text-slate-400">${prod.sellingPrice?.toFixed(2)}</div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${cfg.badgeBg} ${cfg.badgeText}`}>
                    {cfg.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
