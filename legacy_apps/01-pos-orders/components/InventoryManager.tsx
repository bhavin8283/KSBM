import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search,
  Filter,
  Package,
  TrendingDown,
  TrendingUp,
  X,
  Clock,
  BarChart2,
  Calendar,
  AlertTriangle,
  ArrowUpDown,
  FileText,
  DollarSign,
  Tag,
  Layers,
  HelpCircle,
  RefreshCw,
  Image as ImageIcon,
  ArrowUp,
  SlidersHorizontal,
  Eye,
  EyeOff,
  Minus,
  Plus,
  RotateCcw,
  Check,
  LayoutGrid,
  List,
  AlertOctagon,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ShieldAlert,
  Sparkles,
  Info,
  Barcode,
  Truck,
  Camera,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { InventoryItem, StockMovement, ProductSalesHistory } from '../types';
import { useAppTheme } from '../ThemeContext';
import { MultiSelectDepartmentDropdown } from './MultiSelectDepartmentDropdown';
import { UniversalBarcodeScannerModal } from './UniversalBarcodeScannerModal';
import { ExpiryBatchManagerModal } from './ExpiryBatchManagerModal';
import {
  ExpiryBatch,
  getProductExpirySummary,
  getDaysUntilExpiry,
  getExpiryBadgeConfig,
  getExpiryWarningStatus,
  ProductExpirySummary,
} from '../expiryUtils';
import {
  calculatePredictiveStock,
  getStockStatusBadge,
  PredictiveStockResult,
  MultiHorizonSales,
  SalesTrend,
  ForecastConfidence,
} from '../predictiveStockUtils';
import { CurrentUserSession } from '../types';
import { StockSuggestionsTableView } from './StockSuggestionsTableView';
import { StockOrderAssistantModal } from './StockOrderAssistantModal';
import { ExpiryManagementTableView } from './ExpiryManagementTableView';

export interface InventoryManagerProps {
  currentUser?: CurrentUserSession | null;
  initialFilter?: string;
}

export interface ColumnSetting {
  id: keyof InventoryItem;
  label: string;
  visible: boolean;
  width: number; // in pixels
}

const DEFAULT_COLUMNS: ColumnSetting[] = [
  { id: 'itemCode', label: 'Item Code', visible: true, width: 110 },
  { id: 'scanCode', label: 'Barcode / Scan Code', visible: true, width: 160 },
  { id: 'longDescription', label: 'Long Description (Description3)', visible: true, width: 300 },
  { id: 'departmentName', label: 'Department', visible: true, width: 140 },
  { id: 'sellingPrice', label: 'Selling Price', visible: true, width: 110 },
  { id: 'currentStock', label: 'Current Stock', visible: true, width: 130 },
  { id: 'supplierName', label: 'Supplier', visible: false, width: 160 },
  { id: 'suggestedMin', label: 'Suggested Min', visible: false, width: 130 },
  { id: 'suggestedTarget', label: 'Suggested Target', visible: false, width: 140 },
  { id: 'suggestedOrder', label: 'Suggested Order', visible: false, width: 140 },
  { id: 'salesVelocityStatus', label: 'Stock Status', visible: false, width: 140 },
];

/**
 * Advanced Search Syntax Engine
 * Rules:
 * Rule 1: 'Dare' -> description STARTS WITH 'Dare'
 * Rule 2: '*Dare' -> description CONTAINS 'Dare' anywhere
 * Rule 3: 'Dare *500ml' -> STARTS WITH 'Dare' AND CONTAINS '500ml' anywhere
 * Rule 4: '*Dare *500ml' -> CONTAINS 'Dare' AND CONTAINS '500ml' anywhere
 * Rule 5: '*Monster *Ultra *500ml' -> CONTAINS 'Monster', 'Ultra', '500ml' anywhere in any order
 * Rule 6: Also matches barcode / scanCode or itemCode if query matches
 */
export function matchAdvancedSearch(
  description: string,
  rawQuery: string,
  scanCode?: string,
  itemCode?: string
): boolean {
  if (!rawQuery || !rawQuery.trim()) return true;

  const trimmed = rawQuery.trim();
  const queryLower = trimmed.toLowerCase();

  // Barcode / Item code match
  if (scanCode && scanCode.toLowerCase().includes(queryLower)) return true;
  if (itemCode && itemCode.toLowerCase().includes(queryLower)) return true;

  const tokens = trimmed.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;

  const descLower = (description || '').toLowerCase().trim();

  // Token 0: Check if starts with '*'
  const firstToken = tokens[0];
  if (firstToken.startsWith('*')) {
    const word = firstToken.slice(1).toLowerCase();
    if (word && !descLower.includes(word)) return false;
  } else {
    const word = firstToken.toLowerCase();
    if (!descLower.startsWith(word)) return false;
  }

  // Tokens 1..N: must appear anywhere
  for (let i = 1; i < tokens.length; i++) {
    const tok = tokens[i];
    const word = tok.startsWith('*') ? tok.slice(1).toLowerCase() : tok.toLowerCase();
    if (word && !descLower.includes(word)) return false;
  }

  return true;
}

/**
 * Individual Column Filter Matching Engine
 * Supports:
 * - Live real-time typing of text or numbers
 * - OR logic: 'A or B', 'A OR B', 'A | B'
 * - Wildcard * logic: '*text', 'text*', '*text*', 'part1*part2'
 * - Numeric comparison: '>10', '>=10', '<5', '<=5', '=0', '!=0', '5-10'
 */
export function matchColumnFilter(
  rawVal: any,
  query: string,
  colId?: string
): boolean {
  if (!query || !query.trim()) return true;

  const trimmedQuery = query.trim();

  // Split by OR operators: " or ", " OR ", " | "
  const orClauses = trimmedQuery
    .split(/\s+or\s+|\s+OR\s+|\|/i)
    .map((c) => c.trim())
    .filter(Boolean);

  if (orClauses.length === 0) return true;

  // Returns true if ANY of the OR clauses match the column value
  return orClauses.some((clause) => matchSingleColumnCondition(rawVal, clause, colId));
}

function matchSingleColumnCondition(
  rawVal: any,
  clause: string,
  colId?: string
): boolean {
  if (!clause || !clause.trim()) return true;
  const cond = clause.trim();

  // Format value to string and number
  const valStr = rawVal === null || rawVal === undefined ? '' : String(rawVal).trim();
  const valLower = valStr.toLowerCase();
  const numVal = typeof rawVal === 'number' ? rawVal : parseFloat(valStr);
  const isNumeric = !isNaN(numVal) && typeof numVal === 'number';

  // Numeric comparison operators (e.g. '>10', '>=5', '<0', '<=10', '=0', '!=0')
  const compMatch = cond.match(/^([><]=?|!=|=)\s*(-?\d+(?:\.\d+)?)$/);
  if (compMatch && isNumeric) {
    const op = compMatch[1];
    const target = parseFloat(compMatch[2]);
    if (!isNaN(target)) {
      if (op === '>') return numVal > target;
      if (op === '>=') return numVal >= target;
      if (op === '<') return numVal < target;
      if (op === '<=') return numVal <= target;
      if (op === '=' || op === '==') return Math.abs(numVal - target) < 0.0001;
      if (op === '!=') return Math.abs(numVal - target) >= 0.0001;
    }
  }

  // Numeric range (e.g. '10-20' or '10..20')
  const rangeMatch = cond.match(/^(-?\d+(?:\.\d+)?)\s*(?:-|\.\.)\s*(-?\d+(?:\.\d+)?)$/);
  if (rangeMatch && isNumeric) {
    const min = parseFloat(rangeMatch[1]);
    const max = parseFloat(rangeMatch[2]);
    if (!isNaN(min) && !isNaN(max)) {
      return numVal >= min && numVal <= max;
    }
  }

  // Wildcard search with '*'
  if (cond.includes('*')) {
    if (cond === '*') return valStr.length > 0;

    const parts = cond.split('*').map((p) => p.trim().toLowerCase()).filter(Boolean);
    if (parts.length === 0) return true;

    // Starts with, ends with or contains wildcard sequence
    const startsWithWildcard = cond.startsWith('*');
    const endsWithWildcard = cond.endsWith('*');

    if (!startsWithWildcard && endsWithWildcard && parts.length === 1) {
      return valLower.startsWith(parts[0]);
    }

    // Default wildcard contains in sequence
    let searchIndex = 0;
    for (const part of parts) {
      const idx = valLower.indexOf(part, searchIndex);
      if (idx === -1) return false;
      searchIndex = idx + part.length;
    }
    return true;
  }

  // Standard substring/case-insensitive search
  return valLower.includes(cond.toLowerCase());
}

