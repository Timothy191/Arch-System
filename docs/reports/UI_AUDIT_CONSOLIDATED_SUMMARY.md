# ARCH-SYSTEM — CONSOLIDATED UI/UX AUDIT SUMMARY

**Auditor:** UI/UX & Frontend Architecture Forensic Auditor  
**Date:** October 1, 2026  
**Repository:** `Timothy191/Arch-System`  
**Monorepo Architecture:** pnpm Workspaces + Turborepo 2.x  
**Primary Application:** `apps/portal` (Next.js 16 App Router / React 19)  

---

## 1. EXECUTIVE OVERVIEW

An exhaustive, evidence-based, read-only UI/UX forensic audit of the Arch-System monorepo was executed. The audit evaluated all components, design tokens, static assets, route screens, dependencies, and architectural patterns.

### Key Metrics
- **Audited Routes:** 17 routes across 3 route groups in `apps/portal`
- **Audited Components:** 57 in `packages/ui`, 12 shell components, 24 domain widgets in `libs/features/*/ui`
- **Design Tokens:** 100+ variables in `packages/theme` (Dual-pipeline: Style Dictionary + CSS Generator)
- **Static Assets:** 30+ files across brand, avatars, background video, and icons
- **UI Maturity Rating:** **68 / 100** (Advanced macOS-like field terminal shell over a partially fragmented domain core)

---

## 2. SYNTHESIS OF AUDIT REPORTS

### A. Dependencies & Libraries (`ui-dependencies-and-libraries.md`)
- **Core Engine:** React `19.0.0-rc`, Next.js `16.0.0-canary.112`, Framer Motion `11.11.17`, Lucide React `0.460.0`.
- **Competing / Fragmented Systems:**
  - **Data Tables:** Virtualized `RevoGrid` (`packages/ui/src/components/DataGrid.tsx`) vs Radix/Tailwind standard tables vs `@univerjs` spreadsheet.
  - **Data Visualization:** `recharts` (primary telemetry engine) vs `@tremor/react` (legacy overlap).
  - **Dead 3D Engine:** `three`, `@react-three/fiber`, and `@react-three/drei` (~600KB) are installed and compiled in `libs/features/hub/ui`, but explicitly bypassed by `HeroRotator.tsx` in favor of a 2D Framer Motion rotator.

### B. Design Tokens & Styling (`ui-design-tokens.md`)
- **The OKLCH Myth:** Repository documentation mandates strict semantic OKLCH tokens (`color-bg-base`, `color-bg-elevated`). In reality, `packages/theme/src/tokens/tokens.json` contains **zero OKLCH tokens** (99% Hex, RGBA, and HSL).
- **Token Semantic Drift:**
  - `--accent-electric-blue` resolves to `#D4AF37` (Metallic Gold).
  - `--accent-electric-blue-subtle` resolves to `rgba(0, 122, 255, 0.08)` (Royal Blue).
  - `--accent-charcoal` compiles to `#ff9500` (Apple Orange), despite code comments defining it as `#1c1c1e` charcoal.
- **Strict Light-Mode Invariant:** Fully enforced across all runtime CSS. Zero `dark:` classes are present in application layouts.

### C. Branding & Assets (`ui-branding-assets.md`)
- **Brand Identity Confusion:**
  - Primary Operator: Plantcor Mining Operations (Brakfontein Pit).
  - Platform OS: Arch-System / Arch OS.
  - Borrowed Logos: `apps/portal/public/brand/arch-logo.png` is the official **Arch Linux** curve logo; `eve-logo.png` is the **Vercel** triangle logo; `MacMenuBar.tsx` renders an **Apple** logo SVG.
- **Active 404 Font Bug:**
  - `packages/theme/src/css/typography.css` declares `@font-face` for `Anurati` from `/fonts/Anurati-Regular.otf` for all `h1`-`h6` headings.
  - `apps/portal/public/fonts/` is completely empty (0 files), causing network 404 errors on every page load with headings.
- **Heavy Video Asset:**
  - `apps/portal/public/background/global-background.mp4` (11 MB) is preloaded by `RouteBackground.tsx` on every page load.

### D. Component Inventory (`ui-component-inventory.md`)
- **Active Foundation:** High-quality frosted glass cards (`GlassCard.tsx`), KPI cards (`KPICard.tsx`), and Mac desktop shell (`MacMenuBar.tsx`, `DockNav.tsx`).
- **Dead / Unused Primitives:** `FluidCanvas.tsx`, `LiquiButton.tsx`, `CyberButton.tsx`, and `ActionConfirmDialog.tsx` in `packages/ui` have zero consumers across all application routes.

