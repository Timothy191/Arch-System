# Agent Tracer - @repo/ui

## 2026-08-26 - HeroRotator Side Cards Matched to Center Card

- **Purpose**: Remove 3D angle distortion, tilt, blur, and opacity fade from adjacent side Hero Cards so they visually mirror and match the center Hero Card.
- **Changes**:
  - `packages/ui/src/components/HeroRotator.tsx`:
    - Set `rotateY` to `0` across adjacent offsets (`[-2, -1, 0, 1, 2] -> [0, 0, 0, 0, 0]`).
    - Set `rotateX` to `0` and `z` depth to `0`.
    - Set `imageX` parallax to `0%`.
    - Set `opacity` at offset `[-1, 0, 1]` to `1` (clean, un-dimmed visibility).
    - Set `blurValue` at offset `[-1, 0, 1]` to `0px` (zero blur).
    - Set uniform `scale` at offset `[-1, 0, 1]` to `0.98`.
    - Added inline `// AGENT-TRACE` comments.
- **Verification**:
  - `pnpm --filter @repo/ui type-check` ✅ (0 errors)
  - `pnpm nx test features-hub-ui` ✅ (16/16 tests passed)
- **What the Next Agent Should Know**: Adjacent side slides match the center slide in scale (0.98), opacity (1.0), and 0-degree 3D tilt without blur.

## 2026-08-26 - HeroRotator Middle Card Width Expansion to 70%

- **Purpose**: Extend the horizontal length of the middle active hero card further to 70% while keeping track centering and perspective transforms aligned.
- **Changes**:
  - `packages/ui/src/components/HeroRotator.tsx`:
    - Adjusted `CONFIG.cardWidth` from `60%` to `70%`.
    - Adjusted `CONFIG.cardLeft` from `20%` to `15%` (`(100% - 70%) / 2 = 15%`).
    - Active center card scale retained at `0.98`. Added inline `// AGENT-TRACE` comment.
- **Verification**:
  - `pnpm --filter @repo/ui type-check` ✅ (0 errors)
  - `pnpm nx test features-hub-ui` ✅ (16/16 tests passed)
- **What the Next Agent Should Know**: The HeroRotator active card is 70% track width centered at 15% left offset.

## 2026-08-25 - Workspace Dependency Link

**Purpose**: Declare the package utility dependency used by `ShiftToggle`.

**Changes**: Added `@repo/utils` as a pnpm workspace dependency.

**Handoff**: The UI package now resolves its local utility import through an explicit workspace link. - @repo/ui

## 2026-08-24 - Hub Page Performance: GlassCard, Marquee & aurora-shadow

- **Purpose**: Reduce GPU/compositor load on the hub page — liquid displacement re-runs, 12 continuous marquee layers, and box-shadow animation were saturating the compositor.
- **Changes**:
  - `packages/ui/src/components/GlassCard.tsx`:
    - rAF-coalesced ResizeObserver: drag-resize bursts (dozens of callbacks/sec) now coalesce to at most one displacement-map regeneration per frame.
    - Change-guard on `setSize` — skips re-renders when width/height are unchanged.
    - Canvas DPI cap: `MAX_CANVAS_DIM = 512`, `canvasDPI = Math.min(0.75, MAX_CANVAS_DIM / max(finalWidth, finalHeight))` — bounds the refraction canvas memory/CPU on large cards.
  - `packages/ui/src/components/ui/marquee.tsx`:
    - `repeat` default 4 → 2 (halves the DOM layers per marquee).
    - IntersectionObserver off-screen pause with `rootMargin: "200px"` — off-screen marquees stop animating (inline `animationPlayState: "paused"` wins over the hover class).
    - Added `"use client"` (component uses hooks).
  - `packages/ui/src/globals.css`:
    - `@keyframes aurora-shadow` now animates `opacity` + `transform` (compositor-only) instead of `box-shadow`. The box-shadow is static on the `::after` pseudo-element, painted once.