export function getColumnPlaceholder(colId: string): string {
  switch (colId) {
    case 'itemCode':
      return 'Code / *ID...';
    case 'scanCode':
      return 'Barcode / *...';
    case 'longDescription':
      return 'Search (e.g. *coke or pepsi)';
    case 'departmentName':
      return 'Dept / *...';
    case 'sellingPrice':
      return '$ (e.g. >5, 4.5, or)';
    case 'currentStock':
      return 'Qty (e.g. <=0, >10, or)';
    case 'supplierName':
      return 'Supplier / *...';
    case 'nextExpiryDate':
      return 'Date / *soon...';
    case 'suggestedMin':
    case 'suggestedTarget':
    case 'suggestedOrder':
      return 'Qty / >N...';
    case 'salesVelocityStatus':
      return 'Status / *...';
    default:
      return 'Filter... (*, or)';
  }
}

export const InventoryManager: React.FC<InventoryManagerProps> = ({ currentUser, initialFilter }) => {
  const { getThemeClasses } = useAppTheme();
  const theme = getThemeClasses();

  // Top view sub-tab
  const [activeSubTab, setActiveSubTab] = useState<'inventory' | 'suggestions' | 'expiry'>(() => {
    if (initialFilter === 'expiry_tab' || initialFilter === 'expiry_unresolved') {
      return 'expiry';
    }
    return 'inventory';
  });
  const [isStockOrderAssistantOpen, setIsStockOrderAssistantOpen] = useState(false);

  useEffect(() => {
    if (initialFilter === 'expiry_tab' || initialFilter === 'expiry_unresolved') {
      setActiveSubTab('expiry');
    }
  }, [initialFilter]);

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Operational State: Expiry Batches & Modals
  const [expiryBatches, setExpiryBatches] = useState<ExpiryBatch[]>([]);
  const [isBarcodeScannerOpen, setIsBarcodeScannerOpen] = useState(false);
  const [batchManagerProduct, setBatchManagerProduct] = useState<any | null>(null);
  const [attentionFilter, setAttentionFilter] = useState<string>('all');

  // Department Flags & Settings
  const [departmentFlagsList, setDepartmentFlagsList] = useState<
    Array<{ departmentCode: number; departmentName: string; isCore: boolean; isGeneral: boolean }>
  >([]);

  // Filtering State
  const [selectedDeptDropdown, setSelectedDeptDropdown] = useState<string>('ALL');
  const [priceFrom, setPriceFrom] = useState<string>('');
  const [priceTo, setPriceTo] = useState<string>('');
  const [quickSelectedDepts, setQuickSelectedDepts] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');

  const [stockFilter, setStockFilter] = useState<'all' | 'lowstock'>('all');
  const [sortField, setSortField] = useState<keyof InventoryItem>('departmentCode');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Individual Column-Specific Search & Filter State
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});

  const activeColumnFilterCount = useMemo(
    () => (Object.values(columnFilters) as string[]).filter((v) => typeof v === 'string' && v.trim().length > 0).length,
    [columnFilters]
  );

  const handleColumnFilterChange = (colId: string, value: string) => {
    setColumnFilters((prev) => ({
      ...prev,
      [colId]: value,
    }));
    setCurrentPage(1);
  };

  const handleClearColumnFilters = () => {
    setColumnFilters({});
    setCurrentPage(1);
  };

  // Pagination State
  const [pageSize, setPageSize] = useState<number | 'all'>(25);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Debounce search query (280ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
      setCurrentPage(1);
    }, 280);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Check if user has an active filter or search
  const isFilterActive =
    selectedDeptDropdown !== 'ALL' ||
    priceFrom.trim().length > 0 ||
    priceTo.trim().length > 0 ||
    quickSelectedDepts.length > 0 ||
    debouncedSearchQuery.trim().length > 0 ||
    attentionFilter !== 'all' ||
    activeColumnFilterCount > 0;

  // Column Customization State
  const [columns, setColumns] = useState<ColumnSetting[]>(() => {
    try {
      const saved = localStorage.getItem('idealpos_inventory_columns_v3');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return DEFAULT_COLUMNS.map((def) => {
            const found = parsed.find((p: any) => p.id === def.id);
            return found
              ? {
                  ...def,
                  width: typeof found.width === 'number' ? found.width : def.width,
                  visible: typeof found.visible === 'boolean' ? found.visible : def.visible,
                }
              : def;
          });
        }
      }
    } catch (e) {
      console.error('Failed to parse columns config:', e);
    }
    return DEFAULT_COLUMNS;
  });
  const [showColumnConfig, setShowColumnConfig] = useState(false);

  useEffect(() => {
    localStorage.setItem('idealpos_inventory_columns_v3', JSON.stringify(columns));
  }, [columns]);

  // View Mode State (Default 'cards' on mobile, 'table' on desktop)
  const [viewMode, setViewMode] = useState<'auto' | 'table' | 'cards'>('auto');

  const toggleColumnVisibility = (colId: keyof InventoryItem) => {
    setColumns((prev) =>
      prev.map((col) => (col.id === colId ? { ...col, visible: !col.visible } : col))
    );
  };

  const resetColumns = () => {
    setColumns(DEFAULT_COLUMNS);
  };

  // Selected Product Modal state
  const [selectedProduct, setSelectedProduct] = useState<InventoryItem | null>(null);
  const [modalImageBroken, setModalImageBroken] = useState(false);
  const [productDetails, setProductDetails] = useState<{
    movements: StockMovement[];
    dailyTrend?: Array<{ date: string; dayName: string; fullDayName?: string; qtySold: number; revenue: number }>;
    dayOfWeekBreakdown?: Array<{ dayName: string; dayShort: string; dayIndex: number; totalQtySold: number; percentage: number }>;
    multiHorizon?: MultiHorizonSales;
    peakDay?: { dayName: string; totalQtySold: number; percentage: number };
    totalQtySoldPeriod?: number;
    totalRevenuePeriod?: number;
    salesHistory: ProductSalesHistory;
  } | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [trendPeriod, setTrendPeriod] = useState<'7days' | 'month' | 'this_quarter' | 'last_quarter' | 'year' | 'custom'>('7days');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Column Drag Resizing
  const [resizingColId, setResizingColId] = useState<keyof InventoryItem | null>(null);
  const startXRef = React.useRef(0);
  const startWidthRef = React.useRef(0);

  const handleMouseDownResize = (e: React.MouseEvent, colId: keyof InventoryItem, currentWidth: number) => {
    e.stopPropagation();
    e.preventDefault();
    setResizingColId(colId);
    startXRef.current = e.clientX;
    startWidthRef.current = currentWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startXRef.current;
      const newWidth = Math.max(70, Math.min(800, startWidthRef.current + deltaX));
      setColumns((prev) =>
        prev.map((c) => (c.id === colId ? { ...c, width: newWidth } : c))
      );
    };

    const handleMouseUp = () => {
      setResizingColId(null);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      setColumns((latest) => {
        try {
          localStorage.setItem('idealpos_inventory_columns_v3', JSON.stringify(latest));
        } catch (e) {}
        return latest;
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Fetch department master list with core & general flags on mount
  useEffect(() => {
    let isMounted = true;
    const fetchDepartments = async (retryCount = 0) => {
      try {
        const res = await fetch('/api/pos/departments');
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.departments && Array.isArray(data.departments)) {
            setDepartmentFlagsList(data.departments);
          }
        }
      } catch (err) {
        if (isMounted && retryCount < 2) {
          setTimeout(() => fetchDepartments(retryCount + 1), 1500);
        } else {
          console.warn('Failed to fetch departments list:', err);
        }
      }
    };
    fetchDepartments();
    return () => { isMounted = false; };
  }, []);

  // Fetch Expiry Batches
  const fetchExpiryBatches = async (retryCount = 0) => {
    try {
      const res = await fetch('/api/expiry');
      if (res.ok) {
        const data = await res.json();
        setExpiryBatches(data.batches || []);
      }
    } catch (e) {
      if (retryCount < 2) {
        setTimeout(() => fetchExpiryBatches(retryCount + 1), 1500);
      } else {
        console.warn('Failed to fetch expiry batches:', e);
      }
    }
  };

  useEffect(() => {
    fetchExpiryBatches();
  }, []);

  // Compute visible departments for dropdowns & filters
  const visibleDepartmentNames = useMemo(() => {
    if (departmentFlagsList.length > 0) {
      return Array.from(new Set(departmentFlagsList.map((d) => d.departmentName))).filter(Boolean);
    }
    return Array.from(new Set(items.map((i) => i.departmentName))).filter(Boolean);
  }, [departmentFlagsList, items]);

  // Hidden departments set (empty by default so all inventory is visible)
  const hiddenDepartmentNamesSet = useMemo(() => {
    return new Set<string>();
  }, []);

  // Fetch Inventory products (retrieves all items)
  const fetchInventory = async (isManualRefresh = false, retryCount = 0) => {
    if (isManualRefresh || items.length === 0) {
      setLoading(true);
    }
    try {
      const res = await fetch('/api/pos/inventory');
      if (!res.ok) throw new Error('Failed to load inventory');
      const json = await res.json();
      setItems(json.items || []);
    } catch (err) {
      if (retryCount < 2) {
        setTimeout(() => fetchInventory(isManualRefresh, retryCount + 1), 1500);
      } else {
        console.warn('Inventory fetch error:', err);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  // Map barcodes to detect barcode conflicts
  const barcodeOccurrences = useMemo(() => {
    const map = new Map<string, number[]>();
    for (const item of items) {
      const bar = (item.scanCode || '').trim();
      // Ignore empty, zero placeholders or generic markers
      if (bar && bar !== '0' && bar !== '00' && bar !== '—' && bar !== '-' && bar.length >= 3) {
        const existing = map.get(bar) || [];
        existing.push(item.productId);
        map.set(bar, existing);
      }
    }
    return map;
  }, [items]);

  // Enrich Inventory items with predictive stock and expiry metadata
  const enrichedItems = useMemo(() => {
    return items.map((item) => {
      const expiry = getProductExpirySummary(expiryBatches, item.productId);
      
      // Calculate predictive stock metrics
      const est30DaySales = (item.minimumStock || 2) * 4; // realistic estimation based on min stock
      const predictive = calculatePredictiveStock({
        currentStock: item.currentStock,
        recentSalesTotal: est30DaySales,
        salesHistoryDays: 30,
        daysUntilNextDelivery: 4,
        leadTimeDays: 2,
        safetyMultiplier: 1.2,
        isDiscontinued: item.isDiscontinued,
      });

      const bar = (item.scanCode || '').trim();
      const isValidBarcode = Boolean(bar && bar !== '0' && bar !== '00' && bar !== '—' && bar !== '-' && bar.length >= 3);
      const hasBarcodeConflict = isValidBarcode ? (barcodeOccurrences.get(bar)?.length || 0) > 1 : false;

      return {
        ...item,
        suggestedMin: predictive.suggestedMin,
        suggestedTarget: predictive.suggestedTarget,
        suggestedOrder: predictive.suggestedOrderQty,
        avgDailySales: predictive.avgDailySales,
        salesVelocityStatus: predictive.stockStatus,
        confidence: predictive.confidence,
        nextExpiryDate: expiry.nextExpiryDate,
        daysUntilExpiry: expiry.daysUntilNextExpiry,
        expiryWarningStatus: expiry.worstStatus,
        trackedExpiryQty: expiry.totalTrackedQty,
        activeBatchesCount: expiry.activeBatchesCount,
        hasBarcodeConflict,
      };
    });
  }, [items, expiryBatches, barcodeOccurrences]);

  const fetchProductDetails = async (
    productId: number,
    periodVal = trendPeriod,
    startVal = customStartDate,
    endVal = customEndDate
  ) => {
    setLoadingDetails(true);
    try {
      const params = new URLSearchParams();
      params.append('period', periodVal);
      if (periodVal === 'custom') {
        if (startVal) params.append('startDate', startVal);
        if (endVal) params.append('endDate', endVal);
      }
      const res = await fetch(`/api/pos/inventory/${productId}/details?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load product movements & sales history');
      const json = await res.json();
      setProductDetails(json);
    } catch (err) {
      console.error('Failed to load details:', err);
    } finally {
      setLoadingDetails(false);
    }
  };

  // Load Product Modal details
  const openProductModal = async (item: InventoryItem) => {
    setSelectedProduct(item);
    setModalImageBroken(false);
    setTrendPeriod('7days');
    setCustomStartDate('');
    setCustomEndDate('');
    fetchProductDetails(item.productId, '7days', '', '');
  };

  const handlePeriodChange = (newPeriod: typeof trendPeriod) => {
    setTrendPeriod(newPeriod);
    if (selectedProduct) {
      fetchProductDetails(selectedProduct.productId, newPeriod, customStartDate, customEndDate);
    }
  };

  const handleApplyCustomDates = () => {
    if (selectedProduct && customStartDate && customEndDate) {
      fetchProductDetails(selectedProduct.productId, 'custom', customStartDate, customEndDate);
    }
  };

  const toggleQuickDept = (deptName: string) => {
    setQuickSelectedDepts((prev) =>
      prev.includes(deptName) ? prev.filter((d) => d !== deptName) : [...prev, deptName]
    );
    setCurrentPage(1);
  };

  const handleClearAllFilters = () => {
    setSelectedDeptDropdown('ALL');
    setPriceFrom('');
    setPriceTo('');
    setQuickSelectedDepts([]);
    setSearchQuery('');
    setAttentionFilter('all');
    setColumnFilters({});
    setCurrentPage(1);
  };

  // Filter items based on active criteria, attention filter, and department visibility
  const filteredAndSortedItems = useMemo(() => {
    const filtered = enrichedItems.filter((item) => {
      // Exclude items from hidden departments
      if (hiddenDepartmentNamesSet.has(item.departmentName)) {
        return false;
      }

      // Attention and Low Stock Filter logic
      const hasTrackedExpiry = (item.activeBatchesCount || 0) > 0 || (item.trackedExpiryQty || 0) > 0;
      if (attentionFilter === 'has_expiry' && !hasTrackedExpiry) return false;
      if (attentionFilter === 'expired' && item.expiryWarningStatus !== 'EXPIRED') return false;
      if (attentionFilter === 'expiring_soon' && !['TODAY', 'URGENT', 'SOON'].includes(item.expiryWarningStatus || '')) return false;
      if (attentionFilter === 'expiring_month' && item.expiryWarningStatus !== 'WATCH') return false;
      if (attentionFilter === 'barcode_conflict' && !item.hasBarcodeConflict) return false;
      if (attentionFilter === 'out_of_stock' && item.currentStock > 0) return false;
      if (attentionFilter === 'below_min' && (item.currentStock <= 0 || item.currentStock >= (item.suggestedMin || item.minimumStock || 1))) return false;
      if (attentionFilter === 'reorder_needed' && item.currentStock >= (item.suggestedMin || item.minimumStock || 1)) return false;

      // Dropdown 1: Department
      if (selectedDeptDropdown !== 'ALL' && item.departmentName !== selectedDeptDropdown) {
        return false;
      }

      // Quick Department Selector (Multi-select)
      if (quickSelectedDepts.length > 0 && !quickSelectedDepts.includes(item.departmentName)) {
        return false;
      }

      // Price Range Filter: Price From and Price To
      if (priceFrom.trim() !== '') {
        const minP = parseFloat(priceFrom);
        if (!isNaN(minP) && (item.sellingPrice ?? 0) < minP) {
          return false;
        }
      }

      if (priceTo.trim() !== '') {
        const maxP = parseFloat(priceTo);
        if (!isNaN(maxP) && (item.sellingPrice ?? 0) > maxP) {
          return false;
        }
      }

      // Stock filter
      if (stockFilter === 'lowstock' && item.currentStock > item.minimumStock) {
        return false;
      }

      // Advanced Search Syntax (Main Search Bar - Instant Client-side filtering)
      if (searchQuery.trim()) {
        const matches = matchAdvancedSearch(
          item.longDescription || '',
          searchQuery,
          item.scanCode,
          item.itemCode
        );
        if (!matches) return false;
      }

      // Individual Column-Specific Searches (* wildcard, 'or' syntax, numeric comparison, real-time typing)
      if (activeColumnFilterCount > 0) {
        for (const [colId, colQuery] of Object.entries(columnFilters) as [string, string][]) {
          if (!colQuery || typeof colQuery !== 'string' || !colQuery.trim()) continue;

          let targetVal: any = (item as any)[colId];
          if (colId === 'nextExpiryDate') {
            targetVal = `${item.nextExpiryDate || ''} ${item.expiryWarningStatus || ''} ${
              item.daysUntilExpiry !== undefined ? item.daysUntilExpiry + ' days' : ''
            }`;
          } else if (colId === 'scanCode') {
            const allBarcodes = [item.scanCode, ...(item.barcodes || [])].filter(Boolean).join(' ');
            targetVal = allBarcodes;
          } else if (colId === 'salesVelocityStatus') {
            targetVal = `${item.salesVelocityStatus || ''} ${item.salesVelocityGroup || ''}`;
          }

          const matches = matchColumnFilter(targetVal, colQuery, colId);
          if (!matches) return false;
        }
      }

      return true;
    });

    // Client-side sorting
    return filtered.sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (sortField === 'departmentCode' || sortField === 'currentStock' || sortField === 'sellingPrice' || sortField === 'suggestedMin' || sortField === 'suggestedTarget' || sortField === 'suggestedOrder') {
        valA = Number(valA) || 0;
        valB = Number(valB) || 0;
      } else if (typeof valA === 'string') {
        valA = (valA as string).toLowerCase();
        valB = (valB as string).toLowerCase();
      }

      if (valA! < valB!) return sortDirection === 'asc' ? -1 : 1;
      if (valA! > valB!) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [
    enrichedItems,
    hiddenDepartmentNamesSet,
    attentionFilter,
    selectedDeptDropdown,
    quickSelectedDepts,
    priceFrom,
    priceTo,
    stockFilter,
    debouncedSearchQuery,
    columnFilters,
    activeColumnFilterCount,
    sortField,
    sortDirection,
  ]);

  // Paginated items
  const totalItemsCount = filteredAndSortedItems.length;
  const totalPages = pageSize === 'all' ? 1 : Math.max(1, Math.ceil(totalItemsCount / Number(pageSize)));

  const paginatedItems = useMemo(() => {
    if (pageSize === 'all') return filteredAndSortedItems;
    const size = Number(pageSize);
    const startIdx = (currentPage - 1) * size;
    return filteredAndSortedItems.slice(startIdx, startIdx + size);
  }, [filteredAndSortedItems, pageSize, currentPage]);

  const toggleSort = (field: keyof InventoryItem) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Selected product predictive metrics for drawer
  const selectedProductPredictive = useMemo(() => {
    if (!selectedProduct) return null;
    return calculatePredictiveStock({
      currentStock: selectedProduct.currentStock,
      multiHorizon: productDetails?.multiHorizon,
      recentSalesTotal: productDetails?.totalQtySoldPeriod,
      salesHistoryDays: 30,
      daysUntilNextDelivery: 4,
      leadTimeDays: 2,
      safetyMultiplier: 1.2,
      isDiscontinued: selectedProduct.isDiscontinued,
    });
  }, [selectedProduct, productDetails]);

  const selectedProductExpirySummary = useMemo(() => {
    if (!selectedProduct) return null;
    return getProductExpirySummary(expiryBatches, selectedProduct.productId);
  }, [selectedProduct, expiryBatches]);

  return (
    <div className="space-y-6">
      {/* Title & Top Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-neutral-800">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-neutral-100 tracking-tight flex items-center gap-2">
            <Package className="w-6 h-6 text-blue-600" />
            POS Inventory & Stock Control
          </h1>
          <p className="text-sm text-slate-500 dark:text-neutral-400 mt-0.5">
            View stock levels, movement velocities, suggested holding targets, and shelf observation counts.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Sub-Tab Toggle */}
          <div className="inline-flex bg-slate-100 dark:bg-neutral-800 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveSubTab('inventory')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeSubTab === 'inventory'
                  ? 'bg-white dark:bg-neutral-700 text-blue-700 dark:text-blue-300 shadow-xs'
                  : 'text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-neutral-200'
              }`}
            >
              POS Inventory &amp; Stock
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('suggestions')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeSubTab === 'suggestions'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-neutral-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Suggested Stock</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('expiry')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeSubTab === 'expiry'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-neutral-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Expiry Management</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsStockOrderAssistantOpen(true)}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
            title="Open Stock Order Assistant modal"
          >
            <Sparkles className="w-4 h-4 text-blue-200" />
            <span>Stock Order Assistant</span>
          </button>
          <div className="px-3 py-2 bg-slate-100 dark:bg-neutral-800 text-slate-700 dark:text-neutral-300 rounded-xl border border-slate-200 dark:border-neutral-700 text-xs font-semibold">
            Filtered Products: <span className="font-bold text-slate-900 dark:text-neutral-100">{totalItemsCount}</span>
          </div>
        </div>
      </div>

      {/* Render SubTabs: Suggested Stock on Hand / Expiry Management / Main Inventory */}
      {activeSubTab === 'suggestions' ? (
        <StockSuggestionsTableView
          currentUser={currentUser}
          inventoryProducts={items}
        />
      ) : activeSubTab === 'expiry' ? (
        <ExpiryManagementTableView
          inventoryProducts={items}
          initialFilter={initialFilter}
        />
      ) : (
        <>
          {/* Filtering Header Section */}
          <div className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl p-4 shadow-xs space-y-3">
            {/* Row 1: Search Bar & View/Columns Mode */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
              {/* Advanced Search Input */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search... Examples: Dare, *Dare, Dare *500ml, *Monster *Ultra"
                  className="w-full pl-9 pr-9 py-2.5 bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-neutral-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-neutral-900 transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

          {/* View Mode & Column Controls */}
          <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
            <div className="flex items-center bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                  viewMode === 'cards'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Cards</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                  viewMode === 'table'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <List className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Table</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowColumnConfig(!showColumnConfig)}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Columns</span>
            </button>
          </div>
        </div>

        {/* Row 2: Department & Price Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
          {/* Dropdown 1: Department */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-blue-600" />
              Department
            </label>
            <select
              value={selectedDeptDropdown}
              onChange={(e) => {
                setSelectedDeptDropdown(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none cursor-pointer"
            >
              <option value="ALL">Show All Visible Departments</option>
              {(visibleDepartmentNames.length > 0
                ? visibleDepartmentNames
                : Array.from(new Set(items.map((i) => i.departmentName))).filter(Boolean)
              ).map((d, index) => (
                <option key={`inv-dept-opt-${d}-${index}`} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          {/* Price Range: From & To */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
              <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
              Price Range ($)
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  placeholder="Min $"
                  value={priceFrom}
                  onChange={(e) => {
                    setPriceFrom(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none"
                />
              </div>
              <span className="text-slate-400 font-bold text-xs">—</span>
              <div className="relative flex-1">
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  placeholder="Max $"
                  value={priceTo}
                  onChange={(e) => {
                    setPriceTo(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none"
                />
              </div>
            </div>
          </div>

          {/* Stock Level Quick Filter */}
          <div className="space-y-1 sm:col-span-2 lg:col-span-1">
            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
              <TrendingDown className="w-3.5 h-3.5 text-amber-600" />
              Stock Condition
            </label>
            <select
              value={stockFilter}
              onChange={(e) => {
                setStockFilter(e.target.value as any);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none cursor-pointer"
            >
              <option value="all">All Stock Levels</option>
              <option value="lowstock">Low Stock (≤ Minimum Level)</option>
            </select>
          </div>
        </div>

        {/* Column Visibility Configuration Panel */}
        {showColumnConfig && (
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 animate-in slide-in-from-top-2">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Configure Table Columns
              </div>
              <button
                onClick={resetColumns}
                className="text-xs text-blue-600 hover:underline flex items-center gap-1 font-semibold"
              >
                <RotateCcw className="w-3 h-3" />
                Reset Default
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {columns.map((col) => (
                <label
                  key={col.id}
                  className="flex items-center gap-2 p-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 cursor-pointer hover:bg-blue-50/50"
                >
                  <input
                    type="checkbox"
                    checked={col.visible}
                    onChange={() => toggleColumnVisibility(col.id)}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span className="truncate">{col.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Main Inventory Content (Cards / Table) */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        {loading && items.length === 0 ? (
          <div className="p-16 text-center text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-blue-600" />
            <p className="text-sm font-semibold text-slate-600">Loading inventory data...</p>
          </div>
        ) : (
          <>
            {/* MOBILE CARDS VIEW */}
            <div
              className={`p-3 space-y-2.5 divide-y divide-slate-100 ${
                viewMode === 'cards' ? 'block' : viewMode === 'table' ? 'hidden' : 'block md:hidden'
              }`}
            >
              {paginatedItems.map((item, index) => {
                const isNegative = item.currentStock < 0;
                const isLow = item.currentStock <= item.minimumStock && !isNegative;
                const statusBadge = getStockStatusBadge(item.salesVelocityStatus as any);
                const expiryBadge = item.expiryWarningStatus
                  ? getExpiryBadgeConfig(item.expiryWarningStatus as any)
                  : null;

                return (
                  <div
                    key={`mob-inv-${item.productId}-${index}`}
                    onDoubleClick={() => openProductModal(item)}
                    title="Double click to view product details"
                    className="pt-2.5 first:pt-0 pb-1 cursor-pointer group hover:bg-blue-50/50 p-2.5 rounded-xl border border-slate-100 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <span className="font-bold text-sm text-slate-900 group-hover:text-blue-600 leading-snug block">
                          {item.longDescription}
                        </span>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700">
                            {item.departmentName}
                          </span>
                          {item.scanCode && (
                            <span className="text-[11px] font-mono text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">
                              {item.scanCode}
                            </span>
                          )}
                          {item.hasBarcodeConflict && (
                            <span className="px-1.5 py-0.5 bg-rose-100 text-rose-800 rounded font-bold text-[10px]">
                              Barcode Conflict
                            </span>
                          )}
                          {expiryBadge && (
                            <span
                              onClick={(e) => {
                                e.stopPropagation();
                                setBatchManagerProduct(item);
                              }}
                              className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] border font-bold ${expiryBadge.bgClass} ${expiryBadge.textClass} ${expiryBadge.borderClass}`}
                            >
                              {expiryBadge.label} ({item.nextExpiryDate})
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-base font-extrabold text-slate-900 block font-mono">
                          ${(item.sellingPrice ?? 0).toFixed(2)}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 font-bold text-[11px] px-2 py-0.5 rounded-full mt-1 ${
                            isLow
                              ? 'bg-amber-100 text-amber-800'
                              : item.currentStock < 0
                              ? 'bg-red-100 text-red-800'
                              : 'bg-emerald-50 text-emerald-700'
                          }`}
                        >
                          Stock: {item.currentStock}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* DESKTOP TABLE VIEW */}
            <div
              className={`overflow-x-auto ${
                viewMode === 'table' ? 'block' : viewMode === 'cards' ? 'hidden' : 'hidden md:block'
              }`}
            >
              <table className="w-full text-left text-sm table-fixed border-collapse">
                <thead className="bg-slate-50 text-slate-600 font-semibold text-xs uppercase tracking-wider border-b border-slate-200 sticky top-0 z-20 shadow-xs">
                  {/* Row 1: Column Headings, Sorting & Resizing */}
                  <tr>
                    {columns
                      .filter((c) => c.visible)
                      .map((col) => (
                        <th
                          key={col.id}
                          style={{ width: `${col.width}px` }}
                          className={`relative py-2.5 px-3 select-none border-r border-slate-200/60 last:border-r-0 hover:bg-slate-100 transition-colors ${
                            ['sellingPrice', 'currentStock', 'suggestedMin', 'suggestedTarget', 'suggestedOrder'].includes(
                              col.id
                            )
                              ? 'text-right'
                              : ''
                          }`}
                        >
                          <div
                            onClick={() => toggleSort(col.id)}
                            className={`flex items-center gap-1 cursor-pointer pr-2 ${
                              ['sellingPrice', 'currentStock', 'suggestedMin', 'suggestedTarget', 'suggestedOrder'].includes(
                                col.id
                              )
                                ? 'justify-end pr-3'
                                : ''
                            }`}
                          >
                            <span className="truncate">{col.label}</span>
                            <ArrowUpDown className="w-3 h-3 text-slate-400 shrink-0" />
                          </div>

                          {/* Draggable Column Width Resizer */}
                          <div
                            onMouseDown={(e) => handleMouseDownResize(e, col.id, col.width)}
                            onClick={(e) => e.stopPropagation()}
                            className={`absolute right-0 top-0 bottom-0 w-3 cursor-col-resize hover:bg-blue-500/80 group transition-all z-10 flex items-center justify-center ${
                              resizingColId === col.id ? 'bg-blue-600' : 'bg-transparent'
                            }`}
                            title="Click and drag to adjust column width"
                          >
                            <div className="w-0.5 h-4 bg-slate-300 group-hover:bg-white transition-colors" />
                          </div>
                        </th>
                      ))}
                  </tr>

                  {/* Row 2: Individual Column Search Inputs (Live search, wildcard *, OR queries) */}
                  <tr className="bg-slate-100/90 border-t border-slate-200 font-normal">
                    {columns
                      .filter((c) => c.visible)
                      .map((col) => {
                        const currentVal = columnFilters[col.id] || '';
                        const hasVal = currentVal.trim().length > 0;
                        return (
                          <th
                            key={`col-filter-${col.id}`}
                            style={{ width: `${col.width}px` }}
                            className="p-1.5 border-r border-slate-200/70 last:border-r-0 font-normal"
                          >
                            <div className="relative flex items-center w-full">
                              <input
                                type="text"
                                value={currentVal}
                                onChange={(e) => handleColumnFilterChange(col.id, e.target.value)}
                                placeholder={getColumnPlaceholder(col.id)}
                                title={`Search in ${col.label}. Type to filter live. Supports '*' (e.g. *Dare) and 'or' (e.g. coke or pepsi, >10 or 0)`}
                                className={`w-full text-xs py-1 px-2 pr-6 rounded-lg border transition-all text-slate-800 placeholder:text-slate-400 placeholder:font-normal focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                                  hasVal
                                    ? 'bg-blue-50/90 border-blue-400 font-semibold ring-1 ring-blue-400/40 text-blue-950 shadow-xs'
                                    : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
                                }`}
                              />
                              {hasVal && (
                                <button
                                  type="button"
                                  onClick={() => handleColumnFilterChange(col.id, '')}
                                  className="absolute right-1 text-slate-400 hover:text-slate-700 p-0.5 rounded transition-colors"
                                  title="Clear this column search"
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
                  {paginatedItems.map((item, index) => {
                    const isNegative = item.currentStock < 0;
                    const isLow = item.currentStock <= item.minimumStock && !isNegative;
                    const visibleCols = columns.filter((c) => c.visible);

                    return (
                      <tr
                        key={`desk-inv-${item.productId}-${index}`}
                        onDoubleClick={() => openProductModal(item)}
                        title="Double click to view product details"
                        className="hover:bg-blue-50/50 cursor-pointer transition-colors group"
                      >
                        {visibleCols.map((col) => {
                          if (col.id === 'itemCode') {
                            return (
                              <td
                                key={col.id}
                                style={{ width: `${col.width}px` }}
                                className="py-3 px-4 font-mono text-xs text-slate-500 font-semibold truncate"
                              >
                                {item.itemCode}
                              </td>
                            );
                          }
                          if (col.id === 'scanCode') {
                            const raw = (item.scanCode || '').trim();
                            const displayScan = (raw && raw !== '0' && raw !== '00' && raw !== '—' && raw !== '-') ? raw : '—';
                            return (
                              <td
                                key={col.id}
                                style={{ width: `${col.width}px` }}
                                className="py-3 px-4 font-mono text-xs text-slate-700 truncate"
                              >
                                {displayScan}
                                {displayScan !== '—' && item.hasBarcodeConflict && (
                                  <span
                                    title="Barcode shared by multiple products"
                                    className="ml-1.5 text-[10px] font-bold text-rose-600 bg-rose-50 px-1 py-0.5 rounded"
                                  >
                                    !
                                  </span>
                                )}
                              </td>
                            );
                          }
                          if (col.id === 'longDescription') {
                            return (
                              <td
                                key={col.id}
                                style={{ width: `${col.width}px` }}
                                className="py-3 px-4 font-medium text-slate-900 group-hover:text-blue-700"
                              >
                                <span className="line-clamp-2 leading-tight">{item.longDescription}</span>
                              </td>
                            );
                          }
                          if (col.id === 'departmentName') {
                            return (
                              <td
                                key={col.id}
                                style={{ width: `${col.width}px` }}
                                className="py-3 px-4"
                              >
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 truncate max-w-full">
                                  {item.departmentName}
                                </span>
                              </td>
                            );
                          }
                          if (col.id === 'sellingPrice') {
                            return (
                              <td
                                key={col.id}
                                style={{ width: `${col.width}px` }}
                                className="py-3 px-4 text-right font-bold text-slate-900 font-mono"
                              >
                                ${(item.sellingPrice ?? 0).toFixed(2)}
                              </td>
                            );
                          }
                          if (col.id === 'currentStock') {
                            return (
                              <td
                                key={col.id}
                                style={{ width: `${col.width}px` }}
                                className="py-3 px-4 text-right"
                              >
                                <span
                                  className={`inline-flex items-center gap-1 font-bold text-xs px-2.5 py-1 rounded-full ${
                                    isLow
                                      ? 'bg-amber-100 text-amber-800'
                                      : item.currentStock < 0
                                      ? 'bg-slate-100 text-slate-700'
                                      : 'bg-emerald-50 text-emerald-700'
                                  }`}
                                >
                                  {item.currentStock}
                                </span>
                              </td>
                            );
                          }
                          if (col.id === 'supplierName') {
                            return (
                              <td
                                key={col.id}
                                style={{ width: `${col.width}px` }}
                                className="py-3 px-4 text-xs text-slate-700 font-medium truncate"
                                title={item.supplierName || 'No supplier linked'}
                              >
                                {item.supplierName ? (
                                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800 border border-slate-200/60 max-w-full truncate">
                                    <Truck className="w-3 h-3 text-slate-400 shrink-0" />
                                    <span className="truncate">{item.supplierName}</span>
                                  </span>
                                ) : (
                                  <span className="text-slate-400 italic text-[11px]">—</span>
                                )}
                              </td>
                            );
                          }
                          if (col.id === 'nextExpiryDate') {
                            if (!item.nextExpiryDate) {
                              return (
                                <td
                                  key={col.id}
                                  style={{ width: `${col.width}px` }}
                                  className="py-3 px-4 text-xs text-slate-400"
                                >
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setBatchManagerProduct(item);
                                    }}
                                    className="text-[11px] text-slate-400 hover:text-amber-600 font-medium"
                                  >
                                    + Add Expiry
                                  </button>
                                </td>
                              );
                            }
                            const status = getExpiryWarningStatus(item.nextExpiryDate);
                            const badge = getExpiryBadgeConfig(status);
                            const days = getDaysUntilExpiry(item.nextExpiryDate);

                            return (
                              <td
                                key={col.id}
                                style={{ width: `${col.width}px` }}
                                className="py-3 px-4 text-xs"
                              >
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setBatchManagerProduct(item);
                                  }}
                                  className={`inline-flex items-center px-2 py-1 rounded-lg border text-[11px] font-bold transition-all hover:scale-105 ${badge.bgClass} ${badge.textClass} ${badge.borderClass}`}
                                  title={`Click to manage expiry batches (${item.activeBatchesCount || 1} active)`}
                                >
                                  {badge.label} ({days < 0 ? `${Math.abs(days)}d ago` : `${days}d`})
                                </button>
                              </td>
                            );
                          }
                          if (col.id === 'suggestedMin') {
                            return (
                              <td
                                key={col.id}
                                style={{ width: `${col.width}px` }}
                                className="py-3 px-4 text-right font-mono text-xs font-semibold text-slate-600"
                              >
                                {item.suggestedMin ?? '—'}
                              </td>
                            );
                          }
                          if (col.id === 'suggestedTarget') {
                            return (
                              <td
                                key={col.id}
                                style={{ width: `${col.width}px` }}
                                className="py-3 px-4 text-right font-mono text-xs font-semibold text-blue-700"
                              >
                                {item.suggestedTarget ?? '—'}
                              </td>
                            );
                          }
                          if (col.id === 'suggestedOrder') {
                            return (
                              <td
                                key={col.id}
                                style={{ width: `${col.width}px` }}
                                className="py-3 px-4 text-right font-mono text-xs font-bold text-emerald-700"
                              >
                                {(item.suggestedOrder ?? 0) > 0 ? `+${item.suggestedOrder}` : '0'}
                              </td>
                            );
                          }
                          if (col.id === 'salesVelocityStatus') {
                            const badge = getStockStatusBadge(item.salesVelocityStatus as any);
                            return (
                              <td
                                key={col.id}
                                style={{ width: `${col.width}px` }}
                                className="py-3 px-4 text-xs"
                              >
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${badge.bgClass} ${badge.textClass} ${badge.borderClass}`}>
                                  {badge.label}
                                </span>
                              </td>
                            );
                          }
                          return null;
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination & Rows Per Page Toolbar */}
            <div className="px-6 py-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/70 text-xs text-slate-600">
              <div className="flex items-center gap-3">
                <span>
                  Showing <strong className="font-bold text-slate-900">{totalItemsCount === 0 ? 0 : pageSize === 'all' ? 1 : (currentPage - 1) * Number(pageSize) + 1}</strong> to{' '}
                  <strong className="font-bold text-slate-900">
                    {totalItemsCount === 0 ? 0 : pageSize === 'all' ? totalItemsCount : Math.min(totalItemsCount, currentPage * Number(pageSize))}
                  </strong>{' '}
                  of <strong className="font-bold text-slate-900">{totalItemsCount}</strong> products
                </span>

                <div className="flex items-center gap-1.5 ml-2">
                  <span className="text-slate-400">Rows:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(e.target.value === 'all' ? 'all' : Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 outline-none"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value="all">All</option>
                  </select>
                </div>
              </div>

              {pageSize !== 'all' && totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40"
                    title="First page"
                  >
                    <ChevronsLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40"
                    title="Previous page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <span className="px-3 py-1 font-semibold text-slate-800">
                    Page {currentPage} of {totalPages}
                  </span>

                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40"
                    title="Next page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40"
                    title="Last page"
                  >
                    <ChevronsRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Product Detail Modal (Inspector Drawer) */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-slate-200">
            {/* Modal Header */}
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                {selectedProduct.photoUrl && !modalImageBroken ? (
                  <img
                    src={selectedProduct.photoUrl}
                    alt={selectedProduct.longDescription}
                    className="w-12 h-12 rounded-lg object-cover border-2 border-white/20"
                    onError={() => setModalImageBroken(true)}
                  />
                ) : (
                  <div className="p-3 bg-blue-600/30 rounded-lg text-blue-300">
                    <Package className="w-6 h-6" />
                  </div>
                )}
                <div>
                  <h2 className="text-lg font-bold tracking-tight">{selectedProduct.longDescription}</h2>
                  <p className="text-xs text-slate-400 font-mono flex items-center gap-3 mt-0.5 flex-wrap">
                    <span>Barcode: {selectedProduct.scanCode || 'N/A'}</span>
                    <span>Item Code: {selectedProduct.itemCode}</span>
                    <span>Dept: {selectedProduct.departmentName}</span>
                    {selectedProduct.supplierName && (
                      <span className="text-blue-300 font-sans font-semibold">
                        Supplier: {selectedProduct.supplierName}
                      </span>
                    )}
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  setSelectedProduct(null);
                  setProductDetails(null);
                }}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* Quick Info Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                <div>
                  <span className="text-slate-500 block">Selling Price</span>
                  <span className="text-lg font-extrabold text-slate-900">
                    ${(selectedProduct.sellingPrice ?? 0).toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Cost Price</span>
                  <span className="text-lg font-bold text-slate-700">
                    ${(selectedProduct.costPrice ?? 0).toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Current Stock</span>
                  <span
                    className={`text-lg font-extrabold ${
                      selectedProduct.currentStock < 0 ? 'text-red-600' : 'text-emerald-700'
                    }`}
                  >
                    {selectedProduct.currentStock} units
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">POS Minimum Stock</span>
                  <span className="text-lg font-bold text-slate-700">
                    {selectedProduct.minimumStock ?? 0} units
                  </span>
                </div>
              </div>

              {/* SALES & STOCK INSIGHT (DEMAND FORECASTING & REPLENISHMENT) */}
              {selectedProductPredictive && (
                <div className="p-5 bg-gradient-to-br from-slate-50 to-blue-50/40 border border-blue-200/80 rounded-2xl space-y-5 shadow-xs">
                  {/* Header & Confidence Banner */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-blue-200/60">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-blue-600 text-white rounded-xl shadow-xs">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                          Sales & Stock Insight
                          <span className="text-[11px] font-normal text-slate-500">
                            (Demand-Derived Analytics)
                          </span>
                        </h3>
                        <p className="text-xs text-slate-500">
                          Multi-period sales velocity, trend analysis, suggested min/target & shelf-life
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider flex items-center gap-1 ${
                          selectedProductPredictive.confidence === 'HIGH'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : selectedProductPredictive.confidence === 'MEDIUM'
                            ? 'bg-blue-100 text-blue-800 border border-blue-300'
                            : selectedProductPredictive.confidence === 'LOW'
                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                            : 'bg-rose-100 text-rose-800 border border-rose-300'
                        }`}
                      >
                        {selectedProductPredictive.confidence === 'INSUFFICIENT_HISTORY'
                          ? '⚠️ Insufficient History'
                          : `Confidence: ${selectedProductPredictive.confidence}`}
                      </span>

                      <span
                        className={`px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1 ${
                          selectedProductPredictive.trend === 'Increasing'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : selectedProductPredictive.trend === 'Decreasing'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : selectedProductPredictive.trend === 'Steady'
                            ? 'bg-slate-100 text-slate-700 border border-slate-200'
                            : 'bg-slate-100 text-slate-500 border border-slate-200'
                        }`}
                      >
                        {selectedProductPredictive.trend === 'Increasing' && <TrendingUp className="w-3.5 h-3.5" />}
                        {selectedProductPredictive.trend === 'Decreasing' && <TrendingDown className="w-3.5 h-3.5" />}
                        {selectedProductPredictive.trend === 'Steady' && <ArrowUpDown className="w-3.5 h-3.5" />}
                        Trend: {selectedProductPredictive.trend}
                      </span>
                    </div>
                  </div>

                  {/* Multi-Period Sales History Breakdown */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                        Historical Demand Across Intervals
                      </span>
                      <span className="text-[11px] text-slate-400">
                        Units Sold (Absolute Value of Sales Movement)
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                      <div className="p-2.5 bg-white border border-slate-200 rounded-xl">
                        <span className="text-[10px] text-slate-400 font-semibold block uppercase">Last 7 Days</span>
                        <span className="text-base font-extrabold text-blue-700">
                          {selectedProductPredictive.multiHorizon.sales7d} units
                        </span>
                        <span className="text-[10px] text-slate-500 block mt-0.5">
                          ~{selectedProductPredictive.velocity7d} / day
                        </span>
                      </div>

                      <div className="p-2.5 bg-white border border-slate-200 rounded-xl">
                        <span className="text-[10px] text-slate-400 font-semibold block uppercase">Last 14 Days</span>
                        <span className="text-base font-bold text-slate-800">
                          {selectedProductPredictive.multiHorizon.sales14d} units
                        </span>
                        <span className="text-[10px] text-slate-500 block mt-0.5">
                          ~{selectedProductPredictive.velocity14d} / day
                        </span>
                      </div>

                      <div className="p-2.5 bg-white border border-slate-200 rounded-xl">
                        <span className="text-[10px] text-slate-400 font-semibold block uppercase">Last 30 Days</span>
                        <span className="text-base font-bold text-slate-800">
                          {selectedProductPredictive.multiHorizon.sales30d} units
                        </span>
                        <span className="text-[10px] text-slate-500 block mt-0.5">
                          ~{selectedProductPredictive.velocity30d} / day
                        </span>
                      </div>

                      <div className="p-2.5 bg-white border border-slate-200 rounded-xl">
                        <span className="text-[10px] text-slate-400 font-semibold block uppercase">Last 60 Days</span>
                        <span className="text-base font-bold text-slate-800">
                          {selectedProductPredictive.multiHorizon.sales60d} units
                        </span>
                        <span className="text-[10px] text-slate-500 block mt-0.5">
                          ~{selectedProductPredictive.velocity60d} / day
                        </span>
                      </div>

                      <div className="p-2.5 bg-white border border-slate-200 rounded-xl col-span-2 sm:col-span-1">
                        <span className="text-[10px] text-slate-400 font-semibold block uppercase">Last 90 Days</span>
                        <span className="text-base font-bold text-slate-800">
                          {selectedProductPredictive.multiHorizon.sales90d} units
                        </span>
                        <span className="text-[10px] text-slate-500 block mt-0.5">
                          ~{selectedProductPredictive.velocity90d} / day
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Insufficient History Warning (if applicable) */}
                  {selectedProductPredictive.confidence === 'INSUFFICIENT_HISTORY' && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-900">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold block">Insufficient Sales History</span>
                        <p className="text-amber-800 text-[11px] mt-0.5">
                          No significant transaction history was recorded for this item. Suggested Minimum and Target remain at a lean trial baseline (1–2 units) without inventing artificial demand.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Demand-Derived Recommendations & Replenishment Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    {/* Card 1: Suggested Minimum */}
                    <div className="p-4 bg-white border border-blue-200 rounded-xl space-y-2 relative overflow-hidden">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 font-semibold text-[11px] uppercase">
                          Suggested Minimum
                        </span>
                        <span className="p-1 bg-blue-50 text-blue-700 rounded-md">
                          <Package className="w-3.5 h-3.5" />
                        </span>
                      </div>
                      <div>
                        <span className="text-2xl font-black text-blue-700">
                          {selectedProductPredictive.suggestedMin}
                        </span>
                        <span className="text-xs text-slate-500 ml-1.5 font-medium">units</span>
                      </div>
                      <div className="pt-2 border-t border-slate-100">
                        <span className="text-[11px] font-bold text-slate-700 block mb-0.5">Why this Minimum?</span>
                        <p className="text-[11px] text-slate-500 leading-snug">
                          {selectedProductPredictive.explanation.whyMinimum}
                        </p>
                      </div>
                    </div>

                    {/* Card 2: Suggested Target */}
                    <div className="p-4 bg-white border border-indigo-200 rounded-xl space-y-2 relative overflow-hidden">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 font-semibold text-[11px] uppercase">
                          Suggested Target
                        </span>
                        <span className="p-1 bg-indigo-50 text-indigo-700 rounded-md">
                          <TrendingUp className="w-3.5 h-3.5" />
                        </span>
                      </div>
                      <div>
                        <span className="text-2xl font-black text-indigo-700">
                          {selectedProductPredictive.suggestedTarget}
                        </span>
                        <span className="text-xs text-slate-500 ml-1.5 font-medium">units</span>
                      </div>
                      <div className="pt-2 border-t border-slate-100">
                        <span className="text-[11px] font-bold text-slate-700 block mb-0.5">Why this Target?</span>
                        <p className="text-[11px] text-slate-500 leading-snug">
                          {selectedProductPredictive.explanation.whyTarget}
                        </p>
                      </div>
                    </div>

                    {/* Card 3: Replenishment & Current Stock Position */}
                    <div className="p-4 bg-white border border-emerald-200 rounded-xl space-y-2 relative overflow-hidden">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 font-semibold text-[11px] uppercase">
                          Replenishment Gap
                        </span>
                        <span className="p-1 bg-emerald-50 text-emerald-700 rounded-md">
                          <Truck className="w-3.5 h-3.5" />
                        </span>
                      </div>
                      <div>
                        <span
                          className={`text-2xl font-black ${
                            selectedProductPredictive.replenishmentGap > 0 ? 'text-emerald-700' : 'text-slate-600'
                          }`}
                        >
                          {selectedProductPredictive.replenishmentGap > 0
                            ? `+${selectedProductPredictive.replenishmentGap}`
                            : '0'}
                        </span>
                        <span className="text-xs text-slate-500 ml-1.5 font-medium">
                          {selectedProductPredictive.replenishmentGap > 0 ? 'units required' : 'fully stocked'}
                        </span>
                      </div>
                      <div className="pt-2 border-t border-slate-100 text-[11px] space-y-0.5">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Current Stock:</span>
                          <span className="font-bold text-slate-800">{selectedProduct.currentStock} units</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Suggested Order:</span>
                          <span className="font-bold text-emerald-700">+{selectedProductPredictive.suggestedOrderQty} units</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Visual Stock Level Progress Meter */}
                  <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800">
                        Physical Stock Level vs Demand Targets
                      </span>
                      <span className="text-slate-500 text-[11px]">
                        {selectedProductPredictive.daysOfStockRemaining > 900
                          ? '90+ days of stock'
                          : `${selectedProductPredictive.daysOfStockRemaining} days of stock remaining`}
                      </span>
                    </div>

                    {/* Meter bar */}
                    <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex relative">
                      <div
                        className={`h-full transition-all ${
                          selectedProduct.currentStock <= 0
                            ? 'bg-rose-500 w-0'
                            : selectedProduct.currentStock < selectedProductPredictive.suggestedMin
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{
                          width: `${Math.min(
                            100,
                            Math.max(0, (selectedProduct.currentStock / Math.max(1, selectedProductPredictive.suggestedTarget)) * 100)
                          )}%`,
                        }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                      <span>0 (Out of Stock)</span>
                      <span className="font-semibold text-blue-700">
                        Min Threshold: {selectedProductPredictive.suggestedMin}
                      </span>
                      <span className="font-semibold text-indigo-700">
                        Target Buffer: {selectedProductPredictive.suggestedTarget}
                      </span>
                    </div>
                  </div>

                  {/* Expiry Overview for this product */}
                  <div className="p-3.5 bg-white border border-blue-100 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2.5">
                      <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                      <div>
                        <span className="font-bold text-slate-800 block">
                          Expiry Tracking:{' '}
                          {selectedProductExpirySummary?.nextExpiryDate
                            ? `Next expiry on ${selectedProductExpirySummary.nextExpiryDate} (${selectedProductExpirySummary.daysUntilNextExpiry} days)`
                            : 'No active expiry batches recorded'}
                        </span>
                        <span className="text-slate-500 text-[11px]">
                          {selectedProductExpirySummary?.activeBatchesCount || 0} active batches (
                          {selectedProductExpirySummary?.totalTrackedQty || 0} units tracked)
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setBatchManagerProduct(selectedProduct)}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 transition-colors self-end sm:self-auto"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Manage Batches
                    </button>
                  </div>
                </div>
              )}

              {/* Stock Movement Day Trend & Day-of-Week Analysis */}
              <div className="border border-slate-200 rounded-xl p-5 bg-white space-y-4 shadow-sm">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <BarChart2 className="w-4 h-4 text-blue-600" />
                      Stock Movement Day Trend
                    </h3>
                    <p className="text-xs text-slate-500">
                      Daily units sold & sales velocity by day of week
                    </p>
                  </div>

                  {/* Period Filter Selector */}
                  <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-lg text-xs font-semibold">
                    <button
                      onClick={() => handlePeriodChange('7days')}
                      className={`px-3 py-1 rounded transition-all ${
                        trendPeriod === '7days'
                          ? 'bg-white text-slate-900 shadow-sm font-bold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      7 Days
                    </button>
                    <button
                      onClick={() => handlePeriodChange('month')}
                      className={`px-3 py-1 rounded transition-all ${
                        trendPeriod === 'month'
                          ? 'bg-white text-slate-900 shadow-sm font-bold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      This Month
                    </button>
                    <button
                      onClick={() => handlePeriodChange('this_quarter')}
                      className={`px-3 py-1 rounded transition-all ${
                        trendPeriod === 'this_quarter'
                          ? 'bg-white text-slate-900 shadow-sm font-bold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      This Quarter
                    </button>
                    <button
                      onClick={() => handlePeriodChange('year')}
                      className={`px-3 py-1 rounded transition-all ${
                        trendPeriod === 'year'
                          ? 'bg-white text-slate-900 shadow-sm font-bold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Year
                    </button>
                  </div>
                </div>

                {loadingDetails || !productDetails ? (
                  <div className="h-52 flex items-center justify-center text-slate-400 text-xs">
                    <RefreshCw className="w-5 h-5 animate-spin mr-2 text-blue-600" />
                    Loading stock movement day trend graph...
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Key Period Metrics & Peak Sales Day Banner */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                      <div>
                        <span className="text-slate-500 block">Total Sold</span>
                        <span className="text-base font-extrabold text-blue-700">
                          {productDetails.totalQtySoldPeriod || 0} units
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Total Revenue</span>
                        <span className="text-base font-bold text-slate-800">
                          ${(productDetails.totalRevenuePeriod || 0).toFixed(2)}
                        </span>
                      </div>
                      <div className="bg-amber-50 border border-amber-200 p-2 rounded-md flex items-center gap-2.5">
                        <div className="p-1.5 bg-amber-500 text-white rounded-md">
                          <TrendingUp className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-amber-900 font-bold block text-[11px]">
                            Peak Day: {productDetails.peakDay?.dayName || 'Friday'}
                          </span>
                          <span className="text-amber-700 text-[11px]">
                            {productDetails.peakDay?.totalQtySold || 0} units ({productDetails.peakDay?.percentage || 0}% of period)
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Stock Movement Daily Trend Bar Chart */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                        <span>Daily Sales Volume Trend</span>
                        <span className="text-slate-400 font-normal">X-Axis: Date / Day | Y-Axis: Units Sold</span>
                      </div>
                      <div className="h-48 w-full pt-2">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={productDetails.dailyTrend || productDetails.salesHistory?.weekly || []}
                            margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis
                              dataKey="dayName"
                              tick={{ fontSize: 10, fill: '#64748b' }}
                              tickLine={false}
                            />
                            <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} />
                            <Tooltip
                              contentStyle={{ backgroundColor: '#1e293b', borderRadius: '8px', border: 'none', color: '#fff', fontSize: '12px' }}
                              formatter={(val: any, name: any) => [
                                `${val} ${name === 'qtySold' ? 'units sold' : '$ revenue'}`,
                                name === 'qtySold' ? 'Units Sold' : 'Revenue'
                              ]}
                            />
                            <Bar dataKey="qtySold" fill="#2563eb" radius={[4, 4, 0, 0]} name="qtySold" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Stock Movement Audit Log List */}
              <div className="border border-slate-200 rounded-xl p-5 bg-white space-y-3">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-600" />
                  Stock Movement Log (Audit Trail)
                </h3>

                {loadingDetails || !productDetails ? (
                  <div className="p-6 text-center text-slate-400 text-xs">Loading audit log...</div>
                ) : (
                  <div className="overflow-x-auto border border-slate-200 rounded-lg">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3">Date & Time</th>
                          <th className="py-2.5 px-3">Transaction Type</th>
                          <th className="py-2.5 px-3 text-right">Qty Change</th>
                          <th className="py-2.5 px-3 text-right">Balance After</th>
                          <th className="py-2.5 px-3">Reference / Doc</th>
                          <th className="py-2.5 px-3">User</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {(productDetails?.movements || []).map((m) => (
                          <tr key={m.id} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3 font-mono text-slate-500">{m.dateTime}</td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                                  m.type === 'Sale'
                                    ? 'bg-blue-50 text-blue-700'
                                    : m.type === 'Goods Received'
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : 'bg-amber-50 text-amber-700'
                                }`}
                              >
                                {m.type}
                              </span>
                            </td>
                            <td
                              className={`py-2.5 px-3 text-right font-bold ${
                                m.changeQty < 0 ? 'text-red-600' : 'text-emerald-600'
                              }`}
                            >
                              {m.changeQty > 0 ? `+${m.changeQty}` : m.changeQty}
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                              {m.balanceAfter}
                            </td>
                            <td className="py-2.5 px-3 text-slate-500">{m.reference}</td>
                            <td className="py-2.5 px-3 text-slate-500">{m.user}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => {
                  setSelectedProduct(null);
                  setProductDetails(null);
                }}
                className="px-4 py-2 bg-slate-800 text-white rounded-lg text-xs font-semibold hover:bg-slate-900 transition-colors"
              >
                Close Product Window
              </button>
            </div>
          </div>
        </div>
      )}
        </>
      )}

      {/* Stock Order Assistant Modal */}
      <StockOrderAssistantModal
        isOpen={isStockOrderAssistantOpen}
        onClose={() => setIsStockOrderAssistantOpen(false)}
        inventoryProducts={items}
        currentUser={currentUser}
      />

      {/* Universal Camera Barcode Scanner Modal */}
      <UniversalBarcodeScannerModal
        isOpen={isBarcodeScannerOpen}
        onClose={() => setIsBarcodeScannerOpen(false)}
        inventoryProducts={items}
        onScan={(barcode, matchedProduct) => {
          if (matchedProduct) {
            setSelectedProduct(matchedProduct);
            fetchProductDetails(Number(matchedProduct.productId));
            setSearchQuery(matchedProduct.scanCode || matchedProduct.itemCode || barcode);
          } else {
            setSearchQuery(barcode);
          }
        }}
      />

      {/* Expiry Batch Manager Modal */}
      <ExpiryBatchManagerModal
        isOpen={!!batchManagerProduct}
        onClose={() => setBatchManagerProduct(null)}
        product={batchManagerProduct}
        batches={expiryBatches}
        onBatchUpdated={() => fetchExpiryBatches()}
      />

      {/* Floating Go To Top Button */}
      {showScrollTop && (
        <button
          type="button"
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 z-40 p-3 bg-slate-900 hover:bg-slate-800 text-white rounded-full shadow-2xl transition-all border border-slate-700 hover:scale-105 active:scale-95 flex items-center gap-2 text-xs font-bold px-4"
          title="Scroll back to top"
        >
          <ArrowUp className="w-4 h-4 text-blue-400" />
          <span>Go to Top</span>
        </button>
      )}
    </div>
  );
};
