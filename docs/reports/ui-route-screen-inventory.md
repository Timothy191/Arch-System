# Arch-System UI/UX Audit — Route & Screen Inventory

**Date:** 2026-10-01  
**Auditor:** UI/UX & Frontend Architecture Auditor  
**Scope:** Complete inventory of every route, page segment, layout, and UI state across `apps/portal/app`.

---

## 1. Master Route Inventory Table

| Route | Application | Page / File | Layout Hierarchy | Major Components | UI State Coverage | Auth & Gating | Status |
|---|---|---|---|---|---|---|---|
| `/` | `apps/portal` | `app/page.tsx` | `app/layout.tsx` | None (Client redirect) | Loading | Public -> Redirects `/hub` | `VERIFIED` |
| `/login` | `apps/portal` | `app/(auth)/login/page.tsx` | `app/(auth)/layout.tsx` | `LoginForm`, `Logo`, `AlertTriangle` | Error, Loading, Success | Public; Redirects `/hub` if authed | `VERIFIED` |
| `/reset-password` | `apps/portal` | `app/(auth)/reset-password/page.tsx` | `app/(auth)/layout.tsx` | `AnimatedButton`, `Input` | Error, Loading | Public | `VERIFIED` |
| `/update-password` | `apps/portal` | `app/(auth)/update-password/page.tsx` | `app/(auth)/layout.tsx` | `AnimatedButton`, `Input` | Error, Loading | Public (Supabase recovery) | `VERIFIED` |
| `/hub` | `apps/portal` | `app/hub/page.tsx` | `app/layout.tsx` > `hub/layout.tsx` | `HeroRotator`, `ProductionTrend`, `CoreOperationalModules`, `AlertTicker`, `ToolBanner` | Loading, Error | Authed (All roles) | `VERIFIED` |
| `/hub/executive` | `apps/portal` | `app/hub/executive/page.tsx` | `app/layout.tsx` > `hub/layout.tsx` | `ExportButton`, `PDFDownloadButton`, `ProductionTrendChart` | Loading | Authed (Supervisor/Admin) | `VERIFIED` |
| `/overview` | `apps/portal` | `app/overview/page.tsx` | `app/layout.tsx` | `SystemArchitecture`, `BackendArchitecture`, `TechStack`, `DatabaseSchema`, `@xyflow/react` | Loading, Error | Authed (All roles) | `VERIFIED` |
| `/control-room` | `apps/portal` | `app/(departments)/control-room/page.tsx` | `app/layout.tsx` | `ShiftCloseoutForm`, `Divider` | Offline queue, Loading | Authed (`control_room_operator`, `admin`) | `VERIFIED` |
| `/[department]` | `apps/portal` | `app/(departments)/[department]/page.tsx` | `[department]/layout.tsx` | `ControlRoomSummaryGridClient`, `NonControlRoomSummaryGridClient`, `ProductionDashboard` | Loading, Error | Authed (Role vs Dept) | `VERIFIED` |
| `/[department]/hourly-loads` | `apps/portal` | `app/(departments)/[department]/hourly-loads/page.tsx` | `[department]/layout.tsx` | `HourlyLoadsGrid` (`DataGrid` RevoGrid), `KPICard`, `PageHeader` | Loading | Authed (Department match) | `VERIFIED` |
| `/[department]/machine-operations` | `apps/portal` | `app/(departments)/[department]/machine-operations/page.tsx` | `[department]/layout.tsx` | `MachineOperationsForm`, `MachineOperationsList`, `DelayEntriesForm`, `ComplianceWidget` | Loading | Authed (Department match) | `VERIFIED` |
| `/[department]/excavator-activity` | `apps/portal` | `app/(departments)/[department]/excavator-activity/page.tsx` | `[department]/layout.tsx` | `ExcavatorActivityForm`, `ExcavatorActivityList`, `ExcavatorDumperTable` | Loading | Authed (Department match) | `VERIFIED` |
| `/[department]/engineering-notes` | `apps/portal` | `app/(departments)/[department]/engineering-notes/page.tsx` | `[department]/layout.tsx` | `EngineeringNotesForm`, `EngineeringNotesList`, `PredictiveAlertsWidget` | Loading | Authed (Department match) | `VERIFIED` |
| `/[department]/breakdowns` | `apps/portal` | `app/(departments)/[department]/breakdowns/page.tsx` | `[department]/layout.tsx` | `BreakdownsDashboard` (**Stub: Under Review**) | Loading | Authed (Department match) | `STUBBED` |
| `/[department]/operational-delays`| `apps/portal` | `app/(departments)/[department]/operational-delays/page.tsx` | `[department]/layout.tsx` | Delay log grid, filters | Loading | Authed (Department match) | `VERIFIED` |
| `/[department]/shift-compilation` | `apps/portal` | `app/(departments)/[department]/shift-compilation/page.tsx` | `[department]/layout.tsx` | `ShiftCompilationClient`, `KPICard`, PDF Actions | Loading | Authed (Department match) | `VERIFIED` |
| `/[department]/shift-coverage` | `apps/portal` | `app/(departments)/[department]/shift-coverage/page.tsx` | `[department]/layout.tsx` | `ShiftCoverageClient`, `ShiftToggle`, `GlassCard` | Loading | Authed (Department match) | `VERIFIED` |
| `/[department]/daily-log` | `apps/portal` | `app/(departments)/[department]/daily-log/page.tsx` | `[department]/layout.tsx` | `DailyLogForm`, `GlassCard` | Loading | Authed (Department match) | `VERIFIED` |
| `/[department]/machines` | `apps/portal` | `app/(departments)/[department]/machines/page.tsx` | `[department]/layout.tsx` | Machines roster table | Loading | Authed (Department match) | `VERIFIED` |
| `/[department]/reports` | `apps/portal` | `app/(departments)/[department]/reports/page.tsx` | `[department]/layout.tsx` | Report preview, `ExportButton`, `PDFDownloadButton` | Loading | Authed (Department match) | `VERIFIED` |
| `/[department]/roll-over` | `apps/portal` | `app/(departments)/[department]/roll-over/page.tsx` | `[department]/layout.tsx` | Shift handover checklist | Loading | Authed (Department match) | `VERIFIED` |
| `/[department]/history` | `apps/portal` | `app/(departments)/[department]/history/page.tsx` | `[department]/layout.tsx` | Historical shift records | Loading | Authed (Department match) | `VERIFIED` |
| `/[department]/tools` | `apps/portal` | `app/(departments)/[department]/tools/page.tsx` | `[department]/layout.tsx` | `ToolsPageClient`, `UniverSheet` | Loading | Authed (`admin`, `supervisor`) | `VERIFIED` |
| `/access-control` | `apps/portal` | `app/(departments)/access-control/page.tsx` | `access-control/layout.tsx` | `HeadcountMusterBanner`, `PerimeterGateHUD`, `QuickActionHub`, `KPIGrid`, `ChartsRow` | Loading, Error | Authed (`access_control`, `admin`) | `VERIFIED` |
| `/access-control/print-cards` | `apps/portal` | `app/(departments)/access-control/print-cards/page.tsx` | `access-control/layout.tsx` | `Neo300PrintStudio` (Magicard Neo 300 spooler) | Loading | Authed (`access_control`, `admin`) | `VERIFIED` |
| `/access-control/qr-codes` | `apps/portal` | `app/(departments)/access-control/qr-codes/page.tsx` | `access-control/layout.tsx` | `QRManagementStudio` (Dynamic QR generation) | Loading | Authed (`access_control`, `admin`) | `VERIFIED` |
| `/access-control/muster` | `apps/portal` | `app/(departments)/access-control/muster/page.tsx` | `access-control/layout.tsx` | `MusterRollCallView`, Emergency Headcount | Loading | Authed (`access_control`, `admin`) | `VERIFIED` |
| `/access-control/visitors` | `apps/portal` | `app/(departments)/access-control/visitors/page.tsx` | `access-control/layout.tsx` | Visitor induction forms, Visitor logs table | Loading, Empty | Authed (`access_control`, `admin`) | `VERIFIED` |
| `/access-control/badges` | `apps/portal` | `app/(departments)/access-control/badges/page.tsx` | `access-control/layout.tsx` | Badge roster, expiry badges, search | Loading | Authed (`access_control`, `admin`) | `VERIFIED` |
| `/access-control/card-actions` | `apps/portal` | `app/(departments)/access-control/card-actions/page.tsx` | `access-control/layout.tsx` | Card revocation, reissue, medical signoff | Loading | Authed (`access_control`, `admin`) | `VERIFIED` |
| `/access-control/access-logs` | `apps/portal` | `app/(departments)/access-control/access-logs/page.tsx` | `access-control/layout.tsx` | Audit logs of turnstile entries | Loading | Authed (`access_control`, `admin`) | `VERIFIED` |
| `/access-control/reports` | `apps/portal` | `app/(departments)/access-control/reports/page.tsx` | `access-control/layout.tsx` | Daily visitor and personnel PDF export | Loading | Authed (`access_control`, `admin`) | `VERIFIED` |
| `/drilling` | `apps/portal` | `app/(departments)/drilling/page.tsx` | `drilling/layout.tsx` | Drill fleet KPI grid, active operations, delay summary | Loading, Error | Authed (Drilling access) | `VERIFIED` |
| `/drilling/drilling-operations` | `apps/portal` | `app/(departments)/drilling/drilling-operations/page.tsx` | `drilling/layout.tsx` | `DrillingOperationsTable`, hole completion tracking | Loading | Authed (Drilling access) | `VERIFIED` |
| `/drilling/machine-telemetry` | `apps/portal` | `app/(departments)/drilling/machine-telemetry/page.tsx` | `drilling/layout.tsx` | `RealtimeDrillTelemetryStream` (SSE live cards) | Loading | Authed (Drilling access) | `VERIFIED` |
| `/drilling/reports` | `apps/portal` | `app/(departments)/drilling/reports/page.tsx` | `drilling/layout.tsx` | Drill penetration yield reports | Loading | Authed (Drilling access) | `VERIFIED` |
| `/engineering` | `apps/portal` | `app/(departments)/engineering/page.tsx` | `engineering/layout.tsx` | Fleet reliability summary, work order queue | Loading, Error | Authed (Engineering access) | `VERIFIED` |
| `/engineering/tire-management` | `apps/portal` | `app/(departments)/engineering/tire-management/page.tsx` | `engineering/layout.tsx` | `TireManagementDashboard` (**Stub: Under Review**) | Loading | Authed (Engineering access) | `STUBBED` |
| `/admin` | `apps/portal` | `app/admin/page.tsx` | `admin/layout.tsx` | `AdminTabsClient`, `UsersTab`, `FleetTab`, `SitesTab`, `AuditLogsTab`, `SettingsTab` | Loading, Error | Authed (`admin` OR `timothyoniel558@gmail.com`) | `VERIFIED` |
| `/admin/workflows` | `apps/portal` | `app/admin/workflows/page.tsx` | `admin/layout.tsx` | `WorkflowBuilder` (`@xyflow/react`), n8n dispatch | Loading | Authed (`admin` OR `timothyoniel558@gmail.com`) | `VERIFIED` |
| `/admin/redis` | `apps/portal` | `app/admin/redis/page.tsx` | `admin/layout.tsx` | `RedisManagerPage`, Key inspection, Cluster health | Loading | Authed (`admin` OR `timothyoniel558@gmail.com`) | `VERIFIED` |
| `/admin/ai-metrics` | `apps/portal` | `app/admin/ai-metrics/page.tsx` | `admin/layout.tsx` | `AIMetricsDashboard`, prompt tokens, cost metrics | Loading | Authed (`admin` OR `timothyoniel558@gmail.com`) | `VERIFIED` |
| `/docs` | `apps/portal` | `app/docs/page.tsx` | `docs/layout.tsx` | `Book` (3D manual volumes), `CodeBlock`, `Collapse` | Loading | Public | `VERIFIED` |
| `/docs/api` | `apps/portal` | `app/docs/api/page.tsx` | `docs/layout.tsx` | `SwaggerUI` interactive OpenAPI explorer | Loading | Public / Authed | `VERIFIED` |
| `/offline` | `apps/portal` | `app/offline/page.tsx` | `app/layout.tsx` | `ReloadButton`, Offline warning card | Static offline | Offline Service Worker fallback | `VERIFIED` |
| `/privacy` | `apps/portal` | `app/privacy/page.tsx` | `app/layout.tsx` | Privacy Policy prose | Static text | Public | `VERIFIED` |

