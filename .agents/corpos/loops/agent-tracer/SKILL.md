# Skill: Verify AGENT_TRACER.md coverage

## Objective
Scan recent git commits and ensure that `AGENT_TRACER.md` has been updated in the corresponding packages.

## Execution
1. Run `node tools/audits/audit-agentic-content.cjs` or manually inspect git diffs.
2. If missing, warn the agent/user to update the tracer before committing.