- **Verification**:
  - `pnpm nx run-many -t type-check --projects=features-hub-ui,@repo/ui,@repo/theme,portal --skip-nx-cache` ✅
  - `pnpm nx run-many -t lint --projects=features-hub-ui,@repo/ui,@repo/theme,portal --skip-nx-cache` ✅
  - `node tools/check-css-performance.cjs` ✅ (9 pre-existing warnings only)
- **What the Next Agent Should Know**: The marquee off-screen pause uses an inline style so it always wins over `group-hover:[animation-play-state:paused]`. The aurora-shadow `::after` keeps a static box-shadow — never move it back into the keyframes (forces a full repaint every frame on the hub page).

## 2026-08-24 - TypeScript Null-Safety & Resize/Intersection Observer Fixes

- **Purpose**: Fix compiler type errors in `GlassCard` and `Marquee` components to guarantee zero build regressions during monorepo type-checking.
- **Changes**:
  - `packages/ui/src/components/GlassCard.tsx`: Stored pending resize state in local non-null const before closure evaluation to satisfy strict `SetStateAction` type check.
  - `packages/ui/src/components/ui/marquee.tsx`: Added null check for `entry` from IntersectionObserver destructured array before accessing `.isIntersecting`.
- **Verification**: `pnpm --filter @repo/ui type-check` ✅ (0 errors).
- **What the Next Agent Should Know**: Strict compiler type checks pass cleanly across all UI library components.

## 2026-08-21 - Hub Page UI: GlassCard Liquid Mode Performance Fix

- **Purpose**: Stop every `GlassCard` from running the expensive liquid-glass displacement engine regardless of variant; only hero cards that explicitly request `variant="liquid"` should pay the cost.
- **Changes**:
  - `packages/ui/src/components/GlassCard.tsx:270`: Replaced hardcoded `const isLiquid = true` with `const isLiquid = variant === "liquid";` so the refraction canvas, SVG filters, ResizeObserver, and blob URLs are only created for liquid variants.
- **Verification**:
  - `pnpm --filter @repo/ui type-check` ✅
  - `pnpm --filter @repo/ui lint` ✅
- **What the Next Agent Should Know**: Default, window, spotlight, and glowborder cards now skip the liquid engine. The portal hub hero remains liquid because it passes `variant="liquid"`; verify other consumers that expected liquid-by-default still look correct.

## 2026-08-21 - Borders & Dividers Industrial Techniques Suite

- **Purpose**: Implement the complete suite of 9 industrial Borders & Dividers design techniques in @repo/theme and @repo/ui.
- **Changes**:
  - `packages/theme/src/css/borders.css`: Created CSS variables and utility classes implementing all 9 techniques (Dotted Border, Dotted Divider, Double Border, Gradient Border, Bevelled Border, Hand-Drawn Border, Patterned Border, Thick Transparent Border, Fading Borders).
  - `packages/theme/src/css/index.css`: Added `@import "./borders.css" layer(components)`.
  - `packages/ui/src/components/Divider.tsx`: Created accessible Divider component supporting default, dotted, fading, double, and dashed variants with horizontal/vertical orientations and center-label support.
  - `packages/ui/src/components/BorderBox.tsx`: Created polymorphic BorderBox component with 9 variants matching theme tokens and liquid glass architecture.
  - `packages/ui/package.json`: Registered `./Divider` and `./BorderBox` exports.
  - `packages/ui/src/components/BorderBox.stories.tsx` & `Divider.stories.tsx`: Created Storybook stories.
  - `apps/portal/components/system/BordersAndDividers.test.tsx`: Implemented 13 unit tests verifying all 9 techniques (100% pass).
  - `docs/UI_Component_UX_Rules.md`: Updated mapping table.
- **Verification**: `pnpm --filter @repo/theme build`, `pnpm --filter @repo/ui type-check`, `pnpm --filter @repo/ui lint`, and `pnpm --filter portal test` passed with 100% success.

## 2026-08-18 - Liqui Design Integration

