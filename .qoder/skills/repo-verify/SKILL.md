---
name: repo-verify
description: Run Arch-System verification gates before claiming work is done. Use when asked to verify, test, validate, or check changes; supports quick, full, migration, e2e, and redis scopes.
---

# Repo Verify

Run the narrowest gate that proves the change, then widen only if needed. Report the exact failing command and a short error excerpt; never summarize a failure away.

## Pick a scope

Read `$ARGUMENTS`; default to `quick`.

| Scope       | Command                                                                         |
| ----------- | ------------------------------------------------------------------------------- |
| `quick`     | `pnpm turbo run type-check lint test --filter='...[HEAD~1]'`                    |
| `full`      | `pnpm agent:verify`                                                             |
| `migration` | `pnpm lint:migrations && pnpm audit:drift && pnpm --filter @repo/database test` |
| `e2e`       | `pnpm test:e2e`                                                                 |
| `redis`     | `REDIS_INTEGRATION=1 pnpm --filter @repo/redis test:integration`                |

`quick` uses the last commit as the baseline. If it reports no affected packages, run `pnpm --filter portal type-check && pnpm --filter portal test` instead.

`e2e` auto-starts `pnpm --filter portal dev` on port 3000 unless `BASE_URL` is set; credentials come from `TEST_EMAIL`/`TEST_PASSWORD` or `e2e/helpers/credentials.ts`.

## Rules

- `pnpm agent:verify` is the completion gate. It must exit 0 before work is claimed done.
- Never use `--no-verify`, and never set `SKIP_TYPE_CHECK=true` in CI.
- Apply the AGENTS.md fix map before retrying: rule-drift → sync `../.agents/rules/`; maps parity → `pnpm maps:sync`; token budget → `pnpm context:debloat`; policy → `pnpm policy:gen`; Tailwind → extract the repeated chain.

## Output

Return a compact table of scope, command, pass/fail, and the first actionable error. If everything passes, say so in one line.
