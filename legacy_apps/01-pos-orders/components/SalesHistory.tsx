import React, { useEffect, useState } from 'react';
import {
  Receipt,
  RefreshCw,
  Search,
  DollarSign,
  ShoppingBag,
  CreditCard,
  Printer,
  Calendar,
  Clock,
  ChevronRight,
  Tag,
  Download,
  X,
  FileText,
  ChevronLeft,
  Filter,
  SlidersHorizontal,
  Eye,
  CheckCircle,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Percent,
  Sparkles,
  UserCheck,
  Ban,
} from 'lucide-react';
import type { TodaySalesHistoryResponse, SalesTransaction } from '../types';
import { useDateTime } from '../DateTimeContext';
import { ColumnVisibilityDropdown, usePersistentColumns, ColumnDefinition } from './ColumnVisibilityDropdown';

export function isMiscProduct(stockCode?: string, barcode?: string, description?: string): boolean {
  const code = String(stockCode || '').toUpperCase().trim();
  const bc = String(barcode || '').toUpperCase().trim();
  const desc = String(description || '').toUpperCase().trim();
  if (bc === '15302901' || code === '15302901') return true;
  if (desc.includes('MISC') || code.includes('MISC') || bc.includes('MISC')) return true;
  return false;
}

export function SalesHistory() {
  const {
    formatDate,
    formatTime,
    formatDateTime,
    settings: regionalSettings,
  } = useDateTime();
  const [data, setData] = useState<TodaySalesHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Date and Time Filter State
  const getLocalDateString = (d: Date = new Date()) => {
    return d.toLocaleDateString('en-CA', { timeZone: regionalSettings.timeZone || 'Australia/Brisbane' });
  };
  const todayStr = getLocalDateString();
  const [preset, setPreset] = useState<'today' | 'yesterday' | 'week' | 'month' | 'custom'>('today');
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [startTime, setStartTime] = useState('00:00');
  const [endTime, setEndTime] = useState('23:59');

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [tenderFilter, setTenderFilter] = useState('all');
  const [flagFilter, setFlagFilter] = useState<'all' | 'sales_only' | 'float_entries' | 'normal' | 'void_sales' | 'void_items' | 'discounts' | 'promotions'>('all');

  // Pagination State (Handling 200+ sales per day)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Modal Popup Receipt State
  const [selectedTx, setSelectedTx] = useState<SalesTransaction | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Column Visibility
  const DEFAULT_SALES_COLUMNS: ColumnDefinition[] = [
    { id: 'receiptNo', label: 'Receipt #', visible: true, required: true },
    { id: 'dateTime', label: 'Date & Time', visible: true },
    { id: 'clerk', label: 'Clerk / Cashier', visible: true },
    { id: 'items', label: 'Items & Details', visible: true },
    { id: 'status', label: 'Status & Flags', visible: true },
    { id: 'tender', label: 'Tender Type', visible: true },
    { id: 'total', label: 'Total Amount', visible: true, required: true },
    { id: 'action', label: 'Receipt Action', visible: true },
  ];

  const { columns, isVisible, setColumns: updateColumns } = usePersistentColumns('col_vis_sales_history', DEFAULT_SALES_COLUMNS);

  const fetchSalesHistory = async (overrideParams?: {
    sDate?: string;
    eDate?: string;
    sTime?: string;
    eTime?: string;
  }) => {
    setLoading(true);
    setError(null);
    try {
      const pStart = overrideParams?.sDate ?? startDate;
      const pEnd = overrideParams?.eDate ?? endDate;
      const pStartTime = overrideParams?.sTime ?? startTime;
      const pEndTime = overrideParams?.eTime ?? endTime;

      const queryParams = new URLSearchParams();
      if (pStart) queryParams.set('startDate', pStart);
      if (pEnd) queryParams.set('endDate', pEnd);
      if (pStartTime) queryParams.set('startTime', pStartTime);
      if (pEndTime) queryParams.set('endTime', pEndTime);

      let res = await fetch(`/api/sales/today?${queryParams.toString()}`);
      if (!res.ok) {
        res = await fetch(`/api/pos/sales-history?${queryParams.toString()}`);
      }
      if (!res.ok) throw new Error('Failed to fetch sales history');
      const json: TodaySalesHistoryResponse = await res.json();
      if (json && json.transactions) {
        json.transactions = json.transactions.map((tx) => ({
          ...tx,
          items: (tx.items || []).map((i) => {
            const isMisc = isMiscProduct(i.stockCode, i.barcode, i.description);
            return {
              ...i,
              discount: isMisc ? 0 : (i.discount || 0),
            };
          }),
        }));
      }
      setData(json);
      if (json.activeDate && preset === 'today') {
        setStartDate(json.activeDate);
        setEndDate(json.activeDate);
      }
      setCurrentPage(1);
    } catch (err: any) {
      setError(err.message || 'Error loading sales history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchSalesHistory();
  }, []);

  // Quick Preset Selector Helper
  const handlePresetChange = (newPreset: 'today' | 'yesterday' | 'week' | 'month' | 'custom') => {
    setPreset(newPreset);
    const now = new Date();
    const currToday = getLocalDateString(now);

    let sDate = currToday;
    let eDate = currToday;
    let sTime = '00:00';
    let eTime = '23:59';

    if (newPreset === 'yesterday') {
      const yest = new Date(now);
      yest.setDate(now.getDate() - 1);
      sDate = getLocalDateString(yest);
      eDate = sDate;
    } else if (newPreset === 'week') {
      const weekAgo = new Date(now);
      weekAgo.setDate(now.getDate() - 7);
      sDate = getLocalDateString(weekAgo);
      eDate = currToday;
    } else if (newPreset === 'month') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      sDate = getLocalDateString(startOfMonth);
      eDate = currToday;
    }

    setStartDate(sDate);
    setEndDate(eDate);
    setStartTime(sTime);
    setEndTime(eTime);

    void fetchSalesHistory({ sDate, eDate, sTime, eTime });
  };

  const handleApplyCustomFilter = (e: React.FormEvent) => {
    e.preventDefault();
    void fetchSalesHistory();
  };

  const openReceiptModal = (tx: SalesTransaction) => {
    setSelectedTx(tx);
    setIsModalOpen(true);
  };

  const closeReceiptModal = () => {
    setIsModalOpen(false);
    setSelectedTx(null);
  };

  // Keyboard shortcut ESC to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isModalOpen) {
        closeReceiptModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen]);

  // Filtering transactions locally
  const filteredTransactions = (data?.transactions || []).filter((tx) => {
    const isFloat = Boolean(tx.isFloatEntry || tx.tenderType === 'Float Entry' || (tx.items && tx.items.some(i => i.isFloatEntry)));

    const matchesTender =
      tenderFilter === 'all' ||
      (tenderFilter === 'float' && isFloat) ||
      tx.tenderType.toLowerCase().includes(tenderFilter.toLowerCase());

    const matchesFlag =
      flagFilter === 'all' ||
      (flagFilter === 'float_entries' && isFloat) ||
      (flagFilter === 'sales_only' && !isFloat) ||
      (flagFilter === 'void_sales' && (tx.isVoidSale || tx.status === 'Void')) ||
      (flagFilter === 'void_items' && (tx.hasVoidProducts || tx.items.some((i) => i.isVoided))) ||
      (flagFilter === 'discounts' && (tx.hasDiscount || tx.discount > 0 || tx.items.some((i) => i.discount > 0))) ||
      (flagFilter === 'promotions' && ((tx.appliedPromotions && tx.appliedPromotions.length > 0) || tx.items.some((i) => Boolean(i.promotionName)))) ||
      (flagFilter === 'normal' && !tx.isVoidSale && !tx.hasVoidProducts && !tx.hasDiscount && !isFloat && (!tx.appliedPromotions || tx.appliedPromotions.length === 0));

    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      tx.receiptNo.toLowerCase().includes(q) ||
      tx.cashier.toLowerCase().includes(q) ||
      (tx.clerkName && tx.clerkName.toLowerCase().includes(q)) ||
      (isFloat && ('float entry'.includes(q) || 'shift start'.includes(q) || 'start of shift'.includes(q) || 'drawer'.includes(q))) ||
      (tx.appliedPromotions && tx.appliedPromotions.some((p) => p.toLowerCase().includes(q))) ||
      tx.items.some(
        (i) =>
          i.description.toLowerCase().includes(q) ||
          i.stockCode.toLowerCase().includes(q) ||
          i.barcode.toLowerCase().includes(q) ||
          (i.promotionName && i.promotionName.toLowerCase().includes(q))
      );

    return matchesTender && matchesFlag && matchesSearch;
  });

  // Pagination Math
  const totalRecords = filteredTransactions.length;
  const totalPages = Math.ceil(totalRecords / pageSize) || 1;
  const paginatedTransactions = filteredTransactions.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const formatTxDateTime = (tx: SalesTransaction | null) => {
    if (!tx) return '';
    const raw = tx as any;
    const dateInput = tx.dateTime || raw.dateTimeStr || (raw.date && raw.time ? `${raw.date}T${raw.time}` : raw.date);
    if (!dateInput) return 'N/A';
    return formatDateTime(dateInput);
  };

  const printReceipt = (tx: SalesTransaction) => {
    const store = data?.storeInfo || {
      name: 'KWIKSTOP CONVENIENCE STORE',
      address: '4812 Main Highway, Brisbane QLD 4000',
      phone: '(07) 3812 4812',
      abn: '74 812 903 481',
      terminal: 'Register 01',
    };

    const headerText = store.receiptHeader || `${store.name}\n${store.address}\nPh: ${store.phone} · ABN: ${store.abn}\n${store.terminal}`;
    const footerText = store.receiptFooter || '*** THANK YOU FOR SHOPPING AT KWIKSTOP ***\nKeep receipt for returns or exchanges within 14 days.';
    const clerkName = tx.clerkName || tx.cashier || 'Register Clerk';

    const itemRows = tx.items
      .map(
        (i) => `
        <div style="margin-bottom: 5px; ${i.isVoided ? 'text-decoration: line-through; opacity: 0.6;' : ''}">
          <div style="font-weight: bold; display: flex; justify-content: space-between;">
            <span>${i.description} ${i.isVoided ? '<span style="color: red;">[VOIDED]</span>' : ''}</span>
            <span>$${i.isVoided ? '0.00' : i.lineTotal.toFixed(2)}</span>
          </div>
          <div style="font-size: 11px; color: #555; display: flex; justify-content: space-between;">
            <span>Code: ${i.stockCode} · ${i.qty} x $${i.unitPrice.toFixed(2)}</span>
            ${i.discount > 0 && !isMiscProduct(i.stockCode, i.barcode, i.description) ? `<span style="color: #b91c1c;">Disc: -$${i.discount.toFixed(2)}</span>` : ''}
          </div>
          ${i.promotionName ? `<div style="font-size: 10px; color: #6b21a8; font-weight: bold;">Promo: ${i.promotionName}</div>` : ''}
        </div>
      `
      )
      .join('');

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Receipt ${tx.receiptNo}</title>
  <style>
    body {
      font-family: 'Courier New', Courier, monospace;
      width: 290px;
      margin: 20px auto;
      padding: 12px;
      border: 1px solid #ddd;
      font-size: 12px;
      line-height: 1.3;
      background: #fff;
    }
    .center { text-align: center; }
    .bold { font-weight: bold; }
    .divider { border-top: 1px dashed #000; margin: 8px 0; }
    .flex-between { display: flex; justify-content: space-between; }
    .pre-line { white-space: pre-line; }
  </style>
</head>
<body>
  <div class="center bold pre-line" style="font-size: 13px;">${headerText}</div>

  <div class="divider"></div>

  <div class="flex-between"><span>Receipt #:</span><span class="bold">${tx.receiptNo}</span></div>
  <div class="flex-between"><span>Date/Time:</span><span>${formatTxDateTime(tx)}</span></div>
  <div class="flex-between"><span>Clerk Name:</span><span class="bold">${clerkName}</span></div>
  <div class="flex-between"><span>Terminal:</span><span>${store.terminal}</span></div>
  ${tx.isVoidSale ? '<div class="center bold" style="color: red; font-size: 14px; margin: 4px 0;">*** VOIDED TRANSACTION ***</div>' : ''}

  <div class="divider"></div>

  <div class="bold" style="margin-bottom: 6px;">ITEMS PURCHASED:</div>
  ${itemRows}

  <div class="divider"></div>

  <div class="flex-between"><span>Subtotal (ex GST):</span><span>$${tx.subtotal.toFixed(2)}</span></div>
  ${tx.discount > 0 ? `<div class="flex-between" style="color: #b91c1c; font-weight: bold;"><span>Total Discounts:</span><span>-$${tx.discount.toFixed(2)}</span></div>` : ''}
  ${tx.appliedPromotions && tx.appliedPromotions.length > 0 ? `<div style="font-size: 11px; color: #6b21a8; font-weight: bold;">Promotions: ${tx.appliedPromotions.join(', ')}</div>` : ''}
  <div class="flex-between"><span>Includes GST (10%):</span><span>$${tx.gst.toFixed(2)}</span></div>
  
  <div class="divider"></div>

  <div class="flex-between bold" style="font-size: 14px; margin: 4px 0;">
    <span>TOTAL:</span>
    <span>$${tx.total.toFixed(2)}</span>
  </div>

  <div class="flex-between"><span>Tender Type:</span><span>${tx.tenderType}</span></div>
  <div class="flex-between"><span>Amount Tendered:</span><span>$${tx.tendered.toFixed(2)}</span></div>
  <div class="flex-between"><span>Change Given:</span><span>$${tx.change.toFixed(2)}</span></div>

  <div class="divider"></div>

  <div class="center pre-line" style="margin-top: 10px; font-size: 11px; color: #444;">
    ${footerText}
  </div>
  <script>window.onload = () => window.print();</script>
</body>
</html>`;

    const win = window.open('', '_blank', 'noopener,noreferrer,width=400,height=600');
    if (win) {
      win.document.write(html);
      win.document.close();
    }
  };

  const downloadReceiptTxt = (tx: SalesTransaction) => {
    const store = data?.storeInfo || { name: 'KWIKSTOP CONVENIENCE STORE' };
    const header = store.receiptHeader || store.name;
    const footer = store.receiptFooter || '*** THANK YOU FOR SHOPPING AT KWIKSTOP ***';
    const clerk = tx.clerkName || tx.cashier || 'Register Clerk';

    let txt = `========================================\n`;
    txt += `${header}\n`;
    txt += `Receipt #: ${tx.receiptNo}\n`;
    txt += `Date/Time: ${formatTxDateTime(tx)}\n`;
    txt += `Clerk: ${clerk}\n`;
    if (tx.isVoidSale) txt += `STATUS: *** VOIDED TRANSACTION ***\n`;
    txt += `========================================\n\n`;

    tx.items.forEach((item, idx) => {
      txt += `${idx + 1}. ${item.description} ${item.isVoided ? '[VOIDED]' : ''}\n`;
      txt += `   Code: ${item.stockCode} | ${item.qty} x $${item.unitPrice.toFixed(2)} = $${item.isVoided ? '0.00' : item.lineTotal.toFixed(2)}\n`;
      if (item.discount > 0 && !isMiscProduct(item.stockCode, item.barcode, item.description)) txt += `   Discount: -$${item.discount.toFixed(2)}\n`;
      if (item.promotionName) txt += `   Promo Applied: ${item.promotionName}\n`;
    });

    txt += `\n----------------------------------------\n`;
    txt += `Subtotal (ex GST): $${tx.subtotal.toFixed(2)}\n`;
    if (tx.discount > 0) txt += `Discounts: -$${tx.discount.toFixed(2)}\n`;
    if (tx.appliedPromotions && tx.appliedPromotions.length > 0) {
      txt += `Promotions: ${tx.appliedPromotions.join(', ')}\n`;
    }
    txt += `GST (10%): $${tx.gst.toFixed(2)}\n`;
    txt += `TOTAL: $${tx.total.toFixed(2)}\n`;
    txt += `Tender: ${tx.tenderType} ($${tx.tendered.toFixed(2)})\n`;
    txt += `Change: $${tx.change.toFixed(2)}\n`;
    txt += `========================================\n`;
    txt += `${footer}\n`;

    const blob = new Blob([txt], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Receipt_${tx.receiptNo}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Top Title Bar */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-600 text-white shadow-md">
            <Receipt className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
              Sales History
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              IdealPOS Transactions · Flags for Void Products, Void Sales &amp; Discounts · Thermal Receipt Popups
            </p>
          </div>
        </div>

        <button
          onClick={() => void fetchSalesHistory()}
          disabled={loading}
          className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-2 disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh Sales
        </button>
      </div>

      {/* Date & Time Range Controls Card */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
            <Calendar className="w-4 h-4 text-blue-600" />
            <span>Date &amp; Time Range Filter</span>
          </div>

          {/* Quick Presets Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => handlePresetChange('today')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                preset === 'today'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => handlePresetChange('yesterday')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                preset === 'yesterday'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              Yesterday
            </button>
            <button
              type="button"
              onClick={() => handlePresetChange('week')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                preset === 'week'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              Last 7 Days
            </button>
            <button
              type="button"
              onClick={() => handlePresetChange('month')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                preset === 'month'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              This Month
            </button>
            <button
              type="button"
              onClick={() => setPreset('custom')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                preset === 'custom'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              Custom Range
            </button>
          </div>
        </div>

        {/* Custom Date & Time Inputs */}
        <form onSubmit={handleApplyCustomFilter} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end pt-2 border-t border-slate-100">
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">From Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPreset('custom');
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">From Time</label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => {
                setStartTime(e.target.value);
                setPreset('custom');
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">To Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPreset('custom');
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">To Time</label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => {
                setEndTime(e.target.value);
                setPreset('custom');
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Query Sales</span>
            </button>
          </div>
        </form>
      </div>

      {/* KPI Summary Cards with Void, Discount & Float counters */}
      {data?.summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
              <span>Total Revenue</span>
              <DollarSign className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-lg font-extrabold text-slate-900 font-mono">
              ${data.summary.totalSales.toFixed(2)}
            </p>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
              <span>Transactions</span>
              <Receipt className="w-4 h-4 text-blue-600" />
            </div>
            <p className="text-lg font-extrabold text-slate-900 font-mono">
              {data.summary.totalTransactions}
            </p>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/20 shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-xs font-bold text-emerald-800">
              <span>Shift Floats</span>
              <CheckCircle className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-lg font-extrabold text-emerald-700 font-mono">
              {data.summary.totalFloats || 0}
              <span className="text-[11px] font-bold text-slate-600 ml-1">
                (${((data.summary.totalFloatAmount || 0)).toFixed(2)})
              </span>
            </p>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
              <span>Items Sold</span>
              <ShoppingBag className="w-4 h-4 text-amber-600" />
            </div>
            <p className="text-lg font-extrabold text-slate-900 font-mono">
              {data.summary.totalItems}
            </p>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
              <span>GST (10%)</span>
              <Tag className="w-4 h-4 text-rose-600" />
            </div>
            <p className="text-lg font-extrabold text-slate-900 font-mono">
              ${data.summary.gstTotal.toFixed(2)}
            </p>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
              <span>Discounts</span>
              <Percent className="w-4 h-4 text-purple-600" />
            </div>
            <p className="text-lg font-extrabold text-purple-700 font-mono">
              ${(data.summary.totalDiscounts || 0).toFixed(2)}
            </p>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
              <span>Void Sales/Items</span>
              <AlertOctagon className="w-4 h-4 text-rose-500" />
            </div>
            <p className="text-lg font-extrabold text-rose-600 font-mono">
              {data.summary.totalVoidSales || 0} / {data.summary.totalVoidItems || 0}
            </p>
          </div>
        </div>
      )}

      {/* Main Transactions Table Container */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        {/* Table Search & Flag Filters Header */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search receipt #, clerk name, product, float entry or barcode..."
              className="w-full pl-8 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Status / Flag Filter Dropdown */}
            <select
              value={flagFilter}
              onChange={(e) => {
                setFlagFilter(e.target.value as any);
                setCurrentPage(1);
              }}
              className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer text-slate-700"
            >
              <option value="all">All Records (Sales &amp; Floats)</option>
              <option value="sales_only">Sales Transactions Only</option>
              <option value="float_entries">Start of Shift Float Entries Only</option>
              <option value="normal">Normal Sales (No Flags)</option>
              <option value="void_sales">Void Sales Only</option>
              <option value="void_items">Contains Void Items</option>
              <option value="discounts">Discounts Provided</option>
              <option value="promotions">Promotions Applied</option>
            </select>

            <select
              value={tenderFilter}
              onChange={(e) => {
                setTenderFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer text-slate-700"
            >
              <option value="all">All Tender Types</option>
              <option value="cash">Cash</option>
              <option value="eftpos">EFTPOS</option>
              <option value="visa">Visa / Mastercard</option>
              <option value="float">Float Entry (Shift Start)</option>
            </select>

            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer text-slate-700"
            >
              <option value={25}>25 per page</option>
              <option value={50}>50 per page</option>
              <option value={100}>100 per page</option>
            </select>

            <ColumnVisibilityDropdown
              columns={columns}
              onChange={updateColumns}
              storageKey="col_vis_sales_history"
            />
          </div>
        </div>

        {/* Transactions Table */}
        <div className="overflow-x-auto min-h-[400px]">
          {loading ? (
            <div className="p-16 text-center text-slate-400 space-y-3">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-600" />
              <p className="text-sm font-semibold">Fetching sales history from IdealPOS...</p>
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="p-16 text-center text-slate-400 space-y-2">
              <Receipt className="w-12 h-12 mx-auto text-slate-300" />
              <p className="text-base font-semibold text-slate-700">No sales transactions found</p>
              <p className="text-xs text-slate-400">
                Try adjusting your date range, flag filters, or search term.
              </p>
            </div>
          ) : (
            <>
              {/* Mobile Transaction Cards (Hidden on md and larger) */}
              <div className="block md:hidden p-3 space-y-2.5 divide-y divide-slate-100">
                {paginatedTransactions.map((tx, index) => (
                  <div
                    key={`mob-tx-${tx.id || tx.receiptNo}-${index}`}
                    onClick={() => openReceiptModal(tx)}
                    className="pt-2.5 first:pt-0 cursor-pointer p-3 rounded-xl border border-slate-100 bg-white hover:bg-blue-50/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono font-extrabold text-sm text-slate-900 block">
                            #{tx.receiptNo}
                          </span>
                          {tx.isFloatEntry ? (
                            <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded text-[10px] font-extrabold flex items-center gap-1">
                              <CheckCircle className="w-3 h-3 text-emerald-600" />
                              FLOAT ENTRY (SHIFT START)
                            </span>
                          ) : tx.isVoidSale ? (
                            <span className="px-1.5 py-0.5 bg-rose-100 text-rose-700 rounded text-[10px] font-extrabold">
                              VOID SALE
                            </span>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5">
                          <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{formatTxDateTime(tx)}</span>
                          <span className="text-slate-300">·</span>
                          <span className="font-medium text-slate-700">{tx.clerkName || tx.cashier}</span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className={`text-base font-extrabold block font-mono ${tx.isFloatEntry ? 'text-emerald-700' : tx.isVoidSale ? 'text-rose-600 line-through' : 'text-slate-900'}`}>
                          ${tx.total.toFixed(2)}
                        </span>
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase mt-0.5 ${
                            tx.isFloatEntry || tx.tenderType === 'Float Entry'
                              ? 'bg-emerald-100 text-emerald-900 border border-emerald-300 font-black'
                              : tx.tenderType === 'Cash'
                              ? 'bg-emerald-100 text-emerald-800'
                              : tx.tenderType === 'EFTPOS'
                              ? 'bg-blue-100 text-blue-800'
                              : tx.tenderType === 'Void'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-indigo-100 text-indigo-800'
                          }`}
                        >
                          {tx.isFloatEntry ? 'Float Entry' : tx.tenderType}
                        </span>
                      </div>
                    </div>

                    {/* Mobile Badges Row */}
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      {tx.isFloatEntry && (
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[10px] font-bold">
                          Register Opening Float Cash (Drawer In)
                        </span>
                      )}
                      {tx.hasVoidProducts && !tx.isVoidSale && (
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full text-[10px] font-bold flex items-center gap-1">
                          <AlertTriangle className="w-2.5 h-2.5 text-amber-600" />
                          Void Item
                        </span>
                      )}
                      {(tx.discount > 0 || tx.hasDiscount) && (
                        <span className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded-full text-[10px] font-bold flex items-center gap-1">
                          <Percent className="w-2.5 h-2.5 text-purple-600" />
                          Disc -${tx.discount.toFixed(2)}
                        </span>
                      )}
                      {tx.appliedPromotions && tx.appliedPromotions.length > 0 && (
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-[10px] font-bold flex items-center gap-1">
                          <Sparkles className="w-2.5 h-2.5 text-blue-600" />
                          Promo Applied
                        </span>
                      )}
                    </div>

                    <div className="mt-2 text-xs text-slate-600 border-t border-slate-100 pt-1.5 flex items-center justify-between">
                      <span className="truncate max-w-[220px]">
                        {tx.isFloatEntry
                          ? 'Opening Float Cash · Drawer In'
                          : `${tx.items.length} item${tx.items.length === 1 ? '' : 's'}: ${tx.items.map((i) => i.description).join(', ')}`}
                      </span>
                      <span className="text-blue-600 font-bold text-[11px] shrink-0">Receipt &rarr;</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table (Hidden on small mobile) */}
              <table className="hidden md:table w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100/80 border-b border-slate-200 text-[11px] font-extrabold uppercase tracking-wider text-slate-600">
                    {isVisible('receiptNo') && <th className="py-3 px-4">Receipt #</th>}
                    {isVisible('dateTime') && <th className="py-3 px-4">Date &amp; Time</th>}
                    {isVisible('clerk') && <th className="py-3 px-4">Clerk</th>}
                    {isVisible('items') && <th className="py-3 px-4">Items &amp; Details</th>}
                    {isVisible('status') && <th className="py-3 px-4">Status &amp; Flags</th>}
                    {isVisible('tender') && <th className="py-3 px-4">Tender</th>}
                    {isVisible('total') && <th className="py-3 px-4 text-right">Total Amount</th>}
                    {isVisible('action') && <th className="py-3 px-4 text-center">Action</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {paginatedTransactions.map((tx, index) => (
                    <tr
                      key={`desk-tx-${tx.id || tx.receiptNo}-${index}`}
                      onClick={() => openReceiptModal(tx)}
                      className={`hover:bg-blue-50/50 cursor-pointer transition-all group ${
                        tx.isFloatEntry ? 'bg-emerald-50/30 hover:bg-emerald-50/60' : tx.isVoidSale ? 'bg-rose-50/30' : ''
                      }`}
                    >
                      {isVisible('receiptNo') && (
                        <td className="py-3.5 px-4 font-mono font-extrabold text-slate-900 group-hover:text-blue-600 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span>{tx.receiptNo}</span>
                            {tx.isFloatEntry && (
                              <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded text-[9px] font-black uppercase">
                                FE
                              </span>
                            )}
                          </div>
                        </td>
                      )}
                      {isVisible('dateTime') && (
                        <td className="py-3.5 px-4 text-slate-600 font-medium whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span>{formatTxDateTime(tx)}</span>
                          </div>
                        </td>
                      )}
                      {isVisible('clerk') && (
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                            <UserCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                            <span>{tx.clerkName || tx.cashier}</span>
                          </div>
                        </td>
                      )}
                      {isVisible('items') && (
                        <td className="py-3.5 px-4 text-slate-700 max-w-xs">
                          {tx.isFloatEntry ? (
                            <div>
                              <div className="font-extrabold text-emerald-800 flex items-center gap-1">
                                <span>Start of Shift Float Entry</span>
                              </div>
                              <div className="text-[11px] text-emerald-600 font-medium">
                                Register Opening Float Cash (Drawer In)
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="font-semibold text-slate-800">
                                {tx.items.length} item{tx.items.length === 1 ? '' : 's'}
                              </div>
                              <div className="text-[11px] text-slate-500 truncate">
                                {tx.items.map((i) => `${i.qty}x ${i.description}${i.isVoided ? ' (Void)' : ''}`).join(', ')}
                              </div>
                            </>
                          )}
                        </td>
                      )}
                      {isVisible('status') && (
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {tx.isFloatEntry && (
                              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-md text-[10px] font-extrabold flex items-center gap-1 shadow-xs">
                                <CheckCircle className="w-3 h-3 text-emerald-600" />
                                Shift Start Float
                              </span>
                            )}
                            {tx.isVoidSale && (
                              <span className="px-2 py-0.5 bg-rose-100 text-rose-800 border border-rose-200 rounded-md text-[10px] font-extrabold flex items-center gap-1">
                                <Ban className="w-3 h-3 text-rose-600" />
                                Void Sale
                              </span>
                            )}
                            {tx.hasVoidProducts && !tx.isVoidSale && (
                              <span className="px-2 py-0.5 bg-amber-100 text-amber-800 border border-amber-200 rounded-md text-[10px] font-bold flex items-center gap-1" title="Transaction contains voided items">
                                <AlertTriangle className="w-3 h-3 text-amber-600" />
                                Void Item
                              </span>
                            )}
                            {(tx.discount > 0 || tx.hasDiscount) && (
                              <span className="px-2 py-0.5 bg-purple-100 text-purple-800 border border-purple-200 rounded-md text-[10px] font-bold flex items-center gap-1" title={`Discount: -$${tx.discount.toFixed(2)}`}>
                                <Percent className="w-3 h-3 text-purple-600" />
                                -${tx.discount.toFixed(2)}
                              </span>
                            )}
                            {tx.appliedPromotions && tx.appliedPromotions.length > 0 && (
                              <span className="px-2 py-0.5 bg-blue-100 text-blue-800 border border-blue-200 rounded-md text-[10px] font-bold flex items-center gap-1" title={tx.appliedPromotions.join(', ')}>
                                <Sparkles className="w-3 h-3 text-blue-600" />
                                Promo
                              </span>
                            )}
                            {!tx.isFloatEntry && !tx.isVoidSale && !tx.hasVoidProducts && !tx.hasDiscount && (!tx.appliedPromotions || tx.appliedPromotions.length === 0) && (
                              <span className="text-[11px] text-slate-400 font-medium">Standard</span>
                            )}
                          </div>
                        </td>
                      )}
                      {isVisible('tender') && (
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wide ${
                              tx.isFloatEntry || tx.tenderType === 'Float Entry'
                                ? 'bg-emerald-100 text-emerald-900 border border-emerald-300 font-black'
                                : tx.tenderType === 'Cash'
                                ? 'bg-emerald-100 text-emerald-800'
                                : tx.tenderType === 'EFTPOS'
                                ? 'bg-blue-100 text-blue-800'
                                : tx.tenderType === 'Void'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-indigo-100 text-indigo-800'
                            }`}
                          >
                            {tx.isFloatEntry ? 'Float Entry' : tx.tenderType}
                          </span>
                        </td>
                      )}
                      {isVisible('total') && (
                        <td className="py-3.5 px-4 text-right font-extrabold text-sm whitespace-nowrap">
                          <span className={tx.isFloatEntry ? 'text-emerald-700 font-mono' : tx.isVoidSale ? 'text-rose-600 line-through' : 'text-slate-900'}>
                            ${tx.total.toFixed(2)}
                          </span>
                        </td>
                      )}
                      {isVisible('action') && (
                        <td className="py-3.5 px-4 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => openReceiptModal(tx)}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-700 text-xs font-bold rounded-lg transition-all flex items-center gap-1 mx-auto cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Receipt</span>
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>

        {/* Pagination Footer */}
        {totalRecords > 0 && (
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs font-medium text-slate-600">
            <div>
              Showing <strong className="text-slate-900">{(currentPage - 1) * pageSize + 1}</strong> to{' '}
              <strong className="text-slate-900">{Math.min(currentPage * pageSize, totalRecords)}</strong> of{' '}
              <strong className="text-slate-900">{totalRecords}</strong> sales transactions
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-3 font-bold text-slate-800">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* POPUP RECEIPT MODAL DIALOG */}
      {isModalOpen && selectedTx && (
        <div
          className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in"
          onClick={closeReceiptModal}
        >
          <div
            className="bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 text-slate-100 max-w-md w-full overflow-hidden flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-emerald-400" />
                <span className="font-bold text-sm text-white">IdealPOS Receipt View</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => printReceipt(selectedTx)}
                  className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                  title="Print Thermal Receipt"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print
                </button>
                <button
                  onClick={() => downloadReceiptTxt(selectedTx)}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                  title="Download Receipt TXT"
                >
                  <Download className="w-3.5 h-3.5" />
                  Save
                </button>
                <button
                  onClick={closeReceiptModal}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body: Thermal Paper Style Receipt */}
            <div className="p-5 overflow-y-auto space-y-4">
              <div className="bg-white text-slate-900 p-6 rounded-xl shadow-inner font-mono text-xs leading-relaxed space-y-4 border border-slate-200">
                {/* Branch Heading */}
                <div className="text-center space-y-1 border-b border-dashed border-slate-300 pb-3">
                  {data?.storeInfo.receiptHeader ? (
                    <div className="font-bold text-xs text-slate-800 whitespace-pre-line leading-snug">
                      {data.storeInfo.receiptHeader}
                    </div>
                  ) : (
                    <>
                      <div className="font-extrabold text-sm text-slate-900 tracking-tight">
                        {data?.storeInfo.name || 'KWIKSTOP CONVENIENCE STORE'}
                      </div>
                      <div className="text-[11px] text-slate-600">
                        {data?.storeInfo.address}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        Ph: {data?.storeInfo.phone} · ABN: {data?.storeInfo.abn}
                      </div>
                      <div className="text-[10px] font-bold text-blue-700 mt-1">
                        IdealPOS Terminal: {data?.storeInfo.terminal || 'Register 01'}
                      </div>
                    </>
                  )}
                </div>

                {/* Float Entry or Void Warning Header */}
                {selectedTx.isFloatEntry ? (
                  <div className="bg-emerald-50 border-2 border-emerald-500 text-emerald-950 p-3 rounded-xl space-y-1.5 shadow-xs">
                    <div className="flex items-center justify-between flex-wrap gap-1">
                      <span className="font-extrabold text-xs uppercase tracking-wider flex items-center gap-1.5 text-emerald-800">
                        <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                        START OF SHIFT FLOAT ENTRY
                      </span>
                      <span className="px-2 py-0.5 bg-emerald-200 text-emerald-900 rounded font-black text-[10px]">
                        DRAWER OPENING CASH
                      </span>
                    </div>
                    <p className="text-[11px] text-emerald-800 leading-snug font-sans">
                      Official staff float entry recorded at register to establish opening drawer float.
                      This exact date and time (<strong>{formatTxDateTime(selectedTx)}</strong>) anchors the staff shift start in POS &amp; Clerk Performance reports to eliminate date mismatches.
                    </p>
                  </div>
                ) : selectedTx.isVoidSale ? (
                  <div className="bg-rose-50 border border-rose-300 text-rose-800 p-2.5 rounded text-center font-bold text-xs uppercase tracking-wider">
                    *** TRANSACTION VOIDED ***
                  </div>
                ) : null}

                {/* Receipt Details with Clerk Name */}
                <div className="space-y-1 text-[11px] border-b border-dashed border-slate-300 pb-3">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Receipt #:</span>
                    <span className="font-extrabold text-slate-900">{selectedTx.receiptNo}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Date/Time:</span>
                    <span>{formatTxDateTime(selectedTx)}</span>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span className="text-slate-500">Clerk / Cashier:</span>
                    <span className="text-blue-800 font-extrabold flex items-center gap-1">
                      <UserCheck className="w-3 h-3 text-blue-600" />
                      {selectedTx.clerkName || selectedTx.cashier}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Terminal:</span>
                    <span>{data?.storeInfo.terminal || 'Register 01'}</span>
                  </div>
                  {selectedTx.isFloatEntry && (
                    <div className="flex justify-between text-emerald-800 font-bold">
                      <span>Operation:</span>
                      <span>Shift Start Float In (Type 15)</span>
                    </div>
                  )}
                </div>

                {/* Purchased Items or Float Entry Breakdown */}
                <div className="space-y-2 border-b border-dashed border-slate-300 pb-3">
                  {selectedTx.isFloatEntry ? (
                    <div className="space-y-2">
                      <div className="font-bold text-[11px] text-emerald-800 uppercase tracking-wider flex items-center justify-between">
                        <span>Shift Float Entry Details</span>
                        <span className="text-[10px] text-emerald-600 font-bold uppercase">Opening Cash</span>
                      </div>
                      <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-200 space-y-2">
                        <div className="flex justify-between font-extrabold text-xs text-slate-900">
                          <span>REGISTER OPENING FLOAT</span>
                          <span className="text-emerald-700 font-mono text-sm">${selectedTx.total.toFixed(2)}</span>
                        </div>
                        <div className="text-[10px] text-slate-600 space-y-1">
                          <div className="flex justify-between">
                            <span>Transaction Type:</span>
                            <span className="font-bold text-slate-800">Float Entry (FE / Type ID 15)</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Cash Drawer In:</span>
                            <span className="font-bold text-emerald-700 font-mono">+${selectedTx.total.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Opening Shift Anchor:</span>
                            <span className="font-bold text-slate-800">{formatTxDateTime(selectedTx)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="font-bold text-[11px] text-slate-800 uppercase tracking-wider">
                        Purchased Products
                      </div>
                      {selectedTx.items.map((item, idx) => (
                        <div
                          key={idx}
                          className={`space-y-0.5 p-1.5 rounded ${
                            item.isVoided ? 'bg-rose-50/50 border border-rose-100' : ''
                          }`}
                        >
                          <div className="flex justify-between font-bold text-xs text-slate-900">
                            <span className={`truncate pr-2 ${item.isVoided ? 'line-through text-rose-700' : ''}`}>
                              {item.description}
                              {item.isVoided && (
                                <span className="ml-1.5 text-[9px] font-extrabold px-1.5 py-0.2 bg-rose-200 text-rose-800 rounded uppercase no-underline inline-block">
                                  VOID
                                </span>
                              )}
                            </span>
                            <span className={item.isVoided ? 'text-rose-600 line-through' : ''}>
                              ${item.isVoided ? '0.00' : item.lineTotal.toFixed(2)}
                            </span>
                          </div>

                          <div className="flex justify-between text-[10px] text-slate-500">
                            <span>
                              Code: <strong className="text-slate-700">{item.stockCode}</strong> · {item.qty} x ${item.unitPrice.toFixed(2)}
                            </span>
                            {item.discount > 0 && !isMiscProduct(item.stockCode, item.barcode, item.description) && (
                              <span className="text-purple-700 font-bold">
                                Disc: -${item.discount.toFixed(2)}
                              </span>
                            )}
                          </div>

                          {item.promotionName && (
                            <div className="text-[10px] text-purple-700 font-semibold flex items-center gap-1 pt-0.5">
                              <Sparkles className="w-3 h-3 text-purple-500" />
                              <span>Promo: {item.promotionName}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </>
                  )}
                </div>

                {/* Financial Totals with Promotions & GST breakdown */}
                <div className="space-y-1.5 pt-1">
                  {!selectedTx.isFloatEntry && (
                    <>
                      <div className="flex justify-between text-[11px] text-slate-600">
                        <span>Subtotal (ex GST):</span>
                        <span>${selectedTx.subtotal.toFixed(2)}</span>
                      </div>

                      {selectedTx.discount > 0 && (
                        <div className="flex justify-between text-[11px] text-purple-700 font-bold bg-purple-50 px-1.5 py-0.5 rounded">
                          <span className="flex items-center gap-1">
                            <Percent className="w-3 h-3" />
                            Discounts Provided:
                          </span>
                          <span>-${selectedTx.discount.toFixed(2)}</span>
                        </div>
                      )}

                      {selectedTx.appliedPromotions && selectedTx.appliedPromotions.length > 0 && (
                        <div className="bg-blue-50 p-1.5 rounded text-[10px] text-blue-800 space-y-0.5">
                          <div className="font-bold flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-blue-600" />
                            <span>Applied Promotions:</span>
                          </div>
                          <ul className="list-disc pl-4 text-blue-700 font-medium">
                            {selectedTx.appliedPromotions.map((p, pIdx) => (
                              <li key={pIdx}>{p}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className="flex justify-between text-[11px] font-semibold text-slate-700 bg-slate-50 px-1.5 py-0.5 rounded">
                        <span>Includes GST (10%):</span>
                        <span className="font-mono text-slate-900">${selectedTx.gst.toFixed(2)}</span>
                      </div>
                    </>
                  )}

                  <div className="flex justify-between font-black text-base text-slate-900 pt-2 border-t-2 border-slate-900">
                    <span>{selectedTx.isFloatEntry ? 'TOTAL FLOAT AMOUNT:' : 'TOTAL AMOUNT:'}</span>
                    <span className={selectedTx.isFloatEntry ? 'text-emerald-700 font-mono' : selectedTx.isVoidSale ? 'text-rose-600 line-through' : ''}>
                      ${selectedTx.total.toFixed(2)}
                    </span>
                  </div>

                  <div className="flex justify-between text-[11px] text-slate-700 pt-1">
                    <span>Tender Type:</span>
                    <span className="font-extrabold">{selectedTx.isFloatEntry ? 'Float Entry (FE)' : selectedTx.tenderType}</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-600">
                    <span>Amount Tendered:</span>
                    <span>${selectedTx.tendered.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-600">
                    <span>Change Given:</span>
                    <span>${selectedTx.change.toFixed(2)}</span>
                  </div>
                </div>

                {/* Branch Default Footer */}
                <div className="text-center text-[10px] text-slate-500 pt-3 border-t border-dashed border-slate-300 whitespace-pre-line leading-relaxed">
                  {data?.storeInfo.receiptFooter || '*** THANK YOU FOR YOUR CUSTOM ***\nKeep receipt for returns or exchanges within 14 days.'}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-end">
              <button
                onClick={closeReceiptModal}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Close Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
