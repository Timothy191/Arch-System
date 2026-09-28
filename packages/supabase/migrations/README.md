# Migrations Overview

The canonical source of truth for database schema migrations is `packages/database/migrations`.
All migrations are tracked and pushed directly to Cloud Supabase.

## Disabled Migrations

You may notice a few migrations suffixed with `.disabled`:

- `158_fix_function_search_paths.sql.disabled`: Disabled because it targets legacy schemas and functions that no longer exist or match the current architecture. Execution in a fresh reset throws fatal errors.
- `161_db_hardening.sql.disabled`: Disabled because it contains out-of-date security schemas and attempts to alter roles that clash with the actual control room hardening applied in `160_control_room_hardening.sql`.

If these legacy concepts are still needed, they should be re-implemented in a new, correctly sequenced migration file.
