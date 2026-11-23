# IdealPOS Suite Module — KSBM Integration Specification (`MODULE_SPEC.md`)

This document is the technical blueprint for integrating the **IdealPOS Store Operations, Inventory, Ordering & Telemetry Module** (`ksbm_export/`) into **Kwik Stop Business Manager (KSBM)**.

All standalone outer shells (`App.tsx`, `main.tsx`, `index.css`), PIN lock overlays (`PinLockModal.tsx`), user/staff CRUD screens (`UserManagementSettings.tsx`), and outer store-switcher headers (`StoreSwitcherHeader.tsx`) have been stripped. The module enters through a single React component (`ModuleEntry.tsx`) driven by KSBM's `currentUser` and `businessConfig` props.

---

## 1. Module Summary & Core Features

The module connects to live **IdealPOS v10.4 MS SQL Server (`IPSTransaction`)** instances (directly or via **Cloudflare Zero Trust `cloudflared` TCP tunnels**) alongside **Firebase Firestore (`app_data` collection)** for operational overlays (expiry batches, wastage claims, supplier schedules, draft orders, aliases, and branch profiles).

### Core Workflows Supported
1. **Live POS Telemetry Dashboard (`POSDashboard`, `DashboardCustomizeStudio`, `MultiStoreDashboardComparison`, `DashboardExpiryWidget`, `DashboardOptionalWidgets`)**
   - Today's Session, Week-to-Date (WTD), and Month-to-Date (MTD) gross revenue, customer counts, average basket value, and period-over-period variance vs. last week/month.
   - Interactive hourly sales & customer trend charts, department/category revenue splits, tender breakdowns (`Cash`, `EFTPOS`, `Amex`, `Split`), customizable widget studio, and multi-branch comparison cards.
2. **Inventory, Stock Suggestions & Shelf-Life Expiry Control (`InventoryManager`, `StockSuggestionsTableView`, `StockOrderAssistantModal`, `ExpiryManagementTableView`, `ExpiryBatchManagerModal`, `AddEditExpiryModal`)**
   - Searchable product catalog (with wildcard `*`, `OR`, and numeric filter syntax), barcode camera scanner (`UniversalBarcodeScannerModal`), custom product photo upload & crop (`ImageCropModal`), product aliases, and minimum pack quantities.
   - Predictive stock reorder suggestions (`predictiveStockUtils.ts`, `stockSuggestionUtils.ts`) factoring daily velocity, safety buffers, and upcoming delivery windows.
   - Shelf-life expiry batch tracking (`Active`, `Discounted`, `Wasted`, `Cleared`), wastage logging, and supplier credit claim preparation.
3. **Smart Supplier Order Engine (`OrderEngine`)**
   - Schedule-aware order calculation by supplier (`Cut-off Day/Time` -> `Delivery Day`), comparing physical shelf count vs. IdealPOS `CurrentStock`, flagging overstocked/urgent lines, optional Gemini AI pass (`/api/orders/recommend`), Draft Order persistence, and PDF/CSV export via `jspdf`.
4. **Live Sales & Receipt Audit (`SalesHistory`)**
   - Real-time transaction lookup by receipt number, clerk, tender type, promotions applied, line-item voids, full-sale voids, manual discounts, and float entries, complete with thermal 80mm receipt viewer and print/export.
5. **Comprehensive POS & Operations Reporting (`ReportsManager`, `SalesBifurcationView`, `ClerkVariancePerformanceReport`, `ClerkPerformanceCards`, `ClerkShiftDeclarationModal`)**
   - End-of-Day / Period sales reports, Australian GST vs. GST-Free sales bifurcation (`SalesBifurcationView`), clerk cash drawer declaration & 5-tier variance flagging (`varianceUtils.ts`), and wastage/expiry credit claim summaries.
6. **IdealPOS Database Explorer (`DatabaseExplorer`)**
   - Direct inspection of live IdealPOS SQL Server schema/tables (`StockItems`, `Departments`, `Creditor`, `SaleHeader`, `SaleLine`, `CashDeclaration`, `POSPromotions`, etc.) and table sync toggles.
