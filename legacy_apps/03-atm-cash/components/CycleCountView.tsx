import React, { useEffect, useState } from 'react';
import {
  Check,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  EyeOff,
  Lock,
  RotateCcw,
  Share2,
  ShieldAlert,
  SlidersHorizontal,
} from 'lucide-react';
import { ATMTransaction, CycleCountTransaction, KSBMUser } from '../types';
import {
  calculateCashTotal,
  formatCurrencyAUD,
  formatVarianceNoteText,
} from '../utils/denominations';
import { formatDateTimeAU, formatTransactionShareText } from '../utils/storage';

interface CycleCountViewProps {
  staffMembers: string[];
  currentUser: KSBMUser;
  canApproveAdjustment: boolean;
  transactions: ATMTransaction[];
  onSubmitCycleCount: (data: {
    staffName: string;
    mainCassette20: number;
    mainCassette50: number;
    rejectBin20: number;
    rejectBin50: number;
    reference: string;
  }) => CycleCountTransaction;
  onAdjustToPhysical: (data: {
    cycleCountId: string;
    supervisorName: string;
    reason: string;
  }) => void;
}

export const CycleCountView: React.FC<CycleCountViewProps> = ({
  staffMembers,
  currentUser,
  canApproveAdjustment,
  transactions,
  onSubmitCycleCount,
  onAdjustToPhysical,
}) => {
  const isMaster = currentUser.role === 'master';
  const [staffName, setStaffName] = useState<string>(currentUser.name || (staffMembers[0] ?? ''));
  const [main20Input, setMain20Input] = useState<string>('');
  const [main50Input, setMain50Input] = useState<string>('');
  const [reject20Input, setReject20Input] = useState<string>('0');
  const [reject50Input, setReject50Input] = useState<string>('0');
  const [reference, setReference] = useState<string>('');
  const [formError, setFormError] = useState<string>('');

  const [submittedAudit, setSubmittedAudit] = useState<CycleCountTransaction | null>(null);
  const [showAdjustForm, setShowAdjustForm] = useState<boolean>(false);
  const [supervisorName, setSupervisorName] = useState<string>(currentUser.name);
  const [adjustReason, setAdjustReason] = useState<string>('');
  const [pinInput, setPinInput] = useState<string>('');
  const [adjustError, setAdjustError] = useState<string>('');
  const [copiedSummary, setCopiedSummary] = useState<boolean>(false);

  useEffect(() => {
    setStaffName(currentUser.name);
    setSupervisorName(currentUser.name);
  }, [currentUser.id, currentUser.name]);

  const hasOptionalPin = Boolean(currentUser.pin && /^\d{4}$/.test(currentUser.pin));

  const main20 = Math.max(0, Math.floor(Number(main20Input) || 0));
  const main50 = Math.max(0, Math.floor(Number(main50Input) || 0));
  const reject20 = Math.max(0, Math.floor(Number(reject20Input) || 0));
  const reject50 = Math.max(0, Math.floor(Number(reject50Input) || 0));

  const physical20 = main20 + reject20;
  const physical50 = main50 + reject50;
  const physicalTotal = calculateCashTotal(physical20, physical50);

  const handleSubmitAudit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffName.trim()) {
      setFormError('Select the staff member performing this audit.');
      return;
    }
    if (main20Input.trim() === '' || main50Input.trim() === '') {
      setFormError('Enter both Main Cassette $20 and $50 note counts (enter 0 if empty).');
      return;
    }

    const result = onSubmitCycleCount({
      staffName,
      mainCassette20: main20,
      mainCassette50: main50,
      rejectBin20: reject20,
      rejectBin50: reject50,
      reference: reference.trim(),
    });

    setSubmittedAudit(result);
    setShowAdjustForm(false);
    setAdjustReason('');
    setPinInput('');
    setAdjustError('');
    setFormError('');
  };

  const handleStartNewAudit = () => {
    setSubmittedAudit(null);
    setMain20Input('');
    setMain50Input('');
    setReject20Input('0');
    setReject50Input('0');
    setReference('');
    setShowAdjustForm(false);
    setAdjustReason('');
    setPinInput('');
    setAdjustError('');
    setFormError('');
  };

  const handleConfirmAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!submittedAudit || !canApproveAdjustment) return;
    if (!supervisorName.trim()) {
      setAdjustError('Select the supervisor authorising this balance adjustment.');
      return;
    }
    if (adjustReason.trim().length < 5) {
      setAdjustError('Enter a clear supervisor reason note (minimum 5 characters).');
      return;
    }
    if (hasOptionalPin && pinInput.trim() !== currentUser.pin) {
      setAdjustError(`Incorrect 4-digit PIN for ${currentUser.name}.`);
      return;
    }

    onAdjustToPhysical({
      cycleCountId: submittedAudit.id,
      supervisorName,
      reason: adjustReason.trim(),
    });

    setSubmittedAudit({
      ...submittedAudit,
      adjusted: true,
      adjustedBy: supervisorName,
      adjustmentReason: adjustReason.trim(),
      adjustedAt: new Date().toISOString(),
    });
    setShowAdjustForm(false);
    setPinInput('');
    setAdjustError('');
  };

  const handleShareOrCopyAudit = async (audit: CycleCountTransaction, useNativeShare: boolean) => {
    const summary = formatTransactionShareText(audit);
    if (useNativeShare && typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: 'Kwik Stop ATM Cycle Count',
          text: summary,
        });
        return;
      } catch {
        // User cancelled or share unsupported, fall back to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(summary);
      setCopiedSummary(true);
      setTimeout(() => setCopiedSummary(false), 2000);
    } catch {
      // Ignore clipboard failure
    }
  };

  const entriesSincePreviousCycleCount = (() => {
    if (!submittedAudit) return [];
    const currentIndex = transactions.findIndex((tx) => tx.id === submittedAudit.id);
    const sliceAfterCurrent = currentIndex >= 0 ? transactions.slice(currentIndex + 1) : transactions;
    const prevAuditIndex = sliceAfterCurrent.findIndex((tx) => tx.type === 'cycle_count');
    const windowEntries =
      prevAuditIndex >= 0 ? sliceAfterCurrent.slice(0, prevAuditIndex) : sliceAfterCurrent;

    return windowEntries.filter((tx) => tx.type === 'feed' || tx.type === 'withdrawal');
  })();

  const liveAuditRecord =
    submittedAudit
      ? (transactions.find((t): t is CycleCountTransaction => t.id === submittedAudit.id) ??
        submittedAudit)
      : null;

  return (
    <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
      {!liveAuditRecord ? (
        <form
          onSubmit={handleSubmitAudit}
          className="bg-white border border-slate-200 rounded-xl p-4 sm:p-7 space-y-4 sm:space-y-5"
        >
          {/* Blind Audit Notice */}
          <div className="bg-slate-100 border border-slate-200 rounded-xl p-3 sm:p-4 flex items-start gap-2.5 sm:gap-3">
            <EyeOff className="w-4 h-4 sm:w-5 sm:h-5 text-slate-700 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs sm:text-sm font-bold text-slate-900">Blind Physical Audit Mode</p>
              <p className="text-[11px] sm:text-xs text-slate-600 mt-0.5">
                Expected balances stay hidden until you verify and submit your physical count.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5 sm:gap-5">
            <div className="min-w-0">
              <label
                htmlFor="ksbm-cc-staff"
                className="block text-xs sm:text-sm font-semibold text-slate-900 mb-1.5 truncate"
              >
                Counted By <span className="text-red-600">*</span>
              </label>
              <select
                id="ksbm-cc-staff"
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

            <div className="min-w-0">
              <label
                htmlFor="ksbm-cc-ref"
                className="block text-xs sm:text-sm font-semibold text-slate-900 mb-1.5 truncate"
              >
                Audit Note <span className="font-normal text-slate-500">(Opt.)</span>
              </label>
              <input
                id="ksbm-cc-ref"
                type="text"
                placeholder="e.g., Spot check"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="w-full min-h-[44px] px-2.5 sm:px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
              />
            </div>
          </div>

          {/* Main Cassette Section */}
          <div className="space-y-2">
            <h2 className="text-xs sm:text-sm font-bold text-slate-900">
              Main Cassette Physical Notes
            </h2>
            <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
              <div className="border border-slate-200 rounded-xl p-3 sm:p-4 bg-slate-50/50 space-y-1.5 min-w-0">
                <div className="flex items-baseline justify-between gap-1">
                  <label
                    htmlFor="ksbm-cc-main-20"
                    className="text-xs sm:text-sm font-semibold text-slate-900 truncate"
                  >
                    Main $20s
                  </label>
                  <span className="text-xs sm:text-sm font-bold font-mono tabular-nums text-slate-700 shrink-0">
                    {formatCurrencyAUD(main20 * 20)}
                  </span>
                </div>
                <input
                  id="ksbm-cc-main-20"
                  type="number"
                  min={0}
                  step={1}
                  inputMode="numeric"
                  required
                  placeholder="0"
                  value={main20Input}
                  onChange={(e) => {
                    setMain20Input(e.target.value);
                    setFormError('');
                  }}
                  className="w-full min-h-[44px] sm:min-h-[48px] px-2.5 sm:px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 text-lg sm:text-xl font-bold font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
                />
              </div>

              <div className="border border-slate-200 rounded-xl p-3 sm:p-4 bg-slate-50/50 space-y-1.5 min-w-0">
                <div className="flex items-baseline justify-between gap-1">
                  <label
                    htmlFor="ksbm-cc-main-50"
                    className="text-xs sm:text-sm font-semibold text-slate-900 truncate"
                  >
                    Main $50s
                  </label>
                  <span className="text-xs sm:text-sm font-bold font-mono tabular-nums text-slate-700 shrink-0">
                    {formatCurrencyAUD(main50 * 50)}
                  </span>
                </div>
                <input
                  id="ksbm-cc-main-50"
                  type="number"
                  min={0}
                  step={1}
                  inputMode="numeric"
                  required
                  placeholder="0"
                  value={main50Input}
                  onChange={(e) => {
                    setMain50Input(e.target.value);
                    setFormError('');
                  }}
                  className="w-full min-h-[44px] sm:min-h-[48px] px-2.5 sm:px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 text-lg sm:text-xl font-bold font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
                />
              </div>
            </div>
          </div>

          {/* Reject Bin Section */}
          <div className="space-y-2">
            <h2 className="text-xs sm:text-sm font-bold text-slate-900">Reject Bin Notes</h2>
            <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
              <div className="border border-slate-200 rounded-xl p-3 sm:p-4 bg-slate-50/50 space-y-1.5 min-w-0">
                <div className="flex items-baseline justify-between gap-1">
                  <label
                    htmlFor="ksbm-cc-rej-20"
                    className="text-xs sm:text-sm font-semibold text-slate-900 truncate"
                  >
                    Reject $20s
                  </label>
                  <span className="text-xs sm:text-sm font-bold font-mono tabular-nums text-slate-700 shrink-0">
                    {formatCurrencyAUD(reject20 * 20)}
                  </span>
                </div>
                <input
                  id="ksbm-cc-rej-20"
                  type="number"
                  min={0}
                  step={1}
                  inputMode="numeric"
                  value={reject20Input}
                  onChange={(e) => setReject20Input(e.target.value)}
                  className="w-full min-h-[42px] sm:min-h-[44px] px-2.5 sm:px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 text-base sm:text-lg font-bold font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
                />
              </div>

              <div className="border border-slate-200 rounded-xl p-3 sm:p-4 bg-slate-50/50 space-y-1.5 min-w-0">
                <div className="flex items-baseline justify-between gap-1">
                  <label
                    htmlFor="ksbm-cc-rej-50"
                    className="text-xs sm:text-sm font-semibold text-slate-900 truncate"
                  >
                    Reject $50s
                  </label>
                  <span className="text-xs sm:text-sm font-bold font-mono tabular-nums text-slate-700 shrink-0">
                    {formatCurrencyAUD(reject50 * 50)}
                  </span>
                </div>
                <input
                  id="ksbm-cc-rej-50"
                  type="number"
                  min={0}
                  step={1}
                  inputMode="numeric"
                  value={reject50Input}
                  onChange={(e) => setReject50Input(e.target.value)}
                  className="w-full min-h-[42px] sm:min-h-[44px] px-2.5 sm:px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 text-base sm:text-lg font-bold font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
                />
              </div>
            </div>
          </div>

          {/* Counted Physical Total */}
          <div className="border border-slate-200 rounded-xl p-3.5 sm:p-5 bg-slate-900 text-white flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] sm:text-xs text-slate-300">Physical Count (Main + Reject)</p>
              <p className="text-xs sm:text-sm font-mono tabular-nums text-slate-200 mt-0.5 truncate">
                {physical20}×$20 · {physical50}×$50
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[11px] sm:text-xs text-slate-300">Counted</p>
              <p className="text-xl sm:text-3xl font-extrabold font-mono tabular-nums text-white mt-0.5">
                {formatCurrencyAUD(physicalTotal)}
              </p>
            </div>
          </div>

          {formError && (
            <p
              role="alert"
              className="text-xs sm:text-sm font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5"
            >
              {formError}
            </p>
          )}

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              className="w-full sm:w-auto min-h-[46px] px-6 py-2.5 rounded-lg bg-emerald-700 text-white text-sm font-bold hover:bg-emerald-800 transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
            >
              <ClipboardCheck className="w-4 h-4 shrink-0" />
              <span>Verify &amp; Submit Count</span>
            </button>
          </div>
        </form>
      ) : (
        /* Post-Submission Comparison Panel */
        <div className="space-y-4 sm:space-y-6">
          {liveAuditRecord.varianceTotal === 0 &&
          liveAuditRecord.varianceNotes20 === 0 &&
          liveAuditRecord.varianceNotes50 === 0 ? (
            <div
              role="status"
              className="bg-emerald-50 border border-emerald-300 rounded-xl p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4"
            >
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-700 shrink-0 mt-0.5" />
                <div>
                  <h2 className="text-sm sm:text-base font-extrabold text-emerald-950">
                    EXACT MATCH — Cash Balanced
                  </h2>
                  <p className="text-xs sm:text-sm text-emerald-900 mt-1">
                    Physical count of{' '}
                    <span className="font-mono font-bold tabular-nums">
                      {formatCurrencyAUD(liveAuditRecord.physicalTotal)}
                    </span>{' '}
                    matches expected ATM balance across all $20 and $50 notes.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    void handleShareOrCopyAudit(liveAuditRecord, false);
                  }}
                  className="min-h-[40px] px-3 py-2 rounded-lg border border-emerald-300 bg-white text-emerald-900 text-xs font-semibold hover:bg-emerald-100 flex items-center gap-1.5 whitespace-nowrap"
                >
                  {copiedSummary ? (
                    <Check className="w-3.5 h-3.5 text-emerald-700" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{copiedSummary ? 'Copied' : 'Copy Summary'}</span>
                </button>
                {typeof navigator !== 'undefined' && typeof navigator.share === 'function' && (
                  <button
                    type="button"
                    onClick={() => {
                      void handleShareOrCopyAudit(liveAuditRecord, true);
                    }}
                    className="min-h-[40px] px-3 py-2 rounded-lg border border-emerald-300 bg-white text-emerald-900 text-xs font-semibold hover:bg-emerald-100 flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Share</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleStartNewAudit}
                  className="min-h-[40px] px-3.5 py-2 rounded-lg bg-emerald-800 text-white text-xs font-semibold hover:bg-emerald-900 transition-colors flex items-center gap-1.5 whitespace-nowrap"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>New Count</span>
                </button>
              </div>
            </div>
          ) : (
            <div
              role="alert"
              className="bg-red-50 border border-red-300 rounded-xl p-4 sm:p-6 space-y-3.5"
            >
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="flex items-start gap-3">
                  <ShieldAlert className="w-5 h-5 sm:w-6 sm:h-6 text-red-700 shrink-0 mt-0.5" />
                  <div>
                    <h2 className="text-sm sm:text-base font-extrabold text-red-950">
                      {liveAuditRecord.varianceTotal === 0
                        ? 'DENOMINATION MIX VARIANCE DETECTED'
                        : 'DISCREPANCY DETECTED'}
                    </h2>
                    <p className="text-xs sm:text-sm font-semibold text-red-900 mt-1 font-mono tabular-nums">
                      Total Variance: {liveAuditRecord.varianceTotal >= 0 ? '+' : ''}
                      {formatCurrencyAUD(liveAuditRecord.varianceTotal)}
                    </p>
                    <ul className="mt-1.5 space-y-0.5 text-xs sm:text-sm text-red-900 font-mono tabular-nums">
                      {formatVarianceNoteText(
                        liveAuditRecord.varianceNotes20,
                        liveAuditRecord.varianceNotes50
                      ).map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0 self-start">
                  <button
                    type="button"
                    onClick={() => {
                      void handleShareOrCopyAudit(liveAuditRecord, false);
                    }}
                    className="min-h-[40px] px-3 py-2 rounded-lg border border-red-300 bg-white text-red-900 text-xs font-semibold hover:bg-red-100 flex items-center gap-1.5 whitespace-nowrap"
                  >
                    {copiedSummary ? (
                      <Check className="w-3.5 h-3.5 text-emerald-700" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedSummary ? 'Copied' : 'Copy Summary'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleStartNewAudit}
                    className="min-h-[40px] px-3.5 py-2 rounded-lg border border-red-300 bg-white text-red-900 text-xs font-semibold hover:bg-red-100 transition-colors flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>New Count</span>
                  </button>
                </div>
              </div>

              {liveAuditRecord.adjusted ? (
                <div className="bg-white border border-red-200 rounded-lg p-3.5 text-xs sm:text-sm text-slate-900">
                  <p className="font-bold text-emerald-800">
                    Expected Balance Adjusted to Physical Count
                  </p>
                  <p className="text-xs text-slate-600 mt-1">
                    Authorised by {liveAuditRecord.adjustedBy} · Reason:{' '}
                    {liveAuditRecord.adjustmentReason}
                  </p>
                </div>
              ) : canApproveAdjustment ? (
                !showAdjustForm && (
                  <div>
                    <button
                      type="button"
                      onClick={() => setShowAdjustForm(true)}
                      className="min-h-[44px] px-4 py-2 rounded-lg bg-red-700 text-white text-xs sm:text-sm font-bold hover:bg-red-800 transition-colors inline-flex items-center gap-2 whitespace-nowrap"
                    >
                      <SlidersHorizontal className="w-4 h-4" />
                      <span>Adjust Expected Balance to Physical Count</span>
                    </button>
                  </div>
                )
              ) : (
                <p className="text-xs font-semibold text-red-900 bg-white/80 border border-red-200 rounded-lg px-3 py-2">
                  Supervisor approval permission (<code className="font-mono">approveAdjustment</code>) is required to reconcile expected balance to this physical count.
                </p>
              )}

              {showAdjustForm && canApproveAdjustment && !liveAuditRecord.adjusted && (
                <form
                  onSubmit={handleConfirmAdjustment}
                  className="bg-white border border-red-200 rounded-xl p-4 space-y-3.5"
                >
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    {hasOptionalPin && <Lock className="w-3.5 h-3.5 text-red-700" />}
                    <span>Supervisor Balance Adjustment Authorisation</span>
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label
                        htmlFor="ksbm-adj-supervisor"
                        className="block text-xs font-semibold text-slate-700 mb-1"
                      >
                        Supervisor / Manager <span className="text-red-600">*</span>
                      </label>
                      <select
                        id="ksbm-adj-supervisor"
                        required
                        disabled={!isMaster}
                        value={supervisorName}
                        onChange={(e) => setSupervisorName(e.target.value)}
                        className="w-full min-h-[42px] px-3 py-2 rounded-lg border border-slate-300 bg-white disabled:bg-slate-100 disabled:text-slate-700 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600"
                      >
                        {Array.from(new Set([currentUser.name, ...staffMembers])).map((member) => (
                          <option key={member} value={member}>
                            {member}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label
                        htmlFor="ksbm-adj-reason"
                        className="block text-xs font-semibold text-slate-700 mb-1"
                      >
                        Mandatory Supervisor Reason Note <span className="text-red-600">*</span>
                      </label>
                      <input
                        id="ksbm-adj-reason"
                        type="text"
                        required
                        placeholder="e.g., Unlogged Tuesday EOD receipt"
                        value={adjustReason}
                        onChange={(e) => {
                          setAdjustReason(e.target.value);
                          setAdjustError('');
                        }}
                        className="w-full min-h-[42px] px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600"
                      />
                    </div>
                    {hasOptionalPin && (
                      <div className="sm:col-span-2">
                        <label
                          htmlFor="ksbm-adj-pin"
                          className="block text-xs font-semibold text-slate-700 mb-1"
                        >
                          Confirm {currentUser.name}&apos;s 4-Digit PIN{' '}
                          <span className="text-red-600">*</span>
                        </label>
                        <input
                          id="ksbm-adj-pin"
                          type="password"
                          inputMode="numeric"
                          maxLength={4}
                          required
                          placeholder="Enter 4-digit PIN"
                          value={pinInput}
                          onChange={(e) => {
                            setPinInput(e.target.value.replace(/\D/g, '').slice(0, 4));
                            setAdjustError('');
                          }}
                          className="w-full sm:w-48 min-h-[42px] px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm font-mono tracking-widest text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600"
                        />
                      </div>
                    )}
                  </div>
                  {adjustError && (
                    <p className="text-xs font-semibold text-red-700">{adjustError}</p>
                  )}
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAdjustForm(false)}
                      className="min-h-[40px] px-3.5 py-1.5 rounded-lg border border-slate-300 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="min-h-[40px] px-3.5 py-1.5 rounded-lg bg-red-700 text-white text-xs sm:text-sm font-bold hover:bg-red-800"
                    >
                      Confirm Adjustment &amp; Sync
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* Detailed Comparison Table */}
          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-slate-200">
              <h3 className="text-sm sm:text-base font-bold text-slate-900">
                Audit Comparison: Expected vs. Physical
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-600 mt-0.5 font-mono tabular-nums">
                {liveAuditRecord.id} · {formatDateTimeAU(liveAuditRecord.timestamp)} ·{' '}
                {liveAuditRecord.staffName}
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[11px] sm:text-xs font-semibold text-slate-600">
                    <th className="py-2.5 px-3 sm:px-6">Note</th>
                    <th className="py-2.5 px-2.5 sm:px-4 text-right">Expected</th>
                    <th className="py-2.5 px-2.5 sm:px-4 text-right">Physical</th>
                    <th className="py-2.5 px-3 sm:px-6 text-right">Variance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs sm:text-sm">
                  <tr>
                    <td className="py-3 px-3 sm:px-6 font-semibold text-slate-900">$20 AUD</td>
                    <td className="py-3 px-2.5 sm:px-4 text-right font-mono tabular-nums text-slate-700">
                      {liveAuditRecord.expectedNotes20} (
                      {formatCurrencyAUD(liveAuditRecord.expectedNotes20 * 20)})
                    </td>
                    <td className="py-3 px-2.5 sm:px-4 text-right font-mono tabular-nums text-slate-900 font-semibold">
                      {liveAuditRecord.physicalNotes20} (
                      {formatCurrencyAUD(liveAuditRecord.physicalNotes20 * 20)})
                      <span className="block text-[10px] sm:text-xs font-normal text-slate-500">
                        {liveAuditRecord.mainCassette20}m + {liveAuditRecord.rejectBin20}r
                      </span>
                    </td>
                    <td
                      className={`py-3 px-3 sm:px-6 text-right font-mono tabular-nums font-bold ${
                        liveAuditRecord.varianceNotes20 === 0
                          ? 'text-emerald-700'
                          : 'text-red-700'
                      }`}
                    >
                      {liveAuditRecord.varianceNotes20 > 0 ? '+' : ''}
                      {liveAuditRecord.varianceNotes20} (
                      {liveAuditRecord.varianceNotes20 >= 0 ? '+' : ''}
                      {formatCurrencyAUD(liveAuditRecord.varianceNotes20 * 20)})
                    </td>
                  </tr>

                  <tr>
                    <td className="py-3 px-3 sm:px-6 font-semibold text-slate-900">$50 AUD</td>
                    <td className="py-3 px-2.5 sm:px-4 text-right font-mono tabular-nums text-slate-700">
                      {liveAuditRecord.expectedNotes50} (
                      {formatCurrencyAUD(liveAuditRecord.expectedNotes50 * 50)})
                    </td>
                    <td className="py-3 px-2.5 sm:px-4 text-right font-mono tabular-nums text-slate-900 font-semibold">
                      {liveAuditRecord.physicalNotes50} (
                      {formatCurrencyAUD(liveAuditRecord.physicalNotes50 * 50)})
                      <span className="block text-[10px] sm:text-xs font-normal text-slate-500">
                        {liveAuditRecord.mainCassette50}m + {liveAuditRecord.rejectBin50}r
                      </span>
                    </td>
                    <td
                      className={`py-3 px-3 sm:px-6 text-right font-mono tabular-nums font-bold ${
                        liveAuditRecord.varianceNotes50 === 0
                          ? 'text-emerald-700'
                          : 'text-red-700'
                      }`}
                    >
                      {liveAuditRecord.varianceNotes50 > 0 ? '+' : ''}
                      {liveAuditRecord.varianceNotes50} (
                      {liveAuditRecord.varianceNotes50 >= 0 ? '+' : ''}
                      {formatCurrencyAUD(liveAuditRecord.varianceNotes50 * 50)})
                    </td>
                  </tr>

                  <tr className="bg-slate-50 font-bold">
                    <td className="py-3 px-3 sm:px-6 text-slate-900">Total AUD</td>
                    <td className="py-3 px-2.5 sm:px-4 text-right font-mono tabular-nums text-slate-900">
                      {formatCurrencyAUD(liveAuditRecord.expectedTotal)}
                    </td>
                    <td className="py-3 px-2.5 sm:px-4 text-right font-mono tabular-nums text-slate-900">
                      {formatCurrencyAUD(liveAuditRecord.physicalTotal)}
                    </td>
                    <td
                      className={`py-3 px-3 sm:px-6 text-right font-mono tabular-nums ${
                        liveAuditRecord.varianceTotal === 0
                          ? 'text-emerald-700'
                          : 'text-red-700'
                      }`}
                    >
                      {liveAuditRecord.varianceTotal > 0 ? '+' : ''}
                      {formatCurrencyAUD(liveAuditRecord.varianceTotal)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Investigation Feed & Withdrawal Entries Since Last Cycle Count */}
          {(liveAuditRecord.varianceTotal !== 0 ||
            liveAuditRecord.varianceNotes20 !== 0 ||
            liveAuditRecord.varianceNotes50 !== 0) && (
            <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-slate-200">
                <h3 className="text-sm sm:text-base font-bold text-slate-900">
                  Movements Since Previous Cycle Count
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-600 mt-0.5">
                  Review all Feed and Withdrawal entries since the prior audit
                </p>
              </div>

              {entriesSincePreviousCycleCount.length === 0 ? (
                <div className="p-4 sm:p-6 text-xs sm:text-sm text-slate-600">
                  No Feed or Withdrawal transactions were recorded between the previous cycle count
                  and this audit.
                </div>
              ) : (
                <div className="divide-y divide-slate-200">
                  {entriesSincePreviousCycleCount.map((tx) => (
                    <div
                      key={tx.id}
                      className="px-4 py-3 sm:px-6 sm:py-3.5 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-semibold text-slate-900 truncate">
                          {tx.type === 'feed' ? 'Cash Feed' : 'Daily Withdrawal'} · {tx.staffName}
                        </p>
                        <p className="text-[11px] sm:text-xs text-slate-600 font-mono tabular-nums mt-0.5 truncate">
                          {formatDateTimeAU(tx.timestamp)} · {tx.notes20}×$20 · {tx.notes50}×$50
                          {tx.reference ? ` · ${tx.reference}` : ''}
                        </p>
                      </div>
                      <p
                        className={`text-xs sm:text-sm font-bold font-mono tabular-nums shrink-0 ${
                          tx.type === 'feed' ? 'text-emerald-700' : 'text-slate-900'
                        }`}
                      >
                        {tx.type === 'feed' ? '+' : '-'}
                        {formatCurrencyAUD(tx.totalAmount)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
};