- **Purpose**: Integrate liqui liquid-glass components into the existing design system without disrupting current theme tokens.
- **Changes**:
  - `components.json`: Added `@liqui-design` registry pointing to `https://liqui.design/r/{name}.json` for shadcn CLI component installation.
  - `package.json`: Added `@liqui-design/glass@^0.2.2` dependency and `@base-ui/react@^1.7.0` (required by liqui components).
  - `package.json`: Registered `./LiquiButton` export for the new liqui button component.
  - `liqui-button.tsx`: Created new liqui-compatible button component using Base UI primitives and LiquiGlass surface with glass/accent/danger variants.
  - `packages/theme/src/css/variables.css`: Added liqui design tokens (--lq-radius, --lq-text, --lq-tint, --lq-accent, etc.) integrated into existing theme structure.
  - Theme build: Ran `pnpm --filter @repo/theme build` to regenerate CSS variables with new liqui tokens.
- **Status**: Integration complete, type-check passes for both @repo/ui and portal packages.
- **Next Steps**: Users can now import and use `LiquiButton` from `@repo/ui/LiquiButton` and install additional liqui components via `npx shadcn@latest add @liqui-design/<component>`.

## 2026-06-25 - Design system shadow token compliance

- **Purpose**: Remove forbidden Tailwind `shadow-*` utilities per DESIGN.md / design-system rules.
- **Changes**:
  - `cyber-button.tsx`: `shadow-md/lg` → `shadow-glow-electric` for blue variant.
  - `sonner.tsx`: `shadow-lg` → `shadow-diffusion-md`.
  - Storybook demos: `shadow-2xl` / `shadow-xl` → `shadow-window` / `shadow-diffusion-lg`.

## 2026-06-25 - Phase 3 CSS cascade layer consolidation

- **Purpose**: Complete Phase 3 `@layer` standard — single consolidated layer blocks and aligned theme package imports.
- **Changes**:
  - `globals.css`: Merged three `@layer components` blocks (skip-link, focus-mode, RevoGrid) into one; merged two `@layer utilities` blocks (z-index/glass + arch-blue) into one.
  - Explicit `@layer reset, base, theme, components, utilities;` declaration retained after theme import.
- **Next Steps**: Portal build + visual QA on focus-mode, RevoGrid tables, glass utilities. Theme `index.css` now assigns Uiverse component CSS to `components` layer (see `@repo/theme` tracer).

## 2026-06-24 - Explicit CSS layer order in globals.css

- **Purpose**: Declare explicit `@layer` cascade order so Tailwind directives and custom layer blocks resolve predictably (reset → base → theme → components → utilities).
- **Changes**:
  - `globals.css`: Inserted `@layer reset, base, theme, components, utilities;` immediately after `@import "@repo/theme/css"` and before `@tailwind` directives.
  - Step 2 audit: Moved `:root` brand token definitions into `@layer base` (merged with `.hide-cursor`). Moved RevoGrid grid-line overrides into `@layer components` (retains `!important` for third-party specificity).
- **Next Steps**: Run portal build + manual QA on buttons, modals, cards, focus-mode overrides. If utilities unexpectedly override `@layer components` rules, consider migrating to `@import 'tailwindcss/*' layer(...)` syntax.

## 2026-06-24 - Concentric Animated Loader Component

- **Purpose**: Create and export the Uiverse concentric animated loader component for global use across the system.
- **Changes**:
  - `loader.tsx`: Implemented `<Loader>` component rendering the SVG concentric circles with sizing, accessibility, and class forwarding support.
  - `package.json`: Registered `./Loader` in the package exports section to allow clean imports.
- **Next Steps**: Verification complete, all compilation, linting, and quality checks pass cleanly.

## 2026-06-24 - Uiverse Tabs integration for ShiftToggle

- **Purpose**: Refactor ShiftToggle to use Uiverse circular tabs styling as the visual design foundation.
- **Changes**:
  - `ShiftToggle.tsx`: Refactored to use standard HTML radio inputs and labels inside a `.cir-tabs` container. This integrates natively with the Uiverse CSS selectors and ensures keyboard accessibility.
