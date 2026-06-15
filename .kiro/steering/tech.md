# Tech Stack

## Runtime & Tooling

- **Node.js**: `>=20.17.0` (enforced via `engines` and Volta)
- **Package manager**: `pnpm 9.12.0` (enforced via `packageManager` field)
- **Monorepo**: Turborepo 2.1.1 with pnpm workspaces
- **Language**: TypeScript throughout

## Core Frameworks & Libraries

| Layer              | Technology                                                            |
| ------------------ | --------------------------------------------------------------------- |
| Frontend framework | Next.js 15 (App Router), React 19                                     |
| Styling            | Tailwind CSS (shared config in `@repo/ui`), CSS variables for theming |
| Animations         | Framer Motion, tailwindcss-animate                                    |
| Database / Auth    | Supabase (Postgres + RLS + Auth)                                      |
| Forms / Validation | Zod                                                                   |
| Maps / GIS         | react-map-gl, maplibre-gl, deck.gl                                    |
| 3D                 | @react-three/fiber v8, @react-three/drei v9                           |
| Spreadsheet        | Univer SDK (`@univerjs/preset-sheets-core`)                           |
| Icons              | Lucide React, Heroicons                                               |
| Charts             | Tremor                                                                |
| CMS                | Payload CMS v3 (Postgres-backed)                                      |

## Testing

- **Unit**: Jest 30 + `jest-environment-jsdom` + `ts-jest`, React Testing Library
- **E2E**: Playwright (baseURL `http://localhost:3000`)

## Common Commands

```bash
# Install dependencies
pnpm install

# Development (portal only)
pnpm dev

# Build all packages
pnpm build

# Lint all packages
pnpm lint

# Format (Prettier)
pnpm format

# Unit tests (portal)
pnpm --filter portal test

# Single test file
pnpm --filter portal test -- --testPathPatterns=<file>

# E2E tests (requires running app)
pnpm test:e2e

# Type check (portal)
pnpm --filter portal type-check

# Full local stack (Supabase + build + serve)
pnpm deploy:local

# Full reset (clean install, rebuild, start)
pnpm fresh-start

# Add shadcn component to @repo/ui
pnpm ui

# Supabase local dev
cd packages/database && pnpm supabase:dev

# Push migrations to remote
cd packages/database && pnpm supabase:push

# Reset local DB
cd packages/database && pnpm supabase:reset

# Overview app (port 3002)
pnpm --filter arch-systems-overview dev
```

## Environment Variables

Copy `apps/portal/.env.example` → `apps/portal/.env` and fill in:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (client-side)
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY` (server-side)
- `DATABASE_URL`, `PAYLOAD_SECRET` (CMS app)
- `GROQ_API_KEY`, `OPENROUTER_API_KEY`, `TOGETHER_API_KEY` (AI providers)
- `N8N_URL`, `FLOWISE_URL` (optional tool integrations)
- `PORT` (optional, default 3000)

> **Never** expose `SUPABASE_SERVICE_KEY` in `NEXT_PUBLIC_*` vars or client-side code.
