# Design System (@repo/theme)

Single source of truth for visual design, tokens, and Tailwind configuration.

## 🚀 Key Commands

- `pnpm codegen`: Generate TypeScript tokens from `tokens.json` using Style Dictionary.
- `pnpm tokens:watch`: Rebuild tokens automatically on change.
- `pnpm lint:tokens`: Validate token naming and structure.
- `pnpm lint:css`: Lint global CSS files.

## 🛠️ Development Conventions

### Color System (OKLCH)

- **Palette**: Neutral-heavy with functional accents (≤10%).
- **Tokens**: Primitives are named `arch0` to `arch15`.
- **Semantic Aliases**: Always prefer semantic aliases (e.g., `bg-primary`, `text-heading`, `accent-blue`) over primitives.
- **Theme**: Light-only (macOS Sonoma visual language). Dark mode is explicitly NOT supported.

### Tailwind Configuration

- The preset lives in `src/tailwind/preset.ts`.
- Components in the monorepo import this preset to ensure consistent styling.

### Animation Rules

- **Easing**: `cubic-bezier(0.16, 1, 0.3, 1)` (ease-out-expo).
- **Durations**: 150ms (micro), 250ms (structural), 400ms (modal).
- **Restrictions**: Never animate layout properties (`width`, `height`, etc.). Only `opacity`, `transform`, and colors.

### Development Notes

- **Context Breadcrumbs**: When implementing complex architectural logic, leave inline comments explaining the rationale. This ensures future maintainers understand the design decisions.
- **Runtime Telemetry**: Where applicable, ensure functions are instrumented (e.g., `prom-client` or OpenTelemetry spans) so runtime behavior can be analyzed.
