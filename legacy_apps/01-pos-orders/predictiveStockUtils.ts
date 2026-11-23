export type StockOperationalStatus =
  | 'OUT_OF_STOCK'
  | 'BELOW_MINIMUM'
  | 'LOW'
  | 'HEALTHY'
  | 'OVERSTOCKED'
  | 'DORMANT';

export type ForecastConfidence =
  | 'HIGH'
  | 'MEDIUM'
  | 'LOW'
  | 'INSUFFICIENT_HISTORY';

export type SalesTrend = 'Increasing' | 'Steady' | 'Decreasing' | 'Seasonal' | 'Insufficient Data';

export interface MultiHorizonSales {
  sales7d: number;
  sales14d: number;
  sales30d: number;
  sales60d: number;
  sales90d: number;
  sales180d?: number;
  weekendSharePct?: number; // % of sales occurring on Fri/Sat/Sun
}

export interface PredictiveStockParams {
  currentStock: number;
  multiHorizon?: MultiHorizonSales;
  recentSalesTotal?: number; // legacy single period fallback
  salesHistoryDays?: number; // legacy single period days
  daysUntilNextDelivery?: number; // e.g. from supplier schedule, default 4 days
  leadTimeDays?: number; // supplier lead time, default 2 days
  safetyMultiplier?: number; // default 1.2 (20% buffer)
  packSize?: number; // default 1
  minOrderQty?: number;
  isDiscontinued?: boolean;
  manualMinOverride?: number | null;
  manualTargetOverride?: number | null;
}

export interface PredictiveStockResult {
  currentStock: number;
  // Velocity & Demand
  avgDailySales: number; // weighted recent daily velocity
  avgWeeklySales: number; // extrapolated weekly velocity
  velocity7d: number;
  velocity14d: number;
  velocity30d: number;
  velocity60d: number;
  velocity90d: number;
  trend: SalesTrend;
  confidence: ForecastConfidence;
  
  // Historical Sales Horizons
  multiHorizon: MultiHorizonSales;
  
  // Recommendations (DEMAND-DERIVED)
  suggestedMin: number;
  suggestedTarget: number;
  
  // Replenishment (CURRENT STOCK DERIVED)
  replenishmentGap: number;
  suggestedOrderQty: number;
  packSize: number;
  daysOfStockRemaining: number;
  stockStatus: StockOperationalStatus;
  
  // Explainability
  explanation: {
    avgSalesPerDay: string;
    cycleDays: number;
    expectedDemand: string;
    safetyBufferPct: string;
    packSize: number;
    trendDescription: string;
    whyMinimum: string;
    whyTarget: string;
    summary: string;
  };
}

/**
 * Normalises raw historical sales movement quantities.
 * In IdealPOS, negative movement quantities (e.g. -12, -5, -1) represent units sold/consumed.
 * ABSOLUTE VALUE of negative sales quantity = QUANTITY SOLD.
 */
export function normalizeSalesQuantity(qty: number): number {
  if (!qty || isNaN(qty)) return 0;
  return Math.abs(qty);
}

/**
 * Calculates demand-derived suggested minimum & target stock.
 * 
 * CORE PRINCIPLES:
 * 1. Suggested Minimum Stock is NOT based on current on-hand stock.
 * 2. It is calculated strictly from HISTORICAL PRODUCT DEMAND across multiple horizons (7d, 14d, 30d, 60d, 90d).
 * 3. Recent sales (7d, 14d, 30d) carry higher relevance than older sales.
 * 4. Current physical stock is evaluated ONLY AFTER demand targets are established to compute replenishment gap & order qty.
 */
