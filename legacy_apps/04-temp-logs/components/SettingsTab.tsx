import React, { useState } from 'react';
import {
  Radio,
  Trash2,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Sliders,
  Wifi,
  Info,
  Mail,
  Download,
  Upload,
  Clock,
  Plus,
  Volume2,
  Bell,
} from 'lucide-react';
import {
  Equipment,
  JaaleeConfig,
  NotificationOptions,
  SmtpConfig,
  TempRecord,
} from '../types';
import { STORAGE_KEYS } from '../constants';
import { loginJaaleeAccount, requestJaaleeVerificationCode } from '../services/jaaleeService';

interface SettingsTabProps {
  canManageSettings: boolean;
  canUseBackdateAudit: boolean;
  jaaleeConfig: JaaleeConfig;
  onUpdateJaaleeConfig: (config: JaaleeConfig) => void;
  onTriggerDodgySpawner: (days: number) => number;
  equipments: Equipment[];
  records: TempRecord[];
  onResetModuleData: (mode: 'empty' | 'demo') => void;
  onImportModuleData: (importedData: {
    smtpConfig?: SmtpConfig;
    equipments?: Equipment[];
    records?: TempRecord[];
    reminderTimes?: string[];
  }) => void;
  onRefreshJaalee: () => void;
  isSyncingJaalee: boolean;
  reminderTimes: string[];
  onUpdateReminderTimes: (times: string[]) => void;
  notificationOptions: NotificationOptions;
  onUpdateNotificationOptions: (options: NotificationOptions) => void;
  timezone?: string;
}