7. **Multi-Store, Tunnel & Operational Settings (`StoreManagementSettings`, `Settings`, `DepartmentManagementSettings`, `CloudflaredTunnelCard`, `CloudflaredLogsModal`, `CloudflareTunnelGuideModal`)**
   - Multi-branch SQL & Cloudflare `cloudflared` tunnel profiles, `.BAT` connector script generator, 5-tier cash variance thresholds, department visibility & core/general flags, supplier delivery cut-off schedules, theme selector, and regional date/time localization.
8. **AI Store Operations Chat Assistant (`AIChatAssistant`)**
   - Floating corner Q&A widget backed by Gemini + live database/sales/department/inventory lookup (`/api/assistant/chat`) with fuzzy spelling/item-code tolerance and clickable suggested prompts.

---

## 2. File Manifest (`ksbm_export/`)

All imports inside `ksbm_export/` use strictly self-contained relative paths (`./...` or `../...`).

### Root Entry, Contexts, Types & Utilities (`ksbm_export/`)

| File | Exact Role |
| :--- | :--- |
| `ModuleEntry.tsx` | Single KSBM module entry component accepting `ModuleEntryProps` (`{ currentUser, businessConfig, activeSection, onSectionChange, hideSubNav }`), normalized session builder, internal section switcher, and `fetchModuleDashboardMetrics()` KPI helper. |
| `MODULE_SPEC.md` | Complete technical blueprint for KSBM integration (this file). |
| `types.ts` | Canonical TypeScript interfaces for POS telemetry, inventory, expiry/wastage, sales receipts, reports, stores, supplier schedules, permissions, and KSBM contracts (`KSBMCurrentUser`, `KSBMBusinessConfig`, `ModuleEntryProps`, `ModuleDashboardMetrics`). |
| `ThemeContext.tsx` | Theme state provider supporting `'blue' \| 'emerald' \| 'midnight' \| 'amber' \| 'slate'` with `initialTheme` sync from KSBM `businessConfig.theme`. |
| `DateTimeContext.tsx` | Regional date/time/timezone provider with `initialSettings` sync from KSBM `businessConfig` (`timezone`, `dateFormat`, `timeFormat`). |
| `dateTimeUtils.ts` | Timezone-aware date/time formatting helpers, presets (`Australia/Brisbane` default), and hourly label formatters. |
| `expiryUtils.ts` | Expiry batch urgency classification (`expired`, `critical`, `warning`, `safe`), days-remaining calculation, and batch sorting helpers. |
| `predictiveStockUtils.ts` | Velocity & days-of-cover prediction helpers for reorder and shelf-life risk badges. |
| `productUtils.ts` | Product normalization, barcode/stock-code matching, pack-size parsing, and search helpers. |
| `schemaMap.ts` | IdealPOS table mappings (`StockItems`, `Departments`, `Creditor`, etc.) and weekday constants (`WEEKDAYS`). |
| `stockSuggestionUtils.ts` | Stock suggestion calculation utilities combining daily sales velocity, stock-on-hand, and minimum stock targets. |
| `supplierConfigUtils.ts` | Supplier schedule normalization, cut-off/delivery window formatting, and ID/code matching helpers. |
| `varianceUtils.ts` | 5-tier cash drawer variance threshold defaults (`DEFAULT_CASH_VARIANCE_CONFIG`) and `evaluateCashVariance()` evaluator. |

### Feature & UI Components (`ksbm_export/components/`)

