import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  FileSpreadsheet,
  Download,
  Calendar,
  BarChart2,
  PieChart as PieIcon,
  TrendingUp,
  Printer,
  Filter,
  DollarSign,
  Clock,
  Layers,
  CheckCircle,
  RefreshCw,
  Check,
  ChevronDown,
  Search,
  Users,
  Package,
  AlertTriangle,
  Truck,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Receipt,
  FileText,
  SlidersHorizontal,
  Tag,
  ArrowRight,
  Scale,
  Sliders,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { jsPDF } from 'jspdf';
import { POSReport, StoreLocation } from '../types';
import { useAppTheme } from '../ThemeContext';
import { ColumnVisibilityDropdown, ColumnDefinition } from './ColumnVisibilityDropdown';
import { ClerkShiftDeclarationModal } from './ClerkShiftDeclarationModal';
import { SalesBifurcationView } from './SalesBifurcationView';
import { ClerkPerformanceCards } from './ClerkPerformanceCards';
import {
  CashVarianceThresholds,
  DEFAULT_CASH_VARIANCE_CONFIG,
  evaluateCashVariance,
} from '../varianceUtils';
import { ClerkVariancePerformanceReport } from './ClerkVariancePerformanceReport';

interface FilterOption {
  code?: number | string;
  id?: number | string;
  name: string;
  codeStr?: string;
  discontinued?: boolean;
}

interface FilterMetadata {
  departments: FilterOption[];
  groups: FilterOption[];
  clerks: FilterOption[];
  terminals: FilterOption[];
  tenders: FilterOption[];
  suppliers: FilterOption[];
  wasteCategories: FilterOption[];
}

interface ReportCategoryItem {
  id: string;
  name: string;
  icon: React.ElementType;
  badgeCount: number;
  description: string;
}

interface ReportTileDef {
  type: string;
  title: string;
  category: string;
  description: string;
  icon: React.ElementType;
  badge?: string;
}

// Canonical alias map for deprecated / consolidated reports
export const REPORT_TYPE_ALIASES: Record<string, string> = {
  clerk_variance_performance: 'clerk_shift_cash_declaration',
  clerk_performance_overview: 'clerk_sales',
  clerk_transactions: 'clerk_sales',
  clerk_items_sold: 'clerk_sales',
  clerk_avg_ticket: 'clerk_sales',
  clerk_items_per_txn: 'clerk_sales',
  clerk_discounts: 'clerk_sales',
  clerk_voids_refunds: 'clerk_sales',
  gross_sales: 'financial_eod',
  net_sales: 'financial_eod',
  cash_eftpos_credit: 'tender_summary',
  refunds: 'void_refund_activity',
  voids: 'void_refund_activity',
  avg_transaction_value: 'financial_eod',
  transaction_count: 'financial_eod',
  sales_activity: 'daily_sales',
  weekly_monthly_sales: 'daily_sales',
};

const REPORT_CATEGORIES: ReportCategoryItem[] = [
  { id: 'SALES', name: 'Sales Reports', icon: DollarSign, badgeCount: 9, description: 'Daily, hourly, product, department, and terminal transaction summaries' },
  { id: 'FINANCIAL', name: 'Financial & Tax Bifurcation', icon: Receipt, badgeCount: 7, description: 'GST taxable vs GST-free bifurcation, Z-Reports, drawer reconciliation, tenders, and margins' },
  { id: 'CLERK', name: 'Clerk Performance', icon: Users, badgeCount: 4, description: 'Cashier leaderboard cards, operational POS throughput, shift cash declarations, and scan velocity' },
  { id: 'INVENTORY', name: 'Inventory & Stock', icon: Package, badgeCount: 10, description: 'Stock valuation, velocity, reorder requirements, low/out of stock, and barcode conflicts' },
  { id: 'EXPIRY', name: 'Expiry & Wastage', icon: AlertTriangle, badgeCount: 8, description: 'Active expiry batches, write-offs, product wastage loss, and resolution history' },
  { id: 'SUPPLIER', name: 'Supplier & Ordering', icon: Truck, badgeCount: 4, description: 'Supplier reorders, ordering recommendations, draft history, and demand velocity' },
];

const ALL_REPORT_TILES: ReportTileDef[] = [
  // SALES (Streamlined 9 essential reports)
  { type: 'daily_sales', title: 'Daily Sales Summary', category: 'SALES', description: 'Daily sales aggregate, transaction totals, and average basket sizes', icon: DollarSign, badge: 'Popular' },
  { type: 'hourly_sales', title: 'Hourly Sales & Velocity', category: 'SALES', description: 'Customer traffic and revenue velocity across 24-hour windows', icon: Clock },
  { type: 'product_sales', title: 'Product Sales & Margin', category: 'SALES', description: 'Breakdown by Stock Item with quantity, revenue, cost, and profit', icon: Package },
  { type: 'department_sales', title: 'Department Sales', category: 'SALES', description: 'Sales volume and revenue split by store department', icon: Layers },
  { type: 'category_sales', title: 'Category & Group Sales', category: 'SALES', description: 'Performance categorized by StockGroup categories', icon: Layers },
  { type: 'terminal_sales', title: 'Sales by Terminal / Register', category: 'SALES', description: 'POS register performance and lane throughput comparison', icon: Receipt },
  { type: 'day_of_week_sales', title: 'Sales by Day of Week', category: 'SALES', description: 'Monday to Sunday seasonal trend and peak shopping days', icon: Calendar },
  { type: 'top_selling_products', title: 'Top Selling Products', category: 'SALES', description: 'Best-performing products ranked by gross revenue', icon: TrendingUp },
  { type: 'slow_selling_products', title: 'Slow & Non-Moving Stock', category: 'SALES', description: 'Products with zero or lowest sales over the period', icon: AlertTriangle },

  // FINANCIAL & TAX (Consolidated into 7 purpose-driven reports with rich visual bifurcation)
  { type: 'tax_gst', title: 'GST & Tax Component (Sales Bifurcation)', category: 'FINANCIAL', description: 'Visual bifurcation of period sales: GST-Free (0%) vs Taxable (10% GST), ATO liability, and tender split', icon: FileText, badge: 'ATO / BAS' },
  { type: 'financial_eod', title: 'End-of-Day Reconciliation (Z-Report)', category: 'FINANCIAL', description: 'Daily settlement balance, register totals, drawer summary, and cash audit', icon: Receipt, badge: 'Core' },
  { type: 'tender_summary', title: 'Tender & Payment Breakdown', category: 'FINANCIAL', description: 'Summary of all settlement methods: EFTPOS, Cash, Credit, AMEX, and Vouchers', icon: DollarSign, badge: 'Settlement' },
  { type: 'cash_declaration', title: 'Cash Declaration (End of Shift)', category: 'FINANCIAL', description: 'Counted vs expected drawer cash, float verification, and over/short reconciliation', icon: DollarSign, badge: 'End of Shift' },
  { type: 'cogs_profit', title: 'COGS, Profitability & Gross Margin', category: 'FINANCIAL', description: 'Cost of goods sold, net gross profit yield, and margin % by department', icon: TrendingUp },
  { type: 'discounts', title: 'Discounts & Promotions Audit', category: 'FINANCIAL', description: 'Promotional markdowns, staff discounts, manual price overrides, and fraud check', icon: DollarSign },
  { type: 'void_refund_activity', title: 'Refunds, Voids & Adjustments Audit', category: 'FINANCIAL', description: 'Audit trail of item returns, voided receipts, line cancellations, and reversals', icon: AlertTriangle },

  // CLERK PERFORMANCE (Consolidated into 4 powerful operational views with staff cards & table)
  { type: 'clerk_sales', title: 'Sales by Clerk & Performance Cards', category: 'CLERK', description: 'Comprehensive cashier leaderboard: sales, units scanned, basket size, discounts, and staff cards', icon: Users, badge: 'Leaderboard' },
  { type: 'clerk_shift_cash_declaration', title: 'Clerk Shift Cash Declaration & Variance', category: 'CLERK', description: 'End-of-shift cashier cash counts, register float verification, and over/short variance with custom thresholds & emojis', icon: Receipt, badge: 'End of Shift' },
  { type: 'clerk_variance_performance', title: 'Clerk Shift Variance & Performance Report', category: 'CLERK', description: 'Staff cash drawer integrity, hours worked, total +/- variance, perfect scores, and department breakdown', icon: Scale, badge: 'Integrity Report' },
  { type: 'clerk_hourly_shifts', title: 'Clerk Shift & Hourly Activity', category: 'CLERK', description: 'Cashier lane coverage, hourly scan velocity, and staff throughput', icon: Clock, badge: 'Velocity' },

  // INVENTORY / PRODUCT
  { type: 'current_stock_valuation', title: 'Current Stock Valuation', category: 'INVENTORY', description: 'On-hand stock levels, unit costs, and total department valuation', icon: Package, badge: 'Audited' },
  { type: 'stock_movement', title: 'Stock Movement Log', category: 'INVENTORY', description: 'Inventory movements, sales, receiving, and stock adjustments', icon: Layers },
  { type: 'product_velocity', title: 'Product Sales Velocity', category: 'INVENTORY', description: 'Daily average consumption and turnover rates', icon: TrendingUp },
  { type: 'suggested_min_stock', title: 'Suggested Min Stock Buffer', category: 'INVENTORY', description: 'Calculated minimum safety buffers based on sales velocity', icon: ShieldCheck },
  { type: 'suggested_target_stock', title: 'Suggested Target Stock Levels', category: 'INVENTORY', description: 'Optimal stock replenishment targets by lead time', icon: Package },
  { type: 'suggested_reorder', title: 'Inventory Reorder Alerts', category: 'INVENTORY', description: 'Products at or below calculated reorder triggers', icon: AlertTriangle },
  { type: 'low_stock', title: 'Low Stock Alert Report', category: 'INVENTORY', description: 'Items with 5 or fewer units remaining on hand', icon: AlertTriangle },
  { type: 'out_of_stock', title: 'Out of Stock Depleted Items', category: 'INVENTORY', description: 'Zero and negative inventory items requiring replenishment', icon: AlertTriangle },
  { type: 'overstock_slow', title: 'Overstock & Excess Inventory', category: 'INVENTORY', description: 'High stock volume paired with low sales velocity', icon: Package },
  { type: 'barcode_conflicts', title: 'Barcode & Scan Code Conflicts', category: 'INVENTORY', description: 'Duplicate EANs, scan codes, or alternate code collisions', icon: ShieldCheck },

  // EXPIRY & WASTAGE
  { type: 'wastage_category_claim', title: 'Category Wastage & Supplier Claim', category: 'EXPIRY', description: 'Individual wastage category report with Barcode, Product, and Quantity for supplier claim returns', icon: FileSpreadsheet, badge: 'Supplier Claim' },
  { type: 'expiry_expiring_stock', title: 'Expiring Stock Batches', category: 'EXPIRY', description: 'Active batches approaching expiry date within warning buffer', icon: AlertTriangle, badge: 'Live Batches' },
  { type: 'expired_stock', title: 'Expired Stock Batches', category: 'EXPIRY', description: 'Past-due inventory batches requiring immediate write-off', icon: AlertTriangle },
  { type: 'wastage_summary', title: 'Wastage & Write-Off Summary', category: 'EXPIRY', description: 'Total inventory shrinkage and write-off loss valuation', icon: DollarSign },
  { type: 'wastage_by_product', title: 'Wastage Loss by Product', category: 'EXPIRY', description: 'Financial loss breakdown by specific stock item', icon: Package },
  { type: 'wastage_by_department', title: 'Wastage by Department', category: 'EXPIRY', description: 'Departmental shrinkage and spoilage breakdown', icon: Layers },
  { type: 'wastage_by_reason', title: 'Wastage by Reason Code', category: 'EXPIRY', description: 'Loss categorized by Expired, Damaged, Spoiled, or Theft', icon: FileText },
  { type: 'expiry_to_wastage_history', title: 'Expiry to Wastage Resolution History', category: 'EXPIRY', description: 'Audit lifecycle tracking expiry batches from notification to write-off', icon: FileSpreadsheet },

  // SUPPLIER & ORDERING
  { type: 'suggested_reorder_supplier', title: 'Suggested Reorder by Supplier', category: 'SUPPLIER', description: 'Order requirements grouped by primary vendor/creditor', icon: Truck, badge: 'Ordering' },
  { type: 'supplier_recommendation', title: 'Supplier Ordering Recommendations', category: 'SUPPLIER', description: 'Safety multipliers, cutoff times, and pack size calculations', icon: Package },
  { type: 'order_history_drafts', title: 'Draft & Purchase Order History', category: 'SUPPLIER', description: 'History of generated draft orders, line items, and status', icon: FileSpreadsheet },
  { type: 'supplier_demand_velocity', title: 'Supplier Product Demand Velocity', category: 'SUPPLIER', description: 'Sales volume generated across vendor product portfolios', icon: TrendingUp },
];

