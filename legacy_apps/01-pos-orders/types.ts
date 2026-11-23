import type { CashVarianceThresholds, CashVarianceTierConfig } from './varianceUtils';
export type { CashVarianceThresholds, CashVarianceTierConfig };

export interface ConnectionStatus {
  connected: boolean;
  isDemoMode?: boolean;
  server: string | null;
  database: string | null;
  error?: string;
}

export interface DashboardStats {
  tables: number;
  products: number;
  sales: number;
  suppliers: number;
}

export interface DeliverySchedule {
  cutOffDay: string;
  cutOffTime: string;
  deliveryDay: string;
  departments?: string[];
  storeId?: string; // 'all' or specific store ID
  storeIds?: string[]; // list of store IDs
  storeName?: string;
}

export interface SupplierConfig {
  schedules: DeliverySchedule[];
  safetyMultiplier: number;
  storeConfigs?: Record<string, { schedules: DeliverySchedule[]; safetyMultiplier: number }>;
}

export interface SupplierConfigMap {
  [supplierId: string]: SupplierConfig;
}

export interface Supplier {
  SupplierID: string;
  SupplierName: string;
  SupplierCode?: string;
  Phone?: string;
  Email?: string;
}

export interface SupplierProduct {
  productId: number | string;
  stockCode?: string;
  description: string;
  barcode?: string;
  department?: string;
  cost?: number;
  currentStock?: number;
  minimumStock?: number;
  starred?: boolean;
  photoUrl?: string;
  minPackQty?: number | string;
  shelfLifeDays?: number | string;
}

export interface OrderRecommendation {
  productId: number | string;
  stockCode?: string;
  description: string;
  barcode?: string;
  department?: string;
  cost?: number;
  currentStock: number;
  minimumStock: number;
  salesLastWeek: number;
  avgSalesWeekly: number;
  avgSalesForCoverage: number;
  recommendedQty: number;
  reason: string;
  starred?: boolean;
  photoUrl?: string;
  minPackQty?: number | string;
  shelfLifeDays?: number | string;
}

/* ==========================================================================
   POS SPECIFIC TYPES (Dashboard, Inventory, Reports, Theme)
   ========================================================================== */

export interface HourlySalesPoint {
  hour: string;
  todaySales: number;
  lastWeekSales: number;
  todayCustomers: number;
  lastWeekCustomers: number;
}

export interface SalesBreakdownItem {
  name: string;
  amount: number;
  percentage: number;
  quantityOrTxn: number;
}

export interface POSDashboardData {
  // Tile 1: Current Session
  sessionSales: number;
  sessionSalesLastWeekSameTime: number;
  sessionSalesLastWeekSameDayTotal: number;
  sessionCustomers: number;
  sessionCustomersLastWeekSameTime: number;
  sessionCustomersLastWeekSameDayTotal: number;

  // Tile 2: Week to Date (WTD)
  wtdSales: number;
  wtdSalesLastWeekSameTime: number;
  wtdSalesLastWeekTotal: number;
  wtdCustomers: number;
  wtdCustomersLastWeekSameTime: number;
  wtdCustomersLastWeekTotal: number;

  // Tile 3: Month to Date (MTD)
  mtdSales: number;
  mtdSalesLastMonthSameTime: number;
  mtdSalesLastMonthTotal: number;
  mtdCustomers: number;
  mtdCustomersLastMonthSameTime: number;
  mtdCustomersLastMonthTotal: number;

  // Additional Summary Metrics
  todaySales: number;
  currentSales: number;
  lastWeekSameTimeSales: number;
  totalSales: number;
  lastMonthSameTimeSales: number;
  totalMonthSales: number;
  customerCount: number;
  lastWeekCustomerCount: number;
  avgBasketValue: number;

  hourlyTrend: HourlySalesPoint[];
  departmentSales: SalesBreakdownItem[];
  categorySales: SalesBreakdownItem[];
  tenderSales: SalesBreakdownItem[];
}

export interface InventoryItem {
  productId: number;
  itemCode: string;
  scanCode: string;
  longDescription: string;
  departmentName: string;
  departmentCode: number;
  sellingPrice: number;
  costPrice: number;
  currentStock: number;
  minimumStock: number;
  photoUrl?: string;
  barcodes?: string[];
  isDiscontinued?: boolean;
  suggestedMin?: number;
  suggestedTarget?: number;
  suggestedOrder?: number;
  avgDailySales?: number;
  salesVelocityStatus?: string;
  confidence?: string;
  nextExpiryDate?: string | null;
  daysUntilExpiry?: number | null;
  expiryWarningStatus?: string | null;
  trackedExpiryQty?: number;
  activeBatchesCount?: number;
  supplierName?: string;
  supplierId?: string | number | null;
  supplierCode?: string;
}

export interface StockMovement {
  id: string;
  dateTime: string;
  type: 'Sale' | 'Goods Received' | 'Adjustment' | 'Stock Return' | 'Transfer';
  changeQty: number;
  balanceAfter: number;
  reference: string;
  user: string;
}