| File | Exact Role |
| :--- | :--- |
| `AIChatAssistant.tsx` | Floating AI Store Assistant chat panel querying live SQL/inventory/department/sales endpoints via `/api/assistant/chat`. |
| `AddEditExpiryModal.tsx` | Modal to log or edit tracked shelf-life product expiry batches and quantities. |
| `ClerkPerformanceCards.tsx` | Summary scorecard grid showing clerk sales, basket size, items/txn, voids, and discounts. |
| `ClerkShiftDeclarationModal.tsx` | Detailed per-clerk shift cash declaration breakdown, drawer variance, and transaction flags modal. |
| `ClerkVariancePerformanceReport.tsx` | Full clerk cash variance & performance audit table integrated with 5-tier store variance thresholds. |
| `CloudflareTunnelGuideModal.tsx` | Interactive step-by-step Cloudflare Zero Trust setup guide & downloadable Windows `.BAT` / `config.yml` generator. |
| `CloudflaredLogsModal.tsx` | Live `cloudflared` daemon status, start/stop controls, and streaming tunnel logs modal. |
| `CloudflaredTunnelCard.tsx` | Inline tunnel health summary card rendered inside Server/Store settings. |
| `ColumnVisibilityDropdown.tsx` | Multi-column toggle dropdown for dense inventory/suggestion tables. |
| `DashboardCustomizeStudio.tsx` | Drawer/modal allowing users to toggle, reorder, and customize dashboard telemetry cards and widgets. |
| `DashboardExpiryWidget.tsx` | Dashboard alert widget summarizing critical/expiring-soon shelf-life batches. |
| `DashboardOptionalWidgets.tsx` | Configurable supplementary dashboard analytics blocks (top movers, department alerts, tender ratios). |
| `DatabaseExplorer.tsx` | Live IdealPOS SQL Server table browser, row previewer, and table sync configuration manager. |
| `DepartmentManagementSettings.tsx` | Settings view to mark departments as Core/General and toggle dashboard/report visibility. |
| `ExpiryBatchManagerModal.tsx` | Per-product modal to inspect, discount, waste, clear, or add expiry batches directly from Inventory. |
| `ExpiryManagementTableView.tsx` | Dedicated expiry management table view with bulk status resolution and supplier claim actions. |
| `ImageCropModal.tsx` | Client-side square/custom image cropper before uploading product thumbnails to `/api/product-photos`. |
| `InventoryManager.tsx` | Primary Inventory hub combining live IdealPOS stock search, inline editing, barcode scanning, Stock Suggestions tab, and Expiry tab. |
| `MultiSelectDepartmentDropdown.tsx` | Multi-select department filter dropdown used across inventory, orders, and reports. |
| `MultiStoreDashboardComparison.tsx` | Cross-branch telemetry comparison widget filtered by `currentUser.allowedStoreIds`. |
| `OrderEngine.tsx` | Schedule-driven supplier order builder with manual shelf stock entry, draft persistence, AI recommendations, and PDF export. |
| `POSDashboard.tsx` | Main POS analytics dashboard (Session/WTD/MTD tiles, hourly chart, department & tender splits, optional widgets). |
| `ReportsManager.tsx` | Multi-category reporting suite (Sales, Tax/GST Bifurcation, Clerk Cash Variance, Inventory & Wastage Credit Claims) with PDF export. |
| `SalesBifurcationView.tsx` | Detailed GST vs. GST-Free tax bifurcation breakdown view inside Reports. |
| `SalesHistory.tsx` | Live transaction/receipt explorer with void, discount, promotion, and float filters plus 80mm thermal receipt viewer. |
| `Settings.tsx` | Scoped module configuration view (`stores`, `server`, `cloudflared`, `departments`, `suppliers`, `appearance`, `regional`) — user/PIN subtabs removed. |
| `StockOrderAssistantModal.tsx` | Quick inline reorder & stock observation modal launched from inventory/suggestion rows. |
| `StockSuggestionsTableView.tsx` | Dedicated smart reorder suggestions view with velocity indicators and bulk draft-order actions. |
| `StoreManagementSettings.tsx` | Multi-branch store profile, receipt template, regional timezone, Cloudflare tunnel, SQL config, and 5-tier cash variance settings (centralized KSBM staff access note). |
| `UniversalBarcodeScannerModal.tsx` | Webcam/mobile camera barcode & QR code scanner powered by `@zxing/library`. |

---

## 3. Dependencies & Environment Variables

