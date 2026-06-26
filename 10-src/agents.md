# 🤖 Active Persona Registry

- **Antigravity Lead Orchestrator**: The primary local-first AI architect managing complex, modular project structures and local markdown vaults.

## Project-wide agent lifecycle (Cursor)

All agents in this workspace are subject to:

| Marker                                      | Rule                                                                                                                | Hook event                              |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| `[TOKEN-SAVING AGENT MANIFEST]`             | `10-src/TOKEN-SAVING-AGENT-MANIFEST.md`, `.cursor/rules/token-saving-agent-manifest.mdc`                            | `sessionStart` (all CLI agents)         |
| `[CONTEXT-ANCHOR HOOK]`                     | `.cursor/rules/context-anchor.mdc`                                                                                  | `sessionStart`                          |
| `[OOPS GUARDRAILS]`                         | `.cursor/rules/oops-guardrails.mdc`                                                                                 | `sessionStart`                          |
| `[3-PASS OPTIMIZATION]`                     | `.cursor/rules/three-pass-optimization.mdc`                                                                         | `sessionStart`                          |
| `[LIBRARIAN SKILL WORKFLOW]`                | `.cursor/rules/librarian-skill-workflow.mdc`                                                                        | `sessionStart`                          |
| `[ZERO-TRUST DEFENSIVENESS HOOK]`           | `.cursor/rules/zero-trust-defensiveness.mdc`                                                                        | `sessionStart`                          |
| Deterministic Performance / Unified Cascade | `.cursor/rules/deterministic-performance-sanity-check.mdc`, `.cursor/rules/unified-system-cascade-verification.mdc` | `sessionStart`                          |
| `[STRUCTURAL_AUDIT HOOK]`                   | `.cursor/rules/structural-audit.mdc`                                                                                | `stop` (`loop_count=0`)                 |
| `[CONTEXT-PRUNING HOOK]`                    | `.cursor/rules/context-pruning.mdc`                                                                                 | `preCompact`, `stop` (every 6 turns)    |
| `[QA_RESPONSE_REVIEW]`                      | `.cursor/rules/qa-response-review.mdc`                                                                              | `stop` (`loop_count=1`), `subagentStop` |
| `[PATCH-ONLY]` / `[REPORT-FORMAT]`          | `.cursor/rules/patch-only-delivery.mdc`                                                                             | alwaysApply                             |
| `[TRACE-*]` / `[APPEND-UPGRADE]`            | `.cursor/rules/trace-reflective-optimization.mdc`                                                                   | alwaysApply                             |

Compliance rules are `alwaysApply: true`. Hook scripts live in `.cursor/hooks/`.