- **Next Steps**: Verification complete, all tests and linters pass cleanly.

## 2026-06-24 - Uiverse Button Foundation integration

- **Purpose**: Refactor UI button components to use the Uiverse button style as the global action button foundation.
- **Changes**:
  - `button.tsx`: Refactored primary `default` variant. If no custom background class (`bg-` or `bg-[`) is supplied, automatically wrap the button children in the Uiverse `.blob1` and `.inner` markup, mapping `size` props to the Uiverse size classes.
  - `animated-button.tsx`: Refactored `default`/`accent` variants similarly, applying Uiverse wrappers and size classes while preserving custom Framer Motion scale and hover/tap options.
- **Next Steps**: Verification complete, all tests and linters pass cleanly.

## 2026-06-20 - Deprecated Accent Token Migration

- **Purpose**: Migrate all usages of deprecated accent color tokens to canonical equivalents in the UI package components and stories.
- **Changes**:
  - `GlassCard.tsx`: Replaced deprecated `accent-indigo` and `accent-violet` with `accent-blue` in custom color palette
  - `animated-button.tsx`: Migrated button variant colors - `accent` and `destructive` variants now use canonical tokens
  - `hero-video-dialog.tsx`: Updated play button overlay colors
  - `bento-grid.tsx`: Updated CTA link colors
  - `motion-primitives/spotlight.stories.tsx`: Updated spotlight gradient colors
  - `ui/marquee.stories.tsx`: Updated logo animation colors
  - `ui/Card.stories.tsx`: Updated metric display color
- **Token Migration Summary**:
  - `--accent-cyan` → `--accent-blue`
  - `--accent-indigo` → `--accent-blue`
  - `--accent-violet` → `--accent-blue`
  - `--accent-alert` → `--accent-red`
- **Status**: All deprecated tokens migrated, no visual changes expected
- **Next Steps**: None

## 2026-06-16 - Add WhatsApp Web Shortcuts to MacMenuBar

- **Purpose**: Add WhatsApp Web shortcuts inside the top navigation bar and system dropdown menu of `MacMenuBar.tsx`.
- **Changes**:
  - Updated the taskbar WhatsApp circular button to trigger `window.open` pointing to `https://web.whatsapp.com` with a 400px-wide popup configuration docked to the right edge of the screen.
  - Inserted a "Split View" section between "Tools" and "Automation" in the system dropdown menu.
  - Added a `<DropdownMenuItem asChild>` button for "New Split Tab" pointing to WhatsApp Web via the same right-docked popup window configuration to bypass iframe security sandbox policies (`X-Frame-Options: DENY`).
- **Status**: Completed successfully, bypasses iframe limitations with a right-aligned window layout.
- **Next Steps**: None.

## 2026-06-16 - Arch Menu Bar Logo Rebranding

- **Purpose**: Final system-wide rebranding by replacing legacy Plantcor header logo bitmap files with the official vector `<Logo />` component in the `MacMenuBar` component.
- **Changes**:
  - Modified `src/components/MacMenuBar.tsx` to import and render the SVG vector `<Logo className="w-7 h-7 text-[var(--accent-blue)]" />` inside the system menu dropdown button trigger.
  - Removed obsolete Plantcor bitmap images from `apps/portal/public/` (`plantcor-header.png`, `plantcor-header-dark.png`, `plantcor.png`).
- **Status**: Visual branding migration completed successfully, quality checks passing.
- **Next Steps**: None.

## 2026-06-16 - Logo Vectorization Refactoring

- **Purpose**: Rewrite the `Logo` component to output the official Arch symbol SVG path instead of rendering legacy image files.
- **Changes**:
  - Replaced the implementation of `src/components/Logo.tsx` with the raw vector paths of the official symbol-only SVG (`logo.svg`).
  - Set color mapping to support Tailwind styles using `fill-current`.
- **Status**: Completed vector logo refactoring.

## 2026-06-16 - Arch Vector Logo Engineering & Sidebar Migration

