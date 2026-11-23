import {
  ATMDashboardSummary,
  ATMInventory,
  ATMModuleSettings,
  ATMModuleState,
  ATMTransaction,
  CycleCountTransaction,
  KSBMBusinessConfig,
  KSBMPermissions,
  KSBMUser,
  ModuleTabId,
} from '../types';
import { calculateCashTotal, formatCurrencyAUD } from './denominations';

const BASE_STORAGE_KEY = 'kwik_stop_atm_tracker_v1';

export function getModuleStorageKey(namespace?: string): string {
  const clean = namespace?.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  return clean ? `${BASE_STORAGE_KEY}_${clean}` : BASE_STORAGE_KEY;
}

export function resolveModulePermissions(user: KSBMUser): KSBMPermissions {
  const baseByRole: Record<KSBMUser['role'], KSBMPermissions> = {
    master: {
      viewDashboard: true,
      feedCash: true,
      recordWithdrawal: true,
      runCycleCount: true,
      approveAdjustment: true,
      viewHistory: true,
      exportData: true,
      manageModuleSettings: true,
    },
    manager: {
      viewDashboard: true,
      feedCash: true,
      recordWithdrawal: true,
      runCycleCount: true,
      approveAdjustment: true,
      viewHistory: true,
      exportData: true,
      manageModuleSettings: false,
    },
    staff: {
      viewDashboard: true,
      feedCash: false,
      recordWithdrawal: false,
      runCycleCount: false,
      approveAdjustment: false,
      viewHistory: false,
      exportData: false,
      manageModuleSettings: false,
    },
  };

  const defaults = baseByRole[user.role] ?? baseByRole.staff;
  return {
    ...defaults,
    ...(user.permissions ?? {}),
  };
}

export function canAccessModuleTab(permissions: KSBMPermissions, tab: ModuleTabId): boolean {
  switch (tab) {
    case 'dashboard':
      return permissions.viewDashboard;
    case 'feed':
      return permissions.feedCash;
    case 'withdrawal':
      return permissions.recordWithdrawal;
    case 'cycle_count':
      return permissions.runCycleCount;
    case 'history':
      return permissions.viewHistory;
    case 'config':
      return permissions.manageModuleSettings;
  }
}

export const DEFAULT_MODULE_STATE: ATMModuleState = {
  inventory: {
    expectedNotes20: 0,
    expectedNotes50: 0,
  },
  transactions: [],
  settings: {
    thresholds: {
      minTotalCash: 2000,
      minNotes20: 30,
      minNotes50: 30,
    },
    webhookUrl: '',
    spreadsheetId: '',
    autoSyncEnabled: true,
    autoPullOnOpen: false,
    lastSyncedAt: null,
  },
};

export function mergeBusinessConfig(
  settings: ATMModuleSettings,
  businessConfig?: KSBMBusinessConfig
): ATMModuleSettings {
  if (!businessConfig) return settings;
  return {
    ...settings,
    thresholds: {
      minTotalCash:
        typeof businessConfig.atmThresholds?.minTotalCash === 'number'
          ? businessConfig.atmThresholds.minTotalCash
          : settings.thresholds.minTotalCash,
      minNotes20:
        typeof businessConfig.atmThresholds?.minNotes20 === 'number'
          ? businessConfig.atmThresholds.minNotes20
          : settings.thresholds.minNotes20,
      minNotes50:
        typeof businessConfig.atmThresholds?.minNotes50 === 'number'
          ? businessConfig.atmThresholds.minNotes50
          : settings.thresholds.minNotes50,
    },
    webhookUrl:
      typeof businessConfig.googleSync?.webhookUrl === 'string' &&
      businessConfig.googleSync.webhookUrl.trim()
        ? businessConfig.googleSync.webhookUrl.trim()
        : settings.webhookUrl,
    spreadsheetId:
      typeof businessConfig.googleSync?.spreadsheetId === 'string' &&
      businessConfig.googleSync.spreadsheetId.trim()
        ? businessConfig.googleSync.spreadsheetId.trim()
        : settings.spreadsheetId,
    autoSyncEnabled:
      typeof businessConfig.googleSync?.autoSyncEnabled === 'boolean'
        ? businessConfig.googleSync.autoSyncEnabled
        : settings.autoSyncEnabled,
    autoPullOnOpen:
      typeof businessConfig.googleSync?.autoPullOnOpen === 'boolean'
        ? businessConfig.googleSync.autoPullOnOpen
        : settings.autoPullOnOpen,
  };
}

