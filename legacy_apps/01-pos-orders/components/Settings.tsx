import React, { useEffect, useMemo, useState } from 'react';
import {
  Database,
  Server,
  User,
  Key,
  CheckCircle,
  XCircle,
  Truck,
  Save,
  Plus,
  Trash2,
  Palette,
  Check,
  Sparkles,
  Lock,
  ShieldCheck,
  KeyRound,
  Clock,
  AlertCircle,
  AlertTriangle,
  Terminal,
  ChevronDown,
  ChevronUp,
  RotateCw,
  Users,
  UserPlus,
  Edit2,
  Trash,
  Eye,
  EyeOff,
  ShieldAlert,
  CheckSquare,
  Square,
  X,
  Layers,
  Globe,
  Calendar,
  Store,
} from 'lucide-react';
import { CloudflaredTunnelCard } from './CloudflaredTunnelCard';
import { DepartmentManagementSettings } from './DepartmentManagementSettings';
import { StoreManagementSettings } from './StoreManagementSettings';
import { WEEKDAYS } from '../schemaMap';
import {
  defaultSchedule,
  findConfigForSupplier,
  formatSchedule,
  normalizeSupplierConfigMap,
} from '../supplierConfigUtils';
import type {
  DeliverySchedule,
  Supplier,
  SupplierConfig,
  SupplierConfigMap,
  AppTheme,
  SettingsSubTab,
  DateFormat,
  TimeFormat,
} from '../types';
import { useAppTheme } from '../ThemeContext';
import { useDateTime } from '../DateTimeContext';
import {
  AVAILABLE_DATE_FORMATS,
  AVAILABLE_TIME_FORMATS,
  AVAILABLE_TIMEZONES,
} from '../dateTimeUtils';

type DraftEntry = {
  supplierId: string;
  safetyBufferPct: number;
  schedules: DeliverySchedule[];
};

interface SettingsProps {
  onStatusUpdate: () => void;
  allowedSettings?: SettingsSubTab[];
  userRole?: string;
}

