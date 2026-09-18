---
name: code-refactoring
description: "Authoritative Code Refactoring Standards, Zero-Magic Invariant (Named Constraints), complexity gates, and refactoring checklists."
paths:
  - "apps/**/*.{ts,tsx,js,jsx}"
  - "packages/**/*.{ts,tsx,js,jsx}"
  - "libs/**/*.{ts,tsx,js,jsx}"
  - "services/**/*.{ts,tsx,js,jsx}"
  - "tools/**/*.{ts,tsx,js,jsx}"
  - "scripts/**/*.{ts,tsx,js,jsx}"
---

# Code Refactoring Standards & The Zero-Magic Invariant

This rule is permanently active across all agent sessions and engineering workflows within the Arch-System monorepo. Whenever refactoring existing code, modifying functions, or adding new features, all contributors and agents **MUST strictly adhere to these standards**.

---

## 1. Rule 1: Magic Numbers & Named Constraints (REFAC-01)

```text
ID        REFAC-01
Rule      Always replace unexplained numeric literals with descriptive, unit-annotated named constants, 'as const' dictionaries, or Zod schema constraints when refactoring or writing code.
Why       Unnamed numbers obscure business intent, conceal measurement units, create brittle duplication across call sites, and cause silent regressions during maintenance.
Enforce   Layer 1 Structural Gate (Pre-Write Critique Council), linter audits, and monorepo compliance checks ('pnpm audit:compliance').
```

### 1.1 The Rationale & Failure Modes
Numeric literals without names ("magic numbers") degrade code readability, prevent automated refactoring, and introduce critical bugs:
- **Unit Confusion**: A literal like `5000` or `15` does not indicate whether it represents milliseconds, seconds, bytes, or records. In industrial environments (e.g. handheld C66 scanners, printer timeouts), unit confusion causes hardware lockups and network storms.
- **Hidden Coupled Duplication**: If the same limit (e.g., maximum batch size `50`, or card print DPI `300`) is hardcoded across multiple files, changing it in one file causes subtle system desynchronization.
- **Obscured Domain Logic**: Comparisons such as `if (status === 3)` or `if (attempts > 5)` force engineers to reverse-engineer business rules from implementation details.

### 1.2 The Allowed Exceptions (Safe Literals)
To prevent counter-productive noise and verbosity, the following literal numbers are designated as **Safe Literals** and may remain inline when used in standard programming idioms:
1. **`0` and `1`**:
   - Array and collection index initialization (`arr[0]`).
   - Length comparisons and emptiness checks (`arr.length === 0`).
   - Standard loop step increments and decrements (`i++`, `count - 1`).
2. **`-1`**:
   - Sentinel values indicating not-found results (`array.indexOf(item) === -1`, `string.search(...) === -1`).
3. **`2`**:
   - Standard mathematical operations for halving, doubling, or computing averages (`(start + end) / 2`, `radius * 2`).
4. **Self-Defining Multipliers in Constant Declarations**:
   - Explicit definitions of time or data conversions, such as:
     ```typescript
     const ONE_SECOND_MS = 1000;
     const ONE_MINUTE_MS = 60 * ONE_SECOND_MS;
     const ONE_DAY_MS = 24 * 60 * ONE_MINUTE_MS;
     ```

**All other numbers** in business logic, conditions, timeouts, calculations, retry loops, and layout measurements must be named constants or schema constraints.

### 1.3 Mandatory Unit Suffix Convention
Every numeric constant that represents a measurement, duration, dimension, or quantity **MUST** append an explicit unit suffix:

