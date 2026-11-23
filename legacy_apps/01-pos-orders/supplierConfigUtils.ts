import { WEEKDAYS } from './schemaMap';
import type { DeliverySchedule, SupplierConfig, SupplierConfigMap } from './types';

export function defaultSchedule(): DeliverySchedule {
  return {
    cutOffDay: 'Friday',
    cutOffTime: '10:00',
    deliveryDay: 'Monday',
    departments: [],
  };
}

export function formatTime(timeStr: string): string {
  if (!timeStr) return '';
  const parts = timeStr.split(':');
  if (parts.length < 2) return timeStr;
  let hours = parseInt(parts[0], 10);
  const minutes = parts[1].padStart(2, '0');
  if (isNaN(hours)) return timeStr;
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  if (hours === 0) hours = 12;
  return `${hours}:${minutes} ${ampm}`;
}

export function formatSchedule(s: DeliverySchedule): string {
  if (!s) return 'Default Schedule';
  const deptsStr = s.departments && s.departments.length > 0 ? ` (${s.departments.join(', ')})` : '';
  const storeStr = s.storeName ? ` [${s.storeName}]` : (s.storeId && s.storeId !== 'all' ? ` [Store #${s.storeId}]` : '');
  return `Cut-off: ${s.cutOffDay} ${formatTime(s.cutOffTime)} → Delivery: ${s.deliveryDay}${deptsStr}${storeStr}`;
}

export function getCoverageDays(cutOffDay: string, deliveryDay: string): string[] {
  const daysList = [...WEEKDAYS];
  const startIdx = daysList.indexOf(cutOffDay as any);
  const endIdx = daysList.indexOf(deliveryDay as any);

  if (startIdx === -1 || endIdx === -1) {
    return daysList;
  }

  const result: string[] = [];
  let curr = startIdx;

  while (true) {
    result.push(daysList[curr]);
    if (curr === endIdx) break;
    curr = (curr + 1) % daysList.length;
    if (result.length > 7) break; // prevent infinite loop
  }

  return result;
}

export function normalizeSupplierConfig(raw: any): SupplierConfig {
  if (!raw || typeof raw !== 'object') {
    return {
      schedules: [defaultSchedule()],
      safetyMultiplier: 1.2,
    };
  }

  let schedules: DeliverySchedule[] = [];
  if (Array.isArray(raw.schedules) && raw.schedules.length > 0) {
    schedules = raw.schedules.map((s: any) => ({
      cutOffDay: s.cutOffDay || 'Friday',
      cutOffTime: s.cutOffTime || '10:00',
      deliveryDay: s.deliveryDay || 'Monday',
      departments: Array.isArray(s.departments) ? s.departments : [],
      storeId: s.storeId || 'all',
      storeIds: Array.isArray(s.storeIds) ? s.storeIds : (s.storeId && s.storeId !== 'all' ? [s.storeId] : []),
      storeName: s.storeName || undefined,
    }));
  } else if (raw.cutOffDay && raw.deliveryDay) {
    schedules = [
      {
        cutOffDay: raw.cutOffDay,
        cutOffTime: raw.cutOffTime || '10:00',
        deliveryDay: raw.deliveryDay,
        departments: Array.isArray(raw.departments) ? raw.departments : [],
        storeId: raw.storeId || 'all',
        storeIds: Array.isArray(raw.storeIds) ? raw.storeIds : (raw.storeId && raw.storeId !== 'all' ? [raw.storeId] : []),
        storeName: raw.storeName || undefined,
      },
    ];
  } else {
    schedules = [defaultSchedule()];
  }

  const safetyMultiplier =
    typeof raw.safetyMultiplier === 'number' && raw.safetyMultiplier >= 1
      ? raw.safetyMultiplier
      : typeof raw.safetyBufferPct === 'number'
      ? 1 + raw.safetyBufferPct / 100
      : 1.2;

  return {
    schedules,
    safetyMultiplier,
  };
}

export function normalizeSupplierConfigMap(raw: any): SupplierConfigMap {
  if (!raw || typeof raw !== 'object') return {};
  const result: SupplierConfigMap = {};

  // If raw is a single corrupted config object like { supplierId: "1", schedules: [...] }
  if (raw.supplierId && Array.isArray(raw.schedules)) {
    result[String(raw.supplierId)] = normalizeSupplierConfig(raw);
    return result;
  }

  for (const key of Object.keys(raw)) {
    if (key !== 'supplierId' && key !== 'schedules' && key !== 'safetyMultiplier') {
      result[key] = normalizeSupplierConfig(raw[key]);
    }
  }
  return result;
}

