# Plan: UI/UX Review Against 2026 Next.js & World-Class Standards

**Date:** 2026-09-19  
**Scope:** Frontend UI/UX surface of the Arch monorepo  
**allow:** `apps/portal`, `packages/ui`, `packages/theme`, `libs/features/**/ui`, shared styling/layout configs, public frontend assets  
**deny:** backend API routes, DB/migrations, CI/CD, secrets, infra, anything outside the UI surface

## Objectives

1. Inventory the actual UI surface (components, pages, design tokens, styling config).
2. Run objective scans (build, agent-ready, a11y/contrast, lint, type-check).
3. Research current top-tier Next.js UI/UX standards for 2026.
4. Deploy a multi-agent review team to score each UX dimension.
5. Synthesize a prioritized roadmap with concrete actions and effort estimates.

## Scoring Dimensions

| Dimension                             | Weight | Evidence Sources                                                           |
| :------------------------------------ | :----- | :------------------------------------------------------------------------- |
| Design-token discipline               | 0.15   | `tokens.json`, `variables.css`, Tailwind preset, component class names     |
| Glassmorphism & visual consistency    | 0.15   | `GlassCard`, `glass.css`, screenshots/build output, token usage            |
| Accessibility (a11y)                  | 0.20   | axe/Lighthouse, keyboard flow, touch targets, color contrast               |
| Performance & Core Web Vitals         | 0.15   | `next.config.mjs`, build stats, WebVitalsReporter, image/animation choices |
| Interaction & motion design           | 0.15   | Framer Motion usage, reduced-motion support, hover/active states           |
| Navigation & information architecture | 0.10   | route structure, hub/department layout, page hierarchy                     |
| Mobile/responsive fit                 | 0.10   | breakpoints, popover collision, touch targets, viewport handling           |

## Constraints

- No new runtime dependencies without explicit approval (P7).
- No edits to CI/CD, backend, or secrets.
- All findings must be evidence-based; no speculative styling opinions.
- Validation output must be pasted raw into the run manifest.

## Run Manifest

- Model: claude-sonnet-4 (via Droid)
- Tools: review skill, agent-ready skill, llm-council skill, subagent workers, `pnpm`, `next build`, `agent-ready`, Lighthouse/axe via Playwright if available
- Output: `ui-ux-review-report-2026.md`
