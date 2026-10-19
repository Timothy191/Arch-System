-- Migration: 185_fleet_machine_fields_and_bin_factors.sql
-- Description: Add manufacturer, starting_smr, bin_factor_waste, and bin_factor_coal to machines table

ALTER TABLE public.machines
  ADD COLUMN IF NOT EXISTS manufacturer TEXT,
  ADD COLUMN IF NOT EXISTS starting_smr NUMERIC(10, 1) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bin_factor_waste NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS bin_factor_coal NUMERIC(10, 2);

COMMENT ON COLUMN public.machines.manufacturer IS 'Machine manufacturer (e.g. Caterpillar, Komatsu, Bell, Volvo)';
COMMENT ON COLUMN public.machines.starting_smr IS 'Starting Service Meter Reading (SMR) hours when commissioned on site';
COMMENT ON COLUMN public.machines.bin_factor_waste IS 'Bin payload factor for Waste material (BCM/tonnes per load)';
COMMENT ON COLUMN public.machines.bin_factor_coal IS 'Bin payload factor for Coal material (BCM/tonnes per load)';

-- Backfill bin_factor_waste from legacy bin_factor where present
UPDATE public.machines
SET bin_factor_waste = bin_factor
WHERE bin_factor IS NOT NULL AND bin_factor_waste IS NULL;
