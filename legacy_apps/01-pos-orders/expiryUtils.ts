export interface ExpiryBatch {
  id: string;
  stockItemId: number;
  productCode: string;
  productName: string;
  barcode?: string;
  departmentCode?: number | string;
  departmentName?: string;
  quantity: number;
  expiryDate: string; // YYYY-MM-DD
  batchLot?: string;
  notes?: string;
  status: 'active' | 'sold' | 'written_off' | 'cleared';
  resolvedReason?: 'sold' | 'written_off' | 'cleared' | 'manual_clear';
  resolvedAt?: string;
  createdAt: string;
  createdBy?: string;
  updatedAt: string;
  updatedBy?: string;
}

export interface WastageRecord {
  id: string;
  stockItemId: number;
  productCode: string;
  productName: string;
  barcode?: string;
  departmentCode?: number | string;
  departmentName?: string;
  quantity: number;
  costPrice?: number;
  totalCost?: number;
  reason: 'expired' | 'damaged' | 'spoiled' | 'sampling' | 'other';
  date: string;
  staffName?: string;
  expiryBatchId?: string;
  notes?: string;
}

export type ExpiryWarningStatus = 'EXPIRED' | 'TODAY' | 'URGENT' | 'SOON' | 'WATCH' | 'OK';

export interface ExpiryWarningConfig {
  urgent: number; // default 3 days
  soon: number;   // default 7 days
  watch: number;  // default 30 days
}

export const DEFAULT_EXPIRY_CONFIG: ExpiryWarningConfig = {
  urgent: 3,
  soon: 7,
  watch: 30,
};

/**
 * Calculates days difference between current local date and target YYYY-MM-DD string.
 * Negative = expired in past. 0 = expires today. Positive = days in future.
 */
