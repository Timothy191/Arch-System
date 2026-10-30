---
name: json-formatting-rules
description: JSON formatting, structure, and schema validation standards for configuration, contract, and manifest files
paths:
  - '**/*.json'
  - '**/*.jsonc'
---

# JSON Formatting & Schema Standards

## 1. Deep Validation

- **Beyond syntax**: All JSON must be validated against Zod schemas (and Zod-types) with:
  - Required fields explicitly marked with `.required()`
  - Optional fields with `.optional()`
  - Nullability constraints: `null` is a valid value only when explicitly permitted by schema
  - Number ranges: `int().min(0).max(1000)`, `number().min(0.5).max(5.0)`
  - Enum definitions: `enum(['active', 'inactive', 'pending']).default('active')`
  - Discriminated unions: `discriminatedUnion(['type': 'error', 'type': 'warning']).refine(...)`
  - Conditional validation: `.superRefine((data, ctx) => { if (data.age < 18) ctx.addIssue({ path: ['age'], message: 'Must be adult' }) })`

## 2. API Contract Formats

- **JSON Schema fragments**:
  - Use `$defs` for reusable schema components (OpenAPI 3 convention)
  - Use `definitions` for OpenAPI-specific references (schema.org convention)
  - Nested object schemas: `object({ user: { $ref: '#/defs/User' } })`
  - Arrays:
    - Primitive arrays: `array().of(string()).min(1)`
    - Object arrays: `array().of({ $ref: '#/defs/Address' }).min(1)`
  - Discriminated unions: `union([ { type: 'user', user: object({ $ref: '#/defs/User' }) }, { type: 'admin', admin: object({ $ref: '#/defs/User' }) } ])`
- **Request bodies**: Always validate against request schema before processing
- **Responses**: Use response schema for consistent output shape
- **Query params**: Define as `object({ page: number().int().min(1), limit: number().int().min(1).max(100) })`

## 3. Test Fixtures & Mocks

- **Canonical versioning**: Store test fixtures in `test/fixtures/v1/` with semantic versioning
- **Faker-based mock factories**: Use `@repo/testing/factory` to generate realistic data:
  ```ts
  const userFactory = createFactory('User', {
    id: () => `user-${uuidv4()}`,
    name: ({ faker }) => faker.name.fullName(),
    email: ({ faker }) => faker.internet.email(),
    isActive: () => faker.datatype.boolean(),
  });
  ```
- **Generated boundary values**: Include edge cases in fixtures:
  - Min/max numbers: `4`, `999`, `1000`, `1001`
  - Empty strings, null, undefined
  - Max array sizes, min array sizes
  - Deeply nested structures
- **Zod validation in tests**: Validate fixtures against Zod schema during test setup:
  ```ts
  beforeAll(() => {
    userSchema.parse(userFixture);
  });
  ```

## 4. Configuration JSON Standards

- **Key ordering**:
  1. `extends`/`baseConfig`
  2. `compilerOptions`
  3. `include`/`exclude`
  4. `plugins`/`paths`
  5. `compilerOptions` overrides (if needed)
- **Nesting expectations**:
  - `next.config.mjs`: `reactStrictMode`, `transpilePackages`, `images: { remotePatterns: [...] }`
  - `tailwind.config.mjs`: `content: ['./src/**/*.{js,ts,jsx,tsx}']`, `theme: { extend: { colors: { ... } } }`
  - `tsconfig.json`: `compilerOptions: { strict: true, noImplicitAny: true, ... }`
  - `vitest.config.ts`: `test: { globals: true, environment: 'jsdom' }`
  - `storybook/main.js`: `framework: { name: '@storybook/nextjs', options: {} }`
- **No trailing commas** in JSON config files (unlike JS files)

## 5. Data Generation Patterns

- **SPARQL vertex data**: Use a codegen helper to emit valid JSON-LD without hand-writing:

  ```ts
  // lib/generate-sparql-data.ts
  import { createVertex } from '@repo/data-access/sparql';

  export const generateEventVertex = (event: Event) =>
    createVertex('Event', {
      id: event.id,
      name: event.name,
      date: event.date.toISOString(),
      location: {
        type: 'Place',
        name: event.location,
        geo: { latitude: event.lat, longitude: event.lng },
      },
      participants: [
        { type: 'Person', name: person.name },
        { type: 'Organization', name: org.name },
      ],
    });
  ```

- **Avoid brittle JSON**: Use template literals or code generation instead of hard-coded JSON

## 6. Special JSON Constructs

- **`null` semantics**:
  - Use `null` when absence of value is meaningful (e.g., `middleName: null`)
  - Omit field when absence is assumed (e.g., `optionalField?: string`)
- **Empty states**:
  - `null` → meaningful absence
  - `{}` → empty object (no properties)
  - `[]` → empty array (no items)
  - `""` → empty string (not `null`)
- **DTO mapping**: Convert Zod `output` types to runtime JSON by:
  1. Validating input with Zod
  2. Mapping to output type
  3. Serializing to JSON with `JSON.stringify()`
  4. Never mutate the Zod schema after validation

## 7. Anti-patterns to Forbid

- **Key naming**:
  - ❌ `snake_case` in JSON where TS consumers expect `camelCase`
  - ✅ `userId`, `createdAt`, `isActive`
- **Trailing commas**:
  - ❌ Not allowed in strict `.json` files (use `biome check --write` to enforce)
  - ✅ Allowed only in JS/TS files
- **Comments**:
  - ❌ Never include comments in JSON files (invalid JSON)
  - ✅ Use documentation outside JSON files
- **Hex colors**:
  - ❌ `#ff0000` → use OKLCH tokens like `oklch(0 100% 50%)`
  - ✅ OKLCH tokens for design tokens
- **Magic numbers**:
  - ❌ Hardcoded values like `200` → use named constants
  - ✅ `MAX_RETRIES = 5` with proper documentation

## 8. Verification Command

- **Always run** after JSON edits:
  ```bash
  pnpm type-check  # Validates TypeScript types against JSON schemas
  pnpm lint        # Enforces formatting rules via Biome
  ```
- **Secret handling**:
  - Never inline secrets in `.mcp.json` files
  - Reference via `bearerTokenEnvVar` in environment block:
    ```json
    {
      "env": {
        "SECRET_API_KEY": "$BEARER_TOKEN_ENV_VAR"
      }
    }
    ```

_Last updated: 2026-10-30_
