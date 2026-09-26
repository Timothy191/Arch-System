---
name: fable-method
description: The Fable Workflow (Think, Act, Prove). Adversarially tested verification methodology mapped to Antigravity CLI and Gemini models.
---

# The Fable Method

## Overview
Adopted from `Sahir619/fable-method`, this methodology forces the swarm to act honestly via a strict "Think, Act, Prove" execution model. 

While originally a Claude plugin, it has been ported to our **Antigravity CLI (agy)** and powered natively by **Gemini 3.8 Flash**.

## The 6 Tenets of Fable Execution
When a swarm subagent is modifying mission-critical logic, they MUST adhere to this loop:
1. **Classify:** Classify the ask before touching anything.
2. **Define Done:** Name the exact verification (e.g., `pnpm test`) that proves success.
3. **Primary Evidence:** Gather evidence from primary sources in parallel (no guessing).
4. **Commit:** Commit to ONE recommendation.
5. **Atomic Change:** Change the smallest correct thing.
6. **Verify:** Prove the outcome first with honest caveats via terminal output (ARWR).

## Autonomous Handoff
To run a strict Fable validation loop on your code, use the configured `agy` runner:
```bash
agy --model gemini-3.8-flash-low --print "Execute the Fable Method on this PR diff: Think, Act, Prove."
```
