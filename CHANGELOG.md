# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.5.1] - 2026-06-24

### Changed

- Major cleanup: removed experimental AI features, implemented lazy loading, and restructured routes for improved load times.
- Optimized Core Web Vitals (LCP, CLS, INP) across portal interfaces.
- Added pagination to the access control admin dashboards to handle large datasets.
- Enhanced production readiness by applying high-priority security fixes and cleaning up development infrastructure.
- Resolved styling issue where solid body backgrounds hid negative z-index video/animation layers.

### Added

- Root TypeScript configuration for workspace-wide type enforcement.
- Security-only Dependabot configuration.
- Lighthouse CI performance budgets and mobile emulation testing configuration.
- Dynamic health check endpoint checking Supabase database and Redis cache connectivity.
- Webpack performance budgets in Next.js config for package size control.

## [1.5.0] - 2026-06-18

### Added

- Automated Zod schema generation and deep contract validation for cross-service API parity.
- Static OpenAPI spec generation for offline contract validation.
- Self-hosted Nx caching using `nx-remotecache-s3`.
- Adopted `nrwl/nx-set-shas` and affected commands in CI workflows for faster pipeline execution.
- Inline architecture comments (`// AGENT-TRACE:`) for automated agents.

### Fixed

- Fixed systemd service file destination path typo from `/etc/infra/systemd/system/` to `/etc/systemd/system/`.

## [1.4.0] - 2026-06-15

### Added

- Reorganized project structure for production readiness:
  - Moved runtime files to `run/` directory.
  - Organized config files into `config/`, `docs/`, and `docker/` subdirectories.
  - Setup ESLint boundary rules and syncpack configs.
- Integrated `sync-assets-smart` to optimize build-time asset synchronization.
- Implemented static Row Level Security (RLS) policies auditor tool.

## [1.0.0] - 2026-06-15

### Added

- Initial release of the Arch-System Mining Operations Portal.
- Monorepo structure with Turborepo, pnpm workspaces, and Nx.
- Supabase integration with database migrations and schema types.
- Shared `@repo/ui` Radix/shadcn design system package.
