## [2026-10-23T09:35:16+02:00] Atomic Fixed Window

- **Agent**: Qoder
- **Summary**: Added an atomic `INCR` + `PEXPIRE` + `PTTL` Lua path to `FixedWindowStrategy` when the store implements `eval`, eliminating the concurrent read-modify-write race that let requests exceed the limit. Falls back to the existing get/set path when `eval` is unavailable or the script fails.
- **Verification**: `pnpm --filter @repo/rate-limiter test` (46/46) and `type-check` pass.
- **Handoff**: Matches the Lua-first pattern already used by `SlidingWindowStrategy` and `TokenBucketStrategy`.
