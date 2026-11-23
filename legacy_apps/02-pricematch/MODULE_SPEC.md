# Kwik Stop Wholesale Intelligence — KSBM Module Integration Specification

> **Package Root:** `ksbm_export/`  
> **Primary Entry Component:** `ModuleEntry` (`./ModuleEntry.tsx`, also re-exported via `./index.ts`)  
> **Target Host Shell:** **Kwik Stop Business Manager (KSBM)**  
> **Shell Isolation Status:** Standalone PIN lock screen (`PINLockScreen.tsx`, `utils/auth.ts`), outer application navbar (`App.tsx` `<header>`), and legacy Python modal (`PythonCodeModal.tsx`) have been stripped. KSBM centrally handles staff login, session timeouts, permissions, and outer shell navigation.

---

## 1. Module Summary & Core Features

The **Wholesale Intelligence** module is a multi-distributor wholesale cost comparison, POS retail margin calculator, and master SKU catalog system tailored for convenience stores (primarily Cigarettes, Roll-Your-Own Tobacco Pouches, and FMCG products).

### Key Capabilities & User Workflows
1. **Multi-Supplier Wholesale Price Comparison**:
   - Compares wholesale carton/outer costs side-by-side across **Trax Distribution (TRX)**, **Campbells Wholesale (CMP)**, and **One Distribution (OND)** (plus configurable custom suppliers).
   - **Cost Leader Color Semantics**: Automatically ranks supplier quotes per SKU — **Green** (`lowest`), **Blue** (`middle`), and **Red** (`highest`).
   - **Cash Spread & Percentage Detection**: Computes exact dollar savings (`highest_cost - lowest_cost`) and percentage spread per SKU, highlighting high-spread opportunities (`High Spread $2.50+` quick filter).
2. **Master Pack vs. Single-Unit Cost Breakdown**:
   - Infers or reads `master_pack_size` (e.g., `10 Packs`, `5 Pouches`, `20 Packs`) via `getPackCount()` to display per-unit wholesale cost (`$4.35 / ea`) alongside carton costs.
3. **3-Tier POS Retail Margin Calculator & Whole-Dollar Rounding**:
   - Computes **Tier 1 (Default +15%)**, **Tier 2 (Member/Volume +12%)**, and **Tier 3 (Floor +10%)** retail sell prices based conservatively on the **highest** wholesale quote so store margin stays protected regardless of distributor availability.
   - Optional per-tier **Round Figure** checkboxes apply `Math.round()` to snap retail prices to whole dollars for faster counter checkout.
4. **Dual Dashboard Views (`MainDashboard.tsx`)**:
   - **Card View (`CardView.tsx`)**: Detailed visual cards with cost rankings, spread badges, unit cost math tooltips, and retail tier cards, with optional **Group by Brand** sections.
   - **Table View (`TableView.tsx`)**: Dense sortable matrix featuring **persistent Show/Hide Columns** (`localStorage` `kwik_stop_table_columns`), bidirectional column sorting, brand grouping, and **CSV Export**.
   - **Collapsible Intelligence KPI Bar**: Toggleable summary metrics (`Active In-Store Catalog`, `Avg Wholesale Variance`, `Max Savings Spread`, `Top Cost Leader`).
5. **Camera & File Barcode Scanner (`BarcodeScannerModal.tsx`)**:
   - Uses `html5-qrcode` + Web Audio API beep synthesis to scan EAN-13, EAN-8, UPC-A, UPC-E, and Code-128 barcodes from device cameras or uploaded images to search the dashboard, filter the catalog, or populate GTIN/SKU fields when adding/editing products.
6. **Master Catalog, Brand & Theme Management (`SettingsDatabaseManager.tsx`)**:
   - **Section 1 — UI Theme Picker**: 5 persistent palettes (`slate`, `navy`, `emerald`, `warm`, `bordeaux`) synced via `ThemeProvider`.
   - **Section 2 — Markup Tiers & Live Sandbox**: Interactive sliders, numeric inputs, and rounding toggles with live `$50.00` cost simulation.
   - **Section 3 — Brand Manager**: Register custom brands, cascade-rename misspelled brands across all products (`handleRenameBrand`), and **Hide/Show** brands across the Dashboard and Catalog.
   - **Section 4 — Supplier Manager & Scraper Test Hub (`SupplierManager.tsx`, `SupplierModal.tsx`, `SupplierTestConsole.tsx`)**: Configure distributor login portals, credential `.env` vault keys, DOM CSS selectors, rate limits, and run a 6-stage terminal extraction simulation.
   - **Section 5 — Master Catalog Database Editor**: Toggle `in_store` visibility, add/edit/delete SKUs via `ProductFormModal.tsx`, and filter by barcode/brand/name.