| Unit Category | Approved Suffixes | Examples |
| :--- | :--- | :--- |
| **Time & Duration** | `_MS`, `_SEC`, `_MIN`, `_HOURS`, `_DAYS` | `POLLING_INTERVAL_MS = 3000`, `HEARTBEAT_SEC = 30`, `SESSION_TIMEOUT_MIN = 15` |
| **Memory & Storage** | `_BYTES`, `_KB`, `_MB`, `_GB` | `MAX_PAYLOAD_BYTES = 1048576`, `IMAGE_BUFFER_LIMIT_MB = 10` |
| **Physical / Print Geometry** | `_MM`, `_DPI`, `_INCH` | `CR80_CARD_WIDTH_MM = 85.6`, `PRINT_RESOLUTION_DPI = 300` |
| **UI Dimensions** | `_PX`, `_REM` | `NAVBAR_HEIGHT_PX = 64`, `CARD_BORDER_RADIUS_PX = 8` |
| **Percentages & Rates** | `_PERCENT`, `_BPS`, `_RATIO` | `MAX_OVERAGE_PERCENT = 15`, `SAMPLING_RATE_RATIO = 0.05` |
| **Financial / Currency** | `_CENTS`, `_USD`, `_EUR` | `BASE_CARD_ISSUANCE_FEE_CENTS = 2500` |
| **Counts & Thresholds** | `_COUNT`, `_LIMIT`, `_RETRIES`, `_LENGTH` | `MAX_RETRY_COUNT = 3`, `DEFAULT_PAGE_LIMIT = 50`, `MIN_PIN_LENGTH = 4` |

### 1.4 Co-Location & Placement Hierarchy
Constants must be placed at the narrowest appropriate scope according to the **4-Tier Placement Model**:

1. **Tier 1 — File-Local Scope**:
   - Used only within a single file.
   - Placed at the top of the file immediately after imports, formatted in `SCREAMING_SNAKE_CASE`.
   ```typescript
   // apps/portal/components/access/card-scanner.tsx
   const SCANNER_DEBOUNCE_MS = 250;
   const MAX_CONSECUTIVE_SCAN_ERRORS = 3;
   ```

2. **Tier 2 — Feature-Local Scope**:
   - Shared across multiple components or hooks within a feature directory.
   - Placed in a colocated `constants.ts` or `[feature].constants.ts`.
   ```typescript
   // libs/features/access-control/constants.ts
   export const ACCESS_BADGE_DEFAULTS = {
     EXPIRY_DAYS: 365,
     GRACE_PERIOD_HOURS: 48,
     MAX_CARDS_PER_EMPLOYEE: 2,
   } as const;
   ```

3. **Tier 3 — Monorepo Domain Contracts**:
   - Constraints that govern validation, APIs, database boundaries, or cross-package communication.
   - Defined in `@repo/contract` and directly referenced inside Zod validation schemas.
   ```typescript
   // packages/contract/src/schemas/access-control.schema.ts
   export const ACCESS_PIN_CONSTRAINTS = {
     MIN_LENGTH: 4,
     MAX_LENGTH: 8,
     MAX_ATTEMPTS: 3,
     LOCKOUT_DURATION_MS: 15 * 60 * 1000,
   } as const;

   export const AccessPinSchema = z
     .string()
     .min(ACCESS_PIN_CONSTRAINTS.MIN_LENGTH, "PIN must be at least 4 digits")
     .max(ACCESS_PIN_CONSTRAINTS.MAX_LENGTH, "PIN cannot exceed 8 digits");
   ```

4. **Tier 4 — UI & Design Tokens**:
   - Visual tokens, colors, shadows, and spacing.
   - Must be sourced directly from `@repo/theme` (OKLCH color system and approved shadow tokens).

---

## 2. Additional Code Refactoring Rules

### Rule 2: Single Responsibility & LOC Thresholds (REFAC-02)
```text
ID        REFAC-02
Rule      Decompose any function exceeding 50 lines of code or any file approaching 400 lines into cohesive, single-purpose sub-functions, custom hooks, or utility modules.
Why       Oversized functions and god-files obscure cognitive flow, increase cyclomatic complexity, and cause high defect rates during edits.
Enforce   File length limits rule (file-length-limits.md) and maintainability budget gate (AGENTS.md S6).
```
- Break React components into focused presentational sub-components.
- Extract data fetching, mutation, and state management into custom hooks (`use[FeatureName].ts`).
- Extract standalone algorithmic logic into pure, testable helper functions in `lib/` or `utils/`.

### Rule 3: Guard Clauses & Indentation Ceiling (REFAC-03)
```text
ID        REFAC-03
Rule      Eliminate deep conditional nesting by enforcing early return guard clauses with an absolute indentation ceiling of 3 levels.
Why       Nested 'if/else' hierarchies create combinatorial execution paths that evade test coverage and confuse mental models.
Enforce   Code review inspection and static analysis.
```
- Invert conditions and return early on validation failures, null checks, or edge cases.
- Avoid cascading `else if` ladders when a lookup table or typed switch block is more expressive.

