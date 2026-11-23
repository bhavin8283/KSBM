import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  CloudDownload,
  CloudUpload,
  Copy,
  Database,
  FileJson,
  Info,
  Plus,
  RefreshCw,
  Upload,
} from 'lucide-react';
import {
  ATMModuleSettings,
  ATMModuleState,
  KSBMBusinessConfig,
} from '../types';
import { formatCurrencyAUD } from '../utils/denominations';
import {
  exportFullBackupJSON,
  formatDateTimeAU,
  parseBackupJson,
  ParsedBackupResult,
} from '../utils/storage';
import {
  fetchLatestBackupFromWebhook,
  GOOGLE_APPS_SCRIPT_TEMPLATE,
} from '../utils/webhook';

interface ModuleConfigViewProps {
  state: ATMModuleState;
  settings: ATMModuleSettings;
  businessConfig?: KSBMBusinessConfig;
  onUpdateSettings: (next: ATMModuleSettings) => void;
  onTestWebhook: (url: string, sheetId?: string) => Promise<{ ok: boolean; text: string }>;
  onSyncAllHistory: (url: string, sheetId?: string) => Promise<{ ok: boolean; text: string }>;
  onPullFromCloud: (url?: string) => Promise<void>;
  onLoadSampleData: () => void;
  onResetAllData: () => void;
  onRestoreState: (restored: ATMModuleState, sourceLabel: string) => void;
}