7. **On-Demand Price Synchronization (`ManualScrapeModal.tsx`)**:
   - Simulates (or hooks into) live wholesale portal scraping across active suppliers, logging step-by-step progress and summarizing price drops vs. increases before updating catalog prices and `lastScrapedTime`.

---

## 2. File Manifest

| File Path | Role |
| :--- | :--- |
| `ksbm_export/index.ts` | Clean barrel export exposing `ModuleEntry`, `getWholesaleDashboardSummary`, `hasWholesalePermission`, pricing utilities, theme provider, and TypeScript contracts. |
| `ksbm_export/ModuleEntry.tsx` | Single plug-and-play module entry component accepting `{ currentUser, businessConfig }`; manages module state, permission evaluation, compact tab bar, and mounts `ThemeProvider`. |
| `ksbm_export/MODULE_SPEC.md` | Complete technical blueprint, manifest, dependencies, permissions matrix, and KSBM dashboard KPI spec. |
| `ksbm_export/types.ts` | Core domain types (`ProductItem`, `CalculatedProduct`, `MarkupTiers`, `SupplierConfig`, etc.) plus KSBM shell contracts (`KsbmCurrentUser`, `KsbmBusinessConfig`, `KsbmModuleProps`, `WholesalePermission`, `WholesaleDashboardSummary`). |
| `ksbm_export/theme.tsx` | Self-contained `ThemeProvider`, `THEMES` registry (5 themes), and `useTheme()` hook. |
| `ksbm_export/constants/mockData.ts` | Default seed markup tiers (`INITIAL_MARKUP_TIERS`) and sample wholesale product catalog (`INITIAL_PRODUCTS`). |
| `ksbm_export/constants/mockSuppliers.ts` | Pre-configured distributor definitions (`INITIAL_SUPPLIERS`: Trax, Campbells, One Distribution) and test simulation log/payload generators. |
| `ksbm_export/utils/pricing.ts` | Pure calculation engine: `getBrand`, `inferProductType`, `inferMasterPackSize`, `getPackCount`, `getCategory`, and `calculateProductDetails`. |
| `ksbm_export/utils/permissions.ts` | `hasWholesalePermission()` evaluator enforcing KSBM role defaults and granular `permissions[]` overrides. |
| `ksbm_export/utils/summaryMetrics.ts` | `getWholesaleDashboardSummary()` helper returning live KPIs for the KSBM Master Dashboard Home screen without mounting the full module UI. |
| `ksbm_export/components/MainDashboard.tsx` | Primary wholesale price comparison view with search, category tabs, brand multi-select, high-spread filter, view mode persistence, and intelligence metrics toggle. |
| `ksbm_export/components/CardView.tsx` | Card-based wholesale & retail comparison layout with supplier ranking badges and per-unit cost breakdowns. |
| `ksbm_export/components/TableView.tsx` | Sortable comparison table with persistent Show/Hide Columns menu (`kwik_stop_table_columns`) and permission-gated CSV export. |
| `ksbm_export/components/SettingsDatabaseManager.tsx` | 5-section Settings & Database Manager (PIN Security section stripped for KSBM), gated by granular edit/delete/brand/supplier/markup permissions. |
| `ksbm_export/components/SupplierManager.tsx` | Wholesale distributor registry and testing console launcher (gated by `canManageSuppliers`). |
| `ksbm_export/components/SupplierModal.tsx` | 4-tab modal (General & Portal, Credentials Vault, DOM Selectors, Stealth/Age-Gate Rules) for adding/editing suppliers. |
| `ksbm_export/components/SupplierTestConsole.tsx` | Live terminal-style simulation console inspecting supplier auth, extraction latency, and sample SKU JSON payloads. |
| `ksbm_export/components/ProductFormModal.tsx` | Dual-mode Add/Edit SKU modal with typeahead brand autocomplete, product type selector, pack size presets, and inline barcode scan triggers. |
| `ksbm_export/components/AddProductModal.tsx` | Lightweight wrapper around `ProductFormModal` in `'add'` mode. |
| `ksbm_export/components/BarcodeScannerModal.tsx` | `html5-qrcode` camera & image-file barcode scanner modal with camera switcher, flashlight toggle, audio feedback, and manual fallback. |
| `ksbm_export/components/ManualScrapeModal.tsx` | On-demand supplier scrape workflow modal displaying live progress logs and SKU price change diffs. |

---

## 3. Dependencies & Environment Variables

### 3.1 NPM Dependencies (Versions from Root `package.json`)
Ensure the host **KSBM** React + TypeScript + Tailwind application provides:

