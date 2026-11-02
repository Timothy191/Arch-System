# Agent Tracer - @repo/agents

## 2026-11-02T19:26:00+02:00 - Programmatic STM-0 Structured Thinking Enforcement (`QualityGate`, `ReflectionEngine`, `AgentPillarEnvelope`, `runHarnessDoctor`)

- **Phase 1 (Comprehension)**: Verify and improve the `structured-thinking` (STM-0) mandate across `.agents/rules/structured-thinking-mandate.md`, `.agents/skills/structured-thinking/SKILL.md`, and `@repo/agents` so the 5-phase protocol (Comprehension, Evidence, Design, Criticism, Contract) is programmatically enforced in `QualityGate`, `ReflectionEngine`, `AgentPillarEnvelope`, and `runHarnessDoctor` with zero external API overhead.
- **Phase 2 (Evidence)**: Inspected `.agents/rules/structured-thinking-mandate.md`, `.agents/skills/structured-thinking/SKILL.md`, `packages/agents/src/{prompt-envelope.ts,quality-gate.ts,reflection-engine.ts,harness-engine.ts,harness-engine.test.ts}`, and `tools/audits/audit-agentic-content.cjs`.
- **Phase 3 (Design)**:
  - `src/prompt-envelope.ts`: Added `STM_0_MANDATORY_PHASES` and compiled Section `5B. STRUCTURED THINKING MANDATE (STM-0 PROTOCOL)` into `AgentPillarEnvelope.compileSystemPrompt()`.
  - `src/quality-gate.ts`: Implemented `QualityGate.validateStructuredThinking()` detecting Format A (`<structured-thinking>`), Format B (`<thinking>`), and Format C (`AGENT_TRACER.md` `Phase 1..5`), flagging `THINKING_MISSING` or `INCOMPLETE_STM_PHASES` when any phase is omitted.
  - `src/reflection-engine.ts`: Added `requireStructuredThinking?: boolean` to `ReflectionEngineOptions` so specialist outputs missing STM-0 phases trigger self-remediation.
  - `src/harness-engine.ts`: Added `stm-0-structured-thinking-mandate` check to `runHarnessDoctor()`.
  - `src/harness-engine.test.ts`: Added unit tests verifying Format A/C validation, `THINKING_MISSING` / `INCOMPLETE_STM_PHASES` detection, `AgentPillarEnvelope` Section 5B compilation, and `runHarnessDoctor` STM-0 diagnostics.
- **Phase 4 (Criticism)**: Kept `requireStructuredThinking` opt-in in `ReflectionEngineOptions` to preserve backward compatibility with existing unit mocks while enabling strict enforcement.
- **Phase 5 (Contract)**: Modified `src/{prompt-envelope.ts,quality-gate.ts,reflection-engine.ts,harness-engine.ts,harness-engine.test.ts}` and `.agents/skills/structured-thinking/SKILL.md`; verified with `pnpm --filter @repo/agents test`, `pnpm --filter @repo/agents type-check`, and `bash tools/scripts/agent-verify.sh`.

## 2026-11-02T14:48:00+02:00 - Unified Antigravity Gemini Harness Engine (AutoGPT + RuFlo + invisible_dots)

- **Purpose**: Integrate reverse-engineered zero-overhead agentic harness mechanisms from `Significant-Gravitas/AutoGPT`, `ruvnet/ruflo`, and `feder-cr/invisible_dots` into `@repo/agents` while standardizing all model tiers on Antigravity Gemini models (`gemini-3.6-flash`, `gemini-2.5-pro`, `gemini-2.5-flash-lite`).
- **Changes**:
  - `src/harness-engine.ts` & `src/harness-engine.test.ts`: Added `ToolPermissionGate` (3-tier `allow`/`ask`/`deny` + durable Approval Inbox), `IdempotentCallLedger` (crash-safe single-execution guarantee), `TrajectoryContrastiveStore` (zero-LLM local trajectory contrastive ranking), `AgentRoutineRegistry` (AutoGPT Otto Expert Briefs & Routines), and `runHarnessDoctor` preflight diagnostics.
  - `src/index.ts`: Exported `harness-engine`.
