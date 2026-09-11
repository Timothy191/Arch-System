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
5. **Type Safety**: Strict TypeScript throughout. Never use `any` or `@ts-ignore`.
6. **Phased Action Plan Framework**: All coding tasks must maintain the `temp/` pipeline (`temp/outline.md` → `temp/requirements.md` [EARS syntax] → `temp/design.md` → `temp/tasks.md` with real-world scoring audit gates).
