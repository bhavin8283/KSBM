import React, { useState } from "react";
import {
  Calendar,
  Layers,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  AlertOctagon,
  Clock,
  Archive,
  FileSpreadsheet,
  AlertTriangle,
} from "lucide-react";
import {
  ExpiryBatch,
  getDaysUntilExpiry,
  getExpiryBadgeConfig,
  getExpiryWarningStatus,
  WastageRecord,
} from "../expiryUtils";

interface ExpiryBatchManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  product?: {
    productId: number;
    stockCode?: string;
    description?: string;
    barcode?: string;
    departmentCode?: any;
    departmentName?: string;
    costPrice?: number;
  } | null;
  batches: ExpiryBatch[];
  onBatchUpdated: () => void;
}

export function ExpiryBatchManagerModal({
  isOpen,
  onClose,
  product,
  batches,
  onBatchUpdated,
}: ExpiryBatchManagerModalProps) {
  const [editingBatch, setEditingBatch] = useState<ExpiryBatch | null>(null);
  const [newBatchMode, setNewBatchMode] = useState(false);
  const [writeOffModalBatch, setWriteOffModalBatch] = useState<ExpiryBatch | null>(null);
  const [writeOffReason, setWriteOffReason] = useState<'expired' | 'damaged' | 'spoiled'>('expired');
  const [writeOffNotes, setWriteOffNotes] = useState("");
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'written_off'>('active');

  // Form states
  const [formQty, setFormQty] = useState("1");
  const [formDate, setFormDate] = useState("");
  const [formLot, setFormLot] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  if (!isOpen) return null;

  const relevantBatches = batches.filter((b) => {
    if (product) {
      if (Number(b.stockItemId) !== Number(product.productId)) return false;
    }
    if (filterStatus !== 'all' && b.status !== filterStatus) return false;
    return true;
  });

  const handleStartEdit = (b: ExpiryBatch) => {
    setEditingBatch(b);
    setFormQty(String(b.quantity));
    setFormDate(b.expiryDate);
    setFormLot(b.batchLot || "");
    setFormNotes(b.notes || "");
    setNewBatchMode(false);
  };

  const handleStartAdd = () => {
    setEditingBatch(null);
    setFormQty("1");
    setFormDate("");
    setFormLot("");
    setFormNotes("");
    setNewBatchMode(true);
  };

  const handleSaveForm = async () => {
    if (!formDate) {
      setErrorMsg("Expiry date is required.");
      return;
    }
    const q = parseFloat(formQty);
    if (isNaN(q) || q <= 0) {
      setErrorMsg("Quantity must be greater than 0.");
      return;
    }

    setIsSaving(true);
    setErrorMsg("");

    try {
      if (editingBatch) {
        const res = await fetch(`/api/expiry/${editingBatch.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            quantity: q,
            expiryDate: formDate,
            batchLot: formLot.trim() || undefined,
            notes: formNotes.trim() || undefined,
            updatedAt: new Date().toISOString(),
          }),
        });
        if (res.ok) {
          setEditingBatch(null);
          onBatchUpdated();
        }
      } else if (newBatchMode && product) {
        const res = await fetch("/api/expiry", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            batch: {
              stockItemId: product.productId,
              productCode: product.stockCode || "",
              productName: product.description || `Product #${product.productId}`,
              barcode: product.barcode,
              departmentCode: product.departmentCode,
              departmentName: product.departmentName,
              quantity: q,
              expiryDate: formDate,
              batchLot: formLot.trim() || undefined,
              notes: formNotes.trim() || undefined,
              status: 'active',
            },
          }),
        });
        if (res.ok) {
          setNewBatchMode(false);
          onBatchUpdated();
        }
      }
    } catch (e) {
      setErrorMsg("Error saving batch.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to remove this expiry batch record?")) return;
    try {
      const res = await fetch(`/api/expiry/${id}`, { method: "DELETE" });
      if (res.ok) {
        onBatchUpdated();
      }
    } catch (e) {
      alert("Error deleting batch.");
    }
  };

  const handleConfirmWriteOff = async () => {
    if (!writeOffModalBatch) return;
    setIsSaving(true);
    try {
      const res = await fetch("/api/wastage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          record: {
            stockItemId: writeOffModalBatch.stockItemId,
            productCode: writeOffModalBatch.productCode,
            productName: writeOffModalBatch.productName,
            barcode: writeOffModalBatch.barcode,
            departmentCode: writeOffModalBatch.departmentCode,
            departmentName: writeOffModalBatch.departmentName,
            quantity: writeOffModalBatch.quantity,
            costPrice: product?.costPrice || 0,
            reason: writeOffReason,
            date: new Date().toISOString(),
            staffName: "Staff",
            expiryBatchId: writeOffModalBatch.id,
            notes: writeOffNotes.trim() || `Written off from batch expiring ${writeOffModalBatch.expiryDate}`,
          },
          closeExpiryBatchId: writeOffModalBatch.id,
        }),
      });

      if (res.ok) {
        setWriteOffModalBatch(null);
        setWriteOffNotes("");
        onBatchUpdated();
      }
    } catch (e) {
      alert("Error processing wastage write-off.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-neutral-50/70 dark:bg-neutral-950/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
                {product ? `Expiry Batches: ${product.description}` : "Store Expiry Batches"}
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {product ? `Item Code: ${product.stockCode || product.productId}` : "All tracked product batches"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action / Filter Bar */}
        <div className="px-6 py-3 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-3 bg-neutral-50/30 dark:bg-neutral-900/30">
          <div className="flex items-center gap-1.5 bg-neutral-100 dark:bg-neutral-800 p-1 rounded-xl">
            {(['active', 'all', 'written_off'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setFilterStatus(st)}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors capitalize ${
                  filterStatus === st
                    ? "bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-sm"
                    : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-800"
                }`}
              >
                {st === 'written_off' ? 'Written Off' : st}
              </button>
            ))}
          </div>

          {product && !newBatchMode && !editingBatch && (
            <button
              onClick={handleStartAdd}
              className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Add New Batch
            </button>
          )}
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {/* Add / Edit Form Drawer */}
          {(newBatchMode || editingBatch) && (
            <div className="p-4 bg-amber-50/60 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700/60 rounded-xl space-y-3 animate-in slide-in-from-top-2">
              <div className="text-xs font-bold text-amber-900 dark:text-amber-200 uppercase tracking-wider">
                {editingBatch ? "Edit Expiry Batch" : "Add New Expiry Batch"}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-600 dark:text-neutral-400 mb-1">
                    Quantity
                  </label>
                  <input
                    type="number"
                    min="0.1"
                    step="any"
                    value={formQty}
                    onChange={(e) => setFormQty(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg text-sm font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-600 dark:text-neutral-400 mb-1">
                    Expiry Date (YYYY-MM-DD)
                  </label>
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-600 dark:text-neutral-400 mb-1">
                    Batch / Lot # (Opt)
                  </label>
                  <input
                    type="text"
                    value={formLot}
                    onChange={(e) => setFormLot(e.target.value)}
                    placeholder="e.g. B-9942"
                    className="w-full px-3 py-2 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-neutral-600 dark:text-neutral-400 mb-1">
                  Notes (Optional)
                </label>
                <input
                  type="text"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="e.g. Back stock room shelf 2"
                  className="w-full px-3 py-2 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg text-sm"
                />
              </div>

              {errorMsg && (
                <div className="text-xs text-rose-600 font-semibold">{errorMsg}</div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setEditingBatch(null);
                    setNewBatchMode(false);
                  }}
                  className="px-3 py-1.5 text-xs text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveForm}
                  disabled={isSaving}
                  className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  {isSaving ? "Saving..." : "Save Batch"}
                </button>
              </div>
            </div>
          )}

          {/* Batch Items List */}
          {relevantBatches.length === 0 ? (
            <div className="p-8 text-center border border-dashed border-neutral-200 dark:border-neutral-800 rounded-2xl">
              <Calendar className="w-8 h-8 mx-auto text-neutral-400 mb-2 opacity-50" />
              <p className="text-sm font-semibold text-neutral-600 dark:text-neutral-400">
                No {filterStatus} expiry batches found.
              </p>
              <p className="text-xs text-neutral-500 mt-1">
                Click "Add New Batch" or use the Quick Scanner to record stock expiry dates.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {relevantBatches.map((b) => {
                const days = getDaysUntilExpiry(b.expiryDate);
                const status = getExpiryWarningStatus(b.expiryDate);
                const badge = getExpiryBadgeConfig(status);

                return (
                  <div
                    key={b.id}
                    className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                      b.status === 'written_off'
                        ? "bg-neutral-50/50 dark:bg-neutral-900/40 border-neutral-200 dark:border-neutral-800 opacity-60"
                        : "bg-white dark:bg-neutral-800/60 border-neutral-200 dark:border-neutral-700/80 shadow-xs"
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] border font-semibold ${badge.bgClass} ${badge.textClass} ${badge.borderClass}`}>
                          {badge.label}
                        </span>
                        {!product && (
                          <span className="font-bold text-sm text-neutral-900 dark:text-neutral-100">
                            {b.productName}
                          </span>
                        )}
                        <span className="text-xs font-mono text-neutral-500 dark:text-neutral-400">
                          Exp: <strong className="text-neutral-800 dark:text-neutral-200">{b.expiryDate}</strong> ({days < 0 ? `${Math.abs(days)}d ago` : `${days}d left`})
                        </span>
                        {b.batchLot && (
                          <span className="text-[11px] bg-neutral-100 dark:bg-neutral-700 px-1.5 py-0.5 rounded text-neutral-600 dark:text-neutral-300 font-mono">
                            Lot: {b.batchLot}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-neutral-500 dark:text-neutral-400 flex items-center gap-3">
                        <span>Batch Qty: <strong className="text-neutral-800 dark:text-neutral-200 font-bold">{b.quantity}</strong></span>
                        {b.notes && <span>Note: <em>{b.notes}</em></span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                      {b.status === 'active' && (
                        <>
                          <button
                            type="button"
                            onClick={() => setWriteOffModalBatch(b)}
                            className="px-2.5 py-1 text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-lg font-semibold transition-colors flex items-center gap-1"
                            title="Move expired or damaged stock to wastage"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Write-Off
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStartEdit(b)}
                            className="p-1.5 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg transition-colors"
                            title="Edit batch"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDelete(b.id)}
                        className="p-1.5 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                        title="Delete record"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Wastage Write-Off Confirmation Modal Sub-View */}
        {writeOffModalBatch && (
          <div className="p-4 bg-rose-50 dark:bg-rose-950/60 border-t border-rose-300 dark:border-rose-800/80 space-y-3 animate-in slide-in-from-bottom-2">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-rose-900 dark:text-rose-200 flex items-center gap-1.5">
                <AlertOctagon className="w-4 h-4 text-rose-600" />
                Confirm Wastage / Write-Off for Batch (Qty: {writeOffModalBatch.quantity})
              </div>
              <button
                onClick={() => setWriteOffModalBatch(null)}
                className="text-neutral-400 hover:text-neutral-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Reason for Write-Off
                </label>
                <select
                  value={writeOffReason}
                  onChange={(e) => setWriteOffReason(e.target.value as any)}
                  className="w-full px-3 py-1.5 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs"
                >
                  <option value="expired">Expired Stock</option>
                  <option value="damaged">Damaged / Broken</option>
                  <option value="spoiled">Spoiled / Out of Temp</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Wastage Notes
                </label>
                <input
                  type="text"
                  value={writeOffNotes}
                  onChange={(e) => setWriteOffNotes(e.target.value)}
                  placeholder="e.g. Removed from coolroom"
                  className="w-full px-3 py-1.5 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setWriteOffModalBatch(null)}
                className="px-3 py-1 text-xs text-neutral-600 hover:bg-neutral-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmWriteOff}
                disabled={isSaving}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm"
              >
                <Check className="w-3.5 h-3.5" />
                Record Wastage & Close Batch
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-3 border-t border-neutral-200 dark:border-neutral-800 flex justify-end bg-neutral-50/70 dark:bg-neutral-950/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 rounded-xl font-medium transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
