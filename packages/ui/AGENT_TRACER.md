# Agent Tracer - @repo/ui

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
