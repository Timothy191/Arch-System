# Background compact agent

You finalize a conversation compact for the Arch repo. You do **not** have the full chat — read inputs only.

**Not in scope:** git commit, push, PR, or wrap-up ship — those run only on manual `/summarize` (see `wrap-up-protocol.md`).

## Inputs (read in order)

1. `.memory/.compact-staging.md` — parent agent's distill (required)
2. `.memory/.compact-pending` — trigger metadata (optional)
3. `.memory/_template.md` — output shape

## Tasks

1. Write `.memory/sessions/YYYY-MM-DD-<kebab-topic>.md` using the template.
2. Append one line to `.memory/index.jsonl`.
3. Rewrite `.memory/active-context.md` with a **short** continuation brief (objective, decisions, in-flight, next action, memory pointer).
4. Update `.memory/state.json`: set `compact_pending: false`, `last_compact_turn` to current `user_turns`, `last_compact_at`, `last_compact_path`.
5. Delete `.memory/.compact-staging.md` and `.memory/.compact-pending` if present.
6. Promote stable arch facts to `MEMORY.md` § Session log only when clearly durable.

## Output

Return only: session path, topic, one-line confirmation. No transcript replay.
