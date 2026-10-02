# Arch-System UI/UX Audit — Technical Debt & Architectural Drift

**Date:** 2026-10-01  
**Auditor:** UI/UX & Frontend Architecture Auditor  
**Scope:** Technical debt, code duplication, orphaned components, architectural drift, and maintainability concerns across the Arch-System frontend.

---

## 1. Executive Summary of Technical Debt

The forensic inspection revealed critical discrepancies between the repository's documented standards (e.g. `AGENTS.md`, `GEMINI.md`, `DESIGN.md`) and the actual implementation in code. The most significant issues fall into five categories:
1. **Disconnected Real UI vs Feature Stubs:** Complete, feature-rich dashboards in `libs/features/departments/ui/` are bypassed in favor of placeholder stubs in `apps/portal/features/departments/index.tsx`.
2. **Dual-Pipeline Token Architecture:** Two competing scripts generate tokens from two different source files, leading to semantic color drift and conflicting radii/shadow scales.
3. **Orphaned / Dead Dependencies & Components:** ~600KB of Three.js / React Three Fiber code and multiple experimental buttons are installed, tested, and compiled but 0% active in runtime routes.
4. **Hardcoded Credentials & Personal Identifiers:** Personal email addresses and mocked operator identities are hardcoded into production authentication checks and layouts.
5. **Asset & Performance Overhead:** An unoptimized 11.0 MB video background and missing font files (triggering 404s) impact loading performance.

---

## 2. Prioritized Technical Debt Inventory

### P0 — Critical Architectural Disconnects & Security

#### TD-01: Disconnected Production Dashboards (Stubbed Feature Index)
- **Finding:** In `apps/portal/features/departments/index.tsx` (lines 6-14), three primary operational dashboards are implemented as dummy stubs:
  ```tsx
  export function BreakdownsDashboard(props: any) {
    return <div>BreakdownsDashboard (Under Review)</div>;
  }
  export function ShiftCoverageWidget(props: any) {
    return <div>ShiftCoverageWidget (Under Review)</div>;
  }
  export function TireManagementDashboard(props: any) {
    return <div>TireManagementDashboard (Under Review)</div>;
  }
  ```
- **Evidence:** 
  - `apps/portal/app/(departments)/[department]/breakdowns/page.tsx` imports from `@/features/departments` and renders the stub.
  - `apps/portal/app/(departments)/engineering/tire-management/page.tsx` queries the database for tires and machines, and passes them to the stub.
  - Meanwhile, full implementations exist at:
    - `libs/features/departments/ui/src/engineering/breakdowns/BreakdownsDashboard.tsx` (234 lines)
    - `libs/features/departments/ui/src/engineering/tires/TireManagementDashboard.tsx` (560 lines)
    - `libs/features/departments/ui/src/control-room/ShiftCoverageWidget.tsx` (112 lines)
- **Impact:** Live mining operators viewing breakdowns or tire management see "Under Review" instead of the fully developed engineering dashboard.
- **Classification:** `DUPLICATED / STUBBED`

#### TD-02: Hardcoded Personal Email in Admin Authorization
- **Finding:** Hardcoded personal email `timothyoniel558@gmail.com` bypasses database role checks.
- **Evidence:**
  - `apps/portal/app/admin/page.tsx` (line 42):
    ```ts
    if (employee?.role !== 'admin' && user.email?.toLowerCase() !== 'timothyoniel558@gmail.com') {
      redirect('/');
    }
    ```
  - `apps/portal/app/admin/layout.tsx` (line 26 & line 90):
    ```ts
    const isAdmin = employee?.role === 'admin' || user.email?.toLowerCase() === 'timothyoniel558@gmail.com';
    ```
  - `apps/portal/app/admin/workflows/page.tsx` (line 57):
    ```ts
    triggeredBy: 'timothyoniel558@gmail.com'
    ```
- **Impact:** Security risk; hardcoded individual credential violates RBAC principles and multi-tenant isolation.
- **Classification:** `VERIFIED / SECURITY DEBT`

---

### P1 — Design System Inconsistency & Drift

#### TD-03: Dual Token Generation Pipeline & Semantic Drift
- **Finding:** Tokens are compiled via two competing systems from two different source files:
  1. `sd.config.mjs` compiles `tokens.json` to `variables-generated.css` and `generated-sd.ts`.
  2. `generate-tokens.mjs` parses `variables.css` to `generated.ts`.
  Both generated files are then imported simultaneously in `index.css`.
