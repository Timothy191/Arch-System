# Accessibility (WCAG 2.2)

## 1. Focus-visible styles

- Source: <https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html>
- Rule: Never remove focus outlines; use `:focus-visible` with a visible OKLCH ring.

## 2. `aria-live` for dynamic regions

- Source: <https://www.w3.org/WAI/ARIA/apg/patterns/>
- Rule: Announce async updates via `aria-live="polite"` (or `assertive` for errors).

## 3. Skip link to main content

- Source: <https://www.w3.org/WAI/WCAG22/Understanding/bypass-blocks.html>
- Rule: Provide a visually-hidden "Skip to main content" link as the first focusable element.

## 4. Color contrast ≥ 4.5:1 (text) / 3:1 (UI)

- Source: <https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html>
- Rule: Verify OKLCH token pairs meet WCAG AA contrast; run axe in Storybook/Playwright.

## 5. Respect reduced motion & transparency

- Source: <https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html>
- Rule: Honor `prefers-reduced-motion` and `prefers-reduced-transparency`.
