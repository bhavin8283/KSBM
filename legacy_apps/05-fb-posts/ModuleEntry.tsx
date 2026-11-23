import React, { useState } from "react";
import {
  LayoutDashboard,
  UploadCloud,
  FolderOpen,
  Calendar,
  Settings as SettingsIcon,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  Info,
} from "lucide-react";
import { MODULE_VIEWS } from "./constants";
import { ModuleEntryProps, ModuleViewId } from "./types";
import { useStoreSocialModule } from "./hooks/useStoreSocialModule";
import DashboardView from "./components/DashboardView";
import UploadGalleryView from "./components/UploadGalleryView";
import AssetsView from "./components/AssetsView";
import CalendarView from "./components/CalendarView";
import SettingsView from "./components/SettingsView";

const VIEW_ICONS: Record<ModuleViewId, React.ComponentType<{ className?: string }>> = {
  dashboard: LayoutDashboard,
  upload: UploadCloud,
  assets: FolderOpen,
  calendar: Calendar,
  settings: SettingsIcon,
};

export function ModuleEntry({
  currentUser,
  businessConfig,
  initialView = "dashboard",
  onMetricsUpdate,
}: ModuleEntryProps) {
  const [activeView, setActiveView] = useState<ModuleViewId>(initialView);

  const {
    api,
    permissions,
    products,
    schedules,
    templates,
    logs,
    notifications,
    settings,
    tokenLogs,
    dataLoading,
    toasts,
    addToast,
    fetchInitialData,
    handleImportAssetToStudio,
    handleProductUploadAutomated,
    handleApproveAutomation,
    handleProductUpdate,
    handleProductDelete,
    handleCreateTemplate,
    handleUpdateTemplate,
    handleDeleteTemplate,
    handlePublishNow,
    handleSchedulePost,
    handleDeleteSchedule,
    handleReschedule,
    handleUpdateSettings,
    handleTestGemini,
    handleTestFacebook,
    handleTestInstagram,
    handleClearLogs,
    handleClearTokenLogs,
  } = useStoreSocialModule({
    currentUser,
    businessConfig,
    onNavigateView: setActiveView,
    onMetricsUpdate,
  });

  if (!permissions.canView) {
    return (
      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-8 text-center max-w-lg mx-auto my-8">
        <div className="w-12 h-12 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-white">Access Restricted</h3>
        <p className="text-sm text-slate-400 mt-2">
          Your KSBM role (<span className="text-slate-200 font-semibold">{currentUser.role}</span>) does not include
          permission to view the StoreSocial AI Marketing module.
        </p>
      </div>
    );
  }

  const effectiveStoreName = settings?.storeName || businessConfig.storeName || "Kwik Stop Convenience";

  return (
    <div className="w-full text-slate-200 relative">
      {/* Module-Scoped Sub-Navigation (Renders inside KSBM Host Workspace) */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 bg-slate-900/70 border border-slate-800/90 rounded-2xl p-2 backdrop-blur-md">
        <div className="flex flex-wrap items-center gap-1.5">
          {MODULE_VIEWS.map((view) => {
            const Icon = VIEW_ICONS[view.id];
            const isActive = activeView === view.id;
            return (
              <button
                key={view.id}
                type="button"
                onClick={() => setActiveView(view.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                  isActive
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/70"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{view.label}</span>
              </button>
            );
          })}
        </div>

        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950/70 border border-slate-800/80 text-xs text-slate-400">
          <span className="font-semibold text-slate-200 truncate max-w-[180px]">{effectiveStoreName}</span>
          <span className="text-slate-600">•</span>
          <span className="text-indigo-400 font-medium capitalize">{currentUser.role}</span>
        </div>
      </div>

      {/* Active Module View */}
      <div className="min-w-0">
        {activeView === "dashboard" && (
          <DashboardView
            products={products}
            schedules={schedules}
            logs={logs}
            notifications={notifications}
            tokenLogs={tokenLogs}
            storeName={effectiveStoreName}
            permissions={permissions}
            onNavigate={setActiveView}
            onClearLogs={handleClearLogs}
            onClearTokenLogs={handleClearTokenLogs}
            onTriggerRefresh={fetchInitialData}
            isLoading={dataLoading}
          />
        )}

        {activeView === "upload" && (
          <UploadGalleryView
            api={api}
            permissions={permissions}
            storeName={effectiveStoreName}
            socialHandle={businessConfig.socialHandle}
            products={products}
            onUploadAutomated={handleProductUploadAutomated}
            onApproveAutomation={handleApproveAutomation}
            onDeleteProduct={handleProductDelete}
            onUpdateProduct={handleProductUpdate}
            templates={templates}
            onPublishNow={handlePublishNow}
            onSchedulePost={handleSchedulePost}
            onTriggerRefresh={fetchInitialData}
            onNotify={addToast}
          />
        )}

        {activeView === "assets" && (
          <AssetsView
            api={api}
            permissions={permissions}
            onImportToStudio={handleImportAssetToStudio}
            onNotify={addToast}
          />
        )}

        {activeView === "calendar" && (
          <CalendarView
            schedules={schedules}
            permissions={permissions}
            onDeleteSchedule={handleDeleteSchedule}
            onReschedule={handleReschedule}
          />
        )}

        {activeView === "settings" && settings && (
          <SettingsView
            settings={settings}
            permissions={permissions}
            onUpdateSettings={handleUpdateSettings}
            templates={templates}
            onCreateTemplate={handleCreateTemplate}
            onUpdateTemplate={handleUpdateTemplate}
            onDeleteTemplate={handleDeleteTemplate}
            onTestGemini={handleTestGemini}
            onTestFacebook={handleTestFacebook}
            onTestInstagram={handleTestInstagram}
          />
        )}

        {activeView === "settings" && !settings && (
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-10 text-center text-sm text-slate-400">
            Loading module configuration...
          </div>
        )}
      </div>

      {/* Scoped Toast Feedback Stack */}
      {toasts.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-xl border shadow-xl text-xs font-medium backdrop-blur-md ${
                toast.type === "error"
                  ? "bg-rose-950/95 border-rose-500/40 text-rose-100"
                  : toast.type === "info"
                  ? "bg-slate-900/95 border-indigo-500/40 text-slate-100"
                  : "bg-emerald-950/95 border-emerald-500/40 text-emerald-100"
              }`}
            >
              {toast.type === "error" ? (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              ) : toast.type === "info" ? (
                <Info className="w-4 h-4 text-indigo-400 shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              )}
              <span>{toast.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ModuleEntry;
