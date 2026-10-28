import { getUserSafely } from '@repo/supabase/server';
import { Button } from '@repo/ui/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@repo/ui/components/ui/table';
import { GlassCard } from '@repo/ui/GlassCard';
import {
  Activity,
  AlertTriangle,
  Archive,
  ArrowDown,
  BarChart3,
  Calendar,
  Clock,
  Database,
  Droplets,
  Gauge,
  Layers,
  Thermometer,
  TrendingUp,
} from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getDepartmentContext } from '~/lib/dept-context';

interface TelemetryRecord {
  period: string;
  machine_id: string;
  machine_name: string;
  avg_engine_rpm: number | null;
  avg_engine_temp: number | null;
  avg_hydraulic_pressure: number | null;
  max_bit_depth: number | null;
  max_hole_depth: number | null;
  avg_penetration_rate: number | null;
  total_alerts: number;
  record_count: number;
}

interface ArchivedMonth {
  id: string;
  year_month: string;
  machine_name: string;
  archived_at: string;
  record_count: number;
}

interface DrillMonthlySummary {
  machine_id: string;
  machine_name: string;
  scheduled_hours: number | null;
  downtime_hours: number | null;
  productive_hours: number | null;
  availability_pct: number | null;
  utilization_pct: number | null;
}

async function getTelemetryData(selectedMachineId?: string): Promise<{
  currentMonth: string;
  telemetry: TelemetryRecord[];
  archives: ArchivedMonth[];
  drills: { id: string; name: string }[];
  monthlySummary: DrillMonthlySummary[];
}> {
  const { deptId, supabase } = await getDepartmentContext({
    department: 'drilling',
  });

  const user = await getUserSafely(supabase);
  if (!user) {
    redirect('/login');
  }

  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

  // Parallel fetch: all drill rigs (active + inactive in 1 query), telemetry, archives, monthly summary
  const [
    { data: allDrillMachines },
    { data: telemetry },
    { data: archives },
    { data: monthlySummary },
  ] = await Promise.all([
    supabase
      .from('machines')
      .select('id, name, active')
      .eq('machine_type', 'Drill Rig')
      .order('name'),
    supabase.rpc('get_telemetry_summary', {
      p_department_id: deptId,
      p_machine_id: selectedMachineId || null,
      p_granularity: 'day',
    }),
    supabase
      .from('machine_telemetry_archive')
      .select('id, year_month, archived_at, record_count, machine_id')
      .eq('department_id', deptId)
      .order('archived_at', { ascending: false })
      .limit(12),
    supabase.rpc('get_drill_monthly_summary', {
      p_department_id: deptId,
      p_year_month: currentMonth,
    }),
  ]);

  const drills = (allDrillMachines || [])
    .filter((m) => m.active)
    .map((m) => ({ id: m.id, name: m.name }));
  const machineNameMap = new Map((allDrillMachines || []).map((m) => [m.id, m.name]));

  const transformedArchives: ArchivedMonth[] = (archives || []).map((a) => ({
    id: a.id,
    year_month: a.year_month,
    machine_name: machineNameMap.get(a.machine_id) || 'Unknown',
    archived_at: a.archived_at,
    record_count: a.record_count,
  }));

  return {
    currentMonth,
    telemetry: (telemetry || []) as TelemetryRecord[],
    archives: transformedArchives,
    drills: drills || [],
    monthlySummary: (monthlySummary || []) as DrillMonthlySummary[],
  };
}

