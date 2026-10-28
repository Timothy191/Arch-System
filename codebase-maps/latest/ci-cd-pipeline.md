# 🚀 CI/CD Pipeline & Quality Gate Topology Map

**Generated:** ${dateInfo.displayDate}  
**Orchestration:** Local Preflight + GitHub Actions + Vercel Production Deploy

---

## 🧪 Visual Multi-Stage Pipeline & Verification Flow

```mermaid
flowchart TD
    subgraph Preflight ["Phase 1: Local Preflight & Completion Gate"]
        H_PRE["Husky pre-commit (lint-staged, skills check)"]
        H_PUSH["Husky pre-push -> agent-verify.sh"]
        GATE["15-Step Gate: TypeCheck -> Lint -> Test -> Policy -> Drift -> Knip"]
        H_PRE --> H_PUSH
        H_PUSH --> GATE
    end

    subgraph CI ["Phase 2: GitHub Actions CI Matrix"]
        CI_LINT["turbo run lint (Biome)"]
        CI_TC["turbo run type-check (Strict TS)"]
        CI_TEST["turbo run test (Jest Unit & Integration)"]
        CI_AUDIT["pnpm audit:compliance (RLS, Caching, Routing)"]
        CI_SEC["Security Scans: CodeQL, Gitleaks, Semgrep, Trivy"]
    end

    subgraph Build ["Phase 3: Deterministic Monorepo Build"]
        SYNC["sync-assets-smart.cjs (Public Assets SSoT)"]
        GLASS["patch-glass-css.mjs (OKLCH Glass Token Fixes)"]
        TURBO_BUILD["turbo run build (Next.js 16 + Remote Cache)"]
        SYNC --> GLASS
        GLASS --> TURBO_BUILD
    end

    subgraph Deploy ["Phase 4: Deployment & Release Engine"]
        VERCEL["Vercel Production Deploy / Canary"]
        DOCKER["Docker Multi-Stage Container Build"]
        KUBE["Kubernetes / Helm Manifest Validation"]
    end

    subgraph PostDeploy ["Phase 5: Post-Deployment Smoke & Health Probes"]
        PROBE_LIVE["GET /api/health/live (Process Liveness)"]
        PROBE_REDIS["GET /api/health/redis (Cache & Limits)"]
        PROBE_DB["GET /api/health (Database Connection Pool)"]
        SYNTH["Synthetic Playwright E2E Navigation Canaries"]
    end

    GATE -->|Git Push| CI
    CI_LINT --> Build
    CI_TC --> Build
    CI_TEST --> Build
    CI_AUDIT --> Build
    CI_SEC --> Build
    TURBO_BUILD --> Deploy
    Deploy --> PostDeploy
```

---

## 📋 Comprehensive Quality Gates Reference

1. **`turbo run type-check`**: Zero `any`, zero `@ts-ignore`, concurrency=2.
2. **`turbo run lint`**: Biome formatter & linter enforcing single quotes, sorted Tailwind classes, and clean syntax.
3. **`turbo run test`**: Hermetic Jest suites across apps, feature libs, and shared packages.
4. **`pnpm policy:check`**: Monorepo scope-tagging boundaries verified by `policy-compiler.cjs`.
5. **`pnpm audit:drift`**: Database schema vs. `@repo/contract` Zod definition parity.
6. **`pnpm audit:compliance`**: Exhaustive invariant scan across RLS, server cache profiles, RSC, routing, and design system rules.
7. **`pnpm deps:lint` & `pnpm knip`**: Syncpack version harmonization and dead code eradication.
