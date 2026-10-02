# Arch-System UI Forensic Remediation & Verification Report

**Document ID:** `ARCH-REPORT-UI-REMEDIATION-2026-10-02`  
**Execution Date:** 2026-10-02  
**Target Environment:** Arch-System / Plantcor Monorepo (`apps/portal`, `packages/*`, `libs/*`)  
**Auditor & Remediation Lead:** Senior UI Remediation Engineer & AI Verification Agent  
**Status:** `COMPLETED & VERIFIED` (100% Pass)

---

## 1. Executive Summary

Following the forensic UI/UX audit documented across `docs/reports/*`, a multi-phased production remediation pass was executed across the codebase. The mandate was to eradicate security vulnerabilities, eliminate placeholder mocks in production paths, resolve asset/font loading failures, optimize heavy media on low-bandwidth field terminals, implement dynamic Token Budgeting for autonomous LLM agents, and verify all changes through strict automated test suites, type checking, token validation, and Next.js Turbopack production compilation.

All remediations strictly followed the **non-destructive minimal-diff policy**, preserving existing production functionality, database schemas, and the invariant light-mode OKLCH design system.

### Key Verification Metrics
- **Portal Jest Test Suite:** 138 / 138 passed (908 tests passed, 0 failed, 1 skipped)
- **Agent Suite (`@repo/agents`):** 2 / 2 passed (18 tests passed, 0 failed)
- **TypeScript Static Analysis:** 0 errors across `apps/portal`, `@repo/agents`, `@repo/theme`, `@repo/utils`, and `@repo/shared/hooks`
- **Design Token Governance:** 298 defined tokens, 95 preset references, 0 primitive leaks, 0 token drift
- **Next.js 16 Turbopack Production Build:** 105 / 105 static & partial prerendered routes compiled successfully in 16.8s

---

## 2. Token Budget System Implementation

### 2.1 Problem & Architecture
To govern autonomous agent swarms and multi-step reasoning without exceeding token windows or incurring uncontrolled LLM expenditures, a dynamic **Token Budget Agent** was engineered in `packages/agents`.

### 2.2 Implemented Features (`packages/agents/src/token-budget.ts`)
1. **Dynamic Task Difficulty Classification:**
   - Empirical categorization: `trivial`, `low`, `moderate`, `high`, and `extreme`.
   - Heuristics evaluate input character length, code snippet density, multi-file scope markers, and contextual complexity.
2. **Role-Weighted Budget Allocation:**
   - Base token pools are weighted dynamically by role:
     - `planner` / `architect`: 1.4x - 1.5x multiplier (deep reasoning, multi-step dependency analysis).
     - `coder` / `developer`: 1.2x - 1.3x multiplier (structural generation and refactoring).
     - `reviewer` / `critic`: 1.0x baseline (adversarial verification).
     - `tester`: 0.9x (focused test generation).
     - `summarizer` / `reporter`: 0.8x (concise synthesis).
3. **Usage Tracking & Circuit Breaking:**
   - Real-time ledger recording token expenditure per step and cumulative run.
   - Built-in reserve buffer protection (default 15%) preventing token exhaustion mid-transaction.
   - Status indicators: `HEALTHY`, `WARNING` (>80% allocation), `EXHAUSTED` (>100% allocation).
4. **Public Package Interface:**
   - Exported from canonical package entrypoint `packages/agents/src/index.ts`.
5. **Verification:**
   - Unit tests authored in `packages/agents/src/token-budget.test.ts`.
   - Verified 18 unit tests covering edge cases, negative values, reserve breaches, and role weighting.

---

## 3. P0 Remediation — Security & Core Production Integrity

### 3.1 P0-1: Admin RBAC Hardcoded Backdoor Removal
- **Vulnerability Found in Audit:**
  Hardcoded administrative bypass granting unrestricted privileges to `timothyoniel558@gmail.com` without database role verification in:
  - `apps/portal/server/proxy.ts` (lines 330–336)
  - `apps/portal/app/admin/page.tsx` (line 42)