function formatNumber(num: number | null | undefined, decimals: number = 1): string {
  if (num === null || num === undefined) return '—';
  return num.toFixed(decimals);
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split('-');
  if (!year || !month) return yearMonth;
  const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

interface MachineTelemetryPageProps {
  searchParams: Promise<{ machineId?: string }>;
}

export default async function MachineTelemetryPage({ searchParams }: MachineTelemetryPageProps) {
  const { machineId } = await searchParams;
  const selectedMachineId = machineId === 'all' ? undefined : machineId;
  const { currentMonth, telemetry, archives, drills, monthlySummary } =
    await getTelemetryData(selectedMachineId);

  // Calculate monthly totals
  const totalRecords = telemetry.reduce((sum, t) => sum + (t.record_count || 0), 0);
  const totalAlerts = telemetry.reduce((sum, t) => sum + (t.total_alerts || 0), 0);
  const avgPenetration =
    telemetry.length > 0
      ? telemetry.reduce((sum, t) => sum + (t.avg_penetration_rate || 0), 0) / telemetry.length
      : 0;
  const maxBitDepth = Math.max(...telemetry.map((t) => t.max_bit_depth || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-2xl text-[var(--text-heading)]">Machine Telemetry</h2>
          <div className="mt-1 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-[var(--text-muted)]" />
            <p className="text-[var(--text-muted)] text-sm">
              Current Period:{' '}
              <span className="font-medium text-[var(--accent-blue)]">
                {formatMonth(currentMonth)}
              </span>
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href="/drilling/drilling-operations">
            <Button variant="outline" className="border-[var(--border-subtle)]">
              <Activity className="mr-2 h-4 w-4" />
              Live Operations
            </Button>
          </Link>
          <Button className="bg-[var(--accent-blue)] hover:bg-[var(--accent-blue)]/90">
            <Gauge className="mr-2 h-4 w-4" />
            Export Data
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <GlassCard>
          <p className="font-medium text-[var(--text-muted)] text-xs uppercase tracking-wider">
            Active Drills
          </p>
          <p className="mt-1 font-bold text-2xl text-[var(--text-heading)]">{drills.length}</p>
        </GlassCard>
        <GlassCard>
          <p className="font-medium text-[var(--text-muted)] text-xs uppercase tracking-wider">
            Data Points
          </p>
          <p className="mt-1 font-bold text-2xl text-[var(--accent-blue)]">
            {totalRecords.toLocaleString()}
          </p>
        </GlassCard>
        <GlassCard>
          <p className="font-medium text-[var(--text-muted)] text-xs uppercase tracking-wider">
            Avg Penetration
          </p>
          <p className="mt-1 font-bold text-2xl text-accent-green">
            {formatNumber(avgPenetration, 2)} m/h
          </p>
        </GlassCard>
        <GlassCard>
          <p className="font-medium text-[var(--text-muted)] text-accent-red text-xs uppercase tracking-wider">
            Alerts
          </p>
          <p className="mt-1 font-bold text-2xl text-accent-red">{totalAlerts}</p>
        </GlassCard>
      </div>

      {/* Monthly Availability & Utilization Summary (auto-built from drill_operations) */}
      <GlassCard className="overflow-hidden p-0">
        <div className="flex items-center justify-between border-[var(--border-subtle)] border-b p-4">
          <div>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-[var(--accent-blue)]" />
              <h3 className="font-semibold text-[var(--text-heading)] text-lg">
                Monthly Availability &amp; Utilization
              </h3>
            </div>
            <p className="mt-1 text-[var(--text-muted)] text-sm">
              Auto-built from {formatMonth(currentMonth)} drill operations. Downtime = Standard +
              External + Production + Engineering delays.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-[var(--border-subtle)] border-b hover:bg-transparent">
                <TableHead className="font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider">
                  <Activity className="mr-1 inline h-3 w-3" />
                  Drill Rig
                </TableHead>
                <TableHead className="text-right font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider">
                  <Clock className="mr-1 inline h-3 w-3" />
                  Scheduled (h)
                </TableHead>
                <TableHead className="text-right font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider">
                  <TrendingUp className="mr-1 inline h-3 w-3" />
                  Productive (h)
                </TableHead>
                <TableHead className="text-right font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider">
                  <AlertTriangle className="mr-1 inline h-3 w-3" />
                  Downtime (h)
                </TableHead>
                <TableHead className="text-right font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider">
                  Availability %
                </TableHead>
                <TableHead className="text-right font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider">
                  Utilization %
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monthlySummary.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-[var(--text-muted)]">
                    <BarChart3 className="mx-auto mb-2 h-10 w-10 opacity-30" />
                    <p>No drill operations logged for {formatMonth(currentMonth)} yet.</p>
                    <p className="mt-1 text-sm">
                      Log shifts in Drilling Operations to populate the summary.
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                monthlySummary.map((s) => {
                  const scheduled = Number(s.scheduled_hours ?? 0);
                  const productive = Number(s.productive_hours ?? 0);
                  const downtime = Number(s.downtime_hours ?? 0);
                  const availabilityPct = s.availability_pct;
                  const utilizationPct = s.utilization_pct;

                  const availabilityClass =
                    availabilityPct === null
                      ? 'text-[var(--text-muted)]'
                      : availabilityPct >= 85
                        ? 'text-accent-green'
                        : availabilityPct >= 70
                          ? 'text-accent-blue'
                          : 'text-accent-red';

                  const utilizationClass =
                    utilizationPct === null
                      ? 'text-[var(--text-muted)]'
                      : utilizationPct >= 85
                        ? 'text-accent-green'
                        : utilizationPct >= 70
                          ? 'text-accent-blue'
                          : 'text-accent-red';

                  return (
                    <TableRow
                      key={s.machine_id}
                      className="border-[var(--border-subtle)] border-b hover:bg-[var(--bg-tertiary)]/30"
                    >
                      <TableCell className="font-medium text-[var(--text-heading)]">
                        {s.machine_name}
                      </TableCell>
                      <TableCell className="text-right text-[var(--text-body)] tabular-nums">
                        {scheduled > 0 ? scheduled.toFixed(2) : '—'}
                      </TableCell>
                      <TableCell className="text-right text-[var(--text-body)] tabular-nums">
                        {productive > 0 ? productive.toFixed(2) : '—'}
                      </TableCell>
                      <TableCell className="text-right text-[var(--text-body)] tabular-nums">
                        {downtime > 0 ? downtime.toFixed(2) : '—'}
                      </TableCell>
                      <TableCell
                        className={`text-right font-semibold tabular-nums ${availabilityClass}`}
                      >
                        {availabilityPct === null ? '—' : `${availabilityPct.toFixed(1)}%`}
                      </TableCell>
                      <TableCell
                        className={`text-right font-semibold tabular-nums ${utilizationClass}`}
                      >
                        {utilizationPct === null ? '—' : `${utilizationPct.toFixed(1)}%`}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </GlassCard>

      {/* Current Month Telemetry Table */}
      <GlassCard className="overflow-hidden p-0">
        <div className="flex flex-col gap-4 border-[var(--border-subtle)] border-b p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-semibold text-[var(--text-heading)] text-lg">
              {formatMonth(currentMonth)} Telemetry
            </h3>
            <p className="mt-1 text-[var(--text-muted)] text-sm">
              Daily aggregated telemetry data for active month
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            {/* Filter Dropdown */}
            <form method="GET" className="flex items-center gap-2">
              <label
                htmlFor="machineId"
                className="font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider"
              >
                Filter Rig:
              </label>
              <select
                id="machineId"
                name="machineId"
                defaultValue={machineId || 'all'}
                className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-2.5 py-1.5 text-[var(--text-heading)] text-sm focus:border-[var(--accent-blue)] focus:outline-none"
              >
                <option value="all">All Drill Rigs</option>
                {drills.map((drill) => (
                  <option key={drill.id} value={drill.id}>
                    {drill.name}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-tertiary)] px-2.5 py-1.5 font-semibold text-[var(--text-heading)] text-xs transition-colors hover:bg-[var(--border-subtle)]"
              >
                Apply
              </button>
            </form>

            <div className="flex items-center gap-2 border-[var(--border-subtle)] border-l pl-4">
              <TrendingUp className="h-5 w-5 text-accent-green" />
              <span className="text-[var(--text-body)] text-sm">
                Max Depth:{' '}
                <span className="font-semibold text-accent-green">
                  {formatNumber(maxBitDepth, 1)}m
                </span>
              </span>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-[var(--border-subtle)] border-b hover:bg-transparent">
                <TableHead className="font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider">
                  <Calendar className="mr-1 inline h-3 w-3 text-[var(--text-muted)]" />
                  Date
                </TableHead>
                <TableHead className="font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider">
                  <Activity className="mr-1 inline h-3 w-3 text-[var(--text-muted)]" />
                  Drill Rig
                </TableHead>
                <TableHead className="text-right font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider">
                  <Gauge className="mr-1 inline h-3 w-3 text-[var(--text-muted)]" />
                  Engine RPM
                </TableHead>
                <TableHead className="text-right font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider">
                  <Thermometer className="mr-1 inline h-3 w-3 text-[var(--text-muted)]" />
                  Temp (°C)
                </TableHead>
                <TableHead className="text-right font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider">
                  <Droplets className="mr-1 inline h-3 w-3 text-[var(--text-muted)]" />
                  Pressure
                </TableHead>
                <TableHead className="text-right font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider">
                  <ArrowDown className="mr-1 inline h-3 w-3 text-[var(--text-muted)]" />
                  Bit Depth
                </TableHead>
                <TableHead className="text-right font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider">
                  <Layers className="mr-1 inline h-3 w-3 text-[var(--text-muted)]" />
                  Hole Depth
                </TableHead>
                <TableHead className="text-right font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider">
                  <TrendingUp className="mr-1 inline h-3 w-3 text-[var(--text-muted)]" />
                  Pen. Rate
                </TableHead>
                <TableHead className="text-center font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider">
                  <AlertTriangle className="mr-1 inline h-3 w-3 text-[var(--text-muted)]" />
                  Alerts
                </TableHead>
                <TableHead className="text-right font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider">
                  <Database className="mr-1 inline h-3 w-3 text-[var(--text-muted)]" />
                  Records
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {telemetry.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="py-12 text-center text-[var(--text-muted)]">
                    <Activity className="mx-auto mb-3 h-12 w-12 opacity-30" />
                    <p>No telemetry data for {formatMonth(currentMonth)}</p>
                    <p className="mt-1 text-sm">
                      Data will appear once machines start reporting telemetry
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                telemetry.map((record) => {
                  const isHighRPM = record.avg_engine_rpm && record.avg_engine_rpm > 2100;
                  const isOverheating = record.avg_engine_temp && record.avg_engine_temp > 95;
                  const isWarm =
                    record.avg_engine_temp &&
                    record.avg_engine_temp > 85 &&
                    record.avg_engine_temp <= 95;

                  return (
                    <TableRow
                      key={`${record.machine_id}-${record.period}`}
                      className="border-[var(--border-subtle)] border-b hover:bg-[var(--bg-tertiary)]/50"
                    >
                      <TableCell className="font-semibold text-[var(--text-heading)]">
                        {formatDate(record.period)}
                      </TableCell>
                      <TableCell className="text-[var(--text-body)]">
                        {record.machine_name}
                      </TableCell>
                      <TableCell
                        className={`text-right font-medium ${isHighRPM ? 'text-accent-blue' : 'text-[var(--text-body)]'}`}
                      >
                        {formatNumber(record.avg_engine_rpm, 0)} rpm
                      </TableCell>
                      <TableCell
                        className={`text-right font-semibold ${isOverheating ? 'text-accent-red' : isWarm ? 'text-accent-blue' : 'text-[var(--text-body)]'}`}
                      >
                        {formatNumber(record.avg_engine_temp, 1)}°C
                      </TableCell>
                      <TableCell className="text-right font-medium text-[var(--text-body)]">
                        {formatNumber(record.avg_hydraulic_pressure, 0)} bar
                      </TableCell>
                      <TableCell className="text-right font-semibold text-accent-green">
                        {formatNumber(record.max_bit_depth, 1)}m
                      </TableCell>
                      <TableCell className="text-right font-semibold text-cyan-400">
                        {formatNumber(record.max_hole_depth, 1)}m
                      </TableCell>
                      <TableCell className="text-right font-medium text-[var(--text-body)]">
                        {formatNumber(record.avg_penetration_rate, 2)} m/h
                      </TableCell>
                      <TableCell className="text-center">
                        {record.total_alerts > 0 ? (
                          <span className="inline-flex rounded-full bg-accent-red/10 px-2 py-0.5 font-semibold text-accent-red text-xs">
                            {record.total_alerts}
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-accent-green/10 px-2 py-0.5 font-semibold text-accent-green text-xs">
                            0
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-[var(--text-muted)] text-sm">
                        {record.record_count}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </GlassCard>

      {/* Archived Months */}
      <GlassCard className="overflow-hidden p-0">
        <div className="border-[var(--border-subtle)] border-b p-4">
          <div className="flex items-center gap-2">
            <Archive className="h-5 w-5 text-[var(--text-muted)]" />
            <h3 className="font-semibold text-[var(--text-heading)] text-lg">Archived Months</h3>
          </div>
          <p className="mt-1 text-[var(--text-muted)] text-sm">
            Previous months telemetry data is automatically archived and preserved for safe keeping
          </p>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-[var(--border-subtle)] border-b hover:bg-transparent">
                <TableHead className="font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider">
                  <Calendar className="mr-1 inline h-3 w-3 text-[var(--text-muted)]" />
                  Month
                </TableHead>
                <TableHead className="font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider">
                  <Activity className="mr-1 inline h-3 w-3 text-[var(--text-muted)]" />
                  Drill Rig
                </TableHead>
                <TableHead className="text-right font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider">
                  <Database className="mr-1 inline h-3 w-3 text-[var(--text-muted)]" />
                  Records
                </TableHead>
                <TableHead className="text-right font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider">
                  <Archive className="mr-1 inline h-3 w-3 text-[var(--text-muted)]" />
                  Archived On
                </TableHead>
                <TableHead className="text-center font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {archives.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-[var(--text-muted)]">
                    <Archive className="mx-auto mb-2 h-8 w-8 opacity-30" />
                    <p>No archived telemetry data yet</p>
                    <p className="mt-1 text-sm">
                      Data is archived automatically when each month ends
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                archives.map((archive) => (
                  <TableRow
                    key={archive.id}
                    className="border-[var(--border-subtle)] border-b hover:bg-[var(--bg-tertiary)]/50"
                  >
                    <TableCell className="font-semibold text-[var(--text-heading)]">
                      {formatMonth(archive.year_month)}
                    </TableCell>
                    <TableCell className="text-[var(--text-body)]">
                      {archive.machine_name}
                    </TableCell>
                    <TableCell className="text-right font-medium text-[var(--text-body)]">
                      {archive.record_count.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right text-[var(--text-muted)] text-sm">
                      {formatDate(archive.archived_at)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-[var(--accent-blue)] hover:text-[var(--accent-blue)]/90"
                      >
                        View Summary
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </GlassCard>
    </div>
  );
}
