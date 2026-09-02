# Quick Reference

| I need to...               | Go to                                                                               |
| -------------------------- | ----------------------------------------------------------------------------------- |
| Understand the project     | [Arch-Systems Overview](./entities/arch-systems.md)                                 |
| Start developing           | [Onboarding](./concepts/onboarding.md) → [Monorepo](./concepts/nx-monorepo.md)        |
| Build a department feature | [Department Features](./concepts/department-features.md)                            |
| Add UI components          | [Design System](./concepts/design-system.md)                                        |
| Work with database         | [Database Schema](./concepts/database-schema.md) → [RLS Policies](./concepts/rls-policy.md) |
| Implement auth             | [Auth & Middleware](./concepts/auth-middleware.md)                                  |
| Use AI service             | [Multi-Provider AI](./concepts/adr-006-multi-provider-ai.md)                         |
| Set up external tools      | [External Tools](./concepts/external-tools.md)                                      |
| Monitor/debug              | [Monitoring](./concepts/monitoring-error-tracking.md)                               |
| Run tests/eval             | [DeepEval](./concepts/deepeval-integration.md)                                      |
| Debug issues               | [Troubleshooting](./concepts/troubleshooting.md)                                    |
| Deploy code                | [Deployment](./concepts/deployment.md)                                              |

## Common Commands

```bash
# Development
pnpm dev                                         # Start portal frontend
pnpm build                                       # Build all packages and apps
pnpm lint                                        # Run ESLint across workspace
pnpm test                                        # Run all unit tests
pnpm quality                                     # Full quality gate (lint, test, format)

# Supabase Local Database
pnpm --filter @repo/database supabase:dev        # Start local Supabase Docker stack
pnpm --filter @repo/database db:migrate          # Apply latest database migrations

# Deployment
pnpm dlx vercel --prod                           # Deploy to production
```

## Key Architecture Decisions

1. [ADR-001: Next.js App Router](./concepts/adr-001-nextjs-app-router.md)
2. [ADR-002: Supabase Backend](./concepts/adr-002-supabase-backend.md)
3. [ADR-003: Turborepo](./concepts/adr-003-turborepo-monorepo.md)
4. [ADR-004: Tailwind Design System](./concepts/adr-004-tailwind-design-system.md)
5. [ADR-005: Zustand State](./concepts/adr-005-zustand-state-management.md)
6. [ADR-006: Multi-Provider AI](./concepts/adr-006-multi-provider-ai.md)
7. [ADR-007: React 19](./concepts/adr-007-react-19-adoption.md)

