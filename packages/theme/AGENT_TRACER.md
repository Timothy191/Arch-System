# Agent Tracer - @repo/theme

## 2026-08-26 - Fluid Typography CSS Clamp() Token Integration

- **Purpose**: Implement fluid typography scaling via CSS `clamp()` in Tailwind preset according to responsive design constraints.
- **Changes**:
  - `packages/theme/src/tailwind/preset.ts`: Added `fluid-2xs` through `fluid-6xl` font size tokens utilizing dynamic viewport calculation and `clamp()` boundaries for smooth mobile to ultra-wide scaling.
- **Verification**:
  - `pnpm nx run @repo/theme:lint` / type-check.
- **Next Steps**: Components across apps/portal and packages/ui can now use `text-fluid-*` classes for seamless responsive scaling without abrupt media-query jumps.

## 2026-08-24 - Hub Page Performance: Grain Overlay & Focus Background

- **Purpose**: Stop the full-screen grain overlay from repainting every frame and point the focus-mode background at the downscaled poster.
- **Changes**:
  - `packages/theme/src/css/glass.css`:
    - `grain-dance` keyframes now animate `transform: translate3d()` only (compositor-friendly) instead of `background-position` (forces a repaint of the full-screen grain layer every frame).
    - `.route-bg-grain` oversized to `inset: -24px` so the translate3d drift never reveals edges.
    - Reduced-motion block now includes `.route-bg-grain` (animation disabled for `prefers-reduced-motion`).
    - `.route-bg-focus` background-image updated to `/background/macos-27-golden-2560x1764.png` (downscaled poster, 7MB → ~1.5MB).
- **Verification**:
  - `pnpm nx run @repo/theme:lint:css --skip-nx-cache` ✅
  - `pnpm nx run @repo/theme:lint:tokens --skip-nx-cache` ✅ (278 tokens, 161 references)
  - `node tools/check-css-performance.cjs` ✅ (9 pre-existing warnings only)
- **What the Next Agent Should Know**: The grain layer is a full-viewport element — any non-compositor animation on it repaints the whole screen. Keep `grain-dance` transform-only.

## 2026-08-18 - Liqui Design Token Integration

- **Purpose**: Add liqui design system CSS variables to support liquid-glass components without disrupting existing theme structure.
- **Changes**:
  - `src/css/variables.css`: Added liqui design tokens section with light mode variables (--lq-radius, --lq-text, --lq-text-dim, --lq-tint, --lq-tint-deep, --lq-rim-hi, --lq-rim-lo, --lq-highlight, --lq-accent, --lq-danger, --lq-danger-text, --lq-scrim).
  - Included commented dark mode liqui tokens for future reference (system is currently light-only).
  - Integrated tokens into existing theme structure under "LIQUI DESIGN TOKENS" section.
  - Ran theme build to regenerate CSS variables and TypeScript token maps.
- **Status**: Integration complete, liqui tokens available for use in components.
- **Next Steps**: Components can now reference liqui design tokens for glass effects and component styling.

## 2026-08-17 - Style Dictionary Prettier Post-Hook

- **Purpose**: Prevent cosmetic formatting drift across generated theme files (`variables-generated.css`, `generated-sd.ts`, `tokens-hsl.json`).
- **Changes**:
  - `sd.config.mjs`: Added Prettier post-formatting loop targeting all output destinations after `sd.buildAllPlatforms()`.
- **Verification**: Verified running `pnpm --filter @repo/theme codegen` runs cleanly with 0 git diff against canonical HEAD.

## 2026-06-25 - Follow-up alignment (codegen HSL, accent-charcoal, theme provider)

- **Purpose**: Complete alignment audit follow-ups — auto HSL sync, canonical accent naming, remove next-themes, Outfit font.
- **Changes**:
  - `scripts/generate-tokens.mjs`: Emits `tokens.hsl` + `tokens.primitives` from `variables.css`; `colors.ts` re-exports `hsl` from generated.
  - `variables.css`: Added `--accent-charcoal` (canonical); `--accent-blue` deprecated alias → `arch13`; `--font-outfit` fallback stack.
  - `preset.ts`: `accent-charcoal` utility; fixed stale arch.accent comments.
  - `react/theme-provider.tsx`: Removed `next-themes`; light-only `data-theme` + `useTheme` stub.
  - `package.json`: Removed `next-themes` dependency.
  - `tokens.json`, `DECISIONS.md` (008), `DESIGN.md` shadow/typography docs updated.
