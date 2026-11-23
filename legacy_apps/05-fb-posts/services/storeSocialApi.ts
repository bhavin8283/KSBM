import {
  Asset,
  AuditLog,
  Folder,
  GeneratedCaption,
  KSMBBusinessConfig,
  KSBMUser,
  Notification,
  Product,
  Schedule,
  Settings,
  Template,
  TokenUsageLog,
} from "../types";

export interface ApiClientContext {
  currentUser?: KSBMUser;
  businessConfig?: KSMBBusinessConfig;
}

export class StoreSocialApiClient {
  private baseUrl: string;
  private defaultHeaders: Record<string, string>;

  constructor(context?: ApiClientContext) {
    this.baseUrl = (context?.businessConfig?.apiBaseUrl || "").replace(/\/$/, "");
    this.defaultHeaders = {
      ...(context?.businessConfig?.apiHeaders || {}),
      ...(context?.currentUser?.id ? { "x-ksbm-user-id": context.currentUser.id } : {}),
      ...(context?.currentUser?.email ? { "x-ksbm-user-email": context.currentUser.email } : {}),
      ...(context?.currentUser?.role ? { "x-ksbm-user-role": context.currentUser.role } : {}),
    };
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...this.defaultHeaders,
        ...(init?.headers || {}),
      },
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.error || data?.message || `Request failed (${response.status})`);
    }
    return data as T;
  }

  // Initial Dashboard & Catalog Feeds
  getProducts(): Promise<Product[]> {
    return this.request<Product[]>("/api/products");
  }

  getSchedules(): Promise<Schedule[]> {
    return this.request<Schedule[]>("/api/schedules");
  }

  getTemplates(): Promise<Template[]> {
    return this.request<Template[]>("/api/templates");
  }

  getLogs(): Promise<AuditLog[]> {
    return this.request<AuditLog[]>("/api/logs");
  }

  getNotifications(): Promise<Notification[]> {
    return this.request<Notification[]>("/api/notifications");
  }

  getSettings(): Promise<Settings> {
    return this.request<Settings>("/api/settings");
  }

  getFolders(): Promise<Folder[]> {
    return this.request<Folder[]>("/api/folders");
  }

  getAssets(): Promise<Asset[]> {
    return this.request<Asset[]>("/api/assets");
  }

  getTokenUsage(): Promise<TokenUsageLog[]> {
    return this.request<TokenUsageLog[]>("/api/token-usage");
  }

  // Products & Campaigns
  uploadProduct(payload: { name: string; imageUrl: string; category: string; mediaType?: "image" | "video" }) {
    return this.request<{ success: boolean; product: Product }>("/api/products/upload", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  uploadAutomatedCampaign(payload: {
    imageUrl: string;
    category: string;
    mediaType: "image" | "video";
    date: string;
    time: string;
    platform: "Facebook" | "Instagram" | "Both";
    extraNotes?: string;
  }) {
    return this.request<{ success: boolean; product: Product }>("/api/products/upload-automated", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  uploadManualCreative(payload: Record<string, unknown>, signal?: AbortSignal) {
    return this.request<{ success: boolean; product?: Product }>("/api/products/upload-manual", {
      method: "POST",
      signal,
      body: JSON.stringify(payload),
    });
  }

  updateProduct(productId: string, updates: Partial<Product>) {
    return this.request<{ success: boolean }>(`/api/products/${productId}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    });
  }

  deleteProduct(productId: string) {
    return this.request<{ success: boolean }>(`/api/products/${productId}`, {
      method: "DELETE",
    });
  }

  processProductNow(productId: string) {
    return this.request<{ success: boolean }>(`/api/products/${productId}/process-now`, {
      method: "POST",
    });
  }

  stopProductProduction(productId: string) {
    return this.request<{ success: boolean; error?: string }>(`/api/products/${productId}/stop`, {
      method: "POST",
    });
  }

  approveAutomation(productId: string) {
    return this.request<{ success: boolean }>(`/api/products/${productId}/approve-automation`, {
      method: "POST",
    });
  }

  runDailyBatchNow() {
    return this.request<{ success: boolean; processedCount?: number; message?: string }>("/api/queue/run-batch", {
      method: "POST",
    });
  }

  // AI Engines
  recognizeProduct(productId: string) {
    return this.request<{ success: boolean; quotaExceeded?: boolean; simulated?: boolean; result: Partial<Product>; error?: string }>(
      `/api/products/${productId}/recognize`,
      { method: "POST" }
    );
  }

  generateCaptions(productId: string, options: { force?: boolean; type?: string } = {}) {
    return this.request<{
      success: boolean;
      quotaExceeded?: boolean;
      simulated?: boolean;
      cached?: boolean;
      captions: GeneratedCaption[];
      error?: string;
    }>(`/api/products/${productId}/generate-captions`, {
      method: "POST",
      body: JSON.stringify(options),
    });
  }

  updateCaption(productId: string, captionId: string, content: string) {
    return this.request<{ success: boolean }>(`/api/products/${productId}/captions/${captionId}`, {
      method: "PUT",
      body: JSON.stringify({ content }),
    });
  }

  generateHashtags(productId: string, count: number, force = false) {
    return this.request<{
      success: boolean;
      quotaExceeded?: boolean;
      simulated?: boolean;
      cached?: boolean;
      hashtags: string[];
      error?: string;
    }>(`/api/products/${productId}/generate-hashtags`, {
      method: "POST",
      body: JSON.stringify({ count, force }),
    });
  }

  enhanceBackground(
    productId: string,
    payload: {
      themeName: string;
      customPrompt?: string;
      placement?: "left" | "center" | "right";
      scale?: number;
      facebookOptimize?: boolean;
    }
  ) {
    return this.request<{ success: boolean; quotaExceeded?: boolean; enhancedUrl: string; error?: string }>(
      `/api/products/${productId}/enhance-background`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    );
  }

  // Publishing & Schedules
  publishNow(postData: { productId: string; platform: string; caption: string; hashtags: string[]; imageUrl: string }) {
    return this.request<{ success: boolean }>("/api/posts/publish-now", {
      method: "POST",
      body: JSON.stringify(postData),
    });
  }

  createSchedule(schedData: { productId: string; date: string; time: string; platform: "Facebook" | "Instagram" | "Both" }) {
    return this.request<{ success: boolean; schedule: Schedule }>("/api/schedules", {
      method: "POST",
      body: JSON.stringify(schedData),
    });
  }

  deleteSchedule(scheduleId: string) {
    return this.request<{ success: boolean }>(`/api/schedules/${scheduleId}`, {
      method: "DELETE",
    });
  }

  // Templates
  createTemplate(payload: { type: "content" | "hashtag"; title: string; content: string; alwaysUseAutomated?: boolean }) {
    return this.request<{ success: boolean; template: Template }>("/api/templates", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  updateTemplate(templateId: string, updates: Partial<Template>) {
    return this.request<{ success: boolean }>(`/api/templates/${templateId}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    });
  }

  deleteTemplate(templateId: string) {
    return this.request<{ success: boolean }>(`/api/templates/${templateId}`, {
      method: "DELETE",
    });
  }

  // Media Assets Vault
  createFolder(payload: { name: string; description: string }) {
    return this.request<{ success: boolean; folder: Folder }>("/api/folders", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  updateFolder(folderId: string, payload: { name: string; description: string }) {
    return this.request<{ success: boolean }>(`/api/folders/${folderId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  }

  deleteFolder(folderId: string) {
    return this.request<{ success: boolean }>(`/api/folders/${folderId}`, {
      method: "DELETE",
    });
  }

  createAsset(payload: {
    folderId: string;
    name: string;
    imageUrl: string;
    mediaType: "image" | "video";
    description: string;
  }) {
    return this.request<{ success: boolean; asset: Asset }>("/api/assets", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  updateAsset(assetId: string, payload: { name: string; folderId: string; description: string }) {
    return this.request<{ success: boolean }>(`/api/assets/${assetId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  }

  deleteAsset(assetId: string) {
    return this.request<{ success: boolean }>(`/api/assets/${assetId}`, {
      method: "DELETE",
    });
  }

  // Settings & Logs
  updateSettings(updates: Partial<Settings>) {
    return this.request<{ success: boolean; settings: Settings }>("/api/settings", {
      method: "POST",
      body: JSON.stringify(updates),
    });
  }

  testGemini(apiKey: string) {
    return this.request<{ success: boolean; message?: string; error?: string }>("/api/settings/test-gemini", {
      method: "POST",
      body: JSON.stringify({ apiKey }),
    });
  }

  testFacebook(fbData: { fbAppId: string; fbPageId: string; fbAccessToken: string }) {
    return this.request<{ accountName: string; tokenStatus: string }>("/api/settings/test-facebook", {
      method: "POST",
      body: JSON.stringify(fbData),
    });
  }

  testInstagram(igData: { igAccountId: string; igAccessToken: string }) {
    return this.request<{ username: string; followersCount: number }>("/api/settings/test-instagram", {
      method: "POST",
      body: JSON.stringify(igData),
    });
  }

  clearLogs() {
    return this.request<{ success: boolean }>("/api/logs/clear", { method: "POST" });
  }

  clearTokenLogs() {
    return this.request<{ success: boolean }>("/api/token-usage/clear", { method: "POST" });
  }
}
