#!/usr/bin/env node

/**
 * seed-access-logs.mjs
 *
 * Seeds realistic employee access and attendance logs into `access_logs`
 * across morning clock-ins, pit checkpoints, and gate movements.
 */

import { createRequire } from 'node:module';

const require = createRequire(`${process.cwd()}/packages/supabase/index.js`);
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const GATES = [
  'Main Gate North Turnstile',
  'East Pit Boom Gate',
  'South Haul Road Turnstile',
  'Weighbridge Inbound',
  'Processing Plant Turnstile',
];

const DEVICES = ['C66-GATE-NORTH-01', 'C66-PIT-EAST-02', 'GATE-TERMINAL-01', 'C66-PLANT-03'];

async function seed() {
  console.log('Seeding attendance access logs...');

  // 1. Fetch key badges
  const { data: badges } = await supabase
    .from('badges')
    .select('id, qr_code, rfid_code, entity_type, personnel_id, department_id')
    .not('personnel_id', 'is', null)
    .limit(15);

  if (!badges || badges.length === 0) {
    console.error('No badges found to seed');
    return;
  }

  const logsToInsert = [];
  const now = Date.now();

  // Create scans for each employee
  for (let i = 0; i < badges.length; i++) {
    const badge = badges[i];
    const isAlice = badge.qr_code === 'BADGE-EMP-ALICE';

    // Morning Clock-In (between 06:15 and 07:15 today)
    const morningOffsetMs = (badges.length - i) * 180000 + 7200000; // ~2-3 hours ago
    const morningTime = new Date(now - morningOffsetMs).toISOString();

    logsToInsert.push({
      badge_id: badge.id,
      access_type: 'personnel',
      direction: 'IN',
      gate_location: GATES[0],
      access_granted: true,
      denial_reason: null,
      department_id: badge.department_id,
      alcohol_tested: 'Approved',
      operator: 'Officer S. Dlamini',
      device_id: DEVICES[0],
      scanned_at: morningTime,
    });

    // Checkpoint scan in pit or plant (~1-2 hours ago)
    const midOffsetMs = morningOffsetMs - 3600000;
    if (midOffsetMs > 0) {
      logsToInsert.push({
        badge_id: badge.id,
        access_type: 'personnel',
        direction: 'IN',
        gate_location: isAlice ? GATES[1] : GATES[i % GATES.length],
        access_granted: true,
        denial_reason: null,
        department_id: badge.department_id,
        alcohol_tested: 'Approved',
        operator: 'Operator Guard M. Sithole',
        device_id: isAlice ? DEVICES[1] : DEVICES[i % DEVICES.length],
        scanned_at: new Date(now - midOffsetMs).toISOString(),
      });
    }

    // For a few employees, create a lunch/break clock-out and clock-in
    if (i % 3 === 0) {
      const outTime = new Date(now - 1800000).toISOString(); // 30 min ago
      logsToInsert.push({
        badge_id: badge.id,
        access_type: 'personnel',
        direction: 'OUT',
        gate_location: GATES[0],
        access_granted: true,
        denial_reason: null,
        department_id: badge.department_id,
        alcohol_tested: 'Approved',
        operator: 'Officer S. Dlamini',
        device_id: DEVICES[0],
        scanned_at: outTime,
      });

      // Return IN
      const inTime = new Date(now - 600000).toISOString(); // 10 min ago
      logsToInsert.push({
        badge_id: badge.id,
        access_type: 'personnel',
        direction: 'IN',
        gate_location: GATES[0],
        access_granted: true,
        denial_reason: null,
        department_id: badge.department_id,
        alcohol_tested: 'Approved',
        operator: 'Officer S. Dlamini',
        device_id: DEVICES[0],
        scanned_at: inTime,
      });
    }
  }

  // Insert a simulated denial event (e.g. unknown tag or expired contractor)
  logsToInsert.push({
    badge_id: null,
    access_type: 'UNKNOWN',
    direction: 'IN',
    gate_location: GATES[0],
    access_granted: false,
    denial_reason: 'DENIED - Unrecognized Badge / RFID',
    department_id: null,
    alcohol_tested: 'Not Tested',
    operator: 'Officer S. Dlamini',
    device_id: DEVICES[0],
    scanned_at: new Date(now - 900000).toISOString(),
  });

  const { data: inserted, error: insertError } = await supabase
    .from('access_logs')
    .insert(logsToInsert)
    .select('id');

  if (insertError) {
    console.error('Failed to seed access logs:', insertError);
  } else {
    console.log(`Successfully seeded ${inserted.length} attendance access log records!`);
  }
}

seed();
