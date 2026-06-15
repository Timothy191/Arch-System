---
inclusion: manual
---

# Rate Limit Recovery Procedure

Use this when resuming from a "Too Many Requests", "429", or rate limit error.

## Recovery Steps

1. **Assess state**: Run `python3 ltm/bin/ltm.py files --limit 10` and `python3 ltm/bin/ltm.py sessions --limit 5` to see what was happening before the interruption.
2. **Check LTM memory**: `python3 ltm/bin/ltm.py health` to confirm memory is intact. Read `ltm/runtime/last-recall.md` for a quick summary.
3. **Resume from context**: Read `ltm/runtime/active-context.json` to see the recent workstream, files touched, and next actions.
4. **Continue work**: Pick up where the last operation left off. Do NOT re-do completed work. Do NOT re-explore the codebase if context is sufficient.
5. **After resuming**: Run `python3 ltm/bin/ltm.py checkpoint --summary "Resumed after rate limit: <brief summary>"` to mark the recovery point.

## Prevention for Next Time

- If the task is large (> 5 files), break it into smaller chunks via the planner agent.
- Save checkpoints after each milestone: `python3 ltm/bin/ltm.py checkpoint --summary "..."`
- Use subagents for independent subtasks to reduce main-session API consumption.
- Monitor context usage and run `/compact` before hitting 50%.
