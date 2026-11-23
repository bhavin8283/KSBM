import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  ClipboardCheck,
  CheckCircle2,
  ShieldAlert,
  ArrowRight,
  Database,
  Copy,
  Check,
  RefreshCw,
} from 'lucide-react';
import {
  ATMModuleState,
  ATMTransaction,
  CycleCountTransaction,
  KSBMPermissions,
  ModuleTabId,
} from '../types';
import { calculateCashTotal, formatCurrencyAUD } from '../utils/denominations';
import {
  calculateCashRunway,
  formatDateTimeAU,
  formatTransactionShareText,
} from '../utils/storage';

interface DashboardViewProps {
  state: ATMModuleState;
  permissions: KSBMPermissions;
  onNavigate: (tab: ModuleTabId) => void;
  onLoadSampleData: () => void;
  onPullFromCloud?: () => Promise<void>;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  state,
  permissions,
  onNavigate,
  onLoadSampleData,
  onPullFromCloud,
}) => {
  const { inventory, settings, transactions } = state;
  const [copiedTxId, setCopiedTxId] = useState<string | null>(null);
  const [isPulling, setIsPulling] = useState<boolean>(false);

  const canFeed = permissions.feedCash;
  const canWithdraw = permissions.recordWithdrawal;
  const canAudit = permissions.runCycleCount;
  const canHistory = permissions.viewHistory;
  const canSettings = permissions.manageModuleSettings;
  const hasQuickActions = canFeed || canWithdraw || canAudit;

  const totalCash = calculateCashTotal(inventory.expectedNotes20, inventory.expectedNotes50);
  const value20 = inventory.expectedNotes20 * 20;
  const value50 = inventory.expectedNotes50 * 50;
  const runway = calculateCashRunway(transactions, totalCash);

  const lowReasons: string[] = [];
  if (totalCash < settings.thresholds.minTotalCash) {
    lowReasons.push(
      `Total cash (${formatCurrencyAUD(totalCash)}) < ${formatCurrencyAUD(settings.thresholds.minTotalCash)}`
    );
  }
  if (inventory.expectedNotes20 < settings.thresholds.minNotes20) {
    lowReasons.push(
      `$20s (${inventory.expectedNotes20}) < ${settings.thresholds.minNotes20} min`
    );
  }
  if (inventory.expectedNotes50 < settings.thresholds.minNotes50) {
    lowReasons.push(
      `$50s (${inventory.expectedNotes50}) < ${settings.thresholds.minNotes50} min`
    );
  }

  const lastCycleCount = transactions.find(
    (tx): tx is CycleCountTransaction => tx.type === 'cycle_count'
  );

  const recentTransactions = transactions.slice(0, 5);
  const isLow = lowReasons.length > 0;
  const hasWebhook = Boolean(settings.webhookUrl.trim());

  const handleCopySummary = async (tx: ATMTransaction) => {
    const text = formatTransactionShareText(tx, inventory);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedTxId(tx.id);
      setTimeout(() => setCopiedTxId(null), 2000);
    } catch {
      // Ignore clipboard failure
    }
  };

  const handlePullClick = async () => {
    if (!onPullFromCloud) return;
    setIsPulling(true);
    try {
      await onPullFromCloud();
    } finally {
      setIsPulling(false);
    }
  };

  return (
    <div className="space-y-3.5 sm:space-y-5">
      {/* Low Cash Alert Banner */}
      {isLow && (
        <div
          role="alert"
          className="bg-amber-50 border border-amber-300 rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 sm:gap-4"
        >
          <div className="flex items-start gap-2.5 sm:gap-3">
            <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-amber-700 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <h2 className="text-xs sm:text-sm font-bold text-amber-950">Low Cash Alert</h2>
              <p className="text-xs sm:text-sm text-amber-900 mt-0.5">{lowReasons.join(' · ')}</p>
            </div>
          </div>
          {canFeed && (
            <button
              type="button"
              onClick={() => onNavigate('feed')}
              className="min-h-[40px] sm:min-h-[44px] px-3.5 py-1.5 rounded-lg bg-amber-900 text-white text-xs sm:text-sm font-semibold hover:bg-amber-950 transition-colors whitespace-nowrap shrink-0 self-start sm:self-center"
            >
              + Feed ATM Now
            </button>
          )}
        </div>
      )}

      {/* Primary KPI Cards: Compact 2-up note cards on mobile, 3-up on foldable unfolded/desktop */}
      <section
        aria-label="Expected ATM Cash Balances"
        className="grid grid-cols-2 md:grid-cols-3 gap-2.5 sm:gap-4"
      >
        {/* Total Expected Cash + Cash Runway Forecast */}
        <div className="col-span-2 md:col-span-1 bg-white border border-slate-200 rounded-xl p-3.5 sm:p-5 flex flex-col justify-between">
          <div className="flex items-baseline justify-between gap-2 md:block">
            <p className="text-xs sm:text-sm font-semibold text-slate-600">
              Expected Total Cash
            </p>
            <p
              className={`md:mt-2 text-2xl sm:text-3xl lg:text-4xl font-bold font-mono tabular-nums tracking-tight ${
                totalCash < settings.thresholds.minTotalCash ? 'text-amber-700' : 'text-slate-900'
              }`}
            >
              {formatCurrencyAUD(totalCash)}
            </p>
          </div>
          <div className="mt-2.5 sm:mt-3.5 pt-2 sm:pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px] sm:text-xs text-slate-600">
            <span className="font-mono tabular-nums">
              {inventory.expectedNotes20 + inventory.expectedNotes50} notes · Min{' '}
              {formatCurrencyAUD(settings.thresholds.minTotalCash)}
            </span>
            {runway.hasData && runway.daysRemaining !== null ? (
              <span
                className={`font-mono tabular-nums font-semibold ${
                  runway.daysRemaining <= 2 ? 'text-amber-700' : 'text-emerald-700'
                }`}
              >
                ~{runway.daysRemaining}d left ({formatCurrencyAUD(runway.avgDailyWithdrawal)}/day)
              </span>
            ) : (
              <span className="text-slate-500">Log EOD for cash runway</span>
            )}
          </div>
        </div>

        {/* Expected $20 Notes */}
        <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-5 flex flex-col justify-between min-w-0">
          <div>
            <p className="text-xs sm:text-sm font-semibold text-slate-600 truncate">
              $20 Notes
            </p>
            <div className="mt-1.5 sm:mt-2.5 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
              <p
                className={`text-xl sm:text-3xl font-bold font-mono tabular-nums ${
                  inventory.expectedNotes20 < settings.thresholds.minNotes20
                    ? 'text-amber-700'
                    : 'text-slate-900'
                }`}
              >
                {inventory.expectedNotes20}
                <span className="text-[11px] sm:text-sm font-medium text-slate-500 ml-1">
                  notes
                </span>
              </p>
              <p className="text-sm sm:text-lg font-bold font-mono tabular-nums text-slate-700">
                {formatCurrencyAUD(value20)}
              </p>
            </div>
          </div>
          <div className="mt-2.5 sm:mt-4 pt-2 sm:pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] sm:text-xs text-slate-600 gap-1">
            <span className="truncate">$20 AUD</span>
            <span className="font-mono tabular-nums shrink-0">
              Min {settings.thresholds.minNotes20}
            </span>
          </div>
        </div>

        {/* Expected $50 Notes */}
        <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-5 flex flex-col justify-between min-w-0">
          <div>
            <p className="text-xs sm:text-sm font-semibold text-slate-600 truncate">
              $50 Notes
            </p>
            <div className="mt-1.5 sm:mt-2.5 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
              <p
                className={`text-xl sm:text-3xl font-bold font-mono tabular-nums ${
                  inventory.expectedNotes50 < settings.thresholds.minNotes50
                    ? 'text-amber-700'
                    : 'text-slate-900'
                }`}
              >
                {inventory.expectedNotes50}
                <span className="text-[11px] sm:text-sm font-medium text-slate-500 ml-1">
                  notes
                </span>
              </p>
              <p className="text-sm sm:text-lg font-bold font-mono tabular-nums text-slate-700">
                {formatCurrencyAUD(value50)}
              </p>
            </div>
          </div>
          <div className="mt-2.5 sm:mt-4 pt-2 sm:pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] sm:text-xs text-slate-600 gap-1">
            <span className="truncate">$50 AUD</span>
            <span className="font-mono tabular-nums shrink-0">
              Min {settings.thresholds.minNotes50}
            </span>
          </div>
        </div>
      </section>

      {/* Quick Actions & Last Verified Cycle Count */}
      <section className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 sm:gap-4 items-stretch">
        {hasQuickActions && (
          <div className="sm:col-span-7 bg-white border border-slate-200 rounded-xl p-3.5 sm:p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm sm:text-base font-bold text-slate-900">Quick Actions</h2>
                <p className="hidden sm:block text-xs text-slate-600 mt-0.5">
                  Log cash movements immediately to maintain cassette accuracy
                </p>
              </div>
              {hasWebhook && onPullFromCloud && (
                <button
                  type="button"
                  disabled={isPulling}
                  onClick={handlePullClick}
                  className="min-h-[34px] px-2.5 py-1 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isPulling ? 'animate-spin' : ''}`} />
                  <span>{isPulling ? 'Syncing...' : 'Pull Cloud'}</span>
                </button>
              )}
            </div>
            <div className="mt-2.5 sm:mt-4 grid grid-cols-2 md:grid-cols-3 gap-2 sm:gap-2.5">
              {canFeed && (
                <button
                  type="button"
                  onClick={() => onNavigate('feed')}
                  className="min-h-[44px] px-2.5 sm:px-3.5 py-2 rounded-lg bg-emerald-700 text-white font-semibold text-xs sm:text-sm hover:bg-emerald-800 transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <ArrowDownToLine className="w-4 h-4 shrink-0" />
                  <span>+ Feed ATM</span>
                </button>
              )}
              {canWithdraw && (
                <button
                  type="button"
                  onClick={() => onNavigate('withdrawal')}
                  className="min-h-[44px] px-2.5 sm:px-3.5 py-2 rounded-lg bg-slate-900 text-white font-semibold text-xs sm:text-sm hover:bg-slate-800 transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <ArrowUpFromLine className="w-4 h-4 shrink-0" />
                  <span>- Withdrawal</span>
                </button>
              )}
              {canAudit && (
                <button
                  type="button"
                  onClick={() => onNavigate('cycle_count')}
                  className="col-span-2 md:col-span-1 min-h-[42px] sm:min-h-[44px] px-2.5 sm:px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 font-semibold text-xs sm:text-sm hover:bg-slate-50 transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <ClipboardCheck className="w-4 h-4 shrink-0" />
                  <span>Run Cycle Count</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Last Verified Cycle Count */}
        <div
          className={`${
            hasQuickActions ? 'sm:col-span-5' : 'sm:col-span-12'
          } bg-white border border-slate-200 rounded-xl p-3.5 sm:p-5 flex flex-col justify-between`}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                Last Verified Cycle Count
              </h2>
              {lastCycleCount ? (
                <p className="text-[11px] sm:text-xs text-slate-600 mt-0.5 font-mono tabular-nums truncate">
                  {formatDateTimeAU(lastCycleCount.timestamp)} · {lastCycleCount.staffName}
                </p>
              ) : (
                <p className="text-xs text-slate-600 mt-0.5">No physical audit recorded yet</p>
              )}
            </div>
            {!hasQuickActions && hasWebhook && onPullFromCloud && (
              <button
                type="button"
                disabled={isPulling}
                onClick={handlePullClick}
                className="min-h-[34px] px-2.5 py-1 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isPulling ? 'animate-spin' : ''}`} />
                <span>{isPulling ? 'Syncing...' : 'Pull Cloud'}</span>
              </button>
            )}
          </div>

          {lastCycleCount ? (
            <div className="mt-2.5 sm:mt-4 pt-2.5 sm:pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
              {lastCycleCount.status === 'matched' ? (
                <div className="flex items-center gap-1.5 text-emerald-700 font-semibold text-xs sm:text-sm min-w-0">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span className="truncate">
                    Matched ({formatCurrencyAUD(lastCycleCount.physicalTotal)})
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-red-700 font-semibold text-xs sm:text-sm min-w-0">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span className="truncate">
                    Discrepancy ({lastCycleCount.varianceTotal >= 0 ? '+' : ''}
                    {formatCurrencyAUD(lastCycleCount.varianceTotal)})
                    {lastCycleCount.adjusted ? ' · Adjusted' : ''}
                  </span>
                </div>
              )}
              {canAudit && (
                <button
                  type="button"
                  onClick={() => onNavigate('cycle_count')}
                  className="text-xs font-semibold text-slate-700 hover:text-slate-900 underline whitespace-nowrap shrink-0"
                >
                  New Audit
                </button>
              )}
            </div>
          ) : (
            <div className="mt-2.5 sm:mt-4 pt-2.5 sm:pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
              <span className="text-[11px] sm:text-xs text-slate-500 truncate">
                Blind physical safe check
              </span>
              {canAudit && (
                <button
                  type="button"
                  onClick={() => onNavigate('cycle_count')}
                  className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 underline whitespace-nowrap shrink-0"
                >
                  Start Count
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Recent Activity Feed */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900">Recent Activity</h2>
            <p className="text-[11px] sm:text-xs text-slate-600 mt-0.5">
              Last 5 movements · Tap copy icon to share summary via WhatsApp/SMS
            </p>
          </div>
          {transactions.length > 0 && canHistory && (
            <button
              type="button"
              onClick={() => onNavigate('history')}
              className="text-xs sm:text-sm font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 whitespace-nowrap shrink-0"
            >
              <span>View All</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>

        {recentTransactions.length === 0 ? (
          <div className="p-6 sm:p-10 text-center max-w-md mx-auto">
            <p className="text-sm font-semibold text-slate-900">No ATM cash movements logged yet</p>
            <p className="text-xs sm:text-sm text-slate-600 mt-1">
              {canFeed
                ? 'Start by feeding your initial cassette load of $20 and $50 AUD notes, or load sample store records to test tracking and cycle counts.'
                : 'No feeds, withdrawals, or cycle counts have been logged by a Manager or Master Admin yet.'}
            </p>
            {(canFeed || canSettings) && (
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {canFeed && (
                  <button
                    type="button"
                    onClick={() => onNavigate('feed')}
                    className="min-h-[44px] px-4 py-2 rounded-lg bg-emerald-700 text-white text-xs sm:text-sm font-semibold hover:bg-emerald-800 transition-colors whitespace-nowrap"
                  >
                    + Log First Cash Feed
                  </button>
                )}
                {canSettings && (
                  <button
                    type="button"
                    onClick={onLoadSampleData}
                    className="min-h-[44px] px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs sm:text-sm font-semibold hover:bg-slate-50 transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap"
                  >
                    <Database className="w-4 h-4 shrink-0" />
                    <span>Load Sample Data</span>
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {recentTransactions.map((tx) => {
              const typeLabel =
                tx.type === 'feed'
                  ? 'Cash Feed'
                  : tx.type === 'withdrawal'
                    ? 'Daily Withdrawal'
                    : tx.type === 'cycle_count'
                      ? 'Cycle Count'
                      : 'Balance Adjustment';

              const amountPrefix =
                tx.type === 'feed'
                  ? '+'
                  : tx.type === 'withdrawal'
                    ? '-'
                    : tx.type === 'adjustment' && tx.totalAmount >= 0
                      ? '+'
                      : '';

              const amountColor =
                tx.type === 'feed'
                  ? 'text-emerald-700'
                  : tx.type === 'withdrawal'
                    ? 'text-slate-900'
                    : tx.type === 'cycle_count'
                      ? tx.status === 'matched'
                        ? 'text-emerald-700'
                        : 'text-red-700'
                      : 'text-amber-700';

              return (
                <div
                  key={tx.id}
                  className="px-4 py-3 sm:px-6 sm:py-3.5 flex items-center justify-between gap-2.5 hover:bg-slate-50/70 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                      <span className="text-xs sm:text-sm font-semibold text-slate-900">
                        {typeLabel}
                      </span>
                      <span aria-hidden="true" className="text-slate-400">
                        ·
                      </span>
                      <span className="text-xs sm:text-sm text-slate-700 truncate">
                        {tx.staffName}
                      </span>
                      {tx.type === 'cycle_count' && (
                        <>
                          <span aria-hidden="true" className="text-slate-400">
                            ·
                          </span>
                          <span
                            className={`text-[11px] sm:text-xs font-semibold ${
                              tx.status === 'matched' ? 'text-emerald-700' : 'text-red-700'
                            }`}
                          >
                            {tx.status === 'matched'
                              ? 'Matched'
                              : `Variance ${tx.varianceTotal >= 0 ? '+' : ''}${formatCurrencyAUD(tx.varianceTotal)}`}
                          </span>
                        </>
                      )}
                    </div>
                    <p className="text-[11px] sm:text-xs text-slate-600 mt-0.5 font-mono tabular-nums truncate">
                      {formatDateTimeAU(tx.timestamp)} · {tx.notes20}×$20 · {tx.notes50}×$50
                      {tx.reference ? ` · ${tx.reference}` : ''}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      <p className={`text-sm sm:text-base font-bold font-mono tabular-nums ${amountColor}`}>
                        {amountPrefix}
                        {formatCurrencyAUD(tx.totalAmount)}
                      </p>
                      <p className="text-[10px] sm:text-xs text-slate-500 font-mono tabular-nums">
                        {tx.id}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        void handleCopySummary(tx);
                      }}
                      aria-label={`Copy ${typeLabel} summary`}
                      title="Copy summary for WhatsApp / SMS"
                      className="min-h-[36px] min-w-[36px] p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 flex items-center justify-center transition-colors"
                    >
                      {copiedTxId === tx.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-700" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
