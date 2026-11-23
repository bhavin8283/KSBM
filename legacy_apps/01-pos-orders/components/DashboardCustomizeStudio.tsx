import React, { useState } from 'react';
import {
  Settings,
  Eye,
  EyeOff,
  MoveUp,
  MoveDown,
  Maximize2,
  Minimize2,
  Plus,
  Trash2,
  RotateCcw,
  Search,
  Check,
  X,
  Grid,
  Sparkles,
  Sliders,
  Layers,
  BarChart2,
  Clock,
  Package,
  TrendingUp,
  Calendar,
  DollarSign,
  Users,
  AlertTriangle,
  Barcode,
  Truck,
  PieChart,
} from 'lucide-react';

export type PanelWidth = 'one_third' | 'half' | 'two_thirds' | 'full';

export interface DashboardSubpanelConfig {
  id: string;
  name: string;
  visible: boolean;
  description?: string;
}

export interface DashboardPanelConfig {
  id: string;
  title: string;
  description: string;
  category: 'core_kpis' | 'attention_inventory' | 'sales_trends' | 'optional_analytics';
  visible: boolean;
  width: PanelWidth;
  order: number;
  subpanels?: DashboardSubpanelConfig[];
  isRemovable?: boolean;
}

export const AVAILABLE_OPTIONAL_WIDGETS: Omit<DashboardPanelConfig, 'order'>[] = [
  {
    id: 'expiry_date_monitoring',
    title: 'EXPIRY DATE MONITORING & FLAGGING (3-Panel Live Ticker)',
    description: '3-Panel live ticker (Expired Red, Expiring This Week Blue, Expiring This Month Green) with quick batch add and resolve',
    category: 'attention_inventory',
    visible: true,
    width: 'full',
    isRemovable: true,
  },
  {
    id: 'stock_order_assistant',
    title: 'STOCK ORDER ASSISTANT (Shelf Check & Reorder Suggestion)',
    description: 'Quick tool for staff while physically checking retail shelves and preparing supplier orders',
    category: 'optional_analytics',
    visible: true,
    width: 'full',
    isRemovable: true,
  },
  {
    id: 'fast_movers_reorder',
    title: 'Fast Moving Products (Daily Reorder Watch)',
    description: 'Top velocity items with highest 7-day depletion requiring rapid shelf replenishment',
    category: 'optional_analytics',
    visible: true,
    width: 'two_thirds',
    isRemovable: true,
  },
  {
    id: 'target_goal_meter',
    title: 'Daily Sales Target & Revenue Goal Meter',
    description: 'Real-time financial gauge measuring today revenue against daily budget milestone',
    category: 'optional_analytics',
    visible: true,
    width: 'one_third',
    isRemovable: true,
  },
  {
    id: 'department_leaderboard',
    title: 'Department Sales & Margin Leaderboard',
    description: 'Ranked performance breakdown across all store departments with gross margins',
    category: 'optional_analytics',
    visible: true,
    width: 'two_thirds',
    isRemovable: true,
  },
  {
    id: 'expiry_watchlist_feed',
    title: 'Imminent Expiry & Markdown Watchlist',
    description: 'Live feed of batches reaching 3-day critical threshold for clearance discounting',
    category: 'optional_analytics',
    visible: true,
    width: 'one_third',
    isRemovable: true,
  },
  {
    id: 'supplier_schedule_card',
    title: 'Supplier Lead Time & Delivery Cut-Offs',
    description: 'Upcoming supplier ordering deadlines, order cut-off countdowns, and delivery ETAs',
    category: 'optional_analytics',
    visible: true,
    width: 'one_third',
    isRemovable: true,
  },
  {
    id: 'basket_velocity_metrics',
    title: 'Live Basket Size & Customer Volume',
    description: 'Average spend per transaction, basket depth, and peak hourly shopper traffic',
    category: 'optional_analytics',
    visible: true,
    width: 'one_third',
    isRemovable: true,
  },
];

