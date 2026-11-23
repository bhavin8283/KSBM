# StoreSocial AI Module — KSBM Integration Specification (`MODULE_SPEC.md`)

This document is the technical blueprint for embedding the **StoreSocial AI** social media automation and product marketing module (`ksbm_export/`) inside **Kwik Stop Business Manager (KSBM)**.

---

## 1. Module Summary & Core Features

**StoreSocial AI** is a convenience-store social media creative studio, AI copywriting engine, and automated publishing manager built for Facebook and Instagram promotions. Inside KSBM, it operates as a self-contained module with standalone authentication, outer shell navigation, and user management stripped out so KSBM's Master Shell controls PIN sign-in, permissions, and workspace chrome.

### Core Capabilities & Workflows
1. **Overview (`DashboardView`)**
   - Live KPI cards: Total Catalog Assets, Ready/Drafts, Scheduled Today, and Published Posts.
   - Quick-navigation triggers into Product Studio (`upload`) and Publish Queue (`calendar`).
   - Tabbed telemetry feed for **Audit Logs** (all product/AI/publish actions) and **AI Token Usage Logs** (provider, model, prompt/completion/total token breakdown), plus admin log clearing and manual refresh.
   - Recent system notifications feed.

2. **Product Studio — Automated & Manual Pipelines (`UploadGalleryView`)**
   - **Bulk Automated Queue & Nightly 9:00 PM Batch Workflow**:
     - Staff can bulk-upload product photos/videos (`JPEG`, `PNG`, `MP4`, `MOV`) via drag-and-drop, file picker, or folder picker without blocking on synchronous AI processing.
     - Per-thumbnail queue controls allow assigning target **Scheduled Date**, **Scheduled Time**, **Platform (`Facebook` | `Instagram` | `Both`)**, **Category**, and **Extra Notes**.
     - **Deferred Nightly Batch (`9:00 PM` server cron + manual trigger)**: Scans up to **2 queued items per batch** to recognize brand/flavor/packaging via vision AI, style a custom backdrop matching the product flavor/color profile, generate localized Facebook/Instagram captions with emojis & hashtags, and save the campaign as `"Draft Scheduled"` (**Ready to Approve**).
     - **Human-in-the-Loop Approval**: Once a manager/approver clicks **Approve**, the campaign transitions to `"Scheduled"` at the pre-selected date and time.
   - **Manual Studio Mode**:
     - Fine-grained creative workspace for configuring custom tone (`Fun`, `Professional`, `Promotional`, `Trendy`, `Sales Focused`), flavor/size/brand specs, web enrichment context, hashtag counts, custom background prompts, hero placement (`left` / `center` / `right`), hero scale, and safe-area aspect presets (`1:1`, `4:5`, `9:16` Feeds, Stories, Reels).
     - Interactive multi-caption selection & inline editing, direct backdrop regeneration, WYSIWYG social feed preview with dynamic store name & social handle (`deriveSocialHandle`), one-click **Publish Now**, or **Schedule Post**.
   - **In-Flight Job Controls**: Supports triggering immediate single-item AI processing (`process-now`), cancelling in-flight production (`stop`), editing specs, or two-step delete confirmation.

3. **Media Assets Vault (`AssetsView`)**
   - Organized folder library for reusable store/product photography and short videos (`Folder` + `Asset` CRUD).
   - Drag-and-drop or file-picker upload into folders, inline asset metadata editing, folder reassignment, and one-click **Import to Product Studio** (`onImportToStudio`) that stages the vault asset directly as a Studio campaign item.

4. **Publish Queue Calendar (`CalendarView`)**
   - **Day / Week / Month** schedule views displaying upcoming and published promotional posts.
   - Inline rescheduling (date + time shift) and schedule cancellation gated by KSBM permissions.

