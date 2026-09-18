# Gemini Agent Guide

You are operating within the Arch-System enterprise monorepo.

## Directives & Ground Rules

- Refer to the canonical Agent SSoT: [AGENTS.md](./AGENTS.md).
- Follow Turborepo task conventions: use `pnpm` exclusively.
- All code changes must satisfy `@repo/eslint-config`, Biome rules, and TypeScript strict checking.
- Do not edit generated Supabase types manually; use `pnpm --filter @repo/database db:types`.

## Core Directives & Quality Gates

1. **Always Light Mode**: Invariant UI rule — strictly light mode (#f3f4f6 background, luminance > 200). Never introduce `dark:` Tailwind classes.
2. **Design Tokens**: Rely on OKLCH tokens from `@repo/theme`. Use only approved shadow tokens.
3. **Quality Gate**: Always ensure `pnpm quality` passes before completing work.
4. **Architectural Boundaries**: Public package APIs must export strictly from `src/index.ts`. Never cross domain boundaries or import server-only code into client components.
5. **Type Safety**: Strict TypeScript throughout. Never use `any` or `@ts-ignore`; use explicit domain interfaces, `unknown`, and narrowing type guards (`val is Type`). Validate external payloads at runtime instead of blindly asserting types (`as Type`). Model explicit domain states (discriminated unions) instead of hiding unexpected states with optional chaining (`?.`).
6. **Phased Action Plan Framework**: All coding tasks must maintain the `temp/` pipeline (`temp/outline.md` → `temp/requirements.md` [EARS syntax] → `temp/design.md` → `temp/tasks.md` with real-world scoring audit gates).
7. **Code Refactoring & Quality Invariants**: Whenever refactoring or modifying code, strictly enforce `.agents/rules/code-refactoring.md` (REFAC-01: Zero unexplained numbers; REFAC-06: Parameter object pattern; REFAC-07: DRY principle; REFAC-08: Zero `any` & narrowing type guards; REFAC-09: No unsafe `as Type` assertions; validate external data at runtime; REFAC-10: Model explicit domain states instead of hiding invalid states with `?.`).
8. **Frontend Styling & UI Architecture**: Strictly adhere to the rules defined in `.agents/rules/frontend-styling.md` for CSS invariants, Tailwind strict mode, and React UI architectural boundaries.
9. **Turborepo & Monorepo Best Practices**: When managing the workspace, dependencies, build caching, or executing Turborepo commands, strictly adhere to `.agents/rules/turborepo-best-practices.md` to prevent bundle bloat, ensure topological execution, and preserve exact Next.js/Turbopack boundaries.
