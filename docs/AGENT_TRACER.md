# Agent Tracer Log

This file maintains a record of AI agent interventions, context hand-offs, and architectural breadcrumbs for this specific package/app.

## [2026-06-15] Asset Consolidation - Single Source of Truth Established

- **Agent**: Devin (Claude Code)
- **Purpose**: Consolidate all assets to single source of truth at `/home/timothy/Documents/Arch-System/assets`, remove duplicates from `apps/portal/public/`, and update all references
- **Changes Made**:
  - **Removed unused assets** (~87MB freed):
    - Unused videos: intro.mp4, video*output_mp*.mp4, arch-bg.mp4, background.mp4, ps3-wave.mp4, light-mode.mp4
    - Unused images: focused.jpeg, focused-bg.jpeg, whatsapp-logo.jpeg (from both root and public)
    - Duplicate directories: background/, error-pages/, focused/, intro/, assets/ from public
  - **Enhanced sync script** (`scripts/sync-assets.sh`):
    - Added clean sync functionality (removes existing asset directories before copying)
    - Added specific asset directory list (background, error-pages, large)
    - Added confirmation message about single source of truth
  - **Moved company-branding.jpeg** from `public/assets/large/` to `assets/large/` for centralized management
  - **Updated asset references** in components:
    - `app/error.tsx`: Changed `/404-error.png` to `/error-pages/404-error.png`
    - `app/not-found.tsx`: Changed `/404-error.png` to `/error-pages/404-error.png`
    - `components/RouteBackground.tsx`: Updated comment to remove outdated ps3-wave.mp4 reference
  - **Cleaned root assets/**:
    - Removed empty intro/ and focused/ directories
    - Removed unused icons/whatsapp-logo.jpeg
    - Removed empty icons/ directory (PWA icons stay in public/icons/)
- **Current Asset Structure**:
  - **Single Source of Truth**: `/home/timothy/Documents/Arch-System/assets` (47MB total)
    - `background/light-mode/light mode.mp4` (22MB)
    - `background/focused-mode/focused mode.mp4` (25MB)
    - `error-pages/404-error.png` (2.7KB)
    - `large/company-branding.jpeg` (948KB)
    - `logo-1.png` (20KB)
    - `logo-focused.jpeg` (1.2MB)
  - **Sync Target**: `apps/portal/public/` (contains synced copy + app-specific files like PWA icons)
- **Next Agent Notes**:
  - All assets are now managed from the single source at `/home/timothy/Documents/Arch-System/assets`
  - Run `scripts/sync-assets.sh` after any asset changes to propagate to public/
  - PWA icons remain in `public/icons/` as they are app-specific
  - App-specific files (favicon.ico, manifest.json, etc.) remain in public/
  - Always verify asset paths in components match the synced structure in public/

## [2026-06-05] AMCA Foundation / Initialization

- **Agent**: Antigravity
- **Changes**: Initialized tracing protocols globally as per user instruction.

## [2026-06-15] Global Asset Synchronization Pipeline

- **Agent**: Antigravity
- **Changes**:
  - Added [scripts/sync-assets.sh](file:///home/timothy/Documents/Arch-System/scripts/sync-assets.sh) to automate synchronization of global assets from the root `assets/` directory to workspace public folders.
  - Integrated asset synchronization into [scripts/dev.sh](file:///home/timothy/Documents/Arch-System/scripts/dev.sh) and root [package.json](file:///home/timothy/Documents/Arch-System/package.json) scripts (`build`, `dev`, and `sync-assets`).
  - Ensured that all global assets (icons, logos, background videos) are automatically copied to target app directories at dev and build time, resolving the monorepo assets scaffolding issue.

## [2026-06-15] Cleanup of Safe-to-Remove Directories

- **Agent**: Antigravity
- **Changes**:
  - Confirmed the removal of safe-to-remove directories: `.audit`, `.codebase-viz`, and `.nx`.
  - Added `.audit/` to [/.gitignore](file:///home/timothy/Documents/Arch-System/.gitignore) to prevent generated RLS reports from polluting Git.
  - Added `.audit/` to [/.secretlintignore](file:///home/timothy/Documents/Arch-System/.secretlintignore) to exclude generated report folders from secret scanning.
  - Added `.audit/` to [/.memoryignore](file:///home/timothy/Documents/Arch-System/.memoryignore) to prevent indexing the generated reports.
  - Verified that running `pnpm audit:rls` continues to work properly and recreates the `.audit` directory when run.

## [2026-06-15] Comprehensive Project & Tech Stack Documentation

- **Agent**: Antigravity
- **Purpose**: Create a detailed, definitive project overview and tech stack wiki document to facilitate onboarding and architectural understanding.
- **Changes**:
  - Created [wiki/concepts/project-overview.md](file:///home/timothy/Documents/Arch-System/wiki/concepts/project-overview.md) detailing the Executive Summary, 8 Operational Departments, 100% Offline/Air-gapped readiness, Light-Theme contrast ergonomics, PostgreSQL Row Level Security (RLS) policies, Nx monorepo layout, Next.js 15 App Router stack, Local Ollama AI orchestrator, and Rocky Linux deployment topology.
  - Linked the new document within [wiki/index.md](file:///home/timothy/Documents/Arch-System/wiki/index.md), [wiki/README.md](file:///home/timothy/Documents/Arch-System/wiki/README.md), and [DOCUMENTATION_INDEX.md](file:///home/timothy/Documents/Arch-System/DOCUMENTATION_INDEX.md) for quick discovery.
  - Disabled markdownlint rule `MD025` (multiple H1 headers) in [.markdownlint.json](file:///home/timothy/Documents/Arch-System/.markdownlint.json) to standardise YAML frontmatter + H1 title formats across wiki documents.
  - Verified document formatting and linting validity.
