export interface KSBMUser {
  id: string;
  name: string;
  email?: string;
  role: "admin" | "manager" | "staff" | "viewer" | string;
  /**
   * Granular KSBM permission keys or flags.
   * If omitted, permissions are derived from `role`.
   */
  permissions?: string[] | Record<string, boolean>;
}

export interface KSMBBusinessConfig {
  storeName?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  openingHours?: string;
  storeDescription?: string;
  socialHandle?: string;
  defaultCTA?: string;
  defaultSignature?: string;
  /**
   * Optional API base URL when KSBM proxies or hosts the StoreSocial backend
   * on a separate origin/prefix (defaults to "" for same-origin `/api/*`).
   */
  apiBaseUrl?: string;
  /**
   * Optional auth/tenant headers forwarded with module API requests.
   */
  apiHeaders?: Record<string, string>;
}

export interface ModulePermissions {
  canView: boolean;
  canUpload: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canApprove: boolean;
  canPublish: boolean;
  canManageAssets: boolean;
  canManageSettings: boolean;
}

export interface ModuleDashboardMetrics {
  scheduledTodayCount: number;
  awaitingApprovalCount: number;
  unprocessedAssetsCount: number;
  queuedBatchCount: number;
  publishedCount: number;
  totalProductsCount: number;
}

export type ModuleViewId = "dashboard" | "upload" | "assets" | "calendar" | "settings";

export interface ModuleEntryProps {
  currentUser: KSBMUser;
  businessConfig: KSMBBusinessConfig;
  initialView?: ModuleViewId;
  onMetricsUpdate?: (metrics: ModuleDashboardMetrics) => void;
}

export interface Product {
  id: string;
  imageUrl: string;
  name: string;
  brand: string;
  flavor: string;
  size: string;
  category: string;
  packagingType: string;
  promotionalAppeal: string;
  colorTheme: string[];
  targetAudience: string;
  status: "Not Processed" | "Processing" | "Ready" | "Scheduled" | "Posted" | "Draft Scheduled" | "Queued";
  createdAt: string;
  mediaType?: "image" | "video";
  isFullyAutomated?: boolean;
  automatedScheduledDate?: string;
  automatedScheduledTime?: string;
  automatedPlatform?: "Facebook" | "Instagram" | "Both";
  originalImageUrl?: string;
  isManualCreative?: boolean;
  manualSettings?: Record<string, unknown>;
  quotaExceeded?: boolean;
  quotaWarningMessage?: string;
  internetSearchNotes?: string;
  internetSearchPerformed?: boolean;
  extraNotes?: string;
}

export interface GeneratedCaption {
  id: string;
  productId: string;
  platform: "Facebook" | "Instagram" | "Both";
  type: "Professional" | "Fun" | "Promotional" | "Trendy" | "Sales Focused";
  content: string;
  isSelected: boolean;
  createdAt: string;
}

export interface Template {
  id: string;
  type: "content" | "hashtag";
  title: string;
  content: string;
  colors?: string[];
  createdAt: string;
  alwaysUseAutomated?: boolean;
}

export interface Schedule {
  id: string;
  productId: string;
  date: string;
  time: string;
  platform: "Facebook" | "Instagram" | "Both";
  status: "pending" | "published" | "failed";
  createdAt: string;
  productName?: string;
  productImage?: string;
  brand?: string;
  category?: string;
}

export interface Post {
  id: string;
  productId: string;
  platform: "Facebook" | "Instagram" | "Both";
  caption: string;
  hashtags: string[];
  imageUrl: string;
  status: "draft" | "scheduled" | "published" | "failed";
  publishedAt?: string;
  scheduledAt: string;
}

export interface AIAgentConfig {
  id: string;
  name: string;
  apiKey: string;
  model: string;
  priority: number;
  enabled: boolean;
}

export interface Settings {
  storeName: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  openingHours: string;
  storeDescription: string;
  defaultCTA: string;
  defaultSignature: string;
  fbAppId: string;
  fbAppSecret: string;
  fbPageId: string;
  fbAccessToken: string;
  igAccountId: string;
  igAccessToken: string;
  geminiApiKey: string;
  geminiModel: string;
  autoCaption: boolean;
  autoHashtags: boolean;
  autoBackgroundTheme: boolean;
  approvalWorkflow: "Auto Publish" | "Manual Approval" | "Approval Queue";
  aiAgents?: AIAgentConfig[];
  disableAutoBackgroundRemoval?: boolean;
}

export interface AuditLog {
  id: string;
  userId: string;
  userEmail: string;
  action: string;
  details: string;
  timestamp: string;
}

export interface Notification {
  id: string;
  type: "success" | "info" | "warning" | "error";
  title: string;
  message: string;
  time: string;
}

export interface Folder {
  id: string;
  name: string;
  description: string;
  createdAt: string;
}

export interface Asset {
  id: string;
  folderId: string;
  name: string;
  imageUrl: string;
  mediaType: "image" | "video";
  description: string;
  createdAt: string;
}

export interface TokenUsageLog {
  id: string;
  userId: string;
  userEmail: string;
  action: string;
  agentName: string;
  modelName: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  timestamp: string;
}

export interface ToastMessage {
  id: string;
  type: "success" | "error" | "info";
  message: string;
}
