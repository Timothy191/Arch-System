# Junie guidelines — Arch-System (priority-1 guidelines file)

First action on every task: read `./AGENTS.md` (architecture SSoT) and `./CLAUDE.md`
(agent guide) in the repo root, plus `.agents/GUIDE.md` for operational rules.

## Commands (pnpm ONLY — never npm/yarn; pnpm ≠ 9.15.9 hangs)

| Task | Command |
|---|---|
| Dev server | `pnpm dev` (binds 0.0.0.0:3000) |
| Type-check | `./node_modules/.bin/turbo run type-check` |
| Lint | `./node_modules/.bin/turbo run lint` |
| Tests | `./node_modules/.bin/turbo run test` |
| All gates | `./node_modules/.bin/turbo run lint type-check test` |

## Definition of done

- [ ] All three gates green before claiming completion (`lint`, `type-check`, `test`).
- [ ] New business logic has unit tests; run the touched package's tests at minimum.
- [ ] Verify edits by re-reading the file after writing (no partial/placeholder edits).
- [ ] Conventional commit messages (`feat:`, `fix:`, `chore:`, `test:`) — commitlint enforces.
- [ ] Keep changes minimal and targeted; no speculative refactors in feature tasks.

## Hard rules

- Never log tokens, API keys, or PII; never commit `.env*` files.
- No `TODO`/`FIXME`/stub implementations — ship complete or explain the blocker.
- DB schema changes require a matching migration in `packages/database/migrations/`
  (next free number; `IF NOT EXISTS`/`IF EXISTS` for idempotency).
  `packages/supabase/migrations/` and `packages/database/supabase/migrations/` are
  symlinks to the canonical tree — never create a real directory there.
- E2E: `e2e/global.setup.ts` intentionally tolerates redirect mismatches (`.catch(() => {})`) —
  do not "fix" it by removing the catch; auth failures surface in later assertions.
- Match existing patterns: server actions colocated with routes, `@repo/*` aliases,
  `cn()` from `@repo/ui` for classes, Biome formatting (no manual style churn).

## Coordination

Another agent (Claude/Cline) works in this repo concurrently. Before committing:
`git status` — stage only your own files, never `git add -A`. If `.git/index.lock`
exists, wait and retry; never delete the lock.
