# General Best Practices

Aligned with the Arch-System AGENTS.md conventions.

## Code Quality

- No magic numbers/strings; extract to UPPER_SNAKE_CASE constants.
- Max 2 positional params; use typed options objects for 3+.
- Guard clauses; nesting depth <= 2; no else after return.
- Discriminated unions for multi-stage state.
- Banned identifiers: data, value, val, item, info, temp, tmp, flag, obj, arr.
- Immutable params; return new references.
- Lookup maps over if/else ladders.
- Cyclomatic complexity <= 8; ~50 lines per function.
- Never swallow errors; rethrow with cause.

## Formatting

- Biome: 2-space indent, 100 columns, single quotes TS, double quotes JSX, semicolons, trailing commas.
- Prettier owns md/css/scss/yaml.

## Error Handling

- Extend `AppError` from `@repo/errors`; use `isAppError` at boundaries.

## Testing

- Jest 30 + SWC; co-located tests; mock at network-client boundary.
