# CI/CD Pipeline Map

**Generated:** 2026-08-18  
**System:** Arch-System Mining Operations Portal

## Overview

This map details the complete CI/CD pipeline architecture, including workflow stages, jobs, deployment strategies, and environments.

## Visual Overview

### Workflow Distribution

```mermaid
pie title CI/CD Workflows
    "Main CI" : 12
    "Deployment" : 25
    "Release" : 12
    "Code Review" : 12
    "Theme CI" : 12
    "Security" : 12
    "AI Review" : 12
    "Canary" : 12
```

### CI/CD Pipeline Overview

```mermaid
graph TD
    DEV[Developer Push] --> CI[Main CI Pipeline]
    CI --> QUALITY[Quality Gates]
    QUALITY --> STAGING[Staging Deploy]
    STAGING --> PROD[Production Deploy]
    PROD --> CANARY[Canary Deploy]

    CI --> THEMER[Theme CI]
    CI --> SECURITY[Security Scans]
    CI --> REVIEW[Code Review]

    QUALITY --> RELEASE[Release Pipeline]

    style DEV fill:#e1f5ff
    style CI fill:#fff4e1
    style QUALITY fill:#e8f5e9
    style STAGING fill:#f3e5f5
    style PROD fill:#ffebee
    style CANARY fill:#fdcb6e
    style THEMER fill:#a29bfe
    style SECURITY fill:#4ecdc4
    style REVIEW fill:#45b7d1
    style RELEASE fill:#96ceb4
```

### Trigger Flow

```mermaid
graph LR
    PUSH[Push to main] --> CI_MAIN[ci.yml]
    PUSH --> DEPLOY[deploy.yml]
    PUSH --> RELEASE[release.yml]

    PR[Pull Request] --> CI_MAIN
    PR --> REVIEW[reviewdog.yml]
    PR --> OPENCODE[opencode.yml]

    TAG[Tag v*] --> DEPLOY
    TAG --> RELEASE

    THEME[Theme Changes] --> THEME_CI[theme-ci.yml]

    STAGING[Staging Push] --> DAST[dast.yml]

    MANUAL[Manual Trigger] --> CANARY[deploy-canary.yml]
    MANUAL --> DEPLOY

    style PUSH fill:#e1f5ff
    style PR fill:#fff4e1
    style TAG fill:#e8f5e9
    style THEME fill:#f3e5f5
    style STAGING fill:#ffebee
    style MANUAL fill:#fdcb6e
    style CI_MAIN fill:#a29bfe
    style DEPLOY fill:#4ecdc4
    style RELEASE fill:#45b7d1
    style REVIEW fill:#96ceb4
    style OPENCODE fill:#ffeaa7
    style THEME_CI fill:#ff6b6b
    style DAST fill:#fd79a8
    style CANARY fill:#00cec9
```

---

## 1. Workflow Files and Purposes

| Workflow File         | Trigger                                            | Purpose                                                        |
| --------------------- | -------------------------------------------------- | -------------------------------------------------------------- |
| **ci.yml**            | Push to main/master, PR to main/master             | Main CI pipeline with comprehensive quality gates              |
| **deploy.yml**        | Push to main/master, tags (v\*), workflow_dispatch | Deployment to staging and production environments              |
| **deploy-canary.yml** | Workflow_dispatch                                  | Canary deployment to production with 10% traffic split         |
| **release.yml**       | Push to main                                       | Automated versioning and publishing via Changesets             |
| **reviewdog.yml**     | Pull requests                                      | Code review with ESLint, Prettier, and Markdown linting        |
| **theme-ci.yml**      | Changes to packages/theme/\*\*                     | Theme-specific build, token drift, and visual regression tests |
| **dast.yml**          | Push to staging, daily cron                        | Dynamic Application Security Testing (OWASP ZAP)               |
| **opencode.yml**      | PR comments with /oc or /opencode                  | AI-powered code review via OpenCode                            |

---

## 2. Pipeline Stages and Order

### Main CI Pipeline (ci.yml)

