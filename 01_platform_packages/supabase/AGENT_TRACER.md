# Agent Tracer - @repo/supabase

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
  - Added `BreakdownControlRoomView` interface to `00_applications/portal/features/departments/components/engineering/breakdowns/types.ts`
  - Updated `EngineeringNotesForm.tsx` to use the new interface
- **Files touched**: `src/database.types.ts`, `00_applications/portal/features/departments/components/engineering/breakdowns/types.ts`, `00_applications/portal/app/(departments)/[department]/engineering-notes/EngineeringNotesForm.tsx`
- **Status**: Type-check passes cleanly, migration applied to local database.
- **Next Steps**: When Supabase CLI is properly authenticated, run `pnpm --filter @repo/database supabase:gen` to regenerate full type definitions and migrate away from manual additions.

## [2026-06-24T07:59:00Z] Phase 1: Architecture and Data Layer

**Purpose:** Updated database types to reflect new employee profile fields.
**Changes:**

- Updated `manual-types.ts` interfaces (`EmployeesRow`, `EmployeesInsert`, `EmployeesUpdate`) to include the new fields: `first_name`, `last_name`, `national_id`, `job_title`, `areas`, `medical_expiry_date`, `induction_expiry_date`, `qr_code_data`, and `photo_url`.
  **Next Agent Notes:** Forms interacting with employee data can now use these strongly typed fields.
