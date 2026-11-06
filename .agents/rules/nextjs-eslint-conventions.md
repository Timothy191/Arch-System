# Next.js ESLint Conventions

Source (rules 1–9): <https://nextjs.org/docs/14/app/building-your-application/configuring/eslint>

> Biome (`biome.json`) is Arch-System's enforced linter; ESLint is not wired in. These rules govern any Next.js ESLint setup adopted in the portal or new Next.js apps. Biome conventions (2-space indent, 100 columns, single quotes in TS/JS, double quotes in JSX, semicolons, ES5 trailing commas) still apply to all TS/JS.

1. **`next lint` script**: Every Next.js app must define `"lint": "next lint"` in `package.json` and run it in CI before every build; ESLint errors fail `next build`, warnings do not.
2. **Preset**: `.eslintrc.json` must extend `next/core-web-vitals` (Strict, recommended) or `next` (Base). Opting out ("Cancel") only with a documented custom ESLint setup.
3. **Monorepo `rootDir`**: When Next.js is not at the repo root, set `settings.next.rootDir` to the app directory (relative/absolute path, glob like `apps/*/`, or an array).
4. **Cache**: ESLint caches in `.next/cache` (or configured build dir) by default; use `next lint --no-cache` when a rule depends on more than one file.
5. **Rule changes**: Modify `eslint-plugin-react`, `eslint-plugin-react-hooks`, `@next/eslint-plugin-next` rules via the `rules` property (e.g. `"react/no-unescaped-entities": "off"`). Avoid scattered inline `eslint-disable`; document any exception.
6. **Core Web Vitals**: `next/core-web-vitals` promotes LCP/INP/CLS rules to errors; prefer Strict for all user-facing routes.
7. **Prettier**: Extend `prettier` after the Next.js config (`extends: ["next", "prettier"]`). Formatting stays owned by Biome/Prettier; ESLint covers logic and Next.js correctness only.
8. **lint-staged**: Invoke `next lint --fix --file <relative-path> ... --file <relative-path>` on staged `.{js,jsx,ts,tsx}` files — never whole-repo `next lint` in pre-commit.
9. **Precedence**: Bundled rulesets (`eslint-plugin-react`, `react-hooks`, `@next/eslint-plugin-next`) override `next.config.js` eslint options; extend `next` last when combining shareable configs.
10. **Layering** (repo policy: `apps/*` → `@repo/*` only): `dirs`/`--dir`/`--file` scopes lint `apps/portal` and each `@repo/*` package `src/` independently. No rule, ignore, or override may permit `@repo/*` to import from `apps/*`.
