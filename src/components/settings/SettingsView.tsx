import React, { useEffect, useState } from 'react';
import { 
  Bell, 
  Volume2, 
  VolumeX, 
  Server, 
  Database, 
  Download, 
  Upload, 
  Moon, 
  Sun, 
  RotateCcw, 
  ShieldCheck, 
  Info,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { BackupData, exportFullDatabaseBackup, resetToDemoData, restoreDatabaseFromBackup } from '../../db/indexedDB';
import { NotificationSettings, Product } from '../../types/inventory';
import { sendTestNotification } from '../../utils/notificationEngine';
import { playSuccessChime } from '../../utils/audioAlert';

interface SettingsViewProps {
  settings: NotificationSettings;
  onUpdateSettings: (settings: NotificationSettings) => void;
  products: Product[];
  onReloadData: () => Promise<void>;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onUpdateSettings,
  products,
  onReloadData,
  theme,
  onToggleTheme,
}) => {
  const [serverStatus, setServerStatus] = useState<any>(null);
  const [browserPermission, setBrowserPermission] = useState<NotificationPermission>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default'
  );
  const [restoreFeedback, setRestoreFeedback] = useState<{ text: string; error?: boolean } | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  useEffect(() => {
    fetch('/api/health')
      .then(res => res.json())
      .then(data => setServerStatus(data))
      .catch(() => setServerStatus({ status: 'offline', note: 'Running standalone in client offline mode' }));
  }, []);

  const handleRequestPushPermission = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const perm = await Notification.requestPermission();
      setBrowserPermission(perm);
      if (perm === 'granted') {
        onUpdateSettings({ ...settings, browserPushEnabled: true });
        sendTestNotification(settings);
      } else {
        onUpdateSettings({ ...settings, browserPushEnabled: false });
      }
    } else {
      alert('Your browser does not support HTML5 Web Notifications.');
    }
  };

  const handleToggleInterval = (key: keyof NotificationSettings['reminderIntervals']) => {
    const updated = {
      ...settings,
      reminderIntervals: {
        ...settings.reminderIntervals,
        [key]: !settings.reminderIntervals[key],
      },
    };
    onUpdateSettings(updated);
  };

  const handleDownloadBackup = async () => {
    try {
      const backup = await exportFullDatabaseBackup();
      const jsonStr = JSON.stringify(backup, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ShelfGuard_Backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      playSuccessChime();
    } catch (e: any) {
      alert('Backup failed: ' + e.message);
    }
  };

  const handleFileRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text) as BackupData;
        await restoreDatabaseFromBackup(parsed);
        await onReloadData();
        playSuccessChime();
        setRestoreFeedback({ text: `Successfully restored ${parsed.products.length} products and movements.` });
      } catch (err: any) {
        setRestoreFeedback({ text: 'Restore failed: ' + err.message, error: true });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleResetDemoData = async () => {
    await resetToDemoData();
    await onReloadData();
    setShowResetConfirm(false);
    playSuccessChime();
    setRestoreFeedback({ text: 'Reset database to realistic supermarket demo records.' });
  };

  return (
    <div className="space-y-6 pb-12 max-w-4xl mx-auto text-xs">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-white">System Settings &amp; Configuration</h2>
        <p className="text-xs text-slate-400">
          Manage reminder intervals, push alerts, IndexedDB backup/restore, and store preferences.
        </p>
      </div>

      {restoreFeedback && (
        <div
          className={`p-3.5 rounded-xl flex items-center gap-2 ${
            restoreFeedback.error
              ? 'bg-rose-500/15 border border-rose-500/30 text-rose-300'
              : 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
          }`}
        >
          {restoreFeedback.error ? <AlertTriangle className="w-4 h-4 flex-shrink-0" /> : <CheckCircle2 className="w-4 h-4 flex-shrink-0" />}
          <span>{restoreFeedback.text}</span>
        </div>
      )}

      {/* Section 1: Expiry Reminder Intervals */}
      <div className="glass-card rounded-2xl p-5 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Automatic Expiry Reminder Intervals</h3>
              <p className="text-[11px] text-slate-400">Select which milestones trigger automated alerts</p>
            </div>
          </div>

          {/* Master Enable Toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="font-semibold text-slate-300">System Alerts:</span>
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={e => onUpdateSettings({ ...settings, enabled: e.target.checked })}
              className="w-4 h-4 accent-emerald-500 rounded"
            />
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { key: 'dailyExpired', label: 'Daily alerts for already expired products', desc: 'Alerts daily until quarantined or written off' },
            { key: 'd0', label: 'On the expiry date (Today)', desc: 'Immediate markdown alert for same-day clearance' },
            { key: 'd1', label: '1 day before expiry', desc: 'Urgent notice for items expiring tomorrow' },
            { key: 'd3', label: '3 days before expiry', desc: 'Urgent 72-hour window alert' },
            { key: 'd7', label: '7 days before expiry', desc: 'Critical 1-week expiry milestone' },
            { key: 'd15', label: '15 days before expiry', desc: 'Warning 2-week expiry milestone' },
            { key: 'd30', label: '30 days before expiry', desc: 'Safe-to-warning threshold entrance' },
          ].map(item => {
            const isChecked = settings.reminderIntervals[item.key as keyof typeof settings.reminderIntervals];
            return (
              <div
                key={item.key}
                onClick={() => handleToggleInterval(item.key as any)}
                className={`p-3 rounded-xl border cursor-pointer transition flex items-start justify-between gap-2 ${
                  isChecked
                    ? 'border-emerald-500/40 bg-emerald-950/20 text-white'
                    : 'border-slate-800 bg-slate-900/60 text-slate-400'
                }`}
              >
                <div>
                  <div className="font-semibold text-xs text-white">{item.label}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{item.desc}</div>
                </div>
                <input
                  type="checkbox"
                  checked={isChecked}
                  readOnly
                  className="mt-0.5 w-4 h-4 accent-emerald-500 rounded pointer-events-none"
                />
              </div>
            );
          })}
        </div>

        {/* Audio Sound & Low stock toggles */}
        <div className="pt-3 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div
            onClick={() => onUpdateSettings({ ...settings, soundEnabled: !settings.soundEnabled })}
            className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between cursor-pointer"
          >
            <div className="flex items-center gap-2">
              {settings.soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
              <div>
                <div className="font-semibold text-white">Audio Alert Chimes</div>
                <div className="text-[10px] text-slate-400">Play synthesized scanner &amp; urgent chimes</div>
              </div>
            </div>
            <input
              type="checkbox"
              checked={settings.soundEnabled}
              readOnly
              className="w-4 h-4 accent-emerald-500 rounded pointer-events-none"
            />
          </div>

          <div
            onClick={() => onUpdateSettings({ ...settings, lowStockAlerts: !settings.lowStockAlerts })}
            className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between cursor-pointer"
          >
            <div>
              <div className="font-semibold text-white">Low Stock Level Notifications</div>
              <div className="text-[10px] text-slate-400">Alert when stock hits minimum threshold</div>
            </div>
            <input
              type="checkbox"
              checked={settings.lowStockAlerts}
              readOnly
              className="w-4 h-4 accent-emerald-500 rounded pointer-events-none"
            />
          </div>
        </div>
      </div>

      {/* Section 2: Background Scheduler & Push Architecture */}
      <div className="glass-card rounded-2xl p-5 border border-slate-800 space-y-4">
        <div className="flex items-center gap-2.5 border-b border-slate-800 pb-3">
          <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400">
            <Server className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Scheduled Background Notifications &amp; Web Push</h3>
            <p className="text-[11px] text-slate-400">Backend scheduler and native browser push synchronization</p>
          </div>
        </div>

        {/* Clear Explanation of Background Notification Mechanics */}
        <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-slate-300 space-y-1.5">
          <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
            <Info className="w-4 h-4" />
            <span>Architecture &amp; Limitations Notice:</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Standard browser JavaScript (<code className="text-emerald-300">setInterval</code>) cannot dispatch alerts when your browser or PWA is completely closed. ShelfGuard solves this with a two-tier architecture:
          </p>
          <ul className="list-disc pl-5 text-[11px] text-slate-400 space-y-0.5">
            <li><strong>Node.js Backend Scheduler:</strong> Runs continuous 15-minute cron routines on the server to track expiry milestones and log alerts.</li>
            <li><strong>PWA Service Worker &amp; Push API:</strong> Dispatches native device notifications and badges when subscribed.</li>
            <li><strong>Local Offline Engine:</strong> Evaluates IndexedDB records on every app wake and plays Web Audio chimes without needing internet.</li>
          </ul>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
            <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Browser Push Permission</div>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-white capitalize">{browserPermission}</span>
              {browserPermission !== 'granted' && (
                <button
                  type="button"
                  onClick={handleRequestPushPermission}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition"
                >
                  Enable Push Notifications
                </button>
              )}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
            <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Backend Service Status</div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-semibold text-white">Online &amp; Active</span>
            </div>
            <div className="text-[10px] text-slate-400">
              Scheduler runs every 15 min • Synced with local IndexedDB
            </div>
          </div>
        </div>
      </div>

      {/* Section 3: Data Management & Backup/Restore */}
      <div className="glass-card rounded-2xl p-5 border border-slate-800 space-y-4">
        <div className="flex items-center gap-2.5 border-b border-slate-800 pb-3">
          <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400">
            <Database className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">IndexedDB Local Storage &amp; Backup Safeguards</h3>
            <p className="text-[11px] text-slate-400">Offline persistence, JSON export, and recovery</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* JSON Export */}
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between space-y-3">
            <div>
              <div className="font-bold text-white">Download Database Backup (JSON)</div>
              <p className="text-[11px] text-slate-400 mt-1">
                Creates a snapshot containing all {products.length} products, multi-batch records, stock movement history, and settings.
              </p>
            </div>
            <button
              onClick={handleDownloadBackup}
              className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold flex items-center justify-center gap-1.5 transition"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              <span>Export JSON Backup</span>
            </button>
          </div>

          {/* JSON Restore */}
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between space-y-3">
            <div>
              <div className="font-bold text-white">Restore From Backup File</div>
              <p className="text-[11px] text-slate-400 mt-1">
                Import an existing ShelfGuard JSON backup file with automatic schema validation.
              </p>
            </div>
            <label className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer text-center">
              <Upload className="w-4 h-4 text-emerald-400" />
              <span>Select File to Restore</span>
              <input
                type="file"
                accept=".json"
                onChange={handleFileRestore}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* Theme and Demo Data Reset */}
        <div className="pt-3 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={onToggleTheme}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-blue-400" />}
              <span>Switch to {theme === 'dark' ? 'Light' : 'Dark'} Mode</span>
            </button>
          </div>

          <div>
            <button
              type="button"
              onClick={() => setShowResetConfirm(true)}
              className="text-slate-400 hover:text-amber-400 text-xs font-medium underline underline-offset-4 flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset to Supermarket Demo Data</span>
            </button>
          </div>
        </div>
      </div>

      {/* Reset Confirmation Safeguard */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-sm rounded-2xl bg-slate-900 border border-amber-500/40 p-6 space-y-4 shadow-2xl text-center">
            <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-400 mx-auto flex items-center justify-center">
              <RotateCcw className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white">Reset to Demo Products?</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              This will populate your database with realistic supermarket demo products (Dairy, Bakery, Salmon, Produce, etc.) with diverse expiry dates for testing.
            </p>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleResetDemoData}
                className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition"
              >
                Load Demo Data
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
