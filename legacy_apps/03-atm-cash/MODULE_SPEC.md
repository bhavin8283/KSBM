# Kwik Stop ATM Cash Tracker — KSBM Module Specification

Self-contained feature module packaged for integration inside **Kwik Stop Business Manager (KSBM)**. Standalone PIN authentication, staff/role management, PWA shell files, and outer app navigation have been stripped so KSBM's Master Shell controls authentication, permissions, routing, and store configuration centrally.

---

## 1. Module Summary & Core Features

Tracks Australian Dollar (**AUD**) **$20** and **$50** physical cassette cash for a retail ATM, maintaining an auditable ledger, blind physical cycle counts, cash runway forecasting, and optional Google Sheets + Google Drive backup sync.

### Supported User Workflows
1. **Overview Dashboard (`DashboardView`)**
   - Displays **Expected Total Cash (AUD)**, **$20 Notes** count/value, and **$50 Notes** count/value.
   - Computes **Cash Runway Forecast** (`avgDailyWithdrawal` & `daysRemaining`) from the last 14 days of EOD withdrawals.
   - Displays a **Low Cash Alert Banner** whenever total cash or either denomination drops below configurable thresholds.
   - Shows the **Last Verified Cycle Count** status (`Matched` or `Discrepancy`), Quick Action triggers, Recent Activity feed (last 5 entries), 1-click WhatsApp/SMS text summary copy, and manual Cloud Pull.
2. **Cash Replenishment (`FeedCashView`)**
   - Logs incoming **$20** and **$50** notes with quick `+10 / +25 / +50 / +100` buttons, editable date/time, bank slip reference, and live AUD subtotal calculation.
   - Increments expected cassette inventory and triggers auto-sync if configured.
3. **Daily EOD Withdrawal (`DailyWithdrawalView`)**
   - **Mode A (By Note Count — Recommended):** Exact $20 and $50 dispensed counts from the ATM EOD settlement receipt.
   - **Mode B (By Total $ Amount):** Validates AUD $20/$50 dispensability (`>= $20`, divisible by `$10`, excludes `$30`) and estimates optimal note split against current cassette inventory.
   - **Duplicate EOD Date Guard:** Flags when a withdrawal already exists for the selected settlement date and requires explicit confirmation for multi-batch days.
4. **Blind Physical Cycle Count & Reconciliation (`CycleCountView`)**
   - **Blind Audit Mode:** Expected cassette balance remains hidden until physical Main Cassette (`$20`, `$50`) and Reject Bin (`$20`, `$50`) counts are submitted.
   - Reveals a line-by-line comparison table (**Expected vs. Physical vs. Variance**).
   - If variance exists, highlights exact note/dollar discrepancy, lists all Feed and Withdrawal movements since the prior cycle count for investigation, and provides a supervisor **Adjust Expected Balance to Physical Count** flow with mandatory reason note (and optional 4-digit PIN re-verification if passed by KSBM).
5. **History, Search, Export & Restore (`HistoryView`)**
   - Filterable ledger (`All`, `Feeds`, `EOD`, `Audits`), free-text search (staff, ID, reference), and date-range filters.
   - Exports filtered ledger to **CSV**, exports full module snapshot to **JSON**, and supports local JSON restore with pre-commit preview.
6. **Module Sync & Threshold Config (`ModuleConfigView`)**
   - Manages Low Cash Alert Thresholds (`minTotalCash`, `minNotes20`, `minNotes50`) when not overridden by `businessConfig`.
   - Manages Google Apps Script Webhook URL, target Google Sheet URL/ID, auto-sync/auto-pull toggles, connection testing, `Sync All History`, `Pull Latest`, `Preview Drive Restore`, collapsible `Code.gs` template, sample data seeding, and ledger reset.

---

## 2. File Manifest (`ksbm_export/`)

