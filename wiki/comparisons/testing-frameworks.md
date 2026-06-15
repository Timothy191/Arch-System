---
title: Testing Framework Comparison
created: 2026-05-15
updated: 2026-05-15
type: comparison
tags: [testing, architecture, decision]
sources: [apps/portal/package.json, packages/eval/README.md, CLAUDE.md]
confidence: high
---

# Testing Framework Comparison: Jest vs Vitest vs Node.js Test Runner

## What is Being Compared

Selection of unit testing framework for a Next.js 15 + React 19 application with Server Components and client-side interactivity.

## Dimensions of Comparison

| Dimension            | Jest 30                             | Vitest                         | Node.js Test Runner    |
| -------------------- | ----------------------------------- | ------------------------------ | ---------------------- |
| **React 19 Support** | Native via `jest-environment-jsdom` | Native via `happy-dom`/`jsdom` | Limited (experimental) |
| **RSC Testing**      | Via `@testing-library/react`        | Via `@testing-library/react`   | Not supported          |
| **Speed**            | Good (parallel by default)          | Excellent (Vite-powered)       | Fastest (native)       |
| **ESM Support**      | Improved in v30                     | First-class                    | Native                 |
| **Mocking**          | Jest mocks (mature)                 | vi.fn() (Jest-compatible)      | Native mock module     |
| **IDE Integration**  | Excellent                           | Excellent                      | Limited                |
| **CI/CD**            | Mature reporters                    | Growing support                | Minimal                |
| **Snapshot Testing** | Mature                              | Compatible                     | Basic                  |
| **TypeScript**       | `ts-jest` required                  | Native                         | `tsx` loader needed    |

## Project Context

The codebase uses **Jest 30** with:

- `jest-environment-jsdom` for component tests
- `ts-jest` for TypeScript transformation
- `@testing-library/react` for React component testing
- Co-located test files (`<Component>.test.tsx` pattern)

## Why Jest Was Chosen

1. **Mature ecosystem** — Deep integration with React Testing Library
2. **Next.js compatibility** — Official Next.js testing examples use Jest
3. **jsdom environment** — Required for testing client components with DOM APIs
4. **Snapshot stability** — Established snapshot testing for UI components
5. **Parallel execution** — Built-in worker parallelization for monorepo speed

## Why Not Vitest

While Vitest offers superior speed and ESM-first design, the project prioritized:

- Battle-tested React 19 compatibility
- Existing team familiarity with Jest patterns
- Mocks ecosystem (Jest's mock system is more mature)

## Why Not Node.js Test Runner

Experimental status and lack of RSC/React Testing Library integration make it unsuitable for a production React application.

## Verdict

**Jest 30 is the correct choice** for this project's maturity requirements, though Vitest would be reconsidered for a greenfield React 19+ project in 2026.

## Related

- [[deepeval-integration]] — Python-based LLM evaluation (complementary, not replacement)
- [[portal-app-architecture]] — Testing strategy in architecture
