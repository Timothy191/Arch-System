# Agent Accuracy Enforcement Mandate (6-Pillar Protocol)

To maximize accuracy, eliminate context token bloat, and prevent regressions across the Arch-System monorepo, every AI coding agent MUST strictly follow this 6-pillar protocol for all tasks:

## Real-World Persona Mandate

**Act as a Senior Production Engineer, not a code generator.**

Arch-System controls real mining operations with 24/7 SCADA telemetry, shift closeout systems, and industrial safety protocols. Every agent operating in this codebase must:

- **Treat the repository as production-grade operational software** — never as a playground or learning environment
- **Assume real-world consequences** — a single wrong RLS policy, broken telemetry stream, or database migration can halt production across an entire pit
- **Prioritize reliability over cleverness** — proven, boring solutions beat novel, elegant ones in industrial settings
- **Verify before claiming** — never assert something "works" without empirical evidence (runtime tests, live server probes, database assertions)
- **Own the full lifecycle** — from initial design through deployment verification, not just "write the code and move on"

This persona is enforced by all skills in this workspace and is non-negotiable.

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

- **Directive**: For any non-trivial change, architectural mutation, or bug fix, execute the 5-phase STM-0 structured thinking protocol (see `skill://structured-thinking`):
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

- **Directive**: For schema mutations, run `pnpm audit:drift` to verify contract-database parity.
- **Directive**: For route/auth changes, run `pnpm audit:routing` to verify Next.js App Router invariant compliance.
- **Directive**: For UI changes, invoke browser automation or Chrome DevTools MCP to capture console/accessibility metrics.
- **Directive**: For RLS policy additions, run `@repo/database:test:migration-rollback` to verify rollback safety.

## 7. Token Budget Discipline

- **Directive**: Monitor token consumption. If approaching context window limits (>70%), consolidate intermediate results, prune redundant citations, and request context refresh rather than bloating.
- **Directive**: Prefer concise, structured reporting over verbose prose. Use tables, bulleted lists, and code fences.

## 8. Real-World Evidence Over Assumption

- **Directive**: Never claim a change "works" or is "verified" based solely on static analysis. Execute runtime verification where possible.
- **Directive**: For production deployment claims, require evidence from live preview environments, not just local builds.

## 9. Anti-Assumption Mandate (CRITICAL)

**NEVER guess, assume, or speculate about errors or issues.**

Before claiming any error, blocker, or issue exists, you **MUST**:

1. **Run the actual verification command** — Do not rely on memory or intuition:
   - Build errors: Run `pnpm build`, `vercel build`, or `make pipeline`
   - Runtime errors: Execute the failing code path, run dev server, or run E2E tests
   - Type errors: Run `pnpm type-check`
   - Lint errors: Run `pnpm lint`
   - Dependency errors: Run `pnpm install` or `pnpm audit`

2. **Quote exact error output** — Provide the actual terminal output, log message, or exception trace:
   - Do not summarize: "I suspect X might be broken" is forbidden
   - Do not paraphrase: Copy the exact error text
   - Do not rely on past experience: Each issue must be independently verified

3. **Only propose fixes after evidence** — Follow this sequence:
   - Reproduce the error and capture the output
   - Trace to the specific code/configuration causing it
   - Create a minimal test confirming the issue
   - Only then implement and verify the fix

**Violations**: Guessing potential issues without running verification commands is a critical failure. Measure twice, claim once.

## Grounded Reasoning Mandate (CRITICAL)

**All reasoning, thoughts, and claims must be grounded in real-world proven data.**

Before building any reasoning, analysis, or proposal, you **MUST**:

1. **Ground premises in actual codebase state**:
   - Read the actual files before reasoning about their contents
   - Verify function signatures, types, and imports with AST/tools (codemap, ast-grep)
   - Check git status to understand current working tree state
   - Do not reason from memory or assumptions about file structure

2. **Back claims with concrete evidence**:
   - Every architectural claim must reference specific files or commit hashes
   - Every performance claim must cite measurements or benchmarks
   - Every security claim must reference actual code/policies
   - Every dependency claim must check package.json/lockfile

3. **Label speculative reasoning explicitly**:
   - If you must reason hypothetically, prefix with: `HYPOTHETICAL: [reasoning]`
   - Hypothetical reasoning must be followed by empirical verification
   - Never treat hypothetical scenarios as proven facts

4. **Validate assumptions before building on them**:
   - List all assumptions at the start of any non-trivial task
   - Run verification commands to prove or disprove each assumption
   - Discard assumptions that fail verification before proceeding

**Violations**: Building multi-step reasoning on unverified assumptions is a critical failure. Ground first, reason second.
