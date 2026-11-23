# Kwik Temp — Food Safety Temperature Logger (`ksbm_export`)

**Module Slug:** `food-safety-temp-logger`  
**Target Host Shell:** Kwik Stop Business Manager (KSBM)  
**Compliance Standard:** Australian Food Safety Standard 3.2.2

---

## 1. Module Summary & Core Features

**Kwik Temp** is a food safety cold-chain and hot-holding temperature compliance module designed for retail stores, delis, commercial kitchens, and food-service venues. It replaces paper temperature clipboards with live manual temperature logging, automated Jaalee Bluetooth/Wi-Fi IoT sensor telemetry syncing, threshold excursion alerting, and audit-ready regulatory reporting.

### Supported User Workflows
1. **Safety Dashboard & Quick Temperature Logging (`DashboardTab.tsx`):**
   - Dual-zone overview separating **Manual Equipment Registers** (operator-logged units) and **Jaalee Bluetooth Wireless Sensors** (automated IoT telemetry units).
   - Live status badges per appliance (`Safe`, `Needs Check`, `Out of Zone` excursion alerts, battery level, last check timestamp).
   - Interactive **Unit Inspection Modal** featuring:
     - Manual temperature submission (`°C`) stamped automatically with `currentUser.name` and timestamp.
     - Interactive Recharts `AreaChart` temperature history across `hour`, `day`, `week`, and `month` windows.
     - Scrollable chronological audit log per unit.
   - Manual & hourly automatic **Jaalee Bluetooth Cloud Sync**.
2. **Equipment Directory & Threshold Configuration (`EquipmentTab.tsx`):**
   - Create, inline-edit, and delete manual food-storage units (`Fridge`, `Freezer`, `Hot Box`, `Ambient Box`, `Other`).
   - Smart Australian Food Safety default temperature limits per equipment type (e.g., Fridge `1°C–5°C`, Freezer `-25°C to -15°C`, Hot Box `60°C–80°C`).
   - Dual-threshold configuration: **Safe Zone Limits** (regulatory compliance) and **Alert Notification Limits** (custom early-warning triggers).
   - Auto-enrolled Jaalee IoT hardware display (MAC address, battery percentage, editable thresholds).
3. **Regulatory Audit Reports & Exports (`ReportTab.tsx`):**
   - Multi-select equipment appliance filter dropdown (`All Units` or specific units) + date range presets (`Today`, `Yesterday`, `This Week`, `Last Week`, `This Month`, `Last Month`, `Custom Date Range`).
   - Explicit **"Compile Official Audit Report"** workflow generating:
     - Compliance summary KPIs (`Total Records`, `Failed Log Readings`, `Audit Compliance Rate %`).
     - Printable A4 Compliance Ledger preview.
     - **CSV Excel** export download.
     - **PDF** generation and download via `jspdf`.
     - **Print Report** (`window.print()` with `.no-print` support).
     - **Email Audit Dispatch** to council inspectors using configured SMTP settings.
4. **Module Settings, Alerts & Backup Portability (`SettingsTab.tsx`):**
   - **Temperature Log Reminder Checkpoints** (e.g., `10:00`, `14:00`, `18:00`) evaluated against `currentUser.dailyShifts` to trigger overdue compliance banners, synthesized Web Audio tones, and browser desktop notifications.
   - **Jaalee Cloud Sync Link** (verification code request, token login, `demo@jaalee.com` sandbox support, hourly auto-sync toggle, earliest-history resync).
   - **SMTP Audit Email Configuration** (Gmail/Yahoo/Zoho/Custom presets, connection handshake test, persistent SMTP credentials).
   - **Archive Back-Date Synchronization** (permission-gated historical slot recovery tool).
   - **Module JSON Backup & Restore** (export/import equipment, temperature records, reminder checkpoints, and SMTP settings) + **Module Data Purge/Demo Reset**.

---

## 2. File Manifest