```mermaid
graph TD
    subgraph STAGE1[Stage 1: Parallel Static Checks]
        DEPS[deps-lint]
        SEC[security-audit]
        KNIP[knip]
        POLICY[policy-check]
        MD[md-lint]
        LINT[lint-type-check]
        TOKEN[token-css-lint]
    end

    subgraph STAGE2[Stage 2: Build]
        BUILD[build<br/>CodeQL, Trivy, SBOM]
    end

    subgraph STAGE3[Stage 3: Quality Checks]
        TEST[test]
        E2E[e2e]
        LH[lighthouse]
        A11Y[a11y]
    end

    subgraph STAGE4[Stage 4: Self-Healing]
        HEAL[self-healing]
    end

    LINT --> BUILD
    TOKEN --> BUILD
    BUILD --> TEST
    BUILD --> E2E
    BUILD --> LH
    BUILD --> A11Y

    TEST --> HEAL
    E2E --> HEAL
    LH --> HEAL
    A11Y --> HEAL

    style STAGE1 fill:#e1f5ff
    style STAGE2 fill:#fff4e1
    style STAGE3 fill:#e8f5e9
    style STAGE4 fill:#f3e5f5
    style DEPS fill:#ffebee
    style SEC fill:#fdcb6e
    style KNIP fill:#a29bfe
    style POLICY fill:#4ecdc4
    style MD fill:#45b7d1
    style LINT fill:#96ceb4
    style TOKEN fill:#ffeaa7
    style BUILD fill:#ff6b6b
    style TEST fill:#4ecdc4
    style E2E fill:#45b7d1
    style LH fill:#96ceb4
    style A11Y fill:#ffeaa7
    style HEAL fill:#fd79a8
```

### Deployment Pipeline (deploy.yml)

```mermaid
graph TD
    subgraph STAGE1[Stage 1: Quality Gates]
        QUALITY[quality-check<br/>lint → type-check → test → build]
    end

    subgraph STAGE2[Stage 2: Staging]
        STAGING[deploy-staging<br/>Vercel/SSH/Docker]
    end

    subgraph STAGE3[Stage 3: Production]
        PROD[deploy-production<br/>Docker Hub + Server]
    end

    QUALITY --> STAGING
    QUALITY --> PROD
    STAGING --> PROD

    style STAGE1 fill:#e1f5ff
    style STAGE2 fill:#fff4e1
    style STAGE3 fill:#e8f5e9
    style QUALITY fill:#f3e5f5
    style STAGING fill:#ffebee
    style PROD fill:#fdcb6e
```

### Theme CI Pipeline (theme-ci.yml)

```mermaid
graph TD
    subgraph THEME_STAGE1[Stage 1: Build and Lint]
        BUILD_LINT[build-and-lint<br/>theme build + token drift]
    end

    subgraph THEME_STAGE2[Stage 2: Visual Regression]
        VISUAL[visual-smoke<br/>portal build + Playwright]
    end

    BUILD_LINT --> VISUAL

    style THEME_STAGE1 fill:#e1f5ff
    style THEME_STAGE2 fill:#fff4e1
    style BUILD_LINT fill:#e8f5e9
    style VISUAL fill:#f3e5f5
```

---

## 3. Key Jobs and Responsibilities

### ci.yml Jobs

| Job                 | Responsibility                                           | Tools/Commands                                |
| ------------------- | -------------------------------------------------------- | --------------------------------------------- |
| **deps-lint**       | Ensures dependency version consistency across monorepo   | `pnpm deps:lint` (syncpack)                   |
| **security-audit**  | Security vulnerability scanning + secret detection       | `pnpm audit --audit-level=high`, gitleaks     |
| **knip**            | Dead code and unused dependency detection                | `pnpm knip`                                   |
| **policy-check**    | Policy compliance validation                             | `pnpm policy:check`                           |
| **md-lint**         | Markdown linting                                         | `pnpm md:lint`                                |
| **lint-type-check** | ESLint and TypeScript type checking                      | `pnpm nx affected -t lint type-check`         |
| **token-css-lint**  | Design token and CSS linting                             | `pnpm nx affected -t lint:tokens lint:css`    |
| **build**           | Build with CodeQL, Trivy, SBOM, DeepEval, Terraform lint | CodeQL, Trivy, Anchore SBOM, DeepEval, tflint |
| **test**            | Unit tests with coverage reporting                       | `pnpm nx affected -t test -- --coverage`      |
| **e2e**             | End-to-end tests with Playwright                         | `pnpm test:e2e`                               |
| **lighthouse**      | Performance, SEO, and best practices audit               | `@lhci/cli autorun`                           |
| **a11y**            | Accessibility audit via Storybook                        | `pnpm test:a11y` against Storybook            |
| **self-healing**    | Auto-fix CI issues using Nx                              | `pnpm exec nx fix-ci`                         |

### deploy.yml Jobs

