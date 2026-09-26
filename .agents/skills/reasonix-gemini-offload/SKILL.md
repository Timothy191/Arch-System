---
name: reasonix-gemini-offload
description: Orchestrates a dual-phase workflow using DeepSeek-Reasonix for heavy initial reasoning and then handing off execution to Gemini Pro.
---

# Dual-Phase Workflow: DeepSeek-Reasonix & Gemini Pro

## Overview
When tasks involve extreme logical complexity (e.g., massive refactors, deep architectural mapping, or resolving circular dependencies), the swarm MUST split the task into two distinct phases using the Reasonix wrapper.

1. **Phase 1 (Reasoning):** We invoke `DeepSeek-Reasonix` (via `npx reasonix`). Its prefix-caching architecture makes it ideal for churning through the codebase to build a semantic map of the problem and compute the reasoning tree.
2. **Phase 2 (Execution):** Once Reasonix concludes its reasoning phase, the orchestrator immediately hands off the synthesized plan to **Antigravity CLI (Gemini 3.8 Flash Low)**. The `agy` client uses its vast context window and native integration to execute the actual code mutations blazingly fast.

## Autonomous Usage
To invoke this dual-phase offload, do not attempt to run the agents manually in the chat. Instead, execute the wrapper script:
`bash scripts/agents/reasonix-gemini-offload.sh "Your complex task prompt here"`

The script will automatically proxy the request through the `npx reasonix` headless runner and then configure the environment for the Gemini Pro execution handoff.
