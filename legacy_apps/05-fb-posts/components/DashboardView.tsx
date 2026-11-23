import React, { useState } from "react";
import {
  TrendingUp,
  Layers,
  Clock,
  Calendar,
  UploadCloud,
  CheckCircle,
  Wand2,
  Sparkles,
  AlertTriangle,
  Trash2,
  Bell,
  RefreshCw,
  Cpu,
} from "lucide-react";
import {
  AuditLog,
  ModulePermissions,
  ModuleViewId,
  Notification,
  Product,
  Schedule,
  TokenUsageLog,
} from "../types";

interface DashboardViewProps {
  products: Product[];
  schedules: Schedule[];
  logs: AuditLog[];
  notifications: Notification[];
  tokenLogs?: TokenUsageLog[];
  storeName?: string;
  permissions: ModulePermissions;
  onNavigate: (view: ModuleViewId) => void;
  onClearLogs: () => void;
  onClearTokenLogs?: () => void;
  onTriggerRefresh: () => void;
  isLoading: boolean;
}

export default function DashboardView({
  products,
  schedules,
  logs,
  notifications,
  tokenLogs = [],
  storeName,
  permissions,
  onNavigate,
  onClearLogs,
  onClearTokenLogs,
  onTriggerRefresh,
  isLoading,
}: DashboardViewProps) {
  const [activeTab, setActiveTab] = useState<"audit" | "token">("audit");

  const totalProducts = products.length;
  const scheduledTodayCount = schedules.filter((s) => {
    const todayStr = new Date().toISOString().split("T")[0];
    return s.date === todayStr && s.status === "pending";
  }).length;

  const publishedThisWeekCount = products.filter((p) => p.status === "Posted").length;
  const pendingApprovalsCount = products.filter(
    (p) => p.status === "Processing" || p.status === "Not Processed" || p.status === "Draft Scheduled"
  ).length;
  const awaitingReviewCount = products.filter((p) => p.status === "Ready" || p.status === "Draft Scheduled").length;

  return (
    <div id="dashboard_container" className="space-y-8 animate-fade-in">
      {/* Upper banner section */}
      <div
        id="dashboard_header_banner"
        className="bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950/30 text-white p-8 rounded-3xl shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border border-indigo-500/20 relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_120%,rgba(99,102,241,0.15),transparent)] pointer-events-none" />
        <div id="dashboard_welcome_text" className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <span className="bg-indigo-500/10 text-indigo-300 text-xs px-3 py-1 rounded-full font-medium border border-indigo-500/20">
              {storeName ? `${storeName} • Social Studio` : "Convenience Store Marketing"}
            </span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight font-display bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
            StoreSocial AI Dashboard
          </h1>
          <p className="text-slate-400 mt-2 text-sm max-w-xl leading-relaxed">
            Automate your product photography, generate viral captions and localized hashtag templates, and schedule seamless daily promotions to Facebook & Instagram.
          </p>
        </div>
        <div id="dashboard_header_actions" className="flex items-center gap-3 relative z-10">
          <button
            onClick={onTriggerRefresh}
            id="btn_refresh_dashboard"
            className="p-3 bg-slate-900 hover:bg-slate-800 transition-all rounded-xl text-slate-200 border border-slate-800 flex items-center gap-2 text-sm cursor-pointer"
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            Sync Feeds
          </button>
          {permissions.canUpload && (
            <button
              onClick={() => onNavigate("upload")}
              id="btn_hero_upload"
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 transition-all rounded-xl text-white font-semibold flex items-center gap-2 shadow-lg shadow-indigo-600/25 text-sm cursor-pointer"
            >
              <UploadCloud className="w-4 h-4" />
              Upload Products
            </button>
          )}
        </div>
      </div>

      {/* Grid containing core analytical statistics */}
      <div id="stats_cards_grid" className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div
          id="stat_scheduled_today"
          className="bg-slate-900/80 p-5 rounded-2xl border border-slate-800/80 shadow-md hover:border-slate-700 transition-all flex flex-col justify-between group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Scheduled Today</span>
            <span className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
              <Calendar className="w-5 h-5" />
            </span>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-extrabold text-white font-display tracking-tight">{scheduledTodayCount}</h3>
            <p className="text-xs text-slate-500 mt-1 font-medium">Automatic queue active</p>
          </div>
        </div>

        <div
          id="stat_published_week"
          className="bg-slate-900/80 p-5 rounded-2xl border border-slate-800/80 shadow-md hover:border-slate-700 transition-all flex flex-col justify-between group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Posted Campaigns</span>
            <span className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
              <CheckCircle className="w-5 h-5" />
            </span>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-extrabold text-white font-display tracking-tight">{publishedThisWeekCount}</h3>
            <p className="text-xs text-slate-500 mt-1 font-medium">Over Facebook & IG</p>
          </div>
        </div>

        <div
          id="stat_total_uploaded"
          className="bg-slate-900/80 p-5 rounded-2xl border border-slate-800/80 shadow-md hover:border-slate-700 transition-all flex flex-col justify-between group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Products</span>
            <span className="p-2 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20">
              <Layers className="w-5 h-5" />
            </span>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-extrabold text-white font-display tracking-tight">{totalProducts}</h3>
            <p className="text-xs text-slate-500 mt-1 font-medium">Beverages & snacks</p>
          </div>
        </div>

        <div
          id="stat_awaiting_review"
          className="bg-slate-900/80 p-5 rounded-2xl border border-slate-800/80 shadow-md hover:border-slate-700 transition-all flex flex-col justify-between group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Awaiting Review</span>
            <span className="p-2 bg-violet-500/10 text-violet-400 rounded-xl border border-violet-500/20">
              <Sparkles className="w-5 h-5" />
            </span>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-extrabold text-white font-display tracking-tight">{awaitingReviewCount}</h3>
            <p className="text-xs text-slate-500 mt-1 font-medium">Drafts & captions ready</p>
          </div>
        </div>

        <div
          id="stat_pending_approvals"
          className="bg-slate-900/80 p-5 rounded-2xl border border-slate-800/80 shadow-md hover:border-slate-700 transition-all flex flex-col justify-between col-span-2 lg:col-span-1 group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Action Needed</span>
            <span className="p-2 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
              <AlertTriangle className="w-5 h-5" />
            </span>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-extrabold text-white font-display tracking-tight">{pendingApprovalsCount}</h3>
            <p className="text-xs text-slate-500 mt-1 font-medium">Needs processing or review</p>
          </div>
        </div>
      </div>

      {/* Quick Action Shortcuts Grid */}
      <div id="quick_actions_panel" className="bg-slate-900/40 p-6 rounded-3xl border border-slate-800/80">
        <h2 className="text-xs font-bold text-slate-400 mb-4 tracking-wider uppercase">Direct Action Shortcuts</h2>
        <div id="quick_actions_grid" className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <button
            onClick={() => onNavigate("upload")}
            id="action_upload"
            className="p-4 bg-slate-900 hover:bg-slate-800/80 border border-slate-800 rounded-2xl shadow-sm text-center flex flex-col items-center gap-2 transition-all cursor-pointer group hover:border-slate-700"
          >
            <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl group-hover:bg-indigo-500/20 transition-colors border border-indigo-500/20">
              <UploadCloud className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-200">Upload Products</span>
          </button>

          <button
            onClick={() => onNavigate("upload")}
            id="action_generate"
            className="p-4 bg-slate-900 hover:bg-slate-800/80 border border-slate-800 rounded-2xl shadow-sm text-center flex flex-col items-center gap-2 transition-all cursor-pointer group hover:border-slate-700"
          >
            <div className="p-3 bg-violet-500/10 text-violet-400 rounded-xl group-hover:bg-violet-500/20 transition-colors border border-violet-500/20">
              <Wand2 className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-200">Generate Posts</span>
          </button>

          <button
            onClick={() => onNavigate("calendar")}
            id="action_schedule"
            className="p-4 bg-slate-900 hover:bg-slate-800/80 border border-slate-800 rounded-2xl shadow-sm text-center flex flex-col items-center gap-2 transition-all cursor-pointer group hover:border-slate-700"
          >
            <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl group-hover:bg-emerald-500/20 transition-colors border border-emerald-500/20">
              <Clock className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-200">Schedule Posts</span>
          </button>

          <button
            onClick={() => onNavigate("calendar")}
            id="action_view_calendar"
            className="p-4 bg-slate-900 hover:bg-slate-800/80 border border-slate-800 rounded-2xl shadow-sm text-center flex flex-col items-center gap-2 transition-all cursor-pointer group hover:border-slate-700"
          >
            <div className="p-3 bg-sky-500/10 text-sky-400 rounded-xl group-hover:bg-sky-500/20 transition-colors border border-sky-500/20">
              <Calendar className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-200">View Calendar</span>
          </button>

          <button
            onClick={() => onNavigate("settings")}
            id="action_hashtag_lib"
            className="p-4 bg-slate-900 hover:bg-slate-800/80 border border-slate-800 rounded-2xl shadow-sm text-center flex flex-col items-center gap-2 transition-all cursor-pointer group hover:border-slate-700"
          >
            <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl group-hover:bg-amber-500/20 transition-colors border border-amber-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-200">Hashtag Library</span>
          </button>

          <button
            onClick={() => onNavigate("settings")}
            id="action_sys_settings"
            className="p-4 bg-slate-900 hover:bg-slate-800/80 border border-slate-800 rounded-2xl shadow-sm text-center flex flex-col items-center gap-2 transition-all cursor-pointer group hover:border-slate-700"
          >
            <div className="p-3 bg-rose-500/10 text-rose-400 rounded-xl group-hover:bg-rose-500/20 transition-colors border border-rose-500/20">
              <TrendingUp className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-200">Settings</span>
          </button>
        </div>
      </div>

      {/* Multi-column Layout: Active Notifications on Left, Audit Trail on Right */}
      <div id="dashboard_logs_notifications" className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div
          id="notifications_section"
          className="lg:col-span-5 bg-slate-900/50 backdrop-blur-md p-6 rounded-3xl border border-slate-800/80 flex flex-col"
        >
          <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <span className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg border border-indigo-500/20">
                <Bell className="w-4 h-4" />
              </span>
              <h2 className="text-md font-bold text-white">Urgent Notifications</h2>
            </div>
            <span className="text-xs font-semibold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full">
              Live Feed
            </span>
          </div>

          <div id="notifications_list" className="space-y-3 flex-1 overflow-y-auto max-h-[350px] pr-1">
            {notifications.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-sm">No active notifications or alerts.</div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  id={`notif_card_${notif.id}`}
                  className={`p-3.5 rounded-xl border flex gap-3 items-start transition-all ${
                    notif.type === "success"
                      ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-200"
                      : notif.type === "warning"
                      ? "bg-amber-500/5 border-amber-500/20 text-amber-200"
                      : notif.type === "error"
                      ? "bg-rose-500/5 border-rose-500/20 text-rose-200"
                      : "bg-indigo-500/5 border-indigo-500/20 text-indigo-200"
                  }`}
                >
                  <div className="mt-0.5 font-bold text-xs">
                    {notif.type === "success" && "OK"}
                    {notif.type === "warning" && "!"}
                    {notif.type === "error" && "ERR"}
                    {notif.type === "info" && "i"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-bold leading-tight">{notif.title}</h4>
                    <p className="text-xs opacity-90 mt-1 leading-relaxed">{notif.message}</p>
                    <span className="text-[10px] font-medium opacity-60 block mt-1.5">{notif.time}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Real-time Audit Logs & Action Logs with Tab Switching */}
        <div
          id="audit_logs_section"
          className="lg:col-span-7 bg-slate-900/50 backdrop-blur-md p-6 rounded-3xl border border-slate-800/80 flex flex-col"
        >
          <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3 flex-wrap gap-3">
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => setActiveTab("audit")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === "audit" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Audit Trail
              </button>
              <button
                onClick={() => setActiveTab("token")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === "token" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Cpu className="w-3.5 h-3.5" />
                AI Token Usage
              </button>
            </div>

            {permissions.canManageSettings && (
              <button
                onClick={activeTab === "audit" ? onClearLogs : onClearTokenLogs}
                id="btn_clear_logs"
                className="text-xs text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 px-3 py-1.5 rounded-xl border border-rose-500/20 transition-all font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear {activeTab === "audit" ? "Audit" : "Token"} Logs
              </button>
            )}
          </div>

          {activeTab === "audit" ? (
            <div id="audit_logs_list" className="space-y-3 flex-1 overflow-y-auto max-h-[350px] pr-1">
              {logs.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-sm">No system audit logs found.</div>
              ) : (
                logs.map((log) => (
                  <div
                    key={log.id}
                    id={`log_item_${log.id}`}
                    className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 flex items-start justify-between gap-4 text-xs hover:bg-slate-800/30 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-100">{log.action}</span>
                        <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-1.5 py-0.5 rounded text-[10px] font-medium">
                          {log.userEmail}
                        </span>
                      </div>
                      <p className="text-slate-400 mt-1.5 font-medium leading-relaxed">{log.details}</p>
                    </div>
                    <span className="text-[10px] text-slate-500 whitespace-nowrap font-medium font-mono">
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </span>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="grid grid-cols-3 gap-2 mb-4 bg-slate-950/80 p-3 rounded-xl border border-slate-800/60">
                <div className="text-center">
                  <span className="text-[9px] uppercase tracking-wider text-slate-500 block font-semibold">Prompt</span>
                  <span className="text-sm font-bold text-slate-300 font-mono">
                    {tokenLogs.reduce((acc, curr) => acc + curr.promptTokens, 0).toLocaleString()}
                  </span>
                </div>
                <div className="text-center border-x border-slate-800">
                  <span className="text-[9px] uppercase tracking-wider text-slate-500 block font-semibold">Completion</span>
                  <span className="text-sm font-bold text-slate-300 font-mono">
                    {tokenLogs.reduce((acc, curr) => acc + curr.completionTokens, 0).toLocaleString()}
                  </span>
                </div>
                <div className="text-center">
                  <span className="text-[9px] uppercase tracking-wider text-slate-500 block font-semibold">Total Tokens</span>
                  <span className="text-sm font-bold text-indigo-400 font-mono">
                    {tokenLogs.reduce((acc, curr) => acc + curr.totalTokens, 0).toLocaleString()}
                  </span>
                </div>
              </div>

              <div id="token_logs_list" className="space-y-3 flex-1 overflow-y-auto max-h-[280px] pr-1">
                {tokenLogs.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 text-sm">
                    No token consumption logs recorded. Run AI actions first!
                  </div>
                ) : (
                  tokenLogs.map((log) => (
                    <div
                      key={log.id}
                      id={`token_log_${log.id}`}
                      className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 hover:bg-slate-800/30 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-100 text-xs">{log.action}</span>
                            <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-1.5 py-0.5 rounded text-[10px] font-medium">
                              {log.agentName}
                            </span>
                            <span className="bg-slate-800 text-slate-400 border border-slate-700 px-1.5 py-0.5 rounded text-[10px] font-mono">
                              {log.modelName}
                            </span>
                          </div>

                          <div className="flex items-center gap-4 mt-2 text-[10px] font-mono text-slate-400">
                            <span>
                              In: <strong className="text-slate-300">{log.promptTokens.toLocaleString()}</strong>
                            </span>
                            <span>
                              Out: <strong className="text-slate-300">{log.completionTokens.toLocaleString()}</strong>
                            </span>
                            <span>
                              Total: <strong className="text-indigo-400">{log.totalTokens.toLocaleString()}</strong>
                            </span>
                          </div>
                        </div>

                        <span className="text-[10px] text-slate-500 whitespace-nowrap font-medium font-mono">
                          {new Date(log.timestamp).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
