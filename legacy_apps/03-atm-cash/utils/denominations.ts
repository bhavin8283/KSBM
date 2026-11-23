export interface AmountValidationResult {
  valid: boolean;
  error?: string;
}

export interface NoteEstimateResult {
  notes20: number;
  notes50: number;
  exactInventoryFit: boolean;
}

/**
 * Validates that a dollar withdrawal amount can be formed using $20 and $50 AUD notes.
 * Must be >= $20, divisible by $10, and not $30 (which is impossible with $20 & $50 notes).
 */
export function validateWithdrawalAmount(amount: number): AmountValidationResult {
  if (!Number.isFinite(amount) || Number.isNaN(amount)) {
    return { valid: false, error: 'Enter a valid dollar amount.' };
  }
  if (!Number.isInteger(amount)) {
    return { valid: false, error: 'Amount must be a whole dollar figure.' };
  }
  if (amount < 20) {
    return { valid: false, error: 'Minimum withdrawal amount is $20 AUD.' };
  }
  if (amount % 10 !== 0) {
    return { valid: false, error: 'Amount must be divisible by $10 (only $20 and $50 notes exist).' };
  }
  if (amount === 30) {
    return {
      valid: false,
      error: '$30 cannot be dispensed using only $20 and $50 AUD notes.',
    };
  }
  return { valid: true };
}

/**
 * Computes a valid ($20, $50) note split summing exactly to `amount`.
 * Prefers a split that fits within current expected inventory when possible.
 */
export function estimateNoteBreakdown(
  amount: number,
  available20: number,
  available50: number
): NoteEstimateResult {
  const max50 = Math.floor(amount / 50);

  for (let n50 = max50; n50 >= 0; n50--) {
    const rem = amount - n50 * 50;
    if (rem % 20 === 0) {
      const n20 = rem / 20;
      if (n50 <= available50 && n20 <= available20) {
        return { notes20: n20, notes50: n50, exactInventoryFit: true };
      }
    }
  }

  for (let n50 = max50; n50 >= 0; n50--) {
    const rem = amount - n50 * 50;
    if (rem % 20 === 0) {
      return { notes20: rem / 20, notes50: n50, exactInventoryFit: false };
    }
  }

  return { notes20: 0, notes50: 0, exactInventoryFit: false };
}

export function calculateCashTotal(notes20: number, notes50: number): number {
  return notes20 * 20 + notes50 * 50;
}

export function formatCurrencyAUD(amount: number): string {
  const abs = Math.abs(amount);
  const formatted = new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(abs);
  return amount < 0 ? `-${formatted}` : formatted;
}

export function formatVarianceNoteText(variance20: number, variance50: number): string[] {
  const details: string[] = [];
  if (variance50 !== 0) {
    const abs50 = Math.abs(variance50);
    const label = abs50 === 1 ? 'note' : 'notes';
    details.push(
      variance50 < 0
        ? `Short ${abs50} × $50 ${label} (-$${abs50 * 50})`
        : `Over ${abs50} × $50 ${label} (+$${abs50 * 50})`
    );
  }
  if (variance20 !== 0) {
    const abs20 = Math.abs(variance20);
    const label = abs20 === 1 ? 'note' : 'notes';
    details.push(
      variance20 < 0
        ? `Short ${abs20} × $20 ${label} (-$${abs20 * 20})`
        : `Over ${abs20} × $20 ${label} (+$${abs20 * 20})`
    );
  }
  return details;
}
