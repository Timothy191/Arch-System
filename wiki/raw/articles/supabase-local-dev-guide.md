---
source_url: file:///home/timothy/Project/Arch-Mk2/packages/supabase/README.md
ingested: 2026-05-14
sha256: 3e87dc6a98c255e7329f54b9f44532248440775b60e46854bb44a83e3d6e40af
---

## Local Supabase Development

### Prerequisites

Docker installed and running.
pnpm package manager.
Supabase CLI (installed via devDependencies).
A Supabase account with an existing project (for linking remote DB).

### Setup and Running Locally

1. Install dependencies: `pnpm install`.
2. Initialize Supabase config: `pnpm run supabase:link`.
3. Start local Supabase: `pnpm run supabase:dev`.
4. Access Supabase Studio: Open <http://127.0.0.1:54323>

### Environment Variables

After running `pnpm run supabase:dev`, the output displays database URL and keys. Add these to `.env`.

### Linking and Syncing with Remote DB

1. Link to remote project: Update `supabase:link` script in package.json with your project ID, then run `pnpm run supabase:link`.
2. Pull remote schema: `pnpm run supabase:pull`.
3. Push local changes: `pnpm run supabase:push`.

### Best Practices

- Commit all migration files to version control for team consistency and rollback.
- Use local Supabase for development and testing; switch to remote for staging/production via environment variables.
- Reset the local database with `supabase db reset` before applying major schema changes.
- Never hardcode sensitive keys; always use environment variables and add them to `.gitignore`.
- Enable and test Row Level Security (RLS) policies in the local Studio dashboard to catch issues early.
- Pull remote changes frequently with `supabase db pull` to stay in sync.
