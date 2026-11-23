import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search,
  Filter,
  Package,
  TrendingUp,
  Clock,
  Calendar,
  Layers,
  RefreshCw,
  Barcode,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  CheckCircle2,
  AlertCircle,
  Tag,
  ArrowRight,
  SlidersHorizontal,
  Eye,
  Check,
} from 'lucide-react';
import { InventoryItem, CurrentUserSession } from '../types';
import { StockOrderAssistantModal } from './StockOrderAssistantModal';
import { matchAdvancedSearch } from './InventoryManager';

interface StockSuggestionsTableViewProps {
  currentUser?: CurrentUserSession | null;
  inventoryProducts?: InventoryItem[];
}

export interface ColumnVisibilityState {
  department: boolean;
  sales7d: boolean;
  sales30d: boolean;
  sales90d: boolean;
  salesPeriod: boolean;
  lastCount: boolean;
  suggestedStock: boolean;
  actions: boolean;
}

const DEFAULT_COLUMN_VISIBILITY: ColumnVisibilityState = {
  department: true,
  sales7d: true,
  sales30d: true,
  sales90d: true,
  salesPeriod: true,
  lastCount: true,
  suggestedStock: true,
  actions: true,
};

const COLUMN_CONFIG: { id: keyof ColumnVisibilityState; label: string }[] = [
  { id: 'department', label: 'Department' },
  { id: 'sales7d', label: '7-Day Sales' },
  { id: 'sales30d', label: '30-Day Sales' },
  { id: 'sales90d', label: '90-Day Sales' },
  { id: 'salesPeriod', label: '6M / 12M Sales' },
  { id: 'lastCount', label: 'Last Physical Count' },
  { id: 'suggestedStock', label: 'Suggested Stock on Hand' },
  { id: 'actions', label: 'Actions (Inspect/Count)' },
];

