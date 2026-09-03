# Multi-Agent Protocols & 4-Agent Critique Council

## 1. 4-Agent Critique Council Scoring System

Before any system modification, schema update, or refactoring is approved, it must be evaluated across 4 critical perspectives with an overall score threshold $\ge 98\%$:

| Perspective | Focus Area | Minimum Bar |
| :--- | :--- | :--- |
| **Angle 1: Architectural Integrity & OS Standards** | XDG adherence, system boundaries, lifecycle correctness, concurrency safety, data-flow integrity, SOLID adherence. | $\ge 98\%$ |
| **Angle 2: Performance, Latency & Anti-Bloat** | Execution efficiency, memory footprint, bundle size, zero extraneous dependencies, non-blocking execution. | $\ge 98\%$ |
| **Angle 3: Security, Robustness & Error Boundaries** | Input validation, defensive handling, failure recovery, credential safety, zero unhandled exceptions. | $\ge 98\%$ |
| **Angle 4: Maintainability, Docs & Cascading Consistency** | Zero orphan symbols/files, complete imports, typing completeness, wiki & storybook updates. | $\ge 98\%$ |

## 2. Refinement Loop Protocol

If any perspective scores $< 98\%$:
1. Immediately halt execution.
2. Formulate a targeted remediation plan.
3. Apply structural fixes.
4. Re-evaluate against the 4 perspectives until all clear $\ge 98\%$.

## 3. The RISEN Prompt Engineering Standard

All multi-agent delegations via `@repo/agents` (`SubagentCoordinator`) and subagent prompts must follow the **RISEN** framework:

```
<role>
Specialist role with domain ownership (e.g., Lead Database Architect)
</role>
<instructions>
Exact task directive with verifiable success criteria
</instructions>
<steps>
1. Sequential first-principles execution step
2. Verification checkpoint
</steps>
<expectation>
Structured output contract (JSON, typed Markdown, AST diff)
</expectation>
<constraints>
- Negative constraints (zero placeholders, zero mocks)
- XDG Base Directory adherence
</constraints>
<context>
Target workspace metadata (e.g. @[path])
</context>
```

## 4. Langfuse Observability & Tracing Lifecycle

- **Root Orchestration Spans**: Every multi-agent run records an overarching orchestrator trace (`subagent-orchestrator`).
- **Child Specialist Spans**: Each specialist task executes within a child generation (`specialist-${role}`) capturing prompt tokens, completion tokens, execution latency, and specialist output.
- **Synthesis Span**: Aggregated specialist reports are merged into a synthesized document via `orchestrator-synthesis` and flushed asynchronously.

## 5. Agent Tracing & Breadcrumbs

- **`AGENT_TRACER.md`**: Assistants must append an ISO 8601 timestamped entry documenting context handover, files modified, and rationale.
- **Inline Breadcrumbs**: Annotate non-obvious logic with `// AGENT-TRACE: <explanation>`.