export const DEFAULT_DASHBOARD_PANELS: DashboardPanelConfig[] = [
  {
    id: 'kpi_tiles',
    title: 'POS Key Performance Indicator Cards',
    description: 'Live today sales, week-to-date, month-to-date & customer transaction volume tiles',
    category: 'core_kpis',
    visible: true,
    width: 'full',
    order: 0,
    subpanels: [
      { id: 'kpi_today_sales', name: "Today's Sales Tile", visible: true },
      { id: 'kpi_wtd_sales', name: 'Week-to-Date Sales Tile', visible: true },
      { id: 'kpi_mtd_sales', name: 'Month-to-Date Sales Tile', visible: true },
      { id: 'kpi_customers_tile', name: 'Customer Count & Basket Tile', visible: true },
    ],
  },
  {
    id: 'expiry_date_monitoring',
    title: 'EXPIRY DATE MONITORING & FLAGGING',
    description: '3-Panel live ticker (Expired Red, Expiring This Week Blue, Expiring This Month Green) with quick add and resolve',
    category: 'attention_inventory',
    visible: true,
    width: 'full',
    order: 1,
    isRemovable: true,
  },
  {
    id: 'stock_order_assistant',
    title: 'STOCK ORDER ASSISTANT',
    description: 'Quick tool for staff while physically checking retail shelves and preparing supplier orders',
    category: 'optional_analytics',
    visible: true,
    width: 'full',
    order: 2,
    isRemovable: true,
  },
  {
    id: 'hourly_trend_chart',
    title: 'Hourly Sales & Traffic Trend Chart',
    description: 'Real-time sales velocity comparison against previous week same day',
    category: 'sales_trends',
    visible: true,
    width: 'two_thirds',
    order: 3,
    subpanels: [
      { id: 'ht_comparison_line', name: 'Last Week Comparison Line', visible: true },
      { id: 'ht_grid_lines', name: 'Cartesian Grid Lines', visible: true },
    ],
  },
  {
    id: 'sales_breakdown_chart',
    title: 'Dynamic Sales Breakdown Chart',
    description: 'Interactive department, category, and tender type sales distribution',
    category: 'sales_trends',
    visible: true,
    width: 'one_third',
    order: 4,
    subpanels: [
      { id: 'sb_chart_visual', name: 'Chart Visualizer (Bar/Line/Pie/Donut)', visible: true },
      { id: 'sb_data_table', name: 'Summary Breakdown List', visible: true },
    ],
  },
];

interface DashboardCustomizeStudioProps {
  isOpen: boolean;
  onClose: () => void;
  panels: DashboardPanelConfig[];
  onUpdatePanels: (panels: DashboardPanelConfig[]) => void;
  onResetToDefault: () => void;
}

