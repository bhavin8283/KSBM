import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats, CameraDevice } from 'html5-qrcode';
import {
  X,
  Camera,
  Flashlight,
  FlashlightOff,
  SwitchCamera,
  Upload,
  Barcode,
  CheckCircle2,
  AlertCircle,
  Volume2,
  VolumeX,
  Sparkles,
} from 'lucide-react';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (scannedCode: string) => void;
  title?: string;
  subtitle?: string;
  targetFieldLabel?: string;
}

const SAMPLE_TEST_BARCODES = [
  { label: 'Chesterfield Blue 20s', code: '9310704929271' },
  { label: 'Winfield Blue 20s', code: '9311492003810' },
  { label: 'Marlboro Red 20s', code: '9300612042008' },
  { label: 'Riverstone 30g', code: '9310704930109' },
];

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onScan,
  title = 'Barcode Scanner',
  subtitle = 'Scan 1D retail barcode (GTIN, EAN-13, UPC, Code 128) using your device camera.',
  targetFieldLabel,
}) => {
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [hasTorchSupport, setHasTorchSupport] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [lastScannedResult, setLastScannedResult] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState('');
  const [isProcessingFile, setIsProcessingFile] = useState(false);

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scannerContainerId = 'ksbm-wholesale-barcode-reader-viewport';

  const playScanBeep = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.08);

      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.13);
    } catch {
      // Audio autoplay policy or AudioContext unavailable
    }

    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(80);
      } catch {
        // Haptic feedback fallback
      }
    }
  }, [soundEnabled]);

  const handleBarcodeDetected = useCallback(
    (decodedText: string) => {
      const trimmed = decodedText.trim();
      if (!trimmed) return;

      playScanBeep();
      setLastScannedResult(trimmed);

      setTimeout(() => {
        onScan(trimmed);
        onClose();
      }, 350);
    },
    [onScan, onClose, playScanBeep]
  );

  const stopCamera = useCallback(async () => {
    try {
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current.clear();
      }
    } catch (e) {
      console.warn('Error stopping barcode camera:', e);
    } finally {
      setIsScanning(false);
      setIsTorchOn(false);
      setHasTorchSupport(false);
    }
  }, []);

  const startCamera = useCallback(
    async (cameraIdOrFacing?: string | { facingMode: string }) => {
      setCameraError(null);
      await stopCamera();

      const container = document.getElementById(scannerContainerId);
      if (!container) return;

      try {
        if (!html5QrCodeRef.current) {
          html5QrCodeRef.current = new Html5Qrcode(scannerContainerId, {
            formatsToSupport: [
              Html5QrcodeSupportedFormats.EAN_13,
              Html5QrcodeSupportedFormats.EAN_8,
              Html5QrcodeSupportedFormats.UPC_A,
              Html5QrcodeSupportedFormats.UPC_E,
              Html5QrcodeSupportedFormats.CODE_128,
              Html5QrcodeSupportedFormats.CODE_39,
              Html5QrcodeSupportedFormats.ITF,
              Html5QrcodeSupportedFormats.QR_CODE,
            ],
            verbose: false,
          });
        }

        const cameraConfig = cameraIdOrFacing || { facingMode: 'environment' };
        const config = {
          fps: 20,
          qrbox: { width: 280, height: 160 },
          aspectRatio: 1.333333,
          showTorchButtonIfSupported: true,
        };

        await html5QrCodeRef.current.start(
          cameraConfig,
          config,
          (decodedText) => {
            handleBarcodeDetected(decodedText);
          },
          () => {}
        );

        setIsScanning(true);

        try {
          const track = html5QrCodeRef.current?.getRunningTrackCameraCapabilities() as unknown as {
            torchFeature?: () => { isSupported: () => boolean; apply: (val: boolean) => Promise<void> };
          };
          if (track && track.torchFeature && track.torchFeature().isSupported()) {
            setHasTorchSupport(true);
          }
        } catch {
          // Torch check ignored
        }
      } catch (err: unknown) {
        const errorMsg =
          err instanceof Error
            ? err.message
            : typeof err === 'string'
            ? err
            : 'Unable to access device camera.';

        if (errorMsg.toLowerCase().includes('permission') || errorMsg.toLowerCase().includes('denied')) {
          setCameraError(
            'Camera permission was denied. Please allow camera access in your browser settings, or use the image upload / sample buttons below.'
          );
        } else if (errorMsg.toLowerCase().includes('notfound') || errorMsg.toLowerCase().includes('devices')) {
          setCameraError(
            'No video camera device was detected on this device. You can still scan from an image file or test with sample barcodes.'
          );
        } else {
          setCameraError(
            `Camera initialization failed (${errorMsg}). You can retry, select another camera, or use the image upload option.`
          );
        }
        setIsScanning(false);
      }
    },
    [handleBarcodeDetected, stopCamera]
  );

  const handleToggleTorch = async () => {
    if (!html5QrCodeRef.current || !isScanning) return;
    try {
      const nextTorch = !isTorchOn;
      const track = html5QrCodeRef.current.getRunningTrackCameraCapabilities() as unknown as {
        torchFeature?: () => { apply: (val: boolean) => Promise<void> };
      };
      if (track && track.torchFeature) {
        await track.torchFeature().apply(nextTorch);
        setIsTorchOn(nextTorch);
      }
    } catch (e) {
      console.warn('Torch toggle failed:', e);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessingFile(true);
    setCameraError(null);

    try {
      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode(scannerContainerId, {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.ITF,
            Html5QrcodeSupportedFormats.QR_CODE,
          ],
          verbose: false,
        });
      }

      const decodedResult = await html5QrCodeRef.current.scanFile(file, true);
      if (decodedResult) {
        handleBarcodeDetected(decodedResult);
      }
    } catch {
      setCameraError(
        'No readable barcode was found in the selected photo. Please ensure good lighting and steady focus.'
      );
    } finally {
      setIsProcessingFile(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setLastScannedResult(null);
      return;
    }

    let isMounted = true;

    Html5Qrcode.getCameras()
      .then((deviceList) => {
        if (!isMounted) return;
        setCameras(deviceList);
        if (deviceList.length > 0) {
          const backCam = deviceList.find(
            (c) =>
              c.label.toLowerCase().includes('back') ||
              c.label.toLowerCase().includes('rear') ||
              c.label.toLowerCase().includes('environment')
          );
          const initialCamId = backCam ? backCam.id : deviceList[0].id;
          setSelectedCameraId(initialCamId);
          startCamera(initialCamId);
        } else {
          startCamera({ facingMode: 'environment' });
        }
      })
      .catch(() => {
        if (!isMounted) return;
        startCamera({ facingMode: 'environment' });
      });

    return () => {
      isMounted = false;
      stopCamera();
    };
  }, [isOpen, startCamera, stopCamera]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-3 sm:p-4 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 bg-slate-50/80">
          <div className="flex items-center space-x-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white shadow-2xs">
              <Barcode className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 leading-none">{title}</h3>
                {targetFieldLabel && (
                  <span className="rounded bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 text-[10px] font-bold text-indigo-700">
                    Target: {targetFieldLabel}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>
            </div>
          </div>

          <button
            type="button"
            id="close-barcode-modal-btn"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 transition cursor-pointer"
            aria-label="Close scanner"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="relative bg-slate-950 overflow-hidden flex flex-col items-center justify-center min-h-[280px] sm:min-h-[320px]">
          <div
            id={scannerContainerId}
            className="w-full max-w-full overflow-hidden"
            style={{ width: '100%', minHeight: '260px' }}
          />

          {isScanning && !lastScannedResult && (
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-4">
              <div className="relative w-[280px] h-[160px] border-2 border-emerald-400/80 rounded-lg shadow-lg">
                <div className="absolute -top-1 -left-1 h-4 w-4 border-t-4 border-l-4 border-emerald-400 rounded-tl-sm" />
                <div className="absolute -top-1 -right-1 h-4 w-4 border-t-4 border-r-4 border-emerald-400 rounded-tr-sm" />
                <div className="absolute -bottom-1 -left-1 h-4 w-4 border-b-4 border-l-4 border-emerald-400 rounded-bl-sm" />
                <div className="absolute -bottom-1 -right-1 h-4 w-4 border-b-4 border-r-4 border-emerald-400 rounded-br-sm" />

                <div
                  className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_8px_#34d399] animate-pulse"
                  style={{
                    animation: 'scannerLaser 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                  }}
                />

                <div className="absolute -bottom-7 inset-x-0 text-center">
                  <span className="rounded-full bg-slate-900/80 backdrop-blur-xs px-2.5 py-0.5 text-[10px] font-semibold text-emerald-300 border border-emerald-500/30">
                    Align barcode inside frame
                  </span>
                </div>
              </div>
            </div>
          )}

          {lastScannedResult && (
            <div className="absolute inset-0 bg-emerald-950/90 flex flex-col items-center justify-center p-6 text-center animate-in zoom-in-95 duration-150">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg mb-3">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
                Barcode Scanned Successfully!
              </p>
              <div className="mt-2 rounded-lg bg-slate-900/90 border border-emerald-500/40 px-4 py-2 font-mono text-base font-bold text-emerald-300 shadow-inner">
                {lastScannedResult}
              </div>
            </div>
          )}

          {cameraError && !isScanning && (
            <div className="absolute inset-0 bg-slate-900 p-6 flex flex-col items-center justify-center text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/20 text-amber-400 mb-3 border border-amber-500/30">
                <AlertCircle className="h-6 w-6" />
              </div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Camera Notice</h4>
              <p className="mt-1.5 text-xs text-slate-300 max-w-sm leading-relaxed">{cameraError}</p>
              <div className="mt-4 flex flex-wrap gap-2 justify-center">
                <button
                  type="button"
                  onClick={() => startCamera(selectedCameraId || { facingMode: 'environment' })}
                  className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition cursor-pointer"
                >
                  Retry Camera Access
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-1.5 text-xs font-semibold transition cursor-pointer flex items-center gap-1.5"
                >
                  <Upload className="h-3.5 w-3.5" />
                  <span>Upload Photo</span>
                </button>
              </div>
            </div>
          )}

          <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 z-10">
            {hasTorchSupport && (
              <button
                type="button"
                onClick={handleToggleTorch}
                title={isTorchOn ? 'Turn Flashlight Off' : 'Turn Flashlight On'}
                className={`flex h-8 w-8 items-center justify-center rounded-lg backdrop-blur-md transition ${
                  isTorchOn
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-md'
                    : 'bg-slate-900/70 text-white hover:bg-slate-900'
                }`}
              >
                {isTorchOn ? <FlashlightOff className="h-4 w-4" /> : <Flashlight className="h-4 w-4" />}
              </button>
            )}

            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              title={soundEnabled ? 'Beep sound ON' : 'Beep sound OFF'}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900/70 text-white backdrop-blur-md hover:bg-slate-900 transition"
            >
              {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4 text-slate-400" />}
            </button>
          </div>
        </div>

        <div className="p-4 space-y-3 bg-white overflow-y-auto">
          {cameras.length > 1 && (
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-slate-500 font-medium flex items-center gap-1 shrink-0">
                <SwitchCamera className="h-3.5 w-3.5 text-slate-400" />
                Select Camera:
              </span>
              <select
                value={selectedCameraId}
                onChange={(e) => {
                  setSelectedCameraId(e.target.value);
                  startCamera(e.target.value);
                }}
                className="flex-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 font-medium focus:border-slate-900 focus:outline-hidden"
              >
                {cameras.map((c, i) => (
                  <option key={c.id} value={c.id}>
                    {c.label || `Camera ${i + 1}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileUpload}
            className="hidden"
          />

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-1 border-t border-slate-100">
            <button
              type="button"
              id="upload-barcode-photo-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessingFile}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition cursor-pointer shadow-2xs"
            >
              <Upload className="h-3.5 w-3.5 text-slate-500" />
              <span>{isProcessingFile ? 'Reading Photo...' : 'Scan from Photo / File'}</span>
            </button>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (manualInput.trim()) {
                  handleBarcodeDetected(manualInput.trim());
                }
              }}
              className="flex items-center gap-1.5 flex-1 max-w-xs"
            >
              <input
                type="text"
                placeholder="Or type/paste GTIN barcode..."
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-mono text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:border-slate-900"
              />
              <button
                type="submit"
                disabled={!manualInput.trim()}
                className="rounded-lg bg-slate-900 text-white px-2.5 py-1.5 text-xs font-bold hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 transition shrink-0 cursor-pointer"
              >
                Apply
              </button>
            </form>
          </div>

          <div className="pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1.5">
              <span className="font-semibold flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-amber-500" />
                Quick-Test Catalog Barcodes:
              </span>
              <span className="text-[10px] text-slate-400">Click to simulate scan</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {SAMPLE_TEST_BARCODES.map((item) => (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => handleBarcodeDetected(item.code)}
                  className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 hover:bg-slate-100 px-2 py-1 text-left transition cursor-pointer"
                >
                  <span className="text-[11px] font-medium text-slate-800 truncate">{item.label}</span>
                  <span className="font-mono text-[10px] text-slate-500 shrink-0 ml-1">
                    ...{item.code.slice(-5)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="border-t border-slate-200 bg-slate-50 px-4 py-2.5 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <Camera className="h-3.5 w-3.5 text-emerald-600" />
            <span className="font-medium text-slate-700">
              {isScanning ? 'Camera active & scanning' : 'Camera ready'}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200/80 transition cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>

      <style>{`
        @keyframes scannerLaser {
          0% { top: 10%; opacity: 0.2; }
          50% { top: 90%; opacity: 1; }
          100% { top: 10%; opacity: 0.2; }
        }
      `}</style>
    </div>
  );
};
