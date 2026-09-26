# Wiki Schema

## Domain

Company knowledge base for Arch-Systems (Plantcor) — a multi-departmental mining operations portal. Covers people, systems, processes, decisions, issues, standards, and tribal knowledge accumulated across the organization.

## Conventions

- File names: lowercase, hyphens, no spaces (e.g., `shift-handover-process.md`)
- Every wiki page starts with YAML frontmatter (see below)
- Use `[[wikilinks]]` to link between pages (minimum 2 outbound links per page)
- When updating a page, always bump the `updated` date
- Every new page must be added to `index.md` under the correct section
- Every action must be appended to `log.md`
- **Provenance markers:** On pages that synthesize 3+ sources, append `^[raw/articles/source-file.md]`
  at the end of paragraphs whose claims come from a specific source.
- Use Obsidian-compatible wikilink syntax: `[[page-title]]` or `[[page-title|Display Text]]`

## Frontmatter

```yaml
---
title: Page Title
created: YYYY-MM-DD
updated: YYYY-MM-DD
type: entity | concept | comparison | query | summary
tags: [from taxonomy below]
sources: [raw/articles/source-name.md]
# Optional quality signals:
confidence: high | medium | low # how well-supported the claims are
contested: true # set when the page has unresolved contradictions
contradictions: [other-page-slug] # pages this one conflicts with
---
```

`confidence` and `contested` are optional but recommended for opinion-heavy or fast-moving
topics. Lint surfaces `contested: true` and `confidence: low` pages for review so weak claims
don't silently harden into accepted wiki fact.

### raw/ Frontmatter

Raw sources ALSO get a small frontmatter block so re-ingests can detect drift:

```yaml
---
source_url: https://example.com/article # original URL, if applicable
ingested: YYYY-MM-DD
sha256: <hex digest of the raw content below the frontmatter>
---
```

The `sha256:` lets a future re-ingest of the same URL skip processing when content is unchanged,
and flag drift when it has changed. Compute over the body only (everything after the closing
`---`), not the frontmatter itself.

## Tag Taxonomy

- **Teams & People:** person, team, department, role, vendor
- **Systems & Products:** system, application, service, infrastructure, database, api
- **Processes & Workflows:** process, workflow, procedure, standard, sops
- **Projects & Initiatives:** project, initiative, milestone, deliverable, deployment
- **Concepts & Architecture:** concept, architecture, design, pattern, convention, integration
- **Decisions & Policies:** decision, rfc, adr, policy, guideline
- **Issues & Incidents:** issue, bug, incident, postmortem, risk
- **External:** regulation, competitor, partner, client
- **Meta:** comparison, timeline, glossary, onboarding, query

Rule: every tag on a page must appear in this taxonomy. If a new tag is needed,
add it here first, then use it. This prevents tag sprawl.

## Page Thresholds

- **Create a page** when an entity/concept appears in 2+ sources OR is central to one source
- **Add to existing page** when a source mentions something already covered
- **DON'T create a page** for passing mentions, minor details, or things outside the domain
- **Split a page** when it exceeds ~200 lines — break into sub-topics with cross-links
- **Archive a page** when its content is fully superseded — move to `_archive/`, remove from index

## Entity Pages

One page per notable entity (person, system, team, vendor, client). Include:

- Overview / what it is
- Key facts and dates
- Relationships to other entities ([[wikilinks]])
- Source references

## Concept Pages

One page per concept or topic (architecture, process, standard, integration). Include:

- Definition / explanation
- Current state of knowledge
- Open questions or debates
- Related concepts ([[wikilinks]])

## Comparison Pages

Side-by-side analyses (tool evaluations, vendor comparisons, design options). Include:

- What is being compared and why
- Dimensions of comparison (table format preferred)
- Verdict or synthesis
- Sources

## Update Policy

When new information conflicts with existing content:

1. Check the dates — newer sources generally supersede older ones
2. If genuinely contradictory, note both positions with dates and sources
3. Mark the contradiction in frontmatter: `contradictions: [page-name]`
4. Flag for user review in the lint report

