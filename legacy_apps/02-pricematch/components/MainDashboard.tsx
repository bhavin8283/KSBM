import React, { useState, useMemo } from 'react';
import { CalculatedProduct, MarkupTiers, CategoryFilter, ViewMode } from '../types';
import { TableView } from './TableView';
import { CardView } from './CardView';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import {
  Search,
  Table as TableIcon,
  LayoutGrid,
  TrendingDown,
  DollarSign,
  Package,
  Award,
  Filter,
  X,
  Tag,
  CheckSquare,
  Square,
  Layers,
  Eye,
  EyeOff,
  Barcode,
  Camera,
  RefreshCw,
} from 'lucide-react';

interface MainDashboardProps {
  products: CalculatedProduct[];
  markupTiers: MarkupTiers;
  onNavigateToSettings?: () => void;
  lastScrapedTime?: string;
  onOpenManualScrape?: () => void;
  hiddenBrands?: string[];
  canScrape?: boolean;
  canExport?: boolean;
  canAccessSettings?: boolean;
  currencySymbol?: string;
  highSpreadThreshold?: number;
}

export const MainDashboard: React.FC<MainDashboardProps> = ({
  products,
  markupTiers,
  onNavigateToSettings,
  lastScrapedTime,
  onOpenManualScrape,
  hiddenBrands = [],
  canScrape = true,
  canExport = true,
  canAccessSettings = true,
  currencySymbol = '$',
  highSpreadThreshold = 2.5,
}) => {
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try {
      const saved = localStorage.getItem('kwik_stop_dashboard_view_mode');
      return saved === 'table' ? 'table' : 'card';
    } catch {
      return 'card';
    }
  });

  const handleSetViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    try {
      localStorage.setItem('kwik_stop_dashboard_view_mode', mode);
    } catch {
      // Ignore storage error
    }
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [sortQuickFilter, setSortQuickFilter] = useState<'none' | 'high-spread'>('none');
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  const [showWholesaleIntelligence, setShowWholesaleIntelligence] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('kwik_stop_show_intelligence');
      return saved !== null ? saved === 'true' : false;
    } catch {
      return false;
    }
  });

  const handleToggleIntelligence = () => {
    setShowWholesaleIntelligence((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('kwik_stop_show_intelligence', String(next));
      } catch {
        // Ignore storage error
      }
      return next;
    });
  };

  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [groupByBrand, setGroupByBrand] = useState<boolean>(false);

  const storeProducts = useMemo(() => {
    return products.filter((p) => {
      if (!p.in_store) return false;
      const b =
        p.brand && p.brand.trim()
          ? p.brand.trim().toUpperCase()
          : (p.product_name.trim().split(/\s+/)[0] || '').toUpperCase();
      if (hiddenBrands && hiddenBrands.includes(b)) {
        return false;
      }
      return true;
    });
  }, [products, hiddenBrands]);

  const brandStats = useMemo(() => {
    const stats: Record<string, number> = {};
    storeProducts.forEach((p) => {
      stats[p.brand] = (stats[p.brand] || 0) + 1;
    });
    return stats;
  }, [storeProducts]);

  const allBrands = useMemo(() => Object.keys(brandStats).sort(), [brandStats]);

  const handleToggleBrand = (brand: string) => {
    if (selectedBrands.length === 0) {
      setSelectedBrands(allBrands.filter((b) => b !== brand));
    } else if (selectedBrands.includes(brand)) {
      setSelectedBrands(selectedBrands.filter((b) => b !== brand));
    } else {
      setSelectedBrands([...selectedBrands, brand]);
    }
  };

  const handleSelectAllBrands = () => setSelectedBrands([]);
  const handleClearAllBrands = () => setSelectedBrands(['__NONE__']);
  const isBrandChecked = (brand: string) => selectedBrands.length === 0 || selectedBrands.includes(brand);

  const filteredProducts = useMemo(() => {
    return storeProducts.filter((p) => {
      if (categoryFilter === 'cigarettes' && p.category !== 'Cigarettes') return false;
      if (categoryFilter === 'ryo' && p.category !== 'RYO / Tobacco') return false;
      if (categoryFilter === 'other' && p.category !== 'Other') return false;

      if (selectedBrands.length > 0 && !selectedBrands.includes(p.brand)) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matches =
          p.product_name.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q) ||
          p.gtin.toLowerCase().includes(q) ||
          p.retail_code.toLowerCase().includes(q) ||
          p.trax_code.toLowerCase().includes(q) ||
          p.campbells_code.toLowerCase().includes(q) ||
          p.onedistribution_code.toLowerCase().includes(q);
        if (!matches) return false;
      }

      if (sortQuickFilter === 'high-spread' && p.spread < highSpreadThreshold) return false;

      return true;
    });
  }, [storeProducts, categoryFilter, selectedBrands, searchQuery, sortQuickFilter, highSpreadThreshold]);

  const totalActive = storeProducts.length;
  const avgSpread = useMemo(() => {
    if (storeProducts.length === 0) return 0;
    return storeProducts.reduce((acc, curr) => acc + curr.spread, 0) / storeProducts.length;
  }, [storeProducts]);

  const maxSpreadProduct = useMemo(() => {
    if (storeProducts.length === 0) return null;
    return [...storeProducts].sort((a, b) => b.spread - a.spread)[0];
  }, [storeProducts]);

  const topSupplierLeader = useMemo(() => {
    const counts: Record<string, number> = { Trax: 0, Campbells: 0, 'One Distribution': 0 };
    storeProducts.forEach((p) => {
      if (counts[p.cheapest_supplier] !== undefined) {
        counts[p.cheapest_supplier]++;
      }
    });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return sorted[0] ? { name: sorted[0][0], count: sorted[0][1] } : { name: 'Trax', count: 0 };
  }, [storeProducts]);

  const activeBrandsCount =
    selectedBrands.length === 0 ? allBrands.length : selectedBrands.filter((b) => b !== '__NONE__').length;

  return (
    <div className="space-y-6" id="main-dashboard-section">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              {showWholesaleIntelligence ? 'Wholesale Price Intelligence' : 'Inventory & Price Matching'}
            </h2>
            <button
              id="header-intelligence-toggle-badge"
              onClick={handleToggleIntelligence}
              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold transition cursor-pointer border ${
                showWholesaleIntelligence
                  ? 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
                  : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
              }`}
              title={
                showWholesaleIntelligence
                  ? 'Click to hide Wholesale Price Intelligence metrics'
                  : 'Click to reveal Wholesale Price Intelligence metrics'
              }
            >
              {showWholesaleIntelligence ? (
                <>
                  <EyeOff className="h-3 w-3" />
                  <span>Metrics Visible</span>
                </>
              ) : (
                <>
                  <Eye className="h-3 w-3" />
                  <span>Metrics Hidden</span>
                </>
              )}
            </button>

            {lastScrapedTime && (
              <div
                id="dashboard-last-scraped-timestamp-badge"
                className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-800 shadow-2xs"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600" />
                </span>
                <span className="text-emerald-700">Last Scraped:</span>
                <span className="font-bold text-emerald-950 font-mono">{lastScrapedTime}</span>
              </div>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {showWholesaleIntelligence
              ? 'Compare wholesale costs across Trax, Campbells, and One Distribution with automated retail reference tiers.'
              : 'Direct inventory view for in-store SKUs. Click "Show Wholesale Intelligence" to reveal macro KPIs and supplier spreads.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canScrape && onOpenManualScrape && (
            <button
              type="button"
              id="dashboard-quick-manual-scrape-btn"
              onClick={onOpenManualScrape}
              className="inline-flex items-center space-x-1.5 rounded-lg border border-emerald-200 bg-emerald-50/80 hover:bg-emerald-100 text-emerald-800 px-3 py-1.5 text-xs font-semibold transition cursor-pointer shadow-2xs"
              title="Scrape latest prices from all wholesale supplier portals"
            >
              <RefreshCw className="h-3.5 w-3.5 text-emerald-600" />
              <span>Scrape Prices</span>
            </button>
          )}

          <button
            id="toggle-wholesale-intelligence-btn"
            onClick={handleToggleIntelligence}
            className={`flex items-center space-x-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition cursor-pointer shadow-2xs ${
              showWholesaleIntelligence
                ? 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                : 'border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold'
            }`}
          >
            {showWholesaleIntelligence ? (
              <>
                <EyeOff className="h-3.5 w-3.5 text-slate-500" />
                <span>Hide Wholesale Intelligence</span>
              </>
            ) : (
              <>
                <Eye className="h-3.5 w-3.5 text-blue-600" />
                <span>Show Wholesale Intelligence</span>
              </>
            )}
          </button>

          <div
            className="inline-flex rounded-lg border border-slate-200 bg-slate-100/90 p-1"
            role="radiogroup"
            aria-label="View mode toggle"
          >
            <button
              id="view-toggle-card"
              onClick={() => handleSetViewMode('card')}
              className={`flex items-center space-x-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                viewMode === 'card' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>Card View</span>
            </button>
            <button
              id="view-toggle-table"
              onClick={() => handleSetViewMode('table')}
              className={`flex items-center space-x-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <TableIcon className="h-3.5 w-3.5" />
              <span>Table View</span>
            </button>
          </div>
        </div>
      </div>

      {showWholesaleIntelligence && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 animate-in fade-in duration-150">
          <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Active In-Store Catalog</span>
              <div className="rounded-lg bg-slate-100 p-2 text-slate-700">
                <Package className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-mono text-2xl font-bold text-slate-900">{totalActive}</span>
              <span className="text-xs text-slate-500">of {products.length} catalog items</span>
            </div>
            <div className="mt-1 text-[11px] text-slate-400">Active in-store SKUs tracked</div>
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Avg Wholesale Variance</span>
              <div className="rounded-lg bg-slate-100 p-2 text-slate-700">
                <TrendingDown className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-mono text-2xl font-bold text-slate-900">
                {currencySymbol}
                {avgSpread.toFixed(2)}
              </span>
              <span className="text-xs font-semibold text-slate-500">spread / item</span>
            </div>
            <div className="mt-1 text-[11px] text-slate-400">Difference between highest &amp; lowest supplier</div>
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Max Savings Spread</span>
              <div className="rounded-lg bg-emerald-50 p-2 text-emerald-700">
                <DollarSign className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-mono text-2xl font-bold text-emerald-700">
                {currencySymbol}
                {maxSpreadProduct ? maxSpreadProduct.spread.toFixed(2) : '0.00'}
              </span>
              <span className="text-xs font-medium text-emerald-600">peak margin gap</span>
            </div>
            <div className="mt-1 text-[11px] text-slate-400 truncate" title={maxSpreadProduct?.product_name}>
              {maxSpreadProduct ? maxSpreadProduct.product_name : 'No items'}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Top Cost Leader</span>
              <div className="rounded-lg bg-slate-100 p-2 text-slate-700">
                <Award className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-xl font-bold text-slate-900">{topSupplierLeader.name}</span>
              <span className="font-mono text-xs font-semibold text-slate-600">
                ({topSupplierLeader.count} best quotes)
              </span>
            </div>
            <div className="mt-1 text-[11px] text-slate-400">
              Lowest cost on {topSupplierLeader.count} wholesale items
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 mr-1 flex items-center gap-1">
              <Filter className="h-3.5 w-3.5 text-slate-400" />
              Category:
            </span>
            <button
              id="category-filter-all"
              onClick={() => setCategoryFilter('all')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                categoryFilter === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80'
              }`}
            >
              All Categories ({storeProducts.length})
            </button>
            <button
              id="category-filter-cigarettes"
              onClick={() => setCategoryFilter('cigarettes')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                categoryFilter === 'cigarettes'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80'
              }`}
            >
              <span>Cigarettes (20s)</span>
              <span className="rounded-full bg-slate-200/70 px-1.5 py-0.2 text-[10px] font-bold">
                {storeProducts.filter((p) => p.category === 'Cigarettes').length}
              </span>
            </button>
            <button
              id="category-filter-ryo"
              onClick={() => setCategoryFilter('ryo')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                categoryFilter === 'ryo'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80'
              }`}
            >
              <span>RYO / Tobacco (30g)</span>
              <span className="rounded-full bg-slate-200/70 px-1.5 py-0.2 text-[10px] font-bold">
                {storeProducts.filter((p) => p.category === 'RYO / Tobacco').length}
              </span>
            </button>
            {storeProducts.filter((p) => p.category === 'Other').length > 0 && (
              <button
                id="category-filter-other"
                onClick={() => setCategoryFilter('other')}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                  categoryFilter === 'other'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80'
                }`}
              >
                <span>Other FMCG</span>
                <span className="rounded-full bg-slate-200/70 px-1.5 py-0.2 text-[10px] font-bold">
                  {storeProducts.filter((p) => p.category === 'Other').length}
                </span>
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              id="group-by-brand-toggle"
              onClick={() => setGroupByBrand(!groupByBrand)}
              className={`flex items-center space-x-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                groupByBrand
                  ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-bold'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              <span>Group by Brand: {groupByBrand ? 'ON' : 'OFF'}</span>
            </button>

            <button
              id="quick-filter-high-spread"
              onClick={() => setSortQuickFilter(sortQuickFilter === 'high-spread' ? 'none' : 'high-spread')}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                sortQuickFilter === 'high-spread'
                  ? 'border-amber-500 bg-amber-50 text-amber-900 font-bold'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              High Spread ({currencySymbol}
              {highSpreadThreshold.toFixed(2)}+)
            </button>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5" id="brand-filter-container">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-2.5 border-b border-slate-200">
            <div className="flex items-center gap-2 flex-wrap">
              <Tag className="h-3.5 w-3.5 text-slate-700" />
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">Filter by Brand Name</span>
              <span className="text-[11px] text-slate-500">(First word in product name)</span>
              <span className="rounded-md bg-white border border-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                {activeBrandsCount} of {allBrands.length} selected
              </span>
              {hiddenBrands.length > 0 && (
                <span className="text-[10px] text-slate-400 font-medium">
                  ({hiddenBrands.length} brand{hiddenBrands.length > 1 ? 's' : ''} hidden in Settings)
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                id="brand-select-all-btn"
                onClick={handleSelectAllBrands}
                className="text-xs font-semibold text-slate-700 hover:text-slate-950 underline decoration-slate-300 transition cursor-pointer"
              >
                Select All
              </button>
              <span className="text-slate-300 text-xs">•</span>
              <button
                id="brand-clear-all-btn"
                onClick={handleClearAllBrands}
                className="text-xs font-semibold text-slate-500 hover:text-slate-700 transition cursor-pointer"
              >
                Clear All
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {allBrands.map((brand) => {
              const checked = isBrandChecked(brand);
              const count = brandStats[brand] || 0;

              return (
                <label
                  key={brand}
                  className={`inline-flex items-center gap-2 rounded-lg border px-2.5 py-1 text-xs cursor-pointer select-none transition ${
                    checked
                      ? 'border-slate-800 bg-slate-900 text-white font-bold shadow-2xs'
                      : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => handleToggleBrand(brand)}
                    className="sr-only"
                  />
                  {checked ? <CheckSquare className="h-3.5 w-3.5 text-white" /> : <Square className="h-3.5 w-3.5 text-slate-400" />}
                  <span>{brand}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                      checked ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {count}
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              id="catalog-search-input"
              type="text"
              placeholder="Search products by brand (e.g. CHESTERFIELD, WINFIELD), GTIN barcode, or SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-slate-50/50 pl-9 pr-24 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:bg-white focus:outline-hidden"
            />
            <div className="absolute right-1.5 top-1.5 flex items-center gap-1">
              {searchQuery && (
                <button
                  type="button"
                  id="dashboard-clear-search-btn"
                  onClick={() => setSearchQuery('')}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded transition"
                  title="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                type="button"
                id="dashboard-scan-barcode-inline-btn"
                onClick={() => setIsScannerOpen(true)}
                className="inline-flex items-center gap-1 rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-2 py-1 text-xs font-semibold transition cursor-pointer shadow-2xs"
                title="Scan retail barcode with camera"
              >
                <Barcode className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Scan</span>
              </button>
            </div>
          </div>

          <button
            type="button"
            id="dashboard-scan-barcode-btn"
            onClick={() => setIsScannerOpen(true)}
            className="hidden sm:inline-flex items-center gap-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white px-3.5 py-2 text-xs font-bold shadow-xs transition cursor-pointer shrink-0"
            title="Scan barcode with phone or web camera"
          >
            <Camera className="h-3.5 w-3.5 text-emerald-400" />
            <Barcode className="h-3.5 w-3.5" />
            <span>Scan Barcode</span>
          </button>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
          <span>
            Showing <strong className="text-slate-900">{filteredProducts.length}</strong> matching active items
          </span>
          {canAccessSettings && onNavigateToSettings && (
            <span className="text-[11px]">
              * Inactive catalog items hidden. Configure in{' '}
              <button onClick={onNavigateToSettings} className="font-bold text-slate-900 hover:underline cursor-pointer">
                Settings
              </button>
            </span>
          )}
        </div>
      </div>

      {viewMode === 'card' ? (
        <CardView
          products={filteredProducts}
          markupTiers={markupTiers}
          groupByBrand={groupByBrand}
          currencySymbol={currencySymbol}
        />
      ) : (
        <TableView
          products={filteredProducts}
          markupTiers={markupTiers}
          groupByBrand={groupByBrand}
          canExport={canExport}
          currencySymbol={currencySymbol}
        />
      )}

      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={(scannedCode) => {
          setSearchQuery(scannedCode);
          setSelectedBrands([]);
        }}
        title="Scan Barcode to Search"
        subtitle="Point camera at product GTIN or Retail SKU barcode to filter dashboard instantly."
        targetFieldLabel="Dashboard Search"
      />
    </div>
  );
};