export function DashboardCustomizeStudio({
  isOpen,
  onClose,
  panels,
  onUpdatePanels,
  onResetToDefault,
}: DashboardCustomizeStudioProps) {
  const [activeTab, setActiveTab] = useState<'manage' | 'add_widgets'>('manage');
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  // Toggle main panel visibility
  const togglePanelVisibility = (panelId: string) => {
    const updated = panels.map((p) =>
      p.id === panelId ? { ...p, visible: !p.visible } : p
    );
    onUpdatePanels(updated);
  };

  // Toggle subpanel visibility
  const toggleSubpanelVisibility = (panelId: string, subpanelId: string) => {
    const updated = panels.map((p) => {
      if (p.id !== panelId || !p.subpanels) return p;
      const updatedSub = p.subpanels.map((sub) =>
        sub.id === subpanelId ? { ...sub, visible: !sub.visible } : sub
      );
      return { ...p, subpanels: updatedSub };
    });
    onUpdatePanels(updated);
  };

  // Change width of panel
  const updatePanelWidth = (panelId: string, width: PanelWidth) => {
    const updated = panels.map((p) =>
      p.id === panelId ? { ...p, width } : p
    );
    onUpdatePanels(updated);
  };

  // Reorder panels
  const movePanel = (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= panels.length) return;

    const newPanels = [...panels];
    const temp = newPanels[index];
    newPanels[index] = newPanels[targetIdx];
    newPanels[targetIdx] = temp;

    // Recalculate order indices
    const normalized = newPanels.map((p, idx) => ({ ...p, order: idx }));
    onUpdatePanels(normalized);
  };

  // Add optional widget from catalog
  const addOptionalWidget = (widgetConfig: Omit<DashboardPanelConfig, 'order'>) => {
    const alreadyExists = panels.some((p) => p.id === widgetConfig.id);
    if (alreadyExists) {
      // If already present but hidden, just make visible
      const updated = panels.map((p) =>
        p.id === widgetConfig.id ? { ...p, visible: true } : p
      );
      onUpdatePanels(updated);
    } else {
      const newPanel: DashboardPanelConfig = {
        ...widgetConfig,
        order: panels.length,
        visible: true,
      };
      onUpdatePanels([...panels, newPanel]);
    }
  };

  // Remove optional widget
  const removeOptionalWidget = (panelId: string) => {
    const updated = panels.filter((p) => p.id !== panelId);
    onUpdatePanels(updated.map((p, idx) => ({ ...p, order: idx })));
  };

  // Filtered lists
  const filteredPanels = panels.filter((p) =>
    p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const existingPanelIds = new Set(panels.map((p) => p.id));
  const availableWidgetsToCatalog = AVAILABLE_OPTIONAL_WIDGETS.filter(
    (w) =>
      w.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div
      id="dashboard-customizer-studio"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col my-auto max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 text-white flex items-center justify-between shadow-sm shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-xl border border-white/20">
              <Sliders className="w-5 h-5 text-blue-300" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-tight flex items-center gap-2">
                Dashboard Customization Studio
              </h2>
              <p className="text-xs text-slate-300">
                Show/hide panels, customize subpanels, adjust sizing, reorder & add optional widgets
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab & Search Navigation */}
        <div className="px-5 py-3 border-b border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('manage')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'manage'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white dark:bg-neutral-800 text-slate-700 dark:text-neutral-300 border border-slate-200 dark:border-neutral-700'
              }`}
            >
              <Grid className="w-3.5 h-3.5" />
              <span>Active Panels ({panels.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('add_widgets')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'add_widgets'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white dark:bg-neutral-800 text-slate-700 dark:text-neutral-300 border border-slate-200 dark:border-neutral-700'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Optional Widgets</span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search panels & widgets..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white dark:bg-neutral-800 border border-slate-300 dark:border-neutral-700 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-hidden"
            />
          </div>
        </div>

        {/* Studio Content Area */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
          {activeTab === 'manage' ? (
            /* MANAGE ACTIVE PANELS */
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500 px-1">
                <span>Drag or use arrows to reorder. Toggle eye to show/hide.</span>
                <span>{panels.filter((p) => p.visible).length} visible of {panels.length}</span>
              </div>

              {filteredPanels.map((panel, idx) => (
                <div
                  key={panel.id}
                  className={`p-4 rounded-2xl border transition-all ${
                    panel.visible
                      ? 'bg-white dark:bg-neutral-800 border-slate-200 dark:border-neutral-700 shadow-xs'
                      : 'bg-slate-50 dark:bg-neutral-900 border-dashed border-slate-300 dark:border-neutral-800 opacity-60'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      {/* Reorder Buttons */}
                      <div className="flex flex-col items-center gap-1 shrink-0 pt-0.5">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => movePanel(idx, 'up')}
                          className="p-1 rounded bg-slate-100 dark:bg-neutral-700 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed text-slate-600 dark:text-neutral-300"
                          title="Move Panel Up"
                        >
                          <MoveUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === panels.length - 1}
                          onClick={() => movePanel(idx, 'down')}
                          className="p-1 rounded bg-slate-100 dark:bg-neutral-700 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed text-slate-600 dark:text-neutral-300"
                          title="Move Panel Down"
                        >
                          <MoveDown className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Panel Info */}
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-slate-900 dark:text-neutral-100">
                            {panel.title}
                          </h4>
                          {panel.isRemovable && (
                            <span className="px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 text-[10px] font-semibold">
                              Optional Widget
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {panel.description}
                        </p>
                      </div>
                    </div>

                    {/* Width & Visibility Controls */}
                    <div className="flex items-center gap-2 self-end sm:self-center">
                      {/* Width Selector */}
                      <div className="flex items-center gap-1 bg-slate-100 dark:bg-neutral-700/60 p-1 rounded-xl text-[11px] font-semibold">
                        <span className="text-[10px] text-slate-400 px-1 uppercase">Width:</span>
                        <button
                          type="button"
                          onClick={() => updatePanelWidth(panel.id, 'one_third')}
                          className={`px-2 py-0.5 rounded-lg transition-all ${
                            panel.width === 'one_third'
                              ? 'bg-white dark:bg-neutral-800 text-blue-600 shadow-xs font-bold'
                              : 'text-slate-500 hover:text-slate-800'
                          }`}
                          title="1 Column (33% Width)"
                        >
                          1 Col
                        </button>
                        <button
                          type="button"
                          onClick={() => updatePanelWidth(panel.id, 'two_thirds')}
                          className={`px-2 py-0.5 rounded-lg transition-all ${
                            panel.width === 'two_thirds'
                              ? 'bg-white dark:bg-neutral-800 text-blue-600 shadow-xs font-bold'
                              : 'text-slate-500 hover:text-slate-800'
                          }`}
                          title="2 Columns (66% Width)"
                        >
                          2 Col
                        </button>
                        <button
                          type="button"
                          onClick={() => updatePanelWidth(panel.id, 'full')}
                          className={`px-2 py-0.5 rounded-lg transition-all ${
                            panel.width === 'full'
                              ? 'bg-white dark:bg-neutral-800 text-blue-600 shadow-xs font-bold'
                              : 'text-slate-500 hover:text-slate-800'
                          }`}
                          title="Full Width (100% Width)"
                        >
                          Full
                        </button>
                      </div>

                      {/* Show / Hide Toggle Button */}
                      <button
                        type="button"
                        onClick={() => togglePanelVisibility(panel.id)}
                        className={`p-2 rounded-xl transition-colors ${
                          panel.visible
                            ? 'bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-300'
                            : 'bg-slate-200 text-slate-500 hover:bg-slate-300 dark:bg-neutral-700'
                        }`}
                        title={panel.visible ? 'Hide this panel' : 'Show this panel'}
                      >
                        {panel.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </button>

                      {/* Optional Widget Removal */}
                      {panel.isRemovable && (
                        <button
                          type="button"
                          onClick={() => removeOptionalWidget(panel.id)}
                          className="p-2 bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-950 dark:text-rose-300 rounded-xl transition-colors"
                          title="Remove this widget"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Subpanel Toggles (if panel has subcomponents) */}
                  {panel.subpanels && panel.subpanels.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-neutral-700/60">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                        Subpanel Elements:
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {panel.subpanels.map((sub) => (
                          <button
                            key={sub.id}
                            type="button"
                            onClick={() => toggleSubpanelVisibility(panel.id, sub.id)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                              sub.visible
                                ? 'bg-blue-100/70 text-blue-800 dark:bg-blue-950 dark:text-blue-200 border border-blue-300 dark:border-blue-800'
                                : 'bg-slate-100 text-slate-400 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 line-through'
                            }`}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-current" />
                            <span>{sub.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            /* ADD OPTIONAL WIDGETS CATALOG */
            <div className="space-y-3">
              <div className="p-3.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-2xl flex items-start gap-2.5 text-xs text-blue-900 dark:text-blue-200">
                <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block">Optional Analytics & Replenishment Widgets Catalog</span>
                  <p className="text-blue-700 dark:text-blue-300 text-[11px] mt-0.5">
                    Click "Add Widget" to place any of these analytics panels directly onto your live POS dashboard.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {availableWidgetsToCatalog.map((widget) => {
                  const isAlreadyAdded = existingPanelIds.has(widget.id);
                  return (
                    <div
                      key={widget.id}
                      className="p-4 rounded-2xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 shadow-xs flex flex-col justify-between space-y-3"
                    >
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-neutral-100">
                          {widget.title}
                        </h4>
                        <p className="text-xs text-slate-500 mt-1">
                          {widget.description}
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-neutral-700/60 text-xs">
                        <span className="text-[11px] text-slate-400 font-semibold uppercase">
                          Default: {widget.width === 'full' ? 'Full Width' : widget.width === 'two_thirds' ? '2 Columns' : '1 Column'}
                        </span>

                        <button
                          type="button"
                          onClick={() => addOptionalWidget(widget)}
                          className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all ${
                            isAlreadyAdded
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs cursor-pointer active:scale-95'
                          }`}
                        >
                          {isAlreadyAdded ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>Added to Dashboard</span>
                            </>
                          ) : (
                            <>
                              <Plus className="w-3.5 h-3.5" />
                              <span>Add Widget</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-50 dark:bg-neutral-950 border-t border-slate-200 dark:border-neutral-800 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <button
            type="button"
            onClick={onResetToDefault}
            className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-slate-700 dark:text-neutral-300 rounded-xl font-semibold flex items-center gap-1.5 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset to Default Layout</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-xs transition-colors"
          >
            Save & Close Studio
          </button>
        </div>
      </div>
    </div>
  );
}
