# Arch-Systems (Plantcor) Mining Operations Portal

Industrial operations portal built for high-scale vigilance and operational precision.

## Related Documentation

- **[DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md)** — Complete documentation index and quick navigation guide
- **[CLAUDE.md](CLAUDE.md)** — Complete technical guide and development commands
- **[AGENTS.md](AGENTS.md)** — Development workflow and quality gates
- **[DEPLOYMENT.md](DEPLOYMENT.md)** — Deployment guide for all environments

---

## 🏗️ Architecture & Tech Stack

- **Monorepo**: Turborepo + pnpm 9.12.0.
- **Frontend**: Next.js 15+ (App Router), React 19, Tailwind (OKLCH).
- **Backend**: Supabase (PostgreSQL, Auth, RLS), Payload CMS v3.
- **Quality**: Strict TypeScript, Jest, Playwright, DeepEval.

## 🚀 Key Commands

- `pnpm quality`: Full quality gate (lint, type-check, test, format-check).
- `pnpm build`: Build all workspace projects.
- `pnpm test`: Run all unit tests.
- `pnpm test:e2e`: Run Playwright E2E tests.

## 🛠️ Global Development Conventions

### Data Safety & Confirmation

- **Data is Sacred**: All operations must prioritize data integrity and security.
- **Confirmation Required**: For any data-related change, I must halt execution, explain the potential impact on data, and ask for your explicit confirmation before proceeding. This applies to:
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
- **Runtime Telemetry**: Where applicable, ensure functions are instrumented (e.g., `prom-client` or OpenTelemetry spans) so runtime behavior can be analyzed by subsequent debugging agents.

## 📖 Subdirectory Instructions

- [apps/portal/GEMINI.md](./apps/portal/GEMINI.md) — Portal specific rules & AI orchestration.
- [packages/theme/GEMINI.md](./packages/theme/GEMINI.md) — Design system & token pipeline.

## 📚 Authoritative Docs

- [CLAUDE.md](./CLAUDE.md) — Technical guide & command list.
- [DESIGN.md](./DESIGN.md) — Color system & visual rules.
- [PRODUCT.md](./PRODUCT.md) — User personas & strategy.
