import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Camera,
  X,
  Flashlight,
  RefreshCw,
  Search,
  CheckCircle2,
  Volume2,
  VolumeX,
  Keyboard,
  Barcode,
  Sparkles,
  Layers,
  ArrowRight,
  Plus,
} from 'lucide-react';
import { BrowserMultiFormatReader, BarcodeFormat, DecodeHintType } from '@zxing/library';
import { InventoryItem } from '../types';

export interface BarcodeScanResult {
  barcode: string;
  format?: string;
  matchedProduct?: InventoryItem;
  scannedAt: string;
}

interface UniversalBarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string, matchedProduct?: InventoryItem) => void;
  title?: string;
  subtitle?: string;
  inventoryProducts?: InventoryItem[];
  continuousScan?: boolean;
  onBatchScanComplete?: (results: BarcodeScanResult[]) => void;
}

// Play audio beep using Web Audio API
function playScanBeep() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1800, ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.09);
  } catch (e) {
    // AudioContext blocked or not allowed yet
  }
}

// Trigger haptic vibration if available
function triggerHaptic() {
  try {
    if (navigator.vibrate) {
      navigator.vibrate([50, 30, 50]);
    }
  } catch (e) {}
}

export const UniversalBarcodeScannerModal: React.FC<UniversalBarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onScan,
  title = 'Scan Product Barcode',
  subtitle = 'Point camera at any barcode (EAN-13, UPC, Code 128, QR Code)',
  inventoryProducts = [],
  continuousScan = false,
  onBatchScanComplete,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const zxingReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const isScanningRef = useRef<boolean>(false);
  const lastScannedCodeRef = useRef<string>('');
  const lastScannedTimeRef = useRef<number>(0);

  const [cameraPermission, setCameraPermission] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [maxZoom, setMaxZoom] = useState<number>(1);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [manualCode, setManualCode] = useState('');
  const [activeTab, setActiveTab] = useState<'camera' | 'manual'>('camera');
  const [lastScannedResult, setLastScannedResult] = useState<BarcodeScanResult | null>(null);
  const [batchResults, setBatchResults] = useState<BarcodeScanResult[]>([]);
  const [scanFlash, setScanFlash] = useState(false);

  // Helper to find matched product
  const findProductByBarcode = useCallback(
    (code: string): InventoryItem | undefined => {
      if (!inventoryProducts || inventoryProducts.length === 0) return undefined;
      const clean = code.trim().toLowerCase();
      return inventoryProducts.find(
        (p) =>
          (p.barcode && p.barcode.toLowerCase() === clean) ||
          (p.productCode && p.productCode.toLowerCase() === clean) ||
          (p.barcode && p.barcode.replace(/\D/g, '') === clean.replace(/\D/g, ''))
      );
    },
    [inventoryProducts]
  );

  const handleBarcodeDetected = useCallback(
    (code: string, format = 'BARCODE') => {
      const now = Date.now();
      // Debounce duplicate scans within 1.5 seconds if continuous, or prevent repeat
      if (code === lastScannedCodeRef.current && now - lastScannedTimeRef.current < 1500) {
        return;
      }

      lastScannedCodeRef.current = code;
      lastScannedTimeRef.current = now;

      if (soundEnabled) {
        playScanBeep();
      }
      triggerHaptic();

      // Trigger visual laser flash
      setScanFlash(true);
      setTimeout(() => setScanFlash(false), 300);

      const matched = findProductByBarcode(code);
      const result: BarcodeScanResult = {
        barcode: code,
        format,
        matchedProduct: matched,
        scannedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      };

      setLastScannedResult(result);

      if (continuousScan) {
        setBatchResults((prev) => [result, ...prev]);
        onScan(code, matched);
      } else {
        onScan(code, matched);
        // Automatically close single scan after brief confirmation
        setTimeout(() => {
          onClose();
        }, 500);
      }
    },
    [continuousScan, findProductByBarcode, onClose, onScan, soundEnabled]
  );

  // Initialize Native BarcodeDetector if available
  const startNativeBarcodeDetectorLoop = useCallback(() => {
    if (!('BarcodeDetector' in window)) return false;

    try {
      const BarcodeDetectorClass = (window as any).BarcodeDetector;
      const detector = new BarcodeDetectorClass({
        formats: [
          'ean_13',
          'ean_8',
          'upc_a',
          'upc_e',
          'code_128',
          'code_39',
          'code_93',
          'itf',
          'qr_code',
          'data_matrix',
        ],
      });

      const detectFrame = async () => {
        if (!isScanningRef.current || !videoRef.current || videoRef.current.readyState < 2) {
          if (isScanningRef.current) {
            animFrameIdRef.current = requestAnimationFrame(detectFrame);
          }
          return;
        }

        try {
          const barcodes = await detector.detect(videoRef.current);
          if (barcodes && barcodes.length > 0) {
            const first = barcodes[0];
            if (first.rawValue) {
              handleBarcodeDetected(first.rawValue, first.format);
            }
          }
        } catch (e) {
          // Native detector frame error
        }

        if (isScanningRef.current) {
          animFrameIdRef.current = requestAnimationFrame(detectFrame);
        }
      };

      isScanningRef.current = true;
      animFrameIdRef.current = requestAnimationFrame(detectFrame);
      return true;
    } catch (e) {
      console.warn('Native BarcodeDetector initialization failed, falling back to ZXing:', e);
      return false;
    }
  }, [handleBarcodeDetected]);

  // Start ZXing fallback engine
  const startZXingDecoder = useCallback(() => {
    try {
      const hints = new Map<DecodeHintType, any>();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,
        BarcodeFormat.CODE_128,
        BarcodeFormat.CODE_39,
        BarcodeFormat.ITF,
        BarcodeFormat.QR_CODE,
      ]);
      hints.set(DecodeHintType.TRY_HARDER, true);

      const reader = new BrowserMultiFormatReader(hints);
      zxingReaderRef.current = reader;

      if (videoRef.current) {
        (reader as any).decodeFromVideoElement(videoRef.current, (result: any, err: any) => {
          if (result && typeof result.getText === 'function' && result.getText()) {
            handleBarcodeDetected(result.getText(), result.getBarcodeFormat()?.toString());
          }
        });
      }
    } catch (e) {
      console.error('ZXing decoder setup failed:', e);
    }
  }, [handleBarcodeDetected]);

  // Start Camera Stream
  const startCamera = useCallback(
    async (deviceId?: string) => {
      setErrorMessage(null);
      stopCamera();

      try {
        const constraints: MediaStreamConstraints = {
          audio: false,
          video: deviceId
            ? { deviceId: { exact: deviceId } }
            : {
                facingMode: { ideal: 'environment' },
                width: { ideal: 1280 },
                height: { ideal: 720 },
              },
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;
        setCameraPermission('granted');

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();

          // Check for torch and zoom capabilities
          const track = stream.getVideoTracks()[0];
          if (track) {
            const capabilities: any = track.getCapabilities ? track.getCapabilities() : {};
            if (capabilities.torch) {
              setHasTorch(true);
            }
            if (capabilities.zoom) {
              setMaxZoom(capabilities.zoom.max || 3);
            }
          }

          // Enumerate all available camera devices
          const allDevices = await navigator.mediaDevices.enumerateDevices();
          const videoInputs = allDevices.filter((d) => d.kind === 'videoinput');
          setDevices(videoInputs);

          if (!selectedDeviceId && videoInputs.length > 0) {
            const currentTrackId = track?.getSettings()?.deviceId;
            setSelectedDeviceId(currentTrackId || videoInputs[0].deviceId);
          }

          // Attempt high-speed native BarcodeDetector first, otherwise ZXing
          isScanningRef.current = true;
          const nativeSuccess = startNativeBarcodeDetectorLoop();
          if (!nativeSuccess) {
            startZXingDecoder();
          }
        }
      } catch (err: any) {
        console.error('Camera access error:', err);
        setCameraPermission('denied');
        setErrorMessage(
          err.name === 'NotAllowedError'
            ? 'Camera permission denied. Please enable camera access in browser settings to scan barcodes.'
            : err.message || 'Unable to access camera on this device.'
        );
      }
    },
    [selectedDeviceId, startNativeBarcodeDetectorLoop, startZXingDecoder]
  );

  const stopCamera = useCallback(() => {
    isScanningRef.current = false;
    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current);
      animFrameIdRef.current = null;
    }
    if (zxingReaderRef.current) {
      try {
        zxingReaderRef.current.reset();
      } catch (e) {}
      zxingReaderRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setTorchEnabled(false);
  }, []);

  // Toggle Torch/Flashlight
  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (track && hasTorch) {
      try {
        const next = !torchEnabled;
        await (track as any).applyConstraints({
          advanced: [{ torch: next }],
        });
        setTorchEnabled(next);
      } catch (e) {
        console.warn('Torch toggle failed:', e);
      }
    }
  };

  // Adjust Zoom
  const handleZoomChange = async (newZoom: number) => {
    setZoomLevel(newZoom);
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (track) {
      try {
        await (track as any).applyConstraints({
          advanced: [{ zoom: newZoom }],
        });
      } catch (e) {}
    }
  };

  // Handle Manual Code Submit
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    handleBarcodeDetected(manualCode.trim(), 'MANUAL_ENTRY');
    setManualCode('');
  };

  useEffect(() => {
    if (isOpen && activeTab === 'camera') {
      startCamera(selectedDeviceId);
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, activeTab, selectedDeviceId, startCamera, stopCamera]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-white flex items-center gap-2">
                {title}
                {continuousScan && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 font-bold uppercase tracking-wider">
                    Continuous Mode
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400">{subtitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Close scanner"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher: Camera Scanner vs Manual Keypad */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 p-1.5 gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab('camera')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'camera'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Camera className="w-4 h-4" />
            <span>Live Camera Scanner</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('manual')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'manual'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Keyboard className="w-4 h-4" />
            <span>Manual Barcode / SKU</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {activeTab === 'camera' ? (
            <div className="space-y-4">
              {/* Camera Viewport with Aiming Reticle */}
              <div className="relative aspect-4/3 w-full bg-black rounded-2xl overflow-hidden border border-slate-700 shadow-inner flex items-center justify-center">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />

                {/* Laser scan animation & reticle */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-6">
                  {/* Aiming Bracket Box */}
                  <div
                    className={`relative w-4/5 h-3/5 border-2 rounded-2xl transition-all duration-200 ${
                      scanFlash
                        ? 'border-emerald-400 bg-emerald-500/20 scale-105 shadow-[0_0_30px_rgba(52,211,153,0.6)]'
                        : 'border-blue-400/80 shadow-[0_0_15px_rgba(59,130,246,0.3)]'
                    }`}
                  >
                    {/* Corner Reticle Accents */}
                    <div className="absolute -top-1 -left-1 w-4 h-4 border-t-3 border-l-3 border-white rounded-tl-lg" />
                    <div className="absolute -top-1 -right-1 w-4 h-4 border-t-3 border-r-3 border-white rounded-tr-lg" />
                    <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-3 border-l-3 border-white rounded-bl-lg" />
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-3 border-r-3 border-white rounded-br-lg" />

                    {/* Red Laser Sweep Line */}
                    <div className="absolute left-2 right-2 top-1/2 -translate-y-1/2 h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent animate-pulse shadow-[0_0_8px_#ef4444]" />
                  </div>
                </div>

                {/* Top Controls Overlay inside Viewport */}
                <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-auto">
                  <div className="flex items-center gap-2">
                    {/* Flashlight toggle */}
                    {hasTorch && (
                      <button
                        type="button"
                        onClick={toggleTorch}
                        className={`p-2.5 rounded-xl backdrop-blur-md transition-all cursor-pointer ${
                          torchEnabled
                            ? 'bg-amber-500 text-slate-950 font-bold shadow-lg shadow-amber-500/30'
                            : 'bg-black/60 text-white hover:bg-black/80'
                        }`}
                        title="Toggle Flashlight Torch"
                      >
                        <Flashlight className="w-4 h-4" />
                      </button>
                    )}

                    {/* Audio Feedback Toggle */}
                    <button
                      type="button"
                      onClick={() => setSoundEnabled(!soundEnabled)}
                      className={`p-2.5 rounded-xl backdrop-blur-md transition-all cursor-pointer ${
                        soundEnabled ? 'bg-blue-600/80 text-white' : 'bg-black/60 text-slate-400'
                      }`}
                      title={soundEnabled ? 'Audio Beep Enabled' : 'Audio Beep Muted'}
                    >
                      {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Camera switcher if multiple video devices */}
                  {devices.length > 1 && (
                    <div className="relative">
                      <select
                        value={selectedDeviceId}
                        onChange={(e) => {
                          setSelectedDeviceId(e.target.value);
                          startCamera(e.target.value);
                        }}
                        className="bg-black/70 backdrop-blur-md text-white text-xs px-2.5 py-1.5 rounded-xl border border-slate-700 font-medium focus:outline-none cursor-pointer"
                      >
                        {devices.map((device, idx) => (
                          <option key={device.deviceId || idx} value={device.deviceId} className="bg-slate-900 text-white">
                            {device.label || `Camera ${idx + 1}`}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Bottom Zoom Control if supported */}
                {maxZoom > 1 && (
                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-center gap-2">
                    <div className="bg-black/70 backdrop-blur-md px-3 py-1 rounded-xl flex items-center gap-2 border border-slate-700">
                      <span className="text-[11px] font-bold text-slate-300">Zoom:</span>
                      {[1, 2, Math.min(3, maxZoom)].map((z) => (
                        <button
                          key={z}
                          type="button"
                          onClick={() => handleZoomChange(z)}
                          className={`text-[11px] font-extrabold px-2 py-0.5 rounded-lg transition-all ${
                            zoomLevel === z
                              ? 'bg-blue-600 text-white'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {z}x
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Camera Permission / Error Warning */}
              {errorMessage && (
                <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-300 text-xs flex items-start gap-2.5">
                  <X className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-bold">Camera Connection Notice</p>
                    <p className="text-slate-400 mt-0.5 leading-relaxed">{errorMessage}</p>
                    <button
                      type="button"
                      onClick={() => startCamera(selectedDeviceId)}
                      className="mt-2 px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" /> Retry Camera
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Manual Barcode / SKU Entry Form */
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-300">
                  Enter Barcode, SKU, or Product Code
                </label>
                <div className="relative">
                  <Barcode className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    placeholder="e.g. 9300601234567, 1001, COCA-500"
                    autoFocus
                    className="w-full bg-slate-950 border border-slate-700 text-white pl-11 pr-4 py-3 rounded-2xl text-sm font-mono focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-colors"
                  />
                </div>
                <p className="text-[11px] text-slate-400">
                  Works with standard hand-held USB/Bluetooth laser scanners or keyboard input.
                </p>
              </div>

              <button
                type="submit"
                disabled={!manualCode.trim()}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold rounded-2xl text-sm flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Submit Barcode</span>
              </button>
            </form>
          )}

          {/* Last Scanned Item Live Preview Card */}
          {lastScannedResult && (
            <div className="p-3.5 bg-slate-950 border border-emerald-500/30 rounded-2xl space-y-2 animate-in slide-in-from-bottom-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  Scanned Barcode: <code className="font-mono bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 text-white">{lastScannedResult.barcode}</code>
                </span>
                <span className="text-[11px] text-slate-400">{lastScannedResult.scannedAt}</span>
              </div>

              {lastScannedResult.matchedProduct ? (
                <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">
                      {lastScannedResult.matchedProduct.description}
                    </p>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                      <span>Dept: {lastScannedResult.matchedProduct.departmentName || 'General'}</span>
                      <span>•</span>
                      <span>Stock: <strong className="text-slate-200">{lastScannedResult.matchedProduct.currentStock}</strong></span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-sm font-black text-emerald-400">
                      ${Number(lastScannedResult.matchedProduct.sellingPrice || 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-900/50 p-2 rounded-xl border border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
                  <span>No exact matching product found in loaded catalog.</span>
                  <span className="text-slate-300 font-mono">{lastScannedResult.barcode}</span>
                </div>
              )}
            </div>
          )}

          {/* Continuous Batch Scan History */}
          {continuousScan && batchResults.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-300 px-1">
                <span className="flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-blue-400" />
                  Batch Scanned ({batchResults.length})
                </span>
                <button
                  type="button"
                  onClick={() => setBatchResults([])}
                  className="text-[11px] text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  Clear History
                </button>
              </div>

              <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                {batchResults.slice(0, 10).map((item, idx) => (
                  <div
                    key={`${item.barcode}-${idx}`}
                    className="p-2 rounded-xl bg-slate-950/70 border border-slate-800 text-xs flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-400 text-[10px] flex items-center justify-center font-mono">
                        {batchResults.length - idx}
                      </span>
                      <div className="truncate">
                        <p className="font-medium text-white truncate">
                          {item.matchedProduct?.description || item.barcode}
                        </p>
                        <p className="text-[10px] font-mono text-slate-400">{item.barcode}</p>
                      </div>
                    </div>
                    {item.matchedProduct && (
                      <span className="text-xs font-bold text-emerald-400 shrink-0 ml-2">
                        ${Number(item.matchedProduct.sellingPrice || 0).toFixed(2)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 sm:p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between gap-3">
          <p className="text-[11px] text-slate-400 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            Multi-format auto detection engine active
          </p>

          <div className="flex items-center gap-2">
            {continuousScan && onBatchScanComplete && batchResults.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  onBatchScanComplete(batchResults);
                  onClose();
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>Done ({batchResults.length})</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
