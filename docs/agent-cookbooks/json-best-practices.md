# JSON Best Practices

Aligned with the Arch-System AGENTS.md conventions.

## Formatting

- 2-space indentation, no tabs.
- Trailing newline at end of file.
- No trailing commas (JSON standard).
- Double quotes for all keys and string values.
- Keep lines under 100 columns where practical.

## Schema Validation

- Validate all external JSON with Zod schemas in `packages/contract/src/schemas/`.
- Prefer discriminated unions for multi-state payloads.
- Never trust unvalidated JSON at boundaries.

## Naming Conventions

- Keys use camelCase for application data.
- File names use kebab-case.
- Environment/config keys use UPPER_SNAKE_CASE.

## Error Handling

- Never swallow parse errors; surface typed errors extending `AppError`.
- Provide fallback values only when safe and documented.
