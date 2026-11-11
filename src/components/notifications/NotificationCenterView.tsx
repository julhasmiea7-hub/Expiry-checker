import React, { useState } from 'react';
import { 
  Bell, 
  Check, 
  CheckCheck, 
  Trash2, 
  AlertTriangle, 
  Clock, 
  ShieldAlert, 
  TrendingDown, 
  Volume2, 
  VolumeX, 
  Send, 
  Sparkles,
  Layers,
  ArrowRight
} from 'lucide-react';
import { ExpiryNotification, NotificationSettings, Product } from '../../types/inventory';
import { formatExpiryRelative } from '../../utils/expiry';
import { sendTestNotification } from '../../utils/notificationEngine';

interface NotificationCenterViewProps {
  notifications: ExpiryNotification[];
  settings: NotificationSettings;
  products: Product[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onClearRead: () => void;
  onUpdateSettings: (settings: NotificationSettings) => void;
  onSelectProduct: (product: Product) => void;
}

export const NotificationCenterView: React.FC<NotificationCenterViewProps> = ({
  notifications,
  settings,
  products,
  onMarkAsRead,
  onMarkAllAsRead,
  onClearRead,
  onUpdateSettings,
  onSelectProduct,
}) => {
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [testSent, setTestSent] = useState(false);

  const unreadCount = notifications.filter(n => !n.read).length;

  const filteredNotifications = notifications.filter(n => {
    if (filterSeverity === 'unread') return !n.read;
    if (filterSeverity === 'critical') return n.severity === 'critical';
    if (filterSeverity === 'urgent') return n.severity === 'urgent';
    if (filterSeverity === 'warning') return n.severity === 'warning';
    if (filterSeverity === 'low_stock') return n.type === 'low_stock';
    return true;
  });

  const handleTestAlert = async () => {
    await sendTestNotification(settings);
    setTestSent(true);
    setTimeout(() => setTestSent(false), 3000);
  };

  const handleProductNavigate = (productId?: string) => {
    if (!productId) return;
    const prod = products.find(p => p.id === productId);
    if (prod) {
      onSelectProduct(prod);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-white">Supermarket Notification Center</h2>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white text-xs font-bold animate-pulse">
                {unreadCount} Unread
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400">
            Real-time feed of expired items, upcoming shelf expiries, and minimum stock alerts.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleTestAlert}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition active:scale-95"
            title="Send Immediate Sound & Push Test"
          >
            <Send className="w-3.5 h-3.5 text-emerald-400" />
            <span>{testSent ? 'Alert Dispatched!' : 'Test Notification'}</span>
          </button>

          {unreadCount > 0 && (
            <button
              onClick={onMarkAllAsRead}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition"
            >
              <CheckCheck className="w-4 h-4 text-emerald-400" />
              <span>Mark All Read</span>
            </button>
          )}

          <button
            onClick={onClearRead}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700 transition"
            title="Clear Read Notifications"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filter Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
        {[
          { id: 'all', label: 'All Alerts', count: notifications.length },
          { id: 'unread', label: 'Unread Only', count: unreadCount, highlight: 'bg-rose-500/20 text-rose-300' },
          { id: 'critical', label: 'Critical / Expired', count: notifications.filter(n => n.severity === 'critical').length, highlight: 'bg-red-500/20 text-red-300' },
          { id: 'urgent', label: 'Urgent (1–6d)', count: notifications.filter(n => n.severity === 'urgent').length, highlight: 'bg-amber-500/20 text-amber-300' },
          { id: 'warning', label: '15–30d Warning', count: notifications.filter(n => n.severity === 'warning').length },
          { id: 'low_stock', label: 'Low Stock', count: notifications.filter(n => n.type === 'low_stock').length },
        ].map(chip => (
          <button
            key={chip.id}
            onClick={() => setFilterSeverity(chip.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium whitespace-nowrap transition ${
              filterSeverity === chip.id
                ? 'bg-emerald-600 text-white font-bold shadow-md shadow-emerald-950/40'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
            }`}
          >
            <span>{chip.label}</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${chip.highlight || 'bg-slate-800 text-slate-400'}`}>
              {chip.count}
            </span>
          </button>
        ))}
      </div>

      {/* Notifications Feed */}
      {filteredNotifications.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center border border-slate-800">
          <Bell className="w-10 h-10 text-slate-500 mx-auto mb-2" />
          <h4 className="text-sm font-bold text-white">No Notifications</h4>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            You are all caught up! No active expiry alerts or stock warnings currently in this view.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredNotifications.map(notif => {
            let borderClass = 'border-slate-800';
            let iconBg = 'bg-slate-800 text-slate-300';
            let IconComponent = Bell;

            if (notif.severity === 'critical') {
              borderClass = 'border-rose-500/40 bg-rose-950/15';
              iconBg = 'bg-rose-500/20 text-rose-400';
              IconComponent = ShieldAlert;
            } else if (notif.severity === 'urgent') {
              borderClass = 'border-amber-500/40 bg-amber-950/15';
              iconBg = 'bg-amber-500/20 text-amber-400';
              IconComponent = AlertTriangle;
            } else if (notif.type === 'low_stock') {
              borderClass = 'border-purple-500/40 bg-purple-950/15';
              iconBg = 'bg-purple-500/20 text-purple-400';
              IconComponent = TrendingDown;
            }

            return (
              <div
                key={notif.id}
                className={`glass-card rounded-2xl p-4 border ${borderClass} transition flex items-start justify-between gap-3 ${
                  !notif.read ? 'ring-1 ring-emerald-500/30' : 'opacity-85'
                }`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${iconBg}`}>
                    <IconComponent className="w-5 h-5" />
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-xs font-bold text-white">{notif.title}</h4>
                      {!notif.read && (
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      )}
                    </div>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                      {notif.message}
                    </p>
                    <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-2">
                      <span className="font-mono">
                        {new Date(notif.timestamp).toLocaleDateString()} {new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {notif.productId && (
                        <button
                          onClick={() => handleProductNavigate(notif.productId)}
                          className="text-emerald-400 hover:underline font-semibold flex items-center gap-1"
                        >
                          View Product <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {!notif.read && (
                  <button
                    onClick={() => onMarkAsRead(notif.id)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition flex-shrink-0"
                    title="Mark as Read"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
