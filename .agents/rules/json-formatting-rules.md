---
name: json-formatting-rules
description: JSON formatting, structure, and schema validation standards for Arch-System configuration, contract, and data files
paths:
  - '\*_/_.json'
  - '\*_/_.package.json'
  - '\*_/_.tsconfig.json'
  - '\*_/_.eslintrc.json'
  - '\*\*/.prettierrc.json'
  - '\*\*/.prettierrc'
  - '\*\*/.biome.json'
  - '\*\*/.biome.jsonc'
---

# JSON Formatting & Schema Standards

## 1. Canonical Form & Indentation

- **2-space indentation**: Every JSON file must use 2-space indentation (no tabs). No trailing commas.
- **Ordering**: Alphabetical key ordering for objects, sorted array items where appropriate (e.g., `package.json` dependencies, exports, and imports).
- **Empty object/array**: Use `{}` and `[]` — never omit braces for empty structures.

```json
{
  "dependency": "pnpm",
  "scripts": {
    "start": "node server.js",
    "build": "tsc -b"
  },
  "dependencies": {
    "express": "^4.18.0",
    "typescript": "^5.0.0"
  }
}
```

## 2. Schema Validation Requirements

### Mandatory Schemas

- **Every JSON config must be valid**: All `.json` files are validated by a JSON parser; malformed JSON is rejected immediately.
- **Package manifest requirements** (`package.json`, `pnpm-workspace.yaml`):
  - Required fields: `"name"`, `"version"`, `"type"`, `"private"`, `"scripts"`, `"dependencies"`, `"devDependencies"`, `"peerDependencies"`, `"exports"` (if applicable), `"files"`, `"type"`.
  - `"name"` must be lowercase, hyphenated (kebab-case) for packages; camelCase for apps (`portal`).
  - `"version"` follows [semantic versioning](https://semver.org/) (`MAJOR.MINOR.PATCH`), managed via `pnpm version`.
  - `"private": true` for local workspaces, `false` for published packages.
  - `"files"` includes only the published distribution files (`dist/`, `src/`, `LICENSE`, `README.md`, `package.json`)
  - `"scripts"` must be executable via `pnpm <script>`.

```json
{
  "name": "@repo/ui",
  "version": "2.1.3",
  "type": "module",
  "private": false,
  "files": ["dist/**", "src/**/*", "README.md", "LICENSE"],
  "exports": {
    "./GlassCard": {
      "types": "./dist/src/components/GlassCard.d.ts",
      "import": "./dist/src/components/GlassCard.js",
      "default": "./dist/src/components/GlassCard.js"
    }
  },
  "scripts": {
    "build": "tsc -b",
    "test": "vitest run",
    "lint": "biome check"
  },
  "dependencies": {
    "react": "^19.0.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "vite": "^5.0.0"
  }
}
```

### Project metadata integrity

- **Tool-specific JSON** (`.prettierrc.json`, `.biome.json`, `.eslintrc.json`) must be valid and syntactically correct (no missing required fields).

## 3. Special Schema Rules

### `package.json` and `pnpm-workspace.yaml`

- **pnpm lockfile**: Keep `pnpm-lock.yaml` committed; never modify it manually.
- **Biomechanical constraints**: No circular deps (`pnpm cycles`), zero dead code (`pnpm knip`), strict TypeScript (`pnpm type-check`), lint compliance (`pnpm lint`), and test coverage thresholds.

### Environment configurations

- **`.env*` files**: Never commit environment files. Use `.env.example` for documentation.
- **`config.json` files**: Must contain only JSON; no trailing commas, no comments.

### Schema documentation

- **Schema description**: Every JSON schema file must include a top-level comment describing the schema's purpose and required fields.

## 4. Validation and Consistency

### Automated validation

- **Pre-commit hooks**: Run `pnpm lint`, `pnpm type-check`, `pnpm test`, `pnpm policy:check` before commits.
- **CI gate enforcement**: All `pnpm` validation commands are part of `pnpm agent:verify` (see `tools/scripts/agent-verify.sh`).
- **JSON linting**: For any `.json` modification, run `biome check --write` (handles formatting) before commit; if Biome reports issues, commit only after resolved.

### Consistent formatting

- **Tool consistency**: Use Biome for formatting and linting; no parallel tools allowed.
- **Backup maintenance**: Never backup config files manually; rely on git history.

## 5. Reporting and Enforcement

- **Violation consequences**: Any JSON file that fails validation or violates these rules is rejected and must be fixed before merge.
- **Automation enforcement**: The `.qoder/settings.json` PostToolUse hook runs Biome/Prettier on every `Write|Edit` under Arch-System, ensuring JSON consistency automatically.

## 6 PR compliance

- **Schema validation in CI**: The `pnpm quality` pipeline includes JSON validation checks.
- **Local testing**: Always run `pnpm lint` and `pnpm type-check` before committing JSON changes.

These rules ensure that all JSON files in Arch-System are consistently formatted, valid, and maintain the integrity of the project's configuration and dependency management.
