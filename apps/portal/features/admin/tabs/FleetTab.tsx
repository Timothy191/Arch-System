'use client';

import { createBrowserSupabaseClient } from '@repo/supabase/client';
import { Badge } from '@repo/ui/components/ui/badge';
import { Button } from '@repo/ui/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@repo/ui/components/ui/dialog';
import { Input } from '@repo/ui/components/ui/input';
import { GlassCard } from '@repo/ui/GlassCard';
import { Download, Edit2, Plus, Power, Search, Sparkles, X } from 'lucide-react';
import Image from 'next/image';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { logError } from '@/lib/errors/error-logger';
import { adminAddMachine, adminGenerateStartingSmr, adminUpdateMachine } from '../actions/fleet';
import { FleetAnalyticsPanel } from './FleetAnalyticsPanel';
import {
  buildFleetCsv,
  computeFleetAnalytics,
  estimateBaselineStartingSmr,
  FLEET_IMAGE_PRESETS,
  type FleetMachineRecord,
  isArticulatedOrRigidDumper,
  resolveDefaultMachineImage,
  resolveDefaultManufacturer,
  resolveMachineIdentity,
} from './fleet-utils';

type Machine = FleetMachineRecord;

interface Department {
  id: string;
  display_name: string;
}

interface Site {
  id: string;
  name: string;
  site_code: string;
  active: boolean;
}

type StatusFilter = 'all' | 'active' | 'inactive';
type FleetSortOption = 'id-asc' | 'name-asc' | 'smr-desc' | 'manufacturer-asc';

const FILTER_SELECT_CLASS =
  'rounded-md border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2 text-[var(--text-heading)] text-sm focus:border-accent-gold focus:outline-none';
const TABLE_HEADER_CELL_CLASS =
  'px-4 py-3 font-medium text-[var(--text-muted)] text-xs uppercase tracking-wider';
const FORM_LABEL_CLASS = 'mb-2 block font-medium text-[var(--text-body)] text-sm';

const MACHINE_TYPE_OPTIONS = [
  'Articulated Dumper',
  'Rigid Dumper',
  'Dump Truck',
  'Excavator',
  'Dozer',
  'Drill Rig',
  'Grader',
  'Loader',
  'Crusher',
  'Compactor',
  'Water Truck',
  'Other',
] as const;

