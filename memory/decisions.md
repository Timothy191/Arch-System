# Arch-System Monorepo: Score-Based Quality Audit Architecture

## Executive Summary

This document defines how the five score-based audit dimensions map to concrete architectural boundaries in the Arch-System monorepo, recommends package/module boundaries to enforce minimum passing scores, and proposes a phased CI/CD architecture that automates score computation and gating.

---

## 1. Audit Dimension → Architectural Boundary Mapping

| Audit Dimension                                    | Weight | Min Score | Maps To                                                                                | Enforcement Boundary                                                                             |
| :------------------------------------------------- | :----- | :-------- | :------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------- |
| **System Correctness & Safety**                    | 25%    | 9.0/10    | Type safety, error contracts, RLS policies, zero vulnerability posture                 | `@repo/errors`, `@repo/supabase`, `packages/database/tests/`, `apps/portal/lib/errors/`          |
| **Architectural Integrity & Multi-File Alignment** | 25%    | 9.0/10    | Cross-package type contracts, dependency DAG, Jest mapper sync, route/schema alignment | `pnpm-workspace.yaml`, `nx.json` task deps, `package.json` exports, database migrations ↔ types |
| **Agentic Loop & Test Verification**               | 20%    | 9.5/10    | Test coverage per package, self-healing CI, automated test generation                  | Per-package `jest.config.js` / `vitest.config.ts`, CI `test` target with coverage gates          |
| **Aesthetic Quality**                              | 15%    | 8.5/10    | Design token pipeline, glassmorphism compliance, animation constraints                 | `@repo/theme` (codegen → tokens), `@repo/ui` (glass components), Stylelint                       |
| **Code Simplicity & Cleanliness**                  | 15%    | 9.0/10    | Dead code elimination, file size caps, function length, no orphaned exports            | `knip`, ESLint complexity rules, file-size gates in CI                                           |

---

## 2. Recommended Package/Module Boundaries

### Tier 1: Foundation Packages (Score Targets: All ≥ 9.5)

These packages are consumed by all apps. Any regression here cascades.

| Package                   | Role                                         | Score Targets                     | Structural Guard                                                            |
| ------------------------- | -------------------------------------------- | --------------------------------- | --------------------------------------------------------------------------- |
| `@repo/errors`            | Domain error classes, typed error contracts  | Correctness 10.0, Simplicity 10.0 | 100% unit coverage; every error class has `code`, `message`, `details`      |
| `@repo/theme`             | OKLCH tokens, Tailwind preset, motion tokens | Aesthetic 10.0, Correctness 9.5   | `codegen` task generates `src/tokens/generated.ts`; `lint:tokens` validates |
| `@repo/typescript-config` | Shared tsconfig bases                        | Correctness 10.0, Arch 10.0       | Strictest config; no package overrides without `// AGENT-TRACE`             |
| `@repo/eslint-config`     | Shared ESLint configs                        | Simplicity 9.5, Correctness 9.5   | Enforces complexity max, no `console.log`, no raw shadows                   |

### Tier 2: Data & Infrastructure Packages (Score Targets: Correctness ≥ 9.5, Arch ≥ 9.5)

| Package          | Role                                | Score Targets                   | Structural Guard                                                                                    |
| ---------------- | ----------------------------------- | ------------------------------- | --------------------------------------------------------------------------------------------------- |
| `@repo/supabase` | Auth clients, DB types, RLS helpers | Correctness 9.5, Arch 9.5       | `database.types.ts` auto-generated; never hand-edited. Security tests in `packages/database/tests/` |
| `@repo/database` | SQL migrations (source of truth)    | Correctness 10.0, Arch 10.0     | Migration rollback tests, index coverage tests, RLS privilege escalation tests                      |
| `@repo/redis`    | Redis client, cache primitives      | Correctness 9.5, Simplicity 9.5 | Typed wrappers only; no raw redis commands in apps                                                  |
| `@repo/utils`    | Excel export, Inngest, Novu         | Correctness 9.0, Simplicity 9.0 | Subpath exports only (`/client`, `/inngest`, `/novu`)                                               |

### Tier 3: UI & Presentation Packages (Score Targets: Aesthetic ≥ 9.0, Arch ≥ 9.0)

