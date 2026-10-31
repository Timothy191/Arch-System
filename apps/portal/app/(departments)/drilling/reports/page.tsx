import { getCurrentShift } from '@repo/utils';
import { getDepartmentContext } from '~/lib/dept-context';
import {
  type CompiledDrillReportRow,
  DrillingReportsDashboardClient,
} from './DrillingReportsDashboardClient';

interface DrillingReportsPageProps {
  params: Promise<{ department: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}

interface ControlRoomDrillOpRow {
  id: string;
  machine_id: string;
  shift_type: string | null;
  shift_date: string;
  start_smu: number | null;
  end_smu: number | null;
  hours_worked: number | null;
  block_drilled: string | null;
  meters_drilled: number | null;
  holes_drilled: number | null;
  operator: { full_name: string } | { full_name: string }[] | null;
  site: { name: string } | { name: string }[] | null;
  delay_entries: Array<{
    duration_hours: number | null;
    deleted_at: string | null;
    delay_category: { name: string } | { name: string }[] | null;
  }> | null;
}

export default async function DrillingReportsPage({
  params,
  searchParams,
}: DrillingReportsPageProps) {
  await params;
  const { from: fromParam, to: toParam } = await searchParams;
  const { deptId, supabase, today } = await getDepartmentContext({
    department: 'drilling',
  });

  const to: string = toParam || today || new Date().toISOString().slice(0, 10);
  const from: string = fromParam || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const currentShift = getCurrentShift();

  const [{ data: drills }, { data: rawDrillOps }] = await Promise.all([
    supabase.from('machines').select('id, name').eq('machine_type', 'Drill Rig'),
    supabase
      .from('drill_operations')
      .select(
        `
        id,
        machine_id,
        shift_type,
        operation_date,
        open_hours,
        close_hours,
        total_hours,
        operator_name,
        site,
        block_drilled,
        holes,
        meters_drilled,
        production_delays,
        non_productional_delays,
        engineering_delays,
        production_delays_minutes,
        external_delays_minutes,
        engineering_delays_minutes,
        status,
        machines!inner(name)
      `
      )
      .eq('department_id', deptId)
      .gte('operation_date', from)
      .lte('operation_date', to)
      .order('operation_date', { ascending: false }),
  ]);

  const drillIds = (drills ?? []).map((d) => d.id);
  const drillRigNames = (drills ?? []).map((d) => d.name);
  const drillNameMap = new Map((drills ?? []).map((d) => [d.id, d.name]));

  // Also fetch Control Room machine_operations for Drill Rigs across [from, to]
  const { data: controlRoomOps } =
    drillIds.length > 0
      ? await supabase
          .from('machine_operations')
          .select(
            'id, machine_id, shift_type, shift_date, start_smu, end_smu, hours_worked, block_drilled, meters_drilled, holes_drilled, operator:operators(full_name), site:sites(name), delay_entries:delay_entries(duration_hours, deleted_at, delay_category:delay_categories(name))'
          )
          .in('machine_id', drillIds)
          .gte('shift_date', from)
          .lte('shift_date', to)
          .order('shift_date', { ascending: false })
      : { data: [] };

  const compiledMap = new Map<string, CompiledDrillReportRow>();

  for (const op of rawDrillOps ?? []) {
    const shift = op.shift_type || 'day';
    const key = `${op.machine_id}:${op.operation_date}:${shift}`;

    const production_delays =
      Number(op.production_delays_minutes) || Number(op.production_delays) || 0;
    const non_productional_delays =
      Number(op.external_delays_minutes) || Number(op.non_productional_delays) || 0;
    const engineering_delays =
      Number(op.engineering_delays_minutes) || Number(op.engineering_delays) || 0;

    compiledMap.set(key, {
      id: op.id,
      machine_id: op.machine_id,
      machine_name:
        (op.machines as unknown as { name: string } | undefined)?.name ||
        drillNameMap.get(op.machine_id) ||
        'Unknown',
      operation_date: op.operation_date,
      shift_type: shift,
      operator_name: op.operator_name ?? null,
      site: op.site ?? null,
      block_drilled: op.block_drilled ?? null,
      total_hours: op.total_hours != null ? Number(op.total_hours) : null,
      holes: Number(op.holes) || 0,
      meters_drilled: Number(op.meters_drilled) || 0,
      production_delays,
      non_productional_delays,
      engineering_delays,
      status: op.status || 'completed',
    });
  }

  for (const cr of (controlRoomOps ?? []) as unknown as ControlRoomDrillOpRow[]) {
    const shift = cr.shift_type || 'day';
    const key = `${cr.machine_id}:${cr.shift_date}:${shift}`;
    const existing = compiledMap.get(key);

    const delays = Array.isArray(cr.delay_entries)
      ? cr.delay_entries.filter((d) => !d.deleted_at)
      : [];
    const getCategoryName = (
      cat: { name: string } | { name: string }[] | null | undefined
    ): string | undefined => (Array.isArray(cat) ? cat[0]?.name : cat?.name);

    const extMin = delays
      .filter((d) => getCategoryName(d.delay_category) === 'External')
      .reduce((s, d) => s + Number(d.duration_hours || 0) * 60, 0);
    const prodMin = delays
      .filter((d) => getCategoryName(d.delay_category) === 'Production')
      .reduce((s, d) => s + Number(d.duration_hours || 0) * 60, 0);
    const engMin = delays
      .filter((d) => getCategoryName(d.delay_category) === 'Engineering')
      .reduce((s, d) => s + Number(d.duration_hours || 0) * 60, 0);

    const startSmu = cr.start_smu != null ? Number(cr.start_smu) : null;
    const endSmu = cr.end_smu != null ? Number(cr.end_smu) : null;
    const calcHours =
      cr.hours_worked != null
        ? Number(cr.hours_worked)
        : startSmu != null && endSmu != null && endSmu >= startSmu
          ? endSmu - startSmu
          : (existing?.total_hours ?? null);

    const operatorName = Array.isArray(cr.operator)
      ? cr.operator[0]?.full_name
      : cr.operator?.full_name;
    const siteName = Array.isArray(cr.site) ? cr.site[0]?.name : cr.site?.name;

    compiledMap.set(key, {
      id: existing?.id ?? cr.id,
      machine_id: cr.machine_id,
      machine_name: existing?.machine_name || drillNameMap.get(cr.machine_id) || 'Unknown',
      operation_date: cr.shift_date,
      shift_type: shift,
      operator_name: operatorName ?? existing?.operator_name ?? null,
      site: siteName ?? existing?.site ?? null,
      block_drilled: cr.block_drilled ?? existing?.block_drilled ?? null,
      total_hours: calcHours,
      holes: cr.holes_drilled != null ? Number(cr.holes_drilled) : (existing?.holes ?? 0),
      meters_drilled:
        cr.meters_drilled != null ? Number(cr.meters_drilled) : (existing?.meters_drilled ?? 0),
      production_delays: prodMin || existing?.production_delays || 0,
      non_productional_delays: extMin || existing?.non_productional_delays || 0,
      engineering_delays: engMin || existing?.engineering_delays || 0,
      status: endSmu != null ? 'completed' : 'active',
    });
  }

  const operations = Array.from(compiledMap.values()).sort((a, b) =>
    b.operation_date.localeCompare(a.operation_date)
  );

  const csvRows = [
    [
      'Date',
      'Shift',
      'Drill Rig',
      'Operator',
      'Site',
      'Block',
      'Hours Worked',
      'Holes Drilled',
      'Meters Drilled',
      'Prod Delays (min)',
      'Non-Prod Delays (min)',
      'Eng Delays (min)',
      'Status',
    ],
    ...operations.map((op) => [
      op.operation_date,
      op.shift_type,
      op.machine_name,
      op.operator_name || '',
      op.site || '',
      op.block_drilled || '',
      op.total_hours ? op.total_hours.toFixed(2) : '',
      op.holes || 0,
      op.meters_drilled ? Number(op.meters_drilled).toFixed(2) : '',
      op.production_delays || 0,
      op.non_productional_delays || 0,
      op.engineering_delays || 0,
      op.status,
    ]),
  ];

  const csvContent = csvRows
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  return (
    <DrillingReportsDashboardClient
      todayStr={today || to}
      fromDateStr={from}
      toDateStr={to}
      currentShift={currentShift}
      operations={operations}
      drillRigNames={drillRigNames}
      csvContent={csvContent}
    />
  );
}