---

# Database Schema Documentation

## Overview

The Arch-Systems database is built on PostgreSQL via Supabase, designed for multi-departmental mining operations. The schema follows industry best practices for security, performance, and scalability.

## Architecture Principles

### 1. Security Model

- **Row Level Security (RLS)** enabled on all tables
- Department-scoped access via `auth.uid()` correlation through `employees` table
- Role-based access: `admin`, `supervisor`, `operator`
- Cross-department access via `accessible_departments` UUID array

### 2. Data Model

- UUID primary keys (generated via `uuid_generate_v4()`)
- `TIMESTAMPTZ` for all timestamps (timezone-aware)
- Soft deletes via `deleted_at` timestamp where applicable
- Enum-like check constraints for categorical data
- Generated/computed columns for derived values

### 3. Indexing Strategy

- Primary key indexes (automatic)
- Foreign key indexes (explicit)
- Composite indexes for common query patterns
- HNSW indexes for vector similarity (AI memory system)

## Core Entities

### Departments

Organizational units with isolated data access.

| Column       | Type | Constraints      | Description            |
| ------------ | ---- | ---------------- | ---------------------- |
| id           | UUID | PK               | Department identifier  |
| name         | TEXT | UNIQUE, NOT NULL | Slug identifier        |
| display_name | TEXT | NOT NULL         | Human-readable name    |
| icon         | TEXT | NOT NULL         | Icon reference         |
| description  | TEXT | -                | Department description |
| color        | TEXT | NOT NULL         | Brand color            |

### Employees

Linked to Supabase Auth users with role-based permissions.

| Column                 | Type   | Constraints               | Description               |
| ---------------------- | ------ | ------------------------- | ------------------------- |
| id                     | UUID   | PK                        | Employee identifier       |
| auth_id                | UUID   | FK → auth.users, NOT NULL | Supabase auth reference   |
| department_id          | UUID   | FK → departments          | Primary department        |
| full_name              | TEXT   | NOT NULL                  | Full name                 |
| role                   | TEXT   | DEFAULT 'operator'        | admin/supervisor/operator |
| accessible_departments | UUID[] | DEFAULT '{}'              | Cross-department access   |

### Machines

Equipment tracked per department with operational metrics.

| Column        | Type    | Constraints                | Description                |
| ------------- | ------- | -------------------------- | -------------------------- |
| id            | UUID    | PK                         | Machine identifier         |
| department_id | UUID    | FK → departments, NOT NULL | Ownership                  |
| name          | TEXT    | NOT NULL                   | Machine name/code          |
| machine_type  | TEXT    | NOT NULL                   | Category                   |
| serial_number | TEXT    | -                          | Manufacturer serial        |
| active        | BOOLEAN | DEFAULT true               | Status flag                |
| bin_factor    | NUMERIC | -                          | Volume conversion factor   |
| site_id       | UUID    | FK → sites                 | Site assignment (optional) |

## Operational Tables

### Daily Logs

Base container for shift-specific operational data.

| Column        | Type | Constraints                | Description      |
| ------------- | ---- | -------------------------- | ---------------- |
| id            | UUID | PK                         | Log identifier   |
| department_id | UUID | FK → departments, NOT NULL | Ownership        |
| log_date      | DATE | NOT NULL                   | Calendar date    |
| shift         | TEXT | CHECK IN ('day', 'night')  | Shift period     |
| notes         | TEXT | -                          | Additional notes |

**Index**: UNIQUE (department_id, log_date, shift)

### Machine Hours

Tracked within daily log context.

| Column       | Type    | Constraints               | Description       |
| ------------ | ------- | ------------------------- | ----------------- |
| id           | UUID    | PK                        | Entry identifier  |
| daily_log_id | UUID    | FK → daily_logs, NOT NULL | Parent log        |
| machine_id   | UUID    | FK → machines, NOT NULL   | Machine reference |
| hours_worked | NUMERIC | NOT NULL, DEFAULT 0       | Hours count       |

### Fuel Logs

