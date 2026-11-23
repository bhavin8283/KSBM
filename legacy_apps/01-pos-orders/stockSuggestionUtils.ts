export interface ProductMovementData {
  sales7d: number;
  sales30d: number;
  sales90d: number;
  sales180d?: number;
  sales365d?: number;
}

export interface StockObservationCheckpoint {
  id?: string;
  productId: number | string;
  itemCode?: string;
  barcode?: string;
  productName?: string;
  departmentName?: string;
  countedQty: number;
  countedAt: string;
  staffName?: string;
  notes?: string;
}

export interface SuggestedStockCalculationResult {
  suggestedStockToHold: number;
  weightedDailyVelocity: number;
  holdingDays: number;
  velocity7d: number;
  velocity30d: number;
  velocity90d: number;
  velocity180d: number;
  isRecentSpike: boolean;
  sales7d: number;
  sales30d: number;
  sales90d: number;
  sales180d: number;
  sales365d?: number;
  lastObservation?: StockObservationCheckpoint | null;
  approxOrderRequirement?: number | null; // only present if physical stock count provided
}

/**
 * Calculates Suggested Stock to Hold based on multi-horizon movement data.
 * 
 * CORE PRINCIPLES:
 * 1. Strictly uses sales/movement data, never negative POS inventory balances.
 * 2. Balances recent sales velocity (7d, 30d) against longer-term history (90d, 180d).
 * 3. Applies a practical 14-day operational replenishment hold buffer.
 * 4. Distinctly calculates Suggested Stock to Hold vs. Approx. Order Requirement.
 */
export function calculateSuggestedStockToHold(
  movement: ProductMovementData,
  currentPhysicalStock?: number | null,
  lastObservation?: StockObservationCheckpoint | null
): SuggestedStockCalculationResult {
  const s7 = Math.max(0, Number(movement.sales7d) || 0);
  const s30 = Math.max(0, Number(movement.sales30d) || 0);
  const s90 = Math.max(0, Number(movement.sales90d) || 0);
  const s180 = Math.max(0, Number(movement.sales180d !== undefined ? movement.sales180d : s90 * 2) || 0);
  const s365 = movement.sales365d !== undefined ? Math.max(0, Number(movement.sales365d) || 0) : undefined;

  const v7 = s7 / 7;
  const v30 = s30 / 30;
  const v90 = s90 / 90;
  const v180 = s180 / 180;

  // Check if item has any movement at all
  const totalSales = s7 + s30 + s90 + s180;
  if (totalSales <= 0) {
    return {
      suggestedStockToHold: 0,
      weightedDailyVelocity: 0,
      holdingDays: 14,
      velocity7d: 0,
      velocity30d: 0,
      velocity90d: 0,
      velocity180d: 0,
      isRecentSpike: false,
      sales7d: 0,
      sales30d: 0,
      sales90d: 0,
      sales180d: 0,
      sales365d: s365 || 0,
      lastObservation,
      approxOrderRequirement: currentPhysicalStock !== undefined && currentPhysicalStock !== null
        ? Math.max(0, 0 - currentPhysicalStock)
        : null,
    };
  }

  // Detect genuine velocity increase (recent demand surge)
  const isRecentSpike = v7 > 1.35 * v30 && s7 >= 3;

  let weightedVelocity = 0;
  if (isRecentSpike) {
    // 50% weight on 7-day velocity to respond to demand surge, 30% on 30d, 20% on 90d
    weightedVelocity = (0.50 * v7) + (0.30 * v30) + (0.20 * v90);
  } else {
    // Standard stable weighted velocity
    weightedVelocity = (0.40 * v7) + (0.30 * v30) + (0.20 * v90) + (0.10 * v180);
  }

  // Standard 14-day retail shelf buffer
  const holdingDays = 14;

  let suggested = Math.round(weightedVelocity * holdingDays);

  // If item is actively selling, guarantee at least a minimal shelf presence of 1 or 2 units
  if (s30 > 0 && suggested < 1) {
    suggested = 1;
  }
  if (s7 >= 5 && suggested < 2) {
    suggested = 2;
  }

  // Calculate approx order requirement if current physical stock is provided
  let approxOrderRequirement: number | null = null;
  if (currentPhysicalStock !== undefined && currentPhysicalStock !== null && !isNaN(currentPhysicalStock)) {
    approxOrderRequirement = Math.max(0, suggested - Math.max(0, currentPhysicalStock));
  }

  return {
    suggestedStockToHold: suggested,
    weightedDailyVelocity: Math.round(weightedVelocity * 100) / 100,
    holdingDays,
    velocity7d: Math.round(v7 * 100) / 100,
    velocity30d: Math.round(v30 * 100) / 100,
    velocity90d: Math.round(v90 * 100) / 100,
    velocity180d: Math.round(v180 * 100) / 100,
    isRecentSpike,
    sales7d: s7,
    sales30d: s30,
    sales90d: s90,
    sales180d: s180,
    sales365d: s365,
    lastObservation,
    approxOrderRequirement,
  };
}
