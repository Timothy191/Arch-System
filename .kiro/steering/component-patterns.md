---
inclusion: fileMatch
fileMatchPattern: ["**/components/**/*", "**/ui/**/*"]
---

# Component Architecture

## Component Conventions

- Use `cn()` from `@repo/ui/lib/utils` for class merging
- Theme source of truth: `@repo/theme/tailwind/preset.ts`
- Do NOT add theme values directly in portal

## Forbidden Patterns

| Pattern                                | Why                             |
| -------------------------------------- | ------------------------------- |
| `bg-white/5`, `border-white/10`        | Breaks theme abstraction        |
| `font-semibold`, `font-bold`           | Use theme tokens instead        |
| `shadow-*`, `box-shadow`               | Use design system shadow tokens |
| Direct `@supabase/supabase-js` imports | Use `@repo/supabase` wrappers   |

## Design System Components

- `@repo/ui` is the shared component library
- Use shadcn/ui primitives as foundation
- Custom components go in `@repo/ui` unless app-specific
- Run `pnpm ui` to add new shadcn components
