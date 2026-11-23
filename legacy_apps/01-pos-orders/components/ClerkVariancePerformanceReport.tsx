import React, { useState, useMemo } from 'react';
import {
  Users,
  Clock,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  ShieldAlert,
  Search,
  Sliders,
  Award,
  Layers,
  FileText,
  ChevronRight,
  Filter,
  Check,
  Scale
} from 'lucide-react';
import {
  CashVarianceThresholds,
  DEFAULT_CASH_VARIANCE_CONFIG,
  aggregateClerkPerformanceReport,
  evaluateCashVariance,
  VarianceTierId,
} from '../varianceUtils';

interface ClerkVariancePerformanceReportProps {
  shiftRows?: any[];
  rows?: any[];
  config?: CashVarianceThresholds | null;
  thresholdConfig?: CashVarianceThresholds | null;
  periodText?: string;
  onSelectShift?: (declarationId: number) => void;
  onOpenStoreSettings?: () => void;
}

export const ClerkVariancePerformanceReport: React.FC<ClerkVariancePerformanceReportProps> = ({
  shiftRows,
  rows,
  config,
  thresholdConfig,
  periodText = 'Selected Period',
  onSelectShift,
  onOpenStoreSettings,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTierFilter, setSelectedTierFilter] = useState<VarianceTierId | 'all'>('all');
  const [selectedClerkId, setSelectedClerkId] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'severity' | 'hours' | 'shifts' | 'variance'>('severity');

  const rawRows = Array.isArray(shiftRows) ? shiftRows : Array.isArray(rows) ? rows : [];
  const cfg = config || thresholdConfig;
  const activeConfig = cfg && cfg.enabled !== false ? cfg : DEFAULT_CASH_VARIANCE_CONFIG;

  // Aggregate stats across all shifts
  const aggregated = useMemo(() => {
    return aggregateClerkPerformanceReport(rawRows, activeConfig);
  }, [rawRows, activeConfig]);

  // Filter clerks
  const filteredClerks = useMemo(() => {
    if (!aggregated || !Array.isArray(aggregated.clerks)) return [];
    return aggregated.clerks.filter((clerk) => {
      const nameMatch = (clerk.clerkName || '').toLowerCase().includes(searchQuery.toLowerCase());
      const clerkMatch = selectedClerkId === 'all' || String(clerk.clerkId) === selectedClerkId;
      
      let tierMatch = true;
      if (selectedTierFilter !== 'all' && clerk.tierDistribution && clerk.tierDistribution[selectedTierFilter]) {
        tierMatch = clerk.tierDistribution[selectedTierFilter].total > 0;
      }

      return nameMatch && clerkMatch && tierMatch;
    }).sort((a, b) => {
      if (sortBy === 'severity') {
        if (b.highestSeverity !== a.highestSeverity) return b.highestSeverity - a.highestSeverity;
        return Math.abs(b.netVariance) - Math.abs(a.netVariance);
      }
      if (sortBy === 'hours') return b.totalMinutesWorked - a.totalMinutesWorked;
      if (sortBy === 'shifts') return b.shiftCount - a.shiftCount;
      if (sortBy === 'variance') return Math.abs(b.netVariance) - Math.abs(a.netVariance);
      return 0;
    });
  }, [aggregated, searchQuery, selectedClerkId, selectedTierFilter, sortBy]);

  // Calculate tier totals across store
  const tierTotals = useMemo(() => {
    const totals: Record<VarianceTierId, number> = {
      perfect: 0,
      good: 0,
      moderate: 0,
      concerned: 0,
      red_flag: 0,
    };
    rawRows.forEach((row) => {
      if (!row) return;
      const rawVal = typeof row._rawVariance === 'number'
        ? row._rawVariance
        : (row.cashVariance ?? row.variance ?? row['Cash Variance'] ?? 0);
      const evald = evaluateCashVariance(rawVal, activeConfig);
      if (totals[evald.tier] !== undefined) {
        totals[evald.tier]++;
      }
    });
    return totals;
  }, [rawRows, activeConfig]);

  return (
    <div className="space-y-6">
      {/* 1. Top Executive Control Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-2xs shrink-0">
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-slate-900">
                Clerk Shift Cash Variance & Performance Report
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                Shift Integrity
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Period: <strong className="text-slate-700 font-semibold">{periodText}</strong> • {aggregated.totalShifts} shift declarations across {aggregated.clerks.length} cashiers
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {onOpenStoreSettings && (
            <button
              type="button"
              onClick={onOpenStoreSettings}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold border border-slate-200 transition-colors shadow-2xs cursor-pointer"
              title="Configure 5 variance thresholds and toggle emojis"
            >
              <Sliders className="w-3.5 h-3.5 text-slate-500" />
              <span>Thresholds & Emojis</span>
            </button>
          )}

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search cashier name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 w-44 sm:w-56"
            />
          </div>
        </div>
      </div>

      {/* 2. Core KPI Summary Cards (Explicitly requested metrics) */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4">
        {/* Metric 1: Total + Variance (Surplus) */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total + Variance</span>
            <span className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
              <TrendingUp className="w-3.5 h-3.5" />
            </span>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-blue-600 font-mono">
              +${aggregated.overallPositiveVariance.toFixed(2)}
            </div>
            <p className="text-[10px] text-slate-500 mt-1 leading-tight">
              Cash surplus declared above expected drawer
            </p>
          </div>
        </div>

        {/* Metric 2: Total - Variance (Shortage) */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total - Variance</span>
            <span className="p-1.5 rounded-lg bg-rose-50 text-rose-600">
              <TrendingDown className="w-3.5 h-3.5" />
            </span>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-rose-600 font-mono">
              -${aggregated.overallNegativeVariance.toFixed(2)}
            </div>
            <p className="text-[10px] text-slate-500 mt-1 leading-tight">
              Cash deficit declared below expected drawer
            </p>
          </div>
        </div>

        {/* Metric 3: Net Cash Variance */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Net Variance</span>
            <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
              <Scale className="w-3.5 h-3.5" />
            </span>
          </div>
          <div>
            <div
              className={`text-xl sm:text-2xl font-black font-mono ${
                aggregated.overallNetVariance === 0
                  ? 'text-slate-800'
                  : aggregated.overallNetVariance > 0
                  ? 'text-blue-700'
                  : 'text-rose-700'
              }`}
            >
              {aggregated.overallNetVariance === 0
                ? '$0.00'
                : aggregated.overallNetVariance > 0
                ? `+$${aggregated.overallNetVariance.toFixed(2)}`
                : `-$${Math.abs(aggregated.overallNetVariance).toFixed(2)}`}
            </div>
            <p className="text-[10px] text-slate-500 mt-1 leading-tight">
              {aggregated.overallNetVariance === 0
                ? 'Perfect net reconciliation balance'
                : aggregated.overallNetVariance > 0
                ? 'Store net cash overage'
                : 'Store net cash shortfall'}
            </p>
          </div>
        </div>

        {/* Metric 4: Perfect Score Rate */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Perfect Score</span>
            <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </span>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-emerald-600 flex items-baseline gap-1">
              <span>{aggregated.overallPerfectRate}%</span>
              <span className="text-xs font-normal text-slate-400">
                ({aggregated.overallPerfectCount}/{aggregated.totalShifts})
              </span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1 leading-tight">
              Shifts within &le; +/- ${activeConfig.perfect?.maxThreshold?.toFixed(2) || '0.10'} tolerance
            </p>
          </div>
        </div>

        {/* Metric 5: Hours Worked in Selected Period */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs relative overflow-hidden flex flex-col justify-between col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Hours Worked</span>
            <span className="p-1.5 rounded-lg bg-purple-50 text-purple-600">
              <Clock className="w-3.5 h-3.5" />
            </span>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-purple-700 font-mono">
              {aggregated.totalHoursFormatted}
            </div>
            <p className="text-[10px] text-slate-500 mt-1 leading-tight">
              Lane coverage across recorded shifts
            </p>
          </div>
        </div>
      </div>

      {/* 3. Department Performance Highlights Banner */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Best Performing Department */}
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-4.5 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-600 text-white shadow-2xs">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-emerald-800 tracking-wider block">
                Best Performing Department
              </span>
              <h4 className="text-base font-bold text-emerald-950 mt-0.5">
                {aggregated.storeBestDepartment}
              </h4>
              <p className="text-[11px] text-emerald-700 mt-0.5">
                Highest cashier sales throughput and customer basket turnover
              </p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 shrink-0">
            Top Volume
          </span>
        </div>

        {/* Less Performed Department */}
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4.5 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-600 text-white shadow-2xs">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-amber-800 tracking-wider block">
                Less Performed Department
              </span>
              <h4 className="text-base font-bold text-amber-950 mt-0.5">
                {aggregated.storeLessDepartment}
              </h4>
              <p className="text-[11px] text-amber-700 mt-0.5">
                Lowest register checkout velocity; opportunity for cashier upselling
              </p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300 shrink-0">
            Growth Potential
          </span>
        </div>
      </div>

      {/* 4. 5-Tier Threshold Distribution Strip with Interactive Filtering */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-slate-500" />
            <span className="text-xs font-bold text-slate-800">
              Store Cash Variance Thresholds & Shift Distribution
            </span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <span>Filter view by tolerance tier:</span>
            {selectedTierFilter !== 'all' && (
              <button
                type="button"
                onClick={() => setSelectedTierFilter('all')}
                className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
              >
                Clear Filter
              </button>
            )}
          </div>
        </div>

        {/* 5 Tier Pill Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5">
          {/* Tier 1: Perfect */}
          <button
            type="button"
            onClick={() => setSelectedTierFilter(selectedTierFilter === 'perfect' ? 'all' : 'perfect')}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
              selectedTierFilter === 'perfect'
                ? 'bg-emerald-100 border-emerald-400 ring-2 ring-emerald-500/20 shadow-2xs'
                : 'bg-emerald-50/50 hover:bg-emerald-50 border-emerald-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5 truncate">
                {activeConfig.showEmoji && <span>{activeConfig.perfect?.emoji || '🎯'}</span>}
                <span className="truncate">{activeConfig.perfect?.label || 'Perfect'}</span>
              </span>
              <span className="text-xs font-black text-emerald-700 bg-white px-1.5 py-0.5 rounded border border-emerald-200">
                {tierTotals.perfect}
              </span>
            </div>
            <div className="text-[10px] text-emerald-700 mt-1">
              &le; +/- ${activeConfig.perfect?.maxThreshold?.toFixed(2) || '0.10'}
            </div>
          </button>

          {/* Tier 2: Good */}
          <button
            type="button"
            onClick={() => setSelectedTierFilter(selectedTierFilter === 'good' ? 'all' : 'good')}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
              selectedTierFilter === 'good'
                ? 'bg-blue-100 border-blue-400 ring-2 ring-blue-500/20 shadow-2xs'
                : 'bg-blue-50/50 hover:bg-blue-50 border-blue-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5 truncate">
                {activeConfig.showEmoji && <span>{activeConfig.good?.emoji || '✅'}</span>}
                <span className="truncate">{activeConfig.good?.label || 'Minor'}</span>
              </span>
              <span className="text-xs font-black text-blue-700 bg-white px-1.5 py-0.5 rounded border border-blue-200">
                {tierTotals.good}
              </span>
            </div>
            <div className="text-[10px] text-blue-700 mt-1">
              &le; +/- ${activeConfig.good?.maxThreshold?.toFixed(2) || '0.90'}
            </div>
          </button>

          {/* Tier 3: Moderate */}
          <button
            type="button"
            onClick={() => setSelectedTierFilter(selectedTierFilter === 'moderate' ? 'all' : 'moderate')}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
              selectedTierFilter === 'moderate'
                ? 'bg-amber-100 border-amber-400 ring-2 ring-amber-500/20 shadow-2xs'
                : 'bg-amber-50/50 hover:bg-amber-50 border-amber-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5 truncate">
                {activeConfig.showEmoji && <span>{activeConfig.moderate?.emoji || '⚠️'}</span>}
                <span className="truncate">{activeConfig.moderate?.label || 'Moderate'}</span>
              </span>
              <span className="text-xs font-black text-amber-700 bg-white px-1.5 py-0.5 rounded border border-amber-200">
                {tierTotals.moderate}
              </span>
            </div>
            <div className="text-[10px] text-amber-700 mt-1">
              &le; +/- ${activeConfig.moderate?.maxThreshold?.toFixed(2) || '5.00'}
            </div>
          </button>

          {/* Tier 4: Concerned */}
          <button
            type="button"
            onClick={() => setSelectedTierFilter(selectedTierFilter === 'concerned' ? 'all' : 'concerned')}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
              selectedTierFilter === 'concerned'
                ? 'bg-orange-100 border-orange-400 ring-2 ring-orange-500/20 shadow-2xs'
                : 'bg-orange-50/50 hover:bg-orange-50 border-orange-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-orange-950 flex items-center gap-1.5 truncate">
                {activeConfig.showEmoji && <span>{activeConfig.concerned?.emoji || '🔍'}</span>}
                <span className="truncate">{activeConfig.concerned?.label || 'Concerned'}</span>
              </span>
              <span className="text-xs font-black text-orange-800 bg-white px-1.5 py-0.5 rounded border border-orange-200">
                {tierTotals.concerned}
              </span>
            </div>
            <div className="text-[10px] text-orange-800 mt-1">
              &le; +/- ${activeConfig.concerned?.maxThreshold?.toFixed(2) || '10.00'}
            </div>
          </button>

          {/* Tier 5: Red Flag */}
          <button
            type="button"
            onClick={() => setSelectedTierFilter(selectedTierFilter === 'red_flag' ? 'all' : 'red_flag')}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
              selectedTierFilter === 'red_flag'
                ? 'bg-rose-100 border-rose-400 ring-2 ring-rose-500/20 shadow-2xs'
                : 'bg-rose-50/50 hover:bg-rose-50 border-rose-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-rose-950 flex items-center gap-1.5 truncate">
                {activeConfig.showEmoji && <span>{activeConfig.redFlag?.emoji || '🚨'}</span>}
                <span className="truncate">{activeConfig.redFlag?.label || 'Red Flag'}</span>
              </span>
              <span className="text-xs font-black text-rose-800 bg-white px-1.5 py-0.5 rounded border border-rose-200">
                {tierTotals.red_flag}
              </span>
            </div>
            <div className="text-[10px] text-rose-700 mt-1">
              &gt; +/- ${activeConfig.concerned?.maxThreshold?.toFixed(2) || '10.00'}
            </div>
          </button>
        </div>
      </div>

      {/* 5. Clerk Performance Cards Grid */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-bold text-slate-900">
              Cashier Individual Performance & Variance Audit
            </h4>
            <p className="text-xs text-slate-500">
              Showing {filteredClerks.length} of {aggregated.clerks.length} cashiers with shift activity
            </p>
          </div>

          {/* Sorting controls */}
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
            <span>Sort by:</span>
            <div className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => setSortBy('severity')}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  sortBy === 'severity' ? 'bg-white text-blue-700 font-bold shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Audit Alert
              </button>
              <button
                type="button"
                onClick={() => setSortBy('hours')}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  sortBy === 'hours' ? 'bg-white text-blue-700 font-bold shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Hours Worked
              </button>
              <button
                type="button"
                onClick={() => setSortBy('variance')}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  sortBy === 'variance' ? 'bg-white text-blue-700 font-bold shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Net Discrepancy
              </button>
            </div>
          </div>
        </div>

        {filteredClerks.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-400">
            <Users className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <p className="text-sm font-semibold text-slate-700">No cashiers match your filter criteria.</p>
            <p className="text-xs text-slate-400 mt-1">Try clearing search or selecting "All" tolerance tiers.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
            {filteredClerks.map((clerk, idx) => {
              const initials = (clerk.clerkName || 'CL')
                .split(' ')
                .filter(Boolean)
                .map((n) => n[0] || '')
                .join('')
                .toUpperCase()
                .slice(0, 2) || 'CL';

              const isRedFlag = clerk.auditStatus === 'RED_FLAG_AUDIT';
              const isConcern = clerk.auditStatus === 'CONCERN_FLAGGED';
              const isModerate = clerk.auditStatus === 'MODERATE_ATTENTION';

              return (
                <div
                  key={`clerk-perf-${clerk.clerkId}-${idx}`}
                  className={`bg-white border rounded-2xl p-5 shadow-2xs flex flex-col justify-between transition-all hover:shadow-md relative ${
                    isRedFlag
                      ? 'border-rose-300 ring-2 ring-rose-500/10'
                      : isConcern
                      ? 'border-orange-300 ring-2 ring-orange-500/10'
                      : isModerate
                      ? 'border-amber-200'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div>
                    {/* Header: Avatar, Name, Audit Badge */}
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm text-white shadow-2xs shrink-0 ${
                            isRedFlag
                              ? 'bg-rose-600'
                              : isConcern
                              ? 'bg-orange-600'
                              : 'bg-gradient-to-tr from-slate-700 to-slate-900'
                          }`}
                        >
                          {initials}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <h4 className="font-bold text-slate-900 text-sm">{clerk.clerkName}</h4>
                          </div>
                          <span className="text-[11px] text-slate-500">ID #{clerk.clerkId} • {clerk.shiftCount} shifts</span>
                        </div>
                      </div>

                      {/* Audit Status Badge */}
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold border shrink-0 flex items-center gap-1 ${
                          isRedFlag
                            ? 'bg-rose-50 text-rose-700 border-rose-300 animate-pulse'
                            : isConcern
                            ? 'bg-orange-50 text-orange-800 border-orange-300'
                            : isModerate
                            ? 'bg-amber-50 text-amber-800 border-amber-300'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-300'
                        }`}
                      >
                        {activeConfig.showEmoji && (
                          <span>
                            {isRedFlag ? '🚨' : isConcern ? '🔍' : isModerate ? '⚠️' : '🎯'}
                          </span>
                        )}
                        <span>
                          {isRedFlag
                            ? 'Red Flag Alert'
                            : isConcern
                            ? 'Concern Flagged'
                            : isModerate
                            ? 'Moderate Notice'
                            : 'Clean Balanced'}
                        </span>
                      </span>
                    </div>

                    {/* Core 4-Grid of Specific Metrics */}
                    <div className="grid grid-cols-2 gap-2 text-xs mb-3.5">
                      {/* Total + Variance */}
                      <div className="p-2.5 rounded-xl bg-blue-50/60 border border-blue-100">
                        <span className="text-[10px] uppercase font-bold text-blue-800 block">Total + Variance</span>
                        <span className="font-mono font-bold text-sm text-blue-700 block mt-0.5">
                          +${clerk.positiveVariance.toFixed(2)}
                        </span>
                        <span className="text-[10px] text-blue-600">Surplus declared</span>
                      </div>

                      {/* Total - Variance */}
                      <div className="p-2.5 rounded-xl bg-rose-50/60 border border-rose-100">
                        <span className="text-[10px] uppercase font-bold text-rose-800 block">Total - Variance</span>
                        <span className="font-mono font-bold text-sm text-rose-700 block mt-0.5">
                          -${clerk.negativeVariance.toFixed(2)}
                        </span>
                        <span className="text-[10px] text-rose-600">Shortage declared</span>
                      </div>

                      {/* Perfect Score */}
                      <div className="p-2.5 rounded-xl bg-emerald-50/60 border border-emerald-100">
                        <span className="text-[10px] uppercase font-bold text-emerald-800 block">Perfect Score</span>
                        <span className="font-bold text-sm text-emerald-700 block mt-0.5">
                          {clerk.perfectRate}%
                        </span>
                        <span className="text-[10px] text-emerald-600">
                          {clerk.perfectCount} of {clerk.shiftCount} shifts
                        </span>
                      </div>

                      {/* Hours Worked */}
                      <div className="p-2.5 rounded-xl bg-purple-50/60 border border-purple-100">
                        <span className="text-[10px] uppercase font-bold text-purple-800 block">Hours Worked</span>
                        <span className="font-mono font-bold text-sm text-purple-800 block mt-0.5">
                          {clerk.hoursFormatted}
                        </span>
                        <span className="text-[10px] text-purple-600">Active lane duty</span>
                      </div>
                    </div>

                    {/* Department Performance Splits */}
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 mb-3 text-xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-500 font-bold uppercase flex items-center gap-1">
                          <Award className="w-3 h-3 text-emerald-600" />
                          Best Performance Dept:
                        </span>
                        <span className="font-bold text-slate-800 truncate max-w-[150px] text-right">
                          {clerk.bestDepartment}
                        </span>
                      </div>
                      <div className="flex items-center justify-between border-t border-slate-200/60 pt-1.5">
                        <span className="text-[10px] text-slate-500 font-bold uppercase flex items-center gap-1">
                          <Layers className="w-3 h-3 text-amber-600" />
                          Less Performed Dept:
                        </span>
                        <span className="font-bold text-slate-700 truncate max-w-[150px] text-right">
                          {clerk.lessDepartment}
                        </span>
                      </div>
                    </div>

                    {/* 5-Tier Mini Distribution Bar */}
                    <div className="space-y-1 mb-2">
                      <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium">
                        <span>Tolerance Tier Distribution</span>
                        <span>Net: <strong className={clerk.netVariance === 0 ? 'text-slate-700' : clerk.netVariance > 0 ? 'text-blue-600 font-mono' : 'text-rose-600 font-mono'}>
                          {clerk.netVariance === 0 ? '$0.00' : clerk.netVariance > 0 ? `+$${clerk.netVariance.toFixed(2)}` : `-$${Math.abs(clerk.netVariance).toFixed(2)}`}
                        </strong></span>
                      </div>
                      <div className="flex h-2 rounded-full overflow-hidden bg-slate-100 gap-0.5">
                        {clerk.tierDistribution.perfect.total > 0 && (
                          <div
                            style={{ width: `${(clerk.tierDistribution.perfect.total / clerk.shiftCount) * 100}%` }}
                            className="bg-emerald-500"
                            title={`Perfect: ${clerk.tierDistribution.perfect.total} shifts`}
                          />
                        )}
                        {clerk.tierDistribution.good.total > 0 && (
                          <div
                            style={{ width: `${(clerk.tierDistribution.good.total / clerk.shiftCount) * 100}%` }}
                            className="bg-blue-500"
                            title={`Minor: ${clerk.tierDistribution.good.total} shifts`}
                          />
                        )}
                        {clerk.tierDistribution.moderate.total > 0 && (
                          <div
                            style={{ width: `${(clerk.tierDistribution.moderate.total / clerk.shiftCount) * 100}%` }}
                            className="bg-amber-500"
                            title={`Moderate: ${clerk.tierDistribution.moderate.total} shifts`}
                          />
                        )}
                        {clerk.tierDistribution.concerned.total > 0 && (
                          <div
                            style={{ width: `${(clerk.tierDistribution.concerned.total / clerk.shiftCount) * 100}%` }}
                            className="bg-orange-500"
                            title={`Concerned: ${clerk.tierDistribution.concerned.total} shifts`}
                          />
                        )}
                        {clerk.tierDistribution.red_flag.total > 0 && (
                          <div
                            style={{ width: `${(clerk.tierDistribution.red_flag.total / clerk.shiftCount) * 100}%` }}
                            className="bg-rose-600"
                            title={`Red Flag: ${clerk.tierDistribution.red_flag.total} shifts`}
                          />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Card Footer: View Shifts or Action */}
                  <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[11px] text-slate-500">
                      {clerk.shifts.length} declarations recorded
                    </span>
                    {onSelectShift && clerk.shifts[0] && (
                      <button
                        type="button"
                        onClick={() => {
                          const id = clerk.shifts[0]._declarationId || Number(String(clerk.shifts[0]['Declaration ID']).replace('#', ''));
                          if (id) onSelectShift(id);
                        }}
                        className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 group cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Audit Latest Shift</span>
                        <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
