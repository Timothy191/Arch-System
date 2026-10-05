# Arch-System — Development Commands

> Extracted from the former monolithic `AGENTS.md`. Loaded on demand.

## Development Commands

### Package Management & Setup

```bash
# Bootstrap entire repository (Node validation, dependencies, tokens, policies)
./setup.sh

# Bootstrap with clean slate
./setup.sh --clean

# Install via pnpm directly (runs postinstall: patch-glass-css.mjs)
pnpm install
```

### Development & Local Run

```bash
# Full interactive local dev system (smart asset sync + Turbopack + Monitor HUD)
pnpm dev

# Fast development server targeting the portal application directly
pnpm dev:turbo

# Fast headless startup
pnpm dev:quick

# Start development companion services in Docker (Postgres, Redis, tools)
pnpm dev:tools

# Start local AI tooling stack (Docker)
pnpm dev:ai

# Start dev server with Cloudflare tunnel
pnpm dev:cloudflare

# Start dev server connecting to hosted remote services
pnpm dev:hosted

# Start Storybook component workbench (port 6006)
pnpm --filter @repo/ui storybook

# Start local Inngest background event dev server
pnpm inngest:dev
```

### Build & Production

```bash
# Full monorepo build via Turborepo (syncs assets + builds all packages)
pnpm build

# Build only the portal application
pnpm --filter portal build

# Start production Next.js server (binds to 0.0.0.0:3000)
pnpm start

# Clear Next.js, Turborepo, and system runtime caches
pnpm clean:caches

# Analyze production bundle distribution
pnpm analyze
```

### Type Checking, Linting & Quality

```bash
# Comprehensive full-suite quality verification (Turborepo lint, typecheck, test, tokens, CSS, knip, policy, gates)
pnpm quality

# Type-check all packages via Turborepo (tsc --noEmit)
pnpm type-check

# Type-check single workspace
pnpm --filter @repo/contract type-check
pnpm --filter portal type-check

# Format entire codebase with Biome
pnpm format

# Verify formatting compliance without modifying files
pnpm format:check

# Run Biome linter across all workspaces
pnpm lint

# Auto-fix linting issues
pnpm lint:fix

# Stylelint on CSS/tokens (verifies OKLCH token usage & animation performance)
pnpm lint:styles
pnpm lint:css-perf

# Spellcheck across codebase
pnpm lint:spelling

# Detect dead code and unused exports
pnpm knip
pnpm knip:fix

# Syncpack dependency alignment across package.json files
pnpm deps:check
pnpm deps:fix
pnpm deps:lint
```

### Policy & Quality Gates

```bash
# Compile architectural rules into ESLint boundaries
pnpm policy:gen

# Verify architectural rules and security checks in CI
pnpm policy:check

# Run 4-gate reality enforcement script (ARWR, tests, modernization, strict TS)
pnpm verify:gates

# Audit database schema vs contract synchronization
pnpm audit:drift

# Audit Row Level Security coverage and InitPlan optimizations
pnpm audit:rls
pnpm audit:rls-matrix

# Audit design token compliance (detects raw colors and forbidden dark: classes)
pnpm audit:tokens

# Audit & synchronize MCP server registrations across all 7 agent runtimes
pnpm mcp:verify
pnpm mcp:onboard
```

### Database & Migrations

```bash
# Start local Supabase container stack (automatically synchronizes migrations first)
pnpm --filter @repo/supabase supabase:start

# Reset local database and re-apply all migrations cleanly
pnpm --filter @repo/supabase supabase:reset

# Generate TypeScript database types (src/database.types.ts)
pnpm --filter @repo/supabase supabase:gen-types

# Synchronize SQL migrations between @repo/database/migrations and Supabase
pnpm --filter @repo/database sync-migrations

# Check that migrations are strictly in sync
pnpm --filter @repo/database check-migrations

# Run migration rollback safety static analysis
pnpm --filter @repo/database test

# Seed local database via tsx
pnpm db:seed

# Reload PostgREST schema cache
pnpm db:schema-reload

# Generate database markdown documentation
pnpm db:docs
```

---
