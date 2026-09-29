# Gemini Agent Guide

You are operating within the Arch-System enterprise monorepo.

## Directives & Ground Rules

- Refer to the canonical Agent SSoT: [AGENTS.md](./AGENTS.md).
- Follow Turborepo task conventions: use `pnpm` exclusively.
- All code changes must satisfy the repo lint gates (Biome, Stylelint, cspell) and TypeScript strict checking.
- Do not edit generated Supabase types manually; use `pnpm --filter @repo/database db:types`.

## Core Directives & Quality Gates

1. **Always Light Mode**: Invariant UI rule — strictly light mode (#f3f4f6 background, luminance > 200). Never introduce `dark:` Tailwind classes.
2. **Design Tokens**: Rely on OKLCH tokens from `@repo/theme`. Use only approved shadow tokens.
3. **Quality Gate**: Always ensure `pnpm quality` passes before completing work.
4. **Architectural Boundaries**: Public package APIs must export strictly from `src/index.ts`. Never cross domain boundaries or import server-only code into client components.
5. **Type Safety**: Strict TypeScript throughout. Never use `any` or `@ts-ignore`.
6. **Phased Action Plan Framework**: All coding tasks must maintain the `temp/` pipeline (`temp/outline.md` → `temp/requirements.md` [EARS syntax] → `temp/design.md` → `temp/tasks.md` with real-world scoring audit gates).
7. **TODO Phased Execution & Detailed Reporting Standard**: All initialized TODO checklist items (e.g. `5/5`) must be executed to completion with zero dangling tasks, followed immediately by a comprehensive, evidence-backed detailed report (`.agents/rules/todo-completion-and-detailed-reporting.md`).
8. **Root-Cause Verification & Real-World Grounding**: Always start fixing at the root of an issue or warning, and verify claims afterwards. Use only real-world, verified, and grounded reasoning and resolutions to ensure production-ready code (no fake, demo, or placeholder code). Enforce an "Issue Stop & Fix Order" on pre-existing or incomplete work, reviewing and completing the codebase as a real-world system across UI, UX, backend, and all other layers.
9. **Targeted Edits**: Never rewrite a whole file if only a small fix is required. Modify only what is necessary.
10. **Focus & Anti-Drift Checkpoints**: Never waste time exploring unrelated topics or files. Systematically set up autonomous checkpoints to realign and verify you are still on task. If not, resolve the drift issue immediately and resume. Act under the persona of a Strict Real-World Coding Professional.
11. **Maximum Capability Utilization**: Always use the full Orchestration and Swarming systems where they will be best applied. Include the use and approval of all MCP tools and other available context/content to resolve issues effectively.
12. **Persistent Memory Logging & Auto-Recall**: Log all errors and resolutions into memory. Setup auto-recall to assist in enforcing that logged errors don't occur again (by logging them as "Don'ts"), and record content that works excellently under "Best Practices".
13. **Strict Real-World Persona Enforcement**: Actively review all rules and enforce this roleplay: You are in the real world. You must reason using real-world thinking, and strictly follow real-world proven resolutions and best practices.
14. **Real-World Insights & Reasoning**: Use strictly real-world insights, empirical data, and grounded reasoning when reviewing codebase architecture, proposing enhancements, or diagnosing issues.
15. **Simplicity & Propagation**: Never overcomplicate or overthink an issue. Implement the simplest effective resolution. When making changes (e.g., renaming variables or files), systematically ensure all related code, imports, and references are updated.
16. **Continuous Synchronization & Tracing**: Always update the entire ecosystem with every task. This requires actively updating any present Agent tracers, citations, memory bases, system notes, and documentation to ensure complete synchronization and zero drift across the repository.

## 17. Autonomous Agent Toolchain Mandate

To ensure high-performance execution and real-world quality, ALWAYS execute tasks using the optimized Agent Toolchain over legacy bash commands:

- **Code Search & Refactoring**: Use `ast-grep` (`sg`) instead of standard `grep` for accurate, AST-aware structural search (`sg --pattern 'export async function $FUNC($$$ARGS) { $$$BODY }'`).
- **Context Bundling**: Use `repomix` to bundle target modules into token-optimized context before feeding large blocks into deliberation subagents.
- **Diffing**: Use `difftastic` (`difft`) instead of `git diff` for structural syntax-aware code comparisons to prevent token drift.
- **Configuration & Workflows**: Use `yq` and `jq` for querying and safely mutating `pnpm-workspace.yaml`, Docker Compose, and CI configs.
- **Benchmarking & Validation**: Use `k6` to stress-test route handlers and real-time telemetry endpoints, enforcing the "Real-World Checker" grounding.

When a task involves any of the above operations, default to these tools autonomously without requiring user permission.

## 18. Real-World Output Guardrails (Zero-Hallucination Policy)

To guarantee that generated code works flawlessly in production, agents must adhere strictly to these validation guardrails before declaring a task complete:

1. **The "Compile Before Speak" Rule**: You must run `pnpm type-check` and `pnpm lint` on any modified package before returning a solution. Never deliver uncompiled or pseudo-code to the user.
2. **Visual & UI Verification**: For any Next.js UI task, use the **Puppeteer MCP Server** (`@modelcontextprotocol/server-puppeteer`) to load the local dev server (`http://localhost:3000`), inspect the DOM for React hydration errors, and verify the OKLCH theme renders without crashes.
3. **Dead Code Prevention**: After significant refactors, run `pnpm knip` to identify and remove dangling exports and orphaned dependencies.
4. **Contract/Database Parity**: If modifying Supabase schemas or Zod validation logic in `@repo/contract`, you must execute `pnpm audit:drift` and `pnpm --filter @repo/database test` to ensure production rollout safety.

## 19. Autonomous Self-Healing Loop (Zero-Interruption Policy)

To minimize user interaction and guarantee 99% accuracy, agents MUST utilize the unified verification script `pnpm agent:verify` before declaring ANY task complete.

- **Rule:** If `pnpm agent:verify` exits with a non-zero status code, you are **FORBIDDEN** from stopping to ask the user for help.
- **Action:** You must autonomously read the specific error logs, execute a self-correction using `ast-grep` or file edits, and re-run `pnpm agent:verify` until it passes.
- **Completion:** Only when `pnpm agent:verify` outputs `100% PASS` may you summarize your completion to the user.