| File Path | Role & Responsibility |
| :--- | :--- |
| `ksbm_export/ModuleEntry.tsx` | Single self-contained entry component accepting `{ currentUser, businessConfig, onSummaryUpdate }`. Manages module state, `localStorage` persistence, overdue checkpoint/breach banners, Jaalee background sync, and internal sub-view routing. |
| `ksbm_export/types.ts` | All TypeScript interfaces for KSBM integration (`KsbmCurrentUser`, `KsbmBusinessConfig`, `KsbmPermissions`, `ModuleDashboardSummary`, `ModuleEntryProps`) and module domain entities (`Equipment`, `TempRecord`, `JaaleeConfig`, `AppNotification`, `SmtpConfig`, `DayShift`). |
| `ksbm_export/constants.ts` | Centralized `STORAGE_KEYS`, `DEFAULT_THRESHOLDS`, `DEFAULT_REMINDER_TIMES`, `DEFAULT_NOTIFICATION_OPTIONS`, `INITIAL_EQUIPMENTS`, and `generateInitialRecords` demo seed helper. |
| `ksbm_export/utils/compliance.ts` | Pure business-logic utilities: `resolvePermissions`, `getAlertThresholds`, `isTempOutOfZone`, `parseJaaleeTimestamp`, `getShiftStatus`, `getOverdueCheckpoints`, `playAlertTone`, and `computeDashboardSummary`. |
| `ksbm_export/services/jaaleeService.ts` | Frontend API client for `/api/jaalee/code`, `/api/jaalee/login`, `/api/jaalee/devices-all`, `/api/jaalee/historical`, and batch `syncAllJaaleeTelemetry`. |
| `ksbm_export/components/DashboardTab.tsx` | Equipment register cards, Jaalee IoT cards, manual temperature entry modal, Recharts temperature history chart, and cloud sync trigger. |
| `ksbm_export/components/EquipmentTab.tsx` | Equipment directory CRUD (manual units), safe/alert threshold editors, and Jaalee sensor listing. |
| `ksbm_export/components/ReportTab.tsx` | Audit report filter bar, compliance ledger preview, CSV export, `jsPDF` A4 PDF generator, print trigger, and SMTP inspector email form. |
| `ksbm_export/components/SettingsTab.tsx` | Module-only configuration: reminder checkpoints, notification channels, Jaalee IoT link, SMTP relay config, back-date archival sync, JSON backup/restore, and module data reset. |
| `ksbm_export/MODULE_SPEC.md` | Technical integration blueprint for KSBM engineers. |

---

## 3. Dependencies & Environment Variables

### NPM Packages Required in KSBM Host (`package.json`)
| Package | Version in Source | Usage |
| :--- | :--- | :--- |
| `react` | `^19.0.1` | Core UI runtime |
| `react-dom` | `^19.0.1` | DOM rendering |
| `lucide-react` | `^0.546.0` | Module iconography |
| `recharts` | `^3.8.1` | Interactive temperature history `AreaChart` |
| `jspdf` | `^4.2.1` | Client-side A4 compliance PDF generation |

*(Styling relies on host **Tailwind CSS v4** (`tailwindcss: ^4.1.14` / `@tailwindcss/vite: ^4.1.14`). Ensure the host global CSS includes `@media print { .no-print { display: none !important; } }` for clean browser printing of `ReportTab`.)*

### Environment Variables & Backend Proxy Endpoints
- **Environment Variables:** None required directly inside `ksbm_export/` client files. (Host `.env.example` contains `GEMINI_API_KEY` and `APP_URL` from the AI Studio template, which are not consumed by this module.)
- **Backend Proxy Routes Required for Live Jaalee IoT Sync:**
  KSBM's backend server (Express / Next.js API routes) must proxy the following endpoints to `https://sensor.jaalee.com` to avoid browser CORS restrictions:
  - `GET /api/jaalee/code?account=...` → `https://sensor.jaalee.com/v1/open/code`
  - `POST /api/jaalee/login` → `https://sensor.jaalee.com/v1/open/login`
  - `GET /api/jaalee/devices-all` (Header: `Authorization`) → `https://sensor.jaalee.com/v1/open/data/all`
  - `GET /api/jaalee/historical?bleMac=...&type=...&size=5000` (Header: `Authorization`) → routes by device `type` (`F526`/`F527`/`F534`/`F535` → `/v1/open/pt`, `F523` → `/v1/open/htplu`, default → `/v1/open/data`).
  - *(Note: The source `server.ts` also supports `demo@jaalee.com` / `DEMO_TOKEN` virtual device responses for offline sandbox testing.)*