- **Evidence of Semantic Drift:**
  - `--accent-electric-blue` is defined as `#D4AF37` (Metallic Gold), while `--accent-electric-blue-subtle` is `rgba(0, 122, 255, 0.08)` (True Blue).
  - `--accent-charcoal` is mapped to `--arch13`, which compiles to `#ff9500` (Bright Orange), despite comments and TS types claiming it is charcoal `#1c1c1e`.
  - Four conflicting border-radius scales exist between `tokens.json`, `radii.ts`, `variables.css`, and Tailwind presets.
  - Two conflicting shadow palettes exist between `shadows.ts` and `variables.css`.
- **Impact:** UI developers cannot predict token values; components render inconsistent radii and colors depending on whether they consume CSS classes, Tailwind utilities, or TS constants.
- **Classification:** `DUPLICATED / DRIFT`

#### TD-04: The OKLCH Myth (Specification vs Implementation Mismatch)
- **Finding:** Documentation mandates strict OKLCH token usage and forbids hex/rgba colors. In reality, `tokens.json` contains 0 OKLCH tokens, and `packages/theme` uses hex, rgba, and HSL across 99% of its definitions.
- **Impact:** Misleads developers and agents into assuming an OKLCH engine exists when standard sRGB hex/hsl is actually driving the interface.
- **Classification:** `MISMATCH`

---

### P2 — Performance & Unused Heavy Assets

#### TD-05: Missing Font Asset Triggering Network 404
- **Finding:** `packages/theme/src/css/typography.css` specifies `@font-face` for `Anurati` from `/fonts/Anurati-Regular.otf` and applies it to all `h1`-`h6`.
- **Evidence:** `apps/portal/public/fonts/` is empty (0 bytes). Every page load with a heading attempts to fetch `/fonts/Anurati-Regular.otf` and receives a 404.
- **Impact:** Network overhead, console errors, and fallback font snapping during hydration.
- **Classification:** `DEFECT`

#### TD-06: 11.0 MB Background Video on Critical Path
- **Finding:** `apps/portal/public/background/global-background.mp4` is an uncompressed 11.0 MB video file loaded on every portal page.
- **Evidence:** `RouteBackground.tsx` loads the video with `preload="auto"`. On slow or intermittent satellite ("lie-fi") mining site connections, this consumes substantial bandwidth.
- **Impact:** High data consumption, mobile battery drain, frame drops on low-power rugged field terminals.
- **Classification:** `PERFORMANCE DEBT`

#### TD-07: Unused Three.js / React Three Fiber Bundle Overhead
- **Finding:** `three`, `@react-three/fiber`, and `@react-three/drei` are installed and compiled in `@repo/ui`. `ThreeHeroRotator.tsx` is implemented and unit tested.
- **Evidence:** `libs/features/hub/ui/src/HeroRotator.tsx` explicitly renders the 2D Framer Motion `GenericHeroRotator`. The 3D component is never rendered in production.
- **Impact:** Unnecessary dependencies, prolonged install times, and cognitive load.
- **Classification:** `UNUSED`

---

### P3 — Mocked / Fiction Features & Dead UI Components

#### TD-08: Mocked WhatsApp Web & GitHub in Split-Screen
- **Finding:** `SplitWindowLayout.tsx` (826 lines) contains a complete, mocked WhatsApp Web client with hardcoded messages ("Coal Truck CT-01 weighed", "Timothy Archer scanned in") and a mocked GitHub client with hardcoded PRs ("Opened by Timothy").
- **Impact:** Blurs the line between genuine industrial telemetry and static demonstrative prototypes.
- **Classification:** `LEGACY / MOCK`

#### TD-09: Dead Components in `@repo/ui`
- **Finding:** Multiple components are exported from `@repo/ui` but have zero active production consumers:
  - `FluidCanvas.tsx` (Fluid dynamics simulation — never rendered)
  - `LiquiButton.tsx` (LiquiDesign glass button — never rendered)
  - `CyberButton.tsx` (Glitch button — Storybook only)
  - `ActionConfirmDialog.tsx` (Replaced by toast)
- **Classification:** `UNUSED / DEAD CODE`

#### TD-10: Hardcoded User Identity in MacMenuBar
- **Finding:** `packages/ui/src/components/MacMenuBar.tsx` (lines 250-264) hardcodes the user profile in the system menu as "Arch Operator" / `admin@arch-systems.com` with initials "AO", rather than reading the authenticated user's session from Supabase.
- **Classification:** `MOCK / HARDCODED`