export function findConfigForSupplier(
  supplier: { id?: string | number; code?: string; name?: string } | string | number | null | undefined,
  configs: SupplierConfigMap,
  suppliersList?: any[]
): SupplierConfig | null {
  if (!supplier || !configs) return null;

  let sId = '';
  let sCode = '';
  let sName = '';

  if (typeof supplier === 'string' || typeof supplier === 'number') {
    sId = String(supplier);
    if (suppliersList && Array.isArray(suppliersList)) {
      const foundSup = suppliersList.find((sup) => {
        const supId = String(sup.id ?? sup.supplierId ?? sup.SupplierID ?? '');
        const supCode = String(sup.code ?? sup.SupplierCode ?? '');
        const supName = String(sup.name ?? sup.SupplierName ?? '');
        return (
          supId === sId ||
          (supCode && supCode.toLowerCase() === sId.toLowerCase()) ||
          (supName && supName.toLowerCase() === sId.toLowerCase())
        );
      });
      if (foundSup) {
        sId = String(foundSup.id ?? foundSup.supplierId ?? foundSup.SupplierID ?? sId);
        sCode = String(foundSup.code ?? foundSup.SupplierCode ?? '');
        sName = String(foundSup.name ?? foundSup.SupplierName ?? '');
      }
    }
  } else {
    sId = String(supplier.id ?? '');
    sCode = String(supplier.code ?? '');
    sName = String(supplier.name ?? '');
  }

  // 1. Direct keys
  if (sId && configs[sId]) return configs[sId];
  if (sCode && configs[sCode]) return configs[sCode];
  if (sName && configs[sName]) return configs[sName];

  // 2. Case-insensitive keys
  for (const [key, cfg] of Object.entries(configs)) {
    const kLow = key.toLowerCase();
    if (
      (sId && kLow === sId.toLowerCase()) ||
      (sCode && kLow === sCode.toLowerCase()) ||
      (sName && kLow === sName.toLowerCase())
    ) {
      return cfg;
    }
  }

  return null;
}

export function pickNextScheduleIndex(schedules: DeliverySchedule[]): number {
  if (!schedules || schedules.length === 0) return 0;
  if (schedules.length === 1) return 0;

  const today = new Date();
  const dayNames = [...WEEKDAYS];
  const currentDayName = dayNames[today.getDay() === 0 ? 6 : today.getDay() - 1];

  for (let i = 0; i < schedules.length; i++) {
    if (schedules[i].cutOffDay === currentDayName) {
      return i;
    }
  }

  return 0;
}

export interface UpcomingCutoffOccurrence {
  scheduleIndex: number;
  cutoffDate: Date;
  deliveryDate: Date;
  cutoffDayName: string;
  deliveryDayName: string;
  cutoffTimeStr: string;
  displayText: string;
}

const DAY_MAP: Record<string, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

export function getUpcomingCutoffOccurrences(
  schedules: DeliverySchedule[],
  count = 4,
  referenceDate = new Date()
): UpcomingCutoffOccurrence[] {
  if (!schedules || schedules.length === 0) return [];

  const occurrences: UpcomingCutoffOccurrence[] = [];
  const refTime = referenceDate.getTime();

  schedules.forEach((s, scheduleIndex) => {
    const targetCutoffDayNum = DAY_MAP[s.cutOffDay];
    const targetDeliveryDayNum = DAY_MAP[s.deliveryDay];

    if (typeof targetCutoffDayNum !== 'number' || typeof targetDeliveryDayNum !== 'number') return;

    const timeParts = (s.cutOffTime || '10:00').split(':');
    const cutHours = parseInt(timeParts[0], 10) || 10;
    const cutMins = parseInt(timeParts[1], 10) || 0;

    for (let dayOffset = 0; dayOffset <= 56; dayOffset++) {
      const candidateCutoff = new Date(referenceDate);
      candidateCutoff.setDate(candidateCutoff.getDate() + dayOffset);
      candidateCutoff.setHours(cutHours, cutMins, 0, 0);

      if (candidateCutoff.getDay() === targetCutoffDayNum) {
        if (candidateCutoff.getTime() >= refTime - 60000) {
          const candidateDelivery = new Date(candidateCutoff);
          let delOffset = 0;
          while (delOffset < 7) {
            if (delOffset > 0) {
              candidateDelivery.setDate(candidateDelivery.getDate() + 1);
            }
            if (candidateDelivery.getDay() === targetDeliveryDayNum) {
              break;
            }
            delOffset++;
          }

          const formatDM = (d: Date) => {
            const day = String(d.getDate()).padStart(2, '0');
            const month = String(d.getMonth() + 1).padStart(2, '0');
            return `${day}/${month}`;
          };

          const timeFormatted = formatTime(s.cutOffTime);

          const displayText = `Cut-off ${s.cutOffDay} ${formatDM(candidateCutoff)} ${timeFormatted} · Delivery ${s.deliveryDay} ${formatDM(candidateDelivery)}`;

          occurrences.push({
            scheduleIndex,
            cutoffDate: candidateCutoff,
            deliveryDate: candidateDelivery,
            cutoffDayName: s.cutOffDay,
            deliveryDayName: s.deliveryDay,
            cutoffTimeStr: s.cutOffTime,
            displayText,
          });
        }
      }
    }
  });

  occurrences.sort((a, b) => a.cutoffDate.getTime() - b.cutoffDate.getTime());

  return occurrences.slice(0, count);
}

/**
 * Filters supplier schedules specifically for a given store location ID.
 * If store-specific schedules exist for the store, returns those;
 * otherwise falls back to global ("all" or unspecified) schedules.
 */
export function getSchedulesForStore(
  schedules: DeliverySchedule[] | undefined,
  storeId?: string | number | null
): DeliverySchedule[] {
  if (!schedules || schedules.length === 0) return [defaultSchedule()];
  if (!storeId || storeId === 'all') return schedules;

  const targetStr = String(storeId);
  const storeSpecific = schedules.filter((s) => {
    if (s.storeId && String(s.storeId) === targetStr) return true;
    if (Array.isArray(s.storeIds) && s.storeIds.some((id) => String(id) === targetStr)) return true;
    return false;
  });

  if (storeSpecific.length > 0) {
    return storeSpecific;
  }

  // Fallback to global schedules (marked 'all' or with no specific storeId)
  const globalSchedules = schedules.filter(
    (s) => !s.storeId || s.storeId === 'all' || !s.storeIds || s.storeIds.length === 0
  );

  return globalSchedules.length > 0 ? globalSchedules : schedules;
}

