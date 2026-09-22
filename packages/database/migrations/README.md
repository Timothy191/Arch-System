# Migrations Overview

This directory is the canonical source of truth for the database schema migrations.
During the build or development lifecycle, these migrations are synced to `packages/supabase/migrations` (the directory that the local Supabase CLI actually executes from).
Do NOT edit migrations directly in `packages/supabase/migrations`.

## Disabled Migrations

You may notice a few migrations suffixed with `.disabled`:

- `158_fix_function_search_paths.sql.disabled`: Disabled because it targets legacy schemas and functions that no longer exist or match the current architecture. Execution in a fresh reset throws fatal errors.
- `161_db_hardening.sql.disabled`: Disabled because it contains out-of-date security schemas and attempts to alter roles that clash with the actual control room hardening applied in `160_control_room_hardening.sql`.

If these legacy concepts are still needed, they should be re-implemented in a new, correctly sequenced migration file.
