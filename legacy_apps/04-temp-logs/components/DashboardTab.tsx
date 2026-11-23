import React, { useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Thermometer, Bell, CheckCircle, Battery, Radio, Plus, User, Clock, RefreshCw, X, Shield } from 'lucide-react';
import { Equipment, TempRecord, JaaleeConfig, KsbmCurrentUser } from '../types';
import { getAlertThresholds } from '../utils/compliance';

interface DashboardTabProps {
  equipments: Equipment[];
  records: TempRecord[];
  currentUser: KsbmCurrentUser;
  canLogTemperature: boolean;
  canSyncIoT: boolean;
  onAddTempRecord: (equipId: string, temp: number, staffName: string, isManual: boolean) => void;
  onRefreshJaalee: () => void;
  isSyncingJaalee: boolean;
  jaaleeConfig: JaaleeConfig;
}

export default function DashboardTab({
  equipments,
  records,
  currentUser,
  canLogTemperature,
  canSyncIoT,
  onAddTempRecord,
  onRefreshJaalee,
  isSyncingJaalee,
  jaaleeConfig,
}: DashboardTabProps) {
  const [selectedEquipId, setSelectedEquipId] = useState<string | null>(null);
  const [manualTempString, setManualTempString] = useState('');
  const [logError, setLogError] = useState('');
  const [chartPeriod, setChartPeriod] = useState<'hour' | 'day' | 'week' | 'month'>('day');

  const getCurrentReading = (equipId: string) => {
    const equipRecords = records.filter((r) => r.equipmentId === equipId);
    if (equipRecords.length === 0) return null;
    return [...equipRecords].sort((a, b) => b.timestamp - a.timestamp)[0];
  };

  const handleManualSubmit = (e: React.FormEvent, equip: Equipment) => {
    e.preventDefault();
    if (!canLogTemperature) return;
    setLogError('');

    const parsedTemp = parseFloat(manualTempString);
    if (isNaN(parsedTemp)) {
      setLogError('Please enter a valid numeric temperature (e.g. 4.2)');
      return;
    }

    if (parsedTemp < -50 || parsedTemp > 120) {
      setLogError('Temperature out of bounds. Must be between -50°C and 120°C.');
      return;
    }

    const staffName = currentUser.name || 'Operator';
    onAddTempRecord(equip.id, parsedTemp, staffName, true);
    setManualTempString('');
    setLogError('');
  };

  const selectedEquip = equipments.find((e) => e.id === selectedEquipId);
  const selectedReading = selectedEquip ? getCurrentReading(selectedEquip.id) : null;
  const { minNotify: selectedEquipMinNotify, maxNotify: selectedEquipMaxNotify } = selectedEquip
    ? getAlertThresholds(selectedEquip)
    : { minNotify: 0, maxNotify: 0 };

  const getChartData = (equipId: string, period: 'hour' | 'day' | 'week' | 'month') => {
    const equipRecords = records
      .filter((r) => r.equipmentId === equipId)
      .sort((a, b) => a.timestamp - b.timestamp);

    if (equipRecords.length === 0) return [];

    const refTime = Date.now();
    let cutoff = 0;
    if (period === 'hour') cutoff = refTime - 1 * 60 * 60 * 1000;
    else if (period === 'day') cutoff = refTime - 24 * 60 * 60 * 1000;
    else if (period === 'week') cutoff = refTime - 7 * 24 * 60 * 60 * 1000;
    else if (period === 'month') cutoff = refTime - 30 * 24 * 60 * 60 * 1000;

    const filtered = equipRecords.filter((r) => r.timestamp >= cutoff);
    const sliceRecords = filtered.length > 0 ? filtered : equipRecords.slice(-15);

    return sliceRecords.map((rec) => {
      const dateStr = new Date(rec.timestamp).toLocaleDateString('en-AU', {
        day: 'numeric',
        month: 'short',
      });
      const timeStr = new Date(rec.timestamp).toLocaleTimeString('en-AU', {
        hour: '2-digit',
        minute: '2-digit',
      });
      return {
        time: timeStr,
        date: dateStr,
        label: period === 'hour' || period === 'day' ? timeStr : `${dateStr} ${timeStr}`,
        temp: rec.temperature,
        humidity: rec.humidity,
      };
    });
  };

  return (
    <div className="space-y-8">
      {/* Overview Banner */}
      <div className="flex flex-col md:flex-row justify-between md:items-start gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Shield className="w-6 h-6 text-emerald-600 stroke-[2.25]" />
            Store Safety Dashboard
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Real-time Food Standards cooling audit overview. Click on any equipment unit card to inspect or document.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-100 bg-slate-50 text-slate-600 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Active Surveillance
          </div>
        </div>
      </div>

      {/* FRAME 1: Manual Food Standards Regulated Cabinets */}
      <div className="p-6 md:p-8 bg-slate-50/40 rounded-3xl border border-slate-200/80">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="text-sm font-extrabold uppercase tracking-widest text-slate-700 flex items-center gap-2">
              <Thermometer className="w-5 h-5 text-emerald-600 stroke-[2]" />
              Manual Equipment Registers
            </h2>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">
              Operator logged compliance check entries. Tap unit cards to submit periodic manual audit readings.
            </p>
          </div>
          <span className="bg-slate-200/60 text-slate-700 font-mono text-[10px] font-bold px-2 py-0.5 rounded-full">
            {equipments.filter((e) => !e.isJaalee).length} Items
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {equipments.filter((e) => !e.isJaalee).length > 0 ? (
            [...equipments]
              .filter((e) => !e.isJaalee)
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((equip) => {
                const latestReading = getCurrentReading(equip.id);
                const currentTemp = latestReading ? latestReading.temperature : null;
                const { minNotify, maxNotify } = getAlertThresholds(equip);
                const isOutOfZone = currentTemp !== null && (currentTemp < minNotify || currentTemp > maxNotify);
                const isSelected = selectedEquipId === equip.id;

                return (
                  <button
                    key={equip.id}
                    type="button"
                    onClick={() => {
                      setSelectedEquipId(equip.id);
                      setManualTempString('');
                      setLogError('');
                    }}
                    className={`text-left rounded-2xl p-4 sm:p-5 border cursor-pointer transition-all ${
                      isOutOfZone
                        ? 'bg-red-50/50 border-red-200 hover:border-red-400 ring-2 ring-red-100 ring-offset-1'
                        : isSelected
                        ? 'bg-emerald-50/20 border-emerald-500 hover:border-emerald-600 ring-2 ring-emerald-100'
                        : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
                    }`}
                  >
                    <div className="flex justify-between items-start gap-1 mb-2.5">
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold tracking-tight bg-slate-100 text-slate-700 border border-slate-200">
                        Manual Entry
                      </span>

                      {isOutOfZone ? (
                        <span className="flex items-center gap-1 text-red-600 bg-red-100 border border-red-200 rounded p-0.5 animate-bounce" title="WARNING: Temperature Out of Safe Range!">
                          <Bell className="w-3.5 h-3.5 text-red-600 stroke-[2.5]" />
                        </span>
                      ) : currentTemp !== null ? (
                        <span className="text-emerald-700 bg-emerald-50 p-0.5 rounded border border-emerald-100">
                          <CheckCircle className="w-3.5 h-3.5 stroke-[2.5]" />
                        </span>
                      ) : (
                        <span className="text-amber-600 bg-amber-50 p-0.5 px-1.5 rounded border border-amber-200 font-bold text-[9px] uppercase tracking-wider">
                          Needs Check
                        </span>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div>
                        <h3 className="text-xs sm:text-sm font-bold text-slate-900 line-clamp-1">{equip.name}</h3>
                        <p className="text-[10px] sm:text-xs text-slate-500 font-medium truncate">{equip.location}</p>
                      </div>

                      <div className="flex justify-between items-baseline pt-1.5">
                        <div>
                          <span className="text-[8px] sm:text-[9px] uppercase font-bold text-slate-400 block tracking-widest leading-none mb-0.5">Temp</span>
                          <span className={`text-base sm:text-lg font-black font-mono tracking-tight ${
                            isOutOfZone ? 'text-red-600' : 'text-slate-800'
                          }`}>
                            {currentTemp !== null ? `${currentTemp.toFixed(1)}°C` : '—'}
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="text-[8px] sm:text-[9px] uppercase font-bold text-slate-400 block tracking-widest leading-none mb-0.5">Zone</span>
                          <span className="font-mono text-[9px] sm:text-[10px] text-slate-500 font-medium">
                            {equip.tempMinThreshold}°C to {equip.tempMaxThreshold}°C
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3.5 pt-2.5 border-t border-slate-100 flex justify-between items-center text-[9px] text-slate-400">
                      <span className="text-slate-600 bg-slate-100/60 font-semibold px-2 py-0.5 rounded text-[8px] tracking-wide uppercase">
                        Operator
                      </span>
                      {latestReading ? (
                        <span className="text-slate-400 font-mono flex items-center gap-0.5">
                          <Clock className="w-3 h-3" />
                          {new Date(latestReading.timestamp).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      ) : (
                        <span className="text-red-500 font-bold text-[8px] uppercase">No logs today</span>
                      )}
                    </div>
                  </button>
                );
              })
          ) : (
            <div className="col-span-full bg-white border border-slate-200 border-dashed p-8 rounded-2xl text-center text-slate-400">
              <Thermometer className="w-8 h-8 mx-auto text-slate-300 stroke-[1.5] mb-2" />
              <h4 className="font-bold text-slate-700 text-xs">No manually registered cabinets yet</h4>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Go to Equipment tab to create a manual food temperature track card.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* FRAME 2: Jaalee IoT Smart Wireless Electronic Monitors */}
      <div className="p-6 md:p-8 bg-sky-50/20 rounded-3xl border border-sky-100">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="text-sm font-extrabold uppercase tracking-widest text-sky-950 flex items-center gap-2">
              <Radio className="w-5 h-5 text-sky-600 stroke-[2] animate-pulse" />
              Jaalee Bluetooth Wireless Sensors
            </h2>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">
              Automated continuous electronic microclimate tracking. Syncs historical telemetry charts securely over the cloud.
            </p>
          </div>
          <span className="bg-sky-100 text-sky-800 font-mono text-[10px] font-bold px-2 py-0.5 rounded-full border border-sky-200/50">
            {equipments.filter((e) => e.isJaalee).length} Wireless Sensors
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {equipments.filter((e) => e.isJaalee).length > 0 ? (
            [...equipments]
              .filter((e) => e.isJaalee)
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((equip) => {
                const latestReading = getCurrentReading(equip.id);
                const currentTemp = latestReading ? latestReading.temperature : null;
                const { minNotify, maxNotify } = getAlertThresholds(equip);
                const isOutOfZone = currentTemp !== null && (currentTemp < minNotify || currentTemp > maxNotify);
                const isSelected = selectedEquipId === equip.id;

                return (
                  <button
                    key={equip.id}
                    type="button"
                    onClick={() => {
                      setSelectedEquipId(equip.id);
                      setManualTempString('');
                      setLogError('');
                    }}
                    className={`text-left rounded-2xl p-4 sm:p-5 border cursor-pointer transition-all ${
                      isOutOfZone
                        ? 'bg-red-50/50 border-red-200 hover:border-red-400 ring-2 ring-red-100 ring-offset-1'
                        : isSelected
                        ? 'bg-sky-50 border-sky-400 hover:border-sky-500 ring-2 ring-sky-100'
                        : 'bg-white border-slate-200 hover:border-sky-200 shadow-2xs'
                    }`}
                  >
                    <div className="flex justify-between items-start gap-1 mb-2.5">
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold tracking-tight bg-sky-50 text-sky-700 border border-sky-100 uppercase">
                        <Radio className="w-2.5 h-2.5 stroke-[2.5]" />
                        IoT Active
                      </span>

                      {isOutOfZone ? (
                        <span className="flex items-center gap-1 text-red-600 bg-red-100 border border-red-200 rounded p-0.5 animate-bounce" title="WARNING: Temperature Out of Safe Range!">
                          <Bell className="w-3.5 h-3.5 text-red-600 stroke-[2.5]" />
                        </span>
                      ) : currentTemp !== null ? (
                        <span className="text-emerald-700 bg-emerald-50 p-0.5 rounded border border-emerald-100">
                          <CheckCircle className="w-3.5 h-3.5 stroke-[2.5]" />
                        </span>
                      ) : (
                        <span className="text-slate-400 bg-slate-50 p-0.5 rounded border border-slate-200 italic text-[9px] px-1.5 font-medium">
                          No logs
                        </span>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div>
                        <h3 className="text-xs sm:text-sm font-bold text-slate-900 line-clamp-1">{equip.name}</h3>
                        <p className="text-[10px] sm:text-xs text-sky-600/80 font-medium truncate">MAC: {equip.mac}</p>
                      </div>

                      <div className="flex justify-between items-baseline pt-1.5">
                        <div>
                          <span className="text-[8px] sm:text-[9px] uppercase font-bold text-slate-400 block tracking-widest leading-none mb-0.5">Temp</span>
                          <span className={`text-base sm:text-lg font-black font-mono tracking-tight ${
                            isOutOfZone ? 'text-red-600' : 'text-sky-800 font-extrabold'
                          }`}>
                            {currentTemp !== null ? `${currentTemp.toFixed(1)}°C` : '—'}
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="text-[8px] sm:text-[9px] uppercase font-bold text-slate-400 block tracking-widest leading-none mb-0.5">Zone</span>
                          <span className="font-mono text-[9px] sm:text-[10px] text-slate-500 font-medium">
                            {equip.tempMinThreshold}°C to {equip.tempMaxThreshold}°C
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3.5 pt-2.5 border-t border-slate-100 flex justify-between text-[9px] text-slate-400">
                      <span className="flex items-center gap-0.5 text-slate-600 font-bold bg-slate-100/70 px-1 py-0.5 rounded border border-slate-200/50">
                        <Battery className="w-3 h-3 text-emerald-500 stroke-[2.5]" />
                        {equip.power ?? 100}%
                      </span>
                      {latestReading && (
                        <span className="text-slate-400 font-mono">
                          {new Date(latestReading.timestamp).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
          ) : (
            <div className="col-span-full bg-white border border-slate-200 border-dashed p-8 rounded-2xl text-center text-slate-400">
              <Radio className="w-8 h-8 mx-auto text-slate-300 stroke-[1.5] mb-2" />
              <h4 className="font-bold text-slate-700 text-xs">No wireless sensors connected</h4>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Authenticate with Jaalee servers inside settings to synchronize IoT hardware channels.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* JAALEE CLOUD SYNC CONTROL UNIT */}
      <div className="bg-sky-50/55 border border-sky-100/90 rounded-3xl p-6 flex flex-col md:flex-row items-center justify-between gap-5 shadow-2xs">
        <div className="flex items-start gap-3.5 text-left w-full md:w-auto">
          <div className="p-3 bg-sky-100 text-sky-800 rounded-2xl shrink-0 border border-sky-200/60 shadow-2xs">
            <Radio className="w-6 h-6 stroke-[2.25] animate-pulse" />
          </div>
          <div>
            <h3 className="font-black text-sm text-sky-950 uppercase tracking-wide">Jaalee Bluetooth Cloud Sync</h3>
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
              Retrieve all oldest available sensor archives from Jaalee cloud servers instantly.
            </p>
            <div className="mt-2 text-[11px] text-slate-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-sky-500" />
              <span>Link Account: <strong>{jaaleeConfig.isLoggedIn ? jaaleeConfig.account : 'Not linked'}</strong></span>
              {jaaleeConfig.lastImportTime && (
                <>
                  <span className="text-slate-300">|</span>
                  <span>Last Synced: <strong>{jaaleeConfig.lastImportTime}</strong></span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="w-full md:w-auto flex items-center shrink-0">
          <button
            type="button"
            onClick={onRefreshJaalee}
            disabled={!canSyncIoT || isSyncingJaalee || !jaaleeConfig.isLoggedIn}
            className="w-full md:w-auto flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-extrabold text-xs px-6 py-3.5 rounded-2xl transition-all cursor-pointer shadow-sm tracking-widest uppercase disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncingJaalee ? 'animate-spin' : ''}`} />
            {isSyncingJaalee ? 'Importing Archives...' : 'Jaalee Bluetooth Cloud Sync'}
          </button>
        </div>
      </div>

      {/* INSPECTION MODAL */}
      {selectedEquip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity cursor-pointer"
            onClick={() => setSelectedEquipId(null)}
          />

          <div className="relative bg-white rounded-3xl border border-slate-200 shadow-2xl p-5 sm:p-7 w-full max-w-xl max-h-[85vh] overflow-y-auto z-10 space-y-6">
            <button
              type="button"
              onClick={() => setSelectedEquipId(null)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="border-b border-slate-100 pb-4 pr-6">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-tight mb-2 ${
                selectedEquip.isJaalee ? 'bg-sky-50 text-sky-700 border border-sky-100' : 'bg-slate-100 text-slate-700 border border-slate-200'
              }`}>
                {selectedEquip.isJaalee ? <Radio className="w-2.5 h-2.5" /> : null}
                {selectedEquip.isJaalee ? 'Jaalee Wireless IoT System' : 'Manual Paperless Registry'}
              </span>
              <h2 className="text-xl font-black text-slate-900 tracking-tight leading-snug">{selectedEquip.name}</h2>
              <p className="text-xs text-slate-500 font-semibold mt-1">
                Type: {selectedEquip.type} | Location: {selectedEquip.location} | Safe Zone (Standard): {selectedEquip.tempMinThreshold}°C to {selectedEquip.tempMaxThreshold}°C | Alert Trigger (Custom): {selectedEquipMinNotify}°C to {selectedEquipMaxNotify}°C
              </p>
            </div>

            {/* Manual Check logger (gated by canLogTemperature) */}
            {!selectedEquip.isJaalee && (
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
                  <Plus className="w-4 h-4 text-emerald-600" />
                  Perform Temperature Logging
                </h3>

                {canLogTemperature ? (
                  <form onSubmit={(e) => handleManualSubmit(e, selectedEquip)} className="space-y-3">
                    <div className="text-xs">
                      <label className="block font-bold text-slate-500 uppercase tracking-widest text-[9px]">Curr Temp (°C)</label>
                      <div className="flex gap-2 mt-1">
                        <input
                          type="text"
                          required
                          value={manualTempString}
                          onChange={(e) => setManualTempString(e.target.value)}
                          placeholder="e.g. 3.4"
                          className="flex-1 block w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-slate-900 font-mono font-bold focus:ring-1 focus:ring-emerald-500 focus:outline-none text-sm"
                        />
                        <button
                          type="submit"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-5 py-2 rounded-xl transition-all cursor-pointer shadow-xs uppercase tracking-wide shrink-0"
                        >
                          Log Temperature
                        </button>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1.5 font-semibold flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        Logging Operator Sign: <strong className="text-slate-700">{currentUser.name}</strong>
                      </p>
                    </div>

                    {logError && <p className="text-[11px] text-red-600 font-bold">{logError}</p>}
                  </form>
                ) : (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3 font-medium">
                    Read-only access: Your KSBM role does not have permission to submit temperature logs.
                  </p>
                )}
              </div>
            )}

            {/* Temperature Stat Digit Card */}
            <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
              <div className="p-3 bg-white rounded-xl text-emerald-600 border border-slate-200 shadow-xs shrink-0">
                <Thermometer className="w-6 h-6 stroke-[2.5]" />
              </div>
              <div className="text-xs">
                <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block">Latest Documented</span>
                <div className="flex items-baseline gap-1.5">
                  <span className={`text-xl font-black font-mono ${
                    selectedReading && (selectedReading.temperature < selectedEquipMinNotify || selectedReading.temperature > selectedEquipMaxNotify) ? 'text-red-600' : 'text-slate-900'
                  }`}>
                    {selectedReading ? `${selectedReading.temperature.toFixed(1)}°C` : 'N/A'}
                  </span>
                  {selectedReading && selectedReading.humidity !== undefined && (
                    <span className="text-xs text-slate-500 font-mono">
                      ({selectedReading.humidity.toFixed(0)}% Hum)
                    </span>
                  )}
                </div>
                {selectedReading && (
                  <span className="text-[10px] text-slate-400 block pt-0.5 leading-snug">
                    Logged {new Date(selectedReading.timestamp).toLocaleDateString('en-AU')} {new Date(selectedReading.timestamp).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })} by <strong>{selectedReading.enteredBy}</strong>
                  </span>
                )}
              </div>
            </div>

            {/* CHART PREVIEW */}
            <div className="space-y-2">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                  Temperature History Chart
                </h3>
                <div className="flex gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                  {(['hour', 'day', 'week', 'month'] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setChartPeriod(p)}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase transition-all whitespace-nowrap cursor-pointer ${
                        chartPeriod === p
                          ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/50'
                          : 'text-slate-400 hover:text-slate-700'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div className="h-52 bg-slate-50 rounded-xl p-2 border border-slate-100 flex items-center justify-center">
                {getChartData(selectedEquip.id, chartPeriod).length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={getChartData(selectedEquip.id, chartPeriod)}>
                      <defs>
                        <linearGradient id="ksbmColorTemp" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="label" tick={{ fontSize: 8, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
                      <Tooltip
                        contentStyle={{ fontSize: '11px', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                        labelFormatter={(label, items) => {
                          if (items && items[0]) {
                            return `${label} (${items[0].payload.date})`;
                          }
                          return label;
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="temp"
                        stroke="#10b981"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#ksbmColorTemp)"
                        name="Temp (°C)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center text-slate-400 text-xs p-4 leading-relaxed">
                    No historical readings documented. Enter a check above to compile visual data logs.
                  </div>
                )}
              </div>
            </div>

            {/* RECENT READING HISTORY TABLE */}
            <div className="space-y-2">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Previous Audited Logs</h3>
              <div className="max-h-36 overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded-xl">
                {[...records]
                  .filter((r) => r.equipmentId === selectedEquip.id)
                  .sort((a, b) => b.timestamp - a.timestamp)
                  .map((rec) => {
                    const isErr = rec.temperature < selectedEquipMinNotify || rec.temperature > selectedEquipMaxNotify;
                    return (
                      <div key={rec.id} className="p-3 text-xs flex justify-between items-center bg-white hover:bg-slate-50/50 transition-colors">
                        <div>
                          <span className="font-mono font-bold text-slate-800">{rec.temperature.toFixed(1)}°C</span>
                          <span className="text-slate-400 font-mono text-[10px] pl-2">
                            {new Date(rec.timestamp).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div className="text-right space-y-0.5">
                          <span className="text-[10px] text-slate-400 block font-medium">Logged by {rec.enteredBy}</span>
                          {isErr ? (
                            <span className="inline-block text-[9px] font-bold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-md uppercase">
                              Out of zone
                            </span>
                          ) : (
                            <span className="inline-block text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md uppercase">
                              Safe
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}

                {records.filter((r) => r.equipmentId === selectedEquip.id).length === 0 && (
                  <div className="p-4 text-center text-slate-400 text-xs">No records logged yet.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
