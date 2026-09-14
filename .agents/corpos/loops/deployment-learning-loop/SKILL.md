---
name: deployment-learning-loop
description: Executes the post-deployment capability validation. Triggers the self-improving loop if a monitoring or diagnostic gap is observed after deployment.
---

# Skill: Post-Deployment Learning Loop

## Execution Contract (Runbook)

**Phase 1: Ingest**

- Read recent deployment logs.
- Execute `sidekick health` and `sidekick status`.

**Phase 2: Analyze**

- Identify any failed endpoints or degraded services.
- Search current `.agents/skills/` and `.agents/rules/` for existing diagnostic coverage of the identified failure.

**Phase 3: Decision Gate (Self-Improving Loop Phase 1)**

- If diagnostics are missing or insufficient, decide whether to BUILD (e.g., a specific log parser, a specialized SCADA health checker) or CHAIN existing tools.
- Adhere strictly to the zero-overhead mandate.

**Phase 4: Scaffold & Validate (Self-Improving Loop Phases 2 & 3)**

- Scaffold the required diagnostic rule/skill.
- Spawn a verification pass (`agent-readiness-auditor` or self-chain).

**Phase 5: Emit**

- Output the newly generated capability context and state the completion of the post-deployment check.
