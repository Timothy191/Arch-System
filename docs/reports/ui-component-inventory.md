# Arch-System UI/UX Audit — Master Component Inventory

**Date:** 2026-10-01  
**Auditor:** UI/UX & Frontend Architecture Auditor  
**Scope:** Component libraries and reusable UI widgets across `packages/ui`, `apps/portal/components`, `apps/portal/features`, and `libs/features/*/ui`.

---

## 1. Component Architecture Summary

The Arch-System frontend component ecosystem is distributed across four distinct locations in the monorepo:
1. **`packages/ui` (`@repo/ui`):** 57 shared presentational components, Radix wrappers, motion primitives, and canvas/3D widgets.
2. **`apps/portal/components/`:** Application-shell components (system tray, split window, command bar, background, accessibility skip links, route announcers).
3. **`apps/portal/features/`:** Domain feature widgets implemented locally within the portal Next.js app.
4. **`libs/features/*/ui/`:** Independent feature packages (`@repo/auth/ui`, `@repo/departments/ui`, `@repo/hub/ui`).

**Key Architectural Divergence:**  
A critical finding is that `apps/portal/features/departments/index.tsx` contains dummy stubs for `BreakdownsDashboard`, `TireManagementDashboard`, and `ShiftCoverageWidget` which override complete, multi-hundred-line implementations residing in `libs/features/departments/ui`.

---

## 2. Master Component Inventory Table

### 2.1 Primitives & Core Controls (`packages/ui`)

| Exported Component | Source Path | Dependencies | Variants / Modes | Styling Method | Token Usage | Accessibility | Animation | Active Usage Count | Status |
|---|---|---|---|---|---|---|---|---|---|
| `Button` | `packages/ui/src/components/ui/button.tsx` | `@radix-ui/react-slot`, `cva` | default, destructive, outline, secondary, ghost, link, glass | Tailwind + CVA | High | Focus rings, `asChild` composition | None | 35+ | `VERIFIED` |
| `Input` | `packages/ui/src/components/ui/input.tsx` | React | Standard, error state | Tailwind utility | High | Visible focus, aria-invalid | None | 20+ | `VERIFIED` |
| `SecondaryButton` | `packages/ui/src/components/SecondaryButton.tsx` | React | Glass secondary | Tailwind utility | Medium | Focus ring | Hover transition | 4 | `VERIFIED` |
| `AnimatedButton` | `packages/ui/src/components/ui/animated-button.tsx` | `framer-motion` | Primary, glass, glowing | Framer Motion + Tailwind | Medium | Keyboard accessible | Tap/hover scale spring | 2 (`reset/update password`) | `VERIFIED` |
| `CyberButton` | `packages/ui/src/components/ui/cyber-button.tsx` | `framer-motion` | Cyberpunk glitch / border | Tailwind + inline CSS | Low (Hardcoded) | Minimal | Glitch keyframes | 0 (Storybook only) | `UNUSED` |
| `LiquiButton` | `packages/ui/src/components/ui/liqui-button.tsx` | `@liqui-design/glass` | default, outline, ghost | LiquiGlass + Tailwind | Low | Standard button | Shader ripple | 0 | `UNUSED` |
| `Badge` | `packages/ui/src/components/ui/badge.tsx` | `cva` | default, secondary, destructive, outline, success, warning | Tailwind + CVA | High | Semantic text role | None | 18 | `VERIFIED` |
| `Avatar` | `packages/ui/src/components/ui/avatar.tsx` | React | Circular, letter avatar, image avatar | Tailwind utility | High | `role="img"` | None | 6 | `VERIFIED` |
| `Dialog` / `DialogContent` | `packages/ui/src/components/ui/dialog.tsx` | `@radix-ui/react-dialog` | Modal, confirmation | Radix Dialog + Tailwind | High | Focus trapping, aria-modal, Esc | Fade/scale in | 12 | `VERIFIED` |
| `AnimatedDialog` | `packages/ui/src/components/ui/animated-dialog.tsx` | `framer-motion`, Radix | Modal with spring physics | Framer Motion + Radix | High | Focus trapping | Spring physics | 1 (internal) | `VERIFIED` |
| `ActionConfirmDialog` | `packages/ui/src/components/ui/action-confirm-dialog.tsx` | `AnimatedDialog` | Confirmation modal | Glass card | High | Accessible dialog | Spring exit | 0 (Replaced by toast) | `UNUSED` |
| `DropdownMenu` | `packages/ui/src/components/ui/dropdown-menu.tsx` | `@radix-ui/react-dropdown-menu` | Nested menus, item groups | Radix + Tailwind | High | Keyboard navigation, roving tab | Fade/slide in | 8 | `VERIFIED` |
| `Checkbox` | `packages/ui/src/components/Checkbox.tsx` | React | Standard, circular, checklist | Tailwind + custom CSS | High | Native label association | Spring checkmark | 4 | `VERIFIED` |
| `Table` / `TableRow` | `packages/ui/src/components/ui/table.tsx` | React | Dense industrial table | Tailwind utility | High | Semantic `<table>`, `<th>` | Hover row tint | 14 | `VERIFIED` |
| `Divider` | `packages/ui/src/components/Divider.tsx` | `@radix-ui/react-separator` | horizontal, vertical, labeled, dotted, fading | Radix + Tailwind | High | `role="separator"` | None | 9 | `VERIFIED` |
| `ScrollArea` | `packages/ui/src/components/ui/scroll-area.tsx` | `@radix-ui/react-scroll-area` | Vertical, horizontal custom bar | Radix primitive | High | Native scroll semantics | None | 6 | `VERIFIED` |
| `Skeleton` | `packages/ui/src/components/ui/skeleton.tsx` | React | Rectangular, circular | Tailwind animate-pulse | High | `aria-busy="true"` | Pulse animation | 16 | `VERIFIED` |
| `GlassSkeleton` | `packages/ui/src/components/ui/glass-skeleton.tsx` | React | Frosted glass pulse placeholder | Tailwind + glass CSS | High | `aria-busy="true"` | Pulse animation | 7 | `VERIFIED` |

