import type { SupabaseClient } from '@supabase/supabase-js';

const MACHINE_BASELINE_SMR: Record<
  string,
  { prevStart: number; prevClose: number; currClose: number }
> = {
  'BD-19': { prevStart: 4120.0, prevClose: 4129.5, currClose: 4138.0 },
  'DR-001': { prevStart: 1408.5, prevClose: 1420.0, currClose: 1431.5 },
  'DR-002': { prevStart: 2150.0, prevClose: 2160.5, currClose: 2171.0 },
  'DT-101': { prevStart: 3240.0, prevClose: 3250.5, currClose: 3261.0 },
  'DT-102': { prevStart: 2890.0, prevClose: 2900.0, currClose: 2910.5 },
  'EX-501': { prevStart: 5410.0, prevClose: 5421.0, currClose: 5432.0 },
  'GEN-A': { prevStart: 1852.0, prevClose: 1864.0, currClose: 1876.0 },
  'GEN-B': { prevStart: 1620.0, prevClose: 1631.5, currClose: 1643.0 },
};

export async function seedControlRoom(supabase: SupabaseClient): Promise<void> {
  console.log('--> Seeding Control Room department data & fleet SMR baselines...');

  const { data: dept, error: deptError } = await supabase
    .from('departments')
    .select('id')
    .eq('name', 'control-room')
    .single();

  if (deptError || !dept) {
    console.error('   [Control Room] Department not found in database.');
    return;
  }

  const { data: machines } = await supabase
    .from('machines')
    .select('id, name, machine_type, department_id, site_id')
    .eq('active', true)
    .order('name');

  if (!machines || machines.length === 0) {
    console.error('   [Control Room] No valid machines found for seeding.');
    return;
  }

  const { data: operators } = await supabase
    .from('operators')
    .select('id, full_name')
    .eq('active', true)
    .order('full_name')
    .limit(1);

  const defaultOperator = operators?.[0];

  const now = new Date();
  const today = now.toISOString().split('T')[0]!;
  const yesterdayDate = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]!;

  const haulTruck =
    machines.find((m) => m.machine_type === 'Dump Truck' || m.machine_type === 'ADT') ??
    machines[0]!;

  // 1. Hourly Loads (12-hour shift format)
  const hourlyPayload = {
    department_id: dept.id,
    machine_id: haulTruck.id,
    load_date: today,
    shift_type: 'day',
    hour_01: 22,
    hour_02: 28,
    hour_03: 31,
    hour_04: 35,
    hour_05: 30,
    hour_06: 27,
    hour_07: 34,
    hour_08: 38,
    hour_09: 29,
    hour_10: 33,
    hour_11: 36,
    hour_12: 30,
  };

  const { data: existingHourlyLoad } = await supabase
    .from('hourly_loads')
    .select('id')
    .eq('machine_id', haulTruck.id)
    .eq('load_date', today)
    .eq('shift_type', 'day')
    .limit(1)
    .maybeSingle();

  const { error: loadError } = existingHourlyLoad?.id
    ? await supabase.from('hourly_loads').update(hourlyPayload).eq('id', existingHourlyLoad.id)
    : await supabase.from('hourly_loads').insert(hourlyPayload);

  if (loadError) {
    console.error('   [Control Room] Hourly loads seed error:', loadError.message);
  } else {
    console.log('   ✓ Hourly loads seeded successfully (12-hour day shift).');
  }

  // 2. Machine Operations with continuous SMR (Previous Close SMR -> Current Start SMR -> Current Close SMR)
  let seededCount = 0;
  for (let i = 0; i < machines.length; i++) {
    const m = machines[i]!;
    const fallbackStart = 1000.0 + (i + 1) * 250.0;
    const smr = MACHINE_BASELINE_SMR[m.name] ?? {
      prevStart: fallbackStart,
      prevClose: fallbackStart + 10.5,
      currClose: fallbackStart + 21.0,
    };
    const isDrill = m.machine_type === 'Drill Rig';

    const shiftRows = [
      {
        department_id: dept.id,
        machine_id: m.id,
        operator_id: defaultOperator?.id ?? null,
        operator_name: defaultOperator?.full_name ?? 'Shift Operator',
        site_id: m.site_id ?? null,
        shift_date: yesterdayDate,
        shift_type: 'night',
        start_time: '18:00:00',
        end_time: '06:00:00',
        start_smu: smr.prevStart,
        end_smu: smr.prevClose,
        holes_drilled: isDrill ? 16 : null,
        meters_drilled: isDrill ? 212.0 : null,
        block_drilled: isDrill ? 'Pit-A-Bench-03' : null,
      },
      {
        department_id: dept.id,
        machine_id: m.id,
        operator_id: defaultOperator?.id ?? null,
        operator_name: defaultOperator?.full_name ?? 'Shift Operator',
        site_id: m.site_id ?? null,
        shift_date: today,
        shift_type: 'day',
        start_time: '06:00:00',
        end_time: '18:00:00',
        start_smu: smr.prevClose,
        end_smu: smr.currClose,
        holes_drilled: isDrill ? 18 : null,
        meters_drilled: isDrill ? 234.5 : null,
        block_drilled: isDrill ? 'Pit-A-Bench-04' : null,
      },
    ];

    for (const row of shiftRows) {
      const { data: existing } = await supabase
        .from('machine_operations')
        .select('id')
        .eq('machine_id', row.machine_id)
        .eq('shift_date', row.shift_date)
        .eq('shift_type', row.shift_type)
        .limit(1)
        .maybeSingle();

      if (existing?.id) {
        const { error: updErr } = await supabase
          .from('machine_operations')
          .update(row)
          .eq('id', existing.id);
        if (!updErr) seededCount++;
      } else {
        const { error: insErr } = await supabase.from('machine_operations').insert(row);
        if (!insErr) seededCount++;
      }
    }
  }

  console.log(
    `   ✓ Seeded ${seededCount} machine operation SMR records across ${machines.length} active machines.`
  );
}
