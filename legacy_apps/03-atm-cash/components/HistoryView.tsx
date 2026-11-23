import React, { useMemo, useRef, useState } from 'react';
import { Check, Copy, Download, FileJson, Search, Upload, X } from 'lucide-react';
import { ATMModuleState, ATMTransaction } from '../types';
import { formatCurrencyAUD } from '../utils/denominations';
import {
  exportFullBackupJSON,
  exportTransactionsToCSV,
  formatDateTimeAU,
  formatTransactionShareText,
  parseBackupJson,
  ParsedBackupResult,
} from '../utils/storage';

interface HistoryViewProps {
  state: ATMModuleState;
  canExport: boolean;
  canRestore: boolean;
  onRestoreState: (restored: ATMModuleState, sourceLabel: string) => void;
}

type HistoryFilter = 'all' | 'feed' | 'withdrawal' | 'cycle_count';

export const HistoryView: React.FC<HistoryViewProps> = ({
  state,
  canExport,
  canRestore,
  onRestoreState,
}) => {
  const [filterType, setFilterType] = useState<HistoryFilter>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingRestore, setPendingRestore] = useState<ParsedBackupResult | null>(null);
  const [restoreError, setRestoreError] = useState<string>('');
  const [copiedTxId, setCopiedTxId] = useState<string | null>(null);

  const handleCopyTx = async (tx: ATMTransaction) => {
    try {
      await navigator.clipboard.writeText(formatTransactionShareText(tx));
      setCopiedTxId(tx.id);
      setTimeout(() => setCopiedTxId(null), 2000);
    } catch {
      // Ignore clipboard failure
    }
  };

  const filteredTransactions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return state.transactions.filter((tx) => {
      if (filterType === 'feed' && tx.type !== 'feed') return false;
      if (filterType === 'withdrawal' && tx.type !== 'withdrawal') return false;
      if (
        filterType === 'cycle_count' &&
        tx.type !== 'cycle_count' &&
        tx.type !== 'adjustment'
      ) {
        return false;
      }

      if (query) {
        const hay = [tx.staffName, tx.reference ?? '', tx.id]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(query)) return false;
      }

      if (fromDate) {
        const txDate = new Date(tx.timestamp);
        const start = new Date(`${fromDate}T00:00:00`);
        if (txDate < start) return false;
      }

      if (toDate) {
        const txDate = new Date(tx.timestamp);
        const end = new Date(`${toDate}T23:59:59.999`);
        if (txDate > end) return false;
      }

      return true;
    });
  }, [state.transactions, filterType, searchQuery, fromDate, toDate]);

  const hasActiveFilters =
    filterType !== 'all' || searchQuery.trim() !== '' || fromDate !== '' || toDate !== '';

  const clearFilters = () => {
    setFilterType('all');
    setSearchQuery('');
    setFromDate('');
    setToDate('');
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = parseBackupJson(text, state.settings);
      if (!parsed.ok) {
        setRestoreError(parsed.error || 'Invalid backup file.');
        setPendingRestore(null);
      } else {
        setRestoreError('');
        setPendingRestore(parsed);
      }
    } catch {
      setRestoreError('Could not read selected file.');
      setPendingRestore(null);
    }
  };

  const renderTypeTitle = (tx: ATMTransaction): string => {
    switch (tx.type) {
      case 'feed':
        return 'Cash Feed';
      case 'withdrawal':
        return tx.entryMode === 'amount' ? 'Withdrawal (Est.)' : 'Daily Withdrawal';
      case 'cycle_count':
        return tx.status === 'matched' ? 'Cycle Count (Matched)' : 'Cycle Count (Variance)';
      case 'adjustment':
        return 'Balance Adjustment';
    }
  };

  const renderSyncLabel = (tx: ATMTransaction): { text: string; color: string } => {
    switch (tx.syncStatus) {
      case 'synced':
        return { text: 'Synced', color: 'text-emerald-700' };
      case 'failed':
        return { text: 'Sync failed', color: 'text-red-700' };
      case 'pending':
        return { text: 'Syncing...', color: 'text-amber-700' };
      case 'disabled':
        return { text: 'Auto-sync off', color: 'text-slate-500' };
      default:
        return { text: 'Local only', color: 'text-slate-500' };
    }
  };

  return (
    <div className="space-y-3.5 sm:space-y-5">
      {/* Filter & Export Controls */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-5 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          {/* Segmented Filter */}
          <div className="grid grid-cols-4 sm:flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'feed', label: 'Feeds' },
                { id: 'withdrawal', label: 'EOD' },
                { id: 'cycle_count', label: 'Audits' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterType(tab.id)}
                className={`min-h-[36px] px-2 sm:px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  filterType === tab.id
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Export & Restore Buttons gated by permissions */}
          {(canExport || canRestore) && (
            <div className="flex flex-wrap items-center gap-2">
              {canExport && (
                <>
                  <button
                    type="button"
                    disabled={filteredTransactions.length === 0}
                    onClick={() => exportTransactionsToCSV(filteredTransactions)}
                    className="min-h-[40px] px-3 sm:px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 text-xs font-bold hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
                  >
                    <Download className="w-3.5 h-3.5 shrink-0" />
                    <span>CSV</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => exportFullBackupJSON(state)}
                    className="min-h-[40px] px-3 sm:px-3.5 py-2 rounded-lg bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
                  >
                    <FileJson className="w-3.5 h-3.5 shrink-0" />
                    <span>Backup</span>
                  </button>
                </>
              )}
              {canRestore && (
                <>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="min-h-[40px] px-3 sm:px-3.5 py-2 rounded-lg border border-emerald-700 bg-emerald-50 text-emerald-900 text-xs font-bold hover:bg-emerald-100 transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
                  >
                    <Upload className="w-3.5 h-3.5 shrink-0" />
                    <span>Restore</span>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json,application/json"
                    onChange={handleFileSelected}
                    className="hidden"
                  />
                </>
              )}
            </div>
          )}
        </div>

        {/* Restore Preview / Error */}
        {restoreError && (
          <p
            role="alert"
            className="text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2"
          >
            {restoreError}
          </p>
        )}

        {pendingRestore?.ok && pendingRestore.state && pendingRestore.meta && (
          <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-3.5 space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <p className="text-xs sm:text-sm font-bold text-emerald-950">
                  Ready to Restore: {pendingRestore.meta.sourceLabel}
                </p>
                <p className="text-xs text-emerald-900 font-mono tabular-nums mt-0.5">
                  {pendingRestore.meta.transactionCount} entries · Expected{' '}
                  {formatCurrencyAUD(pendingRestore.meta.expectedTotalAUD)} (
                  {pendingRestore.meta.expectedNotes20}×$20, {pendingRestore.meta.expectedNotes50}×$50)
                  {pendingRestore.meta.exportedAt
                    ? ` · Saved ${formatDateTimeAU(pendingRestore.meta.exportedAt)}`
                    : ''}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setPendingRestore(null)}
                  className="min-h-[38px] px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onRestoreState(pendingRestore.state!, pendingRestore.meta!.sourceLabel);
                    setPendingRestore(null);
                  }}
                  className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-emerald-700 text-white text-xs font-bold hover:bg-emerald-800"
                >
                  Confirm Restore
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Search & Date Range */}
        <div className="grid grid-cols-2 sm:grid-cols-12 gap-2 sm:gap-3 pt-2 border-t border-slate-100">
          <div className="col-span-2 sm:col-span-5 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              aria-label="Search by staff name, reference, or ID"
              placeholder="Search staff, ref #, or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full min-h-[40px] pl-9 pr-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <div className="sm:col-span-3">
            <input
              type="date"
              aria-label="Filter from date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full min-h-[40px] px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs sm:text-sm font-mono tabular-nums text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <div className="sm:col-span-3">
            <input
              type="date"
              aria-label="Filter to date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full min-h-[40px] px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs sm:text-sm font-mono tabular-nums text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          {hasActiveFilters && (
            <div className="col-span-2 sm:col-span-1 flex items-center justify-end">
              <button
                type="button"
                onClick={clearFilters}
                aria-label="Clear filters"
                className="w-full sm:w-auto min-h-[38px] px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-1 whitespace-nowrap"
              >
                <X className="w-3.5 h-3.5" />
                <span className="sm:hidden">Clear Filters</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Transaction Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 sm:px-6 sm:py-3.5 border-b border-slate-200 flex items-center justify-between text-[11px] sm:text-xs text-slate-600">
          <span className="font-semibold text-slate-900">
            {filteredTransactions.length} of {state.transactions.length} entries
          </span>
          <span>AUD · $20 &amp; $50</span>
        </div>

        {filteredTransactions.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm font-semibold text-slate-900">No matching transactions found</p>
            <p className="text-xs text-slate-600 mt-1">
              {state.transactions.length === 0
                ? 'Cash feeds, EOD withdrawals, and cycle counts will appear here once recorded.'
                : 'Try adjusting your search query, type filter, or date range.'}
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="mt-3 min-h-[40px] px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Clear All Filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <th className="py-3 px-5">Date &amp; Time</th>
                    <th className="py-3 px-4">Type &amp; Details</th>
                    <th className="py-3 px-4">Staff</th>
                    <th className="py-3 px-3 text-right">$20s</th>
                    <th className="py-3 px-3 text-right">$50s</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                    <th className="py-3 px-4 text-right">Sync</th>
                    <th className="py-3 px-4 text-right">Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-sm">
                  {filteredTransactions.map((tx) => {
                    const syncInfo = renderSyncLabel(tx);
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
                        : tx.type === 'cycle_count'
                          ? tx.status === 'matched'
                            ? 'text-emerald-700'
                            : 'text-red-700'
                          : tx.type === 'adjustment'
                            ? 'text-amber-700'
                            : 'text-slate-900';

                    return (
                      <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-5 font-mono tabular-nums text-xs text-slate-700 whitespace-nowrap">
                          {formatDateTimeAU(tx.timestamp)}
                          <span className="block text-[11px] text-slate-400">{tx.id}</span>
                        </td>
                        <td className="py-3 px-4">
                          <p
                            className={`font-semibold ${
                              tx.type === 'cycle_count' && tx.status === 'discrepancy'
                                ? 'text-red-700'
                                : 'text-slate-900'
                            }`}
                          >
                            {renderTypeTitle(tx)}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {tx.type === 'cycle_count' && (
                              <span className="font-mono tabular-nums">
                                Variance: {tx.varianceTotal >= 0 ? '+' : ''}
                                {formatCurrencyAUD(tx.varianceTotal)}
                                {tx.adjusted ? ' (Adjusted)' : ''}
                                {tx.reference ? ` · ${tx.reference}` : ''}
                              </span>
                            )}
                            {tx.type === 'adjustment' && <span>{tx.reason}</span>}
                            {(tx.type === 'feed' || tx.type === 'withdrawal') &&
                              (tx.reference ||
                                (tx.type === 'withdrawal'
                                  ? `EOD ${tx.settlementDate}`
                                  : 'Cassette load'))}
                          </p>
                        </td>
                        <td className="py-3 px-4 text-slate-800 whitespace-nowrap">
                          {tx.staffName}
                        </td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-700">
                          {tx.notes20}
                        </td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-700">
                          {tx.notes50}
                        </td>
                        <td
                          className={`py-3 px-4 text-right font-mono tabular-nums font-bold ${amountColor}`}
                        >
                          {amountPrefix}
                          {formatCurrencyAUD(tx.totalAmount)}
                        </td>
                        <td
                          className={`py-3 px-4 text-right text-xs font-medium whitespace-nowrap ${syncInfo.color}`}
                        >
                          {syncInfo.text}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => {
                              void handleCopyTx(tx);
                            }}
                            aria-label={`Copy ${renderTypeTitle(tx)} summary`}
                            title="Copy summary for WhatsApp / SMS"
                            className="inline-flex items-center justify-center min-h-[34px] min-w-[34px] p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                          >
                            {copiedTxId === tx.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-700" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="md:hidden divide-y divide-slate-200">
              {filteredTransactions.map((tx) => {
                const syncInfo = renderSyncLabel(tx);
                const amountPrefix =
                  tx.type === 'feed'
                    ? '+'
                    : tx.type === 'withdrawal'
                      ? '-'
                      : tx.type === 'adjustment' && tx.totalAmount >= 0
                        ? '+'
                        : '';
                return (
                  <div key={tx.id} className="px-3.5 py-3 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                          {renderTypeTitle(tx)}
                        </p>
                        <p className="text-[11px] text-slate-600 truncate">
                          {tx.staffName} · <span className={syncInfo.color}>{syncInfo.text}</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <p className="text-sm font-bold font-mono tabular-nums text-slate-900">
                          {amountPrefix}
                          {formatCurrencyAUD(tx.totalAmount)}
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            void handleCopyTx(tx);
                          }}
                          aria-label={`Copy ${renderTypeTitle(tx)} summary`}
                          title="Copy summary for WhatsApp / SMS"
                          className="min-h-[34px] min-w-[34px] p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 flex items-center justify-center transition-colors"
                        >
                          {copiedTxId === tx.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-700" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-600 font-mono tabular-nums truncate">
                      {formatDateTimeAU(tx.timestamp)} · {tx.notes20}×$20 · {tx.notes50}×$50
                    </p>
                    {tx.reference && (
                      <p className="text-[11px] text-slate-500 truncate">Ref: {tx.reference}</p>
                    )}
                    {tx.type === 'adjustment' && (
                      <p className="text-[11px] text-amber-800">Reason: {tx.reason}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