Diesel consumption tracking.

| Column        | Type    | Constraints               | Description       |
| ------------- | ------- | ------------------------- | ----------------- |
| id            | UUID    | PK                        | Entry identifier  |
| daily_log_id  | UUID    | FK → daily_logs, NOT NULL | Parent log        |
| machine_id    | UUID    | FK → machines, NOT NULL   | Machine reference |
| diesel_litres | NUMERIC | NOT NULL, DEFAULT 0       | Litres consumed   |

### Production Logs

Coal and waste tonnage tracking.

| Column       | Type    | Constraints               | Description      |
| ------------ | ------- | ------------------------- | ---------------- |
| id           | UUID    | PK                        | Entry identifier |
| daily_log_id | UUID    | FK → daily_logs, NOT NULL | Parent log       |
| coal_tonnes  | NUMERIC | NOT NULL, DEFAULT 0       | Coal extracted   |
| waste_tonnes | NUMERIC | NOT NULL, DEFAULT 0       | Waste moved      |

## Control Room Tables

### Machine Operations

Detailed operational tracking with calculated hours.

| Column        | Type    | Constraints                | Description           |
| ------------- | ------- | -------------------------- | --------------------- |
| id            | UUID    | PK                         | Operation identifier  |
| department_id | UUID    | FK → departments, NOT NULL | Ownership             |
| machine_id    | UUID    | FK → machines, NOT NULL    | Machine reference     |
| operator_id   | UUID    | FK → operators             | Assigned operator     |
| site_id       | UUID    | FK → sites                 | Operational site      |
| shift_date    | DATE    | NOT NULL                   | Calendar date         |
| shift_type    | TEXT    | CHECK IN ('day', 'night')  | Shift period          |
| start_time    | TIME    | NOT NULL                   | Shift start           |
| end_time      | TIME    | -                          | Shift end             |
| hours_worked  | NUMERIC | GENERATED                  | Calculated from times |
| created_by    | UUID    | FK → employees             | Creator reference     |

**Index**: UNIQUE (machine_id, shift_date, shift_type, start_time)

### Hourly Loads

12-hour shift grid for load counting (Day: 06:00-18:00, Night: 18:00-06:00).

| Column            | Type    | Constraints                | Description         |
| ----------------- | ------- | -------------------------- | ------------------- |
| id                | UUID    | PK                         | Entry identifier    |
| department_id     | UUID    | FK → departments, NOT NULL | Ownership           |
| machine_id        | UUID    | FK → machines, NOT NULL    | Machine reference   |
| load_date         | DATE    | NOT NULL                   | Calendar date       |
| shift_type        | TEXT    | CHECK IN ('day', 'night')  | Shift period        |
| hour_01 - hour_12 | INTEGER | NOT NULL, DEFAULT 0        | Hourly counts       |
| total_loads       | INTEGER | GENERATED                  | Sum of hourly loads |

**Index**: UNIQUE (machine_id, load_date, shift_type)

### Excavator Activity

Detailed excavator cycle tracking with dumper assignments.

| Column                 | Type    | Constraints                | Description         |
| ---------------------- | ------- | -------------------------- | ------------------- |
| id                     | UUID    | PK                         | Activity identifier |
| department_id          | UUID    | FK → departments, NOT NULL | Ownership           |
| machine_id             | UUID    | FK → machines, NOT NULL    | Excavator reference |
| operator_id            | UUID    | FK → operators             | Operator reference  |
| site_id                | UUID    | FK → sites                 | Site location       |
| block_mined_id         | UUID    | FK → mine_blocks           | Mine block          |
| activity_date          | DATE    | NOT NULL                   | Calendar date       |
| shift_type             | TEXT    | CHECK IN ('day', 'night')  | Shift period        |
| passes                 | INTEGER | NOT NULL, DEFAULT 0        | Total passes        |
| loads                  | INTEGER | NOT NULL, DEFAULT 0        | Total loads         |
| avg_cycle_time_seconds | INTEGER | -                          | Average cycle time  |
| material_type          | TEXT    | -                          | Material category   |
| estimated_tonnes       | NUMERIC | -                          | Volume estimate     |

