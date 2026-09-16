# Phased Action Plan: Vercel React Best Practices Implementation

## Strategic Vision & Problem Framing

The objective is to implement the architectural recommendations identified during the Vercel React Best Practices review of Arch-Systems:

1. **Standardize Server Action Error & Return Protocol**: Replace raw `throw new Error(...)` with standardized `{ success: boolean, data?: T, error?: string, code?: string }` responses using `@repo/errors` to prevent unhandled client-side rejections and enforce consistent error reporting across Server Actions.
2. **Consolidate Feature Widget Dynamic Imports**: Streamline route-level dynamic imports in `apps/portal/app/(departments)/[department]/` into a consolidated feature widget island to reduce React tree reconciliation passes and bundle fragmentation.
3. **Verify Compliance with Quality Gate & Invariants**: Ensure full compliance with strict light mode invariants, zero `any`/`@ts-ignore`, 100% test passing rate, and architectural boundary constraints.

## Scope Breakdown

- **Wave 1: Server Action Response & Error Protocol Standardisation**
  - Refactor `apps/portal/app/actions.ts` to return standard typed responses and handle validation/authorization with `@repo/errors`.
  - Update unit tests in `apps/portal/app/actions.test.ts` to validate standard responses and error codes.
- **Wave 2: Dynamic Widget Consolidation**
  - Implement `ControlRoomWidgets.tsx` in `apps/portal/app/(departments)/[department]/` to co-locate and bundle dynamic control room widgets (`ScadaPanel`, `AlertPanel`, `ControlRoomActivityFeed`, `ControlRoomChecklistWidget`, `ShiftCoverageSectionClient`).
  - Refactor `apps/portal/app/(departments)/[department]/page.tsx` to consume the consolidated widget boundary with granular Suspense skeletons.
- **Wave 3: Verification & Quality Gate**
  - Execute full test suite (`pnpm --filter portal test`).
  - Verify lint, type checks, and monorepo quality gates (`pnpm type-check`).