export function getDaysUntilExpiry(expiryDateStr: string): number {
  if (!expiryDateStr) return 999;
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const [y, m, d] = expiryDateStr.split('-').map(Number);
  if (!y || !m || !d) return 999;

  const target = new Date(y, m - 1, d);
  target.setHours(0, 0, 0, 0);

  const diffMs = target.getTime() - now.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Categorizes an individual batch for filters and views:
 * - EXPIRED: days < 0 (Active unresolved)
 * - THIS_WEEK: 0 <= days <= 7 (Active)
 * - THIS_MONTH: 8 <= days <= 30 (Active)
 * - FUTURE: days > 30 (Active)
 * - RESOLVED: status !== 'active'
 */
export function getBatchCategory(batch: ExpiryBatch): 'EXPIRED' | 'THIS_WEEK' | 'THIS_MONTH' | 'FUTURE' | 'RESOLVED' {
  if (batch.status !== 'active') return 'RESOLVED';
  const days = getDaysUntilExpiry(batch.expiryDate);
  if (days < 0) return 'EXPIRED';
  if (days <= 7) return 'THIS_WEEK';
  if (days <= 30) return 'THIS_MONTH';
  return 'FUTURE';
}

/**
 * Checks if a batch should appear on the RED Dashboard ticker:
 * Active + Expired within the last 7 days (-7 <= days < 0).
 * After 7 days, it drops off Dashboard alert ticker to prevent permanent clutter,
 * but remains in the Expiry Management table as 'Expired – Unresolved'.
 */
export function isDashboardExpired(batch: ExpiryBatch): boolean {
  if (batch.status !== 'active') return false;
  const days = getDaysUntilExpiry(batch.expiryDate);
  return days < 0 && days >= -7;
}

/**
 * Checks if a batch should appear on the BLUE Dashboard ticker:
 * Active + Expiring today or in the next 7 days (0 <= days <= 7).
 */
export function isDashboardThisWeek(batch: ExpiryBatch): boolean {
  if (batch.status !== 'active') return false;
  const days = getDaysUntilExpiry(batch.expiryDate);
  return days >= 0 && days <= 7;
}

/**
 * Checks if a batch should appear on the GREEN Dashboard ticker:
 * Active + Expiring between day 8 and day 30 (8 <= days <= 30).
 */
export function isDashboardThisMonth(batch: ExpiryBatch): boolean {
  if (batch.status !== 'active') return false;
  const days = getDaysUntilExpiry(batch.expiryDate);
  return days > 7 && days <= 30;
}

/**
 * Returns user-friendly relative expiry text (e.g., 'Expired 2 days ago', 'Expires today', 'Expires in 4 days')
 */
export function formatExpiryRelative(expiryDateStr: string): string {
  const days = getDaysUntilExpiry(expiryDateStr);
  if (days < 0) {
    const abs = Math.abs(days);
    return abs === 1 ? 'Expired 1 day ago' : `Expired ${abs} days ago`;
  }
  if (days === 0) return 'Expires TODAY';
  if (days === 1) return 'Expires tomorrow';
  return `Expires in ${days} days`;
}

/**
 * Returns the operational warning status for an expiry date
 */
export function getExpiryWarningStatus(
  expiryDateStr: string,
  config: ExpiryWarningConfig = DEFAULT_EXPIRY_CONFIG
): ExpiryWarningStatus {
  const days = getDaysUntilExpiry(expiryDateStr);

  if (days < 0) return 'EXPIRED';
  if (days === 0) return 'TODAY';
  if (days <= config.urgent) return 'URGENT';
  if (days <= config.soon) return 'SOON';
  if (days <= config.watch) return 'WATCH';
  return 'OK';
}

/**
 * Visual styling and label for each status level
 */
export function getExpiryBadgeConfig(status: ExpiryWarningStatus): {
  label: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  iconName: string;
} {
  switch (status) {
    case 'EXPIRED':
      return {
        label: 'EXPIRED',
        bgClass: 'bg-rose-50 dark:bg-rose-950/40',
        textClass: 'text-rose-700 dark:text-rose-300 font-bold',
        borderClass: 'border-rose-300 dark:border-rose-800',
        iconName: 'AlertOctagon',
      };
    case 'TODAY':
      return {
        label: 'EXPIRES TODAY',
        bgClass: 'bg-red-50 dark:bg-red-950/40',
        textClass: 'text-red-700 dark:text-red-300 font-bold animate-pulse',
        borderClass: 'border-red-400 dark:border-red-800',
        iconName: 'AlertTriangle',
      };
    case 'URGENT':
      return {
        label: 'URGENT (≤3d)',
        bgClass: 'bg-amber-50 dark:bg-amber-950/40',
        textClass: 'text-amber-800 dark:text-amber-300 font-semibold',
        borderClass: 'border-amber-300 dark:border-amber-700',
        iconName: 'Clock',
      };
    case 'SOON':
      return {
        label: 'EXPIRING SOON',
        bgClass: 'bg-amber-50/60 dark:bg-amber-900/30',
        textClass: 'text-amber-700 dark:text-amber-400',
        borderClass: 'border-amber-200 dark:border-amber-800',
        iconName: 'Clock',
      };
    case 'WATCH':
      return {
        label: 'WATCH (≤30d)',
        bgClass: 'bg-sky-50 dark:bg-sky-950/40',
        textClass: 'text-sky-700 dark:text-sky-300',
        borderClass: 'border-sky-200 dark:border-sky-800',
        iconName: 'Eye',
      };
    case 'OK':
    default:
      return {
        label: 'FRESH / OK',
        bgClass: 'bg-emerald-50 dark:bg-emerald-950/40',
        textClass: 'text-emerald-700 dark:text-emerald-300',
        borderClass: 'border-emerald-200 dark:border-emerald-800',
        iconName: 'CheckCircle2',
      };
  }
}

export interface ProductExpirySummary {
  stockItemId: number;
  activeBatchesCount: number;
  totalTrackedQty: number;
  nextExpiryDate: string | null;
  daysUntilNextExpiry: number | null;
  worstStatus: ExpiryWarningStatus | null;
  hasExpired: boolean;
  hasExpiringSoon: boolean;
}

export function getProductExpirySummary(
  batches: ExpiryBatch[],
  stockItemId: number,
  config: ExpiryWarningConfig = DEFAULT_EXPIRY_CONFIG
): ProductExpirySummary {
  const activeBatches = batches.filter(
    (b) => Number(b.stockItemId) === Number(stockItemId) && b.status === 'active'
  );

  if (activeBatches.length === 0) {
    return {
      stockItemId,
      activeBatchesCount: 0,
      totalTrackedQty: 0,
      nextExpiryDate: null,
      daysUntilNextExpiry: null,
      worstStatus: null,
      hasExpired: false,
      hasExpiringSoon: false,
    };
  }

  // Sort batches by earliest expiry date
  activeBatches.sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));

  const totalTrackedQty = activeBatches.reduce((sum, b) => sum + Number(b.quantity || 0), 0);
  const nextExpiryDate = activeBatches[0].expiryDate;
  const daysUntilNextExpiry = getDaysUntilExpiry(nextExpiryDate);

  let worstStatus: ExpiryWarningStatus = 'OK';
  let hasExpired = false;
  let hasExpiringSoon = false;

  for (const b of activeBatches) {
    const status = getExpiryWarningStatus(b.expiryDate, config);
    if (status === 'EXPIRED') {
      worstStatus = 'EXPIRED';
      hasExpired = true;
      break;
    } else if (status === 'TODAY' && worstStatus !== 'TODAY') {
      worstStatus = 'TODAY';
      hasExpiringSoon = true;
    } else if (status === 'URGENT' && worstStatus !== 'TODAY' && worstStatus !== 'URGENT') {
      worstStatus = 'URGENT';
      hasExpiringSoon = true;
    } else if (status === 'SOON' && worstStatus === 'OK') {
      worstStatus = 'SOON';
      hasExpiringSoon = true;
    } else if (status === 'WATCH' && worstStatus === 'OK') {
      worstStatus = 'WATCH';
    }
  }

  return {
    stockItemId,
    activeBatchesCount: activeBatches.length,
    totalTrackedQty,
    nextExpiryDate,
    daysUntilNextExpiry,
    worstStatus,
    hasExpired,
    hasExpiringSoon,
  };
}
