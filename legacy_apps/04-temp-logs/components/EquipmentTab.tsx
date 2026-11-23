import React, { useState } from 'react';
import { Plus, Trash2, Edit, Radio, Shield, Thermometer, MapPin, Settings, Info, Battery, Check, X } from 'lucide-react';
import { Equipment, EquipmentType } from '../types';
import { DEFAULT_THRESHOLDS } from '../constants';

interface EquipmentTabProps {
  equipments: Equipment[];
  onAddEquipment: (equip: Omit<Equipment, 'id' | 'createdAt'>) => void;
  onUpdateEquipment: (equip: Equipment) => void;
  onDeleteEquipment: (id: string) => void;
  canManageEquipment: boolean;
}

export default function EquipmentTab({
  equipments,
  onAddEquipment,
  onUpdateEquipment,
  onDeleteEquipment,
  canManageEquipment,
}: EquipmentTabProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // New Equipment Form State
  const [name, setName] = useState('');
  const [type, setType] = useState<EquipmentType>('Fridge');
  const [location, setLocation] = useState('');
  const [tempMin, setTempMin] = useState<string | number>(1.0);
  const [tempMax, setTempMax] = useState<string | number>(5.0);
  const [notifyMin, setNotifyMin] = useState<string | number>(1.0);
  const [notifyMax, setNotifyMax] = useState<string | number>(5.0);

  // Editing Equipment Form State
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState<EquipmentType>('Fridge');
  const [editLocation, setEditLocation] = useState('');
  const [editTempMin, setEditTempMin] = useState<string | number>(1.0);
  const [editTempMax, setEditTempMax] = useState<string | number>(5.0);
  const [editNotifyMin, setEditNotifyMin] = useState<string | number>(1.0);
  const [editNotifyMax, setEditNotifyMax] = useState<string | number>(5.0);

  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedType = e.target.value as EquipmentType;
    setType(selectedType);
    const defaults = DEFAULT_THRESHOLDS[selectedType];
    setTempMin(defaults.min);
    setTempMax(defaults.max);
    setNotifyMin(defaults.min);
    setNotifyMax(defaults.max);
  };

  const handleEditTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedType = e.target.value as EquipmentType;
    setEditType(selectedType);
    const defaults = DEFAULT_THRESHOLDS[selectedType];
    setEditTempMin(defaults.min);
    setEditTempMax(defaults.max);
    setEditNotifyMin(defaults.min);
    setEditNotifyMax(defaults.max);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageEquipment || !name.trim()) return;

    onAddEquipment({
      name,
      type,
      location: location || 'Main Kitchen',
      isJaalee: false,
      tempMinThreshold: Number(tempMin),
      tempMaxThreshold: Number(tempMax),
      notifyMinThreshold: Number(notifyMin),
      notifyMaxThreshold: Number(notifyMax),
    });

    setName('');
    setType('Fridge');
    setLocation('');
    setTempMin(1.0);
    setTempMax(5.0);
    setNotifyMin(1.0);
    setNotifyMax(5.0);
    setIsAdding(false);
  };

  const startEditing = (equip: Equipment) => {
    if (!canManageEquipment) return;
    setEditingId(equip.id);
    setEditName(equip.name);
    setEditType(equip.type);
    setEditLocation(equip.location);
    setEditTempMin(equip.tempMinThreshold);
    setEditTempMax(equip.tempMaxThreshold);
    setEditNotifyMin(equip.notifyMinThreshold !== undefined ? equip.notifyMinThreshold : equip.tempMinThreshold);
    setEditNotifyMax(equip.notifyMaxThreshold !== undefined ? equip.notifyMaxThreshold : equip.tempMaxThreshold);
  };

  const saveEdit = (e: React.FormEvent, equip: Equipment) => {
    e.preventDefault();
    if (!canManageEquipment) return;
    onUpdateEquipment({
      ...equip,
      name: editName,
      type: editType,
      location: editLocation,
      tempMinThreshold: Number(editTempMin),
      tempMaxThreshold: Number(editTempMax),
      notifyMinThreshold: Number(editNotifyMin),
      notifyMaxThreshold: Number(editNotifyMax),
    });
    setEditingId(null);
  };

  const manualEquips = equipments.filter((e) => !e.isJaalee);
  const jaaleeEquips = equipments.filter((e) => e.isJaalee);

  const renderEquipmentRow = (equip: Equipment) => {
    const isEditing = editingId === equip.id;

    return (
      <div
        key={equip.id}
        className={`p-4 sm:p-5 transition-colors ${
          isEditing ? 'bg-slate-50/50' : 'hover:bg-slate-50/30'
        }`}
      >
        {isEditing ? (
          <form onSubmit={(e) => saveEdit(e, equip)} className="space-y-4 w-full">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 flex items-center gap-1">
                <Settings className="w-3.5 h-3.5" />
                Configure {equip.name}
              </span>
              <div className="flex gap-1.5">
                <button
                  type="submit"
                  className="p-1 px-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 cursor-pointer flex items-center gap-1 text-xs font-semibold shadow-xs"
                  title="Save Changes"
                >
                  <Check className="w-3.5 h-3.5" />
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  className="p-1 px-2.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 cursor-pointer flex items-center gap-1 text-xs font-semibold"
                  title="Cancel"
                >
                  <X className="w-3.5 h-3.5" />
                  Back
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400">Unit Name</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="mt-1 block w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400">Device Type</label>
                <select
                  value={editType}
                  onChange={handleEditTypeChange}
                  className="mt-1 block w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="Fridge">Fridge</option>
                  <option value="Freezer">Freezer</option>
                  <option value="Hot Box">Hot Box</option>
                  <option value="Ambient Box">Ambient Box</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400">Location</label>
                <input
                  type="text"
                  value={editLocation}
                  onChange={(e) => setEditLocation(e.target.value)}
                  className="mt-1 block w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400">Safe Min</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={editTempMin}
                    onKeyDown={(e) => { if (e.key === 'e' || e.key === 'E') e.preventDefault(); }}
                    onChange={(e) => setEditTempMin(e.target.value)}
                    className="mt-1 block w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400">Safe Max</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={editTempMax}
                    onKeyDown={(e) => { if (e.key === 'e' || e.key === 'E') e.preventDefault(); }}
                    onChange={(e) => setEditTempMax(e.target.value)}
                    className="mt-1 block w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 bg-amber-50/40 p-1.5 rounded-lg border border-amber-100">
                <div>
                  <label className="block text-[9px] font-extrabold uppercase tracking-widest text-amber-800 leading-none">Notify Min</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={editNotifyMin}
                    onKeyDown={(e) => { if (e.key === 'e' || e.key === 'E') e.preventDefault(); }}
                    onChange={(e) => setEditNotifyMin(e.target.value)}
                    className="mt-1 block w-full bg-white border border-slate-200 rounded px-1.5 py-1 text-[11px] font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-extrabold uppercase tracking-widest text-amber-800 leading-none">Notify Max</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={editNotifyMax}
                    onKeyDown={(e) => { if (e.key === 'e' || e.key === 'E') e.preventDefault(); }}
                    onChange={(e) => setEditNotifyMax(e.target.value)}
                    className="mt-1 block w-full bg-white border border-slate-200 rounded px-1.5 py-1 text-[11px] font-mono font-bold"
                  />
                </div>
              </div>
            </div>
          </form>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 sm:w-1/3 min-w-[220px]">
              <div className={`p-2.5 rounded-xl border shrink-0 ${
                equip.isJaalee ? 'bg-sky-50 text-sky-700 border-sky-100 shadow-xs' : 'bg-slate-50 text-slate-600 border-slate-200'
              }`}>
                {equip.isJaalee ? <Radio className="w-5 h-5 animate-pulse text-sky-600" /> : <Thermometer className="w-5 h-5" />}
              </div>

              <div className="space-y-0.5">
                <h3 className="text-sm font-extrabold text-slate-900 tracking-tight leading-snug line-clamp-1">{equip.name}</h3>
                <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium">
                  <span className="flex items-center gap-0.5">
                    <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                    {equip.location}
                  </span>
                  <span className="text-slate-300 pointer-events-none">•</span>
                  <span className="font-bold text-slate-600">{equip.type}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-xs text-slate-600 sm:w-1/2">
              <div className="space-y-0.5">
                <span className="block text-[9px] uppercase font-bold text-slate-400 tracking-widest leading-none">Safe Zone Limits</span>
                <span className="font-mono font-bold text-slate-700 bg-slate-50 px-2 py-0.5 rounded border border-slate-100 text-[10px]">
                  {equip.tempMinThreshold}°C to {equip.tempMaxThreshold}°C
                </span>
              </div>

              <div className="space-y-0.5">
                <span className="block text-[9px] uppercase font-bold text-amber-800 tracking-widest leading-none">Alert Notification Limits</span>
                <span className="font-mono font-bold text-amber-900 bg-amber-50 px-2 py-0.5 rounded border border-amber-100 text-[10px]">
                  {equip.notifyMinThreshold !== undefined ? equip.notifyMinThreshold : equip.tempMinThreshold}°C to {equip.notifyMaxThreshold !== undefined ? equip.notifyMaxThreshold : equip.tempMaxThreshold}°C
                </span>
              </div>

              {equip.isJaalee ? (
                <div className="flex items-center gap-5">
                  <div className="space-y-0.5">
                    <span className="block text-[9px] uppercase font-bold text-slate-400 tracking-widest leading-none">MAC ADDR</span>
                    <span className="font-mono text-[10.5px] text-slate-500 font-semibold">{equip.mac}</span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="block text-[9px] uppercase font-bold text-slate-400 tracking-widest leading-none">Battery Status</span>
                    <span className="flex items-center gap-0.5 text-[9.5px] text-emerald-600 font-extrabold bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded">
                      <Battery className="w-3.5 h-3.5 text-emerald-500" />
                      {equip.power ?? 100}%
                    </span>
                  </div>
                </div>
              ) : (
                <div className="space-y-0.5">
                  <span className="block text-[9px] uppercase font-bold text-slate-400 tracking-widest leading-none">Logging System</span>
                  <span className="text-[10px] bg-amber-50 text-amber-800 border border-amber-100 px-2 py-0.5 rounded-md font-bold uppercase tracking-wide">
                    Manual Paperless Table
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-3 border-t sm:border-t-0 pt-2.5 sm:pt-0 sm:w-1/6">
              <span className="sm:hidden text-[10px] text-slate-400">Added {new Date(equip.createdAt).toLocaleDateString()}</span>
              <span className="hidden sm:inline text-xs text-slate-400 font-mono font-semibold">
                {new Date(equip.createdAt).toLocaleDateString('en-AU', { day: '2-digit', month: 'short' })}
              </span>

              {canManageEquipment && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => startEditing(equip)}
                    className="p-1 px-1.5 text-slate-400 hover:text-emerald-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                    title="Edit Equipment Details"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  {!equip.isJaalee && (
                    <button
                      type="button"
                      onClick={() => onDeleteEquipment(equip.id)}
                      className="p-1 px-1.5 text-slate-400 hover:text-red-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                      title="Delete Equipment"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-slate-100 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Equipment Directory</h1>
          <p className="text-sm text-slate-500">
            Define compliance thresholds for cold/hot holding equipment and configure Jaalee wireless trackers.
          </p>
        </div>
        {canManageEquipment ? (
          <button
            type="button"
            onClick={() => setIsAdding(!isAdding)}
            className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm px-4 py-2.5 rounded-xl shadow-sm transition-colors cursor-pointer"
          >
            {isAdding ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {isAdding ? 'Close Drawer' : 'Add Manual Equipment'}
          </button>
        ) : (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs py-2 px-3.5 rounded-xl flex items-center gap-2 font-medium">
            <Shield className="w-4 h-4 text-amber-600" />
            Staff Access: Add/Edit/Delete managed by Admin permission
          </div>
        )}
      </div>

      {isAdding && canManageEquipment && (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm max-w-2xl space-y-4">
          <h2 className="text-base font-bold text-slate-900">Configure New Food Service Equipment</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">Equipment Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Prep Bench Under-Counter Fridge"
                className="mt-1 block w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">Equipment Type</label>
              <select
                value={type}
                onChange={handleTypeChange}
                className="mt-1 block w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
              >
                <option value="Fridge">Fridge (Safe: below 5°C)</option>
                <option value="Freezer">Freezer (Safe: below -15°C)</option>
                <option value="Hot Box">Hot Box (Safe: above 60°C)</option>
                <option value="Ambient Box">Ambient / Pantry Box</option>
                <option value="Other">Other Custom Type</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">Location</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g., Cold Kitchen, Pastry Area"
                className="mt-1 block w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">Safe Min Limit (°C)</label>
                <input
                  type="number"
                  step="0.1"
                  required
                  value={tempMin}
                  onKeyDown={(e) => { if (e.key === 'e' || e.key === 'E') e.preventDefault(); }}
                  onChange={(e) => setTempMin(e.target.value)}
                  className="mt-1 block w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">Safe Max Limit (°C)</label>
                <input
                  type="number"
                  step="0.1"
                  required
                  value={tempMax}
                  onKeyDown={(e) => { if (e.key === 'e' || e.key === 'E') e.preventDefault(); }}
                  onChange={(e) => setTempMax(e.target.value)}
                  className="mt-1 block w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 p-3.5 bg-amber-50/50 border border-amber-100 rounded-2xl">
              <div className="col-span-2">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-amber-800 leading-none mb-1">
                  Alert Settings (Override Safe Zone Notifications)
                </span>
                <span className="block text-[10.5px] text-slate-500 leading-tight">
                  Manually define the temperature scope that triggers warnings and notifications.
                </span>
              </div>
              <div className="mt-1">
                <label className="block text-[10px] font-bold text-slate-500">Min Alert Trigger (°C)</label>
                <input
                  type="number"
                  step="0.1"
                  required
                  value={notifyMin}
                  onKeyDown={(e) => { if (e.key === 'e' || e.key === 'E') e.preventDefault(); }}
                  onChange={(e) => setNotifyMin(e.target.value)}
                  className="mt-1 block w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono font-bold"
                />
              </div>
              <div className="mt-1">
                <label className="block text-[10px] font-bold text-slate-500">Max Alert Trigger (°C)</label>
                <input
                  type="number"
                  step="0.1"
                  required
                  value={notifyMax}
                  onKeyDown={(e) => { if (e.key === 'e' || e.key === 'E') e.preventDefault(); }}
                  onChange={(e) => setNotifyMax(e.target.value)}
                  className="mt-1 block w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono font-bold"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-5 py-2 rounded-xl transition-colors cursor-pointer"
            >
              Verify & Add Equipment
            </button>
          </div>
        </form>
      )}

      <div className="space-y-8">
        <div className="space-y-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50 border border-slate-100 rounded-2xl p-4 sm:px-5">
            <div>
              <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Thermometer className="w-4 h-4 text-emerald-600" />
                Manual Registry Equipment
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Food-grade storage systems requiring offline paperless clipboard checks.
              </p>
            </div>
            <div className="self-start sm:self-center">
              <span className="inline-flex items-center text-xs font-bold text-slate-700 bg-slate-200/50 px-3 py-1 rounded-full border border-slate-200/60 font-mono">
                {manualEquips.length} {manualEquips.length === 1 ? 'Unit' : 'Units'}
              </span>
            </div>
          </div>

          <div className="border border-slate-200 bg-white rounded-2xl divide-y divide-slate-100 overflow-hidden shadow-xs">
            {manualEquips.map(renderEquipmentRow)}

            {manualEquips.length === 0 && (
              <div className="bg-slate-50/10 p-10 text-center text-slate-500 border-dashed border border-slate-200 rounded-2xl m-3">
                <Thermometer className="w-9 h-9 mx-auto text-slate-300 stroke-[1.5] mb-2" />
                <h4 className="font-extrabold text-xs text-slate-700">No Manual Equipment</h4>
                <p className="text-[10.5px] text-slate-400 mt-0.5 max-w-xs mx-auto">
                  Click 'Add Manual Equipment' above to log your cold/hot holding storage units.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-sky-50/30 border border-sky-100 rounded-2xl p-4 sm:px-5">
            <div>
              <h2 className="text-sm font-black text-sky-900 uppercase tracking-wider flex items-center gap-2">
                <Radio className="w-4 h-4 text-sky-500 animate-pulse" />
                Jaalee Wireless IoT System
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Active wireless Bluetooth telemetry synced dynamically with smart safety zones.
              </p>
            </div>
            <div className="self-start sm:self-center">
              <span className="inline-flex items-center text-xs font-bold text-sky-800 bg-sky-50 px-3 py-1 rounded-full border border-sky-100 font-mono">
                {jaaleeEquips.length} {jaaleeEquips.length === 1 ? 'Sensor' : 'Sensors'}
              </span>
            </div>
          </div>

          <div className="border border-slate-200 bg-white rounded-2xl divide-y divide-slate-100 overflow-hidden shadow-xs">
            {jaaleeEquips.map(renderEquipmentRow)}

            {jaaleeEquips.length === 0 && (
              <div className="bg-slate-50/10 p-10 text-center text-slate-500 border-dashed border border-slate-200 rounded-2xl m-3">
                <Radio className="w-9 h-9 mx-auto text-slate-300 stroke-[1.5] mb-2" />
                <h4 className="font-extrabold text-xs text-slate-700">No IoT Trackers Active</h4>
                <p className="text-[10.5px] text-slate-400 mt-0.5 max-w-xs mx-auto">
                  Sign in with your Jaalee gateway in Module Settings to automatically enroll connected sensors.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 flex gap-3 text-slate-600 text-xs leading-relaxed">
        <Info className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-slate-800 block mb-0.5">Australian Food Safety Standards Guidance:</span>
          Safe holding limit for cooled foods is {'<= 5°C'}. Safe hot holding is {'>= 60°C'}. Cold storage freezers must prevent ice deterioration, ideally maintaining {'<= -15°C'}. Out-of-zone excursions will trigger live dashboard alerts and persistent notifications.
        </div>
      </div>
    </div>
  );
}
