---
name: langflow
description: Visual flow and graph execution engine with headless API and MCP capabilities for rapid agentic prototyping.
---

# Langflow Visual Flow & Graph Execution Engine

Langflow provides a visual and programmatic execution framework for AI workflows, components, and tools.

## Repository Location

- Root: `/home/tim/Fork/langflow`
- Virtualenv: `/home/tim/Fork/langflow/.venv`
- Source: `/home/tim/Fork/langflow/src/backend/base/langflow`

## Autonomous Invocation

Agents can run flows or query component schemas:

```bash
/home/tim/Fork/langflow/.venv/bin/python -m langflow --help
```

## Agent Guidelines

1. Export flows as JSON specifications for reproducible deployment.
2. Interface with Langflow graphs via REST or LangGraph bridges.