export function loadATMModuleState(businessConfig?: KSBMBusinessConfig): ATMModuleState {
  const key = getModuleStorageKey(businessConfig?.storageNamespace);
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return {
        ...DEFAULT_MODULE_STATE,
        settings: mergeBusinessConfig(DEFAULT_MODULE_STATE.settings, businessConfig),
      };
    }
    const parsed = JSON.parse(raw) as Partial<ATMModuleState>;

    const baseSettings: ATMModuleSettings = {
      thresholds: {
        minTotalCash:
          typeof parsed.settings?.thresholds?.minTotalCash === 'number'
            ? parsed.settings.thresholds.minTotalCash
            : DEFAULT_MODULE_STATE.settings.thresholds.minTotalCash,
        minNotes20:
          typeof parsed.settings?.thresholds?.minNotes20 === 'number'
            ? parsed.settings.thresholds.minNotes20
            : DEFAULT_MODULE_STATE.settings.thresholds.minNotes20,
        minNotes50:
          typeof parsed.settings?.thresholds?.minNotes50 === 'number'
            ? parsed.settings.thresholds.minNotes50
            : DEFAULT_MODULE_STATE.settings.thresholds.minNotes50,
      },
      webhookUrl:
        typeof parsed.settings?.webhookUrl === 'string' ? parsed.settings.webhookUrl : '',
      spreadsheetId:
        typeof parsed.settings?.spreadsheetId === 'string' ? parsed.settings.spreadsheetId : '',
      autoSyncEnabled:
        typeof parsed.settings?.autoSyncEnabled === 'boolean'
          ? parsed.settings.autoSyncEnabled
          : true,
      autoPullOnOpen:
        typeof parsed.settings?.autoPullOnOpen === 'boolean'
          ? parsed.settings.autoPullOnOpen
          : false,
      lastSyncedAt:
        typeof parsed.settings?.lastSyncedAt === 'string' ? parsed.settings.lastSyncedAt : null,
    };

    return {
      inventory: {
        expectedNotes20:
          typeof parsed.inventory?.expectedNotes20 === 'number'
            ? parsed.inventory.expectedNotes20
            : 0,
        expectedNotes50:
          typeof parsed.inventory?.expectedNotes50 === 'number'
            ? parsed.inventory.expectedNotes50
            : 0,
      },
      transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
      settings: mergeBusinessConfig(baseSettings, businessConfig),
    };
  } catch {
    return {
      ...DEFAULT_MODULE_STATE,
      settings: mergeBusinessConfig(DEFAULT_MODULE_STATE.settings, businessConfig),
    };
  }
}

export function saveATMModuleState(state: ATMModuleState, namespace?: string): void {
  try {
    localStorage.setItem(getModuleStorageKey(namespace), JSON.stringify(state));
  } catch {
    // Ignore storage quota errors gracefully
  }
}

export interface ParsedBackupResult {
  ok: boolean;
  state?: ATMModuleState;
  meta?: {
    sourceLabel: string;
    exportedAt: string | null;
    transactionCount: number;
    expectedTotalAUD: number;
    expectedNotes20: number;
    expectedNotes50: number;
  };
  error?: string;
}

