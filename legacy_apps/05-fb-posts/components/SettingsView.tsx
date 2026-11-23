import React, { useState } from "react";
import {
  Building,
  Facebook,
  Instagram,
  Cpu,
  FileText,
  CheckCircle,
  Plus,
  Trash2,
  RefreshCw,
  SlidersHorizontal,
  Edit3,
  Check,
  X,
  Lock,
} from "lucide-react";
import { AIAgentConfig, ModulePermissions, Settings, Template } from "../types";
import { sanitizeHashtagContent } from "../utils/mediaUtils";

interface SettingsViewProps {
  settings: Settings;
  permissions: ModulePermissions;
  onUpdateSettings: (updates: Partial<Settings>) => void;
  templates: Template[];
  onCreateTemplate: (type: "content" | "hashtag", title: string, content: string, alwaysUseAutomated?: boolean) => void;
  onUpdateTemplate?: (templateId: string, updates: Partial<Template>) => void;
  onDeleteTemplate: (templateId: string) => void;
  onTestGemini: (apiKey: string) => Promise<{ success: boolean; message?: string; error?: string }>;
  onTestFacebook: (fbData: { fbAppId: string; fbPageId: string; fbAccessToken: string }) => Promise<any>;
  onTestInstagram: (igData: { igAccountId: string; igAccessToken: string }) => Promise<any>;
}

