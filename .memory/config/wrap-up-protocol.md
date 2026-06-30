# `/summarize` wrap-up protocol

**Scope:** Manual `/summarize` only. Auto-compact at turn threshold does **not** commit, push, or ship — it archives context while work continues.

**Gate:** Do not write the session archive or shrink context until wrap-up passes or user explicitly accepts documented blockers.

## Phase 0 — Inventory (read-only)

1. `.memory/active-context.md` — in-flight objective, open items
2. `HOW.md` — unchecked checklist items for the active task
3. `git status` + `git diff` + `git log -3`
4. `git fetch origin` (no config changes) then compare branch to upstream:
   - `git status -sb`
   - `git rev-list --left-right --count HEAD...@{u}` when upstream exists
5. List every unfinished item: code edits, migrations, generated files, docs, tests, PR not opened

## Phase 1 — Finish work

Execute in order until nothing remains or a blocker is recorded:

| Step | Action |
|------|--------|
| 0 | `python3 scripts/lending-library/purge-staging.py` if orphaned lending-library checkouts |
| 1 | Complete all in-scope checklist items in `HOW.md` |
| 2 | Apply missing edits (migrations + `database.types.ts`, `policy:gen` if policy compiler touched, etc.) |
| 3 | Run scoped verification on touched packages (see `AGENTS.md`) |
| 3b | `bash scripts/agent-orchestrator/verify-gate.sh` |
| 4 | Fix failures — do not skip hooks (`--no-verify`) unless user explicitly overrides |
| 5 | Mark completed items `[x]` in `HOW.md`; set task status when objective is done |

**Verification defaults (touched paths only):**

```bash
pnpm format
pnpm --filter <app-or-package> lint && pnpm --filter <app-or-package> type-check
# schema: pnpm audit:rls
# pre-ship: pnpm quality
```

## Phase 2 — Git sync (local ≡ GitHub)

| Condition | Action |
|-----------|--------|
| Uncommitted changes | Stage relevant files only (no `.env`, secrets). Commit with conventional message (heredoc). `/summarize` grants commit authority for this session's work. |
| Branch ahead of `origin` | `git push -u origin HEAD` |
| Branch behind `origin` | `git pull --rebase` (never force-push `master`/`main`) |
| Diverged | Rebase onto remote; resolve conflicts; re-run scoped verify |
| No upstream | Push with `-u origin HEAD`; open PR if objective warrants (`gh pr create`) |
| Dirty unrelated files | Do not commit; list in blockers |

**Sync proof (required before Phase 3):**

```bash
git fetch origin
git status -sb   # expect: clean working tree, in sync with @{u} or documented why not
```

## Phase 3 — Record wrap-up in staging

Append to `.memory/.compact-staging.md` § Wrap-up:

- `sync_status`: `clean` \| `pushed` \| `pr_open` \| `blocked`
- `branch` / `commit` / `pr_url` (if any)
- `verify_commands` run and pass/fail
- `blockers` — empty means safe to archive

## Phase 4 — Compact (only after Phase 3)

Run the compact protocol from `.cursor/rules/summarize-memory.mdc` (staging already includes wrap-up §).

Session file must include **Wrap-up** section (see `_template.md`).

## Blockers

If something cannot finish (missing credentials, failing CI, ambiguous scope):

1. Do **not** claim wrap-up complete
2. List blockers with exact next action for the user
3. Still write `active-context.md` with blockers at top — but session `sync_status` must be `blocked`
4. Ask user to resolve before treating conversation as closed

## User reply (after full wrap-up + compact)

≤8 lines: wrap-up result (branch, commit, sync), session path, blockers if any, continue from `active-context.md`.
