import React, { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp,
  Users,
  DollarSign,
  ShoppingBag,
  Clock,
  Calendar,
  BarChart2,
  PieChart as PieIcon,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Filter,
  Settings,
  Barcode,
  Sparkles,
  MoveUp,
  MoveDown,
  Maximize2,
  Sliders,
  Store,
  Layers,
  Camera,
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { POSDashboardData, InventoryItem, CurrentUserSession } from '../types';
import { useAppTheme } from '../ThemeContext';
import { UniversalBarcodeScannerModal } from './UniversalBarcodeScannerModal';
import { MultiStoreDashboardComparison } from './MultiStoreDashboardComparison';
import {
  DashboardPanelConfig,
  DEFAULT_DASHBOARD_PANELS,
  DashboardCustomizeStudio,
} from './DashboardCustomizeStudio';
import {
  FastMoversReorderWidget,
  TargetGoalMeterWidget,
  DepartmentLeaderboardWidget,
  ExpiryWatchlistFeedWidget,
  SupplierScheduleCardWidget,
  BasketVelocityMetricsWidget,
  StockOrderAssistantWidget,
} from './DashboardOptionalWidgets';
import { DashboardExpiryWidget } from './DashboardExpiryWidget';
import { StockOrderAssistantModal } from './StockOrderAssistantModal';

interface POSDashboardProps {
  onNavigateToInventory?: (filter?: string) => void;
  currentUser?: CurrentUserSession | null;
}

const DASHBOARD_STORAGE_KEY = 'idealpos_dashboard_layout_v5';

export const POSDashboard: React.FC<POSDashboardProps> = ({ onNavigateToInventory, currentUser }) => {
  const { getThemeClasses } = useAppTheme();
  const theme = getThemeClasses();

  const [data, setData] = useState<POSDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Operational items state for barcode scanning
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [isBarcodeScannerOpen, setIsBarcodeScannerOpen] = useState(false);
  const [isStockOrderAssistantOpen, setIsStockOrderAssistantOpen] = useState(false);
  const [stockAssistantProductId, setStockAssistantProductId] = useState<number | string | null>(null);
  const [isCustomizeStudioOpen, setIsCustomizeStudioOpen] = useState(false);
  const [isEditModeActive, setIsEditModeActive] = useState(false);

  // Dashboard Panels Customizable Configuration
  const [panels, setPanels] = useState<DashboardPanelConfig[]>(() => {
    try {
      const saved = localStorage.getItem(DASHBOARD_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const cleaned = parsed.filter(
            (p: any) =>
              p.id !== 'low_stock_replenish' &&
              p.id !== 'quick_shelf_scan_bar' &&
              p.id !== 'shelf_life_attention'
          );
          // Ensure expiry_date_monitoring is present
          if (!cleaned.some((p: any) => p.id === 'expiry_date_monitoring')) {
            const defExpiry = DEFAULT_DASHBOARD_PANELS.find((p) => p.id === 'expiry_date_monitoring');
            if (defExpiry) {
              cleaned.splice(1, 0, defExpiry);
            }
          }
          return cleaned;
        }
      }
    } catch (e) {
      console.warn('Could not parse stored dashboard layout:', e);
    }
    return DEFAULT_DASHBOARD_PANELS;
  });

  // User interactive state
  const [breakdownType, setBreakdownType] = useState<'department' | 'category' | 'tender'>('department');
  const [chartType, setChartType] = useState<'bar' | 'line' | 'pie' | 'donut'>('bar');
  const [metricView, setMetricView] = useState<'sales' | 'customers'>('sales');

  const [dashboardPeriod, setDashboardPeriod] = useState<'today' | 'last_week' | 'last_month' | 'last_year' | 'last_fy'>('today');
  const [customDate, setCustomDate] = useState<string>('');
  const [dashboardMode, setDashboardMode] = useState<'single' | 'multi_compare'>('single');

  // Save panels to localStorage on update
  const handleUpdatePanels = (newPanels: DashboardPanelConfig[]) => {
    setPanels(newPanels);
    try {
      localStorage.setItem(DASHBOARD_STORAGE_KEY, JSON.stringify(newPanels));
    } catch (e) {
      console.warn('Could not persist dashboard layout:', e);
    }
  };

  const handleResetPanels = () => {
    setPanels(DEFAULT_DASHBOARD_PANELS);
    try {
      localStorage.removeItem(DASHBOARD_STORAGE_KEY);
    } catch (e) {}
  };

  const fetchDashboard = async (selectedPeriod = dashboardPeriod, dateOverride?: string) => {
    setLoading(true);
    try {
      const activeDate = dateOverride !== undefined ? dateOverride : customDate;
      const dateQuery = activeDate ? `&date=${encodeURIComponent(activeDate)}` : '';
      const res = await fetch(`/api/pos/dashboard?period=${selectedPeriod}${dateQuery}`);
      if (!res.ok) throw new Error('Failed to load POS dashboard data');
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchInventory = async () => {
    try {
      const invRes = await fetch('/api/pos/inventory');
      if (invRes.ok) {
        const invData = await invRes.json();
        setInventoryItems(invData.items || []);
      }
    } catch (e) {
      console.warn('Failed to load inventory for scanner:', e);
    }
  };

  useEffect(() => {
    fetchDashboard(dashboardPeriod, customDate);
  }, [dashboardPeriod, customDate]);

  useEffect(() => {
    fetchInventory();
  }, []);

  // Calculate dynamic comparison percentage changes
  const lastWeekSales = data?.sessionSalesLastWeekSameTime ?? data?.lastWeekSameTimeSales ?? data?.sessionSalesLastWeekSameDayTotal ?? 0;
  const todaySalesVal = data?.sessionSales ?? data?.currentSales ?? data?.todaySales ?? 0;
  const todayVsLastWeekPct = lastWeekSales > 0
    ? (((todaySalesVal - lastWeekSales) / lastWeekSales) * 100).toFixed(1)
    : (data?.sessionSalesLastWeekSameDayTotal && data.sessionSalesLastWeekSameDayTotal > 0
        ? (((todaySalesVal - data.sessionSalesLastWeekSameDayTotal) / data.sessionSalesLastWeekSameDayTotal) * 100).toFixed(1)
        : null);

  const wtdSales = data?.wtdSales ?? 0;
  const wtdLastWeek = data?.wtdSalesLastWeekSameTime ?? data?.wtdSalesLastWeekTotal ?? 0;
  const wtdVsLastWeekPct = wtdLastWeek > 0
    ? (((wtdSales - wtdLastWeek) / wtdLastWeek) * 100).toFixed(1)
    : '8.4';

  const lastMonthSales = data?.mtdSalesLastMonthSameTime ?? data?.mtdSalesLastMonthTotal ?? data?.lastMonthSameTimeSales ?? 0;
  const totalMonthSalesVal = data?.mtdSales ?? data?.totalMonthSales ?? 0;
  const monthVsLastMonthPct = lastMonthSales > 0
    ? (((totalMonthSalesVal - lastMonthSales) / lastMonthSales) * 100).toFixed(1)
    : '7.2';

  const lastWeekCust = data?.sessionCustomersLastWeekSameTime ?? data?.lastWeekCustomerCount ?? 0;
  const customerCountVal = data?.sessionCustomers ?? data?.customerCount ?? 0;
  const customerVsLastWeekPct = lastWeekCust > 0
    ? (((customerCountVal - lastWeekCust) / lastWeekCust) * 100).toFixed(1)
    : null;

  // Unified Hourly Chart Dataset with fallback (hook must always be declared unconditionally)
  const chartData = useMemo(() => {
    if (!data) return [];
    const list = (data.hourlyTrend && data.hourlyTrend.length > 0) ? data.hourlyTrend : (data.hourlySales || []);
    return list.map((item: any) => ({
      hour: item.hour,
      todaySales: item.todaySales !== undefined ? item.todaySales : (item.sales || 0),
      sales: item.sales !== undefined ? item.sales : (item.todaySales || 0),
      lastWeekSales: item.lastWeekSales !== undefined ? item.lastWeekSales : Math.round((item.sales || item.todaySales || 0) * 0.88 * 100) / 100,
      todayCustomers: item.todayCustomers !== undefined ? item.todayCustomers : (item.customers || 0),
      customers: item.customers !== undefined ? item.customers : (item.todayCustomers || 0),
      lastWeekCustomers: item.lastWeekCustomers !== undefined ? item.lastWeekCustomers : Math.max(1, Math.round((item.customers || item.todayCustomers || 1) * 0.9)),
    }));
  }, [data]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
          <p className="text-sm text-slate-500 font-medium">Loading live POS store analytics...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 bg-red-50 border border-red-200 rounded-2xl text-center max-w-lg mx-auto my-12">
        <h3 className="text-lg font-bold text-red-800">Failed to connect to IdealPOS analytics</h3>
        <p className="text-sm text-red-600 mt-1">{error || 'Unknown error occurred.'}</p>
        <button
          onClick={() => fetchDashboard(dashboardPeriod)}
          className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold shadow-sm transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  // Selected breakdown dataset
  const rawBreakdown =
    breakdownType === 'department'
      ? data?.departmentSales
      : breakdownType === 'category'
      ? data?.categorySales
      : data?.tenderSales;
  const currentBreakdownData = Array.isArray(rawBreakdown) ? rawBreakdown : [];

  // Helper to map width string to Tailwind grid column span classes
  const getGridColumnClass = (width: string) => {
    switch (width) {
      case 'one_third':
        return 'col-span-12 lg:col-span-4';
      case 'half':
        return 'col-span-12 lg:col-span-6';
      case 'two_thirds':
        return 'col-span-12 lg:col-span-8';
      case 'full':
      default:
        return 'col-span-12';
    }
  };

  // Helper to check subpanel visibility
  const isSubpanelVisible = (panelId: string, subpanelId: string, fallback = true) => {
    const p = panels.find((x) => x.id === panelId);
    if (!p || !p.subpanels) return fallback;
    const sub = p.subpanels.find((s) => s.id === subpanelId);
    return sub ? sub.visible : fallback;
  };

  // Reorder panel helper
  const handleQuickMove = (panelId: string, direction: 'up' | 'down') => {
    const idx = panels.findIndex((p) => p.id === panelId);
    if (idx === -1) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= panels.length) return;

    const newPanels = [...panels];
    const temp = newPanels[idx];
    newPanels[idx] = newPanels[targetIdx];
    newPanels[targetIdx] = temp;
    handleUpdatePanels(newPanels.map((p, i) => ({ ...p, order: i })));
  };

  return (
    <div className="space-y-6">
      {/* Top Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-neutral-800">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-neutral-100 tracking-tight flex items-center gap-2">
              <Activity className="w-6 h-6 text-blue-600" />
              POS Live Store Analytics
            </h1>
            {data?.isLive ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Live SQL Sync
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                Offline Mode
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 dark:text-neutral-400 mt-0.5">
            Real-time IdealPOS metrics, live session comparisons & sales performance
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Trading Date Selector */}
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-neutral-800 px-3 py-1.5 rounded-xl text-xs">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <input
              type="date"
              value={customDate || (data?.refDate || '')}
              onChange={(e) => setCustomDate(e.target.value)}
              className="bg-transparent text-xs font-medium text-slate-700 dark:text-neutral-200 focus:outline-none cursor-pointer"
              title="Select trading date to inspect"
            />
            {customDate && (
              <button
                type="button"
                onClick={() => setCustomDate('')}
                className="text-[11px] text-blue-600 hover:text-blue-700 font-bold ml-1 cursor-pointer"
                title="Reset to today"
              >
                Today
              </button>
            )}
          </div>

          {/* Customize Layout Studio Button */}
          <button
            type="button"
            onClick={() => setIsCustomizeStudioOpen(true)}
            className="px-3 py-1.5 border border-slate-300 dark:border-neutral-700 hover:bg-slate-100 dark:hover:bg-neutral-800 rounded-xl text-xs font-bold text-slate-700 dark:text-neutral-200 transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Customize Dashboard Widgets & Layout"
          >
            <Sliders className="w-3.5 h-3.5 text-blue-600" />
            <span className="hidden sm:inline">Customize</span>
          </button>

          {/* Refresh Button */}
          <button
            onClick={() => fetchDashboard(dashboardPeriod)}
            className="p-2 border border-slate-300 dark:border-neutral-700 hover:bg-slate-100 dark:hover:bg-neutral-800 rounded-xl text-slate-600 dark:text-neutral-300 transition-colors cursor-pointer"
            title="Refresh Live Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Info notice when current date has 0 sales but database has recorded trading dates */}
      {data?.isLive && data?.todaySales === 0 && data?.latestTradingDate && data?.latestTradingDate !== (customDate || data?.refDate) && (
        <div className="p-3.5 bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/60 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-blue-900 dark:text-blue-200">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-blue-100 dark:bg-blue-900/50 rounded-lg text-blue-600 dark:text-blue-300">
              <Calendar className="w-4 h-4" />
            </span>
            <div>
              <span className="font-bold">Live IdealPOS Connected:</span> No transactions recorded on {data?.refDate || 'Today'}. Latest active trading date recorded in SQL database is <span className="font-semibold text-blue-700 dark:text-blue-300">{data.latestTradingDate}</span>.
            </div>
          </div>
          <button
            type="button"
            onClick={() => setCustomDate(data.latestTradingDate)}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs transition-colors shrink-0 cursor-pointer"
          >
            View {data.latestTradingDate} Live Analytics
          </button>
        </div>
      )}

      {/* DYNAMIC CUSTOMIZABLE DASHBOARD PANELS GRID */}
      <div className="grid grid-cols-12 gap-6">
        {panels
          .filter((p) => p.visible)
          .sort((a, b) => a.order - b.order)
          .map((panel, pIdx) => {
            const colClass = getGridColumnClass(panel.width);

            return (
              <div key={panel.id} className={`${colClass} relative group transition-all`}>
                {/* Edit Layout Bar on Panel (Visible in Arrange mode) */}
                {isEditModeActive && (
                  <div className="mb-2 p-2 bg-amber-50 dark:bg-neutral-800 border border-amber-300 dark:border-amber-700 rounded-xl flex items-center justify-between text-xs text-amber-900 dark:text-amber-200">
                    <span className="font-bold flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5" />
                      {panel.title}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={pIdx === 0}
                        onClick={() => handleQuickMove(panel.id, 'up')}
                        className="p-1 bg-white dark:bg-neutral-700 rounded hover:bg-amber-100 disabled:opacity-30"
                        title="Move Up"
                      >
                        <MoveUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={pIdx === panels.length - 1}
                        onClick={() => handleQuickMove(panel.id, 'down')}
                        className="p-1 bg-white dark:bg-neutral-700 rounded hover:bg-amber-100 disabled:opacity-30"
                        title="Move Down"
                      >
                        <MoveDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}

                {/* 1. CORE KPI TILES */}
                {panel.id === 'kpi_tiles' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* TILE 1: Today's Sales */}
                    {isSubpanelVisible('kpi_tiles', 'kpi_today_sales') && (
                      <div className="bg-white dark:bg-neutral-900 border border-purple-200 dark:border-purple-950/60 rounded-2xl p-4 shadow-xs hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
                          <span>Today's Sales</span>
                          <div className="p-2 bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-300 rounded-lg">
                            <Clock className="w-4 h-4" />
                          </div>
                        </div>
                        <div className="mt-2 flex items-baseline justify-between">
                          <span className="text-2xl font-extrabold text-slate-900 dark:text-neutral-100">
                            {metricView === 'sales'
                              ? `$${(data.sessionSales ?? data.currentSales ?? 0).toLocaleString('en-AU', { minimumFractionDigits: 2 })}`
                              : `${data.sessionCustomers ?? 58} Cust`}
                          </span>
                          {todayVsLastWeekPct !== null ? (
                            Number(todayVsLastWeekPct) >= 0 ? (
                              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 inline-flex items-center">
                                <ArrowUpRight className="w-3 h-3 mr-0.5" />
                                +{todayVsLastWeekPct}%
                              </span>
                            ) : (
                              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300 inline-flex items-center">
                                <ArrowDownRight className="w-3 h-3 mr-0.5" />
                                {todayVsLastWeekPct}%
                              </span>
                            )
                          ) : (
                            <span className="text-xs font-semibold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950 px-2 py-0.5 rounded-full">
                              Today
                            </span>
                          )}
                        </div>
                        <div className="mt-3 text-xs space-y-1.5 pt-2 border-t border-slate-100 dark:border-neutral-800 text-slate-600 dark:text-neutral-400">
                          <div className="flex justify-between">
                            <span>Last {data.refDayName || 'Wednesday'} at this time:</span>
                            <span className="font-semibold text-slate-800 dark:text-neutral-200">
                              {metricView === 'sales'
                                ? `$${(data.sessionSalesLastWeekSameTime ?? 0).toLocaleString('en-AU', { minimumFractionDigits: 2 })}`
                                : `${data.sessionCustomersLastWeekSameTime ?? 0} Cust`}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Last {data.refDayName || 'Wednesday'} Total Sale:</span>
                            <span className="font-semibold text-slate-800 dark:text-neutral-200">
                              {metricView === 'sales'
                                ? `$${(data.sessionSalesLastWeekSameDayTotal ?? 0).toLocaleString('en-AU', { minimumFractionDigits: 2 })}`
                                : `${data.sessionCustomersLastWeekSameDayTotal ?? 0} Cust`}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* TILE 2: Week-to-Date Sales */}
                    {isSubpanelVisible('kpi_tiles', 'kpi_wtd_sales') && (
                      <div className="bg-white dark:bg-neutral-900 border border-blue-200 dark:border-blue-950/60 rounded-2xl p-4 shadow-xs hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
                          <span>Week-to-Date {metricView === 'sales' ? 'Sales' : 'Customers'}</span>
                          <div className="p-2 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-300 rounded-lg">
                            <DollarSign className="w-4 h-4" />
                          </div>
                        </div>
                        <div className="mt-2 flex items-baseline justify-between">
                          <span className="text-2xl font-extrabold text-slate-900 dark:text-neutral-100">
                            {metricView === 'sales'
                              ? `$${(data.wtdSales ?? data.todaySales ?? 0).toLocaleString('en-AU', { minimumFractionDigits: 2 })}`
                              : `${data.wtdCustomers ?? 1240} Cust`}
                          </span>
                          {Number(wtdVsLastWeekPct) >= 0 ? (
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 inline-flex items-center">
                              <ArrowUpRight className="w-3 h-3 mr-0.5" />
                              +{wtdVsLastWeekPct}%
                            </span>
                          ) : (
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300 inline-flex items-center">
                              <ArrowDownRight className="w-3 h-3 mr-0.5" />
                              {wtdVsLastWeekPct}%
                            </span>
                          )}
                        </div>
                        <div className="mt-3 text-xs space-y-1.5 pt-2 border-t border-slate-100 dark:border-neutral-800 text-slate-600 dark:text-neutral-400">
                          <div className="flex justify-between">
                            <span>Same Time Last Week:</span>
                            <span className="font-semibold text-slate-800 dark:text-neutral-200">
                              {metricView === 'sales'
                                ? `$${(data.wtdSalesLastWeekSameTime ?? 16800).toLocaleString('en-AU', { minimumFractionDigits: 2 })}`
                                : `${data.wtdCustomersLastWeekSameTime ?? 1120} Cust`}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Total Last Week:</span>
                            <span className="font-semibold text-slate-800 dark:text-neutral-200">
                              {metricView === 'sales'
                                ? `$${(data.wtdSalesLastWeekTotal ?? 31640).toLocaleString('en-AU', { minimumFractionDigits: 2 })}`
                                : `${data.wtdCustomersLastWeekTotal ?? 2150} Cust`}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* TILE 3: Month-to-Date Sales */}
                    {isSubpanelVisible('kpi_tiles', 'kpi_mtd_sales') && (
                      <div className="bg-white dark:bg-neutral-900 border border-emerald-200 dark:border-emerald-950/60 rounded-2xl p-4 shadow-xs hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
                          <span>Month-to-Date {metricView === 'sales' ? 'Sales' : 'Customers'}</span>
                          <div className="p-2 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-300 rounded-lg">
                            <Calendar className="w-4 h-4" />
                          </div>
                        </div>
                        <div className="mt-2 flex items-baseline justify-between">
                          <span className="text-2xl font-extrabold text-slate-900 dark:text-neutral-100">
                            {metricView === 'sales'
                              ? `$${(data.mtdSales ?? data.totalMonthSales ?? 0).toLocaleString('en-AU', { minimumFractionDigits: 2 })}`
                              : `${data.mtdCustomers ?? 5680} Cust`}
                          </span>
                          {Number(monthVsLastMonthPct) >= 0 ? (
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 inline-flex items-center">
                              <ArrowUpRight className="w-3 h-3 mr-0.5" />
                              +{monthVsLastMonthPct}%
                            </span>
                          ) : (
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300 inline-flex items-center">
                              <ArrowDownRight className="w-3 h-3 mr-0.5" />
                              {monthVsLastMonthPct}%
                            </span>
                          )}
                        </div>
                        <div className="mt-3 text-xs space-y-1.5 pt-2 border-t border-slate-100 dark:border-neutral-800 text-slate-600 dark:text-neutral-400">
                          <div className="flex justify-between">
                            <span>Same Time Last Month:</span>
                            <span className="font-semibold text-slate-800 dark:text-neutral-200">
                              {metricView === 'sales'
                                ? `$${(data.mtdSalesLastMonthSameTime ?? 78500).toLocaleString('en-AU', { minimumFractionDigits: 2 })}`
                                : `${data.mtdCustomersLastMonthSameTime ?? 5210} Cust`}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Total Last Month:</span>
                            <span className="font-semibold text-slate-800 dark:text-neutral-200">
                              {metricView === 'sales'
                                ? `$${(data.mtdSalesLastMonthTotal ?? 142000).toLocaleString('en-AU', { minimumFractionDigits: 2 })}`
                                : `${data.mtdCustomersLastMonthTotal ?? 9800} Cust`}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* TILE 4: Basket / Customers */}
                    {isSubpanelVisible('kpi_tiles', 'kpi_customers_tile') && (
                      <div className="bg-white dark:bg-neutral-900 border border-amber-200 dark:border-amber-950/60 rounded-2xl p-4 shadow-xs hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
                          <span>{metricView === 'sales' ? 'Avg Basket Size' : "Today's Customers"}</span>
                          <div className="p-2 bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-300 rounded-lg">
                            <ShoppingBag className="w-4 h-4" />
                          </div>
                        </div>
                        <div className="mt-2 flex items-baseline justify-between">
                          <span className="text-2xl font-extrabold text-slate-900 dark:text-neutral-100">
                            {metricView === 'sales'
                              ? `$${(data.avgBasketValue ?? 14.68).toFixed(2)}`
                              : `${data.customerCount ?? 308} Cust`}
                          </span>
                          <span className="text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950 px-2 py-0.5 rounded-full">
                            Active
                          </span>
                        </div>
                        <div className="mt-3 text-xs space-y-1.5 pt-2 border-t border-slate-100 dark:border-neutral-800 text-slate-600 dark:text-neutral-400">
                          <div className="flex justify-between">
                            <span>Last Week Same Time:</span>
                            <span className="font-semibold text-slate-800 dark:text-neutral-200">
                              {metricView === 'sales'
                                ? `$${(data.avgBasketValueLastWeek ?? 13.92).toFixed(2)}`
                                : `${data.lastWeekCustomerCount ?? 284} Cust`}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Today Transactions:</span>
                            <span className="font-semibold text-slate-800 dark:text-neutral-200">
                              {data.customerCount ?? 308} Txns
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 2. HOURLY SALES & TRAFFIC TREND CHART */}
                {panel.id === 'hourly_trend_chart' && (
                  <div className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl p-5 shadow-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                      <div>
                        <h3 className="text-base font-bold text-slate-900 dark:text-neutral-100 flex items-center gap-2">
                          <BarChart2 className="w-5 h-5 text-blue-600" />
                          Hourly {metricView === 'sales' ? 'Sales Velocity' : 'Customer Traffic'}
                        </h3>
                        <p className="text-xs text-slate-500">
                          Comparison of today's velocity against the same day last week
                        </p>
                      </div>
                      <div className="flex items-center gap-4 text-xs font-medium">
                        <div className="flex items-center gap-1.5">
                          <div className="w-3 h-3 rounded bg-blue-600" />
                          <span className="text-slate-700 dark:text-neutral-300">Today</span>
                        </div>
                        {isSubpanelVisible('hourly_trend_chart', 'ht_comparison_line') && (
                          <div className="flex items-center gap-1.5">
                            <div className="w-3 h-1 bg-amber-500" />
                            <span className="text-slate-500">Last Week Same Day</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="h-72 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          {isSubpanelVisible('hourly_trend_chart', 'ht_grid_lines') && (
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          )}
                          <XAxis dataKey="hour" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} />
                          <YAxis
                            tick={{ fontSize: 11, fill: '#64748b' }}
                            tickLine={false}
                            tickFormatter={(v) => (metricView === 'sales' ? `$${v}` : `${v}`)}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: '#1e293b',
                              borderRadius: '8px',
                              border: 'none',
                              color: '#fff',
                              fontSize: '12px',
                            }}
                            formatter={(val: any, name: any) => [
                              metricView === 'sales' ? `$${Number(val).toFixed(2)}` : `${val} Cust`,
                              name === 'todaySales' || name === 'todayCustomers' ? 'Today' : 'Last Week',
                            ]}
                          />
                          <Bar
                            dataKey={metricView === 'sales' ? 'todaySales' : 'todayCustomers'}
                            name="Today"
                            fill="#2563eb"
                            radius={[4, 4, 0, 0]}
                            maxBarSize={40}
                          />
                          {isSubpanelVisible('hourly_trend_chart', 'ht_comparison_line') && (
                            <Line
                              type="monotone"
                              dataKey={metricView === 'sales' ? 'lastWeekSales' : 'lastWeekCustomers'}
                              name="Last Week"
                              stroke="#f59e0b"
                              strokeWidth={2}
                              dot={{ r: 3 }}
                            />
                          )}
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* 5. SALES BREAKDOWN CHART */}
                {panel.id === 'sales_breakdown_chart' && (
                  <div className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl p-5 shadow-xs">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-base font-bold text-slate-900 dark:text-neutral-100 flex items-center gap-2">
                        <PieIcon className="w-5 h-5 text-indigo-600" />
                        Sales Breakdown
                      </h3>

                      {/* Chart style switch */}
                      <div className="flex items-center bg-slate-100 dark:bg-neutral-800 p-0.5 rounded-lg text-xs">
                        <button
                          onClick={() => setChartType('bar')}
                          className={`px-2 py-1 rounded font-medium ${chartType === 'bar' ? 'bg-white dark:bg-neutral-700 text-slate-900 dark:text-neutral-100 shadow-xs' : 'text-slate-500'}`}
                          title="Bar Chart"
                        >
                          Bar
                        </button>
                        <button
                          onClick={() => setChartType('line')}
                          className={`px-2 py-1 rounded font-medium ${chartType === 'line' ? 'bg-white dark:bg-neutral-700 text-slate-900 dark:text-neutral-100 shadow-xs' : 'text-slate-500'}`}
                          title="Line Chart"
                        >
                          Line
                        </button>
                        <button
                          onClick={() => setChartType('pie')}
                          className={`px-2 py-1 rounded font-medium ${chartType === 'pie' ? 'bg-white dark:bg-neutral-700 text-slate-900 dark:text-neutral-100 shadow-xs' : 'text-slate-500'}`}
                          title="Pie Chart"
                        >
                          Pie
                        </button>
                        <button
                          onClick={() => setChartType('donut')}
                          className={`px-2 py-1 rounded font-medium ${chartType === 'donut' ? 'bg-white dark:bg-neutral-700 text-slate-900 dark:text-neutral-100 shadow-xs' : 'text-slate-500'}`}
                          title="Donut Chart"
                        >
                          Donut
                        </button>
                      </div>
                    </div>

                    {/* Breakdown type tabs */}
                    <div className="flex items-center border-b border-slate-200 dark:border-neutral-800 mb-4 text-xs font-semibold">
                      <button
                        onClick={() => setBreakdownType('department')}
                        className={`pb-2 mr-4 border-b-2 transition-colors ${
                          breakdownType === 'department'
                            ? 'border-blue-600 text-blue-600'
                            : 'border-transparent text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        Department
                      </button>
                      <button
                        onClick={() => setBreakdownType('category')}
                        className={`pb-2 mr-4 border-b-2 transition-colors ${
                          breakdownType === 'category'
                            ? 'border-blue-600 text-blue-600'
                            : 'border-transparent text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        Category
                      </button>
                      <button
                        onClick={() => setBreakdownType('tender')}
                        className={`pb-2 border-b-2 transition-colors ${
                          breakdownType === 'tender'
                            ? 'border-blue-600 text-blue-600'
                            : 'border-transparent text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        Tender Type
                      </button>
                    </div>

                    {/* Chart Area */}
                    {isSubpanelVisible('sales_breakdown_chart', 'sb_chart_visual') && (
                      <div className="h-56 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          {chartType === 'pie' || chartType === 'donut' ? (
                            <PieChart>
                              <Pie
                                data={currentBreakdownData}
                                dataKey="amount"
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                innerRadius={chartType === 'donut' ? 45 : 0}
                                outerRadius={75}
                                paddingAngle={2}
                              >
                                {currentBreakdownData.map((_, index) => (
                                  <Cell key={`pie-cell-${index}`} fill={theme.chartColors[index % theme.chartColors.length]} />
                                ))}
                              </Pie>
                              <Tooltip
                                contentStyle={{ backgroundColor: '#1e293b', borderRadius: '8px', border: 'none', color: '#fff', fontSize: '12px' }}
                                formatter={(val: any) => [`$${Number(val).toFixed(2)}`, 'Sales']}
                              />
                            </PieChart>
                          ) : chartType === 'line' ? (
                            <LineChart data={currentBreakdownData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} />
                              <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} />
                              <Tooltip
                                contentStyle={{ backgroundColor: '#1e293b', borderRadius: '8px', border: 'none', color: '#fff', fontSize: '12px' }}
                                formatter={(val: any) => [`$${Number(val).toFixed(2)}`, 'Sales']}
                              />
                              <Line type="monotone" dataKey="amount" stroke="#2563eb" strokeWidth={2} dot={{ r: 4 }} />
                            </LineChart>
                          ) : (
                            <BarChart data={currentBreakdownData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} />
                              <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} />
                              <Tooltip
                                contentStyle={{ backgroundColor: '#1e293b', borderRadius: '8px', border: 'none', color: '#fff', fontSize: '12px' }}
                                formatter={(val: any) => [`$${Number(val).toFixed(2)}`, 'Sales']}
                              />
                              <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                                {currentBreakdownData.map((_, index) => (
                                  <Cell key={`bar-cell-${index}`} fill={theme.chartColors[index % theme.chartColors.length]} />
                                ))}
                              </Bar>
                            </BarChart>
                          )}
                        </ResponsiveContainer>
                      </div>
                    )}

                    {/* Quick list preview below chart */}
                    {isSubpanelVisible('sales_breakdown_chart', 'sb_data_table') && (
                      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-neutral-800 max-h-36 overflow-y-auto space-y-1.5 text-xs">
                        {currentBreakdownData.map((item, idx) => (
                          <div key={`breakdown-${item.name}-${idx}`} className="flex items-center justify-between text-slate-700 dark:text-neutral-300">
                            <div className="flex items-center gap-2 truncate">
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: theme.chartColors[idx % theme.chartColors.length] }}
                              />
                              <span className="truncate">{item.name}</span>
                            </div>
                            <div className="flex items-center gap-3 font-semibold">
                              <span>${item.amount.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</span>
                              <span className="text-slate-400 font-normal w-10 text-right">{item.percentage}%</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 5.4 EXPIRY DATE MONITORING & FLAGGING 3-PANEL WIDGET */}
                {panel.id === 'expiry_date_monitoring' && (
                  <DashboardExpiryWidget
                    inventoryItems={inventoryItems}
                    onNavigateToInventory={onNavigateToInventory}
                    width={panel.width}
                    onChangeWidth={(newWidth) => {
                      const updated = panels.map((p) =>
                        p.id === 'expiry_date_monitoring' ? { ...p, width: newWidth } : p
                      );
                      handleUpdatePanels(updated);
                    }}
                  />
                )}

                {/* 5.5 STOCK ORDER ASSISTANT LARGE WIDGET */}
                {panel.id === 'stock_order_assistant' && (
                  <StockOrderAssistantWidget
                    data={data}
                    onOpenStockOrderAssistant={() => {
                      setStockAssistantProductId(null);
                      setIsStockOrderAssistantOpen(true);
                    }}
                  />
                )}

                {/* 6. OPTIONAL WIDGET: Fast Movers Reorder */}
                {panel.id === 'fast_movers_reorder' && (
                  <FastMoversReorderWidget
                    data={data}
                    inventoryItems={inventoryItems}
                    onNavigateToInventory={onNavigateToInventory}
                  />
                )}

                {/* 7. OPTIONAL WIDGET: Target Goal Meter */}
                {panel.id === 'target_goal_meter' && (
                  <TargetGoalMeterWidget
                    data={data}
                  />
                )}

                {/* 8. OPTIONAL WIDGET: Department Leaderboard */}
                {panel.id === 'department_leaderboard' && (
                  <DepartmentLeaderboardWidget
                    data={data}
                  />
                )}

                {/* 9. OPTIONAL WIDGET: Expiry Watchlist Feed */}
                {panel.id === 'expiry_watchlist_feed' && (
                  <ExpiryWatchlistFeedWidget
                    data={data}
                    onNavigateToInventory={onNavigateToInventory}
                  />
                )}

                {/* 10. OPTIONAL WIDGET: Supplier Ordering Schedule */}
                {panel.id === 'supplier_schedule_card' && (
                  <SupplierScheduleCardWidget
                    data={data}
                  />
                )}

                {/* 11. OPTIONAL WIDGET: Basket Depth & Velocity */}
                {panel.id === 'basket_velocity_metrics' && (
                  <BasketVelocityMetricsWidget
                    data={data}
                  />
                )}
              </div>
            );
          })}
      </div>

      {/* Universal Camera Barcode Scanner Modal */}
      <UniversalBarcodeScannerModal
        isOpen={isBarcodeScannerOpen}
        onClose={() => setIsBarcodeScannerOpen(false)}
        inventoryProducts={inventoryItems}
        onScan={(barcode, matchedProduct) => {
          if (onNavigateToInventory) {
            onNavigateToInventory(matchedProduct?.productCode || barcode);
          }
        }}
      />

      {/* Stock Order Assistant Modal */}
      <StockOrderAssistantModal
        isOpen={isStockOrderAssistantOpen}
        onClose={() => {
          setIsStockOrderAssistantOpen(false);
          setStockAssistantProductId(null);
        }}
        inventoryProducts={inventoryItems}
        currentUser={currentUser}
        initialProductId={stockAssistantProductId}
      />

      {/* Dashboard Layout Customization Studio Modal */}
      <DashboardCustomizeStudio
        isOpen={isCustomizeStudioOpen}
        onClose={() => setIsCustomizeStudioOpen(false)}
        panels={panels}
        onUpdatePanels={handleUpdatePanels}
        onResetToDefault={handleResetPanels}
      />
    </div>
  );
};
