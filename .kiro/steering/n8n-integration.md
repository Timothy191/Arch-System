---
description: n8n workflow engine integration for agent augmentation. Use n8n MCP tools to execute, orchestrate, and monitor workflows that supercharge agent capabilities.
inclusion: auto
---

# n8n Workflow Engine Integration

This project uses n8n (running at `http://localhost:5678`) for agent augmentation. n8n workflows are accessible via MCP tools listed below.

## Available Workflows

| Pattern                  | Webhook Path                     | What It Does                                                      | When to Use                                                       |
| ------------------------ | -------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------- |
| 1. Tool Batcher          | `/webhook/tool-batcher`          | Executes multiple tool calls in one round-trip (Code sandbox)     | Sending 3+ independent tool calls; reduces LLM round-trips by 91% |
| 2. Function Orchestrator | `/webhook/function-orchestrator` | Routes actions to specialized handlers (search, store, code exec) | Single agent tool call needs to trigger a multi-step process      |
| 3. Skills Loader         | `/webhook/skills-loader`         | Fetches specific skill prompts on-demand by intent                | Avoid bloating system prompt; only load needed skill context      |
| 4. Vector Memory         | `/webhook/vector-memory`         | Search or store memories in LTM JSONL store                       | Cross-session recall; 50-70% token savings                        |
| 5. Hybrid Memory         | `/webhook/hybrid-memory`         | Combines short-term window + long-term LTM search                 | Full context view: recent turns + past sessions                   |
| 6. Orchestrator-Worker   | `/webhook/orchestrator-worker`   | Decomposes task, dispatches parallel workers, merges              | Complex multi-file work, parallel feature development             |
| 7. Evaluator-Optimizer   | `/webhook/eval-optimizer`        | Self-refinement loop: generate → evaluate → improve               | Code review, output quality improvement, iterative refinement     |
| 8. Parallel Executor     | `/webhook/parallel-executor`     | Fetches multiple independent data sources in parallel             | Research tasks, data gathering, multi-source analysis             |
| 9. Observability         | `/webhook/observability`         | Tracks token usage, tool calls, bottlenecks, cost                 | Cost tracking, performance monitoring, session health             |
| 10. Guardrails           | `/webhook/guardrails`            | Validates actions against safety rules, hard limits               | Pre-flight check before dangerous operations                      |

## MCP Tools

The n8n MCP server exposes these tools:

- `n8n_list_workflows` — List all workflows (optional search filter)
- `n8n_get_workflow` — Get workflow details by ID
- `n8n_execute_workflow` — Execute a workflow via webhook POST
- `n8n_check_execution` — Check execution result by ID
- `n8n_import_workflow` — Import a workflow JSON
- `n8n_activate_workflow` / `n8n_deactivate_workflow` — Toggle workflow state
- `n8n_search_workflows_by_tag` — Find workflows by tag

## When to Use n8n Workflows

Use n8n workflows when:

- Task requires 5+ sequential tool calls (use Pattern 1: Tool Batcher)
- Task has independent parallel sub-tasks (use Pattern 6/8)
- Agent needs cross-session memory recall (use Pattern 4/5)
- Action could be dangerous (use Pattern 10: Guardrails)
- Monitoring token cost or performance (use Pattern 9)
- Need to reduce LLM round-trips and token consumption

Skip n8n when:

- Simple single-tool operation (use direct tool call)
- Emergency hotfix (speed over optimization)
- n8n service is down (fall back to direct execution)

## Usage Pattern

```
1. Check if n8n is available: n8n_list_workflows
2. Select appropriate workflow pattern
3. Execute: n8n_execute_workflow with webhook_path + data
4. Process results in agent context
5. Log findings to LTM for future recall
```

## n8n + LTM Integration

Pattern 4 (Vector Memory) and Pattern 5 (Hybrid Memory) directly read/write LTM JSONL stores. This means:

- LTM gains semantic search via n8n workflows
- LTM data is accessible from outside Kiro (via n8n web UI)
- Performance data from Pattern 9 is persisted to LTM automatically
