# `.memory/` — conversation compaction & summaries

Persistent memories + **context compaction** so one chat can continue without spawning new threads.

## Commands

| Command | Effect |
|---------|--------|
| `/summarize` | **Wrap-up** (finish work, verify, commit, push, sync with GitHub) → archive → shrink context |
| _(auto)_ | After ~10 user turns (or Cursor pre-compact), background agent archives while you continue — **no ship** |

## Layout

| Path | Purpose |
|------|---------|
| `active-context.md` | **Continuation brief** — only history agents should load after compact |
| `.recall-brief.md` | **Auto-recall brief** — keyword hits from MEMORY, sessions, learnings, git (hook-refreshed) |
| `state.json` | Turn counter, compact threshold, pending flag |
| `.compact-pending` | Hook signal: auto-compact now (gitignored) |
| `.compact-staging.md` | Parent distill for background agent (gitignored) |
| `sessions/` | Archived summaries |
| `index.jsonl` | Search index |
| `config/background-compact-prompt.md` | Background subagent instructions |
| `config/wrap-up-protocol.md` | `/summarize` ship gate — finish, verify, commit, push, sync |

## Hooks (`.cursor/hooks.json`)

| Event | Script | Role |
|-------|--------|------|
| `sessionStart` | `scripts/memory/hooks/session-init.sh` | Init `state.json` |
| `sessionStart` | `scripts/memory/hooks/auto-recall.sh` | Build `.recall-brief.md` |
| `beforeSubmitPrompt` | `scripts/memory/hooks/turn-counter.sh` | Count turns → flag at threshold |
| `beforeSubmitPrompt` | `scripts/memory/hooks/recall-on-prompt.sh` | Refresh recall from user prompt |
| `preCompact` | `scripts/memory/hooks/pre-compact.sh` | Flag before Cursor native compact |

See `config/auto-recall.md` for the recall protocol.

## Tune auto-compact

Edit `.memory/state.json`:

```json
"compact_every_n_turns": 10,
"auto_compact_enabled": true
```

Lower = more aggressive compaction. Set `auto_compact_enabled: false` to disable auto (manual `/summarize` only).

## After compact

Agents must read `active-context.md` only — not replay archived chat. Use `rg` on `sessions/` for deep recall.

## Privacy

`sessions/*.md`, `index.jsonl`, `state.json`, `.compact-*`, `.recall-brief.md` are gitignored.
