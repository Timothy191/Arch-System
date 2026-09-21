# Arch-Systems (Plantcor) Mining Operations Portal

[![Coverage Status](https://coveralls.io/repos/github/Timothy191/Arch-System/badge.svg?branch=main)](https://coveralls.io/github/Timothy191/Arch-System?branch=main)
A high-performance, multi-departmental mining operations portal built as a monorepo. It provides authenticated access to department-specific dashboards for drilling, production, access control, engineering, control room, safety, training, and satellite monitoring.

## 🏗️ Architecture

This project is organized as a **Turborepo** monorepo using **pnpm** for workspace management.

### Applications (`apps/`)

- **`portal`**: The main Next.js 16 (App Router) application. High-density dashboards, real-time monitoring, data entry forms, SCADA integration, and architectural visualization (includes the `/overview` route).

### Packages (`packages/`)

- **`@repo/theme`**: Design tokens, OKLCH color system, and Tailwind CSS configuration (Single Source of Truth).
- **`@repo/ui`**: Shared React components (GlassCard, KPI, DepartmentLayout, etc.) built with Radix UI and shadcn/ui.
- **`@repo/supabase`**: Supabase clients (browser, server, middleware, service-role, read-replica) and Kysely query builders.
- **`@repo/database`**: SQL migrations and schema definitions (source of truth).
- **`@repo/contract`**: API type definitions and Zod validation schemas (canonical data contracts).
- **`@repo/errors`**: Structured error classes with context and cause tracking.
- **`@repo/redis`**: Redis client, caching helpers, cache statistics, and TTL registry.
- **`@repo/rate-limiter`**: Rate limiting framework with fixed-window, sliding-window, and token-bucket strategies.
- **`@repo/logger`**: Structured Pino logging for server, browser, and Next.js.
- **`@repo/utils`**: Utility functions for third-party integrations (Novu, Inngest, Excel exports).
- **`@repo/eval`**: LLM evaluation suite using DeepEval for AI service quality testing.
- **`@repo/agents`**: Shared agent coordination engine and specialist modules.
- **`@repo/eslint-config`**: Shared ESLint configurations.
- **`@repo/typescript-config`**: Shared TypeScript configuration.

### Libraries (`libs/`)

- **`libs/features/*`**: Domain-specific feature modules (`auth`, `departments`, `hub`, etc.) with UI and data-access layers.
- **`libs/shared/*`**: Shared utilities, data-access, hooks, and utilities across features.

### Services (`services/`)

- **`services/integrations/`**: Third-party API client integrations (OpenRouter, Cohere, n8n).

## 🚀 Quick Start

### Prerequisites

- **Node.js**: `>=22`
- **pnpm**: `9.15.9`

### Setup

1. **Install dependencies**:

   ```bash
   pnpm install
   ```

2. **Environment Variables**:
   Copy `apps/portal/env/.env.example` to `apps/portal/.env` and fill in your Supabase credentials.
3. **Start Local Database** (requires Docker):

   ```bash
   cd packages/database && pnpm supabase:dev
   ```

4. **Development Mode**:

   ```bash
   # Start the monorepo dev server (auto-resolves port conflicts and starts dependencies)
   pnpm dev
   ```

   **Note**: The development server automatically checks for port conflicts, starts the Supabase local stack, and launches the portal.

## 🛠️ Key Commands

- `pnpm dev`: Start the portal development server (includes asset sync).
- `pnpm dev:quick`: Start headless dev server (quick boot).
- `pnpm dev:turbo`: Start portal dev server via Turborepo.
- `pnpm build`: Build all applications and packages.
- `pnpm lint`: Run linting across the entire monorepo.
- `pnpm test`: Run tests (Jest and Playwright).
- `pnpm type-check`: Run TypeScript type checking across the monorepo.
- `pnpm quality`: Run the full quality gate (lint, type-check, tests, token linting, policy checks).
- `pnpm deploy:local`: Full stack deployment (Supabase + build + start).
- `pnpm audit:suite`: Run compliance audits (RLS, design tokens, contract drift, agentic content).

## 📖 Documentation

### Unified Documentation Center

- **[documentation/README.md](documentation/README.md)**: New unified documentation center with consolidated structure
  - **[documentation/03-audit-reports/](documentation/03-audit-reports/)**: Audit reports, RLS analysis, and quality compliance
  - **[codebase-maps/](codebase-maps/)**: Codebase visualization and architecture maps
  - **[documentation/05-wiki/](documentation/05-wiki/)**: Comprehensive technical wiki and knowledge base

### Core Documentation

- **[CLAUDE.md](CLAUDE.md)**: Authoritative technical guide and conventions.
- **[DESIGN.md](docs/DESIGN.md)**: Detailed design system, color palette (OKLCH), and component rules.
- **[PRODUCT.md](docs/PRODUCT.md)**: Product strategy, user personas, and core mission.

### Additional Documentation

- **[AGENTS.md](AGENTS.md)**: Development workflow, quality gates, and agent contracts
- **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**: Deployment guide for all environments
- **[docs/ONBOARDING.md](docs/ONBOARDING.md)**: Step-by-step developer onboarding guide
- **[docs/MONOREPO.md](docs/MONOREPO.md)**: Monorepo structure, Turbo targets, and security policies
- **[docs/DOCUMENTATION_INDEX.md](docs/DOCUMENTATION_INDEX.md)**: Comprehensive documentation index
- **[GEMINI.md](GEMINI.md)**: AI-specific development conventions
- **[SECURITY.md](docs/SECURITY.md)**: Security policy and vulnerability reporting

---

_Built for industrial-scale vigilance and operational precision._
