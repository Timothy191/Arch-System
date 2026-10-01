# /verify Command

Execute the full comprehensive repository quality gate suite and report verification results:

```bash
pnpm quality
```

### Checks Performed:
1. **Type Check**: `pnpm type-check` across all 29 packages via Turborepo.
2. **Biome Linting**: Strict lint compliance with zero syntax or stylistic violations.
3. **Stylelint CSS & Token Compliance**: Verifies semantic OKLCH tokens and prevents forbidden `dark:` variants.
4. **Spellcheck**: Repository-wide `cspell` compliance.
5. **Contract Drift**: Verifies that `@repo/database` and `@repo/contract` are 100% in sync.

If any check fails, do NOT stop and ask for help. Autonomously inspect the terminal errors, identify the root cause, apply the minimal necessary fix, and re-run until all 25+ Turborepo tasks report 100% PASS.
