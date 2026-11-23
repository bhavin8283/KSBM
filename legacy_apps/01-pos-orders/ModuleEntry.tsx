import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  LayoutDashboard,
  Package,
  ClipboardList,
  Receipt,
  FileSpreadsheet,
  Database,
  Store,
  Settings as SettingsIcon,
} from 'lucide-react';
import { ThemeProvider } from './ThemeContext';
import { DateTimeProvider } from './DateTimeContext';
import { POSDashboard } from './components/POSDashboard';
import { InventoryManager } from './components/InventoryManager';
import OrderEngine from './components/OrderEngine';
import { SalesHistory } from './components/SalesHistory';
import { ReportsManager } from './components/ReportsManager';
import DatabaseExplorer from './components/DatabaseExplorer';
import { StoreManagementSettings } from './components/StoreManagementSettings';
import Settings from './components/Settings';
import { AIChatAssistant } from './components/AIChatAssistant';
import type {
  ConnectionStatus,
  CurrentUserSession,
  KSBMBusinessConfig,
  KSBMCurrentUser,
  ModuleDashboardMetrics,
  ModuleEntryProps,
  NavigationTab,
  SettingsSubTab,
  UserPermissions,
  UserRole,
} from './types';

const ALL_MODULE_TABS: NavigationTab[] = [
  'dashboard',
  'inventory',
  'orders',
  'sales',
  'reports',
  'explorer',
  'stores',
  'settings',
];

const ALL_MODULE_SETTINGS: SettingsSubTab[] = [
  'stores',
  'server',
  'cloudflared',
  'departments',
  'suppliers',
  'appearance',
  'regional',
];

function resolveDefaultPermissions(role: UserRole, overrides?: Partial<UserPermissions>): UserPermissions {
  const isAdminOrManager = role === 'admin' || role === 'manager';
  const base: UserPermissions = {
    canViewCostPrices: isAdminOrManager || role === 'stock_clerk',
    canEditInventory: isAdminOrManager || role === 'stock_clerk' || role === 'supervisor',
    canCreateOrders: isAdminOrManager || role === 'stock_clerk',
    canViewFinancialRevenue: isAdminOrManager || role === 'supervisor',
    canManageUsers: role === 'admin',
  };
  return {
    ...base,
    ...(overrides || {}),
  };
}

function resolveAllowedTabs(
  user: KSBMCurrentUser,
  permissions: UserPermissions,
  businessConfig: KSBMBusinessConfig
): NavigationTab[] {
  const enableExplorer = businessConfig.features?.enableDatabaseExplorer !== false;

  if (Array.isArray(user.allowedTabs) && user.allowedTabs.length > 0) {
    return user.allowedTabs.filter((tab) => {
      if (tab === 'explorer' && !enableExplorer) return false;
      return ALL_MODULE_TABS.includes(tab);
    });
  }

  const tabs: NavigationTab[] = ['dashboard', 'inventory'];
  if (permissions.canCreateOrders) tabs.push('orders');
  tabs.push('sales');
  if (permissions.canViewFinancialRevenue || user.role === 'admin' || user.role === 'manager') {
    tabs.push('reports');
  }
  if ((user.role === 'admin' || user.role === 'manager') && enableExplorer) {
    tabs.push('explorer');
  }
  if (user.role === 'admin' || user.role === 'manager') {
    tabs.push('stores', 'settings');
  }
  return tabs;
}

function resolveAllowedSettings(user: KSBMCurrentUser): SettingsSubTab[] {
  if (Array.isArray(user.allowedSettings) && user.allowedSettings.length > 0) {
    return user.allowedSettings.filter((sub) => ALL_MODULE_SETTINGS.includes(sub));
  }
  if (user.role === 'admin') {
    return [...ALL_MODULE_SETTINGS];
  }
  if (user.role === 'manager') {
    return ['departments', 'suppliers', 'appearance', 'regional'];
  }
  return ['appearance', 'regional'];
}

