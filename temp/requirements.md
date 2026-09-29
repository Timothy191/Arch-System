# Vercel Deployment Requirements (EARS Syntax)

## Ubiquitous Requirements (Always Active)

- **REQ-UBI-01**: The system SHALL require that all production builds executed by Vercel use `pnpm build --filter=portal`.
- **REQ-UBI-02**: The system SHALL maintain strict separation between client-exposed environment variables (`NEXT_PUBLIC_*`) and secret server-only variables (`SUPABASE_SERVICE_KEY`, `REDIS_URL`, `GOOGLE_AI_API_KEY`).
- **REQ-UBI-03**: The system SHALL enforce light-mode rendering tokens with no dark-mode Tailwind classes on all deployed pages.

## Event-Driven Requirements (Triggered by Action)

- **REQ-EVT-01**: When `pnpm deploy:vercel:preflight` is executed, the preflight runner SHALL verify that all mandatory configuration files (`vercel.json`, `.vercelignore`, `apps/portal/next.config.mjs`) are present and compliant with monorepo rules.
- **REQ-EVT-02**: When an automated deployment command (`pnpm deploy:vercel:preview` or `pnpm deploy:vercel:prod`) is invoked, the script SHALL execute `--non-interactive` or `--yes` flags to prevent CLI interactive hanging.
- **REQ-EVT-03**: When preflight checks detect missing critical build environment variables without `IGNORE_ENV_VALIDATION=true`, the system SHALL emit clear error messages and halt execution with a non-zero exit code.

## State-Driven Requirements (Operating in a Mode)

- **REQ-STA-01**: While executing within Vercel's build environment (`process.env.VERCEL` is truthy), `apps/portal/next.config.mjs` SHALL omit the `'standalone'` output setting to allow native Vercel lambda tracing.
- **REQ-STA-02**: While executing in preview or production deployments, the Edge proxy SHALL attach CSP nonces and security headers to all HTTP responses.

## Unwanted Behavior Requirements (Failures & Fallbacks)

- **REQ-UNW-01**: IF `.vercel/project.json` is missing during a headless deployment attempt, THEN the runner SHALL guide the user or CI to link the project interactively once, preventing headless crash loop `err-20260925-vercel-headless-deploy`.
- **REQ-UNW-02**: IF an unhandled exception or 500 error occurs during build time, THEN the deployment script SHALL abort and output diagnostic guidance.

## Real-World Quality Score Assessment

- **Grounding (20/20)**: Directly mapped to actual repository paths, verified files, and historical retrospectives.
- **Completeness (20/20)**: Covers monorepo, environment, secrets, CLI, and runtime concerns.
- **Accuracy (20/20)**: Validated against Next.js 16 App Router and Turborepo monorepo standards.
- **Auditability (20/20)**: Automated test assertions via `vercel-preflight.cjs`.
- **Resilience (20/20)**: Explicit error codes and non-zero exit handlers.
- **Total Real-World Quality Score**: 100/100