5. **Templates, AI Engines & Integrations (`SettingsView`)**
   - **Store Profile**: Populated dynamically from KSBM `businessConfig` with module-level fallback/overrides (Store Name, Address, Phone, Email, Website, Opening Hours, Description, Default CTA, Default Signature).
   - **Social & AI APIs**: Meta Graph credentials (`fbAppId`, `fbAppSecret`, `fbPageId`, `fbAccessToken`, `igAccountId`, `igAccessToken`), Gemini API key + model selection, multi-provider AI Failover Priority Chain (`aiAgents`), and live connection test buttons.
   - **Templates Library**: Reusable **Content Templates** and **Hashtag Templates** (with auto-sanitized `#tag` formatting and optional `alwaysUseAutomated` flag for the automated pipeline).
   - **Automation Rules**: Toggles for Auto Vision/Caption/Hashtags/Backgrounds, background removal bypass (`disableAutoBackgroundRemoval`), and Approval Workflow mode (`Auto Publish` | `Manual Approval` | `Approval Queue`).
   - *Note: The legacy standalone `"security"` password-change sub-tab has been stripped because KSBM handles staff PIN/password management centrally.*

---

## 2. File Manifest (`ksbm_export/`)

| File Path | Role |
|---|---|
| `ksbm_export/ModuleEntry.tsx` | Primary drop-in entry component accepting `{ currentUser, businessConfig, initialView?, onMetricsUpdate? }`. Enforces `canView`, renders internal module view tabs, scoped toast stack, and delegates to the 5 feature views (zero outer shell/login chrome). |
| `ksbm_export/index.ts` | Public barrel export exposing `ModuleEntry` (named + default), `useStoreSocialModule`, `StoreSocialApiClient`, utility helpers, constants, and TypeScript interfaces. |
| `ksbm_export/types.ts` | Complete TypeScript domain types (`Product`, `GeneratedCaption`, `Template`, `Schedule`, `Post`, `AIAgentConfig`, `Settings`, `AuditLog`, `Notification`, `Folder`, `Asset`, `TokenUsageLog`, `ToastMessage`) plus KSBM host contract types (`KSBMUser`, `KSMBBusinessConfig`, `ModulePermissions`, `ModuleDashboardMetrics`, `ModuleViewId`, `ModuleEntryProps`). |
| `ksbm_export/constants.ts` | Shared constants: `PRODUCT_CATEGORIES`, `CAPTION_TONES`, `BACKGROUND_STYLES`, `SAFE_AREA_MODES`, `KSBM_PERMISSION_KEYS`, and `MODULE_VIEWS`. |
| `ksbm_export/services/storeSocialApi.ts` | Typed HTTP client (`StoreSocialApiClient`) wrapping every `/api/*` endpoint. Supports `businessConfig.apiBaseUrl`, custom `businessConfig.apiHeaders`, and automatically attaches `x-ksbm-user-id`, `x-ksbm-user-email`, and `x-ksbm-user-role` headers. |
| `ksbm_export/hooks/useStoreSocialModule.ts` | Core state, data fetching, `businessConfig` -> `Settings` merging, permission resolution (`resolveModulePermissions`), live KPI computation (`computeDashboardMetrics` -> `onMetricsUpdate`), toast management, and action handlers for all module operations. |
| `ksbm_export/utils/mediaUtils.ts` | Pure helpers: `sanitizeHashtagContent`, `isVideoMedia`, `getBgImageUrl`, `getComputedBgStyle`, `computeDashboardMetrics`, `resolveModulePermissions`, and `deriveSocialHandle`. |
| `ksbm_export/components/DashboardView.tsx` | Overview KPI cards, quick actions, system notifications, and Audit / Token Usage log tables. |
| `ksbm_export/components/UploadGalleryView.tsx` | Product Studio workspace supporting Automated Bulk Upload + 9 PM Queue, Manual Creative Studio, AI Vision/Caption/Hashtag/Backdrop workflows, safe-area WYSIWYG social previews, Publish Now, and Scheduling. |
| `ksbm_export/components/AssetsView.tsx` | Media Vault folder & asset browser with drag-and-drop upload, metadata editor, inline delete confirmations, and Studio import. |
| `ksbm_export/components/CalendarView.tsx` | Day/Week/Month promotional post calendar with permission-gated rescheduling and queue removal. |
| `ksbm_export/components/SettingsView.tsx` | Module configuration UI (Business Profile, Social/AI API integrations, Content/Hashtag Templates, Automation Rules; login/security tab removed). |
| `ksbm_export/MODULE_SPEC.md` | This integration specification document. |

