# Developer Onboarding Guide

Welcome to the Arch-Systems project! This guide will help you get set up and start contributing.

## 1. Prerequisites

Ensure you have the following installed:

- **Node.js**: `>=22` (Managed via Volta, see `package.json`)
- **pnpm**: `9.15.9` (Enforced via `packageManager` field)
- **Docker & Docker Compose**: For local Supabase, Redis, and tools.
- **Git**: Ensure your SSH keys are configured for GitHub/GitLab.

## 2. Initial Setup

Clone the repository and run the initial setup commands:

```bash
git clone git@github.com:arch-systems/portal.git
cd portal

# Install all dependencies (Nx workspace)
pnpm install

# Copy environment variables
cp apps/portal/.env.example apps/portal/.env
cp .env.tools.example .env.tools
```

_Note: Request the actual development secrets from your team lead._

## 3. Start Local Infrastructure

We use Supabase for our database and authentication. Start it locally:

```bash
pnpm --filter @repo/database supabase:dev
```

_Note: This will print out your local `SUPABASE_URL` and `SUPABASE_ANON_KEY`. Update your `apps/portal/.env` with these values._

## 4. Run the Development Server

With the database running, you can start the Next.js portal:

```bash
pnpm dev
```

Navigate to `http://localhost:3000`.

## 5. Quality Gates & Git Workflow

Before committing, always ensure your code passes the quality gates:

```bash
pnpm quality
```

This runs:

- `eslint` and `prettier`
- `tsc` (Type Checking)
- `jest` (Unit Tests)
- `knip` (Dead code detection)

We use `husky` and `lint-staged` to enforce this on pre-commit.

## 6. Required Reading

To understand the architecture and our AI-assisted development workflow, please read:

- **[CLAUDE.md](../CLAUDE.md)**: Deep dive into the monorepo structure and technical patterns.
- **[AGENTS.md](../AGENTS.md)**: How we use AI agents, the `AGENT_TRACER.md` requirement, and strict handoff procedures.
- **[DESIGN.md](../DESIGN.md)**: Our UI/UX philosophy and Tailwind OKLCH token system.

## 7. Your First Contribution

1. Check the Linear/Jira board for a "good first issue".
2. Create a feature branch: `git checkout -b feature/your-feature-name`
3. Make your changes and **update `AGENT_TRACER.md`** in the respective package.
4. Run `pnpm quality`.
5. Submit a Pull Request. CI will automatically run tests and deploy a preview environment.

Welcome aboard! 🚀
