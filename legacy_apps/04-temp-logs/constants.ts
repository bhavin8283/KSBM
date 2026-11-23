import { Equipment, EquipmentType, NotificationOptions, TempRecord } from './types';

export const STORAGE_KEYS = {
  EQUIPMENTS: 'food_temp_equipments',
  RECORDS: 'food_temp_records',
  JAALEE_CONFIG: 'food_temp_jaaleeConfig',
  NOTIFICATIONS: 'food_temp_notifications',
  REMINDER_TIMES: 'food_temp_reminderTimes',
  NOTIFICATION_OPTIONS: 'food_temp_notificationOptions',
  SMTP_CONFIG: 'food_temp_smtpConfig',
  SMTP_PASS: 'food_temp_smtpPass',
} as const;

export const DEFAULT_THRESHOLDS: Record<EquipmentType, { min: number; max: number }> = {
  'Fridge': { min: 1.0, max: 5.0 },
  'Freezer': { min: -25.0, max: -15.0 },
  'Hot Box': { min: 60.0, max: 80.0 },
  'Ambient Box': { min: 10.0, max: 24.0 },
  'Other': { min: 0.0, max: 10.0 },
};

export const DEFAULT_REMINDER_TIMES: string[] = ['10:00', '14:00', '18:00'];

export const DEFAULT_NOTIFICATION_OPTIONS: NotificationOptions = {
  browserBanner: true,
  soundAlert: true,
  desktopNotification: true,
};

export const INITIAL_EQUIPMENTS: Equipment[] = [
  {
    id: 'equip-1',
    name: 'Main Salad Prep Bench Fridge',
    type: 'Fridge',
    location: 'Kitchen Hot-Line',
    isJaalee: false,
    tempMinThreshold: 1.0,
    tempMaxThreshold: 5.0,
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'equip-2',
    name: 'Kitchen Walk-in Cool Room',
    type: 'Fridge',
    location: 'Back Dry Storage',
    isJaalee: false,
    tempMinThreshold: 1.0,
    tempMaxThreshold: 5.0,
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'equip-3',
    name: 'Raw Crustacean Freezer Cabinet',
    type: 'Freezer',
    location: 'Dishwash Station Left',
    isJaalee: false,
    tempMinThreshold: -25.0,
    tempMaxThreshold: -15.0,
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'equip-4',
    name: 'Carvery Hot Holding Cabinet',
    type: 'Hot Box',
    location: 'Buffet Console',
    isJaalee: false,
    tempMinThreshold: 60.0,
    tempMaxThreshold: 80.0,
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

export const generateInitialRecords = (): TempRecord[] => {
  const records: TempRecord[] = [];
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;

  INITIAL_EQUIPMENTS.forEach((eq) => {
    let base = 3.5;
    if (eq.type === 'Freezer') base = -18.2;
    if (eq.type === 'Hot Box') base = 65.5;

    for (let i = 6; i >= 0; i--) {
      const ts = now - i * 4 * oneHour - Math.random() * 10 * 60 * 1000;
      const hour = new Date(ts).getHours();

      if (hour >= 6 && hour <= 20) {
        records.push({
          id: `rec-init-${eq.id}-${i}`,
          equipmentId: eq.id,
          temperature: Math.round((base + (Math.random() * 1.2 - 0.6)) * 10) / 10,
          timestamp: ts,
          enteredBy: 'System Seed',
          isManual: true,
        });
      }
    }
  });

  return records;
};
