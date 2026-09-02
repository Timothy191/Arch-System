# Agent Tracer - @repo/agents

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
