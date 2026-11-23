import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  X,
  Search,
  Barcode,
  Camera,
  Calendar,
  Layers,
  Plus,
  Trash2,
  Check,
  AlertTriangle,
  Clock,
  Sparkles,
  Package,
  ChevronDown,
  Info,
  Edit2,
} from 'lucide-react';
import { ExpiryBatch, getDaysUntilExpiry, formatExpiryRelative } from '../expiryUtils';
import { UniversalBarcodeScannerModal } from './UniversalBarcodeScannerModal';
import { matchAdvancedSearch } from './InventoryManager';

export interface BatchEntryRow {
  id?: string;
  expiryDate: string;
  quantity: number;
  batchLot?: string;
  notes?: string;
}

interface AddEditExpiryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBatchesSaved: (savedBatches: ExpiryBatch[]) => void;
  inventoryProducts?: any[];
  editingBatch?: ExpiryBatch | null;
  initialProduct?: any | null;
}

export const AddEditExpiryModal: React.FC<AddEditExpiryModalProps> = ({
  isOpen,
  onClose,
  onBatchesSaved,
  inventoryProducts = [],
  editingBatch = null,
  initialProduct = null,
}) => {
  const [searchInput, setSearchInput] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>('ALL');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // Multi-batch rows state
  const [batchRows, setBatchRows] = useState<BatchEntryRow[]>([
    { expiryDate: '', quantity: 1, batchLot: '', notes: '' },
  ]);

  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Initialize or reset when modal opens or editingBatch changes
  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      setSuccessMessage(null);
      setIsSaving(false);

      if (editingBatch) {
        // Edit mode for single existing batch
        const matched = inventoryProducts.find(
          (p) => Number(p.productId || p.stockItemId || p.id) === Number(editingBatch.stockItemId)
        );
        setSelectedProduct(
          matched || {
            productId: editingBatch.stockItemId,
            itemCode: editingBatch.productCode,
            scanCode: editingBatch.barcode,
            longDescription: editingBatch.productName,
            departmentName: editingBatch.departmentName,
            currentStock: 0,
          }
        );
        setSearchInput(editingBatch.productName);
        setBatchRows([
          {
            id: editingBatch.id,
            expiryDate: editingBatch.expiryDate,
            quantity: editingBatch.quantity,
            batchLot: editingBatch.batchLot || '',
            notes: editingBatch.notes || '',
          },
        ]);
        setIsDropdownOpen(false);
      } else if (initialProduct) {
        setSelectedProduct(initialProduct);
        setSearchInput(initialProduct.longDescription || initialProduct.description || '');
        setBatchRows([{ expiryDate: '', quantity: 1, batchLot: '', notes: '' }]);
        setIsDropdownOpen(false);
      } else {
        setSelectedProduct(null);
        setSearchInput('');
        setSelectedDeptFilter('ALL');
        setBatchRows([{ expiryDate: '', quantity: 1, batchLot: '', notes: '' }]);
        setIsDropdownOpen(false);
        setTimeout(() => searchInputRef.current?.focus(), 150);
      }
    }
  }, [isOpen, editingBatch, initialProduct, inventoryProducts]);

  // Extract unique departments for filter dropdown
  const departmentsList = useMemo(() => {
    const set = new Set<string>();
    for (const p of inventoryProducts) {
      const d = p.departmentName || p.department;
      if (d) set.add(d);
    }
    return Array.from(set).sort();
  }, [inventoryProducts]);

  // Live filter suggestions based on advanced search engine
  const searchSuggestions = useMemo(() => {
    const q = searchInput.trim();
    if (!q && selectedDeptFilter === 'ALL') return [];

    let filtered = inventoryProducts;
    if (selectedDeptFilter !== 'ALL') {
      filtered = filtered.filter(
        (p) => (p.departmentName || p.department) === selectedDeptFilter
      );
    }

    if (!q) return filtered.slice(0, 15);

    return filtered
      .filter((p) => {
        const desc = p.longDescription || p.description || '';
        const scanCode = p.scanCode || p.barcode || '';
        const itemCode = String(p.itemCode || p.productId || p.id || '');
        return matchAdvancedSearch(desc, q, scanCode, itemCode);
      })
      .slice(0, 25);
  }, [searchInput, selectedDeptFilter, inventoryProducts]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectProduct = (prod: any) => {
    setSelectedProduct(prod);
    setSearchInput(prod.longDescription || prod.description || '');
    setIsDropdownOpen(false);
    setErrorMessage(null);
  };

  const handleBarcodeScanned = (barcode: string, matchedProduct?: any) => {
    setIsScannerOpen(false);
    if (matchedProduct) {
      handleSelectProduct(matchedProduct);
    } else {
      // Find in inventoryProducts
      const found = inventoryProducts.find(
        (p) =>
          String(p.scanCode || p.barcode || '').trim().toLowerCase() === barcode.trim().toLowerCase() ||
          String(p.itemCode || p.productId || '').trim().toLowerCase() === barcode.trim().toLowerCase()
      );
      if (found) {
        handleSelectProduct(found);
      } else {
        setSearchInput(barcode);
        setIsDropdownOpen(true);
      }
    }
  };

  // Add another batch row
  const handleAddBatchRow = () => {
    setBatchRows((prev) => [
      ...prev,
      { expiryDate: '', quantity: 1, batchLot: '', notes: '' },
    ]);
  };

  // Remove a batch row
  const handleRemoveBatchRow = (index: number) => {
    if (batchRows.length <= 1) return;
    setBatchRows((prev) => prev.filter((_, i) => i !== index));
  };

  // Update a specific field in a batch row
  const handleUpdateBatchRow = (index: number, field: keyof BatchEntryRow, value: any) => {
    setBatchRows((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  // Preset date helper for a specific row
  const applyPresetDays = (rowIndex: number, days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    handleUpdateBatchRow(rowIndex, 'expiryDate', `${yyyy}-${mm}-${dd}`);
  };

  // Preset End of Month
  const applyEndOfMonth = (rowIndex: number) => {
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const yyyy = lastDay.getFullYear();
    const mm = String(lastDay.getMonth() + 1).padStart(2, '0');
    const dd = String(lastDay.getDate()).padStart(2, '0');
    handleUpdateBatchRow(rowIndex, 'expiryDate', `${yyyy}-${mm}-${dd}`);
  };

  // Save batches to backend
  const handleSave = async () => {
    if (!selectedProduct) {
      setErrorMessage('Please select a product first.');
      return;
    }

    // Validation on rows
    for (let i = 0; i < batchRows.length; i++) {
      const row = batchRows[i];
      if (!row.expiryDate) {
        setErrorMessage(`Please select an expiry date for Batch #${i + 1}.`);
        return;
      }
      if (!row.quantity || Number(row.quantity) <= 0) {
        setErrorMessage(`Please enter a valid quantity (> 0) for Batch #${i + 1}.`);
        return;
      }
    }

    setIsSaving(true);
    setErrorMessage(null);

    const stockItemId = Number(selectedProduct.productId || selectedProduct.stockItemId || selectedProduct.id || 0);
    const productCode = String(selectedProduct.itemCode || selectedProduct.productCode || stockItemId);
    const productName = String(selectedProduct.longDescription || selectedProduct.description || 'Product');
    const barcode = selectedProduct.scanCode || selectedProduct.barcode;
    const departmentCode = selectedProduct.departmentCode;
    const departmentName = selectedProduct.departmentName || selectedProduct.department;

    try {
      if (editingBatch && batchRows.length === 1) {
        // Single Batch PUT Update
        const singleRow = batchRows[0];
        const res = await fetch(`/api/expiry/${editingBatch.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            expiryDate: singleRow.expiryDate,
            quantity: Number(singleRow.quantity),
            batchLot: singleRow.batchLot || undefined,
            notes: singleRow.notes || undefined,
            productName,
            productCode,
            barcode,
            departmentCode,
            departmentName,
          }),
        });

        if (!res.ok) throw new Error('Failed to update expiry batch');
        const data = await res.json();
        setSuccessMessage('Expiry batch updated successfully!');
        setTimeout(() => {
          onBatchesSaved([data.batch]);
          onClose();
        }, 500);
      } else {
        // Bulk or Multi-Batch Creation POST
        const payloadBatches = batchRows.map((row) => ({
          id: row.id,
          stockItemId,
          productCode,
          productName,
          barcode,
          departmentCode,
          departmentName,
          quantity: Number(row.quantity),
          expiryDate: row.expiryDate,
          batchLot: row.batchLot || undefined,
          notes: row.notes || undefined,
          status: 'active' as const,
        }));

        const res = await fetch('/api/expiry/batches/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ batches: payloadBatches }),
        });

        if (!res.ok) throw new Error('Failed to save expiry batches');
        const data = await res.json();
        setSuccessMessage(`Successfully recorded ${payloadBatches.length} batch(es)!`);
        setTimeout(() => {
          onBatchesSaved(data.batches || payloadBatches);
          onClose();
        }, 600);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error saving expiry records.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-3xl shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4.5 bg-gradient-to-r from-blue-600 to-indigo-700 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/15 rounded-xl backdrop-blur-xs">
              {editingBatch ? <Edit2 className="w-5 h-5" /> : <Calendar className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight">
                {editingBatch ? 'Edit Expiry Batch' : 'Record Product Expiry Batches'}
              </h2>
              <p className="text-xs text-blue-100/90 font-medium">
                {editingBatch
                  ? 'Update tracked expiry date, quantity, and batch details'
                  : 'Track multiple shelf batches, arrival dates, and expiry countdowns'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/20 text-white transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Step 1: Product Search & Identification Bar */}
          {!editingBatch && (
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-neutral-300">
                1. Search Product by Name (*wildcard), Barcode or Scan
              </label>

              <div className="relative" ref={dropdownRef}>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={searchInput}
                      onChange={(e) => {
                        setSearchInput(e.target.value);
                        setIsDropdownOpen(true);
                        setHighlightedIndex(0);
                      }}
                      onFocus={() => {
                        if (searchInput.trim() || selectedDeptFilter !== 'ALL') {
                          setIsDropdownOpen(true);
                        }
                      }}
                      placeholder="Type product name (e.g. *Dare, Milk 2L), barcode, or scan code..."
                      className="w-full pl-10 pr-10 py-3 text-sm bg-slate-50 dark:bg-neutral-800 border border-slate-300 dark:border-neutral-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-900 dark:text-neutral-100 placeholder-slate-400"
                    />
                    {searchInput && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchInput('');
                          setSelectedProduct(null);
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-neutral-200"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Department Filter Dropdown */}
                  <select
                    value={selectedDeptFilter}
                    onChange={(e) => setSelectedDeptFilter(e.target.value)}
                    className="py-3 px-3 text-xs font-semibold bg-slate-50 dark:bg-neutral-800 border border-slate-300 dark:border-neutral-700 rounded-2xl text-slate-700 dark:text-neutral-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shrink-0 max-w-[150px]"
                  >
                    <option value="ALL">All Depts</option>
                    {departmentsList.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>

                  {/* Camera Barcode Scanner Trigger Button */}
                  <button
                    type="button"
                    onClick={() => setIsScannerOpen(true)}
                    className="p-3 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-2xl flex items-center gap-1.5 text-xs font-bold transition-colors cursor-pointer shrink-0"
                    title="Scan Barcode via Camera"
                  >
                    <Camera className="w-4 h-4" />
                    <span className="hidden sm:inline">Camera Scan</span>
                  </button>
                </div>

                {/* Suggestions Dropdown */}
                {isDropdownOpen && searchSuggestions.length > 0 && (
                  <div className="absolute z-30 left-0 right-0 mt-1.5 max-h-60 overflow-y-auto bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-2xl shadow-xl divide-y divide-slate-100 dark:divide-neutral-700/60">
                    {searchSuggestions.map((prod, idx) => {
                      const isHighlighted = idx === highlightedIndex;
                      return (
                        <div
                          key={prod.productId || prod.id || idx}
                          onClick={() => handleSelectProduct(prod)}
                          onMouseEnter={() => setHighlightedIndex(idx)}
                          className={`p-3 cursor-pointer transition-colors flex items-center justify-between text-xs ${
                            isHighlighted
                              ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200'
                              : 'hover:bg-slate-50 dark:hover:bg-neutral-700/50 text-slate-800 dark:text-neutral-200'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-slate-100 dark:bg-neutral-700 rounded-xl text-slate-600 dark:text-neutral-300 shrink-0">
                              <Package className="w-4 h-4" />
                            </div>
                            <div>
                              <span className="font-bold block text-slate-900 dark:text-neutral-100">
                                {prod.longDescription || prod.description}
                              </span>
                              <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-neutral-400 mt-0.5">
                                <span>Code: <strong className="font-mono">{prod.itemCode || prod.productId}</strong></span>
                                {prod.scanCode && (
                                  <span>Barcode: <strong className="font-mono">{prod.scanCode}</strong></span>
                                )}
                                <span>Dept: <strong>{prod.departmentName || prod.department || 'General'}</strong></span>
                              </div>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="font-bold text-slate-900 dark:text-neutral-100 font-mono text-sm block">
                              ${Number(prod.sellingPrice || prod.sellPrice || 0).toFixed(2)}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              POS Stock: {prod.currentStock ?? 0}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Selected Product Card */}
          {selectedProduct ? (
            <div className="p-4 bg-slate-50 dark:bg-neutral-800/60 border border-slate-200 dark:border-neutral-700 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3.5">
                <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-xs shrink-0">
                  <Package className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                      {selectedProduct.departmentName || selectedProduct.department || 'General'}
                    </span>
                    <span className="text-xs font-mono text-slate-500">
                      ID: #{selectedProduct.productId || selectedProduct.stockItemId || selectedProduct.id}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-neutral-100 mt-0.5">
                    {selectedProduct.longDescription || selectedProduct.description || selectedProduct.productName}
                  </h3>
                  <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-neutral-400 mt-0.5">
                    {selectedProduct.scanCode && (
                      <span className="flex items-center gap-1 font-mono">
                        <Barcode className="w-3.5 h-3.5 text-slate-400" />
                        {selectedProduct.scanCode}
                      </span>
                    )}
                    <span>
                      POS In-Stock: <strong>{selectedProduct.currentStock ?? 0}</strong>
                    </span>
                  </div>
                </div>
              </div>

              {!editingBatch && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedProduct(null);
                    setSearchInput('');
                  }}
                  className="text-xs text-blue-600 hover:text-blue-700 font-bold underline cursor-pointer"
                >
                  Change Product
                </button>
              )}
            </div>
          ) : (
            <div className="p-6 border-2 border-dashed border-slate-200 dark:border-neutral-700 rounded-2xl text-center text-slate-400 text-xs">
              Search and select a product above to configure expiry batches.
            </div>
          )}

          {/* Step 2: Multi-Batch Entry Rows */}
          {selectedProduct && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-neutral-300 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-blue-600" />
                  <span>2. Expiry Batches & Quantities</span>
                </label>

                {!editingBatch && (
                  <button
                    type="button"
                    onClick={handleAddBatchRow}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 text-blue-700 dark:text-blue-300 rounded-xl text-xs font-bold border border-blue-200 dark:border-blue-800 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Another Batch</span>
                  </button>
                )}
              </div>

              {/* Rows List */}
              <div className="space-y-4">
                {batchRows.map((row, rIdx) => {
                  const daysUntil = row.expiryDate ? getDaysUntilExpiry(row.expiryDate) : null;
                  const relativeStr = row.expiryDate ? formatExpiryRelative(row.expiryDate) : null;

                  return (
                    <div
                      key={row.id || rIdx}
                      className="p-4 bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-2xl shadow-xs space-y-3"
                    >
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-neutral-700/50 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold text-[10px] flex items-center justify-center">
                            {rIdx + 1}
                          </span>
                          <span className="font-bold text-slate-800 dark:text-neutral-200">
                            Batch #{rIdx + 1}
                          </span>
                          {relativeStr && (
                            <span
                              className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                daysUntil !== null && daysUntil < 0
                                  ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                  : daysUntil !== null && daysUntil <= 7
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                                  : daysUntil !== null && daysUntil <= 30
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                  : 'bg-slate-100 text-slate-700 dark:bg-neutral-700 dark:text-neutral-300'
                              }`}
                            >
                              {relativeStr}
                            </span>
                          )}
                        </div>

                        {batchRows.length > 1 && !editingBatch && (
                          <button
                            type="button"
                            onClick={() => handleRemoveBatchRow(rIdx)}
                            className="text-rose-600 hover:text-rose-700 p-1 rounded-lg hover:bg-rose-50 transition-colors"
                            title="Remove this batch row"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      {/* Input Grid: Expiry Date & Quantity */}
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                        {/* Expiry Date Picker */}
                        <div className="sm:col-span-6 space-y-1">
                          <label className="text-[11px] font-bold text-slate-600 dark:text-neutral-400">
                            Expiry Date (YYYY-MM-DD) <span className="text-rose-500">*</span>
                          </label>
                          <div className="relative">
                            <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <input
                              type="date"
                              value={row.expiryDate}
                              onChange={(e) => handleUpdateBatchRow(rIdx, 'expiryDate', e.target.value)}
                              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-neutral-900 border border-slate-300 dark:border-neutral-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold text-slate-900 dark:text-neutral-100 cursor-pointer"
                              required
                            />
                          </div>
                        </div>

                        {/* Batch Quantity */}
                        <div className="sm:col-span-6 space-y-1">
                          <label className="text-[11px] font-bold text-slate-600 dark:text-neutral-400">
                            Tracked Quantity <span className="text-rose-500">*</span>
                          </label>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                handleUpdateBatchRow(
                                  rIdx,
                                  'quantity',
                                  Math.max(1, (Number(row.quantity) || 1) - 1)
                                )
                              }
                              className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-neutral-700 hover:bg-slate-200 text-slate-700 dark:text-neutral-200 font-bold flex items-center justify-center cursor-pointer shrink-0"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min="1"
                              step="1"
                              value={row.quantity}
                              onChange={(e) =>
                                handleUpdateBatchRow(
                                  rIdx,
                                  'quantity',
                                  Math.max(1, parseInt(e.target.value, 10) || 1)
                                )
                              }
                              className="w-full py-2 text-center text-sm bg-slate-50 dark:bg-neutral-900 border border-slate-300 dark:border-neutral-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold font-mono text-slate-900 dark:text-neutral-100"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                handleUpdateBatchRow(
                                  rIdx,
                                  'quantity',
                                  (Number(row.quantity) || 1) + 1
                                )
                              }
                              className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-neutral-700 hover:bg-slate-200 text-slate-700 dark:text-neutral-200 font-bold flex items-center justify-center cursor-pointer shrink-0"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Quick Expiry Date Preset Buttons */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">
                          Presets:
                        </span>
                        <button
                          type="button"
                          onClick={() => applyPresetDays(rIdx, 3)}
                          className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-slate-100 dark:bg-neutral-700 text-slate-700 dark:text-neutral-300 hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors"
                        >
                          +3 Days
                        </button>
                        <button
                          type="button"
                          onClick={() => applyPresetDays(rIdx, 7)}
                          className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-slate-100 dark:bg-neutral-700 text-slate-700 dark:text-neutral-300 hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors"
                        >
                          +7 Days
                        </button>
                        <button
                          type="button"
                          onClick={() => applyPresetDays(rIdx, 14)}
                          className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-slate-100 dark:bg-neutral-700 text-slate-700 dark:text-neutral-300 hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors"
                        >
                          +14 Days
                        </button>
                        <button
                          type="button"
                          onClick={() => applyPresetDays(rIdx, 30)}
                          className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-slate-100 dark:bg-neutral-700 text-slate-700 dark:text-neutral-300 hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors"
                        >
                          +30 Days
                        </button>
                        <button
                          type="button"
                          onClick={() => applyPresetDays(rIdx, 60)}
                          className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-slate-100 dark:bg-neutral-700 text-slate-700 dark:text-neutral-300 hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors"
                        >
                          +60 Days
                        </button>
                        <button
                          type="button"
                          onClick={() => applyPresetDays(rIdx, 90)}
                          className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-slate-100 dark:bg-neutral-700 text-slate-700 dark:text-neutral-300 hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors"
                        >
                          +90 Days
                        </button>
                        <button
                          type="button"
                          onClick={() => applyEndOfMonth(rIdx)}
                          className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-slate-100 dark:bg-neutral-700 text-slate-700 dark:text-neutral-300 hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors"
                        >
                          End of Month
                        </button>
                      </div>

                      {/* Optional Batch/Lot and Notes */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        <div>
                          <input
                            type="text"
                            value={row.batchLot || ''}
                            onChange={(e) => handleUpdateBatchRow(rIdx, 'batchLot', e.target.value)}
                            placeholder="Batch / Lot # (optional)"
                            className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 rounded-lg text-slate-800 dark:text-neutral-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <input
                            type="text"
                            value={row.notes || ''}
                            onChange={(e) => handleUpdateBatchRow(rIdx, 'notes', e.target.value)}
                            placeholder="Notes / Supplier pallet ref (optional)"
                            className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 rounded-lg text-slate-800 dark:text-neutral-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Feedback messages */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs font-semibold text-rose-800 dark:text-rose-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-neutral-800 border-t border-slate-200 dark:border-neutral-700 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500">
            {batchRows.length} batch(es) to save (Total:{' '}
            <strong>{batchRows.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0)} units</strong>)
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white dark:bg-neutral-700 hover:bg-slate-100 text-slate-700 dark:text-neutral-200 border border-slate-300 dark:border-neutral-600 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSaving || !selectedProduct}
              onClick={handleSave}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              {isSaving ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>{editingBatch ? 'Update Expiry Batch' : 'Save Expiry Batches'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Embedded Barcode Scanner Camera Modal */}
      <UniversalBarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        inventoryProducts={inventoryProducts}
        onScan={handleBarcodeScanned}
        title="Scan Product Barcode for Expiry"
        subtitle="Hold camera steady over barcode on shelf or carton"
      />
    </div>
  );
};