### 3.1 Frontend NPM Packages (Required in KSBM Shell)
Versions verified from `package.json`:

| Package | Version | Usage in `ksbm_export/` |
| :--- | :--- | :--- |
| `react` | `^19.0.1` | Core UI hooks and components |
| `react-dom` | `^19.0.1` | React DOM runtime |
| `lucide-react` | `^0.546.0` | All module iconography |
| `recharts` | `^3.10.0` | Hourly trend, department breakdown, and report charts |
| `jspdf` | `^4.2.1` | Order sheets, GST reports, and wastage claim PDF exports |
| `@zxing/library` | `^0.23.0` | Live camera barcode scanning (`UniversalBarcodeScannerModal.tsx`) |

**Styling Requirement:** KSBM must include **Tailwind CSS v4** (`tailwindcss: ^4.1.14`, `@tailwindcss/vite: ^4.1.14`) via `@import "tailwindcss";` in KSBM's global stylesheet (no duplicate CSS resets are shipped inside `ksbm_export/`).

### 3.2 Backend Express Packages (Required if KSBM Hosts/Proxies Backend Routes)
- `express` (`^4.21.2`)
- `mssql` (`^12.7.0`, dev `@types/mssql: ^12.3.0`) — MS SQL Server client for IdealPOS `IPSTransaction`
- `@google/genai` (`^2.13.0`) — Gemini AI calls for `/api/orders/recommend` and `/api/assistant/chat`
- `firebase` (`^12.16.0`) / `firebase-admin` (`^14.2.0`) — Firestore operational overlay sync
- `dotenv` (`^17.2.3`)

### 3.3 Environment Variables
Defined across `.env.example` and `server/`:
- `GEMINI_API_KEY` — **Required** on the backend for AI Store Chat Assistant (`/api/assistant/chat`) and AI Order Pass (`/api/orders/recommend`). Never expose in client bundle.
- `APP_URL` — Hosted origin URL.
- **Optional SQL Boot Overrides** (`server/db.ts`, overridden at runtime by saved store SQL configs):
  - `DB_SERVER` (or `MSSQL_HOST` / `SQL_SERVER`) — defaults to `127.0.0.1` (Cloudflare Tunnel local TCP forwarder)
  - `DB_PORT` (or `MSSQL_PORT`) — defaults to `1433` (store configs use `14333+`)
  - `DB_NAME` (or `MSSQL_DATABASE`) — defaults to `IPSTransaction`
  - `DB_USER` (or `MSSQL_USER`)
  - `DB_PASSWORD` (or `MSSQL_PASSWORD`)
  - `DB_AUTH_TYPE` — `'sql' | 'windows'`
  - `DB_DOMAIN` — Workgroup/PC domain when `DB_AUTH_TYPE=windows`
- `DISABLE_HMR` — `'true'` in AI Studio/containerized preview environments.

### 3.4 External Persistence, API Endpoints & Connectors
- **Supabase / Google Apps Script:** **None used.** (Zero Supabase tables or Google Apps Script webhook URLs are required by this module.)
- **IdealPOS MS SQL Server (`IPSTransaction` via Cloudflare `cloudflared` TCP Tunnel):**
  - Core tables queried: `StockItems`, `StockBarcodes` / alternate scan codes, `Departments`, `Creditor` (suppliers), `StockSupplier`, `SaleHeader`, `SaleLine`, `SaleTenders`, `CashDeclaration`, `Clerk`, `POSPromotions`, `PromotionGroups`, `PromotionTables`, `PromotionTableItem`.
- **Firebase Firestore (`app_data` collection via `firebase-applet-config.json` + local JSON fallback files):**
  - Documents: `stores_config`, `active_store`, `db_config`, `synced_tables`, `supplier_configs`, `draft_orders`, `product_aliases`, `photo_map`, `department_settings`, `department_visibility`, `starred_products`, `expiry_batches`, `expiry_settings`, `wastage_records`, `stock_observations`, `departments_cache`, `suppliers_cache`, and chunked `inventory_cache_meta` / `inventory_cache_chunk_*`.
