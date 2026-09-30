# @repo/ui-primitives - Agent Guidelines

## Scope & Purpose

**Low-level primitive UI component library** built on shadcn/Radix UI foundation. This package contains:
- Base form inputs (Button, Input, Checkbox, Select, etc.)
- Layout primitives (Card, Dialog, Drawer, etc.)
- Data display primitives (Badge, Avatar, Table, etc.)
- Navigation primitives (DropdownMenu, Tabs, Breadcrumb, etc.)

## Architectural Invariants

### Hard Boundaries
- **NO** direct database access (`@repo/database`, `@repo/supabase`)
- **NO** domain-specific business logic
- **NO** Server Components or Next.js-specific code
- **NO** dark mode support (light mode only per project invariant)
- **Pure presentational components only** - receive data via props

### Design System Standards
- **Must** consume OKLCH design tokens from `@repo/theme`
- **Must** use Tailwind CSS for styling
- **Must** follow shadcn/Radix UI patterns for accessibility
- **Must NOT** use raw color values (hex, rgb, etc.) - use semantic tokens only

### Dependencies
- **Allowed**: `@radix-ui/*`, `lucide-react`, `tailwind-merge`, `clsx`, `class-variance-authority`
- **Allowed internal**: `@repo/theme` (tokens only)
- **Prohibited**: Any `@repo/*` package except `@repo/theme`
- **Prohibited**: Next.js, React DOM server APIs

## Component Classification

### Form Primitives
- Button (variants: default, destructive, outline, secondary, ghost, link)
- Input (Text, Password, Search)
- Checkbox
- Radio Group
- Select
- Textarea
- Label
- Fieldset

### Layout Primitives
- Card
- Dialog
- Drawer
- Sheet
- Popover
- Tooltip
- Accordion
- Tabs
- Separator
- ScrollArea
- Resizable

### Data Display Primitives
- Badge
- Avatar
- Table
- Progress
- Skeleton
- Toast/Sonner

### Navigation Primitives
- DropdownMenu
- ContextMenu
- CommandMenu
- Breadcrumb
- Pagination
- NavigationMenu

## Public API

All public exports MUST go through `src/index.ts`. No barrel exports from subdirectories.

## Testing

- Unit tests with Jest + @testing-library/react
- Storybook stories for visual testing
- Accessibility tests with axe-core

## Quality Gates

- TypeScript strict mode
- Biome linting
- Stylelint for CSS
- 100% TypeScript type coverage for public API
