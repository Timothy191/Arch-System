# Codebase Maps

**Generated:** 2026-09-10
**System:** Arch-System Mining Operations Portal

## Overview

This directory contains versioned, machine-generated visual maps of the Arch-System monorepo. They provide multiple perspectives on the system architecture, dependencies, and structure to help developers understand the codebase quickly.

## Regeneration

Maps are regenerated with the canonical generator:

```bash
pnpm maps:gen        # node tools/repo/generate-codebase-maps.cjs
```

Each run writes a new versioned log folder (`log-N(YY-MM-DD)/`), updates `latest/`, and refreshes the root-level map files plus `manifest.json`. Commit the regenerated output atomically with any source change.

## Available Maps

| Map                        | File                            | Purpose                                             |
| -------------------------- | ------------------------------- | --------------------------------------------------- |
| Turborepo graph            | `turbo-graph.md`                | Task pipeline, caching, and scope-tagging hierarchy |
| Multi-agent architecture   | `multi-agent-architecture.md`   | Agent orchestration topology                        |
| Project dependencies       | `project-dependencies.md`       | Dependency relationships between projects           |
| Dependencies graph         | `dependencies-graph.md`         | High-level dependency flow                          |
| Package structure          | `package-structure.md`          | Package layout overview                             |
| Route/feature architecture | `route-feature-architecture.md` | Portal routing and feature mapping                  |
| Database schema            | `database-schema.md`            | Schema documentation with ER diagrams               |
| Technology stack           | `technology-stack.md`           | Stack overview                                      |
| CI/CD pipeline             | `ci-cd-pipeline.md`             | Pipeline visualization                              |

All maps include Mermaid diagrams for visual representation. Versioned snapshots live under `log-*/` and the most recent run under `latest/`.

## SVG Rendering

To render Mermaid diagrams to SVG, use the generic utility at `tools/scripts/generate-svg.sh` (requires Mermaid CLI with Puppeteer).
