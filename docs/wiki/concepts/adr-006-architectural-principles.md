---
title: "ADR-006: Architectural Principles & Constraints"
created: 2026-06-29
updated: 2026-06-29
type: decision
status: accepted
tags: [adr, architecture, principles, decision]
sources: [DESIGN.md, AGENTS.md, tools/policy-compiler.cjs,
  tools/design-audit.cjs, docs/wiki/concepts/adr-004-tailwind-design-system.md]
confidence: high
---

# ADR-006: Architectural Principles & Constraints

## Status

**Accepted** — Implemented incrementally across 2025–2026

## Context

The project has evolved from a single Next.js application into an
Nx-managed monorepo with multiple apps, shared packages, feature
libraries, and a custom design system. As the codebase and team grew,
visual drift, security regressions, and coupling risk emerged. Prior
ADRs established the technology stack (Supabase, Next.js, Nx, Tailwind).
This record establishes the non-negotiable architectural principles
enforced on top of that stack.

## Decision

The following seven binding architectural principles govern all code,
configuration, and design contributions to the repository.

### 1. Light-Only Theme

**Context**: Field-office environments require a UI legible under varying
ambient light conditions. A dual-theme system would double the design
token surface and QA burden.

**Decision**: The application supports only a light theme. No dark-mode
toggle exists. The macOS Sonoma visual language is enforced through
static analysis (`audit:design`) and Stylelint rules. All color tokens
use OKLCH values defined in `@repo/theme`.

**Consequences**:

- **Positive** — Simplified token set, no theme-switching runtime cost,
  consistent QA surface, reduced cognitive load for designers and
  developers.
- **Negative** — No accommodation of user dark-mode preferences.
  Potential accessibility concern for users with light sensitivity.
- **Neutral** — A future dark-mode introduction would require token
  duplication and a runtime switching layer.

**Alternatives Considered**:

- **CSS `prefers-color-scheme` media query** — Rejected. Would allow
  uncontrolled system-driven theme changes inconsistent with the product
  register.
- **Runtime theme toggle** — Rejected. Adds state complexity, requires
  dual token sets, conflicts with PRODUCT.md light-only directive.

### 2. Department Isolation

**Context**: Multi-departmental mining operations require strict data
segregation. A breach in one department (e.g., drilling) must never
expose another's (e.g., safety) data.

**Decision**: Every data access is scoped to the authenticated user's
department via two complementary layers:

- PostgreSQL Row-Level Security (RLS) policies on every table
- Application-level authorization checks in the Next.js middleware
  and Server Actions

No feature, API route, or background job may bypass these protections.
The `employees` table is the authoritative source of truth for
authorization decisions; Supabase Auth metadata is never used for
access control.

**Consequences**:

- **Positive** — Security by default, audit-friendly, aligns with
  regulatory compliance expectations, defense-in-depth.
- **Negative** — RLS policy maintenance overhead as schema evolves,
  potential query planning complexity, requires discipline when adding
  new tables.
- **Neutral** — New contributors must understand both database-level
  and application-level authorization patterns.

**Alternatives Considered**:

- **Application-only authorization** — Rejected. RLS provides a
  critical second layer; if application code has a bug, the database
  still enforces isolation.
- **Shared tenant schema with `tenant_id`** — Rejected. PostgreSQL
  RLS is more maintainable and expressive than manual filtering in
  every query.

### 3. Separation of Concerns

**Context**: Unchecked import coupling in a growing monorepo leads to
circular dependencies, untestable code, and difficult refactoring.

**Decision**: The repository follows a strict layered architecture
enforced by Nx dependency constraints and the policy compiler:

| Directory | Responsibility |
|-----------|----------------|
| `libs/features/*/*` | Domain-specific business logic |
| `libs/shared/*` | Cross-cutting utilities, hooks, shared styles |
| `pkgs/*` | Infrastructure: UI, theme, DB clients, tooling |
| `apps/*` | Application shells: portal, CMS, overview |

UI components (`@repo/ui`) must remain pure and presentational. They
may not import from `@repo/supabase` or `@repo/database`. Data
fetching belongs in `libs/features/*` or `apps/*` Server Components.

**Consequences**:

- **Positive** — Independent testing of each layer, clear ownership
  boundaries, parallel development, safer refactoring.
- **Negative** — Longer import paths, mental overhead for newcomers,
  requires running the policy compiler as part of the development
  workflow.
- **Neutral** — The policy compiler generates ESLint rules that must be
  committed; stale generated files cause CI failures.

**Alternatives Considered**:

- **Layered packages within `pkgs/` only** — Rejected.
  `libs/features/` enables domain-driven organization without bloating
  `pkgs/` with business logic.
- **No enforced boundaries** — Rejected. History showed drift toward
  "kitchen sink" packages and cross-layer imports.

### 4. Named Icon Imports Only

**Context**: Wildcard imports of icon libraries
(`import * as Icons from "lucide-react"`) prevent effective
tree-shaking, inflating JavaScript bundles by approximately 1.3 MB.

**Decision**: Icons from `lucide-react` must always be imported
individually:

```tsx
import { Drill, AlertTriangle, Wrench } from "lucide-react";
```

Wildcard imports are prohibited. This rule is enforced by
`audit:design` static analysis and reviewed during code review.

**Consequences**:

