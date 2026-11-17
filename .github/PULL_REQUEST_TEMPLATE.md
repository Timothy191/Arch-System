## Summary

Describe the operational or engineering change and why it is needed.

## Changes

-
-

## Architectural & Security Invariants

- [ ] **Light Mode Only**: Uses semantic OKLCH tokens from `@repo/theme` (`#f3f4f6` canvas, zero `dark:` classes or raw hex values)
- [ ] **Layering Boundaries**: Respects `pnpm policy:check` (`apps/*` never imports `packages/database` directly; `packages/ui` remains pure presentation)
- [ ] **Server Action / API Security**: Protected mutations follow the Canonical 8-Step Security Sequence (`Authenticate -> Authorize -> Validate (@repo/contract) -> Rate-limit -> Execute -> Audit log -> Invalidate cache -> Return typed result`)
- [ ] **Database & RLS**: Any `public` table changes include zero-padded migrations in `packages/database/migrations/` with `(SELECT auth.uid())` + `public.employees` RLS policies and synced `@repo/contract` schemas
- [ ] **Traceability**: Workspace changes recorded in root `AGENT_TRACER.md` only (never per-package tracer files)

## Verification (`28/28` Gates)

- [ ] `pnpm install --frozen-lockfile`
- [ ] `pnpm type-check && pnpm lint && pnpm test`
- [ ] `pnpm agent:verify` (`28/28` gates passing)
- [ ] `pnpm ci:gatekeeper --from-evidence` (`6/6` required GitHub Commit Statuses green)