- **Next agent**: Prefer `--accent-charcoal` / `colors.accent.charcoal` in new code; run `pnpm --filter @repo/theme build` after palette edits.

## 2026-06-25 - Token alignment remediation (colors.ts + CSS drift)

- **Purpose**: Resolve misalignment between `colors.ts`, `variables.css`, and `tokens.json` after brand charcoal refresh.
- **Changes**:
  - `src/tokens/colors.ts`: Synced `arch0`–`arch15`, deprecated accent exports, and shadcn HSL block to match `variables.css` / `tokens.json`.
  - `src/css/variables.css`: `--danger` → `var(--arch12)`; `--destructive` / `--chart-4` → `#d22118` HSL; fixed `--shadow-glow-electric-blue` (was red RGBA typo).
  - `tokens.json`: `danger`, `destructive`, `chart-4` aligned to arch12 contrast values.
  - `src/tokens/shadows.ts`: Glow shadows updated to charcoal RGBA (matches CSS).
- **SSoT**: Semantic tokens in `variables.css`; primitives in `tokens.json` for Style Dictionary; `colors.ts` must be updated when arch palette changes (codegen for arch block planned).
- **Next agent**: Run `pnpm --filter @repo/theme build && lint:tokens` after any palette edit; consider extending `generate-tokens.mjs` to emit arch constants from CSS.

- **Purpose**: Map theme CSS imports to the canonical cascade layers declared in `@repo/ui/globals.css`.
- **Changes**:
  - `src/css/index.css`: `reset.css` → `layer(reset)`; Uiverse component sheets (`buttons`, `tabs`, `loaders`, `checks`, `cards`) → `layer(components)`; token/animation/glass/focus sheets remain in `layer(theme)`.
- **Next Steps**: Run `pnpm --filter @repo/theme lint:css` and portal build to confirm no cascade regressions.

## 2026-06-24 - Uiverse Concentric Animated Loader Integration

- **Purpose**: Integrate the Uiverse concentric animated loader (by Nawsome) as the core spinner styling.
- **Changes**:
  - `packages/theme/src/css/variables.css`: Declared tokenized stroke color variables (`--loader-ring-a` to `--loader-ring-d`) for the concentric loader rings.
  - `packages/theme/src/css/loaders.css`: Created a stylesheet implementing `.loader-pl` and `.loader-pl-ring` selectors conforming to Stylelint rules and percentage-based keyframes.
  - `packages/theme/src/css/index.css`: Imported the new `loaders.css` stylesheet in the `theme` layer.
  - `packages/theme/.stylelintrc.mjs`: Added `src/css/loaders.css` to overrides to guarantee design token compliance.
- **Next Steps**: Rebuild theme to sync generated typescript token maps.

## 2026-06-24 - Uiverse Circular Tabs / Segmented Control integration

- **Purpose**: Integrate the Uiverse circular tabs style (by uiverse-astronaut) as the visual design foundation for ShiftToggle and segmented tab components.
- **Changes**:
  - `packages/theme/src/css/variables.css`: Declared tokenized background, border, text color, and active shadow variables for the circular tabs.
  - `packages/theme/src/css/tabs.css`: Created a stylesheet implementing `.cir-tabs`, `.cir-tabs-r`, and `.cir-tabs-t` selectors conforming to Stylelint patterns.
  - `packages/theme/src/css/index.css`: Imported the new `tabs.css` stylesheet in the `theme` layer.
  - `packages/theme/.stylelintrc.mjs`: Added `src/css/tabs.css` to overrides to guarantee design token compliance.
- **Next Steps**: Rebuild theme to sync generated typescript token maps.

## 2026-06-24 - Global Uiverse Button Foundation integration

- **Purpose**: Integrate the Uiverse button style (by Spacious74) as the global button foundation.
- **Changes**:
  - `packages/theme/src/css/variables.css`: Declared tokenized background, shadow, and color variables for the Uiverse button.
  - `packages/theme/src/css/buttons.css`: Created a new stylesheet implementing Uiverse button geometry, glowing shadow effects, and size overrides.
  - `packages/theme/src/css/index.css`: Imported the new `buttons.css` stylesheet in the `theme` layer.
  - `packages/theme/.stylelintrc.mjs`: Added `src/css/buttons.css` to overrides to guarantee design token compliance.