**Index**: UNIQUE (machine_id, activity_date, shift_type)

### Excavator Dumper Assignments

Child table linking excavators to assigned dumpers.

| Column                | Type    | Constraints                       | Description           |
| --------------------- | ------- | --------------------------------- | --------------------- |
| id                    | UUID    | PK                                | Assignment identifier |
| excavator_activity_id | UUID    | FK → excavator_activity, NOT NULL | Parent activity       |
| dumper_machine_id     | UUID    | FK → machines, NOT NULL           | Dumper reference      |
| material_type         | TEXT    | NOT NULL, DEFAULT 'Unspecified'   | Material category     |
| total_loads           | INTEGER | NOT NULL, DEFAULT 0               | Load count            |
| total_bcm             | NUMERIC | -                                 | Bank cubic metres     |

## Safety Department Tables

### Safety Incidents

Comprehensive incident tracking with severity categorization.

| Column            | Type        | Constraints                     | Description         |
| ----------------- | ----------- | ------------------------------- | ------------------- |
| id                | UUID        | PK                              | Incident identifier |
| department_id     | UUID        | FK → departments, NOT NULL      | Location            |
| incident_date     | DATE        | NOT NULL                        | Calendar date       |
| shift_type        | TEXT        | CHECK IN ('day', 'night')       | Shift period        |
| category_id       | UUID        | FK → safety_incident_categories | Incident type       |
| severity_id       | UUID        | FK → safety_severities          | Severity level      |
| incident_type     | TEXT        | CHECK IN (...)                  | Classification      |
| description       | TEXT        | NOT NULL                        | Incident details    |
| location          | TEXT        | -                               | Specific location   |
| injured_parties   | INTEGER     | NOT NULL, DEFAULT 0             | Person count        |
| reported_by       | UUID        | FK → employees                  | Reporter            |
| reviewed_by       | UUID        | FK → employees                  | Reviewer            |
| root_cause        | TEXT        | -                               | Analysis result     |
| corrective_action | TEXT        | -                               | Action plan         |
| status            | TEXT        | CHECK IN (...)                  | Workflow status     |
| closed_at         | TIMESTAMPTZ | -                               | Resolution time     |

## Engineering Department Tables

### Breakdowns

Equipment breakdown book-in/book-out workflow.

| Column          | Type        | Constraints                | Description          |
| --------------- | ----------- | -------------------------- | -------------------- |
| id              | UUID        | PK                         | Breakdown identifier |
| department_id   | UUID        | FK → departments, NOT NULL | Location             |
| fleet_id        | TEXT        | NOT NULL                   | Fleet identifier     |
| machine_type    | TEXT        | NOT NULL                   | Equipment type       |
| date_in         | DATE        | NOT NULL                   | Book-in date         |
| time_in         | TIME        | DEFAULT '00:00'            | Book-in time         |
| date_out        | DATE        | -                          | Book-out date        |
| time_out        | TIME        | -                          | Book-out time        |
| reason          | TEXT        | NOT NULL                   | Failure reason       |
| repair_notes    | TEXT        | -                          | Repair details       |
| status          | TEXT        | CHECK IN (...)             | 'active'/'completed' |
| missing_book_in | BOOLEAN     | DEFAULT false              | Data quality flag    |
| created_by      | UUID        | FK → auth.users            | Book-in user         |
| completed_by    | UUID        | FK → auth.users            | Book-out user        |
| deleted_at      | TIMESTAMPTZ | -                          | Soft delete          |

**Indexes**:

- idx_breakdowns_department (department_id)
- idx_breakdowns_status (status) WHERE deleted_at IS NULL
- idx_breakdowns_fleet_id (fleet_id)
- idx_breakdowns_date_in (date_in DESC)

## AI Memory System (Vector Store)

### Memory Embeddings

Hybrid retrieval system for conversation history and semantic memory.

