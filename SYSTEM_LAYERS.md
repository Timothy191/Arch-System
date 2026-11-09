# Arch-System System Layers

This document outlines the architectural layers and directories of the Arch-System (Plantcor / Arch OS) project. The repository uses a Turborepo-based monorepo structure.

## 1. Frontend / UI Layer

This layer is responsible for the visual presentation and client-side interactions.

*   **`apps/portal`**: The main Next.js 16 App Router application. It is the sole application in this monorepo and serves high-density dashboards for various departments.
*   **`packages/theme`**: Contains design tokens (OKLCH color system), Tailwind CSS configuration, and serves as the Single Source of Truth for styling.
*   **`packages/ui`**: Shared React components built with Radix UI and shadcn/ui. Examples include `GlassCard`, `DepartmentLayout`, and `KPI`.

## 2. Backend / API Layer

This layer handles the server-side logic, routing, and data fetching orchestrations.

*   **Next.js Server Actions (`apps/portal/actions` & Server Components)**: Following the canonical 8-step security sequence, server actions manage authentication, authorization, rate-limiting, and data mutations.
*   **`apps/portal/server/proxy.ts`**: The request proxy handling Next 16 routing, CSP, nonces, and Supabase auth claims verification.

## 3. Domain & Shared Logic Layer

This layer contains the business logic, domain-specific models, and shared utilities.

*   **`libs/features/*`**: Contains domain-specific feature modules like `auth`, `departments`, and `hub`. Each module is further divided into UI components, data-access layers, and utilities.
*   **`libs/shared/*`**: Provides shared hooks, data-access patterns, and utilities that cross-cut different feature modules.
*   **`packages/contract`**: Contains the canonical API type definitions and Zod validation schemas. It acts as the Single Source of Truth for frontend and backend input validation.

## 4. Data / Storage Layer

This layer manages persistence, caching, and database interactions.

*   **`packages/database`**: The authoritative source for SQL migrations and generated types.
*   **`packages/supabase`**: Contains clients for Supabase interactions, including typed DB access via Kysely and Supabase SSR clients.
*   **`packages/redis`**: Provides Redis caching clients, L1/L2 caching helpers, sessions, rate limiting storage, and TTL registry.

## 5. Infrastructure & Utilities Layer

This layer provides cross-cutting infrastructural concerns like logging and error handling.

*   **`packages/errors`**: Defines structured error classes (e.g., `AppError`, `AuthError`, `ValidationError`) for consistent error handling and tracking across the system.
*   **`packages/logger`**: Implements structured Pino logging for server, browser, and Next.js environments.
*   **`packages/rate-limiter`**: Provides a framework for rate limiting using fixed-window, sliding-window, and token-bucket strategies.
*   **`packages/utils`**: Contains utility functions for third-party integrations like Novu, Inngest, and Excel exports.

## 6. AI & Agentic Layer

This layer manages AI integrations and agentic workflows.

*   **`packages/agents`**: Houses the AI coordination engine and specialist modules.
*   **`packages/eval`**: Contains an LLM evaluation suite using DeepEval for testing AI service quality.

## 7. Tooling & Testing

This layer encompasses build tools, scripts, and testing environments.

*   **`tools/`**: Build-time tools, policy compilers, audits, scripts, and the zero-drift watchdog.
*   **`scripts/`**: Utilities for development, deployment, and database seeding.
*   **`e2e/`**: Contains the Playwright End-to-End (E2E) testing specifications.
*   **`config/`**: Configuration files for tools like knip, syncpack, and turbo.
*   **`packages/typescript-config`**: Shared TypeScript configurations used across the monorepo.
