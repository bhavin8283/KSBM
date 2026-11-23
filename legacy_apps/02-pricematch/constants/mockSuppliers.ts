import { SupplierConfig, ScraperLogEntry } from '../types';

export const INITIAL_SUPPLIERS: SupplierConfig[] = [
  {
    id: 'supplier-trax',
    name: 'Trax Distribution',
    codePrefix: 'TRX',
    portalUrl: 'https://ordering.traxdistribution.com.au',
    loginUrl: 'https://ordering.traxdistribution.com.au/customer/account/login',
    status: 'active',
    engine: 'Playwright (Stealth)',
    schedule: 'Daily at 05:30 AM AEST',
    credentials: {
      accountNumber: 'TRX-CUST-88412',
      usernameEnvKey: 'TRAX_PORTAL_USER',
      passwordEnvKey: 'TRAX_PORTAL_PASS',
      pinOrTokenKey: '',
    },
    selectors: {
      cardSelector: 'div.product-item-info, .product-grid-card',
      priceSelector: 'span.special-price span.price, span.price-wrapper span.price',
      skuSelector: 'div.product-item-details span.sku, .product-code',
      stockSelector: 'div.stock.available, .badge-in-stock',
      paginationSelector: 'a.action.next, li.pages-item-next a',
      ageGateSelector: '',
    },
    specialHandling: {
      ageGateBypass: false,
      stealthMode: true,
      sessionCookiesPersist: true,
      rateLimitDelayMs: 850,
    },
    lastScraped: 'Today at 05:42 AM',
    lastTestResult: {
      status: 'success',
      timestamp: 'Today at 05:42 AM',
      latencyMs: 184,
      itemsExtracted: 18,
      message: 'All 18 SKU price points extracted cleanly. Zero selector mismatches.',
    },
  },
  {
    id: 'supplier-campbells',
    name: 'Campbells Wholesale',
    codePrefix: 'CMP',
    portalUrl: 'https://www.campbells.com.au/b2b',
    loginUrl: 'https://www.campbells.com.au/b2b/account/login',
    status: 'active',
    engine: 'Playwright (Stealth)',
    schedule: 'Daily at 06:00 AM AEST',
    credentials: {
      accountNumber: 'CMP-ACT-49201',
      usernameEnvKey: 'CAMPBELLS_PORTAL_USER',
      passwordEnvKey: 'CAMPBELLS_PORTAL_PASS',
      pinOrTokenKey: 'CAMPBELLS_CUSTOMER_NO',
    },
    selectors: {
      cardSelector: 'table.product-list-table tr.product-row, div.catalog-product-card',
      priceSelector: 'span.contract-price, span.price-ex-gst, .tier-cost',
      skuSelector: 'td.sku-code, span.product-sku, .sku-number',
      stockSelector: 'span.in-stock-badge, span.badge-success',
      paginationSelector: 'ul.pagination li.page-item.next:not(.disabled) a',
      ageGateSelector: '',
    },
    specialHandling: {
      ageGateBypass: false,
      stealthMode: true,
      sessionCookiesPersist: true,
      rateLimitDelayMs: 1200,
    },
    lastScraped: 'Today at 06:12 AM',
    lastTestResult: {
      status: 'success',
      timestamp: 'Today at 06:12 AM',
      latencyMs: 210,
      itemsExtracted: 18,
      message: 'Pagination traversal validated across 2 pages. 18 items successfully mapped.',
    },
  },
  {
    id: 'supplier-onedistribution',
    name: 'One Distribution',
    codePrefix: 'OND',
    portalUrl: 'https://ordering.onedistribution.com.au',
    loginUrl: 'https://ordering.onedistribution.com.au/auth/signin',
    status: 'active',
    engine: 'Playwright (Stealth)',
    schedule: 'Daily at 06:30 AM AEST',
    credentials: {
      accountNumber: 'OND-STORE-7730',
      usernameEnvKey: 'ONE_DIST_CLIENT_USER',
      passwordEnvKey: 'ONE_DIST_CLIENT_PASS',
      pinOrTokenKey: 'ONE_DIST_PORTAL_PIN',
    },
    selectors: {
      cardSelector: 'div.wholesale-product-card, div.product-catalog-item',
      priceSelector: 'div.wholesale-price-box span.wholesale-amount, .current-price',
      skuSelector: 'span.supplier-product-code, [data-field="sku"]',
      stockSelector: 'span.stock-indicator.in-stock',
      paginationSelector: 'button[data-action="load-more-items"], .next-page',
      ageGateSelector: '#age-verification-modal button.confirm-18-plus, .btn-age-verify',
    },
    specialHandling: {
      ageGateBypass: true,
      stealthMode: true,
      sessionCookiesPersist: true,
      rateLimitDelayMs: 1000,
    },
    lastScraped: 'Today at 06:45 AM',
    lastTestResult: {
      status: 'success',
      timestamp: 'Today at 06:45 AM',
      latencyMs: 195,
      itemsExtracted: 18,
      message: 'Age-gate bypassed via cookie persistence. 18 items extracted with valid timestamps.',
    },
  },
];

