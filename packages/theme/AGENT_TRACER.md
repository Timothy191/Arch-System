# Agent Tracer - @repo/theme

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
