---
name: lexical-and-naming-governance
description: Mandatory spelling (CSpell), grammar (en-US), identifier, and file-naming governance for all autonomous agents
paths:
  - '**/*'
alwaysApply: true
---

# Lexical, Spelling, Grammar & File-Naming Governance

Every autonomous agent, subagent, and swarm worker operating in `Arch-System` MUST enforce identical spelling, grammar, identifier, and file-naming rules across code, documentation, rules, skills, and commit messages.

## 1. American English (`en-US`) & CSpell Lexical Integrity

1. **Single Locale (`en-US`)**: Write all documentation, comments, UI copy, error messages, and identifiers in standard American English (`en-US`).
2. **Zero Unknown Words**: Every file in `apps/`, `packages/`, `libs/`, `docs/`, `tools/`, `scripts/`, `.agents/`, `.github/`, and root `*.md` (including `AGENT_TRACER.md`) is checked by `pnpm lint:spelling` (`cspell --config config/tools/cspell.json`).
3. **Dictionary Discipline**:
   - **Fix Typos First**: Never add a misspelled word to `config/project-words.txt` or `config/tools/cspell.json`. Fix the typo in the source file or filename.
   - **Domain Terms Only**: Add a word to `config/project-words.txt` only when it is a verified industrial/mining acronym, library name, or technical identifier, in alphabetical order.
   - **No Blind-Spot Ignores**: Never exclude `AGENT_TRACER.md`, `.agents/**`, or `docs/**` from `config/tools/cspell.json` `ignorePaths`.

## 2. Canonical File & Symbol Naming Conventions

| Artifact Type               | Required Naming Pattern           | Canonical Examples                                     | Forbidden Examples                                                   |
| :-------------------------- | :-------------------------------- | :----------------------------------------------------- | :------------------------------------------------------------------- |
| **Root Agent Tracer SSoT**  | Exact `AGENT_TRACER.md` at root   | `AGENT_TRACER.md`                                      | `AGENTS-TRACER.md`, `AGENTS_TRACER.md`, `packages/*/AGENT_TRACER.md` |
| **React Components**        | `PascalCase.tsx`                  | `GlassCard.tsx`, `DepartmentFilterToolbar.tsx`         | `glass-card.tsx`, `departmentFilterToolbar.tsx`                      |
| **React Hooks**             | `useCamelCase.ts`                 | `useSupabaseRealtime.ts`, `useFormDraftPersistence.ts` | `UseSupabaseRealtime.ts`, `supabase-realtime.hook.ts`                |
| **Zod Contract Schemas**    | `kebab-case.schema.ts`            | `access-control.schema.ts`, `shift-closeout.schema.ts` | `accessControlSchema.ts`, `shift_closeout.schema.ts`                 |
| **TypeScript Types**        | `kebab-case.types.ts`             | `telemetry.types.ts`                                   | `TelemetryTypes.ts`                                                  |
| **Shared Utilities / Libs** | `kebab-case.ts` / `.cjs` / `.mjs` | `export-helpers.ts`, `server-timing-client.ts`         | `exportHelpers.ts`, `ServerTimingClient.ts`                          |
| **SQL Migrations**          | `NNN_snake_case.sql` (3-digit)    | `163_shift_closeout_rpc.sql`                           | `163-shift-closeout.sql`, `shift_closeout.sql`                       |
| **Agent Rules & Skills**    | `kebab-case.md` / `SKILL.md`      | `.agents/rules/lexical-and-naming-governance.md`       | `Lexical_Governance.md`                                              |
| **EARS Specifications**     | `kebab-case.spec.md`              | `docs/specs/lexical-and-naming-governance.spec.md`     | `docs/specs/LexicalSpec.md`                                          |

## 3. Identifier & Grammar Rules

1. **Banned Generic Identifiers**: Never use `data`, `value`, `val`, `item`, `info`, `temp`, `tmp`, `flag`, `obj`, `arr`, or awkward coined plurals. Use domain-specific nouns (`shiftCloseoutPayload`, `importSpecifiers`, `allocatedHours`).
2. **Units & Boolean Prefixes**: Append explicit units to numeric identifiers (`timeoutMs`, `maxWeightTons`, `retentionDays`) and prefix booleans with `is`, `has`, `can`, `should`, `did`, or `will`.
3. **Markdown Grammar & Structure**: All `.md` files must pass `pnpm md:lint` (`markdownlint --config config/tools/.markdownlint.json`) and `prettier --check`. Headings must have surrounding blank lines (`MD022`).
4. **Conventional Commits**: All commit messages must pass `commitlint` (`<type>(<scope>): <imperative lower-case summary>`) with zero spelling errors.

## 4. Automated Hook & Gate Enforcement

- **PreToolUse (`.qoder/hooks/protect-paths.sh`)**: Blocks creation of non-canonical tracer files (`AGENTS_TRACER.md`, `AGENTS-TRACER.md`) and nested package `*/AGENT_TRACER.md` files.
- **PostToolUse (`.qoder/hooks/auto-format.sh`)**: Runs Biome on JS/TS/JSON/CSS edits, Markdownlint + Prettier on Markdown edits, and `cspell` on every edited file.
- **Pre-Commit (`.lintstagedrc.mjs`)**: Runs Biome, Stylelint, Markdownlint, Prettier, and `cspell` on all staged files before commit.
- **Gate 2 & Gate 25 (`pnpm agent:verify`)**: Enforces `pnpm lint:spelling`, `audit-agentic-content.cjs --check`, and `audit-agent-permissions.cjs`.
