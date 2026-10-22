# Database Admin Department (`(departments)/database`)

## Overview

The **Database Admin** department route module (`apps/portal/app/(departments)/database/`) provides real-time PostgreSQL 17 schema introspection, Row Level Security (RLS) InitPlan compliance telemetry, live read-replica row counts, and migration ledger inspection across the Arch-System operational schema.

## Route Structure

- `page.tsx` (`DatabaseDashboardPage`): Async React Server Component that queries live row counts across core domain tables via `createReadReplicaClient()` with graceful fallback to Standby mode when offline.
- `layout.tsx` (`DatabaseLayout`): Department shell wrapping child routes with `ActiveDepartmentSetter` and `DepartmentLayout`.
- `loading.tsx` (`DatabaseLoading`): Accessible Light Mode skeleton loader (`aria-busy="true"`, `aria-label="Loading database operations"`).
- `error.tsx` (`DatabaseError`): Client error boundary delegating to `ErrorFallback` with retry capability.
- `panels/page.tsx`: Interactive provisioning panels for personnel, badges, and operational configuration.
- `schemas/page.tsx`: Full column and foreign-key relationship explorer for `public.*` domain tables.
- `page.test.tsx`: Co-located BDD unit test suite verifying `DatabaseDashboardPage`, `DatabaseLayout`, `DatabaseLoading`, and `DatabaseError`.
