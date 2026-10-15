import { createServerSupabaseClient } from '@repo/supabase/server';
import { getOperationalToday } from '@repo/utils';
import { redirect } from 'next/navigation';
import { DrillingOperationsTable, type DrillOpRow } from './DrillingOperationsTable';

async function getDrillingOpsData() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: dept } = await supabase
    .from('departments')
    .select('id')
    .eq('name', 'drilling')
    .single();
  if (!dept) {
    return { drills: [], ops: [] as DrillOpRow[], operators: [], deptId: '' };
  }

  const today = getOperationalToday();

  const [{ data: drills }, { data: drillOps }, { data: operators }] = await Promise.all([
    supabase
      .from('machines')
      .select('id, name')
      .eq('machine_type', 'Drill Rig')
      .eq('active', true)
      .order('name'),
    supabase
      .from('drill_operations')
      .select(
        'id, machine_id, shift_type, operation_date, open_hours, close_hours, total_hours, holes, meters_drilled, operator_name, block_drilled, site, external_delays_minutes, standard_delays_hours, production_delays_minutes, engineering_delays_minutes, non_productional_delays, production_delays, engineering_delays, comments, notes, status'
      )
      .eq('department_id', dept.id)
      .eq('operation_date', today),
    supabase
      .from('employees')
      .select('id, full_name')
      .eq('department_id', dept.id)
      .order('full_name'),
  ]);

  const drillIds = (drills ?? []).map((d) => d.id);

  // Fetch Control Room machine_operations for Drill Rigs today as primary SSoT
  const { data: controlRoomOps } =
    drillIds.length > 0
      ? await supabase
          .from('machine_operations')
          .select(
            'id, machine_id, shift_type, shift_date, start_smu, end_smu, hours_worked, block_drilled, meters_drilled, holes_drilled, operator:operators(full_name), site:sites(name), delay_entries:delay_entries(duration_hours, deleted_at, delay_category:delay_categories(name))'
          )
          .in('machine_id', drillIds)
          .eq('shift_date', today)
          .order('created_at', { ascending: false })
      : { data: [] };

  // Merge Control Room operations + synced drill_operations keyed by `${machine_id}:${shift_type}`
  const mergedMap = new Map<string, DrillOpRow>();

  for (const op of drillOps ?? []) {
    const shift = (op.shift_type === 'night' ? 'night' : 'day') as 'day' | 'night';
    const key = `${op.machine_id}:${shift}`;
    mergedMap.set(key, {
      id: op.id,
      machine_id: op.machine_id,
      shift_type: shift,
      operation_date: op.operation_date,
      open_hours: op.open_hours != null ? Number(op.open_hours) : null,
      close_hours: op.close_hours != null ? Number(op.close_hours) : null,
      total_hours: op.total_hours != null ? Number(op.total_hours) : null,
      holes: op.holes != null ? Number(op.holes) : null,
      meters_drilled: op.meters_drilled != null ? Number(op.meters_drilled) : null,
      operator_name: op.operator_name ?? null,
      block_drilled: op.block_drilled ?? null,
      site: op.site ?? null,
      external_delays_minutes:
        Number(op.external_delays_minutes || op.non_productional_delays || 0) || null,
      standard_delays_hours:
        op.standard_delays_hours != null ? Number(op.standard_delays_hours) : null,
      production_delays_minutes:
        Number(op.production_delays_minutes || op.production_delays || 0) || null,
      engineering_delays_minutes:
        Number(op.engineering_delays_minutes || op.engineering_delays || 0) || null,
      comments: op.comments ?? op.notes ?? null,
      status: op.status ?? 'active',
    });
  }

  for (const cr of (controlRoomOps ?? []) as any[]) {
    const shift = (cr.shift_type === 'night' ? 'night' : 'day') as 'day' | 'night';
    const key = `${cr.machine_id}:${shift}`;
    const existing = mergedMap.get(key);

    const delays = Array.isArray(cr.delay_entries)
      ? cr.delay_entries.filter((d: any) => !d.deleted_at)
      : [];
    const extMin = delays
      .filter((d: any) => d.delay_category?.name === 'External')
      .reduce((s: number, d: any) => s + Number(d.duration_hours || 0) * 60, 0);
    const prodMin = delays
      .filter((d: any) => d.delay_category?.name === 'Production')
      .reduce((s: number, d: any) => s + Number(d.duration_hours || 0) * 60, 0);
    const engMin = delays
      .filter((d: any) => d.delay_category?.name === 'Engineering')
      .reduce((s: number, d: any) => s + Number(d.duration_hours || 0) * 60, 0);

    const startSmu = cr.start_smu != null ? Number(cr.start_smu) : (existing?.open_hours ?? null);
    const endSmu = cr.end_smu != null ? Number(cr.end_smu) : (existing?.close_hours ?? null);
    const totalHours =
      cr.hours_worked != null
        ? Number(cr.hours_worked)
        : startSmu != null && endSmu != null && endSmu >= startSmu
          ? endSmu - startSmu
          : (existing?.total_hours ?? null);

    mergedMap.set(key, {
      id: existing?.id ?? cr.id,
      machine_id: cr.machine_id,
      shift_type: shift,
      operation_date: cr.shift_date ?? today,
      open_hours: startSmu,
      close_hours: endSmu,
      total_hours: totalHours,
      holes: cr.holes_drilled != null ? Number(cr.holes_drilled) : (existing?.holes ?? 0),
      meters_drilled:
        cr.meters_drilled != null ? Number(cr.meters_drilled) : (existing?.meters_drilled ?? 0),
      operator_name: cr.operator?.full_name ?? existing?.operator_name ?? null,
      block_drilled: cr.block_drilled ?? existing?.block_drilled ?? null,
      site: cr.site?.name ?? existing?.site ?? null,
      external_delays_minutes: extMin || existing?.external_delays_minutes || null,
      standard_delays_hours: existing?.standard_delays_hours ?? null,
      production_delays_minutes: prodMin || existing?.production_delays_minutes || null,
      engineering_delays_minutes: engMin || existing?.engineering_delays_minutes || null,
      comments: existing?.comments ?? 'Auto-synced from Control Room',
      status: endSmu != null ? 'completed' : 'active',
    });
  }

  return {
    drills: drills ?? [],
    ops: Array.from(mergedMap.values()),
    operators: operators ?? [],
    deptId: dept.id,
  };
}

export default async function DrillingOperationsPage() {
  const { drills, ops, operators, deptId } = await getDrillingOpsData();

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-[var(--text-heading)]">
            Drilling Shift Operations Report
          </h2>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Automatically compiled from Control Room machine operations (Meters, Site, Block, Holes
            &amp; SMR).
          </p>
        </div>
      </header>

      <DrillingOperationsTable
        departmentId={deptId}
        drills={drills}
        operators={operators}
        initialOps={ops}
      />
    </div>
  );
}
