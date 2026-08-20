# 🕸️ Project Dependencies & Monorepo Graph Map

**Generated:** 8/20/2026, 9:17:54 AM UTC  
**Workspace:** Nx Monorepo Workspace

---

## 📦 Package Graph Rules

- **Apps**: `apps/portal`, `apps/cms`, `apps/overview`
- **Packages**:
  - `@repo/ui` — Shared OKLCH UI component library
  - `@repo/theme` — Design tokens and Tailwind configuration
  - `@repo/supabase` — Supabase client & server factory helpers
  - `@repo/database` — Database migrations & source-of-truth schemas
  - `@repo/contract` — Zod API input & mutation contracts
  - `@repo/redis` — Redis caching categories & rate limiters
- **Constraint**: `scope:app` -> `scope:package` only; `scope:package:ui` cannot depend on database packages.
