import { useState } from 'react';
import { ArrowLeft, ShieldAlert } from 'lucide-react';
import { DashboardHome } from './components/DashboardHome';
import { Header } from './components/Header';
import { PinLoginScreen } from './components/PinLoginScreen';
import { Sidebar } from './components/Sidebar';
import { AuthProvider, useAuth } from './context/AuthContext';
import { StoreProvider, useStore } from './context/StoreContext';
import { AtmCashModule } from './modules/atm-cash/AtmCashModule';
import { FbPostModule } from './modules/fb-posts/FbPostModule';
import { PosOrderModule } from './modules/pos-orders/PosOrderModule';
import { PricematchModule } from './modules/pricematch/PricematchModule';
import { SettingsModule } from './modules/settings/SettingsModule';
import { TempLogModule } from './modules/temp-logs/TempLogModule';
import { hasModuleAccess, NAV_MODULES, type ModuleId } from './types';

function KsbmWorkspaceShell() {
  const { currentUser, logout } = useAuth();
  const { businessConfig } = useStore();
  const [activeModule, setActiveModule] = useState<ModuleId>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!currentUser) {
    return <PinLoginScreen />;
  }

  const handleLockTerminal = () => {
    setSidebarOpen(false);
    setActiveModule('dashboard');
    logout();
  };

  const renderRestrictedView = () => {
    const requestedMeta = NAV_MODULES.find((item) => item.id === activeModule);
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 sm:p-10 max-w-xl space-y-4">
        <div className="w-11 h-11 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
          <ShieldAlert className="w-5 h-5" aria-hidden="true" />
        </div>
        <h2 className="text-lg font-semibold text-slate-900">
          Access Restricted — Contact Store Admin
        </h2>
        <p className="text-sm text-slate-600 leading-relaxed">
          Your profile ({currentUser.name} · {currentUser.role}) does not currently have access
          to <strong className="font-semibold text-slate-900">{requestedMeta?.label ?? activeModule}</strong>.
          Ask a Store Admin to enable this module in Store &amp; Staff Settings.
        </p>
        <button
          type="button"
          onClick={() => setActiveModule('dashboard')}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold transition-colors"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>Return to Dashboard</span>
        </button>
      </div>
    );
  };

  const renderActiveModule = () => {
    if (!hasModuleAccess(currentUser, activeModule)) {
      return renderRestrictedView();
    }

    switch (activeModule) {
      case 'dashboard':
        return (
          <DashboardHome
            currentUser={currentUser}
            businessConfig={businessConfig}
            onNavigate={setActiveModule}
          />
        );
      case 'pos-orders':
        return (
          <PosOrderModule
            currentUser={currentUser}
            onBackToDashboard={() => setActiveModule('dashboard')}
          />
        );
      case 'temp-logs':
        return (
          <TempLogModule
            currentUser={currentUser}
            onBackToDashboard={() => setActiveModule('dashboard')}
          />
        );
      case 'atm-cash':
        return (
          <AtmCashModule
            currentUser={currentUser}
            onBackToDashboard={() => setActiveModule('dashboard')}
          />
        );
      case 'fb-posts':
        return (
          <FbPostModule
            currentUser={currentUser}
            onBackToDashboard={() => setActiveModule('dashboard')}
          />
        );
      case 'pricematch':
        return (
          <PricematchModule
            currentUser={currentUser}
            onBackToDashboard={() => setActiveModule('dashboard')}
          />
        );
      case 'settings':
        return <SettingsModule currentUser={currentUser} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex">
      <Sidebar
        activeModule={activeModule}
        currentUser={currentUser}
        businessConfig={businessConfig}
        onSelectModule={setActiveModule}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onLockTerminal={handleLockTerminal}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <Header
          activeModule={activeModule}
          currentUser={currentUser}
          businessConfig={businessConfig}
          onOpenSidebar={() => setSidebarOpen(true)}
          onLockSwitchStaff={handleLockTerminal}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {renderActiveModule()}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <AuthProvider>
        <KsbmWorkspaceShell />
      </AuthProvider>
    </StoreProvider>
  );
}
