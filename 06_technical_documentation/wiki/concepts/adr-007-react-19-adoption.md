---
title: "ADR-007: React 19 Adoption Strategy"
created: 2026-05-15
updated: 2026-05-15
type: decision
status: accepted
tags: [adr, react, upgrade, decision]
sources: [CLAUDE.md, 06_technical_documentation/wiki/concepts/portal-app-architecture.md]
confidence: medium
---

# ADR-007: React 19 Adoption Strategy

## Status

**Accepted** — Implemented May 2024

## Context

React 19 was released with Next.js 15, offering:

- React Server Components (stable)
- Actions (form mutations simplified)
- use() hook for promises
- Improved hydration
- Document metadata API

However, the ecosystem was still adapting. We needed to decide:

- Adopt React 19 early or stay on 18?
- How to handle package compatibility?
- What to do about `00_applications/overview` (React 18)?

## Decision

We will **adopt React 19 for the main portal and shared packages**, with **00_applications/overview remaining on React 18** temporarily.

### Implementation Strategy

1. **Portal app** (`00_applications/portal`) — React 19 via `catalog:react19`
2. **Shared packages** (`@repo/ui`, `@repo/theme`, etc.) — React 19
3. **Overview app** (`00_applications/overview`) — React 18 (isolated)
4. **No cross-app component sharing** — Prevent version conflicts

## Consequences

### Positive

- **Latest features** — RSC, Actions, use() hook
- **Performance** — Improved hydration, smaller bundles
- **Future-proof** — Aligns with React direction
- **Next.js 15** — Required for App Router optimizations

### Negative

- **Ecosystem gaps** — Some packages not yet compatible
- `@react-three/fiber` v8 works but v9 not released
- `@tremor/react` compatibility questions
- **Testing** — Jest 30 + jsdom required updates
- **Team learning** — New patterns (use(), Actions)

### Neutral

- **Risk** — Early adopter challenges vs long-term benefit

## Risk Mitigation

### Package Compatibility Issues

| Package              | Version Used | Status              |
| -------------------- | ------------ | ------------------- |
| `@react-three/fiber` | v8.x         | Works with React 19 |
| `@react-three/drei`  | v9.x         | Works with React 19 |
| `@tremor/react`      | v3.18.7      | Monitor for issues  |
| `framer-motion`      | v12.x        | Fully compatible    |

### Backup Plan

If critical issues arise:

1. Pin to React 18 temporarily
2. Use `overrides` in package.json for specific packages
3. Fork and patch incompatible packages
4. Report issues to maintainers

## 00_applications/overview Isolation

`00_applications/overview` uses React 18 intentionally:

- Static visualization dashboard
- No interactivity requirements
- Uses older D3-based charts
- **Strict rule**: No component sharing with portal

```typescript
// DANGER: Never do this
// 00_applications/overview/components/chart.tsx
export { Chart } from "../../overview/components/chart"; // React 18!

// SAFE: Always do this
import { Chart } from "@repo/ui"; // React 19 compatible
```

## Migration Path

### Complete (2024)

- Portal migrated to React 19
- All shared packages on React 19
- Tests passing with Jest 30

### Future (2025)

- Upgrade `@react-three/fiber` to v9 when released
- Upgrade `00_applications/overview` to React 19 when chart library supports
- Remove React 18 from monorepo entirely

## Alternatives Considered

### Stay on React 18 (REJECTED)

- Would miss Next.js 15 optimizations
- RSC not fully stable in React 18
- Technical debt accumulation

### Upgrade Everything to React 19 (REJECTED)

- `00_applications/overview` chart library incompatible
- Forcing upgrade would break visualizations
- Isolated approach safer

## Learnings

- React 19 is production-ready for new projects
- Catalog versioning in pnpm helps manage mixed versions
- Some ecosystem packages need time to catch up
- Having isolation strategy (overview app) is valuable

## Related

- [[portal-app-architecture]] — React 19 patterns used
- [[nx-monorepo]] — Workspace version management
- [[comparisons/react-patterns]] — Why App Router + RSC
