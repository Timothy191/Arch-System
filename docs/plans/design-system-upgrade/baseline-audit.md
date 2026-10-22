# Arch-System Design System & Iconography Upgrade: Baseline Audit

**Date:** 2026-10-22  
**Status:** Completed  
**Repository:** Arch-System (Plantcor OS)

---

## 1. Executive Summary

This baseline audit evaluates the existing `Arch-System` frontend design system across the Turborepo + pnpm monorepo (`apps/portal`, `packages/ui`, `packages/theme`, `libs/features/{auth,departments,hub}`). The objective is to standardize typography (`IBM Plex Sans`), Lucide React iconography, and shared operational UI primitives in `@repo/ui` while preserving strict architectural boundaries, light-mode invariants (`#f3f4f6` canvas + OKLCH semantic tokens), and backend authorization.

---

## 2. Monorepo & Design System Inventory

### 2.1 Typography & Design Tokens (`@repo/theme` & `apps/portal/app/layout.tsx`)

- **Token SSoT:** `packages/theme/tokens.json` → compiled via Style Dictionary (`sd.config.mjs`) into CSS variables (`packages/theme/src/css/variables.css`) and TypeScript token maps (`packages/theme/src/tokens/`).
- **Tailwind Preset:** `packages/theme/src/tailwind/preset.ts` provides unified spacing (`0.5x` through `4xl`), fluid typography (`text-fluid-*`), OKLCH color tokens with alpha-modifier support (`withAlpha`), and glass surface tokens.
- **Typefaces:**
  - Primary sans-serif: `IBM Plex Sans` (`--font-sans`), with `Inter` (`--font-inter`) and `Outfit` (`--font-outfit`) in the font stack.
  - Monospace telemetry: `JetBrains Mono` (`--font-mono`).
  - Display / Department headers: `Anurati` (`font-anurati`).
- **Theme Mode Invariant:** Strict Light Mode (`data-theme="light"`, `#f3f4f6` canvas) for outdoor industrial pit legibility. `dark:` Tailwind variants are prohibited by `001-light-mode-invariants.mdc` and `pnpm audit:tokens`.

### 2.2 Existing `@repo/ui` Component Inventory

inspected prior to adding any new primitives:

| Category                           | Existing Components in `packages/ui/src/`                                                                                                                                                                                                                                                                                                 |
| :--------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Application Shell & Navigation** | `MacMenuBar.tsx`, `MacTitleBar.tsx`, `DepartmentLayout.tsx`, `PageHeader.tsx`, `ui/breadcrumb.tsx`, `ui/command-menu.tsx`, `ui/dropdown-menu.tsx`, `ui/context-menu.tsx`, `ui/menu.tsx`, `ui/dots-menu.tsx`, `ui/dock.tsx`, `ui/drawer.tsx`, `ui/tabs.tsx`, `ShiftToggle.tsx`                                                             |
| **Surfaces & Containers**          | `GlassCard.tsx` (`default`, `window`, `spotlight`, `glowborder`, `liquid`), `BorderBox.tsx`, `Divider.tsx`, `ui/card.tsx`, `ui/bento-grid.tsx`, `ui/collapse.tsx`, `ui/scroll-area.tsx`, `ui/separator.tsx`, `ui/shine-border.tsx`                                                                                                        |
| **Forms & Controls**               | `FormFields.tsx`, `Input.tsx`, `Checkbox.tsx`, `SecondaryButton.tsx`, `AcknowledgeButton.tsx`, `ui/button.tsx`, `ui/input.tsx`, `ui/clearable-input.tsx`, `ui/PrecisionInput.tsx`, `ui/textarea.tsx`, `ui/select.tsx`, `ui/combobox.tsx`, `ui/checkbox.tsx`, `ui/calendar.tsx`, `ui/label.tsx`, `ui/fieldset.tsx`, `ui/freeze-toggle.tsx` |
| **Data Display & Telemetry**       | `KPI.tsx`, `HeroRotator.tsx`, `HeroCardContent.tsx`, `WorkflowStatusBadge.tsx`, `Clock.tsx`, `ui/table.tsx`, `ui/pagination.tsx`, `ui/badge.tsx`, `ui/gauge.tsx`, `ui/telemetry-chart.tsx`, `ui/number-ticker.tsx`, `ui/animated-number.tsx`, `ui/avatar.tsx`, `ui/avatar-group.tsx`                                                      |
| **Feedback, Overlays & States**    | `EmptyState.tsx`, `CookieConsent.tsx`, `ui/dialog.tsx`, `ui/animated-dialog.tsx`, `ui/action-confirm-dialog.tsx`, `ui/sonner.tsx`, `ui/skeleton.tsx`, `ui/glass-skeleton.tsx`, `ui/loader.tsx`, `ui/loading-dots.tsx`, `ui/reveal-loader.tsx`                                                                                             |

---

## 3. Identified Gaps & Inconsistencies

1. **Fragmented Department & Action Iconography:**
   - `libs/features/hub/ui/src/DepartmentCard.tsx`, `packages/ui/src/components/DepartmentLayout.tsx`, and `packages/ui/src/components/MacMenuBar.tsx` each maintained separate local `ICON_MAP` objects.
   - `DepartmentLayout.tsx` rendered a hardcoded `<BarChart3 />` in the sidebar header instead of the active department's canonical icon.
2. **Primary Sans-Serif Font Binding:**
   - `apps/portal/app/layout.tsx` bound `Inter` directly to `--font-sans` and `packages/theme/src/tokens/typography.ts` referenced `--font-space-grotesk` instead of `IBM Plex Sans`.
3. **Missing Reusable Operational Primitives in `@repo/ui`:**
   - While low-level `ui/table.tsx` and `ui/pagination.tsx` existed, there was no shared `<DataTable>` combining search filtering, column sorting, empty states, loading skeletons, and pagination.
   - No shared `<StatusBadge>`, `<MetricCard>`, `<MachineStatusPanel>`, `<ActivityTimeline>`, `<FilterToolbar>`, `<Alert>`, `<LoadingState>`, or `<ErrorState>` in `@repo/ui`, causing department routes to rebuild these patterns inline.

---

## 4. Baseline Verification Status

| Check                     | Command             | Baseline Result                            |
| :------------------------ | :------------------ | :----------------------------------------- |
| Type Check                | `pnpm type-check`   | ✅ PASS                                    |
| Lint & Format             | `pnpm lint`         | ✅ PASS                                    |
| Architectural Policy      | `pnpm policy:check` | ✅ PASS                                    |
| Contract Drift            | `pnpm audit:drift`  | ✅ PASS (97 tables, 205 schemas, 100% DHI) |
| 12-Step Verification Gate | `pnpm agent:verify` | ✅ PASS (12/12 gates)                      |