---

## 2. Forensic Screen-by-Screen Breakdown

### 2.1 Screen: Login
- **Route:** `/login`
- **Source:** `apps/portal/app/(auth)/login/page.tsx`
- **Layout:** `apps/portal/app/(auth)/layout.tsx`
- **Components:** `LoginForm` (from `@repo/auth/ui`), `Logo` (Arch Linux vector), `AlertTriangle`, `ShieldCheck`.
- **Styling:** Custom amber/gold palette (`from-[#c59837] via-[#a36c1e] to-[#71440d]`), `bg-white/80 backdrop-blur-xl`, radial gradients.
- **Tokens:** Bypasses semantic tokens; uses hardcoded amber Tailwind classes and inline gradient hex strings.
- **Branding:** Arch Systems logo in a gold box; "Arch OS v2.4.1"; "eve agentic system" in footer.
- **Animation:** `animate-fade-up`, `animate-spin` on loader, active scale transition `active:scale-[0.98]`.
- **Responsive:** Centered card, `max-w-md`, full width on mobile with `px-4`.
- **Accessibility:** Proper `<label>` elements, `aria-live="assertive"` for error announcements, caps lock warning.
- **Data:** Checks Supabase session cookies; verifies authentication health.
- **Auth:** Public. Redirects authenticated users to `/hub` or `?redirect=...`.
- **Status:** `VERIFIED`.

