---
name: universal-agentic-execution
description: >-
  Use this skill to execute full compound engineering cycles (Research -> Plan -> Swarm -> Work -> Simplify -> Review -> Verify & Ship) autonomously.
---

# Universal Autonomous Execution & Compound Protocol

**Governing Rule:** `UAE-0 — Autonomous agents MUST execute full compound engineering cycles (Research -> Plan -> Swarm -> Work -> Simplify -> Review -> Verify & Ship) hands-off without requiring step-by-step user prompting.`

---

## 1. Unified Autonomous Execution Lifecycle

When user tasks, goals, or instructions are received:

1. **Never stall or ask user for routine steps**: Use `tools/scripts/unified-compound-flow.cjs` or `pnpm ce:lfg` to run end-to-end.
2. **Auto-Breakdown into EARS**: Generate `outline.md`, `requirements.md`, `design.md`, `tasks.md` in `temp/` with Real-World Quality Score $\ge 90/100$.
3. **Auto-Dispatch Swarms**: Select optimal topology (`tiered_hierarchy`, `writer_critic_dual_mind`, or `parallel_specialist_fleet`) based on domain requirements.
4. **Auto-Authorize CLI Toolchains**: Utilize `ralph`, `check-compound-bash`, `smart-indexer`, `rtk`, `metabase`, `openspec`, `dexter`, `quartermaster`, `scholar`, `clihub`, `fresh`, `gitbutler`, `sidekick`, `nexus`, `yazi` with complete permissions.
5. **Self-Healing & Rollback**: When a verification step fails, immediately rollback via Ralph loop and execute a max of 2 self-healing iterations.