| Package | Version in Source `package.json` | Usage in Module |
| :--- | :--- | :--- |
| `react` | `^19.0.1` | Core React hooks & component rendering |
| `react-dom` | `^19.0.1` | React DOM runtime |
| `lucide-react` | `^0.546.0` | All UI icons across dashboard, settings, and modals |
| `html5-qrcode` | `^2.3.8` | Camera & file barcode scanning (`BarcodeScannerModal.tsx`) |
| `tailwindcss` / `@tailwindcss/vite` | `^4.1.14` | Styling utility classes (`animate-in`, flex/grid, color tokens) |

> **Optional Production Migration Package:** `@supabase/supabase-js` (when wiring live PostgreSQL data instead of browser `localStorage` fallback).

### 3.2 Browser Permissions
- **Camera (`getUserMedia`)**: Required only when staff trigger `Scan Barcode`. The KSBM host shell should ensure `Permissions-Policy` / iframe attributes allow `camera`.

### 3.3 Environment Variables & Backend Integration Keys

#### Host Shell / Frontend `.env` (for Supabase live data migration)
```env
VITE_SUPABASE_URL="https://<your-project-ref>.supabase.co"
VITE_SUPABASE_ANON_KEY="<your-supabase-anon-key>"
```
*(Alternatively, pass `supabaseUrl` and `supabaseAnonKey` into `ModuleEntry` via `businessConfig`.)*

#### Server-Side Scraper Worker `.env` (Never expose in browser bundle)
Configured via `SupplierConfig.credentials` environment key names:
```env
# Supabase Admin Ingestion
SUPABASE_URL="https://<your-project-ref>.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"

# Trax Distribution Portal
TRAX_PORTAL_USER="..."
TRAX_PORTAL_PASS="..."

# Campbells Wholesale Portal
CAMPBELLS_PORTAL_USER="..."
CAMPBELLS_PORTAL_PASS="..."

# One Distribution Portal
ONE_DIST_CLIENT_USER="..."
ONE_DIST_CLIENT_PASS="..."
ONE_DIST_SECURITY_PIN="..."
```

### 3.4 Required Supabase Database Tables (For Production Migration)
Currently the module persists state client-side in `localStorage` (`kwik_stop_products`, `kwik_stop_suppliers`, `kwik_stop_tiers`, `kwik_stop_custom_brands`, `kwik_stop_hidden_brands`, `kwik_stop_theme`, `kwik_stop_last_scraped`, `kwik_stop_show_intelligence`, `kwik_stop_table_columns`, `kwik_stop_dashboard_view_mode`).

When connecting to KSBM's shared Supabase backend, provision these module tables (auth/PIN tables like `store_terminals` remain owned by KSBM Master Shell):
1. `public.master_products` (`id`, `gtin`, `product_name`, `brand`, `product_type`, `master_pack_size`, `retail_code`, `in_store`, `is_hidden`, `created_at`, `updated_at`)
2. `public.suppliers` (`id`, `name`, `code_prefix`, `portal_url`, `login_url`, `status`, `engine`, `schedule`, `selectors`, `special_handling`)
3. `public.supplier_product_codes` (`id`, `product_id`, `supplier_id`, `supplier_sku`)
4. `public.wholesale_quotes` (`id`, `product_id`, `supplier_id`, `scraped_price`, `is_in_stock`, `scraped_at`)
5. `public.store_settings` (`store_id`, `tier1_percent`, `tier2_percent`, `tier3_percent`, `round_tier1`, `round_tier2`, `round_tier3`, `hidden_brands`)

> **Google Apps Script / Webhooks:** None required natively by this module. If KSBM hosts a scheduled scrape webhook endpoint, wire `ManualScrapeModal.tsx` (`startScrape`) to `POST` to that endpoint instead of simulating portal latency.

---

## 4. Props & Permissions Mapping

### 4.1 Entry Component Signature
```tsx
import { ModuleEntry } from './ksbm_export';

<ModuleEntry
  currentUser={{
    id: 'staff_01',
    name: 'Sam Patel',
    role: 'manager',
    permissions: ['wholesale.view', 'wholesale.scrape', 'wholesale.catalog.edit', 'wholesale.export'],
  }}
  businessConfig={{
    storeId: 'kwik_stop_main',
    storeName: 'Kwik Stop #1 - Melbourne',
    currencySymbol: '$',
    defaultThemeId: 'slate',
    defaultMarkupTiers: { tier1: 15, tier2: 12, tier3: 10, round_tier1: false },
    highSpreadAlertThreshold: 2.5,
  }}
/>
```

