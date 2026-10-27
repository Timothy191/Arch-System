# Cookbook: Database and Contract Changes

## Use when

Adding or changing tables, columns, indexes, RLS, RPCs, migrations, or Zod contracts.

## Steps

1. Inspect current migrations and the relevant schema in `packages/database/migrations/`.
2. Create the next migration using `NNN_description.sql`. Never rename or renumber an applied migration. Do not write through `packages/supabase/migrations`.
3. Make migration operations safe: explicit constraints, indexes for access paths, reversible intent where practical, and RLS for every exposed table.
4. Add or update the matching Zod schema in `packages/contract/src/schemas/`. Database/contract parity is mandatory.
5. Update generated database types only through the repository command; never hand-edit generated types.
6. Ensure every query is tenant/user scoped and every mutation has authorization and input validation.
7. Add rollback/RLS coverage where the database package convention requires it.

## Checks

```bash
pnpm audit:drift
pnpm audit:rls
pnpm --filter @repo/database check-migrations
pnpm --filter @repo/database test
pnpm --filter @repo/contract type-check
pnpm --filter @repo/supabase supabase:gen-types
```

## Safety rules

- Never use service-role access as a substitute for RLS.
- Never interpolate user input into SQL, identifiers, filters, or ordering.
- Never ship a table or column without its contract and access policy.
- If a migration has already run in any environment, preserve its filename and prefix.
