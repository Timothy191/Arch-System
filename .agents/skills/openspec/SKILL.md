---
name: openspec
description: Spec-driven API design, schema validation, OpenAPI linting, and format conversion utilizing OpenSpec with Gemini-native zero-cost execution.
---

# OpenSpec Operational Runbook

## Overview

OpenSpec streamlines API specification management, OpenAPI schema validation, and contract synchronization. It is configured to run zero-overhead, leveraging native Antigravity and local Gemini endpoints.

---

## 1. Core CLI Commands

| Command                            | Action                                               | Example                     |
| :--------------------------------- | :--------------------------------------------------- | :-------------------------- |
| `openspec init`                    | Initialize OpenSpec within a package or service      | `openspec init apps/portal` |
| `openspec validate [item]`         | Validate OpenAPI specifications against schema rules | `openspec validate`         |
| `openspec change <propose\|apply>` | Propose or apply spec-driven schema updates          | `openspec change propose`   |
| `openspec spec <list\|show>`       | Inspect and search API specs across workspaces       | `openspec spec list`        |
| `openspec context`                 | Print working API spec context for agent reasoning   | `openspec context`          |

---

## 2. Agent Workflow Integration

- **Contract Synchronization**: Specialists run `openspec validate` to assert that `@repo/contract` Zod schemas and OpenAPI exports remain synchronized.
- **Spec-First Changes**: Before mutating API route endpoints, agents propose spec deltas via `openspec change`.
