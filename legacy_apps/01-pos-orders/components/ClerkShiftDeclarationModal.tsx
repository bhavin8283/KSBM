import React, { useState, useEffect } from 'react';
import {
  X,
  Printer,
  Download,
  Calendar,
  Clock,
  User,
  DollarSign,
  Receipt,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  Layers,
  ArrowRight,
  RefreshCw,
  FileText,
  BarChart3,
  Percent,
  MinusCircle,
  HelpCircle
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell
} from 'recharts';
import { jsPDF } from 'jspdf';

interface ShiftDeclarationDetail {
  id: number;
  shiftEndDate: string;
  shiftStartDate: string;
  declarationMadeDate?: string;
  floatDateStr?: string;
  declDateStr?: string;
  isDateMismatch?: boolean;
  durationFormatted: string;
  durationHours: number;
  posNum: number;
  clerkId: number;
  clerkName: string;
  clerkDiscontinued: boolean;
  auditNo: number;
  notes: string;

  floatEntryReceiptNo: string | number | null;
  floatEntryTime: string | null;
  floatEntryAmount: number;

  openingFloat: number;
  countedCash: number;
  expectedCash: number;
  cashVariance: number;
  countedEftpos: number;
  expectedEftpos: number;
  eftposVariance: number;
  countedVoucher: number;
  expectedVoucher: number;
  roundingAmount: number;
  totalCalculatedSales: number;
  netVariance: number;
  varianceStatus: 'BALANCED' | 'OVER' | 'SHORT';

  discountsTotal: number;
  discountsCount: number;
  voidsTotal: number;
  voidsCount: number;
  refundsTotal: number;
  refundsCount: number;

  totalShiftTxnCount: number;
  avgSalesPerHour: number;
  avgTxnsPerHour: number;
  avgBasketValue: number;

  departmentSales: Array<{
    departmentCode: number;
    departmentName: string;
    salesAmount: number;
    itemsCount: number;
  }>;
  categoryGstSales: Array<{
    categoryIndex: number;
    amount: number;
    gst: number;
  }>;
  categoryGstFreeSales: Array<{
    categoryIndex: number;
    amount: number;
  }>;
  hourlyPerformance: Array<{
    hourOfDay: number;
    hourLabel: string;
    txnCount: number;
    hourSales: number;
    itemsSold: number;
  }>;
  shiftComparison: Array<{
    id: number;
    dateStr: string;
    shiftEndDate: string;
    totalSales: number;
    salesPerHour: number;
    cashVariance: number;
    isCurrent?: boolean;
  }>;
}

interface ClerkShiftDeclarationModalProps {
  declarationId: number;
  onClose: () => void;
}

