# Frontend Styling Best Practices & Rule Engine

This document formalizes strict rules to prevent common beginner mistakes across CSS, Tailwind CSS, and General Frontend/React architecture.

## 1. Core CSS Rules (CSS-01 to CSS-10)

| ID | Rule | Rationale |
| :--- | :--- | :--- |
| **CSS-01** | **Never use fixed dimensions for text containers.** Use `min-width`, `max-width`, and allow the DOM flow to dictate height. | Prevents text overflow and layout breaks on varying screen sizes or translation expansions. |
| **CSS-02** | **Maintain a centralized `z-index` scale.** Never use arbitrary numbers like `z-index: 9999`. | Prevents stacking context wars and guarantees predictable overlay rendering. |
| **CSS-03** | **Ban the use of `!important` for specificity.** Fix the underlying selector architecture instead. | Overusing `!important` makes styles impossible to override downstream. |
| **CSS-04** | **Scope styles locally (CSS Modules/BEM).** Never allow component styles to leak into the global scope. | Prevents unexpected regressions when unrelated components share class names. |
| **CSS-05** | **Keep selector specificity flat.** Never nest selectors more than 3 levels deep (e.g., avoid `.card > div > p > span`). | Deep nesting bloats stylesheets and makes overriding incredibly difficult. |
| **CSS-06** | **Always use CSS Custom Properties (variables) for design tokens.** Never hardcode raw hex colors or fixed px spacing. | Ensures a single source of truth for theming, enabling instant rebrands or dark mode. |
| **CSS-07** | **Universally apply `box-sizing: border-box`.** | Ensures padding and borders are calculated within the element's defined width, not added to it. |
| **CSS-08** | **Use Flexbox/Grid for layout; reserve Absolute for overlays.** Never use absolute positioning to construct grid structures. | Modern layout algorithms are responsive by default; absolute positioning is brittle. |
| **CSS-09** | **Never remove `outline: none` without providing an explicit focus alternative.** | Destroying focus rings severely harms accessibility for keyboard navigation users. |
| **CSS-10** | **Only animate `transform` and `opacity`.** Never animate layout-triggering properties like `width`, `height`, or `margin`. | Ensures animations run on the GPU at 60fps without triggering expensive browser reflows. |

---

## 2. Tailwind CSS Rules (TW-01 to TW-10)

| ID | Rule | Rationale |
| :--- | :--- | :--- |
| **TW-01** | **Never dynamically construct class strings.** (e.g., `bg-${color}-500`). Route them via CSS variables or use a static map. | Tailwind's JIT compiler cannot purge dynamically constructed strings; styles will be missing in production. |
| **TW-02** | **Use `tailwind-merge` and `clsx` for dynamic overrides.** Do not rely on string concatenation when composing components. | Prevents specificity clashes where conflicting Tailwind classes cancel each other out randomly. |
| **TW-03** | **Limit arbitrary values (e.g., `w-[233px]`).** Stick strictly to the defined design system scale unless absolutely necessary. | Overusing arbitrary values destroys the visual consistency Tailwind is designed to enforce. |
| **TW-04** | **Always author mobile-first.** Write base classes first, followed by breakpoints (`sm:`, `md:`, `lg:`). | Ensures standard progressive enhancement and prevents breakpoint collision confusion. |
| **TW-05** | **Extend, don't override the theme.** Use `extend` in `tailwind.config.js` for colors/fonts unless you intend to wipe the default palette entirely. | Overriding the entire theme breaks default Tailwind utilities that developers expect to exist. |
| **TW-06** | **Do not misuse `@apply` to recreate standard CSS.** Embrace the utility-first workflow within HTML/JSX. | Recreating BEM classes with `@apply` defeats the purpose of Tailwind and bloats the CSS output. |
| **TW-07** | **Avoid duplicating identical layout wrappers.** Extract complex grid/flex wrappers into reusable React/Vue components. | Keeps the DOM clean and prevents repetitive 30-class strings across multiple files. |
| **TW-08** | **Handle color schemes via semantic tokens, not hardcoded variants.** Avoid scattering `dark:bg-black` everywhere. | Using semantic variables (e.g., `bg-surface-primary`) makes theme switching cleaner and more maintainable. |
| **TW-09** | **Do not mix opacity modifiers with CSS variables improperly.** (e.g., `bg-[var(--my-color)]/50`). | Tailwind requires color variables to be formatted as RGB channels to apply opacity modifiers safely. |
| **TW-10** | **Ensure the `content` array accurately covers all files.** | Missing paths in `tailwind.config.js` will result in un-compiled classes and broken UI in production. |

---

## 3. General Frontend/React UI Rules (UI-01 to UI-10)

| ID | Rule | Rationale |
| :--- | :--- | :--- |
| **UI-01** | **Avoid inline styles for layout.** Reserve inline styles strictly for highly dynamic, JS-calculated values (e.g., mouse coordinates). | Inline styles are impossible to override with media queries and bloat the DOM. |
| **UI-02** | **Use a robust variants API (like `cva`).** Do not prop-drill massive strings of class names. | Variant authorities ensure components have predictable, strongly-typed visual states. |
| **UI-03** | **Prevent Hydration Mismatches.** Ensure styles derived from browser APIs (`window.innerWidth`) fall back safely during SSR. | Mismatches cause the React tree to throw errors and visually glitch on initial client load. |
| **UI-04** | **Components should not dictate their own outer margins.** Let the parent layout container handle spacing via `gap` or wrappers. | A component with a baked-in `margin-top: 2rem` is incredibly difficult to reuse in different contexts. |
| **UI-05** | **Adopt a single primary styling methodology per boundary.** Do not mix CSS Modules, Tailwind, and Styled-Components in the same file. | Paradigmatic mixing causes massive technical debt, unpredictable build orders, and onboarding friction. |
| **UI-06** | **Use native CSS pseudo-classes instead of JS state.** (e.g., use `:hover` instead of React `onMouseEnter`/`onMouseLeave`). | JS-driven hover states cause unnecessary re-renders and lag compared to native CSS browser optimizations. |
| **UI-07** | **Never hardcode responsive breakpoints in JS.** Rely on CSS media queries or Tailwind variants instead of window resizing listeners. | CSS handles responsiveness synchronously without the performance overhead of JS event listeners. |
| **UI-08** | **Enforce WCAG AA Contrast Ratios natively in the design system.** | Accessibility should be a baseline invariant built into the tokens, not an afterthought. |
| **UI-09** | **Extract Critical CSS.** Ensure above-the-fold styles are inlined to prevent the Flash of Unstyled Content (FOUC). | Guarantees a smooth perceived load performance before heavy JS bundles are parsed. |
| **UI-10** | **Lazy load heavy styling libraries or icons.** Do not ship massive icon fonts or overarching CSS frameworks in the main vendor chunk. | Reduces Time to Interactive (TTI) and saves significant bandwidth for the end-user. |