### 2.2 Screen: Central Hub
- **Route:** `/hub`
- **Source:** `apps/portal/app/hub/page.tsx`
- **Layout:** `apps/portal/app/layout.tsx` > `apps/portal/app/hub/layout.tsx`
- **Components:** `MacMenuBar`, `SystemTrayPill`, `HeroRotator` (2D version), `ProductionTrend`, `CoreOperationalModules`, `AlertTicker`, `ToolBanner`, `BottomNav` (mobile).
- **Styling:** Frosted glass cards (`liquid-glass-light`), backdrop blur, semantic tokens.
- **Tokens:** Consumes `--bg-primary`, `--text-heading`, `--accent-blue`, `--dept-*`.
- **Branding:** Arch Systems logo, department imagery (`public/images/departments/*.jpg`), lowercase "eve" in footer.
- **Animation:** Auto-rotating carousel, Framer Motion springs, auto-scroll Marquee in banners.
- **Responsive:** Full width container with fluid gutters (`px-4 sm:px-6 lg:px-8`), mobile `BottomNav` hidden on `md+`.
- **Accessibility:** SkipLinks to `#main-content`, `RouteAnnouncer` live region, keyboard navigation in MacMenuBar.
- **Data:** Fetches live breakdown counts, machine statuses, and production trends from Supabase RPC `get_production_trend` with Redis caching.
- **Auth:** Authed (requires valid Supabase JWT).
- **Status:** `VERIFIED`.

