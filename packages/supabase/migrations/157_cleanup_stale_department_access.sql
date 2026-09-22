-- Migration 153: Purge Stale Department Permissions
-- Removes pruned department UUIDs (safety, training, satellite-monitoring) from employee accessible_departments arrays and purges department entries

UPDATE public.employees
SET accessible_departments = array_remove(
  array_remove(
    array_remove(accessible_departments, '516ab006-c7ce-4c0e-ba5a-501d82cf8734'::uuid),
    '47540f48-43ff-40bd-97fa-be25a6d1ae31'::uuid
  ),
  '89af13e7-3b75-4ee7-99cb-31a179a74c78'::uuid
)
WHERE '516ab006-c7ce-4c0e-ba5a-501d82cf8734' = ANY(accessible_departments)
   OR '47540f48-43ff-40bd-97fa-be25a6d1ae31' = ANY(accessible_departments)
   OR '89af13e7-3b75-4ee7-99cb-31a179a74c78' = ANY(accessible_departments);

DELETE FROM public.departments WHERE name IN ('safety', 'training', 'satellite-monitoring');