- **Next Steps**: Already built the theme to sync generated typescript token maps.

## 2026-06-18 - Background Tint Overlay z-index Layering Fix

- **Purpose**: Fix visual layering issue where `.route-bg-tint` overlay was incorrectly positioned at `z-index: 0`, causing potential interference with foreground content and interactive elements.
- **Root Cause**: The tint overlay had `z-index: 0` (default stacking level) instead of the documented `z-index: -9`. This placed it at the same level as normal content, risking overlap issues with components lacking explicit z-indexes.
- **Changes**:
  - `packages/theme/src/css/glass.css`: Changed `.route-bg-tint` from `z-index: 0` to `z-index: -9` (line 1060)
  - This aligns with the existing comment that states the tint should "sit at z-index -9 (one above the video/fallback)"
  - Corrected layer stack: videos at -10, tint/focus-scrim at -9, grain at -8, content at 30+
- **Impact**: Resolves potential layering conflicts where interactive elements could be covered by the semi-transparent tint, and ensures the tint stays in the background decoration layer where it belongs.
- **Status**: Layering fix applied, matches documented intent.
- **Next Steps**: None.

## 2026-06-17 - Root Stylelint and Token Guard Implementation

- **Purpose**: Implement strict Stylelint rules at the workspace root to prevent raw color bypasses of the theme tokens.
- **Changes**:
  - Installed `stylelint-declaration-strict-value` and `stylelint-config-standard` at root.
  - Created root `stylelint.config.mjs` config to block hardcoded colors (hex, rgb, hsl) while permitting CSS custom properties (`var(--color-*)`) and common keywords.
  - Linked stylelint to the quality checking scripts.
- **Status**: Completed root-level Stylelint guarding.

## 2026-06-20 - Deprecated Accent Token Cleanup

- **Purpose**: Remove deprecated accent color tokens that were replaced by canonical equivalents as part of the style cleanup initiative. This eliminates technical debt and ensures all components use the standardized color palette.
- **Changes**:
  - Removed deprecated token definitions from `variables.css`: `--accent-cyan`, `--accent-indigo`, `--accent-violet`, `--accent-alert`, `--accent-emerald`
  - These were mapped to canonical tokens: `--accent-blue` and `--accent-green`
  - Updated deprecation notice to document the migration completion
  - Cleaned up `variables-generated.css` to remove deprecated token definitions
  - Migrated component usage across the codebase (portal apps, UI package, overview app)
  - Updated `GlassCard.tsx` custom color palette to use canonical tokens
- **Token Migration Summary**:
  - `--accent-cyan` → `--accent-blue`
  - `--accent-indigo` → `--accent-blue`
  - `--accent-violet` → `--accent-blue`
  - `--accent-alert` → `--accent-red`
  - `--accent-emerald` → `--accent-green`
- **Status**: Cleanup complete, all deprecated tokens removed and migrated
- **Next Steps**: Next theme build will regenerate variables-generated.css from tokens.json

## 2026-06-16 - macOS-Inspired Light Mode Implementation

- **Purpose**: Implement a macOS-inspired light mode with white branding and liquid glass effects.
- **Changes**:
  - `packages/theme/tokens.json`: Updated `arch0` to `#ffffff` (pure white) and modified `glass.border-gradient` for a brighter, more distinct reflection.
  - `packages/theme/src/css/glass.css`: Changed `.route-bg-tint` background to a bright, semi-transparent white wash (`rgba(255, 255, 255, 0.5)`) to ensure the ambient background video retains dynamic motion while the canvas feels white and airy.
  - Ran `pnpm --filter @repo/theme build` to regenerate theme variables.
- **Status**: Completed visual update to pure white light mode.
- **Next Steps**: None.

## 2026-06-16 - Asset Audit and Missing Asset Resolution

- **Purpose**: Fix a missing asset reference found during the cross-app asset audit.
- **Changes**:
  - `packages/theme/src/css/glass.css`: Replaced missing `/focused-bg.jpeg` fallback image reference with `/auth-bg-poster.jpg`.
- **Status**: Audit completed and missing asset reference resolved.

## 2026-06-16 - Commit generated token files

- **Purpose**: Regenerate and commit design tokens, CSS variables, and TS maps to synchronize theme changes across the workspace.
- **Changes**:
  - Re-ran Style Dictionary and token generation scripts.
  - Updated `packages/theme/src/css/variables-generated.css` and `packages/theme/src/tokens/generated.ts` with latest definitions (e.g. `--arch12` to `#d22118` and `shadow.lg` definition).
