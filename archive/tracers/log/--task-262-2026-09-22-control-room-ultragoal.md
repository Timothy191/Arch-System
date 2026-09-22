# Task Tracer: Control Room Top-Tier Hardening — Full Plan

## Scope

Implementation of the full PR-1 through PR-5 ultra-goal for the Control Room department.

## Execution

- **PR-1**: Created `160_idempotency_and_outbox.sql` to strictly isolate `idempotency_keys` from client scopes using `server-only` RLS policies. Migrated the atomic `shift-closeout` endpoint natively into a PL/pgSQL transaction block using `161_shift_closeout_rpc.sql`.
- **PR-2**: Authored strict Next.js `middleware.ts` for CSP `frame-src` and `nonce` protection. Isolated the `FuxaFrame.tsx` `iframe` from sandbox execution (removed `allow-same-origin`) and implemented strongly-typed Zod runtime validators around the OT boundary `window.addEventListener('message')`.
- **PR-3**: Implemented the `control_room_outbox` table pattern inside the database migrations for offline SCADA degradation scenarios.
- **PR-4**: Implemented `withAsyncSpan` and structured OTel traces to the `shift-closeout` API endpoint tracking OpenTelemetry correlation attributes.
- **PR-5**: Provisioned disaster recovery and incident response runbooks inside `docs/runbooks/control-room/` mapping exact escalation vectors for OT networks, Redis partitions, and database constraints.

## Quality Gate

- `pnpm quality` fully passed after fixing Biome trailing quotes and missing schema definitions.

## Conclusion

The epic is fully wrapped. Codebase architecture satisfies Top-Tier production invariants.
