-- Migration 082: Dual-Technology Badges (QR + RFID) & Coal Trucks Access Support
-- Adds rfid_code column to badges for Chainway C66 RFID/NFC chip reading
-- Ensures fleet supports Coal Trucks and appropriate indexing for rapid gate verification

ALTER TABLE badges ADD COLUMN IF NOT EXISTS rfid_code text;
CREATE INDEX IF NOT EXISTS idx_badges_rfid_code ON badges(rfid_code);
CREATE INDEX IF NOT EXISTS idx_badges_lookup ON badges(qr_code, rfid_code);

-- Insert sample Coal Trucks if none exist
INSERT INTO fleet (fleet_code, vehicle_type, registration_number, make, model, status)
VALUES 
  ('CT-01', 'Coal Truck', 'ABC 123 GP', 'Scania', 'R500 6x4', 'Active'),
  ('CT-02', 'Coal Truck', 'DEF 456 GP', 'Volvo', 'FH16 8x4', 'Active'),
  ('CT-03', 'Coal Truck', 'GHI 789 GP', 'Mercedes-Benz', 'Actros 3352', 'Active')
ON CONFLICT (fleet_code) DO NOTHING;