| Job                   | Responsibility                                              | Deployment Targets                                                 |
| --------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------ |
| **quality-check**     | Pre-deployment quality gate (lint, type-check, test, build) | Runs all checks before deployment                                  |
| **deploy-staging**    | Deploy to staging environment                               | Vercel, SSH, or Docker Compose (controlled by `DEPLOY_TARGET` var) |
| **deploy-production** | Deploy to production environment                            | Vercel, SSH, or Docker Hub + server pull                           |

### Other Workflows

| Workflow              | Job            | Responsibility                                                       |
| --------------------- | -------------- | -------------------------------------------------------------------- |
| **theme-ci.yml**      | build-and-lint | Theme build, token drift verification, uncommitted changes check     |
| **theme-ci.yml**      | visual-smoke   | Visual regression tests against theme changes                        |
| **reviewdog.yml**     | reviewdog      | PR-focused linting (ESLint, Prettier, Markdown) with inline comments |
| **dast.yml**          | dast           | OWASP ZAP baseline scan against staging                              |
| **release.yml**       | release        | Changesets versioning and publishing                                 |
| **deploy-canary.yml** | canary_deploy  | Canary deployment with 10% traffic, smoke tests, metrics monitoring  |
| **opencode.yml**      | opencode       | AI code review on PR comment trigger                                 |

---

## 4. Deployment Strategies and Environments

### Environments

| Environment    | Trigger                                                      | URL                                 | Purpose                            |
| -------------- | ------------------------------------------------------------ | ----------------------------------- | ---------------------------------- |
| **Staging**    | Push to main/master, workflow_dispatch (environment=staging) | `STAGING_URL` var or localhost:8080 | Pre-production testing, DAST scans |
| **Production** | Tags (v\*), workflow_dispatch (environment=production)       | `PRODUCTION_URL` var                | Live production deployment         |
| **Canary**     | Manual workflow_dispatch                                     | Simulated canary endpoint           | Gradual rollout (10% → 100%)       |

### Deployment Strategies

#### Deployment Strategy Overview

```mermaid
graph TD
    CODE[Code Changes] --> QUALITY[Quality Gates]
    QUALITY --> TARGET{Deploy Target}

    TARGET -->|vercel| VERCEL[Vercel Deployment]
    TARGET -->|ssh| SSH[SSH Deployment]
    TARGET -->|docker| DOCKER[Docker Deployment]

    VERCEL --> STAGING_ENV[Staging Environment]
    VERCEL --> PROD_ENV[Production Environment]

    SSH --> STAGING_ENV
    SSH --> PROD_ENV

    DOCKER --> DOCKER_STAGING[Docker Compose<br/>Local Staging]
    DOCKER --> DOCKER_PROD[Docker Hub<br/>+ Server Pull]

    PROD_ENV --> CANARY[Canary Deployment<br/>10% Traffic]
    CANARY --> FULL[Full Production<br/>100% Traffic]

    style CODE fill:#e1f5ff
    style QUALITY fill:#fff4e1
    style TARGET fill:#e8f5e9
    style VERCEL fill:#f3e5f5
    style SSH fill:#ffebee
    style DOCKER fill:#fdcb6e
    style STAGING_ENV fill:#a29bfe
    style PROD_ENV fill:#4ecdc4
    style DOCKER_STAGING fill:#45b7d1
    style DOCKER_PROD fill:#96ceb4
    style CANARY fill:#ffeaa7
    style FULL fill:#ff6b6b
```

#### 1. Vercel Deployment

- Controlled by `DEPLOY_TARGET=vercel` variable
- Staging: `vercel --target=staging`
- Production: `vercel --prod`
- Requires: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`

#### 2. SSH/On-Premises Deployment

- Controlled by `DEPLOY_TARGET=ssh` variable
- Git pull + `./scripts/deploy.sh staging|production --force`
- Requires: `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_KEY`

#### 3. Docker/Container Deployment

- Controlled by `DEPLOY_TARGET=docker` variable
- **Staging**: Local Docker Compose stack (`./scripts/staging-local.sh`) with reverse proxy simulation
- **Production**: Build → push to Docker Hub → server pull + compose up
- Requires: `DOCKER_USERNAME`, `DOCKER_PASSWORD`, build args for env vars

#### 4. Canary Deployment

- Manual trigger via workflow_dispatch
- Simulated 10% traffic split (commented Argo Rollouts/Istio commands)
- Smoke tests against canary endpoint
- 5-minute metrics monitoring (Prometheus)
- Auto-promotion to 100% if stable

### Deployment Safety Features

#### Quality Gates Flow

```mermaid
graph TD
    START[Deployment Request] --> LINT[Lint Check]
    LINT --> TYPECHECK[Type Check]
    TYPECHECK --> TEST[Test Suite]
    TEST --> BUILD[Build]
    BUILD --> HEALTH[Health Check]
    HEALTH --> DEPLOY_SUCCESS[Deploy Success]

    LINT -->|Fail| BLOCK[Block Deployment]
    TYPECHECK -->|Fail| BLOCK
    TEST -->|Fail| BLOCK
    BUILD -->|Fail| BLOCK
    HEALTH -->|Fail| ROLLBACK[Rollback]

    style START fill:#e1f5ff
    style LINT fill:#fff4e1
    style TYPECHECK fill:#e8f5e9
    style TEST fill:#f3e5f5
    style BUILD fill:#ffebee
    style HEALTH fill:#fdcb6e
    style DEPLOY_SUCCESS fill:#4ecdc4
    style BLOCK fill:#ff6b6b
    style ROLLBACK fill:#a29bfe