---

### 2.2 Layout & Shell Components

| Component | Path | Purpose | Behavior & Shell Placement | Status |
|---|---|---|---|---|
| `MacMenuBar` | `packages/ui/src/components/MacMenuBar.tsx` | Fixed macOS top bar | Fixed `top-2 left-3 right-3`, system menu dropdown, Google search form, WhatsApp split trigger | `VERIFIED` |
| `MacTitleBar` | `packages/ui/src/components/MacTitleBar.tsx` | Window header bar | Red/yellow/green traffic light buttons, window title, toolbar slots | `VERIFIED` |
| `DepartmentLayout` | `packages/ui/src/components/DepartmentLayout.tsx` | Department screen shell | Left sidebar navigation (w-60), vibrancy backdrop, active tab highlight | `VERIFIED` |
| `SplitWindowLayout` | `apps/portal/components/system/SplitWindowLayout.tsx` | Dual-pane split view | 50/50, 35/65, 70/30 split ratios, embedded WhatsApp Web mock, GitHub PRs mock | `VERIFIED` |
| `BottomNav` | `apps/portal/components/nav/BottomNav.tsx` | Mobile bottom bar | Fixed `bottom-0`, hidden on `md+`, displays 5 primary navigation tabs | `VERIFIED` |
| `SystemTray` / `SystemTrayPill` | `apps/portal/components/system/SystemTray.tsx` | Status HUD | Battery status, wifi signal, volume mute, notification center popover | `VERIFIED` |
| `CommandBar` | `apps/portal/components/CommandBar.tsx` | Cmd+K palette | Department switching, tools navigation, quick actions, logout action | `VERIFIED` |
| `RouteBackground` | `apps/portal/components/RouteBackground.tsx` | Ambient background | LCP WebP poster preloaded, 11MB loop video, reduced-motion bypass | `VERIFIED` |
| `SkipLinks` | `apps/portal/components/accessibility/SkipLinks.tsx` | WCAG 2.4.1 Skip link | Jumps to `#main-content`, `#navigation`, `#search` | `VERIFIED` |
| `RouteAnnouncer` | `apps/portal/components/RouteAnnouncer.tsx` | WCAG 4.1.3 SPA route updates | Polite live region announcing page title changes to screen readers | `VERIFIED` |
| `ViewportBoundaries` | `apps/portal/components/system/ViewportBoundaries.tsx` | Viewport constraints | Bounds window canvas to prevent layout breakage on ultrawide monitors | `VERIFIED` |

