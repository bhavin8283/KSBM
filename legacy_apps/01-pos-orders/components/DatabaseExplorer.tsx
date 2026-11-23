import React, { useState, useEffect } from 'react';
import {
  Database,
  Search,
  Table as TableIcon,
  LayoutGrid,
  FileDigit,
  List,
  CheckSquare,
  Square,
  Zap,
  CheckCircle2,
  AlertCircle,
  Save,
  RotateCcw,
  ShieldCheck,
  PauseCircle,
  Layers,
  ArrowLeft,
  X,
} from 'lucide-react';

const APP_CORE_TABLES = [
  // Stock & Inventory
  'StockItems',
  'StockItemsValue',
  'StockTransaction',
  'StockPurchases',
  'StockPurchaseLines',
  'StockTransfers',
  'Departments',
  'Groups',
  'Locations',

  // Sales & POS Transactions
  'Transactions',
  'TransactionsLine',
  'TransactionType',
  'PendingSales',
  'PendingSaleLines',

  // Clerks, Staff & Terminals
  'Clerk',
  'Users',
  'POSTerminals',

  // Cash & Shift Declarations
  'CashDeclaration',
  'CashDeclarationAmount',

  // Promotions, Discounts & Coupons
  'POSPromotions',
  'PromotionGroups',
  'PromotionTables',
  'PromotionTableItem',
  'SpecialPrices',
  'PriceChanges',
  'Coupon',

  // Creditors & Suppliers
  'Creditor',
  'CreditorTransaction',

  // Customers & Loyalty
  'Customer',
  'CustomerTransaction',

  // Wastage / Write-offs
  'WriteOffCategories',
  'WriteOffTransaction',
  'WriteOffTransactionLines',

  // System Configurations
  'Options',
];