- **Status**: Token files generated and committed.

## 2026-06-16 - Applied Background Video Depth Layering

- **Purpose**: Increase visual separation between background video and content for improved hierarchy.
- **Changes**:
  - `packages/theme/src/css/glass.css`: Reduced `.route-bg-video` and `.route-bg-focus-video` opacity to 0.6 and brightness to 0.7.
  - Modified `.route-bg-tint` background to `rgba(10, 10, 30, 0.5)` and set `z-index: 0`.
  - Added `z-index: 10` and `backdrop-filter: blur(16px)` to `.glass-card`.
  - Added `z-index: 20` and a text-shadow to `.glass-input`.
- **Status**: Completed visual layering implementation.
- **Next Steps**: None.

## 2026-06-20 - Video Background Container Fix (inset: 0)

- **Purpose**: Fix video background gaps caused by viewport unit dimensions not accounting for scrollbar width.
- **Root Cause**: The previous implementation used `width: 100vw; height: 100vh; height: 100dvh;` which could create gaps when scrollbars appear/disappear because viewport units don't account for scrollbar width.
- **Changes**:
  - Changed `.route-bg-video-container` and `.route-bg-focus-video-container` from `top: 0; left: 0; width: 100vw; height: 100vh; height: 100dvh;` to `inset: 0; width: 100%; height: 100%;`
  - Updated comment to explain the new approach using `inset: 0` which accounts for scrollbar width
  - Removed the viewport height fallback chain comment since `inset: 0` with percentage sizing handles browser compatibility reliably
- **Why This Works**:
  - `inset: 0` is the modern CSS shorthand that sets all four position properties in one declaration
  - Unlike `100vw`/`100vh`, `inset: 0` accounts for the actual viewport dimensions including scrollbar width
  - Using `width: 100%; height: 100%` on the container ensures it fills the fixed-positioned inset area
  - The video elements already had percentage sizing with `object-fit: cover` - no changes needed
- **Status**: CSS linting passed
- **Next Steps**: None

---

## 2026-06-16 - Clean up duplicate CSS variables and undefined primitives

- **Purpose**: Clean up stylelint validation failure caused by duplicate custom property declarations.
- **Changes**:
  - Removed duplicate declarations of `--color-action-primary`, `--color-action-primary-hover`, `--color-status-positive`, `--color-status-warning`, and `--color-status-danger` from `packages/theme/src/css/variables.css`.
  - Replaced undefined/invalid primitives (`--arch16`, `--arch17`, `--arch18`) with correct design tokens.
  - Re-mapped `--color-accent-subtle` to its correct token `var(--accent-electric-blue-subtle)`.
- **Status**: stylelint checks passed successfully.

## 2026-06-16 - Video Background Mobile Viewport Height Fix (Critical Correction)

- **Purpose**: Fix critical oversight where `min-height: 100vh` was undermining the `100dvh` fix by forcing overflow when mobile toolbar is visible.
- **Root Cause**:
  - When mobile toolbar is visible, `100dvh` shrinks to ~750px while `100vh` remains at ~900px
  - `min-height: 100vh` forced container to be taller than the visible viewport
  - Result: overflow/scroll issues - exactly what the fix was trying to prevent
- **Changes**:
  - **Removed `min-height: 100vh`** from `.route-bg-video-container` and `.route-bg-focus-video-container`
  - Updated comment to explain that no min-height is needed
  - Modern browsers handle `100vh` → `100dvh` fallback reliably
  - Older browsers ignore `dvh` and safely use `100vh`
- **Why This Works**:
  - The simple fallback `height: 100vh; height: 100dvh;` is sufficient for all browsers
  - No safety net needed - the fallback chain handles cross-browser compatibility
  - Alternative would have been `min-height: 100svh`, but removed entirely is cleaner
- **Status**: CSS linting passed
- **Next Steps**: None

## 2026-06-16 - Video Background Window Resizing Fix (Container Pattern + Mobile Support)

