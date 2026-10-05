-- Migration to add excavator_id to hourly_loads table
ALTER TABLE hourly_loads 
ADD COLUMN IF NOT EXISTS excavator_id UUID REFERENCES machines(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_hourly_loads_excavator_id ON hourly_loads(excavator_id);

COMMENT ON COLUMN hourly_loads.excavator_id IS 'Assigned excavator for the load run, providing site/location context.';
