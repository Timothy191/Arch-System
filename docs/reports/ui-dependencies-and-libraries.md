# Arch-System UI/UX Audit — Dependencies & Libraries Forensic Inventory

**Date:** 2026-10-01  
**Auditor:** UI/UX & Frontend Architecture Auditor  
**Scope:** Workspace dependencies across root `package.json`, `apps/portal/package.json`, `packages/ui/package.json`, `packages/theme/package.json`, and `libs/features/*/ui/package.json`.

---

## 1. Overview of Dependency Landscape

Arch-System is structured as a pnpm workspace and Turborepo monorepo with Next.js 16 (React 19) at the core. The UI stack combines:
- **Core Framework:** Next.js `16.2.6` (React `19.2.7` / React DOM `19.2.7`)
- **Primitive UI:** Radix UI primitives (`@radix-ui/react-*`), shadcn/ui patterns, Lucide React
- **Styling:** Tailwind CSS `3.4.17`, Tailwind Animate, PostCSS, Style Dictionary `5.4.1`
- **Motion & Physics:** Framer Motion `12.40.0`, `@formkit/auto-animate` `0.8.2`
- **Data Visualization & Graphs:** Recharts `3.8.1`, `@tremor/react` `3.18.7`, `@xyflow/react` `12.6.0`
- **Spreadsheets & Grids:** `@revolist/react-datagrid` / `@revolist/revogrid` `4.21.0`, `@univerjs/presets` / `@univerjs/preset-sheets-core` `0.23.0`
- **3D & Graphics:** Three.js `0.185.1`, `@react-three/fiber` `9.7.0`, `@react-three/drei` `10.7.8`
- **Specialty UI:** `@liqui-design/glass` `0.2.2`, `qr-code-styling` `1.9.2`, `swagger-ui-react` `5.18.2`

---

## 2. Master UI Dependency Audit Table

| Library | Version | Installed Location | Imported In | Actually Used | Main Usage | Verification Status |
|---|---|---|---|---|---|---|
| `react` | `^19.2.7` | Root catalog, all packages | All UI files | Yes | Core React rendering engine | `VERIFIED` |
| `react-dom` | `^19.2.7` | Root catalog, all packages | Apps & tests | Yes | DOM renderer | `VERIFIED` |
| `next` | `^16.2.6` | `apps/portal`, peer in `@repo/ui` | `apps/portal` routes, components | Yes | Next.js 16 App Router application | `VERIFIED` |
| `tailwindcss` | `^3.4.17` | Root catalog, portal, theme, ui | Preset & components | Yes | Utility CSS compilation | `VERIFIED` |
| `@tailwindcss/typography` | `^0.5.16` | portal, theme | `preset.ts` | Yes | Prose styling in docs & markdown | `VERIFIED` |
| `tailwindcss-animate` | `^1.0.7` | portal, theme | `preset.ts` | Yes | Keyframe animation utilities | `VERIFIED` |
| `framer-motion` | `^12.40.0` | Root catalog, portal, ui | GlassCard, MacMenuBar, Hub | Yes | Spring animations, gestures, modals | `VERIFIED` |
| `@formkit/auto-animate` | `^0.8.2` | `packages/ui` | `AnimatedList.tsx` | Yes | Automatic list item transitions | `VERIFIED` |
| `lucide-react` | `^1.18.0` | Root catalog, portal, theme, ui | Monorepo-wide (60+ files) | Yes | Standard icon library | `VERIFIED` |
| `recharts` | `^3.8.1` | Root catalog, portal, ui | `telemetry-chart.tsx`, access-control | Yes | Direct SVG charts (radial, bar, line) | `VERIFIED` |
| `@tremor/react` | `^3.18.7` | Root catalog, portal | `ProductionTrend.tsx`, `TireWearCurveChart.tsx` | Yes | Opinionated dashboard charts | `VERIFIED` |
| `@xyflow/react` | `^12.6.0` | Root catalog, portal, ui | `SystemArchitecture.tsx`, `WorkflowBuilder.tsx` | Yes | Node-based workflow & topology canvas | `VERIFIED` |
| `@revolist/react-datagrid` | `^4.21.0` | `packages/ui` | `data-grid.tsx` | Yes | Virtualized data table grid | `VERIFIED` |
| `@revolist/revogrid` | `^4.21.0` | `packages/ui` | `data-grid.tsx` | Yes | Core engine for RevoGrid | `VERIFIED` |
| `@univerjs/presets` | `^0.23.0` | portal, `libs/departments/ui` | `UniverSheet.tsx` | Yes (Isolated) | Embedded spreadsheet editor (~7MB) | `PARTIALLY VERIFIED` |
| `@univerjs/preset-sheets-core` | `^0.23.0` | portal, `libs/departments/ui` | `UniverSheet.tsx` | Yes (Isolated) | Spreadsheet core plugin | `PARTIALLY VERIFIED` |
| `three` | `^0.185.1` | Root catalog, portal, ui | `ThreeHeroRotator.tsx` | No (in prod) | Three.js WebGL engine | `UNUSED` |
| `@react-three/fiber` | `^9.7.0` | Root catalog, portal, ui | `ThreeHeroRotator.tsx` | No (in prod) | React wrapper for Three.js | `UNUSED` |
| `@react-three/drei` | `^10.7.8` | Root catalog, portal, ui | `ThreeHeroRotator.tsx` | No (in prod) | Three.js helper components | `UNUSED` |
| `@liqui-design/glass` | `^0.2.2` | `packages/ui` | `liqui-button.tsx` | No | Liquid glass WebGL / SVG filter engine | `UNUSED` |
| `qr-code-styling` | `^1.9.2` | `apps/portal` | `qr-section.tsx`, `qr-management-studio.tsx` | Yes | Canvas-based branded QR generation | `VERIFIED` |
| `swagger-ui-react` | `^5.18.2` | `apps/portal` | `apps/portal/app/docs/api/page.tsx` | Yes | Interactive OpenAPI specification explorer | `VERIFIED` |
| `@react-pdf/renderer` | `^4.5.1` | `apps/portal` | `pdf-actions.ts`, `ExportPdfButton.tsx` | Yes | Server-side & client PDF generation | `VERIFIED` |
| `sonner` | `^2.0.1` | Root catalog, portal, ui | `Toaster.tsx`, forms | Yes | Toast notification manager | `VERIFIED` |
| `style-dictionary` | `^5.4.1` | `packages/theme` | `sd.config.mjs` | Yes | Design token compilation | `VERIFIED` |
| `clsx` | `^2.1.1` | `packages/ui` | `lib/utils.ts` | Yes | Conditional classname utility | `VERIFIED` |
| `tailwind-merge` | `^2.5.4` | `packages/ui` | `lib/utils.ts` | Yes | Tailwind class collision resolver | `VERIFIED` |
| `class-variance-authority` | `^0.7.0` | `packages/ui` | `button.tsx`, `badge.tsx` | Yes | Component variant dispatch | `VERIFIED` |
| `@radix-ui/react-dialog` | `^1.1.15` | `packages/ui` | `dialog.tsx` | Yes | Accessible modal dialog primitive | `VERIFIED` |
| `@radix-ui/react-dropdown-menu` | `^2.1.16` | `packages/ui` | `dropdown-menu.tsx`, `MacMenuBar.tsx` | Yes | Accessible dropdown primitive | `VERIFIED` |
| `@radix-ui/react-popover` | `^1.1.15` | `apps/portal` | `SystemTray.tsx` | Yes | Control center system tray popover | `VERIFIED` |
| `@radix-ui/react-scroll-area` | `^1.2.10` | `packages/ui` | `scroll-area.tsx` | Yes | Custom scrollbar container | `VERIFIED` |
| `@radix-ui/react-separator` | `^1.1.8` | `packages/ui` | `separator.tsx`, `Divider.tsx` | Yes | Semantic divider primitive | `VERIFIED` |
| `@radix-ui/react-slot` | `^1.1.2` | `packages/ui` | `button.tsx` | Yes | `asChild` composition primitive | `VERIFIED` |
| `@radix-ui/react-tabs` | `^1.1.0` | `packages/ui` | `tabs.tsx`, `OverviewPage.tsx` | Yes | Tabbed interface primitive | `VERIFIED` |

