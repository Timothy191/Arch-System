-- Assign existing machines to existing sites to ensure Machine-to-Site linkage is populated
-- This fulfills the requirement to "populate from all the required setup ensure we can add / remove or other from machine to sites"

DO $$
DECLARE
    site_rec RECORD;
    machine_rec RECORD;
    site_ids uuid[];
    i INT := 1;
    num_sites INT;
BEGIN
    -- Gather all active site IDs
    SELECT array_agg(id) INTO site_ids FROM sites WHERE active = true;
    num_sites := array_length(site_ids, 1);

    IF num_sites > 0 THEN
        -- Assign sites to machines round-robin
        FOR machine_rec IN SELECT id FROM machines WHERE site_id IS NULL AND active = true LOOP
            UPDATE machines 
            SET site_id = site_ids[i]
            WHERE id = machine_rec.id;
            
            i := i + 1;
            IF i > num_sites THEN
                i := 1;
            END IF;
        END LOOP;
    END IF;
END $$;
