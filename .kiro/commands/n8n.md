# /n8n — n8n Workflow Management

Interact with the n8n workflow engine running at `http://localhost:5678`.

## Usage

```
/n8n list [search-term]       — List workflows (optional name filter)
/n8n exec <webhook-path>      — Execute a workflow via webhook
/n8n status <execution-id>    — Check execution status
/n8n get <workflow-id>        — Get workflow details
/n8n activate <workflow-id>   — Activate a workflow
/n8n deactivate <workflow-id> — Deactivate a workflow
/n8n import <file-path>       — Import workflow from JSON file
/n8n tag <tag-name>           — Search workflows by tag
/n8n help                     — Show this help
```

## Available Workflows

| #   | Name                     | Webhook Path            | Tags                  |
| --- | ------------------------ | ----------------------- | --------------------- |
| 1   | Single-Shot Tool Batcher | `tool-batcher`          | performance, tool-use |
| 2   | Function-As-A-Workflow   | `function-orchestrator` | orchestration         |
| 3   | Skills Loader            | `skills-loader`         | context, efficiency   |
| 4   | LTM Vector Memory        | `vector-memory`         | memory, ltm           |
| 5   | Hybrid Semantic Memory   | `hybrid-memory`         | memory, context       |
| 6   | Orchestrator-Worker      | `orchestrator-worker`   | multi-agent           |
| 7   | Evaluator-Optimizer      | `eval-optimizer`        | quality               |
| 8   | Parallel Executor        | `parallel-executor`     | parallel              |
| 9   | Observability Pipeline   | `observability`         | performance           |
| 10  | Guardrails               | `guardrails`            | safety                |

## Examples

```bash
# List all workflows
/n8n list

# Search for memory-related workflows
/n8n list memory

# Execute the Tool Batcher with batch calls
/n8n exec tool-batcher {"calls":[{"tool":"read_file","args":{"path":"test.md"}},{"tool":"stat","args":{"path":"test.md"}}]}

# Execute the Skills Loader
/n8n exec skills-loader {"intent":"refactor_component"}

# Execute Guardrails check
/n8n exec guardrails {"action":"git push --force","tool_calls_so_far":42}
```

## Notes

- n8n must be running. Start with: `docker compose -f docker-compose.tools.yml up -d n8n redis`
- All workflows use basic auth (plantcor/plantcor)
- Workflow JSON templates are in `tools/n8n-mcp/workflows/`
