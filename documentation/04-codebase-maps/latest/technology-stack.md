# ⚡ Technology Stack & Catalog Map

**Generated:** 8/20/2026, 9:17:54 AM UTC  
**Architecture:** Nx Monorepo + Next.js 16 + Supabase

---

## 🛠️ Stack Catalog

- **Monorepo Manager**: Nx 22 + pnpm 9.15.9 workspace
- **Frontend Core**: Next.js 16 (App Router), React 19, Tailwind CSS
- **Design System**: OKLCH Palette (`@repo/theme`), Glass surfaces, Named shadows only
- **Database Layer**: Supabase PostgreSQL + Drizzle ORM / Kysely
- **Caching & Metrics**: Redis Cluster + `@repo/redis` rate limiting
- **Quality & E2E**: Jest, Playwright E2E, DeepEval