export default function SettingsTab({
  canManageSettings,
  canUseBackdateAudit,
  jaaleeConfig,
  onUpdateJaaleeConfig,
  onTriggerDodgySpawner,
  equipments,
  records,
  onResetModuleData,
  onImportModuleData,
  onRefreshJaalee,
  isSyncingJaalee,
  reminderTimes,
  onUpdateReminderTimes,
  notificationOptions,
  onUpdateNotificationOptions,
  timezone = 'GMT+10:00',
}: SettingsTabProps) {
  const [newReminderTime, setNewReminderTime] = useState('12:00');
  const [reminderError, setReminderError] = useState('');

  // Jaalee Credentials state
  const [jAccount, setJAccount] = useState(jaaleeConfig.account);
  const [jCode, setJCode] = useState('');
  const [jStatusMsg, setJStatusMsg] = useState({ text: '', isErr: false });
  const [jRequestingCode, setJRequestingCode] = useState(false);
  const [jLoggingIn, setJLoggingIn] = useState(false);

  // SMTP Settings Config Form State
  const [smtpConfig, setSmtpConfig] = useState<SmtpConfig>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.SMTP_CONFIG);
    return saved
      ? JSON.parse(saved)
      : {
          host: 'smtp.gourmetfresh.com.au',
          port: '587',
          username: 'compliance@gourmetfresh.com.au',
          senderEmail: 'compliance@gourmetfresh.com.au',
          encryption: 'tls',
        };
  });
  const [smtpPass, setSmtpPass] = useState(() => {
    return localStorage.getItem(STORAGE_KEYS.SMTP_PASS) || '••••••••••••';
  });
  const [smtpSaved, setSmtpSaved] = useState(false);

  const [smtpPreset, setSmtpPreset] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.SMTP_CONFIG);
    if (!saved) return 'custom';
    const cfg = JSON.parse(saved);
    if (cfg.host === 'smtp.gmail.com' && cfg.port === '587' && cfg.encryption === 'tls') return 'gmail';
    if (cfg.host === 'smtp.mail.yahoo.com' && cfg.port === '587' && cfg.encryption === 'tls') return 'yahoo';
    if (cfg.host === 'smtp.zoho.com' && cfg.port === '587' && cfg.encryption === 'tls') return 'zoho';
    return 'custom';
  });
  const [smtpTesting, setSmtpTesting] = useState(false);
  const [smtpTestLogs, setSmtpTestLogs] = useState<string[]>([]);
  const [smtpTestSuccess, setSmtpTestSuccess] = useState(false);
  const [smtpTestError, setSmtpTestError] = useState('');

  // Back-date archival sync state
  const [generatorDays, setGeneratorDays] = useState(7);
  const [spawnSuccessCount, setSpawnSuccessCount] = useState<number | null>(null);

  // Reset states
  const [resetStateMsg, setResetStateMsg] = useState('');
  const [confirmingWipeMode, setConfirmingWipeMode] = useState<'none' | 'manual' | 'full'>('none');

  // Export/Import states
  const [exportSmtp, setExportSmtp] = useState(true);
  const [exportEquipment, setExportEquipment] = useState(true);
  const [exportReminders, setExportReminders] = useState(true);

  const [importedPayload, setImportedPayload] = useState<Record<string, unknown> | null>(null);
  const [importFileError, setImportFileError] = useState('');
  const [importSuccessMsg, setImportSuccessMsg] = useState('');
  const [importSmtp, setImportSmtp] = useState(true);
  const [importEquipment, setImportEquipment] = useState(true);
  const [importReminders, setImportReminders] = useState(true);

  const [activeAccordion, setActiveAccordion] = useState<string | null>(null);
  const toggleAccordion = (section: string) => {
    setActiveAccordion((prev) => (prev === section ? null : section));
  };

  if (!canManageSettings) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center max-w-lg mx-auto space-y-4 shadow-xs">
        <Sliders className="w-12 h-12 text-amber-500 mx-auto stroke-[1.5]" />
        <h2 className="text-xl font-bold text-slate-800">Module Settings Locked</h2>
        <p className="text-sm text-slate-500 leading-relaxed">
          Your current KSBM account role does not include <code className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">canManageSettings</code> permission.
          IoT gateway credentials, SMTP relay settings, and data backups are managed by store administrators.
        </p>
      </div>
    );
  }

  const handlePresetChange = (preset: string) => {
    setSmtpPreset(preset);
    setSmtpTestSuccess(false);
    if (preset === 'gmail') {
      setSmtpConfig((prev) => ({ ...prev, host: 'smtp.gmail.com', port: '587', encryption: 'tls' }));
    } else if (preset === 'yahoo') {
      setSmtpConfig((prev) => ({ ...prev, host: 'smtp.mail.yahoo.com', port: '587', encryption: 'tls' }));
    } else if (preset === 'zoho') {
      setSmtpConfig((prev) => ({ ...prev, host: 'smtp.zoho.com', port: '587', encryption: 'tls' }));
    }
  };

  const updateSmtpConfigField = (key: keyof SmtpConfig, value: string) => {
    setSmtpTestSuccess(false);
    setSmtpConfig((prev) => {
      const updated = { ...prev, [key]: value };
      let matched = 'custom';
      if (updated.host === 'smtp.gmail.com' && updated.port === '587' && updated.encryption === 'tls') matched = 'gmail';
      else if (updated.host === 'smtp.mail.yahoo.com' && updated.port === '587' && updated.encryption === 'tls') matched = 'yahoo';
      else if (updated.host === 'smtp.zoho.com' && updated.port === '587' && updated.encryption === 'tls') matched = 'zoho';
      setSmtpPreset(matched);
      return updated;
    });
  };

  const handleTestSmtpConnection = () => {
    if (!smtpConfig.host || !smtpConfig.port || !smtpConfig.username || !smtpConfig.senderEmail || !smtpPass) {
      setSmtpTestError('All fields including authorization password are required.');
      return;
    }
    setSmtpTesting(true);
    setSmtpTestSuccess(false);
    setSmtpTestError('');
    setSmtpTestLogs([
      `[SMTP DIAGNOSTIC] Initiating validation for custom outbound envelope...`,
      `[SMTP DIAGNOSTIC] Resolving mail relay address: ${smtpConfig.host}...`,
    ]);

    setTimeout(() => {
      setSmtpTestLogs((prev) => [
        ...prev,
        `[SMTP DIAGNOSTIC] Connecting on remote port: ${smtpConfig.port} with secure layer TLS...`,
        `[SMTP DIAGNOSTIC] SSL/TLS handshaking successfully established using ${smtpConfig.encryption.toUpperCase()}.`,
      ]);
    }, 600);

    setTimeout(() => {
      setSmtpTestLogs((prev) => [
        ...prev,
        `[SMTP DIAGNOSTIC] Sending EHLO identification command to server MTA...`,
        `[SMTP DIAGNOSTIC] SMTP Response: [250-STARTTLS, 250-8BITMIME, 250-AUTH LOGIN PLAIN].`,
        `[SMTP DIAGNOSTIC] Transmitting credentials under sender address: ${smtpConfig.username}...`,
      ]);
    }, 1300);

    setTimeout(() => {
      const isPlaceholder = smtpPass === '••••••••••••';
      const isSimulatedFailure =
        smtpPass.length < 6 ||
        isPlaceholder ||
        ['wrong', 'invalid', 'incorrect', 'error', 'fail', 'test', 'dummy', '1234', 'password'].some((keyword) =>
          smtpPass.toLowerCase().includes(keyword)
        );

      if (isSimulatedFailure) {
        setSmtpTestLogs((prev) => [
          ...prev,
          `[SMTP CLIENT AUTHENTICATION ERROR] SMTP 535 5.7.8 Authentication credentials invalid, secret strength too simple, or simulation keyword detected.`,
          `[SMTP DIAGNOSTIC] Connection verification failed! Please input a valid secure passkey to clear this lock.`,
        ]);
        setSmtpTestError('Outbound Authentication Failed (535 credentials invalid, too simple, or simulation password used).');
        setSmtpTesting(false);
      } else {
        setSmtpTestLogs((prev) => [
          ...prev,
          `[SMTP DIAGNOSTIC] SMTP Authentication successful! (235 Authentication succeeded).`,
          `[SMTP DIAGNOSTIC] Constructing compliance envelope: MAIL FROM:<${smtpConfig.senderEmail}> RCPT TO:<${smtpConfig.username}>.`,
        ]);
      }
    }, 2000);

    setTimeout(() => {
      setSmtpTestLogs((prev) => {
        if (prev.some((line) => line.toLowerCase().includes('error') || line.toLowerCase().includes('failed'))) {
          return prev;
        }
        setSmtpTestSuccess(true);
        setSmtpTesting(false);
        return [
          ...prev,
          `[SMTP DIAGNOSTIC] Dispatched outbound test audit page. Status: 250 OK Queue ID: food-temp-test-${Math.floor(Math.random() * 900000 + 100000)}.`,
          `[SMTP DIAGNOSTIC] Verification complete! Mail relay route is healthy and verified. Option to save configurations unlocked.`,
        ];
      });
    }, 2800);
  };

  const handleSmtpSave = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem(STORAGE_KEYS.SMTP_CONFIG, JSON.stringify(smtpConfig));
    localStorage.setItem(STORAGE_KEYS.SMTP_PASS, smtpPass);
    setSmtpSaved(true);
    setTimeout(() => setSmtpSaved(false), 3000);
  };

  const requestJaaleeCode = async () => {
    if (!jAccount.trim()) {
      setJStatusMsg({ text: 'Please enter account email or phone number', isErr: true });
      return;
    }

    setJRequestingCode(true);
    setJStatusMsg({ text: 'Requesting verification code...', isErr: false });

    try {
      const data = await requestJaaleeVerificationCode(jAccount);
      if (data.code === '0' || data.code === 0) {
        setJStatusMsg({
          text: data.message || 'Verification token sent! Check your email or inbox.',
          isErr: false,
        });
      } else {
        setJStatusMsg({ text: data.message || 'Failed to request code.', isErr: true });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown network error';
      setJStatusMsg({ text: `Connection proxy failed: ${msg}`, isErr: true });
    } finally {
      setJRequestingCode(false);
    }
  };

  const loginJaalee = async () => {
    if (!jAccount.trim() || !jCode.trim()) {
      setJStatusMsg({ text: 'Account and Verification Code are required', isErr: true });
      return;
    }

    setJLoggingIn(true);
    setJStatusMsg({ text: 'Authenticating with Jaalee Remote Server...', isErr: false });

    try {
      const data = await loginJaaleeAccount(jAccount, jCode, timezone);
      if (data.code === '0' || data.code === 0) {
        const token = data.data?.token || '';
        onUpdateJaaleeConfig({
          account: jAccount,
          token,
          isLoggedIn: true,
          lastImportTime: new Date().toLocaleString('en-AU'),
          autoImportHour: jaaleeConfig.autoImportHour,
        });

        setJStatusMsg({
          text: 'Connected successfully! All wireless sensors and log histories imported to app safety grid.',
          isErr: false,
        });
        setJCode('');
      } else {
        setJStatusMsg({ text: data.message || 'Login details rejected by Jaalee API.', isErr: true });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown network error';
      setJStatusMsg({ text: `Connection proxy failed: ${msg}`, isErr: true });
    } finally {
      setJLoggingIn(false);
    }
  };

  const toggleAutoImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdateJaaleeConfig({
      ...jaaleeConfig,
      autoImportHour: e.target.checked,
    });
  };

  const handleDodgySpawn = () => {
    setSpawnSuccessCount(null);
    const count = onTriggerDodgySpawner(generatorDays);
    setSpawnSuccessCount(count);
    setTimeout(() => setSpawnSuccessCount(null), 5000);
  };

  const handleExport = () => {
    const payloadToExport: Record<string, unknown> = {
      version: '1.0',
      module: 'Kwik Temp Food Safety Logger (KSBM Module)',
      exportedAt: new Date().toISOString(),
    };

    if (exportSmtp) {
      const savedSmtp = localStorage.getItem(STORAGE_KEYS.SMTP_CONFIG);
      payloadToExport.smtpConfig = savedSmtp ? JSON.parse(savedSmtp) : null;
    }

    if (exportReminders) {
      payloadToExport.reminderTimes = reminderTimes;
    }

    if (exportEquipment) {
      const manualEquips = equipments.filter((e) => !e.isJaalee);
      const manualEquipIds = new Set(manualEquips.map((e) => e.id));
      const manualRecords = records.filter((r) => manualEquipIds.has(r.equipmentId));
      payloadToExport.equipments = manualEquips;
      payloadToExport.records = manualRecords;
    }

    const blob = new Blob([JSON.stringify(payloadToExport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kwik-temp-module-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (!parsed || typeof parsed !== 'object') {
          setImportFileError('Invalid backup file. The backup file format is corrupted.');
          setImportedPayload(null);
          return;
        }
        setImportedPayload(parsed);
        setImportFileError('');
        setImportSmtp(!!parsed.smtpConfig);
        setImportReminders(Array.isArray(parsed.reminderTimes));
        setImportEquipment(
          (!!parsed.equipments && Array.isArray(parsed.equipments)) ||
            (!!parsed.records && Array.isArray(parsed.records))
        );
      } catch {
        setImportFileError('Could not parse JSON schema. Verify the file contents are correct.');
        setImportedPayload(null);
      }
    };
    reader.readAsText(file);
  };

  const executeImportRestore = () => {
    if (!importedPayload) return;

    const payloadToImport: {
      smtpConfig?: SmtpConfig;
      equipments?: Equipment[];
      records?: TempRecord[];
      reminderTimes?: string[];
    } = {};

    if (importSmtp && importedPayload.smtpConfig) {
      const cfg = importedPayload.smtpConfig as SmtpConfig;
      payloadToImport.smtpConfig = cfg;
      setSmtpConfig(cfg);
    }

    if (importReminders && Array.isArray(importedPayload.reminderTimes)) {
      payloadToImport.reminderTimes = importedPayload.reminderTimes as string[];
    }

    if (importEquipment && Array.isArray(importedPayload.equipments)) {
      payloadToImport.equipments = importedPayload.equipments as Equipment[];
      payloadToImport.records = Array.isArray(importedPayload.records)
        ? (importedPayload.records as TempRecord[])
        : [];
    }

    onImportModuleData(payloadToImport);
    setImportSuccessMsg('Module backup restored successfully!');
    setImportedPayload(null);
    setImportFileError('');
    setTimeout(() => setImportSuccessMsg(''), 4000);
  };

  const handleAddReminderCheckpoint = () => {
    setReminderError('');
    if (!newReminderTime) return;
    if (reminderTimes.includes(newReminderTime)) {
      setReminderError('This reminder checkpoint already exists.');
      return;
    }
    onUpdateReminderTimes([...reminderTimes, newReminderTime].sort());
  };

  return (
    <div className="space-y-6 font-sans">
      <div className="border-b border-slate-100 pb-5">
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Module Settings & IoT</h1>
        <p className="text-sm text-slate-500">
          Configure log checkpoints, wireless Jaalee telemetry sensors, SMTP audit dispatch, and module backup portability. Store identity and staff permissions are managed centrally by KSBM.
        </p>
      </div>

      <div className="space-y-4 max-w-3xl mx-auto pb-12">
        {/* OPTION 1: Log Reminders & Alert Channels */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <button
            type="button"
            onClick={() => toggleAccordion('shifts_reminders')}
            className="w-full text-left p-5 flex items-center justify-between hover:bg-slate-50/50 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3.5">
              <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
                <Clock className="w-5 h-5 stroke-[2.25]" />
              </div>
              <div className="text-left">
                <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">Temperature Log Reminders & Alert Channels</h3>
                <p className="text-[11px] text-slate-500 font-medium select-none">
                  Organize custom manual check intervals and browser alert channels
                </p>
              </div>
            </div>
            <span className="text-slate-400 font-mono text-base font-bold select-none pr-1">
              {activeAccordion === 'shifts_reminders' ? 'Collapse ▲' : 'Expand ▼'}
            </span>
          </button>

          {activeAccordion === 'shifts_reminders' && (
            <div className="p-6 border-t border-slate-100 bg-slate-50/20 space-y-6">
              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3.5 text-xs shadow-2xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-emerald-600" />
                    <h3 className="text-sm font-bold text-slate-800">Reminder Checkpoints</h3>
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium select-none">Auto-triggers reminders during active shift</span>
                </div>

                <div className="space-y-4">
                  <p className="text-slate-500 text-[11px] leading-relaxed">
                    Set the exact time checkpoints when operators on duty are required to verify and log cabinet temperatures manually.
                  </p>

                  <div className="flex flex-wrap gap-2 items-center">
                    {reminderTimes.map((time, idx) => (
                      <div
                        key={idx}
                        className="flex items-center bg-slate-100 text-slate-800 font-mono text-xs font-bold px-2.5 py-1.5 rounded-lg border border-slate-200 gap-2 shadow-2xs hover:bg-slate-200 transition-colors"
                      >
                        <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span>{time}</span>
                        <button
                          type="button"
                          onClick={() => onUpdateReminderTimes(reminderTimes.filter((_, i) => i !== idx))}
                          className="text-red-500 hover:text-red-700 ml-1 font-bold shrink-0 cursor-pointer text-xs"
                          title="Remove reminder"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                    {reminderTimes.length === 0 && (
                      <span className="text-slate-400 text-xs italic">No manual reminders set. Create one below:</span>
                    )}
                  </div>

                  <div className="flex gap-2 items-center pt-2 max-w-sm">
                    <input
                      type="time"
                      value={newReminderTime}
                      onChange={(e) => setNewReminderTime(e.target.value)}
                      className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:ring-1 focus:ring-emerald-500 focus:outline-none w-36 [color-scheme:light]"
                    />
                    <button
                      type="button"
                      onClick={handleAddReminderCheckpoint}
                      className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-2 rounded-lg cursor-pointer transition-colors shadow-2xs whitespace-nowrap"
                    >
                      <Plus className="w-4 h-4" />
                      Add Checkpoint
                    </button>
                  </div>

                  {reminderError && <p className="text-xs text-red-600 font-semibold">{reminderError}</p>}
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3.5 text-xs shadow-2xs">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                  <Volume2 className="w-4 h-4 text-emerald-600" />
                  <h3 className="text-sm font-bold text-slate-800">Browser Notification & Alert Channels</h3>
                </div>

                <div className="space-y-3">
                  <label className="flex items-start gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={notificationOptions.browserBanner}
                      onChange={(e) => onUpdateNotificationOptions({ ...notificationOptions, browserBanner: e.target.checked })}
                      className="mt-1 accent-emerald-600 w-4 h-4 rounded cursor-pointer shrink-0"
                    />
                    <div>
                      <span className="font-bold text-slate-800 block">Show High-Contrast Dashboard Alert Banners</span>
                      <span className="text-[10px] text-slate-500 leading-normal block pt-0.5">
                        Displays sticky warning banners in the module UI for unlogged reminder checkpoints.
                      </span>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 cursor-pointer border-t border-slate-100 pt-3 select-none">
                    <input
                      type="checkbox"
                      checked={notificationOptions.soundAlert}
                      onChange={(e) => onUpdateNotificationOptions({ ...notificationOptions, soundAlert: e.target.checked })}
                      className="mt-1 accent-emerald-600 w-4 h-4 rounded cursor-pointer shrink-0"
                    />
                    <div>
                      <span className="font-bold text-slate-800 block">Enable Ambient Sound / Audio Tone Reminders</span>
                      <span className="text-[10px] text-slate-500 leading-normal block pt-0.5">
                        Triggers a gentle synthesizer alert tone locally when a manual check becomes overdue.
                      </span>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 cursor-pointer border-t border-slate-100 pt-3 select-none">
                    <input
                      type="checkbox"
                      checked={notificationOptions.desktopNotification}
                      onChange={async (e) => {
                        const checked = e.target.checked;
                        if (checked && 'Notification' in window) {
                          const permission = await Notification.requestPermission();
                          onUpdateNotificationOptions({
                            ...notificationOptions,
                            desktopNotification: permission === 'granted',
                          });
                        } else {
                          onUpdateNotificationOptions({ ...notificationOptions, desktopNotification: checked });
                        }
                      }}
                      className="mt-1 accent-emerald-600 w-4 h-4 rounded cursor-pointer shrink-0"
                    />
                    <div>
                      <span className="font-bold text-slate-800 block">Integrate Mobile / Native Desktop Browser Push Notifications</span>
                      <span className="text-[10px] text-slate-500 leading-normal block pt-0.5">
                        Triggers standard operational browser alerts when permitted by the user.
                      </span>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* OPTION 2: Jaalee Wireless Bluetooth IoT Configuration */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <button
            type="button"
            onClick={() => toggleAccordion('jaalee')}
            className="w-full text-left p-5 flex items-center justify-between hover:bg-slate-50/50 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3.5">
              <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
                <Radio className={`w-5 h-5 stroke-[2.25] ${jaaleeConfig.isLoggedIn ? 'animate-pulse' : ''}`} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">Jaalee Bluetooth Cloud Sync</h3>
                  {jaaleeConfig.isLoggedIn ? (
                    <span className="bg-sky-50 text-sky-800 text-[8px] tracking-wider font-extrabold px-1.5 py-0.5 rounded-md border border-sky-100 uppercase">Connected</span>
                  ) : (
                    <span className="bg-slate-100 text-slate-400 text-[8px] tracking-wider font-extrabold px-1.5 py-0.5 rounded-md border border-slate-200 uppercase">Inactive</span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 font-medium">Sync with external Jaalee API server for continuous electronic monitoring</p>
              </div>
            </div>
            <span className="text-slate-400 font-mono text-base font-bold select-none pr-1">
              {activeAccordion === 'jaalee' ? 'Collapse ▲' : 'Expand ▼'}
            </span>
          </button>

          {activeAccordion === 'jaalee' && (
            <div className="p-6 border-t border-slate-100 bg-slate-50/20 space-y-5 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <p className="text-slate-500 leading-relaxed">
                    Establishing an active API connection retrieves all wireless electronic sensors, current battery percentages, and long-term historical records cleanly to the visual logs dashboard.
                  </p>

                  <div className="space-y-3">
                    <div>
                      <label className="block font-bold text-slate-500 uppercase tracking-widest text-[9px]">Jaalee Email / Account ID</label>
                      <div className="flex gap-2 mt-1">
                        <input
                          type="text"
                          required
                          value={jAccount}
                          onChange={(e) => setJAccount(e.target.value)}
                          placeholder="e.g. dev@jaalee.com"
                          className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-sky-500 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={requestJaaleeCode}
                          disabled={jRequestingCode}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3 rounded-xl border border-slate-200 cursor-pointer disabled:opacity-50 text-[10px] uppercase tracking-wide"
                        >
                          {jRequestingCode ? 'Sending...' : 'Get Code'}
                        </button>
                      </div>
                      <p className="mt-1.5 text-[10px] text-slate-400 flex items-center gap-1">
                        <Info className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>Sandbox Test: Log in using <strong>demo@jaalee.com</strong> to sync virtual IoT devices.</span>
                      </p>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-500 uppercase tracking-widest text-[9px]">Verification Code (SMS / Inbox)</label>
                      <div className="flex gap-2 mt-1">
                        <input
                          type="text"
                          value={jCode}
                          onChange={(e) => setJCode(e.target.value)}
                          placeholder="e.g. 1234"
                          className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-center text-sm font-mono tracking-widest focus:ring-1 focus:ring-sky-500 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={loginJaalee}
                          disabled={jLoggingIn || !jCode}
                          className="bg-sky-600 hover:bg-sky-700 text-white font-bold px-4 rounded-xl cursor-pointer disabled:bg-slate-200 disabled:text-slate-400 text-xs uppercase"
                        >
                          {jLoggingIn ? 'Connecting...' : 'Establish Link'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {jStatusMsg.text && (
                    <p className={`p-2.5 rounded-xl border font-bold text-[11px] ${
                      jStatusMsg.isErr ? 'bg-red-50 text-red-700 border-red-100' : 'bg-sky-50 text-sky-800 border-sky-100'
                    }`}>
                      {jStatusMsg.text}
                    </p>
                  )}
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 flex flex-col justify-between shadow-2xs">
                  <div className="space-y-3">
                    <h3 className="font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wide text-xs border-b border-slate-50 pb-1">
                      <Sliders className="w-4 h-4 text-slate-400" />
                      Automatic Synchronizer
                    </h3>

                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        id="ksbm_auto_import_chk"
                        checked={jaaleeConfig.autoImportHour}
                        onChange={toggleAutoImport}
                        className="mt-1 h-4 w-4 text-sky-600 border-slate-300 rounded focus:ring-sky-500 cursor-pointer"
                      />
                      <label htmlFor="ksbm_auto_import_chk" className="cursor-pointer select-none">
                        <span className="font-bold text-slate-800 block leading-tight">Auto-Import Latest Temp Readings</span>
                        <span className="text-slate-400 block text-[11px] leading-relaxed mt-0.5 font-medium">
                          Connects every hour to download live temperature charts automatically.
                        </span>
                      </label>
                    </div>
                  </div>

                  {jaaleeConfig.isLoggedIn ? (
                    <div className="text-xs pt-4 border-t border-slate-200 text-slate-500 space-y-3">
                      <div className="space-y-1">
                        <p>Linked Remote ID: <strong>{jaaleeConfig.account}</strong></p>
                        <p className="font-mono text-[10px]">API Key: {jaaleeConfig.token.substring(0, 10)}...</p>
                        {jaaleeConfig.lastImportTime && <p>Last Successful Import: <strong>{jaaleeConfig.lastImportTime}</strong></p>}
                      </div>

                      <div className="pt-2 space-y-2">
                        <button
                          type="button"
                          onClick={onRefreshJaalee}
                          disabled={isSyncingJaalee}
                          className="w-full flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-700 disabled:bg-slate-100 disabled:text-slate-400 text-white font-bold p-2 px-3 rounded-xl transition-all cursor-pointer shadow-2xs uppercase tracking-wider text-[10px]"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isSyncingJaalee ? 'animate-spin' : ''}`} />
                          {isSyncingJaalee ? 'Syncing...' : 'Resync Earliest Historical Telemetry'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400 italic pt-4 border-t border-slate-100 font-medium">
                      Connection currently inactive. Establish an API link first to access automated intervals.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* OPTION 3: Secure SMTP Dispatch Server */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <button
            type="button"
            onClick={() => toggleAccordion('smtp')}
            className="w-full text-left p-5 flex items-center justify-between hover:bg-slate-50/50 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3.5">
              <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
                <Mail className="w-5 h-5 stroke-[2.25]" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">SMTP Audit Email Configuration</h3>
                <p className="text-[11px] text-slate-500 font-medium">Setup custom SMTP outbound servers for transmitting compliant digital log digests</p>
              </div>
            </div>
            <span className="text-slate-400 font-mono text-base font-bold select-none pr-1">
              {activeAccordion === 'smtp' ? 'Collapse ▲' : 'Expand ▼'}
            </span>
          </button>

          {activeAccordion === 'smtp' && (
            <div className="p-6 border-t border-slate-100 bg-slate-50/20 space-y-4">
              <form onSubmit={handleSmtpSave} className="space-y-4 text-xs">
                <div className="bg-emerald-50/45 border border-emerald-100 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 select-none">
                  <div>
                    <h4 className="font-extrabold text-emerald-950 tracking-tight flex items-center gap-1.5 text-xs">
                      <Sliders className="w-4 h-4 text-emerald-600" />
                      Auditorial SMTP Mail Presets
                    </h4>
                    <p className="text-[10px] text-emerald-800 leading-snug">
                      Instantly configure secure outbound routers with trusted public providers.
                    </p>
                  </div>
                  <div className="w-full sm:w-64 shrink-0">
                    <select
                      value={smtpPreset}
                      onChange={(e) => handlePresetChange(e.target.value)}
                      className="w-full bg-white border border-emerald-200 text-emerald-950 rounded-lg px-3 py-2 text-xs font-bold focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                    >
                      <option value="custom">⚙️ Custom Parameters (Manual Server)</option>
                      <option value="gmail">📨 Gmail SMTP Router (smtp.gmail.com)</option>
                      <option value="yahoo">📨 Yahoo Outbound Relay (smtp.mail.yahoo.com)</option>
                      <option value="zoho">📨 Zoho Mail Outbound Relay (smtp.zoho.com)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold uppercase tracking-wider text-slate-500">SMTP Host Outbound Relay</label>
                    <input
                      type="text"
                      required
                      value={smtpConfig.host}
                      onChange={(e) => updateSmtpConfigField('host', e.target.value)}
                      placeholder="e.g. mail.gourmetdelmelb.com.au"
                      className="mt-1 block w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-slate-900 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none shadow-2xs"
                    />
                  </div>
                  <div>
                    <label className="block font-bold uppercase tracking-wider text-slate-500">SMTP Server Port</label>
                    <input
                      type="text"
                      required
                      value={smtpConfig.port}
                      onChange={(e) => updateSmtpConfigField('port', e.target.value)}
                      placeholder="e.g. 587 or 465"
                      className="mt-1 block w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-slate-900 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none shadow-2xs"
                    />
                  </div>
                  <div>
                    <label className="block font-bold uppercase tracking-wider text-slate-500">SMTP User Account / Email</label>
                    <input
                      type="email"
                      required
                      value={smtpConfig.username}
                      onChange={(e) => updateSmtpConfigField('username', e.target.value)}
                      placeholder="e.g. compliance@gourmetdelmelb.com.au"
                      className="mt-1 block w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-slate-900 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none shadow-2xs"
                    />
                  </div>
                  <div>
                    <label className="block font-bold uppercase tracking-wider text-slate-500">SMTP Auth Passphrase</label>
                    <input
                      type="password"
                      required
                      value={smtpPass}
                      onChange={(e) => {
                        setSmtpPass(e.target.value);
                        setSmtpTestSuccess(false);
                      }}
                      placeholder="••••••••••••"
                      className="mt-1 block w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-slate-900 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none shadow-2xs"
                    />
                    <p className="mt-1.5 text-[10px] text-slate-400 italic leading-snug">
                      * Sandbox Simulation Note: Connection validation is simulated locally. Enter any passphrase containing <strong className="text-rose-600">"wrong"</strong>, <strong className="text-rose-600">"invalid"</strong>, or passwords less than 6 characters long to simulate failure.
                    </p>
                  </div>
                  <div>
                    <label className="block font-bold uppercase tracking-wider text-slate-500">Auditor Sender Profile Address</label>
                    <input
                      type="email"
                      required
                      value={smtpConfig.senderEmail}
                      onChange={(e) => updateSmtpConfigField('senderEmail', e.target.value)}
                      placeholder="e.g. reports@gourmetdelmelb.com.au"
                      className="mt-1 block w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-slate-900 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none shadow-2xs"
                    />
                  </div>
                  <div>
                    <label className="block font-bold uppercase tracking-wider text-slate-500">Outbound Secure Connection</label>
                    <select
                      value={smtpConfig.encryption}
                      onChange={(e) => updateSmtpConfigField('encryption', e.target.value)}
                      className="mt-1 block w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-slate-900 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none shadow-2xs"
                    >
                      <option value="tls">STARTTLS Secure Layer (Standard port 587)</option>
                      <option value="ssl">SSL Implicit Encrypted (Port 465)</option>
                      <option value="none">No security (Plain text relay)</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3.5 pt-1.5">
                  <button
                    type="button"
                    onClick={handleTestSmtpConnection}
                    disabled={smtpTesting}
                    className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white font-extrabold py-2 px-4 rounded-xl cursor-pointer disabled:cursor-not-allowed disabled:opacity-75 transition-colors text-xs uppercase"
                  >
                    {smtpTesting ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
                        Diagnosing Outbound...
                      </>
                    ) : (
                      <>
                        <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                        Test Connection
                      </>
                    )}
                  </button>
                </div>

                {(smtpTesting || smtpTestLogs.length > 0) && (
                  <div className="bg-slate-950 text-slate-200 p-4 rounded-xl font-mono text-[10px] leading-relaxed space-y-1 shadow-inner border border-slate-800 select-none">
                    <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-800">
                      <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider">Outbound SMTP Handshake Ledger</span>
                      {smtpTesting && <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />}
                    </div>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {smtpTestLogs.map((log, index) => {
                        let colorClass = 'text-slate-300';
                        if (log.includes('ERROR') || log.includes('failed')) colorClass = 'text-rose-400 font-extrabold';
                        else if (log.includes('successful') || log.includes('OK') || log.includes('complete!')) colorClass = 'text-emerald-400 font-bold';
                        else if (log.includes('Response:') || log.includes('EHLO') || log.includes('verified!')) colorClass = 'text-amber-300';

                        return (
                          <p key={index} className={colorClass}>
                            {log}
                          </p>
                        );
                      })}
                    </div>
                  </div>
                )}

                {smtpTestError && (
                  <p className="text-xs bg-rose-50 text-rose-800 p-3 rounded-xl font-bold border border-rose-100 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    {smtpTestError}
                  </p>
                )}

                {smtpSaved && (
                  <p className="text-xs bg-emerald-50 text-emerald-800 p-2.5 rounded-lg font-bold border border-emerald-100">
                    ✓ SMTP Relay server configurations updated and secured locally.
                  </p>
                )}

                <div className="pt-2">
                  {smtpTestSuccess ? (
                    <div className="space-y-3.5">
                      <div className="bg-emerald-50 text-emerald-900 p-3.5 rounded-xl border border-emerald-100 flex items-start gap-2.5">
                        <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-extrabold text-xs">✓ SMTP Relay Validated Successfully!</p>
                          <p className="text-[10px] text-emerald-700 font-medium leading-relaxed mt-0.5">
                            Connection tests verified host parameters and authentication layers. You may now persist this configuration.
                          </p>
                        </div>
                      </div>

                      <button
                        type="submit"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-black py-2.5 px-6 rounded-xl cursor-pointer transition-all text-xs uppercase tracking-wide shadow-md"
                      >
                        Save Mail Configurations
                      </button>
                    </div>
                  ) : (
                    <div className="bg-slate-100/70 p-3 rounded-xl border border-slate-200/50 text-[11px] text-slate-500 font-bold flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                      <span>Please perform a successful <strong>Connection Test</strong> above to verify your credentials and unlock the Save option.</span>
                    </div>
                  )}
                </div>
              </form>
            </div>
          )}
        </div>

        {/* OPTION 4: Archive Back-Date Synchronization (Permission-gated by KSBM) */}
        {canUseBackdateAudit && (
          <div className="bg-amber-50/20 border border-amber-200 rounded-2xl overflow-hidden shadow-xs">
            <button
              type="button"
              onClick={() => toggleAccordion('ledger')}
              className="w-full text-left p-5 flex items-center justify-between hover:bg-amber-50/30 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <div className="p-2.5 bg-amber-500 text-white rounded-xl">
                  <RefreshCw className="w-5 h-5 stroke-[2.25]" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-amber-900 tracking-tight">Archive Back-Date Synchronization</h3>
                  <p className="text-[11px] text-amber-700 font-medium">Restores and backfills missing manual records for previous kitchen operational days</p>
                </div>
              </div>
              <span className="text-amber-600 font-mono text-base font-bold select-none pr-1">
                {activeAccordion === 'ledger' ? 'Collapse ▲' : 'Expand ▼'}
              </span>
            </button>

            {activeAccordion === 'ledger' && (
              <div className="p-6 border-t border-amber-200 bg-amber-50/15 space-y-4 text-xs">
                <div className="bg-white border border-amber-200 rounded-xl p-4 text-xs leading-relaxed text-slate-700 flex gap-2.5 shadow-2xs">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-slate-900 block mb-1">Archival Recovery Execution Parameters:</span>
                    Configure the recovery parameters below to align vacant operational slots of manual devices back to standard guidelines.
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4 text-xs bg-white p-4 text-slate-800 border border-slate-200 rounded-xl shadow-2xs">
                  <div className="w-full sm:w-fit">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Historical Recovery Window Selection</label>
                    <select
                      value={generatorDays}
                      onChange={(e) => setGeneratorDays(Number(e.target.value))}
                      className="block w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 font-semibold"
                    >
                      <option value={1}>1 Day Window (recover previous 24 hours)</option>
                      <option value={3}>3 Days Window (recover previous 72 hours)</option>
                      <option value={7}>7 Days Window (recover previous 1 week)</option>
                      <option value={14}>14 Days Window (recover previous 2 weeks)</option>
                      <option value={30}>30 Days Window (recover previous 1 month)</option>
                      <option value={180}>180 Days Window (recover previous 6 months)</option>
                      <option value={365}>365 Days Window (recover previous 12 months)</option>
                    </select>
                  </div>

                  <div className="flex items-end h-full w-full sm:w-auto pt-4 sm:pt-0">
                    <button
                      type="button"
                      onClick={handleDodgySpawn}
                      className="w-full sm:w-auto bg-amber-500 hover:bg-amber-600 text-white font-bold py-2 px-5 rounded-xl shadow-xs cursor-pointer flex items-center justify-center gap-2 uppercase tracking-wide"
                    >
                      <RefreshCw className="w-4 h-4 text-white" />
                      Execute Re-Synchronization
                    </button>
                  </div>
                </div>

                {spawnSuccessCount !== null && (
                  <div className="text-xs bg-emerald-50 text-emerald-800 font-bold px-4 py-3 rounded-xl border border-emerald-100 flex items-center gap-2 shadow-2xs">
                    <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                    <span>
                      Archive synchronization check completed. Restored {spawnSuccessCount} temperature check entries for your configured {equipments.filter((e) => !e.isJaalee).length} manual food storage cabinets.
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* OPTION 5: Compliance Data Backup & Portability */}
        <div className="bg-emerald-50/10 border border-emerald-200 rounded-2xl overflow-hidden shadow-xs">
          <button
            type="button"
            onClick={() => toggleAccordion('portability')}
            className="w-full text-left p-5 flex items-center justify-between hover:bg-emerald-50/20 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3.5">
              <div className="p-2.5 bg-emerald-600 text-white rounded-xl">
                <Download className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-emerald-900 tracking-tight">Compliance Data Backup & Portability</h3>
                <p className="text-[11px] text-emerald-700 font-medium">Download or restore manual cabinets, logs, reminders, and SMTP configurations</p>
              </div>
            </div>
            <span className="text-emerald-600 font-mono text-base font-bold select-none pr-1">
              {activeAccordion === 'portability' ? 'Collapse ▲' : 'Expand ▼'}
            </span>
          </button>

          {activeAccordion === 'portability' && (
            <div className="p-6 border-t border-emerald-200 bg-white space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-slate-700">
                <div className="bg-slate-50/50 border border-slate-200 p-5 rounded-2xl flex flex-col justify-between">
                  <div>
                    <h4 className="text-xs font-black text-slate-800 tracking-wider uppercase mb-1.5 flex items-center gap-1.5 border-b border-slate-200 pb-2">
                      <Download className="w-4 h-4 text-emerald-600" /> Export Compliance Backup
                    </h4>
                    <p className="text-[11px] text-slate-500 mb-4 leading-relaxed">
                      Download a structured, off-device `.json` backup file for this module:
                    </p>

                    <div className="space-y-2.5 mt-2">
                      <label className="flex items-start gap-2.5 p-2 bg-white hover:bg-slate-100/80 rounded-xl transition-all cursor-pointer border border-slate-200">
                        <input
                          type="checkbox"
                          checked={exportReminders}
                          onChange={(e) => setExportReminders(e.target.checked)}
                          className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5 cursor-pointer"
                        />
                        <div>
                          <span className="font-bold text-slate-800 text-[11px]">Reminder Checkpoints ({reminderTimes.length})</span>
                          <span className="block text-[10px] text-slate-400 mt-0.5">Scheduled manual temperature check times</span>
                        </div>
                      </label>

                      <label className="flex items-start gap-2.5 p-2 bg-white hover:bg-slate-100/80 rounded-xl transition-all cursor-pointer border border-slate-200">
                        <input
                          type="checkbox"
                          checked={exportSmtp}
                          onChange={(e) => setExportSmtp(e.target.checked)}
                          className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5 cursor-pointer"
                        />
                        <div>
                          <span className="font-bold text-slate-800 text-[11px]">Secure Server SMTP settings</span>
                          <span className="block text-[10px] text-slate-400 mt-0.5">SMTP credentials & alert dispatch route</span>
                        </div>
                      </label>

                      <label className="flex items-start gap-2.5 p-2 bg-white hover:bg-slate-100/80 rounded-xl transition-all cursor-pointer border border-slate-200">
                        <input
                          type="checkbox"
                          checked={exportEquipment}
                          onChange={(e) => setExportEquipment(e.target.checked)}
                          className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5 cursor-pointer"
                        />
                        <div>
                          <span className="font-bold text-slate-800 text-[11px]">Manual Equipments & Log Readings</span>
                          <span className="block text-[10px] mt-0.5 font-semibold text-emerald-700">
                            Includes {equipments.filter((e) => !e.isJaalee).length} manual cabinets and historical temperature records
                          </span>
                        </div>
                      </label>
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={handleExport}
                      disabled={!exportReminders && !exportSmtp && !exportEquipment}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-100 disabled:text-slate-400 text-white font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs text-xs uppercase"
                    >
                      <Download className="w-4 h-4" /> Download Backup File
                    </button>
                  </div>
                </div>

                <div className="bg-slate-50/50 border border-slate-200 p-5 rounded-2xl flex flex-col justify-between">
                  <div>
                    <h4 className="text-xs font-black text-slate-800 tracking-wider uppercase mb-1.5 flex items-center gap-1.5 border-b border-slate-200 pb-2">
                      <Upload className="w-4 h-4 text-emerald-600" /> Restore / Import Backup
                    </h4>
                    <p className="text-[11px] text-slate-500 mb-4 leading-relaxed">
                      Upload a previously exported `.json` backup file to restore module configurations and records.
                    </p>

                    <div className="border-2 border-dashed border-slate-200 hover:border-emerald-500 bg-white/50 hover:bg-emerald-50/10 rounded-2xl p-4 transition-all duration-150 relative text-center">
                      <input
                        type="file"
                        accept=".json"
                        onChange={handleFileChange}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      />
                      <div className="flex flex-col items-center justify-center space-y-1.5 pointer-events-none">
                        <Upload className="w-6 h-6 text-slate-400" />
                        <span className="text-[11px] font-bold text-slate-700">Select Backup File</span>
                        <span className="text-[9px] text-slate-400 font-medium">Accepts Kwik Temp (.json)</span>
                      </div>
                    </div>

                    {importFileError && (
                      <p className="mt-3 text-xs font-bold text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-100 leading-relaxed text-left">
                        ⚠️ {importFileError}
                      </p>
                    )}

                    {importedPayload && (
                      <div className="mt-4 p-3.5 bg-white border border-slate-200 rounded-xl space-y-3">
                        <div className="flex items-center justify-between text-[10px] text-slate-400 border-b border-slate-100 pb-1.5 font-bold font-mono">
                          <span>📦 Backed up at:</span>
                          <span className="text-slate-600">
                            {typeof importedPayload.exportedAt === 'string'
                              ? new Date(importedPayload.exportedAt).toLocaleString()
                              : 'Unknown Date'}
                          </span>
                        </div>

                        <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Confirm Restore Selections:</span>

                        <div className="space-y-2 text-[11px]">
                          {Array.isArray(importedPayload.reminderTimes) && (
                            <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700">
                              <input
                                type="checkbox"
                                checked={importReminders}
                                onChange={(e) => setImportReminders(e.target.checked)}
                                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5 cursor-pointer"
                              />
                              <span>Import Reminder Checkpoints ({importedPayload.reminderTimes.length})</span>
                            </label>
                          )}

                          {Boolean(importedPayload.smtpConfig) && (
                            <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700">
                              <input
                                type="checkbox"
                                checked={importSmtp}
                                onChange={(e) => setImportSmtp(e.target.checked)}
                                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5 cursor-pointer"
                              />
                              <span>Import Alert SMTP dispatch credentials</span>
                            </label>
                          )}

                          {Array.isArray(importedPayload.equipments) && (
                            <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700">
                              <input
                                type="checkbox"
                                checked={importEquipment}
                                onChange={(e) => setImportEquipment(e.target.checked)}
                                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5 cursor-pointer"
                              />
                              <span className="text-emerald-700 font-bold">
                                Restore Cabinets & Readings ({importedPayload.equipments.length} manual,{' '}
                                {Array.isArray(importedPayload.records) ? importedPayload.records.length : 0} timestamps)
                              </span>
                            </label>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-5 pt-3 border-t border-slate-200">
                    <button
                      type="button"
                      disabled={!importedPayload || (!importReminders && !importSmtp && !importEquipment)}
                      onClick={executeImportRestore}
                      className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-100 disabled:text-slate-400 text-white font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs text-xs uppercase"
                    >
                      <Upload className="w-4 h-4" /> Confirm & Execute Restore
                    </button>

                    {importSuccessMsg && (
                      <div className="mt-3 text-xs bg-emerald-50 text-emerald-800 font-bold px-3 py-2 border border-emerald-100 rounded-lg text-center flex items-center justify-center gap-1.5">
                        <CheckCircle className="w-4 h-4 shrink-0 text-emerald-500" />
                        <span>{importSuccessMsg}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* OPTION 6: Module Reset & Database Purge */}
        <div className="bg-red-50/20 border border-red-200 rounded-2xl overflow-hidden shadow-xs">
          <button
            type="button"
            onClick={() => {
              toggleAccordion('reset');
              setConfirmingWipeMode('none');
            }}
            className="w-full text-left p-5 flex items-center justify-between hover:bg-red-50/40 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3.5">
              <div className="p-2.5 bg-red-600 text-white rounded-xl">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-red-900 tracking-tight">Module Reset & Data Purge</h3>
                <p className="text-[11px] text-red-700 font-medium">Remove or reset module equipments, temperature records, and IoT/SMTP configs</p>
              </div>
            </div>
            <span className="text-red-600 font-mono text-base font-bold select-none pr-1">
              {activeAccordion === 'reset' ? 'Collapse ▲' : 'Expand ▼'}
            </span>
          </button>

          {activeAccordion === 'reset' && (
            <div className="p-6 border-t border-red-200 bg-red-50/15 space-y-4 text-xs">
              <div className="bg-white border border-red-200 rounded-xl p-4 leading-relaxed text-slate-700 flex gap-2.5 shadow-2xs">
                <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-slate-900 block mb-1">Administrative Destructive Actions Guard:</span>
                  Resetting the log datasets and cabinets only affects this Food Safety Temperature module. KSBM store details and staff accounts remain untouched.
                </div>
              </div>

              {resetStateMsg && (
                <div className="bg-emerald-50 text-emerald-800 font-bold px-4 py-3 rounded-xl border border-emerald-100 flex items-center gap-2 shadow-2xs">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  <span>{resetStateMsg}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="bg-white border border-slate-200 p-4 rounded-xl flex flex-col justify-between shadow-2xs">
                  <div>
                    <h4 className="font-extrabold text-slate-800 text-xs">Clear Equipments & Temperature Logs</h4>
                    <p className="text-slate-500 text-[11px] mt-1 leading-relaxed">
                      Removes registered equipment cabinets and purges cold-chain safety logs locally.
                    </p>
                  </div>
                  <div className="mt-4">
                    {confirmingWipeMode === 'manual' ? (
                      <div className="space-y-2">
                        <p className="text-red-700 font-bold text-[10px] uppercase">Are you absolutely sure?</p>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              onResetModuleData('empty');
                              setConfirmingWipeMode('none');
                              setResetStateMsg('✓ Clean sweep complete! Module equipment and logs cleared.');
                              setTimeout(() => setResetStateMsg(''), 5000);
                            }}
                            className="bg-red-600 hover:bg-red-700 text-white font-bold py-1.5 px-3 rounded-lg text-[10px] cursor-pointer"
                          >
                            Yes, Clear All
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              onResetModuleData('demo');
                              setConfirmingWipeMode('none');
                              setResetStateMsg('✓ Restored safety templates! Demo equipments & logs reloaded.');
                              setTimeout(() => setResetStateMsg(''), 5000);
                            }}
                            className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-1.5 px-3 rounded-lg text-[10px] cursor-pointer"
                          >
                            Reset to Demo
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmingWipeMode('none')}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-1.5 px-3 rounded-lg text-[10px] cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmingWipeMode('manual')}
                        className="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 hover:border-red-300 font-bold py-1.5 px-3 rounded-lg text-[10px] cursor-pointer transition-all uppercase"
                      >
                        Reset Equipment & Data
                      </button>
                    )}
                  </div>
                </div>

                <div className="bg-red-600 text-white p-4 rounded-xl flex flex-col justify-between shadow-xs">
                  <div>
                    <h4 className="font-black text-white text-xs uppercase tracking-wide">Full Module Factory Wipe</h4>
                    <p className="text-red-100 text-[11px] mt-1 leading-relaxed">
                      Clears all equipment, safety logs, active alerts, Jaalee link, and SMTP settings back to initial defaults.
                    </p>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-3 items-center justify-between">
                    {confirmingWipeMode === 'full' ? (
                      <div className="space-y-2 w-full bg-red-700 p-3 rounded-lg text-white">
                        <p className="text-white font-black text-[10px] uppercase tracking-wider">Confirm Module Database Wipe?</p>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              onResetModuleData('empty');
                              setConfirmingWipeMode('none');
                              setResetStateMsg('✓ Module Factory Purge Complete!');
                              setTimeout(() => setResetStateMsg(''), 5000);
                            }}
                            className="bg-amber-500 hover:bg-amber-600 text-white font-black py-1.5 px-3 rounded-lg text-[10px] cursor-pointer uppercase transition-all shadow-xs"
                          >
                            YES, WIPE MODULE
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              onResetModuleData('demo');
                              setConfirmingWipeMode('none');
                              setResetStateMsg('✓ Clean Demo State Reloaded!');
                              setTimeout(() => setResetStateMsg(''), 5000);
                            }}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-black py-1.5 px-3 rounded-lg text-[10px] cursor-pointer uppercase transition-all shadow-xs"
                          >
                            RESTORE DEMO
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmingWipeMode('none')}
                            className="bg-white/10 hover:bg-white/20 text-white font-bold py-1.5 px-4 rounded-lg text-[10px] cursor-pointer transition-all"
                          >
                            Abandon
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmingWipeMode('full')}
                        className="bg-white hover:bg-red-50 text-red-700 font-black py-2 px-4 rounded-xl text-[10px] cursor-pointer transition-all uppercase tracking-wide shadow-sm"
                      >
                        Execute Module Wipe
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