- **Verification**: `pnpm --filter @repo/agents test` (5/5 suites, 35/35 tests pass) and `pnpm --filter @repo/agents type-check` (0 errors).

## 2026-11-02T14:46:00+02:00 - Antigravity Model Tier Alignment & Specialist Mapping

- **Purpose**: Update specialist personas and prompt envelope with Antigravity Gemini model tiers (Pro for complex reasoning/governance, Flash for rapid telemetry/UI tasks).
- **Changes**:
  - `src/specialists.ts`: Added `ANTIGRAVITY_GEMINI_MODELS` mapping and configured `defaultModel` across all specialist personas.
  - `src/prompt-envelope.ts`: Set default model tier in runtime envelope.
- **Verification**: `pnpm --filter @repo/agents test` and `pnpm --filter @repo/agents type-check` ✅.

## 2026-11-02T14:08:00+02:00 - Autonomous Coordinator Engine & Dependency Sequencer

- **Purpose**: Implement `AutonomousCoordinator` providing multi-agent plan sequencing, topological task dependency scheduling, specialist persona resolution, critical failure abort policies, and output synthesis.
- **Changes**:
  - `src/autonomous-coordinator.ts`: Added `AutonomousCoordinator`, `sequenceSubtasks`, and zero-dependency `createConcurrencyLimiter` replacing ESM `p-limit`.
  - `src/autonomous-coordinator.test.ts`: Added unit test suite covering parallel stages, linear/diamond dependencies, and critical failure aborts (100% pass).
  - `src/coordinator.ts`: Switched to in-house `createConcurrencyLimiter` eliminating `p-limit` dependency.
  - `package.json` & `src/index.ts`: Removed `p-limit` from dependencies (verified Knip clean) and exported `AutonomousCoordinator`.
- **Verification**: `pnpm --filter @repo/agents test` (4/4 suites pass) and `pnpm --filter @repo/agents type-check` (0 errors).

## 2026-11-02T09:41:00+02:00 - Outlines Structured Generation Mandate Across All Agents

