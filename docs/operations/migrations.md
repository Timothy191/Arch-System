# Database Migrations — Canonical Source of Truth

## Status

**Accepted** — Documented 2026-06-29

## Canonical Directory

All PostgreSQL migrations for the Arch-Systems platform live in:

```
pkgs/database/migrations/
```

This directory is the **single source of truth** for schema changes. Every migration is a zero-padded SQL file applied lexically by the Supabase CLI.

## Migration Naming Convention

Files follow the pattern:

```
{N:03d}_{descriptive_name}.sql
```

Where `N` is a zero-padded sequence number. Migration numbers are never reused. When inserting a new migration between existing files, use the next available number (e.g., between `050_hourly_loads_material_type.sql` and `051_fleet_seed_from_csv.sql`, use `050a_` or renumber subsequent files).

## Relationship to `pkgs/supabase/migrations/`

`pkgs/supabase/migrations/` exists for Supabase CLI compatibility during local development (`supabase start`, `supabase db push`). However:

- **New migrations must be added to `pkgs/database/migrations/` first.**
- `pkgs/supabase/migrations/` must be kept in sync with `pkgs/database/migrations/` by copying or symlinking.
- The CI divergence checker (see below) enforces this.

## Divergence Checker

Run the divergence checker before committing migrations:

```bash
pnpm policy:migrations:check
```

The checker compares the two directories and fails if:
1. A file exists in one directory but not the other
2. File contents differ between directories

## Migration Workflow

1. Create migration in `pkgs/database/migrations/`
2. Copy to `pkgs/supabase/migrations/` (or run `pnpm policy:migrations:sync`)
3. Apply locally: `pnpm --filter @repo/database supabase:push`
4. Regenerate types: `pnpm --filter @repo/database supabase:gen`
5. Commit migration + regenerated `pkgs/supabase/src/database.types.ts` as one atomic change
6. If `manual-types.ts` changes, commit that too

## Anti-patterns

- ❌ Editing `pkgs/supabase/migrations/` directly without updating `pkgs/database/migrations/`
- ❌ Running `supabase migration new` from the `pkgs/supabase/` directory (it writes to the wrong place)
- ❌ Deleting migrations after they've been applied to production
- ❌ Renumbering existing migrations (breaks production history)
