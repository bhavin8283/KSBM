import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  ClipboardCheck,
  History,
  Info,
  LayoutDashboard,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import {
  AdjustmentTransaction,
  ATMDashboardSummary,
  ATMInventory,
  ATMModuleSettings,
  ATMModuleState,
  ATMTransaction,
  CycleCountTransaction,
  FeedTransaction,
  KSBMBusinessConfig,
  KSBMPermissions,
  KSBMUser,
  ModuleTabId,
  ToastMessage,
  WebhookSyncStatus,
  WithdrawalTransaction,
} from './types';
import { calculateCashTotal, formatCurrencyAUD } from './utils/denominations';
import {
  canAccessModuleTab,
  computeATMDashboardSummary,
  createTransactionId,
  DEFAULT_MODULE_STATE,
  generateSampleStoreState,
  getATMDashboardSummary,
  loadATMModuleState,
  mergeBusinessConfig,
  parseBackupJson,
  resolveModulePermissions,
  saveATMModuleState,
} from './utils/storage';
import {
  fetchLatestBackupFromWebhook,
  syncAllHistoryToWebhook,
  syncTransactionToWebhook,
  testWebhookConnection,
} from './utils/webhook';
import { DashboardView } from './components/DashboardView';
import { FeedCashView } from './components/FeedCashView';
import { DailyWithdrawalView } from './components/DailyWithdrawalView';
import { CycleCountView } from './components/CycleCountView';
import { HistoryView } from './components/HistoryView';
import { ModuleConfigView } from './components/ModuleConfigView';

export type {
  ATMDashboardSummary,
  KSBMBusinessConfig,
  KSBMPermissions,
  KSBMUser,
  ModuleTabId,
};
export { computeATMDashboardSummary, getATMDashboardSummary };

export interface ModuleEntryProps {
  currentUser: KSBMUser;
  businessConfig?: KSBMBusinessConfig;
  initialTab?: ModuleTabId;
  onSummaryChange?: (summary: ATMDashboardSummary) => void;
}

const SUB_TABS: Array<{
  id: ModuleTabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
  { id: 'feed', label: 'Feed Cash', icon: ArrowDownToLine },
  { id: 'withdrawal', label: 'Daily Withdrawal', icon: ArrowUpFromLine },
  { id: 'cycle_count', label: 'Cycle Count', icon: ClipboardCheck },
  { id: 'history', label: 'History', icon: History },
  { id: 'config', label: 'Sync & Limits', icon: SlidersHorizontal },
];