- **Positive** — Predictable bundle sizes, effective tree-shaking,
  reduced initial load time, smaller production deployments.
- **Negative** — Slightly more typing per file, requires developer
  discipline and lint enforcement.
- **Neutral** — The convention is easily taught during onboarding.

**Alternatives Considered**:

- **Bundler-level tree-shaking configuration** — Rejected. Wildcard
  imports defeat tree-shaking at the module boundary; enforcement at
  the import level is more reliable.
- **Icon pre-build script** — Rejected. Adds build complexity without
  solving the root cause.

### 5. Design Token Enforcement

**Context**: Ad-hoc shadow, color, and spacing values accumulate across
components, producing visual drift and making global design changes
impossible.

**Decision**: Raw CSS `box-shadow` values and hardcoded hex/OKLCH
colors are forbidden in application and component code. Only predefined
design tokens from `@repo/theme` may be used:

- Shadows: `shadow-card`, `shadow-window`,
  `shadow-diffusion-sm/md/lg/xl`
- Colors: `arch-text-primary`, `arch-surface-secondary`,
  `arch-border-subtle`, etc.
- Radii: `radius-sm`, `radius-md`, `radius-lg`, `radius-xl`,
  `radius-full`

Enforcement is provided by `audit:design` (static analysis),
Stylelint, and the policy compiler.

**Consequences**:

- **Positive** — Single control point for the visual language, instant
  global design updates, consistent depth and hierarchy across all
  surfaces.
- **Negative** — Token proliferation risk as new UI patterns emerge,
  requires audit tooling and developer awareness.
- **Neutral** — Tokens must be extended deliberately via the
  `tokens.json` → Style Dictionary pipeline, not ad-hoc.

**Alternatives Considered**:

- **Unrestricted Tailwind utilities** — Rejected. Leads to the exact
  drift this principle prevents; DESIGN.md documents extensive
  rationale for token-driven depth.
- **CSS-in-JS theme objects** — Rejected. Incompatible with React
  Server Components and adds runtime cost.

### 6. `cn()` Utility for Class Composition

**Context**: Inconsistent Tailwind class merging causes specificity
bugs, broken conditional logic, and unreproducible UI states. Direct
`clsx` or `tailwind-merge` imports fragment the merging strategy.

**Decision**: Tailwind classes must be merged using the shared `cn()`
utility from `@repo/ui/lib/utils`, which combines `clsx` and
`tailwind-merge`. Manual string concatenation and template literals
for conditional class names are prohibited.

```tsx
import { cn } from "@repo/ui/lib/utils";

<div className={cn("rounded-lg", isActive && "bg-primary", className)} />
```

**Consequences**:

- **Positive** — Deterministic class resolution, no specificity
  conflicts, type-safe, single point for custom merge strategies.
- **Negative** — Small abstraction layer to learn, requires importing
  from `@repo/ui`.
- **Neutral** — Can be extended with project-specific merge strategies
  without changing call sites.

**Alternatives Considered**:

- **Direct `clsx` + `tailwind-merge` in each file** — Rejected.
  Fragments the strategy; updates to merge logic would require
  sweeping changes.
- **Template literal concatenation** — Rejected. Order-dependent,
  error-prone, no conflict resolution.

### 7. Server Actions Pattern

**Context**: Server-side data access inconsistently authenticated,
leading to authorization bypass risk when developers forget auth checks
in API routes or Server Actions.

**Decision**: Every Server Action and API route handler must begin by
creating an authenticated Supabase client and validating the current
user before any business logic or database operations:

```ts
const supabase = createServerSupabaseClient();
const { data: { user } } = await supabase.auth.getUser();
if (!user) {
  throw new Error("Unauthorized");
}
```

Additional role and department checks follow immediately. This pattern
is codified in AGENTS.md and reviewed during code review.

**Consequences**:

- **Positive** — Consistent security boundary, fail-closed default,
  clear pattern for reviewers and auditors, reduces authorization
  bypass risk.
- **Negative** — Boilerplate in every action, requires developer
  discipline.
- **Neutral** — Could be wrapped in a higher-order function or
  middleware in the future to reduce repetition.

**Alternatives Considered**:

- **Route-level middleware only** — Rejected. Middleware handles
  navigation gating but not Server Action or API route
  authorization; defense-in-depth requires per-handler checks.
- **Trusted API routes with client-side auth** — Rejected. Client-side
  checks are trivially bypassed; auth must be validated server-side.

## Enforcement

These principles are enforced through:

1. **Static analysis**: `audit:design`, `audit:rls`,
   `enforce-security-checks`
2. **Policy compiler**: `policy-compiler.cjs` generates ESLint rules
   for dependency boundaries and security patterns
3. **CI quality gate**: `pnpm quality` chains lint, type-check, test,
   token validation, CSS lint, and all audits
4. **Code review**: All seven principles are checklist items in the
   PR review process

## Related

- [[adr-004-tailwind-design-system]] — Design token and styling
  architecture
- [[adr-008-nx-monorepo]] — Dependency boundary enforcement via Nx
- [[adr-002-supabase-backend]] — RLS and multi-tenant data layer
- [[DESIGN.md]] — Complete design system specification
- [[AGENTS.md]] — Critical schemas, conventions, and quality gates
- [[docs/operations/architecture.md]] — System-level architecture
  overview
