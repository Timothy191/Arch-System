# Arch-Systems (Plantcor) Mining Operations Portal

Industrial operations portal built for high-scale vigilance and operational precision.

## 🏗️ Architecture & Tech Stack

- **Monorepo**: Turborepo + pnpm 9.15.9 + Nx 22.
- **Frontend**: Next.js 16 (App Router), React 19, Tailwind (OKLCH).
- **Backend**: Supabase (PostgreSQL, Auth, RLS), Payload CMS v3.
- **Quality**: Strict TypeScript, Jest, Playwright, DeepEval.

---

## ⚙️ Inner Loop: Developer Discipline

### Data Safety & Confirmation

- **Data is Sacred**: All operations must prioritize data integrity and security.
- **Confirmation Required**: For any data-related change, I must halt execution, explain the potential impact on data, and ask for explicit confirmation before proceeding. This applies to:
  - Database schema migrations (`packages/database`).
  - Data mutation logic (Server Actions, API routes).
  - Changes to authentication or authorization rules (RLS).

### Production Readiness & Recovery

- **Production Readiness**: All changes must pass the full quality gate (`pnpm quality`) and live verification to ensure the system remains deployable at all times.
- **Automated Rollback**: If any change breaks the build, tests, or critical functionality, I must automatically revert the responsible code change and re-evaluate my approach.

### Verification Discipline

- **Tests pass ≠ program working.** Fresh runs are mandatory.
- **Frontend changes require live verification.** Start `pnpm dev`, navigate to the page, and interact with the UI.
- **Evidence before claims.** Never say "it works" without concrete proof (test output, browser check).

### Systematic Debugging

1. **Root Cause**: Reproduce consistently, check diffs, instrument boundaries.
2. **Hypothesis**: Specific and falsifiable. Test one variable at a time.
3. **Defense-in-Depth**: Make bugs structurally impossible. Validate at entry points, logic, and environment layers.
4. **Bail-out**: 3+ failed fixes indicate an architectural problem. Stop and rethink.

### Change Discipline

- **Lineage Test**: Every changed line must trace to a specific requirement.
- **Orphan Cleanup**: Remove imports/vars/functions your changes made unused.
- **Never Invent Values**: Authoritatively confirm paths, env vars, and IDs before using them.

### Agent Tracing & Context Hand-off (MANDATORY RULE)

- **Workflow Traces**: All agents MUST update the `AGENT_TRACER.md` file in the root of the package/app they are modifying. You must log a timestamp, your purpose, the changes made, and what the next agent should know.
- **Context Breadcrumbs**: When implementing complex architectural logic, agents MUST leave inline `// AGENT-TRACE: <explanation>` or `/* AGENT-TRACE: ... */` comments. This ensures future AI agents understand the implicit business rules or domain context immediately upon reading the file.

### Mandatory Response Summary, Token Metrics & Next Steps Protocol (MANDATORY RULE)

All AI agents MUST conclude every response with the following standardized sections:

1. **Summary of Actions Taken**: A concise summary of changes made, files modified, and issues resolved.
2. **Token Efficiency & Usage**:
   - **Tokens Used**: Approximate/tracked tokens used in the turn.
   - **Tokens Cached**: Tokens read from cache / prefix context.
   - **Tokens Saved**: Estimated tokens saved via caching, targeted slicing, or subagent scoping.
3. **Suggested Next Steps (3 options)**:
   - **Option 1**: Immediate operational or functional next step.
   - **Option 2**: Verification, test suite, or quality gate next step.
   - **Option 3**: Architecture, hardening, or performance optimization next step.

### Token Conservation & High-Efficiency Context Engineering (MANDATORY RULE)

All AI agents MUST enforce maximum token efficiency across all operations without sacrificing code completeness, rigor, or output quality:

1. **Targeted Slicing Over Bulk Ingestion**:
   - Never view entire multi-hundred-line files when localized sections suffice. Always specify bounded `StartLine` and `EndLine` parameters to read only relevant function/component spans.
2. **Grep & Regex-First Navigation**:
   - Discover symbols, call sites, and contracts using `grep_search` with targeted `Includes` globs instead of brute-force directory traversals.
3. **Precision Non-Destructive Edits**:
   - Always use `replace_file_content` targeting the exact contiguous lines being modified. Never rewrite entire files to make localized changes.