### 4.2 Granular Staff Permissions (`WholesalePermission`)
Evaluated by `utils/permissions.ts` (`hasWholesalePermission`). Roles `master_admin`, `admin`, `owner`, and `super_admin` automatically receive all permissions. Explicit `currentUser.permissions` overrides role defaults (supports `'*'` and `'wholesale.*'`).

| Permission Key | Gated UI Actions & Workflows | `master_admin` / `admin` | `manager` / `supervisor` | `staff` / `cashier` |
| :--- | :--- | :---: | :---: | :---: |
| `wholesale.view` | Access Price Match Dashboard, Card/Table views, barcode search, and view supplier costs (shows Access Restricted gate if false). | Yes | Yes | Yes |
| `wholesale.export` | **"Export CSV"** button in `TableView.tsx`. | Yes | Yes | Yes |
| `wholesale.scrape` | **"Manual Scrape"** header button, **"Scrape Prices"** dashboard quick button, **"Scrape Latest Prices"** settings button, and `ManualScrapeModal`. | Yes | Yes | No |
| `wholesale.catalog.edit` | Toggle `In-Store` checkbox, click row / **"Edit"** (`ProductFormModal`), **"Add New Item"**, and save catalog changes. | Yes | Yes | No |
| `wholesale.catalog.delete` | Trash delete icon on catalog rows and **"Reset Defaults"** catalog action. | Yes | No | No |
| `wholesale.markups.edit` | Adjust Tier 1/2/3 markup sliders/inputs, toggle **"Round figure"**, and **"Apply & Save Markup Settings"**. | Yes | Yes | No |
| `wholesale.brands.manage` | Add new brands, inline rename/merge brands, **Hide/Show** brand checkboxes, and delete empty brands. | Yes | Yes | No |
| `wholesale.suppliers.manage` | **"Add New Supplier"**, **"Configure"** (`SupplierModal`), delete custom supplier, and **"Reset Default 3 Suppliers"**. *(Test console remains runnable read-only for diagnostics).* | Yes | No | No |

### 4.3 Master Admin `businessConfig` Ownership
These settings should live in KSBM's central **Master Admin Configuration** and flow down via `businessConfig`:
- `storeId` & `storeName`: Identifies the active store branch for multi-store isolation and header context badges.
- `currencySymbol`: Store-wide currency prefix (defaults to `'$'`).
- `defaultThemeId`: Initial color palette (`'slate' | 'navy' | 'emerald' | 'warm' | 'bordeaux'`) when a terminal has no local override.
- `defaultMarkupTiers`: Store-level baseline POS margin tiers (`tier1`, `tier2`, `tier3`, `round_tier1..3`) merged on first initialization.
- `highSpreadAlertThreshold`: Dollar threshold (default `2.50`) defining what triggers high-spread savings alerts on both this module and KSBM Dashboard Home.
- `supabaseUrl` & `supabaseAnonKey`: Shared database client credentials injected from KSBM environment configuration.

---

## 5. Dashboard Summary Metrics

KSBM's main **Dashboard Home** screen can import `getWholesaleDashboardSummary()` directly from `ksbm_export` without mounting the full module UI:

```ts
import { getWholesaleDashboardSummary } from './ksbm_export';

const wholesaleKpis = getWholesaleDashboardSummary({
  highSpreadThreshold: businessConfig.highSpreadAlertThreshold ?? 2.5,
});
```

### Exposed KPIs & Alerts (`WholesaleDashboardSummary`)
1. **Active Tracked SKUs & Average Wholesale Spread**:
   - `activeCatalogCount` / `totalCatalogCount` (e.g. `22 of 24 items`) & `averageSpread` (e.g. `$1.94 avg spread / item`).
   - Gives store owners an immediate pulse on how much price dispersion exists across wholesalers today.
2. **Peak Savings Opportunity & Top Cost Leader**:
   - `maxSavingsOpportunity`: `{ amount, productName, cheapestSupplier }` — surfaces the single biggest dollar-saving item and which distributor has the lowest quote (e.g. `Save $4.50/ctn on WINFIELD BLUE 20s via Trax`).
   - `topCostLeader`: `{ supplierName, bestQuoteCount }` — highlights which supplier currently wins the most lowest-cost quotes.
3. **High-Spread Margin Alerts & Scrape Freshness**:
   - `highSpreadAlertCount`: Count of active in-store SKUs whose wholesale spread meets or exceeds `highSpreadAlertThreshold` (default `$2.50+`), ready to render as an alert badge linking straight into the module.
   - `lastScrapedTime`: Timestamp string of the most recent supplier price synchronization.
