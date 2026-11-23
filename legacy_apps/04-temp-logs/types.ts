/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface DayShift {
  active: boolean;
  start: string; // 24h format e.g. "09:00"
  end: string;   // 24h format e.g. "17:00"
}

export interface KsbmPermissions {
  canViewDashboard?: boolean;
  canLogTemperature?: boolean;
  canManageEquipment?: boolean;
  canExportReports?: boolean;
  canManageSettings?: boolean;
  canSyncIoT?: boolean;
  canUseBackdateAudit?: boolean;
}

export interface KsbmCurrentUser {
  id?: string;
  name: string;
  role: 'admin' | 'manager' | 'staff' | 'viewer' | string;
  permissions?: KsbmPermissions;
  dailyShifts?: Record<string, DayShift>;
}

export interface SmtpConfig {
  host: string;
  port: string;
  username: string;
  senderEmail: string;
  encryption: 'tls' | 'ssl' | 'none' | string;
}

export interface NotificationOptions {
  browserBanner: boolean;
  soundAlert: boolean;
  desktopNotification: boolean;
}

export interface KsbmBusinessConfig {
  name: string;
  address: string;
  email: string;
  phone: string;
  timezone?: string;
  smtpConfig?: SmtpConfig;
  reminderTimes?: string[];
  notificationOptions?: NotificationOptions;
}

export type EquipmentType = 'Fridge' | 'Freezer' | 'Hot Box' | 'Ambient Box' | 'Other';

export interface Equipment {
  id: string;
  name: string;
  type: EquipmentType;
  location: string;
  isJaalee: boolean;
  mac?: string;
  power?: number;
  tempMinThreshold: number;
  tempMaxThreshold: number;
  notifyMinThreshold?: number;
  notifyMaxThreshold?: number;
  createdAt: string;
}

export interface TempRecord {
  id: string;
  equipmentId: string;
  temperature: number;
  humidity?: number;
  timestamp: number; // UNIX timestamp in ms
  enteredBy: string;
  isManual: boolean;
  isDodgy?: boolean;
}

export interface JaaleeConfig {
  account: string;
  token: string;
  isLoggedIn: boolean;
  lastImportTime?: string;
  autoImportHour: boolean;
}

export interface AppNotification {
  id: string;
  equipmentId: string;
  equipmentName: string;
  temperature: number;
  timestamp: number;
  message: string;
  resolved: boolean;
}

export interface ModuleDashboardSummary {
  totalUnits: number;
  compliantUnits: number;
  activeBreachAlerts: number;
  overdueCheckpointsCount: number;
  todayComplianceRate: number;
  lastSyncTime?: string;
}

export interface ModuleEntryProps {
  currentUser: KsbmCurrentUser;
  businessConfig: KsbmBusinessConfig;
  onSummaryUpdate?: (summary: ModuleDashboardSummary) => void;
}
