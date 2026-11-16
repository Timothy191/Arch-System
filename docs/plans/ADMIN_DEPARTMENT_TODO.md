# Administration Department — Implementation TODO

## P0 — Security / RBAC

- [x] Verify hardcoded admin email bypass removed from `app/admin/page.tsx`
- [x] Enforce admin role-only access in `app/admin/layout.tsx` and all admin API routes
- [x] Add Zod validation for POST/PUT/DELETE `/api/admin/data/[table]`
- [x] Add audit logging for POST inserts
- [x] Extend rate limiting to user/role, department, site, machine, settings mutations
- [x] Verify `revokePrivilegeCache()` called on all role/department/access changes

## P1 — Functional completeness

- [x] Implement additional system settings beyond card templates
- [x] Remove optional migration fallbacks (037/080/185)
- [x] Improve admin navigation for 12 tabs
- [x] Verify external content indexing reliability
- [x] Harden webhook delivery/retry/signature handling
- [x] Wire webhook triggers to current operational tables and cron delivery worker

## P2 — Data integrity / contract

- [x] Ensure contract parity for all `OPERATIONAL_TABLES`
- [x] Document service-role usage and RLS coverage
- [x] Remove deprecated `operational_delays` references

## P3 — Testing / QA

- [x] Add tests for all admin tabs
- [x] Expand admin data API route tests
- [ ] Add admin E2E flows

## P4 — UX / accessibility / observability

- [x] Run accessibility audit on admin
- [x] Improve admin observability surfaces
- [x] Verify cache invalidation after admin mutations

## Verification

- [x] `pnpm --filter portal type-check`
- [x] `pnpm --filter portal test -- --testPathPatterns="admin"`
- [x] `pnpm audit:drift`
- [x] `pnpm audit:rls-matrix`
- [x] `pnpm audit:auth-matrix`
- [x] `pnpm agent:verify:fast`