export function parseBackupJson(
  rawText: string,
  currentSettings: ATMModuleSettings
): ParsedBackupResult {
  try {
    const parsed = JSON.parse(rawText) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object') {
      return { ok: false, error: 'Backup file does not contain valid JSON.' };
    }

    let candidateInventory: Record<string, unknown> | undefined;
    let candidateTransactions: unknown;
    let candidateSettings: Record<string, unknown> | undefined;
    let exportedAt: string | null = null;
    let sourceLabel = 'JSON Backup';

    if (parsed.data && typeof parsed.data === 'object') {
      const dataObj = parsed.data as Record<string, unknown>;
      candidateInventory = dataObj.inventory as Record<string, unknown> | undefined;
      candidateTransactions = dataObj.transactions;
      candidateSettings = dataObj.settings as Record<string, unknown> | undefined;
      exportedAt = typeof parsed.exportedAt === 'string' ? parsed.exportedAt : null;
      sourceLabel = 'Local JSON Backup';
    } else if (
      parsed.event === 'full_sync' ||
      parsed.event === 'transaction' ||
      Array.isArray(parsed.transactions)
    ) {
      candidateInventory = parsed.inventory as Record<string, unknown> | undefined;
      candidateTransactions = parsed.transactions;
      candidateSettings = parsed.settings as Record<string, unknown> | undefined;
      exportedAt = typeof parsed.sentAt === 'string' ? parsed.sentAt : null;
      sourceLabel = 'Google Drive Backup';
    } else {
      return {
        ok: false,
        error: 'Unrecognized backup format. Expected a Kwik Stop ATM JSON backup file.',
      };
    }

    if (!Array.isArray(candidateTransactions)) {
      return { ok: false, error: 'Backup file is missing transaction records.' };
    }

    const validTransactions = candidateTransactions.filter(
      (item): item is ATMTransaction =>
        Boolean(item) &&
        typeof item === 'object' &&
        typeof (item as ATMTransaction).id === 'string' &&
        typeof (item as ATMTransaction).type === 'string' &&
        typeof (item as ATMTransaction).timestamp === 'string'
    );

    const expectedNotes20 =
      typeof candidateInventory?.expectedNotes20 === 'number'
        ? candidateInventory.expectedNotes20
        : 0;
    const expectedNotes50 =
      typeof candidateInventory?.expectedNotes50 === 'number'
        ? candidateInventory.expectedNotes50
        : 0;

    const rawThresholds = candidateSettings?.thresholds as Record<string, unknown> | undefined;

    const mergedSettings: ATMModuleSettings = {
      thresholds: {
        minTotalCash:
          typeof rawThresholds?.minTotalCash === 'number'
            ? rawThresholds.minTotalCash
            : currentSettings.thresholds.minTotalCash,
        minNotes20:
          typeof rawThresholds?.minNotes20 === 'number'
            ? rawThresholds.minNotes20
            : currentSettings.thresholds.minNotes20,
        minNotes50:
          typeof rawThresholds?.minNotes50 === 'number'
            ? rawThresholds.minNotes50
            : currentSettings.thresholds.minNotes50,
      },
      webhookUrl:
        typeof candidateSettings?.webhookUrl === 'string' && candidateSettings.webhookUrl.trim()
          ? candidateSettings.webhookUrl
          : currentSettings.webhookUrl,
      spreadsheetId:
        typeof candidateSettings?.spreadsheetId === 'string' &&
        candidateSettings.spreadsheetId.trim()
          ? candidateSettings.spreadsheetId
          : currentSettings.spreadsheetId,
      autoSyncEnabled:
        typeof candidateSettings?.autoSyncEnabled === 'boolean'
          ? candidateSettings.autoSyncEnabled
          : currentSettings.autoSyncEnabled,
      autoPullOnOpen:
        typeof candidateSettings?.autoPullOnOpen === 'boolean'
          ? candidateSettings.autoPullOnOpen
          : currentSettings.autoPullOnOpen,
      lastSyncedAt: exportedAt ?? currentSettings.lastSyncedAt,
    };

    const nextState: ATMModuleState = {
      inventory: {
        expectedNotes20,
        expectedNotes50,
      },
      transactions: validTransactions,
      settings: mergedSettings,
    };

    return {
      ok: true,
      state: nextState,
      meta: {
        sourceLabel,
        exportedAt,
        transactionCount: validTransactions.length,
        expectedTotalAUD: calculateCashTotal(expectedNotes20, expectedNotes50),
        expectedNotes20,
        expectedNotes50,
      },
    };
  } catch {
    return { ok: false, error: 'Could not parse JSON file. Make sure it is a valid .json backup.' };
  }
}

export interface CashRunwayEstimate {
  hasData: boolean;
  avgDailyWithdrawal: number;
  daysRemaining: number | null;
  sampleDays: number;
}