- **Client Persistence (`localStorage` keys) / Future Supabase Migration:**
  Currently persists state in browser `localStorage` under keys defined in `constants.ts` (`food_temp_equipments`, `food_temp_records`, `food_temp_jaaleeConfig`, `food_temp_notifications`, `food_temp_reminderTimes`, `food_temp_notificationOptions`, `food_temp_smtpConfig`, `food_temp_smtpPass`). When migrating to Supabase in KSBM, map these to `temp_equipments`, `temp_records`, `temp_notifications`, and `store_iot_configs` tables keyed by `store_id`.

---

## 4. Props & Permissions Mapping

### Entry Component Usage
```tsx
import ModuleEntry, { ModuleDashboardSummary } from './modules/ksbm_export/ModuleEntry';

<ModuleEntry
  currentUser={{
    id: activeStaff.id,
    name: activeStaff.fullName,
    role: activeStaff.role, // 'admin' | 'manager' | 'staff' | 'viewer'
    permissions: activeStaff.modulePermissions?.foodTemp,
    dailyShifts: activeStaff.dailyShifts,
  }}
  businessConfig={{
    name: store.name,
    address: store.address,
    email: store.email,
    phone: store.phone,
    timezone: store.timezone, // e.g. 'GMT+10:00'
    smtpConfig: store.smtpConfig, // optional centralized SMTP relay
  }}
  onSummaryUpdate={(summary: ModuleDashboardSummary) => setFoodTempKpi(summary)}
/>
```

### Granular Staff Permissions (`currentUser.permissions`)
| Action / Feature | Permission Flag | Default for `admin`/`manager` | Default for `staff` | Default for `viewer` |
| :--- | :--- | :---: | :---: | :---: |
| View Safety Dashboard & Charts | `canViewDashboard` | `true` | `true` | `true` |
| Submit Manual Temperature Logs | `canLogTemperature` | `true` | `true` | `false` |
| Trigger Jaalee Cloud IoT Sync | `canSyncIoT` | `true` | `true` | `false` |
| Add / Edit / Delete Equipment Units | `canManageEquipment` | `true` | `false` | `false` |
| Export CSV / PDF / Print / Email Audits | `canExportReports` | `true` | `true` | `false` |
| Access Module Settings (Reminders, Jaalee Link, SMTP, Backup, Purge) | `canManageSettings` | `true` | `false` | `false` |
| Run Archive Back-Date Synchronization | `canUseBackdateAudit` | `true` (`admin` only) | `false` | `false` |

### Settings Ownership Split (KSBM Master Admin vs. Module)
- **Belongs in KSBM Master Admin (`businessConfig` & Shell):**
  - Store / Business Name, Address, Phone, Registered Email (rendered directly onto Audit Reports and PDFs).
  - Staff Roster, Staff PIN Login, Master Admin PIN/Password, and Weekly Staff Shift Schedules (`currentUser.dailyShifts`).
  - Optional centralized `smtpConfig`, `timezone`, `reminderTimes`, and `notificationOptions` overrides.
- **Managed Inside Module (`SettingsTab.tsx`):**
  - Module-specific **Jaalee IoT Account & Token**.
  - Temperature Log **Reminder Checkpoints** & browser audio/push alert preferences.
  - Module-level **SMTP Relay Override**, **Back-Date Audit Sync**, and **Equipment/Logs JSON Backup & Reset**.

---

## 5. Dashboard Summary Metrics (for KSBM Home Screen)

`ModuleEntry` emits a live `ModuleDashboardSummary` object via `onSummaryUpdate` (and `computeDashboardSummary` can be imported directly by KSBM Home):

1. **Today's Food Safety Compliance Rate (`todayComplianceRate`):**
   - Percentage (`0–100%`) of today's temperature readings falling within each unit's safe threshold (`tempMinThreshold` to `tempMaxThreshold`). Also paired with `compliantUnits / totalUnits` so KSBM Home can show e.g. `100% Compliant (4/4 Units)`.
2. **Active Temperature Excursion Alerts (`activeBreachAlerts`):**
   - Count of unresolved out-of-zone temperature breach notifications (`notifications.filter(n => !n.resolved).length`). Renders a red critical badge on the KSBM Home tile when `> 0`.
3. **Overdue Manual Checkpoints (`overdueCheckpointsCount`):**
   - Count of scheduled daily manual logging checkpoints (e.g., `10:00`, `14:00`) that have passed during the operator's active shift without a matching manual reading logged within ±60 minutes. Renders an amber action-needed indicator on KSBM Home when `> 0`.
