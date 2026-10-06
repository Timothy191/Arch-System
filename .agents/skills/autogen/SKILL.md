---
name: autogen
description: Conversational multi-agent patterns, dynamic GroupChat orchestration, and Assistant/UserProxy agent topologies using Microsoft AutoGen.
---

# Microsoft AutoGen Multi-Agent Runtime

AutoGen enables multi-agent conversation frameworks that can act as collaborative problem solvers.

## Core Capabilities

- **ConversableAgent**: Foundation class for agents that send and receive messages.
- **GroupChat & GroupChatManager**: Dynamic speaker selection with round-robin, auto-select, or LLM-arbitrated topologies.
- **Code Execution**: Docker or local subprocess sandboxing for safe script verification.
- **Magentic-One**: Autonomous multi-agent team architecture for complex web and coding tasks.

## Autonomous Agent Invocation

Run AutoGen agents directly via the dedicated virtual environment:

```bash
/home/tim/Fork/autogen/python/.venv/bin/python -c '
from autogen_core import CancellationToken
print("AutoGen Core is fully initialized and ready.")
'
```

## Agent Guidelines

1. Configure agents with low-effort Gemini Flash endpoints to maintain zero external API costs.
2. Terminate conversations when an agent emits `TERMINATE` or `<promise>DONE</promise>`.
3. Wrap tools as deterministic Python functions with typing annotations.