export const StockSuggestionsTableView: React.FC<StockSuggestionsTableViewProps> = ({
  currentUser,
  inventoryProducts = [],
}) => {
  const [period, setPeriod] = useState<'6months' | '12months'>('6months');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Column Visibility Controls
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibilityState>(() => {
    try {
      const saved = localStorage.getItem('pos_stock_suggestions_columns');
      if (saved) {
        return { ...DEFAULT_COLUMN_VISIBILITY, ...JSON.parse(saved) };
      }
    } catch {}
    return DEFAULT_COLUMN_VISIBILITY;
  });
  const [isColumnMenuOpen, setIsColumnMenuOpen] = useState(false);
  const columnMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem('pos_stock_suggestions_columns', JSON.stringify(columnVisibility));
    } catch {}
  }, [columnVisibility]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (columnMenuRef.current && !columnMenuRef.current.contains(e.target as Node)) {
        setIsColumnMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleColumn = (colId: keyof ColumnVisibilityState) => {
    setColumnVisibility((prev) => ({
      ...prev,
      [colId]: !prev[colId],
    }));
  };

  const resetColumns = () => {
    setColumnVisibility(DEFAULT_COLUMN_VISIBILITY);
  };

  // Sorting
  const [sortField, setSortField] = useState<string>('sales30d');
  const [sortAsc, setSortAsc] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Modal inspection
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Fetch suggested stock items from backend
  const fetchSuggestions = async () => {
    setLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams();
      queryParams.append('period', period);
      if (selectedDept !== 'ALL') {
        queryParams.append('department', selectedDept);
      }
      const res = await fetch(`/api/inventory/stock-suggestions?${queryParams.toString()}`);
      if (!res.ok) throw new Error('Failed to load stock suggestions');
      const data = await res.json();
      setItems(data.items || []);
    } catch (err: any) {
      setError(err.message || 'Error fetching stock suggestions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuggestions();
    setCurrentPage(1);
  }, [period, selectedDept]);

  // Extract unique departments for dropdown
  const departments = useMemo(() => {
    const set = new Set<string>();
    for (const item of items) {
      if (item.departmentName) set.add(item.departmentName);
    }
    return Array.from(set).sort();
  }, [items]);

  // Filter items by client-side advanced search
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (!searchQuery.trim()) return true;
      return matchAdvancedSearch(
        item.longDescription || item.description || '',
        searchQuery,
        item.scanCode,
        item.itemCode
      );
    });
  }, [items, searchQuery]);

  // Sorted items
  const sortedItems = useMemo(() => {
    const list = [...filteredItems];
    return list.sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      if (sortField === 'sales7d' || sortField === 'sales30d' || sortField === 'sales90d' || sortField === 'sales180d' || sortField === 'sales365d') {
        valA = a.movement?.[sortField] ?? 0;
        valB = b.movement?.[sortField] ?? 0;
      } else if (sortField === 'suggestedStockToHold') {
        valA = a.suggestedStockToHold ?? 0;
        valB = b.suggestedStockToHold ?? 0;
      } else if (sortField === 'lastCount') {
        valA = a.lastObservation?.countedQty ?? -1;
        valB = b.lastObservation?.countedQty ?? -1;
      }

      if (typeof valA === 'string') {
        valA = valA.toLowerCase();
        valB = (valB || '').toLowerCase();
      }

      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [filteredItems, sortField, sortAsc]);

  const totalPages = Math.max(1, Math.ceil(sortedItems.length / pageSize));
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedItems.slice(start, start + pageSize);
  }, [sortedItems, currentPage, pageSize]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const openAssistantForProduct = (productId: number) => {
    setSelectedProductId(productId);
    setIsModalOpen(true);
  };

  const visibleColumnCount = useMemo(() => {
    return 1 + Object.values(columnVisibility).filter(Boolean).length;
  }, [columnVisibility]);

  return (
    <div className="space-y-4">
      {/* Control Header */}
      <div className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Movement Period Filter (6 Months vs 12 Months) */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700 dark:text-neutral-300 whitespace-nowrap">
              Movement Horizon:
            </span>
            <div className="inline-flex bg-slate-100 dark:bg-neutral-800 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setPeriod('6months')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  period === '6months'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-neutral-200'
                }`}
              >
                Last 6 Months (Active Default)
              </button>
              <button
                type="button"
                onClick={() => setPeriod('12months')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  period === '12months'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-neutral-200'
                }`}
              >
                Last 12 Months (Extended)
              </button>
            </div>
          </div>

          {/* Department Filter, Show/Hide Columns & Refresh */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700 dark:text-neutral-300 whitespace-nowrap">
                Department:
              </span>
              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                className="py-1.5 px-3 bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-neutral-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="ALL">All Departments ({departments.length})</option>
                {departments.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            {/* Show / Hide Columns Menu */}
            <div className="relative" ref={columnMenuRef}>
              <button
                type="button"
                onClick={() => setIsColumnMenuOpen(!isColumnMenuOpen)}
                className={`px-3 py-1.5 border rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  isColumnMenuOpen
                    ? 'bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-950/60 dark:border-blue-700 dark:text-blue-300'
                    : 'border-slate-200 dark:border-neutral-700 hover:bg-slate-100 dark:hover:bg-neutral-800 text-slate-700 dark:text-neutral-300'
                }`}
                title="Show or hide table columns"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Columns</span>
              </button>

              {isColumnMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-2xl shadow-xl p-3 z-30 space-y-2 animate-in fade-in zoom-in-95 duration-100">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-neutral-700 pb-2">
                    <span className="text-xs font-black text-slate-900 dark:text-neutral-100">
                      Toggle Columns
                    </span>
                    <button
                      type="button"
                      onClick={resetColumns}
                      className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline font-semibold cursor-pointer"
                    >
                      Reset All
                    </button>
                  </div>
                  <div className="space-y-1 max-h-60 overflow-y-auto">
                    {COLUMN_CONFIG.map((col) => (
                      <label
                        key={col.id}
                        className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-neutral-700/50 rounded-xl cursor-pointer text-xs text-slate-700 dark:text-neutral-200"
                      >
                        <input
                          type="checkbox"
                          checked={columnVisibility[col.id]}
                          onChange={() => toggleColumn(col.id)}
                          className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
                        />
                        <span className="font-medium">{col.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={fetchSuggestions}
              className="p-2 border border-slate-200 dark:border-neutral-700 hover:bg-slate-100 dark:hover:bg-neutral-800 rounded-xl text-slate-600 dark:text-neutral-300 transition-colors cursor-pointer shrink-0"
              title="Refresh stock suggestion calculations"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search active products by name, *wildcard, code, barcode..."
            className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-neutral-800/80 border border-slate-200 dark:border-neutral-700 rounded-xl text-xs font-medium text-slate-900 dark:text-neutral-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Overview Metric Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/50 rounded-2xl">
          <p className="text-[11px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">
            Products with Movement
          </p>
          <p className="text-xl font-black text-blue-900 dark:text-blue-100 mt-0.5">
            {filteredItems.length} <span className="text-xs font-normal text-blue-600">items</span>
          </p>
        </div>

        <div className="p-3 bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/50 rounded-2xl">
          <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">
            Avg Holding Buffer
          </p>
          <p className="text-xl font-black text-indigo-900 dark:text-indigo-100 mt-0.5">
            14 <span className="text-xs font-normal text-indigo-600">days demand</span>
          </p>
        </div>

        <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 rounded-2xl">
          <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
            Calculation Basis
          </p>
          <p className="text-xs font-bold text-emerald-900 dark:text-emerald-200 mt-1">
            Movement & Daily Velocity (Strictly ignores negative POS balances)
          </p>
        </div>

        <div className="p-3 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-2xl">
          <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
            Quick Actions
          </p>
          <button
            type="button"
            onClick={() => {
              setSelectedProductId(null);
              setIsModalOpen(true);
            }}
            className="mt-0.5 text-xs font-black text-amber-900 dark:text-amber-200 hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>Open Assistant Shelf Tool</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Suggestions Management Table */}
      <div className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-neutral-800/80 border-b border-slate-200 dark:border-neutral-700/80 text-slate-600 dark:text-neutral-300 font-bold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">
                  <button
                    type="button"
                    onClick={() => handleSort('longDescription')}
                    className="flex items-center gap-1 hover:text-blue-600"
                  >
                    <span>Product & Barcode</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                {columnVisibility.department && (
                  <th className="py-3 px-3">
                    <button
                      type="button"
                      onClick={() => handleSort('departmentName')}
                      className="flex items-center gap-1 hover:text-blue-600"
                    >
                      <span>Department</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                )}
                {columnVisibility.sales7d && (
                  <th className="py-3 px-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleSort('sales7d')}
                      className="inline-flex items-center gap-1 hover:text-blue-600 ml-auto"
                    >
                      <span>7D Sales</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                )}
                {columnVisibility.sales30d && (
                  <th className="py-3 px-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleSort('sales30d')}
                      className="inline-flex items-center gap-1 hover:text-blue-600 ml-auto"
                    >
                      <span>30D Sales</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                )}
                {columnVisibility.sales90d && (
                  <th className="py-3 px-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleSort('sales90d')}
                      className="inline-flex items-center gap-1 hover:text-blue-600 ml-auto"
                    >
                      <span>90D Sales</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                )}
                {columnVisibility.salesPeriod && (
                  <th className="py-3 px-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleSort('sales180d')}
                      className="inline-flex items-center gap-1 hover:text-blue-600 ml-auto"
                    >
                      <span>{period === '12months' ? '12M Sales' : '6M Sales'}</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                )}
                {columnVisibility.lastCount && (
                  <th className="py-3 px-3">
                    <button
                      type="button"
                      onClick={() => handleSort('lastCount')}
                      className="flex items-center gap-1 hover:text-blue-600"
                    >
                      <span>Last Physical Count</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                )}
                {columnVisibility.suggestedStock && (
                  <th className="py-3 px-4 text-center">
                    <button
                      type="button"
                      onClick={() => handleSort('suggestedStockToHold')}
                      className="inline-flex items-center gap-1 hover:text-blue-600 mx-auto"
                    >
                      <span>Suggested Stock on Hand</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                )}
                {columnVisibility.actions && (
                  <th className="py-3 px-3 text-center">Action</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-neutral-800 text-slate-700 dark:text-neutral-300">
              {loading ? (
                <tr>
                  <td colSpan={visibleColumnCount} className="py-12 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                    Calculating multi-period sales velocities & stock suggestions...
                  </td>
                </tr>
              ) : paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumnCount} className="py-10 text-center text-slate-500">
                    No active products found matching current filter.
                  </td>
                </tr>
              ) : (
                paginatedItems.map((item) => (
                  <tr
                    key={item.productId}
                    className="hover:bg-blue-50/40 dark:hover:bg-neutral-800/50 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900 dark:text-neutral-100">
                        {item.longDescription || item.description}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono mt-0.5">
                        <span>Code: {item.itemCode}</span>
                        <span>•</span>
                        <span>Barcode: {item.scanCode}</span>
                      </div>
                    </td>
                    {columnVisibility.department && (
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-neutral-800 text-slate-700 dark:text-neutral-300 text-[11px] font-semibold">
                          {item.departmentName || 'General'}
                        </span>
                      </td>
                    )}
                    {columnVisibility.sales7d && (
                      <td className="py-3 px-3 text-right font-semibold">
                        {item.movement?.sales7d ?? 0}
                      </td>
                    )}
                    {columnVisibility.sales30d && (
                      <td className="py-3 px-3 text-right font-semibold">
                        {item.movement?.sales30d ?? 0}
                      </td>
                    )}
                    {columnVisibility.sales90d && (
                      <td className="py-3 px-3 text-right font-semibold">
                        {item.movement?.sales90d ?? 0}
                      </td>
                    )}
                    {columnVisibility.salesPeriod && (
                      <td className="py-3 px-3 text-right font-semibold">
                        {period === '12months'
                          ? (item.movement?.sales365d ?? 0)
                          : (item.movement?.sales180d ?? 0)}
                      </td>
                    )}
                    {columnVisibility.lastCount && (
                      <td className="py-3 px-3 whitespace-nowrap text-[11px]">
                        {item.lastObservation ? (
                          <div>
                            <span className="font-black text-indigo-600 dark:text-indigo-400">
                              {item.lastObservation.countedQty} units
                            </span>
                            <span className="text-slate-400 ml-1">
                              on {new Date(item.lastObservation.countedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">No count recorded</span>
                        )}
                      </td>
                    )}
                    {columnVisibility.suggestedStock && (
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-full font-black text-sm shadow-xs">
                          <span>{item.suggestedStockToHold}</span>
                          <span className="text-[10px] font-bold text-blue-500 uppercase">units</span>
                        </span>
                      </td>
                    )}
                    {columnVisibility.actions && (
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => openAssistantForProduct(item.productId)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-blue-600 hover:text-white dark:bg-neutral-800 dark:hover:bg-blue-600 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                          title="Open Assistant for this product"
                        >
                          Inspect / Count
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="p-3 border-t border-slate-200 dark:border-neutral-800 flex items-center justify-between text-xs text-slate-500">
            <span>
              Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, sortedItems.length)} of {sortedItems.length} products
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(currentPage - 1)}
                className="p-1 rounded-lg border border-slate-200 dark:border-neutral-700 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-neutral-800"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2 font-bold text-slate-700 dark:text-neutral-300">
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(currentPage + 1)}
                className="p-1 rounded-lg border border-slate-200 dark:border-neutral-700 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-neutral-800"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Stock Order Assistant Modal */}
      <StockOrderAssistantModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedProductId(null);
          fetchSuggestions(); // refresh observations
        }}
        inventoryProducts={inventoryProducts}
        currentUser={currentUser}
        initialProductId={selectedProductId}
      />
    </div>
  );
};
