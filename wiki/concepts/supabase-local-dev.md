---
title: Supabase Local Development
created: 2026-05-14
updated: 2026-05-16
type: concept
tags: [system, infrastructure, database, process]
sources:
  [
    raw/articles/supabase-local-dev-guide.md,
    raw/articles/arch-systems-project-overview.md,
  ]
confidence: high
---

# Supabase Local Development

Local Supabase development setup for the Arch-Systems monorepo.

## Prerequisites

- Docker installed and running
- pnpm package manager
- Supabase CLI (via devDependencies)
- Supabase account with existing project (for remote linking)

## Setup Flow

1. `pnpm install`
2. `pnpm run supabase:link` — link local DB to remote project
3. `pnpm run supabase:dev` — start local stack (DB, auth, storage) via Docker
4. Open Supabase Studio at `http://127.0.0.1:54323`

## Environment Variables

After `supabase:dev`, the CLI outputs database URL and keys. Add these to `.env`.

## Remote Sync

- **Pull remote schema:** `pnpm run supabase:pull`
- **Push local changes:** `pnpm run supabase:push`

## Common Commands

```bash
cd packages/database

pnpm supabase:dev      # Start local Supabase stack
pnpm supabase:reset    # Reset local DB (wipes data)
pnpm supabase:push     # Push migrations to remote
pnpm supabase:pull     # Pull remote schema changes
pnpm supabase:link     # Link to remote project
```

## Best Practices

- Commit all migration files for team consistency and rollback
- Use local Supabase for dev/testing; switch env vars for staging/production
- Reset local DB with `supabase db reset` before major schema changes
- Never hardcode sensitive keys; use environment variables and `.gitignore`
- Enable and test RLS policies in local Studio to catch issues early
- Pull remote changes frequently with `supabase db pull`

## Troubleshooting

### Docker not running

```bash
docker info  # Check if Docker daemon is running
sudo systemctl start docker  # Start if needed
```

### Port conflicts

Supabase uses ports 54321 (API), 54322 (Studio), 54323 (Studio proxy), 54324 (PG). Check for conflicts:

```bash
lsof -i :54321  # Check if port is in use
```

### Migration drift

If local and remote schemas diverge:

```bash
pnpm supabase:reset   # Wipe local and re-apply all migrations
pnpm supabase:dev     # Restart with clean state
```

### Auth not working locally

- Verify `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `.env` match the CLI output
- Check that `handle_new_user()` trigger exists and is enabled
- Ensure RLS policies are not blocking the auth flow

## Related

- [[rls-policy]] — Row Level Security policies enforced in Supabase
- [[arch-systems]] — the product using this setup
- [[database-schema]] — full schema documentation