### Rule 4: Typed Domain Errors (REFAC-04)
```text
ID        REFAC-04
Rule      Never throw generic 'Error' instances or silently return falsy values on business logic failures; always throw or return typed error subclasses from '@repo/errors'.
Why       Untyped errors degrade observability, defeat error telemetry, and prevent graceful error handling in client user interfaces.
Enforce   TypeScript strict checks and '@repo/errors' contract verification.
```
- Use `ValidationError`, `NotFoundError`, `UnauthorizedError`, `ForbiddenError`, or `ConflictError`.
- Include structured metadata in error payloads (e.g., `{ entityId, constraint, attemptedValue }`).

### Rule 5: Behavioral Invariance & Test Parity (REFAC-05)
```text
ID        REFAC-05
Rule      Every refactoring operation must preserve public API signatures and observable runtime behavior, verified by existing tests or newly authored fail-to-pass tests.
Why       Unverified refactoring easily introduces silent regressions in edge cases.
Enforce   P5 closed feedback loop and target test execution ('pnpm --filter <pkg> test').
```
- Run relevant unit tests before beginning refactoring.
- If test coverage is insufficient, author unit tests covering edge cases before refactoring the implementation.
- Verify tests pass cleanly after refactoring without altering test expectations.

### Rule 6: Long Parameter Lists & Object Parameters (REFAC-06)
```text
ID        REFAC-06
Rule      Prefer a single typed options object parameter (or parameter object pattern) over positional parameter lists when a function accepts 3 or more parameters or accepts multiple parameters of identical primitive types.
Why       Long positional parameter lists are difficult to remember, obscure call-site intent, break when positional arguments are swapped, and impede signature extensibility.
Enforce   Layer 1 Structural Gate (Pre-Write Critique Council), code review inspection, and monorepo linting ('pnpm audit:agents').
```
- **Threshold**: Any function, method, or custom hook accepting $\ge 3$ parameters MUST be refactored to use an options object parameter.
- **Type Safety**: Even for 2 parameters, if both share the same primitive type (e.g. `(isDraft: boolean, isArchived: boolean)`), prefer an options object to eliminate silent call-site argument swapping.
- **Pattern Example**:
  ```typescript
  // BAD: Long positional parameter list (difficult to remember, order dependent)
  export async function compileShiftReport(
    shiftId: string,
    operatorId: string,
    includeOpex: boolean,
    includeCapex: boolean,
    retryLimit: number = 3
  ): Promise<ShiftReport> { ... }

  // GOOD: Self-documenting parameter object with named fields
  export interface CompileShiftReportOptions {
    shiftId: string;
    operatorId: string;
    includeOpex?: boolean;
    includeCapex?: boolean;
    retryLimit?: number;
  }

  export async function compileShiftReport({
    shiftId,
    operatorId,
    includeOpex = false,
    includeCapex = false,
    retryLimit = DEFAULT_RETRY_LIMIT,
  }: CompileShiftReportOptions): Promise<ShiftReport> { ... }
  ```
- **Exemptions**: Standard 1-2 parameter functions with distinct types (`findById(id: string)`), standard React synthetic event handlers, or universal mathematical utilities (`clamp(val, min, max)`).

### Rule 7: Duplicate Code & DRY Principle (REFAC-07)
```text
ID        REFAC-07
Rule      Eliminate duplicate code and enforce the Don't Repeat Yourself (DRY) principle by extracting repeated business logic, algorithmic calculations, query blocks, or UI structures into shared, reusable functions, custom hooks, or monorepo packages.
Why       Duplicated code causes parallel bug maintenance, desynchronized fixes across modules, bloated bundle sizes, and fragile codebases where edge cases are handled inconsistently.
Enforce   Layer 1 Structural Gate (Pre-Write Critique Council), code review inspection, and monorepo linting ('pnpm audit:agents').
```
- **Threshold**: Whenever non-trivial logic ($\ge 3$ lines or complex conditional logic) appears in 2 or more places, extract it into a single canonical helper function or hook.
- **Extraction Scope Hierarchy**:
  - **File Scope**: Repeated helper logic used only within one file is placed at top-of-file scope.
  - **Feature Scope**: Shared logic across multiple feature files is placed in `libs/features/[domain]/utils/` or custom hooks `use[Feature]`.
  - **Monorepo Scope**: Cross-package calculations, API formatting, or database queries belong in `@repo/contract`, `@repo/utils`, or `@repo/database`.
