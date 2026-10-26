---
name: regenerate-artifacts
description: Regenerate Arch-System's committed generated artifacts after editing their source. Use when changing tokens.json, variables.css, a policy source, a migration, or a module layout, and when agent:verify fails at maps parity, policy:check, audit:tokens, or token:budget-check. Never hand-edit a generated file.
---

# Regenerate Artifacts

Generated-but-committed files. `protect-paths.sh` now blocks hand-edits of all of them, and `codebase-maps/latest/*` plus the theme outputs additionally failed gates silently before that guard existed. Change the source, regenerate, commit both.

## 1. Map source to command

| Source you edited                      | Regenerate with                         | Output (committed)                                                             | Gate that fails otherwise                                    |
| -------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| anything mapped in the codebase maps   | `pnpm maps:sync`                        | `codebase-maps/latest/*.md`, `codebase-maps/latest/manifest.json`              | `maps parity` (`pnpm maps:check` exits 1)                    |
| policy/boundary source                 | `pnpm policy:gen`                       | `tools/repo/policy/eslint-boundaries.generated.cjs`                            | `pnpm policy:check`                                          |
| `packages/theme/tokens.json`           | `pnpm --filter @repo/theme codegen`     | `packages/theme/src/css/variables-generated.css`, `src/tokens/generated-sd.ts` | `pnpm audit:tokens`, `pnpm --filter @repo/theme lint:tokens` |
| `packages/theme/src/css/variables.css` | `pnpm --filter @repo/theme codegen`     | `packages/theme/src/tokens/generated.ts`                                       | `pnpm audit:tokens`                                          |
| database schema / new migration        | `pnpm --filter @repo/database db:types` | Supabase generated types (`@repo/supabase` `supabase:gen-types`)               | `pnpm audit:drift`                                           |

Version metadata has its own procedure — use `/version-release`, not this skill.

## 2. Two generators are not the same thing

`packages/theme` runs both: Style Dictionary (`sd.config.mjs`) from `tokens.json`, and `scripts/generate-tokens.mjs` parsing `src/css/variables.css`. Edit the wrong source and the other file keeps the old value; run `codegen` and check `git diff` covers what you intended.

## 3. Verify the artifact, not the intent

```bash
pnpm maps:check && pnpm policy:check && pnpm audit:tokens
```

`token:budget-check` is a separate gate — if it fails after the maps sync changed instruction files, run `pnpm context:debloat` (add `-- --aggressive` only when the plain run does not clear it).

## 4. Do not

- Hand-edit any file above, or anything matching `*.generated.*` (hook blocks it).
- Rename or renumber an applied migration while regenerating types.
- Commit regenerated output you did not read; a stale baseline shows up as an unrelated-looking diff.
