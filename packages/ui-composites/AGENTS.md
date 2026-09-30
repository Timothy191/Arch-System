# @repo/ui-composites - Agent Guidelines

## Scope & Purpose

**Composite UI component library** built from `@repo/ui-primitives`. This package contains:
- Business-agnostic composite components
- Industrial-grade data visualization components
- Layout components for pages and sections
- Complex form components

## Architectural Invariants

### Hard Boundaries
- **NO** direct database access
- **NO** domain-specific business logic (use `libs/features/*/ui` for that)
- **NO** Server Actions or mutation logic
- **Pure presentational components** - receive data via props or React Query hooks

### Design System Standards
- **Must** import and use primitives from `@repo/ui-primitives`
- **Must** consume OKLCH design tokens from `@repo/theme`
- **Must** follow strict light mode invariant
- **Must NOT** duplicate primitive component logic

### Dependencies
- **Allowed**: `@repo/ui-primitives`, `@repo/theme`, `framer-motion`, `recharts`
- **Allowed**: Data grid libraries (`@revolist/react-datagrid`)
- **Prohibited**: Any domain-specific packages (`@repo/departments/*`, etc.)
- **Prohibited**: Next.js server APIs

## Component Classification

### Data Display Composites
- GlassCard (window, spotlight, liquid variants)
- KPI (Key Performance Indicator cards)
- DataGrid (with sorting, filtering, pagination)
- TelemetryChart
- Gauge
- EmptyState

### Layout Composites
- PageHeader
- DepartmentLayout
- Divider
- BorderBox
- TrustLogos
- HeroRotator
- HeroCardContent

### Form Composites
- FormFields
- SecondaryButton
- AcknowledgeButton
- ShiftToggle
- Clock
- Input (extended with domain-specific variants)

### Motion-Enhanced Composites
- AnimatedButton
- AnimatedDialog
- AnimatedList
- AnimatedNumber
- Marquee

## Public API

All public exports MUST go through `src/index.ts`.

## Layering Rule

```
@repo/ui-primitives (low-level, no business logic)
    ↓ imports from
@repo/ui-composites (composite, still business-agnostic)
    ↓ imports from
libs/features/*/ui (domain-specific UI)
```

## Testing

Same as `@repo/ui-primitives` - Jest, Storybook, accessibility tests.
