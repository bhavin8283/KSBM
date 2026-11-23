import { Lock, Menu, User } from 'lucide-react';
import {
  NAV_MODULES,
  STORE_INFO,
  type BusinessConfig,
  type ModuleId,
  type StaffProfile,
} from '../types';

interface HeaderProps {
  activeModule: ModuleId;
  currentUser: StaffProfile;
  businessConfig: BusinessConfig;
  onOpenSidebar: () => void;
  onLockSwitchStaff: () => void;
}

export function Header({
  activeModule,
  currentUser,
  businessConfig,
  onOpenSidebar,
  onLockSwitchStaff,
}: HeaderProps) {
  const currentMeta = NAV_MODULES.find((m) => m.id === activeModule) ?? NAV_MODULES[0];

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-4 shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenSidebar}
          aria-label="Open navigation menu"
          className="lg:hidden p-2 -ml-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
        >
          <Menu className="w-5 h-5" aria-hidden="true" />
        </button>

        <div className="flex items-center gap-2 min-w-0 text-sm">
          <span className="font-semibold text-slate-500 whitespace-nowrap hidden sm:inline">
            {STORE_INFO.shortName} · {businessConfig.storeName}
          </span>
          <span className="text-slate-300 hidden sm:inline" aria-hidden="true">
            /
          </span>
          <h1 className="font-semibold text-slate-900 truncate">{currentMeta.label}</h1>
        </div>
      </div>

      <div className="flex items-center gap-4 shrink-0">
        <div className="hidden sm:flex items-center gap-2 text-xs text-slate-600 whitespace-nowrap">
          <User className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
          <span className="font-semibold text-slate-900">{currentUser.name}</span>
          <span className="text-slate-300" aria-hidden="true">
            ·
          </span>
          <span className="text-slate-600">{currentUser.role}</span>
        </div>

        <button
          type="button"
          onClick={onLockSwitchStaff}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 hover:border-orange-400 text-xs font-semibold text-slate-800 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-orange-500"
        >
          <Lock className="w-3.5 h-3.5 text-orange-600 shrink-0" aria-hidden="true" />
          <span>Lock / Switch Staff</span>
        </button>
      </div>
    </header>
  );
}
