'use client';

import { createBrowserSupabaseClient } from '@repo/supabase/client';
import { Badge } from '@repo/ui/components/ui/badge';
import { Button } from '@repo/ui/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/ui/dialog';
import { Input } from '@repo/ui/components/ui/input';
import { GlassCard } from '@repo/ui/GlassCard';
import {
  AlertTriangle,
  Building2,
  ChevronDown,
  ClipboardList,
  Edit2,
  ExternalLink,
  Layers,
  MapPin,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  Truck,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  adminAddDepartment,
  adminArchiveDepartment,
  adminUpdateDepartment,
} from '../actions/departments';
import {
  buildDepartmentMetrics,
  computeDepartmentsOverview,
  type DepartmentAccessRecord,
  type DepartmentBreakdownRecord,
  type DepartmentDailyLogRecord,
  type DepartmentEmployeeRecord,
  type DepartmentMachineRecord,
  type DepartmentMetrics,
  type DepartmentRecord,
  type MineBlockRecord,
  type SiteRecord,
} from './departments-utils';

const HEADER_KPI_CARD_CLASS =
  'rounded-xl border border-accent-gold/25 bg-[var(--bg-secondary)] px-4 py-3';
const DETAIL_METRIC_CARD_CLASS =
  'rounded-xl border border-[var(--border-default)] bg-[var(--bg-primary)]/85 px-3.5 py-2.5 shadow-2xs';
const QUICK_LINK_PILL_CLASS =
  'inline-flex items-center gap-1 rounded-full border border-accent-gold/40 bg-[var(--bg-primary)] px-2.5 py-1 font-medium text-[11px] text-[var(--text-heading)] transition-colors hover:border-accent-gold hover:bg-accent-gold/10';
const RECENT_LOGS_PREVIEW_LIMIT = 250;

const DEPARTMENT_COLOR_OPTIONS = [
  'slate',
  'emerald',
  'amber',
  'blue',
  'gold',
  'teal',
  'indigo',
] as const;

const DEPARTMENT_ICON_OPTIONS = [
  'Building2',
  'Truck',
  'ShieldCheck',
  'Factory',
  'Wrench',
  'Database',
  'ClipboardList',
  'CreditCard',
  'Layers',
] as const;

