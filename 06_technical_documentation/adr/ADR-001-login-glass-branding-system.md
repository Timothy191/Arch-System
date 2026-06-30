# ADR-001: Login Glass Branding System

- **Status**: accepted
- **Date**: 2026-06-30
- **Deciders**: Tim
- **Tags**: portal, theme, login, branding, health-check

## Context

The portal login surface is the first operational touchpoint for remote mine-site staff. It must convey industrial credibility (Arch-Operational System), surface live dependency health (Supabase, Redis, FUXA SCADA, Auth API), and advertise integrated CLI agent capabilities — without demo placeholders or dark-mode chrome.

Prior login iterations mixed panel borders, static "Secure" labels, and inconsistent brushed-metal treatment between the card, inputs, notice bubble, and taskbar.

## Decision

Adopt a **centralized glass branding system** in `@repo/theme` with portal-specific composition in `00_applications/portal`:

1. **Visual language** — Brushed silver card body with woven gold thread borders, animated shine/shade layers, and borderless intro wordmark that blends into the card surface. All colors use OKLCH tokens from `01_platform_packages/theme/src/css/variables.css`; no hardcoded hex in components.

2. **Login card structure** — `login-card-intro` (brand only) + `login-card-panel--main` (form, notice, service banner, CLI ticker). Decorative layers (`login-card-border-shine`, `login-card-thread-border`, `login-card-surface-sheen`) are sibling elements, not nested in content.

3. **Rotating service health banner** — `LoginServiceStatusBanner` polls `/api/health`, maps to tray health types, rotates services every 3.5s, and applies status modifiers (`--ok`, `--degraded`, `--unavailable`, `--disabled`, `--loading`). Pill styling matches brushed silver + gold border shine.

4. **CLI agent ticker** — Footer band lists integrated CLI agents via `CliAgentMark` + `integrated-cli-agents.ts`; icons synced from `04_shared_static_assets/icons/cli-agents/` to `portal/public/` via Nx `sync-assets`.

5. **Glass shine orchestration** — `GlassShineController` in `05_greenfield_application_source/01_Admin` coordinates timed reflect sweeps on login/taskbar targets without coupling shine logic into feature UI.

6. **Wordmark** — Floating split-tone logo + title + tagline ("Powered & Integrated with Agentic AI Capabilities"); accessible name on `h1`, decorative spans `aria-hidden`.

## Consequences

### Positive

- Single source of truth for login/taskbar chrome in `glass.css` and `animations.css`
- Operators see live service state before authenticating
- Branding scales to taskbar search, system tray, and future `05_greenfield_application_source/` admin modules
- `prefers-reduced-motion` pauses decorative animations

### Negative

- Large `glass.css` surface area increases merge conflict risk
- Health banner depends on `/api/health` availability at login (graceful offline states required)
- Animated layers add CSS complexity; visual regressions need browser verification

### Neutral

- Frontend/backend separation (next priority per HOW.md) unchanged — banner is a client component calling a public health endpoint
- Wiki ADRs (`06_technical_documentation/wiki/concepts/adr-00*`) remain separate; this record lives in `06_technical_documentation/adr/` per harness ADR workflow

## Links

- `01_platform_packages/theme/src/css/glass.css`
- `00_applications/portal/app/(auth)/login/page.tsx`
- `00_applications/portal/components/auth/LoginServiceStatusBanner.tsx`
- `05_greenfield_application_source/01_Admin/components/GlassShineController.tsx`
- Related wiki: `06_technical_documentation/wiki/concepts/adr-004-tailwind-design-system.md`