- **Required Backend HTTP Routes (`/api/*`, same-origin or proxied via `businessConfig.apiBaseUrl`):**
  - **System & Tunnels:** `/api/status`, `/api/health`, `/api/settings`, `/api/settings/live-mode`, `/api/settings/clear-test-data`, `/api/cloudflared/status`, `/api/cloudflared/action`, `/api/cloudflared/logs`, `/api/tunnel/connect`, `/api/stores`, `/api/stores/switch`
  - **Telemetry & Sales:** `/api/pos/dashboard`, `/api/dashboard/multi-store`, `/api/sales/today`, `/api/pos/sales-history`
  - **Inventory & Expiry:** `/api/pos/inventory`, `/api/pos/inventory/:id`, `/api/pos/inventory/:id/details`, `/api/pos/inventory/stock-suggestions`, `/api/inventory/stock-observations`, `/api/pos/departments`, `/api/pos/department-settings`, `/api/department-visibility`, `/api/product-aliases`, `/api/product-pack-sizes`, `/api/product-photos`, `/api/starred-products`, `/api/barcode-lookup`, `/api/expiry/batches`, `/api/expiry/batches/bulk`, `/api/expiry/:id/resolve`, `/api/expiry/:id`, `/api/expiry-settings`, `/api/wastage`
  - **Ordering & Reports:** `/api/suppliers`, `/api/suppliers/configured`, `/api/supplier-configs`, `/api/draft-orders`, `/api/orders/recommend`, `/api/pos/reports`, `/api/pos/reports/filters-data`, `/api/cash-declarations`, `/api/clerks`
  - **Database & AI:** `/api/tables`, `/api/table/:tableName`, `/api/synced-tables`, `/api/assistant/chat`, `/api/assistant/suggestions`

---

## 4. Props & Permissions Mapping

### 4.1 Entry Component Props (`ModuleEntryProps`)
```tsx
import ModuleEntry, { fetchModuleDashboardMetrics } from './ksbm_export/ModuleEntry';

<ModuleEntry
  currentUser={ksbmUser}          // Required: KSBMCurrentUser
  businessConfig={ksbmStoreConfig} // Required: KSBMBusinessConfig
  activeSection="dashboard"        // Optional controlled section: NavigationTab
  onSectionChange={(tab) => ...}   // Optional callback when internal tab changes
  hideSubNav={false}               // Set true if KSBM renders its own sub-tabs
/>
```

### 4.2 Granular Staff Permissions Mapping (`currentUser`)
KSBM injects `currentUser: KSBMCurrentUser` (`id`, `name`, `role`, `allowedTabs`, `allowedSettings`, `allowedStoreIds`, `permissions`, `department`).

| Workflow / Action | Permission / Property Gating | Recommended KSBM Role Defaults |
| :--- | :--- | :--- |
| **Access Dashboard / Sales History** | `'dashboard'` / `'sales'` in `allowedTabs` | All store roles (`admin`, `manager`, `supervisor`, `cashier`, `stock_clerk`, `staff`) |
| **View Revenue, Profit & Clerk Variance** | `permissions.canViewFinancialRevenue` & `'reports'` in `allowedTabs` | `admin`, `manager`, `supervisor` |
| **View Supplier Cost Prices & Margins** | `permissions.canViewCostPrices` | `admin`, `manager`, `stock_clerk` |
| **Edit Stock Levels, Min Stock, Aliases, Photos, Expiry** | `permissions.canEditInventory` & `'inventory'` in `allowedTabs` | `admin`, `manager`, `supervisor`, `stock_clerk` |
| **Generate / Save / Approve Supplier Orders** | `permissions.canCreateOrders` & `'orders'` in `allowedTabs` | `admin`, `manager`, `stock_clerk` |
| **View Raw IdealPOS SQL Tables** | `'explorer'` in `allowedTabs` & `features.enableDatabaseExplorer !== false` | `admin`, `manager` |
| **Manage Multi-Store, SQL & Cloudflare Tunnels** | `'stores'` in `allowedTabs`, `'stores'` / `'server'` / `'cloudflared'` in `allowedSettings`, `role === 'admin'` for Add/Delete Store | `admin` (view/switch for `manager`) |
| **Multi-Branch Visibility Scope** | `allowedStoreIds` (`['all']` or array of permitted branch IDs) | Enforced in `MultiStoreDashboardComparison` & KSBM branch switcher |
| **Department & Supplier Schedule Config** | `'departments'`, `'suppliers'` in `allowedSettings` | `admin`, `manager` |
| **Local Theme & Date/Time Preferences** | `'appearance'`, `'regional'` in `allowedSettings` | All authenticated users (or locked by `businessConfig`) |

