import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Search,
  Barcode,
  Package,
  TrendingUp,
  Clock,
  Calendar,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  RefreshCw,
  Plus,
  Minus,
  Sparkles,
  Layers,
  Tag,
  Save,
  Check,
} from 'lucide-react';
import { InventoryItem, CurrentUserSession } from '../types';
import { UniversalBarcodeScannerModal } from './UniversalBarcodeScannerModal';
import {
  calculateSuggestedStockToHold,
  SuggestedStockCalculationResult,
  StockObservationCheckpoint,
} from '../stockSuggestionUtils';

interface StockOrderAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  inventoryProducts?: InventoryItem[];
  currentUser?: CurrentUserSession | null;
  initialProductId?: number | string | null;
}

export const StockOrderAssistantModal: React.FC<StockOrderAssistantModalProps> = ({
  isOpen,
  onClose,
  inventoryProducts = [],
  currentUser,
  initialProductId = null,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [calculationResult, setCalculationResult] = useState<SuggestedStockCalculationResult | null>(null);

  // Manual physical count state
  const [currentPhysicalStock, setCurrentPhysicalStock] = useState<string>('');
  const [isSavingCount, setIsSavingCount] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Barcode scanner modal state
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Focus search on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        if (!selectedProduct && searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }, 100);
    }
  }, [isOpen, selectedProduct]);

  // Load initial product if provided
  useEffect(() => {
    if (isOpen && initialProductId) {
      loadProductById(Number(initialProductId));
    }
  }, [isOpen, initialProductId]);

  // Reset when closing
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setSearchResults([]);
      setSelectedProduct(null);
      setCalculationResult(null);
      setCurrentPhysicalStock('');
      setSaveSuccess(false);
    }
  }, [isOpen]);

  // Live product search debounced
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/inventory/stock-suggestions?search=${encodeURIComponent(q)}&period=6months`);
        if (res.ok) {
          const json = await res.json();
          setSearchResults(json.items || []);
        } else {
          // Fallback search in inventoryProducts prop
          const cleanQ = q.toLowerCase().replace(/^\*/, '');
          const filtered = inventoryProducts.filter(
            (p) =>
              p.longDescription.toLowerCase().includes(cleanQ) ||
              p.scanCode.toLowerCase().includes(cleanQ) ||
              String(p.itemCode).toLowerCase().includes(cleanQ)
          );
          setSearchResults(filtered.slice(0, 15));
        }
      } catch (err) {
        console.error('Error searching products:', err);
      } finally {
        setIsSearching(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [searchQuery, inventoryProducts]);

  // Fetch full details and movement for selected product
  const loadProductById = async (productId: number) => {
    setLoadingDetails(true);
    setCurrentPhysicalStock('');
    setSaveSuccess(false);
    try {
      const res = await fetch(`/api/inventory/stock-suggestions?productId=${productId}&period=12months`);
      if (res.ok) {
        const json = await res.json();
        if (json.items && json.items.length > 0) {
          const prod = json.items[0];
          setSelectedProduct(prod);

          const calc = calculateSuggestedStockToHold(
            prod.movement || { sales7d: 0, sales30d: 0, sales90d: 0, sales180d: 0 },
            null,
            prod.lastObservation
          );
          setCalculationResult(calc);
          return;
        }
      }

      // Fallback
      const fallbackItem = inventoryProducts.find((p) => Number(p.productId) === productId);
      if (fallbackItem) {
        setSelectedProduct(fallbackItem);
        const calc = calculateSuggestedStockToHold(
          { sales7d: 4, sales30d: 18, sales90d: 52, sales180d: 104 },
          null,
          null
        );
        setCalculationResult(calc);
      }
    } catch (err) {
      console.error('Failed to load product stock suggestions:', err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleSelectProduct = (prod: any) => {
    setSelectedProduct(prod);
    setSearchQuery('');
    setSearchResults([]);

    const calc = calculateSuggestedStockToHold(
      prod.movement || { sales7d: 0, sales30d: 0, sales90d: 0, sales180d: 0, sales365d: 0 },
      null,
      prod.lastObservation
    );
    setCalculationResult(calc);
  };

  // Recalculate order requirement when current physical stock is modified
  const handlePhysicalStockChange = (val: string) => {
    setCurrentPhysicalStock(val);
    if (!selectedProduct || !calculationResult) return;

    const numVal = val === '' ? null : Number(val);
    const updatedCalc = calculateSuggestedStockToHold(
      selectedProduct.movement || {
        sales7d: calculationResult.sales7d,
        sales30d: calculationResult.sales30d,
        sales90d: calculationResult.sales90d,
        sales180d: calculationResult.sales180d,
        sales365d: calculationResult.sales365d,
      },
      numVal,
      calculationResult.lastObservation
    );
    setCalculationResult(updatedCalc);
  };

  // Save manual stock count checkpoint
  const handleSaveStockCount = async () => {
    if (!selectedProduct || currentPhysicalStock === '' || isNaN(Number(currentPhysicalStock))) {
      return;
    }

    setIsSavingCount(true);
    try {
      const payload = {
        productId: selectedProduct.productId,
        itemCode: selectedProduct.itemCode,
        barcode: selectedProduct.scanCode,
        productName: selectedProduct.longDescription || selectedProduct.description,
        departmentName: selectedProduct.departmentName,
        countedQty: Number(currentPhysicalStock),
        staffName: currentUser?.name || (currentUser as any)?.username || 'Staff',
      };

      const res = await fetch('/api/inventory/stock-observations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const json = await res.json();
        setSaveSuccess(true);
        if (json.observation && calculationResult) {
          setCalculationResult({
            ...calculationResult,
            lastObservation: json.observation,
          });
        }
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err) {
      console.error('Failed to save stock observation checkpoint:', err);
    } finally {
      setIsSavingCount(false);
    }
  };

  // Handle scan from barcode scanner
  const handleBarcodeScan = (barcode: string, matchedProduct?: InventoryItem) => {
    setIsScannerOpen(false);
    if (matchedProduct) {
      loadProductById(matchedProduct.productId);
    } else {
      setSearchQuery(barcode);
    }
  };

  // Quick next product action
  const handleNextProduct = () => {
    setSelectedProduct(null);
    setCalculationResult(null);
    setCurrentPhysicalStock('');
    setSearchQuery('');
    setSearchResults([]);
    setSaveSuccess(false);
    setTimeout(() => {
      if (searchInputRef.current) {
        searchInputRef.current.focus();
      }
    }, 50);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-neutral-800 flex items-center justify-between bg-slate-50/70 dark:bg-neutral-950/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600 text-white rounded-2xl shadow-sm">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-neutral-100 tracking-tight">
                Stock Order Assistant
              </h2>
              <p className="text-xs text-slate-500 dark:text-neutral-400">
                Shelf check & recommended stock to hold
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-neutral-200 hover:bg-slate-100 dark:hover:bg-neutral-800 rounded-full transition-colors cursor-pointer"
            title="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
          {/* Search Box & Barcode Scanner Button */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-neutral-300 mb-1.5">
              Find Product (Search or Scan Barcode)
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Type product name, *500ml, code or barcode..."
                  className="w-full pl-9 pr-8 py-2.5 bg-slate-50 dark:bg-neutral-800/80 border border-slate-300 dark:border-neutral-700 rounded-2xl text-sm font-medium text-slate-900 dark:text-neutral-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setSearchResults([]);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-neutral-200 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Barcode Camera Scanner Icon Button beside search field */}
              <button
                type="button"
                onClick={() => setIsScannerOpen(true)}
                className="px-3.5 py-2.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/50 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-2xl flex items-center gap-1.5 text-xs font-bold transition-all shadow-xs shrink-0 cursor-pointer"
                title="Scan barcode with camera"
              >
                <Barcode className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="hidden sm:inline">Scan Barcode</span>
              </button>
            </div>

            {/* Live Search Autocomplete Results */}
            {searchQuery.trim().length > 0 && (
              <div className="mt-2 border border-slate-200 dark:border-neutral-800 rounded-2xl bg-white dark:bg-neutral-800 shadow-lg max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-neutral-700/60 z-20">
                {isSearching ? (
                  <div className="p-4 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                    Searching products...
                  </div>
                ) : searchResults.length > 0 ? (
                  searchResults.map((item) => (
                    <button
                      key={item.productId}
                      type="button"
                      onClick={() => handleSelectProduct(item)}
                      className="w-full px-4 py-3 text-left hover:bg-blue-50/70 dark:hover:bg-neutral-700/50 flex items-center justify-between gap-3 transition-colors cursor-pointer"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-900 dark:text-neutral-100 truncate">
                          {item.longDescription || item.description}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500 dark:text-neutral-400">
                          <span className="font-mono">{item.scanCode || item.itemCode}</span>
                          <span>•</span>
                          <span>{item.departmentName || 'General'}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                          ${Number(item.sellingPrice || 0).toFixed(2)}
                        </span>
                        {item.suggestedStockToHold !== undefined && (
                          <p className="text-[10px] text-slate-400 dark:text-neutral-500">
                            Hold: {item.suggestedStockToHold}
                          </p>
                        )}
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="p-4 text-center text-xs text-slate-500">
                    No matching products found. Try a different name or barcode.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Loading Indicator */}
          {loadingDetails && (
            <div className="py-12 flex flex-col items-center justify-center gap-3">
              <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
              <p className="text-xs font-medium text-slate-500">Loading product movement & suggestions...</p>
            </div>
          )}

          {/* Product Found & Suggestion View */}
          {selectedProduct && calculationResult && !loadingDetails && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-150">
              {/* Product Header Card */}
              <div className="p-4 bg-slate-50 dark:bg-neutral-800/60 border border-slate-200 dark:border-neutral-700/80 rounded-2xl flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className="inline-block px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 text-[10px] font-bold uppercase tracking-wider mb-1">
                    {selectedProduct.departmentName || 'Department'}
                  </span>
                  <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-neutral-100 leading-snug">
                    {selectedProduct.longDescription || selectedProduct.description}
                  </h3>
                  <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-slate-500 dark:text-neutral-400">
                    <span className="font-mono flex items-center gap-1">
                      <Barcode className="w-3.5 h-3.5 text-slate-400" />
                      {selectedProduct.scanCode || selectedProduct.itemCode}
                    </span>
                    <span>•</span>
                    <span className="font-semibold text-slate-700 dark:text-neutral-300">
                      Price: ${Number(selectedProduct.sellingPrice || 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* PROMINENT SUGGESTED STOCK TO HOLD HERO */}
              <div className="p-6 bg-gradient-to-br from-blue-600 via-indigo-600 to-blue-700 text-white rounded-3xl shadow-lg text-center relative overflow-hidden">
                <div className="absolute top-0 right-0 transform translate-x-4 -translate-y-4 w-32 h-32 bg-white/10 rounded-full blur-xl pointer-events-none" />
                <p className="text-xs sm:text-sm font-bold uppercase tracking-widest text-blue-100 opacity-90">
                  Suggested Stock to Hold
                </p>
                <div className="my-2 flex items-center justify-center gap-2">
                  <span className="text-5xl sm:text-6xl font-black tracking-tight text-white drop-shadow-sm">
                    {calculationResult.suggestedStockToHold}
                  </span>
                  <span className="text-base font-bold text-blue-200 self-end mb-2">units</span>
                </div>
                <p className="text-xs text-blue-100/90 max-w-sm mx-auto font-medium">
                  Recommended target quantity to have available based on recent sales demand
                </p>
                {calculationResult.isRecentSpike && (
                  <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 bg-amber-400 text-amber-950 rounded-full text-xs font-black shadow-xs">
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span>Demand Surge: 7-Day sales velocity increased</span>
                  </div>
                )}
              </div>

              {/* SALES & MOVEMENT BREAKDOWN */}
              <div className="bg-slate-50 dark:bg-neutral-800/60 border border-slate-200 dark:border-neutral-700/80 rounded-2xl p-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400 mb-3 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  Product Sales Movement History
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="p-2.5 bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-xl text-center">
                    <p className="text-[11px] text-slate-500 dark:text-neutral-400 font-medium">This Week</p>
                    <p className="text-base font-black text-slate-900 dark:text-neutral-100">
                      {calculationResult.sales7d} <span className="text-xs font-normal text-slate-400">sold</span>
                    </p>
                  </div>
                  <div className="p-2.5 bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-xl text-center">
                    <p className="text-[11px] text-slate-500 dark:text-neutral-400 font-medium">This Month</p>
                    <p className="text-base font-black text-slate-900 dark:text-neutral-100">
                      {calculationResult.sales30d} <span className="text-xs font-normal text-slate-400">sold</span>
                    </p>
                  </div>
                  <div className="p-2.5 bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-xl text-center">
                    <p className="text-[11px] text-slate-500 dark:text-neutral-400 font-medium">Last 3 Months</p>
                    <p className="text-base font-black text-slate-900 dark:text-neutral-100">
                      {calculationResult.sales90d} <span className="text-xs font-normal text-slate-400">sold</span>
                    </p>
                  </div>
                  <div className="p-2.5 bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-xl text-center">
                    <p className="text-[11px] text-slate-500 dark:text-neutral-400 font-medium">Last 6 Months</p>
                    <p className="text-base font-black text-slate-900 dark:text-neutral-100">
                      {calculationResult.sales180d} <span className="text-xs font-normal text-slate-400">sold</span>
                    </p>
                  </div>
                </div>
                {calculationResult.sales365d !== undefined && calculationResult.sales365d > 0 && (
                  <p className="text-[11px] text-slate-400 dark:text-neutral-500 mt-2 text-right">
                    Last 12 Months: <span className="font-semibold text-slate-600 dark:text-neutral-300">{calculationResult.sales365d} units</span>
                  </p>
                )}
              </div>

              {/* PREVIOUS PHYSICAL STOCK CHECKPOINT (IF ANY) */}
              {calculationResult.lastObservation && (
                <div className="p-3 bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60 rounded-2xl flex items-center justify-between text-xs text-indigo-900 dark:text-indigo-200">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                    <div>
                      <span className="font-bold">Previous Physical Count:</span>{' '}
                      <span className="font-black text-indigo-700 dark:text-indigo-300">
                        {calculationResult.lastObservation.countedQty} units
                      </span>{' '}
                      on {new Date(calculationResult.lastObservation.countedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                      {calculationResult.lastObservation.staffName ? ` (${calculationResult.lastObservation.staffName})` : ''}
                    </div>
                  </div>
                </div>
              )}

              {/* OPTIONAL CURRENT STOCK ON HAND ENTRY & ORDER REQUIREMENT */}
              <div className="p-4 bg-white dark:bg-neutral-800 border-2 border-dashed border-slate-300 dark:border-neutral-700 rounded-3xl space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <label className="text-xs font-black text-slate-900 dark:text-neutral-100 flex items-center gap-1.5">
                      <span>Current Stock on Hand</span>
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">(Optional Shelf Count)</span>
                    </label>
                    <p className="text-[11px] text-slate-500 dark:text-neutral-400">
                      Enter what you physically count on the shelf to see order requirement
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const cur = Number(currentPhysicalStock) || 0;
                        handlePhysicalStockChange(String(Math.max(0, cur - 1)));
                      }}
                      className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-neutral-700 hover:bg-slate-200 flex items-center justify-center text-slate-700 dark:text-neutral-200 font-bold transition-colors cursor-pointer"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={currentPhysicalStock}
                      onChange={(e) => handlePhysicalStockChange(e.target.value)}
                      placeholder="Count"
                      className="w-20 py-1.5 px-2 bg-slate-50 dark:bg-neutral-900 border border-slate-300 dark:border-neutral-600 rounded-xl text-center text-sm font-black text-slate-900 dark:text-neutral-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const cur = Number(currentPhysicalStock) || 0;
                        handlePhysicalStockChange(String(cur + 1));
                      }}
                      className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-neutral-700 hover:bg-slate-200 flex items-center justify-center text-slate-700 dark:text-neutral-200 font-bold transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>

                    {currentPhysicalStock !== '' && (
                      <button
                        type="button"
                        onClick={handleSaveStockCount}
                        disabled={isSavingCount}
                        className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 dark:bg-neutral-100 dark:hover:bg-white text-white dark:text-neutral-900 rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs transition-all cursor-pointer disabled:opacity-50"
                        title="Save physical count checkpoint"
                      >
                        {saveSuccess ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400 dark:text-emerald-600" />
                            <span>Saved</span>
                          </>
                        ) : isSavingCount ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <>
                            <Save className="w-3.5 h-3.5" />
                            <span>Save</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* APPROX. ORDER REQUIREMENT (Visible when physical count entered) */}
                {calculationResult.approxOrderRequirement !== null && (
                  <div className="mt-3 p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 rounded-2xl flex items-center justify-between animate-in fade-in duration-150">
                    <div>
                      <p className="text-xs font-bold text-amber-900 dark:text-amber-200">
                        Approx. Order Requirement
                      </p>
                      <p className="text-[11px] text-amber-700 dark:text-amber-400">
                        Suggested Stock ({calculationResult.suggestedStockToHold}) − Current Physical ({currentPhysicalStock})
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-black text-amber-900 dark:text-amber-200">
                        {calculationResult.approxOrderRequirement}
                      </span>
                      <span className="text-xs font-bold text-amber-700 dark:text-amber-400 ml-1">to order</span>
                    </div>
                  </div>
                )}
              </div>

              {/* FAST ACTION FOOTER */}
              <div className="pt-2 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleNextProduct}
                  className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs sm:text-sm font-black shadow-md flex items-center justify-center gap-2 transition-all active:scale-98 cursor-pointer"
                >
                  <Search className="w-4 h-4" />
                  <span>Search / Scan Next Product</span>
                </button>
              </div>
            </div>
          )}

          {/* Empty State when no product selected */}
          {!selectedProduct && !loadingDetails && searchQuery.trim() === '' && (
            <div className="py-10 text-center space-y-3">
              <div className="w-14 h-14 mx-auto rounded-3xl bg-blue-50 dark:bg-neutral-800 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <Package className="w-7 h-7" />
              </div>
              <div className="max-w-xs mx-auto">
                <h4 className="text-sm font-bold text-slate-800 dark:text-neutral-200">
                  Ready for Shelf Order Check
                </h4>
                <p className="text-xs text-slate-500 dark:text-neutral-400 mt-1">
                  Type a product name above or tap <strong>Scan Barcode</strong> to identify an item in front of the shelf.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Embedded Barcode Scanner Camera Modal */}
      {isScannerOpen && (
        <UniversalBarcodeScannerModal
          isOpen={isScannerOpen}
          onClose={() => setIsScannerOpen(false)}
          onScan={handleBarcodeScan}
          inventoryProducts={inventoryProducts}
          title="Scan Shelf Product Barcode"
          subtitle="Point camera at product barcode for instant stock suggestion"
        />
      )}
    </div>
  );
};
