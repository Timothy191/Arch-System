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
5. **Anti-Bloat Context Management**:
   - Never inject raw manuals or full rule catalogs into prompt memory.
   - Pull skills on-demand via `skills-mcp` (`acquire_skill`) and release with `return_skill()`.
   - Route external MCP tools virtually via `slim-tooling-mcp` (`call_upstream_tool`).
   - Query unified memory & retrospectives via `memory-gateway-mcp`.
6. **Toolchain Mandate**:
   - Code Search: Use `code-index`, `codemap`, or `ast-grep` (`sg`) instead of raw file dumps.
   - Context Bundling: Use `repomix` (`pnpm context:pack`) for targeted module packaging.
   - Verification: Use `difftastic` (`difft`) for structural syntax diffs.

## Mandatory Verification Protocol

Before declaring ANY task complete, execute and satisfy:

1. **Structured Thinking Mandate (STM-0)**: Follow the 5-phase protocol (Comprehension → Evidence → Solution → Criticism → Execution) defined in [`.agents/rules/structured-thinking-mandate.md`](file:///home/tim/Fork/Arch-System/.agents/rules/structured-thinking-mandate.md).
2. **Zero-Interruption Self-Healing**: Run `pnpm agent:verify`. If any gate fails, autonomously diagnose and self-heal until `100% PASS` is achieved.
3. **Frontend Verification**: For UI modifications, execute `pnpm audit:browser` to verify DOM hydration, zero-CLS, and OKLCH color rendering.
4. **Detailed Reporting Standard**: Provide comprehensive, evidence-backed reports per [`.agents/rules/todo-completion-and-detailed-reporting.md`](file:///home/tim/Fork/Arch-System/.agents/rules/todo-completion-and-detailed-reporting.md).
