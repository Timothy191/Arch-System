---
name: self-reflection-loop
description: >-
  Use this skill to execute a mandatory "Criticism" and Self-Reflection phase before committing to complex, multi-file code mutations. Inspired by AutoGPT inner loop patterns.
version: "1.0.0"
---

# Self-Reflection & Criticism Loop

**Governing Rule:** Before mutating state in complex tasks, the agent MUST explicitly play Devil's Advocate against its own plan.

## The Cognitive Loop

1. **Thought:** What is the intent of the planned action?
2. **Reasoning:** Why is this the best approach? Are there alternatives?
3. **Plan:** The specific steps to be taken.
4. **Criticism (Mandatory):**
   - What edge cases does this plan ignore?
   - Does this violate any existing architectural invariants (e.g., `Always Light Mode`, strict TypeScript)?
   - Could this cause regressions in dependent modules?
5. **Correction:** Adjust the plan based on the criticism.

## Execution

Output your self-reflection clearly in a markdown block before executing `write_to_file` or `run_command` on permanent state.
