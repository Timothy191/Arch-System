# Plan: Native Clock Widget (`@repo/ui/Clock`)

> Replaces the discarded `new-content/modernclock-1.0.0.tar.gz` KDE Plasma QML widget
> with a system-native React implementation. **Status: planned, not yet implemented.**

## Why

`e2e/visual/login.visual.spec.ts` already masks `[data-testid="login-clock"]` and
`[data-testid="footer-date"]`, but no clock is rendered anywhere in the portal — the
mask exists for a component that was never built (or was removed). A clock is also a
natural occupant of the macOS-style `MacMenuBar` `rightSlot` already exported by
`@repo/ui`. This plan delivers the missing native component.

Non-goal: porting the QML/KDE widget. QML + `KPlugin` packaging has no path into an
Nx + Next.js + Payload + Supabase portal; a from-scratch React component is cheaper
and correct.

## Conformance targets (from AGENTS.md)

- Pure `@repo/ui` component — **must not** import `@repo/supabase`, `@repo/redis`,
  `@repo/database` (policy: `scope:package:ui` purity).
- No `any`, no `@ts-ignore`; strict TS.
- No generic `Error` throws (not relevant here — component is presentational).
- Zustand only for UI chrome if needed (not needed here).
- Light-mode invariant: must read from CSS theme tokens, no hardcoded dark colors.
- Exported strictly via `packages/ui/package.json` `exports` map.

## Deliverables

### 1. `packages/ui/src/components/Clock.tsx` (new)

Pure client component (`"use client"`) — needed for live time updates.

Responsibilities:

- Ticking time via `requestAnimationFrame` throttled to 1s, or `setInterval(1000)`.
  Prefer `setInterval` + `useEffect` cleanup (simple, deterministic, testable).
- Format via `Intl.DateTimeFormat` (locale + `timeStyle`/`hour12` props), default
  `en-US` short time to match the macOS menu-bar look already used by `MacMenuBar`.
- Optional `showSeconds`, `showDate`, `format` (`"time" | "date" | "datetime"`),
  `locale`, `className`, `testId` props.
- Stable `data-testid` passthrough (default `"clock"`; login instance uses
  `"login-clock"`; footer instance uses `"footer-date"`).
- Hydration-safe: render an empty/placeholder span on first paint to avoid
  SSR/CSR mismatch, then set the time string after mount. (Critical — Next.js App
  Router SSR will otherwise warn on time-string mismatch.)
- Reads colors from theme tokens (`var(--text-secondary)`, etc.) — no hardcoded
  hex. Keeps the light-mode invariant pass.
- `aria-label` with full localized time for a11y; visible text is the formatted
  short form.

### 2. `packages/ui/src/components/Clock.stories.tsx` (new)

Storybook stories covering: `time`, `date`, `datetime`, `withSeconds`,
`hour12false`. Enables the existing `@storybook/test-runner` axe accessibility
hook (no `a11y.disable`).

### 3. `packages/ui/src/components/Clock.test.tsx` (new)

Jest + JSDOM (matches `apps/portal`/`libs/features` setup). Cover:

- Renders placeholder until mounted (no hydration mismatch string on first render).
- After `act()` + fake timers, displays correctly formatted time.
- Respects `showSeconds`, `hour12`, `locale`, `format`.
- Cleans up interval on unmount (assert no setState-after-unmount warning).
- Forwards `data-testid`.

### 4. Wire `packages/ui/package.json` exports

Add:

```json
"./Clock": "./src/components/Clock.tsx"
```

(Plus keep the wildcard `./components/*` route consistent — the explicit alias
matches the pattern used by `Logo`, `GlassCard`, etc.)

### 5. Place on the login page — `apps/portal/app/(auth)/login/page.tsx`

Login page is a `server component` today. Two options:

**Option A (recommended):** Create a tiny client wrapper at
`apps/portal/features/auth/components/LoginClock.tsx` (`"use client"`) that renders
`<Clock testId="login-clock" format="time" />` and is imported into the server
`page.tsx`. Keeps server component boundary clean, isolates client JS to the
clock only. Position it in the title-bar row of the login card (right side, where
the macOS menu-bar clock lives), replacing the empty `pr-14` spacer pattern.

**Option B:** Make the whole login page client — rejected (breaks the
`force-dynamic` SSR auth-cookie check pattern the page relies on).

Also add a `<Clock testId="footer-date" format="date" />` next to the
`v{PORTAL_VERSION}` / `Arch OS` footer row to satisfy the `footer-date` mask.

### 6. (Optional, follow-up) Wire into `MacMenuBar.rightSlot`

Wherever `MacMenuBar` is mounted in the authenticated shell, pass
`<Clock format="time" />` as `rightSlot`. This is a separate change in the
authenticated layout, out of scope for the login fix but listed for completeness.

## Verification

1. `pnpm --filter @repo/ui test` — new Clock unit tests pass.
2. `pnpm ui` → Storybook — Clock stories render, axe passes.
3. `pnpm --filter portal test` — login page tests (existing + any new) pass.
4. `pnpm test:e2e:visual` — login snapshot still passes (clock is masked, so
   adding it must NOT change the baseline; this proves the mask is now backed by
   a real element instead of matching nothing).
5. `pnpm lint && pnpm type-check` — clean.
6. `pnpm policy:check` — confirm `@repo/ui` still has no data-layer imports.
7. `pnpm quality` — full gate.

## Files touched

| File                                                  | Change                                            |
| ----------------------------------------------------- | ------------------------------------------------- |
| `packages/ui/src/components/Clock.tsx`                | new                                               |
| `packages/ui/src/components/Clock.stories.tsx`        | new                                               |
| `packages/ui/src/components/Clock.test.tsx`           | new                                               |
| `packages/ui/package.json`                            | add `./Clock` export                              |
| `apps/portal/features/auth/components/LoginClock.tsx` | new client wrapper                                |
| `apps/portal/app/(auth)/login/page.tsx`               | import `LoginClock`, render in title bar + footer |
| `packages/ui/AGENT_TRACER.md`                         | append ISO-8601 entry                             |
| `apps/portal/AGENT_TRACER.md`                         | append ISO-8601 entry                             |

## Risks / notes

- **Hydration mismatch** is the main trap. Must render a stable placeholder on
  SSR and only set the live time string in `useEffect`.
- **Visual snapshot stability**: the clock is masked in the visual spec, so a
  ticking clock won't flake the snapshot. Confirm the mask selector still matches
  after wiring (testid must be exactly `login-clock`).
- **Locale**: keep `en-US` default to match the macOS aesthetic already in
  `MacMenuBar`; do not auto-detect `navigator.language` (would break snapshot
  determinism and SSR consistency).

## Out of scope

- Porting any QML/Qt code from the deleted `modernclock` widget.
- A weather card, alert banner, or marquee — the login visual spec masks these
  too, but they are separate features not requested here.