4. **Context Window & Terminal Log Hygiene**:
   - Truncate and filter verbose shell commands, bundle logs, and build artifacts. Never stream large binaries, lockfiles, or huge `.next` outputs into context.
5. **Subagent Delegation for Broad Exploration**:
   - Delegate wide multi-file research tasks and exploratory grep loops to scoped subagents so the primary agent's context remains clean and cache-dense.
6. **Zero Fluff & Prefix Cache Preservation**:
   - Eliminate conversational fluff, repetitive self-narration, and unnecessary code echo. Maintain deterministic context structures to maximize prefix cache hit ratios.

---

## 🛡️ Outer Loop: Production Hardening

### Infrastructure & Resilience

- **CI/CD Mandate**: All deployments must flow through automated CI/CD pipelines with integrated smoke tests and automatic rollback on failure.
- **Availability**: High-availability configuration is mandatory (load balancing, health checks, auto-scaling).
- **Disaster Recovery**: Maintain a documented backup frequency, retention policy, and tested restore procedures. Periodic recovery drills are required.

### Security Hardening

- **Edge Protections**: Enforce rate limiting and brute-force protection on all auth and public API endpoints.
- **Security Headers**: All applications must correctly configure CSP, HSTS, CORS, and X-Frame-Options.
- **Validation**: Enforce strict input validation/sanitization across all Next.js API routes and CMS endpoints.
- **Vulnerability Scanning**: Automated dependency auditing and vulnerability scanning (e.g., Trivy, Snyk) must be integrated into CI.
- **Identity**: Enforce MFA for all operator/supervisor accounts. Use short-lived tokens with secure refresh rotation.

### Observability & Alerting

- **Instrumentation**: **Hard require** OpenTelemetry for all operational paths (traces, metrics).
- **Monitoring**: Implement centralized logging (e.g., Datadog/Loki) and real-time dashboards for CPU, memory, request latency, and error rates.
- **Alerting**: Configure uptime and health check alerting (e.g., PagerDuty, Opsgenie).
- **Audit Trails**: Maintain immutable audit logs for all user actions and sensitive data access.

### Database Change Safety

- **Versioned Migrations**: All schema changes must use versioned migrations.
- **Staging Verification**: Every migration must be verified against a production-mirror staging database in CI before being applied.

### Performance & Load Testing

- **Peak Validation**: Critical paths (login, dashboard load, telemetry updates) must be validated with load/stress tests (e.g., k6/Artillery) to handle shift-change data bursts.
- **Budgets**: Maintain performance budgets in CI to prevent regression.

---

## 🎨 Design System (@repo/theme)

### Color System (OKLCH)

- **Palette**: Neutral-heavy with functional accents (≤10%).
- **Tokens**: Primitives are named `arch0` to `arch15`.
- **Semantic Aliases**: Always prefer semantic aliases (e.g., `bg-primary`, `text-heading`, `accent-blue`) over primitives.
- **Theme**: Light-only (macOS Sonoma visual language). Dark mode is explicitly NOT supported.

### Tailwind Configuration

- The preset lives in `packages/theme/src/tailwind/preset.ts`.
- Components in the monorepo must import this preset for consistency.

### Animation Rules

- **Easing**: `cubic-bezier(0.16, 1, 0.3, 1)` (ease-out-expo).
- **Durations**: 150ms (micro), 250ms (structural), 400ms (modal).
- **Restrictions**: Never animate layout properties (`width`, `height`, etc.). Only `opacity`, `transform`, and colors.

---

## 🚀 Key Commands

- `pnpm quality`: Full quality gate (lint, type-check, test, format-check).
- `pnpm build`: Build all workspace projects.
- `pnpm test`: Run all unit tests.
- `pnpm test:e2e`: Run Playwright E2E tests.

---

## 📚 Authoritative Docs

- **[DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md)** — Complete documentation index.
- **[CLAUDE.md](CLAUDE.md)** — Technical guide & command list.
- **[AGENTS.md](AGENTS.md)** — Development workflow and quality gates.
- **[DEPLOYMENT.md](DEPLOYMENT.md)** — Deployment guide for all environments.
- **[DESIGN.md](./DESIGN.md)** — Color system & visual rules.
- **[PRODUCT.md](./PRODUCT.md)** — User personas & strategy.

<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

## General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax

<!-- nx configuration end-->
