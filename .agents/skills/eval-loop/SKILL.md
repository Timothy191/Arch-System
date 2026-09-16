---
name: eval-loop
description: >-
  Use this skill to run iterative evaluation loops against generated code using the local test suite. Inspired by Loop Engineering patterns.
version: "1.0.0"
---

# Eval-Driven Iterative Refinement

**Governing Rule:** Agents MUST verify generated logic using local evaluations and enter a tight refinement loop until confidence thresholds are met.

## The Iteration Protocol

1. **Generate:** Write the initial implementation.
2. **Evaluate (Local):** Run the corresponding local tests (e.g., `pnpm --filter @repo/eval test` or `pnpm test`).
3. **Analyze:**
   - Did the test pass?
   - Were there performance warnings or coverage drops?
4. **Refine:** If the evaluation failed, DO NOT ask the user for help. You must autonomously apply a fix and return to Step 2.
5. **Exit:** Break the loop only when the evaluation passes or a hard limit of 3 iterations is reached (to prevent infinite looping).

By moving evaluation from a human review step to an autonomous inner loop, we achieve deterministic quality output.

## Dev Server & Route Health Refinement Loop

When validating runtime portal deployments:

1. **Launch:** Run `pnpm dev:turbo` as a background daemon.
2. **Probe:** Query endpoints (`curl -sI http://localhost:3000/login`, `curl -sI http://localhost:3000/<dept>`).
3. **Analyze:** Verify HTTP 200 on public entry points and 307 on auth-gated department routes.
4. **Refine:** If runtime crashes occur, capture stdout/stderr from process logs, resolve the underlying module or syntax issue, and re-evaluate without user escalation.
