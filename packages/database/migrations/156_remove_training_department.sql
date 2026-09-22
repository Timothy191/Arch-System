-- Drop training related tables
DROP TABLE IF EXISTS training_courses CASCADE;
DROP TABLE IF EXISTS training_certifications CASCADE;

-- Delete training department if it exists
DELETE FROM departments WHERE name = 'training';