- **Purpose**: Fix video background not resizing when browser window is resized from fullscreen to half-screen using the recommended container pattern, with added mobile browser support.
- **Changes**:
  - **CSS Architecture**: Separated container sizing from video sizing for cross-browser reliability
  - **Added Container Classes**: `.route-bg-video-container` and `.route-bg-focus-video-container`
    - Use `position: fixed; width: 100vw; height: 100vh; height: 100dvh; overflow: hidden`
    - Viewport height fallback: `100vh` (standard) → `100dvh` (dynamic for mobile toolbars)
    - Provides reliable cross-browser resize behavior independent of parent element sizing
  - **Updated Video Classes**: `.route-bg-video` and `.route-bg-focus-video`
    - Changed to `width: 100%; height: 100%; object-fit: cover` (relative to container)
    - Removed viewport units from video elements (now in containers)
    - Kept `will-change: transform` and GPU optimization properties
  - **Updated Visibility Rules**: Changed focus-mode toggle to target containers instead of videos
  - **Updated Low-Perf Fallback**: Changed `.low-perf-fallback .route-bg-video` to target container
- **Why This Works**:
  - Viewport units (`100vw`/`100vh`) are always relative to the viewport, not parent elements
  - `100dvh` accounts for mobile dynamic toolbars (URL bar appearing/disappearing)
  - Container pattern ensures reliable cross-browser resize behavior without depending on parent sizing chains
- **Status**: CSS linting passed
- **Note**: Subsequently corrected to remove `min-height: 100vh` which was causing mobile overflow (see entry above)

## 2026-06-16 - Global Theme and Background Unification

- **Purpose**: Add semantic overlay tokens and remove deprecated token aliases.
- **Changes**:
  - Added overlay tokens to `tokens.json`:
    - `overlay-dim`: rgba(0, 0, 0, 0.02)
    - `overlay-subtle`: rgba(0, 0, 0, 0.04)
    - `overlay-medium`: rgba(0, 0, 0, 0.06)
  - Added overlay tokens to `src/tailwind/preset.ts` for Tailwind utility classes
  - Regenerated theme tokens via `pnpm codegen` (updates CSS variables and TypeScript types)
  - Removed deprecated token aliases from `tokens.json`:
    - `accent-cyan`, `accent-indigo`, `accent-violet` (all mapped to accent-blue)
    - `accent-alert` (mapped to accent-red)
  - Removed deprecated Tailwind aliases from `src/tailwind/preset.ts`
- **Status**: Token validation passed (220 tokens, 132 references, all clean)
- **Next Steps**: None (deprecated tokens removed)

## 2026-06-16 - Performance & UX Refinements

- **Purpose**: Optimize background performance and enhance Liquid Glass aesthetic.
- **Changes**:
  - Swapped CPU-intensive SVG fractal noise for lightweight PNG base64 grain texture in `.liquid-grain-overlay` and `.route-bg-grain`.
  - Refined `var(--liquid-glass-saturate)` to 160% for optimal frost/clarity balance.
  - Added `liquid-bg-shift` keyframes and `.animate-liquid-bg` utility for subtle atmospheric breathing.
- **Status**: Verified CSS compilation and visual alignment with macOS Sonoma spec.
- **Next Steps**: Monitor performance on low-power mobile devices.

## 2026-06-16 - Resolve Duplicate Exports

- **Purpose**: Clean up duplicate and redundant aliases that cause IDE inspection errors.
- **Changes**:
  - Replaced direct assignments in `colors.ts` and `motion.ts` with shallow destructuring/clones or literal values to avoid AST conflicts.
- **Status**: Completed theme token duplicate export resolutions.

## 2026-06-16 — Register shadow-glow-mint Tailwind utility

- **Purpose**: Register `shadow-glow-mint` Tailwind utility so the `@repo/ui` `cyber-button.tsx` component can use it.
- **Changes**:
  - Added `"glow-mint": "var(--shadow-glow-mint)"` to the `boxShadow` section of `preset.ts`.
  - The CSS variable `--shadow-glow-mint` was already defined in `variables.css` (line 106-107) but lacked a Tailwind utility mapping.
- **Status**: Completed, type-check passes.

## 2026-08-19 - Fix Token Drift Error in Validation Script

- **Purpose**: Fix the `pnpm lint:tokens` "token drift" error introduced by adding Marquee animation keyframes.
- **Changes**: Added `--gap` and `--duration` to `VENDOR_TOKENS` ignore list in `packages/theme/scripts/validate-tokens.mjs`. These are dynamic inline CSS variables used for Marquee animations, not global design tokens, and thus should not be flagged when referenced in `preset.ts`.
- **Status**: Completed. Token validation passing successfully.
