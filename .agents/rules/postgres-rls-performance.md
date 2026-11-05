# PostgreSQL RLS & Performance

## 1. Wrap auth functions in `(select ...)` for RLS initplan

- Source: <https://supabase.com/docs/guides/database/postgres/row-level-security>
- Rule: In RLS policies use `(select auth.uid())` / `(select auth.jwt())` so Postgres evaluates once per statement, not per row.

## 2. Index every foreign key column

- Source: <https://www.postgresql.org/docs/current/ddl-constraints.html>
- Rule: Every FK column must have an index; verify with `EXPLAIN (ANALYZE, BUFFERS)` before merging migrations.

## 3. `security definer` functions must set `search_path`

- Source: <https://www.postgresql.org/docs/current/sql-createfunction.html>
- Rule: `CREATE FUNCTION ... SECURITY DEFINER SET search_path = public, pg_temp` to prevent search-path injection.

## 4. Immutable migrations

- Source: repo policy
- Rule: Never edit/rename/renumber applied migrations; add a new numbered file. Every table/column needs a Zod schema in `@repo/contract`.

## 5. Use partial indexes for hot filtered queries

- Source: <https://www.postgresql.org/docs/current/indexes-partial.html>
- Rule: For queries filtering on a boolean/status, create `WHERE status = 'active'` partial index instead of full index.
