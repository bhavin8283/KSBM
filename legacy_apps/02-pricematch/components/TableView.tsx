import React, { useState, useMemo, useEffect, useRef } from 'react';
import { CalculatedProduct, MarkupTiers } from '../types';
import { ArrowUpDown, ArrowUp, ArrowDown, Download, Tag, Columns, RotateCcw, Eye } from 'lucide-react';
import { useTheme } from '../theme';
import { getPackCount } from '../utils/pricing';

interface TableViewProps {
  products: CalculatedProduct[];
  markupTiers: MarkupTiers;
  groupByBrand?: boolean;
  canExport?: boolean;
  currencySymbol?: string;
}

export interface ColumnVisibility {
  brand: boolean;
  gtin: boolean;
  product_name: boolean;
  retail_code: boolean;
  trax: boolean;
  campbells: boolean;
  onedistribution: boolean;
  tier1: boolean;
  tier2: boolean;
  tier3: boolean;
  spread: boolean;
}

const DEFAULT_COLUMN_VISIBILITY: ColumnVisibility = {
  brand: true,
  gtin: true,
  product_name: true,
  retail_code: true,
  trax: true,
  campbells: true,
  onedistribution: true,
  tier1: true,
  tier2: true,
  tier3: true,
  spread: true,
};

const COLUMN_LABELS: Record<keyof ColumnVisibility, string> = {
  brand: 'Brand Name',
  gtin: 'GTIN / Barcode',
  product_name: 'Product Name',
  retail_code: 'Retail SKU',
  trax: 'Trax Price',
  campbells: 'Campbells Price',
  onedistribution: 'One Dist Price',
  tier1: 'Retail Tier 1',
  tier2: 'Retail Tier 2',
  tier3: 'Retail Tier 3',
  spread: 'Wholesale Spread',
};

type SortField =
  | 'brand'
  | 'gtin'
  | 'product_name'
  | 'retail_code'
  | 'trax_price'
  | 'campbells_price'
  | 'onedistribution_price'
  | 'retail_tier1'
  | 'retail_tier2'
  | 'retail_tier3'
  | 'spread';