- **Purpose**: Permanently establish schema-constrained structured output generation across all AI coding agents, specialist swarms, and subagent prompts, inspired by [dottxt-ai/outlines](https://github.com/dottxt-ai/outlines).
- **Changes**:
  - `packages/agents/src/prompt-envelope.ts`: Added Outlines schema-constrained structured generation invariant to `MANDATORY_NEGATIVE_CONSTRAINTS`.
  - `.agents/skills/agent-accuracy-enforcement/SKILL.md`: Added Pillar 10: Outlines Schema-Constrained Generation Invariant enforcing deterministic JSON Schema / Zod contract compliance for all agent outputs and tool payloads.
  - `scripts/datasette-swarm-memory.sh`: Added Datasette launcher for exploring the local RuFlo Swarm SQLite memory database (`.swarm/memory.db`).
- **Verification**: `pnpm --filter @repo/agents type-check` (0 errors); `pnpm --filter @repo/agents test` (18/18 tests pass).

## 2026-09-08T10:24:37Z - Multi-Provider LLM Support in SubagentCoordinator

- **Purpose**: Extended `SubagentCoordinator` to support Gemini, Aion, Cohere, and local Ollama providers alongside OpenAI, via explicit `provider` selection or env-based auto-detection, and documented the new keys in `.env.example`.
- **Changes**:
  - `src/coordinator.ts`: Added `provider` and `baseURL` to `CoordinatorConfig`; per-provider defaults for API key, base URL, default model, and synthesis model (aion-3.0-mini/3.0, gemini-2.5-flash, command-r7b-12-2024/command-a-reasoning-08-2025, qwen2.5:3b); env fallback chain (OPENAI → GEMINI → AION → ollama) with OpenAI-compatible base URLs.
  - `.env.example`: Documented `GEMINI_API_KEY`, `AION_API_KEY`/`AION_BASE_URL`, `COHERE_API_KEY`/`COHERE_BASE_URL`/`COHERE_OPENAI_COMPAT_URL`, `API_NINJAS_API_KEY`/`API_NINJAS_MCP_URL`, `OPENROUTER_API_KEY`, `OPENAI_BASE_URL`/`OPENAI_API_KEY`/`OPENAI_MODEL`.
- **Verification**: `pnpm --filter @repo/agents type-check` (0 errors); lint-staged eslint + prettier clean; commit `385e51d`.

## 2026-09-02T11:27:00Z - Frontier Systems Research Specialist & SOTA Telemetry Integration

- **Purpose**: Introduced the `researchSpecialist` persona in `@repo/agents`, conducted industry research on smoke testing & architecture drift telemetry, and enhanced `tools/audit-contract-drift.cjs` and `e2e/visual/theme.smoke.spec.ts`.
- **Changes**:
  - `src/specialists.ts`: Added `researchSpecialist`, `realtimeEngineer`, `resilienceEngineer`, `systemSimplifier`, and `telemetryArchitect` personas.
  - `tools/audit-contract-drift.cjs`: Added automated Drift Health Index (DHI) calculation and structured JSON telemetry export.
  - `e2e/visual/theme.smoke.spec.ts`: Added synthetic performance canary timing and layout stability evaluation.
- **Verification**: Verified `pnpm turbo run @repo/agents:type-check` (0 errors) and sub-second component test suite in 0.389s.

## 2026-09-01T14:28:00Z - Technical Specialist Personas & Focus Onboarding

- **Purpose**: Onboard and define focused technical specialist personas to decouple agent execution from business departments into engineering domain roles.
- **Changes**:
  - `src/specialists.ts`: Created `SPECIALIST_PERSONAS` defining `databaseArchitect`, `uiEngineer`, `securityAndQualityGate`, and `coreCoordinator`.
  - `src/index.ts`: Exported specialist contracts and personas.
  - `agentic-system-wiki/specialist-agent-personas.md`: Documented architecture focus areas, boundaries, and narrowing constraints.
- **Verification**: Verified TypeScript compilation with `pnpm --filter @repo/agents type-check`.

## 2026-08-17 - Langfuse Observability & Tracing Integration

- **Purpose**: Integrate full Langfuse tracing into `SubagentCoordinator` following Langfuse Agent Skill best practices.
- **Changes**:
  - `package.json`: Added `langfuse` SDK dependency.
  - `src/langfuse.ts`: Created `getLangfuseClient()` singleton supporting public/secret keys and cloud/self-hosted endpoints.
  - `src/coordinator.ts`: Added parent/child trace and generation tracking for specialist subtasks and orchestrator synthesis (model, temperature, tokens, status message).
  - `src/index.ts`: Exported Langfuse helpers and `RunOptions`.
- **Verification**: Verified `pnpm --filter @repo/agents type-check` compiles with 0 errors.

## 2026-06-16T22:20:45Z

- **Purpose**: Initialize subagent coordination library.
- **Changes**: Created package structure (`package.json`, `tsconfig.json`, `project.json`, `.eslintrc.js`), implemented `SubagentCoordinator` with concurrent executor and synthesis (GPT-4o/gpt-4o-mini), and exported types.
- **Handoff**: The package is ready. The next agent can build unit tests or extend specialists with specific tool-call runners.

## 2026-11-02: Multimodal image token budgeting & dual-threshold context compaction

- **Purpose**: Prevent runaway compaction loops caused by multimodal base64 image strings and establish dual-threshold context compaction (soft 85% and critical 95% limits) derived from `alphacode_compaction_core`.
- **Changes**:
  1. Added `FLAT_IMAGE_TOKEN_COST` (1,200 tokens) in `src/token-budget.ts` to charge a fixed token allowance per image rather than 50x inflated ASCII base64 char length.
  2. Implemented `estimateContentBlockTokens`, `estimateMessageTokens`, and `assessContextCompaction` with `COMPACTION_SOFT_THRESHOLD` (85%) and `COMPACTION_CRITICAL_THRESHOLD` (95%) and tail preservation of recent 20 turns.
  3. Added unit tests in `src/token-budget.test.ts` verifying base64 image flat costs and dual-threshold actions (25/25 tests passing).
- **Handoff**: Multimodal compaction evaluation is ready to be consumed by agents and coordinators.
