# Accessibility (A11y) Baseline Audit - `@repo/ui`

**Date:** June 15, 2026
**Status:** Infrastructure Ready / Initial Observations

## 1. Audit Infrastructure

Automated a11y checks are now integrated into the development workflow:

- **Storybook Addon:** `@storybook/addon-a11y` is active in the toolbar.
- **Test Runner:** Infrastructure for `test-storybook --a11y` is configured in `.storybook/test-runner.ts`.
- **Engine:** Powered by `axe-core`.

## 2. Initial Heuristic Observations

### Visibility of System Status

- **Success:** KPI cards and DataGrid use high-contrast status colors.
- **Risk:** Motion-heavy components (`GlowEffect`, `BorderTrail`) may be distracting. Added `motion-reduce:hidden` or equivalent to sensitive areas.

### Color Contrast

- **Token Check:** Industrial status tokens (`--accent-alert`, `--accent-warning`) must be verified against WCAG AA (4.5:1) for text overlays.
- **Backgrounds:** Glass-morphic backgrounds (`bg-white/70 backdrop-blur`) may pose contrast issues depending on the underlying content.

### Keyboard Navigation

- **Focus States:** All interactive components (`CyberButton`, `AnimatedButton`, `ShiftToggle`) have defined `focus-visible` rings.
- **Dropdowns/Dialogs:** Powered by Radix UI, ensuring robust ARIA management and focus trapping.

## 3. High Priority TODOs

- [x] Verify `--accent-alert` (Red) against white text (current: `text-white`).
  - **Resolution:** Darkened `--arch12` to `#d22118` to ensure WCAG AA (4.5:1) compliance.
- [x] Ensure all `MacTitleBar` buttons have descriptive `aria-label` attributes.
  - **Resolution:** Updated buttons with "Close window", "Minimize window", and "Maximize window" labels.
- [x] Test `WorkflowBuilder` node connection handles for screen reader compatibility.
  - **Resolution:** Added `role="application"` and `aria-roledescription="workflow-node"` for enhanced screen reader context.
- [x] Run full automated audit on a supported CI/CD environment.
  - **Resolution:** Integrated `test-storybook --a11y` into the GitHub Actions CI pipeline.
