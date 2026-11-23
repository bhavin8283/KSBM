import { KSBM_PERMISSION_KEYS } from "../constants";
import { KSBMUser, ModuleDashboardMetrics, ModulePermissions, Product, Schedule } from "../types";

export function sanitizeHashtagContent(content: string): string {
  const trimmed = content.trim();
  if (!trimmed) return "";

  if (!trimmed.includes("#")) {
    return "#" + trimmed.replace(/\s+/g, "");
  }

  const parts = trimmed.split("#");
  const sanitizedParts = parts.map((part, index) => {
    if (index === 0) {
      return part.trim();
    }
    return part.replace(/\s+/g, "");
  });

  const hashtagParts = sanitizedParts.slice(1).filter((p) => p.length > 0);
  const formatted = hashtagParts.map((p) => `#${p}`).join(" ");

  const prefix = sanitizedParts[0] ? sanitizedParts[0] + " " : "";
  return (prefix + formatted).trim();
}

export function isVideoMedia(url?: string, mediaType?: "image" | "video"): boolean {
  if (mediaType === "video") return true;
  if (!url) return false;
  return url.startsWith("data:video/") || /\.(mp4|mov|webm)$/i.test(url);
}

export function getBgImageUrl(style: string): string {
  const styleLower = style.toLowerCase();
  if (styleLower.includes("studio")) {
    return "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80";
  } else if (styleLower.includes("outdoor")) {
    return "https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=800&auto=format&fit=crop&q=80";
  } else if (styleLower.includes("nature")) {
    return "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&auto=format&fit=crop&q=80";
  } else if (styleLower.includes("luxury")) {
    return "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&auto=format&fit=crop&q=80";
  } else if (styleLower.includes("splash")) {
    return "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=800&auto=format&fit=crop&q=80";
  } else if (styleLower.includes("ice")) {
    return "https://images.unsplash.com/photo-1482862549707-f63cb32c5fd9?w=800&auto=format&fit=crop&q=80";
  } else if (styleLower.includes("fire")) {
    return "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=800&auto=format&fit=crop&q=80";
  } else if (styleLower.includes("neon")) {
    return "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&auto=format&fit=crop&q=80";
  } else if (styleLower.includes("tropical")) {
    return "https://images.unsplash.com/photo-1506929562872-bb421503ef21?w=800&auto=format&fit=crop&q=80";
  } else if (styleLower.includes("christmas")) {
    return "https://images.unsplash.com/photo-1544816155-12df9643f363?w=800&auto=format&fit=crop&q=80";
  } else if (styleLower.includes("halloween")) {
    return "https://images.unsplash.com/photo-1508349694737-61c0ec9b8d2b?w=800&auto=format&fit=crop&q=80";
  } else if (styleLower.includes("sports")) {
    return "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=800&auto=format&fit=crop&q=80";
  } else if (styleLower.includes("caf")) {
    return "https://images.unsplash.com/photo-1498804103079-a6351b050096?w=800&auto=format&fit=crop&q=80";
  } else if (styleLower.includes("vintage")) {
    return "https://images.unsplash.com/photo-1506084868230-bb9d95c24759?w=800&auto=format&fit=crop&q=80";
  }
  return "https://images.unsplash.com/photo-1513151233558-d860c5398176?w=800&auto=format&fit=crop&q=80";
}

export function getComputedBgStyle(manualBgStyle: string, manualFlavor: string, manualName: string): string {
  if (manualBgStyle !== "Auto") return manualBgStyle;
  const flavorLower = (manualFlavor || "").toLowerCase();
  const nameLower = (manualName || "").toLowerCase();
  if (flavorLower.includes("orange") || flavorLower.includes("citrus") || flavorLower.includes("lemon")) return "Splash";
  if (flavorLower.includes("chocolate") || flavorLower.includes("cocoa") || flavorLower.includes("fudge")) return "Luxury";
  if (nameLower.includes("water") || flavorLower.includes("glacier") || flavorLower.includes("mint")) return "Ice";
  if (flavorLower.includes("coffee") || nameLower.includes("latte") || nameLower.includes("brew")) return "Café";
  if (nameLower.includes("energy") || flavorLower.includes("neon") || flavorLower.includes("bolt")) return "Neon";
  if (flavorLower.includes("sport") || nameLower.includes("gym") || nameLower.includes("fit")) return "Sports";
  if (flavorLower.includes("sweet") || nameLower.includes("candy") || flavorLower.includes("berry")) return "Tropical";
  return "Realistic Studio";
}

export function computeDashboardMetrics(products: Product[], schedules: Schedule[]): ModuleDashboardMetrics {
  const todayStr = new Date().toISOString().split("T")[0];
  return {
    scheduledTodayCount: schedules.filter((s) => s.date === todayStr && s.status === "pending").length,
    awaitingApprovalCount: products.filter((p) => p.status === "Draft Scheduled").length,
    unprocessedAssetsCount: products.filter((p) => p.status === "Processing" || p.status === "Not Processed").length,
    queuedBatchCount: products.filter((p) => p.status === "Queued" || (p.status === "Not Processed" && p.isFullyAutomated)).length,
    publishedCount: products.filter((p) => p.status === "Posted").length,
    totalProductsCount: products.length,
  };
}

export function resolveModulePermissions(user?: KSBMUser | null): ModulePermissions {
  if (!user) {
    return {
      canView: true,
      canUpload: false,
      canEdit: false,
      canDelete: false,
      canApprove: false,
      canPublish: false,
      canManageAssets: false,
      canManageSettings: false,
    };
  }

  const perms = user.permissions;
  const hasExplicitPerm = (key: string): boolean | undefined => {
    if (!perms) return undefined;
    if (Array.isArray(perms)) return perms.includes("*") || perms.includes(key);
    if ("*" in perms) return !!perms["*"];
    return key in perms ? !!perms[key] : undefined;
  };

  const roleLower = (user.role || "").toLowerCase();
  const isAdmin = roleLower.includes("admin") || roleLower.includes("owner");
  const isManager = isAdmin || roleLower.includes("manager") || roleLower.includes("supervisor");
  const isStaff = isManager || roleLower.includes("staff") || roleLower.includes("clerk") || roleLower.includes("cashier");

  return {
    canView: hasExplicitPerm(KSBM_PERMISSION_KEYS.VIEW) ?? true,
    canUpload: hasExplicitPerm(KSBM_PERMISSION_KEYS.UPLOAD) ?? isStaff,
    canEdit: hasExplicitPerm(KSBM_PERMISSION_KEYS.EDIT) ?? isStaff,
    canDelete: hasExplicitPerm(KSBM_PERMISSION_KEYS.DELETE) ?? isManager,
    canApprove: hasExplicitPerm(KSBM_PERMISSION_KEYS.APPROVE) ?? isManager,
    canPublish: hasExplicitPerm(KSBM_PERMISSION_KEYS.PUBLISH) ?? isManager,
    canManageAssets: hasExplicitPerm(KSBM_PERMISSION_KEYS.MANAGE_ASSETS) ?? isStaff,
    canManageSettings: hasExplicitPerm(KSBM_PERMISSION_KEYS.MANAGE_SETTINGS) ?? isAdmin,
  };
}

export function deriveSocialHandle(storeName?: string, explicitHandle?: string): string {
  if (explicitHandle && explicitHandle.trim()) {
    return explicitHandle.trim().replace(/^@/, "");
  }
  const base = (storeName || "kwikstop").toLowerCase().replace(/[^a-z0-9]/g, "");
  return base || "kwikstop";
}
