-- Drop safety related tables
DROP TABLE IF EXISTS safety_incidents CASCADE;
DROP TABLE IF EXISTS safety_incident_categories CASCADE;
DROP TABLE IF EXISTS safety_severities CASCADE;

-- Delete safety department if it exists
DELETE FROM departments WHERE name = 'safety';
