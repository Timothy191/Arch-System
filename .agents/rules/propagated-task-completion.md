---
description: Always complete all downstream and cross-file actions affected by a primary task (renames, moves, deletions, config/API/schema changes) before concluding.
---

# Propagated Task Completion Mandate

Whenever you perform a primary task, you MUST autonomously identify and complete **all related and downstream actions** affected by that change across the entire workspace before concluding:

1. **Renames & Moves**: Update all imports, exports, re-exports, type references, tests, mocks, docs, scripts, CI/workflow paths, package manifests, and config files that reference the old name or path.
2. **Deletions & Removals**: Remove or update all orphaned references, unused dependencies, environment variables (local `.env*`, `.env.example`, Vercel/CI), tests, docs, and generated artifacts tied to the removed item.
3. **Additions & Schema/API Changes**: Wire up corresponding `@repo/contract` schemas, types, unit tests, environment templates, `AGENT_TRACER.md` entries, and deployment/CI configuration affected by the addition.
4. **Cross-Boundary Search & Verify**: Search across the entire monorepo (`rg` / `sg`) for all affected references after the primary edit, update every impacted file, and run `pnpm agent:verify` to confirm nothing is left broken or out of sync.