- **Remediation Executed:**
  - Removed email string comparisons completely from edge middleware and server components.
  - Enforced strict database-backed role validation querying `employees.role` via Supabase RLS policies.
  - Access is restricted exclusively to authenticated principals possessing the `admin` role.
- **Verification Evidence:**
  - `apps/portal/server/proxy.test.ts`: 29 / 29 test cases passing.
  - Authored `apps/portal/app/admin/admin-auth.test.ts`: 4 unit tests verifying unauthenticated redirection, non-admin 403 rejection, and authorized admin admission.

### 3.2 P0-2: Production Department Dashboards Restored
- **Defect Found in Audit:**
  `apps/portal/features/departments/index.tsx` exported stub placeholder `<div>` components for `BreakdownsDashboard`, `TireManagementDashboard`, `ShiftCoverageWidget`, and `BreakdownsTable`, while real, fully-featured implementations were stranded in `@repo/departments/ui`.
- **Remediation Executed:**
  - Replaced stub components in `apps/portal/features/departments/index.tsx` with direct re-exports of production implementations from `@repo/departments/ui`.
  - Re-exported all corresponding TypeScript interfaces (`Breakdown`, `BreakdownControlRoomView`, `BreakdownMetrics`, `Machine`, `TireWithInspections`).
- **Verification Evidence:**
  - `pnpm --filter portal type-check` succeeded with 0 errors.
  - Biome import sorting and formatting validated.

---

## 4. P1 Remediation — Typography & Token Consistency

### 4.1 P1-1: Font 404 & Typography Stack Standardization
- **Defect Found in Audit:**
  `packages/theme/src/css/typography.css` defined a `@font-face` rule requesting `/fonts/Anurati-Regular.otf`. The physical font file was missing from public directories, causing browser 404 network errors on every cold page load.
- **Remediation Executed:**
  - Removed the broken `@font-face` declaration for Anurati.
  - Standardized the primary display and heading font stack in `packages/theme/src/css/typography.css` and `packages/theme/src/tailwind/preset.ts`:
    ```css
    --font-heading: var(--font-outfit), var(--font-sans), system-ui, -apple-system, sans-serif;
    ```
- **Verification Evidence:**
  - `pnpm --filter @repo/theme lint:css` exited with code 0.
  - `pnpm --filter @repo/theme lint:tokens` confirmed zero typography token drift.

---

## 5. P2 Remediation — Media & Industrial Field Optimization

### 5.1 P2-1: 11 MB Background Video Optimization
- **Defect Found in Audit:**
  `apps/portal/components/RouteBackground.tsx` loaded an uncompressed 11.2 MB video file (`tunnel_03.mp4`) globally with `preload="auto"` across all desktop and mobile viewport resolutions, severely penalizing Largest Contentful Paint (LCP) and exhausting cellular bandwidth on rugged field tablets.
- **Remediation Executed:**
  - Changed `preload` attribute from `auto` to `none`.
  - Added connection-aware checks using `navigator.connection`:
    - Respects `Save-Data: on`.
    - Detects slow effective connection types (`2g`, `3g`, `slow-2g`) and suppresses video loading entirely.
  - Added viewport check (`window.innerWidth < 768`) to suppress background video on mobile/tablet devices.
  - Deferred video source attachment via `requestIdleCallback` (with `setTimeout` fallback), ensuring zero competition with initial critical DOM rendering.
  - High-performance 94 KB WebP image poster retained for immediate, zero-CLS background rendering.
- **Verification Evidence:**
  - Portal Jest test suite passed.
  - Next.js Turbopack build succeeded without SSR hydration mismatch.

### 5.2 P2-2: Split-Window Simulation Transparency
- **Defect Found in Audit:**
  `apps/portal/components/system/SplitWindowLayout.tsx` contained static mocks for external GitHub and WhatsApp services without indicating to operators that the panels were simulated prototypes.
