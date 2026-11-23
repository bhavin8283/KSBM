import {
  Banknote,
  LayoutDashboard,
  Lock,
  Megaphone,
  Settings,
  ShoppingBag,
  Store,
  Tag,
  Thermometer,
  X,
  type LucideIcon,
} from 'lucide-react';
import {
  hasModuleAccess,
  NAV_MODULES,
  STORE_INFO,
  type BusinessConfig,
  type ModuleId,
  type StaffProfile,
} from '../types';

interface SidebarProps {
  activeModule: ModuleId;
  currentUser: StaffProfile;
  businessConfig: BusinessConfig;
  onSelectModule: (moduleId: ModuleId) => void;
  isOpen: boolean;
  onClose: () => void;
  onLockTerminal: () => void;
}

const MODULE_ICONS: Record<ModuleId, LucideIcon> = {
  dashboard: LayoutDashboard,
  'pos-orders': ShoppingBag,
  'temp-logs': Thermometer,
  'atm-cash': Banknote,
  'fb-posts': Megaphone,
  pricematch: Tag,
  settings: Settings,
};

export function Sidebar({
  activeModule,
  currentUser,
  businessConfig,
  onSelectModule,
  isOpen,
  onClose,
  onLockTerminal,
}: SidebarProps) {
  const handleSelect = (id: ModuleId) => {
    onSelectModule(id);
    onClose();
  };

  const primaryModules = NAV_MODULES.filter(
    (item) => item.id !== 'settings' && hasModuleAccess(currentUser, item.id)
  );
  const settingsModule = NAV_MODULES.find((item) => item.id === 'settings');
  const canAccessSettings = hasModuleAccess(currentUser, 'settings');

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-950/50 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        aria-label="Primary navigation"
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-slate-900 text-slate-100 flex flex-col justify-between border-r border-slate-800 transition-transform duration-200 ease-out lg:static lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div>
          <div className="h-16 px-5 flex items-center justify-between border-b border-slate-800">
            <button
              type="button"
              onClick={() => handleSelect('dashboard')}
              className="flex items-center gap-3 text-left min-w-0 focus-visible:outline-2 focus-visible:outline-orange-500 rounded-md"
            >
              <div className="w-9 h-9 rounded-lg bg-orange-600 text-white flex items-center justify-center shrink-0">
                <Store className="w-5 h-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold tracking-tight text-white truncate">
                  {STORE_INFO.shortName} — {businessConfig.storeName}
                </div>
                <div className="text-xs text-slate-400 truncate">{businessConfig.address}</div>
              </div>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close navigation menu"
              className="lg:hidden p-2 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 shrink-0"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>

          <nav className="p-3 space-y-1">
            {primaryModules.map((item) => {
              const Icon = MODULE_ICONS[item.id];
              const isActive = activeModule === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelect(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-orange-500 ${
                    isActive
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? 'text-orange-400' : 'text-slate-400'
                    }`}
                    aria-hidden="true"
                  />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-3 border-t border-slate-800 space-y-2">
          {canAccessSettings && settingsModule && (
            <button
              type="button"
              onClick={() => handleSelect('settings')}
              aria-current={activeModule === 'settings' ? 'page' : undefined}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-orange-500 ${
                activeModule === 'settings'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
              }`}
            >
              <Settings
                className={`w-4 h-4 shrink-0 ${
                  activeModule === 'settings' ? 'text-orange-400' : 'text-slate-400'
                }`}
                aria-hidden="true"
              />
              <span className="truncate">{settingsModule.label}</span>
            </button>
          )}

          <div className="px-2 pt-1 text-xs text-slate-400 leading-relaxed">
            <div className="font-medium text-slate-300 truncate">{businessConfig.storeName}</div>
            <div className="truncate">{businessConfig.operatingHours}</div>
          </div>

          <button
            type="button"
            onClick={onLockTerminal}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-slate-700 bg-slate-800/70 hover:bg-slate-800 text-xs font-medium text-slate-200 transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-orange-500"
          >
            <Lock className="w-3.5 h-3.5 text-orange-400 shrink-0" aria-hidden="true" />
            <span>Lock Terminal</span>
          </button>
        </div>
      </aside>
    </>
  );
}