export const ReportsManager: React.FC = () => {
  const { getThemeClasses } = useAppTheme();
  const theme = getThemeClasses();

  // Navigation State
  const [activeCategory, setActiveCategory] = useState<string>('SALES');
  const [reportType, setReportType] = useState<string>('daily_sales');
  const [tileSearchQuery, setTileSearchQuery] = useState<string>('');

  // Period State
  const [period, setPeriod] = useState<
    'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'current_fy' | 'last_fy' | 'custom'
  >('this_week');
  const [startDate, setStartDate] = useState<string>('2026-07-01');
  const [endDate, setEndDate] = useState<string>('2026-07-21');

  // Multi-Filter State
  const [filtersMetadata, setFiltersMetadata] = useState<FilterMetadata>({
    departments: [],
    groups: [],
    clerks: [],
    terminals: [],
    tenders: [],
    suppliers: [],
    wasteCategories: [],
  });
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [selectedClerk, setSelectedClerk] = useState<string>('');
  const [selectedTerminal, setSelectedTerminal] = useState<string>('');
  const [selectedTender, setSelectedTender] = useState<string>('');
  const [selectedSupplier, setSelectedSupplier] = useState<string>('');
  const [selectedWasteCategory, setSelectedWasteCategory] = useState<string>('');
  const [claimViewMode, setClaimViewMode] = useState<'itemized' | 'grouped'>('itemized');
  const [isPrinting, setIsPrinting] = useState<boolean>(false);

  // Dropdown visibility
  const [isDeptDropdownOpen, setIsDeptDropdownOpen] = useState<boolean>(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState<boolean>(false);

  // Listen for browser print lifecycle to un-paginate table during print
  useEffect(() => {
    const handleBeforePrint = () => setIsPrinting(true);
    const handleAfterPrint = () => setIsPrinting(false);
    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);
    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, []);

  // Report Data
  const [reportData, setReportData] = useState<POSReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [chartTypeOverride, setChartTypeOverride] = useState<'bar' | 'line' | 'pie' | null>(null);
  const [clerkViewMode, setClerkViewMode] = useState<'cards' | 'table'>('table');
  const [declViewMode, setDeclViewMode] = useState<'cards' | 'table' | 'clerk_performance'>('table');
  const [cashVarianceConfig, setCashVarianceConfig] = useState<CashVarianceThresholds>(DEFAULT_CASH_VARIANCE_CONFIG);
  const [bifurcationViewMode, setBifurcationViewMode] = useState<'bifurcation' | 'both' | 'table'>('both');
  const [selectedDeclarationId, setSelectedDeclarationId] = useState<number | null>(null);

  // Fetch active store cash variance thresholds
  const fetchStoreVarianceConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/stores');
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.stores)) {
        const active = data.stores.find((s: StoreLocation) => s.id === data.activeStoreId) || data.stores[0];
        if (active?.cashVarianceThresholds) {
          setCashVarianceConfig(active.cashVarianceThresholds);
        }
      }
    } catch (err) {
      console.warn('Failed to load store variance config for reports:', err);
    }
  }, []);

  useEffect(() => {
    fetchStoreVarianceConfig();
    const handleStoreChanged = () => fetchStoreVarianceConfig();
    window.addEventListener('store-changed', handleStoreChanged);
    return () => {
      window.removeEventListener('store-changed', handleStoreChanged);
    };
  }, [fetchStoreVarianceConfig]);

  // Table Column Search / Filter State (Per-column filter strings)
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  
  // Table Sorting State
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Pagination State
  const [pageSize, setPageSize] = useState<number | 'all'>(20);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [showDeletedClerks, setShowDeletedClerks] = useState<boolean>(false);

  // List of columns to keep hidden by default in clerk variance / cash declaration reports
  // Can be enabled at any time from Column Configuration
  const isColumnVisibleByDefault = useCallback((rptType: string, colId: string): boolean => {
    const hiddenByDefaultInVariance = [
      'Declaration ID',
      'Shift Date / Time',
      'Shift Start (Float)',
      'Register',
      'Opening Float',
      'Variance Status',
    ];
    if (
      rptType === 'clerk_shift_cash_declaration' ||
      rptType === 'cash_declaration' ||
      rptType === 'clerk_variance_performance'
    ) {
      if (hiddenByDefaultInVariance.includes(colId)) {
        return false;
      }
    }
    return true;
  }, []);

  // Column Visibility for Reports Table (Versioned storage key to apply clean new defaults)
  const getInitialColumnVisibility = (rptType: string): Record<string, boolean> => {
    try {
      const saved = localStorage.getItem(`col_vis_rpt_v3_${rptType}`);
      if (saved) return JSON.parse(saved);
    } catch {}
    return {};
  };

  const [columnVisibilityMap, setColumnVisibilityMap] = useState<Record<string, boolean>>(() =>
    getInitialColumnVisibility(reportType)
  );

  useEffect(() => {
    setColumnVisibilityMap(getInitialColumnVisibility(reportType));
    // Clear filters, sorting, and reset page on report switch so old filters don't hide data
    setColumnFilters({});
    setSortColumn(null);
    setCurrentPage(1);
    if (
      reportType === 'clerk_variance_performance' ||
      reportType === 'clerk_shift_cash_declaration' ||
      reportType === 'cash_declaration'
    ) {
      setDeclViewMode('table');
    }
    if (reportType === 'clerk_sales') {
      setClerkViewMode('table');
    }
  }, [reportType]);

  const reportColumns: ColumnDefinition[] = useMemo(() => {
    const rawHeaders =
      reportType === 'wastage_category_claim' && claimViewMode === 'grouped'
        ? ['Barcode', 'Product Name', 'Quantity', 'Est. Unit Cost', 'Total Claim Value', 'Stock Code', 'Wastage Category', 'Department', 'Dates Logged']
        : reportData?.tableHeaders || [];
    return rawHeaders.map((header) => {
      const isExplicit = columnVisibilityMap[header] !== undefined;
      const isVisible = isExplicit ? columnVisibilityMap[header] : isColumnVisibleByDefault(reportType, header);
      return {
        id: header,
        label: header,
        visible: isVisible,
      };
    });
  }, [reportData?.tableHeaders, columnVisibilityMap, reportType, claimViewMode, isColumnVisibleByDefault]);

  const handleColumnVisibilityChange = (newCols: ColumnDefinition[]) => {
    const newMap: Record<string, boolean> = {};
    newCols.forEach((c) => {
      newMap[c.id] = c.visible;
    });
    setColumnVisibilityMap(newMap);
    try {
      localStorage.setItem(`col_vis_rpt_v3_${reportType}`, JSON.stringify(newMap));
    } catch {}
  };

  const handleResetColumnVisibility = () => {
    setColumnVisibilityMap({});
    try {
      localStorage.removeItem(`col_vis_rpt_v3_${reportType}`);
    } catch {}
  };

  const visibleHeaders = useMemo(() => {
    if (reportType === 'wastage_category_claim' && claimViewMode === 'grouped') {
      const groupedHeaders = ['Barcode', 'Product Name', 'Quantity', 'Est. Unit Cost', 'Total Claim Value', 'Stock Code', 'Wastage Category', 'Department', 'Dates Logged'];
      return groupedHeaders.filter((h) => {
        if (columnVisibilityMap[h] !== undefined) return columnVisibilityMap[h];
        return isColumnVisibleByDefault(reportType, h);
      });
    }
    if (!reportData?.tableHeaders) return [];
    return reportData.tableHeaders.filter((h) => {
      if (columnVisibilityMap[h] !== undefined) return columnVisibilityMap[h];
      return isColumnVisibleByDefault(reportType, h);
    });
  }, [reportData?.tableHeaders, columnVisibilityMap, reportType, claimViewMode, isColumnVisibleByDefault]);

  // Fetch filter metadata on mount
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const res = await fetch('/api/pos/reports/filters-data');
        if (res.ok) {
          const json = await res.json();
          setFiltersMetadata({
            departments: json.departments || [],
            groups: json.groups || [],
            clerks: json.clerks || [],
            terminals: json.terminals || [],
            tenders: json.tenders || [],
            suppliers: json.suppliers || [],
            wasteCategories: json.wasteCategories || [],
          });
        }
      } catch (err) {
        console.warn('Notice: Failed to load reports filter metadata', err);
      }
    };
    fetchMetadata();
  }, []);

  // Fetch main report data
  const fetchReport = async () => {
    setLoading(true);
    try {
      const deptsQuery = selectedDepts.join(',');
      const effectiveType = REPORT_TYPE_ALIASES[reportType] || reportType;
      const params = new URLSearchParams({
        type: effectiveType,
        period,
        startDate,
        endDate,
        departments: deptsQuery,
        group: selectedGroup,
        clerk: selectedClerk,
        terminal: selectedTerminal,
        tender: selectedTender,
        supplier: selectedSupplier,
        wasteCategory: selectedWasteCategory,
        includeDeleted: showDeletedClerks ? 'true' : 'false',
        includeDeletedClerks: showDeletedClerks ? 'true' : 'false',
      });
      const res = await fetch(`/api/pos/reports?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load report');
      const json = await res.json();
      setReportData(json);
      // Reset table pagination and column filters on report change
      setCurrentPage(1);
    } catch (err) {
      console.warn('Notice: Report fetch issue:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [reportType, period, startDate, endDate, selectedDepts, selectedGroup, selectedClerk, selectedTerminal, selectedTender, selectedSupplier, selectedWasteCategory, showDeletedClerks]);

  // Filter report tiles by search and active category
  const filteredTiles = useMemo(() => {
    return ALL_REPORT_TILES.filter((tile) => {
      const matchesSearch =
        tileSearchQuery.trim() === '' ||
        tile.title.toLowerCase().includes(tileSearchQuery.toLowerCase()) ||
        tile.description.toLowerCase().includes(tileSearchQuery.toLowerCase()) ||
        tile.type.toLowerCase().includes(tileSearchQuery.toLowerCase());

      if (tileSearchQuery.trim() !== '') {
        return matchesSearch;
      }
      return tile.category === activeCategory;
    });
  }, [activeCategory, tileSearchQuery]);

  // Helper to match column wildcard queries (*Dare, *Dare *500ml, etc.)
  const matchesWildcardFilter = (cellValueStr: string, queryStr: string): boolean => {
    if (!queryStr || queryStr.trim() === '') return true;
    const target = (cellValueStr || '').toLowerCase();
    const tokens = queryStr.trim().toLowerCase().split(/\s+/).filter(Boolean);

    // Every token must match according to wildcard rules
    return tokens.every((token) => {
      if (token.startsWith('*')) {
        const sub = token.slice(1);
        if (!sub) return true;
        return target.includes(sub);
      } else {
        // Normal prefix or direct inclusion
        return target.includes(token) || target.startsWith(token);
      }
    });
  };

  // Filter & Sort Table Rows
  const processedTableRows = useMemo(() => {
    if (!reportData) return [];
    let rows: Array<Record<string, string | number>> = [];

    if (reportType === 'wastage_category_claim' && claimViewMode === 'grouped' && reportData.claimGrouped) {
      rows = reportData.claimGrouped.map((g) => ({
        Barcode: g.barcode,
        'Product Name': g.productName,
        Quantity: g.quantity,
        'Est. Unit Cost': g.unitCost,
        'Total Claim Value': g.totalClaim,
        'Stock Code': g.stockCode,
        'Wastage Category': g.category,
        Department: g.department,
        'Dates Logged': g.dates,
      }));
    } else if (reportData.tableRows) {
      rows = [...reportData.tableRows];
    }

    // 1. Column-specific filters
    Object.entries(columnFilters).forEach(([colHeader, filterVal]) => {
      const filterStr = String(filterVal || '').trim();
      if (filterStr !== '') {
        const hasCol = rows.some((r) => r[colHeader] !== undefined);
        if (hasCol) {
          rows = rows.filter((r) => matchesWildcardFilter(String(r[colHeader] || ''), filterStr));
        }
      }
    });

    // 2. Hide or position discontinued clerks at bottom
    if (!showDeletedClerks && !selectedClerk) {
      rows = rows.filter((r) => !r._discontinued);
    } else if (showDeletedClerks && !sortColumn) {
      rows.sort((a, b) => (a._discontinued ? 1 : 0) - (b._discontinued ? 1 : 0));
    }

    // 3. Sorting
    if (sortColumn) {
      rows.sort((a, b) => {
        const valA = a[sortColumn];
        const valB = b[sortColumn];

        // Numeric comparison if values are currency or pure numbers
        const numA = typeof valA === 'number' ? valA : parseFloat(String(valA).replace(/[^0-9.-]+/g, ''));
        const numB = typeof valB === 'number' ? valB : parseFloat(String(valB).replace(/[^0-9.-]+/g, ''));

        if (!isNaN(numA) && !isNaN(numB)) {
          return sortDirection === 'asc' ? numA - numB : numB - numA;
        }

        // String comparison
        const strA = String(valA || '').toLowerCase();
        const strB = String(valB || '').toLowerCase();
        if (strA < strB) return sortDirection === 'asc' ? -1 : 1;
        if (strA > strB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return rows;
  }, [reportData, columnFilters, sortColumn, sortDirection, showDeletedClerks, selectedClerk, reportType, claimViewMode]);

  // Paginated Rows (When printing, show all rows for full paper document)
  const paginatedRows = useMemo(() => {
    if (isPrinting || pageSize === 'all') return processedTableRows;
    const startIndex = (currentPage - 1) * pageSize;
    return processedTableRows.slice(startIndex, startIndex + pageSize);
  }, [processedTableRows, currentPage, pageSize, isPrinting]);

  const totalPages = pageSize === 'all' ? 1 : Math.ceil(processedTableRows.length / (pageSize as number)) || 1;

  // Toggle sort direction on column click
  const handleSort = (colHeader: string) => {
    if (sortColumn === colHeader) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        setSortColumn(null);
        setSortDirection('asc');
      }
    } else {
      setSortColumn(colHeader);
      setSortDirection('asc');
    }
  };

  const handleColumnFilterChange = (colHeader: string, value: string) => {
    setColumnFilters((prev) => ({
      ...prev,
      [colHeader]: value,
    }));
    setCurrentPage(1);
  };

  const clearAllColumnFilters = () => {
    setColumnFilters({});
    setCurrentPage(1);
  };

  const hasActiveColumnFilters = Object.values(columnFilters).some((v) => String(v || '').trim() !== '');

  // Toggle Department selection
  const toggleDepartment = (deptName: string) => {
    if (selectedDepts.includes(deptName)) {
      setSelectedDepts(selectedDepts.filter((d) => d !== deptName));
    } else {
      setSelectedDepts([...selectedDepts, deptName]);
    }
  };

  const toggleAllDepartments = () => {
    if (selectedDepts.length === filtersMetadata.departments.length) {
      setSelectedDepts([]);
    } else {
      setSelectedDepts(filtersMetadata.departments.map((d) => d.name));
    }
  };

  // Export PDF with Executive Summary, Paginated Table, and Vector Graphic in Landscape Orientation
  const exportPDF = () => {
    if (!reportData) return;

    // A4 Landscape: 297mm width x 210mm height
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Banner Header
    doc.setFillColor(30, 41, 59); // Slate-800
    doc.rect(0, 0, pageWidth, 24, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(reportData.title.toUpperCase(), 14, 13);

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.text(`IDEALPOS ANALYTICS  |  ID: ${reportData.id}  |  LANDSCAPE GRID`, pageWidth - 14, 13, { align: 'right' });

    // Sub-header metadata
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(8);
    doc.text(`Period: ${reportData.periodText}`, 14, 30);
    doc.text(`Generated: ${reportData.generatedAt} (AEST)`, pageWidth - 14, 30, { align: 'right' });

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.4);
    doc.line(14, 33, pageWidth - 14, 33);

    // KPI Summary Cards
    let yPos = 38;
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('EXECUTIVE KPI SUMMARY', 14, yPos);
    yPos += 4.5;

    const kpisToRender = reportData.kpis.slice(0, 5);
    const kpiBoxWidth = (pageWidth - 28 - (kpisToRender.length - 1) * 3.5) / kpisToRender.length;
    kpisToRender.forEach((kpi, idx) => {
      const boxX = 14 + idx * (kpiBoxWidth + 3.5);
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(boxX, yPos, kpiBoxWidth, 16, 2, 2, 'FD');

      doc.setTextColor(100, 116, 139);
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'bold');
      doc.text(kpi.label.toUpperCase(), boxX + 3, yPos + 4.5);

      doc.setTextColor(30, 41, 59);
      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'bold');
      doc.text(String(kpi.value), boxX + 3, yPos + 10.5);

      if (kpi.subtext) {
        doc.setTextColor(37, 99, 235);
        doc.setFontSize(6);
        doc.text(kpi.subtext, boxX + 3, yPos + 14);
      }
    });

    yPos += 21;

    // Detailed Breakdown Table Header
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('DETAILED BREAKDOWN TABLE (LANDSCAPE GRID)', 14, yPos);
    yPos += 4.5;

    // Use active visible columns or full table headers
    const activeHeaders = reportColumns.filter((c) => c.visible).map((c) => c.id);
    const headers = activeHeaders.length > 0 ? activeHeaders : reportData.tableHeaders;
    const colWidth = (pageWidth - 28) / Math.max(headers.length, 1);

    // Function to render table headers
    const renderTableHeaders = (atY: number) => {
      doc.setFillColor(37, 99, 235); // Blue-600
      doc.rect(14, atY, pageWidth - 28, 7, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      const maxCharCount = Math.max(12, Math.floor(colWidth / 1.6));
      headers.forEach((h, colIdx) => {
        const truncH = h.length > maxCharCount ? h.slice(0, maxCharCount - 1) + '..' : h;
        doc.text(truncH.toUpperCase(), 14 + colIdx * colWidth + 2, atY + 4.8);
      });
    };

    renderTableHeaders(yPos);
    yPos += 7;

    // Table Rows
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);

    const rowsToExport = processedTableRows.slice(0, 250);
    rowsToExport.forEach((row, rowIdx) => {
      if (yPos > pageHeight - 18) {
        doc.addPage('a4', 'landscape');
        yPos = 14;
        renderTableHeaders(yPos);
        yPos += 7;
        doc.setFont('helvetica', 'normal');
      }

      if (rowIdx % 2 === 0) {
        doc.setFillColor(248, 250, 252);
        doc.rect(14, yPos, pageWidth - 28, 6, 'F');
      }

      doc.setDrawColor(241, 245, 249);
      doc.line(14, yPos + 6, pageWidth - 14, yPos + 6);

      doc.setTextColor(30, 41, 59);
      const maxCharCount = Math.max(14, Math.floor(colWidth / 1.5));
      headers.forEach((h, colIdx) => {
        let cellValue = String(row[h] !== undefined ? row[h] : '');
        if (cellValue.length > maxCharCount) {
          cellValue = cellValue.slice(0, maxCharCount - 1) + '..';
        }
        doc.text(cellValue, 14 + colIdx * colWidth + 2, yPos + 4.2);
      });

      yPos += 6;
    });

    // --- CHART VISUALIZATION ON DEDICATED LANDSCAPE PAGE ---
    if (reportData.chartData && reportData.chartData.length > 0) {
      doc.addPage('a4', 'landscape');

      doc.setFillColor(30, 41, 59);
      doc.rect(0, 0, pageWidth, 20, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('GRAPHICAL DATA VISUALIZATION', 14, 13);

      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(`${reportData.title} Analytics Graph`, pageWidth - 14, 13, { align: 'right' });

      const chartX = 14;
      const chartY = 26;
      const chartW = pageWidth - 28;
      const chartH = 125;

      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(chartX, chartY, chartW, chartH, 3, 3, 'FD');

      doc.setTextColor(15, 23, 42);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(`${reportData.category} Performance Overview`, chartX + 8, chartY + 10);

      const dataItems = reportData.chartData.slice(0, 16);
      const maxVal = Math.max(...dataItems.map((d) => d.value), 1);

      const plotX = chartX + 24;
      const plotY = chartY + 20;
      const plotW = chartW - 36;
      const plotH = chartH - 36;

      // Draw Grid & Y-Axis
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      for (let i = 0; i <= 4; i++) {
        const gridY = plotY + (plotH / 4) * i;
        doc.line(plotX, gridY, plotX + plotW, gridY);

        const labelVal = Math.round(maxVal - (maxVal / 4) * i);
        doc.setTextColor(148, 163, 184);
        doc.setFontSize(6.5);
        doc.text(labelVal >= 1000 ? `${(labelVal / 1000).toFixed(1)}k` : `${labelVal}`, plotX - 3, gridY + 1, { align: 'right' });
      }

      // Draw Bars
      const barCount = dataItems.length;
      const barGap = 6;
      const barW = Math.min((plotW - (barCount + 1) * barGap) / barCount, 22);

      dataItems.forEach((d, i) => {
        const barX = plotX + barGap + i * (barW + barGap);
        const barH = (d.value / maxVal) * plotH;
        const barY = plotY + plotH - barH;

        doc.setFillColor(37, 99, 235);
        doc.roundedRect(barX, barY, barW, barH, 1, 1, 'F');

        doc.setTextColor(30, 41, 59);
        doc.setFontSize(6);
        doc.setFont('helvetica', 'bold');
        doc.text(`${d.value}`, barX + barW / 2, barY - 1.5, { align: 'center' });

        doc.setTextColor(100, 116, 139);
        doc.setFontSize(6);
        doc.setFont('helvetica', 'normal');
        const truncLabel = d.label.length > 10 ? d.label.substring(0, 9) + '..' : d.label;
        doc.text(truncLabel, barX + barW / 2, plotY + plotH + 4.5, { align: 'center' });
      });

      // Sign-off note
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(chartX, chartY + chartH + 6, chartW, 16, 2, 2, 'FD');

      doc.setTextColor(100, 116, 139);
      doc.setFontSize(7);
      doc.text('Official POS Suite Analytics. All metrics generated from verified Point-of-Sale store transactions.', chartX + 5, chartY + chartH + 11);
      doc.text(`File: ${reportData.id}_${reportType}_landscape_${period}.pdf | Orientation: Landscape`, chartX + 5, chartY + chartH + 16);
    }

    doc.save(`${reportData.id}_${reportType}_landscape_${period}.pdf`);
  };

  // Export CSV (Landscape / Wide Detailed Table Grid Format)
  const exportCSV = () => {
    if (!reportData) return;

    // Determine active visible columns or full table headers
    const activeHeaders = reportColumns.filter((c) => c.visible).map((c) => c.id);
    const headersToUse = activeHeaders.length > 0 ? activeHeaders : reportData.tableHeaders;

    // Header metadata block designating Landscape page style & execution context
    const metaBlock = [
      `# ========================================================`,
      `# IDEALPOS ANALYTICS - ${reportData.title.toUpperCase()}`,
      `# Layout Style : Landscape Detailed Table Grid`,
      `# Report ID    : ${reportData.id}`,
      `# Category     : ${reportData.category}`,
      `# Period       : ${reportData.periodText}`,
      `# Generated At : ${reportData.generatedAt}`,
      `# Total Records: ${processedTableRows.length}`,
      `# Columns      : ${headersToUse.join(' | ')}`,
      `# ========================================================`,
      ``,
    ];

    const headersRow = headersToUse.map((h) => `"${h.replace(/"/g, '""')}"`).join(',');
    const dataRows = processedTableRows.map((r) =>
      headersToUse.map((h) => `"${String(r[h] !== undefined ? r[h] : '').replace(/"/g, '""')}"`).join(',')
    );

    const fullContent = [...metaBlock, headersRow, ...dataRows].join('\r\n');

    // Prepend UTF-8 BOM so Excel on Windows/Mac opens properly without character mangling
    const blob = new Blob(['\uFEFF' + fullContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${reportData.id}_${reportType}_landscape_${period}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Print Report in Landscape Page Style
  const handlePrint = () => {
    // Inject dynamic @page landscape rule to ensure browser print dialog defaults to landscape
    const existingStyle = document.getElementById('dynamic-print-landscape');
    if (existingStyle) existingStyle.remove();

    const printStyle = document.createElement('style');
    printStyle.id = 'dynamic-print-landscape';
    printStyle.innerHTML = `
      @page {
        size: landscape !important;
        margin: 8mm !important;
      }
      @media print {
        body, html, #root {
          width: 100% !important;
          max-width: none !important;
          overflow: visible !important;
          background: #ffffff !important;
        }
      }
    `;
    document.head.appendChild(printStyle);
    window.print();
    setTimeout(() => {
      const el = document.getElementById('dynamic-print-landscape');
      if (el) el.remove();
    }, 1500);
  };

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 print:hidden">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-blue-600" />
            POS Business & Executive Reports
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Comprehensive business analytics, financial reconciliation, clerk performance, stock valuation, and supplier demand
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5"
            title="Print this report view in landscape orientation"
          >
            <Printer className="w-3.5 h-3.5 text-slate-600" />
            Print (Landscape)
          </button>
          <button
            onClick={exportPDF}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5"
            title="Export full executive report in landscape orientation"
          >
            <Download className="w-3.5 h-3.5" />
            Export PDF (Landscape)
          </button>
          <button
            onClick={exportCSV}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5"
            title="Export wide detailed table grid to CSV"
          >
            <FileText className="w-3.5 h-3.5" />
            Export CSV (Landscape)
          </button>
        </div>
      </div>

      {/* 1. Category Switcher Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100/90 rounded-xl border border-slate-200 print:hidden">
        {REPORT_CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const isActive = activeCategory === cat.id && tileSearchQuery.trim() === '';
          return (
            <button
              key={cat.id}
              onClick={() => {
                setActiveCategory(cat.id);
                setTileSearchQuery('');
                // Automatically switch to first report in category if current report is not in category
                const firstTile = ALL_REPORT_TILES.find((t) => t.category === cat.id);
                if (firstTile) {
                  setReportType(firstTile.type);
                  setChartTypeOverride(null);
                }
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                isActive
                  ? 'bg-white text-blue-700 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-blue-600' : 'text-slate-500'}`} />
              <span>{cat.name}</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-semibold ${
                isActive ? 'bg-blue-100 text-blue-800' : 'bg-slate-200 text-slate-600'
              }`}>
                {cat.badgeCount}
              </span>
            </button>
          );
        })}
      </div>

      {/* 2. Compact 4-in-a-row Interactive Report Tiles Grid & Quick Search */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs space-y-2.5 print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              {tileSearchQuery.trim() !== '' ? `Search Results (${filteredTiles.length})` : `${REPORT_CATEGORIES.find(c => c.id === activeCategory)?.name}`}
            </h2>
            <span className="text-[11px] text-slate-400">
              — Click tile to run
            </span>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
            <input
              type="text"
              placeholder="Search reports by keyword..."
              value={tileSearchQuery}
              onChange={(e) => setTileSearchQuery(e.target.value)}
              className="w-full pl-8 pr-7 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
            {tileSearchQuery && (
              <button
                onClick={() => setTileSearchQuery('')}
                className="absolute right-2 top-1.5 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Compact Tile Grid: 4 in a row on standard/desktop viewports */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 pt-0.5">
          {filteredTiles.map((tile) => {
            const Icon = tile.icon;
            const isSelected = reportType === tile.type;
            return (
              <button
                key={tile.type}
                onClick={() => {
                  setReportType(tile.type);
                  setChartTypeOverride(null);
                }}
                className={`text-left p-2.5 rounded-lg border transition-all relative flex flex-col justify-between ${
                  isSelected
                    ? 'bg-blue-50/80 border-blue-500 ring-1 ring-blue-500 shadow-2xs'
                    : 'bg-slate-50/50 hover:bg-slate-100/80 border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-start justify-between gap-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className={`p-1 rounded-md shrink-0 ${isSelected ? 'bg-blue-600 text-white' : 'bg-slate-200/80 text-slate-700'}`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <span className={`text-xs font-bold truncate ${isSelected ? 'text-blue-900' : 'text-slate-800'}`}>
                      {tile.title}
                    </span>
                  </div>
                  {tile.badge && (
                    <span className="px-1 py-0.2 rounded text-[8.5px] font-bold bg-amber-100 text-amber-800 border border-amber-200 shrink-0">
                      {tile.badge}
                    </span>
                  )}
                </div>

                <p className="text-[10.5px] text-slate-500 mt-1.5 line-clamp-2 leading-tight">
                  {tile.description}
                </p>

                {isSelected && (
                  <div className="mt-1.5 flex items-center gap-1 text-[9.5px] font-bold text-blue-700">
                    <CheckCircle className="w-2.5 h-2.5" />
                    <span>Active</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Filtering Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-4 print:hidden">
        {/* Period Selector Pills & Department Dropdown */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 text-xs font-medium text-slate-600">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-bold text-slate-800 flex items-center gap-1 mr-1">
              <Calendar className="w-4 h-4 text-slate-500" />
              Period:
            </span>

            {[
              { id: 'today', label: 'Today' },
              { id: 'yesterday', label: 'Yesterday' },
              { id: 'this_week', label: 'This Week' },
              { id: 'last_week', label: 'Last Week' },
              { id: 'this_month', label: 'This Month' },
              { id: 'last_month', label: 'Last Month' },
              { id: 'current_fy', label: 'Current FY' },
              { id: 'last_fy', label: 'Last FY' },
              { id: 'custom', label: 'Custom Range' },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  period === p.id
                    ? 'bg-slate-900 text-white font-bold shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="flex items-center flex-wrap gap-2">
            {/* Waste Category Quick Selector (Prominent for EXPIRY or Wastage Reports) */}
            {(activeCategory === 'EXPIRY' || reportType.includes('wastage') || reportType.includes('expiry')) && (
              <div className="relative">
                <select
                  value={selectedWasteCategory}
                  onChange={(e) => setSelectedWasteCategory(e.target.value)}
                  className={`px-3 py-1.5 border rounded-lg text-xs font-semibold focus:ring-2 focus:ring-blue-500 cursor-pointer ${
                    selectedWasteCategory
                      ? 'bg-amber-50 border-amber-400 text-amber-900 font-bold'
                      : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
                  }`}
                  title="Filter report by individual Waste / Write-Off Category"
                >
                  <option value="">All Waste Categories</option>
                  {(filtersMetadata.wasteCategories || []).map((wc) => (
                    <option key={`flt-bar-wc-${wc.code || wc.name}`} value={wc.name}>
                      {wc.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Department Multi-Select Dropdown Filter */}
            <div className="relative">
              <button
                onClick={() => setIsDeptDropdownOpen(!isDeptDropdownOpen)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg text-slate-800 font-semibold flex items-center gap-2 transition-colors text-xs"
              >
                <Filter className="w-3.5 h-3.5 text-blue-600" />
                <span>
                  {selectedDepts.length === 0
                    ? 'All Departments'
                    : `${selectedDepts.length} Dept${selectedDepts.length > 1 ? 's' : ''}`}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
              </button>

              {isDeptDropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-xl shadow-xl z-30 p-3 space-y-2">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <span className="font-bold text-slate-800 text-xs">Filter Departments</span>
                    <button
                      onClick={toggleAllDepartments}
                      className="text-[11px] text-blue-600 hover:underline font-semibold"
                    >
                      {selectedDepts.length === filtersMetadata.departments.length ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>

                  <div className="max-h-48 overflow-y-auto space-y-1.5 pt-1">
                    {filtersMetadata.departments.map((dept, index) => {
                      const isChecked = selectedDepts.includes(dept.name);
                      return (
                        <label
                          key={`rpt-dept-${dept.code || dept.name}-${index}`}
                          onClick={() => toggleDepartment(dept.name)}
                          className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 rounded cursor-pointer text-xs text-slate-700"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="truncate">{dept.name}</span>
                        </label>
                      );
                    })}
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex justify-end">
                    <button
                      onClick={() => setIsDeptDropdownOpen(false)}
                      className="px-3 py-1 bg-blue-600 text-white rounded text-[11px] font-semibold hover:bg-blue-700"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Advanced Filters Toggle */}
            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`px-3 py-1.5 border rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                showAdvancedFilters || selectedGroup || selectedClerk || selectedTerminal || selectedTender || selectedSupplier || selectedWasteCategory
                  ? 'bg-blue-50 border-blue-300 text-blue-700'
                  : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600" />
              <span>More Filters</span>
            </button>
          </div>
        </div>

        {/* Custom Date Range Inputs */}
        {period === 'custom' && (
          <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-100 bg-slate-50/80 p-3 rounded-lg text-xs">
            <span className="font-bold text-slate-700">Custom Date Interval:</span>
            <div className="flex items-center gap-1.5">
              <label className="text-slate-500 font-medium">From:</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-2.5 py-1.5 border border-slate-300 rounded-md bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-slate-500 font-medium">To:</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-2.5 py-1.5 border border-slate-300 rounded-md bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={fetchReport}
              className="px-3 py-1.5 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 transition-colors"
            >
              Run Report
            </button>
          </div>
        )}

        {/* Advanced Filters Expandable Panel */}
        {showAdvancedFilters && (
          <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 text-xs bg-slate-50/60 p-3 rounded-lg">
            <div>
              <label className="block text-slate-500 font-bold mb-1">Waste Category:</label>
              <select
                value={selectedWasteCategory}
                onChange={(e) => setSelectedWasteCategory(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md text-slate-800 focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Waste Categories</option>
                {filtersMetadata.wasteCategories?.map((wc) => (
                  <option key={`adv-flt-wc-${wc.code || wc.name}`} value={wc.name}>
                    {wc.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-500 font-bold mb-1">Category / Group:</label>
              <select
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md text-slate-800 focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Categories</option>
                {filtersMetadata.groups.map((g) => (
                  <option key={`flt-grp-${g.code || g.id}`} value={g.name}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-slate-500 font-bold">Clerk / Cashier:</label>
                <button
                  type="button"
                  onClick={() => setShowDeletedClerks(!showDeletedClerks)}
                  className="text-[10px] text-blue-600 hover:text-blue-800 font-semibold hover:underline flex items-center gap-1"
                >
                  {showDeletedClerks ? "Hide Deleted" : `Show Deleted (${filtersMetadata.clerks.filter((c) => c.discontinued).length || 16})`}
                </button>
              </div>
              <select
                value={selectedClerk}
                onChange={(e) => setSelectedClerk(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md text-slate-800 focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Active Clerks ({filtersMetadata.clerks.filter((c) => !c.discontinued).length})</option>
                {filtersMetadata.clerks.filter((c) => !c.discontinued).length > 0 && (
                  <optgroup label="Active Clerks">
                    {filtersMetadata.clerks
                      .filter((c) => !c.discontinued)
                      .map((c) => (
                        <option key={`flt-clk-act-${c.id}`} value={String(c.id)}>
                          {c.name}
                        </option>
                      ))}
                  </optgroup>
                )}
                {showDeletedClerks && filtersMetadata.clerks.filter((c) => c.discontinued).length > 0 && (
                  <optgroup label="Deleted / Inactive Clerks (Historical)">
                    {filtersMetadata.clerks
                      .filter((c) => c.discontinued)
                      .map((c) => (
                        <option key={`flt-clk-disc-${c.id}`} value={String(c.id)}>
                          {c.name} (Deleted)
                        </option>
                      ))}
                  </optgroup>
                )}
              </select>
              {showDeletedClerks && (
                <p className="text-[10px] text-amber-700 mt-1 font-medium">
                  Showing inactive/deleted clerks for historical reconciliation.
                </p>
              )}
            </div>

            <div>
              <label className="block text-slate-500 font-bold mb-1">POS Terminal:</label>
              <select
                value={selectedTerminal}
                onChange={(e) => setSelectedTerminal(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md text-slate-800 focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Terminals</option>
                {filtersMetadata.terminals.map((t) => (
                  <option key={`flt-trm-${t.id}`} value={String(t.id)}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-500 font-bold mb-1">Tender / Payment:</label>
              <select
                value={selectedTender}
                onChange={(e) => setSelectedTender(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md text-slate-800 focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Tenders</option>
                {filtersMetadata.tenders.map((t) => (
                  <option key={`flt-tnd-${t.id}`} value={String(t.id)}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-500 font-bold mb-1">Supplier:</label>
              <select
                value={selectedSupplier}
                onChange={(e) => setSelectedSupplier(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md text-slate-800 focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Suppliers</option>
                {filtersMetadata.suppliers.map((s) => (
                  <option key={`flt-sup-${s.id}`} value={String(s.id)}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* 4. Main Report Output View */}
      {loading || !reportData ? (
        <div className="p-16 text-center text-slate-500 bg-white border border-slate-200 rounded-xl shadow-sm">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-blue-600" />
          <span className="text-base font-bold text-slate-800 block">Querying POS reporting database...</span>
          <span className="text-xs text-slate-400 mt-1 block">Calculating aggregates across transactions</span>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Printable Report & Supplier Claim Header (Visible only when printing) */}
          <div className="hidden print:block pb-4 mb-4 border-b-2 border-slate-900">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-xl font-black uppercase tracking-tight text-slate-900">
                  {reportType === 'wastage_category_claim'
                    ? 'SUPPLIER WASTAGE CREDIT CLAIM REPORT'
                    : reportData.title.toUpperCase()}
                </h1>
                <p className="text-sm font-bold text-slate-800 mt-1">
                  {reportType === 'wastage_category_claim'
                    ? `Claim Category: ${reportData.selectedWasteCategoryName || selectedWasteCategory || 'All Wastage Categories'}`
                    : `Category: ${reportData.category}`}
                </p>
                <p className="text-xs text-slate-600 mt-0.5">
                  Period / Date Range: {reportData.periodText} • Generated: {reportData.generatedAt}
                </p>
              </div>
              <div className="text-right text-xs text-slate-600">
                <p className="font-bold text-slate-900">IDEALPOS AUDIT SYSTEM</p>
                <p>Report Code: {reportData.id}</p>
                <p>Printed: {new Date().toLocaleString()}</p>
              </div>
            </div>
            {reportType === 'wastage_category_claim' && (
              <div className="mt-3 p-2.5 bg-slate-100 rounded text-xs text-slate-700 font-medium border border-slate-300">
                <strong>Supplier Credit Submission Notice:</strong> The listed items have been written off under category <em>"{reportData.selectedWasteCategoryName || selectedWasteCategory || 'All Categories'}"</em>. This document serves as an itemized credit claim schedule verifying <strong>Barcode</strong>, <strong>Product Description</strong>, and <strong>Quantity</strong> for supplier claim credit processing.
              </div>
            )}
          </div>

          {/* Dedicated Category Selector & Supplier Claim Action Banner */}
          {reportType === 'wastage_category_claim' && (
            <div className="bg-gradient-to-r from-amber-50 via-sky-50 to-indigo-50 border-2 border-amber-300/80 rounded-xl p-4 shadow-sm space-y-3 print:hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <span>Supplier Credit Claim & Category Wastage</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200/80 text-amber-900 border border-amber-300">
                        Supplier Claim Ready
                      </span>
                    </h2>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Select an individual wastage category below to isolate inventory for supplier credit. Every row includes <strong>Barcode</strong>, <strong>Product</strong>, and <strong>Quantity</strong>.
                    </p>
                  </div>
                </div>

                {/* Claim View Mode & Print Claim Form */}
                <div className="flex items-center gap-2 shrink-0">
                  <div className="bg-white p-1 rounded-lg border border-slate-200 flex items-center text-xs font-semibold shadow-2xs">
                    <button
                      onClick={() => setClaimViewMode('itemized')}
                      className={`px-2.5 py-1 rounded transition-colors ${
                        claimViewMode === 'itemized'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Itemized Write-Offs
                    </button>
                    <button
                      onClick={() => setClaimViewMode('grouped')}
                      className={`px-2.5 py-1 rounded transition-colors ${
                        claimViewMode === 'grouped'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Consolidated by SKU
                    </button>
                  </div>

                  <button
                    onClick={handlePrint}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                    title="Print official supplier credit claim form"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Print Claim Form</span>
                  </button>
                </div>
              </div>

              {/* Individual Waste Category Pills */}
              <div className="pt-2 border-t border-amber-200/60 flex flex-wrap items-center gap-1.5 text-xs">
                <span className="font-bold text-slate-700 mr-1 flex items-center gap-1">
                  <Tag className="w-3.5 h-3.5 text-amber-600" />
                  Wastage Category:
                </span>
                <button
                  onClick={() => setSelectedWasteCategory('')}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                    !selectedWasteCategory
                      ? 'bg-slate-900 text-white shadow-xs font-bold'
                      : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  All Categories
                </button>
                {(filtersMetadata.wasteCategories || []).map((cat) => {
                  const isSelected = selectedWasteCategory === cat.name;
                  return (
                    <button
                      key={`claim-cat-btn-${cat.code || cat.name}`}
                      onClick={() => setSelectedWasteCategory(cat.name)}
                      className={`px-3 py-1 rounded-full text-xs transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-amber-600 text-white shadow-xs font-bold ring-2 ring-amber-300'
                          : 'bg-white text-slate-700 border border-slate-300 hover:bg-amber-50 hover:border-amber-300 font-medium'
                      }`}
                    >
                      {cat.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Executive KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {reportData.kpis.map((kpi, idx) => (
              <div key={idx} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:border-slate-300 transition-colors">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                  {kpi.label}
                </span>
                <span className="text-2xl font-extrabold text-slate-900 mt-1.5 block tracking-tight">
                  {kpi.value}
                </span>
                {kpi.subtext && (
                  <span className="text-xs text-blue-600 font-semibold mt-1 block">{kpi.subtext}</span>
                )}
              </div>
            ))}
          </div>

          {/* Embedded Recharts Graphical Visualization */}
          {reportData.chartData && reportData.chartData.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <BarChart2 className="w-4 h-4 text-blue-600" />
                    {reportData.title} — Graphical Visualizer
                  </h3>
                  <span className="text-[11px] text-slate-400 font-mono">
                    Report Code: {reportData.id} • Active Period: {period.replace('_', ' ').toUpperCase()}
                  </span>
                </div>

                {/* Chart Type Selector & Quick Export Tools */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
                    <button
                      onClick={() => setChartTypeOverride('bar')}
                      className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1 transition-colors ${
                        (chartTypeOverride || reportData.chartType || 'bar') === 'bar'
                          ? 'bg-white text-blue-700 font-bold shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="Switch to Column / Bar Chart"
                    >
                      <BarChart2 className="w-3.5 h-3.5" />
                      <span>Bar</span>
                    </button>
                    <button
                      onClick={() => setChartTypeOverride('line')}
                      className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1 transition-colors ${
                        (chartTypeOverride || reportData.chartType) === 'line'
                          ? 'bg-white text-blue-700 font-bold shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="Switch to Trend Line Chart"
                    >
                      <TrendingUp className="w-3.5 h-3.5" />
                      <span>Line</span>
                    </button>
                    <button
                      onClick={() => setChartTypeOverride('pie')}
                      className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1 transition-colors ${
                        (chartTypeOverride || reportData.chartType) === 'pie'
                          ? 'bg-white text-blue-700 font-bold shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="Switch to Share / Pie Chart"
                    >
                      <PieIcon className="w-3.5 h-3.5" />
                      <span>Pie</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="h-64 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  {(chartTypeOverride || reportData.chartType) === 'pie' ? (
                    <PieChart>
                      <Pie
                        data={reportData.chartData}
                        dataKey="value"
                        nameKey="label"
                        cx="50%"
                        cy="50%"
                        outerRadius={85}
                        label={({ label, percent }) => `${label}: ${(percent * 100).toFixed(0)}%`}
                      >
                        {reportData.chartData.map((_, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={theme.chartColors[index % theme.chartColors.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip formatter={(val: any) => [`${Number(val).toLocaleString()}`, 'Amount']} />
                    </PieChart>
                  ) : (chartTypeOverride || reportData.chartType) === 'line' ? (
                    <LineChart data={reportData.chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} />
                      <Tooltip formatter={(val: any) => [`${val}`, 'Amount']} />
                      <Line type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={3} dot={{ r: 4 }} />
                    </LineChart>
                  ) : (
                    <BarChart data={reportData.chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} />
                      <Tooltip formatter={(val: any) => [`${val}`, 'Value']} />
                      <Bar dataKey="value" fill="#2563eb" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Sales Bifurcation Component (For Tax GST & Financial Reports) */}
          {reportData.bifurcation && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white border border-slate-200 rounded-xl p-3 shadow-2xs gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-700">Financial Layout:</span>
                  <div className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200 text-xs">
                    <button
                      onClick={() => setBifurcationViewMode('bifurcation')}
                      className={`px-3 py-1 rounded-md font-semibold transition-all ${
                        bifurcationViewMode === 'bifurcation'
                          ? 'bg-white text-blue-700 shadow-2xs font-bold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Bifurcation View
                    </button>
                    <button
                      onClick={() => setBifurcationViewMode('both')}
                      className={`px-3 py-1 rounded-md font-semibold transition-all ${
                        bifurcationViewMode === 'both'
                          ? 'bg-white text-blue-700 shadow-2xs font-bold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Bifurcation + Table
                    </button>
                    <button
                      onClick={() => setBifurcationViewMode('table')}
                      className={`px-3 py-1 rounded-md font-semibold transition-all ${
                        bifurcationViewMode === 'table'
                          ? 'bg-white text-blue-700 shadow-2xs font-bold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Table Only
                    </button>
                  </div>
                </div>
                <span className="text-xs text-slate-500 font-medium">
                  Taxable Products (10% GST) vs GST-Free Staples (0% GST)
                </span>
              </div>

              {(bifurcationViewMode === 'bifurcation' || bifurcationViewMode === 'both') && (
                <SalesBifurcationView
                  bifurcation={reportData.bifurcation}
                  periodText={reportData.periodText}
                />
              )}
            </div>
          )}

          {/* Clerk Performance Cards Component (For Clerk Sales Reports) */}
          {reportType === 'clerk_sales' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white border border-slate-200 rounded-xl p-3 shadow-2xs gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-700">Display Layout:</span>
                  <div className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200 text-xs">
                    <button
                      onClick={() => setClerkViewMode('cards')}
                      className={`px-3 py-1 rounded-md font-semibold transition-all ${
                        clerkViewMode === 'cards'
                          ? 'bg-white text-blue-700 shadow-2xs font-bold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Staff Leaderboard Cards
                    </button>
                    <button
                      onClick={() => setClerkViewMode('table')}
                      className={`px-3 py-1 rounded-md font-semibold transition-all ${
                        clerkViewMode === 'table'
                          ? 'bg-white text-blue-700 shadow-2xs font-bold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Detailed Table Grid
                    </button>
                  </div>
                </div>
                <span className="text-xs text-slate-500 font-medium">
                  Factual throughput, sales share, scan volume & cashier audit
                </span>
              </div>

              {clerkViewMode === 'cards' && (
                <ClerkPerformanceCards
                  clerks={reportData.tableRows as any}
                  totalRevenue={
                    reportData.clerkData?.totalRevenue ??
                    reportData.tableRows.reduce(
                      (acc, r) => {
                        const parsed = Number(String(r['Total Sales'] || '').replace(/[^0-9.-]+/g, ''));
                        return acc + (isNaN(parsed) ? 0 : parsed);
                      },
                      0
                    )
                  }
                  totalTransactions={
                    reportData.clerkData?.totalTransactions ??
                    reportData.tableRows.reduce(
                      (acc, r) => {
                        const parsed = Number(r['Transactions Served']);
                        return acc + (isNaN(parsed) ? 0 : parsed);
                      },
                      0
                    )
                  }
                  onSelectClerk={(cid) => {
                    setSelectedClerk(cid);
                  }}
                />
              )}
            </div>
          )}

          {/* Cash Declaration / Clerk Shift Declaration Cards & Performance Report */}
          {(reportType === 'clerk_shift_cash_declaration' || reportType === 'cash_declaration' || reportType === 'clerk_variance_performance') && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white border border-slate-200 rounded-xl p-3 shadow-2xs gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-700">Display Layout:</span>
                  <div className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200 text-xs">
                    <button
                      onClick={() => setDeclViewMode('table')}
                      className={`px-3 py-1.5 rounded-md font-semibold transition-all flex items-center gap-1.5 ${
                        declViewMode === 'table'
                          ? 'bg-white text-blue-700 shadow-2xs font-bold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>Detailed Table Grid (Default)</span>
                    </button>
                    <button
                      onClick={() => setDeclViewMode('clerk_performance')}
                      className={`px-3 py-1.5 rounded-md font-semibold transition-all flex items-center gap-1.5 ${
                        declViewMode === 'clerk_performance'
                          ? 'bg-white text-blue-700 shadow-2xs font-bold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>Clerk Performance & Integrity</span>
                    </button>
                    <button
                      onClick={() => setDeclViewMode('cards')}
                      className={`px-3 py-1.5 rounded-md font-semibold transition-all flex items-center gap-1.5 ${
                        declViewMode === 'cards'
                          ? 'bg-white text-blue-700 shadow-2xs font-bold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Shift Audit Cards</span>
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 font-medium">
                    {reportData.tableRows.length} declarations • Custom thresholds: {cashVarianceConfig.enabled ? 'Active' : 'Default'}
                  </span>
                </div>
              </div>

              {/* View 1: Clerk Performance & Variance Integrity Report */}
              {declViewMode === 'clerk_performance' && (
                <ClerkVariancePerformanceReport
                  shiftRows={processedTableRows}
                  rows={processedTableRows}
                  config={cashVarianceConfig}
                  thresholdConfig={cashVarianceConfig}
                  periodText={reportData.periodText}
                  onSelectShift={(declId) => setSelectedDeclarationId(declId)}
                  onOpenStoreSettings={() => {
                    window.dispatchEvent(new CustomEvent('switch-tab', { detail: { tab: 'settings' } }));
                  }}
                />
              )}

              {/* View 2: Shift Audit Cards */}
              {declViewMode === 'cards' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {processedTableRows.map((row, idx) => {
                    const declId = row._declarationId || (row['Declaration ID'] ? Number(String(row['Declaration ID']).replace('#', '').trim()) : null);
                    const clerkName = String(row['Clerk / Cashier'] || 'Unknown Cashier');
                    const register = String(row['Register'] || 'POS #1');
                    const shiftDate = String(row['Shift Date / Time'] || '');
                    const duration = String(row['Shift Duration'] || '');
                    const floatAmt = String(row['Opening Float'] || '$0.00');
                    const expectedCash = String(row['Expected Cash'] || '$0.00');
                    const countedCash = String(row['Counted / Declared'] || '$0.00');
                    const variance = String(row['Cash Variance'] || '$0.00');
                    const varianceStatus = String(row['Variance Status'] || 'BALANCED');
                    const eftposTotal = String(row['EFTPOS Total'] || '$0.00');
                    const totalGross = String(row['Total Shift Gross'] || '$0.00');
                    const isBalanced = varianceStatus === 'BALANCED' || variance === '$0.00';
                    const isOver = variance.startsWith('+') || varianceStatus.includes('OVER');
                    const isDateMismatch = Boolean(row._dateMismatch);

                    const rawVarianceVal = typeof row._rawVariance === 'number'
                      ? row._rawVariance
                      : parseFloat(variance.replace('$', '').replace('+', '').replace(/,/g, '')) || 0;
                    const evaluated = evaluateCashVariance(rawVarianceVal, cashVarianceConfig);

                    return (
                      <div
                        key={`decl-card-${idx}`}
                        onClick={() => {
                          if (declId) setSelectedDeclarationId(declId);
                        }}
                        className="bg-white border border-slate-200 hover:border-blue-400 hover:shadow-md transition-all rounded-xl p-4.5 cursor-pointer flex flex-col justify-between group relative overflow-hidden"
                      >
                        <div>
                          {/* Card Header */}
                          <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3 mb-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-sm shrink-0 border border-blue-100">
                                {clerkName.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <h4 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                                  {clerkName}
                                </h4>
                                <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                                  <span className="font-semibold text-slate-700">{register}</span>
                                  {declId && <span className="font-mono text-[11px] text-slate-400">#{declId}</span>}
                                </div>
                              </div>
                            </div>

                            {/* Status Badge */}
                            {cashVarianceConfig.enabled ? (
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border shrink-0 ${evaluated.badgeBg} ${evaluated.badgeText} ${evaluated.badgeBorder}`}
                              >
                                {evaluated.showEmoji && <span>{evaluated.emoji}</span>}
                                <span>{evaluated.label}</span>
                              </span>
                            ) : (
                              <span
                                className={`px-2 py-0.5 rounded-full text-[11px] font-bold border shrink-0 ${
                                  isBalanced
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : isOver
                                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                                    : 'bg-rose-50 text-rose-700 border-rose-200'
                                }`}
                              >
                                {varianceStatus}
                              </span>
                            )}
                          </div>

                          {/* Date and Duration */}
                          <div className="flex items-center justify-between text-xs text-slate-600 mb-3 bg-slate-50/70 p-2 rounded-lg">
                            <div className="flex items-center gap-1.5 truncate">
                              <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="truncate">{shiftDate}</span>
                            </div>
                            {duration && (
                              <span className="font-mono font-medium text-slate-500 shrink-0 ml-2">
                                {duration}
                              </span>
                            )}
                          </div>

                          {isDateMismatch && (
                            <div className="flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-md mb-3">
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                              <span>Float from {String(row._floatDateStr)}, declared {String(row._declDateStr)}</span>
                            </div>
                          )}

                          {/* Financial Reconciliation Breakdown */}
                          <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                            <div className="bg-slate-50 p-2 rounded-lg">
                              <span className="text-[10px] text-slate-400 font-medium block uppercase">Expected Drawer</span>
                              <span className="font-mono font-bold text-slate-800 text-sm block mt-0.5">{expectedCash}</span>
                              <span className="text-[10px] text-slate-500">Float: {floatAmt}</span>
                            </div>
                            <div className={`p-2 rounded-lg border ${
                              cashVarianceConfig.enabled
                                ? `${evaluated.badgeBg} ${evaluated.badgeBorder}`
                                : (isBalanced ? 'bg-emerald-50/60 border-emerald-200' : isOver ? 'bg-amber-50/60 border-amber-200' : 'bg-rose-50/60 border-rose-200')
                            }`}>
                              <span className="text-[10px] text-slate-400 font-medium block uppercase">Counted Cash</span>
                              <span className={`font-mono font-bold text-sm block mt-0.5 ${
                                cashVarianceConfig.enabled
                                  ? evaluated.badgeText
                                  : (isBalanced ? 'text-emerald-700' : isOver ? 'text-amber-700' : 'text-rose-700')
                              }`}>
                                {countedCash}
                              </span>
                              <span className="text-[10px] font-semibold flex items-center gap-1 mt-0.5">
                                <span>Diff: {variance}</span>
                                {evaluated.showEmoji && <span>{evaluated.emoji}</span>}
                              </span>
                            </div>
                          </div>

                          {/* Summary Row */}
                          <div className="flex items-center justify-between text-xs py-1.5 border-t border-slate-100 text-slate-600">
                            <span>EFTPOS: <strong className="font-mono text-slate-800">{eftposTotal}</strong></span>
                            <span>Shift Gross: <strong className="font-mono text-slate-900">{totalGross}</strong></span>
                          </div>
                        </div>

                        {/* Action CTA */}
                        <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                          <span className="text-xs font-bold text-blue-600 group-hover:text-blue-700 flex items-center gap-1">
                            <FileText className="w-3.5 h-3.5" />
                            View Full Shift Audit
                          </span>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-1 group-hover:text-blue-600 transition-transform" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 5. Enhanced Tabular Data Grid with Per-Column Search, Sorting & Pagination */}
          {((reportType !== 'clerk_sales' || clerkViewMode === 'table') && 
            ((reportType !== 'clerk_shift_cash_declaration' && reportType !== 'cash_declaration' && reportType !== 'clerk_variance_performance') || declViewMode === 'table') && 
            (!reportData.bifurcation || bifurcationViewMode !== 'bifurcation')) ? (
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            {/* Table Action Header */}
            <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden">
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-bold text-slate-800">
                  Detailed Breakdown Table
                </h3>
                <span className="text-xs font-semibold text-slate-500 bg-slate-200/80 px-2 py-0.5 rounded-full">
                  {processedTableRows.length} Total Records
                </span>
                {hasActiveColumnFilters && (
                  <button
                    onClick={clearAllColumnFilters}
                    className="text-xs text-blue-600 hover:text-blue-800 font-semibold underline flex items-center gap-1"
                  >
                    <X className="w-3 h-3" />
                    Reset column filters
                  </button>
                )}
              </div>

              {/* Rows per page selector and Quick Table Actions */}
              <div className="flex items-center gap-3 text-xs font-medium text-slate-600">
                <div className="flex items-center gap-1.5">
                  <span>Rows:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      const val = e.target.value === 'all' ? 'all' : Number(e.target.value);
                      setPageSize(val);
                      setCurrentPage(1);
                    }}
                    className="px-2 py-1 bg-white border border-slate-300 rounded font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 text-xs"
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value="all">All</option>
                  </select>
                </div>

                <div className="h-4 w-px bg-slate-300 mx-0.5" />

                <div className="flex items-center gap-1.5">
                  <ColumnVisibilityDropdown
                    columns={reportColumns}
                    onChange={handleColumnVisibilityChange}
                    onReset={handleResetColumnVisibility}
                    storageKey={`col_vis_rpt_v3_${reportType}`}
                  />
                  <button
                    onClick={handlePrint}
                    className="p-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded text-slate-700 hover:text-slate-900 transition-colors shadow-2xs flex items-center gap-1 text-[11px] font-semibold"
                    title="Print Table View in Landscape Orientation"
                  >
                    <Printer className="w-3.5 h-3.5 text-slate-600" />
                    <span className="hidden sm:inline">Print (Landscape)</span>
                  </button>
                  <button
                    onClick={exportCSV}
                    className="p-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded text-slate-700 hover:text-slate-900 transition-colors shadow-2xs flex items-center gap-1 text-[11px] font-semibold"
                    title="Export Wide Table Data to CSV"
                  >
                    <FileText className="w-3.5 h-3.5 text-slate-600" />
                    <span className="hidden sm:inline">CSV (Landscape)</span>
                  </button>
                  <button
                    onClick={exportPDF}
                    className="p-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded text-blue-700 hover:text-blue-900 transition-colors shadow-2xs flex items-center gap-1 text-[11px] font-semibold"
                    title="Export Full PDF Report in Landscape Orientation"
                  >
                    <Download className="w-3.5 h-3.5 text-blue-600" />
                    <span className="hidden sm:inline">PDF (Landscape)</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Main Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                  {/* Column Header Names & Sorting */}
                  <tr>
                    {visibleHeaders.map((header) => {
                      const isSorted = sortColumn === header;
                      return (
                        <th
                          key={`th-${header}`}
                          onClick={() => handleSort(header)}
                          className="py-2.5 px-3 uppercase tracking-wider cursor-pointer hover:bg-slate-200/70 transition-colors select-none text-[11px]"
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-bold break-words whitespace-normal leading-tight">{header}</span>
                            <div className="text-slate-400 shrink-0">
                              {isSorted ? (
                                sortDirection === 'asc' ? (
                                  <ArrowUp className="w-3.5 h-3.5 text-blue-600" />
                                ) : (
                                  <ArrowDown className="w-3.5 h-3.5 text-blue-600" />
                                )
                              ) : (
                                <ArrowUpDown className="w-3 h-3 opacity-40 hover:opacity-100" />
                              )}
                            </div>
                          </div>
                        </th>
                      );
                    })}
                  </tr>

                  {/* Per-Column Wildcard Search / Filter Row */}
                  <tr className="bg-slate-50/90 border-t border-slate-200 print:hidden">
                    {visibleHeaders.map((header) => {
                      const filterVal = columnFilters[header] || '';
                      return (
                        <th key={`filter-col-${header}`} className="p-1.5 font-normal">
                          <div className="relative">
                            <input
                              type="text"
                              placeholder={`Filter (${header.split(' ')[0]})...`}
                              value={filterVal}
                              onChange={(e) => handleColumnFilterChange(header, e.target.value)}
                              className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-[11px] text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 font-normal min-w-[65px]"
                            />
                            {filterVal && (
                              <button
                                onClick={() => handleColumnFilterChange(header, '')}
                                className="absolute right-1.5 top-1.5 text-slate-400 hover:text-slate-600"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {paginatedRows.length === 0 ? (
                    <tr>
                      <td colSpan={visibleHeaders.length || 1} className="text-center py-10 text-slate-400 font-medium">
                        No matching records found matching the filter criteria.
                      </td>
                    </tr>
                  ) : (
                    paginatedRows.map((row, idx) => {
                      const declarationId = row._declarationId || (row['Declaration ID'] ? Number(String(row['Declaration ID']).replace('#', '').trim()) : null);
                      const isClickableDeclaration = Boolean(declarationId && (reportType === 'cash_declaration' || reportType === 'clerk_shift_cash_declaration' || row._declarationId));

                      return (
                        <tr 
                          key={`row-${idx}`}
                          onClick={() => {
                            if (isClickableDeclaration && declarationId) {
                              setSelectedDeclarationId(declarationId);
                            }
                          }}
                          className={`transition-colors ${
                            isClickableDeclaration 
                              ? 'cursor-pointer hover:bg-blue-50/70 group' 
                              : 'hover:bg-blue-50/40'
                          }`}
                          title={isClickableDeclaration ? 'Click to view full shift reconciliation, sales breakdown, charts & download PDF' : undefined}
                        >
                          {visibleHeaders.map((header) => {
                            const cellVal = row[header];

                            // Declaration ID Custom Link / Badge
                            if (header === 'Declaration ID' && cellVal) {
                              return (
                                <td key={`cell-${header}-${idx}`} className="py-2 px-3 whitespace-nowrap">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (declarationId) setSelectedDeclarationId(declarationId);
                                    }}
                                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md font-mono font-bold text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition-colors shadow-2xs group-hover:border-blue-400"
                                    title="View full shift summary & download PDF"
                                  >
                                    <FileText className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                    <span>{String(cellVal)}</span>
                                  </button>
                                </td>
                              );
                            }

                            // Shift Date / Time Custom Rendering with Date Mismatch Flag
                            if (header === 'Shift Date / Time' && cellVal) {
                              return (
                                <td key={`cell-${header}-${idx}`} className="py-2 px-3 text-xs">
                                  <div className="flex flex-col items-start gap-0.5 max-w-[130px]">
                                    <span className="font-mono text-[11px] font-semibold text-slate-800 break-words whitespace-normal leading-tight">
                                      {String(cellVal)}
                                    </span>
                                    {row._dateMismatch && (
                                      <span
                                        className="inline-flex items-center gap-1 text-[9.5px] font-bold px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 border border-amber-300 shadow-2xs whitespace-nowrap"
                                        title={`Date Mismatch: Float recorded on ${row._floatDateStr || 'prior day'}, declaration made on ${row._declDateStr || 'shift end day'}`}
                                      >
                                        <AlertTriangle className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                                        <span>Date Mismatch</span>
                                      </span>
                                    )}
                                  </div>
                                </td>
                              );
                            }

                            // Shift Start (Float) Custom Rendering
                            if (header === 'Shift Start (Float)' && cellVal) {
                              return (
                                <td key={`cell-${header}-${idx}`} className="py-2 px-3 text-xs">
                                  <span className="font-mono text-[11px] font-semibold text-slate-700 break-words whitespace-normal leading-tight block max-w-[130px]">
                                    {String(cellVal)}
                                  </span>
                                </td>
                              );
                            }

                            // Shift End (Declaration) Custom Rendering
                            if (header === 'Shift End (Declaration)' && cellVal) {
                              return (
                                <td key={`cell-${header}-${idx}`} className="py-2 px-3 text-xs">
                                  <span className="font-mono text-[11px] font-semibold text-slate-700 break-words whitespace-normal leading-tight block max-w-[125px]">
                                    {String(cellVal)}
                                  </span>
                                </td>
                              );
                            }

                            // Clerk / Cashier Custom Rendering
                            if (header === 'Clerk / Cashier' && cellVal) {
                              return (
                                <td key={`cell-${header}-${idx}`} className="py-2 px-3 text-xs">
                                  <div className="font-semibold text-slate-900 break-words whitespace-normal leading-tight max-w-[140px]">
                                    {String(cellVal)}
                                    {row._discontinued && (
                                      <span className="ml-1 text-[9px] px-1 py-0.2 bg-slate-100 text-slate-500 rounded border border-slate-200 inline-block font-normal">
                                        Inactive
                                      </span>
                                    )}
                                  </div>
                                </td>
                              );
                            }

                            // Shift Duration Custom Rendering
                            if (header === 'Shift Duration' && cellVal) {
                              return (
                                <td key={`cell-${header}-${idx}`} className="py-2 px-3 whitespace-nowrap">
                                  <div className="flex items-center gap-1 font-mono text-xs font-semibold text-slate-700">
                                    <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                    <span>{String(cellVal)}</span>
                                    {row._dateMismatch && (
                                      <span
                                        className="w-2 h-2 rounded-full bg-amber-500 shrink-0"
                                        title={`Float ${row._floatDateStr} → Declared ${row._declDateStr}`}
                                      />
                                    )}
                                  </div>
                                </td>
                              );
                            }

                            // Variance Status Custom Chip (when enabled in Column Configuration)
                            if (header === 'Variance Status' && cellVal) {
                              const str = String(cellVal);
                              const rawNum = typeof row._rawVariance === 'number'
                                ? row._rawVariance
                                : parseFloat(String(row['Cash Variance'] || '').replace('$', '').replace('+', '').replace(/,/g, '')) || 0;
                              const evaluated = evaluateCashVariance(rawNum, cashVarianceConfig);

                              return (
                                <td key={`cell-${header}-${idx}`} className="py-2 px-3 whitespace-nowrap">
                                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold border ${evaluated.badgeBg} ${evaluated.badgeText} ${evaluated.badgeBorder}`}>
                                    {evaluated.showEmoji && <span className="text-xs">{evaluated.emoji}</span>}
                                    <span>{cashVarianceConfig.enabled ? evaluated.summaryText : str}</span>
                                  </span>
                                </td>
                              );
                            }

                            // Cash Variance: Just show Emoji with amount, NO text label, compact to minimize horizontal scrolling
                            if (header === 'Cash Variance' && cellVal) {
                              const str = String(cellVal);
                              const rawNum = typeof row._rawVariance === 'number'
                                ? row._rawVariance
                                : parseFloat(str.replace('$', '').replace('+', '').replace(/,/g, '')) || 0;
                              const evaluated = evaluateCashVariance(rawNum, cashVarianceConfig);

                              return (
                                <td key={`cell-${header}-${idx}`} className="py-2 px-3 whitespace-nowrap font-mono font-bold text-xs">
                                  <span
                                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md border shadow-2xs ${evaluated.badgeBg} ${evaluated.badgeText} ${evaluated.badgeBorder}`}
                                    title={`Variance: ${str} (${evaluated.label} - ${evaluated.direction})`}
                                  >
                                    <span className="text-sm shrink-0 leading-none">{evaluated.emoji}</span>
                                    <span>{str}</span>
                                  </span>
                                </td>
                              );
                            }

                            // Audit Notes Custom Rendering with clean wrapping
                            if (header === 'Audit Notes' && cellVal) {
                              return (
                                <td key={`cell-${header}-${idx}`} className="py-2 px-3 text-xs text-slate-700">
                                  <div className="break-words whitespace-normal leading-tight max-w-[200px]" title={String(cellVal)}>
                                    {String(cellVal)}
                                  </div>
                                </td>
                              );
                            }

                            // Barcode Highlight Styling
                            if (header === 'Barcode' && cellVal) {
                              return (
                                <td key={`cell-${header}-${idx}`} className="py-2 px-3 font-mono text-xs font-bold text-slate-900 tracking-wider whitespace-nowrap">
                                  {String(cellVal)}
                                </td>
                              );
                            }

                            // Product Name Custom Styling
                            if ((header === 'Product' || header === 'Product Name') && cellVal) {
                              return (
                                <td key={`cell-${header}-${idx}`} className="py-2 px-3 font-semibold text-slate-900 break-words whitespace-normal max-w-[220px]">
                                  {String(cellVal)}
                                </td>
                              );
                            }

                            // Quantity Custom Styling
                            if ((header === 'Quantity' || header === 'Claim Qty' || header === 'Total Qty Written Off') && cellVal !== undefined) {
                              return (
                                <td key={`cell-${header}-${idx}`} className="py-2 px-3 font-mono font-bold text-blue-700 whitespace-nowrap">
                                  {String(cellVal)}
                                </td>
                              );
                            }

                            const isCellNaN = typeof cellVal === 'number' && isNaN(cellVal);
                            const displayVal = isCellNaN || cellVal === undefined || cellVal === null ? '—' : cellVal;
                            const isNumericOrCurrency = typeof displayVal === 'string' && (displayVal.startsWith('$') || displayVal.endsWith('%'));
                            return (
                              <td
                                key={`cell-${header}-${idx}`}
                                className={`py-2 px-3 text-xs font-medium ${
                                  isNumericOrCurrency ? 'font-mono whitespace-nowrap' : 'break-words whitespace-normal max-w-[200px]'
                                }`}
                              >
                                {displayVal}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600 print:hidden">
              <div>
                Showing{' '}
                <span className="font-bold text-slate-800">
                  {processedTableRows.length === 0 ? 0 : (currentPage - 1) * (pageSize === 'all' ? processedTableRows.length : pageSize) + 1}
                </span>{' '}
                to{' '}
                <span className="font-bold text-slate-800">
                  {pageSize === 'all' ? processedTableRows.length : Math.min(currentPage * (pageSize as number), processedTableRows.length)}
                </span>{' '}
                of <span className="font-bold text-slate-800">{processedTableRows.length}</span> entries
              </div>

              {pageSize !== 'all' && totalPages > 1 && (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <span className="px-2 font-semibold text-slate-800">
                    Page {currentPage} of {totalPages}
                  </span>

                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-1.5 rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Printable Supplier Claim Sign-Off & Credit Note Block (Visible only when printing) */}
            {reportType === 'wastage_category_claim' && (
              <div className="hidden print:block p-6 mt-6 border-t-2 border-slate-400 text-xs text-slate-800">
                <p className="font-black uppercase tracking-wider mb-2 text-slate-900 text-sm">
                  Supplier Credit Claim Acknowledgment & Credit Note Details
                </p>
                <p className="text-xs text-slate-600 mb-8">
                  Please verify the returned / written-off inventory items above. Return a copy of this signed form with your corresponding Credit Note reference.
                </p>
                <div className="grid grid-cols-3 gap-8">
                  <div>
                    <span className="font-bold text-slate-800 block mb-10">Supplier Representative:</span>
                    <div className="border-b-2 border-slate-400" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-800 block mb-10">Credit Note Reference #:</span>
                    <div className="border-b-2 border-slate-400" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-800 block mb-10">Signature & Date:</span>
                    <div className="border-b-2 border-slate-400" />
                  </div>
                </div>
              </div>
            )}
          </div>
          ) : (
            <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-6 text-center shadow-2xs">
              <p className="text-sm font-semibold text-slate-700">
                Detailed table grid is currently hidden in favor of the interactive visual display above.
              </p>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                You can inspect every single line-item record or filter individual columns by switching back to table view or selecting Bifurcation + Table.
              </p>
              <button
                type="button"
                onClick={() => {
                  if (reportType === 'clerk_sales') setClerkViewMode('table');
                  if (reportData?.bifurcation) setBifurcationViewMode('both');
                }}
                className="mt-3 px-4 py-2 bg-white border border-slate-300 hover:border-slate-400 text-xs font-bold text-slate-800 rounded-lg shadow-xs transition-colors"
              >
                Show Detailed Table Grid
              </button>
            </div>
          )}
        </div>
      )}

      {/* Clerk Shift Cash Declaration Deep Summary Modal */}
      {selectedDeclarationId !== null && (
        <ClerkShiftDeclarationModal
          declarationId={selectedDeclarationId}
          onClose={() => setSelectedDeclarationId(null)}
        />
      )}
    </div>
  );
};

export default ReportsManager;
