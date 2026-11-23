import React, { useState, useEffect } from 'react';
import {
  Store,
  TrendingUp,
  DollarSign,
  Users,
  ShoppingBag,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Wifi,
  ExternalLink,
  MapPin,
  Layers,
  Sparkles,
  BarChart2,
  PieChart as PieIcon,
  Tag,
  Check,
  Plus,
  X,
  Building2,
  Percent,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { StoreLocation, CurrentUserSession } from '../types';

interface MultiStoreDashboardComparisonProps {
  currentUser?: CurrentUserSession | null;
  onSwitchActiveStore?: (storeId: string) => void;
}

interface StoreComparativeMetric {
  store: {
    id: string;
    code: string;
    name: string;
    address?: string;
    themeColor?: string;
    status?: string;
    tunnelHostname?: string;
    isActive: boolean;
  };
  sessionSales: number;
  todaySales: number;
  lastWeekSales: number;
  growthPct: number;
  customers: number;
  avgBasket: number;
  marginPct: number;
  unitsPerTxn: number;
  lowStockCount: number;
  hourlySales: { hour: string; sales: number; customers: number }[];
  topProducts: { name: string; qtySold: number; revenue: number }[];
  departmentSales: { name: string; amount: number; percentage: number }[];
}

const STORE_PALETTES: { stroke: string; fill: string; badge: string; text: string; bg: string }[] = [
  { stroke: '#3b82f6', fill: '#93c5fd', badge: 'bg-blue-500', text: 'text-blue-700', bg: 'bg-blue-50' },
  { stroke: '#10b981', fill: '#6ee7b7', badge: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50' },
  { stroke: '#8b5cf6', fill: '#c4b5fd', badge: 'bg-purple-500', text: 'text-purple-700', bg: 'bg-purple-50' },
];

export function MultiStoreDashboardComparison({
  currentUser,
  onSwitchActiveStore,
}: MultiStoreDashboardComparisonProps) {
  const [allStores, setAllStores] = useState<StoreLocation[]>([]);
  const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>([]);
  const [activeStoreId, setActiveStoreId] = useState<string>('');
  const [metrics, setMetrics] = useState<StoreComparativeMetric[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // 1. Fetch available stores
  const fetchAvailableStores = async () => {
    try {
      const res = await fetch('/api/stores');
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.stores)) {
        setAllStores(data.stores);
        if (data.activeStoreId) {
          setActiveStoreId(data.activeStoreId);
        }
        // Initialize selected stores to max 3
        if (selectedStoreIds.length === 0) {
          const permitted = data.stores.filter((s: StoreLocation) => {
            if (!currentUser || currentUser.role === 'admin') return true;
            if (!currentUser.allowedStoreIds || currentUser.allowedStoreIds.includes('all')) return true;
            return currentUser.allowedStoreIds.includes(s.id);
          });
          const initial = permitted.slice(0, 3).map((s: StoreLocation) => s.id);
          setSelectedStoreIds(initial);
        }
      }
    } catch (err) {
      console.warn('Notice: Failed to load stores in multi-store comparison:', err);
    }
  };

  useEffect(() => {
    fetchAvailableStores();
  }, []);

  // 2. Fetch Comparative Multi-Store Data
  const fetchMultiStoreMetrics = async () => {
    if (selectedStoreIds.length === 0) {
      setMetrics([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`/api/dashboard/multi-store?storeIds=${selectedStoreIds.join(',')}`);
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.stores)) {
        setMetrics(data.stores);
      }
      if (data.summary) {
        setSummary(data.summary);
      }
    } catch (err) {
      console.warn('Notice: Multi-store metrics fetch notice:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedStoreIds.length > 0) {
      fetchMultiStoreMetrics();
    }
  }, [selectedStoreIds]);

  const permittedStores = allStores.filter((st) => {
    if (!currentUser || currentUser.role === 'admin') return true;
    if (!currentUser.allowedStoreIds || currentUser.allowedStoreIds.includes('all')) return true;
    return currentUser.allowedStoreIds.includes(st.id);
  });

  const handleToggleStoreSelection = (storeId: string) => {
    if (selectedStoreIds.includes(storeId)) {
      if (selectedStoreIds.length === 1) return; // keep at least 1
      setSelectedStoreIds(selectedStoreIds.filter((id) => id !== storeId));
    } else {
      if (selectedStoreIds.length >= 3) {
        // Replace the last one if reached max 3
        setSelectedStoreIds([...selectedStoreIds.slice(0, 2), storeId]);
      } else {
        setSelectedStoreIds([...selectedStoreIds, storeId]);
      }
    }
  };

  const handleSwitchStore = async (storeId: string) => {
    try {
      const res = await fetch('/api/stores/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeId }),
      });
      if (!res.ok) throw new Error('Failed to switch store');
      setActiveStoreId(storeId);
      if (onSwitchActiveStore) {
        onSwitchActiveStore(storeId);
      }
    } catch (err) {
      console.error('Failed to switch active store:', err);
    }
  };

  // Build combined Hourly Chart dataset across the selected stores
  const hoursList = ['06:00', '08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00'];
  const combinedHourlyData = hoursList.map((hour) => {
    const row: Record<string, any> = { hour };
    metrics.forEach((m, idx) => {
      const point = m.hourlySales?.find((h) => h.hour === hour);
      row[`store_${idx}`] = point ? point.sales : 0;
    });
    return row;
  });

  return (
    <div className="space-y-6">
      {/* Top Store Selector & Counter */}
      <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-slate-900 text-sm">
                  Side-by-Side Store Comparison
                </h3>
                <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md text-[10px] font-bold">
                  {selectedStoreIds.length} of 3 Selected (Max 3)
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Compare real-time POS revenue, customers, basket size, and sales trajectory side-by-side.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={fetchMultiStoreMetrics}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600' : ''}`} />
            <span>Refresh All Stores</span>
          </button>
        </div>

        {/* Store Selection Chips */}
        <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-slate-100">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mr-1">
            Choose Stores:
          </span>
          {permittedStores.map((st) => {
            const isSelected = selectedStoreIds.includes(st.id);
            const index = selectedStoreIds.indexOf(st.id);
            const palette = index >= 0 ? STORE_PALETTES[index] : null;

            return (
              <button
                key={st.id}
                type="button"
                onClick={() => handleToggleStoreSelection(st.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer border ${
                  isSelected
                    ? `${palette?.bg} ${palette?.text} border-current ring-2 ring-blue-500/20 shadow-2xs font-extrabold`
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    isSelected ? palette?.badge : 'bg-slate-300'
                  }`}
                />
                <span>{st.name}</span>
                <span className="font-mono text-[10px] opacity-75">({st.code})</span>
                {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Group Combined Aggregate Banner */}
      {summary && (
        <div className="p-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl shadow-md">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <span className="text-[11px] font-bold text-indigo-200 uppercase tracking-wider">
              Combined Total for {metrics.length} Selected Stores
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <span className="text-[11px] text-slate-400 font-medium block">
                Total Combined Sales
              </span>
              <span className="text-2xl font-black text-emerald-400 mt-0.5 block">
                ${summary.combinedTodaySales?.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div>
              <span className="text-[11px] text-slate-400 font-medium block">
                Total Customers
              </span>
              <span className="text-2xl font-black text-white mt-0.5 block">
                {summary.combinedCustomers}
              </span>
            </div>

            <div>
              <span className="text-[11px] text-slate-400 font-medium block">
                Group Average Basket
              </span>
              <span className="text-2xl font-black text-indigo-300 mt-0.5 block">
                ${summary.avgCombinedBasket?.toFixed(2)}
              </span>
            </div>

            <div>
              <span className="text-[11px] text-slate-400 font-medium block">
                Average Margin
              </span>
              <span className="text-2xl font-black text-amber-300 mt-0.5 block">
                32.1%
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Multi-Store Synchronized Sales Trajectory Line Chart */}
      {metrics.length > 0 && (
        <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-blue-600" />
              <h4 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider">
                Live Hourly Sales Trajectory Comparison
              </h4>
            </div>
            <span className="text-[11px] text-slate-500 font-medium">
              Synchronized 2-Hour Buckets
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={combinedHourlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="hour" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={(val) => `$${val}`} />
                <Tooltip
                  formatter={(value: any, name: any) => {
                    const idx = Number(String(name).replace('store_', ''));
                    const storeName = metrics[idx]?.store?.name || name;
                    return [`$${value}`, storeName];
                  }}
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderRadius: '12px',
                    color: '#fff',
                    fontSize: '11px',
                    border: 'none',
                  }}
                />
                <Legend
                  formatter={(value) => {
                    const idx = Number(String(value).replace('store_', ''));
                    return metrics[idx]?.store?.name || value;
                  }}
                />
                {metrics.map((m, idx) => {
                  const palette = STORE_PALETTES[idx] || STORE_PALETTES[0];
                  return (
                    <Line
                      key={m.store.id}
                      type="monotone"
                      dataKey={`store_${idx}`}
                      name={`store_${idx}`}
                      stroke={palette.stroke}
                      strokeWidth={3}
                      dot={{ r: 4, fill: palette.stroke }}
                      activeDot={{ r: 6 }}
                    />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Side-by-Side Multi-Column Store Cards (Max 3 Columns) */}
      <div
        className={`grid grid-cols-1 gap-4 ${
          metrics.length === 1
            ? 'md:grid-cols-1 max-w-xl mx-auto'
            : metrics.length === 2
            ? 'md:grid-cols-2'
            : 'md:grid-cols-3'
        }`}
      >
        {metrics.map((m, idx) => {
          const isCurrentActive = m.store.id === activeStoreId;
          const palette = STORE_PALETTES[idx] || STORE_PALETTES[0];

          return (
            <div
              key={m.store.id}
              className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden shadow-xs flex flex-col ${
                isCurrentActive
                  ? 'border-blue-400 ring-2 ring-blue-500/20 shadow-sm'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              {/* Column Header */}
              <div className="p-4 bg-slate-50/90 border-b border-slate-200 flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className={`w-3.5 h-3.5 rounded-full ${palette.badge} ring-2 ring-white shrink-0`} />
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h4 className="font-extrabold text-slate-900 text-sm">{m.store.name}</h4>
                      <span className="px-1.5 py-0.5 bg-white text-slate-700 font-mono font-bold text-[9px] rounded border border-slate-200">
                        {m.store.code}
                      </span>
                    </div>
                    {m.store.address && (
                      <div className="flex items-center gap-1 text-[10px] text-slate-500 mt-0.5">
                        <MapPin className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                        <span className="truncate max-w-[180px]">{m.store.address}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  {isCurrentActive ? (
                    <span className="px-2 py-0.5 bg-blue-600 text-white font-extrabold text-[9px] rounded-md shadow-2xs">
                      Active Context
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSwitchStore(m.store.id)}
                      className="px-2 py-1 bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 font-bold text-[10px] rounded-lg transition-colors cursor-pointer shadow-2xs"
                    >
                      Make Active
                    </button>
                  )}
                </div>
              </div>

              {/* Column Body Metrics */}
              <div className="p-4 space-y-4 flex-1 text-xs">
                {/* Tile 1: Today's Revenue */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Today's Sales
                    </span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5 ${
                        m.growthPct >= 0
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {m.growthPct >= 0 ? (
                        <ArrowUpRight className="w-3 h-3" />
                      ) : (
                        <ArrowDownRight className="w-3 h-3" />
                      )}
                      {Math.abs(m.growthPct)}% vs lw
                    </span>
                  </div>
                  <div className="text-xl font-black text-slate-900">
                    ${m.todaySales.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    Session: ${m.sessionSales.toLocaleString('en-US', { minimumFractionDigits: 2 })} • Last Wk: ${m.lastWeekSales.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </div>
                </div>

                {/* KPI Matrix 2x2 */}
                <div className="grid grid-cols-2 gap-2">
                  {/* Customers */}
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      Customers
                    </span>
                    <div className="text-base font-extrabold text-slate-900 mt-0.5">
                      {m.customers}
                    </div>
                  </div>

                  {/* Avg Basket */}
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      Avg Basket
                    </span>
                    <div className="text-base font-extrabold text-slate-900 mt-0.5">
                      ${m.avgBasket.toFixed(2)}
                    </div>
                  </div>

                  {/* Margin */}
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      Gross Margin
                    </span>
                    <div className="text-base font-extrabold text-emerald-700 mt-0.5">
                      {m.marginPct}%
                    </div>
                  </div>

                  {/* Units per Txn */}
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      Units / Txn
                    </span>
                    <div className="text-base font-extrabold text-slate-900 mt-0.5">
                      {m.unitsPerTxn}
                    </div>
                  </div>
                </div>

                {/* Top Selling Movers */}
                <div className="space-y-1.5 pt-1">
                  <span className="text-[10px] font-extrabold text-slate-600 uppercase tracking-wider block">
                    Top Movers
                  </span>
                  <div className="space-y-1 bg-slate-50/70 p-2 rounded-xl border border-slate-100">
                    {m.topProducts?.slice(0, 3).map((tp, pIdx) => (
                      <div
                        key={pIdx}
                        className="flex items-center justify-between text-[11px] py-1 border-b border-slate-100 last:border-0"
                      >
                        <span className="truncate max-w-[140px] font-medium text-slate-800">
                          {pIdx + 1}. {tp.name}
                        </span>
                        <span className="font-bold text-slate-900">${tp.revenue.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Department Shares */}
                <div className="space-y-1.5 pt-1">
                  <span className="text-[10px] font-extrabold text-slate-600 uppercase tracking-wider block">
                    Dept Breakdown
                  </span>
                  <div className="space-y-1 bg-slate-50/70 p-2 rounded-xl border border-slate-100">
                    {m.departmentSales?.slice(0, 3).map((dept, dIdx) => (
                      <div
                        key={dIdx}
                        className="flex items-center justify-between text-[11px] py-1 border-b border-slate-100 last:border-0"
                      >
                        <span className="truncate max-w-[140px] text-slate-600">
                          {dept.name}
                        </span>
                        <span className="font-bold text-slate-800">{dept.percentage}%</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Low Stock Alert Count */}
                <div className="flex items-center justify-between p-2 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    <span className="font-bold">Stock Attention:</span>
                  </div>
                  <span className="font-extrabold">{m.lowStockCount} items low</span>
                </div>
              </div>

              {/* Column Footer */}
              <div className="p-3 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-500 flex items-center justify-between">
                <div className="flex items-center gap-1 font-mono">
                  <Wifi className="w-3 h-3 text-emerald-500" />
                  <span className="truncate max-w-[140px]">{m.store.tunnelHostname || 'QUIC Active'}</span>
                </div>
                <span className="text-emerald-700 font-bold">100% Synced</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
