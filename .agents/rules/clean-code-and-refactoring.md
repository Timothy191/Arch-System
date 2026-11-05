---
name: clean-code-and-refactoring
description: 'Concrete code-level rules to keep files clean, predictable, and easy to refactor: constants, guard clauses, immutability, explicit unions, typed lookups, and consistent utility class ordering.'
paths:
  - 'apps/**/*'
  - 'packages/**/*'
  - 'libs/**/*'
alwaysApply: true
---

# Clean Code & Concrete Refactoring Rules

These 11 code-level rules keep the codebase clean, predictable, and maintainable across all packages and apps:

1. **Eliminate Magic Numbers & Strings**: Never hardcode raw numbers/strings (`86400000`, `"STATUS_3"`). Extract to `UPPER_SNAKE_CASE` constants (`MAX_RETRIES = 3`, `ONE_DAY_IN_MS = 86_400_000`; only `-1`, `0`, `1` exempt).
2. **Rule of Three**: Write inline the 1st time, duplicate the 2nd time, and extract a shared helper only on the 3rd identical occurrence.
3. **Guard Clauses (Return Early)**: Validate edge cases at the top of the function and return immediately (`if (!order?.isPaid) return;`). Keep nesting depth ≤ 2; never use `else` after a branch that returns or throws.
4. **Options Object for 3+ Params**: Group 3+ positional arguments or boolean flags into a single typed `Options` interface (`fetchData({ url, useCache: true, timeoutMs: 5000 })`).
5. **Discriminated Unions Over Parallel Booleans**: Model multi-stage state as an explicit union (`type Status = 'idle' | 'loading' | 'success' | 'error'`) instead of parallel `isLoading` / `isError` flags.
6. **Meaningful Identifiers with Units**: Ban vague names (`data`, `value`, `val`, `item`, `info`, `temp`, `tmp`, `flag`, `obj`, `arr`). Append units (`timeoutSeconds`, `maxWeightTons`) and prefix booleans (`is`/`has`/`can`/`should`/`did`/`will`).
7. **Default to Immutability**: Type array/object inputs `readonly` and return new references (`return [...cart, newItem]`); never mutate input arguments via `.push()` or property reassignment.
8. **Lookup Maps Over `if/else` Ladders**: Use exhaustive `Record<Role, string>` dictionaries instead of sprawling `if/else if` or `switch` chains.
9. **One Level of Abstraction Per Function**: Keep cyclomatic complexity ≤ 8 and ~50 lines per function; either orchestrate high-level steps or implement one low-level task, never both.
10. **Never Swallow Errors**: Every `catch` must return a typed fallback or rethrow with operation context, entity IDs, and `{ cause: error }`.
11. **Consistent Utility Class Ordering (`useSortedClasses`)**: `biome.json` enforces `nursery/useSortedClasses` (`"level": "error"`, `"fix": "safe"`) across `className`, `classList`, `wrapperClassName`, `iconClassName`, `contentClassName`, and `cn`/`clsx`/`cva`/`twMerge` calls.
