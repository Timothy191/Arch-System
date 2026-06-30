# Compaction recovery (Opus 4.8 / Fable 5 long-horizon pattern)

After `/summarize` or auto-compact, agents lose pre-compact turns. Recovery quality determines whether work derails.

## Immediate load order

1. `.memory/active-context.md` — **only** conversation history
2. `HOW.md` — active checklist (what was in-flight)
3. `.memory/state.json` — turn count, last session path
4. Last session file pointer in `active-context.md` § Memory pointer — read **only** if a specific past decision is missing

## Recovery brief checklist

Rewrite or confirm `active-context.md` contains:

| Field | Required content |
|-------|------------------|
| Current objective | One imperative line |
| Locked decisions | Irreversible choices — do not re-litigate |
| In-flight work | Files partially edited, failing tests, open PR |
| Next action | Single concrete step |
| Sync | branch / commit / blockers from last wrap-up |
| Memory pointer | Last `sessions/*.md` path |

## Anti-derail rules (τ²-Bench failure modes)

| Failure | Guard |
|---------|-------|
| Policy violation | Re-read `AGENTS.md` RLS + auth rules before DB edits |
| Stale context | Never assume pre-compact tool results — re-`rg` |
| Skipped tool call | If task needs verify/lint/fetch — run it again |
| Wrong tool | MCP: read descriptor before `CallMcpTool` |

## Mid-task instruction injection (Opus 4.8)

User refinements update `HOW.md` + `active-context.md` — do not replay full chat.

## When recovery fails

If `active-context.md` is empty or stale: `rg -i "<topic>" .memory/sessions/ MEMORY.md` — one session file max.