export const ModuleEntry: React.FC<ModuleEntryProps> = ({
  currentUser,
  businessConfig,
  initialTab = 'dashboard',
  onSummaryChange,
}) => {
  const permissions = useMemo(() => resolveModulePermissions(currentUser), [currentUser]);
  const [state, setState] = useState<ATMModuleState>(() => loadATMModuleState(businessConfig));
  const [activeTab, setActiveTab] = useState<ModuleTabId>(initialTab);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const storageNamespace = businessConfig?.storageNamespace;
  const staffMembers = useMemo(() => {
    const base = businessConfig?.staffMembers ?? [];
    return Array.from(new Set([currentUser.name, ...base].filter(Boolean)));
  }, [businessConfig?.staffMembers, currentUser.name]);

  // Reload state cleanly if store namespace changes inside multi-store KSBM
  const prevNamespaceRef = useRef<string | undefined>(storageNamespace);
  useEffect(() => {
    if (prevNamespaceRef.current !== storageNamespace) {
      prevNamespaceRef.current = storageNamespace;
      setState(loadATMModuleState(businessConfig));
    } else {
      setState((prev) => ({
        ...prev,
        settings: mergeBusinessConfig(prev.settings, businessConfig),
      }));
    }
  }, [businessConfig, storageNamespace]);

  useEffect(() => {
    saveATMModuleState(state, storageNamespace);
    onSummaryChange?.(computeATMDashboardSummary(state));
  }, [state, storageNamespace, onSummaryChange]);

  const accessibleTabs = useMemo(
    () => SUB_TABS.filter((tab) => canAccessModuleTab(permissions, tab.id)),
    [permissions]
  );

  const effectiveTab: ModuleTabId = canAccessModuleTab(permissions, activeTab)
    ? activeTab
    : (accessibleTabs[0]?.id ?? 'dashboard');

  const addToast = useCallback((toast: Omit<ToastMessage, 'id'>) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev, { ...toast, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const getInitialSyncStatus = (settings: ATMModuleSettings): WebhookSyncStatus => {
    if (!settings.webhookUrl.trim()) return 'not_configured';
    if (!settings.autoSyncEnabled) return 'disabled';
    return 'pending';
  };

  const triggerAutoSync = useCallback(
    async (
      tx: ATMTransaction,
      nextInventory: ATMInventory,
      currentSettings: ATMModuleSettings,
      nextTransactions: ATMTransaction[]
    ) => {
      if (!currentSettings.webhookUrl.trim() || !currentSettings.autoSyncEnabled) {
        return;
      }

      const result = await syncTransactionToWebhook(
        currentSettings.webhookUrl,
        tx,
        nextInventory,
        currentSettings,
        nextTransactions
      );

      setState((prev) => ({
        ...prev,
        transactions: prev.transactions.map((item) =>
          item.id === tx.id
            ? {
                ...item,
                syncStatus: result.ok ? 'synced' : 'failed',
                syncError: result.ok ? undefined : result.message,
              }
            : item
        ),
        settings: result.ok
          ? { ...prev.settings, lastSyncedAt: result.syncedAt ?? new Date().toISOString() }
          : prev.settings,
      }));

      if (!result.ok) {
        addToast({
          kind: 'warning',
          title: 'Saved locally — Google Sync failed',
          detail: result.message,
        });
      }
    },
    [addToast]
  );

  const handlePullFromCloud = useCallback(
    async (silent = false, overrideUrl?: string) => {
      const url = (overrideUrl ?? state.settings.webhookUrl).trim();
      if (!url) {
        if (!silent) {
          addToast({
            kind: 'warning',
            title: 'Webhook URL Required',
            detail: 'Configure your Google Apps Script Webhook URL in Sync & Limits first.',
          });
        }
        return;
      }

      const res = await fetchLatestBackupFromWebhook(url);
      if (!res.ok || !res.rawJson) {
        if (!silent) {
          addToast({
            kind: 'error',
            title: 'Cloud Pull Failed',
            detail: res.message,
          });
        }
        return;
      }

      const parsed = parseBackupJson(res.rawJson, state.settings);
      if (!parsed.ok || !parsed.state) {
        if (!silent) {
          addToast({
            kind: 'error',
            title: 'Invalid Cloud Snapshot',
            detail: parsed.error || 'Could not parse backup from Google Drive.',
          });
        }
        return;
      }

      const cloudTime = parsed.meta?.exportedAt ? Date.parse(parsed.meta.exportedAt) : 0;
      const localNewestTxTime = state.transactions.reduce((max, tx) => {
        const t = Date.parse(tx.createdAt || tx.timestamp);
        return Number.isFinite(t) && t > max ? t : max;
      }, 0);
      const localSyncTime = state.settings.lastSyncedAt ? Date.parse(state.settings.lastSyncedAt) : 0;
      const localLatestTime = Math.max(localNewestTxTime, localSyncTime);

      if (silent && cloudTime <= localLatestTime) {
        return;
      }

      const total = calculateCashTotal(
        parsed.state.inventory.expectedNotes20,
        parsed.state.inventory.expectedNotes50
      );

      setState({
        ...parsed.state,
        settings: mergeBusinessConfig(parsed.state.settings, businessConfig),
      });
      addToast({
        kind: 'success',
        title: silent ? 'Synced Newer Data from Cloud' : 'Pulled Latest from Google Drive',
        detail: `${parsed.state.transactions.length} entries · Expected ${formatCurrencyAUD(total)}`,
      });
    },
    [addToast, businessConfig, state.settings, state.transactions]
  );

  const hasAutoPulledRef = useRef<boolean>(false);
  useEffect(() => {
    if (hasAutoPulledRef.current) return;
    hasAutoPulledRef.current = true;
    if (state.settings.autoPullOnOpen && state.settings.webhookUrl.trim()) {
      void handlePullFromCloud(true);
    }
  }, [handlePullFromCloud, state.settings.autoPullOnOpen, state.settings.webhookUrl]);

  const handleSelectTab = useCallback(
    (tab: ModuleTabId) => {
      if (!canAccessModuleTab(permissions, tab)) return;
      setActiveTab(tab);
    },
    [permissions]
  );

  const handleSubmitFeed = (data: {
    staffName: string;
    timestamp: string;
    notes20: number;
    notes50: number;
    reference: string;
  }) => {
    if (!permissions.feedCash) return;
    const totalAmount = calculateCashTotal(data.notes20, data.notes50);
    const syncStatus = getInitialSyncStatus(state.settings);

    const newTx: FeedTransaction = {
      id: createTransactionId('FD'),
      type: 'feed',
      timestamp: data.timestamp,
      createdAt: new Date().toISOString(),
      staffName: data.staffName,
      notes20: data.notes20,
      notes50: data.notes50,
      totalAmount,
      reference: data.reference || undefined,
      syncStatus,
    };

    const nextInventory: ATMInventory = {
      expectedNotes20: state.inventory.expectedNotes20 + data.notes20,
      expectedNotes50: state.inventory.expectedNotes50 + data.notes50,
    };

    const nextTransactions = [newTx, ...state.transactions];
    setState((prev) => ({
      ...prev,
      inventory: nextInventory,
      transactions: [newTx, ...prev.transactions],
    }));

    addToast({
      kind: 'success',
      title: `Cash Feed Logged (+${formatCurrencyAUD(totalAmount)})`,
      detail: `${data.notes20} × $20 & ${data.notes50} × $50 added by ${data.staffName}`,
    });

    void triggerAutoSync(newTx, nextInventory, state.settings, nextTransactions);
    setActiveTab('dashboard');
  };

  const handleSubmitWithdrawal = (data: {
    settlementDate: string;
    staffName: string;
    entryMode: 'notes' | 'amount';
    notes20: number;
    notes50: number;
    estimatedBreakdown: boolean;
    reference: string;
  }) => {
    if (!permissions.recordWithdrawal) return;
    const totalAmount = calculateCashTotal(data.notes20, data.notes50);
    const syncStatus = getInitialSyncStatus(state.settings);
    const now = new Date();
    const eventTimestamp = new Date(
      `${data.settlementDate}T${String(now.getHours()).padStart(2, '0')}:${String(
        now.getMinutes()
      ).padStart(2, '0')}:00`
    ).toISOString();

    const newTx: WithdrawalTransaction = {
      id: createTransactionId('WD'),
      type: 'withdrawal',
      timestamp: eventTimestamp,
      createdAt: now.toISOString(),
      settlementDate: data.settlementDate,
      staffName: data.staffName,
      entryMode: data.entryMode,
      estimatedBreakdown: data.estimatedBreakdown,
      notes20: data.notes20,
      notes50: data.notes50,
      totalAmount,
      reference: data.reference || undefined,
      syncStatus,
    };

    const nextInventory: ATMInventory = {
      expectedNotes20: state.inventory.expectedNotes20 - data.notes20,
      expectedNotes50: state.inventory.expectedNotes50 - data.notes50,
    };

    const nextTransactions = [newTx, ...state.transactions];
    setState((prev) => ({
      ...prev,
      inventory: nextInventory,
      transactions: [newTx, ...prev.transactions],
    }));

    addToast({
      kind: 'success',
      title: `Daily Withdrawal Logged (-${formatCurrencyAUD(totalAmount)})`,
      detail: `${data.notes20} × $20 & ${data.notes50} × $50 deducted for ${data.settlementDate}`,
    });

    void triggerAutoSync(newTx, nextInventory, state.settings, nextTransactions);
    setActiveTab('dashboard');
  };

  const handleSubmitCycleCount = (data: {
    staffName: string;
    mainCassette20: number;
    mainCassette50: number;
    rejectBin20: number;
    rejectBin50: number;
    reference: string;
  }): CycleCountTransaction => {
    const physicalNotes20 = data.mainCassette20 + data.rejectBin20;
    const physicalNotes50 = data.mainCassette50 + data.rejectBin50;
    const physicalTotal = calculateCashTotal(physicalNotes20, physicalNotes50);

    const expectedNotes20 = state.inventory.expectedNotes20;
    const expectedNotes50 = state.inventory.expectedNotes50;
    const expectedTotal = calculateCashTotal(expectedNotes20, expectedNotes50);

    const varianceNotes20 = physicalNotes20 - expectedNotes20;
    const varianceNotes50 = physicalNotes50 - expectedNotes50;
    const varianceTotal = physicalTotal - expectedTotal;
    const isExactMatch = varianceTotal === 0 && varianceNotes20 === 0 && varianceNotes50 === 0;

    const newTx: CycleCountTransaction = {
      id: createTransactionId('CC'),
      type: 'cycle_count',
      timestamp: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      staffName: data.staffName,
      mainCassette20: data.mainCassette20,
      mainCassette50: data.mainCassette50,
      rejectBin20: data.rejectBin20,
      rejectBin50: data.rejectBin50,
      physicalNotes20,
      physicalNotes50,
      physicalTotal,
      expectedNotes20,
      expectedNotes50,
      expectedTotal,
      notes20: physicalNotes20,
      notes50: physicalNotes50,
      totalAmount: physicalTotal,
      varianceNotes20,
      varianceNotes50,
      varianceTotal,
      status: isExactMatch ? 'matched' : 'discrepancy',
      reference: data.reference || undefined,
      syncStatus: getInitialSyncStatus(state.settings),
    };

    const nextTransactions = [newTx, ...state.transactions];
    setState((prev) => ({
      ...prev,
      transactions: [newTx, ...prev.transactions],
    }));

    addToast({
      kind: isExactMatch ? 'success' : 'error',
      title: isExactMatch ? 'Cycle Count Balanced' : 'Cycle Count Discrepancy Flagged',
      detail: isExactMatch
        ? `Physical count matched ${formatCurrencyAUD(physicalTotal)}`
        : `Variance of ${varianceTotal >= 0 ? '+' : ''}${formatCurrencyAUD(varianceTotal)} detected`,
    });

    void triggerAutoSync(newTx, state.inventory, state.settings, nextTransactions);
    return newTx;
  };

  const handleAdjustToPhysical = (data: {
    cycleCountId: string;
    supervisorName: string;
    reason: string;
  }) => {
    if (!permissions.approveAdjustment) return;
    const audit = state.transactions.find(
      (t): t is CycleCountTransaction => t.id === data.cycleCountId && t.type === 'cycle_count'
    );
    if (!audit) return;

    const delta20 = audit.physicalNotes20 - state.inventory.expectedNotes20;
    const delta50 = audit.physicalNotes50 - state.inventory.expectedNotes50;
    const deltaTotal = calculateCashTotal(delta20, delta50);
    const nowIso = new Date().toISOString();

    const adjustmentTx: AdjustmentTransaction = {
      id: createTransactionId('ADJ'),
      type: 'adjustment',
      cycleCountId: audit.id,
      timestamp: nowIso,
      createdAt: nowIso,
      staffName: data.supervisorName,
      notes20: delta20,
      notes50: delta50,
      totalAmount: deltaTotal,
      previousExpected20: state.inventory.expectedNotes20,
      previousExpected50: state.inventory.expectedNotes50,
      newExpected20: audit.physicalNotes20,
      newExpected50: audit.physicalNotes50,
      reason: data.reason,
      reference: `Audit ${audit.id}`,
      syncStatus: getInitialSyncStatus(state.settings),
    };

    const nextInventory: ATMInventory = {
      expectedNotes20: audit.physicalNotes20,
      expectedNotes50: audit.physicalNotes50,
    };

    const nextTransactions = [
      adjustmentTx,
      ...state.transactions.map((tx) =>
        tx.id === audit.id && tx.type === 'cycle_count'
          ? {
              ...tx,
              adjusted: true,
              adjustedBy: data.supervisorName,
              adjustmentReason: data.reason,
              adjustedAt: nowIso,
            }
          : tx
      ),
    ];

    setState((prev) => ({
      ...prev,
      inventory: nextInventory,
      transactions: [
        adjustmentTx,
        ...prev.transactions.map((tx) =>
          tx.id === audit.id && tx.type === 'cycle_count'
            ? {
                ...tx,
                adjusted: true,
                adjustedBy: data.supervisorName,
                adjustmentReason: data.reason,
                adjustedAt: nowIso,
              }
            : tx
        ),
      ],
    }));

    addToast({
      kind: 'success',
      title: 'Expected Balance Adjusted',
      detail: `ATM balance reconciled to ${formatCurrencyAUD(audit.physicalTotal)}`,
    });

    void triggerAutoSync(adjustmentTx, nextInventory, state.settings, nextTransactions);
  };

  const handleUpdateSettings = (nextSettings: ATMModuleSettings) => {
    setState((prev) => ({
      ...prev,
      settings: mergeBusinessConfig(nextSettings, businessConfig),
    }));
    addToast({
      kind: 'success',
      title: 'ATM Module Settings Saved',
    });
  };

  const handleTestWebhook = async (
    url: string,
    sheetId?: string
  ): Promise<{ ok: boolean; text: string }> => {
    const res = await testWebhookConnection(
      url,
      state.inventory,
      sheetId ?? state.settings.spreadsheetId
    );
    addToast({
      kind: res.ok ? 'success' : 'error',
      title: res.ok ? 'Webhook Connection Successful' : 'Webhook Connection Failed',
      detail: res.message,
    });
    return { ok: res.ok, text: res.message };
  };

  const handleSyncAllHistory = async (
    url: string,
    sheetId?: string
  ): Promise<{ ok: boolean; text: string }> => {
    const res = await syncAllHistoryToWebhook(
      url,
      state.transactions,
      state.inventory,
      {
        ...state.settings,
        spreadsheetId: sheetId ?? state.settings.spreadsheetId,
      }
    );
    if (res.ok) {
      const syncedAt = res.syncedAt ?? new Date().toISOString();
      setState((prev) => ({
        ...prev,
        transactions: prev.transactions.map((tx) => ({
          ...tx,
          syncStatus: 'synced',
          syncError: undefined,
        })),
        settings: {
          ...prev.settings,
          lastSyncedAt: syncedAt,
        },
      }));
      addToast({
        kind: 'success',
        title: 'Full History Synced',
        detail: res.message,
      });
    } else {
      addToast({
        kind: 'error',
        title: 'Full Sync Failed',
        detail: res.message,
      });
    }
    return { ok: res.ok, text: res.message };
  };

  const handleLoadSampleData = () => {
    const sample = generateSampleStoreState(state.settings);
    setState(sample);
    addToast({
      kind: 'info',
      title: 'Sample Store Ledger Loaded',
      detail: '5 sample entries populated ($2,090 expected balance)',
    });
    setActiveTab('dashboard');
  };

  const handleResetAllData = () => {
    setState({
      ...DEFAULT_MODULE_STATE,
      settings: mergeBusinessConfig(
        {
          ...DEFAULT_MODULE_STATE.settings,
          webhookUrl: state.settings.webhookUrl,
          spreadsheetId: state.settings.spreadsheetId,
          autoSyncEnabled: state.settings.autoSyncEnabled,
          autoPullOnOpen: state.settings.autoPullOnOpen,
        },
        businessConfig
      ),
    });
    addToast({
      kind: 'info',
      title: 'ATM Ledger Reset',
      detail: 'All balances and transaction logs cleared.',
    });
  };

  const handleRestoreState = (restored: ATMModuleState, sourceLabel: string) => {
    const mergedState: ATMModuleState = {
      ...restored,
      settings: mergeBusinessConfig(restored.settings, businessConfig),
    };
    setState(mergedState);
    const total = calculateCashTotal(
      mergedState.inventory.expectedNotes20,
      mergedState.inventory.expectedNotes50
    );
    addToast({
      kind: 'success',
      title: `Restored from ${sourceLabel}`,
      detail: `${mergedState.transactions.length} entries · Expected balance ${formatCurrencyAUD(total)}`,
    });
    setActiveTab('dashboard');
  };

  if (accessibleTabs.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-6 text-center text-sm text-slate-600">
        Your KSBM account does not currently have permission to view the ATM Cash Tracker module.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Internal Module Sub-Navigation (shown only when >1 sub-tab is permitted) */}
      {accessibleTabs.length > 1 && (
        <div
          role="tablist"
          aria-label="ATM Cash Tracker Views"
          className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-200"
        >
          {accessibleTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = effectiveTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => handleSelectTab(tab.id)}
                className={`min-h-[40px] px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Inline Module Notifications */}
      {toasts.length > 0 && (
        <div className="space-y-2" aria-live="polite">
          {toasts.map((toast) => {
            const colorClass =
              toast.kind === 'success'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                : toast.kind === 'warning'
                  ? 'bg-amber-50 border-amber-300 text-amber-950'
                  : toast.kind === 'error'
                    ? 'bg-red-50 border-red-300 text-red-950'
                    : 'bg-slate-100 border-slate-300 text-slate-900';

            const Icon =
              toast.kind === 'success'
                ? CheckCircle2
                : toast.kind === 'info'
                  ? Info
                  : AlertTriangle;

            return (
              <div
                key={toast.id}
                className={`rounded-xl border px-3.5 py-2.5 flex items-start justify-between gap-3 ${colorClass}`}
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <Icon className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-bold">{toast.title}</p>
                    {toast.detail && <p className="text-xs opacity-90 mt-0.5">{toast.detail}</p>}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => dismissToast(toast.id)}
                  aria-label="Dismiss notification"
                  className="p-1 rounded-md hover:bg-black/5 shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Active Module Sub-View */}
      {effectiveTab === 'dashboard' && permissions.viewDashboard && (
        <DashboardView
          state={state}
          permissions={permissions}
          onNavigate={handleSelectTab}
          onLoadSampleData={handleLoadSampleData}
          onPullFromCloud={() => handlePullFromCloud(false)}
        />
      )}

      {effectiveTab === 'feed' && permissions.feedCash && (
        <FeedCashView
          staffMembers={staffMembers}
          currentUser={currentUser}
          onSubmitFeed={handleSubmitFeed}
        />
      )}

      {effectiveTab === 'withdrawal' && permissions.recordWithdrawal && (
        <DailyWithdrawalView
          staffMembers={staffMembers}
          currentUser={currentUser}
          inventory={state.inventory}
          transactions={state.transactions}
          onSubmitWithdrawal={handleSubmitWithdrawal}
        />
      )}

      {effectiveTab === 'cycle_count' && permissions.runCycleCount && (
        <CycleCountView
          staffMembers={staffMembers}
          currentUser={currentUser}
          canApproveAdjustment={permissions.approveAdjustment}
          transactions={state.transactions}
          onSubmitCycleCount={handleSubmitCycleCount}
          onAdjustToPhysical={handleAdjustToPhysical}
        />
      )}

      {effectiveTab === 'history' && permissions.viewHistory && (
        <HistoryView
          state={state}
          canExport={permissions.exportData}
          canRestore={permissions.manageModuleSettings}
          onRestoreState={handleRestoreState}
        />
      )}

      {effectiveTab === 'config' && permissions.manageModuleSettings && (
        <ModuleConfigView
          state={state}
          settings={state.settings}
          businessConfig={businessConfig}
          onUpdateSettings={handleUpdateSettings}
          onTestWebhook={handleTestWebhook}
          onSyncAllHistory={handleSyncAllHistory}
          onPullFromCloud={(url) => handlePullFromCloud(false, url)}
          onLoadSampleData={handleLoadSampleData}
          onResetAllData={handleResetAllData}
          onRestoreState={handleRestoreState}
        />
      )}
    </div>
  );
};

export default ModuleEntry;
