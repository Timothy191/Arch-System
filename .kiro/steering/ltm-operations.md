---
inclusion: auto
name: ltm-operations
description: "LTM memory operations. Activates when the user asks to resume work, continue previous tasks, recall past decisions, or reference project memory."
---

## Recall

1. Run `python3 .memory/data/ltm/bin/ltm.py files --limit 10` and `python3 .memory/data/ltm/bin/ltm.py sessions --limit 5`.
2. For specific past work: `python3 .memory/data/ltm/bin/ltm.py search "term"` or `python3 .memory/data/ltm/bin/ltm.py checkpoints --days 3`.
3. For a specific session: `python3 .memory/data/ltm/bin/ltm.py show <session_id>`.
4. Fallback: read `.memory/data/ltm/runtime/active-context.json` and `.memory/data/ltm/runtime/last-recall.md`.
5. Optional: `git status --short` and `git log --oneline -5`.
6. Use recall to orient. Do not explore broadly if recall is sufficient.

## Checkpoints

1. Read recent events from `.memory/data/ltm/store/events.jsonl` (last 20 entries).
2. Prepare checkpoint JSON with summary, changed_files, decisions, open_threads, next_actions.
3. Run `python3 .memory/data/ltm/bin/ltm.py checkpoint --from-json <path>`.
4. Fallback: write directly to `.memory/data/ltm/store/checkpoints.jsonl` per ltm-memory-format.md.
5. Regenerate: `python3 .memory/data/ltm/bin/ltm.py regenerate`.

## Caps

- `last-recall.md`: max 400 words.
- `active-context.json`: max 8KB (preferred 2KB).
- Never inject raw ledger files into context.

## Maintenance

- Health: `python3 .memory/data/ltm/bin/ltm.py health`
- Validate: `python3 .memory/data/ltm/bin/ltm.py validate`
- Repair: `python3 .memory/data/ltm/bin/ltm.py repair`
- Purge last: `python3 .memory/data/ltm/bin/ltm.py purge-last --confirm`
- Purge all: `python3 .memory/data/ltm/bin/ltm.py purge-all --confirm`
- Teardown: `python3 .memory/data/ltm/bin/ltm.py teardown --confirm`
- Selftest: `python3 .memory/data/ltm/bin/ltm.py selftest`

Read `python_cmd` from `.memory/data/ltm/config.json`.