| File Path | Role |
| :--- | :--- |
| `ksbm_export/ModuleEntry.tsx` | Single KSBM drop-in entry component accepting `{ currentUser, businessConfig, initialTab, onSummaryChange }`; owns sub-tab routing, state persistence, webhook sync orchestration, and toast notifications. Also exports `getATMDashboardSummary` and `computeATMDashboardSummary`. |
| `ksbm_export/types.ts` | Self-contained TypeScript definitions for `KSBMUser`, `KSBMBusinessConfig`, `KSBMPermissions`, `ATMDashboardSummary`, transactions (`FeedTransaction`, `WithdrawalTransaction`, `CycleCountTransaction`, `AdjustmentTransaction`), `ATMModuleState`, and `ModuleTabId`. |
| `ksbm_export/utils/denominations.ts` | AUD $20/$50 math helpers (`calculateCashTotal`, `validateWithdrawalAmount`, `estimateNoteBreakdown`, `formatCurrencyAUD`, `formatVarianceNoteText`). |
| `ksbm_export/utils/storage.ts` | Role/permission resolution (`resolveModulePermissions`, `canAccessModuleTab`), namespaced `localStorage` persistence (`loadATMModuleState`, `saveATMModuleState`, `mergeBusinessConfig`), backup parser (`parseBackupJson`), runway estimator, `ATMDashboardSummary` calculators, CSV/JSON exporters, and AU date formatters. |
| `ksbm_export/utils/webhook.ts` | Client for Google Apps Script Web App (`syncTransactionToWebhook`, `syncAllHistoryToWebhook`, `testWebhookConnection`, `fetchLatestBackupFromWebhook`, `extractSpreadsheetId`, and `GOOGLE_APPS_SCRIPT_TEMPLATE`). |
| `ksbm_export/components/DashboardView.tsx` | Live KPI cards ($ total, $20s, $50s), cash runway indicator, Low Cash Alert banner, Last Verified Cycle Count status, Quick Actions, and Recent Activity feed. |
| `ksbm_export/components/FeedCashView.tsx` | Cash replenishment entry form with denomination quick-increments and live subtotal banner. |
| `ksbm_export/components/DailyWithdrawalView.tsx` | EOD withdrawal entry form supporting Note Count mode, Total $ mode, duplicate date guard, and over-balance warning. |
| `ksbm_export/components/CycleCountView.tsx` | Blind physical audit form, post-submit comparison table, investigation log, and supervisor balance adjustment workflow. |
| `ksbm_export/components/HistoryView.tsx` | Searchable/filterable transaction ledger with CSV export, JSON backup download, JSON restore preview, and copy-summary actions. |
| `ksbm_export/components/ModuleConfigView.tsx` | Low cash limits, Google Sheets/Drive webhook sync controls, Apps Script `Code.gs` viewer, JSON backup/restore, sample data, and ledger reset (staff/PIN/PWA UI excluded). |
| `ksbm_export/MODULE_SPEC.md` | This integration blueprint. |

---

## 3. Dependencies & Environment Variables

### NPM Packages Required in KSBM Host
Versions verified from root `package.json`:

| Package | Version | Purpose |
| :--- | :--- | :--- |
| `react` | `^19.0.1` | React UI runtime (also compatible with React 18/19 hosts) |
| `react-dom` | `^19.0.1` | DOM rendering |
| `lucide-react` | `^0.546.0` | UI icons |
| `tailwindcss` | `^4.3.3` | Utility styling (expects Tailwind CSS host styles; zero CSS resets included inside `ksbm_export/`) |
| `typescript` | `^7.0.2` | TypeScript compilation |

### Environment Variables, Storage & External Endpoints
- **`.env` keys required:** **None.** The module runs 100% client-side with zero Gemini API calls or server secrets.
- **Browser Persistence (`localStorage`):**
  - Default key: `kwik_stop_atm_tracker_v1`
  - Multi-store namespaced key (when `businessConfig.storageNamespace` is provided): `kwik_stop_atm_tracker_v1_<sanitized_namespace>`
  - Stores `{ inventory, transactions, settings }`. No staff PINs are persisted by the module.
- **Google Apps Script Webhook (Optional Cloud Sheets & Drive Sync):**
  - Configured via `businessConfig.googleSync.webhookUrl` or **Sync & Limits** UI (`https://script.google.com/macros/s/.../exec`).
  - Optional target `spreadsheetId` (full Sheets URL or ID) ensures writes target an exact Google Sheet (`ATM_Ledger` and `Current_Balance` tabs) and snapshots JSON files into the `Kwik Stop ATM Backups` Google Drive folder (`kwik-stop-atm-latest.json` + daily snapshots).
  - Deploy Apps Script as Web App (`Execute as: Me`, `Who has access: Anyone`). Template is exported as `GOOGLE_APPS_SCRIPT_TEMPLATE` in `utils/webhook.ts`.

---

## 4. Props & Permissions Mapping

### `ModuleEntry` Props Contract
```ts
import ModuleEntry, {
  KSBMUser,
  KSBMBusinessConfig,
  ATMDashboardSummary,
  ModuleTabId,
} from './ksbm_export/ModuleEntry';

<ModuleEntry
  currentUser={currentUser}
  businessConfig={businessConfig}
  initialTab="dashboard"
  onSummaryChange={(summary) => setAtmSummary(summary)}
/>
```

