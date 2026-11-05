# Next.js ESLint Conventions

## 1. Expose `next lint` as the application lint script

- Source: <https://nextjs.org/docs/14/app/building-your-application/configuring/eslint>
- Rule: Every Next.js application must define `"lint": "next lint"` in `package.json` and run `next lint` in CI before every build; ESLint errors fail `next build`, warnings do not.

## 2. Strict (`next/core-web-vitals`) or Base (`next`) — never Cancel without a replacement

- Source: <https://nextjs.org/docs/14/app/building-your-application/configuring/eslint>
- Rule: `.eslintrc.json` must extend either `next/core-web-vitals` (Strict, recommended; includes the Core Web Vitals rule set) or `next` (Base). Opting out ("Cancel") is allowed only with a documented custom ESLint setup.

## 3. Set `settings.next.rootDir` for monorepo sub-apps

- Source: <https://nextjs.org/docs/14/app/building-your-application/configuring/eslint>
- Rule: When Next.js is not installed at the repository root (as in Arch-System's monorepo), configure `settings.next.rootDir` in `.eslintrc.json` to the Next.js app directory — a relative or absolute path, a glob such as `apps/*/`, or an array of both.

## 4. Respect the ESLint cache; disable with `--no-cache` for cross-file rules

- Source: <https://nextjs.org/docs/14/app/building-your-application/configuring/eslint>
- Rule: ESLint caches processed files by default (`.next/cache` or the configured build directory). Pass `next lint --no-cache` whenever an enabled rule depends on more than the contents of a single source file.

## 5. Disable or modify rules through the `rules` property

- Source: <https://nextjs.org/docs/14/app/building-your-application/configuring/eslint>
- Rule: Change rules from `eslint-plugin-react`, `eslint-plugin-react-hooks`, or `@next/eslint-plugin-next` via the `rules` property in `.eslintrc.json` (e.g. `"react/no-unescaped-entities": "off"`). Avoid scattered inline `eslint-disable` comments; document any exception.

## 6. Enable Core Web Vitals rules for customer-facing routes

- Source: <https://nextjs.org/docs/14/app/building-your-application/configuring/eslint>
- Rule: `next/core-web-vitals` promotes rules affecting Core Web Vitals (LCP, INP, CLS) from warnings to errors; prefer the Strict preset for all user-facing Next.js routes.

## 7. Pair ESLint with Prettier via `eslint-config-prettier`

- Source: <https://nextjs.org/docs/14/app/building-your-application/configuring/eslint>
- Rule: Extend `prettier` after the Next.js config (e.g. `extends: ["next", "prettier"]`) so ESLint never enforces formatting that conflicts with Prettier. In Arch-System, formatting remains owned by Biome/Prettier; ESLint covers logic and Next.js correctness only.

## 8. Run lint-staged with `--file` on staged files

- Source: <https://nextjs.org/docs/14/app/building-your-application/configuring/eslint>
- Rule: lint-staged must invoke `next lint --fix --file <relative-path> ... --file <relative-path>` on staged `.{js,jsx,ts,tsx}` files, never `next lint` on the whole repository in pre-commit hooks.

## 9. `eslint-config-next` takes precedence over `next.config.js` eslint settings

- Source: <https://nextjs.org/docs/14/app/building-your-application/configuring/eslint>
- Rule: The bundled plugin rulesets (`eslint-plugin-react`, `react-hooks`, `@next/eslint-plugin-next`) override `next.config.js` eslint options; when combining shareable configs, extend `next` last so parser, plugins, and settings are not overwritten.

## 10. Arch-System layering: ESLint never overrides package boundaries

- Source: repo layering policy (`apps/*` → `@repo/*` only; `@repo/*` never imports `apps/*`)
- Rule: ESLint `dirs`/`--dir`/`--file` scopes must respect layering: lint `apps/portal` app directories and each `@repo/*` package `src/` independently. No ESLint rule, ignore pattern, or override may permit `@repo/*` code to import from `apps/*`.

## Note: Biome is Arch-System's enforced linter

ESLint is not wired into Arch-System — Biome (`biome.json`) is the enforced linter (AGENTS.md, Formatting & linting). This rule file governs any Next.js ESLint setup adopted in the portal or in new Next.js apps; Biome conventions (2-space indent, 100 columns, single quotes in TS/JS, double quotes in JSX, semicolons, ES5 trailing commas) continue to apply to all TS/JS.
