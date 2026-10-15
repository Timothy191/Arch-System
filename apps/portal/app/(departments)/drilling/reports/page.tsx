import '@/styles/print-report.css';
import { GlassCard } from '@repo/ui/GlassCard';
import { Input } from '@repo/ui/Input';
import { SecondaryButton } from '@repo/ui/SecondaryButton';
import { AlertTriangle, ClipboardList, Clock, Drill, Radio } from 'lucide-react';
import { getDepartmentContext } from '~/lib/dept-context';

interface DrillingReportsPageProps {
  params: Promise<{ department: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}

interface CompiledDrillReportRow {
  id: string;
  machine_id: string;
  machine_name: string;
  operation_date: string;
  shift_type: string;
  operator_name: string | null;
  site: string | null;
  block_drilled: string | null;
  total_hours: number | null;
  holes: number;
  meters_drilled: number;
  production_delays: number;
  non_productional_delays: number;
  engineering_delays: number;
  status: string;
}

export default async function DrillingReportsPage({
  params,
  searchParams,
}: DrillingReportsPageProps) {
  // Use params but specify "drilling" for dept context since this is the dedicated drilling directory
  await params;
  const { from: fromParam, to: toParam } = await searchParams;
  const { deptId, supabase } = await getDepartmentContext({
    department: 'drilling',
  });

  const to = toParam || new Date().toISOString().split('T')[0];
  const from = fromParam || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];

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
        delay_blasting,
        delay_no_operator,
        delay_natural,
        delay_tramming,
        delay_get,
        delay_mechanical,
        delay_electrical,
        delay_hydraulic,
        delay_scheduled_maintenance,
        delay_unscheduled_maintenance,
        delay_supply,
        delay_power,
        delay_other,
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

    const prodSub =
      (Number(op.delay_blasting) || 0) +
      (Number(op.delay_no_operator) || 0) +
      (Number(op.delay_natural) || 0) +
      (Number(op.delay_tramming) || 0) +
      (Number(op.delay_get) || 0);
    const nonProdSub =
      (Number(op.delay_supply) || 0) +
      (Number(op.delay_power) || 0) +
      (Number(op.delay_other) || 0);
    const engSub =
      (Number(op.delay_mechanical) || 0) +
      (Number(op.delay_electrical) || 0) +
      (Number(op.delay_hydraulic) || 0) +
      (Number(op.delay_scheduled_maintenance) || 0) +
      (Number(op.delay_unscheduled_maintenance) || 0);

    const production_delays =
      Number(op.production_delays_minutes) || Number(op.production_delays) || prodSub || 0;
    const non_productional_delays =
      Number(op.external_delays_minutes) || Number(op.non_productional_delays) || nonProdSub || 0;
    const engineering_delays =
      Number(op.engineering_delays_minutes) || Number(op.engineering_delays) || engSub || 0;

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