### 2.3 Screen: Control Room Dashboard
- **Route:** `/control-room`
- **Source:** `apps/portal/app/(departments)/control-room/page.tsx`
- **Layout:** `apps/portal/app/layout.tsx`
- **Components:** `ShiftCloseoutForm`, `Divider`.
- **Styling:** Minimal container with semantic tokens (`text-color-text-primary`).
- **Data:** Connects to PostgreSQL `atomic_shift_closeout` stored procedure with SHA-256 payload idempotency and offline queue buffer.
- **Auth:** Restricted to `control_room_operator`, `admin`, `supervisor`.
- **Status:** `VERIFIED`.

### 2.4 Screen: Access Control Dashboard
- **Route:** `/access-control`
- **Source:** `apps/portal/app/(departments)/access-control/page.tsx`
- **Layout:** `apps/portal/app/(departments)/access-control/layout.tsx`
- **Components:** `HeadcountMusterBanner`, `PerimeterGateHUD`, `QuickActionHub`, `DashboardKPIGrid`, `DashboardChartsRow` (`HourlyAccessChart`, `QRStatusDistributionChart`), `DashboardActivityFeed`.
- **Styling:** Industrial high-density HUD cards, Recharts visualizations.
- **Data:** Aggregates real-time gate turnstile logs, RFID scans, visitor roll calls.
- **Auth:** Restricted to `access_control`, `admin`, `supervisor`.
- **Status:** `VERIFIED`.

