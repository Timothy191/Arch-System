---
name: plandex-planner
description: Integration skill for autonomously delegating project planning, context assembly, and plan handovers to the Plandex CLI agent powered by Gemini Antigravity.
---

# Plandex Autonomous Planner Runbook

## Overview
When the `/plan` or `/goal` triggers are activated, the swarm orchestrator will default to invoking the Plandex agent (running via CLI) to map out the goal, digest the context, and produce the execution plan. Plandex is powered by Gemini and acts as the senior architectural planner.

## Procedure: Autonomous Handoff to Plandex

When executing a complex plan:
1. **Initialize Project:** 
   Run `plandex new <plan-name>` in the terminal.
2. **Context Loading:**
   Feed the required context to Plandex autonomously:
   `plandex load . --recursive` (for targeted directories).
3. **Model Selection:**
   Configure Plandex to use the Gemini engine:
   `plandex set-model gemini-1.5-pro` (or the configured max model).
4. **Delegate the Plan:**
   Instruct Plandex to build the ARWR-compliant plan:
   `plandex tell "Create a step-by-step architectural plan for [TASK]. Output strictly as Plan.md in the root directory."`
5. **Handoff (Swarm Resumption):**
   Once Plandex generates `Plan.md`, the T0 Orchestrator reads the file and delegates the actual coding tasks to the T1 Swarm Specialists (e.g. `dag-orchestrator`).

## Enforcement
This skill ensures that the agent does not try to hallucinate long-term plans in a single zero-shot prompt. Plandex handles the heavy lifting of context assembly before the builders start writing code.
