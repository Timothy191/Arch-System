---
title: Team Onboarding
created: 2026-05-15
updated: 2026-05-15
type: concept
tags: [onboarding, team, getting-started, docs]
sources: [CLAUDE.md, docs/wiki/concepts/nx-monorepo.md]
confidence: high
---

# Team Onboarding Guide

Welcome to the Arch-Systems (Plantcor) development team. This guide will take you from zero to productive contributor.

---

## Day 1: Environment Setup

### Prerequisites Installation

```bash
# 1. Install Node.js (use nvm or download)
nvm install 20
nvm use 20
node --version  # v20.17.0 or higher

# 2. Install pnpm
npm install -g pnpm@9.12.0
pnpm --version  # 9.12.0

# 3. Install Git hooks (optional but recommended)
git config --global core.hooksPath .githooks
```

### Repository Setup

```bash
# 1. Clone the repository
git clone https://github.com/DRACOSFN/Turborepo-Fullstack-Starter-Template.git
cd Arch-Mk2

# 2. Install dependencies
pnpm install

# 3. Verify installation
pnpm --filter portal type-check
```

### Environment Configuration

```bash
# 1. Copy environment template
cp apps/portal/.env.example apps/portal/.env

# 2. Fill in required variables
# Ask team lead for:
# - Supabase project URL and keys
# - AI provider API keys (Groq/OpenRouter)
# - Optional: N8N_URL, FLOWISE_URL for tool integration

# 3. Start local Supabase (separate terminal)
cd packages/database
pnpm supabase:dev

# 4. Start the portal
pnpm dev
# Open http://localhost:3000
```

---

## Day 2: Architecture Overview

### Project Structure Tour

Spend 30 minutes exploring:

```
Arch-Mk2/
├── apps/
│   ├── portal/          ← Main application (where you'll spend 90% of time)
│   ├── overview/       ← Static architecture visualization
│   └── cms/            ← Payload CMS for content
├── packages/
│   ├── ui/             ← @repo/ui shared components
│   ├── theme/          ← @repo/theme design tokens
│   ├── supabase/       ← Supabase client wrappers
│   ├── database/       ← SQL migrations
│   ├── types/          ← Shared TypeScript interfaces
│   └── utils/          ← Helper functions
└── docs/wiki/               ← This knowledge base
```

### Key Concepts to Understand

Read these wiki pages in order:

1. **[[arch-systems]]** — What we're building
2. **[[nx-monorepo]]** — How the codebase is organized
3. **[[portal-app-architecture]]** — Next.js 15 App Router patterns
4. **[[design-system]]** — How to build UI components

### Running the Application

```bash
# Start everything
pnpm dev                    # Portal on :3000
pnpm --filter arch-systems-overview dev   # Overview on :3002

# Useful commands
pnpm lint                   # Check code style
pnpm --filter portal type-check  # TypeScript check
pnpm --filter portal test   # Unit tests
```

---

## Day 3: First Contribution

### Pick a Starter Task

Choose one based on your interests:

| Interest   | Starter Task          | Location                         |
| ---------- | --------------------- | -------------------------------- |
| UI/UX      | Add a new KPI variant | `packages/ui/src/KPI.tsx`        |
| Backend    | Add machine hours API | `apps/portal/lib/`               |
| Full-stack | Add a department tab  | `apps/portal/app/(departments)/` |
| DevOps     | Add a CI check        | `.github/workflows/`             |
| Docs       | Improve wiki          | `docs/wiki/concepts/`                 |

### Development Workflow

```bash
# 1. Create feature branch
git checkout -b feature/your-first-task

# 2. Make changes
# ... edit files ...

# 3. Test locally
pnpm lint
pnpm --filter portal type-check
pnpm --filter portal test -- --testPathPatterns=YourComponent

# 4. Commit (conventional commits)
git commit -m "feat: add new KPI variant for alert states"

# 5. Push and create PR
git push origin feature/your-first-task
# Create PR via GitHub
```

### Code Review Checklist

Before submitting PR:

- [ ] `pnpm lint` passes
- [ ] `pnpm --filter portal type-check` passes
- [ ] Tests added/updated
- [ ] Follows [[design-system]] (no forbidden Tailwind classes)
- [ ] Uses `@repo/supabase` imports (never direct)
- [ ] RLS policies considered for database changes

---

## Week 1: Deep Dives

### Department System

Understand how departments work:

1. Read [[department-features]]
2. Explore `apps/portal/lib/departments.ts`
3. Visit all 8 departments in running app
4. Try adding a test department locally

### Authentication Flow

Trace through auth:

1. [[auth-middleware]] — How routes are protected
2. `apps/portal/app/(auth)/login/page.tsx` — Login UI
3. `apps/portal/proxy.ts` — Route guards
4. Sign up → check `employees` table auto-creation

### Database Patterns

Practice database operations:

1. Read [[database-schema]]
2. [[rls-policy]] — Security patterns
3. Create a migration locally
4. Run `pnpm supabase:reset` to test

---

## Key Resources

### Essential Wiki Pages

Bookmark these for daily reference:

| When you need...      | Go to                  |
| --------------------- | ---------------------- |
| Quick issue fix       | [[troubleshooting]]    |
| Deploy something      | [[deployment]]         |
| Understand a decision | [[comparisons]] folder |
| Add a component       | [[design-system]]      |
| Database questions    | [[database-schema]]    |
| Auth confusion        | [[auth-middleware]]    |

### Tools You'll Use Daily

- **VS Code** — Primary IDE (extensions: ESLint, Prettier, Tailwind CSS)
- **pnpm** — Package manager (never use npm/yarn)
- **Supabase Studio** — Database GUI at `http://localhost:54323`
- **Vercel Dashboard** — Production deployments
- **Sentry** — Error tracking (production)

### Team Communication

- Daily standup: 9:00 AM UTC
- Code reviews: Via GitHub PRs
- Questions: #dev-support Slack channel
- Wiki updates: Log in `docs/wiki/log.md`

---

## Common New-Team-Member Mistakes

### 1. Wrong Package Manager

```bash
# Don't do this
npm install  # Wrong!
yarn add package  # Wrong!

# Do this
pnpm add package
```

### 2. Direct Supabase Imports

```typescript
// Don't do this
import { createClient } from "@supabase/supabase-js";

// Do this
import { createServerSupabaseClient } from "@repo/supabase/server";
```

### 3. Forbidden Tailwind Classes

```tsx
// Don't do this
<div className="font-bold shadow-lg">

// Do this
<div className="font-medium">
```

### 4. Cross-App Imports

```typescript
// Don't do this (React 18 vs 19 conflict)
import { Component } from "../../overview/components";

// Do this
import { Component } from "@repo/ui";
```

---

## Your First Month Goals

### Week 1

- [ ] Environment set up and running
- [ ] First PR merged
- [ ] Understood department system

### Week 2

- [ ] Contributed to 2+ features
- [ ] Written a database migration
- [ ] Understood RLS policies

### Week 3

- [ ] Implemented a Server Action
- [ ] Added real-time subscription feature
- [ ] Reviewed team member's PR

### Week 4

- [ ] Deployed a feature to production
- [ ] Onboarded a concept page to wiki
- [ ] Identified and fixed a bug independently

---

## Questions?

- Stuck on setup? Check [[troubleshooting]]
- Architecture questions? Ask in #architecture Slack
- Want to learn more? Read through `comparisons/` to understand why we chose each tool

## Related

- [[troubleshooting]] — When things go wrong
- [[deployment]] — How to ship code
- [[nx-monorepo]] — Workspace conventions
- [[design-system]] — UI guidelines