function buildUserSession(
  currentUser: KSBMCurrentUser,
  businessConfig: KSBMBusinessConfig
): CurrentUserSession {
  const role: UserRole = currentUser?.role || 'staff';
  const permissions = resolveDefaultPermissions(role, currentUser?.permissions);
  const allowedTabs = resolveAllowedTabs(currentUser, permissions, businessConfig);
  const allowedSettings = resolveAllowedSettings(currentUser);

  return {
    id: currentUser?.id || 'ksbm-user',
    name: currentUser?.name || currentUser?.username || 'Staff',
    role,
    allowedTabs,
    allowedSettings,
    allowedStoreIds: currentUser?.allowedStoreIds || (businessConfig.storeId ? [businessConfig.storeId] : ['all']),
    permissions,
    department: currentUser?.department,
  };
}

const SECTION_META: Record<NavigationTab, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  dashboard: { label: 'POS Dashboard', icon: LayoutDashboard },
  inventory: { label: 'Inventory & Expiry', icon: Package },
  orders: { label: 'Order Engine', icon: ClipboardList },
  sales: { label: "Today's Sales", icon: Receipt },
  reports: { label: 'POS Reports', icon: FileSpreadsheet },
  explorer: { label: 'DB Explorer', icon: Database },
  stores: { label: 'Stores & Tunnels', icon: Store },
  settings: { label: 'Module Settings', icon: SettingsIcon },
};

