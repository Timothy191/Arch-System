# Evidence-Based Verification & Security Gate Invariants

This rule is permanently active across all autonomous agent sessions operating within the Arch-System repository.

---

## 1. Multi-Layer Security & Backdoor Verification Mandate

When removing, auditing, or refactoring authorization, authentication, or sensitive credentials:

1. **Repository-Wide Regex Search**: Never declare a backdoor, hardcoded email, token, or bypass "completely removed" based on single-file edits. You MUST run a repository-wide case-insensitive regex search:
   ```bash
   rg -n -i "<target-pattern>" .
   ```
2. **Multi-Layer Audit**: Ensure authorization checks are validated across:
   - Route Handlers (`app/api/**/route.ts`)
   - Server Actions (`actions.ts`)
   - Server Component Layouts (`app/**/layout.tsx`)
   - Page Components (`app/**/page.tsx`)
   - Middleware and Edge Proxies (`apps/portal/proxy.ts`, `middleware.ts`)
   - Test Fixtures & Mock Data Dictionaries (ensure dummy email strings like `admin@plantcor.os` are not accidentally reused in live authorization logic)
3. **Automated Negative Assertions**: Always add or run automated unit tests asserting that unauthorized users or previously backdoored identities are strictly rejected/redirected when lacking required database roles (`employee.role === 'admin'`).

---

## 2. Compile-Check After Automated Replacements

- **Zero-Drift Batch Edits**: When performing automated or batch string replacements (`sed`, `replace_file_content`, AST codemods), **NEVER** conclude a task or state that the change is complete without immediately verifying compilation:
  ```bash
  pnpm --filter <workspace> type-check
  # or
  pnpm type-check
  ```
- This prevents regressions from out-of-scope identifiers (e.g. referencing `user` where it is undefined in static top-level objects).

---

## 3. Strict Evidence Levels (E0 - E4)

When reporting status, agents must explicitly distinguish between evidence tiers:

- **E0 (No Evidence)**: Unsubstantiated claims, assumptions, or inferences based solely on package manifests or file presence.
- **E1 (Static Evidence)**: Confirmed presence/absence via direct source code inspection (`view_file`, `rg`).
- **E2 (Automated Verification)**: Verified via automated test suites (`pnpm test`), type checkers (`tsc --noEmit`), or builds (`next build`).
- **E3 (Runtime Evidence)**: Verified via live running server probing, DOM inspection, or browser automation.
- **E4 (Cross-Validation)**: Verified across multiple independent channels (e.g., automated test + live HTTP response + database record assertion).

### Headless Environment Disclosure
In headless execution environments where browser automation or live database connections are unavailable, runtime UI rendering and live session cookies MUST be reported as **`NOT VERIFIED (BLOCKED - Headless)`**. Never claim "100% verified" or "zero runtime defects" based on static or build steps alone.

---

## 4. Reality Over Assumed Invariants (Anti-Assumption Mandate)

- **Documentation vs. Reality**: When repository documentation or rules (e.g. "Strict OKLCH Light Mode") contradict the actual implementation in the codebase (e.g. HEX/RGBA design tokens in `packages/theme`), agents MUST explicitly record this as an architectural discrepancy requiring design/architecture decision rather than assuming it works or performing unauthorized large-scale rewrites.
- **Library vs. Runtime Integration**: Accurately distinguish between standalone library utilities (e.g., `TokenBudgetAgent`) and production-integrated systems. If an underlying execution layer (e.g., production swarm) is not present in the runtime application, explicitly state that the utility is library-only/test-only.
