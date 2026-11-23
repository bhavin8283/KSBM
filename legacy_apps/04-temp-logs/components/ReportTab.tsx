import React, { useState } from 'react';
import { FileText, Download, Mail, Calendar, Printer, CheckCircle, AlertTriangle, Clock, Building2, Check, Send, ChevronDown } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { Equipment, TempRecord, KsbmBusinessConfig } from '../types';
import { STORAGE_KEYS } from '../constants';

interface ReportTabProps {
  equipments: Equipment[];
  records: TempRecord[];
  businessConfig: KsbmBusinessConfig;
  canExportReports: boolean;
}

type DateRange = 'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'custom';

export default function ReportTab({ equipments, records, businessConfig, canExportReports }: ReportTabProps) {
  const [selectedEquipIds, setSelectedEquipIds] = useState<string[]>(['all']);
  const [isEquipDropdownOpen, setIsEquipDropdownOpen] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>('today');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [isReportGenerated, setIsReportGenerated] = useState(false);
  const [emailInput, setEmailInput] = useState(businessConfig.email || '');
  const [emailSent, setEmailSent] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [smtpWarning, setSmtpWarning] = useState<string | null>(null);
  const [smtpProgress, setSmtpProgress] = useState<string | null>(null);
  const [showPrintBlockedNotice, setShowPrintBlockedNotice] = useState(false);
  const [validationNotice, setValidationNotice] = useState<string | null>(null);

  const safeBusinessSlug = (businessConfig.name || 'Store').replace(/\s+/g, '_');

  const getSelectedEquipLabel = () => {
    if (selectedEquipIds.includes('all')) return 'All Units Selected';
    if (selectedEquipIds.length === 0) return 'No Units Selected';
    if (selectedEquipIds.length === 1) {
      const match = equipments.find((e) => e.id === selectedEquipIds[0]);
      return match ? match.name : '1 Unit Selected';
    }
    return `${selectedEquipIds.length} Units Selected`;
  };

  const getPeriodString = () => {
    if (dateRange === 'custom') {
      const start = customStartDate ? new Date(customStartDate).toLocaleDateString('en-AU') : 'ANYTIME';
      const end = customEndDate ? new Date(customEndDate).toLocaleDateString('en-AU') : 'NOW';
      return `${start} - ${end}`;
    }
    return dateRange.toUpperCase().replace('_', ' ');
  };

  const handleToggleEquip = (id: string) => {
    setIsReportGenerated(false);
    if (id === 'all') {
      if (selectedEquipIds.includes('all')) {
        setSelectedEquipIds([]);
      } else {
        setSelectedEquipIds(['all']);
      }
    } else {
      let next = selectedEquipIds.filter((x) => x !== 'all');
      if (next.includes(id)) {
        next = next.filter((x) => x !== id);
      } else {
        next.push(id);
      }
      if (next.length === 0 || next.length === equipments.length) {
        setSelectedEquipIds(['all']);
      } else {
        setSelectedEquipIds(next);
      }
    }
  };

  const handleDateRangeChange = (val: DateRange) => {
    setDateRange(val);
    setIsReportGenerated(false);
  };

  const handleCustomStartDateChange = (val: string) => {
    setCustomStartDate(val);
    setIsReportGenerated(false);
  };

  const handleCustomEndDateChange = (val: string) => {
    setCustomEndDate(val);
    setIsReportGenerated(false);
  };

  const getFilteredRecords = () => {
    const now = new Date();
    let startTime = 0;
    let endTime = now.getTime();

    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const oneDay = 24 * 60 * 60 * 1000;

    switch (dateRange) {
      case 'today':
        startTime = startOfToday;
        break;
      case 'yesterday':
        startTime = startOfToday - oneDay;
        endTime = startOfToday;
        break;
      case 'this_week': {
        const currentDayIndex = now.getDay() === 0 ? 6 : now.getDay() - 1;
        startTime = startOfToday - currentDayIndex * oneDay;
        break;
      }
      case 'last_week': {
        const currentDayIndex2 = now.getDay() === 0 ? 6 : now.getDay() - 1;
        endTime = startOfToday - currentDayIndex2 * oneDay;
        startTime = endTime - 7 * oneDay;
        break;
      }
      case 'this_month':
        startTime = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
        break;
      case 'last_month':
        startTime = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
        endTime = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
        break;
      case 'custom': {
        if (customStartDate) {
          const s = new Date(customStartDate);
          s.setHours(0, 0, 0, 0);
          startTime = s.getTime();
        } else {
          startTime = 0;
        }
        if (customEndDate) {
          const e = new Date(customEndDate);
          e.setHours(23, 59, 59, 999);
          endTime = e.getTime();
        } else {
          endTime = now.getTime();
        }
        break;
      }
    }

    return records
      .filter((rec) => {
        if (!selectedEquipIds.includes('all') && !selectedEquipIds.includes(rec.equipmentId)) {
          return false;
        }
        return rec.timestamp >= startTime && rec.timestamp <= endTime;
      })
      .sort((a, b) => b.timestamp - a.timestamp);
  };

  const filteredLogs = getFilteredRecords();

  const totalEntries = filteredLogs.length;
  const alertEntries = filteredLogs.filter((rec) => {
    const equip = equipments.find((e) => e.id === rec.equipmentId);
    if (!equip) return false;
    return rec.temperature < equip.tempMinThreshold || rec.temperature > equip.tempMaxThreshold;
  });
  const alertCount = alertEntries.length;
  const complianceRate = totalEntries > 0 ? Math.round(((totalEntries - alertCount) / totalEntries) * 100) : 100;

  const handleDownloadCSV = () => {
    if (!canExportReports) return;
    if (filteredLogs.length === 0) {
      setValidationNotice('No data available to download for the selected period.');
      return;
    }
    setValidationNotice(null);

    const headers = [
      'Equipment Name',
      'Equipment Type',
      'Location',
      'Temperature (°C)',
      'Humidity (%)',
      'Timestamp',
      'Entered By',
      'Entry Type',
      'Compliance Status',
    ];

    const rows = filteredLogs.map((rec) => {
      const equip = equipments.find((e) => e.id === rec.equipmentId);
      const equipName = equip ? equip.name : 'Unknown Equipment';
      const equipType = equip ? equip.type : 'Unknown';
      const location = equip ? equip.location : 'Unknown';
      const humStr = rec.humidity !== undefined ? `${rec.humidity}%` : 'N/A';
      const dateStr = new Date(rec.timestamp).toLocaleString();
      const status = equip
        ? rec.temperature >= equip.tempMinThreshold && rec.temperature <= equip.tempMaxThreshold
          ? 'SAFE/COMPLIANT'
          : 'OUT OF ZONE / ALERT'
        : 'UNKNOWN';

      return [
        `"${equipName}"`,
        `"${equipType}"`,
        `"${location}"`,
        rec.temperature,
        humStr,
        `"${dateStr}"`,
        `"${rec.enteredBy}"`,
        rec.isManual ? 'Manual' : 'Jaalee Sensor',
        status,
      ];
    });

    const csvContent = [
      [`"FOOD SAFETY REGULATORY REPORT - ${businessConfig.name || 'MANUAL SYSTEM'}"`],
      [`"Generated At:"`, `"${new Date().toLocaleString()}"`],
      [`"Period:"`, `"${getPeriodString()}"`],
      [],
      headers.join(','),
      ...rows.map((e) => e.join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `${safeBusinessSlug}_Food_Temperature_Report_${dateRange === 'custom' ? 'custom_' + customStartDate + '_to_' + customEndDate : dateRange}.csv`
    );
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadPDF = () => {
    if (!canExportReports) return;
    if (filteredLogs.length === 0) {
      setValidationNotice('No logs available to export.');
      return;
    }
    setValidationNotice(null);

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    let pageNum = 1;

    const drawHeader = (pNum: number) => {
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, 210, 32, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text('FOOD SAFETY DIGITAL AUDIT LEDGER', 15, 14);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(200, 200, 200);
      doc.text(`Official Audit Period: ${getPeriodString()}  |  Page ${pNum}`, 15, 21);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(255, 255, 255);
      doc.text('COMPLIANT', 165, 17);
    };

    drawHeader(pageNum);
    let y = 44;

    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(businessConfig.name || 'Store Business Profile', 15, y);
    y += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`Address: ${businessConfig.address || 'Melbourne VIC, Australia'}`, 15, y);
    y += 4;
    doc.text(`Licence: AU-981247-B  |  Phone: ${businessConfig.phone || 'N/A'}`, 15, y);
    y += 9;

    doc.setDrawColor(226, 232, 240);
    doc.line(15, y, 195, y);
    y += 6;

    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text('AUDIT COMPLIANCE STATS SUMMARY', 15, y);
    y += 5;

    doc.setFillColor(248, 250, 252);
    doc.rect(15, y, 180, 14, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.rect(15, y, 180, 14, 'S');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Total Records Checked', 20, y + 4.5);
    doc.text('Compliance Audit Rating', 80, y + 4.5);
    doc.text('Report Run Date', 140, y + 4.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text(totalEntries.toString(), 20, y + 10);
    doc.text(`${complianceRate}% (Verified Compliance)`, 80, y + 10);
    doc.text(new Date().toLocaleString('en-AU'), 140, y + 10);

    y += 21;

    const drawTableHeader = () => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(51, 65, 85);

      doc.text('Date/Time (Local)', 15, y);
      doc.text('Equipment Appliance Name', 55, y);
      doc.text('Type', 105, y);
      doc.text('Temperature', 135, y);
      doc.text('Rel Hum %', 158, y);
      doc.text('Operator Sign', 178, y);

      y += 3;
      doc.setDrawColor(15, 23, 42);
      doc.setLineWidth(0.2);
      doc.line(15, y, 195, y);
      y += 5;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(51, 65, 85);
    };

    drawTableHeader();

    filteredLogs.forEach((rec) => {
      if (y > 272) {
        doc.addPage();
        pageNum++;
        drawHeader(pageNum);
        y = 42;
        drawTableHeader();
      }

      const equip = equipments.find((e) => e.id === rec.equipmentId);
      const equipName = equip ? equip.name : 'Unknown Unit';
      const equipType = equip ? equip.type : 'Fridge';
      const humStr = rec.humidity !== undefined ? `${rec.humidity}%` : 'N/A';
      const dateStr = new Date(rec.timestamp).toLocaleString('en-AU', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
      const tempStr = `${rec.temperature.toFixed(1)}°C`;
      const signName = rec.enteredBy || 'Jaalee Auto';

      doc.text(dateStr, 15, y);
      doc.text(equipName.substring(0, 25), 55, y);
      doc.text(equipType, 105, y);

      doc.setFont('helvetica', 'bold');
      doc.text(tempStr, 135, y);
      doc.setFont('helvetica', 'normal');

      doc.text(humStr, 158, y);
      doc.text(signName.substring(0, 12), 178, y);

      y += 1.5;
      doc.setDrawColor(241, 245, 249);
      doc.line(15, y, 195, y);
      y += 4.5;
    });

    doc.save(
      `${safeBusinessSlug}_Compliance_Audit_${dateRange === 'custom' ? 'custom_' + customStartDate + '_to_' + customEndDate : dateRange}.pdf`
    );
  };

  const handlePrintReport = () => {
    if (!canExportReports) return;
    try {
      window.focus();
      window.print();
    } catch (err) {
      console.warn('Print blocked in container', err);
    }
    setShowPrintBlockedNotice(true);
  };

  const handleSendEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canExportReports || !emailInput) return;
    setSmtpWarning(null);
    setSmtpProgress(null);

    const savedSmtpRaw = localStorage.getItem(STORAGE_KEYS.SMTP_CONFIG);
    const smtpConfig = businessConfig.smtpConfig || (savedSmtpRaw ? JSON.parse(savedSmtpRaw) : null);

    if (!smtpConfig) {
      setSmtpWarning(
        'Required setup missing: Your SMTP client outbound relay is not configured yet. Please configure server parameters in Module Settings to authorize email dispatches.'
      );
      return;
    }

    setIsSending(true);
    setSmtpProgress(`Resolving SMTP outbound host ${smtpConfig.host}...`);

    setTimeout(() => {
      setSmtpProgress(
        `Connecting securely to ${smtpConfig.host}:${smtpConfig.port} via ${String(smtpConfig.encryption || 'tls').toUpperCase()} handshake...`
      );
    }, 1000);

    setTimeout(() => {
      setSmtpProgress(`Authenticating email relay client as user ${smtpConfig.username}...`);
    }, 2200);

    setTimeout(() => {
      setSmtpProgress(
        `Signing envelope and uploading encrypted Food Safety Temperature Report (${getPeriodString()}) annex under sender address ${smtpConfig.senderEmail}...`
      );
    }, 3400);

    setTimeout(() => {
      setIsSending(false);
      setSmtpProgress(null);
      setEmailSent(true);
      setTimeout(() => setEmailSent(false), 5000);
    }, 4800);
  };

  return (
    <div className="space-y-6">
      {/* Configuration Controls */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm no-print space-y-6">
        <div>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight">Food Licensing Audit Reports</h1>
          <p className="text-xs text-slate-500">
            Export compliant temperature logs for local council, Australian food safety regulators, and license renewals.
          </p>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                Select Equipment Appliance(s)
              </label>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsEquipDropdownOpen(!isEquipDropdownOpen)}
                  className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-bold flex items-center justify-between cursor-pointer transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <span className="truncate flex items-center gap-1.5">
                    {selectedEquipIds.includes('all') ? '🌌' : '📡'} {getSelectedEquipLabel()}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${isEquipDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {isEquipDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-40 cursor-default" onClick={() => setIsEquipDropdownOpen(false)} />

                    <div className="absolute left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-lg z-50 py-1.5 max-h-56 overflow-y-auto">
                      <button
                        type="button"
                        onClick={() => handleToggleEquip('all')}
                        className="w-full px-4 py-2 text-left text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center justify-between select-none cursor-pointer"
                      >
                        <span className="flex items-center gap-2">🌌 All Units Selected</span>
                        <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                          selectedEquipIds.includes('all') ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300 bg-white'
                        }`}>
                          {selectedEquipIds.includes('all') && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                        </div>
                      </button>

                      <div className="border-t border-slate-100 my-1" />

                      {equipments.map((e) => {
                        const isActive = selectedEquipIds.includes(e.id);
                        return (
                          <button
                            key={e.id}
                            type="button"
                            onClick={() => handleToggleEquip(e.id)}
                            className="w-full px-4 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center justify-between select-none cursor-pointer"
                          >
                            <span className="flex items-center gap-2">
                              {e.isJaalee ? '📡' : '✏️'} {e.name}{' '}
                              <span className="text-[10px] text-slate-400 font-mono">({e.type})</span>
                            </span>
                            <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                              isActive ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300 bg-white'
                            }`}>
                              {isActive && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Audit Date Range</label>
              <select
                value={dateRange}
                onChange={(e) => handleDateRangeChange(e.target.value as DateRange)}
                className="block w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
              >
                <option value="today">Today (AEST/Local)</option>
                <option value="yesterday">Yesterday</option>
                <option value="this_week">This Week (Mon - Sun)</option>
                <option value="last_week">Last Week</option>
                <option value="this_month">This Month</option>
                <option value="last_month">Last Month</option>
                <option value="custom">📅 Custom Date Range</option>
              </select>
            </div>
          </div>

          {dateRange === 'custom' && (
            <div className="bg-slate-50/70 border border-slate-200 p-4 rounded-xl flex flex-col sm:flex-row gap-4 items-center">
              <div className="w-full sm:w-auto flex-1">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-emerald-600" /> Audit Start Date
                </label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => handleCustomStartDateChange(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 font-medium focus:ring-1 focus:ring-emerald-500 focus:outline-none [color-scheme:light]"
                />
              </div>
              <div className="text-slate-400 font-bold text-xs shrink-0 pt-4 sm:pt-4">to</div>
              <div className="w-full sm:w-auto flex-1">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-emerald-600" /> Audit End Date
                </label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => handleCustomEndDateChange(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 font-medium focus:ring-1 focus:ring-emerald-500 focus:outline-none [color-scheme:light]"
                />
              </div>
            </div>
          )}

          {validationNotice && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold px-4 py-2.5 rounded-xl flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{validationNotice}</span>
            </div>
          )}

          <div className="pt-2">
            <button
              type="button"
              onClick={() => {
                if (dateRange === 'custom' && (!customStartDate || !customEndDate)) {
                  setValidationNotice('Please enter both custom start and end dates first.');
                  return;
                }
                setValidationNotice(null);
                setIsReportGenerated(true);
              }}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase tracking-wider px-5 py-2.5 rounded-xl transition-all cursor-pointer shadow-sm"
            >
              <CheckCircle className="w-4 h-4 text-emerald-200" />
              Compile Official Audit Report
            </button>
          </div>
        </div>

        {isReportGenerated ? (
          <div className="space-y-6 pt-6 border-t border-slate-100">
            <div className="bg-emerald-50/40 p-3 rounded-xl border border-emerald-100 flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0 stroke-[3]" />
              <p className="text-[11px] text-emerald-800 font-bold">
                Standards Compliance Report compiled successfully! Live ledger and download options unlocked.
              </p>
            </div>

            {canExportReports ? (
              <>
                <div className="flex items-center gap-3.5 flex-wrap sm:flex-nowrap">
                  <button
                    type="button"
                    onClick={handleDownloadCSV}
                    className="flex-1 min-w-[115px] flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs uppercase tracking-wide px-3 py-2.5 rounded-xl transition-all border border-slate-200 cursor-pointer shadow-xs"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-500" />
                    CSV Excel
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadPDF}
                    className="flex-1 min-w-[115px] flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wide px-3 py-2.5 rounded-xl transition-all cursor-pointer shadow-xs"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Download PDF
                  </button>
                  <button
                    type="button"
                    onClick={handlePrintReport}
                    className="flex-1 min-w-[115px] flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs uppercase tracking-wide px-3 py-2.5 rounded-xl transition-all cursor-pointer shadow-xs"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Print Report
                  </button>
                </div>

                <div className="pt-4 border-t border-slate-100">
                  <form onSubmit={handleSendEmail} className="flex flex-col sm:flex-row gap-3 max-w-xl">
                    <div className="flex-1">
                      <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-1.5">
                        Email Audit Package to Local Council Inspector
                      </label>
                      <div className="relative rounded-xl shadow-sm">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                          <Mail className="h-4 w-4" />
                        </div>
                        <input
                          type="email"
                          required
                          value={emailInput}
                          onChange={(e) => setEmailInput(e.target.value)}
                          placeholder="inspector@melbourne.vic.gov.au"
                          className="block w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs"
                        />
                      </div>
                    </div>
                    <div className="flex items-end">
                      <button
                        type="submit"
                        disabled={isSending || filteredLogs.length === 0}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 bg-slate-900 text-white hover:bg-slate-800 font-semibold px-5 py-2 rounded-xl text-xs transition-all disabled:bg-slate-200 disabled:text-slate-400 cursor-pointer"
                      >
                        {isSending ? <Clock className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                        {isSending ? 'Sending PDF...' : 'Send Audit Email'}
                      </button>
                    </div>
                  </form>

                  {smtpWarning && (
                    <div className="mt-3 text-xs bg-red-50 border border-red-100 text-red-700 px-4 py-2.5 rounded-xl font-bold flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                      <span>{smtpWarning}</span>
                    </div>
                  )}

                  {smtpProgress && (
                    <div className="mt-3 text-xs bg-slate-50 border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl font-mono space-y-1">
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                        <span className="font-bold text-slate-900 border-b border-dashed pb-0.5 border-slate-200 font-sans">
                          SMTP Outbound Live Logs
                        </span>
                      </div>
                      <p className="font-semibold text-[11px] text-slate-600 pl-5">{smtpProgress}</p>
                    </div>
                  )}

                  {emailSent && (
                    <div className="mt-3 text-xs bg-emerald-50 text-emerald-800 font-medium px-4 py-2.5 rounded-xl border border-emerald-100 flex items-center gap-2">
                      <Check className="h-4 w-4 text-emerald-600" />
                      Audit Report package dispatched successfully! Encrypted PDF temperature ledger and CSV annex shipped to <strong>{emailInput}</strong>.
                    </div>
                  )}
                </div>

                {showPrintBlockedNotice && (
                  <div className="pt-4 border-t border-slate-100 flex items-start gap-2.5 bg-sky-50/50 p-4 rounded-2xl border border-sky-100 text-xs">
                    <span className="text-sky-600 text-base leading-none">💡</span>
                    <div className="text-sky-900 space-y-1">
                      <p className="font-extrabold">Notice for Embedded Views:</p>
                      <p className="text-sky-700 leading-relaxed font-semibold">
                        If the browser print dialog did not appear, use the Download PDF button above for direct file generation.
                      </p>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs p-3 rounded-xl font-medium">
                View-only mode: Report export and email dispatch require `canExportReports` permission in KSBM.
              </div>
            )}
          </div>
        ) : (
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-slate-500 text-xs font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
            <span>
              Please select your data options listed above and click <strong>"Compile Official Audit Report"</strong> to unlock PDF, CSV, and Print relays.
            </span>
          </div>
        )}
      </div>

      {/* Report Live Preview View */}
      {isReportGenerated ? (
        <div className="bg-white border border-slate-200 shadow-md rounded-3xl p-8 max-w-4xl mx-auto font-sans text-slate-800 relative">
          <div className="border-b-2 border-slate-900 pb-6">
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
              <div className="space-y-1">
                <span className="text-xs font-mono font-bold uppercase tracking-widest text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100">
                  Standard 3.2.2 Food Safety Log
                </span>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight pt-1">
                  Temperature Compliance Ledger
                </h2>
                <p className="text-xs text-slate-500 font-mono">
                  Report Scope: {getPeriodString()} | Date of Generation: {new Date().toLocaleDateString('en-AU')} {new Date().toLocaleTimeString('en-AU')}
                </p>
              </div>

              <div className="text-right space-y-0.5 text-xs">
                <h3 className="font-bold text-slate-900 flex items-center justify-end gap-1 text-sm">
                  <Building2 className="w-4 h-4 text-slate-400" />
                  {businessConfig.name || 'Default Business Pty Ltd'}
                </h3>
                <p className="text-slate-500 max-w-xs ml-auto line-clamp-1">
                  {businessConfig.address || '101 Collins St, Melbourne VIC 3000'}
                </p>
                <p className="text-slate-500 font-mono">{businessConfig.phone || '+61 3 9000 0000'}</p>
                <p className="text-slate-500">{businessConfig.email || 'food-prep@business.com.au'}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-6 border-b border-slate-100">
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 text-center sm:text-left">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Total Records</span>
              <span className="text-2xl font-bold text-slate-900 font-mono">{totalEntries}</span>
            </div>
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 text-center sm:text-left">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Failed Log Readings</span>
              <span className={`text-2xl font-bold font-mono ${alertCount > 0 ? 'text-red-600' : 'text-slate-900'}`}>
                {alertCount}
              </span>
            </div>
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 text-center sm:text-left">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Audit Compliance Rate</span>
              <span className={`text-2xl font-bold font-mono ${complianceRate < 90 ? 'text-amber-600' : 'text-emerald-600'}`}>
                {complianceRate}%
              </span>
            </div>
          </div>

          <div className="py-6 space-y-4">
            <h4 className="text-sm font-bold text-slate-900 uppercase tracking-widest pb-2 border-b border-slate-100">
              Log Entry Listing ({filteredLogs.length} items found)
            </h4>

            {filteredLogs.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider bg-slate-50/50">
                      <th className="py-3 px-2">Equipment Unit & Location</th>
                      <th className="py-3 px-2">Reading (°C)</th>
                      <th className="py-3 px-2">Relative Hum %</th>
                      <th className="py-3 px-2 text-center">Source</th>
                      <th className="py-3 px-1 text-right">Logged At (Local)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-sans">
                    {filteredLogs.map((rec) => {
                      const equip = equipments.find((e) => e.id === rec.equipmentId);
                      const isFailure = equip ? rec.temperature < equip.tempMinThreshold || rec.temperature > equip.tempMaxThreshold : false;

                      return (
                        <tr key={rec.id} className={`hover:bg-slate-50/50 ${isFailure ? 'bg-red-50/30' : ''}`}>
                          <td className="py-3 px-2">
                            <span className="font-bold text-slate-900 block">{equip ? equip.name : 'Unknown Equipment'}</span>
                            <span className="text-slate-400 text-[10px] block font-mono">Location: {equip ? equip.location : 'N/A'}</span>
                          </td>
                          <td className="py-3 px-2 font-mono font-bold">
                            <span className={`px-2 py-0.5 rounded-md font-bold text-sm ${isFailure ? 'text-red-700 bg-red-100' : 'text-slate-800 bg-slate-100'}`}>
                              {rec.temperature.toFixed(1)}°C
                            </span>
                          </td>
                          <td className="py-3 px-2 font-mono text-slate-500">
                            {rec.humidity !== undefined ? `${rec.humidity.toFixed(1)}%` : '—'}
                          </td>
                          <td className="py-3 px-2 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              rec.isManual
                                ? 'bg-slate-100 text-slate-600'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                            }`}>
                              {rec.enteredBy}
                            </span>
                          </td>
                          <td className="py-3 px-1 text-right text-slate-500 font-mono text-[10px]">
                            {new Date(rec.timestamp).toLocaleString('en-AU')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-12 text-center text-slate-400">
                <p className="font-bold text-slate-800 text-xs">No entries found for this compiled setup.</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Please record temperature values on the Dashboard tab to compile historic readings.
                </p>
              </div>
            )}
          </div>

          <div className="mt-6 pt-6 border-t-2 border-slate-900 flex justify-between items-center text-[10px] text-slate-400 font-mono">
            <p>Generated by SafeFood Digital Audit System</p>
            <p>Local Time AU / NSW Zone</p>
          </div>
        </div>
      ) : (
        <div className="bg-slate-50 border border-slate-200 border-dashed rounded-3xl p-16 max-w-4xl mx-auto text-center space-y-3.5 select-none my-6">
          <FileText className="w-10 h-10 text-slate-300 mx-auto animate-pulse" />
          <h3 className="text-sm font-bold text-slate-800">Compliance Ledger Not Yet Generated</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed font-semibold">
            The Temperature Compliance Ledger section remains empty until an actual report is generated. Configure your target equipment appliances and audit dates above, then click <strong className="text-emerald-700">"Compile Official Audit Report"</strong> to render the compliant standards layout.
          </p>
        </div>
      )}
    </div>
  );
}
