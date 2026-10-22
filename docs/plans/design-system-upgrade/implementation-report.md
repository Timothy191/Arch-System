# Arch-System Design System & Iconography Upgrade: Implementation Report

**Date:** 2026-10-22  
**Status:** Completed & Verified  
**Repository:** Arch-System (Plantcor OS)

---

## 1. Summary of Implemented Upgrades

### Phase 1: Typography & Iconography Foundation

1. **IBM Plex Sans Primary Typeface (`@repo/theme` & `portal`)**:
   - Updated [`apps/portal/app/layout.tsx`](file:///home/tim/Fork/Arch-System/apps/portal/app/layout.tsx) to load `IBM_Plex_Sans` (`400`, `500`, `600`, `700`) via `next/font/google` as `--font-sans`, preserving `Inter` (`--font-inter`), `Outfit` (`--font-outfit`), `JetBrains_Mono` (`--font-mono`), and `Anurati` (`font-anurati`).
   - Updated [`packages/theme/src/tokens/typography.ts`](file:///home/tim/Fork/Arch-System/packages/theme/src/tokens/typography.ts) and [`packages/theme/src/tailwind/preset.ts`](file:///home/tim/Fork/Arch-System/packages/theme/src/tailwind/preset.ts) to include `IBM Plex Sans` in the canonical `sans` and `heading` font stacks.
2. **Central Lucide Icon Registry (`@repo/ui/icons/department-icons`)**:
   - Created [`packages/ui/src/icons/department-icons.ts`](file:///home/tim/Fork/Arch-System/packages/ui/src/icons/department-icons.ts):
     - `DEPARTMENT_ICON_REGISTRY`: Canonical Lucide icons for `admin` (`Wrench`), `access-control` (`ShieldCheck`), `production` (`Factory`), `drilling` (`Drill`), `plant-processing` (`Factory`), `plant-inventory` (`Package`), `engineering` (`Wrench`), `control-room` (`TowerControl`), `fleet` (`Truck`), `database` (`Database`), `finance` (`CreditCard`), `safety` (`HardHat`), `hr` (`GraduationCap`), `analytics` (`Orbit`), `exploration` (`Compass`), and `energy` (`Orbit`).
     - `ACTION_ICON_REGISTRY`: Standardized action symbols (`search`, `add`, `edit`, `view`, `export`, `import`, `history`, `settings`, `notifications`, `filter`, `sort`, `refresh`, `print`, `user`, `users`, `logout`, `moreHorizontal`, `moreVertical`, chevrons, `maximize`, `minimize`).
     - `STATUS_ICON_REGISTRY`: Standardized operational status symbols (`success`, `confirmed`, `warning`, `error`, `critical`, `info`, `online`, `offline`, `active`, `standby`, `stopped`, `maintenance`, `reset`, `power`, `shield`, `lock`).
     - Helper functions: `getDepartmentIcon()`, `getActionIcon()`, `getStatusIcon()`.
   - Wired `getDepartmentIcon()` into [`libs/features/hub/ui/src/DepartmentCard.tsx`](file:///home/tim/Fork/Arch-System/libs/features/hub/ui/src/DepartmentCard.tsx) and [`packages/ui/src/components/DepartmentLayout.tsx`](file:///home/tim/Fork/Arch-System/packages/ui/src/components/DepartmentLayout.tsx) (replacing the hardcoded `<BarChart3 />` in the department sidebar header with the active department's canonical icon).

### Phase 2 & 3: Shared Operational UI Primitives in `@repo/ui`

Implemented accessible, light-mode glass operational primitives in `packages/ui/src/components/ui/` and exported them from `packages/ui/src/index.ts` and `packages/ui/package.json`:

| Component              | Path                                                     | Purpose & Accessibility Features                                                                                                                                                                                                                       |
| :--------------------- | :------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<StatusBadge>`        | `packages/ui/src/components/ui/status-badge.tsx`         | Multi-state operational status indicator (`active`, `online`, `standby`, `maintenance`, `offline`, `alert`, `critical`) pairing semantic OKLCH tokens with `STATUS_ICON_REGISTRY` icons (`role="status"`, `aria-label`, never relying on color alone). |
| `<MetricCard>`         | `packages/ui/src/components/ui/metric-card.tsx`          | Industrial KPI card built on `<GlassCard>` with `font-mono tabular-nums` metrics, units, trend arrows (`ArrowUpRight`, `ArrowDownRight`, `Minus`), and `nominal` / `warning` / `critical` status borders.                                              |
| `<DataTable>`          | `packages/ui/src/components/ui/data-table.tsx`           | Generic typed table combining `<FilterToolbar>`, accessible sortable column headers (`ArrowUp`, `ArrowDown`, `ArrowUpDown`), loading skeleton rows, custom empty states, and `<Pagination>`.                                                           |
| `<FilterToolbar>`      | `packages/ui/src/components/ui/filter-toolbar.tsx`       | Accessible toolbar (`role="toolbar"`) with search input, clear button, filter control slot, and action slot.                                                                                                                                           |
| `<MachineStatusPanel>` | `packages/ui/src/components/ui/machine-status-panel.tsx` | Reusable equipment telemetry panel displaying machine ID, model, `<StatusBadge>`, uptime %, hours run, assigned operator, live telemetry key-value items, and last ping timestamp.                                                                     |
| `<ActivityTimeline>`   | `packages/ui/src/components/ui/activity-timeline.tsx`    | Audit history feed (`role="feed"`) with semantic `<article>` items, `<time>` elements, status icons, and operator attribution.                                                                                                                         |
| `<Alert>`              | `packages/ui/src/components/ui/alert.tsx`                | Semantic operational alert banner (`role="alert"`) with `default`, `info`, `success`, `warning`, and `destructive` variants and automatic Lucide status icons.                                                                                         |
| `<LoadingState>`       | `packages/ui/src/components/ui/loading-state.tsx`        | Standardized loading indicator (`role="status"`) supporting `spinner`, `skeleton`, and `card` variants with screen-reader announcements.                                                                                                               |
| `<ErrorState>`         | `packages/ui/src/components/ui/error-state.tsx`          | Standardized error feedback card (`role="alert"`) with error details and accessible retry button (`RefreshCw`).                                                                                                                                        |

---

## 2. Files Affected

- `packages/ui/src/icons/department-icons.ts` (new)
- `packages/ui/src/components/ui/status-badge.tsx` (new)
- `packages/ui/src/components/ui/metric-card.tsx` (new)
- `packages/ui/src/components/ui/data-table.tsx` (new)
- `packages/ui/src/components/ui/filter-toolbar.tsx` (new)
- `packages/ui/src/components/ui/machine-status-panel.tsx` (new)
- `packages/ui/src/components/ui/activity-timeline.tsx` (new)
- `packages/ui/src/components/ui/alert.tsx` (new)
- `packages/ui/src/components/ui/loading-state.tsx` (new)
- `packages/ui/src/components/ui/error-state.tsx` (new)
- `packages/ui/src/components/DepartmentLayout.tsx` (updated)
- `packages/ui/src/index.ts` (updated)
- `packages/ui/package.json` (updated)
- `packages/ui/AGENT_TRACER.md` (updated)
- `packages/theme/src/tokens/typography.ts` (updated)
- `packages/theme/src/tailwind/preset.ts` (updated)
- `packages/theme/AGENT_TRACER.md` (updated)
- `libs/features/hub/ui/src/DepartmentCard.tsx` (updated)
- `libs/features/hub/ui/AGENT_TRACER.md` (updated)
- `apps/portal/app/layout.tsx` (updated)
- `apps/portal/components/ui/status-badge.test.tsx` (new)
- `apps/portal/components/ui/metric-card.test.tsx` (new)
- `apps/portal/components/ui/data-table.test.tsx` (new)
- `apps/portal/AGENT_TRACER.md` (updated)
- `docs/plans/design-system-upgrade/baseline-audit.md` (new)
- `docs/plans/design-system-upgrade/implementation-report.md` (new)

---

## 3. Verification Results

| Verification Check   | Command                                                                                   | Status    | Details                                                                                                     |
| :------------------- | :---------------------------------------------------------------------------------------- | :-------- | :---------------------------------------------------------------------------------------------------------- |
| Type Checking        | `pnpm type-check`                                                                         | ✅ PASSED | 0 TypeScript errors across `@repo/ui`, `@repo/theme`, `@repo/hub/ui`, `portal`, and all workspace packages. |
| Biome Lint & Format  | `pnpm lint`                                                                               | ✅ PASSED | 0 lint or formatting errors.                                                                                |
| Component Unit Tests | `pnpm --filter portal test -- --testPathPatterns="status-badge\|metric-card\|data-table"` | ✅ PASSED | 3/3 test suites, 7/7 tests passed.                                                                          |
| Hub UI Unit Tests    | `pnpm --filter @repo/hub/ui test`                                                         | ✅ PASSED | 2/2 test suites, 22/22 tests passed.                                                                        |
| Architectural Policy | `pnpm policy:check`                                                                       | ✅ PASSED | 0 boundary violations, 0 security check failures.                                                           |
| Contract Drift Audit | `pnpm audit:drift`                                                                        | ✅ PASSED | 97 tables, 205 schemas, 100% Drift Health Index.                                                            |
| 12-Step Quality Gate | `pnpm agent:verify`                                                                       | ✅ PASSED | All 12 gates passed 100%.                                                                                   |

---

## 4. Recommended Next Steps

1. **Incremental Department Table Migration:** Gradually adopt `<DataTable>` and `<FilterToolbar>` inside individual department subviews (`access-control/access-logs`, `drilling/drilling-operations`, `plant-inventory/daily-log`) as those features are touched.
2. **Machine Telemetry Cards:** Replace inline machine cards in `drilling/machine-telemetry` and `control-room` with `<MachineStatusPanel>` and `<StatusBadge>`.
3. **Audit Log Views:** Adopt `<ActivityTimeline>` in `admin` and `access-control` audit history panels.