---

## 3. Analysis of Competing UI Systems

### 3.1 Data Visualization Duplication (Recharts vs Tremor)
- **Finding:** The repository imports both `recharts` directly (`apps/portal/app/(departments)/access-control/components/HourlyAccessChart.tsx`, `packages/ui/src/components/ui/telemetry-chart.tsx`) and `@tremor/react` (`libs/features/hub/ui/src/ProductionTrend.tsx`, `libs/features/departments/ui/src/engineering/tires/TireWearCurveChart.tsx`, `apps/portal/features/analytics/components/ProductionTrendChart.tsx`).
- **Impact:** Tremor packages Recharts internally. Using both introduces conflicting configuration patterns, divergent styling mechanisms (CSS variables vs Tremor color palettes), and unnecessary bundle overhead.
- **Classification:** `DUPLICATED`

### 3.2 3D / WebGL Libraries Installed but Bypassed in Production
- **Finding:** `three`, `@react-three/fiber`, and `@react-three/drei` are installed in the root catalog and `@repo/ui`. Components `ThreeHeroRotator.tsx` and `ThreeHeroRotatorDynamic.tsx` are fully coded and tested. However, `libs/features/hub/ui/src/HeroRotator.tsx` explicitly imports and renders `GenericHeroRotator` from `@repo/ui/HeroRotator` (2D CSS/DOM version).
- **Impact:** ~600KB+ of Three.js dependencies remain in the dependency tree, type-checked on every CI run, but 0% active in runtime user flows.
- **Classification:** `UNUSED`

### 3.3 Liqui Glass Engine Installed but Unused
- **Finding:** `@liqui-design/glass` is installed in `packages/ui` and wrapped in `packages/ui/src/components/ui/liqui-button.tsx`.
- **Evidence:** `rg "LiquiButton" apps/` returns 0 results. It is never imported by any portal page or feature.
- **Classification:** `UNUSED`

### 3.4 Data Table Duplication
- **Finding:** Three different table implementations exist across the portal:
  1. Standard HTML/Tailwind table (`packages/ui/src/components/ui/table.tsx`) based on shadcn/Radix.
  2. Virtualized DataGrid (`@revolist/react-datagrid` in `packages/ui/src/components/ui/data-grid.tsx`).
  3. Full Spreadsheet (`@univerjs/presets` in `UniverSheet.tsx`).
- **Usage:**
  - `HourlyLoadsGrid.tsx` uses RevoGrid (`DataGrid`).
  - `ScadaPanel.tsx` uses RevoGrid (`DataGrid`).
  - `access-control/visitors/page.tsx` uses shadcn `Table`.
  - `access-control/badges/page.tsx` uses shadcn `Table`.
  - `drilling/machine-telemetry/page.tsx` uses shadcn `Table`.
  - `department/tools/page.tsx` embeds Univer spreadsheet (`UniverSheet`).
- **Classification:** `VERIFIED` (Legitimate division of concerns, though high dependency weight).
