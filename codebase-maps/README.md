# Codebase Maps & Architecture Topology

**System:** Arch-System Mining Operations Portal (Next.js 16.3.8 App Router + React 19)

## Overview

This directory contains versioned, machine-generated visual architectural maps of the Arch-System monorepo. They provide multiple perspectives on system architecture, data flow, entity relationships, dependency boundaries, and deployment pipelines to help developers and autonomous swarms understand the codebase with zero ambiguity.

## Regeneration & Synchronization

Codebase maps are synchronized using the canonical workspace tools:

```bash
pnpm maps:sync       # node tools/repo/generate-codebase-maps.cjs --latest-only (fast refresh)
pnpm maps:check      # node tools/repo/generate-codebase-maps.cjs --check (used in agent:verify Gate 10)
pnpm maps:gen        # node tools/repo/generate-codebase-maps.cjs (creates new versioned log folder)
```

Each full generation run writes a new versioned snapshot folder (`log-N(YY-MM-DD)/`), updates `latest/`, and synchronizes the root-level map files plus `manifest.json`. Commit the regenerated output atomically with any structural source change.

## Available Architectural Maps

| Map                              | File                            | Diagram Type & Purpose                                                                                                         |
| :------------------------------- | :------------------------------ | :----------------------------------------------------------------------------------------------------------------------------- |
| **Turborepo Graph**              | `turbo-graph.md`                | Mermaid flowchart: Task execution pipeline, content-addressable caching, and scope tagging hierarchy (`turbo.json`).           |
| **Route & Feature Architecture** | `route-feature-architecture.md` | Mermaid sequence diagram: Next.js 16 request lifecycle, `proxy.ts`, Redis RBAC, RSC streaming, and 7-step Server Action gates. |
| **Database Schema**              | `database-schema.md`            | Mermaid ER diagram: Core entity relationships, 189 migrations, 100% InitPlan RLS optimization, and Zod contract parity.        |
| **CI/CD Pipeline**               | `ci-cd-pipeline.md`             | Mermaid flowchart: 6-stage delivery flow (Preflight -> CI Matrix -> Build -> Deploy -> Probes -> Canaries).                    |
| **Technology Stack**             | `technology-stack.md`           | Architecture matrix & Architectural Decision Records (ADR-001 through ADR-006).                                                |
| **Package Structure**            | `package-structure.md`          | Mermaid flowchart: Monorepo package directory tree, layer modularization, and strict directional invariants.                   |
| **Dependencies Graph**           | `dependencies-graph.md`         | Mermaid graph: Cross-package dependency edges and ESLint module boundary matrix.                                               |
| **Project Dependencies**         | `project-dependencies.md`       | Package graph rules, pnpm catalog alignment, and forbidden target enforcement.                                                 |
| **Multi-Agent Architecture**     | `multi-agent-architecture.md`   | Mermaid flowchart: Specialist persona roster, 5-layer Critique Council, SOTA Pre-flight Gate, and Langfuse tracing.            |

All maps include syntax-valid Mermaid diagrams that render natively on GitHub and inside the Portal Overview dashboard (`/overview`). Versioned historical snapshots are stored under `log-*/` and active zero-latency files reside under `latest/`.

## SVG Rendering

To render Mermaid diagrams to SVG for static offline documentation, use the utility script at `tools/scripts/generate-svg.sh` (requires Mermaid CLI with Puppeteer).