*Note:* `permissions.canManageUsers` is unused inside this module because staff onboarding, PIN management, and role assignment are handled exclusively by the KSBM Master Shell.

### 4.3 Store Settings Mapping to KSBM Master Admin `businessConfig`
Map the following centralized store-level fields from KSBM Master Admin into `KSBMBusinessConfig` (`businessConfig`):

| `businessConfig` Field | Source / Effect in Module |
| :--- | :--- |
| `storeId`, `storeName`, `storeCode` | Identifies the currently selected branch for status headers and store management pre-selection. |
| `abn`, `address`, `phone`, `email` | Canonical store legal identity (for thermal receipt defaults & claim exports when store profile overrides are unset). |
| `timezone`, `dateFormat`, `timeFormat` | Hydrates `DateTimeProvider` (`initialSettings`) so every dashboard chart, sales timestamp, and expiry countdown matches KSBM's regional clock. |
| `theme` (`AppTheme`) | Hydrates `ThemeProvider` (`initialTheme`) to keep palette consistent with KSBM shell preferences. |
| `apiBaseUrl` | Optional base URL prefix for KSBM gateways proxying `/api/*`. |
| `cashVarianceThresholds` | Optional centralized 5-tier cash drawer variance tolerance policy (`DEFAULT_CASH_VARIANCE_CONFIG` fallback). |
| `features.enableAIChatAssistant` | Feature toggle (`boolean`, default `true`) controlling visibility of the floating `AIChatAssistant`. |
| `features.enableDatabaseExplorer` | Feature toggle (`boolean`, default `true`) gating access to `DatabaseExplorer`. |
| `features.enableMultiStoreComparison` | Feature toggle (`boolean`, default `true`) for cross-branch comparison widgets. |

---

## 5. Dashboard Summary Metrics (for KSBM Home Screen)

`ModuleEntry.tsx` exports `fetchModuleDashboardMetrics(apiBaseUrl?: string): Promise<ModuleDashboardMetrics>` so the main KSBM Dashboard Home screen can display **3 live operational KPI/Alert tiles** without mounting the full module:

1. **Today's POS Gross Sales & Customer Count**
   - **Fields:** `todaySalesGross` (`number`, AUD) & `todayTransactions` (`number`)
   - **Endpoint:** `GET /api/pos/dashboard` (`sessionSales ?? todaySales`, `sessionCustomers ?? customerCount`)
   - **Home Card Example:** `"Live POS Sales Today: $X,XXX.XX · N txns"`
2. **Shelf-Life Expiry Alert Counter**
   - **Fields:** `expiringSoonCount` (`<= 7 days`, active batches) & `expiredBatchesCount` (`< 0 days`, active batches)
   - **Endpoint:** `GET /api/expiry/batches`
   - **Home Card Example:** `"Expiry Watch: N Expired · M Expiring ≤ 7d"` (deep-links to `activeSection="inventory"`)
3. **IdealPOS SQL / Tunnel Connectivity Status**
   - **Field:** `sqlConnected` (`boolean`)
   - **Endpoint:** `GET /api/status` (`connected`)
   - **Home Card Example:** `"IdealPOS Link: Live SQL Connected"` vs `"Offline / Cached Mode"`
