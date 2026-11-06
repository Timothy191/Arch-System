---
name: json-formatting-rules
description: JSON formatting, structure, and schema validation standards for configuration, contract, and manifest files
paths:
  - '**/*.json'
  - '**/*.jsonc'
---

# JSON Formatting & Schema Standards

## 1. Validation

- Validate all JSON against Zod schemas beyond syntax: explicit required (`.required()`) / `.optional()` fields; `null` only where the schema permits; number ranges (`int().min(0).max(1000)`); enums with defaults (`enum([...]).default('active')`); discriminated unions; conditional rules via `.superRefine` + `ctx.addIssue({ path, message })`.
- JSON Schema fragments: `$defs` for reusable components (OpenAPI 3), `definitions` for OpenAPI-specific refs; refs like `{ $ref: '#/defs/User' }`; arrays with `.min(1)`.
- Validate request bodies against the request schema before processing; use response schemas for consistent output; query params e.g. `object({ page: number().int().min(1), limit: number().int().min(1).max(100) })`.

## 2. Fixtures & Mocks

- Store fixtures in `test/fixtures/v1/` (semantic versioning); generate via `@repo/testing/factory` (`createFactory`, faker).
- Include boundary values: min/max numbers (`4`, `999`, `1000`, `1001`), empty strings, `null`, `undefined`, min/max array sizes, deep nesting.
- `schema.parse(fixture)` in `beforeAll`.

## 3. Config JSON

- Key order: `extends`/`baseConfig` → `compilerOptions` → `include`/`exclude` → `plugins`/`paths` → `compilerOptions` overrides.
- Expected shapes: `next.config.mjs` (`reactStrictMode`, `transpilePackages`, `images.remotePatterns`); `tailwind.config.mjs` (`content`, `theme.extend.colors`); `tsconfig.json` (`strict: true`, `noImplicitAny: true`); `vitest.config.ts` (`test: { globals: true, environment: 'jsdom' }`); `storybook/main.js` (`framework: { name: '@storybook/nextjs' }`).
- Generate JSON-LD/SPARQL vertex data via codegen helpers (`createVertex` from `@repo/data-access/sparql`); avoid brittle hard-coded JSON.

## 4. Semantics

- `null` = meaningful absence (`middleName: null`); omit field when absence is assumed. `{}` empty object, `[]` empty array, `""` empty string (not `null`).
- DTO mapping: validate with Zod → map to output type → `JSON.stringify()`; never mutate the schema after validation.

## 5. Forbidden

- ❌ `snake_case` keys where TS consumers expect `camelCase` (✅ `userId`, `createdAt`, `isActive`).
- ❌ Trailing commas in strict `.json` (enforce with `biome check --write`; allowed only in JS/TS).
- ❌ Comments in JSON — document outside the file.
- ❌ Hex colors (`#ff0000`) — use OKLCH tokens.
- ❌ Magic numbers — named constants (`MAX_RETRIES = 5`).
- ❌ Inline secrets in `.mcp.json` — reference via `bearerTokenEnvVar` / `env` block (`"SECRET_API_KEY": "$BEARER_TOKEN_ENV_VAR"`).

## 6. Verification

After JSON edits always run `pnpm type-check` (types vs JSON schemas) and `pnpm lint` (Biome formatting).

_Last updated: 2026-10-30_
