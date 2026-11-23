import { ArrowLeft, CheckCircle2, Lock, ShoppingBag } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import type { StaffProfile } from '../../types';

interface PosOrderModuleProps {
  currentUser: StaffProfile;
  onBackToDashboard?: () => void;
}

export function PosOrderModule({ currentUser, onBackToDashboard }: PosOrderModuleProps) {
  const { businessConfig } = useStore();
  const perms = currentUser.permissions.posOrders;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            POS &amp; Order Manager
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
            <ShoppingBag className="w-5 h-5" aria-hidden="true" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900">
            POS &amp; Order Manager Module Shell Ready
          </h3>
          <p className="text-sm text-slate-600 leading-relaxed">
            Authenticated for{' '}
            <span className="font-semibold text-slate-900">{currentUser.name}</span>.
            Supplier list synced with {businessConfig.defaultSuppliers.length} store suppliers.
          </p>
        </div>

        <div className="pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl text-xs">
          <div className="flex items-center gap-2 text-slate-700">
            {perms.canApproveOrders ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
            ) : (
              <Lock className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
            )}
            <span>Approve Orders: {perms.canApproveOrders ? 'Enabled' : 'View Only'}</span>
          </div>
          <div className="flex items-center gap-2 text-slate-700">
            {perms.canManageSuppliers ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
            ) : (
              <Lock className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
            )}
            <span>Manage Suppliers: {perms.canManageSuppliers ? 'Enabled' : 'Restricted'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
