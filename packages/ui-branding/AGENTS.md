# @repo/ui-branding - Agent Guidelines

## Scope & Purpose

**Global branding and identity package**. This package contains:
- Company logos and brand assets
- Brand-specific color variants and themes
- Brand-aware components that must be consistent across all applications
- Static assets (SVGs, images) used for branding

## Architectural Invariants

### Hard Boundaries
- **NO** application-specific logic
- **NO** dynamic data fetching
- **Pure static assets and branding components only**
- **All assets MUST be embeddable as static imports**

### Global Branding Rules
- **Single source of truth** for all brand assets
- **All applications MUST import from this package**, not maintain their own copies
- **Logo variants**: Primary, Secondary, Monochrome, Icon-only
- **Color variants**: Must use OKLCH tokens from `@repo/theme`

### Dependencies
- **Allowed**: `@repo/theme`, `@repo/ui-primitives`
- **Prohibited**: Any application packages (`apps/*`)
- **Prohibited**: Any feature packages (`libs/features/*`)

## Package Structure

```
@repo/ui-branding/
├── src/
│   ├── components/
│   │   ├── Logo.tsx          # Primary logo component
│   │   ├── EveLogo.tsx        # Eve variant
│   │   ├── IconBrand.tsx      # Brand icon
│   │   └── Wordmark.tsx       # Text-only logo
│   ├── assets/
│   │   ├── logos/
│   │   │   ├── logo-primary.svg
│   │   │   ├── logo-secondary.svg
│   │   │   ├── logo-icon.svg
│   │   │   └── logo-monochrome.svg
│   │   ├── icons/
│   │   │   └── *.svg
│   │   └── patterns/
│   │       └── *.svg
│   └── theme/
│       └── brand-tokens.ts    # Brand-specific token overrides
└── package.json
```

## Usage Rules

### For Applications
```typescript
// CORRECT - Import from central branding package
import { Logo } from '@repo/ui-branding';
import logoIcon from '@repo/ui-branding/assets/logos/logo-icon.svg';

// WRONG - Never maintain local copies
// import Logo from './components/Logo'; // ❌
// import logo from './assets/logo.svg'; // ❌
```

### For Other UI Packages
```typescript
// @repo/ui-composites can import branding for consistent theming
import { Logo } from '@repo/ui-branding';

// But MUST NOT re-export branding components
// This prevents circular dependencies
```

## Asset Management

### SVG Logos
- Must be optimized (SVGO)
- Must have proper `viewBox` and dimensions
- Must include `aria-label` for accessibility
- Must support `className` prop for styling

### Static Assets
- Use TypeScript string imports for SVGs
- For images, use Next.js `<Image>` in consuming apps
- All paths must be absolute from package root

## Versioning

Brand assets should be versioned carefully:
- Logo changes = MAJOR version bump
- Color token changes = MINOR version bump
- Bug fixes = PATCH version bump

## Testing

- Visual regression tests for logos
- Accessibility tests for all brand components
- Verify SVG optimization in CI
