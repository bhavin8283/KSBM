import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  FileText,
  LayoutDashboard,
  Sliders,
  Thermometer,
} from 'lucide-react';
import {
  AppNotification,
  Equipment,
  JaaleeConfig,
  ModuleEntryProps,
  NotificationOptions,
  SmtpConfig,
  TempRecord,
} from './types';
import {
  DEFAULT_NOTIFICATION_OPTIONS,
  DEFAULT_REMINDER_TIMES,
  INITIAL_EQUIPMENTS,
  STORAGE_KEYS,
  generateInitialRecords,
} from './constants';
import {
  computeDashboardSummary,
  getAlertThresholds,
  getOverdueCheckpoints,
  playAlertTone,
  resolvePermissions,
} from './utils/compliance';
import { syncAllJaaleeTelemetry } from './services/jaaleeService';
import DashboardTab from './components/DashboardTab';
import EquipmentTab from './components/EquipmentTab';
import ReportTab from './components/ReportTab';
import SettingsTab from './components/SettingsTab';

export type {
  AppNotification,
  DayShift,
  Equipment,
  EquipmentType,
  JaaleeConfig,
  KsbmBusinessConfig,
  KsbmCurrentUser,
  KsbmPermissions,
  ModuleDashboardSummary,
  ModuleEntryProps,
  NotificationOptions,
  SmtpConfig,
  TempRecord,
} from './types';

export { computeDashboardSummary } from './utils/compliance';

