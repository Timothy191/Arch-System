# Arch-Systems Portal

Next.js 15 App Router application for the Arch-Systems (Plantcor) mining operations portal.

## Quick Start

```bash
pnpm dev          # Start dev server on :3000
pnpm build        # Production build
pnpm test         # Run Jest unit tests
```

## Structure

- `app/` — App Router routes (auth, hub, departments, admin, api)
- `features/` — Feature-based components (departments, hub, shared, admin)
- `lib/` — Server-side logic (ai, analytics, jobs, observability, sync)
- `components/` — Global UI components

## Environment

Copy `.env.example` to `.env` and fill in Supabase credentials before running.

See root `CLAUDE.md` for full technical guide.
