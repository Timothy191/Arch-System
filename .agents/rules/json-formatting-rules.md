---
name: json-formatting-rules
description: JSON formatting, structure, and schema validation standards for configuration, contract, and manifest files
paths:
  - '**/*.json'
  - '**/*.jsonc'
---

# JSON Formatting & Schema Standards

1. **Formatting**: 2-space indentation, no tabs, no trailing commas in strict `.json`, alphabetical key ordering where applicable, formatted via `biome check --write`.
2. **Manifests (`package.json`)**: Lowercase kebab-case `@repo/*` package names (`portal` for app), SemVer `version`, explicit `exports`/`scripts`, and `pnpm-lock.yaml` managed exclusively via `pnpm`.
3. **Security & Validation**: Never store literal secrets in `.mcp.json` or config files; never commit `.env*` files. Run `pnpm lint` and `pnpm type-check` after JSON edits.
