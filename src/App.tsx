import React, { useEffect, useState, useCallback } from 'react';
import { 
  getAllProducts, 
  getAllMovements, 
  getAllNotifications, 
  getSettings, 
  saveProduct, 
  deleteProduct, 
  addStockMovement, 
  saveSettings, 
  markNotificationAsRead, 
  markAllNotificationsAsRead, 
  clearReadNotifications 
} from './db/indexedDB';
import { ExpiryNotification, NotificationSettings, Product, StockMovement } from './types/inventory';
import { runExpiryNotificationScan } from './utils/notificationEngine';
import { Navbar } from './components/layout/Navbar';
import { BottomNav } from './components/layout/BottomNav';
import { DashboardView } from './components/dashboard/DashboardView';
import { ProductListView } from './components/products/ProductListView';
import { ProductModal } from './components/products/ProductModal';
import { ProductDetailModal } from './components/products/ProductDetailModal';
import { InventoryOpsView } from './components/inventory/InventoryOpsView';
import { FEFOGuideView } from './components/fefo/FEFOGuideView';
import { ReportsView } from './components/reports/ReportsView';
import { NotificationCenterView } from './components/notifications/NotificationCenterView';
import { SettingsView } from './components/settings/SettingsView';
import { BarcodeScannerModal } from './components/scanner/BarcodeScannerModal';
import { OfflineIndicator } from './components/pwa/OfflineIndicator';

