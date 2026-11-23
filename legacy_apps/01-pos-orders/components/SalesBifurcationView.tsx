import React from 'react';
import { SalesBifurcationData } from '../types';
import { 
  DollarSign, 
  ShieldCheck, 
  Percent, 
  CreditCard, 
  Banknote, 
  Receipt, 
  ShoppingBag, 
  ArrowRight,
  TrendingUp,
  CheckCircle2,
  Info
} from 'lucide-react';

interface SalesBifurcationViewProps {
  bifurcation: SalesBifurcationData;
  periodText: string;
}

export const SalesBifurcationView: React.FC<SalesBifurcationViewProps> = ({
  bifurcation,
  periodText,
}) => {
  if (!bifurcation) return null;

  const safeNum = (v: any, fallback = 0) => {
    const n = Number(v);
    return isNaN(n) || !isFinite(n) ? fallback : n;
  };

  const totalPeriodGross = safeNum(bifurcation.totalPeriodGross);
  const netSalesExGst = safeNum(bifurcation.netSalesExGst);
  const gstCollected = safeNum(bifurcation.gstCollected);
  const taxableGross = safeNum(bifurcation.taxableGross);
  const taxableNet = safeNum(bifurcation.taxableNet);
  const gstFreeGross = safeNum(bifurcation.gstFreeGross);
  const taxableSharePercent = safeNum(bifurcation.taxableSharePercent);
  const gstFreeSharePercent = safeNum(bifurcation.gstFreeSharePercent);
  const topGstFree = bifurcation.topGstFree || [];
  const topTaxable = bifurcation.topTaxable || [];
  const tenders = bifurcation.tenders || [];

  // Format currency helper
  const fmt = (val: number) =>
    `$${safeNum(val).toLocaleString('en-AU', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  return (
    <div className="space-y-6">
      {/* Educational Notice Banner on 2 Retail Product Types */}
      <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-4 text-xs text-blue-900 flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold block text-sm text-blue-950 mb-1">
            ATO Retail Standard: 2 Distinct Product Categories in Sales
          </span>
          <p className="text-blue-800 leading-relaxed">
            All sold items belong strictly to <strong>one of two product categories</strong>: 
            (1) <span className="font-semibold text-blue-950">Products Which Accrue GST</span> (standard goods sold inclusive of 10% GST, where <span className="underline">Taxable Net Sales</span> (10/11) and <span className="underline">GST Collected</span> (1/11) are the internal financial components), and 
            (2) <span className="font-semibold text-emerald-900">GST-Free Products</span> (essential staples like fresh milk and bread which are completely exempt from GST with a 0% tax rate).
          </p>
        </div>
      </div>

      {/* 1. Period Sales Bifurcation Header & Visual Split Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-600 mb-1">
              <Receipt className="w-4 h-4" />
              <span>Australian Tax Office (ATO) Compliance & BAS Summary</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Period Sales Bifurcation: GST-Free vs Taxable
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Consolidated sales breakdown for <span className="font-semibold text-slate-700">{periodText}</span>
            </p>
          </div>

          {/* Consolidated Period Total Hero */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white px-5 py-3.5 rounded-xl shadow-sm text-right shrink-0">
            <span className="text-[11px] uppercase tracking-wider text-slate-300 font-semibold block">
              Total Period Product Sales (Inc GST)
            </span>
            <span className="text-2xl sm:text-3xl font-black tracking-tight text-white block mt-0.5">
              {fmt(totalPeriodGross)}
            </span>
            <div className="text-[11px] text-slate-300 mt-1 flex items-center justify-end gap-1.5 font-medium">
              <span>Net Ex-GST: {fmt(netSalesExGst)}</span>
              <span className="text-slate-500">•</span>
              <span className="text-emerald-400 font-semibold">GST: {fmt(gstCollected)}</span>
            </div>
          </div>
        </div>

        {/* Visual Bifurcation Progress Split Bar */}
        <div className="pt-5">
          <div className="flex items-center justify-between text-xs font-bold mb-2">
            <div className="flex items-center gap-2 text-blue-700">
              <span className="w-3 h-3 rounded-full bg-blue-600 inline-block" />
              <span>Taxable Products (10% GST Included): {taxableSharePercent.toFixed(1)}%</span>
              <span className="text-slate-400 font-normal">({fmt(taxableGross)})</span>
            </div>
            <div className="flex items-center gap-2 text-emerald-700">
              <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
              <span>GST-Free Staples (0% GST): {gstFreeSharePercent.toFixed(1)}%</span>
              <span className="text-slate-400 font-normal">({fmt(gstFreeGross)})</span>
            </div>
          </div>

          <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden flex p-0.5 border border-slate-200">
            <div
              style={{ width: `${Math.max(2, Math.min(98, taxableSharePercent))}%` }}
              className="h-full bg-blue-600 rounded-l-full transition-all duration-500"
              title={`Taxable: ${taxableSharePercent.toFixed(1)}%`}
            />
            <div
              style={{ width: `${Math.max(2, Math.min(98, gstFreeSharePercent))}%` }}
              className="h-full bg-emerald-500 rounded-r-full transition-all duration-500"
              title={`GST-Free: ${gstFreeSharePercent.toFixed(1)}%`}
            />
          </div>
        </div>
      </div>

      {/* 2. Side-by-Side In-Depth Bifurcation Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Card: Taxable Products (10% GST) */}
        <div className="bg-white border border-blue-100 rounded-2xl p-5 shadow-xs flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full -mr-10 -mt-10 pointer-events-none opacity-50" />
          <div>
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-blue-50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-blue-100 text-blue-700 font-bold">
                  <Percent className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Taxable Products (10% GST)</h3>
                  <p className="text-xs text-slate-500">Standard rate goods (Snacks, Drinks, Confectionery, Tobacco)</p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-extrabold border border-blue-200">
                10% GST
              </span>
            </div>

            {/* Financial Metrics Grid */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl">
                <span className="text-[11px] font-semibold text-slate-500 uppercase block">Gross (Inc GST)</span>
                <span className="text-lg font-black text-slate-900 mt-0.5 block">{fmt(taxableGross)}</span>
                <span className="text-[10px] text-blue-600 font-bold">{taxableSharePercent.toFixed(1)}% of total</span>
              </div>
              <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl">
                <span className="text-[11px] font-semibold text-slate-500 uppercase block">Net (Ex GST)</span>
                <span className="text-lg font-black text-slate-900 mt-0.5 block">{fmt(taxableNet)}</span>
                <span className="text-[10px] text-slate-500 font-medium">Store revenue</span>
              </div>
              <div className="bg-blue-50/70 border border-blue-100 p-3 rounded-xl">
                <span className="text-[11px] font-semibold text-blue-800 uppercase block">GST Collected</span>
                <span className="text-lg font-black text-blue-700 mt-0.5 block">{fmt(gstCollected)}</span>
                <span className="text-[10px] text-blue-600 font-medium">1/11th to ATO</span>
              </div>
            </div>

            {/* Top Taxable Best Sellers */}
            <div>
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-2.5">
                <span className="flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
                  Top Taxable Products (Inc GST)
                </span>
                <span className="text-slate-400 font-normal">Volume / Revenue</span>
              </div>
              <div className="space-y-2">
                {topTaxable.length === 0 ? (
                  <p className="text-xs text-slate-400 py-3 text-center">No taxable product transactions recorded in period.</p>
                ) : (
                  topTaxable.slice(0, 5).map((item, idx) => (
                    <div
                      key={`tx-${idx}`}
                      className="flex items-center justify-between py-2 px-3 bg-slate-50/80 hover:bg-blue-50/50 rounded-lg text-xs transition-colors"
                    >
                      <div className="flex items-center gap-2 truncate max-w-[70%]">
                        <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-700 font-bold text-[10px] flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <span className="font-semibold text-slate-800 truncate" title={item.description}>
                          {item.description}
                        </span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-bold text-slate-900">{fmt(item.amount)}</span>
                        <span className="text-[11px] text-slate-400 ml-1.5 font-medium">({item.qty} units)</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span className="flex items-center gap-1 text-blue-600 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Tax invoice component compliant
            </span>
            <span>Tax Rate: 10% GST</span>
          </div>
        </div>

        {/* Right Card: GST-Free Products (0% GST) */}
        <div className="bg-white border border-emerald-100 rounded-2xl p-5 shadow-xs flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full -mr-10 -mt-10 pointer-events-none opacity-50" />
          <div>
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-emerald-50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700 font-bold">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">GST-Free Products (0% Tax)</h3>
                  <p className="text-xs text-slate-500">ATO exempt basic food & staples (Milk, Bread, Fresh Groceries)</p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-extrabold border border-emerald-200">
                0% GST-Free
              </span>
            </div>

            {/* Financial Metrics Grid */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl">
                <span className="text-[11px] font-semibold text-slate-500 uppercase block">Total GST-Free</span>
                <span className="text-lg font-black text-slate-900 mt-0.5 block">{fmt(gstFreeGross)}</span>
                <span className="text-[10px] text-emerald-600 font-bold">{gstFreeSharePercent.toFixed(1)}% of total</span>
              </div>
              <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl">
                <span className="text-[11px] font-semibold text-slate-500 uppercase block">Net Revenue</span>
                <span className="text-lg font-black text-slate-900 mt-0.5 block">{fmt(gstFreeGross)}</span>
                <span className="text-[10px] text-slate-500 font-medium">100% retained</span>
              </div>
              <div className="bg-emerald-50/70 border border-emerald-100 p-3 rounded-xl">
                <span className="text-[11px] font-semibold text-emerald-800 uppercase block">Tax Collected</span>
                <span className="text-lg font-black text-emerald-700 mt-0.5 block">$0.00</span>
                <span className="text-[10px] text-emerald-600 font-medium">Exempt from BAS</span>
              </div>
            </div>

            {/* Top GST-Free Best Sellers */}
            <div>
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-2.5">
                <span className="flex items-center gap-1.5">
                  <ShoppingBag className="w-3.5 h-3.5 text-emerald-600" />
                  Top GST-Free Products (Milk, Bread, Groceries)
                </span>
                <span className="text-slate-400 font-normal">Volume / Revenue</span>
              </div>
              <div className="space-y-2">
                {topGstFree.length === 0 ? (
                  <p className="text-xs text-slate-400 py-3 text-center">No GST-Free product transactions recorded in period.</p>
                ) : (
                  topGstFree.slice(0, 5).map((item, idx) => (
                    <div
                      key={`gf-${idx}`}
                      className="flex items-center justify-between py-2 px-3 bg-slate-50/80 hover:bg-emerald-50/50 rounded-lg text-xs transition-colors"
                    >
                      <div className="flex items-center gap-2 truncate max-w-[70%]">
                        <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 font-bold text-[10px] flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <span className="font-semibold text-slate-800 truncate" title={item.description}>
                          {item.description}
                        </span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-bold text-slate-900">{fmt(item.amount)}</span>
                        <span className="text-[11px] text-slate-400 ml-1.5 font-medium">({item.qty} units)</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span className="flex items-center gap-1 text-emerald-600 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Eligible Australian basic essentials
            </span>
            <span>Tax Code: FRE (0%)</span>
          </div>
        </div>
      </div>

      {/* 3. Tender & Payment Settlement Breakdown (EFTPOS vs Cash vs Other) */}
      {tenders && tenders.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-bold text-slate-900">Tender & Payment Settlement Bifurcation</h3>
            </div>
            <span className="text-xs text-slate-500 font-medium">Electronic vs Physical Drawer Settlement</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {tenders.map((tender, i) => {
              const isCash = tender.tenderCode === 'T1' || tender.tenderName.toLowerCase().includes('cash');
              const isEftpos = tender.tenderCode === 'T2' || tender.tenderName.toLowerCase().includes('eftpos') || tender.tenderName.toLowerCase().includes('card');
              return (
                <div
                  key={`td-${i}`}
                  className="p-3.5 rounded-xl border bg-slate-50/80 border-slate-200/80 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2 rounded-lg font-bold ${
                        isCash
                          ? 'bg-amber-100 text-amber-800'
                          : isEftpos
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-purple-100 text-purple-800'
                      }`}
                    >
                      {isCash ? <Banknote className="w-4 h-4" /> : <CreditCard className="w-4 h-4" />}
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">{tender.tenderName}</span>
                      <span className="text-[11px] text-slate-500">{tender.txnCount} checkouts</span>
                    </div>
                  </div>
                  <span className="text-sm font-black text-slate-900">{fmt(tender.totalAmount)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
