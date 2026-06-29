# Quick Reference

| I need to...               | Go to                                                                               |
| -------------------------- | ----------------------------------------------------------------------------------- |
| Understand the project     | [Arch-Systems Overview](/entities/arch-systems)                                     |
| Start developing           | [Onboarding](/concepts/onboarding) → [Monorepo](/concepts/turborepo-monorepo)       |
| Build a department feature | [Department Features](/concepts/department-features)                                |
| Add UI components          | [Design System](/concepts/design-system)                                            |
| Work with database         | [Database Schema](/concepts/database-schema) → [RLS Policies](/concepts/rls-policy) |
| Implement auth             | [Auth & Middleware](/concepts/auth-middleware)                                      |
| Use AI service             | [AI Service](/concepts/ai-service)                                                  |
| Set up external tools      | [External Tools](/concepts/external-tools)                                          |
| Monitor/debug              | [Monitoring](/concepts/monitoring-error-tracking)                                   |
| Run tests/eval             | [DeepEval](/concepts/deepeval-integration)                                          |
| Debug issues               | [Troubleshooting](/concepts/troubleshooting)                                        |
| Deploy code                | [Deployment](/concepts/deployment)                                                  |

## Common Commands

```bash
# Development
pnpm dev                    # Start portal
pnpm build                  # Build all packages
pnpm lint                   # Run ESLint
pnpm --filter portal test   # Run tests

# Supabase
cd packages/database && pnpm supabase:dev    # Start local Supabase
pnpm supabase:push                           # Push migrations

# Deployment
pnpm dlx vercel --prod      # Deploy to production
```

## Key Architecture Decisions

1. [ADR-001: Next.js App Router](/concepts/adr-001-nextjs-app-router)
2. [ADR-002: Supabase Backend](/concepts/adr-002-supabase-backend)
3. [ADR-003: Turborepo](/concepts/adr-003-turborepo-monorepo)
4. [ADR-004: Tailwind Design System](/concepts/adr-004-tailwind-design-system)
5. [ADR-005: Zustand State](/concepts/adr-005-zustand-state-management)
6. [ADR-006: Multi-Provider AI](/concepts/adr-006-multi-provider-ai)
7. [ADR-007: React 19](/concepts/adr-007-react-19-adoption)