---

### 2.3 Data, Telemetry & Complex Widgets

| Component | Path | Library / Engine | Key Capabilities | Status |
|---|---|---|---|---|
| `GlassCard` | `packages/ui/src/components/GlassCard.tsx` | Framer Motion + SVG SDF | 5 variants (default, window, spotlight, glowborder, liquid), spotlight mouse tracking | `VERIFIED` |
| `KPICard` / `KPIGrid` | `packages/ui/src/components/KPI.tsx` | Framer Motion | Tabular figures, animated count transitions, urgency color coding | `VERIFIED` |
| `DataGrid` | `packages/ui/src/components/ui/data-grid.tsx` | `@revolist/react-datagrid` | Virtualized row rendering, column sorting, filters, cell editing | `VERIFIED` |
| `TelemetryChart` | `packages/ui/src/components/ui/telemetry-chart.tsx` | Recharts | Live SCADA streaming chart with FreezeToggle pause feature | `VERIFIED` |
| `HourlyAccessChart` | `apps/portal/app/(departments)/access-control/components/HourlyAccessChart.tsx` | Recharts | 24-hour access bar chart with peak entry/exit indicators | `VERIFIED` |
| `QRStatusDistributionChart`| `apps/portal/app/(departments)/access-control/components/QRStatusDistributionChart.tsx` | Recharts | Radial bar chart showing active vs expired credentials | `VERIFIED` |
| `ProductionTrend` | `libs/features/hub/ui/src/ProductionTrend.tsx` | `@tremor/react` | Area chart tracking Drilling vs Production vs Engineering yield | `VERIFIED` |
| `TireWearCurveChart` | `libs/features/departments/ui/src/engineering/tires/TireWearCurveChart.tsx` | `@tremor/react` | Line chart displaying millimeter tread wear over SMR engine hours | `VERIFIED` |
| `BreakdownCharts` | `libs/features/departments/ui/src/engineering/breakdowns/BreakdownCharts.tsx` | `@tremor/react` | Donut chart for breakdown causes and bar chart for repair hours | `VERIFIED` |
| `WorkflowBuilder` | `packages/ui/src/components/WorkflowBuilder.tsx` | `@xyflow/react` | Drag-and-drop node canvas with `TriggerNode`, `PluginNode`, `FlowEdge` | `VERIFIED` |
| `UniverSheet` | `features/.../tools/UniverSheet.tsx` & `libs/.../tools/UniverSheet.tsx` | `@univerjs/presets` | Full embedded Excel/Google Sheets clone (~7MB bundle) | `DUPLICATED` |
| `HeroRotator` | `packages/ui/src/components/HeroRotator.tsx` | Framer Motion (2D) | 2D CSS carousel with automated department panel rotation | `VERIFIED` |
| `ThreeHeroRotator` | `packages/ui/src/components/ThreeHeroRotator.tsx` | Three.js / R3F (3D) | 3D WebGL rotating cylinder carousel | `UNUSED` |

---

### 2.4 Domain Feature Components

#### Access Control & Badging
- `Neo300PrintStudio` (`apps/portal/.../print-cards/neo300-print-studio.tsx`): CR80 PVC hardware badge designer and Magicard Neo 300 print spooler status (`VERIFIED`).
- `HeadcountMusterBanner` (`apps/portal/.../access-control/components/HeadcountMusterBanner.tsx`): Live souls-on-site headcount and emergency blast siren trigger (`VERIFIED`).
- `PerimeterGateHUD` (`apps/portal/.../access-control/components/PerimeterGateHUD.tsx`): Turnstile gate connectivity and tailgate violation alert widget (`VERIFIED`).
- `QuickActionHub` (`apps/portal/.../access-control/components/QuickActionHub.tsx`): Fast access to badge issuance, visitor booking, and muster rolls (`VERIFIED`).
- `QRManagementStudio` (`apps/portal/.../qr-codes/qr-management-studio.tsx`): Dynamic QR credential generator for personnel, contractors, and coal trucks (`VERIFIED`).

