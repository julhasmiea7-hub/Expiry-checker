import React from 'react';
import { 
  ShieldCheck, 
  Barcode, 
  Bell, 
  Sun, 
  Moon, 
  Wifi, 
  WifiOff, 
  Plus,
  Zap
} from 'lucide-react';
import { PWAInstallButton } from '../pwa/PWAInstallButton';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

interface NavbarProps {
  unreadNotifsCount: number;
  onOpenScanner: () => void;
  onOpenAddModal: () => void;
  onNavigateTab: (tab: string) => void;
  activeTab: string;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  unreadNotifsCount,
  onOpenScanner,
  onOpenAddModal,
  onNavigateTab,
  activeTab,
  theme,
  onToggleTheme,
}) => {
  const isOnline = useOnlineStatus();

  return (
    <header className="sticky top-0 z-30 w-full glass-panel border-b border-slate-800/80 px-4 sm:px-6 py-3 transition-colors">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        {/* Brand */}
        <div 
          onClick={() => onNavigateTab('dashboard')} 
          className="flex items-center gap-2.5 cursor-pointer group"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-cyan-400 p-0.5 shadow-lg shadow-emerald-950/40 group-hover:scale-105 transition">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm sm:text-base font-extrabold text-white tracking-tight">
                Shelf<span className="text-emerald-400">Guard</span>
              </span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                PRO
              </span>
            </div>
            <p className="text-[10px] text-slate-400 hidden sm:block">
              Expiry &amp; Inventory Management
            </p>
          </div>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-1 text-xs">
          {[
            { id: 'dashboard', label: 'Dashboard' },
            { id: 'products', label: 'Products & Batches' },
            { id: 'inventory', label: 'Stock Ops' },
            { id: 'fefo', label: 'FEFO Rotation' },
            { id: 'reports', label: 'Reports' },
            { id: 'notifications', label: 'Alerts', badge: unreadNotifsCount },
            { id: 'settings', label: 'Settings' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => onNavigateTab(tab.id)}
              className={`px-3 py-1.5 rounded-xl font-medium transition relative ${
                activeTab === tab.id
                  ? 'bg-slate-800 text-white font-bold shadow-inner'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <span>{tab.label}</span>
              {Boolean(tab.badge && tab.badge > 0) && (
                <span className="ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] bg-rose-500 text-white font-bold animate-pulse">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Right Action Icons */}
        <div className="flex items-center gap-2">
          {/* Quick Barcode Scanner Button */}
          <button
            onClick={onOpenScanner}
            className="flex items-center gap-1.5 p-2 sm:px-3 sm:py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700/80 text-xs font-semibold shadow transition active:scale-95"
            title="Scan Product Barcode"
          >
            <Barcode className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">Scan</span>
          </button>

          {/* Quick Add Product */}
          <button
            onClick={onOpenAddModal}
            className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-950/40 transition active:scale-95 flex items-center gap-1"
            title="Add Product"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Add</span>
          </button>

          {/* Notification Center Trigger */}
          <button
            onClick={() => onNavigateTab('notifications')}
            className="relative p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700/80 transition"
            title="Notifications & Alerts"
          >
            <Bell className="w-4 h-4" />
            {unreadNotifsCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center animate-bounce">
                {unreadNotifsCount > 9 ? '9+' : unreadNotifsCount}
              </span>
            )}
          </button>

          {/* PWA Install Button */}
          <PWAInstallButton compact />

          {/* Theme Toggle */}
          <button
            onClick={onToggleTheme}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition"
            title="Toggle Dark/Light Mode"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-blue-400" />}
          </button>
        </div>
      </div>
    </header>
  );
};