export function calculateCashRunway(
  transactions: ATMTransaction[],
  currentTotalCash: number
): CashRunwayEstimate {
  const now = Date.now();
  const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000;
  const recentWithdrawals = transactions.filter(
    (tx) => tx.type === 'withdrawal' && now - new Date(tx.timestamp).getTime() <= fourteenDaysMs
  );

  if (recentWithdrawals.length === 0) {
    return { hasData: false, avgDailyWithdrawal: 0, daysRemaining: null, sampleDays: 0 };
  }

  const totalDispensed = recentWithdrawals.reduce((sum, tx) => sum + tx.totalAmount, 0);
  const distinctDays = new Set(
    recentWithdrawals.map((tx) =>
      tx.type === 'withdrawal' ? tx.settlementDate : tx.timestamp.slice(0, 10)
    )
  ).size;

  const avgDailyWithdrawal = Math.round(totalDispensed / Math.max(1, distinctDays));
  const daysRemaining =
    avgDailyWithdrawal > 0 && currentTotalCash > 0
      ? Math.max(0, Math.round((currentTotalCash / avgDailyWithdrawal) * 10) / 10)
      : currentTotalCash <= 0
        ? 0
        : null;

  return {
    hasData: true,
    avgDailyWithdrawal,
    daysRemaining,
    sampleDays: distinctDays,
  };
}

/**
 * Computes live summary metrics exposed to the KSBM Master Dashboard Home screen.
 */
export function computeATMDashboardSummary(state: ATMModuleState): ATMDashboardSummary {
  const { inventory, settings, transactions } = state;
  const expectedTotalAUD = calculateCashTotal(
    inventory.expectedNotes20,
    inventory.expectedNotes50
  );
  const runway = calculateCashRunway(transactions, expectedTotalAUD);

  const lowCashReasons: string[] = [];
  if (expectedTotalAUD < settings.thresholds.minTotalCash) {
    lowCashReasons.push(
      `Total cash (${formatCurrencyAUD(expectedTotalAUD)}) < ${formatCurrencyAUD(
        settings.thresholds.minTotalCash
      )}`
    );
  }
  if (inventory.expectedNotes20 < settings.thresholds.minNotes20) {
    lowCashReasons.push(`$20s (${inventory.expectedNotes20}) < ${settings.thresholds.minNotes20} min`);
  }
  if (inventory.expectedNotes50 < settings.thresholds.minNotes50) {
    lowCashReasons.push(`$50s (${inventory.expectedNotes50}) < ${settings.thresholds.minNotes50} min`);
  }

  const lastCycleCount = transactions.find(
    (tx): tx is CycleCountTransaction => tx.type === 'cycle_count'
  );

  return {
    expectedTotalAUD,
    expectedNotes20: inventory.expectedNotes20,
    expectedNotes50: inventory.expectedNotes50,
    isLowCash: lowCashReasons.length > 0,
    lowCashReasons,
    avgDailyWithdrawalAUD: runway.avgDailyWithdrawal,
    estimatedRunwayDays: runway.daysRemaining,
    lastCycleCountStatus: lastCycleCount ? lastCycleCount.status : 'none',
    lastCycleCountVarianceAUD: lastCycleCount ? lastCycleCount.varianceTotal : null,
    lastCycleCountAt: lastCycleCount ? lastCycleCount.timestamp : null,
  };
}

/**
 * Convenience reader for KSBM Master Shell Dashboard widgets when the ATM module is not mounted.
 */
export function getATMDashboardSummary(businessConfig?: KSBMBusinessConfig): ATMDashboardSummary {
  return computeATMDashboardSummary(loadATMModuleState(businessConfig));
}

