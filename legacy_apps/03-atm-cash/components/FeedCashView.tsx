import React, { useEffect, useState } from 'react';
import { ArrowDownToLine, RotateCcw } from 'lucide-react';
import { KSBMUser } from '../types';
import { calculateCashTotal, formatCurrencyAUD } from '../utils/denominations';
import { toLocalDateTimeInputValue } from '../utils/storage';

interface FeedCashViewProps {
  staffMembers: string[];
  currentUser: KSBMUser;
  onSubmitFeed: (data: {
    staffName: string;
    timestamp: string;
    notes20: number;
    notes50: number;
    reference: string;
  }) => void;
}

export const FeedCashView: React.FC<FeedCashViewProps> = ({
  staffMembers,
  currentUser,
  onSubmitFeed,
}) => {
  const isMaster = currentUser.role === 'master';
  const [staffName, setStaffName] = useState<string>(currentUser.name || (staffMembers[0] ?? ''));
  const [dateTimeInput, setDateTimeInput] = useState<string>(() => toLocalDateTimeInputValue());
  const [notes20Input, setNotes20Input] = useState<string>('');
  const [notes50Input, setNotes50Input] = useState<string>('');
  const [reference, setReference] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    setStaffName(currentUser.name);
  }, [currentUser.id, currentUser.name]);

  const notes20 = Math.max(0, Math.floor(Number(notes20Input) || 0));
  const notes50 = Math.max(0, Math.floor(Number(notes50Input) || 0));
  const subtotal20 = notes20 * 20;
  const subtotal50 = notes50 * 50;
  const totalFed = calculateCashTotal(notes20, notes50);

  const increment20 = (delta: number) => {
    setNotes20Input(String(notes20 + delta));
    setError('');
  };

  const increment50 = (delta: number) => {
    setNotes50Input(String(notes50 + delta));
    setError('');
  };

  const handleReset = () => {
    setNotes20Input('');
    setNotes50Input('');
    setReference('');
    setDateTimeInput(toLocalDateTimeInputValue());
    setError('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffName.trim()) {
      setError('Please select a staff member.');
      return;
    }
    if (notes20 <= 0 && notes50 <= 0) {
      setError('Enter at least 1 note ($20 or $50) to replenish the ATM.');
      return;
    }
    const parsedDate = new Date(dateTimeInput);
    if (Number.isNaN(parsedDate.getTime())) {
      setError('Please provide a valid date and time.');
      return;
    }

    onSubmitFeed({
      staffName,
      timestamp: parsedDate.toISOString(),
      notes20,
      notes50,
      reference: reference.trim(),
    });

    setNotes20Input('');
    setNotes50Input('');
    setReference('');
    setDateTimeInput(toLocalDateTimeInputValue());
    setError('');
  };

  return (
    <div className="max-w-3xl mx-auto">
      <form
        onSubmit={handleSubmit}
        className="bg-white border border-slate-200 rounded-xl p-4 sm:p-7 space-y-4 sm:space-y-5"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-5">
          <div>
            <label
              htmlFor="ksbm-feed-staff"
              className="block text-xs sm:text-sm font-semibold text-slate-900 mb-1.5"
            >
              Staff Member <span className="text-red-600">*</span>
            </label>
            <select
              id="ksbm-feed-staff"
              required
              disabled={!isMaster}
              value={staffName}
              onChange={(e) => {
                setStaffName(e.target.value);
                setError('');
              }}
              className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-slate-300 bg-white disabled:bg-slate-100 disabled:text-slate-700 text-slate-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
            >
              <option value="" disabled>
                Select staff member...
              </option>
              {Array.from(new Set([currentUser.name, ...staffMembers])).map((member) => (
                <option key={member} value={member}>
                  {member}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="ksbm-feed-datetime"
              className="block text-xs sm:text-sm font-semibold text-slate-900 mb-1.5"
            >
              Date &amp; Time
            </label>
            <input
              id="ksbm-feed-datetime"
              type="datetime-local"
              required
              value={dateTimeInput}
              onChange={(e) => setDateTimeInput(e.target.value)}
              className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
            />
          </div>
        </div>

        {/* Denomination Inputs */}
        <div className="grid grid-cols-2 gap-2.5 sm:gap-5">
          <div className="border border-slate-200 rounded-xl p-3 sm:p-4 bg-slate-50/50 space-y-2.5 min-w-0">
            <div className="flex items-baseline justify-between gap-1">
              <label htmlFor="ksbm-feed-20" className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                $20 Notes
              </label>
              <span className="text-xs sm:text-sm font-bold font-mono tabular-nums text-emerald-700 shrink-0">
                {formatCurrencyAUD(subtotal20)}
              </span>
            </div>
            <input
              id="ksbm-feed-20"
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
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {[10, 25, 50, 100].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => increment20(amt)}
                  className="min-h-[36px] px-1.5 py-1 rounded-md border border-slate-300 bg-white text-[11px] sm:text-xs font-semibold font-mono tabular-nums text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  +{amt}
                </button>
              ))}
            </div>
          </div>

          <div className="border border-slate-200 rounded-xl p-3 sm:p-4 bg-slate-50/50 space-y-2.5 min-w-0">
            <div className="flex items-baseline justify-between gap-1">
              <label htmlFor="ksbm-feed-50" className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                $50 Notes
              </label>
              <span className="text-xs sm:text-sm font-bold font-mono tabular-nums text-emerald-700 shrink-0">
                {formatCurrencyAUD(subtotal50)}
              </span>
            </div>
            <input
              id="ksbm-feed-50"
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
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {[10, 25, 50, 100].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => increment50(amt)}
                  className="min-h-[36px] px-1.5 py-1 rounded-md border border-slate-300 bg-white text-[11px] sm:text-xs font-semibold font-mono tabular-nums text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  +{amt}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Live Calculation Summary */}
        <div className="border border-slate-200 rounded-xl p-3.5 sm:p-5 bg-slate-900 text-white">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 items-center">
            <div>
              <p className="text-[11px] sm:text-xs text-slate-300">$20s Subtotal</p>
              <p className="text-sm sm:text-lg font-bold font-mono tabular-nums mt-0.5">
                {formatCurrencyAUD(subtotal20)}
                <span className="text-[11px] sm:text-xs font-normal text-slate-400 ml-1">
                  ({notes20})
                </span>
              </p>
            </div>
            <div>
              <p className="text-[11px] sm:text-xs text-slate-300">$50s Subtotal</p>
              <p className="text-sm sm:text-lg font-bold font-mono tabular-nums mt-0.5">
                {formatCurrencyAUD(subtotal50)}
                <span className="text-[11px] sm:text-xs font-normal text-slate-400 ml-1">
                  ({notes50})
                </span>
              </p>
            </div>
            <div className="col-span-2 sm:col-span-1 sm:text-right pt-2.5 sm:pt-0 border-t sm:border-t-0 border-slate-700 flex items-center justify-between sm:block">
              <p className="text-xs text-emerald-300 font-semibold">Total Cash Fed (AUD)</p>
              <p className="text-xl sm:text-3xl font-extrabold font-mono tabular-nums text-emerald-400 sm:mt-0.5">
                {formatCurrencyAUD(totalFed)}
              </p>
            </div>
          </div>
        </div>

        {/* Optional Notes / Reference */}
        <div>
          <label
            htmlFor="ksbm-feed-ref"
            className="block text-xs sm:text-sm font-semibold text-slate-900 mb-1.5"
          >
            Notes / Reference <span className="font-normal text-slate-500">(Optional)</span>
          </label>
          <input
            id="ksbm-feed-ref"
            type="text"
            placeholder="e.g., ANZ Bank withdrawal slip #4092"
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
            className="min-h-[44px] sm:min-h-[48px] px-3 sm:px-6 py-2 rounded-lg bg-emerald-700 text-white text-xs sm:text-sm font-bold hover:bg-emerald-800 transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap"
          >
            <ArrowDownToLine className="w-4 h-4 shrink-0" />
            <span>Submit Feed</span>
          </button>
        </div>
      </form>
    </div>
  );
};