| Column      | Type                 | Constraints                 | Description       |
| ----------- | -------------------- | --------------------------- | ----------------- |
| id          | UUID                 | PK                          | Memory identifier |
| session_id  | TEXT                 | NOT NULL                    | Session reference |
| user_id     | UUID                 | FK → auth.users             | User reference    |
| content     | TEXT                 | NOT NULL                    | Memory content    |
| embedding   | VECTOR(1536)         | NOT NULL                    | OpenAI embedding  |
| metadata    | JSONB                | DEFAULT '{}'                | Context metadata  |
| memory_type | \"memory_type\" ENUM | NOT NULL DEFAULT 'episodic' | episodic/semantic |
| created_at  | TIMESTAMPTZ          | DEFAULT NOW()               | Creation time     |
| updated_at  | TIMESTAMPTZ          | DEFAULT NOW()               | Update time       |

**Indexes**:

- HNSW index on embedding (cosine similarity)
- B-tree on session_id, user_id, memory_type, created_at
- GIN index on metadata
- Full-text search index on content

## Reference Tables

### Sites

Operational site locations.

| Column    | Type    | Constraints      | Description     |
| --------- | ------- | ---------------- | --------------- |
| id        | UUID    | PK               | Site identifier |
| name      | TEXT    | NOT NULL         | Site name       |
| site_code | TEXT    | UNIQUE, NOT NULL | Short code      |
| active    | BOOLEAN | DEFAULT true     | Status          |

### Mine Blocks

Mining area subdivisions.

| Column  | Type    | Constraints      | Description      |
| ------- | ------- | ---------------- | ---------------- |
| id      | UUID    | PK               | Block identifier |
| name    | TEXT    | NOT NULL         | Block name       |
| code    | TEXT    | UNIQUE, NOT NULL | Block code       |
| site_id | UUID    | FK → sites       | Parent site      |
| active  | BOOLEAN | DEFAULT true     | Status           |

### Operators

Control room operator reference.

| Column        | Type    | Constraints        | Description         |
| ------------- | ------- | ------------------ | ------------------- |
| id            | UUID    | PK                 | Operator identifier |
| full_name     | TEXT    | NOT NULL           | Full name           |
| employee_code | TEXT    | UNIQUE, NOT NULL   | Employee ID         |
| role          | TEXT    | DEFAULT 'operator' | Role designation    |
| active        | BOOLEAN | DEFAULT true       | Status              |

### Delay Categories

Operational delay classifications.

| Column     | Type    | Constraints | Description         |
| ---------- | ------- | ----------- | ------------------- |
| id         | UUID    | PK          | Category identifier |
| name       | TEXT    | NOT NULL    | Category name       |
| color      | TEXT    | NOT NULL    | Display color       |
| icon       | TEXT    | -           | Icon reference      |
| sort_order | INTEGER | DEFAULT 0   | Display order       |

### Safety Severities

Incident severity levels.

| Column | Type    | Constraints      | Description         |
| ------ | ------- | ---------------- | ------------------- |
| id     | UUID    | PK               | Severity identifier |
| level  | TEXT    | UNIQUE, NOT NULL | Severity name       |
| weight | INTEGER | DEFAULT 1        | Sort weight         |
| color  | TEXT    | NOT NULL         | Display color       |

## Row Level Security Policies

### Policy Pattern

All tables use department-scoped RLS with role-based access:

```sql
CREATE POLICY "table_select_department"
  ON table_name FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees e
      WHERE e.auth_id = auth.uid()
        AND (
          e.role = 'admin'
          OR e.department_id = table_name.department_id
          OR table.department_id = ANY(e.accessible_departments)
        )
    )
  );
```

### Helper Functions

Functions for RLS policy evaluation:

| Function                              | Returns | Description               |
| ------------------------------------- | ------- | ------------------------- |
| `auth.user_department_id()`           | UUID    | Current user's department |
| `auth.is_admin()`                     | BOOLEAN | Admin check               |
| `auth.has_department_access(dept_id)` | BOOLEAN | Department access check   |

## Index Strategy

### Foreign Key Indexes (Required)