- **Purpose**: Standardize Arch branding using a high-fidelity vector `<Logo />` component, migrating the sidebar in `DepartmentLayout.tsx` off legacy bitmap assets.
- **Changes**:
  - Created `src/components/Logo.tsx` rendering the official Arch Linux scalable symbol, supporting dynamic `variant="default" | "focus"` states, and automatically integrating with the `useFocusMode()` hook.
  - Added export configuration for `Logo` in `package.json` exports as `"./Logo": "./src/components/Logo.tsx"`.
  - Refactored `src/components/DepartmentLayout.tsx` to replace the legacy `logo.png`/`logo-focused.jpeg` `img` tags with `<Logo className="w-4 h-4 opacity-60 mr-2" />`.
- **Status**: Completed vector logo creation and sidebar migration.
- **Next Steps**: None.

## 2026-06-16 - Plantcor Logo Implementation in MacMenuBar

- **Purpose**: Replace system logo with Plantcor logo for brand recognition in the portal header. Remove old company branding.
- **Changes**:
  - Updated `src/components/MacMenuBar.tsx` system logo button
  - Replaced `/logo.png` and `/logo-focused.jpeg` with Plantcor variants
  - Now uses `/plantcor-header.png` for normal mode
  - Now uses `/plantcor-header-dark.png` for focus mode (dark variant)
  - Updated sizing from `w-6 h-6` to `h-9 w-auto` (36px height, auto width) for better visibility
  - Alt text changed from "Arch Logo" to "Plantcor Logo"
  - **Removed** company branding image (`/company-branding.jpeg`) from navbar
- **Status**: Logo implemented in header with focus mode dark variant support. Old branding removed.
- **Next Steps**: None (logo implementation complete)

## 2026-06-16 - Global Theme and Background Unification

- **Purpose**: Eliminate background styling inconsistencies by consolidating all implementations around design tokens.
- **Changes**:
  - Simplified focus mode overrides in `src/globals.css`
  - Removed component-specific color overrides for bg-white/xx and bg-black/[0.xx] patterns
  - Added overlay token overrides to focus mode block (overlay-dim, overlay-subtle, overlay-medium)
  - Focus mode now operates entirely through token overrides instead of class-specific patterns
  - Removed ~40 lines of redundant CSS overrides
- **Status**: Focus mode complexity reduced; all components now use semantic tokens
- **Next Steps**: None (focus mode simplification complete)

## 2026-06-15 14:30:00 - Storybook Setup

- **Purpose**: UX/UI Design phase initiation.
- **Changes**:
  - Installed Storybook v8.6.14 at workspace root.
  - Generated Storybook configuration for `@repo/ui` using Nx.
  - Integrated Tailwind CSS and OKLCH theme via `packages/ui/src/globals.css`.
  - Created sample story for `KPICard` at `packages/ui/src/components/KPI.stories.tsx`.
- **Status**: Build verified with `pnpm nx run @repo/ui:build-storybook`.
- **Next Steps**:
  - Inventory remaining components in `packages/ui/src/components`.
  - Create stories for `GlassCard`, `DataGrid`, `WorkflowBuilder`, etc.
  - Integrate `axe-core` for automated a11y checks.

## 2026-06-16 - Focus Mode Interaction Refinement

- **Purpose**: Enhance workspace state transitions.
- **Changes**:
  - Added `framer-motion` transition to `MacMenuBar.tsx`.
  - Implemented subtle scale (0.99), opacity (0.85), and vertical shift (-2px) when `isFocusMode` is active.
- **Status**: Smooth state transitions verified; respects `useFocusMode` hook.
- **Next Steps**: Apply similar motion patterns to other high-level HUD elements.

## 2026-06-16 - Resolve Duplicate Exports

- **Purpose**: Fix IDE static analysis warnings about duplicate default/named exports.
- **Changes**:
  - Removed `export default` from `FlowEdge.tsx`, `PluginNode.tsx`, `TriggerNode.tsx`, and `WorkflowBuilder.tsx` to keep only clean named exports which are the exclusive pattern used for these components.
