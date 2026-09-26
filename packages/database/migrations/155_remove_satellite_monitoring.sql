-- Migration 151: Remove Satellite Monitoring Department & Deformations
-- Dropping satellite monitoring tables and cleaning up department registry

DROP TABLE IF EXISTS satellite_insar_deformations CASCADE;

DELETE FROM departments WHERE name = 'satellite-monitoring';
