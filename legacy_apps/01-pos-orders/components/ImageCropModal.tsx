import React, { useState, useEffect, useRef } from 'react';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Check,
  X,
  Crop,
  Move,
  Sparkles,
  RefreshCw,
  Image as ImageIcon,
} from 'lucide-react';

interface ImageCropModalProps {
  file: File;
  productName: string;
  productId: number;
  onSave: (dataUrl: string) => Promise<void>;
  onClose: () => void;
}

export const ImageCropModal: React.FC<ImageCropModalProps> = ({
  file,
  productName,
  productId,
  onSave,
  onClose,
}) => {
  const [imageObj, setImageObj] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  // Load file into HTMLImageElement
  useEffect(() => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        setImageObj(img);
        setZoom(1);
        setOffset({ x: 0, y: 0 });
      };
      img.onerror = () => setError('Failed to read selected image file.');
      img.src = src;
    };
    reader.readAsDataURL(file);
  }, [file]);

  // Handle Dragging / Panning image
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch Support for Mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({
        x: e.touches[0].clientX - offset.x,
        y: e.touches[0].clientY - offset.y,
      });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    setOffset({
      x: e.touches[0].clientX - dragStart.x,
      y: e.touches[0].clientY - dragStart.y,
    });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  // Render Interactive Canvas
  useEffect(() => {
    if (!imageObj || !previewCanvasRef.current) return;
    const canvas = previewCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = 320; // 1:1 Display Viewport Size
    canvas.width = size;
    canvas.height = size;

    ctx.clearRect(0, 0, size, size);

    // Calculate fitted initial scale
    const baseScale = Math.min(size / imageObj.width, size / imageObj.height);
    const currentScale = baseScale * zoom;

    const drawWidth = imageObj.width * currentScale;
    const drawHeight = imageObj.height * currentScale;

    // Center coordinates + offset
    const drawX = (size - drawWidth) / 2 + offset.x;
    const drawY = (size - drawHeight) / 2 + offset.y;

    // Draw white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);

    // Draw transformed image
    ctx.drawImage(imageObj, drawX, drawY, drawWidth, drawHeight);
  }, [imageObj, zoom, offset]);

  // Export 400x400 Compressed Square JPEG
  const handleSaveCrop = async () => {
    if (!imageObj) return;
    setSaving(true);
    setError(null);

    try {
      const exportCanvas = document.createElement('canvas');
      const targetSize = 400; // Output 400x400 square for crisp lightweight thumbnails
      exportCanvas.width = targetSize;
      exportCanvas.height = targetSize;

      const ctx = exportCanvas.getContext('2d');
      if (!ctx) throw new Error('Could not initialize canvas context');

      // Fill white background for transparent PNG conversions
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, targetSize, targetSize);

      const previewSize = 320;
      const scaleRatio = targetSize / previewSize;

      const baseScale = Math.min(previewSize / imageObj.width, previewSize / imageObj.height);
      const currentScale = baseScale * zoom;

      const drawWidth = imageObj.width * currentScale * scaleRatio;
      const drawHeight = imageObj.height * currentScale * scaleRatio;

      const drawX = ((previewSize - imageObj.width * currentScale) / 2 + offset.x) * scaleRatio;
      const drawY = ((previewSize - imageObj.height * currentScale) / 2 + offset.y) * scaleRatio;

      ctx.drawImage(imageObj, drawX, drawY, drawWidth, drawHeight);

      // Convert to compressed JPEG data url
      const croppedDataUrl = exportCanvas.toDataURL('image/jpeg', 0.85);
      await onSave(croppedDataUrl);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to process cropped image');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden text-slate-100 flex flex-col">
        {/* Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crop className="w-5 h-5 text-blue-400" />
            <div>
              <h3 className="font-bold text-sm text-white">Square Crop &amp; Zoom</h3>
              <p className="text-[11px] text-slate-400 truncate max-w-[220px]">
                {productName} (#{productId})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={saving}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Interactive Viewport Canvas */}
        <div className="p-6 flex flex-col items-center justify-center space-y-4">
          <div className="text-center space-y-1">
            <p className="text-xs font-semibold text-slate-300 flex items-center justify-center gap-1.5">
              <Move className="w-3.5 h-3.5 text-blue-400" />
              <span>Drag to center product · Zoom to focus</span>
            </p>
            <p className="text-[10px] text-slate-500">
              Only the area inside the square frame will be saved as the product picture.
            </p>
          </div>

          {/* Canvas Box Container with Square Viewport Frame */}
          <div
            ref={containerRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className="relative w-[320px] h-[320px] rounded-2xl overflow-hidden border-2 border-blue-500/80 shadow-2xl bg-slate-950 cursor-grab active:cursor-grabbing select-none"
          >
            <canvas ref={previewCanvasRef} className="w-full h-full block" />

            {/* Grid Overlay Lines */}
            <div className="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3 border border-white/20">
              <div className="border-r border-b border-white/10" />
              <div className="border-r border-b border-white/10" />
              <div className="border-b border-white/10" />
              <div className="border-r border-b border-white/10" />
              <div className="border-r border-b border-white/10" />
              <div className="border-b border-white/10" />
              <div className="border-r border-white/10" />
              <div className="border-r border-white/10" />
              <div />
            </div>
          </div>

          {/* Zoom Slider & Quick Adjust Controls */}
          <div className="w-full bg-slate-950 p-3.5 rounded-xl border border-slate-800/80 space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
              <span className="flex items-center gap-1.5">
                <ZoomIn className="w-4 h-4 text-blue-400" /> Zoom Level
              </span>
              <span className="font-mono text-blue-400">{Math.round(zoom * 100)}%</span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(0.5, z - 0.2))}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors"
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>

              <input
                type="range"
                min="0.5"
                max="4"
                step="0.05"
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="flex-1 accent-blue-500 cursor-pointer"
              />

              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(4, z + 0.2))}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setZoom(1);
                  setOffset({ x: 0, y: 0 });
                }}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg transition-colors"
                title="Reset Position"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {error && (
            <p className="text-xs text-rose-400 font-semibold bg-rose-950/50 p-2.5 rounded-xl border border-rose-800/50 w-full text-center">
              {error}
            </p>
          )}
        </div>

        {/* Footer Action Buttons */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSaveCrop}
            disabled={saving || !imageObj}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center gap-1.5 disabled:opacity-50"
          >
            {saving ? (
              <RefreshCw className="w-4 h-4 animate-spin text-white" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            <span>Save Product Photo</span>
          </button>
        </div>
      </div>
    </div>
  );
};