export function calculatePredictiveStock(params: PredictiveStockParams): PredictiveStockResult {
  const {
    currentStock = 0,
    multiHorizon: passedHorizon,
    recentSalesTotal,
    salesHistoryDays = 30,
    daysUntilNextDelivery = 4,
    leadTimeDays = 2,
    safetyMultiplier = 1.2,
    packSize = 1,
    minOrderQty = 0,
    isDiscontinued = false,
    manualMinOverride = null,
    manualTargetOverride = null,
  } = params;

  // Build or derive multi-horizon sales
  let multiHorizon: MultiHorizonSales;
  if (passedHorizon) {
    multiHorizon = {
      sales7d: Math.max(0, passedHorizon.sales7d || 0),
      sales14d: Math.max(0, passedHorizon.sales14d || 0),
      sales30d: Math.max(0, passedHorizon.sales30d || 0),
      sales60d: Math.max(0, passedHorizon.sales60d || 0),
      sales90d: Math.max(0, passedHorizon.sales90d || 0),
      sales180d: typeof passedHorizon.sales180d === 'number' ? Math.max(0, passedHorizon.sales180d) : Math.round((passedHorizon.sales90d || 0) * 1.95),
      weekendSharePct: passedHorizon.weekendSharePct,
    };
  } else if (typeof recentSalesTotal === 'number' && recentSalesTotal >= 0) {
    // Extrapolate realistic multi-horizon from single reference period
    const baseDaily = recentSalesTotal / Math.max(1, salesHistoryDays);
    multiHorizon = {
      sales7d: Math.round(baseDaily * 7),
      sales14d: Math.round(baseDaily * 14),
      sales30d: Math.round(baseDaily * 30),
      sales60d: Math.round(baseDaily * 60),
      sales90d: Math.round(baseDaily * 90),
      sales180d: Math.round(baseDaily * 180),
    };
  } else {
    multiHorizon = {
      sales7d: 0,
      sales14d: 0,
      sales30d: 0,
      sales60d: 0,
      sales90d: 0,
      sales180d: 0,
    };
  }

  // 1. Calculate unweighted daily velocities across each horizon
  const v7 = Number((multiHorizon.sales7d / 7).toFixed(2));
  const v14 = Number((multiHorizon.sales14d / 14).toFixed(2));
  const v30 = Number((multiHorizon.sales30d / 30).toFixed(2));
  const v60 = Number((multiHorizon.sales60d / 60).toFixed(2));
  const v90 = Number((multiHorizon.sales90d / 90).toFixed(2));

  // 2. Identify Demand Trend (comparing recent 7d/14d vs 30d/90d baseline)
  let trend: SalesTrend = 'Steady';
  const totalSalesAll = multiHorizon.sales90d || multiHorizon.sales60d || multiHorizon.sales30d || multiHorizon.sales14d || multiHorizon.sales7d;

  if (totalSalesAll === 0) {
    trend = 'Insufficient Data';
  } else if (v7 > 0 && v30 > 0 && v7 >= v30 * 1.25) {
    trend = 'Increasing';
  } else if (v7 > 0 && v30 > 0 && v7 <= v30 * 0.75) {
    trend = 'Decreasing';
  } else if (v14 > 0 && v60 > 0 && v14 >= v60 * 1.2) {
    trend = 'Increasing';
  } else if (v14 > 0 && v60 > 0 && v14 <= v60 * 0.75) {
    trend = 'Decreasing';
  } else {
    trend = 'Steady';
  }

  // 3. Weighted Recency Velocity (give 7d and 14d higher influence than 60d/90d)
  let weightedDailyVelocity = 0;
  if (totalSalesAll === 0) {
    weightedDailyVelocity = 0;
  } else {
    // Recency weighting: 7d (35%), 14d (25%), 30d (20%), 60d (12%), 90d (8%)
    weightedDailyVelocity = Number(
      (v7 * 0.35 + v14 * 0.25 + v30 * 0.20 + v60 * 0.12 + v90 * 0.08).toFixed(2)
    );
    // Sanity boundary: should not fall below 0
    weightedDailyVelocity = Math.max(0, weightedDailyVelocity);
  }

  const avgDailySales = weightedDailyVelocity;
  const avgWeeklySales = Number((avgDailySales * 7).toFixed(1));

  // 4. Forecast Confidence
  let confidence: ForecastConfidence = 'HIGH';
  if (totalSalesAll === 0) {
    confidence = 'INSUFFICIENT_HISTORY';
  } else if (multiHorizon.sales90d < 4 && multiHorizon.sales30d < 2) {
    confidence = 'LOW'; // Slow mover or sparse history
  } else if (multiHorizon.sales30d < 8) {
    confidence = 'MEDIUM';
  } else {
    confidence = 'HIGH';
  }

  // 5. SUGGESTED MINIMUM STOCK (Calculated strictly from demand)
  // Question answered: "How many units do we normally need physically available to cover operational lead time + buffer?"
  let suggestedMin = 0;
  let whyMinimum = '';

  if (isDiscontinued) {
    suggestedMin = 0;
    whyMinimum = 'Product is discontinued. Minimum stock set to 0 to wind down inventory.';
  } else if (manualMinOverride !== null && manualMinOverride >= 0) {
    suggestedMin = manualMinOverride;
    whyMinimum = `Manual store manager override active (${manualMinOverride} units).`;
  } else if (totalSalesAll === 0 || confidence === 'INSUFFICIENT_HISTORY') {
    // For zero sales / new product, do NOT invent high demand. Base minimum is 1 unit (or 0 for dormant).
    suggestedMin = 1;
    whyMinimum = 'Insufficient sales history recorded. Baseline minimum set to 1 unit pending movement history.';
  } else if (avgDailySales < 0.1) {
    // Very slow-moving product (e.g. 90-day sales = 3)
    suggestedMin = 1;
    whyMinimum = `Slow-moving product (${multiHorizon.sales90d} sold in 90 days, ~${avgDailySales}/day). A lean minimum of 1 unit prevents over-stocking.`;
  } else {
    // Fast or standard moving product
    // Operational coverage: ~2.5 to 3.5 days of daily demand (covers 2 days lead time + 1-1.5 days safety buffer)
    const operationalCoverageDays = Math.max(2.5, leadTimeDays + 1.0);
    let minDemand = avgDailySales * operationalCoverageDays;

    // If demand is increasing, provide a 15% responsiveness buffer
    if (trend === 'Increasing') {
      minDemand *= 1.15;
    }

    // Weekend weighting: if >50% of sales occur on weekend, add weekend surge allowance
    if (multiHorizon.weekendSharePct && multiHorizon.weekendSharePct > 50) {
      minDemand *= 1.12;
    }

    suggestedMin = Math.max(1, Math.ceil(minDemand));
    whyMinimum = `Recent sales average ${avgDailySales} units/day (~${avgWeeklySales}/week) with a ${trend.toLowerCase()} trend. Minimum covers ${operationalCoverageDays.toFixed(1)} days of operational lead time + buffer.`;
  }

  // 6. SUGGESTED TARGET STOCK (Preferred physical quantity after replenishment for coverage cycle)
  let suggestedTarget = 0;
  let whyTarget = '';
  const totalCycleDays = Math.max(1, leadTimeDays + daysUntilNextDelivery);

  if (isDiscontinued) {
    suggestedTarget = 0;
    whyTarget = 'Product is discontinued. Target is 0.';
  } else if (manualTargetOverride !== null && manualTargetOverride >= 0) {
    suggestedTarget = manualTargetOverride;
    whyTarget = `Manual store manager override active (${manualTargetOverride} units).`;
  } else if (totalSalesAll === 0 || confidence === 'INSUFFICIENT_HISTORY') {
    suggestedTarget = Math.max(suggestedMin, 2);
    whyTarget = 'Insufficient sales history. Suggested target maintains lean trial inventory.';
  } else if (avgDailySales < 0.1) {
    suggestedTarget = Math.max(suggestedMin, 2);
    whyTarget = `Slow-moving item. Target of ${suggestedTarget} provides sufficient shelf presence without tying up capital.`;
  } else {
    // Cycle demand = demand through full replenishment interval + safety buffer
    const cycleDemand = avgDailySales * totalCycleDays;
    const rawTarget = cycleDemand * safetyMultiplier;
    suggestedTarget = Math.max(suggestedMin + 1, Math.ceil(rawTarget));
    const safetyPct = Math.round((safetyMultiplier - 1) * 100);
    whyTarget = `Expected demand for ${totalCycleDays}-day delivery cycle (${cycleDemand.toFixed(1)} units) plus +${safetyPct}% safety allowance.`;
  }

  // 7. CURRENT PHYSICAL STOCK & REPLENISHMENT GAP (Used strictly AFTER Min/Target are determined)
  const replenishmentGap = Math.max(0, suggestedTarget - currentStock);
  let suggestedOrderQty = 0;

  if (replenishmentGap > 0 && !isDiscontinued && avgDailySales > 0) {
    const validPack = Math.max(1, packSize);
    suggestedOrderQty = Math.ceil(replenishmentGap / validPack) * validPack;
    if (minOrderQty > 0 && suggestedOrderQty < minOrderQty) {
      suggestedOrderQty = minOrderQty;
    }
  }

  // 8. Days of Stock Remaining
  const daysOfStockRemaining = avgDailySales > 0
    ? Number((Math.max(0, currentStock) / avgDailySales).toFixed(1))
    : currentStock > 0 ? 999 : 0;

  // 9. Operational Stock Status
  let stockStatus: StockOperationalStatus = 'HEALTHY';
  if (isDiscontinued) {
    stockStatus = currentStock > 0 ? 'HEALTHY' : 'DORMANT';
  } else if (currentStock <= 0) {
    stockStatus = avgDailySales > 0 ? 'OUT_OF_STOCK' : 'DORMANT';
  } else if (currentStock < suggestedMin) {
    stockStatus = 'BELOW_MINIMUM';
  } else if (currentStock < suggestedTarget * 0.6) {
    stockStatus = 'LOW';
  } else if (currentStock > suggestedTarget * 2.5 && avgDailySales > 0) {
    stockStatus = 'OVERSTOCKED';
  } else if (avgDailySales === 0 && currentStock <= 0) {
    stockStatus = 'DORMANT';
  }

  const safetyPct = Math.round((safetyMultiplier - 1) * 100);
  const trendDescription =
    trend === 'Increasing'
      ? 'Demand is accelerating recently compared to 90-day baseline'
      : trend === 'Decreasing'
      ? 'Demand has slowed recently compared to 90-day baseline'
      : trend === 'Steady'
      ? 'Consistent sales pattern across 7d, 30d, and 90d periods'
      : 'Insufficient transactions recorded';

  const explanation = {
    avgSalesPerDay: `${avgDailySales} units/day`,
    cycleDays: totalCycleDays,
    expectedDemand: `${(avgDailySales * totalCycleDays).toFixed(1)} units`,
    safetyBufferPct: `+${safetyPct}% buffer`,
    packSize,
    trendDescription,
    whyMinimum,
    whyTarget,
    summary: avgDailySales > 0
      ? `Recent velocity is ~${avgDailySales}/day (~${avgWeeklySales}/week) [${trend} trend]. Suggested Minimum is ${suggestedMin} units. Suggested Target is ${suggestedTarget} units. Current stock is ${currentStock} (Gap: ${replenishmentGap}). Recommended order: ${suggestedOrderQty} units (pack size ${packSize}).`
      : `No sales movement recorded across the last 90 days. Target defaults to baseline of ${suggestedTarget}.`,
  };

  return {
    currentStock,
    avgDailySales,
    avgWeeklySales,
    velocity7d: v7,
    velocity14d: v14,
    velocity30d: v30,
    velocity60d: v60,
    velocity90d: v90,
    trend,
    confidence,
    multiHorizon,
    suggestedMin,
    suggestedTarget,
    replenishmentGap,
    suggestedOrderQty,
    packSize,
    daysOfStockRemaining,
    stockStatus,
    explanation,
  };
}