export default function DatabaseExplorer({ activeDatabase }: { activeDatabase: string | null }) {
  const [tables, setTables] = useState<string[]>([]);
  const [syncedTables, setSyncedTables] = useState<Set<string>>(new Set(APP_CORE_TABLES));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<'directory' | 'viewer'>('directory');
  const [tableData, setTableData] = useState<{
    columns: string[];
    rows: any[];
    count: number;
    disabled?: boolean;
    isOfflineCache?: boolean;
    isLive?: boolean;
    message?: string;
  } | null>(null);
  const [tableLoading, setTableLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'synced' | 'disabled'>('all');

  useEffect(() => {
    if (activeDatabase) {
      fetchTablesAndSyncedConfig();
    }
  }, [activeDatabase]);

  const fetchTablesAndSyncedConfig = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tables?database=${activeDatabase || ''}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const allFetched: string[] = data.tables || [];
      setTables(allFetched);

      if (Array.isArray(data.syncedTables) && data.syncedTables.length > 0) {
        setSyncedTables(new Set(data.syncedTables));
      } else {
        // Fallback default: enable core tables, disable others
        const initial = allFetched.filter((t) =>
          APP_CORE_TABLES.some((c) => c.toLowerCase() === t.toLowerCase())
        );
        setSyncedTables(new Set(initial.length > 0 ? initial : APP_CORE_TABLES));
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const persistSyncedTables = async (newSyncedSet: Set<string>) => {
    const arr = Array.from(newSyncedSet);
    setSyncedTables(newSyncedSet);
    try {
      const res = await fetch('/api/synced-tables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ syncedTables: arr }),
      });
      const data = await res.json();
      if (data.success) {
        setSaveSuccessMsg('Sync configuration saved');
        setTimeout(() => setSaveSuccessMsg(null), 2500);
      }
    } catch (e) {
      console.error('Failed to save synced tables:', e);
    }
  };

  const toggleTableSync = (tableName: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const nextSet = new Set<string>();
    const lower = tableName.toLowerCase();
    let alreadySynced = false;

    for (const s of syncedTables) {
      if (s.toLowerCase() === lower) {
        alreadySynced = true;
      } else {
        nextSet.add(s);
      }
    }

    if (!alreadySynced) {
      nextSet.add(tableName);
    }

    persistSyncedTables(nextSet);

    // Refresh active table view if toggled
    if (selectedTable === tableName) {
      fetchTableData(tableName);
    }
  };

  const isCoreTable = (name: string) =>
    APP_CORE_TABLES.some((c) => c.toLowerCase() === name.toLowerCase());

  const isTableSynced = (name: string) => {
    if (syncedTables.has(name)) return true;
    const lower = name.toLowerCase();
    for (const s of syncedTables) {
      if (s.toLowerCase() === lower) return true;
    }
    return false;
  };

  // Combine tables with any synced tables that might be offline core items
  const allDisplayTables = Array.from(
    new Set([...tables, ...Array.from(syncedTables)])
  ).sort((a, b) => a.localeCompare(b));

  const matchedCoreTables = allDisplayTables.filter((t) => isCoreTable(t));
  const matchedCoreCount = matchedCoreTables.length;

  const handleSelectCoreOnly = () => {
    // Find all core POS tables that exist in the database (32 core tables)
    const coreMatches = allDisplayTables.filter((t) => isCoreTable(t));
    const finalSet = new Set<string>(coreMatches.length > 0 ? coreMatches : APP_CORE_TABLES);
    persistSyncedTables(finalSet);
    setSearchQuery(''); // Clear search query so all synced tables are immediately displayed
    setFilterMode('synced'); // Switch to Synced tab to see all synced tables
    setSaveSuccessMsg(`Synced ${finalSet.size} core POS tables`);
    setTimeout(() => setSaveSuccessMsg(null), 3000);
  };

  const handleSelectAll = () => {
    persistSyncedTables(new Set<string>(tables));
  };

  const handleDeselectAll = () => {
    persistSyncedTables(new Set<string>());
  };

  const fetchTableData = async (tableName: string) => {
    setSelectedTable(tableName);
    setMobileTab('viewer');
    setTableLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/table/${tableName}?database=${activeDatabase || ''}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setTableData({
        columns: data.columns || [],
        rows: data.rows || [],
        count: data.count || (data.rows ? data.rows.length : 0),
        disabled: false,
        isOfflineCache: data.isOfflineCache ?? false,
        isLive: data.isLive ?? true,
        message: data.message,
      });
    } catch (err: any) {
      setError(err.message);
      setTableData(null);
    } finally {
      setTableLoading(false);
    }
  };

  const filteredTables = allDisplayTables.filter((t) => {
    const q = searchQuery.trim().toLowerCase();
    const isSynced = isTableSynced(t);

    if (!q) {
      if (filterMode === 'synced') return isSynced;
      if (filterMode === 'disabled') return !isSynced;
      return true;
    }

    // Search anywhere in the table name (e.g. "Options" matches "POSOptions", "SystemOptions", "StockOptions", etc.)
    const searchTerms = q.split(/\s+/).filter(Boolean);
    const tableNameLower = t.toLowerCase();
    const matchesSearch = searchTerms.every((term) => tableNameLower.includes(term));

    if (filterMode === 'synced') return matchesSearch && isSynced;
    if (filterMode === 'disabled') return matchesSearch && !isSynced;
    return matchesSearch;
  });

  const highlightMatch = (text: string, query: string) => {
    const q = query.trim();
    if (!q) return text;
    try {
      const escaped = q.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
      const regex = new RegExp(`(${escaped})`, 'gi');
      const parts = text.split(regex);
      return parts.map((part, i) =>
        regex.test(part) ? (
          <span key={i} className="bg-amber-200 text-amber-900 font-bold px-0.5 rounded-xs">
            {part}
          </span>
        ) : (
          part
        )
      );
    } catch {
      return text;
    }
  };

  const syncedCount = allDisplayTables.filter((t) => isTableSynced(t)).length;
  const disabledCount = Math.max(0, allDisplayTables.length - syncedCount);

  if (!activeDatabase) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white rounded-xl shadow-sm border border-gray-100 text-center">
        <Database className="w-12 h-12 text-gray-300 mb-4" />
        <h3 className="text-lg font-medium text-gray-900">No Database Connected</h3>
        <p className="text-gray-500 mt-2 max-w-md">
          Please connect to a SQL Server in the Settings tab to start exploring tables.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-11rem)]">
      {/* Top Banner: Sync Control Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 border border-blue-100 rounded-lg text-blue-600">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-slate-900 text-sm">Database Sync Controller</h2>
              {saveSuccessMsg && (
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1 animate-in fade-in">
                  <CheckCircle2 className="w-3 h-3" /> {saveSuccessMsg}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Select which tables to keep synced. <span className="text-emerald-700 font-medium">Synced tables are cached & available to view even when your POS computer is offline or disconnected.</span>
            </p>
          </div>
        </div>

        {/* Sync Summary Metrics & Quick Preset Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg text-xs font-semibold">
            <span className="px-2.5 py-1 bg-white text-slate-800 rounded-md shadow-2xs font-mono">
              {allDisplayTables.length} Total
            </span>
            <span className="px-2.5 py-1 bg-emerald-600 text-white rounded-md font-mono flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-200 animate-pulse" />
              {syncedCount} Synced
            </span>
            <span className="px-2.5 py-1 bg-slate-300 text-slate-700 rounded-md font-mono">
              {disabledCount} Paused
            </span>
          </div>

          <button
            type="button"
            onClick={handleSelectCoreOnly}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-2xs"
            title="Enable and sync all core POS tables (Clerk, Cash Declaration, Promotions, Special Prices, Stock, Transactions, Creditor, etc.)"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Enable {matchedCoreCount > 0 ? `${matchedCoreCount} Core POS Tables` : '32 Core POS Tables'}
          </button>

          <button
            type="button"
            onClick={handleSelectAll}
            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
          >
            Select All
          </button>
          <button
            type="button"
            onClick={handleDeselectAll}
            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
          >
            Deselect All
          </button>
        </div>
      </div>

      {/* Mobile Screen Navigation Toggle (Visible on small screens) */}
      <div className="flex lg:hidden bg-slate-200/80 p-1 rounded-xl mb-1 font-semibold text-xs text-slate-700 shrink-0">
        <button
          type="button"
          onClick={() => setMobileTab('directory')}
          className={`flex-1 py-2 rounded-lg text-center transition-all flex items-center justify-center gap-1.5 ${
            mobileTab === 'directory' ? 'bg-white text-blue-700 shadow-2xs font-bold' : 'hover:text-slate-900'
          }`}
        >
          <LayoutGrid className="w-3.5 h-3.5" />
          <span>Tables Directory ({allDisplayTables.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('viewer')}
          className={`flex-1 py-2 rounded-lg text-center transition-all flex items-center justify-center gap-1.5 ${
            mobileTab === 'viewer' ? 'bg-white text-blue-700 shadow-2xs font-bold' : 'hover:text-slate-900'
          }`}
        >
          <TableIcon className="w-3.5 h-3.5 text-blue-600" />
          <span className="truncate max-w-[120px]">
            {selectedTable ? `Data: ${selectedTable}` : 'Data View'}
          </span>
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0">
        {/* Sidebar: Table List with Checkboxes */}
        <div className={`w-full lg:w-80 flex-col bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden shrink-0 ${
          mobileTab === 'directory' ? 'flex' : 'hidden lg:flex'
        }`}>
          <div className="p-3 border-b border-slate-100 bg-slate-50/50 space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                <LayoutGrid className="w-4 h-4 text-blue-600" />
                Tables Directory ({allDisplayTables.length})
              </h3>
              <span className="text-[10px] text-emerald-700 font-medium">Checked = Offline Ready</span>
            </div>

            {/* Search Box */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400 pointer-events-none" />
              <input
                id="database-table-search-input"
                type="text"
                placeholder="Search table name anywhere (e.g. Options)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-7 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-2 p-0.5 text-slate-400 hover:text-slate-600 rounded-full transition-colors"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter Mode Tabs */}
            <div className="grid grid-cols-3 gap-1 bg-slate-200/70 p-0.5 rounded-lg text-[11px] font-semibold text-slate-600">
              <button
                type="button"
                onClick={() => setFilterMode('all')}
                className={`py-1 rounded-md text-center transition-all ${
                  filterMode === 'all' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'hover:text-slate-900'
                }`}
              >
                All ({allDisplayTables.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('synced')}
                className={`py-1 rounded-md text-center transition-all flex items-center justify-center gap-1 ${
                  filterMode === 'synced'
                    ? 'bg-emerald-600 text-white shadow-2xs font-bold ring-1 ring-emerald-700'
                    : 'text-emerald-800 hover:bg-emerald-100/70 font-medium'
                }`}
                title="View tables currently active for sync and offline viewing"
              >
                <span className={`w-1.5 h-1.5 rounded-full ${filterMode === 'synced' ? 'bg-white' : 'bg-emerald-500'}`} />
                Synced ({syncedCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('disabled')}
                className={`py-1 rounded-md text-center transition-all ${
                  filterMode === 'disabled' ? 'bg-slate-700 text-white shadow-2xs font-bold' : 'hover:text-slate-900'
                }`}
              >
                Paused ({disabledCount})
              </button>
            </div>

            {/* Active search filter badge */}
            {searchQuery && (
              <div className="bg-amber-50 border border-amber-200/80 rounded-lg px-2.5 py-1.5 text-[11px] text-amber-900 flex items-center justify-between shadow-2xs">
                <span className="truncate mr-1">
                  Filtering by <strong>&quot;{searchQuery}&quot;</strong> ({filteredTables.length} of {filterMode === 'synced' ? syncedCount : filterMode === 'disabled' ? disabledCount : allDisplayTables.length})
                </span>
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-amber-800 hover:text-amber-950 font-bold underline text-[10px] shrink-0"
                >
                  Clear
                </button>
              </div>
            )}

            {/* Explanatory note */}
            <div className="bg-emerald-50/70 border border-emerald-100 rounded-md px-2 py-1 text-[10px] text-emerald-800 flex items-center gap-1.5">
              <Zap className="w-3 h-3 text-emerald-600 shrink-0" />
              <span>Selecting tables here caches records for offline access.</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-1.5">
            {loading ? (
              <div className="p-6 text-center text-slate-400 text-xs">Loading database tables...</div>
            ) : error && !tableData ? (
              <div className="p-4 text-center text-rose-500 text-xs">{error}</div>
            ) : filteredTables.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-xs space-y-1">
                <p className="font-semibold text-slate-600">
                  {filterMode === 'synced'
                    ? 'No tables currently synced'
                    : filterMode === 'disabled'
                    ? 'No paused tables'
                    : 'No matching tables found'}
                </p>
                {filterMode === 'synced' && (
                  <p className="text-[11px] text-slate-400">
                    Switch to <strong>All ({allDisplayTables.length})</strong> and check any table to sync it.
                  </p>
                )}
              </div>
            ) : (
              <ul className="space-y-0.5">
                {filteredTables.map((tableName) => {
                  const isChecked = isTableSynced(tableName);
                  const isCore = isCoreTable(tableName);
                  const isSelected = selectedTable === tableName;

                  return (
                    <li key={tableName}>
                      <div
                        onClick={() => fetchTableData(tableName)}
                        className={`group w-full text-left px-2.5 py-1.5 text-xs rounded-lg transition-colors flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? 'bg-blue-50 text-blue-900 font-semibold border border-blue-200'
                            : 'text-slate-700 hover:bg-slate-100 border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0 pr-1">
                          {/* Sync Checkbox */}
                          <button
                            type="button"
                            onClick={(e) => toggleTableSync(tableName, e)}
                            className="p-0.5 rounded text-slate-400 hover:text-blue-600 transition-colors shrink-0"
                            title={isChecked ? 'Click to unselect and pause offline sync' : 'Click to select and sync for offline use'}
                          >
                            {isChecked ? (
                              <CheckSquare className="w-4 h-4 text-emerald-600" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-300 hover:text-slate-400" />
                            )}
                          </button>

                          <TableIcon
                            className={`w-3.5 h-3.5 shrink-0 ${
                              isSelected ? 'text-blue-600' : isChecked ? 'text-emerald-500' : 'text-slate-300'
                            }`}
                          />
                          <span className={`truncate font-mono ${!isChecked ? 'opacity-60 text-slate-500' : ''}`}>
                            {highlightMatch(tableName, searchQuery)}
                          </span>
                        </div>

                        {/* Badges */}
                        <div className="flex items-center gap-1 shrink-0">
                          {isCore && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 bg-blue-100 text-blue-700 rounded">
                              Core
                            </span>
                          )}
                          <span
                            className={`w-2 h-2 rounded-full ${
                              isChecked ? 'bg-emerald-500' : 'bg-slate-300'
                            }`}
                            title={isChecked ? 'Sync Active (Offline Available)' : 'Sync Paused'}
                          />
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Main Content: Table Viewer / Sync Disabled Notification */}
        <div className={`flex-1 flex-col bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden min-w-0 ${
          mobileTab === 'viewer' ? 'flex' : 'hidden lg:flex'
        }`}>
          {tableLoading ? (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : !selectedTable || !tableData ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50/50">
              <TableIcon className="w-12 h-12 text-slate-300 mb-3" />
              <h3 className="text-base font-bold text-slate-800">Select a Table</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                Click any table in the directory to inspect records or check boxes to enable offline caching.
              </p>
            </div>
          ) : (
            <>
              {/* Active Table Header */}
              <div className="p-3.5 border-b border-slate-100 bg-slate-50/50 flex flex-wrap gap-4 items-center justify-between">
                <div>
                  {/* Mobile Back Button */}
                  <button
                    type="button"
                    onClick={() => setMobileTab('directory')}
                    className="lg:hidden text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 mb-2 bg-blue-50 px-2.5 py-1 rounded-md w-fit"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Back to Tables Directory
                  </button>

                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-bold text-slate-900 font-mono">{selectedTable}</h2>
                    {isCoreTable(selectedTable) && (
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full">
                        App Core Table
                      </span>
                    )}
                    {isTableSynced(selectedTable) ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Sync Active (Offline Ready)
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full flex items-center gap-1">
                        <PauseCircle className="w-3 h-3" /> Sync Paused
                      </span>
                    )}
                    {tableData.isOfflineCache && (
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-full flex items-center gap-1">
                        <Zap className="w-3 h-3 text-indigo-600" /> Offline Cached Snapshot
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <FileDigit className="w-3.5 h-3.5 text-slate-400" /> {tableData.columns.length} Columns
                    </span>
                    <span className="flex items-center gap-1">
                      <List className="w-3.5 h-3.5 text-slate-400" /> {tableData.count.toLocaleString()} Total Records
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => toggleTableSync(selectedTable)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-2xs ${
                    isTableSynced(selectedTable)
                      ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  }`}
                >
                  {isTableSynced(selectedTable) ? (
                    <>
                      <PauseCircle className="w-3.5 h-3.5 text-amber-600" />
                      Pause Offline Sync
                    </>
                  ) : (
                    <>
                      <CheckSquare className="w-3.5 h-3.5" />
                      Enable Offline Sync
                    </>
                  )}
                </button>
              </div>

              {/* Records Table */}
              <div className="flex-1 overflow-auto bg-white">
                <table className="w-full text-xs text-left whitespace-nowrap">
                  <thead className="text-[11px] text-slate-600 uppercase bg-slate-50 sticky top-0 border-b border-slate-200 shadow-2xs z-10 font-bold">
                    <tr>
                      {tableData.columns.map((col) => (
                        <th key={col} className="px-4 py-2.5 font-bold tracking-wider font-mono">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {tableData.rows.map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                        {tableData.columns.map((col) => (
                          <td key={col} className="px-4 py-2 text-slate-700 truncate max-w-xs font-mono">
                            {row[col] !== null ? (
                              String(row[col])
                            ) : (
                              <span className="text-slate-300 italic font-normal">NULL</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {tableData.rows.length === 0 && (
                      <tr>
                        <td colSpan={tableData.columns.length || 1} className="px-6 py-8 text-center text-slate-400">
                          No records found in this table.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="p-2.5 border-t border-slate-100 bg-slate-50 text-[11px] text-slate-500 text-center font-mono flex items-center justify-between px-4">
                <span>Showing top {Math.min(100, tableData.rows.length)} records out of {tableData.count.toLocaleString()} total</span>
                {tableData.isOfflineCache && (
                  <span className="text-indigo-600 font-semibold">POS Disconnected • Showing Offline Cached Copy</span>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