export interface SalesHistoryPoint {
  period: string;
  qtySold: number;
  revenue: number;
}

export interface ProductSalesHistory {
  weekly: SalesHistoryPoint[];
  monthly: SalesHistoryPoint[];
  yearly: SalesHistoryPoint[];
}

export interface ReportSummaryKpi {
  label: string;
  value: string | number;
  subtext?: string;
}

export interface SalesBifurcationData {
  totalPeriodGross: number;
  netSalesExGst: number;
  gstCollected: number;
  taxableGross: number;
  taxableNet: number;
  gstFreeGross: number;
  taxableSharePercent: number;
  gstFreeSharePercent: number;
  topGstFree: Array<{ description: string; qty: number; amount: number }>;
  topTaxable: Array<{ description: string; qty: number; amount: number; gst?: number }>;
  tenders: Array<{ tenderCode: string; tenderName: string; txnCount: number; totalAmount: number }>;
}

export interface ClerkPerformanceData {
  totalRevenue: number;
  totalTransactions: number;
  totalItems: number;
  clerks: Array<Record<string, any>>;
}

export interface POSReport {
  id: string;
  title: string;
  category: string;
  periodText: string;
  generatedAt: string;
  kpis: ReportSummaryKpi[];
  chartData: Array<{ label: string; value: number; secondary?: number }>;
  chartType: 'bar' | 'line' | 'pie';
  tableHeaders: string[];
  tableRows: Array<Record<string, string | number>>;
  bifurcation?: SalesBifurcationData;
  clerkData?: ClerkPerformanceData;
  selectedWasteCategory?: string;
  selectedWasteCategoryName?: string;
  claimGrouped?: Array<{
    barcode: string;
    productName: string;
    stockCode: string;
    department: string;
    category: string;
    quantity: number;
    unitCost: string;
    totalClaim: string;
    dates: string;
  }>;
}

export type AppTheme = 'blue' | 'emerald' | 'midnight' | 'amber' | 'slate';

/* ==========================================================================
   SAVED DRAFT ORDERS & SALES HISTORY TYPES
   ========================================================================== */

export interface SavedDraftItem {
  productId: number;
  stockCode: string;
  barcode: string;
  description: string;
  departmentName: string;
  cost: number;
  manualStock: number | string;
  dbStock: number;
  orderQty: number;
  recommendedQty: number | null;
  photoUrl: string | null;
  reason?: string;
  minPackQty?: number;
  shelfLifeDays?: number;
}

export interface SavedDraftOrder {
  id: string;
  supplierId: string;
  supplierName: string;
  scheduleLabel: string;
  scheduleIndex: number;
  savedAt: string;
  status: 'Draft' | 'Generated' | 'Completed';
  items: SavedDraftItem[];
  totalLines: number;
  totalUnits: number;
  totalCost: number;
}

export interface SalesTransactionItem {
  stockCode: string;
  barcode: string;
  description: string;
  qty: number;
  unitPrice: number;
  discount: number;
  lineTotal: number;
  isVoided?: boolean;
  promotionName?: string;
  promotionId?: string | number;
  originalPrice?: number;
}

export interface SalesTransaction {
  id?: string;
  receiptNo: string;
  dateTime: string;
  cashier: string;
  clerkName?: string;
  clerkId?: string | number;
  terminal?: string;
  tenderType: 'Cash' | 'EFTPOS' | 'Credit Card' | 'Amex' | 'Split' | string;
  subtotal: number;
  discount: number;
  gst: number;
  total: number;
  tendered: number;
  change: number;
  items: SalesTransactionItem[];
  isVoidSale?: boolean;
  hasVoidProducts?: boolean;
  hasDiscount?: boolean;
  isFloatEntry?: boolean;
  appliedPromotions?: string[];
  status?: 'Completed' | 'Void' | 'Refunded' | 'Float Entry' | string;
}

export interface TodaySalesHistoryResponse {
  summary: {
    totalSales: number;
    totalTransactions: number;
    totalItems: number;
    avgTicket: number;
    gstTotal: number;
    totalFloats?: number;
    totalFloatAmount?: number;
    totalVoidSales?: number;
    totalVoidItems?: number;
    totalDiscounts?: number;
  };
  storeInfo: {
    name: string;
    address: string;
    phone: string;
    abn: string;
    terminal: string;
    receiptHeader?: string;
    receiptFooter?: string;
  };
  transactions: SalesTransaction[];
  isLive?: boolean;
  activeDate?: string;
  latestAvailableDate?: string;
}

/* ==========================================================================
   STAFF MANAGEMENT, MULTI-STORE & PERMISSIONS TYPES
   ========================================================================== */