---

## 3. Dependencies & Environment Variables

### 3.1 Frontend Dependencies (used directly by `ksbm_export/`)
Versions below match root `package.json`:

| Package | Version (`package.json`) | Purpose |
|---|---|---|
| `react` | `^19.0.1` | Core UI runtime (React 19 hooks & portals via `react-dom`) |
| `react-dom` | `^19.0.1` | `createPortal` for full-screen modal previews in `UploadGalleryView` |
| `lucide-react` | `^0.546.0` | Iconography across all views & module navigation |
| `motion` | `^12.23.24` | `motion/react` animations (`AnimatePresence`) in `AssetsView` |
| `tailwindcss` / `@tailwindcss/vite` | `^4.1.14` | Utility styling inside KSBM's Tailwind v4 host CSS |

> **Styling Note**: No duplicate global CSS reset is included in `ksbm_export/`. Ensure KSBM's global stylesheet includes Tailwind CSS v4 (`@import "tailwindcss";`) and dark canvas styling (`bg-slate-950` / `text-slate-200`). Two optional utility classes used in views (`.animate-fade-in` and `.animate-scale-up`) can be added to KSBM's host CSS if not already defined.

### 3.2 Companion Backend Dependencies (required by host/backend API routes)
If KSBM mounts this module's Express routes (from root `server.ts` / `src/db.ts`), the backend server uses:

| Package | Version (`package.json`) | Purpose |
|---|---|---|
| `@google/genai` | `^2.4.0` | Gemini Vision recognition, caption/hashtag generation, backdrop generation |
| `express` | `^4.21.2` | REST API routing (`/api/products/*`, `/api/assets/*`, `/api/schedules/*`, `/api/settings/*`, `/api/queue/*`) |
| `dotenv` | `^17.2.3` | Environment variable loading |
| `sharp` | `^0.35.2` | Image resizing, safe-area framing, hero compositing |
| `jimp` | `^1.6.1` | Image bitmap fallback transformations |
| `tsx` / `typescript` | `^4.21.0` / `~5.8.2` | Server & TypeScript execution |

### 3.3 Environment Variables, Webhooks & Persistence
From `.env.example`:
- `GEMINI_API_KEY` *(Required server-side)* — Primary Google Gemini API key for product recognition, caption copywriting, hashtag generation, and backdrop/creative generation.
- `APP_URL` *(Optional / Host runtime)* — Public base URL where the host service is deployed.

**Webhooks, Supabase Tables & Google Apps Script URLs**:
- **Webhooks**: None required out-of-the-box. Background automation uses an internal server timer (`9:00 PM` daily batch processor, max 2 queued products/night) and manual endpoint `POST /api/queue/run-batch`.
- **Supabase Tables**: None required in the current architecture. The standalone backend persists data in a local JSON store (`data/db.json` via `src/db.ts`) with collections: `products`, `captions`, `templates`, `schedules`, `posts`, `settings`, `auditLogs`, `notifications`, `folders`, `assets`, `tokenUsage`. *(If KSBM standardizes persistence on Supabase/Postgres later, map those 11 collections 1:1 to tables keyed by store/tenant ID.)*
- **Google Apps Script URLs**: None used.
- **Meta Graph API Note**: Credentials (`fbAppId`, `fbAppSecret`, `fbPageId`, `fbAccessToken`, `igAccountId`, `igAccessToken`) are persisted in `Settings`. Currently, `/api/settings/test-facebook`, `/api/settings/test-instagram`, and `/api/posts/publish-now` validate tokens locally / record `Post` state for safe staging; swap in live `graph.facebook.com` API calls in your backend controller when moving to live store Meta accounts.
- **Optional Multi-Agent AI Failover Keys**: Stored per-store in `Settings.aiAgents` (`OpenRouter`, `Groq`, `OpenAI`, `Anthropic`, `DeepSeek`) for automatic fallback if Gemini rate-limits.