export const ModuleConfigView: React.FC<ModuleConfigViewProps> = ({
  state,
  settings,
  businessConfig,
  onUpdateSettings,
  onTestWebhook,
  onSyncAllHistory,
  onPullFromCloud,
  onLoadSampleData,
  onResetAllData,
  onRestoreState,
}) => {
  const [minTotal, setMinTotal] = useState<string>(String(settings.thresholds.minTotalCash));
  const [min20, setMin20] = useState<string>(String(settings.thresholds.minNotes20));
  const [min50, setMin50] = useState<string>(String(settings.thresholds.minNotes50));

  const [webhookUrl, setWebhookUrl] = useState<string>(settings.webhookUrl);
  const [spreadsheetId, setSpreadsheetId] = useState<string>(settings.spreadsheetId ?? '');
  const [syncDiagnostic, setSyncDiagnostic] = useState<{ ok: boolean; text: string } | null>(null);
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [isSyncingAll, setIsSyncingAll] = useState<boolean>(false);
  const [isPullingCloud, setIsPullingCloud] = useState<boolean>(false);
  const [isFetchingDrive, setIsFetchingDrive] = useState<boolean>(false);
  const [showScriptHelp, setShowScriptHelp] = useState<boolean>(false);
  const [copiedScript, setCopiedScript] = useState<boolean>(false);
  const [confirmReset, setConfirmReset] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingRestore, setPendingRestore] = useState<ParsedBackupResult | null>(null);
  const [restoreError, setRestoreError] = useState<string>('');

  const thresholdsManagedByHost = Boolean(
    businessConfig?.atmThresholds &&
      (typeof businessConfig.atmThresholds.minTotalCash === 'number' ||
        typeof businessConfig.atmThresholds.minNotes20 === 'number' ||
        typeof businessConfig.atmThresholds.minNotes50 === 'number')
  );
  const googleSyncManagedByHost = Boolean(
    businessConfig?.googleSync?.webhookUrl?.trim()
  );

  useEffect(() => {
    setMinTotal(String(settings.thresholds.minTotalCash));
    setMin20(String(settings.thresholds.minNotes20));
    setMin50(String(settings.thresholds.minNotes50));
    setWebhookUrl(settings.webhookUrl);
    setSpreadsheetId(settings.spreadsheetId ?? '');
  }, [settings]);

  const handleSaveThresholds = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings({
      ...settings,
      thresholds: {
        minTotalCash: Math.max(0, Math.floor(Number(minTotal) || 0)),
        minNotes20: Math.max(0, Math.floor(Number(min20) || 0)),
        minNotes50: Math.max(0, Math.floor(Number(min50) || 0)),
      },
    });
  };

  const handleSaveWebhook = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings({
      ...settings,
      webhookUrl: webhookUrl.trim(),
      spreadsheetId: spreadsheetId.trim(),
    });
  };

  const handleToggleAutoSync = () => {
    onUpdateSettings({
      ...settings,
      webhookUrl: webhookUrl.trim(),
      spreadsheetId: spreadsheetId.trim(),
      autoSyncEnabled: !settings.autoSyncEnabled,
    });
  };

  const handleToggleAutoPull = () => {
    onUpdateSettings({
      ...settings,
      webhookUrl: webhookUrl.trim(),
      spreadsheetId: spreadsheetId.trim(),
      autoPullOnOpen: !settings.autoPullOnOpen,
    });
  };

  const handlePullCloudClick = async () => {
    const cleanUrl = webhookUrl.trim();
    onUpdateSettings({
      ...settings,
      webhookUrl: cleanUrl,
      spreadsheetId: spreadsheetId.trim(),
    });
    setIsPullingCloud(true);
    try {
      await onPullFromCloud(cleanUrl);
    } finally {
      setIsPullingCloud(false);
    }
  };

  const handleTestClick = async () => {
    onUpdateSettings({
      ...settings,
      webhookUrl: webhookUrl.trim(),
      spreadsheetId: spreadsheetId.trim(),
    });
    setIsTesting(true);
    setSyncDiagnostic(null);
    try {
      const msg = await onTestWebhook(webhookUrl.trim(), spreadsheetId.trim());
      if (msg) setSyncDiagnostic(msg);
    } finally {
      setIsTesting(false);
    }
  };

  const handleSyncAllClick = async () => {
    onUpdateSettings({
      ...settings,
      webhookUrl: webhookUrl.trim(),
      spreadsheetId: spreadsheetId.trim(),
    });
    setIsSyncingAll(true);
    setSyncDiagnostic(null);
    try {
      const msg = await onSyncAllHistory(webhookUrl.trim(), spreadsheetId.trim());
      if (msg) setSyncDiagnostic(msg);
    } finally {
      setIsSyncingAll(false);
    }
  };

  const handleRestoreFromDriveClick = async () => {
    const cleanUrl = webhookUrl.trim();
    onUpdateSettings({
      ...settings,
      webhookUrl: cleanUrl,
      spreadsheetId: spreadsheetId.trim(),
    });
    setIsFetchingDrive(true);
    setRestoreError('');
    setPendingRestore(null);
    try {
      const res = await fetchLatestBackupFromWebhook(cleanUrl);
      if (!res.ok || !res.rawJson) {
        setRestoreError(res.message);
        return;
      }
      const parsed = parseBackupJson(res.rawJson, settings);
      if (!parsed.ok) {
        setRestoreError(parsed.error || 'Backup retrieved from Drive was invalid.');
      } else {
        setPendingRestore(parsed);
      }
    } finally {
      setIsFetchingDrive(false);
    }
  };

  const handleBackupFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = parseBackupJson(text, settings);
      if (!parsed.ok) {
        setRestoreError(parsed.error || 'Invalid backup JSON file.');
        setPendingRestore(null);
      } else {
        setRestoreError('');
        setPendingRestore(parsed);
      }
    } catch {
      setRestoreError('Failed to read the selected JSON file.');
      setPendingRestore(null);
    }
  };

  const handleCopyScript = async () => {
    try {
      await navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_TEMPLATE);
      setCopiedScript(true);
      setTimeout(() => setCopiedScript(false), 2000);
    } catch {
      // Ignore clipboard failure
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
      {(thresholdsManagedByHost || googleSyncManagedByHost) && (
        <div className="bg-slate-100 border border-slate-200 rounded-xl p-3.5 sm:p-4 flex items-start gap-2.5 text-xs text-slate-700">
          <Info className="w-4 h-4 text-slate-700 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-slate-900">Centralized KSBM Business Config Active</p>
            <p className="mt-0.5">
              Staff accounts, PINs, and permissions are managed in KSBM Admin.{' '}
              {thresholdsManagedByHost && 'Alert thresholds are supplied by businessConfig. '}
              {googleSyncManagedByHost && 'Google Sync endpoint is supplied by businessConfig.'}
            </p>
          </div>
        </div>
      )}

      {/* Low Cash Alert Thresholds */}
      <section className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 space-y-4">
        <div>
          <h2 className="text-sm sm:text-base font-bold text-slate-900">
            Low Cash Alert Thresholds
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            Triggers warning banner when expected balances drop below limits.
          </p>
        </div>

        <form onSubmit={handleSaveThresholds} className="space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
            <div>
              <label
                htmlFor="ksbm-th-total"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Minimum Total Cash ($ AUD)
              </label>
              <input
                id="ksbm-th-total"
                type="number"
                min={0}
                step={100}
                disabled={thresholdsManagedByHost}
                value={minTotal}
                onChange={(e) => setMinTotal(e.target.value)}
                className="w-full min-h-[42px] px-3 py-1.5 rounded-lg border border-slate-300 bg-white disabled:bg-slate-100 disabled:text-slate-600 text-sm font-bold font-mono tabular-nums text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label htmlFor="ksbm-th-20" className="block text-xs font-semibold text-slate-700 mb-1">
                Min $20 Notes
              </label>
              <input
                id="ksbm-th-20"
                type="number"
                min={0}
                step={1}
                disabled={thresholdsManagedByHost}
                value={min20}
                onChange={(e) => setMin20(e.target.value)}
                className="w-full min-h-[42px] px-3 py-1.5 rounded-lg border border-slate-300 bg-white disabled:bg-slate-100 disabled:text-slate-600 text-sm font-bold font-mono tabular-nums text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label htmlFor="ksbm-th-50" className="block text-xs font-semibold text-slate-700 mb-1">
                Min $50 Notes
              </label>
              <input
                id="ksbm-th-50"
                type="number"
                min={0}
                step={1}
                disabled={thresholdsManagedByHost}
                value={min50}
                onChange={(e) => setMin50(e.target.value)}
                className="w-full min-h-[42px] px-3 py-1.5 rounded-lg border border-slate-300 bg-white disabled:bg-slate-100 disabled:text-slate-600 text-sm font-bold font-mono tabular-nums text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
          </div>

          {!thresholdsManagedByHost && (
            <button
              type="submit"
              className="min-h-[42px] px-5 py-2 rounded-lg bg-emerald-700 text-white text-xs sm:text-sm font-semibold hover:bg-emerald-800 transition-colors whitespace-nowrap"
            >
              Save Alert Thresholds
            </button>
          )}
        </form>
      </section>

      {/* Auto Google Drive & Google Sheets Sync */}
      <section className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1.5">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900">
              Auto Google Drive &amp; Google Sheets Sync
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Writes every cash entry into your Google Sheet (<strong>ATM_Ledger</strong> &amp;{' '}
              <strong>Current_Balance</strong>) and saves JSON backups to Google Drive.
            </p>
          </div>
          <span className="text-[11px] sm:text-xs font-mono tabular-nums text-slate-600 shrink-0">
            {settings.lastSyncedAt
              ? `Last synced: ${formatDateTimeAU(settings.lastSyncedAt)}`
              : 'Never synced'}
          </span>
        </div>

        <form onSubmit={handleSaveWebhook} className="space-y-3.5">
          <div>
            <label
              htmlFor="ksbm-webhook-url"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Google Apps Script Webhook URL
            </label>
            <div className="flex gap-2">
              <input
                id="ksbm-webhook-url"
                type="url"
                disabled={googleSyncManagedByHost}
                placeholder="https://script.google.com/macros/s/.../exec"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                className="flex-1 min-w-0 min-h-[42px] px-3 py-1.5 rounded-lg border border-slate-300 bg-white disabled:bg-slate-100 disabled:text-slate-600 text-xs sm:text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
              {!googleSyncManagedByHost && (
                <button
                  type="submit"
                  className="min-h-[42px] px-3.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-900 text-xs sm:text-sm font-semibold hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
                >
                  Save
                </button>
              )}
            </div>
          </div>

          <div>
            <label
              htmlFor="ksbm-sheet-id"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Google Sheet URL or ID <span className="font-normal text-slate-500">(Recommended)</span>
            </label>
            <input
              id="ksbm-sheet-id"
              type="text"
              disabled={googleSyncManagedByHost}
              placeholder="Paste your Google Sheet link (https://docs.google.com/spreadsheets/d/...)"
              value={spreadsheetId}
              onChange={(e) => setSpreadsheetId(e.target.value)}
              className="w-full min-h-[42px] px-3 py-1.5 rounded-lg border border-slate-300 bg-white disabled:bg-slate-100 disabled:text-slate-600 text-xs sm:text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          {/* Auto-sync Toggle */}
          <div className="flex items-center justify-between gap-3 py-2 border-y border-slate-100">
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-semibold text-slate-900">
                Auto-sync every entry to Google Sheets &amp; Drive
              </p>
              <p className="text-[11px] sm:text-xs text-slate-600">
                Appends to Google Sheet and updates latest cloud snapshot on every entry
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.autoSyncEnabled}
              onClick={handleToggleAutoSync}
              className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${
                settings.autoSyncEnabled ? 'bg-emerald-700' : 'bg-slate-300'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform ${
                  settings.autoSyncEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Multi-device Auto-pull on Open Toggle */}
          <div className="flex items-center justify-between gap-3 pb-2 border-b border-slate-100">
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-semibold text-slate-900">
                Auto-sync from Cloud on module open
              </p>
              <p className="text-[11px] sm:text-xs text-slate-600">
                Checks Google Drive on mount and pulls newer entries logged on other devices
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={Boolean(settings.autoPullOnOpen)}
              onClick={handleToggleAutoPull}
              className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${
                settings.autoPullOnOpen ? 'bg-emerald-700' : 'bg-slate-300'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform ${
                  settings.autoPullOnOpen ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2.5">
            <button
              type="button"
              disabled={isTesting || !webhookUrl.trim()}
              onClick={handleTestClick}
              className="min-h-[42px] px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 text-xs sm:text-sm font-semibold hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${isTesting ? 'animate-spin' : ''}`} />
              <span>{isTesting ? 'Testing...' : 'Test Connection'}</span>
            </button>

            <button
              type="button"
              disabled={isSyncingAll || !webhookUrl.trim()}
              onClick={handleSyncAllClick}
              className="min-h-[42px] px-3 py-2 rounded-lg bg-emerald-700 text-white text-xs sm:text-sm font-semibold hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              <CloudUpload className="w-3.5 h-3.5 shrink-0" />
              <span>{isSyncingAll ? 'Syncing...' : 'Sync All History'}</span>
            </button>

            <button
              type="button"
              disabled={isPullingCloud || !webhookUrl.trim()}
              onClick={handlePullCloudClick}
              className="min-h-[42px] px-3 py-2 rounded-lg bg-slate-900 text-white text-xs sm:text-sm font-semibold hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${isPullingCloud ? 'animate-spin' : ''}`} />
              <span>{isPullingCloud ? 'Pulling...' : 'Pull Latest'}</span>
            </button>

            <button
              type="button"
              disabled={isFetchingDrive || !webhookUrl.trim()}
              onClick={handleRestoreFromDriveClick}
              className="min-h-[42px] px-3 py-2 rounded-lg border border-emerald-700 bg-emerald-50 text-emerald-900 text-xs sm:text-sm font-semibold hover:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              <CloudDownload className="w-3.5 h-3.5 shrink-0" />
              <span>{isFetchingDrive ? 'Fetching...' : 'Preview Drive Restore'}</span>
            </button>
          </div>

          {syncDiagnostic && (
            <div
              role="status"
              className={`rounded-lg border px-3.5 py-2.5 text-xs font-medium ${
                syncDiagnostic.ok
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-red-50 border-red-200 text-red-900'
              }`}
            >
              {syncDiagnostic.text}
            </div>
          )}
        </form>

        {/* Collapsible Google Apps Script Reference */}
        <div className="border-t border-slate-100 pt-2.5">
          <button
            type="button"
            onClick={() => setShowScriptHelp((prev) => !prev)}
            className="text-xs font-semibold text-slate-700 hover:text-slate-900 flex items-center gap-1.5"
          >
            {showScriptHelp ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            <span>View Updated Google Apps Script (Code.gs)</span>
          </button>

          {showScriptHelp && (
            <div className="mt-3 space-y-2.5">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-950">
                Paste into <strong>script.google.com</strong> then go to{' '}
                <strong>Deploy → Manage deployments → Edit → New version → Deploy</strong>.
              </div>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-slate-600">
                  Deploy as Web App (Execute as: Me, Access: Anyone).
                </p>
                <button
                  type="button"
                  onClick={handleCopyScript}
                  className="px-3 py-1.5 rounded-md border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  {copiedScript ? (
                    <Check className="w-3.5 h-3.5 text-emerald-700" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{copiedScript ? 'Copied' : 'Copy Code'}</span>
                </button>
              </div>
              <pre className="p-3.5 rounded-lg bg-slate-900 text-slate-100 text-[11px] sm:text-xs font-mono overflow-x-auto leading-relaxed">
                {GOOGLE_APPS_SCRIPT_TEMPLATE}
              </pre>
            </div>
          )}
        </div>
      </section>

      {/* Backup, Restore & Local Data Management */}
      <section className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 space-y-4">
        <div>
          <h2 className="text-sm sm:text-base font-bold text-slate-900">
            Backup, Restore &amp; Data Management
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            Restore from any downloaded JSON backup or Google Drive backup file (
            <code className="font-mono">kwik-stop-atm-backup-*.json</code>).
          </p>
        </div>

        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => exportFullBackupJSON(state)}
            className="min-h-[42px] px-3 sm:px-4 py-2 rounded-lg bg-slate-900 text-white text-xs sm:text-sm font-semibold hover:bg-slate-800 flex items-center justify-center gap-1.5 whitespace-nowrap"
          >
            <FileJson className="w-4 h-4 shrink-0" />
            <span>Download Backup</span>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="min-h-[42px] px-3 sm:px-4 py-2 rounded-lg border border-emerald-700 bg-emerald-50 text-emerald-900 text-xs sm:text-sm font-semibold hover:bg-emerald-100 flex items-center justify-center gap-1.5 whitespace-nowrap"
          >
            <Upload className="w-4 h-4 shrink-0" />
            <span>Restore JSON File</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleBackupFileSelected}
            className="hidden"
          />

          <button
            type="button"
            onClick={onLoadSampleData}
            className="min-h-[42px] px-3 sm:px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs sm:text-sm font-semibold hover:bg-slate-50 flex items-center justify-center gap-1.5 whitespace-nowrap"
          >
            <Database className="w-4 h-4 shrink-0" />
            <span>Sample Data</span>
          </button>

          {!confirmReset ? (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="min-h-[42px] px-3 sm:px-4 py-2 rounded-lg border border-red-300 bg-white text-red-700 text-xs sm:text-sm font-semibold hover:bg-red-50 flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              <Plus className="w-4 h-4 rotate-45 shrink-0" />
              <span>Reset All Data</span>
            </button>
          ) : (
            <div className="col-span-2 flex flex-wrap items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <span className="text-xs font-semibold text-red-900">
                Clear all balances &amp; history?
              </span>
              <button
                type="button"
                onClick={() => {
                  onResetAllData();
                  setConfirmReset(false);
                }}
                className="px-3 py-1.5 rounded-md bg-red-700 text-white text-xs font-bold hover:bg-red-800"
              >
                Confirm Reset
              </button>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="px-3 py-1.5 rounded-md border border-slate-300 bg-white text-xs font-semibold text-slate-700"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        {restoreError && (
          <p
            role="alert"
            className="text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5"
          >
            {restoreError}
          </p>
        )}

        {pendingRestore?.ok && pendingRestore.state && pendingRestore.meta && (
          <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-4 space-y-3">
            <div>
              <p className="text-xs sm:text-sm font-bold text-emerald-950">
                Restore Preview · {pendingRestore.meta.sourceLabel}
              </p>
              <p className="text-xs text-emerald-900 font-mono tabular-nums mt-1">
                {pendingRestore.meta.transactionCount} entries · Expected Balance{' '}
                {formatCurrencyAUD(pendingRestore.meta.expectedTotalAUD)} (
                {pendingRestore.meta.expectedNotes20}×$20, {pendingRestore.meta.expectedNotes50}×$50)
                {pendingRestore.meta.exportedAt
                  ? ` · Saved ${formatDateTimeAU(pendingRestore.meta.exportedAt)}`
                  : ''}
              </p>
              <p className="text-[11px] text-emerald-800 mt-1">
                Restoring replaces current local balances and transaction history with this backup.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingRestore(null)}
                className="min-h-[38px] px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onRestoreState(pendingRestore.state!, pendingRestore.meta!.sourceLabel);
                  setPendingRestore(null);
                }}
                className="min-h-[38px] px-4 py-1.5 rounded-lg bg-emerald-700 text-white text-xs font-bold hover:bg-emerald-800"
              >
                Confirm &amp; Restore Backup
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
