# CSS-in-JS

## 1. Tailwind CSS is the styling standard; CSS-in-JS not adopted

- Source: <https://nextjs.org/docs/app/guides/css-in-js>
- Rule: `apps/portal` styles with Tailwind CSS (utility-first). CSS-in-JS libraries (styled-components, styled-jsx, emotion, stylex, etc.) are not added; no new Client Component may introduce a CSS-in-JS dependency.

## 2. OKLCH tokens only; no raw hex/rgb

- Source: repo theme (`@repo/theme`)
- Rule: All colors come from `@repo/theme` OKLCH tokens. No raw hex/rgb values and no `dark:` variants — Arch-System is light mode only (canvas `#f3f4f6`).

## 3. CSS Modules for component-scoped styles only

- Source: <https://nextjs.org/docs/app/getting-started/css>
- Rule: Use `<name>.module.css` for component-specific styles when Tailwind utilities are insufficient. Keep CSS imports contained to a single entry file per component; import global styles and Tailwind in the root layout.

## 4. External stylesheets are imported once

- Source: <https://nextjs.org/docs/app/getting-started/css>
- Rule: Stylesheets published by external packages are imported in a single entry file (typically the root layout), never scattered across components, to keep CSS chunk ordering predictable.