function formatCreatedDate(isoTimestamp?: string | null): string {
  if (!isoTimestamp) return 'System Core';
  const parsed = new Date(isoTimestamp);
  if (Number.isNaN(parsed.getTime())) return 'System Core';
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function DepartmentsTab() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [departments, setDepartments] = useState<DepartmentRecord[]>([]);
  const [sites, setSites] = useState<SiteRecord[]>([]);
  const [mineBlocks, setMineBlocks] = useState<MineBlockRecord[]>([]);
  const [employees, setEmployees] = useState<DepartmentEmployeeRecord[]>([]);
  const [accessGrants, setAccessGrants] = useState<DepartmentAccessRecord[]>([]);
  const [machines, setMachines] = useState<DepartmentMachineRecord[]>([]);
  const [breakdowns, setBreakdowns] = useState<DepartmentBreakdownRecord[]>([]);
  const [dailyLogs, setDailyLogs] = useState<DepartmentDailyLogRecord[]>([]);
  const [exactTotalShiftLogs, setExactTotalShiftLogs] = useState<number | undefined>(undefined);
  const [exactLogsByDept, setExactLogsByDept] = useState<Readonly<Record<string, number>>>({});

  const [newDepartmentName, setNewDepartmentName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(() => new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [editingDept, setEditingDept] = useState<DepartmentRecord | null>(null);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editColor, setEditColor] = useState('slate');
  const [editIcon, setEditIcon] = useState('Building2');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const [pendingArchive, setPendingArchive] = useState<DepartmentRecord | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);

  const loadDepartmentsData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const logsHeadQuery = supabase
        .from('daily_logs')
        .select('id', { count: 'exact', head: true });
      const logsHeadPromise =
        logsHeadQuery && typeof (logsHeadQuery as PromiseLike<unknown>).then === 'function'
          ? logsHeadQuery
          : Promise.resolve({ count: null, error: null });

      const [
        deptRes,
        sitesRes,
        blocksRes,
        employeesRes,
        accessRes,
        machinesRes,
        breakdownsRes,
        logsRes,
        logsCountRes,
      ] = await Promise.all([
        supabase
          .from('departments')
          .select('id, name, display_name, description, color, icon, created_at')
          .is('deleted_at', null)
          .order('display_name', { ascending: true }),
        supabase
          .from('sites')
          .select('id, name, site_code, active, created_at')
          .is('deleted_at', null)
          .order('name', { ascending: true }),
        supabase
          .from('mine_blocks')
          .select('id, name, code, site_id, active')
          .is('deleted_at', null)
          .order('name', { ascending: true }),
        supabase
          .from('employees')
          .select('id, full_name, role, job_title, department_id, accessible_departments, areas')
          .is('deleted_at', null),
        supabase
          .from('employee_department_access')
          .select('department_id, employee_id, access_level'),
        supabase
          .from('machines')
          .select('id, name, machine_type, active, department_id, site_id, starting_smr')
          .is('deleted_at', null),
        supabase
          .from('breakdowns')
          .select('id, department_id, status, site_code, date_in, delay_hours')
          .is('deleted_at', null)
          .in('status', ['open', 'in_progress']),
        supabase
          .from('daily_logs')
          .select('id, department_id, log_date, shift')
          .order('log_date', { ascending: false })
          .limit(RECENT_LOGS_PREVIEW_LIMIT),
        logsHeadPromise,
      ]);

      const firstError =
        deptRes.error ??
        sitesRes?.error ??
        blocksRes?.error ??
        employeesRes?.error ??
        accessRes?.error ??
        machinesRes?.error ??
        breakdownsRes?.error ??
        logsRes?.error;

      if (firstError) {
        setErrorMessage(firstError.message);
        return;
      }

      const loadedDepartments = (deptRes.data as DepartmentRecord[] | null) ?? [];
      setDepartments(loadedDepartments);
      setSites((sitesRes?.data as SiteRecord[] | null) ?? []);
      setMineBlocks((blocksRes?.data as MineBlockRecord[] | null) ?? []);
      setEmployees((employeesRes?.data as DepartmentEmployeeRecord[] | null) ?? []);
      setAccessGrants((accessRes?.data as DepartmentAccessRecord[] | null) ?? []);
      setMachines((machinesRes?.data as DepartmentMachineRecord[] | null) ?? []);
      setBreakdowns((breakdownsRes?.data as DepartmentBreakdownRecord[] | null) ?? []);
      setDailyLogs((logsRes?.data as DepartmentDailyLogRecord[] | null) ?? []);

      if (
        logsCountRes &&
        'count' in logsCountRes &&
        typeof logsCountRes.count === 'number' &&
        !logsCountRes.error
      ) {
        setExactTotalShiftLogs(logsCountRes.count);
      } else {
        setExactTotalShiftLogs(undefined);
      }

      // Query exact per-department shift log head counts when supported
      const perDeptCounts: Record<string, number> = {};
      await Promise.all(
        loadedDepartments.map(async (dept) => {
          const baseSelect = supabase
            .from('daily_logs')
            .select('id', { count: 'exact', head: true });
          if (baseSelect && typeof (baseSelect as { eq?: unknown }).eq === 'function') {
            const res = await (
              baseSelect as unknown as {
                eq: (
                  col: string,
                  val: string
                ) => Promise<{ count: number | null; error: { message: string } | null }>;
              }
            ).eq('department_id', dept.id);
            if (!res.error && typeof res.count === 'number') {
              perDeptCounts[dept.id] = res.count;
            }
          }
        })
      );
      setExactLogsByDept(perDeptCounts);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to load departments');
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void loadDepartmentsData();
  }, [loadDepartmentsData]);

  const overview = useMemo(
    () =>
      computeDepartmentsOverview({
        departments,
        sites,
        mineBlocks,
        employees,
        machines,
        breakdowns,
        dailyLogs,
        exactTotalShiftLogs,
      }),
    [
      departments,
      sites,
      mineBlocks,
      employees,
      machines,
      breakdowns,
      dailyLogs,
      exactTotalShiftLogs,
    ]
  );

  const metricsByDeptId = useMemo(() => {
    const map = new Map<string, DepartmentMetrics>();
    for (const department of departments) {
      map.set(
        department.id,
        buildDepartmentMetrics({
          department,
          sites,
          mineBlocks,
          employees,
          accessGrants,
          machines,
          breakdowns,
          dailyLogs,
          exactShiftLogsCount: exactLogsByDept[department.id],
        })
      );
    }
    return map;
  }, [
    departments,
    sites,
    mineBlocks,
    employees,
    accessGrants,
    machines,
    breakdowns,
    dailyLogs,
    exactLogsByDept,
  ]);

  const filteredDepartments = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return departments;
    return departments.filter((dept) => {
      const displayLabel = (dept.display_name || dept.name).toLowerCase();
      const slugLower = dept.name.toLowerCase();
      const metrics = metricsByDeptId.get(dept.id);
      const matchesSite = metrics?.sites.some(
        (entry) =>
          entry.site.site_code.toLowerCase().includes(query) ||
          entry.site.name.toLowerCase().includes(query)
      );
      return displayLabel.includes(query) || slugLower.includes(query) || Boolean(matchesSite);
    });
  }, [departments, metricsByDeptId, searchQuery]);

  const toggleExpanded = (deptId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(deptId)) {
        next.delete(deptId);
      } else {
        next.add(deptId);
      }
      return next;
    });
  };

  const areAllFilteredExpanded =
    filteredDepartments.length > 0 && filteredDepartments.every((dept) => expandedIds.has(dept.id));

  const toggleExpandAll = () => {
    if (areAllFilteredExpanded) {
      setExpandedIds(new Set());
      return;
    }
    setExpandedIds(new Set(filteredDepartments.map((dept) => dept.id)));
  };

  const handleAddDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newDepartmentName.trim();
    if (!trimmed) return;

    const slug = trimmed
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    if (
      departments.some(
        (d) =>
          d.name.toLowerCase() === slug || d.display_name?.toLowerCase() === trimmed.toLowerCase()
      )
    ) {
      setErrorMessage(`Department "${trimmed}" is already active.`);
      return;
    }

    setErrorMessage(null);
    try {
      const result = await adminAddDepartment({ display_name: trimmed });
      if ('error' in result && result.error) {
        setErrorMessage(result.error);
        return;
      }

      if ('department' in result && result.department) {
        const created = result.department as DepartmentRecord;
        setDepartments((prev) => {
          const filtered = prev.filter((item) => item.id !== created.id);
          return [...filtered, created];
        });
        setExpandedIds((prev) => new Set([...prev, created.id]));
        toast.success(
          'reactivated' in result && result.reactivated
            ? `Reactivated department "${created.display_name || created.name}"`
            : `Added department "${created.display_name || created.name}"`
        );
      }
      setNewDepartmentName('');
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to create department');
    }
  };

  const openEditDialog = (dept: DepartmentRecord) => {
    setEditingDept(dept);
    setEditDisplayName(dept.display_name || dept.name);
    setEditDescription(dept.description ?? '');
    setEditColor(dept.color || 'slate');
    setEditIcon(dept.icon || 'Building2');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDept) return;
    setIsSavingEdit(true);
    setErrorMessage(null);
    try {
      const result = await adminUpdateDepartment({
        id: editingDept.id,
        display_name: editDisplayName.trim(),
        description: editDescription.trim() || null,
        color: editColor,
        icon: editIcon,
      });

      if ('error' in result && result.error) {
        setErrorMessage(result.error);
        return;
      }

      if ('department' in result && result.department) {
        const updated = result.department as DepartmentRecord;
        setDepartments((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
        toast.success(`Updated "${updated.display_name || updated.name}"`);
        setEditingDept(null);
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to update department');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleConfirmArchive = async () => {
    if (!pendingArchive) return;
    setIsArchiving(true);
    setErrorMessage(null);
    try {
      const result = await adminArchiveDepartment(pendingArchive.id);
      if ('error' in result && result.error) {
        setErrorMessage(result.error);
        return;
      }

      const archivedId = pendingArchive.id;
      const archivedLabel = pendingArchive.display_name || pendingArchive.name;
      setDepartments((prev) => prev.filter((dept) => dept.id !== archivedId));
      setExpandedIds((prev) => {
        const next = new Set(prev);
        next.delete(archivedId);
        return next;
      });
      setPendingArchive(null);
      toast.success(`Archived "${archivedLabel}"`);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to archive department');
    } finally {
      setIsArchiving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Full Panel Header + KPI Command Overview */}
      <GlassCard
        data-testid="departments-full-panel-header"
        className="gold-steel-border gold-steel-border-slim space-y-5 p-5"
      >
        <div className="flex flex-col justify-between gap-4 border-[var(--border-default)] border-b pb-4 lg:flex-row lg:items-center">
          <div className="flex items-start gap-3.5">
            <div className="gold-steel-border gold-steel-border-slim flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-gold/15 text-accent-gold shadow-2xs">
              <Building2 className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-semibold text-[var(--text-heading)] text-lg">
                  Departments &amp; Areas
                </h2>
                <Badge
                  variant="outline"
                  className="border-accent-gold/45 bg-accent-gold/10 font-mono text-[11px] text-accent-gold"
                >
                  {overview.totalDepartments} Divisions · {overview.activeSites} Active Sites
                </Badge>
              </div>
              <p className="mt-0.5 text-[var(--text-secondary)] text-xs">
                Operational divisions, site &amp; block coverage, workforce permissions, fleet
                readiness, and shift telemetry.
              </p>
            </div>
          </div>

          <form onSubmit={handleAddDepartment} className="flex w-full items-center gap-2 lg:w-auto">
            <Input
              placeholder="Add department..."
              value={newDepartmentName}
              onChange={(e) => setNewDepartmentName(e.target.value)}
              className="w-full border-[var(--border-default)] bg-[var(--bg-secondary)] lg:w-64"
            />
            <Button
              type="submit"
              className="shrink-0 bg-[var(--accent-emerald)] text-[var(--bg-void)] hover:bg-[var(--accent-green)]"
            >
              <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
              Add Department
            </Button>
          </form>
        </div>

        {/* Full-Panel KPI Summary Grid */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className={HEADER_KPI_CARD_CLASS}>
            <div className="flex items-center justify-between">
              <span className="font-medium text-[var(--text-muted)] text-xs">
                Active Departments
              </span>
              <Layers className="h-4 w-4 text-accent-gold" aria-hidden="true" />
            </div>
            <div className="mt-1 flex items-baseline justify-between gap-2">
              <span className="font-semibold text-2xl text-[var(--text-heading)] tabular-nums">
                {overview.totalDepartments}
              </span>
              <span className="font-mono text-[11px] text-accent-gold">
                {overview.totalShiftLogs.toLocaleString('en-US')} shift logs
              </span>
            </div>
          </div>

          <div className={HEADER_KPI_CARD_CLASS}>
            <div className="flex items-center justify-between">
              <span className="font-medium text-[var(--text-muted)] text-xs">
                Active Sites &amp; Blocks
              </span>
              <MapPin className="h-4 w-4 text-accent-gold" aria-hidden="true" />
            </div>
            <div className="mt-1 flex items-baseline justify-between gap-2">
              <span className="font-semibold text-2xl text-[var(--text-heading)] tabular-nums">
                {overview.activeSites}/{overview.totalSites}
              </span>
              <span className="font-mono text-[11px] text-[var(--text-muted)]">
                {overview.activeBlocks} active blocks
              </span>
            </div>
          </div>

          <div className={HEADER_KPI_CARD_CLASS}>
            <div className="flex items-center justify-between">
              <span className="font-medium text-[var(--text-muted)] text-xs">
                Workforce Coverage
              </span>
              <Users className="h-4 w-4 text-accent-gold" aria-hidden="true" />
            </div>
            <div className="mt-1 flex items-baseline justify-between gap-2">
              <span className="font-semibold text-2xl text-[var(--text-heading)] tabular-nums">
                {overview.totalEmployees}
              </span>
              <span className="font-mono text-[11px] text-[var(--text-muted)]">
                active employees
              </span>
            </div>
          </div>

          <div className={HEADER_KPI_CARD_CLASS}>
            <div className="flex items-center justify-between">
              <span className="font-medium text-[var(--text-muted)] text-xs">
                Fleet &amp; Breakdowns
              </span>
              <Truck className="h-4 w-4 text-accent-gold" aria-hidden="true" />
            </div>
            <div className="mt-1 flex items-baseline justify-between gap-2">
              <span className="font-semibold text-2xl text-[var(--text-heading)] tabular-nums">
                {overview.activeMachines}/{overview.totalMachines}
              </span>
              <span
                className={
                  overview.openBreakdowns > 0
                    ? 'font-mono text-[11px] text-accent-red'
                    : 'font-mono text-[11px] text-accent-green'
                }
              >
                {overview.openBreakdowns} open alerts
              </span>
            </div>
          </div>
        </div>

        {/* Search & Bulk Expand Controls */}
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1 sm:max-w-sm">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]"
              aria-hidden="true"
            />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search departments, slugs, or site codes..."
              aria-label="Search departments"
              className="border-[var(--border-default)] bg-[var(--bg-secondary)] pl-9"
            />
          </div>

          <div className="flex items-center justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={toggleExpandAll}
              disabled={filteredDepartments.length === 0}
              className="shrink-0 border-accent-gold/45 text-xs hover:bg-accent-gold/10"
            >
              {areAllFilteredExpanded ? 'Collapse All' : 'Expand All'}
            </Button>
          </div>
        </div>
      </GlassCard>

      {errorMessage && (
        <div className="rounded-lg border border-accent-red/25 bg-accent-red/10 px-4 py-2 text-accent-red text-xs">
          {errorMessage}
        </div>
      )}

      {/* Interactive Dropdown Department Directory */}
      <GlassCard className="overflow-hidden p-0">
        {isLoading ? (
          <div className="px-6 py-12 text-center text-[var(--text-muted)]">
            Loading departments…
          </div>
        ) : filteredDepartments.length === 0 ? (
          <div className="px-6 py-12 text-center text-[var(--text-muted)]">
            {departments.length === 0
              ? 'No departments found.'
              : 'No departments match the current search.'}
          </div>
        ) : (
          <ul className="divide-y divide-[var(--border-default)]" aria-label="Departments list">
            {filteredDepartments.map((dept) => {
              const label = dept.display_name || dept.name;
              const isExpanded = expandedIds.has(dept.id);
              const metrics = metricsByDeptId.get(dept.id);

              return (
                <li
                  key={dept.id}
                  data-testid={`department-row-${dept.name}`}
                  className="transition-colors"
                >
                  <div className="flex items-center justify-between gap-3 px-6 py-4 hover:bg-[var(--bg-tertiary)]">
                    <button
                      type="button"
                      aria-expanded={isExpanded}
                      aria-controls={`dept-panel-${dept.id}`}
                      onClick={() => toggleExpanded(dept.id)}
                      className="flex min-w-0 flex-1 cursor-pointer items-center justify-between gap-4 text-left focus-visible:outline-none"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <ChevronDown
                          aria-hidden="true"
                          className={`h-4 w-4 shrink-0 text-accent-gold transition-transform duration-200 ${
                            isExpanded ? 'rotate-180' : ''
                          }`}
                        />
                        <MapPin
                          className="h-4 w-4 shrink-0 text-[var(--accent-emerald)]"
                          aria-hidden="true"
                        />
                        <div className="min-w-0">
                          <span className="font-medium text-[var(--text-heading)] text-sm">
                            {label}
                          </span>
                          <span className="ml-2 font-mono text-[var(--text-muted)] text-xs">
                            {dept.name}
                          </span>
                        </div>
                      </div>

                      {metrics && (
                        <div className="hidden flex-wrap items-center gap-2 md:flex">
                          <span className="rounded-full border border-[var(--border-default)] bg-[var(--bg-secondary)] px-2 py-0.5 font-mono text-[11px] text-[var(--text-secondary)]">
                            {metrics.employeeCount} Staff
                          </span>
                          <span className="rounded-full border border-accent-gold/35 bg-accent-gold/10 px-2 py-0.5 font-mono text-[11px] text-accent-gold">
                            {metrics.sites.length} {metrics.sites.length === 1 ? 'Site' : 'Sites'}
                          </span>
                          <span className="rounded-full border border-[var(--border-default)] bg-[var(--bg-secondary)] px-2 py-0.5 font-mono text-[11px] text-[var(--text-secondary)]">
                            {metrics.activeMachines} Fleet
                          </span>
                          {metrics.openBreakdowns > 0 && (
                            <span className="rounded-full border border-accent-red/30 bg-accent-red/10 px-2 py-0.5 font-mono text-[11px] text-accent-red">
                              {metrics.openBreakdowns} Alert
                              {metrics.openBreakdowns === 1 ? '' : 's'}
                            </span>
                          )}
                        </div>
                      )}
                    </button>

                    <div className="flex shrink-0 items-center gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        aria-label={`Edit ${label}`}
                        onClick={() => openEditDialog(dept)}
                      >
                        <Edit2 className="h-4 w-4" aria-hidden="true" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        aria-label={`Archive ${label}`}
                        className="shrink-0 text-accent-red hover:text-accent-red/80"
                        onClick={() => setPendingArchive(dept)}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </div>
                  </div>

                  {/* Expanded Full Site Details & Metrics Dropdown Panel */}
                  {isExpanded && metrics && (
                    <div
                      id={`dept-panel-${dept.id}`}
                      data-testid={`department-details-${dept.name}`}
                      className="space-y-4 border-accent-gold/25 border-t bg-[var(--bg-secondary)]/85 px-6 py-4"
                    >
                      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                        <div>
                          <p className="text-[var(--text-body)] text-xs">
                            {metrics.summaryDescription}
                          </p>
                          <p className="mt-1 font-mono text-[11px] text-[var(--text-muted)]">
                            Slug: {metrics.slug} · Registered: {formatCreatedDate(dept.created_at)}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Link href={`/${dept.name}`} className={QUICK_LINK_PILL_CLASS}>
                            <ExternalLink className="h-3 w-3 text-accent-gold" aria-hidden="true" />
                            Open Workspace
                          </Link>
                          <Link href="/admin?tab=users" className={QUICK_LINK_PILL_CLASS}>
                            <Users className="h-3 w-3 text-accent-gold" aria-hidden="true" />
                            Manage Users
                          </Link>
                          <Link href="/admin?tab=sites" className={QUICK_LINK_PILL_CLASS}>
                            <MapPin className="h-3 w-3 text-accent-gold" aria-hidden="true" />
                            Manage Sites
                          </Link>
                        </div>
                      </div>

                      {/* Division Metrics Grid */}
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <div className={DETAIL_METRIC_CARD_CLASS}>
                          <div className="flex items-center justify-between text-[var(--text-muted)] text-xs">
                            <span>Personnel &amp; Permissions</span>
                            <ShieldCheck className="h-3.5 w-3.5 text-accent-gold" />
                          </div>
                          <div className="mt-1 font-semibold text-[var(--text-heading)] text-base tabular-nums">
                            {metrics.employeeCount} Assigned
                          </div>
                          <div className="mt-0.5 font-mono text-[11px] text-[var(--text-muted)]">
                            {metrics.operateAccessCount} Read+Write · {metrics.readOnlyAccessCount}{' '}
                            Read Only
                          </div>
                        </div>

                        <div className={DETAIL_METRIC_CARD_CLASS}>
                          <div className="flex items-center justify-between text-[var(--text-muted)] text-xs">
                            <span>Fleet Allocation</span>
                            <Truck className="h-3.5 w-3.5 text-accent-gold" />
                          </div>
                          <div className="mt-1 font-semibold text-[var(--text-heading)] text-base tabular-nums">
                            {metrics.activeMachines}/{metrics.totalMachines} Active
                          </div>
                          <div className="mt-0.5 font-mono text-[11px] text-[var(--text-muted)]">
                            {metrics.totalStartingSmr.toLocaleString('en-US')} hrs baseline SMR
                          </div>
                        </div>

                        <div className={DETAIL_METRIC_CARD_CLASS}>
                          <div className="flex items-center justify-between text-[var(--text-muted)] text-xs">
                            <span>Breakdowns &amp; Downtime</span>
                            <AlertTriangle className="h-3.5 w-3.5 text-accent-gold" />
                          </div>
                          <div className="mt-1 font-semibold text-[var(--text-heading)] text-base tabular-nums">
                            {metrics.openBreakdowns} Open
                          </div>
                          <div className="mt-0.5 font-mono text-[11px] text-[var(--text-muted)]">
                            {metrics.totalBreakdownDelayHours.toLocaleString('en-US')}h logged delay
                          </div>
                        </div>

                        <div className={DETAIL_METRIC_CARD_CLASS}>
                          <div className="flex items-center justify-between text-[var(--text-muted)] text-xs">
                            <span>Shift Operations</span>
                            <ClipboardList className="h-3.5 w-3.5 text-accent-gold" />
                          </div>
                          <div className="mt-1 font-semibold text-[var(--text-heading)] text-base tabular-nums">
                            {metrics.recentShiftLogsCount.toLocaleString('en-US')} Shift Logs
                          </div>
                          <div className="mt-0.5 font-mono text-[11px] text-[var(--text-muted)]">
                            Latest: {metrics.latestLogDate ?? 'No shift logs yet'}
                          </div>
                        </div>
                      </div>

                      {/* Full Site Details & Mine Blocks Coverage */}
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="font-semibold text-[var(--text-heading)] text-xs uppercase tracking-wider">
                            Site Details &amp; Mine Blocks Coverage
                          </h3>
                          <Badge
                            variant="outline"
                            className="border-accent-gold/40 bg-[var(--bg-primary)] font-mono text-[10.5px] text-accent-gold"
                          >
                            {metrics.siteCoverageMode === 'direct'
                              ? 'Direct Machine / Event Assignment'
                              : 'Cross-Site Operations Coverage'}
                          </Badge>
                        </div>

                        {metrics.sites.length === 0 ? (
                          <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-primary)]/80 px-4 py-3 text-[var(--text-muted)] text-xs">
                            No active sites configured yet — configure under Sites &amp; Blocks.
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                            {metrics.sites.map((siteDetail) => (
                              <div
                                key={siteDetail.site.id}
                                className="rounded-xl border border-accent-gold/30 bg-[var(--bg-primary)]/90 p-3 shadow-2xs"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-mono font-semibold text-accent-gold text-xs">
                                    {siteDetail.site.site_code}
                                  </span>
                                  <Badge
                                    variant="outline"
                                    className={
                                      siteDetail.site.active
                                        ? 'border-accent-green/30 bg-accent-green/10 text-[10px] text-accent-green'
                                        : 'border-[var(--border-default)] text-[10px] text-[var(--text-muted)]'
                                    }
                                  >
                                    {siteDetail.site.active ? 'Active Site' : 'Inactive'}
                                  </Badge>
                                </div>
                                <div className="mt-1 font-medium text-[var(--text-heading)] text-sm">
                                  {siteDetail.site.name}
                                </div>
                                <div className="mt-1 font-mono text-[11px] text-[var(--text-muted)]">
                                  Site Fleet: {siteDetail.totalMachinesAtSite} · Division Assets:{' '}
                                  {siteDetail.departmentMachineCount}
                                </div>
                                {siteDetail.mineBlocks.length > 0 && (
                                  <div className="mt-2 flex flex-wrap gap-1 border-[var(--border-default)] border-t pt-2">
                                    {siteDetail.mineBlocks.map((block) => (
                                      <span
                                        key={block.id}
                                        className="rounded-md border border-[var(--border-default)] bg-[var(--bg-secondary)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--text-secondary)]"
                                      >
                                        {block.code} · {block.name}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {metrics.samplePersonnel.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 border-[var(--border-default)] border-t pt-2.5 text-xs">
                          <span className="font-medium text-[var(--text-muted)]">Personnel:</span>
                          {metrics.samplePersonnel.map((person) => (
                            <span
                              key={person.id}
                              className="rounded-full border border-[var(--border-default)] bg-[var(--bg-primary)] px-2.5 py-0.5 text-[11px] text-[var(--text-heading)]"
                            >
                              {person.fullName} ·{' '}
                              <span className="text-[var(--text-muted)]">{person.roleLabel}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <div className="border-[var(--border-default)] border-t px-6 py-3">
          <span className="text-[var(--text-muted)] text-xs">
            Showing{' '}
            <strong className="text-[var(--text-heading)]">{filteredDepartments.length}</strong> of{' '}
            {departments.length} departments — click any department for site details &amp; metrics
          </span>
        </div>
      </GlassCard>

      {/* Edit Department Dialog */}
      <Dialog open={Boolean(editingDept)} onOpenChange={(open) => !open && setEditingDept(null)}>
        <DialogContent className="max-w-md border-[var(--border-default)] bg-[var(--bg-primary)]">
          <DialogHeader>
            <DialogTitle>Edit Department</DialogTitle>
            <DialogDescription>
              Update display name, operational summary, theme accent, and icon for{' '}
              <span className="font-mono">{editingDept?.name}</span>.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveEdit} className="space-y-4">
            <div>
              <label
                htmlFor="dept-edit-display-name"
                className="mb-1.5 block font-medium text-[var(--text-heading)] text-xs"
              >
                Display Name
              </label>
              <Input
                id="dept-edit-display-name"
                required
                value={editDisplayName}
                onChange={(e) => setEditDisplayName(e.target.value)}
                className="border-[var(--border-default)] bg-[var(--bg-secondary)]"
              />
            </div>

            <div>
              <label
                htmlFor="dept-edit-description"
                className="mb-1.5 block font-medium text-[var(--text-heading)] text-xs"
              >
                Description
              </label>
              <textarea
                id="dept-edit-description"
                rows={3}
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Describe division responsibilities..."
                className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2 text-[var(--text-heading)] text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="dept-edit-color"
                  className="mb-1.5 block font-medium text-[var(--text-heading)] text-xs"
                >
                  Color Token
                </label>
                <select
                  id="dept-edit-color"
                  value={editColor}
                  onChange={(e) => setEditColor(e.target.value)}
                  className="h-9 w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-secondary)] px-2.5 text-[var(--text-heading)] text-xs"
                >
                  {DEPARTMENT_COLOR_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                  {!DEPARTMENT_COLOR_OPTIONS.includes(
                    editColor as (typeof DEPARTMENT_COLOR_OPTIONS)[number]
                  ) && <option value={editColor}>{editColor}</option>}
                </select>
              </div>

              <div>
                <label
                  htmlFor="dept-edit-icon"
                  className="mb-1.5 block font-medium text-[var(--text-heading)] text-xs"
                >
                  Icon
                </label>
                <select
                  id="dept-edit-icon"
                  value={editIcon}
                  onChange={(e) => setEditIcon(e.target.value)}
                  className="h-9 w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-secondary)] px-2.5 text-[var(--text-heading)] text-xs"
                >
                  {DEPARTMENT_ICON_OPTIONS.map((iconName) => (
                    <option key={iconName} value={iconName}>
                      {iconName}
                    </option>
                  ))}
                  {!DEPARTMENT_ICON_OPTIONS.includes(
                    editIcon as (typeof DEPARTMENT_ICON_OPTIONS)[number]
                  ) && <option value={editIcon}>{editIcon}</option>}
                </select>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={isSavingEdit}
                onClick={() => setEditingDept(null)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSavingEdit || !editDisplayName.trim()}
                className="bg-[var(--accent-emerald)] text-[var(--bg-void)] hover:bg-[var(--accent-green)]"
              >
                {isSavingEdit ? 'Saving...' : 'Save Department'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Archive Department Confirmation Dialog */}
      <Dialog
        open={Boolean(pendingArchive)}
        onOpenChange={(open) => !open && setPendingArchive(null)}
      >
        <DialogContent className="max-w-md border-[var(--border-default)] bg-[var(--bg-primary)]">
          <DialogHeader>
            <DialogTitle>Archive Department</DialogTitle>
            <DialogDescription>
              Are you sure you want to archive &ldquo;
              {pendingArchive?.display_name || pendingArchive?.name}&rdquo;? Historical shift logs
              remain preserved and re-creating the same name will cleanly reactivate it.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isArchiving}
              onClick={() => setPendingArchive(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isArchiving}
              onClick={() => void handleConfirmArchive()}
            >
              {isArchiving ? 'Archiving...' : 'Confirm Archive'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