  for (const cr of (controlRoomOps ?? []) as any[]) {
    const shift = cr.shift_type || 'day';
    const key = `${cr.machine_id}:${cr.shift_date}:${shift}`;
    const existing = compiledMap.get(key);

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

    const startSmu = cr.start_smu != null ? Number(cr.start_smu) : null;
    const endSmu = cr.end_smu != null ? Number(cr.end_smu) : null;
    const calcHours =
      cr.hours_worked != null
        ? Number(cr.hours_worked)
        : startSmu != null && endSmu != null && endSmu >= startSmu
          ? endSmu - startSmu
          : (existing?.total_hours ?? null);

    compiledMap.set(key, {
      id: existing?.id ?? cr.id,
      machine_id: cr.machine_id,
      machine_name: existing?.machine_name || drillNameMap.get(cr.machine_id) || 'Unknown',
      operation_date: cr.shift_date,
      shift_type: shift,
      operator_name: cr.operator?.full_name ?? existing?.operator_name ?? null,
      site: cr.site?.name ?? existing?.site ?? null,
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

  const totalMeters =
    operations.reduce((sum, op) => sum + (Number(op.meters_drilled) || 0), 0) || 0;
  const totalHoles = operations.reduce((sum, op) => sum + (Number(op.holes) || 0), 0) || 0;
  const totalHours = operations.reduce((sum, op) => sum + (Number(op.total_hours) || 0), 0) || 0;
  const totalDelays =
    operations.reduce(
      (sum, op) => sum + op.production_delays + op.non_productional_delays + op.engineering_delays,
      0
    ) || 0;

  function formatDelay(minutes: number): string {
    if (!minutes || minutes === 0) return '—';
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  }

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
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-2xl font-bold text-[var(--text-heading)]">
              Drilling Production Report
            </h2>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded-full bg-accent-green/10 text-accent-green border border-accent-green/20">
              <Radio className="w-3 h-3" />
              Auto-Built from Control Room
            </span>
          </div>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Automatically compiled from Control Room machine operations (Meters, Site, Block, Holes
            &amp; Operating Hours)
          </p>
        </div>
        <SecondaryButton variant="rounded-lg" size="sm" asChild>
          <a
            href={`data:text/csv;charset=utf-8,${encodeURIComponent(csvContent)}`}
            download={`drilling-report-${from}-to-${to}.csv`}
          >
            Download CSV
          </a>
        </SecondaryButton>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <GlassCard>
          <div className="flex items-center gap-2">
            <Drill className="w-4 h-4 text-accent-green" />
            <p className="text-[var(--text-muted)] text-sm font-medium">Total Meters Drilled</p>
          </div>
          <p className="text-2xl font-semibold text-accent-green mt-2">{totalMeters.toFixed(1)}m</p>
        </GlassCard>
        <GlassCard>
          <div className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-[var(--accent-blue)]" />
            <p className="text-[var(--text-muted)] text-sm font-medium">Total Holes Drilled</p>
          </div>
          <p className="text-2xl font-semibold text-[var(--accent-blue)] mt-2">{totalHoles}</p>
        </GlassCard>
        <GlassCard>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-cyan-400" />
            <p className="text-[var(--text-muted)] text-sm font-medium">Total Operating Hours</p>
          </div>
          <p className="text-2xl font-semibold text-cyan-400 mt-2">{totalHours.toFixed(1)}h</p>
        </GlassCard>
        <GlassCard>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-accent-blue" />
            <p className="text-[var(--text-muted)] text-sm font-medium">Total Delays</p>
          </div>
          <p className="text-2xl font-semibold text-accent-blue mt-2">{formatDelay(totalDelays)}</p>
        </GlassCard>
      </div>

      {/* Date Filter */}
      <GlassCard>
        <form method="GET" className="flex items-end gap-4">
          <div className="flex-1 max-w-[200px]">
            <label className="block text-sm text-[var(--text-muted)] mb-1">From</label>
            <Input type="date" name="from" defaultValue={from} className="px-4 py-2" />
          </div>
          <div className="flex-1 max-w-[200px]">
            <label className="block text-sm text-[var(--text-muted)] mb-1">To</label>
            <Input type="date" name="to" defaultValue={to} className="px-4 py-2" />
          </div>
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-heading)] text-sm font-medium hover:bg-[var(--bg-tertiary)] transition-colors"
          >
            Update
          </button>
        </form>
      </GlassCard>

      {/* Report Table */}
      <GlassCard className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[var(--border-subtle)]">
                <th
                  scope="col"
                  className="px-6 py-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider"
                >
                  Date
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider"
                >
                  Shift
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider"
                >
                  Drill Rig
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider"
                >
                  Operator
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider"
                >
                  Site
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider"
                >
                  Block
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider text-right"
                >
                  Hours
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider text-right"
                >
                  Holes
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider text-right"
                >
                  Meters
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider text-right"
                >
                  Delays
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider text-center"
                >
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-default)]">
              {operations.map((op) => {
                const totalOpDelays =
                  op.production_delays + op.non_productional_delays + op.engineering_delays;
                return (
                  <tr key={op.id} className="hover:bg-[var(--bg-tertiary)] transition-colors">
                    <td className="px-6 py-4 text-[var(--text-heading)] text-sm">
                      {op.operation_date}
                    </td>
                    <td className="px-6 py-4 text-[var(--text-body)] text-sm capitalize">
                      {op.shift_type}
                    </td>
                    <td className="px-6 py-4 text-[var(--text-body)] text-sm font-medium">
                      {op.machine_name}
                    </td>
                    <td className="px-6 py-4 text-[var(--text-body)] text-sm">
                      {op.operator_name || '—'}
                    </td>
                    <td className="px-6 py-4 text-[var(--text-body)] text-sm">{op.site || '—'}</td>
                    <td className="px-6 py-4 text-[var(--text-heading)] text-sm font-medium">
                      {op.block_drilled || '—'}
                    </td>
                    <td className="px-6 py-4 text-[var(--text-muted)] text-sm text-right">
                      {op.total_hours ? op.total_hours.toFixed(1) : '—'}
                    </td>
                    <td className="px-6 py-4 text-[var(--accent-blue)] text-sm text-right font-medium">
                      {op.holes || 0}
                    </td>
                    <td className="px-6 py-4 text-accent-green text-sm text-right font-medium">
                      {op.meters_drilled ? Number(op.meters_drilled).toFixed(1) : '—'}
                    </td>
                    <td className="px-6 py-4 text-accent-blue text-sm text-right">
                      {formatDelay(totalOpDelays)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full border ${
                          op.status === 'active' || op.status === 'completed'
                            ? 'bg-emerald-50/70 border-emerald-200/50 text-emerald-700'
                            : op.status === 'maintenance'
                              ? 'bg-amber-50/70 border-amber-200/50 text-amber-700'
                              : 'bg-red-50/70 border-red-200/50 text-red-700'
                        }`}
                      >
                        {op.status === 'active' && (
                          <span className="badge-pulse-dot bg-emerald-500" />
                        )}
                        {op.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {operations.length === 0 && (
                <tr>
                  <td
                    colSpan={11}
                    className="px-6 py-12 text-center text-[var(--text-muted)] text-sm"
                  >
                    No drilling data found for the selected date range.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
}
