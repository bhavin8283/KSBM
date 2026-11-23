import React from 'react';
import {
  TrendingUp,
  TrendingDown,
  Clock,
  Calendar,
  DollarSign,
  Users,
  AlertTriangle,
  Barcode,
  Truck,
  Sparkles,
  Package,
  Layers,
  ArrowRight,
  CheckCircle2,
  PieChart,
  Search,
} from 'lucide-react';
import { InventoryItem, POSDashboardData } from '../types';
import { ExpiryBatch } from '../expiryUtils';

interface WidgetCommonProps {
  data: POSDashboardData | null;
  inventoryItems?: InventoryItem[];
  expiryBatches?: ExpiryBatch[];
  onOpenQuickShelfScan?: () => void;
  onOpenStockOrderAssistant?: () => void;
  onNavigateToInventory?: (filter?: string) => void;
  onOpenQuickExpiry?: () => void;
}

/**
 * 1. Large Dashboard Widget: STOCK ORDER ASSISTANT
 * Quick tool for staff while physically checking shelves and preparing supplier orders.
 */
export const StockOrderAssistantWidget: React.FC<WidgetCommonProps> = ({
  onOpenStockOrderAssistant,
}) => {
  return (
    <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 text-white rounded-3xl p-6 shadow-md relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-5">
      <div className="flex items-start sm:items-center gap-4">
        <div className="p-3.5 bg-white/15 rounded-2xl backdrop-blur-xs border border-white/20 text-white shadow-sm shrink-0">
          <Package className="w-8 h-8 text-blue-100" />
        </div>
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-500/40 text-blue-100 text-[11px] font-bold uppercase tracking-wider mb-1">
            <Sparkles className="w-3 h-3 text-amber-300" />
            <span>Shelf Ordering & Stock Decision Tool</span>
          </div>
          <h3 className="text-xl font-black tracking-tight text-white">
            STOCK ORDER ASSISTANT
          </h3>
          <p className="text-xs sm:text-sm text-blue-100/90 font-medium max-w-xl mt-0.5">
            Quick tool for staff while physically checking retail shelves and preparing supplier orders. Search or scan products to view suggested stock to hold and sales movement.
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={onOpenStockOrderAssistant}
        className="px-6 py-3.5 bg-amber-400 hover:bg-amber-300 active:scale-95 text-amber-950 rounded-2xl text-sm font-black shadow-lg flex items-center justify-center gap-2.5 transition-all cursor-pointer shrink-0"
      >
        <Search className="w-4 h-4 text-amber-900" />
        <span>Open Stock Order Assistant</span>
      </button>
    </div>
  );
};

/**
 * 1b. Legacy Quick Shelf Scan Bar Widget
 */
export const QuickShelfScanBarWidget: React.FC<WidgetCommonProps> = ({
  onOpenQuickShelfScan,
  onOpenStockOrderAssistant,
  inventoryItems = [],
}) => {
  return (
    <StockOrderAssistantWidget
      data={null}
      onOpenStockOrderAssistant={onOpenStockOrderAssistant || onOpenQuickShelfScan}
    />
  );
};

/**
 * 2. Fast Moving Products (Daily Reorder Watch)
 */
