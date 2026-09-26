---
name: ouroboros-os
description: The Ouroboros evolutionary loop. Natively integrates the 5-stage Ralph cycle (Interview, Seed, Execute, Evaluate, Evolve) for complex Gemini-powered tasks using Command Code.
---

# Ouroboros OS: Evolutionary Workflow

## Overview
Based on the `Q00/ouroboros` architecture, this skill mandates that agents do not just iterate, they **evolve**. Complex tasks must be driven through a 5-stage loop until the ontology similarity (understanding) reaches absolute convergence.

## The 5-Stage Evolutionary Loop

When executing a complex, ambiguous, or massive feature request, the swarm MUST use this loop:

1. **Interview:** Launch a Socratic questioning phase with the user or a reflection agent to expose hidden assumptions.
2. **Seed:** Crystallize the answers into an immutable specification artifact (`seed.md`).
3. **Execute:** Hand off the specification to **Command Code AI** (powered by Gemini models).
4. **Evaluate:** Pass the generated code through the 4-Pillar Quality Gates (Mechanical, Semantic, Real-World ARWR).
5. **Evolve:** If evaluation fails, trigger the "Wonder" phase: *"What do we still not know?"* Reflect, update the seed, and run the next generation.

## Execution Handoff (Antigravity CLI)
To trigger the execution phase of the Ouroboros loop, the orchestrator invokes the Antigravity CLI directly in the terminal, setting the backend to the fast Gemini 3.8 Flash model:
`agy --model gemini-3.8-flash-low --dangerously-skip-permissions --print "Implement the spec in seed.md"`

## Orchestration Script
Run `bash scripts/agents/ouroboros-os.sh <task>` to autonomously spin up this 5-stage evolutionary cycle.
