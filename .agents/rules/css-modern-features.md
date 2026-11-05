# Modern CSS Features

## 1. Container queries for components

- Source: <https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_container_queries>
- Rule: Use `@container` for component responsiveness; reserve media queries for page layout.

## 2. OKLCH tokens only

- Source: repo theme
- Rule: All colors via `@repo/theme` OKLCH tokens; no raw hex/rgb or `dark:` variants.

## 3. `content-visibility: auto` for long lists

- Source: <https://developer.mozilla.org/en-US/docs/Web/CSS/content-visibility>
- Rule: Apply `content-visibility: auto; contain-intrinsic-size: ...` to large off-screen lists.

## 4. Respect `prefers-reduced-motion`

- Source: <https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion>
- Rule: Disable or reduce animations under `prefers-reduced-motion: reduce`.

## 5. Logical properties

- Source: <https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Logical_Properties>
- Rule: Use `margin-inline`, `padding-block` instead of physical `margin-left`/`padding-top`.