export function formatTransactionShareText(
  tx: ATMTransaction,
  currentInventory?: ATMInventory
): string {
  const dateStr = formatDateTimeAU(tx.timestamp);
  const lines: string[] = [];

  if (tx.type === 'feed') {
    lines.push('Kwik Stop ATM — Cash Feed');
    lines.push(`Time: ${dateStr}`);
    lines.push(`Staff: ${tx.staffName}`);
    lines.push(`Added: +${formatCurrencyAUD(tx.totalAmount)} (${tx.notes20}×$20, ${tx.notes50}×$50)`);
  } else if (tx.type === 'withdrawal') {
    lines.push('Kwik Stop ATM — Daily Withdrawal');
    lines.push(`EOD Date: ${tx.settlementDate} (${dateStr})`);
    lines.push(`Recorded By: ${tx.staffName}`);
    lines.push(
      `Dispensed: -${formatCurrencyAUD(tx.totalAmount)} (${tx.notes20}×$20, ${tx.notes50}×$50)`
    );
  } else if (tx.type === 'cycle_count') {
    lines.push('Kwik Stop ATM — Cycle Count Audit');
    lines.push(`Time: ${dateStr}`);
    lines.push(`Counted By: ${tx.staffName}`);
    lines.push(
      `Physical: ${formatCurrencyAUD(tx.physicalTotal)} (${tx.physicalNotes20}×$20, ${tx.physicalNotes50}×$50)`
    );
    lines.push(`Expected: ${formatCurrencyAUD(tx.expectedTotal)}`);
    lines.push(
      tx.status === 'matched'
        ? 'Status: EXACT MATCH — Cash Balanced'
        : `Status: DISCREPANCY (${tx.varianceTotal >= 0 ? '+' : ''}${formatCurrencyAUD(tx.varianceTotal)})`
    );
  } else {
    lines.push('Kwik Stop ATM — Balance Adjustment');
    lines.push(`Time: ${dateStr}`);
    lines.push(`Supervisor: ${tx.staffName}`);
    lines.push(`Reason: ${tx.reason}`);
  }

  if (tx.reference) {
    lines.push(`Ref: ${tx.reference}`);
  }

  if (currentInventory) {
    const bal = calculateCashTotal(currentInventory.expectedNotes20, currentInventory.expectedNotes50);
    lines.push(
      `Current Expected ATM: ${formatCurrencyAUD(bal)} (${currentInventory.expectedNotes20}×$20, ${currentInventory.expectedNotes50}×$50)`
    );
  }

  return lines.join('\n');
}

export function createTransactionId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  const ts = Date.now().toString(36).slice(-4).toUpperCase();
  return `${prefix}-${ts}${rand}`;
}

