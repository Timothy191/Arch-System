# Gemini Agent Guide

You are operating within the Arch-System enterprise monorepo.

> **⚠️ Unified Agent System**: All agent behavioral rules, operational guides, skills, and governance have been consolidated into `.agents/`. Read [`.agents/GUIDE.md`](./.agents/GUIDE.md) for the full operational reference.

## Directives & Ground Rules

- Refer to the canonical Agent SSoT: [AGENTS.md](./AGENTS.md).
- Refer to the unified operational guide: [`.agents/GUIDE.md`](./.agents/GUIDE.md).
- Refer to all permanent rules: `.agents/rules/` (21 rule files).
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
- **Context Bundling**: Use `repomix` (`pnpm context:pack`) to bundle target modules into token-optimized context before feeding large blocks into deliberation subagents.
- **Codebase Intelligence & Architecture**: Use `repowise` (`pnpm code:health`, `pnpm code:risk`, `pnpm code:dead`) or the `repowise` MCP server to compute change blast radius, detect dead code, and verify architecture decisions without recurring token burn.
- **Performance & Web Auditing**: Use `lighthouse` (`pnpm audit:perf`) to benchmark page performance, accessibility, and Core Web Vitals under headless Chrome/Chromium.
- **Offline Field Utilities**: Use Docker companion stacks (`it-tools` on `:8088`, `omni-tools` on `:8089` in `compose.tools.yml`) for isolated client-side document/data conversions without internet dependency.
- **Diffing**: Use `difftastic` (`difft`) instead of `git diff` for structural syntax-aware code comparisons to prevent token drift.
- **Configuration & Workflows**: Use `yq` and `jq` for querying and safely mutating `pnpm-workspace.yaml`, Docker Compose, and CI configs.
- **Benchmarking & Validation**: Use `k6` to stress-test route handlers and real-time telemetry endpoints, enforcing the "Real-World Checker" grounding.

When a task involves any of the above operations, default to these tools autonomously without requiring user permission.

## 18. Real-World Output Guardrails (Zero-Hallucination Policy)

To guarantee that generated code works flawlessly in production, agents must adhere strictly to these validation guardrails before declaring a task complete:

1. **The "Compile Before Speak" Rule**: You must run `pnpm type-check` and `pnpm lint` on any modified package before returning a solution. Never deliver uncompiled or pseudo-code to the user.
2. **Visual & UI Verification**: For any Next.js UI task, use the **Puppeteer MCP Server** (`@modelcontextprotocol/server-puppeteer`) to load the local dev server (`http://localhost:3000`), inspect the DOM for React hydration errors, and verify the OKLCH theme renders without crashes.
3. **Dead Code & Risk Verification**: After significant refactors, run `pnpm knip` and `pnpm code:risk` / `pnpm code:dead` to ensure zero orphaned exports or risk regressions.
4. **Contract/Database Parity**: If modifying Supabase schemas or Zod validation logic in `@repo/contract`, you must execute `pnpm audit:drift` and `pnpm --filter @repo/database test` to ensure production rollout safety.
5. **Image Optimization & Zero-CLS**: For any UI task introducing or modifying images in `apps/portal`, you must use `<Image />` from `next/image` with explicit dimensions/fill, alt text, and run `pnpm audit:images` to guarantee zero Cumulative Layout Shift (CLS).
6. **Server-First Data Fetching & Zero-Waterfall**: Primary data queries must run in Server Components or Server Actions via `@repo/supabase`. Independent queries must use `Promise.allSettled()`, per-request shared lookups must use `React.cache()`, and `pnpm audit:data-fetching` must pass.
7. **Cache Components & Boundary Isolation**: Next.js 16 Cache Components (`cacheComponents: true`) must pair `'use cache'` with explicit `cacheLife()` profiles. Dynamic APIs (`cookies()`, `headers()`) must be isolated behind `<Suspense>` to preserve static shell prerendering, and `pnpm audit:caching` must pass.
8. **Turbopack & Lazy Loading**: Monorepo compilation must anchor `turbopack.root: workspaceRoot`. Dynamic imports using `{ ssr: false }` are restricted strictly to Client Components (`'use client'`), heavy external libraries must be dynamically imported on demand, and `pnpm audit:turbopack` must pass.
9. **App Router & Server Actions Boundary**: Layouts and pages must default to Server Components. Interactivity must be isolated in leaf Client Components (`'use client'`). Server Actions (`'use server'`) must enforce caller authorization and invalidate cache before calling `redirect()`. `pnpm audit:routing` must pass.
10. **Server Components, Boundary & Taint**: UI components default to RSC (no directive). Interactive state must use `'use client'` with serializable boundary props. Sensitive records and tokens must be guarded with React 19 Taint APIs (`taint: true`), and `pnpm audit:rsc` must pass.
11. **Single-Source Client Query & State Invariant (Anti-SWR)**: Client data fetching is standardized on `@tanstack/react-query` alongside Server Components and Supabase Realtime CDC. Dual client caching libraries (`swr`) are strictly prohibited, and `pnpm audit:hooks` must pass.
12. **Industrial Field Hooks & SSR Hydration Safety**: Custom hooks in `libs/shared/hooks` must be engineered for harsh mining conditions (lie-fi connectivity, sensor bounce) and guard browser globals during SSR (`typeof window === 'undefined'`), and `pnpm audit:hooks` must pass.
13. **Vercel CLI & Deployment Preflight**: Monorepo builds and preview/prod deployments via Vercel CLI (`vercel`) must strictly satisfy `tools/scripts/vercel-preflight.cjs`, and `pnpm audit:vercel` must pass.
14. **Single-Source Unit Test Runner Invariant (Anti-Runner Fragmentation)**: All unit and integration tests across TypeScript packages are strictly standardized on Jest 30 with `@swc/jest`. Fragmented test runners (`ava`, `mocha`, `tape`) are prohibited to maintain a single test harness across Turborepo, and `pnpm audit:hooks` must pass.

## 19. Autonomous Self-Healing Loop (Zero-Interruption Policy)

To minimize user interaction and guarantee 99% accuracy, agents MUST utilize the unified verification script `pnpm agent:verify` before declaring ANY task complete.

- **Rule:** If `pnpm agent:verify` exits with a non-zero status code, you are **FORBIDDEN** from stopping to ask the user for help.
- **Action:** You must autonomously read the specific error logs, execute a self-correction using `ast-grep` or file edits, and re-run `pnpm agent:verify` until it passes.
- **Completion:** Only when `pnpm agent:verify` outputs `100% PASS` may you summarize your completion to the user.

## 20. Structured Thinking Mandate (STM-0)

All AI agents — regardless of model provider, framework, or execution context — MUST engage **structured, extended thinking** before executing ANY non-trivial code mutation, architectural decision, or configuration change. Reflexive code generation without demonstrated reasoning is a quality gate violation.

**The Mandatory Thinking Protocol (MTP)** requires five phases before any mutation:

1. **Situational Comprehension**: Restate the task, identify affected packages and boundary layers, map to the architecture diagram.
2. **Evidence Gathering**: Read the actual source files, trace data flows, identify existing tests and contracts. Never propose changes based on assumptions.
3. **Solution Design**: Propose at least two candidate approaches for non-trivial changes, evaluate each against the five-pillar Real-World Quality Score (Feasibility, Maintainability, Security, Performance, Industrial Reliability).
4. **Pre-Commit Criticism**: Play Devil's Advocate — analyze blast radius, invariant violations, edge cases, regression risk. If criticism reveals a flaw, revise before proceeding.
5. **Execution Contract**: State the exact files to modify, the verification commands to run, and the expected outcome. Only then begin file mutations.

**Thinking must be visible, structured, falsifiable, and self-critical.** Depth scales with risk: one-line rationale for typos, full 5-phase protocol for migrations and security changes.

**Full specification**: [`.agents/rules/structured-thinking-mandate.md`](./.agents/rules/structured-thinking-mandate.md)