export function buildTestSimulationSteps(
  supplier: SupplierConfig,
  simulateError = false
): Array<{
  delayMs: number;
  entry: Omit<ScraperLogEntry, 'id'>;
}> {
  const now = () => new Date().toLocaleTimeString('en-AU', { hour12: false });
  const hasAgeGate = supplier.specialHandling.ageGateBypass || Boolean(supplier.selectors.ageGateSelector);

  const steps: Array<{ delayMs: number; entry: Omit<ScraperLogEntry, 'id'> }> = [
    {
      delayMs: 150,
      entry: {
        timestamp: now(),
        level: 'info',
        text: `[INIT] Initializing Scraper Engine [${supplier.engine}] for ${supplier.name}...`,
        detail: `Stealth: ${supplier.specialHandling.stealthMode ? 'ENABLED' : 'DISABLED'} | Rate Delay: ${supplier.specialHandling.rateLimitDelayMs}ms`,
      },
    },
    {
      delayMs: 400,
      entry: {
        timestamp: now(),
        level: 'info',
        text: `[NETWORK] Resolving DNS & SSL handshake for ${supplier.loginUrl}...`,
        detail: 'Cipher suite: TLS_AES_256_GCM_SHA384 | Host reachable (HTTP 200)',
      },
    },
    {
      delayMs: 700,
      entry: {
        timestamp: now(),
        level: 'auth',
        text: '[VAULT] Resolving credentials from secure environment keys...',
        detail: `Account: ${supplier.credentials.accountNumber || 'Default'} | User Key: \${${supplier.credentials.usernameEnvKey}} | Pass Key: \${${supplier.credentials.passwordEnvKey}}`,
      },
    },
  ];

  if (hasAgeGate) {
    steps.push({
      delayMs: 1000,
      entry: {
        timestamp: now(),
        level: 'info',
        text: '[AGE-GATE] Intercepting tobacco age-verification barrier...',
        detail: supplier.selectors.ageGateSelector
          ? `Clicking age verification modal: "${supplier.selectors.ageGateSelector}"`
          : 'Injecting age verification cookie session: age_verified=18; Secure',
      },
    });
  }

  if (simulateError) {
    steps.push({
      delayMs: 1300,
      entry: {
        timestamp: now(),
        level: 'error',
        text: `[AUTH-FAIL] Authentication rejected: HTTP 401 Unauthorized for ${supplier.name}`,
        detail: 'Check usernameEnvKey / passwordEnvKey or rotate account credentials.',
      },
    });
    return steps;
  }

  steps.push(
    {
      delayMs: 1100,
      entry: {
        timestamp: now(),
        level: 'auth',
        text: '[AUTH-OK] Authentication successful! Session established with portal.',
        detail: 'Cookies encrypted & persisted into session vault.',
      },
    },
    {
      delayMs: 1450,
      entry: {
        timestamp: now(),
        level: 'extract',
        text: '[DOM-QUERY] Inspecting DOM elements with configured CSS selectors...',
        detail: `Card: "${supplier.selectors.cardSelector}" | Price: "${supplier.selectors.priceSelector}" | SKU: "${supplier.selectors.skuSelector}"`,
      },
    },
    {
      delayMs: 1800,
      entry: {
        timestamp: now(),
        level: 'extract',
        text: '[PARSER] Extracted 18 product quotes matching active wholesale GTIN catalog.',
        detail: 'Sample parsed: CHESTERFIELD 20/200 BLUE -> Price: $43.50 | Stock: In-Stock',
      },
    },
    {
      delayMs: 2150,
      entry: {
        timestamp: now(),
        level: 'success',
        text: `[HEALTH-CHECK PASSED] Connection & scraper validation finished successfully in ${supplier.lastTestResult?.latencyMs || 192}ms.`,
        detail: 'All wholesale cost extraction tests returned valid numerical prices. Status: READY',
      },
    }
  );

  return steps;
}

export function getSampleExtractedPayload(supplierName: string) {
  return [
    {
      gtin: '9310704929271',
      sku: supplierName.includes('Trax') ? 'TRX-4491' : supplierName.includes('Campbells') ? 'CMP-8812' : 'OND-1029',
      product_name: 'CHESTERFIELD 20/200 ORIGINAL BLUE',
      extracted_price: supplierName.includes('Trax') ? 43.50 : supplierName.includes('Campbells') ? 45.20 : 42.10,
      stock_status: 'In Stock (Warehouse A)',
    },
    {
      gtin: '9311492003810',
      sku: supplierName.includes('Trax') ? 'TRX-5120' : supplierName.includes('Campbells') ? 'CMP-7201' : 'OND-2341',
      product_name: 'WINFIELD BLUE 20S CIGARETTES',
      extracted_price: supplierName.includes('Trax') ? 48.90 : supplierName.includes('Campbells') ? 47.50 : 49.80,
      stock_status: 'In Stock (Warehouse B)',
    },
    {
      gtin: '9300612042008',
      sku: supplierName.includes('Trax') ? 'TRX-8820' : supplierName.includes('Campbells') ? 'CMP-9011' : 'OND-5510',
      product_name: 'MARLBORO RED 20S PACK',
      extracted_price: supplierName.includes('Trax') ? 54.80 : supplierName.includes('Campbells') ? 56.20 : 53.95,
      stock_status: 'In Stock (Main Depo)',
    },
    {
      gtin: '9311492003902',
      sku: supplierName.includes('Trax') ? 'TRX-5130' : supplierName.includes('Campbells') ? 'CMP-7230' : 'OND-2330',
      product_name: 'WINFIELD BLUE RYO 30G POUCH',
      extracted_price: supplierName.includes('Trax') ? 94.80 : supplierName.includes('Campbells') ? 93.10 : 96.50,
      stock_status: 'In Stock (Express Stock)',
    },
  ];
}
