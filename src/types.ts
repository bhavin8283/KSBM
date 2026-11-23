export type ModuleId =
  | 'dashboard'
  | 'pos-orders'
  | 'temp-logs'
  | 'atm-cash'
  | 'fb-posts'
  | 'pricematch'
  | 'settings';

export type StaffRole = 'Admin / Owner' | 'Store Manager' | 'Floor Staff' | (string & {});

export interface TempRange {
  min: number;
  max: number;
}

export interface BusinessConfig {
  storeName: string;
  address: string;
  phone: string;
  abn: string;
  operatingHours: string;
  fridgeTempRange: TempRange;
  freezerTempRange: TempRange;
  atmLowCashAlert: number;
  defaultSuppliers: string[];
}

export interface StaffPermissions {
  posOrders: {
    access: boolean;
    canApproveOrders: boolean;
    canManageSuppliers: boolean;
  };
  tempLogs: {
    access: boolean;
    canEditPastLogs: boolean;
    canConfigureUnits: boolean;
  };
  atmCash: {
    access: boolean;
    canLogFeedings: boolean;
    canEditCycleCounts: boolean;
  };
  fbPosts: {
    access: boolean;
    canPublishDirectly: boolean;
  };
  pricematch: {
    access: boolean;
    canEditPrices: boolean;
  };
  adminSettings: boolean;
}

export interface StaffProfile {
  id: string;
  name: string;
  role: StaffRole;
  pin: string;
  active: boolean;
  shiftLabel: string;
  permissions: StaffPermissions;
}

export interface NavModuleItem {
  id: ModuleId;
  label: string;
  shortLabel: string;
  description: string;
}

export const STORE_INFO = {
  shortName: 'KSBM',
  fullTitle: 'Kwik Stop Business Manager',
} as const;

export const NAV_MODULES: NavModuleItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard Overview',
    shortLabel: 'Overview',
    description: 'Storewide live status across counter, cold chain, ATM, social, and wholesale.',
  },
  {
    id: 'pos-orders',
    label: 'POS & Order Manager',
    shortLabel: 'POS & Orders',
    description: 'Counter checkout queue, pickup orders, and shift register totals.',
  },
  {
    id: 'temp-logs',
    label: 'Temperature Logging',
    shortLabel: 'Temp Logs',
    description: 'Daily compliance checks for display fridges, beverage chillers, and freezers.',
  },
  {
    id: 'atm-cash',
    label: 'ATM Cash Manager',
    shortLabel: 'ATM Cash',
    description: 'Cassette balance tracking for $20 and $50 notes and replenishment logs.',
  },
  {
    id: 'fb-posts',
    label: 'AI Facebook Manager',
    shortLabel: 'Facebook AI',
    description: 'Promotional post drafting, store specials scheduling, and page calendar.',
  },
  {
    id: 'pricematch',
    label: 'Smoke Price Tracker',
    shortLabel: 'Smoke Prices',
    description: 'Tobacco & smoke SKU wholesale pricing, RRP tracking, and margin alerts.',
  },
  {
    id: 'settings',
    label: 'Store & Staff Settings',
    shortLabel: 'Settings',
    description: 'Manage store profile, operational thresholds, staff PINs, and permissions.',
  },
];

export function hasModuleAccess(user: StaffProfile | null, moduleId: ModuleId): boolean {
  if (!user) return false;
  switch (moduleId) {
    case 'dashboard':
      return true;
    case 'pos-orders':
      return user.permissions.posOrders.access;
    case 'temp-logs':
      return user.permissions.tempLogs.access;
    case 'atm-cash':
      return user.permissions.atmCash.access;
    case 'fb-posts':
      return user.permissions.fbPosts.access;
    case 'pricematch':
      return user.permissions.pricematch.access;
    case 'settings':
      return user.permissions.adminSettings;
  }
}

export function createRolePresetPermissions(role: string): StaffPermissions {
  const normalized = role.toLowerCase();
  if (normalized.includes('admin') || normalized.includes('owner')) {
    return {
      posOrders: { access: true, canApproveOrders: true, canManageSuppliers: true },
      tempLogs: { access: true, canEditPastLogs: true, canConfigureUnits: true },
      atmCash: { access: true, canLogFeedings: true, canEditCycleCounts: true },
      fbPosts: { access: true, canPublishDirectly: true },
      pricematch: { access: true, canEditPrices: true },
      adminSettings: true,
    };
  }
  if (normalized.includes('manager')) {
    return {
      posOrders: { access: true, canApproveOrders: true, canManageSuppliers: true },
      tempLogs: { access: true, canEditPastLogs: true, canConfigureUnits: true },
      atmCash: { access: true, canLogFeedings: true, canEditCycleCounts: true },
      fbPosts: { access: true, canPublishDirectly: true },
      pricematch: { access: true, canEditPrices: true },
      adminSettings: false,
    };
  }
  return {
    posOrders: { access: false, canApproveOrders: false, canManageSuppliers: false },
    tempLogs: { access: true, canEditPastLogs: false, canConfigureUnits: false },
    atmCash: { access: true, canLogFeedings: false, canEditCycleCounts: false },
    fbPosts: { access: false, canPublishDirectly: false },
    pricematch: { access: false, canEditPrices: false },
    adminSettings: false,
  };
}