export interface StoreCloudflareConfig {
  tunnelHostname: string;
  tunnelToken?: string;
  tunnelId?: string;
  localPort: number;
  protocol?: 'tcp' | 'http' | 'https' | 'ssh' | string;
  originTarget?: string; // e.g. tcp://127.0.0.1:1433
  status?: 'Connected' | 'Active' | 'Standby' | 'Offline';
  lastPing?: string;
  latencyMs?: number;
  autoReconnect?: boolean;
}

export interface StoreSqlConfig {
  server: string;
  port: number;
  database: string;
  user: string;
  password?: string;
  authType?: 'sql' | 'windows';
  encrypt?: boolean;
  trustServerCertificate?: boolean;
}

export interface StoreLocation {
  id: string;
  code: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  postcode?: string;
  phone?: string;
  email?: string;
  managerName?: string;
  operatingHours?: string;
  storeType?: 'Flagship' | 'Standard' | 'Express' | 'Drive-Thru' | 'Fuel & Retail' | string;
  posTerminalCount?: number;
  taxRate?: number;
  notes?: string;
  themeColor?: 'blue' | 'emerald' | 'purple' | 'amber' | 'rose' | 'indigo' | string;
  isActive: boolean;
  isDefault?: boolean;
  receiptHeader?: string;
  receiptFooter?: string;
  timeZone?: string;
  dateFormat?: DateFormat;
  timeFormat?: TimeFormat;
  cloudflared: StoreCloudflareConfig;
  sql: StoreSqlConfig;
  assignedUserIds?: string[]; // user IDs or ['all']
  cashVarianceThresholds?: CashVarianceThresholds;
  createdAt?: string;
  updatedAt?: string;
}

export type NavigationTab =
  | 'dashboard'
  | 'inventory'
  | 'orders'
  | 'sales'
  | 'reports'
  | 'explorer'
  | 'stores'
  | 'settings';

export type SettingsSubTab =
  | 'stores'
  | 'server'
  | 'cloudflared'
  | 'departments'
  | 'suppliers'
  | 'appearance'
  | 'regional';

export type UserRole = 'admin' | 'manager' | 'cashier' | 'stock_clerk' | 'supervisor' | 'staff';

export interface UserPermissions {
  canViewCostPrices: boolean;
  canEditInventory: boolean;
  canCreateOrders: boolean;
  canViewFinancialRevenue: boolean;
  canManageUsers: boolean;
}

export type DateFormat = 'DD-MM-YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD' | 'MM/DD/YYYY' | 'D MMM YYYY';
export type TimeFormat = '12h' | '24h';

export interface RegionalSettings {
  dateFormat: DateFormat;
  timeFormat: TimeFormat;
  timeZone: string;
  timeZoneLabel: string;
}

export interface DepartmentFlagSetting {
  departmentCode?: string | number;
  departmentName: string;
  isCore: boolean;
  isGeneral: boolean;
}

export interface StaffUser {
  id: string;
  name: string;
  role: UserRole;
  allowedTabs?: NavigationTab[];
  allowedSettings?: SettingsSubTab[];
  allowedStoreIds?: string[]; // ['all'] or specific store IDs
  permissions?: UserPermissions;
  department?: string;
  email?: string;
  isActive: boolean;
}

export interface CurrentUserSession {
  id: string;
  name: string;
  role: UserRole;
  allowedTabs: NavigationTab[];
  allowedSettings: SettingsSubTab[];
  allowedStoreIds?: string[];
  permissions?: UserPermissions;
  department?: string;
}

/* ==========================================================================
   KSBM MASTER SHELL INTEGRATION CONTRACTS
   ========================================================================== */

export interface KSBMCurrentUser {
  id: string;
  name: string;
  username?: string;
  email?: string;
  role: UserRole;
  allowedTabs?: NavigationTab[];
  allowedSettings?: SettingsSubTab[];
  allowedStoreIds?: string[];
  permissions?: Partial<UserPermissions>;
  department?: string;
}

export interface KSBMBusinessConfig {
  storeId?: string;
  storeName?: string;
  storeCode?: string;
  abn?: string;
  address?: string;
  phone?: string;
  email?: string;
  currency?: string;
  timezone?: string;
  dateFormat?: DateFormat;
  timeFormat?: TimeFormat;
  theme?: AppTheme;
  apiBaseUrl?: string;
  cashVarianceThresholds?: CashVarianceThresholds;
  features?: {
    enableAIChatAssistant?: boolean;
    enableDatabaseExplorer?: boolean;
    enableMultiStoreComparison?: boolean;
  };
}

export interface ModuleEntryProps {
  currentUser: KSBMCurrentUser;
  businessConfig: KSBMBusinessConfig;
  activeSection?: NavigationTab;
  onSectionChange?: (section: NavigationTab) => void;
  hideSubNav?: boolean;
}

export interface ModuleDashboardMetrics {
  todaySalesGross: number;
  todayTransactions: number;
  expiringSoonCount: number;
  expiredBatchesCount: number;
  sqlConnected: boolean;
}


