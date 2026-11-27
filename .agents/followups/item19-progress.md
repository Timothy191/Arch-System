# Item #19 Progress — Interactive 3D Animation

Worktree: `/home/tim/.local/share/opencode/worktree/8cc180/followup-item19-3d`

## PLAN — 2026-11-27T10:01:28Z

- Read `AGENTS.md` and `.agents/rules/execution-guardrails.md` in this worktree.
- Build `apps/portal/components/visualization/Interactive3DMachineStage.tsx` as a self-contained client component:
  - CSS `transform: perspective(...) translate3d(...) rotateX(...) rotateY(...) scale(...)` with layered `translateZ` elements for depth.
  - Pointer drag rotates; Shift/Middle/Right drag pans; wheel zooms; keyboard arrows rotate, Shift+arrows pan, `+`/`-` zoom.
  - Visible reset button, labeled/grouped keyboard-operable surface, instructions via `aria-describedby`.
  - `prefers-reduced-motion` hook -> marker class + `data-reduced-motion` + no transition.
  - Performance: transform-only transitions, `will-change` only during interaction with timeout cleanup, no rAF loop, clamped zoom/rotation/pan.
- Integrate into `machine-operations/page.tsx` after the KPI strip, without touching data fetching or other layout.
- Add `Interactive3DMachineStage.test.tsx` covering render, pointer drag, wheel zoom, keyboard, reset, reduced motion, no-rAF/no-three source assertions, and package.json dependency assertions.
- Verify: portal type-check, biome on changed files, targeted Jest suites. Commit conventionally; do not push.

## ASSET_REVIEW — 2026-11-27T10:01:28Z

- Confirmed existing real assets: `apps/portal/public/images/fleet/hitachi-excavator.webp`, `komatsu-excavator.webp`, and 15 other fleet WebP images; `@repo/ui/Logo` SVG also available.
- Chosen subject: `next/image` with `/images/fleet/hitachi-excavator.webp` (explicit width/height to satisfy the image-optimization audit).
- Confirmed no `three`, `@react-three/fiber`, or `drei` entry in root or portal `package.json` / lockfile.
- Confirmed Jest maps `@repo/ui/GlassCard`, `@repo/ui/Logo`, and `next/image` is usable in jsdom; `matchMedia` must be mocked per test (pattern copied from `ServiceWorkerRegister.test.tsx`).

## IMPLEMENT — 2026-11-27T10:04:41Z

- Created `apps/portal/components/visualization/Interactive3DMachineStage.tsx` with clamped transform state, pointer rotate/pan, wheel zoom, keyboard map, reset button, reduced-motion hook, glass panel, and layered `next/image` fleet subject.
- Created `apps/portal/components/visualization/Interactive3DMachineStage.test.tsx` with render/drag/pan/wheel/keyboard/reset/reduced-motion/dependency-guard coverage.
- Integrated `<Interactive3DMachineStage />` into `machine-operations/page.tsx` immediately after the KPI strip; no data fetching or existing layout changed.

## VERIFY — 2026-11-27T10:16:09Z

- `pnpm install --frozen-lockfile --prefer-offline` in the isolated worktree: passed (the worktree initially had no `node_modules`; no lockfile change).
- `npx biome check` on the 3 changed files: `Checked 3 files in 5s. No fixes applied.` (pass).
  - Fixed during implementation: Biome rejects `tabIndex` on non-interactive `div` roles; the stage is now a real focusable `<button>` with phrasing-content `<span>` layers, which also keeps the DOM semantically valid and keyboard operable.
  - Removed unused `PRIMARY_BUTTON` by using it in the pointer-button guard.
- `pnpm --filter portal type-check`: passed (`tsc --noEmit`, no errors).
- `pnpm --filter portal test -- --testPathPatterns="Interactive3DMachineStage|MachineOperationsList"`: `2 passed` suites, `36 passed` tests.
  - jsdom has no `PointerEvent` constructor, so `fireEvent.pointer*` initially produced `clientX/clientY === undefined` (NaN transform). Added a test-only `MockPointerEvent extends MouseEvent` polyfill; production code unchanged. Pointer drag and Shift-drag pan are now genuinely asserted, not skipped.
  - The browser style object model normalizes `translate3d(x, y, 0)` (z without a unit) in jsdom; expectations updated accordingly.
  - `window.matchMedia` is defined non-configurable by global `setupTests.ts`; tests use the existing Jest mock via `mockImplementation` instead of `Object.defineProperty`.
- Extra invariant audits (all passed): `audit:images` (0 violations), `audit:tailwind` (499 files within baseline), `audit:tokens` (100%), `audit:hooks` (0 warnings), `audit:agents:check` (100%), `policy:check` (0 violations).

## COMMIT — 2026-11-27T10:21:50Z

- Conventional commit created locally (not pushed): `feat(portal): add dependency-free interactive 3D machine stage`.
- First commit attempt was rejected by the pre-commit CSpell hook for two technical terms in this progress file; both were rephrased and the commit succeeded. All other pre-commit guards (Biome parse, JSON validation, drift/snapshot, policy integrity, affected lint, agent interop, commitlint) passed.

## BLOCKERS — 2026-11-27T10:21:50Z

- None. The worktree started without `node_modules`, resolved by `pnpm install --frozen-lockfile --prefer-offline` inside the worktree (no lockfile change).
- jsdom limitations were handled in the test file only (PointerEvent polyfill, `matchMedia` mock reuse, CSS style normalization); no production workaround and no skipped component.
