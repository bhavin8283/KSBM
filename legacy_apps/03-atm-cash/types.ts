export type ModuleTabId =
  | 'dashboard'
  | 'feed'
  | 'withdrawal'
  | 'cycle_count'
  | 'history'
  | 'config';

export type TransactionType = 'feed' | 'withdrawal' | 'cycle_count' | 'adjustment';

export type WebhookSyncStatus = 'synced' | 'pending' | 'failed' | 'not_configured' | 'disabled';

export type KSBMStaffRole = 'master' | 'manager' | 'staff';

export interface KSBMPermissions {
  viewDashboard: boolean;
  feedCash: boolean;
  recordWithdrawal: boolean;
  runCycleCount: boolean;
  approveAdjustment: boolean;
  viewHistory: boolean;
  exportData: boolean;
  manageModuleSettings: boolean;
}

export interface KSBMUser {
  id: string;
  name: string;
  role: KSBMStaffRole;
  /** Optional 4-digit PIN passed by KSBM Master Shell if supervisor adjustment re-verification is enabled */
  pin?: string;
  /** Optional granular permission overrides from KSBM Master Shell */
  permissions?: Partial<KSBMPermissions>;
}

export interface ATMInventory {
  expectedNotes20: number;
  expectedNotes50: number;
}

export interface LowCashThresholds {
  minTotalCash: number;
  minNotes20: number;
  minNotes50: number;
}

export interface KSBMBusinessConfig {
  storeName?: string;
  /** Authoritative list of staff names managed centrally in KSBM */
  staffMembers?: string[];
  /** Optional centralized alert thresholds from Master Admin businessConfig */
  atmThresholds?: Partial<LowCashThresholds>;
  /** Optional centralized Google Sheets/Drive backup config from Master Admin businessConfig */
  googleSync?: {
    webhookUrl?: string;
    spreadsheetId?: string;
    autoSyncEnabled?: boolean;
    autoPullOnOpen?: boolean;
  };
  /** Optional localStorage key suffix for multi-store isolation inside KSBM */
  storageNamespace?: string;
}

export interface ATMModuleSettings {
  thresholds: LowCashThresholds;
  webhookUrl: string;
  spreadsheetId?: string;
  autoSyncEnabled: boolean;
  autoPullOnOpen?: boolean;
  lastSyncedAt: string | null;
}

export interface BaseTransaction {
  id: string;
  type: TransactionType;
  timestamp: string;
  createdAt: string;
  staffName: string;
  notes20: number;
  notes50: number;
  totalAmount: number;
  reference?: string;
  syncStatus: WebhookSyncStatus;
  syncError?: string;
}

export interface FeedTransaction extends BaseTransaction {
  type: 'feed';
}

export interface WithdrawalTransaction extends BaseTransaction {
  type: 'withdrawal';
  settlementDate: string;
  entryMode: 'notes' | 'amount';
  estimatedBreakdown?: boolean;
}

export interface CycleCountTransaction extends BaseTransaction {
  type: 'cycle_count';
  mainCassette20: number;
  mainCassette50: number;
  rejectBin20: number;
  rejectBin50: number;
  physicalNotes20: number;
  physicalNotes50: number;
  physicalTotal: number;
  expectedNotes20: number;
  expectedNotes50: number;
  expectedTotal: number;
  varianceNotes20: number;
  varianceNotes50: number;
  varianceTotal: number;
  status: 'matched' | 'discrepancy';
  adjusted?: boolean;
  adjustmentReason?: string;
  adjustedBy?: string;
  adjustedAt?: string;
}

export interface AdjustmentTransaction extends BaseTransaction {
  type: 'adjustment';
  cycleCountId: string;
  previousExpected20: number;
  previousExpected50: number;
  newExpected20: number;
  newExpected50: number;
  reason: string;
}

export type ATMTransaction =
  | FeedTransaction
  | WithdrawalTransaction
  | CycleCountTransaction
  | AdjustmentTransaction;

export interface ATMModuleState {
  inventory: ATMInventory;
  transactions: ATMTransaction[];
  settings: ATMModuleSettings;
}

export interface ToastMessage {
  id: string;
  kind: 'success' | 'warning' | 'error' | 'info';
  title: string;
  detail?: string;
}

export interface ATMDashboardSummary {
  expectedTotalAUD: number;
  expectedNotes20: number;
  expectedNotes50: number;
  isLowCash: boolean;
  lowCashReasons: string[];
  avgDailyWithdrawalAUD: number;
  estimatedRunwayDays: number | null;
  lastCycleCountStatus: 'matched' | 'discrepancy' | 'none';
  lastCycleCountVarianceAUD: number | null;
  lastCycleCountAt: string | null;
}
