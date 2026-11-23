import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Clock,
  AlertOctagon,
  AlertTriangle,
  Calendar,
  Layers,
  Plus,
  Maximize2,
  Minimize2,
  ChevronRight,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  Package,
  Sparkles,
  Search,
  Check,
  Trash2,
  ArrowUpRight,
  Pause,
  Play,
} from 'lucide-react';
import {
  ExpiryBatch,
  isDashboardExpired,
  isDashboardThisWeek,
  isDashboardThisMonth,
  formatExpiryRelative,
  getDaysUntilExpiry,
} from '../expiryUtils';
import { AddEditExpiryModal } from './AddEditExpiryModal';

interface DashboardExpiryWidgetProps {
  inventoryItems?: any[];
  onNavigateToInventory?: (filter?: string) => void;
  width?: 'one_third' | 'half' | 'two_thirds' | 'full';
  onChangeWidth?: (newWidth: 'half' | 'two_thirds' | 'full') => void;
}

export const DashboardExpiryWidget: React.FC<DashboardExpiryWidgetProps> = ({
  inventoryItems = [],
  onNavigateToInventory,
  width = 'full',
  onChangeWidth,
}) => {
  const [batches, setBatches] = useState<ExpiryBatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedBatchForResolve, setSelectedBatchForResolve] = useState<ExpiryBatch | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [isAutoScrollPaused, setIsAutoScrollPaused] = useState(false);

  // Fetch batches from backend
  const fetchBatches = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/expiry/batches');
      if (res.ok) {
        const json = await res.json();
        setBatches(json.batches || []);
      }
    } catch (e) {
      console.warn('Failed to load expiry batches for dashboard:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBatches();
  }, []);

  // Filter batches into the 3 Dashboard categories
  const expiredList = useMemo(() => {
    return batches
      .filter((b) => isDashboardExpired(b))
      .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
  }, [batches]);

  const thisWeekList = useMemo(() => {
    return batches
      .filter((b) => isDashboardThisWeek(b))
      .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
  }, [batches]);

  const thisMonthList = useMemo(() => {
    return batches
      .filter((b) => isDashboardThisMonth(b))
      .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
  }, [batches]);

  // Count older unresolved items that expired > 7 days ago
  const olderUnresolvedCount = useMemo(() => {
    return batches.filter((b) => {
      if (b.status !== 'active') return false;
      const days = getDaysUntilExpiry(b.expiryDate);
      return days < -7;
    }).length;
  }, [batches]);

  // Handle fast resolve from dashboard (Sold / Written off)
  const handleQuickResolve = async (batchId: string, action: 'sold' | 'written_off' | 'cleared') => {
    setIsResolving(true);
    try {
      const res = await fetch(`/api/expiry/${batchId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, staffName: 'Dashboard Staff' }),
      });
      if (res.ok) {
        const json = await res.json();
        setBatches(json.batches || []);
      }
    } catch (e) {
      console.error('Resolve error:', e);
    } finally {
      setIsResolving(false);
      setSelectedBatchForResolve(null);
    }
  };

  return (
    <div className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-3xl p-5 shadow-xs space-y-4 relative overflow-hidden">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-neutral-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-400 rounded-2xl shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold text-slate-900 dark:text-neutral-100 tracking-tight">
                EXPIRY DATE MONITORING & FLAGGING
              </h2>
              {/* Category Count Pills */}
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                {expiredList.length} Expired
              </span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                {thisWeekList.length} This Week
              </span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                {thisMonthList.length} This Month
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-neutral-400 mt-0.5">
              Live shelf freshness ticker, critical markdowns & automated batch alerting
            </p>
          </div>
        </div>

        {/* Action Buttons: Add Expiry, Refresh, Sizing Toggles */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Pause / Resume Ticker */}
          <button
            type="button"
            onClick={() => setIsAutoScrollPaused((prev) => !prev)}
            className={`p-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer flex items-center gap-1 ${
              isAutoScrollPaused
                ? 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-neutral-800 dark:text-amber-300'
                : 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-neutral-800 dark:text-neutral-300 dark:border-neutral-700'
            }`}
            title={isAutoScrollPaused ? 'Resume scrolling ticker' : 'Pause scrolling ticker'}
          >
            {isAutoScrollPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            <span className="hidden md:inline">{isAutoScrollPaused ? 'Resume' : 'Pause'}</span>
          </button>

          {/* Sizing toggles if parent provided callback */}
          {onChangeWidth && (
            <div className="flex items-center bg-slate-100 dark:bg-neutral-800 rounded-xl p-0.5 text-xs">
              <button
                type="button"
                onClick={() => onChangeWidth('half')}
                className={`px-2 py-1 rounded-lg font-bold ${
                  width === 'half'
                    ? 'bg-white dark:bg-neutral-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
                title="Half width"
              >
                1/2
              </button>
              <button
                type="button"
                onClick={() => onChangeWidth('two_thirds')}
                className={`px-2 py-1 rounded-lg font-bold ${
                  width === 'two_thirds'
                    ? 'bg-white dark:bg-neutral-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
                title="2/3 width"
              >
                2/3
              </button>
              <button
                type="button"
                onClick={() => onChangeWidth('full')}
                className={`px-2 py-1 rounded-lg font-bold ${
                  width === 'full'
                    ? 'bg-white dark:bg-neutral-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
                title="Full width"
              >
                Full
              </button>
            </div>
          )}

          {/* Add Expiry Button */}
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Product Expiry</span>
          </button>

          {/* View in Expiry Management Tab */}
          {onNavigateToInventory && (
            <button
              type="button"
              onClick={() => onNavigateToInventory('expiry_tab')}
              className="px-3 py-2 bg-slate-100 dark:bg-neutral-800 hover:bg-slate-200 text-slate-700 dark:text-neutral-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
              title="Open full Expiry Management Table in Inventory"
            >
              <span>Full Manager</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* THREE SUB-PANELS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* SUB-PANEL 1: EXPIRED ALREADY (RED) */}
        <ScrollingSubpanel
          title="EXPIRED ALREADY"
          subTitle="Critical Action Required"
          headerBg="bg-rose-500 text-white"
          containerBg="bg-rose-50/40 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/60"
          badgeClass="bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-200"
          items={expiredList}
          isAutoScrollPaused={isAutoScrollPaused}
          onQuickResolve={(b) => setSelectedBatchForResolve(b)}
          theme="red"
          emptyMessage="No recently expired products"
        />

        {/* SUB-PANEL 2: EXPIRING THIS WEEK (BLUE) */}
        <ScrollingSubpanel
          title="EXPIRING THIS WEEK"
          subTitle="Next 7 Days Threshold"
          headerBg="bg-blue-600 text-white"
          containerBg="bg-blue-50/40 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/60"
          badgeClass="bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200"
          items={thisWeekList}
          isAutoScrollPaused={isAutoScrollPaused}
          onQuickResolve={(b) => setSelectedBatchForResolve(b)}
          theme="blue"
          emptyMessage="No products expiring this week"
        />

        {/* SUB-PANEL 3: EXPIRING THIS MONTH (GREEN) */}
        <ScrollingSubpanel
          title="EXPIRING THIS MONTH"
          subTitle="8 to 30 Days Forecast"
          headerBg="bg-emerald-600 text-white"
          containerBg="bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/60"
          badgeClass="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200"
          items={thisMonthList}
          isAutoScrollPaused={isAutoScrollPaused}
          onQuickResolve={(b) => setSelectedBatchForResolve(b)}
          theme="green"
          emptyMessage="No products expiring this month"
        />
      </div>

      {/* Older Unresolved Items Notice Footer */}
      {olderUnresolvedCount > 0 && onNavigateToInventory && (
        <div className="p-2.5 bg-amber-50 dark:bg-neutral-800/80 border border-amber-200 dark:border-amber-800/60 rounded-xl flex items-center justify-between text-xs text-amber-900 dark:text-amber-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>{olderUnresolvedCount} older expired batch(es)</strong> are past 7 days and removed from the Dashboard ticker. They remain in the Expiry Management table.
            </span>
          </div>
          <button
            type="button"
            onClick={() => onNavigateToInventory('expiry_unresolved')}
            className="font-bold underline text-amber-700 hover:text-amber-800 dark:text-amber-300 ml-2 shrink-0 cursor-pointer"
          >
            Review in Table →
          </button>
        </div>
      )}

      {/* Add / Edit Expiry Modal */}
      <AddEditExpiryModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        inventoryProducts={inventoryItems}
        onBatchesSaved={(newBatches) => {
          fetchBatches();
        }}
      />

      {/* Quick Resolve Action Modal */}
      {selectedBatchForResolve && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-3xl p-6 shadow-2xl max-w-md w-full space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-neutral-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-neutral-100 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-blue-600" />
                <span>Resolve Expiry Batch</span>
              </h3>
              <button
                type="button"
                onClick={() => setSelectedBatchForResolve(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-neutral-800 rounded-2xl space-y-1 text-xs">
              <div className="font-bold text-slate-900 dark:text-neutral-100 text-sm">
                {selectedBatchForResolve.productName}
              </div>
              <div className="text-slate-500">
                Tracked Qty: <strong>{selectedBatchForResolve.quantity} units</strong> | Expiry: <strong>{selectedBatchForResolve.expiryDate}</strong> ({formatExpiryRelative(selectedBatchForResolve.expiryDate)})
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-neutral-300">
              Select an action to resolve this batch:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                disabled={isResolving}
                onClick={() => handleQuickResolve(selectedBatchForResolve.id, 'sold')}
                className="p-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-bold text-center transition-colors cursor-pointer"
              >
                Mark as Sold
              </button>
              <button
                type="button"
                disabled={isResolving}
                onClick={() => handleQuickResolve(selectedBatchForResolve.id, 'written_off')}
                className="p-3 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl text-xs font-bold text-center transition-colors cursor-pointer"
              >
                Write Off / Spoilage
              </button>
              <button
                type="button"
                disabled={isResolving}
                onClick={() => handleQuickResolve(selectedBatchForResolve.id, 'cleared')}
                className="p-3 bg-slate-200 hover:bg-slate-300 text-slate-800 dark:bg-neutral-700 dark:text-neutral-200 rounded-2xl text-xs font-bold text-center transition-colors cursor-pointer"
              >
                Clear Entry
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ==================== SCROLLING SUBPANEL COMPONENT ====================

interface ScrollingSubpanelProps {
  title: string;
  subTitle: string;
  headerBg: string;
  containerBg: string;
  badgeClass: string;
  items: ExpiryBatch[];
  isAutoScrollPaused: boolean;
  onQuickResolve: (batch: ExpiryBatch) => void;
  theme: 'red' | 'blue' | 'green';
  emptyMessage: string;
}

const ScrollingSubpanel: React.FC<ScrollingSubpanelProps> = ({
  title,
  subTitle,
  headerBg,
  containerBg,
  badgeClass,
  items,
  isAutoScrollPaused,
  onQuickResolve,
  theme,
  emptyMessage,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  // Seamless infinite auto-scrolling loop
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el || items.length <= 2 || isHovered || isAutoScrollPaused) return;

    let animationFrameId: number;
    let lastTime = performance.now();

    const scrollStep = (time: number) => {
      if (el && !isHovered && !isAutoScrollPaused) {
        const delta = time - lastTime;
        if (delta >= 35) {
          const halfHeight = el.scrollHeight / 2;
          if (halfHeight > 0 && el.scrollTop >= halfHeight - 2) {
            el.scrollTop = 0;
          } else {
            el.scrollTop += 1;
          }
          lastTime = time;
        }
      }
      animationFrameId = requestAnimationFrame(scrollStep);
    };

    animationFrameId = requestAnimationFrame(scrollStep);
    return () => cancelAnimationFrame(animationFrameId);
  }, [items.length, isHovered, isAutoScrollPaused]);

  // Duplicate items for seamless infinite scroll if more than 2 items
  const displayItems = items.length > 2 ? [...items, ...items] : items;

  return (
    <div
      className={`border rounded-2xl overflow-hidden flex flex-col ${containerBg} shadow-2xs`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Subpanel Header */}
      <div className={`px-3.5 py-2.5 flex items-center justify-between ${headerBg} shrink-0`}>
        <div>
          <h3 className="text-xs font-black tracking-wider uppercase">{title}</h3>
          <span className="text-[10px] opacity-90 block">{subTitle}</span>
        </div>
        <span className="px-2 py-0.5 rounded-full text-xs font-black bg-white/20 text-white backdrop-blur-xs">
          {items.length}
        </span>
      </div>

      {/* Subpanel Body (Auto-scrolling bottom-to-up seamless loop) */}
      <div
        ref={scrollContainerRef}
        className="p-2.5 space-y-2 h-56 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-neutral-700"
      >
        {items.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4 text-xs text-slate-400">
            <CheckCircle2 className="w-7 h-7 mb-1 text-slate-300 dark:text-neutral-600" />
            <span>{emptyMessage}</span>
          </div>
        ) : (
          displayItems.map((batch, idx) => {
            const daysUntil = getDaysUntilExpiry(batch.expiryDate);
            const relativeStr = formatExpiryRelative(batch.expiryDate);

            return (
              <div
                key={`${batch.id}-${idx}`}
                className="p-2.5 bg-white dark:bg-neutral-800/90 border border-slate-200/80 dark:border-neutral-700 rounded-xl shadow-2xs text-xs space-y-1.5 transition-all hover:border-blue-400"
              >
                <div className="flex items-start justify-between gap-1.5">
                  <div className="font-bold text-slate-900 dark:text-neutral-100 leading-tight">
                    {batch.productName}
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-black font-mono shrink-0 ${badgeClass}`}
                  >
                    {batch.quantity} units
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-neutral-400">
                  <span className="font-medium">
                    {batch.departmentName || 'General'}
                  </span>
                  <span
                    className={`font-bold ${
                      theme === 'red'
                        ? 'text-rose-600 dark:text-rose-400'
                        : theme === 'blue'
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    {batch.expiryDate} ({relativeStr})
                  </span>
                </div>

                {/* Quick resolve / mark button */}
                <div className="pt-1 flex items-center justify-between border-t border-slate-100 dark:border-neutral-700/60 text-[11px]">
                  {batch.batchLot ? (
                    <span className="text-slate-400 font-mono text-[10px]">Lot: {batch.batchLot}</span>
                  ) : (
                    <span className="text-slate-400 text-[10px]">Active Shelf Batch</span>
                  )}
                  <button
                    type="button"
                    onClick={() => onQuickResolve(batch)}
                    className="text-blue-600 hover:text-blue-800 dark:text-blue-400 font-bold hover:underline cursor-pointer"
                  >
                    Action / Resolve →
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
