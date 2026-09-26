# Sample Package AGENTS.md

## Scope & Purpose

Domain package providing specialized functionality within the monorepo.

## Inner Loop Commands

- Test package: `pnpm turbo run test --filter=<package-name>`
- Targeted spec: `pnpm --filter <package-name> test -- -t "<spec-name>"`
- Type-check: `pnpm turbo run type-check --filter=<package-name>`
- Build: `pnpm turbo run build --filter=<package-name>`

## Architectural Invariants

- Do not import application code (`apps/*`).
- Export all public APIs strictly through `src/index.ts`.
- Subclass standard error models from `@repo/errors`.

## Agent Tracing

- Log all modifications and handovers in `AGENT_TRACER.md`.
