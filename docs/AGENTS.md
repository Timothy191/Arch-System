# AGENTS.md

> **Agent onboarding guide** — Read first. Every line answers: "Would an agent miss this without help?"

---

## ⚠️ Mandatory: AGENT_TRACER.md

**On every code change**, update `AGENT_TRACER.md` in the modified package/app root. Log ISO 8601 timestamp, purpose, changes made, and what the next agent should know.

- Read the affected package's `AGENT_TRACER.md` before starting work.
- Leave inline `// AGENT-TRACE:` breadcrumbs for non‑obvious architectural logic.
- If a package lacks `AGENT_TRACER.md`, create one.
- **Failure to trace is a contract violation.**

---

## One-shot dev environment

```bash
pnpm install
cp apps/portal/env/.env.example apps/portal/.env
cp .env.example .
pnpm --filter @repo/database supabase:dev   # Docker required, separate terminal
pnpm dev                                     # portal on :3000, uses next dev --turbopack
pnpm quality                                 # full gate before pushing
```

Full bootstrap with flags: `pnpm dev:up --all` (`--quick`, `--tools`, `--cms`, `--overview`, `--force`)

---

## Monorepo layout

**Runtime:** Node.js >=22, pnpm 9.15.9 (Volta-managed), ESM (`"type": "module"`)

### Apps (`apps/`)

| App      | Port  | What                                            |
| -------- | ----- | ----------------------------------------------- |
| portal   | :3000 | Next.js 16, App Router, React 19, Turbopack dev |
| cms      | :3001 | Payload CMS v3 (headless)                       |
| overview | :3002 | Architectural visualization (React Flow)        |

### Packages (`packages/`)

| Package              | Purpose                                                                         |
| -------------------- | ------------------------------------------------------------------------------- |
| `@repo/theme`        | OKLCH design tokens → generated CSS, Tailwind preset. SSoT: `tokens.json`       |
| `@repo/ui`           | Shared Radix/shadcn UI components, `cn()` utility, glass primitives             |
| `@repo/supabase`     | Browser/server/middleware Supabase clients + auto-generated `database.types.ts` |
| `@repo/database`     | SQL migrations (`migrations/NNN_*.sql` — SSoT for schema)                       |
| `@repo/redis`        | Redis helpers (department slug → UUID resolution, caching)                      |
| `@repo/utils`        | Shared utilities, Inngest & Novu integrations                                   |
| `@repo/errors`       | Domain-specific error classes                                                   |
| `@repo/rate-limiter` | Rate limiting primitives                                                        |
| `@repo/logger`       | Structured logging                                                              |
| `@repo/eval`         | Python/DeepEval AI compliance suite (Poetry, not in `pnpm quality`)             |
| `@repo/contract`     | Type contracts and domain schemas                                               |
| `@repo/agents`       | Agent orchestration helpers                                                     |

### Dependency versioning

`pnpm-workspace.yaml` defines two catalogs: default `catalog:` and `catalog:react19:`. Packages reference them as `"catalog:"` or `"catalog:react19:"` in their `package.json`. **Change a catalog entry to bump all consumers.**

---

## Essential commands