export default function Settings({
  onStatusUpdate,
  allowedSettings = ['stores', 'server', 'departments', 'suppliers', 'appearance', 'regional'],
  userRole = 'admin',
}: SettingsProps) {
  const { theme, setTheme, getThemeClasses } = useAppTheme();
  const themeClasses = getThemeClasses();
  const {
    settings: regionalSettings,
    updateSettings: updateRegionalSettings,
    resetSettings: resetRegionalSettings,
    formatDate: previewFormatDate,
    formatTime: previewFormatTime,
    formatDateTime: previewFormatDateTime,
  } = useDateTime();

  const [activeSubTab, setActiveSubTab] = useState<SettingsSubTab>(() => {
    return allowedSettings[0] || 'server';
  });

  // Ensure activeSubTab is always allowed
  useEffect(() => {
    if (allowedSettings.length > 0 && !allowedSettings.includes(activeSubTab)) {
      setActiveSubTab(allowedSettings[0]);
    }
  }, [allowedSettings]);

  // Server state
  const [server, setServer] = useState('mssql.kwikstop.com.au');
  const [database, setDatabase] = useState('IPSTransaction');
  const [authType, setAuthType] = useState<'sql' | 'windows'>('sql');
  const [domain, setDomain] = useState('');
  const [user, setUser] = useState('kwikorder');
  const [password, setPassword] = useState('Kwik$top4812');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  // Supplier & Live Mode state
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [configs, setConfigs] = useState<SupplierConfigMap>({});
  const [drafts, setDrafts] = useState<DraftEntry[]>([]);
  const [addSupplierId, setAddSupplierId] = useState('');
  const [configSaving, setConfigSaving] = useState(false);
  const [configMessage, setConfigMessage] = useState<{ success: boolean; text: string } | null>(null);
  const [connected, setConnected] = useState(false);
  const [forceLiveMode, setForceLiveMode] = useState(true);
  const [showClearConfirmModal, setShowClearConfirmModal] = useState(false);
  const [actionNotice, setActionNotice] = useState<{ success: boolean; text: string } | null>(null);
  const [isSetupGuideOpen, setIsSetupGuideOpen] = useState(false);
  const [expandedSuppliers, setExpandedSuppliers] = useState<Record<string, boolean>>({});
  const [availableDepartments, setAvailableDepartments] = useState<string[]>([]);
  const [availableStores, setAvailableStores] = useState<Array<{ id: string; name: string; code: string }>>([]);

  const toggleSupplierExpanded = (id: string) => {
    setExpandedSuppliers((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  useEffect(() => {
    void refreshConnectionAndSuppliers();
    void fetchAvailableDepartments();
    void fetchAvailableStores();
  }, []);

  const fetchAvailableStores = async () => {
    try {
      const res = await fetch('/api/stores');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.stores)) {
          setAvailableStores(
            data.stores.map((st: any) => ({
              id: String(st.id),
              name: st.name || `Store #${st.id}`,
              code: st.code || '',
            }))
          );
        }
      }
    } catch (e) {
      console.warn('Notice: Failed to load stores in Settings', e);
    }
  };

  const fetchAvailableDepartments = async () => {
    try {
      const res = await fetch('/api/pos/departments');
      if (res.ok) {
        const data = await res.json();
        if (data.departments && Array.isArray(data.departments)) {
          const names: string[] = data.departments
            .map((d: any) => d.departmentName || d.name)
            .filter(Boolean);
          setAvailableDepartments(Array.from(new Set(names)).sort());
        }
      }
    } catch (e) {
      console.warn('Notice: Failed to load departments in Settings', e);
    }
  };

  const refreshConnectionAndSuppliers = async () => {
    try {
      const statusRes = await fetch('/api/status');
      const status = await statusRes.json();
      setConnected(!!status.connected);
      if (typeof status.forceLiveMode !== 'undefined') {
        setForceLiveMode(Boolean(status.forceLiveMode));
      }

      const [supRes, cfgRes] = await Promise.all([
        fetch('/api/suppliers'),
        fetch('/api/supplier-configs'),
      ]);
      const supData = await supRes.json();
      const cfgData = normalizeSupplierConfigMap(await cfgRes.json());
      const rawSuppliers = supData.suppliers || [];
      const normalizedSuppliers = rawSuppliers.map((s: any) => ({
        ...s,
        id: String(s.id ?? s.supplierId ?? s.SupplierID ?? ''),
        name: s.name ?? s.SupplierName ?? '',
        code: s.code ?? s.SupplierCode ?? '',
      }));
      if (!supData.error) setSuppliers(normalizedSuppliers);
      setConfigs(cfgData);
      setDrafts(configsToDrafts(cfgData));
    } catch {
      setConnected(false);
    }
  };

  const unconfiguredSuppliers = useMemo(() => {
    const configured = new Set(drafts.map((d) => String(d.supplierId)));
    return suppliers.filter((s: any) => {
      const sId = String(s.id ?? s.supplierId ?? s.SupplierID ?? '');
      return !configured.has(sId);
    });
  }, [suppliers, drafts]);

  const testConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ server, database, user, password, domain, authType }),
      });
      const data = await response.json();
      setResult(data);
      onStatusUpdate();
      if (data.success) {
        await refreshConnectionAndSuppliers();
      }
    } catch (err: any) {
      setResult({ success: false, message: err.message || 'Failed to connect' });
    } finally {
      setLoading(false);
    }
  };

  const addSupplierDraft = () => {
    if (!addSupplierId) return;
    if (drafts.some((d) => d.supplierId === addSupplierId)) return;
    const existing = findConfigForSupplier(addSupplierId, configs, suppliers);
    setDrafts((prev) => [
      ...prev,
      existing
        ? configToDraft(addSupplierId, existing)
        : {
            supplierId: addSupplierId,
            safetyBufferPct: 20,
            schedules: [defaultSchedule()],
          },
    ]);
    setAddSupplierId('');
    setConfigMessage(null);
  };

  const updateDraft = (supplierId: string, patch: Partial<DraftEntry>) => {
    setDrafts((prev) =>
      prev.map((d) => (d.supplierId === supplierId ? { ...d, ...patch } : d))
    );
  };

  const updateSchedule = (
    supplierId: string,
    index: number,
    patch: Partial<DeliverySchedule>
  ) => {
    setDrafts((prev) =>
      prev.map((d) => {
        if (d.supplierId !== supplierId) return d;
        const schedules = d.schedules.map((s, i) => (i === index ? { ...s, ...patch } : s));
        return { ...d, schedules };
      })
    );
  };

  const addSchedule = (supplierId: string) => {
    setDrafts((prev) =>
      prev.map((d) =>
        d.supplierId === supplierId
          ? { ...d, schedules: [...d.schedules, defaultSchedule()] }
          : d
      )
    );
  };

  const removeSchedule = (supplierId: string, index: number) => {
    setDrafts((prev) =>
      prev.map((d) => {
        if (d.supplierId !== supplierId) return d;
        if (d.schedules.length <= 1) return d;
        return { ...d, schedules: d.schedules.filter((_, i) => i !== index) };
      })
    );
  };

  const removeSupplierDraft = async (supplierId: string) => {
    const wasSaved = !!configs[supplierId];
    if (wasSaved) {
      const res = await fetch(`/api/supplier-configs/${encodeURIComponent(supplierId)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!data.success) {
        setConfigMessage({ success: false, text: data.message || 'Failed to remove supplier' });
        return;
      }
      setConfigs((prev) => {
        const next = { ...prev };
        delete next[supplierId];
        return next;
      });
    }
    setDrafts((prev) => prev.filter((d) => d.supplierId !== supplierId));
    setConfigMessage({ success: true, text: 'Supplier removed from config.' });
  };

  const saveAllConfigs = async () => {
    if (drafts.length === 0) {
      setConfigMessage({ success: false, text: 'Add at least one supplier to save.' });
      return;
    }
    setConfigSaving(true);
    setConfigMessage(null);

    try {
      const nextConfigs: SupplierConfigMap = { ...configs };
      for (const draft of drafts) {
        if (!draft.schedules.length) {
          throw new Error(`Add at least one schedule for ${supplierName(draft.supplierId)}`);
        }
        const payload = {
          supplierId: draft.supplierId,
          schedules: draft.schedules,
          safetyMultiplier: 1 + Math.max(0, Number(draft.safetyBufferPct) || 0) / 100,
        };
        const response = await fetch('/api/supplier-configs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await response.json();
        if (!data.success) throw new Error(data.message || 'Save failed');
        nextConfigs[draft.supplierId] = data.config || {
          schedules: draft.schedules,
          safetyMultiplier: payload.safetyMultiplier,
        };
      }
      setConfigs(nextConfigs);
      setDrafts(configsToDrafts(nextConfigs));
      setConfigMessage({
        success: true,
        text: `Saved ${drafts.length} supplier configuration${drafts.length === 1 ? '' : 's'}.`,
      });
    } catch (err: any) {
      setConfigMessage({ success: false, text: err.message || 'Failed to save configurations' });
    } finally {
      setConfigSaving(false);
    }
  };

  const supplierName = (id: string) => {
    if (!id) return 'Supplier';
    const s = suppliers.find((sup: any) => {
      const supId = String(sup.id ?? sup.supplierId ?? sup.SupplierID ?? '');
      const supCode = String(sup.code ?? sup.SupplierCode ?? '');
      const supName = String(sup.name ?? sup.SupplierName ?? '');
      return (
        supId === String(id) ||
        (supCode && supCode.toLowerCase() === String(id).toLowerCase()) ||
        (supName && supName.toLowerCase() === String(id).toLowerCase())
      );
    });

    if (s) {
      const name = (s as any).name || (s as any).SupplierName;
      if (name) {
        const code = (s as any).code || (s as any).SupplierCode;
        return code ? `${name} (${code})` : name;
      }
    }

    if (isNaN(Number(id))) {
      return id;
    }

    return `Supplier #${id}`;
  };

  const themeOptions: Array<{ id: AppTheme; name: string; desc: string; previewBg: string; previewAccent: string }> = [
    { id: 'blue', name: 'Modern Blue', desc: 'Clean corporate blue & white POS canvas', previewBg: 'bg-slate-900', previewAccent: 'bg-blue-600' },
    { id: 'emerald', name: 'Dark Emerald', desc: 'Rich emerald retail POS atmosphere', previewBg: 'bg-emerald-950', previewAccent: 'bg-emerald-600' },
    { id: 'midnight', name: 'Midnight Luxury', desc: 'Sleek dark violet & indigo theme', previewBg: 'bg-slate-950', previewAccent: 'bg-indigo-600' },
    { id: 'amber', name: 'Warm Amber', desc: 'Warm bronze & stone retail layout', previewBg: 'bg-amber-950', previewAccent: 'bg-amber-600' },
    { id: 'slate', name: 'Slate Industrial', desc: 'Neutral carbon & slate monochrome tone', previewBg: 'bg-slate-900', previewAccent: 'bg-slate-700' },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Subtab Navigation Buttons */}
      <div className="bg-white p-2.5 rounded-2xl shadow-xs border border-slate-200">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-bold">
          {(allowedSettings.includes('stores') || allowedSettings.includes('server')) && (
            <button
              type="button"
              onClick={() => setActiveSubTab('stores')}
              className={`px-3 py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 border ${
                activeSubTab === 'stores' || activeSubTab === 'server' || activeSubTab === 'cloudflared'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs font-extrabold'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Store className="w-4 h-4 shrink-0" />
              <span>Stores, SQL &amp; Tunnels</span>
            </button>
          )}

          {allowedSettings.includes('departments') && (
            <button
              type="button"
              onClick={() => setActiveSubTab('departments')}
              className={`px-3 py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 border ${
                activeSubTab === 'departments'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs font-extrabold'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Layers className="w-4 h-4 shrink-0" />
              <span>Department Mgmt</span>
            </button>
          )}

          {allowedSettings.includes('suppliers') && (
            <button
              type="button"
              onClick={() => setActiveSubTab('suppliers')}
              className={`px-3 py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 border ${
                activeSubTab === 'suppliers'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs font-extrabold'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Truck className="w-4 h-4 shrink-0" />
              <span>Supplier Schedules</span>
            </button>
          )}

          {(allowedSettings.includes('appearance') || allowedSettings.includes('regional')) && (
            <button
              type="button"
              onClick={() => setActiveSubTab('appearance')}
              className={`px-3 py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 border ${
                activeSubTab === 'appearance' || activeSubTab === 'regional'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs font-extrabold'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Palette className="w-4 h-4 shrink-0" />
              <span>Theme</span>
            </button>
          )}
        </div>
      </div>


      {/* Sub Tab 1: Server Settings */}
      {activeSubTab === 'server' && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Database className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-bold text-slate-900">SQL Server Connection Settings</h2>
            </div>
            <span className="px-2.5 py-1 text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 rounded-full">
              Cloudflare Tunnel: mssql.kwikstop.com.au
            </span>
          </div>

          {/* Quick Guide Banner for SQL Server Configuration (Collapsible to save vertical space) */}
          <div className="border border-amber-200/90 bg-amber-50/80 rounded-xl overflow-hidden transition-all">
            <button
              type="button"
              onClick={() => setIsSetupGuideOpen(!isSetupGuideOpen)}
              className="w-full p-3.5 flex items-center justify-between gap-2 text-amber-900 font-bold text-xs uppercase tracking-wide hover:bg-amber-100/50 transition-colors text-left"
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>SQL Server 2019 Store PC Setup Guide (DESKTOP-ABEN9NK)</span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-800 normal-case bg-amber-100/80 px-2 py-0.5 rounded-md border border-amber-300/60 shrink-0">
                <span>{isSetupGuideOpen ? 'Hide Guide' : 'Show Guide'}</span>
                {isSetupGuideOpen ? (
                  <ChevronUp className="w-3.5 h-3.5 text-amber-700" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-amber-700" />
                )}
              </div>
            </button>
            
            {isSetupGuideOpen && (
              <div className="p-4 pt-2 border-t border-amber-200/60 space-y-3 text-xs text-amber-900 animate-fade-in">
                <div>
                  <p className="font-semibold text-amber-950 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-amber-200 text-amber-900 flex items-center justify-center font-bold text-[10px]">1</span>
                    In SQL Server Configuration Manager:
                  </p>
                  <ul className="list-disc list-inside space-y-0.5 pl-7 text-amber-900/90">
                    <li>Go to <strong>SQL Server Network Configuration &gt; Protocols for IDEALSQL</strong> &rarr; Enable <strong>TCP/IP</strong>.</li>
                    <li>Right-click <strong>TCP/IP &gt; Properties &gt; IP Addresses tab</strong> &rarr; Scroll to <strong>IPAll</strong> &rarr; Set <strong>TCP Port = 1433</strong> (clear Dynamic Ports).</li>
                    <li>Go to <strong>SQL Server Services</strong> &rarr; Right-click <strong>SQL Server (IDEALSQL)</strong> &rarr; Click <strong>Restart</strong>.</li>
                  </ul>
                </div>

                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg space-y-2">
                  <p className="font-bold text-emerald-900 flex items-center gap-1.5 text-xs">
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    SQL Server Configuration Complete!
                  </p>
                  <p className="text-xs text-emerald-800 leading-relaxed pl-5.5">
                    <strong>Mixed Authentication Mode (Value = 2)</strong> is active. Click <strong>"Test Connection"</strong> below!
                  </p>
                  <p className="text-[11px] text-slate-600 leading-relaxed pl-5.5 pt-1 border-t border-emerald-200/60">
                    <em>If connection test shows "Login failed", run this command in PowerShell (Admin) on the store PC:</em>
                  </p>
                  <div className="ml-5.5 p-2 bg-slate-900 text-slate-100 rounded font-mono text-[10px] overflow-x-auto select-all border border-slate-700">
                    $conn = New-Object System.Data.SqlClient.SqlConnection("Server=.\IDEALSQL;Database=master;Integrated Security=True;"); $conn.Open(); $cmd = $conn.CreateCommand(); $cmd.CommandText = 'ALTER LOGIN kwikorder WITH PASSWORD = ''Kwik$top4812'', CHECK_EXPIRATION=OFF; ALTER LOGIN kwikorder ENABLE; ALTER SERVER ROLE sysadmin ADD MEMBER kwikorder;'; $cmd.ExecuteNonQuery(); $conn.Close(); Write-Host "Done!"
                  </div>
                </div>
              </div>
            )}
          </div>

          <form onSubmit={testConnection} className="space-y-6">
            {/* Auth Mode Toggle */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                Authentication Method
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setAuthType('sql')}
                  className={`px-4 py-2.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                    authType === 'sql'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  <Key className="w-4 h-4" />
                  SQL Server Authentication (Recommended)
                </button>
                <button
                  type="button"
                  onClick={() => setAuthType('windows')}
                  className={`px-4 py-2.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                    authType === 'windows'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  <Lock className="w-4 h-4" />
                  Windows Authentication (Local LAN)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5 text-slate-400" />
                  SQL Server Host / Tunnel Domain
                </label>
                <input
                  type="text"
                  value={server}
                  onChange={(e) => setServer(e.target.value)}
                  placeholder="mssql.kwikstop.com.au"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-slate-400" />
                  Database Name
                </label>
                <input
                  type="text"
                  value={database}
                  onChange={(e) => setDatabase(e.target.value)}
                  placeholder="IPSTransaction"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  required
                />
              </div>

              {authType === 'windows' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <Server className="w-3.5 h-3.5 text-slate-400" />
                    PC / Workgroup Domain Name
                  </label>
                  <input
                    type="text"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    placeholder="DESKTOP-ABEN9NK"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  {authType === 'windows' ? 'Windows Username' : 'SQL Login User'}
                </label>
                <input
                  type="text"
                  value={user}
                  onChange={(e) => setUser(e.target.value)}
                  placeholder={authType === 'windows' ? 'Windows user on store PC' : 'sa or kwikorder'}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-slate-400" />
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center gap-4">
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Testing...
                  </>
                ) : (
                  'Test Connection & Save'
                )}
              </button>
            </div>
          </form>

          {result && (
            <div
              className={`p-4 rounded-xl flex items-start gap-3 ${
                result.success
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}
            >
              {result.success ? (
                <CheckCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
              ) : (
                <XCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
              )}
              <div>
                <p className="font-bold text-sm">
                  {result.success ? 'Connection Successful' : 'Connection Failed'}
                </p>
                <p className="text-xs mt-1 opacity-90">{result.message}</p>
              </div>
            </div>
          )}

          {/* Live Database Mode & Test Data Management */}
          <div className="pt-6 border-t border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Database className="w-4 h-4 text-emerald-600" />
                Live IdealPOS Database Mode & Test Data Management
              </h3>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
                forceLiveMode
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}>
                <span className={`w-2 h-2 rounded-full ${forceLiveMode ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                {forceLiveMode ? 'Live IdealPOS SQL Only' : 'Demo Mode Fallback Enabled'}
              </span>
            </div>

            {/* In-app Action Feedback Notice */}
            {actionNotice && (
              <div className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-2 ${
                actionNotice.success
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border-rose-200'
              }`}>
                <div className="flex items-center gap-2">
                  {actionNotice.success ? (
                    <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  )}
                  <span className="font-semibold">{actionNotice.message}</span>
                </div>
                <button
                  onClick={() => setActionNotice(null)}
                  className="text-xs text-slate-400 hover:text-slate-600 font-bold"
                >
                  Dismiss
                </button>
              </div>
            )}

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-bold text-slate-800">
                    Force Live Database Mode (Disable Demo / Test Data Fallback)
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    When enabled, the app queries exclusively from your live <code className="bg-slate-200 text-slate-800 px-1 rounded">IPSTransaction</code> SQL database and disables mock/simulated items.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    const nextMode = !forceLiveMode;
                    try {
                      const res = await fetch('/api/settings/live-mode', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ forceLiveMode: nextMode })
                      });
                      const data = await res.json();
                      if (data.success) {
                        setForceLiveMode(nextMode);
                        setActionNotice({
                          success: true,
                          message: nextMode
                            ? 'Live IdealPOS Database Mode Enabled! The app will query exclusively from your live SQL Server instance.'
                            : 'Demo Fallback Mode Enabled.'
                        });
                        onStatusUpdate();
                        void refreshConnectionAndSuppliers();
                      }
                    } catch (e) {
                      setActionNotice({ success: false, message: 'Failed to update live mode setting.' });
                    }
                  }}
                  className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all shadow-xs flex-shrink-0 ${
                    forceLiveMode
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : 'bg-slate-800 hover:bg-slate-900 text-white'
                  }`}
                >
                  {forceLiveMode ? '✓ Live Mode Active' : 'Enable Live Database Only'}
                </button>
              </div>

              <div className="pt-3 border-t border-slate-200/80 flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-bold text-slate-800">
                    Clear Sample / Test Supplier Data
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Remove sample test supplier schedules (e.g. Bega, Tip Top) so you can configure your own IdealPOS suppliers from scratch.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowClearConfirmModal(true)}
                  className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/80 rounded-lg text-xs font-bold transition-colors flex-shrink-0"
                >
                  Clear Sample Test Data
                </button>
              </div>
            </div>
          </div>

          {/* Modal for Clear Test Data Confirmation */}
          {showClearConfirmModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
              <div className="bg-white rounded-2xl p-6 max-w-md w-full border border-slate-200 shadow-xl space-y-4 animate-fade-in">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-rose-100 text-rose-600 rounded-xl">
                    <Trash2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Clear Sample Test Data</h3>
                    <p className="text-xs text-slate-500">Reset sample supplier configurations</p>
                  </div>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  Are you sure you want to clear all sample test supplier configurations (e.g. sample Bega/Tip Top schedules)? You will be able to configure your live IdealPOS suppliers from scratch.
                </p>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowClearConfirmModal(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      setShowClearConfirmModal(false);
                      try {
                        const res = await fetch('/api/settings/clear-test-data', { method: 'POST' });
                        const data = await res.json();
                        if (data.success) {
                          setConfigs({});
                          setDrafts([]);
                          setActionNotice({
                            success: true,
                            message: 'Sample test supplier data cleared successfully! You can now add your live IdealPOS suppliers.'
                          });
                          onStatusUpdate();
                          void refreshConnectionAndSuppliers();
                        } else {
                          setActionNotice({ success: false, message: data.message || 'Failed to clear test data.' });
                        }
                      } catch (e) {
                        setActionNotice({ success: false, message: 'Failed to clear test data.' });
                      }
                    }}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
                  >
                    Yes, Clear Test Data
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Cloudflare Tunnel Status & Store Management Link inside Server Settings */}
          <div className="pt-4 border-t border-slate-100 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Terminal className="w-4 h-4 text-blue-600" />
                Cloudflare Tunnel Connector (Flagship Store)
              </h3>
              <button
                type="button"
                onClick={() => setActiveSubTab('stores')}
                className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 hover:underline"
              >
                <Store className="w-3.5 h-3.5" />
                Manage All Branch Tunnels &rarr;
              </button>
            </div>
            <CloudflaredTunnelCard />
          </div>
        </div>
      )}

      {/* Sub Tab: Cloudflare Tunnel (Redirected to Stores & Tunnels) */}
      {activeSubTab === 'cloudflared' && (
        <StoreManagementSettings
          userRole={userRole}
          onStoreSwitched={() => onStatusUpdate()}
        />
      )}

      {/* Sub Tab: Department Management */}
      {activeSubTab === 'departments' && (
        <DepartmentManagementSettings />
      )}

      {/* Sub Tab 2: Supplier Config */}
      {activeSubTab === 'suppliers' && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-6">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <Truck className="w-5 h-5 text-blue-600" />
              <div>
                <h2 className="text-lg font-bold text-slate-900">Supplier Delivery & Lead Time Schedules</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure delivery days and cut-off times for live IdealPOS database suppliers.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={refreshConnectionAndSuppliers}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 shrink-0"
            >
              <RotateCw className="w-3.5 h-3.5" />
              Refresh Suppliers from DB
            </button>
          </div>

          {!connected ? (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-4">
              Demo mode or SQL disconnected. Switch back to Server Settings above to connect.
            </p>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
                <div className="flex-1 space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                    <span>Add Supplier</span>
                    <span className="text-slate-500 font-normal text-[11px]">
                      ({suppliers.length} live supplier{suppliers.length === 1 ? '' : 's'} fetched from IdealPOS)
                    </span>
                  </label>
                  <select
                    value={addSupplierId}
                    onChange={(e) => setAddSupplierId(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg outline-none bg-white"
                  >
                    <option value="">
                      {suppliers.length === 0
                        ? 'Fetching suppliers from live IdealPOS database…'
                        : 'Select supplier to add…'}
                    </option>
                    {unconfiguredSuppliers.map((s, idx) => (
                      <option key={`unconf-sup-${s.id}-${idx}`} value={String(s.id)}>
                        {s.name || `Supplier ${s.id}`} {s.code ? `(${s.code})` : ''} - {s.productCount} product{s.productCount === 1 ? '' : 's'}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={addSupplierDraft}
                  disabled={!addSupplierId}
                  className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 flex items-center justify-center gap-2 text-sm font-semibold"
                >
                  <Plus className="w-4 h-4" />
                  Add
                </button>
              </div>

              {drafts.length === 0 && (
                <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-xl p-4">
                  No suppliers configured yet. Select one above.
                </p>
              )}

              <div className="space-y-3">
                {drafts.map((draft) => {
                  const isExpanded = !!expandedSuppliers[draft.supplierId];
                  const sName = supplierName(draft.supplierId);
                  const firstSched = draft.schedules[0];
                  const schedSummary = firstSched ? formatSchedule(firstSched) : 'No schedule set';

                  return (
                    <div
                      key={draft.supplierId}
                      className="border border-slate-200 rounded-xl bg-white shadow-2xs overflow-hidden transition-all"
                    >
                      {/* Supplier Card Header / Compact Bar */}
                      <div
                        onClick={() => toggleSupplierExpanded(draft.supplierId)}
                        className="px-4 py-3 bg-slate-50/90 hover:bg-slate-100 transition-colors flex items-center justify-between cursor-pointer select-none gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center font-bold shrink-0">
                            <Truck className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-bold text-slate-900 text-xs sm:text-sm truncate">
                                {sName}
                              </h3>
                              <span className="px-2 py-0.5 bg-blue-100/80 text-blue-800 rounded-md text-[11px] font-bold">
                                {draft.schedules.length} schedule{draft.schedules.length === 1 ? '' : 's'}
                              </span>
                              <span className="px-2 py-0.5 bg-slate-200/70 text-slate-700 rounded-md text-[11px] font-medium hidden sm:inline-block truncate">
                                📅 {schedSummary}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5 sm:hidden truncate">
                              📅 {schedSummary}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[11px] text-slate-600 font-semibold bg-white px-2 py-0.5 border border-slate-200 rounded-md hidden sm:inline-block">
                            Buffer: {draft.safetyBufferPct}%
                          </span>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSupplierExpanded(draft.supplierId);
                            }}
                            className="px-2.5 py-1 text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors flex items-center gap-1 text-xs font-bold shadow-2xs"
                          >
                            <span>{isExpanded ? 'Minimize' : 'View Schedule'}</span>
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-slate-500" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-500" />}
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              void removeSupplierDraft(draft.supplierId);
                            }}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Remove supplier"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Expanded Section */}
                      {isExpanded && (
                        <div className="p-4 border-t border-slate-200/80 space-y-4 bg-white animate-fade-in">
                          <div className="flex items-center justify-between gap-3 flex-wrap">
                            <p className="text-xs text-slate-500 font-medium">
                              Configure cut-off day/time and delivery day schedule for <strong className="text-slate-800">{sName}</strong>.
                            </p>
                            <label className="text-xs text-slate-700 font-semibold flex items-center gap-2 shrink-0">
                              Safety Buffer %
                              <input
                                type="number"
                                min={0}
                                max={200}
                                step={5}
                                value={draft.safetyBufferPct}
                                onChange={(e) =>
                                  updateDraft(draft.supplierId, {
                                    safetyBufferPct: Number(e.target.value),
                                  })
                                }
                                className="w-20 px-2 py-1 border border-slate-300 rounded-md bg-white text-xs font-bold"
                              />
                            </label>
                          </div>

                          <div className="space-y-3">
                            {draft.schedules.map((schedule, index) => (
                              <div
                                key={`sched-${draft.supplierId}-${index}`}
                                className="bg-slate-50/70 border border-slate-200 rounded-lg p-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-[1.5fr_1fr_auto_1fr_auto] gap-3 items-end"
                              >
                                <div className="col-span-full pb-1 border-b border-slate-200/60 flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-slate-800">
                                  <div className="flex items-center gap-2">
                                    <span>Supplier: {sName} — Schedule Window #{index + 1}</span>
                                    {schedule.storeName && (
                                      <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-semibold text-[10px]">
                                        📍 {schedule.storeName}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[11px] font-semibold text-slate-600">
                                    Target Store Branch
                                  </label>
                                  <select
                                    value={schedule.storeId || 'all'}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      const matchedStore = availableStores.find((st) => st.id === val);
                                      updateSchedule(draft.supplierId, index, {
                                        storeId: val,
                                        storeIds: val === 'all' ? [] : [val],
                                        storeName: matchedStore ? `${matchedStore.name} (${matchedStore.code})` : (val === 'all' ? 'All Stores' : undefined),
                                      });
                                    }}
                                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white font-medium text-slate-800"
                                  >
                                    <option value="all">🏢 All Stores (Global)</option>
                                    {availableStores.map((st) => (
                                      <option key={st.id} value={st.id}>
                                        📍 {st.name} ({st.code})
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[11px] font-semibold text-slate-600">
                                    Cut-off day
                                  </label>
                                  <select
                                    value={schedule.cutOffDay}
                                    onChange={(e) =>
                                      updateSchedule(draft.supplierId, index, {
                                        cutOffDay: e.target.value,
                                      })
                                    }
                                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white font-medium"
                                  >
                                    {WEEKDAYS.map((d) => (
                                      <option key={d} value={d}>
                                        {d}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[11px] font-semibold text-slate-600">Time</label>
                                  <input
                                    type="time"
                                    value={schedule.cutOffTime}
                                    onChange={(e) =>
                                      updateSchedule(draft.supplierId, index, {
                                        cutOffTime: e.target.value,
                                      })
                                    }
                                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-medium"
                                    required
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[11px] font-semibold text-slate-600">
                                    Delivery day
                                  </label>
                                  <select
                                    value={schedule.deliveryDay}
                                    onChange={(e) =>
                                      updateSchedule(draft.supplierId, index, {
                                        deliveryDay: e.target.value,
                                      })
                                    }
                                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white font-medium"
                                  >
                                    {WEEKDAYS.map((d) => (
                                      <option key={d} value={d}>
                                        {d}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => removeSchedule(draft.supplierId, index)}
                                  disabled={draft.schedules.length <= 1}
                                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed self-end"
                                  title="Remove schedule option"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            ))}
                          </div>

                          <button
                            type="button"
                            onClick={() => addSchedule(draft.supplierId)}
                            className="text-xs text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Add schedule option
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>


              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => void saveAllConfigs()}
                  disabled={configSaving || drafts.length === 0}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-xs transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm"
                >
                  <Save className="w-4 h-4" />
                  {configSaving ? 'Saving…' : 'Save Supplier Configurations'}
                </button>
              </div>

              {configMessage && (
                <div
                  className={`p-3 rounded-lg text-xs border font-medium ${
                    configMessage.success
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-red-50 text-red-800 border-red-200'
                  }`}
                >
                  {configMessage.text}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Sub Tab 3: App Theme Selector */}
      {activeSubTab === 'appearance' && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-6">
          <div className="flex items-center gap-3">
            <Palette className="w-5 h-5 text-blue-600" />
            <div>
              <h2 className="text-lg font-bold text-slate-900">Application Color Theme</h2>
              <p className="text-xs text-slate-500">
                Choose a visual theme tailored for your POS store interface
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {themeOptions.map((opt) => {
              const isSelected = theme === opt.id;
              return (
                <div
                  key={opt.id}
                  onClick={() => setTheme(opt.id)}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    isSelected
                      ? 'border-blue-600 bg-blue-50/40 shadow-sm'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-bold text-sm text-slate-900 flex items-center gap-2">
                      {opt.name}
                      {isSelected && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-600 text-white">
                          <Check className="w-3 h-3 mr-0.5" /> Active
                        </span>
                      )}
                    </span>
                  </div>

                  {/* Preview Palette Bar */}
                  <div className="flex items-center gap-2 h-8 rounded-lg overflow-hidden border border-slate-200 p-1 bg-slate-100">
                    <div className={`h-full flex-1 rounded ${opt.previewBg}`} />
                    <div className={`h-full w-12 rounded ${opt.previewAccent}`} />
                  </div>

                  <p className="text-xs text-slate-500 mt-2.5">{opt.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Sub Tab: Regional, Date & Time Format Settings */}
      {activeSubTab === 'regional' && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                <Globe className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Regional, Date &amp; Time Formats</h2>
                <p className="text-xs text-slate-500">
                  Configure date display, AM/PM 12-hour clock, and Australia/Brisbane timezone
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={resetRegionalSettings}
              className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 self-start sm:self-auto"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Reset to Brisbane Defaults</span>
            </button>
          </div>

          {/* Real-time Live Preview Card */}
          <div className="p-4 bg-gradient-to-r from-blue-50/70 to-indigo-50/70 rounded-2xl border border-blue-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-blue-800 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-blue-600 animate-pulse" />
                Live Store Time Preview (in {regionalSettings.timeZoneLabel})
              </span>
              <div className="mt-1 flex items-baseline gap-3">
                <span className="text-2xl font-black text-slate-900 font-mono">
                  {previewFormatDate(new Date())}
                </span>
                <span className="text-xl font-extrabold text-blue-700 font-mono">
                  {previewFormatTime(new Date(), undefined, true)}
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1">
                Full stamp: <strong className="font-mono text-slate-800">{previewFormatDateTime(new Date(), undefined, undefined, true)}</strong>
              </p>
            </div>

            <div className="px-3.5 py-2 bg-white rounded-xl border border-blue-200 shadow-2xs text-xs font-semibold text-slate-700 shrink-0">
              <div className="text-[10px] text-slate-500 uppercase font-bold">Standard Format</div>
              <div className="text-blue-700 font-bold font-mono">DD-MM-YYYY &bull; 12-Hour AM/PM</div>
            </div>
          </div>

          {/* 1. Date Format Selection */}
          <div className="space-y-3">
            <label className="block text-sm font-bold text-slate-900 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-600" />
              Date Format
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {AVAILABLE_DATE_FORMATS.map((df) => {
                const isSelected = regionalSettings.dateFormat === df.value;
                return (
                  <div
                    key={df.value}
                    onClick={() => updateRegionalSettings({ dateFormat: df.value })}
                    className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/50 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-xs text-slate-900 font-mono">
                        {df.value}
                      </span>
                      {isSelected && (
                        <span className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-600 mt-1 font-semibold">
                      Sample: <span className="font-mono text-blue-700">{previewFormatDate(new Date(), df.value)}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">{df.label}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 2. Time Format (12h AM/PM vs 24h) */}
          <div className="space-y-3 pt-4 border-t border-slate-100">
            <label className="block text-sm font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600" />
              Time Display (12-Hour AM/PM vs 24-Hour)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {AVAILABLE_TIME_FORMATS.map((tf) => {
                const isSelected = regionalSettings.timeFormat === tf.value;
                return (
                  <div
                    key={tf.value}
                    onClick={() => updateRegionalSettings({ timeFormat: tf.value })}
                    className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/50 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-sm text-slate-900">
                        {tf.label}
                      </span>
                      {isSelected && (
                        <span className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-600 mt-1 font-semibold">
                      Sample: <span className="font-mono text-blue-700">{previewFormatTime(new Date(), tf.value, true)}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {tf.value === '12h' ? 'Shows AM/PM suffix (e.g. 02:30 PM)' : 'Shows 24-hour military clock (e.g. 14:30)'}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3. Time Zone Selection */}
          <div className="space-y-3 pt-4 border-t border-slate-100">
            <label className="block text-sm font-bold text-slate-900 flex items-center gap-2">
              <Globe className="w-4 h-4 text-blue-600" />
              Store Time Zone
            </label>
            <p className="text-xs text-slate-500">
              Select the primary operating timezone for sales transactions, receipts, and hourly velocity charts.
            </p>
            <div className="max-w-md">
              <select
                value={regionalSettings.timeZone}
                onChange={(e) => updateRegionalSettings({ timeZone: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
              >
                {AVAILABLE_TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label} ({tz.offset})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Sub Tab: Stores & Multi-Branch */}
      {activeSubTab === 'stores' && (
        <StoreManagementSettings
          userRole={userRole}
          onStoreSwitched={() => onStatusUpdate()}
        />
      )}
    </div>
  );
}

function configToDraft(supplierId: string, config: SupplierConfig): DraftEntry {
  return {
    supplierId,
    safetyBufferPct: Math.round(((config.safetyMultiplier || 1.2) - 1) * 100),
    schedules: config.schedules?.length
      ? config.schedules.map((s) => ({ ...s }))
      : [defaultSchedule()],
  };
}

function configsToDrafts(configs: SupplierConfigMap): DraftEntry[] {
  return Object.entries(configs).map(([supplierId, config]) => configToDraft(supplierId, config));
}