function ModuleWorkspace({
  currentUser,
  businessConfig,
  activeSection,
  onSectionChange,
  hideSubNav = false,
}: ModuleEntryProps) {
  const userSession = useMemo(
    () => buildUserSession(currentUser, businessConfig),
    [currentUser, businessConfig]
  );

  const allowedTabs = userSession.allowedTabs;
  const apiBase = (businessConfig?.apiBaseUrl || '').replace(/\/$/, '');

  const [activeTab, setActiveTab] = useState<NavigationTab>(() => {
    if (activeSection && allowedTabs.includes(activeSection)) {
      return activeSection;
    }
    return allowedTabs[0] || 'dashboard';
  });

  const [status, setStatus] = useState<(ConnectionStatus & { storeId?: string }) | null>(null);

  const selectTab = useCallback(
    (tab: NavigationTab) => {
      if (!allowedTabs.includes(tab)) return;
      setActiveTab(tab);
      onSectionChange?.(tab);
    },
    [allowedTabs, onSectionChange]
  );

  useEffect(() => {
    if (activeSection && allowedTabs.includes(activeSection) && activeSection !== activeTab) {
      setActiveTab(activeSection);
    } else if (!allowedTabs.includes(activeTab) && allowedTabs.length > 0) {
      setActiveTab(allowedTabs[0]);
    }
  }, [activeSection, allowedTabs, activeTab]);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/api/status`);
      if (!res.ok) return;
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await res.json();
        setStatus(data);
      }
    } catch {
      // Offline / API proxy not mounted yet
    }
  }, [apiBase]);

  useEffect(() => {
    void fetchStatus();
    const interval = setInterval(() => {
      void fetchStatus();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  useEffect(() => {
    const handleSwitchTab = (e: Event) => {
      const customEvent = e as CustomEvent<{ tab: NavigationTab }>;
      if (customEvent.detail?.tab) {
        selectTab(customEvent.detail.tab);
      }
    };
    window.addEventListener('switch-tab', handleSwitchTab);
    return () => window.removeEventListener('switch-tab', handleSwitchTab);
  }, [selectTab]);

  const showAssistant = businessConfig?.features?.enableAIChatAssistant !== false;

  return (
    <div className="w-full space-y-5 relative">
      {/* Compact Internal Module Section Switcher (not an outer shell header/sidebar) */}
      {!hideSubNav && allowedTabs.length > 1 && (
        <nav
          aria-label="POS Module Sections"
          className="flex flex-wrap items-center gap-1.5 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-xs"
        >
          {allowedTabs.map((tab) => {
            const meta = SECTION_META[tab];
            const Icon = meta.icon;
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => selectTab(tab)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{meta.label}</span>
              </button>
            );
          })}
        </nav>
      )}

      {/* Active Feature View */}
      <div className="w-full min-w-0">
        {activeTab === 'dashboard' && (
          <POSDashboard
            onNavigateToInventory={() => selectTab('inventory')}
            currentUser={userSession}
          />
        )}
        {activeTab === 'inventory' && (
          <InventoryManager currentUser={userSession} />
        )}
        {activeTab === 'orders' && (
          <OrderEngine connected={Boolean(status?.connected)} />
        )}
        {activeTab === 'sales' && <SalesHistory />}
        {activeTab === 'reports' && <ReportsManager />}
        {activeTab === 'explorer' && (
          <DatabaseExplorer activeDatabase={status?.database || null} />
        )}
        {activeTab === 'stores' && (
          <div className="p-4 sm:p-6 bg-white border border-slate-200 rounded-3xl shadow-sm">
            <StoreManagementSettings
              currentStoreId={status?.storeId || businessConfig?.storeId}
              onStoreSwitched={() => {
                void fetchStatus();
              }}
              userRole={userSession.role}
            />
          </div>
        )}
        {activeTab === 'settings' && (
          <Settings
            onStatusUpdate={() => {
              void fetchStatus();
            }}
            allowedSettings={userSession.allowedSettings}
            userRole={userSession.role}
          />
        )}
      </div>

      {/* Floating Store AI Assistant Widget */}
      {showAssistant && <AIChatAssistant />}
    </div>
  );
}

/**
 * Helper for KSBM Home Screen to fetch live KPI summary metrics for this module.
 */
export async function fetchModuleDashboardMetrics(
  apiBaseUrl: string = ''
): Promise<ModuleDashboardMetrics> {
  const base = apiBaseUrl.replace(/\/$/, '');
  const [dashRes, expiryRes, statusRes] = await Promise.allSettled([
    fetch(`${base}/api/pos/dashboard`),
    fetch(`${base}/api/expiry/batches`),
    fetch(`${base}/api/status`),
  ]);

  let todaySalesGross = 0;
  let todayTransactions = 0;
  let expiringSoonCount = 0;
  let expiredBatchesCount = 0;
  let sqlConnected = false;

  if (dashRes.status === 'fulfilled' && dashRes.value.ok) {
    try {
      const dash = await dashRes.value.json();
      todaySalesGross = Number(dash?.sessionSales ?? dash?.todaySales ?? 0);
      todayTransactions = Number(dash?.sessionCustomers ?? dash?.customerCount ?? 0);
    } catch {
      // Ignore parse error
    }
  }

  if (expiryRes.status === 'fulfilled' && expiryRes.value.ok) {
    try {
      const exp = await expiryRes.value.json();
      const batches = Array.isArray(exp?.batches) ? exp.batches : Array.isArray(exp) ? exp : [];
      const now = Date.now();
      for (const b of batches) {
        if (b?.status && String(b.status).toLowerCase() !== 'active') continue;
        const expDate = b?.expiryDate ? new Date(b.expiryDate).getTime() : NaN;
        if (Number.isNaN(expDate)) continue;
        const days = Math.ceil((expDate - now) / (1000 * 60 * 60 * 24));
        if (days < 0) expiredBatchesCount += 1;
        else if (days <= 7) expiringSoonCount += 1;
      }
    } catch {
      // Ignore parse error
    }
  }

  if (statusRes.status === 'fulfilled' && statusRes.value.ok) {
    try {
      const st = await statusRes.value.json();
      sqlConnected = Boolean(st?.connected);
    } catch {
      // Ignore parse error
    }
  }

  return {
    todaySalesGross,
    todayTransactions,
    expiringSoonCount,
    expiredBatchesCount,
    sqlConnected,
  };
}

export function ModuleEntry(props: ModuleEntryProps) {
  const { businessConfig = {} as KSBMBusinessConfig } = props;

  return (
    <ThemeProvider initialTheme={businessConfig?.theme}>
      <DateTimeProvider
        initialSettings={{
          timeZone: businessConfig?.timezone,
          dateFormat: businessConfig?.dateFormat,
          timeFormat: businessConfig?.timeFormat,
        }}
      >
        <ModuleWorkspace {...props} />
      </DateTimeProvider>
    </ThemeProvider>
  );
}

export default ModuleEntry;