### 3.4 Required Backend API Endpoints (Consumed by `StoreSocialApiClient`)
Ensure the host backend exposes or proxies these JSON routes under `businessConfig.apiBaseUrl || ""`:
- **Catalog & Telemetry**: `GET /api/products`, `GET /api/schedules`, `GET /api/templates`, `GET /api/logs`, `POST /api/logs/clear`, `GET /api/notifications`, `GET /api/token-usage`, `POST /api/token-usage/clear`
- **Products & Automated Batch**: `POST /api/products/upload`, `POST /api/products/upload-automated`, `POST /api/products/upload-manual`, `PUT /api/products/:id`, `DELETE /api/products/:id`, `POST /api/products/:id/process-now`, `POST /api/products/:id/stop`, `POST /api/products/:id/approve-automation`, `POST /api/queue/run-batch`
- **AI Studio Engines**: `POST /api/products/:id/recognize`, `POST /api/products/:id/generate-captions`, `PUT /api/products/:id/captions/:captionId` *(caption inline edit)*, `POST /api/products/:id/generate-hashtags`, `POST /api/products/:id/enhance-background`
- **Vault & Publishing**: `GET/POST /api/folders`, `PUT/DELETE /api/folders/:id`, `GET/POST /api/assets`, `PUT/DELETE /api/assets/:id`, `POST /api/posts/publish-now`, `POST /api/schedules`, `DELETE /api/schedules/:id`
- **Settings**: `GET/POST /api/settings`, `POST /api/settings/test-gemini`, `POST /api/settings/test-facebook`, `POST /api/settings/test-instagram`

*(Legacy auth endpoints `/api/auth/login` and `/api/auth/update-password` are intentionally unused by `ksbm_export/`.)*

---

## 4. Props & Permissions Mapping

### 4.1 `ModuleEntry` Props Contract
```tsx
import { ModuleEntry, KSBMUser, KSMBBusinessConfig, ModuleDashboardMetrics } from "./ksbm_export";

<ModuleEntry
  currentUser={ksbmUser}           // Active PIN-authenticated KSBM staff member
  businessConfig={ksbmBusinessConfig} // Central store profile & API routing config
  initialView="dashboard"          // Optional: "dashboard" | "upload" | "assets" | "calendar" | "settings"
  onMetricsUpdate={(metrics) => {  // Optional callback syncing live KPIs to KSBM Dashboard Home
    // metrics: ModuleDashboardMetrics
  }}
/>
```

### 4.2 Granular Staff Permissions (`currentUser.permissions` / `role`)
`resolveModulePermissions(currentUser)` supports either explicit KSBM permission keys (string array `string[]` or boolean map `Record<string, boolean>`, including wildcard `"*"`) or role-based fallback (`admin`/`owner`, `manager`/`supervisor`, `staff`/`clerk`/`cashier`, `viewer`).

| Permission Key (`KSBM_PERMISSION_KEYS`) | Fallback Roles | Gated Actions in Module |
|---|---|---|
| `social.view` (`canView`) | All authenticated roles | Viewing Dashboard Overview, Catalog Cards, Vault Folders, Publish Queue Calendar, Settings (read-only if lacking manage perm) |
| `social.upload` (`canUpload`) | `staff`, `manager`, `admin` | Bulk uploading photos/videos, creating Manual/Automated campaigns, importing Media Vault assets into Product Studio |
| `social.edit` (`canEdit`) | `staff`, `manager`, `admin` | Running AI Vision / Caption / Hashtag / Backdrop generation, editing product specs & captions, triggering `process-now` / nightly batch, creating or rescheduling Calendar posts |
| `social.delete` (`canDelete`) | `manager`, `admin` | Deleting queued/draft/ready product campaigns, cancelling scheduled posts on Calendar |
| `social.approve` (`canApprove`) | `manager`, `admin` | Approving AI-generated `"Draft Scheduled"` campaigns into active `"Scheduled"` posts |
| `social.publish` (`canPublish`) | `manager`, `admin` | Executing immediate **Publish Now** pushes to Facebook / Instagram |
| `social.assets.manage` (`canManageAssets`) | `staff`, `manager`, `admin` | Creating, renaming, organizing, uploading to, or deleting folders & files in Media Vault |
| `social.settings.manage` (`canManageSettings`) | `admin` | Saving Store Profile / Automation Rules / API Keys, running API test checks, creating/editing/deleting Templates, clearing Audit & Token logs |

