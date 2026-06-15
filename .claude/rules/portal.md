# Portal App

## Configuration

- **Config file**: `apps/portal/next.config.mjs` (not `.ts`). Configures PWA (`@ducanh2912/next-pwa`), Sentry, and `transpilePackages: ["@repo/ui", "@repo/supabase", "@repo/utils", "@repo/redis", "@repo/theme"]`.
- **Server Actions**: A root `app/actions.ts` (and `actions.test.ts`) co-locates shared Server Actions at the app level.
- **Environment**: Copy `apps/portal/.env.example` to `apps/portal/.env` and populate Supabase credentials before running `pnpm dev`.
- **Build behavior env vars**:
  - `ENABLE_HEAVY_PLUGINS=true` — Enables PWA, Sentry source maps, and standalone output. Defaults off locally.
  - `SKIP_TYPE_CHECK=true` — Bypasses TypeScript errors during Next.js build.
  - `ANALYZE=true` — Enables bundle analyzer.

## Path Aliases

The `apps/portal/tsconfig.json` defines:

- `~/*` and `@/*` → `apps/portal/*`
- `@/app/*`, `@/features/*`, `@/components/*`, `@/lib/*`, `@/hooks/*` → respective subdirectories

**Jest module resolution**: Portal Jest uses explicit `moduleNameMapper` entries in `apps/portal/jest.config.js`. When importing a new workspace package or subpath in portal code, add the corresponding Jest mapping or tests will fail with module-not-found. Wildcard patterns alone may not resolve correctly for all `@repo/ui` subpaths.

## Route Groups

The portal App Router uses route groups to scope layouts and navigation:

- `(auth)/` — Login, reset-password, update-password. Uses auth-specific layout with `AnimatedWavesBackground`.
- `(departments)/[department]/` — Dynamic department dashboards (drilling, production, access-control, engineering, control-room, safety, training, satellite-monitoring) plus static routes (e.g. `drilling/drilling-operations/`, `engineering/tire-management/`).
  - **Static department sub-pages**: Routes like `drilling/drilling-operations/` must define their own `layout.tsx` that re-exports `DepartmentLayout`.
- `(hub)/` — Central landing page and executive view.
- `api/` — API routes and Server Actions co-located with features. Categories: `ai/` (chat, predict), `c66/` (hardware, exempt from auth), `export/`, `health/`, `inngest/`, `plugins/`, `sync/`, `tools/`, `webhooks/`.
- `admin/` — Admin panel.

## Global UI Shell

`app/layout.tsx` mounts the global shell: `ArchThemeProvider`, `OfflineBanner`, `AnimatedWavesBackground`, and `AIAssistantSidebarWrapper`. Any new global wrapper should be added there.

## Server Actions & Data Fetching

- **Server Actions**: Co-located near the feature that uses them, often as `actions.ts` in a route or feature directory.
- **API routes**: Under `app/api/`. Examples: `ai/chat`, `ai/predict`, `export`, `sync`, `tools`, `webhooks`.
- **State management**: Zustand for client-side global state. Server Actions for mutations. No `console.log` in production code paths.

## Testing

- **Unit**: Jest + ts-jest + jsdom + Testing Library. Config: `apps/portal/jest.config.js`.
- **Coverage thresholds**: 70% lines, 70% branches, 70% functions, 70% statements.
- **E2E**: Playwright. Config: `playwright.config.ts` at the repo root.
- **Running tests**: E2E tests require the dev server running on port 3000. Unit tests do not.
- **Eval**: Python/DeepEval suite in `packages/eval/` for AI code generation compliance.

## CI Verification Order

Lint → Type-check → Test → Build. Run `pnpm quality` locally before pushing (includes lint:tokens, lint:css, format-check, lint-root, deps:lint, and knip).

CI also runs: `pnpm knip` (dead code), `pnpm md:lint` (markdown), `pnpm bundlesize` (bundle size), and `pnpm install --frozen-lockfile`.
