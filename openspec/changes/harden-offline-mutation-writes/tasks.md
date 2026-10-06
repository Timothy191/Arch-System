# Implementation Tasks

- [x] Export the shared offline-mutation request schema and inferred types.
- [x] Add contract tests for valid, invalid, and oversized batches.
- [x] Authenticate and department-scope the offline mutation endpoint.
- [x] Add route regression tests and OpenAPI documentation.
- [x] Add migration 172 to harden RPC authorization, validation, and grants.
- [x] Add database regression coverage for RPC grants and security invariants.
- [x] Make shift-closeout SMR writes retryable and idempotent.
- [x] Confirm migration 166 is production-applied and preserve its history; document the fresh-replay prerequisite.
- [x] Run database safety/RLS checks, contract drift, full quality, build, and Vercel preflight.
- [x] Record verification and remaining deployment steps in tracer documentation.
