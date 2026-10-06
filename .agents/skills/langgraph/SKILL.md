---
name: langgraph
description: Cyclic state-machine multi-agent graph orchestration utilizing LangGraph. Enables persistent checkpoints, human-in-the-loop breakpoints, conditional branching, and multi-agent coordination.
---

# LangGraph Multi-Agent Architecture & Runtime

LangGraph provides stateful, multi-actor agent orchestration powered by directed cyclic graphs.

## Core Capabilities

- **StateGraph**: Typed state dictionaries updated by graph nodes using reducer annotations.
- **Persistent Checkpointers**: SQLite (`libs/checkpoint-sqlite`), Postgres (`libs/checkpoint-postgres`), or memory for time-travel and session resumption.
- **Conditional Edges**: Dynamic routing decisions based on node output state.
- **Prebuilt Patterns**: ToolNode, create_react_agent, supervisor routers.

## Execution Blueprint (Zero-Overhead Agent Usage)

To execute graph workflows autonomously from Python:

```bash
/home/tim/Fork/langgraph/.venv/bin/python -c '
from langgraph.graph import StateGraph, END
from typing import TypedDict

class AgentState(TypedDict):
    task: str
    verdict: str

builder = StateGraph(AgentState)
builder.add_node("evaluate", lambda state: {"verdict": "VERIFIED"})
builder.set_entry_point("evaluate")
builder.add_edge("evaluate", END)

graph = builder.compile()
result = graph.invoke({"task": "Verify system boundary"})
print("Result:", result)
'
```

## Agent Guidelines

1. Keep graph state minimal and serializable.
2. Store long-term state transitions in SQLite checkpoint tables (`.langgraph_checkpoints.db`).
3. Leverage conditional branches rather than giant sequential loops.
