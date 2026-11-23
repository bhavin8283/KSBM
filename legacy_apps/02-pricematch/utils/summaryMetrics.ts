import { CalculatedProduct, MarkupTiers, ProductItem, WholesaleDashboardSummary } from '../types';
import { INITIAL_MARKUP_TIERS, INITIAL_PRODUCTS } from '../constants/mockData';
import { calculateProductDetails, getBrand } from './pricing';

/**
 * Computes live KPI summary metrics for the KSBM Master Dashboard Home screen
 * directly from persisted store state (or provided catalog arrays).
 */
export function getWholesaleDashboardSummary(options?: {
  products?: ProductItem[];
  markupTiers?: MarkupTiers;
  hiddenBrands?: string[];
  highSpreadThreshold?: number;
}): WholesaleDashboardSummary {
  let products = options?.products;
  let markupTiers = options?.markupTiers;
  let hiddenBrands = options?.hiddenBrands;
  const threshold = options?.highSpreadThreshold ?? 2.5;

  if (!products) {
    try {
      const saved = localStorage.getItem('kwik_stop_products');
      products = saved ? JSON.parse(saved) : INITIAL_PRODUCTS;
    } catch {
      products = INITIAL_PRODUCTS;
    }
  }

  if (!markupTiers) {
    try {
      const saved = localStorage.getItem('kwik_stop_tiers');
      markupTiers = saved ? { ...INITIAL_MARKUP_TIERS, ...JSON.parse(saved) } : INITIAL_MARKUP_TIERS;
    } catch {
      markupTiers = INITIAL_MARKUP_TIERS;
    }
  }

  if (!hiddenBrands) {
    try {
      const saved = localStorage.getItem('kwik_stop_hidden_brands');
      hiddenBrands = saved ? JSON.parse(saved) : [];
    } catch {
      hiddenBrands = [];
    }
  }

  let lastScrapedTime = '13 Sep 2026 at 05:42 AM';
  try {
    lastScrapedTime = localStorage.getItem('kwik_stop_last_scraped') || lastScrapedTime;
  } catch {
    // Ignore storage errors
  }

  const calculated: CalculatedProduct[] = (products || []).map((p) =>
    calculateProductDetails(p, markupTiers!)
  );

  const activeProducts = calculated.filter((p) => {
    if (!p.in_store) return false;
    const b = p.brand && p.brand.trim() ? p.brand.trim().toUpperCase() : getBrand(p.product_name);
    return !(hiddenBrands || []).includes(b);
  });

  const averageSpread =
    activeProducts.length > 0
      ? Number(
          (activeProducts.reduce((sum, item) => sum + item.spread, 0) / activeProducts.length).toFixed(2)
        )
      : 0;

  const sortedBySpread = [...activeProducts].sort((a, b) => b.spread - a.spread);
  const topSpread = sortedBySpread[0] || null;

  const leaderCounts: Record<string, number> = {
    Trax: 0,
    Campbells: 0,
    'One Distribution': 0,
  };
  activeProducts.forEach((p) => {
    if (leaderCounts[p.cheapest_supplier] !== undefined) {
      leaderCounts[p.cheapest_supplier]++;
    }
  });
  const topLeaderEntry = Object.entries(leaderCounts).sort((a, b) => b[1] - a[1])[0];

  const highSpreadAlertCount = activeProducts.filter((p) => p.spread >= threshold).length;

  return {
    activeCatalogCount: activeProducts.length,
    totalCatalogCount: calculated.length,
    averageSpread,
    maxSavingsOpportunity: topSpread
      ? {
          amount: topSpread.spread,
          productName: topSpread.product_name,
          cheapestSupplier: topSpread.cheapest_supplier,
        }
      : null,
    topCostLeader: topLeaderEntry
      ? { supplierName: topLeaderEntry[0], bestQuoteCount: topLeaderEntry[1] }
      : { supplierName: 'Trax', bestQuoteCount: 0 },
    highSpreadAlertCount,
    lastScrapedTime,
  };
}
