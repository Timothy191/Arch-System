# Agent Accuracy Enforcement Mandate (6-Pillar Protocol)

To maximize accuracy, eliminate context token bloat, and prevent regressions across the Arch-System monorepo, every AI coding agent MUST strictly follow this 6-pillar protocol for all tasks:

## 1. Zero-Exception Final Verification Gate

- **Directive**: NEVER consider or declare ANY coding, refactoring, or configuration task complete without running and passing `pnpm agent:verify`.
- **Command**: `pnpm agent:verify` (or `bash tools/scripts/agent-verify.sh`).
- **Autonomous Self-Healing**: If any of the 8 verification gates fail (TypeScript, Biome, Architectural Boundaries, Contract Drift, SkillSpector, MCP Registration, Token Budget, Rule Drift), autonomously diagnose the failure, implement the fix, and re-run until achieving `100% PASS`. Do not stop or ask the user to fix compiler or lint errors.

## 2. Dynamic On-Demand Context Leasing (`skills-mcp` & `slim-tooling-mcp`)

- **Directive**: NEVER attempt to preload or hold full rule catalogs, skill directories, or raw MCP schemas in prompt memory.
- **Skill Leasing**: Pull skills dynamically via `skills-mcp` (`acquire_skill`) and release them immediately upon task completion via `return_skill()`.
- **Context Leasing**: Pull scoped architectural slices via `acquire_context()` and free via `release_context()`.
- **Virtual Tool Routing**: Route external tool calls on-demand through `slim-tooling-mcp` (`call_upstream_tool`) rather than registering heavy direct MCP servers.

## 3. STM-0 Structured Thinking Mandate

- **Directive**: For any non-trivial change, architectural mutation, or bug fix, execute the 5-phase STM-0 structured thinking protocol (`.agents/rules/structured-thinking-mandate.md`):
  1. **Comprehension**: Restate requirements, classify intent, and establish boundary invariants.
  2. **Evidence**: Trace concrete file locations, AST symbols, and live git status before editing.
  3. **Solution**: Design minimal, idiomatic, single-responsibility changes (YAGNI).
  4. **Criticism**: Adversarially challenge the design for edge cases, performance, and breaking changes.
  5. **Execution**: Implement atomically, run verification gates, and record detailed evidence.

## 4. Scoped Task Progression & Pattern Familiarity

- **Directive**: Decompose large objectives into smaller, atomic, sequentially executable subtasks before mutating disk state.
- **Pattern Alignment**: Study existing conventions in neighboring modules (e.g. data-access patterns, Server Actions, light-mode OKLCH tokens) before creating new abstractions. Build confidence on tightly scoped slices before multi-package refactors.

## 5. Structural AST Exploration over Prompt Dumping

- **Directive**: NEVER cat or dump large source files into prompt context.
- **Tooling Hierarchy**:
  - Use `codemap` (`codemap mcp` or `call_mcp_tool`) for SQLite symbol lookup, imports, and AST call graphs.
  - Use `code-index` for sub-millisecond Rust AST symbol search, caller/callee graphs, and fast full-text search.
  - Use `ast-grep` (`sg`) or `ripgrep` (`rg`) for structural pattern matching.

## 6. Continuous Invariant Auditing

- **Directive**: Respect the 11 Non-Negotiable Invariants and regularly run the specific audit check corresponding to the domain being modified:
  - **Boundary Integrity**: `pnpm policy:check`
  - **Design & Light-Mode Tokens**: `pnpm audit:tokens` (`node tools/audits/audit-design-tokens.cjs`)
  - **Data Fetching & Boundaries**: `pnpm audit:data-fetching`
  - **Next.js 16 Caching**: `pnpm audit:caching`
  - **Turbopack & Chunks**: `pnpm audit:turbopack`
  - **Server Actions & Routes**: `pnpm audit:routing`
  - **React 19 Server Components**: `pnpm audit:rsc`
  - **Next.js Image Stability**: `pnpm audit:images`
  - **Client Hooks & Testing SSoT**: `pnpm audit:hooks`
  - **Vercel Deployment Preflight**: `pnpm audit:vercel` (`node tools/scripts/vercel-preflight.cjs`)
