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
