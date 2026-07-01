# Policy & Architectural Rules Guide

This monorepo uses custom tools to enforce architectural boundaries and code consistency.
All policy enforcement is consolidated into `tools/policy-compiler.cjs` and `tools/design-audit.cjs`.

## 1. Adding Architectural Boundaries

To add a new dependency rule (e.g., "UI packages cannot depend on API packages"):

1. Open `tools/apply-project-tags.cjs` to ensure the relevant project directories get the correct `scope:*` tags.
2. Open `nx.json` and update the `dependencyConstraints` array with the new `sourceTag` and `onlyDependOnLibsWithTags`.
3. Run `pnpm policy:gen` to compile the `nx.json` rules into `.eslintrc.cjs` boundaries.

## 2. Design System Rules

To enforce new design system constraints (e.g., "Forbidden Tailwind classes"):

1. Open `tools/design-audit.cjs`.
2. Locate the `REGEX_PATTERNS` or AST parsers depending on the check complexity.
3. Add your new Regex to catch forbidden tokens (e.g., raw colors `#FF0000` instead of OKLCH tokens).
4. Run `pnpm audit:design` to verify.

## 3. RLS Audit Rules

To ensure a new table requires specific row level security:

1. Open `tools/audit-rls.cjs`.
2. The script parses SQL migrations in `pkgs/database/migrations`. Add new parsers to verify that specific policies like `CREATE POLICY` are present for the new table.

All of these tools run sequentially in parallel as part of the `pnpm quality` CI/CD gate.
