# PostgreSQL RLS & Schema Patterns (Arch-System SSoT)

> **DATABASE INVARIANT**: Standardized PostgreSQL patterns for Supabase, Row Level Security (RLS) InitPlan optimization, atomic RPC transactions, time-series partitioning, and pgvector hybrid search.

---

## 1. Row Level Security (RLS) Mandatory Invariant

Every table in `packages/database/migrations/` MUST enable and force RLS:

```sql
-- Standard Table Definition Pattern
CREATE TABLE public.department_shift_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
    operator_id UUID NOT NULL REFERENCES auth.users(id),
    shift_date DATE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('draft', 'submitted', 'approved', 'archived')),
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- MANDATORY: Enable & Force RLS
ALTER TABLE public.department_shift_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.department_shift_logs FORCE ROW LEVEL SECURITY;
```

---

## 2. InitPlan Performance Optimization Pattern

> **PERFORMANCE MANDATE**: Never call `auth.uid()` or role helper functions directly in RLS predicate expressions. Wrap them in a subquery `(SELECT auth.uid())`.
> Wrapping in a subquery allows the PostgreSQL query planner to evaluate the expression once as an **InitPlan** (cached query-level execution) rather than invoking it repeatedly for every single evaluated row (a SubPlan with $O(N)$ execution cost).

### Anti-Pattern vs Optimal InitPlan Pattern

```sql
-- ❌ ANTI-PATTERN: Evaluated for EVERY row ($O(N)$ function calls)
CREATE POLICY shift_logs_select_bad ON public.department_shift_logs
FOR SELECT TO authenticated
USING (
    operator_id = auth.uid() OR public.is_admin()
);

-- ✅ OPTIMAL PATTERN: Evaluated ONCE as an InitPlan ($O(1)$ evaluation)
CREATE POLICY shift_logs_select_good ON public.department_shift_logs
FOR SELECT TO authenticated
USING (
    operator_id = (SELECT auth.uid())
    OR (SELECT public.is_admin())
    OR (SELECT public.has_department_access(department_id))
);
```

---

## 3. Secure Function Signature (`search_path` Guard)

All PL/pgSQL database functions, triggers, and RPCs MUST declare an explicit immutable `search_path` to eliminate search_path hijacking vulnerabilities:

```sql
CREATE OR REPLACE FUNCTION public.close_shift_atomic(
    p_shift_id UUID,
    p_operator_id UUID,
    p_notes TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp  -- MANDATORY: Prevents mutable search_path injection
AS $$
DECLARE
    v_shift RECORD;
    v_result JSONB;
BEGIN
    -- Acquire exclusive row lock to prevent race conditions
    SELECT * INTO v_shift
    FROM public.department_shift_logs
    WHERE id = p_shift_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'SHIFT_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;

    IF v_shift.status = 'approved' THEN
        RAISE EXCEPTION 'SHIFT_ALREADY_CLOSED' USING ERRCODE = 'P0001';
    END IF;

    -- Execute atomic state transition
    UPDATE public.department_shift_logs
    SET status = 'approved',
        payload = jsonb_set(payload, '{closing_notes}', to_jsonb(p_notes)),
        updated_at = timezone('utc'::text, now())
    WHERE id = p_shift_id;

    -- Return standardized JSON envelope
    RETURN jsonb_build_object(
        'success', true,
        'shift_id', p_shift_id,
        'closed_at', timezone('utc'::text, now())
    );
END;
$$;
```

---

## 4. Role-Based Access Control (RBAC) Helper Functions

Centralized access control checks executed in database security policies:

```sql
-- 1. Admin Verification
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = (SELECT auth.uid())
          AND ur.role IN ('admin', 'superadmin')
    );
$$;

-- 2. Department Access Verification
CREATE OR REPLACE FUNCTION public.has_department_access(p_dept_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT (SELECT public.is_admin()) OR EXISTS (
        SELECT 1 FROM public.user_department_memberships udm
        WHERE udm.user_id = (SELECT auth.uid())
          AND udm.department_id = p_dept_id
    );
$$;
```

---

## 5. Time-Series Table Partitioning Pattern

For high-throughput telemetry streams (e.g. SCADA machine telemetry, drill operations), tables are partitioned by month to keep index trees compact and facilitate instant drop-partition archival:

```sql
-- Master partitioned table
CREATE TABLE public.machine_telemetry (
    id UUID DEFAULT gen_random_uuid(),
    machine_id UUID NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL,
    engine_temp NUMERIC(5,2),
    fuel_level NUMERIC(5,2),
    vibration_amplitude NUMERIC(6,3),
    raw_payload JSONB DEFAULT '{}'::jsonb,
    PRIMARY KEY (id, recorded_at)
) PARTITION BY RANGE (recorded_at);

-- Monthly partition instance
CREATE TABLE public.machine_telemetry_2026_10 PARTITION OF public.machine_telemetry
    FOR VALUES FROM ('2026-10-01 00:00:00+00') TO ('2026-11-01 00:00:00+00');

-- Indexing per partition
CREATE INDEX idx_telemetry_2026_10_machine_time
    ON public.machine_telemetry_2026_10 (machine_id, recorded_at DESC);
```

---

## 6. pgvector HNSW Indexing & Hybrid Search Pattern

Arch-System uses pgvector for AI memory, operating documents, and mining equipment troubleshooting manuals. Hybrid search combines dense vector distance with full-text lexical scoring:

```sql
-- Hybrid Vector + Full-Text Search Function
CREATE OR REPLACE FUNCTION public.search_memories_hybrid(
    query_text TEXT,
    query_embedding vector(1536),
    match_count INT DEFAULT 10,
    vector_weight FLOAT DEFAULT 0.7
)
RETURNS TABLE (
    id UUID,
    content TEXT,
    metadata JSONB,
    similarity FLOAT
)
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
    WITH semantic_search AS (
        SELECT
            m.id,
            1 - (m.embedding <=> query_embedding) AS semantic_score
        FROM public.ai_memories m
        ORDER BY m.embedding <=> query_embedding
        LIMIT match_count * 2
    ),
    keyword_search AS (
        SELECT
            m.id,
            ts_rank_cd(to_tsvector('english', m.content), plainto_tsquery('english', query_text)) AS keyword_score
        FROM public.ai_memories m
        WHERE to_tsvector('english', m.content) @@ plainto_tsquery('english', query_text)
        LIMIT match_count * 2
    )
    SELECT
        m.id,
        m.content,
        m.metadata,
        COALESCE(s.semantic_score, 0) * vector_weight +
        COALESCE(k.keyword_score, 0) * (1 - vector_weight) AS similarity
    FROM public.ai_memories m
    LEFT JOIN semantic_search s ON s.id = m.id
    LEFT JOIN keyword_search k ON k.id = m.id
    WHERE s.id IS NOT NULL OR k.id IS NOT NULL
    ORDER BY similarity DESC
    LIMIT match_count;
$$;
```
