# Arch-System — Jest Diagnostic Command Guard

> Protocol for diagnosing Jest open handles and test-lifecycle warnings. Read only
> when investigating a specific Jest hang or warning — not needed for routine work.

## Jest Diagnostic Command Guard

When investigating Jest open handles (`--detectOpenHandles`) or diagnosing test lifecycle warnings:

1. **Distinguish Diagnostic Tooling Errors from Test Failures**: If a command fails with `Unknown option: 'detectOpenHandles'`, this is a `pnpm` CLI argument forwarding error, NOT a test failure. The underlying test results remain valid.
2. **No Code Mutations from CLI Argument Errors**: Do not modify application code merely because `--detectOpenHandles` was rejected by `pnpm`.
3. **Invoke Jest Directly**:
   ```bash
   pnpm --filter portal exec jest --runInBand --detectOpenHandles app/api/scada/tags/route.test.ts
   ```
4. **Or Forward Arguments Explicitly via `--`**:
   ```bash
   pnpm --filter portal test -- --detectOpenHandles app/api/scada/tags/route.test.ts
   ```
5. **Categorize Warning Root Cause**:
   - Real open handle (unclosed socket, active interval timer, persistent connection).
   - Jest config issue (e.g. `forceExit` artifact).
   - `pnpm` argument forwarding error.
   - Normal framework/runtime behavior (e.g. Node experimental warning).
6. **Do Not Weaken Tests**: Never weaken, skip, delete, or rewrite assertions to suppress warnings.
7. **No Arbitrary Suppression**: Do not add arbitrary Jest flags, configuration, timers, or process exits simply to suppress warnings.
8. **Target Genuine Leaks Only**: Only modify application/test infrastructure when the diagnostic output identifies an actual resource-lifecycle problem.
9. **Verify with Normal Test Command**: Re-run the standard test command afterward and confirm that all test suites pass.
