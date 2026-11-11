import React, { useEffect, useRef, useState } from 'react';
import { Camera, X, Zap, RefreshCw, Barcode, CheckCircle, Search, AlertCircle } from 'lucide-react';
import { Product } from '../../types/inventory';
import { playBarcodeBeep, playSuccessChime } from '../../utils/audioAlert';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onProductFound: (product: Product, barcode: string) => void;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  products,
  onProductFound,
}) => {
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [flashOn, setFlashOn] = useState(false);
  const [matchedProduct, setMatchedProduct] = useState<Product | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
      setManualCode('');
      setMatchedProduct(null);
      setCameraError(null);
    }
    return () => {
      stopCamera();
    };
  }, [isOpen]);

  const startCamera = async () => {
    setCameraError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access is not supported by your browser.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setCameraActive(true);

      // Start BarcodeDetector loop if supported
      startDetectionLoop();
    } catch (err: any) {
      console.warn('Camera failed to start:', err);
      setCameraError(err.message || 'Unable to access camera.');
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (scanIntervalRef.current) {
      window.clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    setCameraActive(false);
  };

  const toggleFlash = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (track) {
      try {
        const capabilities = track.getCapabilities ? (track.getCapabilities() as any) : {};
        if (capabilities.torch) {
          await (track as any).applyConstraints({
            advanced: [{ torch: !flashOn }],
          });
          setFlashOn(!flashOn);
        } else {
          alert('Flash/Torch is not supported on this device.');
        }
      } catch (e) {
        console.warn('Flash toggle failed', e);
      }
    }
  };

  const handleBarcodeIdentified = (code: string) => {
    playBarcodeBeep();
    const clean = code.trim().toLowerCase();
    const found = products.find(
      p => (p.barcode && p.barcode.toLowerCase() === clean) ||
           (p.sku && p.sku.toLowerCase() === clean)
    );

    if (found) {
      playSuccessChime();
      setMatchedProduct(found);
      setTimeout(() => {
        onProductFound(found, code);
        onClose();
      }, 700);
    } else {
      setMatchedProduct(null);
    }
  };

  const startDetectionLoop = () => {
    if (typeof window === 'undefined') return;
    const BarcodeDetectorClass = (window as any).BarcodeDetector;

    if (BarcodeDetectorClass) {
      try {
        const detector = new BarcodeDetectorClass({
          formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code'],
        });

        scanIntervalRef.current = window.setInterval(async () => {
          if (!videoRef.current || videoRef.current.readyState < 2) return;
          try {
            const barcodes = await detector.detect(videoRef.current);
            if (barcodes && barcodes.length > 0) {
              const detectedValue = barcodes[0].rawValue;
              if (detectedValue) {
                handleBarcodeIdentified(detectedValue);
              }
            }
          } catch {
            // detection frame skip
          }
        }, 300);
      } catch (e) {
        console.warn('BarcodeDetector setup failed', e);
      }
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    handleBarcodeIdentified(manualCode.trim());
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-700/80 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
              <Barcode className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Live Barcode Scanner</h2>
              <p className="text-xs text-slate-400">Scan product barcode or enter SKU</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewfinder Area */}
        <div className="relative bg-black flex-1 min-h-[260px] max-h-[340px] flex items-center justify-center overflow-hidden">
          {cameraActive ? (
            <>
              <video
                ref={videoRef}
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              {/* Aiming Reticle */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-8">
                <div className="relative w-64 h-44 rounded-xl border-2 border-emerald-400/80 shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                  {/* Scanning Laser Line */}
                  <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_8px_#34d399] animate-[bounce_2s_infinite]" />
                  {/* Corner notches */}
                  <div className="absolute -top-1.5 -left-1.5 w-4 h-4 border-t-4 border-l-4 border-emerald-400" />
                  <div className="absolute -top-1.5 -right-1.5 w-4 h-4 border-t-4 border-r-4 border-emerald-400" />
                  <div className="absolute -bottom-1.5 -left-1.5 w-4 h-4 border-b-4 border-l-4 border-emerald-400" />
                  <div className="absolute -bottom-1.5 -right-1.5 w-4 h-4 border-b-4 border-r-4 border-emerald-400" />
                </div>
              </div>

              {/* Torch button */}
              <button
                onClick={toggleFlash}
                className={`absolute top-4 right-4 p-2.5 rounded-full backdrop-blur-md transition ${
                  flashOn ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-black/50 text-white hover:bg-black/70'
                }`}
                title="Toggle Torch"
              >
                <Zap className="w-4 h-4" />
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 mb-3">
                <Camera className="w-8 h-8" />
              </div>
              <p className="text-sm text-slate-300 font-medium">Camera viewfinder inactive</p>
              {cameraError && (
                <p className="text-xs text-rose-400 max-w-xs mt-1.5">{cameraError}</p>
              )}
              <button
                onClick={startCamera}
                className="mt-4 flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Start Camera
              </button>
            </div>
          )}

          {/* Matched Overlay Banner */}
          {matchedProduct && (
            <div className="absolute inset-0 bg-emerald-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center animate-in zoom-in-95">
              <CheckCircle className="w-12 h-12 text-emerald-400 mb-2 animate-bounce" />
              <div className="text-xs uppercase tracking-wider text-emerald-400 font-bold">Product Identified</div>
              <h3 className="text-lg font-bold text-white mt-1">{matchedProduct.name}</h3>
              <p className="text-xs text-emerald-200 mt-0.5">SKU: {matchedProduct.sku} • {matchedProduct.location}</p>
            </div>
          )}
        </div>

        {/* Manual Barcode & Quick Simulator */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 space-y-4">
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={manualCode}
                onChange={e => setManualCode(e.target.value)}
                placeholder="Type barcode or SKU (e.g. 071234500112)..."
                className="w-full rounded-xl bg-slate-800 border border-slate-700 pl-9 pr-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition"
            >
              Lookup
            </button>
          </form>

          {/* Supermarket Barcode Quick-Sim Chips */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Simulate Store Barcode Scan
              </span>
              <span className="text-[10px] text-slate-500">Click to instantly scan:</span>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
              {products.slice(0, 6).map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleBarcodeIdentified(p.barcode || p.sku)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700/60 text-[11px] text-slate-200 text-left transition active:scale-95"
                >
                  <span>{p.image || '📦'}</span>
                  <span className="truncate max-w-[120px] font-medium">{p.name}</span>
                  <span className="text-[10px] text-emerald-400 font-mono">[{p.barcode?.slice(-4) || p.sku}]</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