export const TableView: React.FC<TableViewProps> = ({
  products,
  markupTiers,
  groupByBrand = false,
  canExport = true,
  currencySymbol = '$',
}) => {
  const { currentTheme } = useTheme();
  const [sortField, setSortField] = useState<SortField>('brand');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [isColumnDropdownOpen, setIsColumnDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [columns, setColumns] = useState<ColumnVisibility>(() => {
    try {
      const saved = localStorage.getItem('kwik_stop_table_columns');
      if (saved) {
        return { ...DEFAULT_COLUMN_VISIBILITY, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.error('Failed to parse saved table columns', e);
    }
    return DEFAULT_COLUMN_VISIBILITY;
  });

  const toggleColumn = (key: keyof ColumnVisibility) => {
    setColumns((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem('kwik_stop_table_columns', JSON.stringify(next));
      } catch {
        // Ignore storage error
      }
      return next;
    });
  };

  const resetColumns = () => {
    setColumns(DEFAULT_COLUMN_VISIBILITY);
    try {
      localStorage.setItem('kwik_stop_table_columns', JSON.stringify(DEFAULT_COLUMN_VISIBILITY));
    } catch {
      // Ignore storage error
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsColumnDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const visibleColumnCount = useMemo(() => {
    return Object.values(columns).filter(Boolean).length;
  }, [columns]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedProducts = useMemo(() => {
    return [...products].sort((a, b) => {
      let valA: string | number = a[sortField];
      let valB: string | number = b[sortField];

      if (typeof valA === 'string' && typeof valB === 'string') {
        valA = valA.toLowerCase();
        valB = valB.toLowerCase();
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [products, sortField, sortDirection]);

  const groupedProducts = useMemo(() => {
    if (!groupByBrand) return null;
    const groups: { [brand: string]: CalculatedProduct[] } = {};
    sortedProducts.forEach((p) => {
      if (!groups[p.brand]) groups[p.brand] = [];
      groups[p.brand].push(p);
    });
    return groups;
  }, [sortedProducts, groupByBrand]);

  const handleExportCSV = () => {
    if (!canExport) return;
    const headers = [
      'Brand',
      'GTIN',
      'Product Name',
      'Product Type',
      'Master Pack Size',
      'Retail Code',
      'Category',
      'Trax Code',
      'Trax Price',
      'Campbells Code',
      'Campbells Price',
      'One Distribution Code',
      'One Distribution Price',
      'Lowest Supplier',
      'Lowest Price',
      'Highest Price',
      'Spread',
      `Tier 1 (+${markupTiers.tier1}%)`,
      `Tier 2 (+${markupTiers.tier2}%)`,
      `Tier 3 (+${markupTiers.tier3}%)`,
    ];

    const rows = sortedProducts.map((p) => [
      `"${p.brand}"`,
      `"${p.gtin}"`,
      `"${p.product_name}"`,
      `"${p.product_type || p.category}"`,
      `"${p.master_pack_size || (p.product_type === 'Cigarettes' ? '10 Packs' : '5 Pouches')}"`,
      `"${p.retail_code}"`,
      `"${p.category}"`,
      `"${p.trax_code}"`,
      p.trax_price.toFixed(2),
      `"${p.campbells_code}"`,
      p.campbells_price.toFixed(2),
      `"${p.onedistribution_code}"`,
      p.onedistribution_price.toFixed(2),
      `"${p.cheapest_supplier}"`,
      p.lowest_cost.toFixed(2),
      p.highest_cost.toFixed(2),
      p.spread.toFixed(2),
      p.retail_tier1.toFixed(2),
      p.retail_tier2.toFixed(2),
      p.retail_tier3.toFixed(2),
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'kwik_stop_wholesale_pricing.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-3 w-3 text-slate-400 group-hover:text-slate-600" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="h-3 w-3 text-slate-900 font-bold" />
    ) : (
      <ArrowDown className="h-3 w-3 text-slate-900 font-bold" />
    );
  };

  const renderRow = (p: CalculatedProduct) => {
    const traxSupplier = p.suppliers.find((s) => s.name === 'Trax');
    const campSupplier = p.suppliers.find((s) => s.name === 'Campbells');
    const oneSupplier = p.suppliers.find((s) => s.name === 'One Distribution');
    const packCount = getPackCount(p.master_pack_size, p.product_type, p.product_name);

    const getSupplierClass = (rank?: string) => {
      if (rank === 'lowest')
        return 'text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/50';
      if (rank === 'highest')
        return 'text-rose-700 font-bold bg-rose-50 px-2 py-0.5 rounded border border-rose-200/50';
      return 'text-blue-700 font-semibold bg-blue-50 px-2 py-0.5 rounded border border-blue-200/50';
    };

    return (
      <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
        {columns.brand && (
          <td className="py-3 px-4 whitespace-nowrap">
            <span
              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold tracking-wide uppercase ${currentTheme.classes.brandBadge}`}
            >
              <Tag className="h-2.5 w-2.5 opacity-80" />
              {p.brand}
            </span>
          </td>
        )}

        {columns.gtin && (
          <td className="py-3 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">{p.gtin}</td>
        )}

        {columns.product_name && (
          <td className="py-3 px-4 min-w-[220px]">
            <div className="font-semibold text-slate-900 text-xs">{p.product_name}</div>
            <div className="text-[10px] text-slate-500 flex flex-wrap items-center gap-1.5 mt-1">
              <span className="rounded bg-slate-100 px-1.5 py-0.2 font-medium text-slate-700">
                {p.product_type || p.category}
              </span>
              <span className="rounded bg-blue-50 border border-blue-200/60 px-1.5 py-0.2 font-semibold text-blue-700">
                Master: {p.master_pack_size || (p.product_type === 'Cigarettes' ? '10 Packs' : '5 Pouches')}
              </span>
              <span className="text-slate-400">•</span>
              <span>
                Best: <strong className="text-emerald-700">{p.cheapest_supplier}</strong>
              </span>
            </div>
          </td>
        )}

        {columns.retail_code && (
          <td className="py-3 px-4 font-mono text-xs font-medium text-slate-700 whitespace-nowrap">
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-700 border border-slate-200/60">
              {p.retail_code}
            </span>
          </td>
        )}

        {columns.trax && (
          <td className="py-3 px-4 text-right font-mono whitespace-nowrap">
            <span className={getSupplierClass(traxSupplier?.rank)}>
              {currencySymbol}
              {p.trax_price.toFixed(2)}
            </span>
            <div
              className="text-[10px] text-slate-500 font-mono mt-0.5"
              title={`${currencySymbol}${p.trax_price.toFixed(2)} ÷ ${packCount}`}
            >
              {currencySymbol}
              {(p.trax_price / packCount).toFixed(2)} <span className="text-[8.5px] text-slate-400">/ ea</span>
            </div>
          </td>
        )}

        {columns.campbells && (
          <td className="py-3 px-4 text-right font-mono whitespace-nowrap">
            <span className={getSupplierClass(campSupplier?.rank)}>
              {currencySymbol}
              {p.campbells_price.toFixed(2)}
            </span>
            <div
              className="text-[10px] text-slate-500 font-mono mt-0.5"
              title={`${currencySymbol}${p.campbells_price.toFixed(2)} ÷ ${packCount}`}
            >
              {currencySymbol}
              {(p.campbells_price / packCount).toFixed(2)}{' '}
              <span className="text-[8.5px] text-slate-400">/ ea</span>
            </div>
          </td>
        )}

        {columns.onedistribution && (
          <td className="py-3 px-4 text-right font-mono whitespace-nowrap">
            <span className={getSupplierClass(oneSupplier?.rank)}>
              {currencySymbol}
              {p.onedistribution_price.toFixed(2)}
            </span>
            <div
              className="text-[10px] text-slate-500 font-mono mt-0.5"
              title={`${currencySymbol}${p.onedistribution_price.toFixed(2)} ÷ ${packCount}`}
            >
              {currencySymbol}
              {(p.onedistribution_price / packCount).toFixed(2)}{' '}
              <span className="text-[8.5px] text-slate-400">/ ea</span>
            </div>
          </td>
        )}

        {columns.tier1 && (
          <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 bg-slate-50/70 whitespace-nowrap">
            <div>
              {currencySymbol}
              {p.retail_tier1.toFixed(2)}
            </div>
            {packCount > 1 && (
              <div className="text-[9.5px] font-mono text-slate-400 font-normal">
                {currencySymbol}
                {(p.retail_tier1 / packCount).toFixed(2)}/pk
              </div>
            )}
          </td>
        )}

        {columns.tier2 && (
          <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 bg-slate-50/70 whitespace-nowrap">
            <div>
              {currencySymbol}
              {p.retail_tier2.toFixed(2)}
            </div>
            {packCount > 1 && (
              <div className="text-[9.5px] font-mono text-slate-400 font-normal">
                {currencySymbol}
                {(p.retail_tier2 / packCount).toFixed(2)}/pk
              </div>
            )}
          </td>
        )}

        {columns.tier3 && (
          <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 bg-slate-50/70 whitespace-nowrap">
            <div>
              {currencySymbol}
              {p.retail_tier3.toFixed(2)}
            </div>
            {packCount > 1 && (
              <div className="text-[9.5px] font-mono text-slate-400 font-normal">
                {currencySymbol}
                {(p.retail_tier3 / packCount).toFixed(2)}/pk
              </div>
            )}
          </td>
        )}

        {columns.spread && (
          <td className="py-3 px-4 text-center whitespace-nowrap">
            <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 font-mono text-[11px] font-bold text-amber-900 border border-amber-200/70">
              {currencySymbol}
              {p.spread.toFixed(2)}
            </span>
          </td>
        )}
      </tr>
    );
  };

  return (
    <div className="rounded-xl border border-slate-200/80 bg-white shadow-xs overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 px-5 py-3 bg-slate-50/60">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Wholesale Price Comparison Table
          </span>
          <span className="rounded-md bg-slate-200/70 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
            {products.length} Products
          </span>
          <span className="rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
            {visibleColumnCount} of {Object.keys(COLUMN_LABELS).length} Columns Visible
          </span>
          {groupByBrand && (
            <span className="rounded-md bg-indigo-50 border border-indigo-200/70 px-2 py-0.5 text-[10px] font-bold text-indigo-700 uppercase tracking-wider">
              Grouped by Brand
            </span>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              id="table-show-hide-columns-btn"
              onClick={() => setIsColumnDropdownOpen((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold shadow-2xs transition cursor-pointer ${
                isColumnDropdownOpen
                  ? 'border-indigo-600 bg-indigo-600 text-white'
                  : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-100 hover:border-slate-400'
              }`}
              title="Show or hide table columns permanently"
            >
              <Columns className="h-3.5 w-3.5" />
              <span>Show / Hide Columns</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                  isColumnDropdownOpen ? 'bg-indigo-800 text-white' : 'bg-slate-100 text-slate-800'
                }`}
              >
                {visibleColumnCount}
              </span>
            </button>

            {isColumnDropdownOpen && (
              <div
                id="table-columns-dropdown-menu"
                className="absolute right-0 mt-2 w-72 rounded-xl border border-slate-200 bg-white shadow-2xl z-50 p-2.5 text-xs divide-y divide-slate-100"
              >
                <div className="pb-2 px-1 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Eye className="h-3.5 w-3.5 text-indigo-600" />
                    <span className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                      Column Visibility
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={resetColumns}
                    className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 hover:text-slate-900 cursor-pointer"
                    title="Reset to all columns visible"
                  >
                    <RotateCcw className="h-2.5 w-2.5" />
                    Reset All
                  </button>
                </div>

                <div className="py-2 max-h-72 overflow-y-auto space-y-1">
                  {(Object.keys(COLUMN_LABELS) as Array<keyof ColumnVisibility>).map((colKey) => {
                    const isVisible = columns[colKey];
                    return (
                      <label
                        key={colKey}
                        className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer select-none transition ${
                          isVisible ? 'bg-indigo-50/50 hover:bg-indigo-50' : 'bg-slate-50/60 hover:bg-slate-100'
                        }`}
                      >
                        <span
                          className={`text-xs ${
                            isVisible ? 'font-semibold text-slate-900' : 'text-slate-400 line-through'
                          }`}
                        >
                          {COLUMN_LABELS[colKey]}
                        </span>
                        <input
                          type="checkbox"
                          checked={isVisible}
                          onChange={() => toggleColumn(colKey)}
                          className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 accent-indigo-600 cursor-pointer"
                        />
                      </label>
                    );
                  })}
                </div>

                <div className="pt-2 px-1 text-[10.5px] text-slate-500 flex items-center justify-between">
                  <span className="font-medium text-emerald-700">✓ Saved permanently</span>
                  <span>
                    {visibleColumnCount} of {Object.keys(COLUMN_LABELS).length} shown
                  </span>
                </div>
              </div>
            )}
          </div>

          {canExport && (
            <button
              id="export-csv-btn"
              onClick={handleExportCSV}
              className="flex items-center space-x-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition shadow-2xs cursor-pointer"
            >
              <Download className="h-3.5 w-3.5 text-slate-500" />
              <span>Export CSV</span>
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-700" id="wholesale-price-table">
          <thead className="bg-slate-100/70 text-[11px] font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200/80">
            <tr>
              {columns.brand && (
                <th scope="col" className="py-3 px-4">
                  <button
                    onClick={() => handleSort('brand')}
                    className="group flex items-center space-x-1 hover:text-slate-900"
                  >
                    <span>Brand</span>
                    {renderSortIcon('brand')}
                  </button>
                </th>
              )}
              {columns.gtin && (
                <th scope="col" className="py-3 px-4">
                  <button
                    onClick={() => handleSort('gtin')}
                    className="group flex items-center space-x-1 hover:text-slate-900"
                  >
                    <span>GTIN Barcode</span>
                    {renderSortIcon('gtin')}
                  </button>
                </th>
              )}
              {columns.product_name && (
                <th scope="col" className="py-3 px-4 min-w-[200px]">
                  <button
                    onClick={() => handleSort('product_name')}
                    className="group flex items-center space-x-1 hover:text-slate-900"
                  >
                    <span>Product Name</span>
                    {renderSortIcon('product_name')}
                  </button>
                </th>
              )}
              {columns.retail_code && (
                <th scope="col" className="py-3 px-4">
                  <button
                    onClick={() => handleSort('retail_code')}
                    className="group flex items-center space-x-1 hover:text-slate-900"
                  >
                    <span>Retail SKU</span>
                    {renderSortIcon('retail_code')}
                  </button>
                </th>
              )}
              {columns.trax && (
                <th scope="col" className="py-3 px-4 text-right">
                  <button
                    onClick={() => handleSort('trax_price')}
                    className="group ml-auto flex items-center space-x-1 hover:text-slate-900"
                  >
                    <span>Trax ({currencySymbol})</span>
                    {renderSortIcon('trax_price')}
                  </button>
                </th>
              )}
              {columns.campbells && (
                <th scope="col" className="py-3 px-4 text-right">
                  <button
                    onClick={() => handleSort('campbells_price')}
                    className="group ml-auto flex items-center space-x-1 hover:text-slate-900"
                  >
                    <span>Campbells ({currencySymbol})</span>
                    {renderSortIcon('campbells_price')}
                  </button>
                </th>
              )}
              {columns.onedistribution && (
                <th scope="col" className="py-3 px-4 text-right">
                  <button
                    onClick={() => handleSort('onedistribution_price')}
                    className="group ml-auto flex items-center space-x-1 hover:text-slate-900"
                  >
                    <span>One Dist ({currencySymbol})</span>
                    {renderSortIcon('onedistribution_price')}
                  </button>
                </th>
              )}
              {columns.tier1 && (
                <th scope="col" className="py-3 px-4 text-right bg-slate-50/80">
                  <button
                    onClick={() => handleSort('retail_tier1')}
                    className="group ml-auto flex items-center space-x-1 text-slate-800 hover:text-slate-950 font-bold"
                  >
                    <span>Tier 1 (+{markupTiers.tier1}%)</span>
                    {renderSortIcon('retail_tier1')}
                  </button>
                </th>
              )}
              {columns.tier2 && (
                <th scope="col" className="py-3 px-4 text-right bg-slate-50/80">
                  <button
                    onClick={() => handleSort('retail_tier2')}
                    className="group ml-auto flex items-center space-x-1 text-slate-800 hover:text-slate-950 font-bold"
                  >
                    <span>Tier 2 (+{markupTiers.tier2}%)</span>
                    {renderSortIcon('retail_tier2')}
                  </button>
                </th>
              )}
              {columns.tier3 && (
                <th scope="col" className="py-3 px-4 text-right bg-slate-50/80">
                  <button
                    onClick={() => handleSort('retail_tier3')}
                    className="group ml-auto flex items-center space-x-1 text-slate-800 hover:text-slate-950 font-bold"
                  >
                    <span>Tier 3 (+{markupTiers.tier3}%)</span>
                    {renderSortIcon('retail_tier3')}
                  </button>
                </th>
              )}
              {columns.spread && (
                <th scope="col" className="py-3 px-4 text-center">
                  <button
                    onClick={() => handleSort('spread')}
                    className="group mx-auto flex items-center space-x-1 hover:text-slate-900"
                  >
                    <span>Spread</span>
                    {renderSortIcon('spread')}
                  </button>
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {groupedProducts ? (
              (Object.entries(groupedProducts) as [string, CalculatedProduct[]][]).map(
                ([brandName, brandItems]) => (
                  <React.Fragment key={`group-${brandName}`}>
                    <tr className="bg-slate-100/90 border-y border-slate-200">
                      <td colSpan={Math.max(1, visibleColumnCount)} className="py-2.5 px-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2.5">
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-extrabold tracking-wider uppercase ${currentTheme.classes.brandBadge}`}
                            >
                              <Tag className="h-3 w-3 opacity-80" />
                              {brandName}
                            </span>
                            <span className="text-xs text-slate-600 font-medium">
                              {brandItems.length} {brandItems.length === 1 ? 'Product' : 'Products'}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono">
                            Avg Spread: {currencySymbol}
                            {(brandItems.reduce((acc, c) => acc + c.spread, 0) / brandItems.length).toFixed(2)}
                          </div>
                        </div>
                      </td>
                    </tr>
                    {brandItems.map((p) => renderRow(p))}
                  </React.Fragment>
                )
              )
            ) : (
              sortedProducts.map((p) => renderRow(p))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between border-t border-slate-200/80 bg-slate-50 px-5 py-3 text-xs text-slate-500">
        <div className="flex items-center gap-4">
          <span>
            * Retail Tiers calculated from highest supplier cost. First word of title represents brand name.
          </span>
        </div>
        <div className="flex items-center gap-4 font-mono text-[11px]">
          <span className="flex items-center gap-1 text-emerald-700 font-medium">
            <span className="h-2 w-2 rounded-full bg-emerald-600" /> Lowest Quote
          </span>
          <span className="flex items-center gap-1 text-blue-700 font-medium">
            <span className="h-2 w-2 rounded-full bg-blue-600" /> Mid Quote
          </span>
          <span className="flex items-center gap-1 text-rose-700 font-medium">
            <span className="h-2 w-2 rounded-full bg-rose-600" /> Highest Quote
          </span>
        </div>
      </div>
    </div>
  );
};