export default function ModuleEntry({
  currentUser,
  businessConfig,
  onSummaryUpdate,
}: ModuleEntryProps) {
  const permissions = resolvePermissions(currentUser);

  const [equipments, setEquipments] = useState<Equipment[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.EQUIPMENTS);
    return saved ? JSON.parse(saved) : INITIAL_EQUIPMENTS;
  });

  const [records, setRecords] = useState<TempRecord[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.RECORDS);
    return saved ? JSON.parse(saved) : generateInitialRecords();
  });

  const [jaaleeConfig, setJaaleeConfig] = useState<JaaleeConfig>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.JAALEE_CONFIG);
    return saved
      ? JSON.parse(saved)
      : {
          account: '',
          token: '',
          isLoggedIn: false,
          autoImportHour: true,
        };
  });

  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
    return saved ? JSON.parse(saved) : [];
  });

  const [reminderTimes, setReminderTimes] = useState<string[]>(() => {
    if (businessConfig.reminderTimes) return businessConfig.reminderTimes;
    const saved = localStorage.getItem(STORAGE_KEYS.REMINDER_TIMES);
    return saved ? JSON.parse(saved) : DEFAULT_REMINDER_TIMES;
  });

  const [notificationOptions, setNotificationOptions] = useState<NotificationOptions>(() => {
    if (businessConfig.notificationOptions) return businessConfig.notificationOptions;
    const saved = localStorage.getItem(STORAGE_KEYS.NOTIFICATION_OPTIONS);
    return saved ? JSON.parse(saved) : DEFAULT_NOTIFICATION_OPTIONS;
  });

  const [activeTab, setActiveTab] = useState<'dashboard' | 'equipment' | 'report' | 'settings'>('dashboard');
  const [isSyncingJaalee, setIsSyncingJaalee] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  const [lastBeepMinute, setLastBeepMinute] = useState(-1);
  const [lastPushedCheckpoints, setLastPushedCheckpoints] = useState<string[]>([]);

  // Persist module state in localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.EQUIPMENTS, JSON.stringify(equipments));
  }, [equipments]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.RECORDS, JSON.stringify(records));
  }, [records]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.JAALEE_CONFIG, JSON.stringify(jaaleeConfig));
  }, [jaaleeConfig]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(notifications));
  }, [notifications]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.REMINDER_TIMES, JSON.stringify(reminderTimes));
  }, [reminderTimes]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.NOTIFICATION_OPTIONS, JSON.stringify(notificationOptions));
  }, [notificationOptions]);

  // Sync SMTP config if provided via Master Admin businessConfig
  useEffect(() => {
    if (businessConfig.smtpConfig) {
      localStorage.setItem(STORAGE_KEYS.SMTP_CONFIG, JSON.stringify(businessConfig.smtpConfig));
    }
  }, [businessConfig.smtpConfig]);

  const overdueCheckpoints = getOverdueCheckpoints(records, reminderTimes, currentUser.dailyShifts);

  // Emit live KPIs to KSBM Master Dashboard whenever module metrics change
  useEffect(() => {
    if (onSummaryUpdate) {
      onSummaryUpdate(
        computeDashboardSummary(
          equipments,
          records,
          notifications,
          overdueCheckpoints,
          jaaleeConfig.lastImportTime
        )
      );
    }
  }, [equipments, records, notifications, overdueCheckpoints.length, jaaleeConfig.lastImportTime, onSummaryUpdate]);

  // Hourly background automatic Jaalee scheduler
  useEffect(() => {
    if (!jaaleeConfig.isLoggedIn || !jaaleeConfig.autoImportHour) return;
    const intervalId = setInterval(() => {
      refreshJaaleeData(true);
    }, 60 * 60 * 1000);
    return () => clearInterval(intervalId);
  }, [jaaleeConfig.isLoggedIn, jaaleeConfig.autoImportHour, equipments]);

  // Periodic shift checkpoint alarm checks
  useEffect(() => {
    if (overdueCheckpoints.length > 0) {
      if (notificationOptions.soundAlert) {
        const m = new Date().getMinutes();
        if (m !== lastBeepMinute) {
          playAlertTone();
          setLastBeepMinute(m);
        }
      }

      if (notificationOptions.desktopNotification) {
        const newlyOverdue = overdueCheckpoints.filter((cp) => !lastPushedCheckpoints.includes(cp));
        if (newlyOverdue.length > 0) {
          if ('Notification' in window && Notification.permission === 'granted') {
            try {
              new Notification('Kwik Temp Shift Compliance Due', {
                body: `Attention ${currentUser.name}: You have manual logs due at: ${newlyOverdue.join(', ')}`,
              });
            } catch {
              // Ignore notification fallback errors in embedded contexts
            }
          }
          setLastPushedCheckpoints(overdueCheckpoints);
        }
      }
    } else if (lastPushedCheckpoints.length > 0) {
      setLastPushedCheckpoints([]);
    }
  }, [overdueCheckpoints, lastBeepMinute, lastPushedCheckpoints, notificationOptions, currentUser.name]);

  const logTempReading = (
    equipId: string,
    temp: number,
    staffName: string,
    isManual: boolean,
    humidity?: number,
    customTime?: number
  ) => {
    const targetEquip = equipments.find((e) => e.id === equipId);
    if (!targetEquip) return;

    const recordId = `rec-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const timestamp = customTime || Date.now();

    const newRecord: TempRecord = {
      id: recordId,
      equipmentId: equipId,
      temperature: temp,
      humidity,
      timestamp,
      enteredBy: staffName,
      isManual,
    };

    setRecords((prev) => [...prev, newRecord]);

    const { minNotify, maxNotify } = getAlertThresholds(targetEquip);
    if (temp < minNotify || temp > maxNotify) {
      const newNotif: AppNotification = {
        id: `notif-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        equipmentId: equipId,
        equipmentName: targetEquip.name,
        temperature: temp,
        timestamp,
        message: `CRITICAL ALERT: '${targetEquip.name}' registered ${temp.toFixed(1)}°C outside Alert Limit (${minNotify}°C to ${maxNotify}°C)`,
        resolved: false,
      };
      setNotifications((prev) => [newNotif, ...prev]);
    }
  };

  const handleAddEquipment = (newEquip: Omit<Equipment, 'id' | 'createdAt'>) => {
    const equip: Equipment = {
      ...newEquip,
      id: `equip-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    setEquipments((prev) => [...prev, equip]);
  };

  const handleUpdateEquipment = (updated: Equipment) => {
    setEquipments((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
  };

  const handleDeleteEquipment = (id: string) => {
    setEquipments((prev) => prev.filter((e) => e.id !== id));
  };

  const refreshJaaleeData = async (silent: boolean = false) => {
    if (!jaaleeConfig.isLoggedIn || !jaaleeConfig.token) {
      if (!silent) {
        setSyncNotice('Please link your Jaalee wireless credentials first in Module Settings.');
        setTimeout(() => setSyncNotice(null), 4000);
      }
      return;
    }

    if (!silent) setIsSyncingJaalee(true);

    try {
      const result = await syncAllJaaleeTelemetry(jaaleeConfig.token, equipments);
      if (result) {
        setEquipments((prev) => {
          const updatedList = [...prev];
          result.devices.forEach((jDev) => {
            const existsIdx = updatedList.findIndex((e) => e.isJaalee && e.mac === jDev.mac);
            const mappingType = (jDev.alias || '').toLowerCase().includes('freezer') ? 'Freezer' : 'Fridge';
            const defaultLimits = mappingType === 'Freezer' ? { min: -25.0, max: -15.0 } : { min: 1.0, max: 5.0 };

            if (existsIdx > -1) {
              updatedList[existsIdx] = {
                ...updatedList[existsIdx],
                power: jDev.power,
              };
            } else {
              updatedList.push({
                id: `jaalee-equip-${jDev.mac}`,
                name: jDev.alias || `Jaalee IoT Sensor (${jDev.mac.slice(-4)})`,
                type: mappingType,
                location: 'Main Store Room',
                isJaalee: true,
                mac: jDev.mac,
                power: jDev.power,
                tempMinThreshold: defaultLimits.min,
                tempMaxThreshold: defaultLimits.max,
                notifyMinThreshold: defaultLimits.min,
                notifyMaxThreshold: defaultLimits.max,
                createdAt: new Date().toISOString(),
              });
            }
          });
          return updatedList;
        });

        if (result.fetchedRecords.length > 0) {
          setRecords((prev) => {
            const merged = [...prev];
            result.fetchedRecords.forEach((newRec) => {
              const alreadyHas = merged.some(
                (r) => r.equipmentId === newRec.equipmentId && Math.abs(r.timestamp - newRec.timestamp) < 5000
              );
              if (!alreadyHas) merged.push(newRec);
            });
            return merged.sort((a, b) => b.timestamp - a.timestamp);
          });
        }

        if (result.fetchedNotifs.length > 0) {
          setNotifications((prev) => {
            const mergedNotifs = [...prev];
            result.fetchedNotifs.forEach((newNotif) => {
              const alreadyHas = mergedNotifs.some(
                (n) => n.equipmentId === newNotif.equipmentId && Math.abs(n.timestamp - newNotif.timestamp) < 5000
              );
              if (!alreadyHas) mergedNotifs.push(newNotif);
            });
            return mergedNotifs;
          });
        }

        setJaaleeConfig((prev) => ({
          ...prev,
          lastImportTime: new Date().toLocaleString('en-AU'),
        }));
      }
    } catch (err) {
      console.error('Jaalee Sync Error:', err);
    } finally {
      if (!silent) setIsSyncingJaalee(false);
    }
  };

  const handleTriggerDodgySpawner = (days: number): number => {
    let generatedCount = 0;
    const manualEquipList = equipments.filter((e) => !e.isJaalee);
    if (manualEquipList.length === 0) return 0;

    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    const recordsToPush: TempRecord[] = [];

    const existingDates = new Set<string>();
    records.forEach((r) => {
      const dDate = new Date(r.timestamp);
      existingDates.add(`${dDate.getFullYear()}-${dDate.getMonth()}-${dDate.getDate()}`);
    });

    for (let d = days; d > 0; d--) {
      const dayBase = now - d * 24 * oneHour;
      const dateObj = new Date(dayBase);
      const dateKey = `${dateObj.getFullYear()}-${dateObj.getMonth()}-${dateObj.getDate()}`;
      if (existingDates.has(dateKey)) continue;

      const checklistTimes = [
        { hour: 7, minute: 12 },
        { hour: 11, minute: 42 },
        { hour: 15, minute: 23 },
        { hour: 19, minute: 51 },
      ];

      manualEquipList.forEach((equip, index) => {
        checklistTimes.forEach((slot) => {
          const jitterMin = index * 2 + Math.floor(Math.random() * 3);
          const dateOfRecord = new Date(
            dateObj.getFullYear(),
            dateObj.getMonth(),
            dateObj.getDate(),
            slot.hour,
            slot.minute + jitterMin
          );
          const timestamp = dateOfRecord.getTime();
          if (timestamp > now) return;

          let temperature = 3.8;
          if (equip.type === 'Fridge') temperature = 3.1 + Math.random() * 1.5;
          else if (equip.type === 'Freezer') temperature = -19.4 + Math.random() * 3.3;
          else if (equip.type === 'Hot Box') temperature = 62.3 + Math.random() * 5.5;
          else if (equip.type === 'Ambient Box') temperature = 16.5 + Math.random() * 3.9;
          else temperature = 4.0 + Math.random() * 2.0;

          temperature = Math.round(temperature * 10) / 10;

          recordsToPush.push({
            id: `dodgy-${Date.now()}-${equip.id}-${timestamp}`,
            equipmentId: equip.id,
            temperature,
            timestamp,
            enteredBy: currentUser.name || 'Admin',
            isManual: true,
            isDodgy: true,
          });
          generatedCount++;
        });
      });
    }

    setRecords((prev) => [...recordsToPush, ...prev]);
    return generatedCount;
  };

  const handleImportModuleData = (data: {
    smtpConfig?: SmtpConfig;
    equipments?: Equipment[];
    records?: TempRecord[];
    reminderTimes?: string[];
  }) => {
    if (data.smtpConfig) {
      localStorage.setItem(STORAGE_KEYS.SMTP_CONFIG, JSON.stringify(data.smtpConfig));
    }
    if (data.reminderTimes) {
      setReminderTimes(data.reminderTimes);
    }
    if (data.equipments && data.equipments.length > 0) {
      setEquipments((prev) => {
        const jaaleeEquips = prev.filter((e) => e.isJaalee);
        const importedIds = new Set(data.equipments!.map((e) => e.id));
        const remainingPrevs = prev.filter((e) => !e.isJaalee && !importedIds.has(e.id));
        return [...jaaleeEquips, ...remainingPrevs, ...data.equipments!];
      });
    }
    if (data.records && data.records.length > 0) {
      setRecords((prev) => {
        const importedRecordIds = new Set(data.records!.map((r) => r.id));
        const existingFilter = prev.filter((r) => !importedRecordIds.has(r.id));
        return [...existingFilter, ...data.records!].sort((a, b) => b.timestamp - a.timestamp);
      });
    }
  };

  const handleResetModuleData = (mode: 'empty' | 'demo') => {
    if (mode === 'empty') {
      setEquipments([]);
      setRecords([]);
      setNotifications([]);
      setJaaleeConfig({
        account: '',
        token: '',
        isLoggedIn: false,
        autoImportHour: true,
      });
      localStorage.removeItem(STORAGE_KEYS.SMTP_CONFIG);
    } else {
      setEquipments(INITIAL_EQUIPMENTS);
      setRecords(generateInitialRecords());
      setNotifications([]);
      setJaaleeConfig({
        account: '',
        token: '',
        isLoggedIn: false,
        autoImportHour: true,
      });
      localStorage.removeItem(STORAGE_KEYS.SMTP_CONFIG);
    }
  };

  const dismissNotification = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, resolved: true } : n)));
  };

  return (
    <div className="w-full font-sans text-slate-800 space-y-6">
      {/* Compact Internal Module Sub-View Switcher (Shell-agnostic) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-2 flex flex-wrap items-center justify-between gap-2 no-print shadow-2xs">
        <div className="flex flex-wrap gap-1.5 bg-slate-100 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              activeTab === 'dashboard' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            Safety Dashboard
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('equipment')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              activeTab === 'equipment' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Thermometer className="w-4 h-4" />
            Equipment Grid
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('report')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              activeTab === 'report' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileText className="w-4 h-4" />
            Audit Reports
          </button>
          {permissions.canManageSettings && (
            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                activeTab === 'settings' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Sliders className="w-4 h-4" />
              Module Settings & IoT
            </button>
          )}
        </div>

        <div className="px-2 text-[11px] text-slate-400 font-medium hidden sm:block">
          {businessConfig.name}
        </div>
      </div>

      {/* Sync Notice */}
      {syncNotice && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl text-xs font-semibold no-print">
          {syncNotice}
        </div>
      )}

      {/* Active Shift Overdue Banner */}
      {notificationOptions.browserBanner && overdueCheckpoints.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl py-3.5 px-4 sm:px-6 no-print">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="bg-amber-100 text-amber-800 p-2 rounded-lg mt-0.5 shrink-0">
                <Bell className="w-5 h-5 animate-bounce stroke-[2.5]" />
              </div>
              <div>
                <h4 className="text-sm font-black text-amber-900 tracking-tight">Manual Temperature Logging Overdue</h4>
                <p className="text-[11px] text-amber-800 font-bold leading-normal pt-1">
                  Hey <span className="underline decoration-2 decoration-amber-400 font-extrabold">{currentUser.name}</span>, food safety compliance checklists require manual temperature readings for checkpoint(s):{' '}
                  <strong className="font-mono text-xs bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded text-amber-900 font-extrabold">
                    {overdueCheckpoints.join(', ')}
                  </strong>.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('dashboard')}
              className="bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl shrink-0 transition-all cursor-pointer shadow-xs border border-amber-500 uppercase tracking-wide whitespace-nowrap self-end sm:self-auto"
            >
              Log Readings Now ➜
            </button>
          </div>
        </div>
      )}

      {/* Active Food Safety Excursion Broadcast Banner */}
      {notifications.filter((n) => !n.resolved).length > 0 && (
        <div className="bg-red-600 text-white py-3 px-4 rounded-2xl shadow-md no-print border border-red-700">
          <div className="flex items-start sm:items-center justify-between gap-3 text-xs sm:text-sm font-semibold">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 shrink-0 text-white" />
              <span>
                <strong>Food Safety Notice:</strong> Out-of-zone temperatures detected! Resolve cabinet excursions immediately to maintain compliant food licensing parameters.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setNotifications((prev) => prev.map((n) => ({ ...n, resolved: true })))}
              className="bg-white/10 hover:bg-white/20 text-white px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer transition-all border border-white/20"
            >
              Acknowledge All
            </button>
          </div>
        </div>
      )}

      {/* Unresolved Alert Cards */}
      {notifications.filter((n) => !n.resolved).length > 0 && (
        <div className="space-y-2 no-print">
          <h3 className="text-xs uppercase font-extrabold tracking-widest text-slate-400 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            Active Food Safety Deviations ({notifications.filter((n) => !n.resolved).length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {notifications
              .filter((n) => !n.resolved)
              .map((notif) => (
                <div
                  key={notif.id}
                  className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3 text-red-900 justify-between items-start text-xs"
                >
                  <div>
                    <span className="font-bold text-red-800 line-clamp-1">{notif.equipmentName} Breach</span>
                    <p className="mt-1 leading-relaxed">{notif.message}</p>
                    <span className="text-[10px] text-slate-400 block pt-1.5 font-mono">
                      Triggered at {new Date(notif.timestamp).toLocaleTimeString('en-AU')}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => dismissNotification(notif.id)}
                    className="bg-red-100 hover:bg-red-200 text-red-800 px-2 py-1 rounded-lg text-[10px] text-center font-bold cursor-pointer transition-all shrink-0"
                    title="Dismiss Warning"
                  >
                    Dismiss
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Sub-View Router */}
      <div>
        {activeTab === 'dashboard' && (
          <DashboardTab
            equipments={equipments}
            records={records}
            currentUser={currentUser}
            canLogTemperature={permissions.canLogTemperature}
            canSyncIoT={permissions.canSyncIoT}
            onAddTempRecord={logTempReading}
            onRefreshJaalee={() => refreshJaaleeData(false)}
            isSyncingJaalee={isSyncingJaalee}
            jaaleeConfig={jaaleeConfig}
          />
        )}

        {activeTab === 'equipment' && (
          <EquipmentTab
            equipments={equipments}
            onAddEquipment={handleAddEquipment}
            onUpdateEquipment={handleUpdateEquipment}
            onDeleteEquipment={handleDeleteEquipment}
            canManageEquipment={permissions.canManageEquipment}
          />
        )}

        {activeTab === 'report' && (
          <ReportTab
            equipments={equipments}
            records={records}
            businessConfig={businessConfig}
            canExportReports={permissions.canExportReports}
          />
        )}

        {activeTab === 'settings' && permissions.canManageSettings && (
          <SettingsTab
            canManageSettings={permissions.canManageSettings}
            canUseBackdateAudit={permissions.canUseBackdateAudit}
            jaaleeConfig={jaaleeConfig}
            onUpdateJaaleeConfig={setJaaleeConfig}
            onTriggerDodgySpawner={handleTriggerDodgySpawner}
            equipments={equipments}
            records={records}
            onResetModuleData={handleResetModuleData}
            onImportModuleData={handleImportModuleData}
            onRefreshJaalee={() => refreshJaaleeData(false)}
            isSyncingJaalee={isSyncingJaalee}
            reminderTimes={reminderTimes}
            onUpdateReminderTimes={setReminderTimes}
            notificationOptions={notificationOptions}
            onUpdateNotificationOptions={setNotificationOptions}
            timezone={businessConfig.timezone}
          />
        )}
      </div>
    </div>
  );
}
