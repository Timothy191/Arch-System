# Tasks: Vercel React Best Practices Implementation

## Wave 1: Server Actions Standardisation (Linked to REQ-SA-01..05)

- [x] Refactor `apps/portal/app/actions.ts` to return standard typed `{ success, data, error, code }` payloads and handle errors using `@repo/errors`.
- [x] Update `apps/portal/app/actions.test.ts` to match standard return signatures and verify rejection/error-handling behaviors.
- [x] Run `pnpm --filter portal test -- app/actions.test.ts` to verify unit test green status.

## Wave 2: Dynamic Widget Consolidation (Linked to REQ-WIDGET-01..03)

- [x] Create `apps/portal/app/(departments)/[department]/ControlRoomWidgets.tsx` wrapping control room sub-widgets with granular Suspense skeletons.
- [x] Refactor `apps/portal/app/(departments)/[department]/page.tsx` to use `ControlRoomWidgets` dynamic import, cleaning up individual top-level dynamic imports.
- [x] Verify light mode invariants and layout integrity.

## Wave 3: Quality Verification & Audit (Linked to REQ-QA-01..02)

- [x] Run `pnpm --filter portal test -- app/actions.test.ts` and related department tests.
- [x] Run `pnpm type-check` across the monorepo.
- [x] Document changes in `AGENT_TRACER.md`.
