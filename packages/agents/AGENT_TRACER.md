# Agent Tracer - @repo/agents

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
