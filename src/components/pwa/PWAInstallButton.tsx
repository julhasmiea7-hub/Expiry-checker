import React, { useState } from 'react';
import { Download, Smartphone, X, CheckCircle2 } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';

export const PWAInstallButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [installSuccess, setInstallSuccess] = useState(false);

  // If already running as standalone PWA
  if (isInstalled) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
        <CheckCircle2 className="w-3.5 h-3.5" />
        <span>Installed PWA</span>
      </div>
    );
  }

  const handleInstall = async () => {
    const success = await install();
    if (success) {
      setInstallSuccess(true);
      setTimeout(() => setInstallSuccess(false), 4000);
    }
  };

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <>
        <button
          onClick={handleInstall}
          className={`flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-medium shadow-lg shadow-emerald-950/40 transition-all ${
            compact ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-1.5 text-xs sm:text-sm'
          }`}
          title="Install ShelfGuard as an Android or Desktop App"
        >
          <Download className="w-4 h-4" />
          <span>{compact ? 'Install' : 'Install PWA'}</span>
        </button>

        {installSuccess && (
          <div className="fixed top-16 right-4 z-50 bg-emerald-600 text-white px-4 py-2 rounded-lg shadow-xl text-xs flex items-center gap-2 animate-bounce">
            <CheckCircle2 className="w-4 h-4" /> ShelfGuard App Installed Successfully!
          </div>
        )}
      </>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className={`flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 font-medium transition ${
            compact ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-1.5 text-xs'
          }`}
        >
          <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
          <span>Install iOS</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700 p-6 shadow-2xl text-slate-100 relative">
              <button
                onClick={() => setShowIOSGuide(false)}
                className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-4">
                <Smartphone className="w-6 h-6" />
              </div>

              <h3 className="text-lg font-bold">Install ShelfGuard on iOS</h3>
              <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                Add this application to your iPhone or iPad home screen for full-screen offline access:
              </p>

              <ol className="mt-4 space-y-3 text-xs text-slate-300">
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-800 border border-slate-700 text-emerald-400 flex items-center justify-center font-bold">1</span>
                  <span>Tap the <strong>Share</strong> icon in the Safari bottom toolbar.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-800 border border-slate-700 text-emerald-400 flex items-center justify-center font-bold">2</span>
                  <span>Scroll down the action sheet and select <strong>Add to Home Screen</strong>.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-800 border border-slate-700 text-emerald-400 flex items-center justify-center font-bold">3</span>
                  <span>Tap <strong>Add</strong> in the top-right corner.</span>
                </li>
              </ol>

              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-6 w-full rounded-xl bg-slate-800 hover:bg-slate-700 py-2.5 text-xs font-semibold text-slate-200 transition"
              >
                Got It
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  // Desktop or already available fallback button
  return (
    <button
      onClick={() => {
        alert('To install ShelfGuard, tap your browser menu (three dots or share icon) and select "Install App" or "Add to Home screen".');
      }}
      className={`hidden md:flex items-center gap-1.5 rounded-lg border border-slate-700/60 bg-slate-800/40 hover:bg-slate-800 px-3 py-1.5 text-xs text-slate-300 transition`}
    >
      <Download className="w-3.5 h-3.5 text-emerald-400" />
      <span>Install PWA</span>
    </button>
  );
};
