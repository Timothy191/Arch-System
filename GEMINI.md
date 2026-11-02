# Gemini Agent Guide

Guidance for Gemini and Antigravity agents operating within the Arch-System enterprise monorepo.

> **⚠️ Unified Agent SSoT**: All agent behavioral rules, operational guides, skills, and governance are consolidated in [`.agents/`](file:///home/tim/Fork/Arch-System/.agents).
> Read [`.agents/GUIDE.md`](file:///home/tim/Fork/Arch-System/.agents/GUIDE.md) and [`AGENTS.md`](file:///home/tim/Fork/Arch-System/AGENTS.md) for full operational references and invariant specifications.

## Core Directives & Invariants

1. **Package Manager**: Use `pnpm` exclusively (v9.15.9 pinned). Never `npm`, `yarn`, or `bun`.
2. **Light Mode Only**: Invariant UI rule — strictly light mode (#f3f4f6 background); semantic OKLCH tokens from `@repo/theme`. Never `dark:` variants.
3. **Architectural Boundaries**:
   - `apps/*` MUST NOT import `packages/database` directly — route via `@repo/supabase`.
   - `packages/ui` must remain pure presentational (zero business logic).
   - `packages/*` and `tools/*` must NOT import `apps/*`.
   - All primary data fetching in RSC / Server Actions / Route Handlers — never in `'use client'`.
4. **Type Safety**: Strict TypeScript throughout. Never use `any` or `@ts-ignore`.
5. **Toolchain Mandate**: Use `code-index`, `codemap`, or `ast-grep` (`sg`) for search, `repomix` (`pnpm context:pack`) for bundling, and `difftastic` (`difft`) for diffs.
6. **Strict Task Focus**: Never explore unrelated code, files, or anything else outside the user's explicit request.
7. **Verification Gate**: Satisfy the 6-pillar protocol ([`.agents/rules/agent-accuracy-enforcement.md`](file:///home/tim/Fork/Arch-System/.agents/rules/agent-accuracy-enforcement.md)) and achieve 100% PASS on `pnpm agent:verify`.