### 4.3 `businessConfig` (Master Admin Settings) vs. Module Settings
KSBM Master Admin owns multi-module store identity & network context via `businessConfig`, while StoreSocial AI retains channel-specific marketing tokens locally in `Settings`:

| Field | Owner | Behavior in Module |
|---|---|---|
| `storeName`, `address`, `phone`, `email`, `website`, `openingHours`, `storeDescription` | **KSBM Master Admin (`businessConfig`)** | Automatically overlays & synchronizes into module `Settings` on load and save (`mergeBusinessConfigWithSettings`) |
| `socialHandle` | **KSBM Master Admin (`businessConfig`)** | Drives `@handle` branding inside Instagram/Facebook WYSIWYG previews (`deriveSocialHandle`) |
| `defaultCTA`, `defaultSignature` | **KSBM Master Admin or Module** | Default call-to-action & caption footer signature |
| `apiBaseUrl`, `apiHeaders` | **KSBM Master Shell (`businessConfig`)** | Routes `StoreSocialApiClient` fetch calls to tenant/proxy backend with auth headers |
| `fbAppId`, `fbAppSecret`, `fbPageId`, `fbAccessToken`, `igAccountId`, `igAccessToken` | **Module Settings (`Settings`)** | Meta channel credentials configured under `Templates & Integrations` |
| `geminiApiKey`, `geminiModel`, `aiAgents`, `autoCaption`, `autoHashtags`, `autoBackgroundTheme`, `approvalWorkflow`, `disableAutoBackgroundRemoval` | **Module Settings (`Settings`)** | Module-specific AI provider failover, prompt/image preferences, and approval mode |

---

## 5. Dashboard Summary Metrics (for KSBM Dashboard Home)

`useStoreSocialModule` automatically computes `ModuleDashboardMetrics` via `computeDashboardMetrics(products, schedules)` and pushes updates to KSBM via `onMetricsUpdate(metrics)` whenever catalog or schedule state refreshes.

KSBM Dashboard Home should highlight these **3 primary live KPIs / Alert Badges**:

1. **Pending Approvals (`awaitingApprovalCount`)** — *Action Alert KPI*
   - **Definition**: Count of products with `status === "Draft Scheduled"` (AI 9:00 PM batch has finished scanning specs, writing captions, and styling visuals; awaiting human approval).
   - **KSBM Home Display**: Amber alert badge (`N Ready to Approve`) clicking straight into `initialView="upload"` for manager sign-off.
2. **Scheduled Today (`scheduledTodayCount`)** — *Daily Operations KPI*
   - **Definition**: Count of pending `Schedule` entries matching today's ISO date (`YYYY-MM-DD`) with `status === "pending"`.
   - **KSBM Home Display**: Emerald/Indigo summary tile (`N Posts Today`) clicking into `initialView="calendar"`.
3. **Queued / Processing Assets (`queuedBatchCount` / `unprocessedAssetsCount`)** — *Pipeline Queue KPI*
   - **Definition**: `queuedBatchCount` tracks bulk-uploaded automated items awaiting the 9:00 PM AI worker (`status === "Queued"` or automated `"Not Processed"`); `unprocessedAssetsCount` covers all `"Processing"` + `"Not Processed"` items.
   - **KSBM Home Display**: Slate/Indigo queue indicator (`N Queued for 9 PM AI` or warning badge if backlog > 0), linking to `initialView="upload"`.

*(Additional secondary metrics exposed on the same object for optional reporting: `publishedCount` and `totalProductsCount`.)*