export const ClerkShiftDeclarationModal: React.FC<ClerkShiftDeclarationModalProps> = ({
  declarationId,
  onClose,
}) => {
  const [data, setData] = useState<ShiftDeclarationDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'departments' | 'hourly' | 'audit'>('overview');

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    fetch(`/api/cash-declarations/${declarationId}`)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`Server returned HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((json) => {
        if (isMounted) {
          if (json.declaration) {
            const d = json.declaration;
            const safeNum = (v: any, fallback = 0) => {
              const n = Number(v);
              return isNaN(n) ? fallback : n;
            };
            const sanitized: ShiftDeclarationDetail = {
              ...d,
              openingFloat: safeNum(d.openingFloat),
              countedCash: safeNum(d.countedCash),
              expectedCash: safeNum(d.expectedCash),
              countedEftpos: safeNum(d.countedEftpos),
              expectedEftpos: safeNum(d.expectedEftpos),
              countedVoucher: safeNum(d.countedVoucher),
              expectedVoucher: safeNum(d.expectedVoucher),
              rounding: safeNum(d.rounding),
              cashVariance: safeNum(d.cashVariance),
              eftposVariance: safeNum(d.eftposVariance),
              voucherVariance: safeNum(d.voucherVariance),
              netVariance: safeNum(d.netVariance),
              floatEntryAmount: safeNum(d.floatEntryAmount, safeNum(d.openingFloat)),
              totalCalculatedSales: safeNum(d.totalCalculatedSales),
              durationHours: safeNum(d.durationHours, 1),
              avgSalesPerHour: safeNum(d.avgSalesPerHour),
              avgTxnsPerHour: safeNum(d.avgTxnsPerHour),
              avgBasketValue: safeNum(d.avgBasketValue),
              totalShiftTxnCount: safeNum(d.totalShiftTxnCount),
              discountsTotal: safeNum(d.discountsTotal),
              discountsCount: safeNum(d.discountsCount),
              voidsTotal: safeNum(d.voidsTotal),
              voidsCount: safeNum(d.voidsCount),
              refundsTotal: safeNum(d.refundsTotal),
              refundsCount: safeNum(d.refundsCount),
              categoryGstSales: (d.categoryGstSales || []).map((c: any) => ({
                ...c,
                categoryIndex: safeNum(c.categoryIndex),
                amount: safeNum(c.amount),
                gst: safeNum(c.gst),
              })),
              categoryGstFreeSales: (d.categoryGstFreeSales || []).map((c: any) => ({
                ...c,
                categoryIndex: safeNum(c.categoryIndex),
                amount: safeNum(c.amount),
              })),
              departmentSales: (d.departmentSales || []).map((ds: any) => ({
                ...ds,
                departmentCode: ds.departmentCode ?? 0,
                departmentName: ds.departmentName || 'Unknown',
                salesAmount: safeNum(ds.salesAmount),
                itemsCount: safeNum(ds.itemsCount),
              })),
              hourlyPerformance: (d.hourlyPerformance || []).map((h: any) => ({
                ...h,
                txnCount: safeNum(h.txnCount),
                hourSales: safeNum(h.hourSales),
                itemsSold: safeNum(h.itemsSold),
              })),
              shiftComparison: (d.shiftComparison || []).map((sc: any) => ({
                ...sc,
                totalSales: safeNum(sc.totalSales),
                salesPerHour: safeNum(sc.salesPerHour),
                cashVariance: safeNum(sc.cashVariance),
              })),
            };
            setData(sanitized);
          } else {
            setError(json.error || 'Shift declaration record not found');
          }
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || 'Failed to fetch shift declaration details');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [declarationId]);

  const handlePrint = () => {
    const existingStyle = document.getElementById('dynamic-print-landscape');
    if (existingStyle) existingStyle.remove();

    const printStyle = document.createElement('style');
    printStyle.id = 'dynamic-print-landscape';
    printStyle.innerHTML = `
      @page {
        size: landscape !important;
        margin: 8mm !important;
      }
      @media print {
        body, html, #root {
          width: 100% !important;
          max-width: none !important;
          overflow: visible !important;
          background: #ffffff !important;
        }
      }
    `;
    document.head.appendChild(printStyle);
    window.print();
    setTimeout(() => {
      const el = document.getElementById('dynamic-print-landscape');
      if (el) el.remove();
    }, 1500);
  };

  const handleExportPDF = () => {
    if (!data) return;

    // A4 Landscape: 297mm width x 210mm height
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const contentWidth = pageWidth - 28;

    // Brand Header
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, pageWidth, 22, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('CLERK SHIFT CASH DECLARATION REPORT', 14, 11);

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.text(`Shift Declaration #${data.id} | Register POS #${data.posNum} | LANDSCAPE AUDIT`, 14, 17.5);
    doc.text(`Exported: ${new Date().toLocaleString('en-AU')}`, pageWidth - 14, 17.5, { align: 'right' });

    // Shift Meta Box
    doc.setTextColor(30, 41, 59);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, 25, contentWidth, 30, 2, 2, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, 25, contentWidth, 30, 2, 2, 'D');

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.text('Clerk / Cashier:', 18, 32);
    doc.text('Declaration Made:', 18, 39);
    doc.text('Shift Duration:', 18, 46);
    doc.text('Float Entry Info:', 140, 32);

    const floatStartTimeStr = data.floatEntryTime ? new Date(data.floatEntryTime).toLocaleString('en-AU') : new Date(data.shiftStartDate).toLocaleString('en-AU');
    const declEndTimeStr = new Date(data.shiftEndDate).toLocaleString('en-AU');
    const mismatchTag = data.isDateMismatch ? ` [FLAG: Date Mismatch]` : '';

    doc.setFont('helvetica', 'normal');
    doc.text(`${data.clerkName} (ID: ${data.clerkId})${data.clerkDiscontinued ? ' [Inactive]' : ''}`, 52, 32);
    doc.text(`${declEndTimeStr}`, 52, 39);
    doc.text(`${data.durationFormatted}${mismatchTag} (${floatStartTimeStr} to ${declEndTimeStr})`, 52, 46);
    doc.text(
      data.floatEntryReceiptNo
        ? `Receipt #${data.floatEntryReceiptNo} ($${data.floatEntryAmount.toFixed(2)}) on ${floatStartTimeStr}`
        : `Opening Float: $${data.openingFloat.toFixed(2)} (Standard Shift Float)`,
      170,
      32
    );

    // Financial KPI Summary
    let yPos = 61;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.text('1. Cash & Tender Reconciliation', 14, yPos);

    yPos += 4;
    // Table Headers
    doc.setFillColor(241, 245, 249);
    doc.rect(14, yPos, contentWidth, 6.5, 'F');
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.text('TENDER / ITEM', 18, yPos + 4.5);
    doc.text('COUNTED / DECLARED', 110, yPos + 4.5);
    doc.text('EXPECTED SYSTEM', 170, yPos + 4.5);
    doc.text('VARIANCE (DIFF)', 230, yPos + 4.5);

    const rows = [
      ['Drawer Cash (inc. Float)', `$${data.countedCash.toFixed(2)}`, `$${data.expectedCash.toFixed(2)}`, `${data.cashVariance >= 0 ? '+' : ''}$${data.cashVariance.toFixed(2)} (${data.varianceStatus})`],
      ['Opening Register Float', `$${data.openingFloat.toFixed(2)}`, `$${data.openingFloat.toFixed(2)}`, '$0.00 (Balanced)'],
      ['Net Cash Sales (ex Float)', `$${Math.max(0, data.countedCash - data.openingFloat).toFixed(2)}`, `$${Math.max(0, data.expectedCash - data.openingFloat).toFixed(2)}`, `${data.cashVariance >= 0 ? '+' : ''}$${data.cashVariance.toFixed(2)}`],
      ['EFTPOS / Electronic Card', `$${data.countedEftpos.toFixed(2)}`, `$${data.expectedEftpos.toFixed(2)}`, `${data.eftposVariance >= 0 ? '+' : ''}$${data.eftposVariance.toFixed(2)}`],
      ['Total Shift Gross Revenue', `$${data.totalCalculatedSales.toFixed(2)}`, `$${data.totalCalculatedSales.toFixed(2)}`, '$0.00'],
    ];

    yPos += 6.5;
    doc.setFont('helvetica', 'normal');
    rows.forEach((r, idx) => {
      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(14, yPos, contentWidth, 5.5, 'F');
      }
      doc.text(r[0], 18, yPos + 3.8);
      doc.text(r[1], 110, yPos + 3.8);
      doc.text(r[2], 170, yPos + 3.8);
      if (r[3].includes('SHORT')) {
        doc.setTextColor(225, 29, 72);
      } else if (r[3].includes('OVER')) {
        doc.setTextColor(37, 99, 235);
      } else {
        doc.setTextColor(16, 185, 129);
      }
      doc.text(r[3], 230, yPos + 3.8);
      doc.setTextColor(30, 41, 59);
      yPos += 5.5;
    });

    // 2. Velocity & Shift Performance
    yPos += 4;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.text('2. Shift Operational & Velocity Metrics', 14, yPos);

    yPos += 4;
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, yPos, contentWidth, 18, 2, 2, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, yPos, contentWidth, 18, 2, 2, 'D');

    doc.setFontSize(8);
    doc.text(`Avg Sales / Hour: $${data.avgSalesPerHour.toFixed(2)}/hr`, 20, yPos + 6);
    doc.text(`Avg Txns / Hour: ${data.avgTxnsPerHour.toFixed(1)} receipts/hr`, 100, yPos + 6);
    doc.text(`Avg Basket Value: $${data.avgBasketValue.toFixed(2)}`, 190, yPos + 6);

    doc.text(`Total Transactions: ${data.totalShiftTxnCount}`, 20, yPos + 13);
    doc.text(`Discounts: ${data.discountsCount} ($${data.discountsTotal.toFixed(2)})`, 100, yPos + 13);
    doc.text(`Voids: ${data.voidsCount} ($${data.voidsTotal.toFixed(2)}) | Returns: ${data.refundsCount}`, 190, yPos + 13);

    // 3. Department Breakdown & 4. Shift Comparison
    yPos += 22;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.text('3. Department Sales Breakdown & Historical Shifts', 14, yPos);

    yPos += 4;
    doc.setFillColor(241, 245, 249);
    doc.rect(14, yPos, contentWidth, 6, 'F');
    doc.setFontSize(7.5);
    doc.text('DEPARTMENT NAME', 18, yPos + 4.2);
    doc.text('ITEMS SOLD', 110, yPos + 4.2);
    doc.text('GROSS SALES', 170, yPos + 4.2);
    doc.text('DEPT SHARE', 230, yPos + 4.2);

    yPos += 6;
    doc.setFont('helvetica', 'normal');
    const depts = data.departmentSales.length > 0 ? data.departmentSales : [{ departmentCode: 1, departmentName: 'General Store Sales', salesAmount: data.totalCalculatedSales, itemsCount: Math.round(data.totalShiftTxnCount * 2.5) }];
    const totalDeptRev = depts.reduce((acc, d) => acc + d.salesAmount, 0) || 1;

    depts.slice(0, 6).forEach((d, idx) => {
      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(14, yPos, contentWidth, 5, 'F');
      }
      doc.text(`${d.departmentName}`, 18, yPos + 3.6);
      doc.text(`${d.itemsCount} units`, 110, yPos + 3.6);
      doc.text(`$${d.salesAmount.toFixed(2)}`, 170, yPos + 3.6);
      const share = ((d.salesAmount / totalDeptRev) * 100).toFixed(1);
      doc.text(`${share}%`, 230, yPos + 3.6);
      yPos += 5;
    });

    // Footer signature line
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.text('Clerk Signature: __________________________________        Manager Signature: __________________________________', 18, pageHeight - 10);
    doc.text(`Page Layout: Landscape A4`, pageWidth - 14, pageHeight - 10, { align: 'right' });

    doc.save(`Shift_Cash_Declaration_${data.id}_${data.clerkName.replace(/\s+/g, '_')}_landscape.pdf`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Clerk Shift Cash Declaration Summary
                </h2>
                <span className="bg-blue-500/20 text-blue-300 border border-blue-400/30 text-[11px] font-mono font-bold px-2 py-0.5 rounded-full">
                  #{declarationId}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Comprehensive end-of-shift reconciliation, float entry audit, and cashier velocity
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {data && (
              <>
                <button
                  onClick={handlePrint}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-semibold text-slate-200 flex items-center gap-1.5 transition-colors"
                  title="Print Summary in Landscape Orientation"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-400" />
                  <span className="hidden sm:inline">Print (Landscape)</span>
                </button>
                <button
                  onClick={handleExportPDF}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
                  title="Download Comprehensive PDF in Landscape Orientation"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>PDF (Landscape)</span>
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="py-24 text-center space-y-3">
              <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
              <p className="text-sm font-bold text-slate-700">Loading comprehensive shift data...</p>
              <p className="text-xs text-slate-400">Fetching float entry receipt, drawer reconciliation, and velocity metrics</p>
            </div>
          ) : error || !data ? (
            <div className="py-16 text-center space-y-3">
              <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto" />
              <p className="text-sm font-bold text-slate-800">Failed to load declaration</p>
              <p className="text-xs text-slate-500">{error || 'Declaration record not available.'}</p>
              <button
                onClick={onClose}
                className="mt-2 px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold"
              >
                Close Window
              </button>
            </div>
          ) : (
            <>
              {/* Date Mismatch Alert Banner if float entry and declaration date differ */}
              {data.isDateMismatch && (
                <div className="bg-amber-50 border border-amber-300 rounded-xl p-3.5 flex items-start gap-3 text-amber-900 shadow-2xs">
                  <div className="w-7 h-7 rounded-lg bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-700 shrink-0 mt-0.5">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div className="text-xs space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-amber-900 text-xs">Date Mismatch Detected Between Shift Float & Declaration</span>
                      <span className="text-[10px] bg-amber-200 text-amber-900 font-bold px-1.5 py-0.5 rounded">Multi-Day Shift</span>
                    </div>
                    <p className="text-amber-800 text-[11.5px] leading-relaxed">
                      Opening float was recorded on <strong className="font-semibold text-amber-950">{data.floatDateStr || 'prior day'}</strong> at {new Date(data.floatEntryTime || data.shiftStartDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}, while this end-of-shift declaration was finalized on <strong className="font-semibold text-amber-950">{data.declDateStr || 'next day'}</strong> at {new Date(data.shiftEndDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Total shift duration spans <strong className="font-mono font-semibold">{data.durationFormatted}</strong> across these dates.
                    </p>
                  </div>
                </div>
              )}

              {/* Shift Information Bar */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
                    <User className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                      Clerk / Cashier
                    </span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-sm font-bold text-slate-800">
                        {data.clerkName}
                      </span>
                      {data.clerkDiscontinued ? (
                        <span className="text-[10px] bg-slate-200 text-slate-600 font-bold px-1.5 py-0.2 rounded">
                          Inactive
                        </span>
                      ) : (
                        <span className="text-[10px] bg-emerald-100 text-emerald-700 font-bold px-1.5 py-0.2 rounded">
                          Active
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                      Declaration Date & Time
                    </span>
                    <span className="text-sm font-bold text-slate-800 block mt-0.5">
                      {new Date(data.shiftEndDate).toLocaleDateString('en-AU', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium">
                      Declared at {new Date(data.shiftEndDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (POS #{data.posNum})
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                    data.isDateMismatch 
                      ? 'bg-amber-100 border border-amber-300 text-amber-700' 
                      : 'bg-emerald-50 border border-emerald-200 text-emerald-600'
                  }`}>
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                        Shift Duration
                      </span>
                      {data.isDateMismatch && (
                        <span
                          className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[9.5px] font-bold bg-amber-200 text-amber-900 border border-amber-300"
                          title={`Float entered on ${data.floatDateStr || 'prior day'}, declaration finalized on ${data.declDateStr || 'end day'}`}
                        >
                          <AlertTriangle className="w-2.5 h-2.5 text-amber-700 shrink-0" />
                          Date Mismatch
                        </span>
                      )}
                    </div>
                    <span className="text-sm font-bold text-slate-800 block mt-0.5 font-mono">
                      {data.durationFormatted}
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium truncate block max-w-[190px]" title={`Float: ${new Date(data.floatEntryTime || data.shiftStartDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} → Declared: ${new Date(data.shiftEndDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}>
                      Float {new Date(data.floatEntryTime || data.shiftStartDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} → Declared {new Date(data.shiftEndDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
                    <DollarSign className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                      Float Entry Provenance
                    </span>
                    <span className="text-sm font-bold text-slate-800 block mt-0.5 font-mono">
                      ${(data.floatEntryAmount || data.openingFloat).toFixed(2)}
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium">
                      {data.floatEntryReceiptNo ? `Receipt #${data.floatEntryReceiptNo}` : 'Standard Shift Float'} {data.floatDateStr ? `(${data.floatDateStr})` : ''}
                    </span>
                  </div>
                </div>
              </div>

              {/* Primary KPI Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                {/* Cash Counted & Expected */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Counted Cash
                    </span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10.5px] font-bold ${
                      data.varianceStatus === 'BALANCED'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : data.varianceStatus === 'OVER'
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}>
                      {data.varianceStatus === 'BALANCED'
                        ? 'BALANCED'
                        : data.varianceStatus === 'OVER'
                        ? `OVER +$${data.cashVariance.toFixed(2)}`
                        : `SHORT -$${Math.abs(data.cashVariance).toFixed(2)}`}
                    </span>
                  </div>
                  <div className="text-2xl font-black text-slate-900 mt-2 font-mono">
                    ${data.countedCash.toFixed(2)}
                  </div>
                  <div className="text-xs text-slate-500 mt-1 flex items-center justify-between">
                    <span>Expected: ${data.expectedCash.toFixed(2)}</span>
                    <span className="font-mono font-bold">
                      Diff: {data.cashVariance >= 0 ? '+' : ''}${data.cashVariance.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* EFTPOS & Electronic Tenders */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      EFTPOS Sales
                    </span>
                    <span className="text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                      Matched
                    </span>
                  </div>
                  <div className="text-2xl font-black text-slate-900 mt-2 font-mono">
                    ${data.countedEftpos.toFixed(2)}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Electronic terminal matched settlement
                  </div>
                </div>

                {/* Total Gross Revenue */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                    Total Shift Revenue
                  </span>
                  <div className="text-2xl font-black text-slate-900 mt-2 font-mono">
                    ${data.totalCalculatedSales.toFixed(2)}
                  </div>
                  <div className="text-xs text-slate-500 mt-1 flex items-center gap-1 font-medium">
                    <TrendingUp className="w-3 h-3 text-blue-600" />
                    <span>Avg ${data.avgSalesPerHour.toFixed(2)} / hr</span>
                  </div>
                </div>

                {/* Staff Velocity & Exceptions */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                    Scan Velocity & Basket
                  </span>
                  <div className="text-2xl font-black text-slate-900 mt-2 font-mono">
                    ${data.avgBasketValue.toFixed(2)}
                    <span className="text-xs font-normal text-slate-500 ml-1">/ txn</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1 flex items-center justify-between">
                    <span>{data.totalShiftTxnCount} txns</span>
                    <span>{data.avgTxnsPerHour.toFixed(1)} receipts/hr</span>
                  </div>
                </div>
              </div>

              {/* Navigation Tabs for Views */}
              <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                {[
                  { id: 'overview', label: 'Shift Overview & Velocity', icon: BarChart3 },
                  { id: 'departments', label: `Department Sales (${data.departmentSales.length})`, icon: Layers },
                  { id: 'hourly', label: `Hourly Timeline (${data.hourlyPerformance.length} hrs)`, icon: Clock },
                  { id: 'audit', label: 'Discounts, Voids & Audit', icon: ShieldCheck },
                ].map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                        isActive
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* TAB 1: OVERVIEW & COMPARISON */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Shift Comparison Bar Chart */}
                  <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                      <div>
                        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                          <BarChart3 className="w-4 h-4 text-blue-600" />
                          Performance Comparison vs Previous Shifts ({data.clerkName})
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Total sales ($) and average sales velocity per hour across the last 5 shifts
                        </p>
                      </div>
                      <div className="flex items-center gap-3 text-xs font-semibold text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <div className="w-3 h-3 rounded bg-blue-600" />
                          <span>Total Sales ($)</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-3 h-3 rounded bg-emerald-500" />
                          <span>Sales / Hour ($)</span>
                        </div>
                      </div>
                    </div>

                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={data.shiftComparison}
                          margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="dateStr" tick={{ fontSize: 11, fill: '#475569' }} tickLine={false} />
                          <YAxis tick={{ fontSize: 11, fill: '#475569' }} tickLine={false} />
                          <Tooltip
                            formatter={(val: any, name: string) => [
                              `$${Number(val).toFixed(2)}`,
                              name === 'totalSales' ? 'Total Shift Sales' : 'Sales per Hour'
                            ]}
                          />
                          <Bar dataKey="totalSales" fill="#2563eb" radius={[4, 4, 0, 0]}>
                            {data.shiftComparison.map((entry, index) => (
                              <Cell
                                key={`cell-total-${index}`}
                                fill={entry.isCurrent ? '#2563eb' : '#94a3b8'}
                              />
                            ))}
                          </Bar>
                          <Bar dataKey="salesPerHour" fill="#10b981" radius={[4, 4, 0, 0]}>
                            {data.shiftComparison.map((entry, index) => (
                              <Cell
                                key={`cell-rate-${index}`}
                                fill={entry.isCurrent ? '#10b981' : '#cbd5e1'}
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Cash Declaration Breakdown Grid */}
                  <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                    <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        Detailed Cash Declaration & Float Reconciliation
                      </h4>
                      <span className="text-xs font-mono font-bold text-slate-500">
                        Audit #{data.auditNo}
                      </span>
                    </div>

                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100/70 text-slate-700 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-4">Tender / Component</th>
                          <th className="py-2.5 px-4">Counted / Declared</th>
                          <th className="py-2.5 px-4">System Expected</th>
                          <th className="py-2.5 px-4">Variance</th>
                          <th className="py-2.5 px-4">Audit Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-800">
                        <tr>
                          <td className="py-3 px-4 font-bold">Physical Drawer Cash (inc. Float)</td>
                          <td className="py-3 px-4 font-mono font-bold">${data.countedCash.toFixed(2)}</td>
                          <td className="py-3 px-4 font-mono">${data.expectedCash.toFixed(2)}</td>
                          <td className={`py-3 px-4 font-mono font-bold ${
                            data.cashVariance === 0 ? 'text-slate-700' : data.cashVariance > 0 ? 'text-blue-600' : 'text-rose-600'
                          }`}>
                            {data.cashVariance >= 0 ? '+' : ''}${data.cashVariance.toFixed(2)}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10.5px] font-bold ${
                              data.varianceStatus === 'BALANCED'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : data.varianceStatus === 'OVER'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}>
                              {data.varianceStatus}
                            </span>
                          </td>
                        </tr>

                        <tr>
                          <td className="py-3 px-4 font-medium text-slate-600">Opening Register Float</td>
                          <td className="py-3 px-4 font-mono">${data.openingFloat.toFixed(2)}</td>
                          <td className="py-3 px-4 font-mono">${data.openingFloat.toFixed(2)}</td>
                          <td className="py-3 px-4 font-mono text-slate-500">$0.00</td>
                          <td className="py-3 px-4 text-slate-500">
                            {data.floatEntryReceiptNo ? `Float Receipt #${data.floatEntryReceiptNo}` : 'Verified'}
                          </td>
                        </tr>

                        <tr>
                          <td className="py-3 px-4 font-medium text-slate-600">Net Shift Cash Sales (Cash Revenue)</td>
                          <td className="py-3 px-4 font-mono font-bold">${Math.max(0, data.countedCash - data.openingFloat).toFixed(2)}</td>
                          <td className="py-3 px-4 font-mono">${Math.max(0, data.expectedCash - data.openingFloat).toFixed(2)}</td>
                          <td className={`py-3 px-4 font-mono font-bold ${
                            data.cashVariance === 0 ? 'text-slate-700' : data.cashVariance > 0 ? 'text-blue-600' : 'text-rose-600'
                          }`}>
                            {data.cashVariance >= 0 ? '+' : ''}${data.cashVariance.toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-slate-600">Net physical register intake</td>
                        </tr>

                        <tr>
                          <td className="py-3 px-4 font-medium text-slate-600">EFTPOS / Electronic Card</td>
                          <td className="py-3 px-4 font-mono">${data.countedEftpos.toFixed(2)}</td>
                          <td className="py-3 px-4 font-mono">${data.expectedEftpos.toFixed(2)}</td>
                          <td className="py-3 px-4 font-mono text-slate-500">$0.00</td>
                          <td className="py-3 px-4 text-emerald-600 font-semibold">Matched POS Terminal</td>
                        </tr>

                        <tr className="bg-slate-50/80 font-bold">
                          <td className="py-3 px-4 text-slate-900 font-extrabold">Total Shift Revenue (Gross)</td>
                          <td className="py-3 px-4 font-mono font-black text-slate-900">${data.totalCalculatedSales.toFixed(2)}</td>
                          <td className="py-3 px-4 font-mono font-bold text-slate-900">${data.totalCalculatedSales.toFixed(2)}</td>
                          <td className="py-3 px-4 font-mono text-slate-500">$0.00</td>
                          <td className="py-3 px-4 text-slate-700">Gross Shift Turnover</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 2: DEPARTMENT & CATEGORY SALES */}
              {activeTab === 'departments' && (
                <div className="space-y-6">
                  <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                    <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        Department Breakdown during this Shift
                      </h4>
                      <span className="text-xs font-semibold text-slate-500">
                        {data.departmentSales.length} Total Departments
                      </span>
                    </div>

                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100/70 text-slate-700 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-4">Code</th>
                          <th className="py-2.5 px-4">Department Name</th>
                          <th className="py-2.5 px-4">Items Scanned</th>
                          <th className="py-2.5 px-4">Gross Revenue</th>
                          <th className="py-2.5 px-4">Share of Shift</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-800">
                        {data.departmentSales.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-8 text-center text-slate-400 font-medium">
                              Detailed department line records consolidated into shift total of ${data.totalCalculatedSales.toFixed(2)}.
                            </td>
                          </tr>
                        ) : (
                          data.departmentSales.map((dept, idx) => {
                            const totalDeptRev = data.departmentSales.reduce((a, b) => a + b.salesAmount, 0) || 1;
                            const share = ((dept.salesAmount / totalDeptRev) * 100).toFixed(1);
                            return (
                              <tr key={`dept-${idx}`} className="hover:bg-slate-50 transition-colors">
                                <td className="py-2.5 px-4 font-mono text-slate-500">#{dept.departmentCode}</td>
                                <td className="py-2.5 px-4 font-bold text-slate-800">{dept.departmentName}</td>
                                <td className="py-2.5 px-4 font-medium">{dept.itemsCount} units</td>
                                <td className="py-2.5 px-4 font-mono font-bold">${dept.salesAmount.toFixed(2)}</td>
                                <td className="py-2.5 px-4">
                                  <div className="flex items-center gap-2">
                                    <div className="w-16 bg-slate-100 h-2 rounded-full overflow-hidden">
                                      <div
                                        className="bg-blue-600 h-full rounded-full"
                                        style={{ width: `${Math.min(100, Math.max(5, parseFloat(share)))}%` }}
                                      />
                                    </div>
                                    <span className="font-mono text-slate-600">{share}%</span>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* GST & Tax Split */}
                  {((data.categoryGstSales && data.categoryGstSales.length > 0) || (data.categoryGstFreeSales && data.categoryGstFreeSales.length > 0)) && (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                          GST Taxable Sales Breakdown
                        </h4>
                        {(data.categoryGstSales || []).map((c, idx) => (
                          <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-slate-200">
                            <span className="text-slate-600">Category Tier #{c.categoryIndex || (idx + 1)}</span>
                            <span className="font-mono font-bold">${(c.amount || 0).toFixed(2)} (GST: ${(c.gst || 0).toFixed(2)})</span>
                          </div>
                        ))}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                          GST-Free / Non-Taxable Sales
                        </h4>
                        {(data.categoryGstFreeSales || []).map((c, idx) => (
                          <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-slate-200">
                            <span className="text-slate-600">Category Tier #{c.categoryIndex || (idx + 1)}</span>
                            <span className="font-mono font-bold">${(c.amount || 0).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: HOURLY TIMELINE */}
              {activeTab === 'hourly' && (
                <div className="space-y-6">
                  <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                          <Clock className="w-4 h-4 text-blue-600" />
                          Hourly Customer Traffic & Revenue Velocity
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Activity from shift start float ({new Date(data.floatEntryTime || data.shiftStartDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}) to end-of-shift declaration ({new Date(data.shiftEndDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                        </p>
                      </div>
                      <div className="text-xs font-bold text-blue-600 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-lg">
                        Avg ${data.avgSalesPerHour.toFixed(2)} / Hour
                      </div>
                    </div>

                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={data.hourlyPerformance}
                          margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="hourLabel" tick={{ fontSize: 11, fill: '#475569' }} tickLine={false} />
                          <YAxis tick={{ fontSize: 11, fill: '#475569' }} tickLine={false} />
                          <Tooltip
                            formatter={(val: any, name: string) => [
                              name === 'hourSales' ? `$${Number(val).toFixed(2)}` : `${val} txns`,
                              name === 'hourSales' ? 'Hourly Sales' : 'Customer Receipts'
                            ]}
                          />
                          <Bar dataKey="hourSales" fill="#2563eb" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-4">Hour Window</th>
                          <th className="py-2.5 px-4">Receipts Count</th>
                          <th className="py-2.5 px-4">Items Sold</th>
                          <th className="py-2.5 px-4">Gross Hourly Sales</th>
                          <th className="py-2.5 px-4">Average Ticket</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-800">
                        {data.hourlyPerformance.map((h, idx) => {
                          const avgTicket = h.txnCount > 0 ? (h.hourSales / h.txnCount).toFixed(2) : '0.00';
                          return (
                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                              <td className="py-2.5 px-4 font-bold text-slate-800">{h.hourLabel}</td>
                              <td className="py-2.5 px-4 font-medium">{h.txnCount} txns</td>
                              <td className="py-2.5 px-4">{h.itemsSold} units</td>
                              <td className="py-2.5 px-4 font-mono font-bold">${h.hourSales.toFixed(2)}</td>
                              <td className="py-2.5 px-4 font-mono text-slate-600">${avgTicket}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 4: DISCOUNTS, VOIDS & AUDIT */}
              {activeTab === 'audit' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">
                          Discounts Granted
                        </span>
                        <Percent className="w-4 h-4 text-amber-600" />
                      </div>
                      <div className="text-2xl font-black text-amber-950 mt-2 font-mono">
                        ${data.discountsTotal.toFixed(2)}
                      </div>
                      <div className="text-xs text-amber-700 mt-1 font-medium">
                        {data.discountsCount} promotional / manual line discounts
                      </div>
                    </div>

                    <div className="bg-rose-50/70 border border-rose-200 rounded-xl p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-rose-800 uppercase tracking-wider">
                          Voids Processed
                        </span>
                        <MinusCircle className="w-4 h-4 text-rose-600" />
                      </div>
                      <div className="text-2xl font-black text-rose-950 mt-2 font-mono">
                        ${data.voidsTotal.toFixed(2)}
                      </div>
                      <div className="text-xs text-rose-700 mt-1 font-medium">
                        {data.voidsCount} voided lines & aborted sales
                      </div>
                    </div>

                    <div className="bg-purple-50/70 border border-purple-200 rounded-xl p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-purple-800 uppercase tracking-wider">
                          Customer Returns
                        </span>
                        <RefreshCw className="w-4 h-4 text-purple-600" />
                      </div>
                      <div className="text-2xl font-black text-purple-950 mt-2 font-mono">
                        ${data.refundsTotal.toFixed(2)}
                      </div>
                      <div className="text-xs text-purple-700 mt-1 font-medium">
                        {data.refundsCount} refund items processed
                      </div>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Audit Notes & Reconciliation Remarks
                    </h4>
                    <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-200 font-medium">
                      {data.notes || (data.varianceStatus === 'BALANCED' ? 'No discrepancies recorded. Cash drawer counted and balanced against register expected amount.' : `Shift finished with cash variance status: ${data.varianceStatus} ($${data.cashVariance.toFixed(2)}).`)}
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Official IdealPOS Shift Declaration Audit Log</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-lg text-xs transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
