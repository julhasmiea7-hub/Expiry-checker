import React, { useMemo, useState } from 'react';
import { 
  FileText, 
  Download, 
  Printer, 
  Calendar, 
  Filter, 
  ShieldAlert, 
  TrendingDown, 
  DollarSign, 
  Package, 
  AlertTriangle 
} from 'lucide-react';
import { Product, StockMovement } from '../../types/inventory';
import { 
  calculateDaysRemaining, 
  formatExpiryRelative, 
  getExpiryStatus, 
  getExpiryStatusConfig, 
  getProductEarliestBatch, 
  getProductTotalStock, 
  getTodayDateString 
} from '../../utils/expiry';
import { exportToCSV, printFormattedReport } from '../../utils/export';

interface ReportsViewProps {
  products: Product[];
  movements: StockMovement[];
}

type ReportType = 
  | 'expired' 
  | 'upcoming' 
  | 'daily' 
  | 'monthly' 
  | 'inventory' 
  | 'low_stock' 
  | 'damaged';

export const ReportsView: React.FC<ReportsViewProps> = ({ products, movements }) => {
  const [reportType, setReportType] = useState<ReportType>('expired');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [customDaysWindow, setCustomDaysWindow] = useState<number>(7);

  const activeProducts = products.filter(p => !p.isArchived);

  // Available categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    activeProducts.forEach(p => set.add(p.category));
    return Array.from(set).sort();
  }, [activeProducts]);

  // Compute report rows and summary stats based on reportType
  const { title, subtitle, headers, rows, summaryStats, rawData } = useMemo(() => {
    const catFiltered = selectedCategory === 'all'
      ? activeProducts
      : activeProducts.filter(p => p.category === selectedCategory);

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    if (reportType === 'expired') {
      const expiredBatches: any[] = [];
      let totalLoss = 0;
      let totalUnits = 0;

      catFiltered.forEach(p => {
        (p.batches || []).forEach(b => {
          if (b.quantity > 0) {
            const days = calculateDaysRemaining(b.expiryDate);
            if (days < 0) {
              const costVal = (b.quantity * (p.purchasePrice || 0));
              totalLoss += costVal;
              totalUnits += b.quantity;
              expiredBatches.push({
                productName: p.name,
                sku: p.sku,
                category: p.category,
                batchNumber: b.batchNumber,
                expiryDate: b.expiryDate,
                daysExpired: Math.abs(days),
                quantity: b.quantity,
                costPrice: p.purchasePrice,
                lossVal: costVal,
                location: b.location || p.location,
              });
            }
          }
        });
      });

      return {
        title: 'Official Expired Products Write-Off Audit',
        subtitle: 'Products past expiration date requiring quarantine, disposal, or vendor credit',
        headers: ['Product Name', 'SKU', 'Batch #', 'Expiry Date', 'Days Past Expiry', 'Units', 'Cost/Unit', 'Total Loss ($)', 'Shelf Location'],
        rows: expiredBatches.map(b => [
          b.productName,
          b.sku,
          b.batchNumber,
          b.expiryDate,
          `${b.daysExpired} days ago`,
          b.quantity,
          `$${b.costPrice.toFixed(2)}`,
          `$${b.lossVal.toFixed(2)}`,
          b.location,
        ]),
        summaryStats: [
          { label: 'Expired SKUs / Batches', value: String(expiredBatches.length) },
          { label: 'Total Expired Units', value: `${totalUnits} Units` },
          { label: 'Total Inventory Cost Loss', value: `$${totalLoss.toFixed(2)}` },
        ],
        rawData: expiredBatches,
      };
    }

    if (reportType === 'upcoming') {
      const upcomingBatches: any[] = [];
      let totalUnits = 0;

      catFiltered.forEach(p => {
        (p.batches || []).forEach(b => {
          if (b.quantity > 0) {
            const days = calculateDaysRemaining(b.expiryDate);
            if (days >= 0 && days <= customDaysWindow) {
              totalUnits += b.quantity;
              upcomingBatches.push({
                productName: p.name,
                sku: p.sku,
                category: p.category,
                batchNumber: b.batchNumber,
                expiryDate: b.expiryDate,
                daysRemaining: days,
                quantity: b.quantity,
                location: b.location || p.location,
                status: getExpiryStatus(days),
              });
            }
          }
        });
      });

      upcomingBatches.sort((a, b) => a.daysRemaining - b.daysRemaining);

      return {
        title: `Upcoming Expiry Report (≤ ${customDaysWindow} Days Window)`,
        subtitle: `Priority shelf items approaching expiration date for markdown or FEFO rotation`,
        headers: ['Product Name', 'SKU', 'Category', 'Batch #', 'Expiry Date', 'Days Left', 'Units in Batch', 'Shelf Location'],
        rows: upcomingBatches.map(b => [
          b.productName,
          b.sku,
          b.category,
          b.batchNumber,
          b.expiryDate,
          formatExpiryRelative(b.daysRemaining),
          b.quantity,
          b.location,
        ]),
        summaryStats: [
          { label: 'Batches In Window', value: String(upcomingBatches.length) },
          { label: 'Units At Risk', value: `${totalUnits} Units` },
          { label: 'Monitoring Window', value: `${customDaysWindow} Days` },
        ],
        rawData: upcomingBatches,
      };
    }

    if (reportType === 'daily') {
      const todayBatches: any[] = [];
      let totalUnits = 0;

      catFiltered.forEach(p => {
        (p.batches || []).forEach(b => {
          if (b.quantity > 0) {
            const days = calculateDaysRemaining(b.expiryDate);
            if (days === 0 || days === 1) {
              totalUnits += b.quantity;
              todayBatches.push({
                productName: p.name,
                sku: p.sku,
                batchNumber: b.batchNumber,
                expiryDate: b.expiryDate,
                timing: days === 0 ? 'Expires TODAY' : 'Expires Tomorrow',
                quantity: b.quantity,
                location: b.location || p.location,
              });
            }
          }
        });
      });

      return {
        title: 'Daily Expiry Shift Briefing Report',
        subtitle: `Action items expiring today or within 24 hours for morning shift clearance`,
        headers: ['Product Name', 'SKU', 'Batch #', 'Expiry Date', 'Shift Urgency', 'Units', 'Location'],
        rows: todayBatches.map(b => [
          b.productName,
          b.sku,
          b.batchNumber,
          b.expiryDate,
          b.timing,
          b.quantity,
          b.location,
        ]),
        summaryStats: [
          { label: 'Items Expiring Today/Tomorrow', value: String(todayBatches.length) },
          { label: 'Units To Mark Down', value: `${totalUnits} Units` },
          { label: 'Shift Date', value: getTodayDateString() },
        ],
        rawData: todayBatches,
      };
    }

    if (reportType === 'monthly') {
      const monthlyBatches: any[] = [];
      let totalUnits = 0;

      catFiltered.forEach(p => {
        (p.batches || []).forEach(b => {
          if (b.quantity > 0 && b.expiryDate) {
            const d = new Date(b.expiryDate + 'T00:00:00');
            if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
              const days = calculateDaysRemaining(b.expiryDate);
              totalUnits += b.quantity;
              monthlyBatches.push({
                productName: p.name,
                sku: p.sku,
                batchNumber: b.batchNumber,
                expiryDate: b.expiryDate,
                daysRemaining: days,
                quantity: b.quantity,
                location: b.location || p.location,
              });
            }
          }
        });
      });

      const monthName = now.toLocaleString('en-US', { month: 'long', year: 'numeric' });

      return {
        title: `Monthly Expiry Forecast (${monthName})`,
        subtitle: `All products scheduled to expire during the current calendar month`,
        headers: ['Product Name', 'SKU', 'Batch #', 'Expiry Date', 'Days Remaining', 'Units', 'Location'],
        rows: monthlyBatches.map(b => [
          b.productName,
          b.sku,
          b.batchNumber,
          b.expiryDate,
          formatExpiryRelative(b.daysRemaining),
          b.quantity,
          b.location,
        ]),
        summaryStats: [
          { label: `Batches in ${now.toLocaleString('en-US', { month: 'short' })}`, value: String(monthlyBatches.length) },
          { label: 'Total Units', value: `${totalUnits} Units` },
          { label: 'Period', value: monthName },
        ],
        rawData: monthlyBatches,
      };
    }

    if (reportType === 'low_stock') {
      const lowStockItems: any[] = [];
      catFiltered.forEach(p => {
        const totalStock = getProductTotalStock(p);
        if (totalStock <= p.minStockLevel && p.minStockLevel > 0) {
          lowStockItems.push({
            productName: p.name,
            sku: p.sku,
            category: p.category,
            currentStock: totalStock,
            minStockLevel: p.minStockLevel,
            deficit: p.minStockLevel - totalStock,
            supplier: p.supplier,
            location: p.location,
          });
        }
      });

      return {
        title: 'Low Stock & Purchase Reorder Report',
        subtitle: 'Products at or below configured minimum inventory thresholds',
        headers: ['Product Name', 'SKU', 'Category', 'Current Stock', 'Min Threshold', 'Deficit To Order', 'Supplier', 'Location'],
        rows: lowStockItems.map(p => [
          p.productName,
          p.sku,
          p.category,
          p.currentStock,
          p.minStockLevel,
          `+${Math.max(1, p.deficit + 10)} units`,
          p.supplier || 'N/A',
          p.location,
        ]),
        summaryStats: [
          { label: 'Critical Low SKUs', value: String(lowStockItems.length) },
          { label: 'Threshold Status', value: 'Needs Reorder' },
        ],
        rawData: lowStockItems,
      };
    }

    if (reportType === 'damaged') {
      const damageLogs = movements.filter(m => m.type === 'damaged' || m.type === 'expired_writeoff');
      let totalUnitsLost = 0;
      damageLogs.forEach(m => {
        totalUnitsLost += Math.abs(m.quantity);
      });

      return {
        title: 'Damaged & Written-Off Inventory Log',
        subtitle: 'Audit trail of damaged goods, packaging failures, and bio-disposal write-offs',
        headers: ['Date', 'Product Name', 'Batch #', 'Action', 'Units Lost', 'Reason', 'Logged By', 'Doc Ref'],
        rows: damageLogs.map(m => [
          new Date(m.timestamp).toLocaleDateString(),
          m.productName,
          m.batchNumber || 'N/A',
          m.type === 'damaged' ? 'Damaged Scrap' : 'Expired Disposal',
          Math.abs(m.quantity),
          m.reason,
          m.staffName,
          m.referenceDoc || 'N/A',
        ]),
        summaryStats: [
          { label: 'Total Incident Entries', value: String(damageLogs.length) },
          { label: 'Total Units Scrapped', value: `${totalUnitsLost} Units` },
        ],
        rawData: damageLogs,
      };
    }

    // Default: Current Inventory Valuation Report
    let totalStock = 0;
    let totalCostVal = 0;
    let totalRetailVal = 0;

    const inventoryList = catFiltered.map(p => {
      const stock = getProductTotalStock(p);
      const cost = stock * (p.purchasePrice || 0);
      const retail = stock * (p.sellingPrice || 0);
      totalStock += stock;
      totalCostVal += cost;
      totalRetailVal += retail;

      return {
        name: p.name,
        sku: p.sku,
        category: p.category,
        batchesCount: p.batches?.length || 0,
        stock,
        purchasePrice: p.purchasePrice,
        sellingPrice: p.sellingPrice,
        costVal: cost,
        retailVal: retail,
        location: p.location,
      };
    });

    return {
      title: 'Current Store Inventory & Valuation Report',
      subtitle: 'Complete catalog stock levels, inventory asset valuation, and shelf distribution',
      headers: ['Product Name', 'SKU', 'Category', 'Batches', 'Total Stock', 'Cost Price', 'Retail Price', 'Total Cost Value', 'Total Retail Value', 'Location'],
      rows: inventoryList.map(p => [
        p.name,
        p.sku,
        p.category,
        p.batchesCount,
        p.stock,
        `$${p.purchasePrice.toFixed(2)}`,
        `$${p.sellingPrice.toFixed(2)}`,
        `$${p.costVal.toFixed(2)}`,
        `$${p.retailVal.toFixed(2)}`,
        p.location,
      ]),
      summaryStats: [
        { label: 'Total Active SKUs', value: String(inventoryList.length) },
        { label: 'Total Inventory Units', value: `${totalStock} Units` },
        { label: 'Total Cost Value', value: `$${totalCostVal.toFixed(2)}` },
        { label: 'Total Retail Value', value: `$${totalRetailVal.toFixed(2)}` },
      ],
      rawData: inventoryList,
    };
  }, [reportType, selectedCategory, customDaysWindow, activeProducts, movements]);

  const handleExportCSV = () => {
    exportToCSV(`ShelfGuard_${reportType}_report`, headers, rows);
  };

  const handlePrintReport = () => {
    // Generate clean HTML table
    const tableHtml = `
      <table>
        <thead>
          <tr>
            ${headers.map(h => `<th>${h}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${rows.map(row => `
            <tr>
              ${row.map(cell => `<td>${cell}</td>`).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    printFormattedReport(title, subtitle, tableHtml, summaryStats);
  };

  const reportButtons: { id: ReportType; label: string; icon: any }[] = [
    { id: 'expired', label: 'Expired Stock', icon: ShieldAlert },
    { id: 'upcoming', label: 'Upcoming Expiry', icon: Calendar },
    { id: 'daily', label: 'Daily Expiry Briefing', icon: FileText },
    { id: 'monthly', label: 'Monthly Forecast', icon: Calendar },
    { id: 'inventory', label: 'Inventory Valuation', icon: DollarSign },
    { id: 'low_stock', label: 'Low Stock Reorder', icon: TrendingDown },
    { id: 'damaged', label: 'Damaged & Waste Log', icon: AlertTriangle },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white">Supermarket Audit &amp; Expiry Reports</h2>
          <p className="text-xs text-slate-400">
            Generate formal printable PDF sheets, CSV data exports, and audit records.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold shadow transition active:scale-95"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={handlePrintReport}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-950/40 transition active:scale-95"
          >
            <Printer className="w-4 h-4" />
            <span>Print / PDF Document</span>
          </button>
        </div>
      </div>

      {/* Report Type Selector Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs no-scrollbar">
        {reportButtons.map(btn => {
          const Icon = btn.icon;
          const isActive = reportType === btn.id;
          return (
            <button
              key={btn.id}
              onClick={() => setReportType(btn.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-medium whitespace-nowrap transition active:scale-95 ${
                isActive
                  ? 'bg-emerald-600 text-white font-bold shadow-md shadow-emerald-950/40'
                  : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{btn.label}</span>
            </button>
          );
        })}
      </div>

      {/* Filter Toolbar */}
      <div className="glass-card rounded-2xl p-4 border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-medium">Category:</span>
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="rounded-lg bg-slate-900 border border-slate-700 px-2.5 py-1 text-slate-200 text-xs focus:outline-none"
            >
              <option value="all">All Store Departments</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {reportType === 'upcoming' && (
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-medium">Window:</span>
              <select
                value={customDaysWindow}
                onChange={e => setCustomDaysWindow(Number(e.target.value))}
                className="rounded-lg bg-slate-900 border border-slate-700 px-2.5 py-1 text-slate-200 text-xs focus:outline-none"
              >
                <option value={7}>Within 7 Days (Critical/Urgent)</option>
                <option value={15}>Within 15 Days</option>
                <option value={30}>Within 30 Days</option>
                <option value={60}>Within 60 Days</option>
              </select>
            </div>
          )}
        </div>

        <div className="text-slate-400 text-[11px]">
          Showing <strong>{rows.length}</strong> record(s)
        </div>
      </div>

      {/* Summary KPI Cards for this Report */}
      {summaryStats && summaryStats.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {summaryStats.map((stat, i) => (
            <div key={i} className="glass-card rounded-2xl p-4 border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">{stat.label}</span>
              <div className="text-lg sm:text-xl font-black text-white mt-0.5">{stat.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Live Report Preview Table */}
      <div className="glass-card rounded-2xl border border-slate-800 overflow-hidden">
        <div className="p-4 border-b border-slate-800 bg-slate-950/40">
          <h3 className="text-sm font-bold text-white">{title}</h3>
          <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
        </div>

        <div className="overflow-x-auto max-h-[500px]">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800 sticky top-0 z-10">
              <tr>
                {headers.map((h, idx) => (
                  <th key={idx} className="py-2.5 px-3 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={headers.length} className="py-8 text-center text-slate-500">
                    No records found matching this report criteria.
                  </td>
                </tr>
              ) : (
                rows.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-slate-800/40 transition">
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} className="py-2 px-3 whitespace-nowrap text-slate-200">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
