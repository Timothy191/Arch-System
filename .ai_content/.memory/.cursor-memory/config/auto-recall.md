# Auto-recall protocol

Deterministic memory pull at **session start** and **before each user prompt**. No vector DB.

## Output

| Path | Role |
|------|------|
| `.memory/.recall-brief.md` | Agent-readable brief (gitignored) |
| `.memory/active-context.md` | Authoritative continuation after compact |

## Hooks

| Event | Script |
|-------|--------|
| `sessionStart` | `03_operations_automation/memory/hooks/auto-recall.sh` |
| `beforeSubmitPrompt` | `03_operations_automation/memory/hooks/recall-on-prompt.sh` |

## Manual

```bash
python3 03_operations_automation/memory/auto-recall.py --trigger manual --prompt "login taskbar border"
python3 03_operations_automation/memory/auto-recall.py --json --prompt "RLS migration"
```

## Agent turn start (mandatory)

1. `.memory/state.json` + `.compact-pending` (compact gate)
2. `.memory/.recall-brief.md` — auto-recall hits
3. `.memory/active-context.md` — continuation brief
4. `HOW.md` active checklist slice only

## Sources (keyword overlap)

- `active-context.md` objective / next / blockers
- `MEMORY.md` matching lines
- `run/agent-learnings.jsonl`
- `.memory/index.jsonl` → `sessions/*.md` snippets
- `HOW.md` task + open checklist count
- `PROGRESSIVE_DISCLOSURE.md` slice titles
- `git` branch, status, last commit

## Privacy

`.recall-brief.md` is gitignored (ephemeral per session).
