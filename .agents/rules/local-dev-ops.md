---
paths: ["apps/portal/**/*", "scripts/dev.sh"]
---

# Local Dev Server Operations & Grounded Reasoning

## Directives

1. **Headless & Fast Dev Loop**:
   - Prefer `pnpm dev:turbo` (Turbopack standalone portal dev server) or `pnpm dev:quick` when full local Docker containers (Supabase, Prometheus) are not running or when running inside autonomous agent loops.
2. **Grounded Verification**:
   - Always verify server availability on port `3000` using direct HTTP status checks (`curl -sI http://localhost:3000`) before concluding deployment success.
   - For route gating checks, assert both redirect status (`307`) on unauthenticated routes (`/hub`, `/<department>`) and `200 OK` on `/login`.
3. **Autonomous Error Resolution**:
   - Inspect build/runtime stdout logs directly using task management tools rather than assuming failures.
   - When encountering port collisions or zombie Next.js processes, inspect process listeners on port `3000` before respawning.
