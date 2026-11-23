import React, { useState, useEffect, useMemo } from 'react';
import {
  Clock,
  AlertOctagon,
  AlertTriangle,
  Calendar,
  Layers,
  Plus,
  Search,
  Filter,
  RefreshCw,
  CheckCircle2,
  Trash2,
  Edit2,
  Check,
  X,
  Package,
  Barcode,
  Sparkles,
  ChevronDown,
  Archive,
  ArrowUpDown,
  History,
  FileText,
} from 'lucide-react';
import {
  ExpiryBatch,
  getDaysUntilExpiry,
  formatExpiryRelative,
  getExpiryBadgeConfig,
  getBatchCategory,
} from '../expiryUtils';
import { AddEditExpiryModal } from './AddEditExpiryModal';
import { matchAdvancedSearch } from './InventoryManager';

interface ExpiryManagementTableViewProps {
  inventoryProducts?: any[];
  initialFilter?: string;
}

type ExpiryTabFilter = 'ALL_ACTIVE' | 'EXPIRED' | 'THIS_WEEK' | 'THIS_MONTH' | 'FUTURE' | 'RESOLVED';

export const ExpiryManagementTableView: React.FC<ExpiryManagementTableViewProps> = ({
  inventoryProducts = [],
  initialFilter,
}) => {
  const [batches, setBatches] = useState<ExpiryBatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTab, setSelectedTab] = useState<ExpiryTabFilter>(() => {
    if (initialFilter === 'expiry_unresolved') return 'EXPIRED';
    return 'ALL_ACTIVE';
  });
  const [selectedDepartment, setSelectedDepartment] = useState<string>('ALL');

  // Modal states
  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState<ExpiryBatch | null>(null);
  const [resolvingBatchId, setResolvingBatchId] = useState<string | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // Sorting
  const [sortField, setSortField] = useState<'expiryDate' | 'productName' | 'quantity' | 'departmentName' | 'createdAt'>('expiryDate');
  const [sortAsc, setSortAsc] = useState(true);

  // Fetch batches from backend
  const fetchBatches = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/expiry/batches');
      if (res.ok) {
        const json = await res.json();
        setBatches(json.batches || []);
      }
    } catch (e) {
      console.warn('Failed to load expiry batches:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBatches();
  }, []);

  // Department options
  const departmentOptions = useMemo(() => {
    const set = new Set<string>();
    for (const b of batches) {
      if (b.departmentName) set.add(b.departmentName);
    }
    for (const p of inventoryProducts) {
      const d = p.departmentName || p.department;
      if (d) set.add(d);
    }
    return Array.from(set).sort();
  }, [batches, inventoryProducts]);

  // Summary counts
  const summaryCounts = useMemo(() => {
    let activeTotal = 0;
    let expiredUnresolved = 0;
    let thisWeek = 0;
    let thisMonth = 0;
    let future = 0;
    let resolved = 0;

    for (const b of batches) {
      if (b.status === 'active') {
        activeTotal++;
        const days = getDaysUntilExpiry(b.expiryDate);
        if (days < 0) {
          expiredUnresolved++;
        } else if (days <= 7) {
          thisWeek++;
        } else if (days <= 30) {
          thisMonth++;
        } else {
          future++;
        }
      } else {
        resolved++;
      }
    }

    return { activeTotal, expiredUnresolved, thisWeek, thisMonth, future, resolved };
  }, [batches]);

  // Filtered batches
  const filteredBatches = useMemo(() => {
    return batches
      .filter((b) => {
        // Tab Filter
        const cat = getBatchCategory(b);
        if (selectedTab === 'ALL_ACTIVE' && b.status !== 'active') return false;
        if (selectedTab === 'EXPIRED' && (b.status !== 'active' || cat !== 'EXPIRED')) return false;
        if (selectedTab === 'THIS_WEEK' && (b.status !== 'active' || cat !== 'THIS_WEEK')) return false;
        if (selectedTab === 'THIS_MONTH' && (b.status !== 'active' || cat !== 'THIS_MONTH')) return false;
        if (selectedTab === 'FUTURE' && (b.status !== 'active' || cat !== 'FUTURE')) return false;
        if (selectedTab === 'RESOLVED' && b.status === 'active') return false;

        // Department Filter
        if (selectedDepartment !== 'ALL' && b.departmentName !== selectedDepartment) {
          return false;
        }

        // Search Query (Supports wildcard * matching via matchAdvancedSearch)
        if (searchQuery.trim()) {
          const matchName = matchAdvancedSearch(
            b.productName,
            searchQuery,
            b.barcode,
            b.productCode
          );
          const matchLot = b.batchLot && b.batchLot.toLowerCase().includes(searchQuery.toLowerCase().trim());
          const matchNotes = b.notes && b.notes.toLowerCase().includes(searchQuery.toLowerCase().trim());
          if (!matchName && !matchLot && !matchNotes) return false;
        }

        return true;
      })
      .sort((a, b) => {
        let valA: any = a[sortField];
        let valB: any = b[sortField];

        if (sortField === 'quantity') {
          valA = Number(valA || 0);
          valB = Number(valB || 0);
        } else {
          valA = String(valA || '').toLowerCase();
          valB = String(valB || '').toLowerCase();
        }

        if (valA < valB) return sortAsc ? -1 : 1;
        if (valA > valB) return sortAsc ? 1 : -1;
        return 0;
      });
  }, [batches, selectedTab, selectedDepartment, searchQuery, sortField, sortAsc]);

  // Resolution actions
  const handleResolveBatch = async (
    batchId: string,
    action: 'sold' | 'written_off' | 'cleared',
    staffName = 'Inventory Manager'
  ) => {
    try {
      const res = await fetch(`/api/expiry/${batchId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, staffName }),
      });
      if (res.ok) {
        const json = await res.json();
        setBatches(json.batches || []);
        setActionSuccessMsg(`Batch successfully marked as ${action.replace('_', ' ')}!`);
        setTimeout(() => setActionSuccessMsg(null), 3000);
      }
    } catch (e) {
      console.error('Resolve batch error:', e);
    } finally {
      setResolvingBatchId(null);
    }
  };

  // Delete batch
  const handleDeleteBatch = async (batchId: string) => {
    if (!window.confirm('Are you sure you want to permanently delete this expiry batch record?')) return;
    try {
      const res = await fetch(`/api/expiry/${batchId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        const json = await res.json();
        setBatches(json.batches || []);
        setActionSuccessMsg('Batch deleted successfully.');
        setTimeout(() => setActionSuccessMsg(null), 3000);
      }
    } catch (e) {
      console.error('Delete batch error:', e);
    }
  };

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. METRICS SUMMARY BANNER */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Active */}
        <button
          type="button"
          onClick={() => setSelectedTab('ALL_ACTIVE')}
          className={`p-3.5 rounded-2xl border transition-all text-left cursor-pointer ${
            selectedTab === 'ALL_ACTIVE'
              ? 'bg-blue-600 text-white border-blue-600 shadow-md scale-102'
              : 'bg-white dark:bg-neutral-800 border-slate-200 dark:border-neutral-700 hover:border-blue-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs opacity-80">
            <span>Total Active</span>
            <Layers className="w-3.5 h-3.5" />
          </div>
          <div className="text-xl font-black mt-1">{summaryCounts.activeTotal}</div>
          <div className="text-[10px] opacity-75">All shelf batches</div>
        </button>

        {/* Expired Unresolved */}
        <button
          type="button"
          onClick={() => setSelectedTab('EXPIRED')}
          className={`p-3.5 rounded-2xl border transition-all text-left cursor-pointer ${
            selectedTab === 'EXPIRED'
              ? 'bg-rose-600 text-white border-rose-600 shadow-md scale-102'
              : 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/60 hover:border-rose-400 text-rose-950 dark:text-rose-200'
          }`}
        >
          <div className="flex items-center justify-between text-xs opacity-80">
            <span className="font-bold">Expired (Unresolved)</span>
            <AlertOctagon className="w-3.5 h-3.5 text-rose-500" />
          </div>
          <div className="text-xl font-black mt-1">{summaryCounts.expiredUnresolved}</div>
          <div className="text-[10px] opacity-75">Needs staff action</div>
        </button>

        {/* Expiring This Week */}
        <button
          type="button"
          onClick={() => setSelectedTab('THIS_WEEK')}
          className={`p-3.5 rounded-2xl border transition-all text-left cursor-pointer ${
            selectedTab === 'THIS_WEEK'
              ? 'bg-blue-600 text-white border-blue-600 shadow-md scale-102'
              : 'bg-blue-50/70 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900/60 hover:border-blue-400 text-blue-950 dark:text-blue-200'
          }`}
        >
          <div className="flex items-center justify-between text-xs opacity-80">
            <span className="font-bold">This Week (≤7d)</span>
            <Clock className="w-3.5 h-3.5 text-blue-500" />
          </div>
          <div className="text-xl font-black mt-1">{summaryCounts.thisWeek}</div>
          <div className="text-[10px] opacity-75">Markdowns / clearance</div>
        </button>

        {/* Expiring This Month */}
        <button
          type="button"
          onClick={() => setSelectedTab('THIS_MONTH')}
          className={`p-3.5 rounded-2xl border transition-all text-left cursor-pointer ${
            selectedTab === 'THIS_MONTH'
              ? 'bg-emerald-600 text-white border-emerald-600 shadow-md scale-102'
              : 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/60 hover:border-emerald-400 text-emerald-950 dark:text-emerald-200'
          }`}
        >
          <div className="flex items-center justify-between text-xs opacity-80">
            <span className="font-bold">This Month (8-30d)</span>
            <Calendar className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <div className="text-xl font-black mt-1">{summaryCounts.thisMonth}</div>
          <div className="text-[10px] opacity-75">Upcoming rotation</div>
        </button>

        {/* Future / Safe */}
        <button
          type="button"
          onClick={() => setSelectedTab('FUTURE')}
          className={`p-3.5 rounded-2xl border transition-all text-left cursor-pointer ${
            selectedTab === 'FUTURE'
              ? 'bg-slate-700 text-white border-slate-700 shadow-md scale-102'
              : 'bg-slate-50 dark:bg-neutral-800 border-slate-200 dark:border-neutral-700 hover:border-slate-400 text-slate-800 dark:text-neutral-200'
          }`}
        >
          <div className="flex items-center justify-between text-xs opacity-80">
            <span>Safe / Future (&gt;30d)</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="text-xl font-black mt-1">{summaryCounts.future}</div>
          <div className="text-[10px] opacity-75">Fresh inventory</div>
        </button>

        {/* Resolved Archive */}
        <button
          type="button"
          onClick={() => setSelectedTab('RESOLVED')}
          className={`p-3.5 rounded-2xl border transition-all text-left cursor-pointer ${
            selectedTab === 'RESOLVED'
              ? 'bg-slate-900 text-white border-slate-900 shadow-md scale-102'
              : 'bg-slate-100/80 dark:bg-neutral-800/80 border-slate-300 dark:border-neutral-700 hover:border-slate-500 text-slate-700 dark:text-neutral-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs opacity-80">
            <span>Resolved Archive</span>
            <Archive className="w-3.5 h-3.5" />
          </div>
          <div className="text-xl font-black mt-1">{summaryCounts.resolved}</div>
          <div className="text-[10px] opacity-75">Sold / Wastage log</div>
        </button>
      </div>

      {/* Action Notification Banner */}
      {actionSuccessMsg && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-2xl flex items-center gap-2 text-xs font-bold text-emerald-800 dark:text-emerald-300 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionSuccessMsg}</span>
        </div>
      )}

      {/* 2. FILTER & SEARCH TOOLBAR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-3xl shadow-xs">
        {/* Search Bar */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search product (*wildcard), barcode, batch lot..."
            className="w-full pl-10 pr-9 py-2.5 text-xs bg-slate-50 dark:bg-neutral-800 border border-slate-300 dark:border-neutral-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-neutral-100 placeholder-slate-400 font-medium"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Department Filter & Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={selectedDepartment}
            onChange={(e) => setSelectedDepartment(e.target.value)}
            className="py-2.5 px-3 text-xs font-semibold bg-slate-50 dark:bg-neutral-800 border border-slate-300 dark:border-neutral-700 rounded-2xl text-slate-700 dark:text-neutral-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            <option value="ALL">All Departments ({batches.length})</option>
            {departmentOptions.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>

          {/* Refresh */}
          <button
            type="button"
            onClick={fetchBatches}
            className="p-2.5 bg-slate-50 dark:bg-neutral-800 hover:bg-slate-100 text-slate-600 dark:text-neutral-300 border border-slate-300 dark:border-neutral-700 rounded-2xl transition-colors cursor-pointer"
            title="Refresh Batches"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
          </button>

          {/* Add Expiry Batch Button */}
          <button
            type="button"
            onClick={() => {
              setEditingBatch(null);
              setIsAddEditModalOpen(true);
            }}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-2xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add Expiry Batch</span>
          </button>
        </div>
      </div>

      {/* 3. BATCHES TABLE */}
      <div className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-3xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-neutral-800/80 border-b border-slate-200 dark:border-neutral-700 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400">
                <th className="py-3.5 px-4">Status & Action</th>
                <th
                  onClick={() => toggleSort('productName')}
                  className="py-3.5 px-4 cursor-pointer hover:text-blue-600"
                >
                  <div className="flex items-center gap-1">
                    <span>Product Name</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort('departmentName')}
                  className="py-3.5 px-4 cursor-pointer hover:text-blue-600"
                >
                  <div className="flex items-center gap-1">
                    <span>Department</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3.5 px-4">Barcode / Code</th>
                <th
                  onClick={() => toggleSort('expiryDate')}
                  className="py-3.5 px-4 cursor-pointer hover:text-blue-600"
                >
                  <div className="flex items-center gap-1">
                    <span>Expiry Date</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort('quantity')}
                  className="py-3.5 px-4 text-center cursor-pointer hover:text-blue-600"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Tracked Qty</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3.5 px-4">Batch Lot & Notes</th>
                <th
                  onClick={() => toggleSort('createdAt')}
                  className="py-3.5 px-4 cursor-pointer hover:text-blue-600"
                >
                  <div className="flex items-center gap-1">
                    <span>Logged Date</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-neutral-800 font-medium">
              {filteredBatches.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <Clock className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-neutral-600" />
                    <p className="text-sm font-semibold">No expiry batches found matching this filter.</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Click &quot;Add Expiry Batch&quot; above to log tracked shelf items.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredBatches.map((batch) => {
                  const daysUntil = getDaysUntilExpiry(batch.expiryDate);
                  const isResolved = batch.status !== 'active';
                  const isExpired = !isResolved && daysUntil < 0;
                  const relativeStr = formatExpiryRelative(batch.expiryDate);

                  return (
                    <tr
                      key={batch.id}
                      className={`hover:bg-slate-50/70 dark:hover:bg-neutral-800/50 transition-colors ${
                        isExpired ? 'bg-rose-50/30 dark:bg-rose-950/15' : ''
                      }`}
                    >
                      {/* Status Badge */}
                      <td className="py-3 px-4">
                        {isResolved ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 dark:bg-neutral-700 dark:text-neutral-300">
                            <CheckCircle2 className="w-3 h-3 text-slate-500" />
                            <span>RESOLVED: {String(batch.resolvedReason || batch.status).toUpperCase()}</span>
                          </span>
                        ) : isExpired ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                            <AlertOctagon className="w-3 h-3 text-rose-600 animate-pulse" />
                            <span>EXPIRED – UNRESOLVED</span>
                          </span>
                        ) : daysUntil <= 7 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-300 dark:border-blue-800">
                            <Clock className="w-3 h-3 text-blue-600" />
                            <span>EXPIRING THIS WEEK</span>
                          </span>
                        ) : daysUntil <= 30 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                            <Calendar className="w-3 h-3 text-emerald-600" />
                            <span>EXPIRING THIS MONTH</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 dark:bg-neutral-800 dark:text-neutral-300">
                            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                            <span>SAFE / FUTURE</span>
                          </span>
                        )}
                      </td>

                      {/* Product Name */}
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-900 dark:text-neutral-100 block">
                          {batch.productName}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          ID: #{batch.stockItemId}
                        </span>
                      </td>

                      {/* Department */}
                      <td className="py-3 px-4 text-slate-600 dark:text-neutral-300">
                        {batch.departmentName || 'General'}
                      </td>

                      {/* Barcode */}
                      <td className="py-3 px-4 font-mono text-slate-600 dark:text-neutral-400">
                        {batch.barcode || batch.productCode || '—'}
                      </td>

                      {/* Expiry Date */}
                      <td className="py-3 px-4">
                        <span
                          className={`font-bold block ${
                            isExpired
                              ? 'text-rose-600 dark:text-rose-400'
                              : daysUntil <= 7
                              ? 'text-blue-600 dark:text-blue-400'
                              : 'text-slate-800 dark:text-neutral-200'
                          }`}
                        >
                          {batch.expiryDate}
                        </span>
                        <span className="text-[10px] text-slate-500 block">
                          {relativeStr}
                        </span>
                      </td>

                      {/* Tracked Quantity */}
                      <td className="py-3 px-4 text-center">
                        <span className="inline-block px-2.5 py-0.5 rounded-lg font-mono font-bold text-xs bg-slate-100 dark:bg-neutral-800 text-slate-900 dark:text-neutral-100">
                          {batch.quantity}
                        </span>
                      </td>

                      {/* Batch Lot & Notes */}
                      <td className="py-3 px-4 text-slate-500 dark:text-neutral-400 max-w-[180px] truncate">
                        {batch.batchLot && (
                          <span className="font-mono font-semibold text-slate-700 dark:text-neutral-300 mr-1">
                            [{batch.batchLot}]
                          </span>
                        )}
                        <span>{batch.notes || '—'}</span>
                      </td>

                      {/* Logged Date */}
                      <td className="py-3 px-4 text-slate-400 text-[11px]">
                        {batch.createdAt ? batch.createdAt.slice(0, 10) : '—'}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Resolve Dropdown / Quick Button for Active Items */}
                          {!isResolved && (
                            <div className="relative">
                              <button
                                type="button"
                                onClick={() =>
                                  setResolvingBatchId(
                                    resolvingBatchId === batch.id ? null : batch.id
                                  )
                                }
                                className="px-2 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 text-blue-700 dark:text-blue-300 font-bold text-[11px] border border-blue-200 dark:border-blue-800 transition-colors flex items-center gap-1 cursor-pointer"
                              >
                                <span>Resolve</span>
                                <ChevronDown className="w-3 h-3" />
                              </button>

                              {resolvingBatchId === batch.id && (
                                <div className="absolute right-0 mt-1 z-30 w-44 bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-xl shadow-xl p-1 text-xs space-y-0.5 animate-in fade-in">
                                  <button
                                    type="button"
                                    onClick={() => handleResolveBatch(batch.id, 'sold')}
                                    className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-emerald-50 text-emerald-700 dark:hover:bg-emerald-950/40 dark:text-emerald-300 font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                    <span>Mark as Sold</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleResolveBatch(batch.id, 'written_off')}
                                    className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-rose-50 text-rose-700 dark:hover:bg-rose-950/40 dark:text-rose-300 font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                                  >
                                    <AlertTriangle className="w-3.5 h-3.5" />
                                    <span>Write Off (Wastage)</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleResolveBatch(batch.id, 'cleared')}
                                    className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-100 text-slate-700 dark:hover:bg-neutral-700 dark:text-neutral-300 font-medium transition-colors cursor-pointer"
                                  >
                                    Clear Entry
                                  </button>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Edit Batch */}
                          <button
                            type="button"
                            onClick={() => {
                              setEditingBatch(batch);
                              setIsAddEditModalOpen(true);
                            }}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
                            title="Edit Batch"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete Batch */}
                          <button
                            type="button"
                            onClick={() => handleDeleteBatch(batch.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                            title="Delete Batch Record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Expiry Modal */}
      <AddEditExpiryModal
        isOpen={isAddEditModalOpen}
        onClose={() => {
          setIsAddEditModalOpen(false);
          setEditingBatch(null);
        }}
        inventoryProducts={inventoryProducts}
        editingBatch={editingBatch}
        onBatchesSaved={() => {
          fetchBatches();
        }}
      />
    </div>
  );
};
