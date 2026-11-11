import React from 'react';
import { 
  LayoutDashboard, 
  Package, 
  ArrowLeftRight, 
  Zap, 
  FileText, 
  Bell, 
  Settings 
} from 'lucide-react';

interface BottomNavProps {
  activeTab: string;
  onNavigateTab: (tab: string) => void;
  unreadNotifsCount: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onNavigateTab,
  unreadNotifsCount,
}) => {
  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'products', label: 'Catalog', icon: Package },
    { id: 'inventory', label: 'Stock Ops', icon: ArrowLeftRight },
    { id: 'fefo', label: 'FEFO', icon: Zap },
    { id: 'reports', label: 'Reports', icon: FileText },
    { id: 'notifications', label: 'Alerts', icon: Bell, badge: unreadNotifsCount },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 glass-panel border-t border-slate-800/80 px-2 py-1.5 backdrop-blur-xl">
      <div className="flex items-center justify-around max-w-md mx-auto">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onNavigateTab(tab.id)}
              className={`flex flex-col items-center justify-center p-1.5 rounded-xl transition relative ${
                isActive ? 'text-emerald-400 font-bold scale-105' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="relative">
                <Icon className="w-5 h-5" />
                {typeof tab.badge === 'number' && tab.badge > 0 && (
                  <span className="absolute -top-1 -right-2 w-3.5 h-3.5 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center">
                    {tab.badge > 9 ? '9+' : tab.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] mt-0.5 tracking-tight font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
