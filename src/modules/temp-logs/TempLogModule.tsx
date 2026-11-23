import { ArrowLeft, CheckCircle2, Lock, Thermometer } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import type { StaffProfile } from '../../types';

interface TempLogModuleProps {
  currentUser: StaffProfile;
  onBackToDashboard?: () => void;
}

export function TempLogModule({ currentUser, onBackToDashboard }: TempLogModuleProps) {
  const { businessConfig } = useStore();
  const perms = currentUser.permissions.tempLogs;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Temperature Logging
          </h2>
          <p className="text-sm text-slate-600">
            {businessConfig.storeName} — {businessConfig.address} · Operator:{' '}
            <span className="font-semibold text-slate-900">{currentUser.name}</span> (
            {currentUser.role})
          </p>
        </div>

        {onBackToDashboard && (
          <button
            type="button"
            onClick={onBackToDashboard}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-sm font-medium text-slate-700 transition-colors whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            <span>Back to Overview</span>
          </button>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-8 sm:p-10 space-y-6">
        <div className="max-w-xl space-y-4">
          <div className="w-11 h-11 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center">
            <Thermometer className="w-5 h-5" aria-hidden="true" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900">
            Temperature Logging Module Shell Ready
          </h3>
          <p className="text-sm text-slate-600 leading-relaxed">
            Threshold targets synced from Store Settings: Display Fridge{' '}
            <span className="font-mono tabular-nums font-semibold text-slate-900">
              {businessConfig.fridgeTempRange.min}°C to {businessConfig.fridgeTempRange.max}°C
            </span>{' '}
            · Freezer{' '}
            <span className="font-mono tabular-nums font-semibold text-slate-900">
              {businessConfig.freezerTempRange.min}°C to {businessConfig.freezerTempRange.max}°C
            </span>
            .
          </p>
        </div>

        <div className="pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl text-xs">
          <div className="flex items-center gap-2 text-slate-700">
            {perms.canEditPastLogs ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
            ) : (
              <Lock className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
            )}
            <span>
              Edit Past Logs: {perms.canEditPastLogs ? 'Enabled' : 'Log New Only'}
            </span>
          </div>
          <div className="flex items-center gap-2 text-slate-700">
            {perms.canConfigureUnits ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
            ) : (
              <Lock className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
            )}
            <span>
              Configure Units: {perms.canConfigureUnits ? 'Enabled' : 'Restricted'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
