import React, { useState } from 'react';
import { 
  Users, 
  DollarSign, 
  Receipt, 
  ShoppingBag, 
  TrendingUp, 
  AlertCircle, 
  ShieldAlert, 
  Search,
  CheckCircle2,
  XCircle,
  Eye,
  Award
} from 'lucide-react';

interface ClerkCardRow {
  'Clerk / Cashier': string;
  Status: string;
  'Transactions Served': number;
  'Items Sold': number;
  'Total Sales': string;
  'Share of Sales'?: string;
  'Avg Basket Value': string;
  'Items per Txn': string;
  'Discounts Given': string;
  'Voids / Refunds': string;
  _rawSales?: number;
  _rawTxns?: number;
  _rawItems?: number;
  _rawAvgBasket?: number;
  _rawDiscounts?: number;
  _rawVoids?: number;
  _sharePercent?: number;
  _discontinued?: boolean;
  _clerkId?: number;
  _clerkName?: string;
}

interface ClerkPerformanceCardsProps {
  clerks: ClerkCardRow[];
  totalRevenue: number;
  totalTransactions: number;
  onSelectClerk?: (clerkId: number) => void;
}

export const ClerkPerformanceCards: React.FC<ClerkPerformanceCardsProps> = ({
  clerks,
  totalRevenue,
  totalTransactions,
  onSelectClerk,
}) => {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('active');

  const filteredClerks = clerks.filter((c) => {
    const nameMatch = (c._clerkName || c['Clerk / Cashier'] || '')
      .toLowerCase()
      .includes(search.toLowerCase());
    const isInactive = Boolean(c._discontinued || c.Status?.toLowerCase().includes('inactive'));

    if (filterStatus === 'active') return nameMatch && !isInactive;
    if (filterStatus === 'inactive') return nameMatch && isInactive;
    return nameMatch;
  });

  // Calculate highest revenue clerk for relative progress bar
  const maxClerkSales = Math.max(...clerks.map((c) => c._rawSales || 0), 1);

  return (
    <div className="space-y-6">
      {/* Filter and Summary Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 font-bold">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Cashier & Staff Performance Leaderboard</h3>
            <p className="text-xs text-slate-500">
              Showing {filteredClerks.length} of {clerks.length} cashiers registered in POS
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Status filter pill buttons */}
          <div className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200 text-xs font-semibold">
            <button
              onClick={() => setFilterStatus('active')}
              className={`px-3 py-1.5 rounded-md transition-all ${
                filterStatus === 'active'
                  ? 'bg-white text-blue-700 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Active Only
            </button>
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-3 py-1.5 rounded-md transition-all ${
                filterStatus === 'all'
                  ? 'bg-white text-blue-700 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Staff ({clerks.length})
            </button>
            <button
              onClick={() => setFilterStatus('inactive')}
              className={`px-3 py-1.5 rounded-md transition-all ${
                filterStatus === 'inactive'
                  ? 'bg-white text-blue-700 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Inactive
            </button>
          </div>

          {/* Quick search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search cashier name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Staff Performance Cards Grid */}
      {filteredClerks.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-slate-400">
          <Users className="w-8 h-8 mx-auto mb-2 text-slate-300" />
          <p className="text-sm font-medium">No cashiers match your search or filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredClerks.map((clerk, index) => {
            const rawSales = !isNaN(Number(clerk._rawSales)) ? Number(clerk._rawSales) : 0;
            const parsedTxns = clerk._rawTxns ?? (clerk['Transactions Served'] !== undefined ? Number(clerk['Transactions Served']) : undefined);
            const rawTxns = (parsedTxns !== undefined && !isNaN(Number(parsedTxns))) ? Number(parsedTxns) : 0;
            const parsedItems = clerk._rawItems ?? (clerk['Items Sold'] !== undefined ? Number(clerk['Items Sold']) : undefined);
            const rawItems = (parsedItems !== undefined && !isNaN(Number(parsedItems))) ? Number(parsedItems) : 0;
            const rawDiscounts = !isNaN(Number(clerk._rawDiscounts)) ? Number(clerk._rawDiscounts) : 0;
            const rawVoids = !isNaN(Number(clerk._rawVoids)) ? Number(clerk._rawVoids) : 0;
            const sharePct = (clerk._sharePercent != null && !isNaN(clerk._sharePercent)) 
              ? clerk._sharePercent 
              : (totalRevenue > 0 && !isNaN(totalRevenue) ? (rawSales / totalRevenue) * 100 : 0);
            const isInactive = Boolean(clerk._discontinued || clerk.Status?.toLowerCase().includes('inactive'));
            const relativePct = maxClerkSales > 0 && !isNaN(maxClerkSales) ? (rawSales / maxClerkSales) * 100 : 0;
            const isTop = index === 0 && rawSales > 0 && !isInactive;

            // Initials
            const name = clerk._clerkName || clerk['Clerk / Cashier'] || 'Cashier';
            const initials = name
              .split(' ')
              .map((n) => n[0])
              .join('')
              .toUpperCase()
              .slice(0, 2);

            return (
              <div
                key={`clerk-card-${clerk._clerkId || index}`}
                className={`bg-white border rounded-2xl p-5 shadow-xs flex flex-col justify-between transition-all hover:shadow-md ${
                  isTop
                    ? 'border-blue-300 ring-2 ring-blue-500/10'
                    : isInactive
                    ? 'border-slate-200 opacity-70 bg-slate-50/50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div>
                  {/* Top Row: Avatar, Name & Status */}
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm text-white shadow-2xs shrink-0 ${
                          isTop
                            ? 'bg-gradient-to-tr from-blue-600 to-indigo-600'
                            : isInactive
                            ? 'bg-slate-400'
                            : 'bg-gradient-to-tr from-slate-700 to-slate-900'
                        }`}
                      >
                        {initials}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h4 className="font-bold text-slate-900 text-sm">{name}</h4>
                          {isTop && (
                            <span className="p-0.5 rounded-full bg-amber-100 text-amber-700" title="Top Sales Volume">
                              <Award className="w-3.5 h-3.5" />
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-500">ID #{clerk._clerkId || 'N/A'}</span>
                      </div>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        isInactive
                          ? 'bg-slate-100 text-slate-600 border-slate-200'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}
                    >
                      {isInactive ? 'Inactive' : 'Active Cashier'}
                    </span>
                  </div>

                  {/* Hero Total Sales */}
                  <div className="bg-slate-50/80 border border-slate-100 rounded-xl p-3.5 mb-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-slate-500 uppercase">Gross Sales Handled</span>
                      <span className="text-xs font-bold text-blue-600">
                        {(isNaN(sharePct) ? 0 : sharePct).toFixed(1)}% store share
                      </span>
                    </div>
                    <span className="text-2xl font-black text-slate-900 block mt-0.5">
                      {clerk['Total Sales'] || '$0.00'}
                    </span>
                    {/* Relative Sales Velocity Bar */}
                    <div className="w-full h-1.5 bg-slate-200 rounded-full mt-2.5 overflow-hidden">
                      <div
                        style={{ width: `${Math.max(2, Math.min(100, isNaN(relativePct) ? 0 : relativePct))}%` }}
                        className={`h-full rounded-full ${
                          isTop ? 'bg-blue-600' : 'bg-slate-700'
                        }`}
                      />
                    </div>
                  </div>

                  {/* Key Operational Metrics 4-Grid */}
                  <div className="grid grid-cols-2 gap-2.5 text-xs mb-4">
                    <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Transactions</span>
                      <span className="text-sm font-bold text-slate-800 block mt-0.5">{isNaN(rawTxns) ? 0 : rawTxns}</span>
                      <span className="text-[10px] text-slate-500">Receipt checkouts</span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Avg Ticket / Basket</span>
                      <span className="text-sm font-bold text-slate-800 block mt-0.5">{clerk['Avg Basket Value'] || '$0.00'}</span>
                      <span className="text-[10px] text-slate-500">Spend per receipt</span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Units Scanned</span>
                      <span className="text-sm font-bold text-slate-800 block mt-0.5">{isNaN(rawItems) ? 0 : rawItems}</span>
                      <span className="text-[10px] text-slate-500">{clerk['Items per Txn'] || '0.00'} items/txn</span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Discounts Given</span>
                      <span className="text-sm font-bold text-slate-800 block mt-0.5">{clerk['Discounts Given'] || '$0.00'}</span>
                      <span className="text-[10px] text-amber-600 font-medium">Promos / manual</span>
                    </div>
                  </div>

                  {/* Voids & Refunds Alert Row */}
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50/60 border border-slate-100 text-[11px]">
                    <span className="text-slate-500 flex items-center gap-1">
                      <ShieldAlert className="w-3.5 h-3.5 text-slate-400" />
                      Voids & Customer Refunds
                    </span>
                    <span className="font-bold text-slate-800">{clerk['Voids / Refunds'] || '$0.00'}</span>
                  </div>
                </div>

                {/* Footer Action */}
                {onSelectClerk && clerk._clerkId && (
                  <div className="mt-4 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => onSelectClerk(clerk._clerkId!)}
                      className="w-full py-1.5 px-3 rounded-lg text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Filter Reports by this Cashier
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