/**
 * Returns UI styling for stock operational status
 */
export function getStockStatusBadge(status: StockOperationalStatus): {
  label: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
} {
  switch (status) {
    case 'OUT_OF_STOCK':
      return {
        label: 'OUT OF STOCK',
        bgClass: 'bg-rose-50 dark:bg-rose-950/50',
        textClass: 'text-rose-700 dark:text-rose-300 font-bold',
        borderClass: 'border-rose-300 dark:border-rose-800',
      };
    case 'BELOW_MINIMUM':
      return {
        label: 'BELOW MIN',
        bgClass: 'bg-amber-50 dark:bg-amber-950/50',
        textClass: 'text-amber-800 dark:text-amber-300 font-semibold',
        borderClass: 'border-amber-300 dark:border-amber-700',
      };
    case 'LOW':
      return {
        label: 'LOW STOCK',
        bgClass: 'bg-yellow-50 dark:bg-yellow-950/40',
        textClass: 'text-yellow-800 dark:text-yellow-300',
        borderClass: 'border-yellow-300 dark:border-yellow-700',
      };
    case 'OVERSTOCKED':
      return {
        label: 'OVERSTOCKED',
        bgClass: 'bg-indigo-50 dark:bg-indigo-950/40',
        textClass: 'text-indigo-700 dark:text-indigo-300',
        borderClass: 'border-indigo-200 dark:border-indigo-800',
      };
    case 'DORMANT':
      return {
        label: 'DORMANT',
        bgClass: 'bg-neutral-100 dark:bg-neutral-800/60',
        textClass: 'text-neutral-500 dark:text-neutral-400',
        borderClass: 'border-neutral-200 dark:border-neutral-700',
      };
    case 'HEALTHY':
    default:
      return {
        label: 'HEALTHY',
        bgClass: 'bg-emerald-50 dark:bg-emerald-950/40',
        textClass: 'text-emerald-700 dark:text-emerald-300 font-medium',
        borderClass: 'border-emerald-200 dark:border-emerald-800',
      };
  }
}
