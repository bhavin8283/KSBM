import { useEffect, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Edit3,
  Eye,
  EyeOff,
  KeyRound,
  Plus,
  RotateCcw,
  Save,
  Shield,
  Store,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import {
  createRolePresetPermissions,
  type BusinessConfig,
  type StaffPermissions,
  type StaffProfile,
} from '../../types';

interface SettingsModuleProps {
  currentUser: StaffProfile;
}

type SettingsTab = 'staff' | 'business';

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label: string;
}

function ToggleSwitch({ checked, onChange, disabled = false, label }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 ${
        disabled
          ? 'cursor-not-allowed opacity-45 bg-slate-200 border-slate-200'
          : checked
            ? 'cursor-pointer bg-orange-600 border-orange-600'
            : 'cursor-pointer bg-slate-200 border-slate-300 hover:bg-slate-300'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

const ROLE_PRESETS = ['Admin / Owner', 'Store Manager', 'Floor Staff'] as const;

export function SettingsModule({ currentUser }: SettingsModuleProps) {
  const {
    businessConfig,
    updateBusinessConfig,
    staffList,
    addStaffMember,
    updateStaffMember,
    deleteStaffMember,
  } = useStore();

  const [activeTab, setActiveTab] = useState<SettingsTab>('staff');
  const [selectedStaffId, setSelectedStaffId] = useState<string>(
    () => staffList[0]?.id ?? currentUser.id
  );
  const [revealedPins, setRevealedPins] = useState<Record<string, boolean>>({});
  const [feedbackBanner, setFeedbackBanner] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Add Staff modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('Floor Staff');
  const [newPin, setNewPin] = useState('');
  const [newShiftLabel, setNewShiftLabel] = useState('');
  const [addFormError, setAddFormError] = useState<string | null>(null);

  // Edit Staff / Reset PIN modal state
  const [editingStaff, setEditingStaff] = useState<StaffProfile | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editPin, setEditPin] = useState('');
  const [editShiftLabel, setEditShiftLabel] = useState('');
  const [editFormError, setEditFormError] = useState<string | null>(null);

  // Business Config draft state
  const [configDraft, setConfigDraft] = useState<BusinessConfig>(businessConfig);
  const [newSupplierInput, setNewSupplierInput] = useState('');

  useEffect(() => {
    setConfigDraft(businessConfig);
  }, [businessConfig]);

  useEffect(() => {
    if (!staffList.some((member) => member.id === selectedStaffId)) {
      setSelectedStaffId(staffList[0]?.id ?? currentUser.id);
    }
  }, [currentUser.id, selectedStaffId, staffList]);

  useEffect(() => {
    if (!feedbackBanner) return;
    const timer = window.setTimeout(() => setFeedbackBanner(null), 4000);
    return () => window.clearTimeout(timer);
  }, [feedbackBanner]);

  const selectedStaff =
    staffList.find((member) => member.id === selectedStaffId) ?? staffList[0] ?? currentUser;

  const activeAdminCount = staffList.filter(
    (member) => member.active && member.permissions.adminSettings
  ).length;

  const isSelectedLastAdmin =
    selectedStaff.active && selectedStaff.permissions.adminSettings && activeAdminCount <= 1;

  const handleToggleRevealPin = (staffId: string) => {
    setRevealedPins((prev) => ({ ...prev, [staffId]: !prev[staffId] }));
  };

  const handleToggleStaffActive = (staff: StaffProfile, nextActive: boolean) => {
    const result = updateStaffMember(staff.id, { active: nextActive });
    if (!result.success) {
      setFeedbackBanner({
        type: 'error',
        message: result.error ?? 'Unable to update staff status.',
      });
      return;
    }
    setFeedbackBanner({
      type: 'success',
      message: `${staff.name} marked as ${nextActive ? 'active' : 'inactive'}.`,
    });
  };

  const handleDeleteStaff = (staff: StaffProfile) => {
    const result = deleteStaffMember(staff.id);
    if (!result.success) {
      setFeedbackBanner({
        type: 'error',
        message: result.error ?? 'Unable to delete staff member.',
      });
      return;
    }
    setFeedbackBanner({
      type: 'success',
      message: `${staff.name} removed from staff directory.`,
    });
  };

  const handleUpdatePermissions = (
    staff: StaffProfile,
    updater: (prev: StaffPermissions) => StaffPermissions
  ) => {
    const nextPermissions = updater(staff.permissions);
    const result = updateStaffMember(staff.id, { permissions: nextPermissions });
    if (!result.success) {
      setFeedbackBanner({
        type: 'error',
        message: result.error ?? 'Unable to update permissions.',
      });
    }
  };

  const openAddModal = () => {
    setNewName('');
    setNewRole('Floor Staff');
    setNewPin('');
    setNewShiftLabel('');
    setAddFormError(null);
    setShowAddModal(true);
  };

  const handleCreateStaff = (event: FormEvent) => {
    event.preventDefault();
    setAddFormError(null);

    const result = addStaffMember({
      name: newName,
      role: newRole,
      pin: newPin,
      active: true,
      shiftLabel: newShiftLabel.trim() || newRole.trim(),
      permissions: createRolePresetPermissions(newRole),
    });

    if (!result.success || !result.staff) {
      setAddFormError(result.error ?? 'Could not add staff member.');
      return;
    }

    setSelectedStaffId(result.staff.id);
    setShowAddModal(false);
    setFeedbackBanner({
      type: 'success',
      message: `${result.staff.name} added with PIN ${result.staff.pin}.`,
    });
  };

  const openEditModal = (staff: StaffProfile) => {
    setEditingStaff(staff);
    setEditName(staff.name);
    setEditRole(staff.role);
    setEditPin(staff.pin);
    setEditShiftLabel(staff.shiftLabel);
    setEditFormError(null);
  };

  const handleSaveStaffEdit = (event: FormEvent) => {
    event.preventDefault();
    if (!editingStaff) return;
    setEditFormError(null);

    const result = updateStaffMember(editingStaff.id, {
      name: editName,
      role: editRole,
      pin: editPin,
      shiftLabel: editShiftLabel.trim() || editRole.trim(),
    });

    if (!result.success) {
      setEditFormError(result.error ?? 'Could not save staff changes.');
      return;
    }

    setEditingStaff(null);
    setFeedbackBanner({
      type: 'success',
      message: `Updated ${editName.trim()}'s profile and PIN.`,
    });
  };

  const handleAddSupplier = () => {
    const trimmed = newSupplierInput.trim();
    if (!trimmed) return;
    if (
      configDraft.defaultSuppliers.some(
        (existing) => existing.toLowerCase() === trimmed.toLowerCase()
      )
    ) {
      setFeedbackBanner({
        type: 'error',
        message: `${trimmed} is already in the default suppliers list.`,
      });
      return;
    }
    setConfigDraft((prev) => ({
      ...prev,
      defaultSuppliers: [...prev.defaultSuppliers, trimmed],
    }));
    setNewSupplierInput('');
  };

  const handleRemoveSupplier = (supplierName: string) => {
    setConfigDraft((prev) => ({
      ...prev,
      defaultSuppliers: prev.defaultSuppliers.filter((item) => item !== supplierName),
    }));
  };

  const handleSaveBusinessConfig = (event: FormEvent) => {
    event.preventDefault();
    if (!configDraft.storeName.trim() || !configDraft.address.trim()) {
      setFeedbackBanner({
        type: 'error',
        message: 'Store Name and Street Address are required.',
      });
      return;
    }
    if (configDraft.fridgeTempRange.min >= configDraft.fridgeTempRange.max) {
      setFeedbackBanner({
        type: 'error',
        message: 'Display fridge min temperature must be lower than max temperature.',
      });
      return;
    }
    if (configDraft.freezerTempRange.min >= configDraft.freezerTempRange.max) {
      setFeedbackBanner({
        type: 'error',
        message: 'Freezer min temperature must be lower than max temperature.',
      });
      return;
    }

    updateBusinessConfig({
      ...configDraft,
      storeName: configDraft.storeName.trim(),
      address: configDraft.address.trim(),
      phone: configDraft.phone.trim(),
      abn: configDraft.abn.trim(),
      operatingHours: configDraft.operatingHours.trim(),
    });

    setFeedbackBanner({
      type: 'success',
      message: 'Store profile and operational thresholds saved.',
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Store &amp; Staff Settings
          </h2>
          <p className="text-sm text-slate-600">
            {businessConfig.storeName} — {businessConfig.address} · Admin:{' '}
            <span className="font-semibold text-slate-900">{currentUser.name}</span>
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Settings sections"
          className="inline-flex items-center p-1 bg-slate-200/80 rounded-lg self-start sm:self-auto"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'staff'}
            onClick={() => setActiveTab('staff')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
              activeTab === 'staff'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Staff &amp; Sub-App Permissions</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'business'}
            onClick={() => setActiveTab('business')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
              activeTab === 'business'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Store className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Business &amp; Store Profile</span>
          </button>
        </div>
      </div>

      {feedbackBanner && (
        <div
          role={feedbackBanner.type === 'error' ? 'alert' : 'status'}
          className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl border text-sm font-medium ${
            feedbackBanner.type === 'error'
              ? 'bg-red-50 border-red-200 text-red-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {feedbackBanner.type === 'error' ? (
              <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
            )}
            <span>{feedbackBanner.message}</span>
          </div>

          <button
            type="button"
            onClick={() => setFeedbackBanner(null)}
            aria-label="Dismiss notification"
            className="p-1 rounded hover:bg-black/5"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {activeTab === 'staff' ? (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* Left column: Staff directory */}
          <section className="xl:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Staff Directory</h3>
                <p className="text-xs text-slate-500 font-mono tabular-nums">
                  {staffList.filter((s) => s.active).length} active · {staffList.length} total
                </p>
              </div>

              <button
                type="button"
                onClick={openAddModal}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
              >
                <UserPlus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Add New Staff</span>
              </button>
            </div>

            <div className="divide-y divide-slate-100">
              {staffList.map((member) => {
                const isSelected = member.id === selectedStaff.id;
                const isRevealed = Boolean(revealedPins[member.id]);
                const isLastAdmin =
                  member.active && member.permissions.adminSettings && activeAdminCount <= 1;

                return (
                  <div
                    key={member.id}
                    className={`p-4 transition-colors ${
                      isSelected ? 'bg-orange-50/50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => setSelectedStaffId(member.id)}
                        className="min-w-0 flex-1 text-left focus-visible:outline-2 focus-visible:outline-orange-500 rounded"
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-slate-900">
                            {member.name}
                          </span>
                          <span
                            className={`text-xs font-medium px-2 py-0.5 rounded border ${
                              member.permissions.adminSettings
                                ? 'bg-slate-900 text-white border-slate-900'
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                          >
                            {member.role}
                          </span>
                        </div>

                        <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                          <span className={member.active ? 'text-emerald-700 font-medium' : 'text-slate-400 font-medium'}>
                            {member.active ? 'Active' : 'Inactive'}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">
                            PIN {isRevealed ? member.pin : '••••'}
                          </span>
                        </div>
                      </button>

                      <div className="flex items-center gap-2 shrink-0">
                        <ToggleSwitch
                          checked={member.active}
                          onChange={(next) => handleToggleStaffActive(member, next)}
                          disabled={isLastAdmin && member.active}
                          label={`Toggle active status for ${member.name}`}
                        />
                      </div>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => handleToggleRevealPin(member.id)}
                          className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 font-medium"
                        >
                          {isRevealed ? (
                            <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />
                          ) : (
                            <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                          )}
                          <span>{isRevealed ? 'Hide PIN' : 'Show PIN'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => openEditModal(member)}
                          className="inline-flex items-center gap-1 text-orange-600 hover:text-orange-700 font-semibold"
                        >
                          <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Edit / Reset PIN</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setSelectedStaffId(member.id)}
                          className={`font-semibold ${
                            isSelected ? 'text-orange-600' : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {isSelected ? 'Editing Permissions' : 'Permissions'}
                        </button>

                        <button
                          type="button"
                          disabled={isLastAdmin}
                          onClick={() => handleDeleteStaff(member)}
                          aria-label={`Delete ${member.name}`}
                          title={
                            isLastAdmin
                              ? 'Cannot delete the last active Store Admin'
                              : `Delete ${member.name}`
                          }
                          className={`p-1 rounded transition-colors ${
                            isLastAdmin
                              ? 'text-slate-300 cursor-not-allowed'
                              : 'text-slate-400 hover:text-red-600 hover:bg-red-50'
                          }`}
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Right column: Granular Module & Sub-App Permission Matrix */}
          <section className="xl:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Module &amp; Sub-App Permission Matrix
                </h3>
                <p className="text-xs text-slate-500">
                  Configuring access for{' '}
                  <strong className="font-semibold text-slate-900">{selectedStaff.name}</strong> ·{' '}
                  {selectedStaff.role} ·{' '}
                  <span className="font-mono tabular-nums">PIN {selectedStaff.pin}</span>
                </p>
              </div>

              <button
                type="button"
                onClick={() => openEditModal(selectedStaff)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 whitespace-nowrap shrink-0"
              >
                <KeyRound className="w-3.5 h-3.5 text-orange-600" aria-hidden="true" />
                <span>Edit Profile / PIN</span>
              </button>
            </div>

            <div className="divide-y divide-slate-200">
              {/* POS & Order Manager */}
              <div className="p-5 space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">
                      POS &amp; Order Manager
                    </div>
                    <div className="text-xs text-slate-500">
                      Counter orders queue, pickup fulfillment, and register operations
                    </div>
                  </div>
                  <ToggleSwitch
                    checked={selectedStaff.permissions.posOrders.access}
                    onChange={(next) =>
                      handleUpdatePermissions(selectedStaff, (prev) => ({
                        ...prev,
                        posOrders: {
                          ...prev.posOrders,
                          access: next,
                          canApproveOrders: next ? prev.posOrders.canApproveOrders : false,
                          canManageSuppliers: next ? prev.posOrders.canManageSuppliers : false,
                        },
                      }))
                    }
                    label="POS & Order Manager module access"
                  />
                </div>

                <div className="pl-4 border-l border-slate-200 space-y-2.5">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-xs font-medium text-slate-700">
                      Approve &amp; Fulfill Customer Orders
                    </span>
                    <ToggleSwitch
                      checked={selectedStaff.permissions.posOrders.canApproveOrders}
                      disabled={!selectedStaff.permissions.posOrders.access}
                      onChange={(next) =>
                        handleUpdatePermissions(selectedStaff, (prev) => ({
                          ...prev,
                          posOrders: { ...prev.posOrders, canApproveOrders: next },
                        }))
                      }
                      label="Approve and fulfill orders"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-xs font-medium text-slate-700">
                      Manage POS Suppliers &amp; Purchase Orders
                    </span>
                    <ToggleSwitch
                      checked={selectedStaff.permissions.posOrders.canManageSuppliers}
                      disabled={!selectedStaff.permissions.posOrders.access}
                      onChange={(next) =>
                        handleUpdatePermissions(selectedStaff, (prev) => ({
                          ...prev,
                          posOrders: { ...prev.posOrders, canManageSuppliers: next },
                        }))
                      }
                      label="Manage POS suppliers"
                    />
                  </div>
                </div>
              </div>

              {/* Temperature Logging */}
              <div className="p-5 space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">
                      Temperature Logging
                    </div>
                    <div className="text-xs text-slate-500">
                      Daily fridge &amp; freezer readings for food safety compliance
                    </div>
                  </div>
                  <ToggleSwitch
                    checked={selectedStaff.permissions.tempLogs.access}
                    onChange={(next) =>
                      handleUpdatePermissions(selectedStaff, (prev) => ({
                        ...prev,
                        tempLogs: {
                          ...prev.tempLogs,
                          access: next,
                          canEditPastLogs: next ? prev.tempLogs.canEditPastLogs : false,
                          canConfigureUnits: next ? prev.tempLogs.canConfigureUnits : false,
                        },
                      }))
                    }
                    label="Temperature Logging module access"
                  />
                </div>

                <div className="pl-4 border-l border-slate-200 space-y-2.5">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-xs font-medium text-slate-700">
                      Edit Past Temperature Logs
                    </span>
                    <ToggleSwitch
                      checked={selectedStaff.permissions.tempLogs.canEditPastLogs}
                      disabled={!selectedStaff.permissions.tempLogs.access}
                      onChange={(next) =>
                        handleUpdatePermissions(selectedStaff, (prev) => ({
                          ...prev,
                          tempLogs: { ...prev.tempLogs, canEditPastLogs: next },
                        }))
                      }
                      label="Edit past temperature logs"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-xs font-medium text-slate-700">
                      Configure Fridge &amp; Freezer Units
                    </span>
                    <ToggleSwitch
                      checked={selectedStaff.permissions.tempLogs.canConfigureUnits}
                      disabled={!selectedStaff.permissions.tempLogs.access}
                      onChange={(next) =>
                        handleUpdatePermissions(selectedStaff, (prev) => ({
                          ...prev,
                          tempLogs: { ...prev.tempLogs, canConfigureUnits: next },
                        }))
                      }
                      label="Configure temperature units"
                    />
                  </div>
                </div>
              </div>

              {/* ATM Cash Manager */}
              <div className="p-5 space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">ATM Cash Manager</div>
                    <div className="text-xs text-slate-500">
                      $20 / $50 note cassette tracking and replenishment records
                    </div>
                  </div>
                  <ToggleSwitch
                    checked={selectedStaff.permissions.atmCash.access}
                    onChange={(next) =>
                      handleUpdatePermissions(selectedStaff, (prev) => ({
                        ...prev,
                        atmCash: {
                          ...prev.atmCash,
                          access: next,
                          canLogFeedings: next ? prev.atmCash.canLogFeedings : false,
                          canEditCycleCounts: next ? prev.atmCash.canEditCycleCounts : false,
                        },
                      }))
                    }
                    label="ATM Cash Manager module access"
                  />
                </div>

                <div className="pl-4 border-l border-slate-200 space-y-2.5">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-xs font-medium text-slate-700">
                      Log Cash Feedings &amp; Cassette Loads
                    </span>
                    <ToggleSwitch
                      checked={selectedStaff.permissions.atmCash.canLogFeedings}
                      disabled={!selectedStaff.permissions.atmCash.access}
                      onChange={(next) =>
                        handleUpdatePermissions(selectedStaff, (prev) => ({
                          ...prev,
                          atmCash: { ...prev.atmCash, canLogFeedings: next },
                        }))
                      }
                      label="Log ATM cash feedings"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-xs font-medium text-slate-700">
                      Edit Cycle Counts &amp; Reconciliation
                    </span>
                    <ToggleSwitch
                      checked={selectedStaff.permissions.atmCash.canEditCycleCounts}
                      disabled={!selectedStaff.permissions.atmCash.access}
                      onChange={(next) =>
                        handleUpdatePermissions(selectedStaff, (prev) => ({
                          ...prev,
                          atmCash: { ...prev.atmCash, canEditCycleCounts: next },
                        }))
                      }
                      label="Edit ATM cycle counts"
                    />
                  </div>
                </div>
              </div>

              {/* AI Facebook Manager */}
              <div className="p-5 space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">
                      AI Facebook Manager
                    </div>
                    <div className="text-xs text-slate-500">
                      Drafting local store promos and scheduling page posts
                    </div>
                  </div>
                  <ToggleSwitch
                    checked={selectedStaff.permissions.fbPosts.access}
                    onChange={(next) =>
                      handleUpdatePermissions(selectedStaff, (prev) => ({
                        ...prev,
                        fbPosts: {
                          ...prev.fbPosts,
                          access: next,
                          canPublishDirectly: next ? prev.fbPosts.canPublishDirectly : false,
                        },
                      }))
                    }
                    label="AI Facebook Manager module access"
                  />
                </div>

                <div className="pl-4 border-l border-slate-200">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-xs font-medium text-slate-700">
                      Publish Posts Directly to Store Page
                    </span>
                    <ToggleSwitch
                      checked={selectedStaff.permissions.fbPosts.canPublishDirectly}
                      disabled={!selectedStaff.permissions.fbPosts.access}
                      onChange={(next) =>
                        handleUpdatePermissions(selectedStaff, (prev) => ({
                          ...prev,
                          fbPosts: { ...prev.fbPosts, canPublishDirectly: next },
                        }))
                      }
                      label="Publish Facebook posts directly"
                    />
                  </div>
                </div>
              </div>

              {/* Smoke Price Tracker */}
              <div className="p-5 space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">
                      Smoke Price Tracker
                    </div>
                    <div className="text-xs text-slate-500">
                      Tobacco &amp; smoke SKU price tracking and margin comparisons
                    </div>
                  </div>
                  <ToggleSwitch
                    checked={selectedStaff.permissions.pricematch.access}
                    onChange={(next) =>
                      handleUpdatePermissions(selectedStaff, (prev) => ({
                        ...prev,
                        pricematch: {
                          ...prev.pricematch,
                          access: next,
                          canEditPrices: next ? prev.pricematch.canEditPrices : false,
                        },
                      }))
                    }
                    label="Smoke Price Tracker module access"
                  />
                </div>

                <div className="pl-4 border-l border-slate-200">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-xs font-medium text-slate-700">
                      Edit &amp; Override Smoke SKU Prices
                    </span>
                    <ToggleSwitch
                      checked={selectedStaff.permissions.pricematch.canEditPrices}
                      disabled={!selectedStaff.permissions.pricematch.access}
                      onChange={(next) =>
                        handleUpdatePermissions(selectedStaff, (prev) => ({
                          ...prev,
                          pricematch: { ...prev.pricematch, canEditPrices: next },
                        }))
                      }
                      label="Edit smoke prices"
                    />
                  </div>
                </div>
              </div>

              {/* Admin Settings */}
              <div className="p-5 bg-slate-50/70">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-start gap-2.5">
                    <Shield className="w-4 h-4 text-orange-600 mt-0.5 shrink-0" aria-hidden="true" />
                    <div>
                      <div className="text-sm font-semibold text-slate-900">
                        Store &amp; Staff Settings (Admin)
                      </div>
                      <div className="text-xs text-slate-500">
                        {isSelectedLastAdmin
                          ? 'Protected: at least one active Store Admin must retain Settings access.'
                          : 'Allows editing business profile, staff PINs, and permission matrix.'}
                      </div>
                    </div>
                  </div>

                  <ToggleSwitch
                    checked={selectedStaff.permissions.adminSettings}
                    disabled={isSelectedLastAdmin}
                    onChange={(next) =>
                      handleUpdatePermissions(selectedStaff, (prev) => ({
                        ...prev,
                        adminSettings: next,
                      }))
                    }
                    label="Store & Staff Settings admin access"
                  />
                </div>
              </div>
            </div>
          </section>
        </div>
      ) : (
        <form onSubmit={handleSaveBusinessConfig} className="space-y-6 max-w-5xl">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Store Identity Card */}
            <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Store Identity</h3>
                <p className="text-xs text-slate-500">
                  Displayed across the KSBM header, sidebar, login screen, and compliance logs.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="block space-y-1.5 sm:col-span-2">
                  <span className="text-xs font-semibold text-slate-700">Store Name</span>
                  <input
                    type="text"
                    required
                    value={configDraft.storeName}
                    onChange={(e) =>
                      setConfigDraft((prev) => ({ ...prev, storeName: e.target.value }))
                    }
                    className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:border-orange-500"
                  />
                </label>

                <label className="block space-y-1.5 sm:col-span-2">
                  <span className="text-xs font-semibold text-slate-700">Store Address</span>
                  <input
                    type="text"
                    required
                    value={configDraft.address}
                    onChange={(e) =>
                      setConfigDraft((prev) => ({ ...prev, address: e.target.value }))
                    }
                    className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:border-orange-500"
                  />
                </label>

                <label className="block space-y-1.5">
                  <span className="text-xs font-semibold text-slate-700">Store Phone</span>
                  <input
                    type="text"
                    value={configDraft.phone}
                    onChange={(e) =>
                      setConfigDraft((prev) => ({ ...prev, phone: e.target.value }))
                    }
                    className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm font-mono tabular-nums text-slate-900 focus:outline-none focus:border-orange-500"
                  />
                </label>

                <label className="block space-y-1.5">
                  <span className="text-xs font-semibold text-slate-700">ABN</span>
                  <input
                    type="text"
                    value={configDraft.abn}
                    onChange={(e) =>
                      setConfigDraft((prev) => ({ ...prev, abn: e.target.value }))
                    }
                    className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm font-mono tabular-nums text-slate-900 focus:outline-none focus:border-orange-500"
                  />
                </label>

                <label className="block space-y-1.5 sm:col-span-2">
                  <span className="text-xs font-semibold text-slate-700">Operating Hours</span>
                  <input
                    type="text"
                    value={configDraft.operatingHours}
                    onChange={(e) =>
                      setConfigDraft((prev) => ({ ...prev, operatingHours: e.target.value }))
                    }
                    className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:border-orange-500"
                  />
                </label>
              </div>
            </section>

            {/* Operational Thresholds Card */}
            <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Operational Thresholds</h3>
                <p className="text-xs text-slate-500">
                  Alert limits shared with Temperature Logging and ATM Cash Manager.
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-slate-700">
                    Display Fridge Safe Range (°C)
                  </span>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block space-y-1">
                      <span className="text-[11px] text-slate-500">Min °C</span>
                      <input
                        type="number"
                        step="0.5"
                        value={configDraft.fridgeTempRange.min}
                        onChange={(e) =>
                          setConfigDraft((prev) => ({
                            ...prev,
                            fridgeTempRange: {
                              ...prev.fridgeTempRange,
                              min: Number(e.target.value),
                            },
                          }))
                        }
                        className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm font-mono tabular-nums text-slate-900 focus:outline-none focus:border-orange-500"
                      />
                    </label>
                    <label className="block space-y-1">
                      <span className="text-[11px] text-slate-500">Max °C</span>
                      <input
                        type="number"
                        step="0.5"
                        value={configDraft.fridgeTempRange.max}
                        onChange={(e) =>
                          setConfigDraft((prev) => ({
                            ...prev,
                            fridgeTempRange: {
                              ...prev.fridgeTempRange,
                              max: Number(e.target.value),
                            },
                          }))
                        }
                        className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm font-mono tabular-nums text-slate-900 focus:outline-none focus:border-orange-500"
                      />
                    </label>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-slate-700">
                    Freezer Safe Range (°C)
                  </span>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block space-y-1">
                      <span className="text-[11px] text-slate-500">Min °C</span>
                      <input
                        type="number"
                        step="0.5"
                        value={configDraft.freezerTempRange.min}
                        onChange={(e) =>
                          setConfigDraft((prev) => ({
                            ...prev,
                            freezerTempRange: {
                              ...prev.freezerTempRange,
                              min: Number(e.target.value),
                            },
                          }))
                        }
                        className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm font-mono tabular-nums text-slate-900 focus:outline-none focus:border-orange-500"
                      />
                    </label>
                    <label className="block space-y-1">
                      <span className="text-[11px] text-slate-500">Max °C</span>
                      <input
                        type="number"
                        step="0.5"
                        value={configDraft.freezerTempRange.max}
                        onChange={(e) =>
                          setConfigDraft((prev) => ({
                            ...prev,
                            freezerTempRange: {
                              ...prev.freezerTempRange,
                              max: Number(e.target.value),
                            },
                          }))
                        }
                        className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm font-mono tabular-nums text-slate-900 focus:outline-none focus:border-orange-500"
                      />
                    </label>
                  </div>
                </div>

                <label className="block space-y-1.5">
                  <span className="text-xs font-semibold text-slate-700">
                    ATM Low-Cash Alert Threshold ($)
                  </span>
                  <input
                    type="number"
                    min={0}
                    step={50}
                    value={configDraft.atmLowCashAlert}
                    onChange={(e) =>
                      setConfigDraft((prev) => ({
                        ...prev,
                        atmLowCashAlert: Math.max(0, Number(e.target.value)),
                      }))
                    }
                    className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm font-mono tabular-nums text-slate-900 focus:outline-none focus:border-orange-500"
                  />
                </label>
              </div>
            </section>
          </div>

          {/* Default Suppliers */}
          <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Default Wholesale Suppliers</h3>
                <p className="text-xs text-slate-500">
                  Pre-populated supplier directory for POS receiving and Wholesale Price Tracker.
                </p>
              </div>
              <span className="text-xs font-mono tabular-nums text-slate-500">
                {configDraft.defaultSuppliers.length} suppliers
              </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5">
              <input
                type="text"
                placeholder="Add supplier name (e.g., Gilmours Wholesale)"
                value={newSupplierInput}
                onChange={(e) => setNewSupplierInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddSupplier();
                  }
                }}
                className="flex-1 h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:border-orange-500"
              />
              <button
                type="button"
                onClick={handleAddSupplier}
                className="inline-flex items-center justify-center gap-1.5 px-4 h-10 rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-800 whitespace-nowrap shrink-0"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
                <span>Add Supplier</span>
              </button>
            </div>

            {configDraft.defaultSuppliers.length === 0 ? (
              <p className="text-xs text-slate-500 py-2">
                No default suppliers configured. Add your first supplier above.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
                {configDraft.defaultSuppliers.map((supplier) => (
                  <li
                    key={supplier}
                    className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm text-slate-800"
                  >
                    <span>{supplier}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveSupplier(supplier)}
                      className="text-xs font-medium text-slate-500 hover:text-red-600 transition-colors"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="flex flex-wrap items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setConfigDraft(businessConfig)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-sm font-medium text-slate-700 transition-colors"
            >
              <RotateCcw className="w-4 h-4" aria-hidden="true" />
              <span>Reset Unsaved</span>
            </button>

            <button
              type="submit"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold transition-colors"
            >
              <Save className="w-4 h-4" aria-hidden="true" />
              <span>Save Store Settings</span>
            </button>
          </div>
        </form>
      )}

      {/* Add New Staff Modal */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-staff-title"
        >
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 id="add-staff-title" className="text-base font-semibold text-slate-900">
                Add New Staff Member
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                aria-label="Close modal"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleCreateStaff} className="p-6 space-y-4">
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-slate-700">Full Name</span>
                <input
                  type="text"
                  required
                  placeholder="e.g., Priya Nair"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-orange-500"
                />
              </label>

              <div className="space-y-1.5">
                <label className="block space-y-1.5">
                  <span className="text-xs font-semibold text-slate-700">Role Label</span>
                  <input
                    type="text"
                    required
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-orange-500"
                  />
                </label>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {ROLE_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setNewRole(preset)}
                      className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
                        newRole === preset
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1.5">
                  <span className="text-xs font-semibold text-slate-700">4-Digit PIN</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={4}
                    required
                    placeholder="4321"
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    className="w-full h-10 px-3 rounded-lg border border-slate-300 font-mono tabular-nums text-sm text-slate-900 focus:outline-none focus:border-orange-500"
                  />
                </label>

                <label className="block space-y-1.5">
                  <span className="text-xs font-semibold text-slate-700">Shift Note</span>
                  <input
                    type="text"
                    placeholder="Evening Counter"
                    value={newShiftLabel}
                    onChange={(e) => setNewShiftLabel(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-orange-500"
                  />
                </label>
              </div>

              {addFormError && (
                <p role="alert" className="text-xs font-medium text-red-600">
                  {addFormError}
                </p>
              )}

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold"
                >
                  Create Staff Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Staff / Reset PIN Modal */}
      {editingStaff && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-staff-title"
        >
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 id="edit-staff-title" className="text-base font-semibold text-slate-900">
                Edit Staff Profile &amp; PIN
              </h3>
              <button
                type="button"
                onClick={() => setEditingStaff(null)}
                aria-label="Close modal"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleSaveStaffEdit} className="p-6 space-y-4">
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-slate-700">Full Name</span>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-orange-500"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-slate-700">Role Label</span>
                <input
                  type="text"
                  required
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-orange-500"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1.5">
                  <span className="text-xs font-semibold text-slate-700">4-Digit PIN</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={4}
                    required
                    value={editPin}
                    onChange={(e) => setEditPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    className="w-full h-10 px-3 rounded-lg border border-slate-300 font-mono tabular-nums text-sm text-slate-900 focus:outline-none focus:border-orange-500"
                  />
                </label>

                <label className="block space-y-1.5">
                  <span className="text-xs font-semibold text-slate-700">Shift Note</span>
                  <input
                    type="text"
                    value={editShiftLabel}
                    onChange={(e) => setEditShiftLabel(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-orange-500"
                  />
                </label>
              </div>

              {editFormError && (
                <p role="alert" className="text-xs font-medium text-red-600">
                  {editFormError}
                </p>
              )}

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditingStaff(null)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
