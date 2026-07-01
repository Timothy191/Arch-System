# Memory hooks (committed copy)

Cursor loads hooks from **`.cursor/hooks.json`** at repo root.

If `.cursor/` is not synced, copy or merge:

```bash
mkdir -p .cursor
cp -n 03_operations_automation/memory/hooks.json.example .cursor/hooks.json 2>/dev/null || true
```

Or ensure `.cursor/hooks.json` contains the same `hooks` block as `hooks.json.example`.

## Scripts

| Script | Event |
|--------|-------|
| `hooks/session-init.sh` | `sessionStart` |
| `hooks/auto-recall.sh` | `sessionStart` |
| `hooks/turn-counter.sh` | `beforeSubmitPrompt` |
| `hooks/recall-on-prompt.sh` | `beforeSubmitPrompt` |
| `hooks/pre-compact.sh` | `preCompact` |
| `auto-recall.py` | Manual / agent CLI — `python3 03_operations_automation/memory/auto-recall.py --prompt "..."` |

Restart Cursor after editing `hooks.json`. Verify in **Settings → Hooks** or the Hooks output channel.

## `/summarize` wrap-up

Manual `/summarize` runs `.ai_content/.memory/.cursor-memory/07_toolchain_configuration/wrap-up-protocol.md` before archiving: finish `HOW.md` items, scoped verify, commit, push, prove local ≡ GitHub. Auto-compact hooks do **not** ship.
