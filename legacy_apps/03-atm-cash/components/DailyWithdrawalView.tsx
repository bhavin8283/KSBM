import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowUpFromLine, RotateCcw } from 'lucide-react';
import {
  ATMInventory,
  ATMTransaction,
  KSBMUser,
  WithdrawalTransaction,
} from '../types';
import {
  calculateCashTotal,
  estimateNoteBreakdown,
  formatCurrencyAUD,
  validateWithdrawalAmount,
} from '../utils/denominations';
import { formatDateAU, toLocalDateInputValue } from '../utils/storage';

interface DailyWithdrawalViewProps {
  staffMembers: string[];
  currentUser: KSBMUser;
  inventory: ATMInventory;
  transactions: ATMTransaction[];
  onSubmitWithdrawal: (data: {
    settlementDate: string;
    staffName: string;
    entryMode: 'notes' | 'amount';
    notes20: number;
    notes50: number;
    estimatedBreakdown: boolean;
    reference: string;
  }) => void;
}

export const DailyWithdrawalView: React.FC<DailyWithdrawalViewProps> = ({
  staffMembers,
  currentUser,
  inventory,
  transactions,
  onSubmitWithdrawal,
}) => {
  const isMaster = currentUser.role === 'master';
  const [settlementDate, setSettlementDate] = useState<string>(() => toLocalDateInputValue());
  const [entryMode, setEntryMode] = useState<'notes' | 'amount'>('notes');
  const [notes20Input, setNotes20Input] = useState<string>('');
  const [notes50Input, setNotes50Input] = useState<string>('');
  const [amountInput, setAmountInput] = useState<string>('');
  const [staffName, setStaffName] = useState<string>(currentUser.name || (staffMembers[0] ?? ''));
  const [reference, setReference] = useState<string>('');
  const [confirmDuplicateDate, setConfirmDuplicateDate] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    setStaffName(currentUser.name);
  }, [currentUser.id, currentUser.name]);

  const expectedTotal = calculateCashTotal(inventory.expectedNotes20, inventory.expectedNotes50);

  const existingForDate = useMemo(
    () =>
      transactions.filter(
        (tx): tx is WithdrawalTransaction =>
          tx.type === 'withdrawal' && tx.settlementDate === settlementDate
      ),
    [transactions, settlementDate]
  );

  const modeANotes20 = Math.max(0, Math.floor(Number(notes20Input) || 0));
  const modeANotes50 = Math.max(0, Math.floor(Number(notes50Input) || 0));
  const modeATotal = calculateCashTotal(modeANotes20, modeANotes50);

  const rawAmount = Number(amountInput);
  const amountValidation =
    amountInput.trim() === ''
      ? { valid: false, error: '' }
      : validateWithdrawalAmount(rawAmount);

  const modeBEstimate =
    amountValidation.valid && rawAmount > 0
      ? estimateNoteBreakdown(rawAmount, inventory.expectedNotes20, inventory.expectedNotes50)
      : null;

  const activeNotes20 = entryMode === 'notes' ? modeANotes20 : (modeBEstimate?.notes20 ?? 0);
  const activeNotes50 = entryMode === 'notes' ? modeANotes50 : (modeBEstimate?.notes50 ?? 0);
  const activeTotal = entryMode === 'notes' ? modeATotal : amountValidation.valid ? rawAmount : 0;

  const exceedsExpectedCash = activeTotal > expectedTotal;
  const exceedsNotes20 = activeNotes20 > inventory.expectedNotes20;
  const exceedsNotes50 = activeNotes50 > inventory.expectedNotes50;

  const handleReset = () => {
    setNotes20Input('');
    setNotes50Input('');
    setAmountInput('');
    setReference('');
    setSettlementDate(toLocalDateInputValue());
    setConfirmDuplicateDate(false);
    setError('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!settlementDate) {
      setError('Select a settlement date.');
      return;
    }
    if (!staffName.trim()) {
      setError('Select the staff member recording this settlement.');
      return;
    }
    if (existingForDate.length > 0 && !confirmDuplicateDate) {
      setError(
        `A Daily Withdrawal already exists for ${formatDateAU(settlementDate)}. Confirm below if this is a separate EOD batch.`
      );
      return;
    }

    if (entryMode === 'notes') {
      if (modeANotes20 <= 0 && modeANotes50 <= 0) {
        setError('Enter at least 1 dispensed $20 or $50 note from the EOD receipt.');
        return;
      }
      onSubmitWithdrawal({
        settlementDate,
        staffName,
        entryMode: 'notes',
        notes20: modeANotes20,
        notes50: modeANotes50,
        estimatedBreakdown: false,
        reference: reference.trim(),
      });
    } else {
      if (amountInput.trim() === '') {
        setError('Enter the total dollar amount dispensed.');
        return;
      }
      const check = validateWithdrawalAmount(rawAmount);
      if (!check.valid || !modeBEstimate) {
        setError(check.error ?? 'Invalid withdrawal amount.');
        return;
      }
      onSubmitWithdrawal({
        settlementDate,
        staffName,
        entryMode: 'amount',
        notes20: modeBEstimate.notes20,
        notes50: modeBEstimate.notes50,
        estimatedBreakdown: true,
        reference: reference.trim(),
      });
    }

    setNotes20Input('');
    setNotes50Input('');
    setAmountInput('');
    setReference('');
    setConfirmDuplicateDate(false);
    setError('');
  };

  return (
    <div className="max-w-3xl mx-auto">
      <form
        onSubmit={handleSubmit}
        className="bg-white border border-slate-200 rounded-xl p-4 sm:p-7 space-y-4 sm:space-y-5"
      >
        <div className="grid grid-cols-2 gap-2.5 sm:gap-5">
          <div className="min-w-0">
            <label
              htmlFor="ksbm-wd-date"
              className="block text-xs sm:text-sm font-semibold text-slate-900 mb-1.5 truncate"
            >
              Settlement Date
            </label>
            <input
              id="ksbm-wd-date"
              type="date"
              required
              value={settlementDate}
              onChange={(e) => {
                setSettlementDate(e.target.value);
                setConfirmDuplicateDate(false);
                setError('');
              }}
              className="w-full min-h-[44px] px-2.5 sm:px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 text-xs sm:text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
            />
          </div>

          <div className="min-w-0">
            <label
              htmlFor="ksbm-wd-staff"
              className="block text-xs sm:text-sm font-semibold text-slate-900 mb-1.5 truncate"
            >
              Recorded By
            </label>
            <select
              id="ksbm-wd-staff"
              required
              disabled={!isMaster}
              value={staffName}
              onChange={(e) => setStaffName(e.target.value)}
              className="w-full min-h-[44px] px-2.5 sm:px-3.5 py-2 rounded-lg border border-slate-300 bg-white disabled:bg-slate-100 disabled:text-slate-700 text-slate-900 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
            >
              {Array.from(new Set([currentUser.name, ...staffMembers])).map((member) => (
                <option key={member} value={member}>
                  {member}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Duplicate Date Warning */}
        {existingForDate.length > 0 && (
          <div
            role="alert"
            className="bg-amber-50 border border-amber-300 rounded-xl p-3 sm:p-4 space-y-2.5"
          >
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-amber-700 shrink-0 mt-0.5" />
              <div className="text-xs sm:text-sm text-amber-950">
                <p className="font-bold">
                  Duplicate EOD Date Check ({formatDateAU(settlementDate)})
                </p>
                <p className="text-xs text-amber-900 mt-0.5">
                  Already recorded for this date:{' '}
                  {existingForDate
                    .map(
                      (ex) =>
                        `${formatCurrencyAUD(ex.totalAmount)} by ${ex.staffName}${ex.reference ? ` (${ex.reference})` : ''}`
                    )
                    .join(', ')}
                  .
                </p>
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs font-semibold text-amber-950 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={confirmDuplicateDate}
                onChange={(e) => {
                  setConfirmDuplicateDate(e.target.checked);
                  setError('');
                }}
                className="h-4 w-4 rounded border-amber-400 text-amber-800 focus:ring-amber-600"
              />
              <span>I confirm this is a separate EOD batch for {formatDateAU(settlementDate)}</span>
            </label>
          </div>
        )}

        {/* Entry Mode Toggle */}
        <div>
          <span className="block text-xs sm:text-sm font-semibold text-slate-900 mb-1.5">
            Entry Mode
          </span>
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => {
                setEntryMode('notes');
                setError('');
              }}
              className={`min-h-[42px] px-2 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap truncate ${
                entryMode === 'notes'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              By Note Count
            </button>
            <button
              type="button"
              onClick={() => {
                setEntryMode('amount');
                setError('');
              }}
              className={`min-h-[42px] px-2 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap truncate ${
                entryMode === 'amount'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              By Total $ Amount
            </button>
          </div>
        </div>

        {/* Mode A Inputs */}
        {entryMode === 'notes' ? (
          <div className="grid grid-cols-2 gap-2.5 sm:gap-5">
            <div className="border border-slate-200 rounded-xl p-3 sm:p-4 bg-slate-50/50 space-y-2 min-w-0">
              <div className="flex items-baseline justify-between gap-1">
                <label
                  htmlFor="ksbm-wd-20"
                  className="text-xs sm:text-sm font-bold text-slate-900 truncate"
                >
                  $20 Dispensed
                </label>
                <span className="text-xs sm:text-sm font-bold font-mono tabular-nums text-slate-700 shrink-0">
                  {formatCurrencyAUD(modeANotes20 * 20)}
                </span>
              </div>
              <input
                id="ksbm-wd-20"
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                placeholder="0"
                value={notes20Input}
                onChange={(e) => {
                  setNotes20Input(e.target.value);
                  setError('');
                }}
                className="w-full min-h-[44px] sm:min-h-[48px] px-2.5 sm:px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 text-lg sm:text-xl font-bold font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
              />
              <p className="text-[11px] sm:text-xs text-slate-500 font-mono tabular-nums truncate">
                Avail: {inventory.expectedNotes20} notes
              </p>
            </div>

            <div className="border border-slate-200 rounded-xl p-3 sm:p-4 bg-slate-50/50 space-y-2 min-w-0">
              <div className="flex items-baseline justify-between gap-1">
                <label
                  htmlFor="ksbm-wd-50"
                  className="text-xs sm:text-sm font-bold text-slate-900 truncate"
                >
                  $50 Dispensed
                </label>
                <span className="text-xs sm:text-sm font-bold font-mono tabular-nums text-slate-700 shrink-0">
                  {formatCurrencyAUD(modeANotes50 * 50)}
                </span>
              </div>
              <input
                id="ksbm-wd-50"
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                placeholder="0"
                value={notes50Input}
                onChange={(e) => {
                  setNotes50Input(e.target.value);
                  setError('');
                }}
                className="w-full min-h-[44px] sm:min-h-[48px] px-2.5 sm:px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 text-lg sm:text-xl font-bold font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
              />
              <p className="text-[11px] sm:text-xs text-slate-500 font-mono tabular-nums truncate">
                Avail: {inventory.expectedNotes50} notes
              </p>
            </div>
          </div>
        ) : (
          <div className="border border-slate-200 rounded-xl p-3.5 sm:p-5 bg-slate-50/50 space-y-2.5">
            <label htmlFor="ksbm-wd-amount" className="block text-xs sm:text-sm font-bold text-slate-900">
              Total Dollar Amount Dispensed (AUD)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-lg sm:text-xl font-bold font-mono text-slate-500">
                $
              </span>
              <input
                id="ksbm-wd-amount"
                type="number"
                min={20}
                step={10}
                inputMode="numeric"
                placeholder="0"
                value={amountInput}
                onChange={(e) => {
                  setAmountInput(e.target.value);
                  setError('');
                }}
                className="w-full min-h-[46px] pl-8 pr-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 text-lg sm:text-xl font-bold font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
              />
            </div>

            {amountInput.trim() !== '' && !amountValidation.valid && amountValidation.error && (
              <p className="text-xs font-semibold text-red-700">{amountValidation.error}</p>
            )}

            {modeBEstimate && (
              <div className="pt-2 border-t border-slate-200 text-xs text-slate-700 space-y-0.5">
                <p className="font-semibold">
                  Est. Split:{' '}
                  <span className="font-mono tabular-nums">
                    {modeBEstimate.notes50}×$50 + {modeBEstimate.notes20}×$20 ={' '}
                    {formatCurrencyAUD(rawAmount)}
                  </span>
                </p>
                <p className="text-[11px] text-slate-500">
                  Use By Note Count when your EOD receipt lists note counts.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Total Summary Banner */}
        <div className="border border-slate-200 rounded-xl p-3.5 sm:p-5 bg-slate-900 text-white flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] sm:text-xs text-slate-300">Total EOD Deduction</p>
            <p className="text-xs sm:text-sm font-mono tabular-nums text-slate-200 mt-0.5 truncate">
              {activeNotes20}×$20 · {activeNotes50}×$50
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[11px] sm:text-xs text-slate-300">Dispensed</p>
            <p className="text-xl sm:text-3xl font-extrabold font-mono tabular-nums text-white mt-0.5">
              -{formatCurrencyAUD(activeTotal)}
            </p>
          </div>
        </div>

        {/* Non-blocking Inventory Warning */}
        {activeTotal > 0 && (exceedsExpectedCash || exceedsNotes20 || exceedsNotes50) && (
          <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 sm:p-4 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-amber-700 shrink-0 mt-0.5" />
            <div className="text-xs sm:text-sm text-amber-950">
              <p className="font-bold">Exceeds Current Expected ATM Balance</p>
              <p className="text-xs text-amber-900 mt-0.5">
                Expected is {formatCurrencyAUD(expectedTotal)} ({inventory.expectedNotes20}×$20,{' '}
                {inventory.expectedNotes50}×$50). You can still log this entry and reconcile via
                Cycle Count.
              </p>
            </div>
          </div>
        )}

        {/* Optional Receipt Ref */}
        <div>
          <label
            htmlFor="ksbm-wd-ref"
            className="block text-xs sm:text-sm font-semibold text-slate-900 mb-1.5"
          >
            ATM Receipt Ref / Batch # <span className="font-normal text-slate-500">(Optional)</span>
          </label>
          <input
            id="ksbm-wd-ref"
            type="text"
            placeholder="e.g., EOD Batch #884"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            className="w-full min-h-[44px] px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
          />
        </div>

        {error && (
          <p
            role="alert"
            className="text-xs sm:text-sm font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5"
          >
            {error}
          </p>
        )}

        <div className="grid grid-cols-2 sm:flex sm:items-center sm:justify-between gap-2.5 sm:gap-3 pt-1">
          <button
            type="button"
            onClick={handleReset}
            className="min-h-[44px] px-3 sm:px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs sm:text-sm font-semibold hover:bg-slate-50 transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap"
          >
            <RotateCcw className="w-4 h-4 shrink-0" />
            <span>Clear</span>
          </button>

          <button
            type="submit"
            className="min-h-[44px] sm:min-h-[48px] px-3 sm:px-6 py-2 rounded-lg bg-slate-900 text-white text-xs sm:text-sm font-bold hover:bg-slate-800 transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap"
          >
            <ArrowUpFromLine className="w-4 h-4 shrink-0" />
            <span>Submit Withdrawal</span>
          </button>
        </div>
      </form>
    </div>
  );
};