- **Pattern Example**:
  ```typescript
  // BAD: Duplicated formatting logic across multiple component files
  // ComponentA.tsx
  const formattedPrice = `$${(rawAmountCents / 100).toFixed(2)}`;
  // ComponentB.tsx
  const formattedPrice = `$${(rawAmountCents / 100).toFixed(2)}`;

  // GOOD: Single canonical utility function in shared package/lib
  // packages/contract/src/utils/currency.ts
  export function formatCurrencyCents(amountCents: number, currencySymbol: string = "$"): string {
    const CENTS_PER_DOLLAR = 100;
    return `${currencySymbol}${(amountCents / CENTS_PER_DOLLAR).toFixed(2)}`;
  }
  ```
- **Exemptions**: Accidental structural similarity between distinct domain models that happen to share fields but represent independent concepts likely to evolve separately.

### Rule 8: Zero 'any' Invariant & Strict Type Guards (REFAC-08)
```text
ID        REFAC-08
Rule      Prohibit the use of 'any' or '@ts-ignore' in all TypeScript code; prefer specific domain types, type parameters/generics, 'unknown' with narrowing type guards ('val is Type'), or Zod schema validation.
Why       Using 'any' disables TypeScript's static type checker, propagates untyped values across function boundaries, hides runtime errors, and defeats IDE auto-completion and safe refactoring.
Enforce   Layer 1 Structural Gate (Pre-Write Critique Council), strict TypeScript compiler checks ('tsc --noImplicitAny'), and monorepo linting ('pnpm audit:agents').
```
- **Prohibition**: Never use `any`, `as any`, or `@ts-ignore` in production or test code.
- **Dynamic External Data Handling**:
  - Type incoming dynamic payloads (API responses, WebSocket messages, catch clause errors) as `unknown`.
  - Perform type narrowing using user-defined type predicates (`function isPayload(val: unknown): val is Payload`), Zod schema parsing (`schema.safeParse()`), or explicit `typeof` / `instanceof` checks before property dereferencing.
- **Pattern Example**:
  ```typescript
  // BAD: Disables type checking, silent runtime failure risk
  export function processUserData(data: any): string {
    return data.user.name.toUpperCase();
  }

  // GOOD: Typed unknown with narrowing predicate
  export interface UserData {
    user: { name: string };
  }

  export function isUserData(val: unknown): val is UserData {
    return (
      typeof val === "object" &&
      val !== null &&
      "user" in val &&
      typeof (val as Record<string, unknown>).user === "object" &&
      (val as { user: Record<string, unknown> }).user !== null &&
      typeof (val as { user: { name?: unknown } }).user.name === "string"
    );
  }

  export function processUserData(data: unknown): string {
    if (!isUserData(data)) {
      throw new ValidationError("Invalid user data structure", { data });
    }
    return data.user.name.toUpperCase();
  }
  ```
- **Exemptions**: None. Untyped 3rd-party library interop must use custom `.d.ts` ambient declarations or type assertions to specific interfaces (`as TargetInterface`), never raw `any`.

### Rule 9: No Unsafe Type Assertions & Mandatory Runtime Validation (REFAC-09)
```text
ID        REFAC-09
Rule      Prohibit unsafe type assertions ('as Type') to mask unvalidated runtime data; always validate external payloads using canonical Zod schemas from '@repo/contract' or explicit type predicate guards before data consumption.
Why       Type assertions ('val as Type') perform zero runtime validation; they blindly bypass TypeScript's static checker, causing silent data corruption and unhandled NullPointer/TypeError crashes at runtime when payload shapes desynchronize.
Enforce   Layer 1 Structural Gate (Pre-Write Critique Council), code review inspection, and monorepo linting ('pnpm audit:agents').
```
- **Prohibition**: Never use `as TargetType` to force TypeScript to accept unvalidated external data (e.g. `const user = await res.json() as UserProfile`).
- **Validation Standard**:
  - All external data sources (network HTTP responses, WebSocket channels, LocalStorage, form inputs, IPC messages) MUST be typed as `unknown` and parsed through a Zod schema (`schema.parse(raw)` or `schema.safeParse(raw)`).
  - If a Zod schema is not available, validate using an explicit type predicate guard (`function isType(val: unknown): val is Type`).
