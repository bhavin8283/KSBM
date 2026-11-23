import { AppNotification, Equipment, TempRecord } from '../types';
import { parseJaaleeTimestamp } from '../utils/compliance';

export interface JaaleeApiResponse<T = unknown> {
  code: number | string;
  message?: string;
  data?: T;
}

export interface JaaleeDeviceRaw {
  type: string;
  mac: string;
  alias?: string;
  power?: number;
  time?: number;
  temperature?: number;
  humidity?: number;
}

export interface JaaleeHistoricalLogRaw {
  id?: string | number;
  temperature: number;
  humidity?: number;
  createTime: number | string;
}

export const requestJaaleeVerificationCode = async (account: string): Promise<JaaleeApiResponse> => {
  const response = await fetch(`/api/jaalee/code?account=${encodeURIComponent(account)}`);
  return response.json();
};

export const loginJaaleeAccount = async (
  account: string,
  code: string,
  timeZone: string = 'GMT+10:00'
): Promise<JaaleeApiResponse<{ token: string }>> => {
  const response = await fetch('/api/jaalee/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ account, code, timeZone }),
  });
  return response.json();
};

export const fetchJaaleeDevices = async (token: string): Promise<JaaleeApiResponse<JaaleeDeviceRaw[]>> => {
  const response = await fetch('/api/jaalee/devices-all', {
    headers: { Authorization: token },
  });
  return response.json();
};

export const fetchJaaleeHistoricalLogs = async (
  token: string,
  bleMac: string,
  type: string,
  size: number = 5000
): Promise<JaaleeApiResponse<{ total?: number; power?: number; list?: JaaleeHistoricalLogRaw[] }>> => {
  const response = await fetch(
    `/api/jaalee/historical?bleMac=${encodeURIComponent(bleMac)}&type=${encodeURIComponent(type)}&size=${size}`,
    { headers: { Authorization: token } }
  );
  return response.json();
};

export const syncAllJaaleeTelemetry = async (
  token: string,
  existingEquipments: Equipment[]
): Promise<{
  devices: JaaleeDeviceRaw[];
  fetchedRecords: TempRecord[];
  fetchedNotifs: AppNotification[];
} | null> => {
  const data = await fetchJaaleeDevices(token);
  if (data.code !== 0 && data.code !== '0') {
    return null;
  }

  const jaaleeDevices = data.data || [];
  const fetchedRecords: TempRecord[] = [];
  const fetchedNotifs: AppNotification[] = [];

  for (const jDev of jaaleeDevices) {
    const histData = await fetchJaaleeHistoricalLogs(token, jDev.mac, jDev.type, 5000);
    if (histData.code === '0' || histData.code === 0) {
      const logs = histData.data?.list || [];
      const equipId = `jaalee-equip-${jDev.mac}`;
      const matchedEquip = existingEquipments.find((e) => e.id === equipId);
      const isFreezer = (jDev.alias || '').toLowerCase().includes('freezer');
      const defaultMin = isFreezer ? -25 : 1;
      const defaultMax = isFreezer ? -15 : 5;

      const minSafety = matchedEquip ? matchedEquip.tempMinThreshold : defaultMin;
      const maxSafety = matchedEquip ? matchedEquip.tempMaxThreshold : defaultMax;
      const minNotify = matchedEquip?.notifyMinThreshold !== undefined ? matchedEquip.notifyMinThreshold : minSafety;
      const maxNotify = matchedEquip?.notifyMaxThreshold !== undefined ? matchedEquip.notifyMaxThreshold : maxSafety;

      logs.forEach((log) => {
        const checkTime = parseJaaleeTimestamp(log.createTime);
        const tempNum = Number(log.temperature);
        const isViolation = tempNum < minNotify || tempNum > maxNotify;

        if (isViolation) {
          fetchedNotifs.push({
            id: `notif-${Date.now()}-${Math.floor(Math.random() * 9999)}-${log.id || Math.random()}`,
            equipmentId: equipId,
            equipmentName: matchedEquip?.name || jDev.alias || 'Jaalee IoT Device',
            temperature: tempNum,
            timestamp: checkTime,
            message: `CRITICAL ALERT (Jaalee IoT): '${matchedEquip?.name || jDev.alias || 'Jaalee Sensor'}' recorded ${tempNum.toFixed(1)}°C outside Alert limits (${minNotify}°C to ${maxNotify}°C)!`,
            resolved: false,
          });
        }

        fetchedRecords.push({
          id: `jaalee-log-${log.id || Date.now()}-${Math.random()}`,
          equipmentId: equipId,
          temperature: tempNum,
          humidity: Number(log.humidity) || 0,
          timestamp: checkTime,
          enteredBy: 'Auto Jaalee',
          isManual: false,
        });
      });
    }
  }

  return { devices: jaaleeDevices, fetchedRecords, fetchedNotifs };
};