#### Control Room & SCADA
- `ShiftCloseoutForm` (`apps/portal/app/(departments)/control-room/components/ShiftCloseoutForm.tsx`): End-of-shift compilation form with SHA-256 idempotency and offline queueing (`VERIFIED`).
- `ScadaPanel` (`apps/portal/features/departments/components/control-room/ScadaPanel.tsx`): Live telemetry tags grid with RevoGrid (`VERIFIED`).
- `AlertPanel` (`apps/portal/.../control-room/AlertPanel.tsx`): **Duplicate/Stub:** 78-line static mock in portal vs 174-line live Realtime Supabase panel in `libs/features/departments/ui` (`DUPLICATED / STUBBED`).
- `ControlRoomChecklistWidget` (`libs/.../control-room/ControlRoomChecklistWidget.tsx`): Shift closeout compliance checklist (`VERIFIED`).

#### Engineering & Mobile Fleet
- `BreakdownsDashboard`: **Duplicate/Stub:** In portal, returns `<div>BreakdownsDashboard (Under Review)</div>`. In `libs/features/departments/ui`, 234 lines of tabs, MTBF metrics, and booking forms (`STUBBED`).
- `TireManagementDashboard`: **Duplicate/Stub:** In portal, returns `<div>TireManagementDashboard (Under Review)</div>`. In `libs/features/departments/ui`, 560 lines of tread depth inspection and replacement workflows (`STUBBED`).
- `BookInForm` (`libs/.../engineering/breakdowns/BookInForm.tsx`): Mobile equipment failure logging (`VERIFIED`).
- `BookOutForm` (`libs/.../engineering/breakdowns/BookOutForm.tsx`): Equipment sign-off and repair verification (`VERIFIED`).

#### Drilling Telemetry
- `RealtimeDrillTelemetryStream` (`apps/portal/.../drilling/machine-telemetry/RealtimeDrillTelemetryStream.tsx`): Live SSE subscriber consuming `/api/telemetry/drilling/stream` (`VERIFIED`).
- `DrillingOperationsTable` (`apps/portal/.../drilling/drilling-operations/DrillingOperationsTable.tsx`): Hole depth, penetration rate, and drill bit wear logs (`VERIFIED`).

---

### 2.5 Motion, Visual Effects & Dead Components

| Component | Path | Technology | Intended Purpose | Audit Finding | Status |
|---|---|---|---|---|---|
| `FluidCanvas` | `packages/ui/src/components/FluidCanvas.tsx` | HTML5 Canvas 2D + rAF | Navier-Stokes fluid ripple effect | Exported from `@repo/ui`, but **never rendered** anywhere | `UNUSED` |
| `ThreeHeroRotator` | `packages/ui/src/components/ThreeHeroRotator.tsx` | Three.js / R3F | 3D cylinder carousel | Tested in unit tests, but bypassed in production | `UNUSED` |
| `LiquiButton` | `packages/ui/src/components/ui/liqui-button.tsx` | `@liqui-design/glass` | Liquid glass button | Exported from `@repo/ui`, zero imports in apps | `UNUSED` |
| `CyberButton` | `packages/ui/src/components/ui/cyber-button.tsx` | Framer Motion | Cyberpunk glitch button | Storybook only, zero production imports | `UNUSED` |
| `ActionConfirmDialog`| `packages/ui/src/components/ui/action-confirm-dialog.tsx`| Framer Motion + Radix | Confirm modal | Replaced by toast undo, zero production imports | `UNUSED` |
| `Marquee` | `packages/ui/src/components/ui/marquee.tsx` | CSS transform | Infinite ticker | Used in `ToolBanner.tsx` and `DepartmentReviews.tsx` | `VERIFIED` |
| `FreezeToggle` | `packages/ui/src/components/ui/freeze-toggle.tsx` | React | Telemetry pause | Used in `TelemetryChart.tsx` | `VERIFIED` |
