# Sample Package AGENTS.md

## Scope & Purpose
Domain package providing specialized functionality within the monorepo.

## Inner Loop Commands
- Test package: `pnpm nx test <package-name>`
- Targeted spec: `pnpm --filter <package-name> test -- -t "<spec-name>"`
- Type-check: `pnpm nx type-check <package-name>`
- Build: `pnpm nx build <package-name>`

## Architectural Invariants
- Do not import application code (`apps/*`).
- Export all public APIs strictly through `src/index.ts`.
- Subclass standard error models from `@repo/errors`.

## Agent Tracing
- Log all modifications and handovers in `AGENT_TRACER.md`.
