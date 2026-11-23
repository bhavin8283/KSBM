import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { BusinessConfig, StaffProfile } from '../types';

const BUSINESS_CONFIG_STORAGE_KEY = 'ksbm_business_config_v1';
const STAFF_LIST_STORAGE_KEY = 'ksbm_staff_list_v1';

export const DEFAULT_BUSINESS_CONFIG: BusinessConfig = {
  storeName: 'Kwik Stop',
  address: '92 Queens Rd, Hermit Park QLD 4812',
  phone: '(07) 4725 8910',
  abn: '48 612 930 415',
  operatingHours: 'Mon–Sun · 5:30 AM – 10:00 PM',
  fridgeTempRange: { min: 0, max: 5 },
  freezerTempRange: { min: -22, max: -15 },
  atmLowCashAlert: 1500,
  defaultSuppliers: [
    'Metcash / IGA Wholesale',
    'Coca-Cola Europacific',
    'Bidfood Townsville',
    'Asahi Beverages',
    'Tip Top Bakeries',
  ],
};

export const DEFAULT_STAFF_LIST: StaffProfile[] = [
  {
    id: 'staff-01',
    name: 'Bhavin Patel',
    role: 'Admin / Owner',
    pin: '1234',
    active: true,
    shiftLabel: 'Full Store Access',
    permissions: {
      posOrders: { access: true, canApproveOrders: true, canManageSuppliers: true },
      tempLogs: { access: true, canEditPastLogs: true, canConfigureUnits: true },
      atmCash: { access: true, canLogFeedings: true, canEditCycleCounts: true },
      fbPosts: { access: true, canPublishDirectly: true },
      pricematch: { access: true, canEditPrices: true },
      adminSettings: true,
    },
  },
  {
    id: 'staff-02',
    name: 'Sarah Jenkins',
    role: 'Store Manager',
    pin: '5678',
    active: true,
    shiftLabel: 'Shift Supervisor',
    permissions: {
      posOrders: { access: true, canApproveOrders: true, canManageSuppliers: true },
      tempLogs: { access: true, canEditPastLogs: true, canConfigureUnits: true },
      atmCash: { access: true, canLogFeedings: true, canEditCycleCounts: true },
      fbPosts: { access: true, canPublishDirectly: true },
      pricematch: { access: true, canEditPrices: true },
      adminSettings: false,
    },
  },
  {
    id: 'staff-03',
    name: 'Marcus Chen',
    role: 'Floor Staff',
    pin: '0000',
    active: true,
    shiftLabel: 'Counter & Stock',
    permissions: {
      posOrders: { access: false, canApproveOrders: false, canManageSuppliers: false },
      tempLogs: { access: true, canEditPastLogs: false, canConfigureUnits: false },
      atmCash: { access: true, canLogFeedings: false, canEditCycleCounts: false },
      fbPosts: { access: false, canPublishDirectly: false },
      pricematch: { access: false, canEditPrices: false },
      adminSettings: false,
    },
  },
];

function loadBusinessConfig(): BusinessConfig {
  try {
    const raw = localStorage.getItem(BUSINESS_CONFIG_STORAGE_KEY);
    if (!raw) return DEFAULT_BUSINESS_CONFIG;
    const parsed = JSON.parse(raw) as Partial<BusinessConfig>;
    return {
      ...DEFAULT_BUSINESS_CONFIG,
      ...parsed,
      fridgeTempRange: {
        ...DEFAULT_BUSINESS_CONFIG.fridgeTempRange,
        ...(parsed.fridgeTempRange ?? {}),
      },
      freezerTempRange: {
        ...DEFAULT_BUSINESS_CONFIG.freezerTempRange,
        ...(parsed.freezerTempRange ?? {}),
      },
      defaultSuppliers: Array.isArray(parsed.defaultSuppliers)
        ? parsed.defaultSuppliers
        : DEFAULT_BUSINESS_CONFIG.defaultSuppliers,
    };
  } catch {
    return DEFAULT_BUSINESS_CONFIG;
  }
}

function loadStaffList(): StaffProfile[] {
  try {
    const raw = localStorage.getItem(STAFF_LIST_STORAGE_KEY);
    if (!raw) return DEFAULT_STAFF_LIST;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return DEFAULT_STAFF_LIST;
    }
    return parsed as StaffProfile[];
  } catch {
    return DEFAULT_STAFF_LIST;
  }
}

export interface StaffActionResult {
  success: boolean;
  error?: string;
  staff?: StaffProfile;
}

interface StoreContextValue {
  businessConfig: BusinessConfig;
  updateBusinessConfig: (newConfig: BusinessConfig) => void;
  staffList: StaffProfile[];
  addStaffMember: (input: Omit<StaffProfile, 'id'>) => StaffActionResult;
  updateStaffMember: (
    id: string,
    updates: Partial<Omit<StaffProfile, 'id'>>
  ) => StaffActionResult;
  deleteStaffMember: (id: string) => StaffActionResult;
}

