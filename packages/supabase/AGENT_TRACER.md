# Agent Tracer - @repo/supabase

## 2026-08-17 - Fix seed.sql Machine Lookup for Fleet Migration Compatibility

- **Purpose**: Prevent `null value in column "machine_id" of relation "hourly_loads"` error during `supabase start` / `seed.sql` execution following fleet table migration 051.
- **Changes**:
  - `seed.sql`: Updated machine lookup to query active fleet dump trucks (`DT12`/`DT13`) instead of legacy deleted machine names (`GEN-A`/`GEN-B`), with explicit null-guards on all relation inserts.
  - Registered canonical user launcher for Supabase CLI in `~/.local/bin/supabase` (v2.106.0).

## 2026-08-17 - Synchronize Database Types from Remote Supabase (mrwhtxbhrzyttlsyuofc)

- **Purpose**: Synchronize `src/database.types.ts` directly from the active remote Supabase project `mrwhtxbhrzyttlsyuofc`.
- **Changes**:
  - Ran `supabase gen types typescript --project-id mrwhtxbhrzyttlsyuofc` and updated `src/database.types.ts`.
  - Verified TypeScript compilation across all 25 monorepo projects.
- **Files touched**: `src/database.types.ts`, `AGENT_TRACER.md`.
- **Status**: Type-check passes across all packages (25/25 projects).
- **Next agent**: Types are fully synced with the remote PostgreSQL schema on project `mrwhtxbhrzyttlsyuofc`.

## 2026-08-15 - Hosted Supabase dev setup: disable LAN URL hostname rewrite

- **Purpose**: Support hosted/cloud Supabase (project ref `mrwhtxbhrzyttlsyuofc`) for dev without breaking the LAN on-prem deployment.
- **Changes**:
  - `src/client.ts`: the browser enablement hostname-rewrite now runs only for non-HTTPS (LAN) Supabase URLs. Hosted/cloud Supabase is always `https://<ref>.supabase.co`, and rewriting that to the window hostname redirected every client call to the portal itself (this was breaking auth/data on hosted even from `localhost:3000`). LAN URLs (`http://<ip>:54321`) still rewrite as before.
- **Files touched**: `src/client.ts`.
- **Status**: Type-check pending; quality gate will not run (Docker not installed at time of change), verified via targeted pnpm type-check.
- **Next agent**: Env var consumers standardized on `*_ANON_KEY` (publishable key value maps into `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_ANON_KEY`); `SUPABASE_SERVICE_KEY` still required for `createServiceRoleClient()` callers (admin/data, c66, shift-integrity, warmup, hourly-loads).

## 2026-06-17 - Quality Gate Fix: Database Types Stub

- **Purpose**: Fix empty `database.types.ts` causing TypeScript compilation failures in quality gate.
- **Changes**:
  - Added stub `Database` interface to `src/database.types.ts` to satisfy TypeScript until `supabase:gen` can run against a migrated local database.
  - Updated `src/index.ts` to re-export `Database` from `database.types.ts` and `Json` from `manual-types.ts` to avoid duplicate type definition.
- **Files touched**: `src/database.types.ts`, `src/index.ts`.
- **Status**: Type-check now passes cleanly. Quality gate passes.

## 2026-06-16 - Export Database Types from Entry Point

- **Purpose**: Fix IDE unused export errors for generated database types.
- **Changes**:
  - Re-exported `Database` and `Json` types from `database.types.ts` in the main entry point `src/index.ts` so they are marked as public entry-point exports.
- **Status**: Completed database types export integration.
- **Next Steps**: None.

## 2026-06-16 - Create Manual Type Stubs for Missing Tables

- **Purpose**: Provide TypeScript type definitions for database tables that exist in SQL migrations but are absent from the stale auto-generated `database.types.ts`.
- **Changes**:
  - Created `src/manual-types.ts` with Row/Insert/Update interfaces for 10 tables: departments, employees, personnel, visitors, badges, access_logs, card_printers, card_templates, print_jobs, issued_cards.
  - Re-exported all 30 manual type interfaces from `src/index.ts` so consumers can import them via `@repo/supabase`.
- **Files touched**: `src/manual-types.ts` (new), `src/index.ts` (updated).
- **Status**: Type-check passes cleanly.
- **Next Steps**: When a fully-migrated local Supabase instance is available, run `supabase:gen` and migrate away from manual types.

## 2026-06-20 - Engineering Breakdown Sharing Type Definitions

- **Purpose**: Add TypeScript type definitions for the new breakdowns_control_room_view and shared_with_departments column after migration 077 was applied.
- **Changes**:
  - Added `Views` section to `database.types.ts` Database interface with `breakdowns_control_room_view` Row type
  - Defined the view schema with only the required fields: id, fleet_id, machine_name, machine_type, reason, date_in, time_in, date_out, status, created_at
  - Added `BreakdownControlRoomView` interface to `apps/portal/features/departments/components/engineering/breakdowns/types.ts`
  - Updated `EngineeringNotesForm.tsx` to use the new interface
- **Files touched**: `src/database.types.ts`, `apps/portal/features/departments/components/engineering/breakdowns/types.ts`, `apps/portal/app/(departments)/[department]/engineering-notes/EngineeringNotesForm.tsx`
- **Status**: Type-check passes cleanly, migration applied to local database.
- **Next Steps**: When Supabase CLI is properly authenticated, run `pnpm --filter @repo/database supabase:gen` to regenerate full type definitions and migrate away from manual additions.

## [2026-06-24T07:59:00Z] Phase 1: Architecture and Data Layer

**Purpose:** Updated database types to reflect new employee profile fields.
**Changes:**

- Updated `manual-types.ts` interfaces (`EmployeesRow`, `EmployeesInsert`, `EmployeesUpdate`) to include the new fields: `first_name`, `last_name`, `national_id`, `job_title`, `areas`, `medical_expiry_date`, `induction_expiry_date`, `qr_code_data`, and `photo_url`.
  **Next Agent Notes:** Forms interacting with employee data can now use these strongly typed fields.