| Package              | Role                                      | Score Targets                           | Structural Guard                                                               |
| -------------------- | ----------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------ |
| `@repo/ui`           | Shared React components, glass primitives | Aesthetic 9.5, Arch 9.0, Simplicity 9.0 | Component max 200 lines; `cn()` for all class merging; no raw Tailwind shadows |
| `@repo/rate-limiter` | Rate limiting primitives                  | Correctness 9.5, Simplicity 9.5         | Pure functions, no portal-specific logic                                       |

### Tier 4: Application Packages (Score Targets: Weighted Average ≥ 9.0)

| App             | Primary Dimensions     | Score Targets                                                         | Structural Guard                                                                            |
| --------------- | ---------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `apps/portal`   | All five               | Correctness 9.0, Arch 9.0, Agentic 9.5, Aesthetic 8.5, Simplicity 9.0 | Feature-based colocation; `lib/ai/` is a bounded context; coverage thresholds raised to 70% |
| `apps/cms`      | Correctness, Arch      | Correctness 9.0, Arch 9.0                                             | Minimal custom logic; leverages Payload CMS conventions                                     |
| `apps/overview` | Aesthetic, Correctness | Aesthetic 9.0, Correctness 9.0                                        | React Flow bounded context; no direct DB access                                             |

---

## 3. CI/CD & Quality Gate Architecture

### 3.1 Proposed Score-Based Pipeline

Introduce a new root-level command `pnpm audit:scores` that computes the five-dimensional score per package and fails if any dimension is below minimum.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        SCORE-BASED CI PIPELINE                       │
├─────────────────────────────────────────────────────────────────────┤
│  Phase 1: Dependency & Security Gates (existing)                     │
│    - pnpm deps:lint                                                  │
│    - pnpm audit --audit-level=high                                   │
│    - pnpm knip                                                       │
│    - secretlint / gitleaks                                           │
├─────────────────────────────────────────────────────────────────────┤
│  Phase 2: Static Correctness & Architecture (existing + enhanced)    │
│    - pnpm nx run-many -t lint type-check                             │
│    - pnpm nx run-many -t lint:tokens lint:css                        │
│    - NEW: Type-alignment check (migrations ↔ database.types.ts)      │
│    - NEW: Jest mapper drift detection (package exports vs mapper)    │
├─────────────────────────────────────────────────────────────────────┤
│  Phase 3: Agentic Loop & Test Verification (enhanced)                │
│    - pnpm nx run-many -t test --coverage                             │
│    - NEW: Per-package coverage gate enforcement                      │
│    - NEW: Self-healing CI (nx fix-ci) with score-aware retries       │
├─────────────────────────────────────────────────────────────────────┤
│  Phase 4: Score Computation & Gate (new)                             │
│    - pnpm audit:scores                                               │
│    - Upload score report as artifact                                 │
│    - Block merge if any dimension < minimum                          │
├─────────────────────────────────────────────────────────────────────┤
│  Phase 5: Build & Performance Verification (existing)                │
│    - pnpm nx run-many -t build                                       │
│    - pnpm bundlesize                                                │
│    - Lighthouse CI                                                   │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 Score Computation Engine (`tools/score-audit/`)

Create a new internal tool package (or Node script in `tools/`) that parses outputs from lint, type-check, test coverage, knip, and bundle-size reports to produce the score matrix.

**Inputs:**

- `eslint` JSON output → Simplicity dimension
- `tsc --noEmit` + `database.types.ts` git-diff → Correctness + Architecture
- `jest --coverage` JSON → Agentic Loop dimension
- `stylelint` + `lint:tokens` → Aesthetic dimension
- `knip` + file-size metrics → Simplicity dimension
- `bundlesize` + Lighthouse → Aesthetic + Simplicity

**Output:** `audit-report.json` and `audit-report.md` posted to PR comments.

### 3.3 Per-Package Score Configuration

Introduce `score-audit.config.ts` in each package root (or centralized in `nx.json` metadata):

```typescript
// apps/portal/score-audit.config.ts
export default {
  thresholds: {
    correctness: 9.0,
    architecture: 9.0,
    agenticLoop: 9.5,
    aesthetic: 8.5,
    simplicity: 9.0,
  },
  weights: {
    correctness: 0.25,
    architecture: 0.25,
    agenticLoop: 0.2,
    aesthetic: 0.15,
    simplicity: 0.15,
  },
  coverage: {
    lines: 70,
    branches: 70,
    functions: 70,
    statements: 70,
  },
};
```