### Granular Permission Gating (`KSBMPermissions`)
`resolveModulePermissions(currentUser)` applies default presets by `currentUser.role` (`'master' | 'manager' | 'staff'`) and merges any explicit overrides from `currentUser.permissions`:

| Permission Key | Master Default | Manager Default | Staff Default | Actions Controlled in Module |
| :--- | :---: | :---: | :---: | :--- |
| `viewDashboard` | `true` | `true` | `true` | View **Overview** tab, expected balances, cash runway, Low Cash Alert, and last 5 movements. |
| `feedCash` | `true` | `true` | `false` | Access **Feed Cash** tab and `+ Feed ATM` quick-action buttons. |
| `recordWithdrawal` | `true` | `true` | `false` | Access **Daily Withdrawal** tab and `- Withdrawal` quick-action buttons. |
| `runCycleCount` | `true` | `true` | `false` | Access **Cycle Count** tab and perform blind physical cassette/reject-bin audits. |
| `approveAdjustment` | `true` | `true` | `false` | Authorise **Adjust Expected Balance to Physical Count** on discrepant cycle counts (also validates `currentUser.pin` if KSBM supplies a 4-digit PIN). |
| `viewHistory` | `true` | `true` | `false` | Access **History** tab, filters, search, and `View All` dashboard link. |
| `exportData` | `true` | `true` | `false` | Download **CSV** ledger exports and **Backup JSON** snapshots inside History. |
| `manageModuleSettings` | `true` | `false` | `false` | Access **Sync & Limits** tab, edit thresholds/webhook URL, load sample data, reset ledger, and restore JSON backups. |

> **Actor Attribution Rule:** Only `role === 'master'` can select another staff name from `businessConfig.staffMembers` when logging entries or adjustments; `'manager'` and `'staff'` entries are locked to `currentUser.name`.

### Master Admin `businessConfig` Mapping
Settings belonging in KSBM's centralized **Master Admin `businessConfig`** (passed into `<ModuleEntry businessConfig={...} />`):
- **`businessConfig.staffMembers` (`string[]`)**: Centralized active staff directory managed by KSBM (replaces standalone Staff/PIN CRUD).
- **`businessConfig.atmThresholds` (`{ minTotalCash, minNotes20, minNotes50 }`)**: Store-level low cash alert thresholds (defaults: `$2,000`, `30`×`$20`, `30`×`$50`). When provided by `businessConfig`, module UI locks those inputs as centrally managed.
- **`businessConfig.googleSync` (`{ webhookUrl, spreadsheetId, autoSyncEnabled, autoPullOnOpen }`)**: Centralized Google Apps Script Web App endpoint and Google Sheet ID. When `webhookUrl` is provided by `businessConfig`, endpoint fields are locked in the module config view.
- **`businessConfig.storageNamespace` (`string`)**: Optional store identifier for isolating `localStorage` keys across multiple convenience store locations inside KSBM.

---

## 5. Dashboard Summary Metrics (KSBM Home Integration)

The module exposes a live `ATMDashboardSummary` payload both reactively via `onSummaryChange` prop and imperatively via `getATMDashboardSummary(businessConfig)`:

```ts
export interface ATMDashboardSummary {
  expectedTotalAUD: number;        // e.g. 2090 ($ AUD expected in safe)
  expectedNotes20: number;         // e.g. 27 ($20 note count)
  expectedNotes50: number;         // e.g. 31 ($50 note count)
  isLowCash: boolean;              // true if total or either note count < threshold
  lowCashReasons: string[];        // e.g. ["$20s (27) < 30 min"]
  avgDailyWithdrawalAUD: number;   // 14-day EOD dispensing average
  estimatedRunwayDays: number | null; // e.g. 2.1 (days until empty) or null
  lastCycleCountStatus: 'matched' | 'discrepancy' | 'none';
  lastCycleCountVarianceAUD: number | null; // 0, negative short, or positive over
  lastCycleCountAt: string | null; // ISO-8601 timestamp of latest audit
}
```

### Recommended 3 KPIs/Alerts for KSBM Master Dashboard Home
1. **Expected ATM Cash & Runway KPI:** `expectedTotalAUD` formatted as AUD (`$2,090`), paired with `estimatedRunwayDays` (`~2.1d left`) and denomination split (`27×$20 · 31×$50`).
2. **Low Cash Alert Flag:** Trigger amber warning tile/action link whenever `isLowCash === true`, displaying `lowCashReasons.join(' · ')`.
3. **Audit Integrity Status:** Show latest physical reconciliation state from `lastCycleCountStatus` (`Matched`, `Discrepancy: -$50`, or `No Audit Yet`) and timestamp `lastCycleCountAt`.
