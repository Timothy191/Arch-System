# Arch-System (Plantcor OS) — AI Code Review Guidance

> Single Source of Truth for autonomous code review policy, severity calibration,
> and sub-agent coordination across Arch-System pull requests and local changes.

## System Context & Operational Harshness

Arch-System is a mission-critical surface-mining operations platform coordinating
SCADA telemetry, pit extraction, drill bit depths, heavy equipment maintenance,
and atomic shift closeouts (Brakfontein). Operating conditions are harsh: dust,
vibration, audio noise, intermittent satellite connectivity ("lie-fi"), 24/7 runtime.

Reviewers MUST evaluate all code changes against operational continuity, data
integrity, offline resilience, and strict field terminal constraints.

---

## Review Severity Calibration

| Level | Definition | Action Required |
|:---|:---|:---|
| **P0 - Blocker** | Monorepo boundary violation, dark-mode styling, raw `<img>`, client-side DB query, broken RLS policy, unhandled offline loss, data corruption risk. | Must block PR merge. Immediate fix required. |
| **P1 - Critical** | Performance regression, N+1 query, non-serializable RSC prop, unkeyed loop, missing rate-limiting on Server Action, cache tag leak. | Requires resolution prior to production release. |
| **P2 - Warning** | Suboptimal bundle size, missing error boundaries, suboptimal OKLCH token usage, missing unit test coverage for edge case. | Address before closeout or track in follow-up. |
| **P3 - Suggestion** | Idiomatic simplification, naming clarity, minor docstring enrichment. | Non-blocking. |

---

## Non-Negotiable Invariants to Enforce

1. **Strict Light Mode Only**:
   - NEVER permit `dark:` Tailwind variants or dark-mode toggles.
   - All colors, borders, shadows, and surfaces MUST use semantic OKLCH tokens from `@repo/theme`.
   - Raw hex (`#...`), `rgb()`, `hsl()` are prohibited in components.

2. **Next.js 16 & Turbopack Invariants**:
   - NEVER raw `<img>` in application routes (only root `error.tsx`). Use `next/image` with explicit `width`/`height` or `fill` + positioned container, plus descriptive `alt`.
   - Client bundle budget: client chunks must remain under 1.0 MB.
   - Turbopack safety: never `{ ssr: false }` inside a Server Component; never webpack-specific magic comments without Turbopack parity.

3. **Data Fetching & Server Boundaries (React 19 / Next 16)**:
   - All primary database queries MUST run in RSC, Server Actions, or Route Handlers.
   - NEVER query `@repo/supabase/server` or `@repo/database` from Client Components (`'use client'`).
   - Props crossing the RSC/Client boundary MUST be serializable. Never pass functions, Promises, or classes across RSC boundary unless using React 19 `use()`.
   - Server Actions MUST authenticate, authorize, validate input via `@repo/contract` Zod schemas, rate-limit, and invalidate cache tags BEFORE redirecting.

4. **Monorepo Architecture Boundaries**:
   - `apps/*` MUST NOT import `packages/database` directly (must route via `@repo/supabase`).
   - `packages/ui` MUST remain purely presentational with zero business logic or domain mutations.
   - `packages/theme` MUST NOT import `packages/ui`.
   - `packages/*` and `tools/*` MUST NOT import from `apps/*`.

5. **PostgreSQL, Supabase & RLS Invariants**:
   - Every database table MUST have Row Level Security (RLS) enabled with explicit tenant isolation.
   - Optimize RLS policies to prevent sequential table scans (use `(SELECT auth.uid())` subqueries to ensure InitPlan caching).
   - Atomic RPCs must be used for multi-row operations (e.g. `atomic_shift_closeout`).

6. **State & Testing SSoT**:
   - React Query (`@tanstack/react-query`) is the sole client state cache. SWR is prohibited.
   - Jest 30 + `@swc/jest` is the sole unit testing framework. Never introduce alternative runners.
   - Target test coverage floors: statements ≥40%, branches ≥30%, functions ≥30%, lines ≥40%.

---

## Sub-Agent Usage Tiers

The Review Agent must scale sub-agent allocation based on change scope and domain risk.
All sub-agents are strictly **read-only** and do not post comments directly. They return
structured findings with `path`, `line`, `severity`, `rationale`, and `confidence`.

| Diff Size | Sub-Agent Allocation | Review Strategy |
|:---|:---|:---|
| **Tiny** (<100 lines, ≤2 files) | **0 sub-agents** | Main reviewer inspects directly. Coordination overhead exceeds benefit. |
| **Small** (100–300 lines, 3–5 files) | **1 sub-agent** | Targeted pass on the highest-risk area (e.g., auth, migrations, RLS, SCADA). |
| **Medium** (300–800 lines, 6+ files) | **3 sub-agents** | Split across 3 specialized review domains: (1) Architecture & Security, (2) UI/Tokens & Accessibility, (3) Testing & Behavioral Coverage. |
| **Large / Cross-Cutting** (>800 lines) | **Up to 6 sub-agents** | Sharded by independent architectural domains. |

### Specialized Reviewer Roles

1. **Security & Boundary Auditor**: Audits monorepo package boundaries, RLS policies, SQL injection risks, and Server Action authorization.
2. **Design System & OKLCH Auditor**: Enforces strict light-mode, semantic OKLCH tokens, responsive layout, and `next/image` invariants.
3. **React 19 & RSC Auditor**: Audits RSC/Client serialization boundaries, cache tag invalidation, and Turbopack bundle constraints.
4. **Resilience & Lie-Fi Auditor**: Validates offline optimistic state, network drop recovery, and SCADA reconnect jitter.
5. **Quality & Test Auditor**: Verifies unit tests, edge cases, Jest assertions, and contract drift against `@repo/contract`.

The main reviewer synthesizes all sub-agent findings, deduplicates, verifies line anchors against the diff, and outputs the final structured review.
