---
name: deer-flow
description: ByteDance flow-based multi-agent execution framework with graph harnesses, contract validation, and workflow automation.
---

# Deer-Flow Agent Framework

Deer-Flow is ByteDance's open-source flow-based agent system for orchestrating complex pipelines across contracts, frontend, and backend runners.

## Repository Location

- Root: `/home/tim/Fork/deer-flow`
- Backend: `/home/tim/Fork/deer-flow/backend` (Python 3.12 + `uv`)
- Frontend: `/home/tim/Fork/deer-flow/frontend` (Next.js + Tailwind)

## Autonomous Invocation

Execute backend test harnesses or flow nodes:

```bash
cd /home/tim/Fork/deer-flow/backend
uv run --directory /home/tim/Fork/deer-flow/backend python debug.py --help
```

## Agent Guidelines

1. Adhere to the contracts defined in `/home/tim/Fork/deer-flow/contracts/`.
2. Integrate flows with LangGraph definitions in `backend/langgraph.json`.
