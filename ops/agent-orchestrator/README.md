# Agent orchestrator

Clones **product-layer** patterns from frontier agentic models into this repo's harness (model-agnostic).

## Commands

| Script | Pattern source | Purpose |
|--------|----------------|---------|
| `classify-effort.py` | Opus 4.8 adaptive thinking | Tier: low / medium / high + recommended path |
| `verify-gate.sh` | Fable 5 self-verify | Scoped lint/type-check/RLS before claiming done |
| `dynamic-workflow.md` | Opus 4.8 / Fable 5 | Plan → parallel lanes → verify → consensus |

## Usage

```bash
# Triage user task
python3 03_operations_automation/agent-orchestrator/classify-effort.py "add RLS migration for fleet table"

# Before done / PR / summarize
bash 03_operations_automation/agent-orchestrator/verify-gate.sh
```

## Rules

- `.cursor/rules/frontier-agentic-patterns.mdc` — model → harness map
- `.cursor/rules/adaptive-agentic-mode.mdc` — integrates effort + verify gate

## What we cannot clone locally

- Fable 5 days-unattended runtime (needs hosted agent + model)
- Grok inference-time 4-agent debate (use `ce-adversarial-reviewer` subagent instead)
- Gemini 2M context (use `rg` slices + progressive disclosure)