---

## 4. Alignment of Existing Apps/Packages with Scoring Matrix

### Current State Assessment

| Module                | Current Weakness                                                        | Target Score    | Gap                                                          |
| --------------------- | ----------------------------------------------------------------------- | --------------- | ------------------------------------------------------------ |
| `apps/portal`         | Coverage thresholds 40%/30%/35%/40% — too low for Agentic Loop ≥9.5     | 9.5 agentic     | Raise to 70% across all metrics                              |
| `@repo/ui`            | No test script in package.json; components untested at package level    | 9.5 agentic     | Add `test` script + component tests                          |
| `@repo/theme`         | `lint:tokens` exists but no automated fail-on-drift for generated files | 9.5 correctness | Add generated-file checksum gate                             |
| `@repo/database`      | Security tests exist but not wired into `pnpm quality`                  | 9.5 agentic     | Wire `test:migration-rollback` and `test:security:*` into CI |
| `apps/portal/lib/ai/` | Large files (agent-graph.ts 624 lines, memory.ts 401 lines)             | 9.0 simplicity  | Split graph nodes; extract sub-modules                       |
| `@repo/utils`         | No visible test infrastructure                                          | 9.0 agentic     | Add test script + unit tests for Excel/Novu/Inngest helpers  |
| `apps/overview`       | Minimal structure; may duplicate UI primitives                          | 9.0 arch        | Consume `@repo/ui` strictly; no local UI duplication         |
| `apps/cms`            | Auth middleware duplication risk vs portal                              | 9.0 arch        | Share `@repo/supabase/middleware` only                       |

### Dependency DAG Integrity

Current DAG is mostly clean. One risk: `apps/overview` depends on `@xyflow/react` and may create its own UI primitives instead of consuming `@repo/ui`. Enforce:

```
apps/overview ──► @repo/ui ──► @repo/theme
        │
        └──────► @xyflow/react (app-local only)
```

---

## 5. Structural Changes for Weakest Dimensions

### 5.1 Agentic Loop & Test Verification (Current: ~6.0/10 → Target: 9.5/10)

**Problem:** Coverage thresholds are 40-35%, `@repo/ui` has no tests, `@repo/utils` has no tests, `@repo/database` security tests are manual.

**Actions:**

1. **Raise portal coverage thresholds** in `apps/portal/jest.config.js` from 40/30/35/40 to 70/70/70/70.
2. **Add `@repo/ui` test infrastructure**: `vitest` or `jest` + `jsdom` + `@testing-library/react`. Every exported component must have a render test.
3. **Add `@repo/utils` unit tests**: Test Excel export, Inngest client init, Novu wrappers.
4. **Wire database security tests into CI**: `packages/database/package.json` test script should run rollback + RLS tests against a local Supabase instance in CI.
5. **Co-locate tests with code**: The monorepo already does this well (e.g., `lib/ai/tools.test.ts`). Extend to `@repo/ui` (`src/components/GlassCard.test.tsx`).

### 5.2 Architectural Integrity & Multi-File Alignment (Current: ~7.5/10 → Target: 9.0/10)

**Problem:** Jest `moduleNameMapper` in `apps/portal/jest.config.js` manually lists every `@repo/ui` subpath export. When a new component is added, tests break until the mapper is updated. This is a classic multi-file misalignment.

**Actions:**

1. **Replace manual Jest mapper with wildcard resolver** for `@repo/ui/*` that respects the package's `exports` field. Use `moduleNameMapper` pattern that maps `@repo/ui/<Name>` to `<rootDir>/../../packages/ui/src/components/<Name>.tsx` generically, with fallback to `src/$1`.
2. **Introduce `type-alignment` gate**: After `supabase:gen`, fail CI if `packages/supabase/src/database.types.ts` has uncommitted changes (indicates schema drift).
3. **Add `exports` field verification**: A CI step that verifies every package's `package.json` `exports` entries resolve correctly via a test import.

### 5.3 Code Simplicity & Cleanliness (Current: ~7.0/10 → Target: 9.0/10)

**Problem:** `agent-graph.ts` (624 lines) and `memory.ts` (401 lines) exceed the 800-line soft cap and approach the 1000-line split signal. AI subsystem is monolithic.

**Actions:**