export function toLocalDateTimeInputValue(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

export function toLocalDateInputValue(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function formatDateTimeAU(isoString: string): string {
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return isoString;
  return new Intl.DateTimeFormat('en-AU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
}

export function formatDateAU(isoOrDate: string): string {
  const d = new Date(isoOrDate.length === 10 ? `${isoOrDate}T12:00:00` : isoOrDate);
  if (Number.isNaN(d.getTime())) return isoOrDate;
  return new Intl.DateTimeFormat('en-AU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

function escapeCSVField(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportTransactionsToCSV(transactions: ATMTransaction[]): void {
  const headers = [
    'ID',
    'Type',
    'Timestamp',
    'Staff Member',
    '$20 Notes',
    '$50 Notes',
    'Total AUD ($)',
    'Reference / Notes',
    'Details / Status',
    'Sync Status',
  ];

  const rows = transactions.map((tx) => {
    let details = '';
    if (tx.type === 'withdrawal') {
      details =
        tx.entryMode === 'amount'
          ? `EOD ${tx.settlementDate} (Total $ Mode - Est. Split)`
          : `EOD ${tx.settlementDate} (Note Count Mode)`;
    } else if (tx.type === 'cycle_count') {
      details =
        tx.status === 'matched'
          ? `Exact Match (Main: ${tx.mainCassette20}x$20/${tx.mainCassette50}x$50, Reject: ${tx.rejectBin20}x$20/${tx.rejectBin50}x$50)`
          : `Variance ${tx.varianceTotal >= 0 ? '+' : ''}$${tx.varianceTotal} (${tx.varianceNotes20}x$20, ${tx.varianceNotes50}x$50)${tx.adjusted ? ' - Adjusted' : ''}`;
    } else if (tx.type === 'adjustment') {
      details = `Reconciliation Adjustment: ${tx.reason}`;
    } else {
      details = 'Cash Replenishment';
    }

    return [
      tx.id,
      tx.type,
      tx.timestamp,
      tx.staffName,
      tx.notes20,
      tx.notes50,
      tx.totalAmount,
      tx.reference ?? '',
      details,
      tx.syncStatus,
    ]
      .map(escapeCSVField)
      .join(',');
  });

  const csvContent = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `kwik-stop-atm-log-${toLocalDateInputValue()}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportFullBackupJSON(state: ATMModuleState): void {
  const payload = {
    application: 'Kwik Stop ATM Cash Tracker',
    currency: 'AUD',
    supportedDenominations: [20, 50],
    exportedAt: new Date().toISOString(),
    data: state,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `kwik-stop-atm-backup-${toLocalDateInputValue()}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function generateSampleStoreState(
  existingSettings?: ATMModuleSettings
): ATMModuleState {
  const now = Date.now();
  const hoursAgo = (h: number) => new Date(now - h * 3600 * 1000).toISOString();
  const dateOfHoursAgo = (h: number) => toLocalDateInputValue(new Date(now - h * 3600 * 1000));

  const tx1: ATMTransaction = {
    id: 'FD-1001',
    type: 'feed',
    timestamp: hoursAgo(96),
    createdAt: hoursAgo(96),
    staffName: 'Store Manager',
    notes20: 100,
    notes50: 120,
    totalAmount: calculateCashTotal(100, 120),
    reference: 'ANZ Bank Slip #4092',
    syncStatus: 'not_configured',
  };

  const tx2: ATMTransaction = {
    id: 'WD-1002',
    type: 'withdrawal',
    timestamp: hoursAgo(72),
    createdAt: hoursAgo(72),
    settlementDate: dateOfHoursAgo(72),
    staffName: 'Staff 1',
    entryMode: 'notes',
    notes20: 34,
    notes50: 38,
    totalAmount: calculateCashTotal(34, 38),
    reference: 'EOD Batch #881',
    syncStatus: 'not_configured',
  };

  const tx3: ATMTransaction = {
    id: 'WD-1003',
    type: 'withdrawal',
    timestamp: hoursAgo(48),
    createdAt: hoursAgo(48),
    settlementDate: dateOfHoursAgo(48),
    staffName: 'Staff 2',
    entryMode: 'notes',
    notes20: 21,
    notes50: 27,
    totalAmount: calculateCashTotal(21, 27),
    reference: 'EOD Batch #882',
    syncStatus: 'not_configured',
  };

  const tx4: ATMTransaction = {
    id: 'CC-1004',
    type: 'cycle_count',
    timestamp: hoursAgo(26),
    createdAt: hoursAgo(26),
    staffName: 'Store Manager',
    mainCassette20: 44,
    mainCassette50: 54,
    rejectBin20: 1,
    rejectBin50: 1,
    physicalNotes20: 45,
    physicalNotes50: 55,
    physicalTotal: calculateCashTotal(45, 55),
    expectedNotes20: 45,
    expectedNotes50: 55,
    expectedTotal: calculateCashTotal(45, 55),
    notes20: 45,
    notes50: 55,
    totalAmount: calculateCashTotal(45, 55),
    varianceNotes20: 0,
    varianceNotes50: 0,
    varianceTotal: 0,
    status: 'matched',
    reference: 'Mid-week safe audit',
    syncStatus: 'not_configured',
  };

  const tx5: ATMTransaction = {
    id: 'WD-1005',
    type: 'withdrawal',
    timestamp: hoursAgo(10),
    createdAt: hoursAgo(10),
    settlementDate: dateOfHoursAgo(10),
    staffName: 'Staff 1',
    entryMode: 'notes',
    notes20: 18,
    notes50: 24,
    totalAmount: calculateCashTotal(18, 24),
    reference: 'EOD Batch #883',
    syncStatus: 'not_configured',
  };

  return {
    inventory: {
      expectedNotes20: 27,
      expectedNotes50: 31,
    },
    transactions: [tx5, tx4, tx3, tx2, tx1],
    settings: existingSettings ?? DEFAULT_MODULE_STATE.settings,
  };
}
