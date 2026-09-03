# 🚀 CI/CD Pipeline & Quality Gate Topology Map

**Generated:** 9/2/2026, 9:51:59 AM UTC  
**Orchestration:** GitHub Actions + Local Deploy Scripts

---

## 🧪 Quality Gate Suite (`pnpm quality`)

1. `nx run-many -t lint` (ESLint code linting across workspace)
2. `nx run-many -t type-check` (Strict TypeScript check)
3. `nx run-many -t test` (Jest unit & integration tests)
4. `pnpm lint:root` & `pnpm lint:styles` (Stylelint CSS OKLCH check)
5. `pnpm lint:spelling` (Cspell spell checking)
6. `pnpm deps:lint` (Syncpack package version consistency)
7. `pnpm knip` (Dead code detection)
8. `pnpm policy:check` (Project tag & security policy compiler)
9. `pnpm audit:suite` (Versioned RLS & Design System compliance auditor)

---

## 🚢 Deployment Workflow (`scripts/deploy.sh`)
- Supports local, staging, and production zero-downtime deployment runs.
- Includes automatic cache purge and rollback triggers on verification failure.
