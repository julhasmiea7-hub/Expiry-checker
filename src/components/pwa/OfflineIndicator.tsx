import React from 'react';
import { WifiOff, Database } from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-20 md:bottom-6 left-4 z-40 flex items-center gap-2 rounded-xl bg-amber-950/90 border border-amber-500/40 px-3.5 py-2 text-xs font-medium text-amber-200 shadow-xl backdrop-blur-md animate-in slide-in-from-bottom-2 duration-300">
      <WifiOff className="w-4 h-4 text-amber-400 animate-pulse" />
      <div>
        <span className="font-semibold">Offline Mode</span>
        <span className="text-amber-300/80 hidden sm:inline"> — Running from local IndexedDB storage. Changes are saved locally.</span>
      </div>
      <div className="flex items-center gap-1 text-[10px] bg-amber-500/20 px-2 py-0.5 rounded text-amber-300 ml-1">
        <Database className="w-3 h-3" />
        <span>Cached</span>
      </div>
    </div>
  );
};