- **Status**: Completed duplicate export cleanup.

## 2026-06-16 - MacMenuBar: Add access-card-actions Dept + Migrate to Dept Theme Tokens

- **Purpose**: Add new `access-card-actions` department entry to `MacMenuBar.tsx` and migrate all hardcoded Tailwind color classes to `dept-*` theme tokens.
- **Changes**:
  - Added `CreditCard` to lucide-react imports.
  - Inserted `access-card-actions` department entry between `access-control` and `engineering` in `DEPARTMENTS_LIST`.
  - Replaced all hardcoded `iconColor` and `bgColor` values in `DEPARTMENTS_LIST` with `dept-*` tokens (drilling, production, access-control, access-card-actions, engineering, control-room, safety, training, satellite).
  - Replaced hardcoded color classes in `PRODUCTIVITY_LIST` with `dept-*` tokens.
  - Replaced Admin Panel hover/bg/icon colors with `dept-admin` tokens.
  - Changed WhatsApp split view SVG icon to `text-dept-engineering`.
  - Changed GitHub workspace SVG icon to `text-dept-drilling`.
- **Status**: Completed, type-check passes with 0 errors.
- **Next Steps**: None.

## 2026-06-16 - Replace Hardcoded Color Cascade with Dept Theme Tokens

- **Purpose**: Replace fragile hardcoded Tailwind utility class cascade for department icon colors with dynamic lookup using `--dept-*` CSS variables.
- **Changes**:
  - Replaced 7-condition color cascade (3x `blue`, 1x each `emerald`, `violet`, `red`, `cyan`, `indigo`) in `DepartmentLayout.tsx` with 6 dedupled conditions mapping to `bg-dept-{drilling,production,engineering,control-room,training,satellite}/10 text-dept-{...}` classes.
- **Status**: Completed, type-check and lint pass with 0 errors.

## 2026-06-16 — Phase 2 & 3: Accessibility (Focus/Button types) + Token cleanup

- **Purpose**: Apply keyboard accessibility fixes, add missing `type="button"` to all buttons, and replace `rounded-2xl` with design token `rounded-xl`.
- **Changes**:
  - **Phase 2.1 — GlassCard keyboard accessibility**: Added `tabIndex={0}` (interactive), `role="button"` (when onClick present), `onKeyDown` handler (Enter/Space triggers onClick), and `focus-visible:ring-2 focus-visible:ring-[var(--accent-blue)]` class when hover+onClick. Supports caller overrides via destructured `tabIndex`, `role`, `onKeyDown` props.

## 2026-08-21 - Accessibility Enhancements

- **Focus ring added to `SecondaryButton`** – Updated Tailwind class list to include `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-blue)] focus-visible:ring-offset-2` for clear keyboard focus.
  - **`aria‑busy` added to `SubmitButton`** – Provides screen‑reader feedback while the button is in a loading state.
  - Both changes are covered by a single commit and validated through the full `pnpm quality` gate (all UI linting passes).

## 2026-08-22 - UX Design Laws Added