### E. Route & Screen Inventory (`ui-route-screen-inventory.md`)
- **Production-Ready Routes:**
  - `/` (Operations Hub): macOS desktop shell, department dock, quick actions.
  - `/(departments)/control-room`: SCADA telemetry, hourly extraction tracking, atomic shift closeout RPC.
  - `/(departments)/drilling`: Live bit-depth SSE streaming.
  - `/(departments)/access-control`: RFID badging, visitor induction, truck weighbridge queue.
- **Degraded Routes:**
  - `/(departments)/engineering`: SMR hours and equipment metrics work, but breakdown and tire wear views are masked by feature stubs.
  - `/admin`: Operational, but guarded by an insecure hardcoded email bypass.
  - `/split-view`: Mocked WhatsApp Web and GitHub console panes.

### F. Technical Debt & Vulnerabilities (`ui-technical-debt.md`)
- **P0-1 (Security):** `apps/portal/app/admin/page.tsx` hardcodes `timothyoniel558@gmail.com` to bypass RBAC checks.
- **P0-2 (Functional):** `apps/portal/features/departments/index.tsx` exports 3-line stub `<div>` tags for `BreakdownsDashboard` and `TireManagementDashboard`, masking over 800 lines of fully implemented code in `libs/features/departments/ui`.
- **P1-1 (Visual):** Missing font asset `/fonts/Anurati-Regular.otf` triggers continuous 404s and font-swapping layout shifts.
- **P2-1 (Performance):** 11 MB MP4 video background preloaded over satellite links.

---

## 3. THE 10 MOST IMPORTANT FACTS ABOUT ARCH-SYSTEM UI

1. **Feature Masking:** `apps/portal/features/departments/index.tsx` replaces full production breakdown and tire dashboards with placeholder `<div>` tags.
2. **The OKLCH Myth:** Architectural guides mandate OKLCH, but `packages/theme` contains 0 OKLCH tokens (pure Hex/RGBA).
3. **Semantic Token Drift:** `--accent-electric-blue` is gold (`#D4AF37`), while `--accent-charcoal` is orange (`#ff9500`).
4. **Font 404 Bug:** `typography.css` points all headings to `/fonts/Anurati-Regular.otf`, but `public/fonts/` is empty.
5. **Hardcoded Admin Bypass:** `apps/portal/app/admin/page.tsx` hardcodes email `timothyoniel558@gmail.com`.
6. **Bypassed 3D Engine:** Three.js and React Three Fiber (~600KB) are installed and built, but runtime explicitly renders a 2D Framer Motion rotator.
7. **Borrowed Branding:** The UI uses the Arch Linux logo, the Vercel logo, and an Apple menu logo alongside the Plantcor mining identity.
8. **Heavy Background Video:** `global-background.mp4` forces an 11 MB payload on every page load.
9. **Dead Code in `@repo/ui`:** `FluidCanvas`, `LiquiButton`, `CyberButton`, and `ActionConfirmDialog` have zero usages.
10. **Simulated Split Panes:** `/split-view` renders hardcoded dummy WhatsApp Web messages and GitHub commits.

---

## 4. CANONICAL AUDIT FILE REGISTRY

All detailed forensic documentation is available in `docs/reports/`:
- [`ui-forensic-report.md`](file:///home/tim/Fork/Arch-System/docs/reports/ui-forensic-report.md) — Master comprehensive forensic report (33 sections)
- [`ui-component-inventory.md`](file:///home/tim/Fork/Arch-System/docs/reports/ui-component-inventory.md) — 57 components + shell + domain inventory
- [`ui-design-tokens.md`](file:///home/tim/Fork/Arch-System/docs/reports/ui-design-tokens.md) — Style Dictionary, token compilation, and semantic drift
- [`ui-branding-assets.md`](file:///home/tim/Fork/Arch-System/docs/reports/ui-branding-assets.md) — 30+ static files, logos, font 404, and video assets
- [`ui-route-screen-inventory.md`](file:///home/tim/Fork/Arch-System/docs/reports/ui-route-screen-inventory.md) — 17 routes, layout hierarchy, and screen states
- [`ui-dependencies-and-libraries.md`](file:///home/tim/Fork/Arch-System/docs/reports/ui-dependencies-and-libraries.md) — Full dependency matrix and library evaluations
- [`ui-technical-debt.md`](file:///home/tim/Fork/Arch-System/docs/reports/ui-technical-debt.md) — Prioritized remediation backlog (P0 to P3)
