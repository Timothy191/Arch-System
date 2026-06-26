-- ============================================
-- Department Requirements Verification
-- ============================================
-- Run in Supabase SQL Editor or:
--   psql $DATABASE_URL -f packages/database/verify_department_requirements.sql
-- Expected: all checks show passed = true
-- ============================================

\echo '=== Department slug registry ==='
SELECT
  d.name AS slug,
  d.display_name,
  d.icon,
  d.color,
  CASE WHEN d.personality IS NOT NULL THEN 'set' ELSE 'MISSING' END AS personality,
  CASE WHEN d.deleted_at IS NULL THEN 'active' ELSE 'deleted' END AS status
FROM departments d
WHERE d.name IN (
  'drilling', 'production', 'access-control', 'access-card-actions',
  'engineering', 'control-room', 'safety', 'training',
  'satellite-monitoring', 'admin'
)
ORDER BY d.name;

\echo ''
\echo '=== Missing hub departments (should return 0 rows) ==='
SELECT slug FROM (
  VALUES
    ('drilling'), ('production'), ('access-control'), ('access-card-actions'),
    ('engineering'), ('control-room'), ('safety'), ('training'),
    ('satellite-monitoring'), ('admin')
) AS expected(slug)
WHERE slug NOT IN (
  SELECT name FROM departments WHERE deleted_at IS NULL
);

\echo ''
\echo '=== Automated requirement checks ==='
SELECT
  check_name,
  passed,
  detail,
  CASE WHEN passed THEN 'PASS' ELSE 'FAIL' END AS result
FROM check_department_requirements()
ORDER BY passed ASC, check_name;

\echo ''
\echo '=== Failed checks only ==='
SELECT check_name, detail
FROM check_department_requirements()
WHERE NOT passed
ORDER BY check_name;

\echo ''
\echo '=== Department → table matrix ==='
SELECT
  r.department_slug,
  t.table_name,
  CASE WHEN ist.table_name IS NOT NULL THEN 'exists' ELSE 'MISSING' END AS table_status
FROM department_schema_requirements r
CROSS JOIN LATERAL unnest(r.required_tables) AS t(table_name)
LEFT JOIN information_schema.tables ist
  ON ist.table_schema = 'public' AND ist.table_name = t.table_name
ORDER BY r.department_slug, t.table_name;

\echo ''
\echo '=== Admin department access ==='
SELECT
  e.full_name,
  e.role,
  array_length(e.accessible_departments, 1) AS accessible_count,
  (SELECT COUNT(*) FROM departments WHERE deleted_at IS NULL) AS total_departments
FROM employees e
WHERE e.role = 'admin';