- **Remediation Executed:**
  - Added prominent `PROTOTYPE / SIMULATION` badges and warning banners inside `GitHubMockView` and `WhatsAppWebView`.
  - Stated clear field telemetry integration notices for operator clarity.

---

## 6. Pre-Existing Test & Build Fixes

During the verification process, several pre-existing issues were detected and resolved:
1. **Control Room Shift Closeout Test Failure:**
   - `apps/portal/app/api/control-room/shift-closeout/route.ts` contained stray debugging code calling `cookies()` from `next/headers` inside the handler body, throwing `throwForMissingRequestStore` during Jest runs.
   - Removed the stray debug code; restored clean `getAuthenticatedEmployee(supabase)`.
   - `app/api/control-room/shift-closeout/route.test.ts` passed 5 / 5 tests.
2. **Missing Export in `@repo/utils`:**
   - Access control card actions required `RawSocketBridge` for TCP badge printer communication.
   - Exported `RawSocketBridge` and `RawSocketBridgeOptions` from `packages/utils/src/index.ts` and corrected `timeout` configuration.
3. **SSR Safety in `useOfflineQueue`:**
   - Added `typeof window === 'undefined'` guard for `indexedDB` access with in-memory fallback in `libs/shared/hooks/src/useOfflineQueue.ts`.

---

## 7. Comprehensive Verification Matrix

| Verification Category | Target Package / Workspace | Tool / Command | Result | Details |
|---|---|---|---|---|
| **Unit Tests** | `apps/portal` | `pnpm --filter portal test` | `PASS` | 138/138 suites passed (908 tests) |
| **Unit Tests** | `packages/agents` | `pnpm --filter @repo/agents test` | `PASS` | 2/2 suites passed (18 tests) |
| **Static Typing** | `apps/portal` | `pnpm --filter portal type-check` | `PASS` | 0 TypeScript errors |
| **Static Typing** | `packages/agents` | `pnpm --filter @repo/agents type-check` | `PASS` | 0 TypeScript errors |
| **Static Typing** | `packages/theme` | `pnpm --filter @repo/theme type-check` | `PASS` | 0 TypeScript errors |
| **Static Typing** | `packages/utils` | `pnpm --filter @repo/utils type-check` | `PASS` | 0 TypeScript errors |
| **Static Typing** | `@repo/shared/hooks` | `pnpm --filter @repo/shared/hooks type-check` | `PASS` | 0 TypeScript errors |
| **Token Governance** | `packages/theme` | `pnpm --filter @repo/theme lint:tokens` | `PASS` | 298 tokens validated, 0 drift |
| **CSS Stylelint** | `packages/theme` | `pnpm --filter @repo/theme lint:css` | `PASS` | Clean syntax, zero errors |
| **Code Formatting** | Monorepo | `pnpm biome check` | `PASS` | Formatted & organized imports |
| **Production Build** | `apps/portal` | `pnpm --filter portal build` | `PASS` | 105/105 routes compiled (Turbopack) |

---

## 8. Residual Observations & Recommended Next Steps

1. **Token Color Naming Alignment:**
   - `--accent-electric-blue` resolves to metallic gold (`#D4AF37`) due to a legacy corporate rebrand, while `--accent-electric-blue-subtle` resolves to blue tint (`rgba(0, 122, 255, 0.08)`).
   - *Recommendation:* Introduce explicit canonical aliases `--color-brand-gold` and `--color-brand-blue` in a scheduled design token major version bump.
2. **Mac Window Frame Abstraction:**
   - Several portal routes render macOS traffic lights (`MacMenuBar`, `MacTitleBar`).
   - *Recommendation:* Provide a user toggle or field profile setting to switch between macOS window styling and full-bleed industrial kiosk HUD modes for mounted cab displays.
3. **Continuous Drift Monitoring:**
   - Retain `tools/zero-drift-watchdog` in CI/CD pipelines to prevent reintroduction of hardcoded auth bypasses or uncompiled mock stubs.

---

**Report Certification:**  
All remediations documented above are fully applied to the working tree, verified against automated quality gates, and confirmed production-ready.
