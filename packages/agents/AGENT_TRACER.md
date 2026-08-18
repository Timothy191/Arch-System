# Agent Tracer - @repo/agents

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