const StoreContext = createContext<StoreContextValue | undefined>(undefined);

function isAdminAccount(staff: StaffProfile): boolean {
  return staff.active && staff.permissions.adminSettings;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [businessConfig, setBusinessConfig] = useState<BusinessConfig>(loadBusinessConfig);
  const [staffList, setStaffList] = useState<StaffProfile[]>(loadStaffList);

  useEffect(() => {
    try {
      localStorage.setItem(BUSINESS_CONFIG_STORAGE_KEY, JSON.stringify(businessConfig));
    } catch {
      // Ignore storage quota errors in restricted sandboxes
    }
  }, [businessConfig]);

  useEffect(() => {
    try {
      localStorage.setItem(STAFF_LIST_STORAGE_KEY, JSON.stringify(staffList));
    } catch {
      // Ignore storage quota errors in restricted sandboxes
    }
  }, [staffList]);

  const updateBusinessConfig = (newConfig: BusinessConfig) => {
    setBusinessConfig({
      ...newConfig,
      defaultSuppliers: newConfig.defaultSuppliers
        .map((s) => s.trim())
        .filter((s) => s.length > 0),
    });
  };

  const addStaffMember = (input: Omit<StaffProfile, 'id'>): StaffActionResult => {
    const name = input.name.trim();
    const role = input.role.trim();
    const pin = input.pin.trim();

    if (!name) {
      return { success: false, error: 'Staff member name is required.' };
    }
    if (!role) {
      return { success: false, error: 'Staff role label is required.' };
    }
    if (!/^\d{4}$/.test(pin)) {
      return { success: false, error: 'PIN must be exactly 4 numeric digits.' };
    }
    if (staffList.some((member) => member.pin === pin)) {
      return { success: false, error: `PIN ${pin} is already assigned to another staff member.` };
    }

    const newStaff: StaffProfile = {
      ...input,
      id: `staff-${Date.now().toString(36)}`,
      name,
      role,
      pin,
      shiftLabel: input.shiftLabel?.trim() || role,
    };

    setStaffList((prev) => [...prev, newStaff]);
    return { success: true, staff: newStaff };
  };

  const updateStaffMember = (
    id: string,
    updates: Partial<Omit<StaffProfile, 'id'>>
  ): StaffActionResult => {
    const target = staffList.find((member) => member.id === id);
    if (!target) {
      return { success: false, error: 'Staff member not found.' };
    }

    const nextPin = updates.pin !== undefined ? updates.pin.trim() : target.pin;
    if (!/^\d{4}$/.test(nextPin)) {
      return { success: false, error: 'PIN must be exactly 4 numeric digits.' };
    }
    if (staffList.some((member) => member.id !== id && member.pin === nextPin)) {
      return {
        success: false,
        error: `PIN ${nextPin} is already assigned to another staff member.`,
      };
    }

    const nextName = updates.name !== undefined ? updates.name.trim() : target.name;
    const nextRole = updates.role !== undefined ? updates.role.trim() : target.role;
    if (!nextName) {
      return { success: false, error: 'Staff member name cannot be empty.' };
    }
    if (!nextRole) {
      return { success: false, error: 'Staff role cannot be empty.' };
    }

    const nextProfile: StaffProfile = {
      ...target,
      ...updates,
      name: nextName,
      role: nextRole,
      pin: nextPin,
      permissions: updates.permissions ?? target.permissions,
      active: updates.active !== undefined ? updates.active : target.active,
    };

    const activeAdminsAfterUpdate = staffList.filter((member) =>
      member.id === id ? isAdminAccount(nextProfile) : isAdminAccount(member)
    );

    if (activeAdminsAfterUpdate.length === 0) {
      return {
        success: false,
        error: 'At least one active Store Admin with Settings access must remain.',
      };
    }

    setStaffList((prev) => prev.map((member) => (member.id === id ? nextProfile : member)));
    return { success: true, staff: nextProfile };
  };

  const deleteStaffMember = (id: string): StaffActionResult => {
    const target = staffList.find((member) => member.id === id);
    if (!target) {
      return { success: false, error: 'Staff member not found.' };
    }

    const remainingAdmins = staffList.filter(
      (member) => member.id !== id && isAdminAccount(member)
    );
    if (remainingAdmins.length === 0) {
      return {
        success: false,
        error: 'Cannot delete the last active Store Admin account.',
      };
    }

    setStaffList((prev) => prev.filter((member) => member.id !== id));
    return { success: true };
  };

  return (
    <StoreContext.Provider
      value={{
        businessConfig,
        updateBusinessConfig,
        staffList,
        addStaffMember,
        updateStaffMember,
        deleteStaffMember,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore(): StoreContextValue {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
}