- **Pattern Example**:
  ```typescript
  // BAD: Blindly trusting external API payload via type assertion
  async function fetchUserProfile(userId: string): Promise<UserProfile> {
    const res = await fetch(`/api/users/${userId}`);
    const raw = await res.json();
    return raw as UserProfile; // Danger! Zero runtime validation!
  }

  // GOOD: Runtime schema validation via canonical Zod schema
  import { UserProfileSchema, type UserProfile } from "@repo/contract";

  async function fetchUserProfile(userId: string): Promise<UserProfile> {
    const res = await fetch(`/api/users/${userId}`);
    const raw: unknown = await res.json();
    const result = UserProfileSchema.safeParse(raw);
    if (!result.success) {
      throw new ValidationError("Invalid UserProfile API response payload", {
        issues: result.error.issues,
      });
    }
    return result.data; // 100% verified & type-safe at runtime!
  }
  ```
- **Exemptions**:
  - `as const` assertions used to freeze literal values and tuple shapes.
  - DOM element casts (`document.getElementById(...) as HTMLInputElement`) when element presence is explicitly guarded (`if (elem) ...`).

### Rule 10: No Optional Chaining Abuse & Explicit Domain State Modeling (REFAC-10)
```text
ID        REFAC-10
Rule      Prohibit using optional chaining ('?.') to silently mask invalid, unexpected, or required domain states; explicitly model domain states with discriminated unions or throw typed domain errors when required data is absent.
Why       Overusing optional chaining creates defensive 'null-swallowing' code that hides illegal state transitions, leads to silent UI rendering bugs, and postpones errors until far away from their root cause.
Enforce   Layer 1 Structural Gate (Pre-Write Critique Council), code review inspection, and monorepo linting ('pnpm audit:agents').
```
- **Prohibition**: Never use `?.` to navigate expected relationships or hide illegal missing data (e.g. `user?.account?.subscription?.tier`).
- **Domain State Modeling Standard**:
  - Model complex lifecycle phases or optional relationships using **discriminated unions** with an explicit discriminant field (e.g., `type AccountState = { status: "unauthenticated" } | { status: "active"; subscription: Subscription }`).
  - When required domain data is absent at an invariant boundary, fail early by throwing a typed error from `@repo/errors` (e.g., `NotFoundError`, `UnauthorizedError`) instead of returning `undefined`.
- **Pattern Example**:
  ```typescript
  // BAD: Deep optional chaining hides unauthenticated or un-subscribed state silently
  function renderTierBadge(user: User | null) {
    return <span>{user?.account?.subscription?.tier?.toUpperCase()}</span>; // Silent blank output on failure!
  }

  // GOOD: Discriminated union modeling explicit domain states
  export type UserAccountState =
    | { status: "logged_out" }
    | { status: "unsubscribed"; userId: string }
    | { status: "active"; userId: string; tier: "basic" | "pro" | "enterprise" };

  export function renderTierBadge(state: UserAccountState) {
    switch (state.status) {
      case "logged_out":
        return <LoginLink />;
      case "unsubscribed":
        return <UpgradeBanner userId={state.userId} />;
      case "active":
        return <Badge tier={state.tier} />;
    }
  }
  ```
- **Exemptions**: Genuinely optional, non-required fields explicitly typed as optional (`field?: string`) in the canonical `@repo/contract` Zod schema (e.g. optional middle name, secondary phone number, or optional UI metadata).

### Rule 11: No Monolithic Type Definitions & Focused Composable Types (REFAC-11)
```text
ID        REFAC-11
Rule      Decompose monolithic, oversized type definitions and interfaces (>25 properties or multi-domain responsibility) into small, focused, composable type blocks using interface extension, intersection types ('&'), or utility types ('Pick', 'Omit').
Why       Huge type definitions obscure entity boundaries, cause high friction during refactoring, encourage leaky abstractions, and make type reuse nearly impossible across UI components and domain handlers.
Enforce   Layer 1 Structural Gate (Pre-Write Critique Council), code review inspection, and monorepo linting ('pnpm audit:agents').
```
- **Prohibition**: Never write bloated "god interfaces" that bundle unrelated identity, permissions, billing, preferences, and UI state into one massive type definition.
- **Composition Standards**:
  - Break domain models into focused, single-responsibility interface building blocks (e.g. `UserIdentity`, `UserAccessRights`, `UserBillingInfo`).
  - Combine building blocks using intersection types (`&`) or interface extension (`extends`).
  - Derive presentational component prop types using utility types (`Pick<Entity, "id" | "name">`) rather than passing full aggregate entities.