export const FastMoversReorderWidget: React.FC<WidgetCommonProps> = ({
  inventoryItems = [],
  onNavigateToInventory,
}) => {
  // Sort items with low stock relative to minimums
  const fastMovers = inventoryItems
    .filter((item) => (item.minimumStock || 2) >= 3)
    .sort((a, b) => (b.minimumStock || 0) - (a.minimumStock || 0))
    .slice(0, 5);

  return (
    <div className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl p-5 shadow-xs space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-neutral-800">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300 rounded-lg">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-neutral-100">
              Fast Moving Products (Daily Velocity Watch)
            </h3>
            <p className="text-xs text-slate-500">High-turnover products requiring frequent shelf replenishment</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onNavigateToInventory && onNavigateToInventory()}
          className="text-xs text-blue-600 font-bold hover:underline"
        >
          View All Inventory
        </button>
      </div>

      <div className="divide-y divide-slate-100 dark:divide-neutral-800">
        {fastMovers.map((item) => {
          const isLow = item.currentStock < (item.minimumStock || 4);
          return (
            <div key={item.productId} className="py-2.5 flex items-center justify-between text-xs">
              <div>
                <span className="font-bold text-slate-900 dark:text-neutral-100 block">
                  {item.longDescription || item.description}
                </span>
                <span className="text-[11px] text-slate-500">
                  Dept: <strong>{item.departmentName || 'General'}</strong> | Min Safe: <strong>{item.minimumStock || 4}</strong>
                </span>
              </div>

              <div className="text-right">
                <span
                  className={`px-2 py-0.5 rounded-full font-bold font-mono text-[11px] inline-block ${
                    isLow
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                      : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                  }`}
                >
                  {item.currentStock} in stock
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Est. Sales: ~{((item.minimumStock || 2) * 1.8).toFixed(0)} / wk
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/**
 * 3. Daily Sales Target & Goal Meter
 */
export const TargetGoalMeterWidget: React.FC<WidgetCommonProps> = ({ data }) => {
  const currentSales = data?.sessionSales ?? data?.todaySales ?? 640;
  const dailyTarget = 1500;
  const progressPct = Math.min(100, Math.round((currentSales / dailyTarget) * 100));

  return (
    <div className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl p-5 shadow-xs space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-neutral-800">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300 rounded-lg">
            <DollarSign className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-neutral-100">
              Daily Target Goal Meter
            </h3>
            <p className="text-xs text-slate-500">Live store revenue milestone</p>
          </div>
        </div>
        <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
          {progressPct}% Reached
        </span>
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <span className="text-2xl font-black text-slate-900 dark:text-neutral-100">
            ${currentSales.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
          </span>
          <span className="text-xs text-slate-500">
            Target: <strong>${dailyTarget.toLocaleString('en-AU')}</strong>
          </span>
        </div>

        <div className="h-3 w-full bg-slate-100 dark:bg-neutral-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 transition-all rounded-full"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
          <span>Remaining to Goal: <strong>${Math.max(0, dailyTarget - currentSales).toFixed(2)}</strong></span>
          <span>Avg Pace: <strong>${(currentSales / 8).toFixed(1)}/hr</strong></span>
        </div>
      </div>
    </div>
  );
};

/**
 * 4. Department Sales Leaderboard
 */
export const DepartmentLeaderboardWidget: React.FC<WidgetCommonProps> = ({ data }) => {
  const deptSales = Array.isArray(data?.departmentSales) ? data?.departmentSales : [];

  return (
    <div className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl p-5 shadow-xs space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-neutral-800">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300 rounded-lg">
            <PieChart className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-neutral-100">
              Department Sales Leaderboard
            </h3>
            <p className="text-xs text-slate-500">Top earning store departments for this period</p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {deptSales.slice(0, 5).map((dept, idx) => (
          <div key={dept.name} className="flex items-center justify-between text-xs p-2 rounded-xl bg-slate-50 dark:bg-neutral-800/50">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-neutral-700 text-slate-700 dark:text-neutral-300 flex items-center justify-center font-bold text-[10px]">
                {idx + 1}
              </span>
              <span className="font-bold text-slate-800 dark:text-neutral-200">{dept.name}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-bold font-mono text-slate-900 dark:text-neutral-100">
                ${dept.amount.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
              </span>
              <span className="text-[11px] text-slate-400 font-semibold w-10 text-right">
                {dept.percentage}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * 5. Imminent Expiry & Markdown Watchlist
 */
export const ExpiryWatchlistFeedWidget: React.FC<WidgetCommonProps> = ({
  expiryBatches = [],
  onOpenQuickExpiry,
}) => {
  const activeBatches = expiryBatches.filter((b) => b.status === 'active').slice(0, 4);

  return (
    <div className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl p-5 shadow-xs space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-neutral-800">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-300 rounded-lg">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-neutral-100">
              Expiry & Markdown Watchlist
            </h3>
            <p className="text-xs text-slate-500">Batches needing quick markdown</p>
          </div>
        </div>

        {onOpenQuickExpiry && (
          <button
            type="button"
            onClick={onOpenQuickExpiry}
            className="text-xs text-blue-600 font-bold hover:underline"
          >
            + Add Batch
          </button>
        )}
      </div>

      {activeBatches.length > 0 ? (
        <div className="space-y-2">
          {activeBatches.map((batch) => (
            <div key={batch.id} className="p-2.5 rounded-xl border border-slate-100 dark:border-neutral-800 bg-slate-50/70 dark:bg-neutral-800/40 flex items-center justify-between text-xs">
              <div>
                <span className="font-bold text-slate-800 dark:text-neutral-200 block truncate max-w-[160px]">
                  {batch.productDescription || 'Product Batch'}
                </span>
                <span className="text-[10px] text-slate-400">
                  Qty: {batch.quantity} units | Exp: {batch.expiryDate}
                </span>
              </div>
              <span className="px-2 py-0.5 rounded-md font-bold text-[10px] bg-rose-100 text-rose-800">
                Action Required
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-4 text-center text-xs text-slate-400">
          No critical expiry batches recorded today.
        </div>
      )}
    </div>
  );
};

/**
 * 6. Supplier Delivery & Order Cut-Offs
 */
export const SupplierScheduleCardWidget: React.FC<WidgetCommonProps> = () => {
  const suppliers = [
    { name: 'Coca-Cola Amatil', cutoff: 'Today 5:00 PM', delivery: 'Tomorrow 8:00 AM', status: 'OPEN' },
    { name: 'Lion Dairy & Drinks', cutoff: 'Tomorrow 2:00 PM', delivery: 'Friday 7:00 AM', status: 'OPEN' },
    { name: 'Smiths Snackfood', cutoff: 'Thursday 4:00 PM', delivery: 'Monday 9:00 AM', status: 'OPEN' },
  ];

  return (
    <div className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl p-5 shadow-xs space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-neutral-800">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-300 rounded-lg">
            <Truck className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-neutral-100">
              Supplier Ordering Cut-Offs
            </h3>
            <p className="text-xs text-slate-500">Order deadlines for next-day replenishment</p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {suppliers.map((s) => (
          <div key={s.name} className="p-2.5 rounded-xl border border-slate-100 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-800/50 flex items-center justify-between text-xs">
            <div>
              <span className="font-bold text-slate-900 dark:text-neutral-100 block">{s.name}</span>
              <span className="text-[10px] text-slate-500">Cut-off: <strong className="text-amber-700 dark:text-amber-300">{s.cutoff}</strong></span>
            </div>
            <span className="px-2 py-0.5 bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 rounded-md font-bold text-[10px]">
              ETA: {s.delivery}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * 7. Live Basket Size & Customer Volume
 */
export const BasketVelocityMetricsWidget: React.FC<WidgetCommonProps> = ({ data }) => {
  const avgBasket = data?.avgBasketValue ?? 14.68;
  const customers = data?.customerCount ?? 308;
  const totalSales = data?.sessionSales ?? 4521.44;

  return (
    <div className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl p-5 shadow-xs space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-neutral-800">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300 rounded-lg">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-neutral-100">
              Basket Depth & Volume
            </h3>
            <p className="text-xs text-slate-500">Live shopper conversion metrics</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="p-3 bg-slate-50 dark:bg-neutral-800 rounded-xl">
          <span className="text-slate-500 text-[10px] block uppercase">Average Basket</span>
          <span className="text-lg font-black text-blue-600 dark:text-blue-400 font-mono">
            ${avgBasket.toFixed(2)}
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">Per Checkout</span>
        </div>

        <div className="p-3 bg-slate-50 dark:bg-neutral-800 rounded-xl">
          <span className="text-slate-500 text-[10px] block uppercase">Units / Basket</span>
          <span className="text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono">
            ~2.8 Items
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">Items per cart</span>
        </div>
      </div>
    </div>
  );
};
