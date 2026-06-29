# Overview App

Standalone architecture visualization app for the Arch Systems monorepo.

## Purpose

Displays system architecture and component relationships using interactive diagrams.

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Visualization**: @xyflow/react for interactive flow diagrams
- **Styling**: Tailwind CSS with @repo/theme design tokens
- **Port**: 3002

## Development

```bash
# Run dev server
pnpm --filter overview dev

# Build for production
pnpm --filter overview build

# Run linter
pnpm --filter overview lint

# Type check
pnpm --filter overview type-check
```

## Structure

- `app/` - Next.js app directory
- `components/` - Reusable UI components
- `lib/` - Utility functions
- `sections/` - Architecture diagram sections