export function FleetTab() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingMachine, setEditingMachine] = useState<Machine | null>(null);
  const [previewMachine, setPreviewMachine] = useState<Machine | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generatingSmr, setGeneratingSmr] = useState(false);
  const [dialogError, setDialogError] = useState('');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [filterType, setFilterType] = useState('');
  const [filterManufacturer, setFilterManufacturer] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterSite, setFilterSite] = useState('');
  const [sortBy, setSortBy] = useState<FleetSortOption>('id-asc');
  const [pendingToggle, setPendingToggle] = useState<Machine | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [{ data: machineData }, { data: deptData }, { data: siteData }] = await Promise.all([
      supabase
        .from('machines')
        .select('*, department:departments(display_name), site:sites(name, site_code)')
        .is('deleted_at', null)
        .order('name'),
      supabase.from('departments').select('id, display_name').order('display_name'),
      supabase.from('sites').select('id, name, site_code, active').order('name'),
    ]);
    if (machineData) {
      const normalized = machineData.map((machine) => ({
        ...machine,
        department: Array.isArray(machine.department)
          ? (machine.department[0] ?? null)
          : machine.department,
        site: Array.isArray(machine.site) ? (machine.site[0] ?? null) : machine.site,
      })) as Machine[];
      setMachines(normalized);
    }
    if (deptData) setDepartments(deptData);
    if (siteData) setSites(siteData);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const analytics = useMemo(() => computeFleetAnalytics(machines), [machines]);

  const typeOptions = useMemo(
    () => Array.from(new Set(machines.map((m) => m.machine_type).filter(Boolean))).sort(),
    [machines]
  );

  const manufacturerOptions = useMemo(
    () => analytics.byManufacturer.map((entry) => entry.label).sort(),
    [analytics.byManufacturer]
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const list = machines.filter((machine) => {
      const identity = resolveMachineIdentity({
        name: machine.name,
        serialNumber: machine.serial_number,
      });
      const resolvedMfg = resolveDefaultManufacturer({
        machineId: identity.machineId,
        machineName: identity.machineName,
        machineType: machine.machine_type,
        manufacturer: machine.manufacturer,
      });

      const matchSearch =
        !query ||
        identity.machineId.toLowerCase().includes(query) ||
        identity.machineName.toLowerCase().includes(query) ||
        machine.machine_type.toLowerCase().includes(query) ||
        resolvedMfg.toLowerCase().includes(query);
      const matchStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && machine.active) ||
        (statusFilter === 'inactive' && !machine.active);
      const matchType = !filterType || machine.machine_type === filterType;
      const matchMfg = !filterManufacturer || resolvedMfg === filterManufacturer;
      const matchDept = !filterDept || machine.department_id === filterDept;
      const matchSite =
        !filterSite ||
        (filterSite === '__none__' ? !machine.site_id : machine.site_id === filterSite);
      return matchSearch && matchStatus && matchType && matchMfg && matchDept && matchSite;
    });

    return [...list].sort((a, b) => {
      const idA = resolveMachineIdentity({ name: a.name, serialNumber: a.serial_number });
      const idB = resolveMachineIdentity({ name: b.name, serialNumber: b.serial_number });
      if (sortBy === 'smr-desc') {
        return Number(b.starting_smr ?? 0) - Number(a.starting_smr ?? 0);
      }
      if (sortBy === 'name-asc') {
        return idA.machineName.localeCompare(idB.machineName);
      }
      if (sortBy === 'manufacturer-asc') {
        const mfgA = resolveDefaultManufacturer({
          machineId: idA.machineId,
          machineName: idA.machineName,
          machineType: a.machine_type,
          manufacturer: a.manufacturer,
        });
        const mfgB = resolveDefaultManufacturer({
          machineId: idB.machineId,
          machineName: idB.machineName,
          machineType: b.machine_type,
          manufacturer: b.manufacturer,
        });
        return mfgA.localeCompare(mfgB);
      }
      return idA.machineId.localeCompare(idB.machineId);
    });
  }, [
    machines,
    search,
    statusFilter,
    filterType,
    filterManufacturer,
    filterDept,
    filterSite,
    sortBy,
  ]);

  const productionDepartmentId = useMemo(
    () =>
      departments.find((dept) => dept.display_name.toLowerCase() === 'production')?.id ??
      departments[0]?.id ??
      '',
    [departments]
  );

  const hasActiveFilters = Boolean(
    search || statusFilter !== 'all' || filterType || filterManufacturer || filterDept || filterSite
  );

  const clearAllFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setFilterType('');
    setFilterManufacturer('');
    setFilterDept('');
    setFilterSite('');
  };

  const handleGenerateStartingSmr = async () => {
    setGeneratingSmr(true);
    const result = await adminGenerateStartingSmr();
    if (result.error) {
      logError(new Error(result.error), { context: 'fleet_generate_starting_smr' });
      toast.error(result.error);
    } else {
      toast.success(
        result.updatedCount && result.updatedCount > 0
          ? `Updated Starting SMR & fleet metadata for ${result.updatedCount} machine(s)`
          : 'All fleet Starting SMR hours, manufacturers, and Production assignments are up to date'
      );
      await loadData();
    }
    setGeneratingSmr(false);
  };

  const handleExportCsv = () => {
    const csv = buildFleetCsv(filtered);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `fleet-registry-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filtered.length} machine record(s)`);
  };

  const handleAdd = () => {
    setEditingMachine(null);
    setDialogError('');
    setShowDialog(true);
  };

  const handleEdit = (machine: Machine) => {
    setEditingMachine(machine);
    setDialogError('');
    setShowDialog(true);
  };

  const handleConfirmToggle = async () => {
    if (!pendingToggle) return;
    setSaving(true);
    const result = await adminUpdateMachine(pendingToggle.id, {
      active: !pendingToggle.active,
    });
    if (result.error) {
      logError(new Error(result.error), { context: 'fleet_toggle_active' });
    }
    setPendingToggle(null);
    setSaving(false);
    await loadData();
  };

  const handleSave = async (formPayload: {
    machine_id: string;
    machine_name: string;
    machine_type: string;
    manufacturer: string;
    image_url: string;
    starting_smr: string;
    bin_factor_waste: string;
    bin_factor_coal: string;
    department_id: string;
    site_id: string;
    active: boolean;
    report_exempt: boolean;
  }) => {
    setSaving(true);
    setDialogError('');

    const parsedWaste = formPayload.bin_factor_waste
      ? parseFloat(formPayload.bin_factor_waste)
      : null;
    const parsedCoal = formPayload.bin_factor_coal ? parseFloat(formPayload.bin_factor_coal) : null;
    const parsedSmr = formPayload.starting_smr !== '' ? parseFloat(formPayload.starting_smr) : 0;

    const payload = {
      name: formPayload.machine_id.trim(),
      serial_number: formPayload.machine_name.trim(),
      machine_type: formPayload.machine_type,
      manufacturer: formPayload.manufacturer,
      image_url: formPayload.image_url.trim() || null,
      starting_smr: parsedSmr,
      bin_factor: parsedWaste ?? parsedCoal ?? null,
      bin_factor_waste: parsedWaste,
      bin_factor_coal: parsedCoal,
      department_id: formPayload.department_id,
      site_id: formPayload.site_id || null,
      active: formPayload.active,
      report_exempt: formPayload.report_exempt,
    };

    const result = editingMachine
      ? await adminUpdateMachine(editingMachine.id, payload)
      : await adminAddMachine(payload);

    if (result.error) {
      setDialogError(result.error);
    } else {
      setShowDialog(false);
      toast.success(editingMachine ? 'Machine updated' : 'Machine added');
      await loadData();
    }
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      {/* Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-[var(--text-heading)] text-lg">Fleet Registry</h2>
          <p className="text-[var(--text-muted)] text-xs">
            Production machinery, separated Machine ID &amp; model names, Starting SMR baselines
            &amp; verified equipment photos.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={generatingSmr || loading}
            onClick={handleGenerateStartingSmr}
            data-testid="generate-starting-smr-button"
            className="border-accent-gold/50 text-[var(--text-heading)] hover:bg-accent-gold/10"
          >
            <Sparkles className="mr-1.5 h-4 w-4 text-accent-gold" aria-hidden="true" />
            {generatingSmr ? 'Generating SMR…' : 'Generate Starting SMR'}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={filtered.length === 0}
            onClick={handleExportCsv}
          >
            <Download className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Export CSV
          </Button>
          <Button
            onClick={handleAdd}
            className="bg-[var(--accent-emerald)] text-[var(--bg-void)] hover:bg-[var(--accent-green)]"
          >
            <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Add Machine
          </Button>
        </div>
      </div>

      {/* Interactive Fleet KPIs & Visual Analytics */}
      <FleetAnalyticsPanel
        analytics={analytics}
        statusFilter={statusFilter}
        selectedType={filterType}
        selectedManufacturer={filterManufacturer}
        onStatusFilterChange={setStatusFilter}
        onSelectType={setFilterType}
        onSelectManufacturer={setFilterManufacturer}
      />

      {/* Search + Standard UX Filters */}
      <GlassCard className="space-y-3 p-3.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative min-w-52 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 z-10 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Machine ID, Machine Name, manufacturer, or type…"
              className="w-full border-[var(--border-default)] bg-[var(--bg-secondary)] pl-9"
            />
          </div>

          <div
            role="group"
            aria-label="Filter by status"
            className="inline-flex rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] p-0.5 text-xs"
          >
            {(['all', 'active', 'inactive'] as const).map((statusOption) => (
              <button
                key={statusOption}
                type="button"
                onClick={() => setStatusFilter(statusOption)}
                className={`rounded-md px-2.5 py-1.5 font-medium capitalize transition-colors ${
                  statusFilter === statusOption
                    ? 'bg-[var(--bg-primary)] text-[var(--text-heading)] shadow-2xs'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-heading)]'
                }`}
              >
                {statusOption}
              </button>
            ))}
          </div>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            aria-label="Filter by machine type"
            className={FILTER_SELECT_CLASS}
          >
            <option value="">All Types</option>
            {typeOptions.map((typeName) => (
              <option key={typeName} value={typeName}>
                {typeName}
              </option>
            ))}
          </select>

          <select
            value={filterManufacturer}
            onChange={(e) => setFilterManufacturer(e.target.value)}
            aria-label="Filter by manufacturer"
            className={FILTER_SELECT_CLASS}
          >
            <option value="">All Manufacturers</option>
            {manufacturerOptions.map((mfgName) => (
              <option key={mfgName} value={mfgName}>
                {mfgName}
              </option>
            ))}
          </select>

          <select
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
            aria-label="Filter by department"
            className={FILTER_SELECT_CLASS}
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.display_name}
              </option>
            ))}
          </select>

          <select
            value={filterSite}
            onChange={(e) => setFilterSite(e.target.value)}
            aria-label="Filter by site"
            className={FILTER_SELECT_CLASS}
          >
            <option value="">All Sites</option>
            <option value="__none__">No site assigned</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.site_code} — {s.name}
              </option>
            ))}
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as FleetSortOption)}
            aria-label="Sort fleet machines"
            className={FILTER_SELECT_CLASS}
          >
            <option value="id-asc">Sort: Machine ID (A–Z)</option>
            <option value="name-asc">Sort: Machine Name (A–Z)</option>
            <option value="smr-desc">Sort: Starting SMR (High–Low)</option>
            <option value="manufacturer-asc">Sort: Manufacturer (A–Z)</option>
          </select>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="inline-flex items-center gap-1 rounded-md border border-[var(--border-default)] px-2.5 py-2 text-[var(--text-muted)] text-xs transition-colors hover:text-[var(--text-heading)]"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              Clear
            </button>
          )}
        </div>

        <div className="flex items-center justify-between text-[var(--text-muted)] text-xs">
          <span>
            Showing <strong className="text-[var(--text-heading)]">{filtered.length}</strong> of{' '}
            {machines.length} machines
          </span>
          <span>Click any machine thumbnail to inspect its reference photo &amp; specs</span>
        </div>
      </GlassCard>

      {/* Fleet Table with Separated Machine ID, Machine Name & Machine Picture */}
      <GlassCard className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-[var(--border-default)] border-b">
                <th scope="col" className={TABLE_HEADER_CELL_CLASS}>
                  Machine ID
                </th>
                <th scope="col" className={TABLE_HEADER_CELL_CLASS}>
                  Machine Name
                </th>
                <th scope="col" className={TABLE_HEADER_CELL_CLASS}>
                  Manufacturer
                </th>
                <th scope="col" className={TABLE_HEADER_CELL_CLASS}>
                  Type / Bin Factor
                </th>
                <th scope="col" className={TABLE_HEADER_CELL_CLASS}>
                  Starting SMR
                </th>
                <th scope="col" className={TABLE_HEADER_CELL_CLASS}>
                  Department
                </th>
                <th scope="col" className={TABLE_HEADER_CELL_CLASS}>
                  Site
                </th>
                <th scope="col" className={TABLE_HEADER_CELL_CLASS}>
                  Status
                </th>
                <th scope="col" className={`${TABLE_HEADER_CELL_CLASS} text-right`}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-default)]">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-[var(--text-muted)]">
                    Loading…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-[var(--text-muted)]">
                    {machines.length === 0
                      ? 'No machines registered. Add one to get started.'
                      : 'No machines match the current filters.'}
                  </td>
                </tr>
              ) : (
                filtered.map((machine) => {
                  const identity = resolveMachineIdentity({
                    name: machine.name,
                    serialNumber: machine.serial_number,
                  });
                  const resolvedManufacturer = resolveDefaultManufacturer({
                    machineId: identity.machineId,
                    machineName: identity.machineName,
                    machineType: machine.machine_type,
                    manufacturer: machine.manufacturer,
                  });
                  const resolvedImage = resolveDefaultMachineImage({
                    machineType: machine.machine_type,
                    manufacturer: resolvedManufacturer,
                    machineId: identity.machineId,
                    imageUrl: machine.image_url,
                  });
                  const isDumper = isArticulatedOrRigidDumper(machine.machine_type);
                  const wasteFactor = machine.bin_factor_waste ?? machine.bin_factor;
                  const coalFactor = machine.bin_factor_coal;
                  const smrValue = Number(machine.starting_smr ?? 0);

                  return (
                    <tr
                      key={machine.id}
                      className="transition-colors hover:bg-[var(--bg-tertiary)]"
                    >
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => setPreviewMachine(machine)}
                            aria-label={`Preview picture for ${identity.machineId}`}
                            className="group relative h-10 w-16 shrink-0 overflow-hidden rounded-lg border border-accent-gold/40 bg-[var(--bg-secondary)] transition-transform hover:scale-105"
                          >
                            <Image
                              src={resolvedImage}
                              alt={`${identity.machineId} ${identity.machineName}`}
                              width={64}
                              height={40}
                              className="h-full w-full object-cover"
                            />
                          </button>
                          <span className="font-mono font-semibold text-[var(--text-heading)] text-sm">
                            {identity.machineId}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 font-medium text-[var(--text-heading)] text-sm">
                        {identity.machineName}
                      </td>
                      <td className="px-4 py-3.5 text-[var(--text-body)] text-sm">
                        {resolvedManufacturer}
                      </td>
                      <td className="px-4 py-3.5 text-sm">
                        <span className="font-mono text-[var(--text-muted)]">
                          {machine.machine_type}
                        </span>
                        {isDumper && (wasteFactor != null || coalFactor != null) && (
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {wasteFactor != null && (
                              <span className="rounded border border-[var(--accent-blue)]/20 bg-[var(--accent-blue)]/10 px-1.5 py-0.5 font-mono text-[10px] text-[var(--accent-blue)]">
                                Waste: {wasteFactor}
                              </span>
                            )}
                            {coalFactor != null && (
                              <span className="rounded border border-accent-green/20 bg-accent-green/10 px-1.5 py-0.5 font-mono text-[10px] text-accent-green">
                                Coal: {coalFactor}
                              </span>
                            )}
                          </div>
                        )}
                        {isDumper && wasteFactor == null && coalFactor == null && (
                          <span className="ml-2 text-[10px] text-accent-amber">
                            ⚠ no bin factor
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-[var(--text-heading)] text-sm tabular-nums">
                        {smrValue > 0
                          ? `${smrValue.toLocaleString('en-US', {
                              minimumFractionDigits: 1,
                              maximumFractionDigits: 1,
                            })} hrs`
                          : '—'}
                      </td>
                      <td className="px-4 py-3.5 text-sm">
                        <Badge
                          variant="outline"
                          className="border-[var(--accent-blue)]/25 bg-[var(--accent-blue)]/10 text-[var(--accent-blue)]"
                        >
                          {machine.department?.display_name || 'Production'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3.5 text-sm">
                        {machine.site ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--accent-blue)]/20 bg-[var(--accent-blue)]/10 px-2 py-0.5 font-medium text-[var(--accent-blue)] text-xs">
                            {machine.site.site_code}
                            <span className="text-[var(--text-muted)]">{machine.site.name}</span>
                          </span>
                        ) : (
                          <span className="text-[var(--text-muted)] text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex flex-col items-start gap-1">
                          <Badge
                            variant="outline"
                            className={
                              machine.active
                                ? 'border-accent-green/20 bg-accent-green/10 text-accent-green'
                                : 'border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-muted)]'
                            }
                          >
                            {machine.active ? 'Active' : 'Inactive'}
                          </Badge>
                          {machine.report_exempt && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-accent-amber/20 bg-accent-amber/10 px-1.5 py-0.5 text-[10px] text-accent-amber">
                              Exempt
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            aria-label={`Edit ${identity.machineId}`}
                            onClick={() => handleEdit(machine)}
                          >
                            <Edit2 className="h-4 w-4" aria-hidden="true" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={saving}
                            className={
                              machine.active
                                ? 'text-accent-red hover:text-accent-red/80'
                                : 'text-accent-green hover:text-accent-green'
                            }
                            onClick={() => setPendingToggle(machine)}
                            title={machine.active ? 'Deactivate' : 'Activate'}
                          >
                            <Power className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* Add / Edit dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent
          aria-describedby={undefined}
          className="max-h-[90vh] max-w-lg overflow-y-auto border-[var(--border-default)] bg-[var(--bg-primary)]"
        >
          <DialogHeader>
            <DialogTitle>{editingMachine ? 'Edit Machine' : 'Add Machine'}</DialogTitle>
          </DialogHeader>
          <MachineForm
            machine={editingMachine}
            departments={departments}
            defaultDepartmentId={productionDepartmentId}
            sites={sites}
            error={dialogError}
            saving={saving}
            onSubmit={handleSave}
            onCancel={() => setShowDialog(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Machine Picture & Spec Preview Modal */}
      <Dialog
        open={Boolean(previewMachine)}
        onOpenChange={(open) => !open && setPreviewMachine(null)}
      >
        <DialogContent
          aria-describedby={undefined}
          className="max-w-lg border-[var(--border-default)] bg-[var(--bg-primary)]"
        >
          {previewMachine && (
            <MachinePreviewDialogContent
              machine={previewMachine}
              onEdit={() => {
                const target = previewMachine;
                setPreviewMachine(null);
                handleEdit(target);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm deactivate / activate dialog */}
      <Dialog open={!!pendingToggle} onOpenChange={(open) => !open && setPendingToggle(null)}>
        <DialogContent
          aria-describedby={undefined}
          className="max-w-sm border-[var(--border-default)] bg-[var(--bg-primary)]"
        >
          <DialogHeader>
            <DialogTitle>
              {pendingToggle?.active ? 'Deactivate Machine?' : 'Activate Machine?'}
            </DialogTitle>
          </DialogHeader>
          <p className="text-[var(--text-body)] text-sm">
            {pendingToggle?.active
              ? `"${pendingToggle?.name}" will be removed from all active dropdowns and marked inactive. This affects shift entry forms immediately.`
              : `"${pendingToggle?.name}" will become available again in all shift entry forms.`}
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setPendingToggle(null)} disabled={saving}>
              Cancel
            </Button>
            <Button
              disabled={saving}
              className={
                pendingToggle?.active
                  ? 'bg-accent-red text-white hover:bg-accent-red/90'
                  : 'bg-[var(--accent-emerald)] text-[var(--bg-void)] hover:bg-[var(--accent-green)]'
              }
              onClick={handleConfirmToggle}
            >
              {saving ? 'Saving…' : pendingToggle?.active ? 'Deactivate' : 'Activate'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MachinePreviewDialogContent({
  machine,
  onEdit,
}: {
  readonly machine: Machine;
  readonly onEdit: () => void;
}) {
  const identity = resolveMachineIdentity({
    name: machine.name,
    serialNumber: machine.serial_number,
  });
  const mfg = resolveDefaultManufacturer({
    machineId: identity.machineId,
    machineName: identity.machineName,
    machineType: machine.machine_type,
    manufacturer: machine.manufacturer,
  });
  const imgUrl = resolveDefaultMachineImage({
    machineType: machine.machine_type,
    manufacturer: mfg,
    machineId: identity.machineId,
    imageUrl: machine.image_url,
  });

  return (
    <div className="space-y-4">
      <DialogHeader>
        <DialogTitle>
          {identity.machineId} — {identity.machineName}
        </DialogTitle>
      </DialogHeader>
      <div className="overflow-hidden rounded-xl border border-accent-gold/40 bg-[var(--bg-secondary)]">
        <Image
          src={imgUrl}
          alt={`${identity.machineId} ${identity.machineName}`}
          width={640}
          height={400}
          className="h-60 w-full object-cover"
        />
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] p-2.5">
          <div className="text-[11px] text-[var(--text-muted)]">Manufacturer &amp; Type</div>
          <div className="font-medium text-[var(--text-heading)]">
            {mfg} · {machine.machine_type}
          </div>
        </div>
        <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] p-2.5">
          <div className="text-[11px] text-[var(--text-muted)]">Starting SMR</div>
          <div className="font-mono font-semibold text-[var(--text-heading)]">
            {Number(machine.starting_smr ?? 0).toLocaleString('en-US', {
              minimumFractionDigits: 1,
              maximumFractionDigits: 1,
            })}{' '}
            hrs
          </div>
        </div>
      </div>
      <div className="flex justify-end">
        <Button type="button" onClick={onEdit} variant="outline">
          <Edit2 className="mr-1.5 h-4 w-4" aria-hidden="true" />
          Edit Machine
        </Button>
      </div>
    </div>
  );
}

function MachineForm({
  machine,
  departments,
  defaultDepartmentId,
  sites,
  error,
  saving,
  onSubmit,
  onCancel,
}: {
  machine: Machine | null;
  departments: Department[];
  defaultDepartmentId: string;
  sites: Site[];
  error: string;
  saving: boolean;
  onSubmit: (_data: {
    machine_id: string;
    machine_name: string;
    machine_type: string;
    manufacturer: string;
    image_url: string;
    starting_smr: string;
    bin_factor_waste: string;
    bin_factor_coal: string;
    department_id: string;
    site_id: string;
    active: boolean;
    report_exempt: boolean;
  }) => void;
  onCancel: () => void;
}) {
  const initialIdentity = machine
    ? resolveMachineIdentity({ name: machine.name, serialNumber: machine.serial_number })
    : { machineId: '', machineName: '' };

  const [machineId, setMachineId] = useState(initialIdentity.machineId);
  const [machineName, setMachineName] = useState(initialIdentity.machineName);
  const [machineType, setMachineType] = useState(machine?.machine_type || '');
  const [manufacturer, setManufacturer] = useState(
    machine
      ? resolveDefaultManufacturer({
          machineId: initialIdentity.machineId,
          machineName: initialIdentity.machineName,
          machineType: machine.machine_type,
          manufacturer: machine.manufacturer,
        })
      : ''
  );
  const [imageUrl, setImageUrl] = useState(
    machine
      ? resolveDefaultMachineImage({
          machineType: machine.machine_type,
          manufacturer: machine.manufacturer,
          machineId: initialIdentity.machineId,
          imageUrl: machine.image_url,
        })
      : ''
  );
  const [startingSmr, setStartingSmr] = useState(
    machine?.starting_smr != null ? machine.starting_smr.toString() : ''
  );
  const [binFactorWaste, setBinFactorWaste] = useState(
    (machine?.bin_factor_waste ?? machine?.bin_factor)?.toString() || ''
  );
  const [binFactorCoal, setBinFactorCoal] = useState(machine?.bin_factor_coal?.toString() || '');
  const [departmentId, setDepartmentId] = useState(
    machine?.department_id || defaultDepartmentId || departments[0]?.id || ''
  );
  const [siteId, setSiteId] = useState(machine?.site_id || '');
  const [active, setActive] = useState(machine?.active ?? true);
  const [reportExempt, setReportExempt] = useState(machine?.report_exempt ?? false);

  const isDumperType = isArticulatedOrRigidDumper(machineType);
  const activeSites = sites.filter((s) => s.active || s.id === siteId);
  const resolvedPreviewUrl = resolveDefaultMachineImage({
    machineType: machineType || 'Dump Truck',
    manufacturer,
    machineId: machineId || 'DT-01',
    imageUrl,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      machine_id: machineId,
      machine_name: machineName,
      machine_type: machineType,
      manufacturer,
      image_url: resolvedPreviewUrl,
      starting_smr: startingSmr,
      bin_factor_waste: isDumperType ? binFactorWaste : '',
      bin_factor_coal: isDumperType ? binFactorCoal : '',
      department_id: departmentId,
      site_id: siteId,
      active,
      report_exempt: reportExempt,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="machineId" className={FORM_LABEL_CLASS}>
            Machine ID <span className="text-accent-red">*</span>
          </label>
          <Input
            id="machineId"
            value={machineId}
            onChange={(e) => setMachineId(e.target.value)}
            placeholder="e.g. BD-22, DT-102, EX-22"
            className="border-[var(--border-default)] bg-[var(--bg-secondary)] font-mono"
            required
          />
        </div>

        <div>
          <label htmlFor="machineName" className={FORM_LABEL_CLASS}>
            Machine Name / Model <span className="text-accent-red">*</span>
          </label>
          <Input
            id="machineName"
            value={machineName}
            onChange={(e) => setMachineName(e.target.value)}
            placeholder="e.g. Caterpillar D9R, Volvo A45G"
            className="border-[var(--border-default)] bg-[var(--bg-secondary)]"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="machineType" className={FORM_LABEL_CLASS}>
            Machine Type <span className="text-accent-red">*</span>
          </label>
          <select
            id="machineType"
            value={machineType}
            onChange={(e) => setMachineType(e.target.value)}
            className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2 text-[var(--text-heading)] text-sm focus:border-[var(--accent-blue)] focus:outline-none"
            required
          >
            <option value="">Select machine type…</option>
            {MACHINE_TYPE_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
            {machineType &&
              !MACHINE_TYPE_OPTIONS.includes(
                machineType as (typeof MACHINE_TYPE_OPTIONS)[number]
              ) && <option value={machineType}>{machineType}</option>}
          </select>
        </div>

        <div>
          <label htmlFor="manufacturer" className={FORM_LABEL_CLASS}>
            Manufacturer <span className="text-accent-red">*</span>
          </label>
          <Input
            id="manufacturer"
            value={manufacturer}
            onChange={(e) => setManufacturer(e.target.value)}
            placeholder="e.g. Volvo, Caterpillar, Komatsu"
            className="border-[var(--border-default)] bg-[var(--bg-secondary)]"
            required
          />
        </div>
      </div>

      <div>
        <label htmlFor="startingSmr" className={FORM_LABEL_CLASS}>
          Starting SMR on Site <span className="text-accent-red">*</span>
        </label>
        <div className="flex gap-2">
          <Input
            id="startingSmr"
            type="number"
            step="0.1"
            min="0"
            value={startingSmr}
            onChange={(e) => setStartingSmr(e.target.value)}
            placeholder="e.g. 12500.0"
            className="border-[var(--border-default)] bg-[var(--bg-secondary)] font-mono"
            required
          />
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              setStartingSmr(
                String(
                  estimateBaselineStartingSmr({
                    machineType: machineType || 'Dump Truck',
                    machineId: machineId || 'UNIT-01',
                  })
                )
              )
            }
          >
            Generate
          </Button>
        </div>
      </div>

      {/* Machine Picture Selector + Preview */}
      <div className="space-y-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3">
        <span className="block font-medium text-[var(--text-body)] text-sm">Machine Picture</span>
        <div className="flex items-center gap-3">
          <div className="h-14 w-24 shrink-0 overflow-hidden rounded-lg border border-accent-gold/40 bg-[var(--bg-primary)]">
            <Image
              src={resolvedPreviewUrl}
              alt={`${machineId || 'Machine'} preview`}
              width={96}
              height={56}
              className="h-full w-full object-cover"
            />
          </div>
          <div className="min-w-0 flex-1 space-y-1.5">
            <select
              aria-label="Machine picture preset"
              value={FLEET_IMAGE_PRESETS.some((p) => p.url === imageUrl) ? imageUrl : ''}
              onChange={(e) => setImageUrl(e.target.value)}
              className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-primary)] px-2.5 py-1.5 text-[var(--text-heading)] text-xs"
            >
              <option value="">Auto-match by Manufacturer &amp; Type</option>
              {FLEET_IMAGE_PRESETS.map((preset) => (
                <option key={preset.url} value={preset.url}>
                  {preset.label}
                </option>
              ))}
            </select>
            <Input
              aria-label="Machine picture URL"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="/images/fleet/volvo-adt.webp"
              className="h-8 border-[var(--border-default)] bg-[var(--bg-primary)] font-mono text-xs"
            />
          </div>
        </div>
      </div>

      {isDumperType && (
        <div
          className="space-y-3 rounded-lg border border-[var(--accent-blue)]/30 bg-[var(--accent-blue)]/5 p-4"
          data-testid="dumper-bin-factor-block"
        >
          <div>
            <h4 className="font-semibold text-[var(--text-heading)] text-sm">
              Bin Factor Configuration (Dumper Payload)
            </h4>
            <p className="text-[var(--text-muted)] text-xs">
              Separate payload factors for Waste and Coal material loads.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="binFactorWaste"
                className="mb-1.5 block font-medium text-[var(--text-body)] text-xs"
              >
                Waste Bin Factor <span className="text-accent-red">*</span>
              </label>
              <Input
                id="binFactorWaste"
                type="number"
                step="0.1"
                min="0.1"
                value={binFactorWaste}
                onChange={(e) => setBinFactorWaste(e.target.value)}
                placeholder="e.g. 28.5"
                className="border-[var(--border-default)] bg-[var(--bg-secondary)] font-mono"
                required
              />
            </div>

            <div>
              <label
                htmlFor="binFactorCoal"
                className="mb-1.5 block font-medium text-[var(--text-body)] text-xs"
              >
                Coal Bin Factor <span className="text-accent-red">*</span>
              </label>
              <Input
                id="binFactorCoal"
                type="number"
                step="0.1"
                min="0.1"
                value={binFactorCoal}
                onChange={(e) => setBinFactorCoal(e.target.value)}
                placeholder="e.g. 22.0"
                className="border-[var(--border-default)] bg-[var(--bg-secondary)] font-mono"
                required
              />
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={FORM_LABEL_CLASS}>
            Department <span className="text-accent-red">*</span>
          </label>
          <select
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
            aria-label="Department"
            className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2 text-[var(--text-heading)] text-sm focus:border-[var(--accent-blue)] focus:outline-none"
            required
          >
            <option value="">Select department…</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.display_name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={FORM_LABEL_CLASS}>Site</label>
          <select
            value={siteId}
            onChange={(e) => setSiteId(e.target.value)}
            aria-label="Site"
            className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2 text-[var(--text-heading)] text-sm focus:border-[var(--accent-blue)] focus:outline-none"
          >
            <option value="">No site assigned</option>
            {activeSites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.site_code} — {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          id="active"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
          className="h-4 w-4 accent-[var(--accent-emerald)]"
        />
        <label htmlFor="active" className="font-medium text-[var(--text-body)] text-sm">
          Active
        </label>
      </div>

      <div className="flex items-center gap-3 rounded-lg border border-accent-amber/20 bg-accent-amber/5 p-3">
        <input
          type="checkbox"
          id="report_exempt"
          checked={reportExempt}
          onChange={(e) => setReportExempt(e.target.checked)}
          className="h-4 w-4 accent-amber-400"
        />
        <div>
          <label
            htmlFor="report_exempt"
            className="cursor-pointer font-medium text-accent-amber text-sm"
          >
            Exempt from shift reporting
          </label>
          <p className="mt-0.5 text-[var(--text-muted)] text-xs">
            When checked, control room users will not be required to log this machine before
            generating reports.
          </p>
        </div>
      </div>

      {error && (
        <p className="rounded-lg border border-accent-red/20 bg-accent-red/10 px-3 py-2 text-accent-red text-sm">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={saving}
          className="bg-[var(--accent-emerald)] text-[var(--bg-void)] hover:bg-[var(--accent-green)]"
        >
          {saving ? 'Saving…' : machine ? 'Save Changes' : 'Add Machine'}
        </Button>
      </div>
    </form>
  );
}
