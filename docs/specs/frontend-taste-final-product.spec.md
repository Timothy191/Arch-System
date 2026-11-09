# EARS Specification: Frontend Taste-Skill 2.5 Final Product Upgrade

- **Spec ID**: `SPEC-FRONTEND-TASTE-250`
- **Status**: Approved
- **Created**: 2026-11-09
- **Branch**: `feat/frontend-taste-final-product`

## 1. Objective

Bring the Arch-System frontend (`packages/ui`, `libs/features/auth/ui`, `libs/features/hub/ui`, and `apps/portal`) to the Taste-Skill 2.5 (`figma.com` / `x.ai`) final-product quality standard while preserving all light-mode OKLCH tokens and unit/E2E test contracts.

## 2. Requirements (EARS Syntax)

1. **WHEN** `GlassCard` is rendered in any variant, **THE SYSTEM SHALL** render immediately at full opacity without `animate-window-open` entrance flicker, use a `2px` (`-translate-y-0.5`) hover lift and `0.985` active press scale when interactive, and exclude banned violet/purple hexes from `colorPresets`.
2. **WHEN** an unauthenticated operator views `/login`, **THE SYSTEM SHALL** display `>= 13px` (`text-[13px]`) typography across all labels, telemetry rows, and footers, render `48px` (`h-12`) form inputs with `16px` (`text-base`) input text, deduplicate the `Arch OS` version badge to a single occurrence, and provide a `32px` (`h-8 w-8`) Play/Pause control for the background mining video.
3. **WHEN** an authenticated operator views `/hub`, **THE SYSTEM SHALL** align content within equal horizontal container edges (`max-w-[1360px]`), size the module search input to `44px` (`h-11`) with `>= 13px` text, render `DepartmentCard` items with a `2px` hover lift and `1.03` banner image zoom instead of 3D perspective tilt or continuous float animations, and eliminate sub-13px badge text.
4. **WHEN** an operator views Control Room KPIs, Machine Operations, or System Overview (`/control-room`, `/control-room/machine-operations`, `/overview`), **THE SYSTEM SHALL** render sparkline readouts and KPI labels at `>= 13px` (`text-[13px]`) in sentence case without continuous scanline overlays, and size Machine Operations form fields to `48px` (`h-12`).

## 3. Constraints & Risks

- **Zero Test Regressions**: All existing unit tests in `apps/portal`, `libs/features/hub/ui`, and `libs/features/auth/ui` must pass without removing required `data-testid` or structural class hooks.
- **Tailwind Chain Limit**: Every element must maintain `<= 20` Tailwind utility classes (`pnpm audit:tailwind`).
- **Rollback**: Revert commit on `feat/frontend-taste-final-product` if any gate in `pnpm agent:verify` fails.
