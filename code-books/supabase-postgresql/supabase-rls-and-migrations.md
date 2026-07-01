# Supabase & PostgreSQL: RLS and Migrations Manual

## 1. The Authoritative Source of Truth: Employees Table
In this monorepo, **authorization decisions must never be based on Supabase Auth user metadata**. 
* The `employees` table serves as the sole source of truth for employee identity, roles, department assignments, and resource permissions.
* The first line of data-access operations must verify that the authenticated user (`auth.uid()`) has a corresponding, active record in the `employees` table.

---

## 2. Row Level Security (RLS) Policies
Every single database table in PostgreSQL must have Row Level Security enabled. This is enforced by `pnpm audit:rls` and `policy:check` in the CI pipeline.

### RLS Template
When creating a table, enable RLS and specify read/write policies based on the user's employee status:
```sql
-- Enable RLS
ALTER TABLE shift_logs ENABLE ROW LEVEL SECURITY;

-- Select policy: Allow employees to view logs in their department
CREATE POLICY select_shift_logs ON shift_logs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM employees
            WHERE employees.user_id = auth.uid()
              AND employees.department_id = shift_logs.department_id
        )
    );

-- Insert policy: Only department managers can insert logs
CREATE POLICY insert_shift_logs ON shift_logs
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM employees
            WHERE employees.user_id = auth.uid()
              AND employees.role = 'manager'
              AND employees.department_id = shift_logs.department_id
        )
    );
```

---

## 3. Database Migration Pipeline
All database modifications (schema changes, RLS policy adjustments, seeds) must be written as migrations.

### Schema Naming & Lexical Ordering
* Migrations reside in `pkgs/database/migrations/`.
* They are named as zero-padded SQL files, e.g., `062_add_shift_logs_table.sql`.
* They are applied lexically by the migrator.

### Command Guide
| Task | Target | Command |
|------|--------|---------|
| Start Local DB Stack | `@repo/database` | `pnpm --filter @repo/database supabase:dev` (Requires Docker) |
| Apply New Migrations | `@repo/database` | `pnpm --filter @repo/database supabase:push` |
| Regenerate TypeScript Types | `@repo/database` | `pnpm --filter @repo/database supabase:gen` |
| Run RLS Security Audits | Workspace-wide | `pnpm audit:rls` |

> [!IMPORTANT]
> When submitting database schema changes, always commit the SQL migration file and the regenerated `pkgs/supabase/src/database.types.ts` type definitions together in a single atomic commit.
