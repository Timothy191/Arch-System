# Gemini Agent Guide

Guidance for Gemini and Antigravity agents operating within the Arch-System enterprise monorepo.

> **⚠️ Unified Agent SSoT**: All agent behavioral rules, operational guides, skills, and governance are consolidated in [`.agents/`](file:///home/tim/Fork/Arch-System/.agents).
> Read [`.agents/GUIDE.md`](file:///home/tim/Fork/Arch-System/.agents/GUIDE.md) and [`AGENTS.md`](file:///home/tim/Fork/Arch-System/AGENTS.md) for full operational references and invariant specifications.

## Core Directives & Ground Rules

1. **Package Manager**: Use `pnpm` exclusively (v9.15.9 pinned). Never `npm`, `yarn`, or `bun`.
2. **Light Mode Only**: Invariant UI rule — strictly light mode (#f3f4f6 background); semantic OKLCH tokens from `@repo/theme`. Never `dark:` variants.
3. **Architectural Boundaries**:
   - `apps/*` MUST NOT import `packages/database` directly — route via `@repo/supabase`.
   - `packages/ui` must remain pure presentational (zero business logic).
   - `packages/*` and `tools/*` must NOT import `apps/*`.
   - All primary data fetching in RSC / Server Actions / Route Handlers — never in `'use client'`.
4. **Type Safety**: Strict TypeScript throughout. Never use `any` or `@ts-ignore`.
5. **Toolchain Mandate**: Use `code-index`, `codemap`, or `ast-grep` (`sg`) for search, `repomix` (`pnpm context:pack`) for bundling, and `difftastic` (`difft`) for diffs.

## Mandatory Verification Protocol (6-Pillar Protocol)

Before declaring ANY task complete, execute and satisfy the 6-pillar protocol ([`.agents/rules/agent-accuracy-enforcement.md`](file:///home/tim/Fork/Arch-System/.agents/rules/agent-accuracy-enforcement.md)):

1. **Zero-Exception Verification Gate**: Run `pnpm agent:verify`. If any gate fails, autonomously diagnose and self-heal until `100% PASS` is achieved.
2. **Dynamic Context Leasing**: Pull skills dynamically via `skills-mcp` (`acquire_skill`) and release with `return_skill()`. Route external tools through `slim-tooling-mcp`.
3. **Structured Thinking Mandate (STM-0)**: Follow the 5-phase protocol (Comprehension → Evidence → Solution → Criticism → Execution) defined in [`.agents/rules/structured-thinking-mandate.md`](file:///home/tim/Fork/Arch-System/.agents/rules/structured-thinking-mandate.md). Complete 100% of TODOs.
4. **Scoped Task Progression**: Decompose large objectives into smaller, atomic tasks to build codebase pattern familiarity before broad mutations.
5. **AST Exploration**: Use `codemap`, `code-index`, or `ast-grep` (`sg`) rather than dumping large files into prompt context.
6. **Continuous Invariant Auditing**: Continuously run the corresponding domain audit (`pnpm policy:check`, `pnpm audit:tokens`, `pnpm audit:routing`, `pnpm audit:vercel`, etc.). For UI changes, execute `pnpm audit:browser`. Provide comprehensive evidence-backed reports per [`.agents/rules/todo-completion-and-detailed-reporting.md`](file:///home/tim/Fork/Arch-System/.agents/rules/todo-completion-and-detailed-reporting.md).