| Command                                                  | What                                                                                                                                                                 |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm dev`                                               | Portal dev server (:3000), turbopack                                                                                                                                 |
| `pnpm --filter <name> dev`                               | Dev a specific app/package                                                                                                                                           |
| `pnpm build`                                             | Build all (via `nx run-many -t build`)                                                                                                                               |
| `pnpm quality`                                           | Full gate: `lint → type-check → test → lint:tokens → lint:css → lint:root → lint:styles → format:check → deps:lint → knip → policy:check → audit:rls → audit:design` |
| `pnpm test`                                              | All unit tests (Jest)                                                                                                                                                |
| `pnpm --filter portal test -- --testPathPatterns=<file>` | Single portal test file                                                                                                                                              |
| `pnpm test:e2e`                                          | Playwright (requires :3000, Chromium at `/usr/bin/google-chrome`)                                                                                                    |
| `pnpm format` / `pnpm format:check`                      | Prettier write/check                                                                                                                                                 |
| `pnpm knip` / `pnpm knip:fix`                            | Dead code detection/fix                                                                                                                                              |
| `pnpm deps:lint` / `pnpm deps:fix`                       | syncpack — workspace version consistency                                                                                                                             |
| `pnpm md:lint` / `pnpm md:fix`                           | Markdownlint                                                                                                                                                         |
| `pnpm analyze`                                           | Bundle analyzer (env `ANALYZE=true`)                                                                                                                                 |
| `pnpm db:docs`                                           | Generate ER diagrams                                                                                                                                                 |
| `pnpm deploy:local`                                      | Full‑stack local deploy                                                                                                                                              |
| `pnpm fresh-start`                                       | Clean rebuild from scratch                                                                                                                                           |

---

## Codegen pipelines — never edit generated files

### Design tokens

- **Edit:** `packages/theme/tokens.json`
- **Generate:** `pnpm --filter @repo/theme build` → `packages/theme/src/tokens/generated.ts`
- **Validate:** `pnpm --filter @repo/theme lint:tokens`
- **Commit both** `tokens.json` and `generated.ts`.

### Database types

- **Edit:** `packages/database/migrations/NNN_*.sql`
- **Push:** `pnpm --filter @repo/database supabase:push`
- **Generate:** `pnpm --filter @repo/database supabase:gen` → `packages/supabase/src/database.types.ts`
- **Never edit** `packages/supabase/supabase/migrations/` directly.
- **Commit** migration + updated types.
- **Note:** Types file is `packages/supabase/src/database.types.ts` (not `packages/database/`).

---

## Database & migrations

- SSoT: `packages/database/migrations/` (zero‑padded, e.g. `001_initial.sql`).
- All tables **must have RLS enabled** with policies.
- The `employees` table is the authorization source of truth — not Supabase Auth metadata.
- Server env vars use `SUPABASE_` prefix; `NEXT_PUBLIC_SUPABASE_*` for browser.

---

## Middleware & auth

- **`apps/portal/middleware.ts`** (Next.js 16 native): checks Supabase session cookies for protected routes.
- **`apps/portal/server/proxy.ts`**: runs after middleware — handles slug → UUID resolution (Redis), redirect validation, route gating.
- Route `/api/c66` is **exempt from auth** — never remove.
- Server Actions must use `createServerSupabaseClient()` from `@repo/supabase/server` and **validate the user at the top**.
- RLS policies must mirror Server Action auth checks.

---

## Portal route groups

| Group                         | Layout rule                                                                               |
| ----------------------------- | ----------------------------------------------------------------------------------------- |
| `(auth)/`                     | Auth layout + `AnimatedWavesBackground`                                                   |
| `(departments)/[department]/` | Each static sub‑page **must** export its own `layout.tsx` re‑exporting `DepartmentLayout` |
| `(hub)/`                      | Landing / executive overview                                                              |
| `api/`                        | API routes (co‑located, Server Actions in features/)                                      |
| `admin/`                      | Admin panel                                                                               |

**Path aliases:** `~/*` and `@/*` → `apps/portal/*`

Root layout mounts `ArchThemeProvider`, `OfflineBanner`, `AnimatedWavesBackground`, `AIAssistantSidebarWrapper` — never bypass.

---

## Design system constraints

**Read `DESIGN.md` for full palette.** Non‑obvious rules that differ from defaults:

- **Light‑only theme** — forced via `<script data-theme="light">`. No dark mode.
- **Shadows:** `box-shadow` and Tailwind `shadow-*` are **forbidden**. Use `shadow-card`, `shadow-window`, `shadow-diffusion-*` tokens.
- **Glass pattern:** `bg-white/70 backdrop-blur-xl border border-black/[0.08]`
- **Class merging:** Always `cn()` from `@repo/ui/lib/utils`. Never concatenate.
- **Icons:** Named imports only (`import { Drill } from "lucide-react"`). Wildcard imports add ~1.3 MB.
- **Animation:** Only `opacity`, `transform`, `background-color`, `border-color`, `color`. Never layout properties. Easing: `cubic-bezier(0.16, 1, 0.3, 1)`.
- **Framer Motion:** Only for `whileTap` (press). Set `hoverScale={1}` to avoid interfering with CSS hover.

---

## Testing quirks

- **Unit tests** (Jest): coverage thresholds — lines 40%, branches 30%, functions 35%, statements 40%.
- **New `@repo/<pkg>` imports in portal** require adding entries to `apps/portal/jest.config.js` `moduleNameMapper`.
- **E2E** (Playwright): Chromium only (`/usr/bin/google-chrome`). Visual snapshots in `e2e/visual/__snapshots__/`. Requires dev server on `:3000`.
- Supabase **not required** for unit tests.

---

## Git & hooks

| Hook       | Action                                                            |
| ---------- | ----------------------------------------------------------------- |
| pre-commit | `pnpm lint-staged` (stylelint, prettier, `lint:tokens` for theme) |
| pre-push   | `pnpm nx run-many -t lint type-check`                             |
| commit-msg | `pnpm commitlint` (conventional commits required)                 |

- **Never bypass with `--no-verify`.**
- One commit per logical task. Never amend. Never force-push to `master`.
- **NEVER execute git write commands without user permission.**

---

## CI pipeline (`.github/workflows/ci.yml`)

Runs on push/PR to `main`/`master`. Order:

```
deps:lint → audit (high/critical) → knip → policy:check → audit:rls → audit:design → md:lint →
gitleaks → nx affected -t lint type-check → tflint → trivy →
nx affected -t lint:tokens lint:css → nx affected -t test →
build → bundlesize → E2E → Lighthouse
```

CI needs these synthetic env vars (set in workflow):

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_*`, `N8N_*`, `FLOWISE_*`, `DATABASE_URL`, `PAYLOAD_SECRET`

**Add new env vars to both `.env.example` files and CI.**

---

## Key config files

| File                                     | What it controls                                                     |
| ---------------------------------------- | -------------------------------------------------------------------- |
| `packages/database/supabase/config.toml` | Local Supabase ports/keys                                            |
| `nx.json`                                | Pipeline DAG, caching, S3 remote cache, dependency constraints       |
| `apps/portal/next.config.mjs`            | PWA, Sentry, `transpilePackages`, Turbopack root                     |
| `config/tools/knip.json`                 | Entry points for dead‑code detection                                 |
| `pnpm-workspace.yaml`                    | Package catalog versions                                             |
| `opencode.json`                          | MCP server config (nx-mcp, supabase, github, memory, redis)          |
| `tools/apply-project-tags.cjs`           | Auto-tags Nx projects with scope:\* tags based on directory location |

---

## Nx Project Tags & Architectural Enforcement

The monorepo uses `tools/apply-project-tags.cjs` to automatically tag projects based on their directory location. These tags are used by Nx's dependency constraints to enforce architectural rules.

### Tag Vocabulary

Tags are automatically applied by `apply-project-tags.cjs`:

- **`scope:app`** - All applications in `apps/`
- **`scope:app:<name>`** - Specific app (e.g., `scope:app:portal`)
- **`scope:package`** - All packages in `packages/`
- **`scope:package:<name>`** - Specific package (e.g., `scope:package:ui`)
- **`scope:package:db`** - Database package (architectural significance)
- **`scope:package:db-internal`** - Database internals (restricted access)
- **`scope:tool`** - Build-time tools in `tools/` (only specific subdirectories: wiki-viewer, n8n-mcp, preflight-mcp, policy)

### Dependency Constraints

Defined in `nx.json` under `dependencyConstraints`:

- Apps can only depend on packages (`scope:app` → `scope:package`)
- Apps cannot depend on database internals (`scope:app` ↛ `scope:package:db-internal`)
- UI packages cannot depend on database-related packages (`scope:package:ui` ↛ `scope:package:db`, `scope:package:db-internal`, `scope:package:supabase`)
- Theme packages cannot depend on UI packages (`scope:package:theme` ↛ `scope:package:ui`)
- Tools cannot depend on apps or Supabase (`scope:tool` ↛ `scope:app`, `scope:package:supabase`)
- Packages cannot depend on apps (`scope:package` ↛ `scope:app`)

**Run `node tools/apply-project-tags.cjs` after adding new projects or when project structure changes.**

---

## Common gotchas

| Problem                            | Fix                                                         |
| ---------------------------------- | ----------------------------------------------------------- |
| Types not updating after migration | Run `supabase:gen` and restart TS server                    |
| Jest can't resolve `@repo/*`       | Add to `apps/portal/jest.config.js` `moduleNameMapper`      |
| knip false positives on new routes | Add entry points to `config/tools/knip.json`                |
| Icon chunk too large               | Never `import * as Icons` — use named imports only          |
| Supabase connection refused        | Docker must be running; `supabase:dev` on ports 54321/54322 |