export default function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [notifications, setNotifications] = useState<ExpiryNotification[]>([]);
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [loading, setLoading] = useState(true);

  // Active navigation
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [productFilter, setProductFilter] = useState<string>('all');

  // Modals
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
  const [productToEdit, setProductToEdit] = useState<Product | null>(null);
  const [selectedProductDetail, setSelectedProductDetail] = useState<Product | null>(null);

  // Theme
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('shelfguard_theme') as 'dark' | 'light') || 'dark';
    }
    return 'dark';
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('shelfguard_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Load all initial data from IndexedDB
  const loadDatabase = useCallback(async () => {
    try {
      const [prods, moves, notifs, stt] = await Promise.all([
        getAllProducts(),
        getAllMovements(),
        getAllNotifications(),
        getSettings(),
      ]);

      setProducts(prods);
      setMovements(moves);
      setNotifications(notifs);
      setSettings(stt);

      // Run initial expiry notification scan
      if (stt) {
        const scanRes = await runExpiryNotificationScan(prods, stt);
        setNotifications(scanRes.notifications);
      }
    } catch (err) {
      console.error('Failed to load IndexedDB:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDatabase();

    // Re-scan when tab gains focus
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && settings) {
        runExpiryNotificationScan(products, settings).then(res => {
          setNotifications(res.notifications);
        });
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [loadDatabase]);

  // Handlers
  const handleSaveProduct = async (updatedProduct: Product) => {
    await saveProduct(updatedProduct);
    const updatedList = products.some(p => p.id === updatedProduct.id)
      ? products.map(p => (p.id === updatedProduct.id ? updatedProduct : p))
      : [updatedProduct, ...products];

    setProducts(updatedList);

    // If modal is open for this product, update it
    if (selectedProductDetail?.id === updatedProduct.id) {
      setSelectedProductDetail(updatedProduct);
    }

    if (settings) {
      const scanRes = await runExpiryNotificationScan(updatedList, settings);
      setNotifications(scanRes.notifications);
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    await deleteProduct(productId);
    const updatedList = products.filter(p => p.id !== productId);
    setProducts(updatedList);
    if (selectedProductDetail?.id === productId) {
      setSelectedProductDetail(null);
    }
  };

  const handleArchiveToggle = async (product: Product) => {
    const updated = { ...product, isArchived: !product.isArchived };
    await handleSaveProduct(updated);
  };

  const handleAddMovement = async (movement: StockMovement) => {
    await addStockMovement(movement);
    setMovements(prev => [movement, ...prev]);
  };

  const handleMarkAsRead = async (id: string) => {
    await markNotificationAsRead(id);
    setNotifications(prev => prev.map(n => (n.id === id ? { ...n, read: true } : n)));
  };

  const handleMarkAllAsRead = async () => {
    await markAllNotificationsAsRead();
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const handleClearRead = async () => {
    await clearReadNotifications();
    setNotifications(prev => prev.filter(n => !n.read));
  };

  const handleUpdateSettings = async (newSettings: NotificationSettings) => {
    setSettings(newSettings);
    await saveSettings(newSettings);
  };

  const handleNavigateTab = (tab: string, filter?: string) => {
    setActiveTab(tab);
    if (filter) {
      setProductFilter(filter);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenEditModal = (product: Product) => {
    setProductToEdit(product);
    setIsAddEditModalOpen(true);
  };

  const handleOpenAddModal = () => {
    setProductToEdit(null);
    setIsAddEditModalOpen(true);
  };

  const handleProductFoundFromScanner = (product: Product) => {
    setSelectedProductDetail(product);
  };

  const unreadNotifsCount = notifications.filter(n => !n.read).length;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-100">
        <div className="w-12 h-12 rounded-2xl border-2 border-emerald-500 border-t-transparent animate-spin mb-4" />
        <h2 className="text-base font-bold text-white tracking-tight">ShelfGuard Pro</h2>
        <p className="text-xs text-slate-400 mt-1">Initializing local database &amp; expiry scheduler...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-emerald-500/30 selection:text-emerald-200 flex flex-col font-sans">
      {/* Top Navbar */}
      <Navbar
        unreadNotifsCount={unreadNotifsCount}
        onOpenScanner={() => setIsScannerOpen(true)}
        onOpenAddModal={handleOpenAddModal}
        onNavigateTab={handleNavigateTab}
        activeTab={activeTab}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 pb-24 md:pb-12">
        {activeTab === 'dashboard' && (
          <DashboardView
            products={products}
            onNavigateTab={handleNavigateTab}
            onOpenAddModal={handleOpenAddModal}
            onOpenScanner={() => setIsScannerOpen(true)}
            onSelectProduct={prod => setSelectedProductDetail(prod)}
          />
        )}

        {activeTab === 'products' && (
          <ProductListView
            products={products}
            activeFilter={productFilter}
            onFilterChange={f => setProductFilter(f)}
            onSelectProduct={prod => setSelectedProductDetail(prod)}
            onOpenAddModal={handleOpenAddModal}
            onOpenScanner={() => setIsScannerOpen(true)}
          />
        )}

        {activeTab === 'inventory' && (
          <InventoryOpsView
            products={products}
            movements={movements}
            onSaveProduct={handleSaveProduct}
            onAddMovement={handleAddMovement}
          />
        )}

        {activeTab === 'fefo' && (
          <FEFOGuideView
            products={products}
            onSaveProduct={handleSaveProduct}
            onAddMovement={handleAddMovement}
            onOpenScanner={() => setIsScannerOpen(true)}
          />
        )}

        {activeTab === 'reports' && (
          <ReportsView
            products={products}
            movements={movements}
          />
        )}

        {activeTab === 'notifications' && (
          <NotificationCenterView
            notifications={notifications}
            settings={settings || ({} as any)}
            products={products}
            onMarkAsRead={handleMarkAsRead}
            onMarkAllAsRead={handleMarkAllAsRead}
            onClearRead={handleClearRead}
            onUpdateSettings={handleUpdateSettings}
            onSelectProduct={prod => setSelectedProductDetail(prod)}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            settings={settings || ({} as any)}
            onUpdateSettings={handleUpdateSettings}
            products={products}
            onReloadData={loadDatabase}
            theme={theme}
            onToggleTheme={toggleTheme}
          />
        )}
      </main>

      {/* Offline Toast Banner */}
      <OfflineIndicator />

      {/* Bottom Mobile Thumb Navigation Bar */}
      <BottomNav
        activeTab={activeTab}
        onNavigateTab={handleNavigateTab}
        unreadNotifsCount={unreadNotifsCount}
      />

      {/* Modals */}
      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        products={products}
        onProductFound={handleProductFoundFromScanner}
      />

      <ProductModal
        isOpen={isAddEditModalOpen}
        onClose={() => {
          setIsAddEditModalOpen(false);
          setProductToEdit(null);
        }}
        onSave={handleSaveProduct}
        productToEdit={productToEdit}
      />

      <ProductDetailModal
        product={selectedProductDetail}
        isOpen={Boolean(selectedProductDetail)}
        onClose={() => setSelectedProductDetail(null)}
        onEdit={prod => {
          setSelectedProductDetail(null);
          handleOpenEditModal(prod);
        }}
        onSaveProduct={handleSaveProduct}
        onAddMovement={handleAddMovement}
        onArchiveToggle={handleArchiveToggle}
        onDeleteProduct={handleDeleteProduct}
      />
    </div>
  );
}
