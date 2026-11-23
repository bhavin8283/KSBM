import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Asset,
  AuditLog,
  Folder,
  KSMBBusinessConfig,
  KSBMUser,
  ModuleDashboardMetrics,
  Notification,
  Product,
  Schedule,
  Settings,
  Template,
  ToastMessage,
  TokenUsageLog,
} from "../types";
import { StoreSocialApiClient } from "../services/storeSocialApi";
import { computeDashboardMetrics, resolveModulePermissions } from "../utils/mediaUtils";

interface UseStoreSocialModuleOptions {
  currentUser: KSBMUser;
  businessConfig: KSMBBusinessConfig;
  onNavigateView?: (view: "dashboard" | "upload" | "assets" | "calendar" | "settings") => void;
  onMetricsUpdate?: (metrics: ModuleDashboardMetrics) => void;
}

export function useStoreSocialModule({
  currentUser,
  businessConfig,
  onNavigateView,
  onMetricsUpdate,
}: UseStoreSocialModuleOptions) {
  const api = useMemo(
    () => new StoreSocialApiClient({ currentUser, businessConfig }),
    [currentUser, businessConfig]
  );

  const permissions = useMemo(() => resolveModulePermissions(currentUser), [currentUser]);

  const [products, setProducts] = useState<Product[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [tokenLogs, setTokenLogs] = useState<TokenUsageLog[]>([]);
  const [dataLoading, setDataLoading] = useState<boolean>(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((message: string, type: "success" | "error" | "info" = "success") => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const mergeBusinessConfigWithSettings = useCallback(
    (fetched: Settings): Settings => ({
      ...fetched,
      storeName: businessConfig.storeName || fetched.storeName,
      address: businessConfig.address || fetched.address,
      phone: businessConfig.phone || fetched.phone,
      email: businessConfig.email || fetched.email,
      website: businessConfig.website || fetched.website,
      openingHours: businessConfig.openingHours || fetched.openingHours,
      storeDescription: businessConfig.storeDescription || fetched.storeDescription,
      defaultCTA: businessConfig.defaultCTA || fetched.defaultCTA,
      defaultSignature: businessConfig.defaultSignature || fetched.defaultSignature,
    }),
    [businessConfig]
  );

  const fetchInitialData = useCallback(async () => {
    setDataLoading(true);
    try {
      const [prodRes, schedRes, tempRes, logRes, notifRes, setRes, foldRes, tokenRes] = await Promise.all([
        api.getProducts(),
        api.getSchedules(),
        api.getTemplates(),
        api.getLogs(),
        api.getNotifications(),
        api.getSettings(),
        api.getFolders(),
        api.getTokenUsage(),
      ]);

      setProducts(prodRes);
      setSchedules(schedRes);
      setTemplates(tempRes);
      setLogs(logRes);
      setNotifications(notifRes);
      setSettings(mergeBusinessConfigWithSettings(setRes));
      setFolders(foldRes);
      setTokenLogs(tokenRes);
    } catch (e) {
      console.error("Failed to fetch StoreSocial module data", e);
      addToast("Failed to sync module data feeds. Check connection.", "error");
    } finally {
      setDataLoading(false);
    }
  }, [api, addToast, mergeBusinessConfigWithSettings]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  const metrics = useMemo(() => computeDashboardMetrics(products, schedules), [products, schedules]);

  useEffect(() => {
    onMetricsUpdate?.(metrics);
  }, [metrics, onMetricsUpdate]);

  const handleProductUpload = useCallback(
    async (name: string, imageUrl: string, category: string, mediaType?: "image" | "video") => {
      if (!permissions.canUpload) {
        addToast("You do not have permission to upload products.", "error");
        return;
      }
      try {
        const data = await api.uploadProduct({ name, imageUrl, category, mediaType });
        if (data.success) {
          setProducts((prev) => [data.product, ...prev]);
          addToast(`Asset uploaded successfully to ${category}!`, "success");
          fetchInitialData();
        }
      } catch {
        addToast("Media upload failed.", "error");
      }
    },
    [api, permissions.canUpload, addToast, fetchInitialData]
  );

  const handleImportAssetToStudio = useCallback(
    async (asset: Asset) => {
      if (!permissions.canUpload) {
        addToast("You do not have permission to import assets into Product Studio.", "error");
        return;
      }
      try {
        const folder = folders.find((f) => f.id === asset.folderId);
        const folderContext = folder ? `From Vault: ${folder.name}` : "General Promotions";
        const data = await api.uploadProduct({
          name: asset.name,
          imageUrl: asset.imageUrl,
          category: folderContext,
          mediaType: asset.mediaType,
        });
        if (data.success) {
          setProducts((prev) => [data.product, ...prev]);
          addToast(`Asset "${asset.name}" imported into Product Studio!`, "success");
          fetchInitialData();
          onNavigateView?.("upload");
        }
      } catch {
        addToast("Failed to import asset.", "error");
      }
    },
    [api, folders, permissions.canUpload, addToast, fetchInitialData, onNavigateView]
  );

  const handleProductUploadAutomated = useCallback(
    async (
      imageUrl: string,
      category: string,
      mediaType: "image" | "video",
      date: string,
      time: string,
      platform: "Facebook" | "Instagram" | "Both",
      extraNotes?: string
    ) => {
      if (!permissions.canUpload) {
        addToast("You do not have permission to queue automated campaigns.", "error");
        return;
      }
      try {
        const data = await api.uploadAutomatedCampaign({
          imageUrl,
          category,
          mediaType,
          date,
          time,
          platform,
          extraNotes,
        });
        if (data.success) {
          setProducts((prev) => [data.product, ...prev]);
          addToast("Automated campaign queued successfully!", "success");
          fetchInitialData();
        }
      } catch {
        addToast("Automated campaign upload failed.", "error");
      }
    },
    [api, permissions.canUpload, addToast, fetchInitialData]
  );

  const handleApproveAutomation = useCallback(
    async (productId: string) => {
      if (!permissions.canApprove) {
        addToast("Manager approval permission is required to approve campaigns.", "error");
        return;
      }
      try {
        const data = await api.approveAutomation(productId);
        if (data.success) {
          addToast("Draft Campaign Approved & Scheduled successfully!", "success");
          fetchInitialData();
        }
      } catch {
        addToast("Failed to approve campaign.", "error");
      }
    },
    [api, permissions.canApprove, addToast, fetchInitialData]
  );

  const handleProductUpdate = useCallback(
    async (productId: string, updates: Partial<Product>) => {
      if (!permissions.canEdit) {
        addToast("You do not have permission to edit products.", "error");
        return;
      }
      try {
        await api.updateProduct(productId, updates);
        setProducts((prev) => prev.map((p) => (p.id === productId ? { ...p, ...updates } : p)));
        addToast("Product spec updated successfully.");
      } catch {
        addToast("Failed to modify product.", "error");
      }
    },
    [api, permissions.canEdit, addToast]
  );

  const handleProductDelete = useCallback(
    async (productId: string) => {
      if (!permissions.canDelete) {
        addToast("You do not have permission to delete products.", "error");
        return;
      }
      try {
        await api.deleteProduct(productId);
        setProducts((prev) => prev.filter((p) => p.id !== productId));
        addToast("Product asset deleted permanently.", "info");
        fetchInitialData();
      } catch {
        addToast("Failed to delete product.", "error");
      }
    },
    [api, permissions.canDelete, addToast, fetchInitialData]
  );

  const handleRecognizeProduct = useCallback(
    async (productId: string) => {
      try {
        const data = await api.recognizeProduct(productId);
        if (data.quotaExceeded) {
          addToast("Gemini API quota reached. Using smart vision simulator instead!", "info");
        } else if (data.simulated) {
          addToast("Smart convenience vision simulator active!", "info");
        } else {
          addToast("AI Vision analysis completed successfully!", "success");
        }
        fetchInitialData();
        return data.result;
      } catch (e: any) {
        addToast(`AI Analysis failed: ${e.message}`, "error");
        throw e;
      }
    },
    [api, addToast, fetchInitialData]
  );

  const handleGenerateCaptions = useCallback(
    async (productId: string, force = false) => {
      try {
        const data = await api.generateCaptions(productId, { force });
        if (data.quotaExceeded) {
          addToast("API quota reached. Loaded high-quality simulated copywriting!", "info");
        } else if (data.simulated) {
          addToast("Simulated copywriting loaded successfully!", "success");
        } else {
          addToast(data.cached ? "Retrieved cached captions" : "AI copywriting drafts generated!", "success");
        }
        fetchInitialData();
        return data.captions;
      } catch (e: any) {
        addToast(`Caption generator failed: ${e.message}`, "error");
        throw e;
      }
    },
    [api, addToast, fetchInitialData]
  );

  const handleGenerateHashtags = useCallback(
    async (productId: string, count: number, force = false) => {
      try {
        const data = await api.generateHashtags(productId, count, force);
        if (data.quotaExceeded) {
          addToast("API quota reached. Loaded targeted simulated hashtags!", "info");
        } else if (data.simulated) {
          addToast("Simulated hashtags loaded successfully!", "success");
        } else {
          addToast(data.cached ? `Retrieved ${count} existing hashtags!` : `Generated ${count} targeted hashtags!`, "success");
        }
        return data.hashtags;
      } catch (e) {
        addToast("Hashtag engine failed.", "error");
        throw e;
      }
    },
    [api, addToast]
  );

  const handleEnhanceBackground = useCallback(
    async (
      productId: string,
      themeName: string,
      customPrompt?: string,
      placement?: "left" | "center" | "right",
      scale?: number,
      facebookOptimize?: boolean
    ) => {
      try {
        const data = await api.enhanceBackground(productId, {
          themeName,
          customPrompt,
          placement,
          scale,
          facebookOptimize,
        });
        if (data.quotaExceeded) {
          addToast("API quota reached. Rendered high-fidelity custom backdrop mockup!", "info");
        } else {
          addToast(`Rendered custom background theme "${themeName}"!`, "success");
        }
        fetchInitialData();
        return data.enhancedUrl;
      } catch (e) {
        addToast("Background Studio failed.", "error");
        throw e;
      }
    },
    [api, addToast, fetchInitialData]
  );

  const handleCreateTemplate = useCallback(
    async (type: "content" | "hashtag", title: string, content: string, alwaysUseAutomated?: boolean) => {
      if (!permissions.canManageSettings) {
        addToast("Permission denied to create templates.", "error");
        return;
      }
      try {
        const data = await api.createTemplate({ type, title, content, alwaysUseAutomated });
        if (data.success) {
          setTemplates((prev) => [...prev, data.template]);
          addToast("Template added to your library.", "success");
          fetchInitialData();
        }
      } catch {
        addToast("Failed to create template.", "error");
      }
    },
    [api, permissions.canManageSettings, addToast, fetchInitialData]
  );

  const handleUpdateTemplate = useCallback(
    async (templateId: string, updates: Partial<Template>) => {
      if (!permissions.canManageSettings) {
        addToast("Permission denied to edit templates.", "error");
        return;
      }
      try {
        await api.updateTemplate(templateId, updates);
        setTemplates((prev) => prev.map((t) => (t.id === templateId ? { ...t, ...updates } : t)));
        addToast("Template updated successfully.", "success");
        fetchInitialData();
      } catch {
        addToast("Failed to update template.", "error");
      }
    },
    [api, permissions.canManageSettings, addToast, fetchInitialData]
  );

  const handleDeleteTemplate = useCallback(
    async (templateId: string) => {
      if (!permissions.canManageSettings) {
        addToast("Permission denied to delete templates.", "error");
        return;
      }
      try {
        await api.deleteTemplate(templateId);
        setTemplates((prev) => prev.filter((t) => t.id !== templateId));
        addToast("Template removed.", "info");
      } catch {
        addToast("Failed to delete template.", "error");
      }
    },
    [api, permissions.canManageSettings, addToast]
  );

  const handlePublishNow = useCallback(
    async (postData: { productId: string; platform: string; caption: string; hashtags: string[]; imageUrl: string }) => {
      if (!permissions.canPublish) {
        addToast("Publishing permission is required to post directly to social feeds.", "error");
        return;
      }
      try {
        const data = await api.publishNow(postData);
        if (data.success) {
          addToast("Successfully published to social channels!", "success");
          fetchInitialData();
          return data;
        }
      } catch {
        addToast("Direct publish handshake failed.", "error");
      }
    },
    [api, permissions.canPublish, addToast, fetchInitialData]
  );

  const handleSchedulePost = useCallback(
    async (schedData: { productId: string; date: string; time: string; platform: "Facebook" | "Instagram" | "Both" }) => {
      if (!permissions.canEdit) {
        addToast("Permission denied to schedule posts.", "error");
        return;
      }
      try {
        const data = await api.createSchedule(schedData);
        if (data.success) {
          addToast("Social post scheduled successfully!", "success");
          fetchInitialData();
          return data;
        }
      } catch {
        addToast("Scheduling queue failed.", "error");
      }
    },
    [api, permissions.canEdit, addToast, fetchInitialData]
  );

  const handleDeleteSchedule = useCallback(
    async (scheduleId: string) => {
      if (!permissions.canDelete) {
        addToast("Permission denied to cancel scheduled posts.", "error");
        return;
      }
      try {
        await api.deleteSchedule(scheduleId);
        setSchedules((prev) => prev.filter((s) => s.id !== scheduleId));
        addToast("Scheduled post removed from queue.", "info");
        fetchInitialData();
      } catch {
        addToast("Failed to clear schedule.", "error");
      }
    },
    [api, permissions.canDelete, addToast, fetchInitialData]
  );

  const handleReschedule = useCallback(
    async (scheduleId: string, newDate: string, newTime: string) => {
      if (!permissions.canEdit) {
        addToast("Permission denied to reschedule posts.", "error");
        return;
      }
      const schedObj = schedules.find((s) => s.id === scheduleId);
      if (schedObj) {
        await handleDeleteSchedule(scheduleId);
        await handleSchedulePost({
          productId: schedObj.productId,
          date: newDate,
          time: newTime,
          platform: schedObj.platform,
        });
        addToast("Schedule date/time shifted successfully.");
      }
    },
    [schedules, permissions.canEdit, handleDeleteSchedule, handleSchedulePost, addToast]
  );

  const handleUpdateSettings = useCallback(
    async (updates: Partial<Settings>) => {
      if (!permissions.canManageSettings) {
        addToast("Admin permission required to modify module settings.", "error");
        return;
      }
      try {
        const data = await api.updateSettings(updates);
        if (data.success) {
          setSettings(mergeBusinessConfigWithSettings(data.settings));
          addToast("Integration and business profile updated.");
        }
      } catch {
        addToast("Failed to save settings.", "error");
      }
    },
    [api, permissions.canManageSettings, mergeBusinessConfigWithSettings, addToast]
  );

  const handleClearLogs = useCallback(async () => {
    if (!permissions.canManageSettings) {
      addToast("Admin permission required to clear audit logs.", "error");
      return;
    }
    try {
      await api.clearLogs();
      setLogs([]);
      addToast("Audit logs cleared successfully.", "info");
    } catch {
      addToast("Failed to clear logs.", "error");
    }
  }, [api, permissions.canManageSettings, addToast]);

  const handleClearTokenLogs = useCallback(async () => {
    if (!permissions.canManageSettings) {
      addToast("Admin permission required to clear token usage logs.", "error");
      return;
    }
    try {
      await api.clearTokenLogs();
      setTokenLogs([]);
      addToast("AI Token usage logs cleared successfully.", "info");
      const logsRes = await api.getLogs();
      setLogs(logsRes);
    } catch {
      addToast("Failed to clear token logs.", "error");
    }
  }, [api, permissions.canManageSettings, addToast]);

  return {
    api,
    permissions,
    metrics,
    products,
    schedules,
    templates,
    logs,
    notifications,
    settings,
    folders,
    tokenLogs,
    dataLoading,
    toasts,
    addToast,
    fetchInitialData,
    handleProductUpload,
    handleImportAssetToStudio,
    handleProductUploadAutomated,
    handleApproveAutomation,
    handleProductUpdate,
    handleProductDelete,
    handleRecognizeProduct,
    handleGenerateCaptions,
    handleGenerateHashtags,
    handleEnhanceBackground,
    handleCreateTemplate,
    handleUpdateTemplate,
    handleDeleteTemplate,
    handlePublishNow,
    handleSchedulePost,
    handleDeleteSchedule,
    handleReschedule,
    handleUpdateSettings,
    handleTestGemini: (apiKey: string) => api.testGemini(apiKey),
    handleTestFacebook: (fbData: { fbAppId: string; fbPageId: string; fbAccessToken: string }) => api.testFacebook(fbData),
    handleTestInstagram: (igData: { igAccountId: string; igAccessToken: string }) => api.testInstagram(igData),
    handleClearLogs,
    handleClearTokenLogs,
  };
}