1. **Split `lib/ai/agent-graph.ts` into node modules**: Extract each LangGraph node into its own file under `lib/ai/nodes/`.
2. **Split `lib/ai/memory.ts`**: Separate Redis-backed memory from vector-store memory from conversation history.
3. **Enforce ESLint complexity rules**: Add `complexity: ["error", 15]` and `max-lines-per-function: ["warn", 80]` to `@repo/eslint-config`.
4. **File-size gate in CI**: Fail PRs that add files > 800 lines without `// AGENT-TRACE` justification.

### 5.4 Aesthetic Quality (Current: ~8.0/10 → Target: 8.5/10)

**Problem:** Forbidden raw Tailwind shadows and unscoped `lucide-react` imports were previously issues. Enforcement is via Stylelint and ESLint but not strictly gated.

**Actions:**

1. **Strengthen `lint:css` and token lint**: Make token failures block CI (they already run but may not gate).
2. **Add bundle analyzer gate**: `pnpm analyze` runs in CI; fail if any chunk exceeds budget (e.g., 1.3MB lucide chunk recurrence).
3. **Component visual regression**: Introduce Playwright screenshot diffing for `@repo/ui` glass components in Storybook or isolated pages.

---

## 6. Phased Implementation Priority

### Phase 1: Foundation (Week 1–2)

- [ ] Create `tools/score-audit/` engine with JSON output format
- [ ] Add `score-audit.config.ts` to `apps/portal` and `@repo/ui`
- [ ] Update CI workflow to run `pnpm audit:scores` after test phase
- [ ] Raise portal Jest coverage thresholds to 70%
- [ ] Add `@repo/ui` test infrastructure (Vitest + jsdom)

### Phase 2: Structural Hardening (Week 3–4)

- [ ] Fix Jest `moduleNameMapper` to use generic wildcard for `@repo/ui/*`
- [ ] Add `type-alignment` gate (migrations ↔ database.types.ts)
- [ ] Split `agent-graph.ts` into `lib/ai/nodes/` directory
- [ ] Split `memory.ts` into domain-specific modules
- [ ] Add `@repo/utils` unit tests

### Phase 3: Advanced Automation (Week 5–6)

- [ ] Wire `@repo/database` security tests into CI
- [ ] Add per-package coverage gate enforcement in CI
- [ ] Add file-size gate (800-line cap) with `// AGENT-TRACE` escape hatch
- [ ] Add bundle analyzer budget enforcement
- [ ] Publish score report as PR comment artifact

### Phase 4: Cross-App Alignment (Week 7–8)

- [ ] Audit `apps/overview` for `@repo/ui` consumption compliance
- [ ] Audit `apps/cms` for auth middleware duplication
- [ ] Ensure `apps/portal/lib/ai/` has no circular deps to other features
- [ ] Final score audit: all packages must pass their configured thresholds

---

## 7. Score Target Summary Table

| Module           | Correctness | Architecture | Agentic | Aesthetic | Simplicity | Weighted Avg |
| ---------------- | ----------- | ------------ | ------- | --------- | ---------- | ------------ |
| `@repo/errors`   | 10.0        | 10.0         | 10.0    | N/A       | 10.0       | 10.00        |
| `@repo/theme`    | 9.5         | 10.0         | 9.5     | 10.0      | 9.5        | 9.73         |
| `@repo/supabase` | 9.5         | 9.5          | 9.5     | N/A       | 9.5        | 9.50         |
| `@repo/database` | 10.0        | 10.0         | 9.5     | N/A       | 9.5        | 9.78         |
| `@repo/ui`       | 9.0         | 9.0          | 9.5     | 9.5       | 9.0        | 9.18         |
| `@repo/utils`    | 9.0         | 9.0          | 9.0     | N/A       | 9.0        | 9.00         |
| `apps/portal`    | 9.0         | 9.0          | 9.5     | 8.5       | 9.0        | 9.05         |
| `apps/cms`       | 9.0         | 9.0          | 9.0     | N/A       | 9.0        | 9.00         |
| `apps/overview`  | 9.0         | 9.0          | 9.0     | 9.0       | 9.0        | 9.00         |

**Monorepo Weighted Average Target: ≥ 9.20 / 10**

---

_Document generated by Architect agent. Next step: Phase 1 execution — create `tools/score-audit/` and update CI workflow._
