import {
  AppNotification,
  DayShift,
  Equipment,
  KsbmCurrentUser,
  KsbmPermissions,
  ModuleDashboardSummary,
  TempRecord,
} from '../types';

export interface ResolvedPermissions {
  canViewDashboard: boolean;
  canLogTemperature: boolean;
  canManageEquipment: boolean;
  canExportReports: boolean;
  canManageSettings: boolean;
  canSyncIoT: boolean;
  canUseBackdateAudit: boolean;
}

export const resolvePermissions = (user: KsbmCurrentUser): ResolvedPermissions => {
  const isAdminLike = user.role === 'admin' || user.role === 'manager';
  const isViewer = user.role === 'viewer';
  const explicit: KsbmPermissions = user.permissions || {};

  return {
    canViewDashboard: explicit.canViewDashboard ?? true,
    canLogTemperature: explicit.canLogTemperature ?? !isViewer,
    canManageEquipment: explicit.canManageEquipment ?? isAdminLike,
    canExportReports: explicit.canExportReports ?? !isViewer,
    canManageSettings: explicit.canManageSettings ?? isAdminLike,
    canSyncIoT: explicit.canSyncIoT ?? !isViewer,
    canUseBackdateAudit: explicit.canUseBackdateAudit ?? user.role === 'admin',
  };
};

export const getAlertThresholds = (equip: Equipment): { minNotify: number; maxNotify: number } => {
  return {
    minNotify: equip.notifyMinThreshold !== undefined ? equip.notifyMinThreshold : equip.tempMinThreshold,
    maxNotify: equip.notifyMaxThreshold !== undefined ? equip.notifyMaxThreshold : equip.tempMaxThreshold,
  };
};

export const isTempOutOfZone = (temp: number, equip: Equipment): boolean => {
  const { minNotify, maxNotify } = getAlertThresholds(equip);
  return temp < minNotify || temp > maxNotify;
};

export const parseJaaleeTimestamp = (val: unknown): number => {
  if (!val) return Date.now();
  if (typeof val === 'number') {
    return val < 10000000000 ? val * 1000 : val;
  }
  if (typeof val === 'string') {
    const num = Number(val);
    if (!isNaN(num)) {
      return num < 10000000000 ? num * 1000 : num;
    }
    const parsed = Date.parse(val);
    if (!isNaN(parsed)) {
      return parsed;
    }
    const cleaned = val.replace(/\s+/g, 'T');
    const parsedCleaned = Date.parse(cleaned);
    if (!isNaN(parsedCleaned)) {
      return parsedCleaned;
    }
  }
  return Date.now();
};

export const getShiftStatus = (dailyShifts?: Record<string, DayShift>): { active: boolean; shiftStart?: string; shiftEnd?: string } => {
  // If KSBM does not supply per-user shift schedules, default to active shift so compliance reminders work
  if (!dailyShifts) {
    return { active: true, shiftStart: '06:00', shiftEnd: '22:00' };
  }

  const now = new Date();
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const currentDay = days[now.getDay()];
  const dayConfig = dailyShifts[currentDay];

  if (!dayConfig || !dayConfig.active || !dayConfig.start || !dayConfig.end) {
    return { active: false };
  }

  const [startH, startM] = dayConfig.start.split(':').map(Number);
  const [endH, endM] = dayConfig.end.split(':').map(Number);
  const currentTotal = now.getHours() * 60 + now.getMinutes();

  const active = currentTotal >= startH * 60 + startM && currentTotal <= endH * 60 + endM;
  return {
    active,
    shiftStart: dayConfig.start,
    shiftEnd: dayConfig.end,
  };
};

export const getOverdueCheckpoints = (
  records: TempRecord[],
  reminderTimes: string[],
  dailyShifts?: Record<string, DayShift>
): string[] => {
  const { active, shiftStart } = getShiftStatus(dailyShifts);
  if (!active || !shiftStart) return [];

  const now = new Date();
  const currentTotal = now.getHours() * 60 + now.getMinutes();
  const [startH, startM] = shiftStart.split(':').map(Number);
  const startTotal = startH * 60 + startM;

  const todayLocalDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const todayManualRecords = records.filter((r) => {
    if (!r.timestamp || !r.isManual) return false;
    const rDate = new Date(r.timestamp);
    const rLocalDateStr = `${rDate.getFullYear()}-${String(rDate.getMonth() + 1).padStart(2, '0')}-${String(rDate.getDate()).padStart(2, '0')}`;
    return rLocalDateStr === todayLocalDateStr;
  });

  const overdue: string[] = [];
  for (const time of reminderTimes) {
    const [h, m] = time.split(':').map(Number);
    const checkpointTotal = h * 60 + m;

    if (checkpointTotal >= startTotal && checkpointTotal <= currentTotal) {
      const isLogged = todayManualRecords.some((r) => {
        const rTime = new Date(r.timestamp);
        const rTotal = rTime.getHours() * 60 + rTime.getMinutes();
        return Math.abs(rTotal - checkpointTotal) <= 60;
      });
      if (!isLogged) {
        overdue.push(time);
      }
    }
  }

  return overdue;
};

export const playAlertTone = (): void => {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(523.25, ctx.currentTime);
    gain1.gain.setValueAtTime(0.08, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + 0.25);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start();
    osc1.stop(ctx.currentTime + 0.3);

    setTimeout(() => {
      try {
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(659.25, ctx.currentTime);
        gain2.gain.setValueAtTime(0.08, ctx.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + 0.3);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start();
        osc2.stop(ctx.currentTime + 0.35);
      } catch {
        // Ignore audio context errors
      }
    }, 150);
  } catch {
    // Ignore audio context errors
  }
};

export const computeDashboardSummary = (
  equipments: Equipment[],
  records: TempRecord[],
  notifications: AppNotification[],
  overdueCheckpoints: string[],
  lastSyncTime?: string
): ModuleDashboardSummary => {
  let compliantUnits = 0;

  equipments.forEach((eq) => {
    const eqRecords = records.filter((r) => r.equipmentId === eq.id);
    if (eqRecords.length === 0) return;
    const latest = eqRecords.sort((a, b) => b.timestamp - a.timestamp)[0];
    if (!isTempOutOfZone(latest.temperature, eq)) {
      compliantUnits++;
    }
  });

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const todayRecords = records.filter((r) => r.timestamp >= startOfToday);
  let todayFailures = 0;
  todayRecords.forEach((r) => {
    const eq = equipments.find((e) => e.id === r.equipmentId);
    if (eq && (r.temperature < eq.tempMinThreshold || r.temperature > eq.tempMaxThreshold)) {
      todayFailures++;
    }
  });

  const todayComplianceRate =
    todayRecords.length > 0
      ? Math.round(((todayRecords.length - todayFailures) / todayRecords.length) * 100)
      : 100;

  return {
    totalUnits: equipments.length,
    compliantUnits,
    activeBreachAlerts: notifications.filter((n) => !n.resolved).length,
    overdueCheckpointsCount: overdueCheckpoints.length,
    todayComplianceRate,
    lastSyncTime,
  };
};
