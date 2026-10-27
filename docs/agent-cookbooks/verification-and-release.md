# Cookbook: Verification and Release

## Use when

Finishing any change or preparing a branch for review/deployment.

## Sequence

1. Inspect the diff and confirm only task-related files changed.
2. Run the narrowest check for the edited area.
3. Run formatting, lint, type-check, tests, and the relevant database/security audits.
4. Run the full completion gate:

```bash
pnpm agent:verify
```

5. For deployment-sensitive changes, run:

```bash
pnpm --filter portal build
pnpm ci:local
```

6. For user-visible changes, verify the running preview in a real browser, including the current viewport and the affected interaction path.
7. Review generated reports and distinguish failures from known pre-existing debt. Do not bypass gates with `SKIP_TYPE_CHECK=true`, `--no-verify`, or ad hoc environment changes.
8. Use conventional commits. Never commit `.env*`, credentials, auth state, build output, or local reports.

## Release evidence

Record the exact commands run, pass/fail results, known blockers, migration impact, security impact, and browser smoke evidence. A green build alone is not proof of authorization, RLS, contract parity, or production readiness.

## Final checklist

- [ ] Scope and nearest rules reviewed
- [ ] Diff is focused
- [ ] Type-check and lint pass
- [ ] Tests pass for changed behavior
- [ ] `pnpm agent:verify` passes
- [ ] Build passes when applicable
- [ ] Browser smoke passes for UI changes
- [ ] No secrets or generated noise in diff