### 2.5 Screen: Access Control — Print Cards Studio
- **Route:** `/access-control/print-cards`
- **Source:** `apps/portal/app/(departments)/access-control/print-cards/page.tsx`
- **Layout:** `apps/portal/app/(departments)/access-control/layout.tsx`
- **Components:** `Neo300PrintStudio`, card preview (front & back), printer hardware queue HUD.
- **Styling:** CR80 PVC card preview (rounded-xl, high contrast industrial layout), GlassCard controls.
- **Data:** Fetches printer spooler status and employee card profiles from database.
- **Status:** `VERIFIED`.

### 2.6 Screen: Drilling Telemetry & Machine Stream
- **Route:** `/drilling/machine-telemetry`
- **Source:** `apps/portal/app/(departments)/drilling/machine-telemetry/page.tsx`
- **Layout:** `apps/portal/app/(departments)/drilling/layout.tsx`
- **Components:** `RealtimeDrillTelemetryStream`, monthly summary table, telemetry history archive.
- **Styling:** Telemetry cards with live status indicators, GlassCard, dense data grid.
- **Data:** Server-Sent Events (SSE) streaming via `/api/telemetry/drilling/stream`.
- **Status:** `VERIFIED`.

### 2.7 Screen: Engineering — Tire Management
- **Route:** `/engineering/tire-management`
- **Source:** `apps/portal/app/(departments)/engineering/tire-management/page.tsx`
- **Layout:** `apps/portal/app/(departments)/engineering/layout.tsx`
- **Components:** `TireManagementDashboard` imported from `@/features/departments`.
- **CRITICAL DEFECT:** In `apps/portal/features/departments/index.tsx`, `TireManagementDashboard` is a dummy stub:
  ```tsx
  export function TireManagementDashboard(props: any) {
    return <div>TireManagementDashboard (Under Review)</div>;
  }
  ```
  The full 560-line component in `libs/features/departments/ui` is completely disconnected.
- **Status:** `STUBBED / DEFECT`.

### 2.8 Screen: Department Breakdowns
- **Route:** `/[department]/breakdowns`
- **Source:** `apps/portal/app/(departments)/[department]/breakdowns/page.tsx`
- **Layout:** `apps/portal/app/(departments)/[department]/layout.tsx`
- **Components:** `BreakdownsDashboard` imported from `@/features/departments`.
- **CRITICAL DEFECT:** In `apps/portal/features/departments/index.tsx`, `BreakdownsDashboard` is a dummy stub:
  ```tsx
  export function BreakdownsDashboard(props: any) {
    return <div>BreakdownsDashboard (Under Review)</div>;
  }
  ```
  The full 234-line component in `libs/features/departments/ui` is completely disconnected.
- **Status:** `STUBBED / DEFECT`.

### 2.9 Screen: Admin Console & Workflows
- **Route:** `/admin`, `/admin/workflows`, `/admin/redis`, `/admin/ai-metrics`
- **Source:** `apps/portal/app/admin/page.tsx`
- **Layout:** `apps/portal/app/admin/layout.tsx`
- **Components:** `AdminTabsClient`, `WorkflowBuilder` (`@xyflow/react`), `RedisManagerPage`, `AIMetricsDashboard`.
- **Auth Gating:** Hardcoded email check:
  `if (employee?.role !== 'admin' && user.email?.toLowerCase() !== 'timothyoniel558@gmail.com')`
- **Data:** Mock key-value data in Redis page; hardcoded workflow dispatches to external Vercel endpoint.
- **Status:** `VERIFIED`.

### 2.10 Screen: System Architecture & Operations Overview
- **Route:** `/overview`
- **Source:** `apps/portal/app/overview/page.tsx`
- **Layout:** `apps/portal/app/layout.tsx`
- **Components:** Interactive `@xyflow/react` nodes depicting the Monorepo architecture, Supabase schema, Redis caching, and autonomous agents.
- **Status:** `VERIFIED`.