Added a new repository‑wide `docs/UX_Design_Rules.md` file that documents 18 core UX principles (Jakob's Law, Hick's Law, Fitts's Law, …). Updated the UI package README to reference this guide so new contributors see the design intent up‑front.

- **Phase 2.2 — MacTitleBar.tsx**: Added `type="button"` to all 3 traffic light buttons (close/minimize/maximize).
- **Phase 2.3 — dock.tsx**: No `<button>` elements exist; no changes needed.
- **Phase 2.4 — animated-dialog.tsx**: Added `type="button"` to close button.
- **Phase 2.5 — hero-video-dialog.tsx**: Added `type="button"` to `<motion.button>` close button.
- **Phase 2.6 — Global button audit**: Added `type="button"` to all `<button>` elements missing it across: `AcknowledgeButton.tsx`, `WorkflowBuilder.tsx` (3 buttons), `freeze-toggle.tsx`, `PluginNode.tsx`, `MacMenuBar.tsx` (fallback nav button), `MacTitleBar.stories.tsx` (2 buttons). Skipped `<DropdownMenuTrigger asChild>` wrapped buttons as they inherit type from the trigger component.
- **Phase 3.1 — Token replacement**: Replaced all `rounded-2xl` instances with `rounded-xl` (design system token) in `animated-dialog.tsx`, `dock.tsx`, `hero-video-dialog.tsx` (3 instances), and `spotlight.stories.tsx`.
- **Status**: All type checks pass (`@repo/ui` and `portal`). Focus-visible rings visible on interactive GlassCards via keyboard navigation.
- **Next Steps**: None.

## 2026-06-16 — Fix deprecated token references in 3 UI components

- **Purpose**: Replace broken/Deprecated CSS variable references and hardcoded shadow values with canonical theme tokens.
- **Changes**:
  - `freeze-toggle.tsx`: Removed broken `shadow-[0_0_12px_rgba(var(--accent-blue-rgb),0.2)]` (referenced non-existent `--accent-blue-rgb` var) — frozen state already visually distinctive via accent classes.
  - `telemetry-chart.tsx`: Replaced hardcoded hex `#3ecf8e` default with CSS variable `var(--accent-green)` for recharts SVG usage.
  - `cyber-button.tsx`: Replaced deprecated `--accent-cyan`, `--accent-blue`, `--accent-alert` with canonical `--accent-mint`, `--accent-electric-blue`, `--accent-red`; replaced hardcoded rgba shadows with `shadow-glow-mint`, `shadow-glow-electric`, and `shadow-md`/`shadow-lg` utilities.
- **Status**: Completed, type-check and lint pass with 0 new errors.

- **2026-06-17T11:52:06Z**: Added CookieConsent component.

## 2026-06-24 - Resolve Unused ESLint Warnings

- **Purpose**: Clean up unused imports and variables flagged in pre-commit lint gates.
- **Changes**:
  - Removed unused `cn` import in `src/components/CookieConsent.tsx`.
  - Removed unused `useFocusMode` hook import and `isFocusMode` local variable declaration in `src/components/DepartmentLayout.tsx`.
  - Removed unused `DialogClose` import in `src/components/ui/Dialog.stories.tsx`.
  - Removed unused `LifeBuoy` import in `src/components/ui/DropdownMenu.stories.tsx`.
- **Status**: Lint warnings resolved, pre-commit checks passing.
- **Next Steps**: None.

## 2026-08-19 - Standardize Liquid Glass effect globally

- **Purpose**: Comply with user request to make all panels, windows, and cards use the Liquid Glass effect with uniform transparency.
- **Changes**:
  - `GlassCard.tsx`: Hardcoded `isLiquid = true` for all variants, forcing the refraction SVGs and liquid styling on all GlassCard instances globally.
  - Standardized liquid background transparency by applying a fixed opacity (`backgroundOpacity ?? 0.08`) across the board instead of relying on individual component overrides.
  - Consolidated and simplified the classNames logic to inject liquid styling unconditionally.
- **Status**: Completed. All GlassCards across the workspace now render with the Liquid Glass effect.

## 2026-08-19 - Fix Marquee Animations & Refactor HeroRotator

- **Purpose**: Fix the issue where Marquee cards ("Operational feedback & Department Logs") were static, and transition the HeroRotator to use the moving Marquee banner.
- **Changes**:
  - `packages/ui/src/components/ui/marquee.tsx`: Fixed Tailwind v4 `gap-(--gap)` syntax to v3 `gap-[var(--gap)]` so the styling is correctly applied.
  - `packages/theme/src/tailwind/preset.ts`: Added `marquee` and `marquee-vertical` keyframes and animations directly to the tailwind preset, bypassing the `@theme inline` block from `globals.css` which was being ignored by Tailwind v3.
  - `libs/features/hub/ui/src/HeroRotator.tsx`: Refactored from a snappy `setInterval` slider to a continuous `Marquee` component, providing a smooth moving banner for the hero section as requested by the user.
- **Status**: Completed. All Marquee banners are now smoothly animating.