export default function SettingsView({
  settings,
  permissions,
  onUpdateSettings,
  templates,
  onCreateTemplate,
  onUpdateTemplate,
  onDeleteTemplate,
  onTestGemini,
  onTestFacebook,
  onTestInstagram,
}: SettingsViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<"business" | "apis" | "templates" | "automation">("business");

  const [localSettings, setLocalSettings] = useState<Settings>(settings);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  React.useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const [geminiTestLoading, setGeminiTestLoading] = useState(false);
  const [geminiTestStatus, setGeminiTestStatus] = useState<{ success: boolean; text: string } | null>(null);

  const [fbTestLoading, setFbTestLoading] = useState(false);
  const [fbTestStatus, setFbTestStatus] = useState<string | null>(null);

  const [igTestLoading, setIgTestLoading] = useState(false);
  const [igTestStatus, setIgTestStatus] = useState<string | null>(null);

  const [newTempType, setNewTempType] = useState<"content" | "hashtag">("hashtag");
  const [newTempTitle, setNewTempTitle] = useState("");
  const [newTempContent, setNewTempContent] = useState("");
  const [newTempAlwaysUse, setNewTempAlwaysUse] = useState(true);

  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [editTempType, setEditTempType] = useState<"content" | "hashtag">("hashtag");
  const [editTempTitle, setEditTempTitle] = useState("");
  const [editTempContent, setEditTempContent] = useState("");

  const isReadOnly = !permissions.canManageSettings;

  const handleUpdateField = (updates: Partial<Settings>) => {
    if (isReadOnly) return;
    setLocalSettings((prev) => ({ ...prev, ...updates }));
  };

  const handleUpdateAgent = (agentId: string, updates: Partial<AIAgentConfig>) => {
    if (isReadOnly) return;
    const updatedAgents = (localSettings.aiAgents || []).map((agent) => {
      if (agent.id === agentId) {
        return { ...agent, ...updates };
      }
      return agent;
    });
    setLocalSettings((prev) => ({ ...prev, aiAgents: updatedAgents }));
  };

  const handleSaveSettings = (tabName: string) => {
    if (isReadOnly) return;
    onUpdateSettings(localSettings);
    setSaveStatus(`${tabName} changes saved successfully!`);
    setTimeout(() => {
      setSaveStatus(null);
    }, 3500);
  };

  const handleTestGeminiAction = async () => {
    const apiKey = localSettings.geminiApiKey || "";
    if (!apiKey) {
      setGeminiTestStatus({ success: false, text: "Google API key is required to test connection." });
      return;
    }

    setGeminiTestLoading(true);
    setGeminiTestStatus(null);

    try {
      const data = await onTestGemini(apiKey);
      if (data.success) {
        setGeminiTestStatus({ success: true, text: data.message || "Connected successfully!" });
      } else {
        setGeminiTestStatus({ success: false, text: data.error || "Connection failed." });
      }
    } catch (e: any) {
      setGeminiTestStatus({ success: false, text: e.message || "Network failed to reach Google API." });
    } finally {
      setGeminiTestLoading(false);
    }
  };

  const handleTestFacebookAction = async () => {
    setFbTestLoading(true);
    setFbTestStatus(null);
    try {
      const res = await onTestFacebook({
        fbAppId: localSettings.fbAppId,
        fbPageId: localSettings.fbPageId,
        fbAccessToken: localSettings.fbAccessToken,
      });
      setFbTestStatus(`Connected! Account: ${res.accountName} (${res.tokenStatus})`);
    } catch (e: any) {
      setFbTestStatus("Error connecting: " + e.message);
    } finally {
      setFbTestLoading(false);
    }
  };

  const handleTestInstagramAction = async () => {
    setIgTestLoading(true);
    setIgTestStatus(null);
    try {
      const res = await onTestInstagram({
        igAccountId: localSettings.igAccountId,
        igAccessToken: localSettings.igAccessToken,
      });
      setIgTestStatus(`Connected! Handle: ${res.username} (${res.followersCount} Followers)`);
    } catch (e: any) {
      setIgTestStatus("Error connecting: " + e.message);
    } finally {
      setIgTestLoading(false);
    }
  };

  const handleCreateTemplateAction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTempTitle || !newTempContent || isReadOnly) return;
    const contentToSave = newTempType === "hashtag" ? sanitizeHashtagContent(newTempContent) : newTempContent;
    onCreateTemplate(newTempType, newTempTitle, contentToSave, newTempAlwaysUse);
    setNewTempTitle("");
    setNewTempContent("");
    setNewTempAlwaysUse(true);
  };

  return (
    <div id="settings_container" className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fade-in">
      {/* Left sidebar nav panel (Password/Security tab removed; handled by KSBM Master Shell) */}
      <div className="lg:col-span-3 space-y-2">
        {[
          { id: "business", label: "Business Information", icon: <Building className="w-4 h-4" /> },
          { id: "apis", label: "API & Integrations", icon: <Cpu className="w-4 h-4" /> },
          { id: "templates", label: "Templates Library", icon: <FileText className="w-4 h-4" /> },
          { id: "automation", label: "Automation Rules", icon: <SlidersHorizontal className="w-4 h-4" /> },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id as any)}
            className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold transition-all flex items-center gap-3 cursor-pointer ${
              activeSubTab === tab.id
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 border border-transparent"
                : "bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}

        {isReadOnly && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300 flex items-start gap-2 mt-4">
            <Lock className="w-4 h-4 shrink-0 mt-0.5" />
            <span>Read-only mode. Admin permission is required to modify module settings.</span>
          </div>
        )}
      </div>

      {/* Main Settings Canvas */}
      <div className="lg:col-span-9 bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl space-y-6 animate-scale-up">
        {saveStatus && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl flex items-center gap-2.5 text-xs text-emerald-400 font-bold animate-slide-in">
            <CheckCircle className="w-4.5 h-4.5" />
            {saveStatus}
          </div>
        )}

        {/* Sub-tab 1: Business Information */}
        {activeSubTab === "business" && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-md font-bold text-white font-display tracking-tight">Convenience Business Profile</h2>
                <p className="text-xs text-slate-400 mt-1">
                  Core store details sync from KSBM Master Admin configuration. Customize social CTAs & signatures below.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Store / Brand Name</label>
                <input
                  type="text"
                  disabled={isReadOnly}
                  value={localSettings.storeName}
                  onChange={(e) => handleUpdateField({ storeName: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Store Website URL</label>
                <input
                  type="text"
                  disabled={isReadOnly}
                  value={localSettings.website}
                  onChange={(e) => handleUpdateField({ website: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
                />
              </div>

              <div className="col-span-1 md:col-span-2">
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Physical Address</label>
                <input
                  type="text"
                  disabled={isReadOnly}
                  value={localSettings.address}
                  onChange={(e) => handleUpdateField({ address: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Customer Phone Line</label>
                <input
                  type="text"
                  disabled={isReadOnly}
                  value={localSettings.phone}
                  onChange={(e) => handleUpdateField({ phone: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Opening Business Hours</label>
                <input
                  type="text"
                  disabled={isReadOnly}
                  value={localSettings.openingHours}
                  onChange={(e) => handleUpdateField({ openingHours: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
                />
              </div>

              <div className="col-span-1 md:col-span-2">
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Store Core Description</label>
                <textarea
                  rows={3}
                  disabled={isReadOnly}
                  value={localSettings.storeDescription}
                  onChange={(e) => handleUpdateField({ storeDescription: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none disabled:opacity-60"
                />
              </div>

              <div className="col-span-1 md:col-span-2 border-t border-slate-800 pt-4">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">Post Automation Appendages</h3>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Default Call-To-Action (CTA)</label>
                <input
                  type="text"
                  disabled={isReadOnly}
                  value={localSettings.defaultCTA}
                  onChange={(e) => handleUpdateField({ defaultCTA: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Default Signature Block</label>
                <input
                  type="text"
                  disabled={isReadOnly}
                  value={localSettings.defaultSignature}
                  onChange={(e) => handleUpdateField({ defaultSignature: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
                />
              </div>
            </div>

            {!isReadOnly && (
              <div className="flex justify-end pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => handleSaveSettings("Business profile")}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1.5 shadow-lg shadow-emerald-600/15"
                >
                  <CheckCircle className="w-4 h-4" />
                  Save Business Profile
                </button>
              </div>
            )}
          </div>
        )}

        {/* Sub-tab 2: APIs & Social Integrations */}
        {activeSubTab === "apis" && (
          <div className="space-y-6 animate-fade-in">
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <span className="p-1.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded">AI</span>
                  Google Gemini API
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Configure your Google API key and Gemini model used for product recognition, caption generation, hashtags, and background workflows.
                </p>
              </div>

              <div className="space-y-4 pt-1">
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-white">Gemini (Google)</h4>
                    <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded text-[8px] uppercase tracking-wider font-extrabold">
                      Active
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Google API Key</label>
                      <input
                        type="password"
                        disabled={isReadOnly}
                        value={localSettings.geminiApiKey || ""}
                        placeholder="Using default system injected key"
                        onChange={(e) => handleUpdateField({ geminiApiKey: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Gemini Model</label>
                      <select
                        disabled={isReadOnly}
                        value={localSettings.geminiModel || "gemini-2.5-flash"}
                        onChange={(e) => handleUpdateField({ geminiModel: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 focus:outline-none cursor-pointer font-bold disabled:opacity-60"
                      >
                        <option value="gemini-2.5-flash">gemini-2.5-flash (Fast & Capable)</option>
                        <option value="gemini-2.5-pro">gemini-2.5-pro (Creative & Reasoning)</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-1">
                    <button
                      type="button"
                      onClick={handleTestGeminiAction}
                      disabled={geminiTestLoading || isReadOnly}
                      className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3 h-3 ${geminiTestLoading ? "animate-spin" : ""}`} />
                      Test Connection
                    </button>
                    {geminiTestStatus && (
                      <span className={`text-xs font-bold flex items-center gap-1 ${geminiTestStatus.success ? "text-emerald-400" : "text-rose-400"}`}>
                        {geminiTestStatus.text}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Failover / Backup AI Engines */}
            <div id="ai_failover_backup_section" className="border-t border-slate-800 pt-5 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <span className="p-1.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded">Failover</span>
                  AI Failover & Backup Engines
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Configure additional AI engines. If the main Gemini key hits daily quota limits, enabled backup engines run in order of priority.
                </p>
              </div>

              <div className="space-y-4">
                {(localSettings.aiAgents || [])
                  .filter((agent) => agent.id !== "gemini")
                  .map((agent) => (
                    <div key={agent.id} className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <input
                            type="checkbox"
                            id={`enable_${agent.id}`}
                            disabled={isReadOnly}
                            checked={agent.enabled}
                            onChange={(e) => handleUpdateAgent(agent.id, { enabled: e.target.checked })}
                            className="w-4 h-4 rounded text-indigo-600 border-slate-800 bg-slate-900 cursor-pointer"
                          />
                          <label htmlFor={`enable_${agent.id}`} className="text-xs font-bold text-slate-200 cursor-pointer uppercase tracking-wide">
                            {agent.name}
                          </label>
                        </div>

                        <div className="flex items-center gap-2">
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Failover Priority:</label>
                          <select
                            disabled={isReadOnly}
                            value={agent.priority || 2}
                            onChange={(e) => handleUpdateAgent(agent.id, { priority: parseInt(e.target.value, 10) })}
                            className="px-2 py-1 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 text-xs font-bold cursor-pointer font-sans"
                          >
                            {[1, 2, 3, 4, 5, 6].map((num) => (
                              <option key={num} value={num}>
                                Priority {num}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {agent.enabled && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-1 animate-fade-in">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{agent.name} API Key</label>
                            <input
                              type="password"
                              disabled={isReadOnly}
                              value={agent.apiKey || ""}
                              placeholder={`Enter ${agent.name} API Key`}
                              onChange={(e) => handleUpdateAgent(agent.id, { apiKey: e.target.value })}
                              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Model Name / ID</label>
                            <input
                              type="text"
                              disabled={isReadOnly}
                              value={agent.model || ""}
                              placeholder="e.g. gpt-4o-mini, llama-3.3-70b-versatile"
                              onChange={(e) => handleUpdateAgent(agent.id, { model: e.target.value })}
                              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono text-xs"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </div>

            {/* Social Network integration */}
            <div className="border-t border-slate-800 pt-5 space-y-5">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Social Publication Streams</h3>

              <div className="space-y-3 pb-5 border-b border-slate-800/80">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded">
                      <Facebook className="w-4 h-4" />
                    </span>
                    <h3 className="text-xs font-bold text-white">Facebook Page Publishing</h3>
                  </div>
                  <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded text-[8px] font-black uppercase">
                    Configured
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">App ID</label>
                    <input
                      type="text"
                      disabled={isReadOnly}
                      value={localSettings.fbAppId}
                      onChange={(e) => handleUpdateField({ fbAppId: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">App Secret</label>
                    <input
                      type="password"
                      disabled={isReadOnly}
                      value={localSettings.fbAppSecret}
                      onChange={(e) => handleUpdateField({ fbAppSecret: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Page ID</label>
                    <input
                      type="text"
                      disabled={isReadOnly}
                      value={localSettings.fbPageId}
                      onChange={(e) => handleUpdateField({ fbPageId: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Long-lived Access Token</label>
                    <input
                      type="password"
                      disabled={isReadOnly}
                      placeholder="Auto-generated during handshake"
                      value={localSettings.fbAccessToken}
                      onChange={(e) => handleUpdateField({ fbAccessToken: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-1">
                  <button
                    onClick={handleTestFacebookAction}
                    disabled={fbTestLoading || isReadOnly}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${fbTestLoading ? "animate-spin" : ""}`} />
                    Test FB Connection
                  </button>
                  {fbTestStatus && <span className="text-xs font-bold text-slate-400">{fbTestStatus}</span>}
                </div>
              </div>

              <div className="space-y-3 pb-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 bg-pink-500/10 text-pink-400 border border-pink-500/20 rounded">
                      <Instagram className="w-4 h-4" />
                    </span>
                    <h3 className="text-xs font-bold text-white">Instagram Account Connection</h3>
                  </div>
                  <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded text-[8px] font-black uppercase">
                    Configured
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Instagram Business ID</label>
                    <input
                      type="text"
                      disabled={isReadOnly}
                      value={localSettings.igAccountId}
                      onChange={(e) => handleUpdateField({ igAccountId: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Instagram Business Access Token</label>
                    <input
                      type="password"
                      disabled={isReadOnly}
                      placeholder="Using shared Facebook Page Access Handshake"
                      value={localSettings.igAccessToken}
                      onChange={(e) => handleUpdateField({ igAccessToken: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-1">
                  <button
                    onClick={handleTestInstagramAction}
                    disabled={igTestLoading || isReadOnly}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${igTestLoading ? "animate-spin" : ""}`} />
                    Verify Instagram Account
                  </button>
                  {igTestStatus && <span className="text-xs font-bold text-slate-400">{igTestStatus}</span>}
                </div>
              </div>
            </div>

            {!isReadOnly && (
              <div className="flex justify-end pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => handleSaveSettings("API Gateways & Integrations")}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1.5 shadow-lg shadow-emerald-600/15"
                >
                  <CheckCircle className="w-4 h-4" />
                  Save API Configurations
                </button>
              </div>
            )}
          </div>
        )}

        {/* Sub-tab 3: Content & Hashtags Reusable Templates Library */}
        {activeSubTab === "templates" && (
          <div className="space-y-6 animate-fade-in">
            <div>
              <h2 className="text-md font-bold text-white font-display tracking-tight">Signatures, CTAs, and Hashtags Library</h2>
              <p className="text-xs text-slate-400 mt-1">
                Store reusable marketing templates that can be easily appended or injected with one click.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {templates.map((temp) => {
                const isEditing = editingTemplateId === temp.id;
                return (
                  <div key={temp.id} className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex flex-col justify-between gap-3 text-xs">
                    {isEditing ? (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Friendly Title</label>
                          <input
                            type="text"
                            value={editTempTitle}
                            onChange={(e) => setEditTempTitle(e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Type</label>
                            <select
                              value={editTempType}
                              onChange={(e) => setEditTempType(e.target.value as any)}
                              className="w-full px-2 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 cursor-pointer focus:outline-none text-xs"
                            >
                              <option value="content">Content Block</option>
                              <option value="hashtag">Hashtag Group</option>
                            </select>
                          </div>
                          <div className="flex items-end pb-1.5">
                            <label className="flex items-center gap-1.5 cursor-pointer text-slate-400 hover:text-slate-200 select-none">
                              <input
                                type="checkbox"
                                checked={temp.alwaysUseAutomated !== false}
                                onChange={() =>
                                  onUpdateTemplate?.(temp.id, { alwaysUseAutomated: temp.alwaysUseAutomated === false })
                                }
                                className="rounded border-slate-800 text-indigo-600 focus:ring-indigo-500 bg-slate-900 w-3.5 h-3.5 cursor-pointer"
                              />
                              <span className="text-[10px] font-medium">Use in Auto-Posts</span>
                            </label>
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Template Content</label>
                          <textarea
                            rows={2}
                            value={editTempContent}
                            onChange={(e) => setEditTempContent(e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 focus:outline-none resize-none focus:ring-1 focus:ring-indigo-500 text-xs"
                          />
                        </div>
                        <div className="flex justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setEditingTemplateId(null)}
                            className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-400 font-medium cursor-pointer flex items-center gap-1"
                          >
                            <X className="w-3 h-3" /> Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (editTempTitle && editTempContent) {
                                const contentToSave =
                                  editTempType === "hashtag" ? sanitizeHashtagContent(editTempContent) : editTempContent;
                                onUpdateTemplate?.(temp.id, {
                                  title: editTempTitle,
                                  content: contentToSave,
                                  type: editTempType,
                                });
                                setEditingTemplateId(null);
                              }
                            }}
                            className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white font-medium cursor-pointer flex items-center gap-1"
                          >
                            <Check className="w-3 h-3" /> Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-200 truncate">{temp.title}</span>
                            <span
                              className={`px-2 py-0.5 rounded text-[9px] font-black uppercase border ${
                                temp.type === "hashtag"
                                  ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
                                  : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              }`}
                            >
                              {temp.type === "hashtag" ? "Hashtag Group" : "Content Signature"}
                            </span>
                          </div>
                          <p className="text-slate-400 mt-2 font-medium break-all line-clamp-3">{temp.content}</p>
                        </div>

                        <div className="flex justify-between items-center pt-2 border-t border-slate-800/60">
                          <label className="flex items-center gap-1.5 cursor-pointer text-slate-400 hover:text-slate-200 select-none">
                            <input
                              type="checkbox"
                              disabled={isReadOnly}
                              checked={temp.alwaysUseAutomated !== false}
                              onChange={() =>
                                onUpdateTemplate?.(temp.id, { alwaysUseAutomated: temp.alwaysUseAutomated === false })
                              }
                              className="rounded border-slate-800 text-indigo-600 focus:ring-indigo-500 bg-slate-950 w-3.5 h-3.5 cursor-pointer"
                            />
                            <span className="text-[10px] font-medium">Use in Automated Posts</span>
                          </label>
                          {!isReadOnly && (
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingTemplateId(temp.id);
                                  setEditTempTitle(temp.title);
                                  setEditTempContent(temp.content);
                                  setEditTempType(temp.type);
                                }}
                                className="text-[11px] text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1 cursor-pointer"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => onDeleteTemplate(temp.id)}
                                className="text-[11px] text-rose-400 hover:text-rose-300 font-bold flex items-center gap-1 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            {!isReadOnly && (
              <form onSubmit={handleCreateTemplateAction} className="border-t border-slate-800 pt-5 space-y-4">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Create New Reusable Template</h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Template Type</label>
                    <select
                      value={newTempType}
                      onChange={(e) => setNewTempType(e.target.value as any)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 cursor-pointer focus:outline-none"
                    >
                      <option value="content">Content Blocks (CTA, Signoffs)</option>
                      <option value="hashtag">Hashtag Template Group</option>
                    </select>
                  </div>

                  <div className="col-span-1 md:col-span-2">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Friendly Title</label>
                    <input
                      type="text"
                      placeholder="E.g. Daily Deals Closing, Energy Drinks Signature"
                      value={newTempTitle}
                      onChange={(e) => setNewTempTitle(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="col-span-1 md:col-span-3">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Template Content</label>
                    <textarea
                      rows={3}
                      placeholder={
                        newTempType === "hashtag"
                          ? "E.g. #ConvenienceStore #KwikStop #Snacks"
                          : "E.g. Visit us today for daily specials!"
                      }
                      value={newTempContent}
                      onChange={(e) => setNewTempContent(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none resize-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="col-span-1 md:col-span-3 flex items-center gap-2 py-1">
                    <input
                      type="checkbox"
                      id="newTempAlwaysUse"
                      checked={newTempAlwaysUse}
                      onChange={(e) => setNewTempAlwaysUse(e.target.checked)}
                      className="rounded border-slate-800 text-indigo-600 focus:ring-indigo-500 bg-slate-950 w-4 h-4 cursor-pointer"
                    />
                    <label htmlFor="newTempAlwaysUse" className="text-xs text-slate-300 font-medium cursor-pointer select-none">
                      Always use in 100% Automated posts
                    </label>
                  </div>
                </div>

                <button
                  type="submit"
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  Add to Library
                </button>
              </form>
            )}
          </div>
        )}

        {/* Sub-tab 4: Automation Rules Editor */}
        {activeSubTab === "automation" && (
          <div className="space-y-6 animate-fade-in">
            <div>
              <h2 className="text-md font-bold text-white font-display tracking-tight">Marketing Automation Rules Engine</h2>
              <p className="text-xs text-slate-400 mt-1">
                Configure automated triggers that automatically execute during product asset uploads.
              </p>
            </div>

            <div className="space-y-3 pt-2 text-xs">
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-200">Rule 1: Energy Drinks Blueprint</h4>
                  <span className="text-[9px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded font-black uppercase">
                    Active
                  </span>
                </div>
                <p className="text-slate-400 font-medium">
                  When product category detected is <b>Energy Drinks</b>:
                </p>
                <div className="space-y-1.5 pl-2">
                  <div className="flex items-center gap-2">
                    <input type="checkbox" defaultChecked disabled className="rounded border-slate-800 text-indigo-500 bg-slate-900" />
                    <span className="font-medium text-slate-300">Auto generate 5 unique social captions (using tone variant)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" defaultChecked disabled className="rounded border-slate-800 text-indigo-500 bg-slate-900" />
                    <span className="font-medium text-slate-300">Auto generate 20 targeted hashtags and append standard Energy template</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" defaultChecked disabled className="rounded border-slate-800 text-indigo-500 bg-slate-900" />
                    <span className="font-medium text-slate-300">Auto suggest "Dark Neon" and "Gaming Setup" background themes</span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-200">Rule 2: Soft Drinks Blueprint</h4>
                  <span className="text-[9px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded font-black uppercase">
                    Active
                  </span>
                </div>
                <p className="text-slate-400 font-medium">
                  When product category detected is <b>Soft Drinks</b>:
                </p>
                <div className="space-y-1.5 pl-2">
                  <div className="flex items-center gap-2">
                    <input type="checkbox" defaultChecked disabled className="rounded border-slate-800 text-indigo-500 bg-slate-900" />
                    <span className="font-medium text-slate-300">Auto generate refreshing, fun copy with ice/summer hashtags</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" defaultChecked disabled className="rounded border-slate-800 text-indigo-500 bg-slate-900" />
                    <span className="font-medium text-slate-300">Suggest "Frosty Ice Blocks" background template overlay</span>
                  </div>
                </div>
              </div>

              {/* Approval Workflow Selector */}
              <div className="p-4 bg-indigo-500/5 border border-indigo-500/20 rounded-2xl space-y-3">
                <h4 className="font-bold text-indigo-300 flex items-center gap-1 text-xs uppercase tracking-wide">
                  Approval Pipeline Workflow
                </h4>
                <p className="text-xs text-indigo-400 leading-relaxed font-medium">
                  Decide how generated social media cards are published to your Facebook Page and Instagram Account.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-2">
                  {[
                    { title: "Auto Publish", desc: "Instantly publish as soon as AI captions generate", value: "Auto Publish" },
                    { title: "Manual Approval", desc: "Keep in Draft until a manager clicks 'Approve / Publish'", value: "Manual Approval" },
                    { title: "Approval Queue", desc: "Batch posts into an admin checklist for weekly review", value: "Approval Queue" },
                  ].map((workflow) => (
                    <div
                      key={workflow.value}
                      onClick={() => !isReadOnly && onUpdateSettings({ approvalWorkflow: workflow.value as any })}
                      className={`p-3 bg-slate-950 border rounded-xl transition-all ${
                        isReadOnly ? "opacity-70 cursor-not-allowed" : "cursor-pointer hover:bg-slate-900"
                      } ${
                        settings.approvalWorkflow === workflow.value
                          ? "border-indigo-500 ring-1 ring-indigo-500/30 font-bold bg-indigo-950/20"
                          : "border-slate-800/60"
                      }`}
                    >
                      <h5 className="text-xs text-slate-200">{workflow.title}</h5>
                      <p className="text-[10px] text-slate-500 mt-1 font-medium leading-normal">{workflow.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Global Auto Background Removal Toggle */}
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-3 animate-fade-in">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="settings_disable_bg_removal"
                    disabled={isReadOnly}
                    checked={!settings.disableAutoBackgroundRemoval}
                    onChange={(e) => onUpdateSettings({ disableAutoBackgroundRemoval: !e.target.checked })}
                    className="w-4 h-4 mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 border-slate-800 bg-slate-900 cursor-pointer"
                  />
                  <div className="space-y-0.5">
                    <label htmlFor="settings_disable_bg_removal" className="text-xs font-bold text-slate-200 cursor-pointer select-none">
                      Global Default: Auto Background Removal (Auto-Crop)
                    </label>
                    <p className="text-[11px] text-slate-400 leading-relaxed font-medium">
                      By default, the AI compositor automatically removes solid white or off-white backgrounds from your uploaded product photos before placing them on a scenic background.
                    </p>
                    <p className="text-[11px] text-amber-400/90 font-medium leading-relaxed">
                      Uncheck this option if your products have white or reflective silver parts that keep getting made transparent during AI background replacement.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
