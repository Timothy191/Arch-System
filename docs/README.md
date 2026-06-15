# Arch-Systems Wiki (VitePress)

This is the VitePress-powered documentation site for the Arch-Systems wiki.

## Setup

```bash
cd docs
pnpm install
```

## Development

```bash
pnpm dev      # Start dev server at http://localhost:5173
```

## Build

```bash
pnpm build    # Build static site to .vitepress/dist
pnpm preview  # Preview built site
```

## Deploy to GitHub Pages

```bash
# Build and deploy
pnpm build
# Copy .vitepress/dist to gh-pages branch
```

## Wiki Content

Content is sourced from `/wiki` directory:

- `entities/` - Product/company entities
- `concepts/` - Architecture, patterns, decisions
- `comparisons/` - Technology comparisons
- `queries/` - How-to guides

## Configuration

- `.vitepress/config.mjs` - Site configuration
- `.vitepress/theme/` - Custom theme (if needed)
