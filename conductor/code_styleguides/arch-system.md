<!-- cspell:ignore Squawk Kysely commitlint Supabase -->

# Arch-System Monorepo Code Style Guide

> **Governing SSoT**: [`AGENTS.md`](../../AGENTS.md) and [`GEMINI.md`](../../GEMINI.md). Any track-level code must satisfy every rule below alongside language guides in this directory.

## 10 Core Code Quality Rules

1. **No Magic Numbers or Strings**: Extract thresholds, timeouts, and keys to `UPPER_SNAKE_CASE` constants (`-1`, `0`, `1` exempt).
2. **Max 2 Positional Parameters**: Functions accepting `3+` inputs or any boolean flag MUST take a single typed `Options` object.
3. **Rule of Three**: Keep inline on 1st use, allow on 2nd, extract a shared helper on the 3rd identical occurrence.
4. **Guard Clauses**: Validate edge cases at the top and return early; max block nesting depth `2`; never write `else` after `return` or `throw`.
5. **Discriminated Unions**: Model multi-stage state via tagged `status` unions (e.g., `'idle' | 'loading' | 'success' | 'error'`), never parallel booleans.
6. **Semantic Identifiers with Units & Prefixes**: Avoid vague names (`data`, `value`, `val`, `item`, `info`, `temp`, `tmp`, `flag`, `obj`, `arr`). Append units (`timeoutMs`, `maxWeightTons`) and prefix booleans (`is`, `has`, `can`, `should`, `did`, `will`).
7. **Default to Immutability**: Type array/object parameters `readonly`; return new references (`map`, `filter`, spread) instead of mutating arguments in place. Also use module-level constants for default empty array/object props in React components to avoid `useEffect` render loops.
8. **Lookup Maps Over Branching Chains**: Prefer `Readonly<Record<Key, Value>>` dictionaries over long `if/else if` ladders or `switch` blocks.
9. **Single Level of Abstraction**: Target cyclomatic complexity `<= 8` and `~50` lines max per function; either orchestrate high-level steps or execute one focused task.
10. **Never Swallow Errors**: Every `catch` must return a typed fallback or rethrow with operation context, entity IDs, and `{ cause: error }` (`AppError` subclasses from `@repo/errors`).

## Layering & Import Boundaries (`pnpm policy:check`)

- Import `packages/*` via canonical subpath exports (e.g., `@repo/ui/GlassCard`, `@repo/supabase/server`, `@repo/redis/cache`) — NEVER deep `/src/` imports.
- `apps/*` NEVER imports `packages/database` directly; route persistence through `@repo/supabase` or feature `data-access`.
- `packages/ui` stays strictly presentational (zero `@repo/database` or `@repo/supabase` imports).
- `packages/theme` feeds `packages/ui`, never the reverse.
- `tools/*` NEVER imports runtime `@repo/supabase`.

## Canonical 8-Step Server Action Sequence

All protected Server Actions (`'use server'`) and Route Handlers must execute in this exact order:

1. **Authenticate** (`getAuthenticatedEmployee` / Supabase SSR `getClaims()`)
2. **Authorize** (role & department clearance)
3. **Validate** (`@repo/contract` Zod 4 schemas)
4. **Rate-limit** (`@repo/rate-limiter` / `withRateLimit`)
5. **Execute** (Supabase / Kysely / service-role scoped mutation)
6. **Audit Log** (`@repo/logger/server`)
7. **Invalidate Caches** (`updateTag()` / `cacheInvalidateTags()` BEFORE any `redirect()`)
8. **Return Typed Result**

## Formatting, Linting & Conventions

- **Biome 2.5**: 2-space indent, 100-col width, single quotes in TS/JS, double quotes in JSX, semicolons required, ES5 trailing commas, `noExplicitAny: "error"`, sorted Tailwind classes (`useSortedClasses: "error"`).
- **Prettier & Markdownlint**: Keep blank lines above and below all Markdown headings (`MD022`), lists, and fenced code blocks; format Markdown/CSS/YAML with Prettier (`pnpm format:prettier`).
- **CSpell**: All comments, docs, and identifiers must pass `pnpm lint:spelling` (`en-US`).
- **Commits**: Strict Conventional Commits (`feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `ci`) validated by `commitlint` (`<= 100` char header).