All foreign key columns should have explicit indexes for join performance:

```sql
-- Standard FK indexes (often missing, should be added)
CREATE INDEX idx_employees_department ON employees(department_id);
CREATE INDEX idx_machines_department ON machines(department_id);
CREATE INDEX idx_daily_logs_department ON daily_logs(department_id);
```

### Query Pattern Indexes

Composite indexes for common query patterns:

```sql
-- Daily logs lookup by date and department
CREATE INDEX idx_daily_logs_dept_date_shift
  ON daily_logs(department_id, log_date, shift);

-- Machine operations by date range
CREATE INDEX idx_machine_ops_dept_date
  ON machine_operations(department_id, shift_date DESC);
```

## Identified Improvements

### Completed (Migrations 010-014)

1. **Foreign key indexes** - Added in migrations 010_schema_optimization.sql and 014_schema_refinement.sql
2. **Native enum types** - Created in 010_schema_optimization.sql (role_type, shift_type, incident_type, delay_type, safety_incident_type, safety_status, memory_type)
3. **Audit timestamps** - updated_at added to daily_logs children and reference tables in migrations 010-014
4. **Soft delete consistency** - deleted_at added to all reference tables
5. **Numeric precision constraints** - Applied in 014_schema_refinement.sql
6. **Comprehensive documentation** - Table/column comments added in 014_schema_refinement.sql

## Schema Quality Assessment

### Current State (After 010-014 Migrations)

| Category        | Score | Notes                                                                   |
| --------------- | ----- | ----------------------------------------------------------------------- |
| Security        | 10/10 | Comprehensive RLS coverage, role-based access, admin policies           |
| Documentation   | 9/10  | Extensive table/column comments, clear conventions                      |
| Indexing        | 9/10  | All FKs indexed, composite indexes for query patterns, HNSW for vectors |
| Performance     | 9/10  | NUMERIC precision, triggers for timestamps, ready for scale             |
| Maintainability | 9/10  | Consistent migrations, clear naming conventions                         |

## Remaining Enhancements

### Future Work (Optional)

1. **Migrate CHECK columns to enum types** - Application update required to use native enums
2. **Hourly loads normalization** - Consider JSONB column for flexible hour data
3. **Table partitioning** - For audit_logs, memory_embeddings when exceeding 1M rows

## Migration Guidelines

1. **Source of truth**: `packages/database/migrations/`
2. **Deploy copy**: `packages/supabase/supabase/migrations/` (auto-synced)
3. **Run locally**: `cd packages/database && pnpm supabase:dev`
4. **Reset local**: `cd packages/database && pnpm supabase:reset`
5. **Push remote**: `cd packages/database && pnpm supabase:push`

## Data Validation Rules

### Check Constraints

- Shift values: `'day'` or `'night'`
- Roles: `'admin'`, `'supervisor'`, `'operator'`
- Status values vary by table (follow existing patterns)
- Numeric values: Non-negative where applicable

### Business Rules

- Daily logs: One per department/date/shift combination
- Machine operations: One per machine/date/shift/start_time
- Hourly loads: One per machine/date/shift combination

## Performance Considerations

### Implemented Improvements (Migrations 010-014)

- Foreign key indexes added to all child tables
- Audit timestamps (`updated_at`) added to daily_logs, machine_hours, fuel_logs, production_logs
- Soft delete (`deleted_at`) columns added to operators, sites, mine_blocks, delay_categories, report_templates
- Composite indexes for dashboard query patterns

### Large Table Projections

Tables expected to exceed 1M rows should consider partitioning:

- `audit_logs` - Time-series, partition by `created_at`
- `memory_embeddings` - Time-series, partition by `created_at`

### Query Optimization

- Use `SELECT column_list` instead of `SELECT *`
- Leverage generated columns for calculated values
- Use partial indexes for filtered queries (e.g., `WHERE deleted_at IS NULL`)

### Connection Pooling

Supabase handles connection pooling automatically. Use:

- `pgbouncer=true` in connection string for high-concurrency scenarios