```

- **Concurrency control**: CI cancels in-progress runs; deploy prevents concurrent deploys per environment
- **Quality gates**: Lint → type-check → test → build must pass before deployment
- **Health checks**: Curl-based health checks after deployment
- **Rollback capability**: Canary workflow includes rollback trigger
- **Notifications**: Webhook notification on production deployment status
- **Environment protection**: GitHub environments with required checks (implied by environment syntax)

---

## 5. Key Configuration Details

### Node/pnpm versions

- Node 22, pnpm 9.15.9 (consistent across all workflows)

### CI Environment Variables (dummy values for builds)

- `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`
- `DATABASE_URL`, `N8N_URL`, `FLOWISE_URL`, `PAYLOAD_SECRET`
- `NEXT_TELEMETRY_DISABLED=1`

### Nx Affected Commands

Most jobs use `pnpm nx affected -t <target>` to only run on changed packages, optimizing CI time.

### Artifact Retention

- Coverage reports (14 days)
- Lighthouse reports (14 days)
- Playwright screenshots (on failure)

### Security Scanning

Multi-layered security scanning:

- npm audit (dependency vulnerabilities)
- gitleaks (SAST - secret detection)
- Trivy (container security)
- OWASP ZAP (DAST - dynamic application security testing)
- CodeQL (SAST - code analysis)

---

## 6. Quality Gates

### Pre-Commit

- Husky pre-commit hooks
- Lint-staged for staged files
- ESLint, Prettier, TypeScript checks

### Pre-Push

- `pnpm quality` command runs:
  - lint → type-check → test → lint:tokens → lint:css → lint:root → lint:styles → format:check → deps:lint → knip → policy:check → audit:rls → audit:design

### CI Pipeline

- All static checks must pass
- Build must succeed
- Tests must pass with coverage
- E2E tests must pass
- Performance audits (Lighthouse)
- Accessibility audits (a11y)
- Security scans (npm audit, gitleaks, Trivy, CodeQL)

### Pre-Deployment

- All CI checks must pass
- Quality gate job runs full lint → type-check → test → build
- Health checks after deployment

---

## 7. Monitoring & Observability

### Build Monitoring

- Nx Cloud for distributed caching
- Build time tracking
- Failure notifications

### Deployment Monitoring

- Health check endpoints
- Prometheus metrics
- Rollback capabilities
- Canary traffic monitoring

### Security Monitoring

- Secret detection (gitleaks)
- Dependency vulnerabilities (npm audit)
- Container vulnerabilities (Trivy)
- DAST scans (OWASP ZAP)

---

## 8. Self-Healing

### Nx fix-ci

- Automatically fixes common CI issues
- Runs after all jobs complete
- Can fix dependency issues, linting errors, etc.
- Commit changes if successful

---

## Summary

The CI/CD pipeline features:

- **8 workflow files** covering CI, deployment, release, code review, theme, security, and AI review
- **Multi-stage pipeline** with parallel execution for efficiency
- **Comprehensive quality gates** including linting, type-checking, testing, security scanning, and performance audits
- **Multiple deployment strategies** (Vercel, SSH, Docker) with environment-specific configurations
- **Canary deployment** support with gradual rollout and rollback capabilities
- **Nx affected commands** for optimized CI execution on changed packages only
- **Multi-layered security scanning** (SAST, DAST, dependency, container)
- **Self-healing capabilities** via Nx fix-ci
- **Theme-specific CI** with visual regression testing
- **AI-powered code review** via OpenCode integration
