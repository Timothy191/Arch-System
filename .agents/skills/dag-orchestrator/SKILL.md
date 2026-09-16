---
name: dag-orchestrator
description: >-
  Use this skill to orchestrate complex tasks as a Directed Acyclic Graph (DAG) for parallel execution. Inspired by Dify workflow patterns.
version: "1.0.0"
---

# DAG Workflow Orchestrator

**Governing Rule:** When a task can be parallelized, it MUST be decomposed into a DAG and executed concurrently using Antigravity subagents, rather than sequentially.

## DAG Representation

Represent the task dependencies in `task.md` using the following format:

```markdown
- [ ] Task A (Depends on: None)
- [ ] Task B (Depends on: None)
- [ ] Task C (Depends on: Task A, Task B)
```

## Execution Protocol

1. **Identify Roots:** Find all tasks with `Depends on: None`.
2. **Spawn Parallel Agents:** Use the `dispatching-parallel-agents` skill to spawn subagents for all Root tasks concurrently.
3. **Wait for Resolution:** Wait until all subagents for a given layer finish.
4. **Advance Layer:** Mark completed tasks as `[x]`, identify the next unblocked tasks, and repeat step 2.

This enables BaaS-level orchestration without external API overhead, relying purely on file-system state.
