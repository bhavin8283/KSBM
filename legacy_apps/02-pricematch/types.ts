export type ProductType = 'Cigarettes' | 'Tobacco Pouch (RYO)' | 'Other';

export interface ProductItem {
  id: string;
  gtin: string;
  product_name: string;
  brand?: string;
  product_type?: ProductType;
  master_pack_size?: string; // e.g. "10 Packs", "5 Pouches", "20 Packs", "Single"
  retail_code: string;
  trax_code: string;
  campbells_code: string;
  onedistribution_code: string;
  in_store: boolean;
  trax_price: number;
  campbells_price: number;
  onedistribution_price: number;
}

export interface MarkupTiers {
  tier1: number; // default 15%
  tier2: number; // default 12%
  tier3: number; // default 10%
  round_tier1?: boolean;
  round_tier2?: boolean;
  round_tier3?: boolean;
}

export type CategoryFilter = 'all' | 'cigarettes' | 'ryo' | 'other';

export type ViewMode = 'table' | 'card';

export type ActiveSection = 'dashboard' | 'settings';

export interface SupplierRank {
  name: 'Trax' | 'Campbells' | 'One Distribution';
  code: string;
  price: number;
  rank: 'lowest' | 'middle' | 'highest'; // green | blue | red
}

export interface CalculatedProduct extends ProductItem {
  brand: string;
  product_type: ProductType;
  master_pack_size: string;
  highest_cost: number;
  lowest_cost: number;
  spread: number;
  spread_percent: number;
  cheapest_supplier: string;
  highest_supplier: string;
  retail_tier1: number;
  retail_tier2: number;
  retail_tier3: number;
  suppliers: SupplierRank[];
  category: 'Cigarettes' | 'RYO / Tobacco' | 'Other';
}

export type ScraperEngine =
  | 'Playwright (Stealth)'
  | 'Requests / HTTP Session'
  | 'Scrapy Headless'
  | 'Selenium Chrome';

export interface SupplierSelectorConfig {
  cardSelector: string;
  priceSelector: string;
  skuSelector: string;
  stockSelector?: string;
  paginationSelector?: string;
  ageGateSelector?: string;
}

export interface SupplierCredentialsConfig {
  accountNumber?: string;
  usernameEnvKey: string;
  passwordEnvKey: string;
  pinOrTokenKey?: string;
}

export interface SupplierSpecialHandling {
  ageGateBypass: boolean;
  stealthMode: boolean;
  sessionCookiesPersist: boolean;
  rateLimitDelayMs: number;
}

export interface SupplierTestResult {
  status: 'success' | 'failed' | 'warning';
  timestamp: string;
  latencyMs: number;
  itemsExtracted: number;
  message: string;
}

export interface SupplierConfig {
  id: string;
  name: string;
  codePrefix: string;
  portalUrl: string;
  loginUrl: string;
  status: 'active' | 'inactive' | 'testing' | 'maintenance';
  engine: ScraperEngine;
  schedule: string;
  credentials: SupplierCredentialsConfig;
  selectors: SupplierSelectorConfig;
  specialHandling: SupplierSpecialHandling;
  lastScraped?: string;
  lastTestResult?: SupplierTestResult;
}

export interface ScraperLogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'success' | 'warn' | 'error' | 'auth' | 'extract';
  text: string;
  detail?: string;
}

export interface SupplierTestSimulation {
  supplierId: string;
  isRunning: boolean;
  logs: ScraperLogEntry[];
  result?: {
    success: boolean;
    latencyMs: number;
    itemsFound: number;
    statusCode: number;
    message: string;
    samplePayload?: Array<{
      gtin: string;
      sku: string;
      product_name: string;
      extracted_price: number;
      stock_status: string;
    }>;
  };
}

// ============================================================================
// KSBM (Kwik Stop Business Manager) Shell Integration Contracts
// ============================================================================

export type WholesalePermission =
  | 'wholesale.view'
  | 'wholesale.scrape'
  | 'wholesale.catalog.edit'
  | 'wholesale.catalog.delete'
  | 'wholesale.markups.edit'
  | 'wholesale.brands.manage'
  | 'wholesale.suppliers.manage'
  | 'wholesale.export';

export interface KsbmCurrentUser {
  id: string;
  name: string;
  role: 'master_admin' | 'admin' | 'manager' | 'supervisor' | 'staff' | 'cashier' | string;
  permissions?: string[];
}

export interface KsbmBusinessConfig {
  storeId?: string;
  storeName?: string;
  currencySymbol?: string;
  defaultThemeId?: 'slate' | 'navy' | 'emerald' | 'warm' | 'bordeaux';
  defaultMarkupTiers?: Partial<MarkupTiers>;
  highSpreadAlertThreshold?: number;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
}

export interface KsbmModuleProps {
  currentUser: KsbmCurrentUser;
  businessConfig?: KsbmBusinessConfig;
}

export interface WholesaleDashboardSummary {
  activeCatalogCount: number;
  totalCatalogCount: number;
  averageSpread: number;
  maxSavingsOpportunity: {
    amount: number;
    productName: string;
    cheapestSupplier: string;
  } | null;
  topCostLeader: {
    supplierName: string;
    bestQuoteCount: number;
  };
  highSpreadAlertCount: number;
  lastScrapedTime: string;
}