- **Pattern Example**:
  ```typescript
  // BAD: Giant kitchen-sink interface describing user identity, permissions, billing, and UI state
  export interface MassiveUserGodType {
    id: string;
    name: string;
    email: string;
    roles: string[];
    scopes: string[];
    stripeCustomerId: string;
    subscriptionTier: string;
    sidebarCollapsed: boolean;
    // ... 40 more fields ...
  }

  // GOOD: Focused, composable sub-interfaces
  export interface UserIdentity {
    id: string;
    name: string;
    email: string;
  }

  export interface UserAccessRights {
    roles: string[];
    scopes: string[];
  }

  export interface UserBillingInfo {
    stripeCustomerId: string;
    subscriptionTier: "basic" | "pro" | "enterprise";
  }

  // Composed aggregate for full context
  export type UserAggregate = UserIdentity & UserAccessRights & UserBillingInfo;

  // Focused presentational prop contract
  export type UserBadgeProps = Pick<UserIdentity, "id" | "name">;
  ```
- **Exemptions**: Generated database table row types (e.g. Supabase generated schema types in `@repo/database`) where row definitions map 1:1 to physical database columns.

---

## 3. Refactoring Checklists

### Pre-Flight Refactoring Checklist
Before modifying any existing code for refactoring:
- [ ] Read and understand the existing unit tests for the module.
- [ ] Check file line count (ensure target stays $\le 400$ LOC per `file-length-limits.md`).
- [ ] Identify all unnamed numeric literals and map them to appropriate unit suffixes (`_MS`, `_PX`, `_COUNT`, etc.).
- [ ] Inspect parameter lists: if $\ge 3$ positional parameters or multiple same-type parameters exist, plan conversion to a typed options object parameter.
- [ ] Search codebase for duplicate logic across files; plan extraction of shared helper functions or custom hooks.
- [ ] Audit module for `any` or `@ts-ignore` usage; plan replacement with specific interfaces, `unknown`, or narrowing type guards.
- [ ] Audit external data calls for unsafe `as Type` casts; replace with Zod schema parsing (`@repo/contract`) or type guard predicates.
- [ ] Audit for optional chaining (`?.`) overuse on required entities; replace with discriminated unions or explicit guard clauses with `@repo/errors`.
- [ ] Audit interfaces for monolithic bloat ($\ge 25$ fields); plan decomposition into focused composable types (`Pick`, `Omit`, `&`).
- [ ] Determine appropriate co-location tier (File-local, Feature-local, Contract schema, or Theme).

### Post-Flight Verification Checklist
After completing the refactor:
- [ ] Zero magic numbers remain in modified lines (excluding safe literals `0, 1, -1, 2`).
- [ ] All newly extracted constants adhere to `SCREAMING_SNAKE_CASE` and unit suffixes.
- [ ] Parameter lists with $\ge 3$ arguments or ambiguous primitive pairs converted to single options objects.
- [ ] Duplicated code blocks extracted into single reusable helper functions or hooks.
- [ ] Zero `any` or `@ts-ignore` in modified lines; dynamic inputs typed as `unknown` with narrowing type guards.
- [ ] Zero unsafe `as Type` assertions on external data; dynamic data validated at runtime via Zod schemas or type guards.
- [ ] Zero optional chaining (`?.`) on required domain relations; invalid states handled explicitly via discriminated unions or typed errors.
- [ ] Monolithic type definitions ($\ge 25$ fields) decomposed into focused composable interfaces (`&`, `Pick`, `Omit`).
- [ ] Max nesting depth $\le 3$; early guard clauses applied.
- [ ] Target unit tests pass with zero regressions (`pnpm --filter <pkg> test`).
- [ ] Code passes strict TypeScript type checks with zero `any` and zero `@ts-ignore`.
- [ ] `AGENT_TRACER.md` updated with an entry documenting the refactoring rationale.
