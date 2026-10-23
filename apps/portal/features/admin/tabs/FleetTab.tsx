'use client';

import { createBrowserSupabaseClient } from '@repo/supabase/client';
import { Badge } from '@repo/ui/components/ui/badge';
import { Button } from '@repo/ui/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@repo/ui/components/ui/dialog';
import { Input } from '@repo/ui/components/ui/input';
import { GlassCard } from '@repo/ui/GlassCard';
import { Edit2, Plus, Power, Search } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { logError } from '@/lib/errors/error-logger';
import { adminAddMachine, adminUpdateMachine } from '../actions/fleet';

interface Machine {
  id: string;
  name: string;
  machine_type: string;
  manufacturer?: string | null;
  serial_number: string | null;
  starting_smr?: number | null;
  bin_factor: number | null;
  bin_factor_waste?: number | null;
  bin_factor_coal?: number | null;
  active: boolean;
  report_exempt: boolean;
  department_id: string;
  site_id: string | null;
  created_at: string;
  department: { display_name: string } | null;
  site: { name: string; site_code: string } | null;
}

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

const MACHINE_TYPE_OPTIONS = [
  'Articulated Dumper',
  'Rigid Dumper',
  'Excavator',
  'Dozer',
  'Drill Rig',
  'Grader',
  'Loader',
  'Water Bowser',
  'Support Equipment',
] as const;

const DUMPER_TYPES = [
  'articulated dumper',
  'articulated dump truck',
  'rigid dumper',
  'rigid dump truck',
  'adt',
  'rdt',
  'dump truck',
  'dump_truck',
  'dumper',
  'hauler',
];

function isArticulatedOrRigidDumper(machineType: string): boolean {
  const lower = machineType.toLowerCase();
  return DUMPER_TYPES.some((t) => lower.includes(t));
}

export function FleetTab() {
  const supabase = createBrowserSupabaseClient();
  const [machines, setMachines] = useState<Machine[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingMachine, setEditingMachine] = useState<Machine | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dialogError, setDialogError] = useState('');

  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterSite, setFilterSite] = useState('');
  const [pendingToggle, setPendingToggle] = useState<Machine | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [{ data: machineData }, { data: deptData }, { data: siteData }] = await Promise.all([
      supabase
        .from('machines')
        .select('*, department:departments(display_name), site:sites(name, site_code)')
        .order('name'),
      supabase.from('departments').select('id, display_name').order('display_name'),
      supabase.from('sites').select('id, name, site_code, active').order('name'),
    ]);
    if (machineData) {
      const normalised = machineData.map((m) => ({
        ...m,
        department: Array.isArray(m.department) ? (m.department[0] ?? null) : m.department,
        site: Array.isArray(m.site) ? (m.site[0] ?? null) : m.site,
      })) as Machine[];
      setMachines(normalised);
    }
    if (deptData) setDepartments(deptData);
    if (siteData) setSites(siteData);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return machines.filter((m) => {
      const matchSearch =
        !q ||
        m.name.toLowerCase().includes(q) ||
        m.machine_type.toLowerCase().includes(q) ||
        (m.manufacturer ?? '').toLowerCase().includes(q) ||
        (m.serial_number ?? '').toLowerCase().includes(q);
      const matchDept = !filterDept || m.department_id === filterDept;
      const matchSite =
        !filterSite || (filterSite === '__none__' ? !m.site_id : m.site_id === filterSite);
      return matchSearch && matchDept && matchSite;
    });
  }, [machines, search, filterDept, filterSite]);

  const totalActive = machines.filter((m) => m.active).length;
  const totalInactive = machines.length - totalActive;

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

  const handleSave = async (data: {
    name: string;
    machine_type: string;
    manufacturer: string;
    machine_id: string;
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

    const parsedWaste = data.bin_factor_waste ? parseFloat(data.bin_factor_waste) : null;
    const parsedCoal = data.bin_factor_coal ? parseFloat(data.bin_factor_coal) : null;
    const parsedSmr = data.starting_smr !== '' ? parseFloat(data.starting_smr) : 0;
    const resolvedName =
      data.name.trim() ||
      `${data.manufacturer.trim()} ${data.machine_type.trim()} (${data.machine_id.trim()})`;

    const payload = {
      name: resolvedName,
      machine_type: data.machine_type,
      manufacturer: data.manufacturer,
      serial_number: data.machine_id || undefined,
      starting_smr: parsedSmr,
      bin_factor: parsedWaste ?? parsedCoal ?? null,
      bin_factor_waste: parsedWaste,
      bin_factor_coal: parsedCoal,
      department_id: data.department_id,
      site_id: data.site_id || null,
      active: data.active,
      report_exempt: data.report_exempt,
    };

    const result = editingMachine
      ? await adminUpdateMachine(editingMachine.id, payload)
      : await adminAddMachine(payload);

    if (result.error) {
      setDialogError(result.error);
    } else {
      setShowDialog(false);
      await loadData();
    }
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-medium text-[var(--text-heading)] text-lg">Fleet</h2>
        <Button
          onClick={handleAdd}
          className="bg-[var(--accent-emerald)] text-[var(--bg-void)] hover:bg-[var(--accent-green)]"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Machine
        </Button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4">
        <GlassCard className="px-4 py-3">
          <p className="text-[var(--text-muted)] text-xs">Total</p>
          <p className="mt-0.5 font-medium text-2xl text-[var(--text-heading)]">
            {machines.length}
          </p>
        </GlassCard>
        <GlassCard className="px-4 py-3">
          <p className="text-[var(--text-muted)] text-xs">Active</p>
          <p className="mt-0.5 font-medium text-2xl text-accent-green">{totalActive}</p>
        </GlassCard>
        <GlassCard className="px-4 py-3">
          <p className="text-[var(--text-muted)] text-xs">Inactive</p>
          <p className="mt-0.5 font-medium text-2xl text-[var(--text-muted)]">{totalInactive}</p>
        </GlassCard>
      </div>

      {/* Search + filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 z-10 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search machine ID, manufacturer, type…"
            className="w-full border-[var(--border-default)] bg-[var(--bg-secondary)] pl-9"
          />
        </div>
        <select
          value={filterDept}
          onChange={(e) => setFilterDept(e.target.value)}
          aria-label="Filter by department"
          className="rounded-md border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2 text-[var(--text-heading)] text-sm focus:border-[var(--accent-blue)] focus:outline-none"
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
          className="rounded-md border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2 text-[var(--text-heading)] text-sm focus:border-[var(--accent-blue)] focus:outline-none"
        >
          <option value="">All Sites</option>
          <option value="__none__">No site assigned</option>
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.site_code} — {s.name}
            </option>
          ))}
        </select>
        {(search || filterDept || filterSite) && (
          <button
            onClick={() => {
              setSearch('');
              setFilterDept('');
              setFilterSite('');
            }}
            className="px-3 py-2 text-[var(--text-muted)] text-sm transition-colors hover:text-[var(--text-heading)]"
          >
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      <GlassCard className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-[var(--border-default)] border-b">
                {[
                  'Machine Id / Name',
                  'Type / Bin Factor (Waste & Coal)',
                  'Manufacture',
                  'Starting SMR',
                  'Department',
                  'Site',
                  'Status',
                  'Actions',
                ].map((h) => (
                  <th
                    key={h}
                    scope="col"
                    className={`px-6 py-3 font-medium text-[var(--text-muted)] text-xs uppercase tracking-wider${h === 'Actions' ? 'text-right' : ''}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-default)]">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-[var(--text-muted)]">
                    Loading…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-[var(--text-muted)]">
                    {machines.length === 0
                      ? 'No machines registered. Add one to get started.'
                      : 'No machines match the current filters.'}
                  </td>
                </tr>
              ) : (
                filtered.map((m) => {
                  const isDumper = isArticulatedOrRigidDumper(m.machine_type);
                  const wasteFactor = m.bin_factor_waste ?? m.bin_factor;
                  const coalFactor = m.bin_factor_coal;
                  return (
                    <tr key={m.id} className="transition-colors hover:bg-[var(--bg-tertiary)]">
                      <td className="px-6 py-4 font-medium text-[var(--text-heading)] text-sm">
                        <div>{m.serial_number || m.name}</div>
                        {m.serial_number && m.name !== m.serial_number && (
                          <div className="font-normal text-[var(--text-muted)] text-xs">
                            {m.name}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className="font-mono text-[var(--text-muted)]">{m.machine_type}</span>
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
                      <td className="px-6 py-4 text-[var(--text-muted)] text-sm">
                        {m.manufacturer || '—'}
                      </td>
                      <td className="px-6 py-4 font-mono text-[var(--text-muted)] text-sm">
                        {m.starting_smr != null ? `${m.starting_smr} hrs` : '—'}
                      </td>
                      <td className="px-6 py-4 text-[var(--text-muted)] text-sm">
                        {m.department?.display_name || '—'}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {m.site ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--accent-blue)]/20 bg-[var(--accent-blue)]/10 px-2 py-0.5 font-medium text-[var(--accent-blue)] text-xs">
                            {m.site.site_code}
                            <span className="text-[var(--text-muted)]">{m.site.name}</span>
                          </span>
                        ) : (
                          <span className="text-[var(--text-muted)] text-xs">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col items-start gap-1">
                          <Badge
                            variant="outline"
                            className={
                              m.active
                                ? 'border-accent-green/20 bg-accent-green/10 text-accent-green'
                                : 'border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-muted)]'
                            }
                          >
                            {m.active ? 'Active' : 'Inactive'}
                          </Badge>
                          {m.report_exempt && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-accent-amber/20 bg-accent-amber/10 px-1.5 py-0.5 text-[10px] text-accent-amber">
                              Exempt
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => handleEdit(m)}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={saving}
                            className={
                              m.active
                                ? 'text-accent-red hover:text-accent-red/80'
                                : 'text-accent-green hover:text-accent-green'
                            }
                            onClick={() => setPendingToggle(m)}
                            title={m.active ? 'Deactivate' : 'Activate'}
                          >
                            <Power className="h-4 w-4" />
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
        {!loading && filtered.length > 0 && filtered.length < machines.length && (
          <p className="border-[var(--border-default)] border-t px-6 py-2 text-[var(--text-muted)] text-xs">
            Showing {filtered.length} of {machines.length} machines
          </p>
        )}
      </GlassCard>

      {/* Add / Edit dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto border-[var(--border-default)] bg-[var(--bg-primary)]">
          <DialogHeader>
            <DialogTitle>{editingMachine ? 'Edit Machine' : 'Add Machine'}</DialogTitle>
          </DialogHeader>
          <MachineForm
            machine={editingMachine}
            departments={departments}
            sites={sites}
            error={dialogError}
            saving={saving}
            onSubmit={handleSave}
            onCancel={() => setShowDialog(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Confirm deactivate / activate dialog */}
      <Dialog open={!!pendingToggle} onOpenChange={(open) => !open && setPendingToggle(null)}>
        <DialogContent className="max-w-sm border-[var(--border-default)] bg-[var(--bg-primary)]">
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

function MachineForm({
  machine,
  departments,
  sites,
  error,
  saving,
  onSubmit,
  onCancel,
}: {
  machine: Machine | null;
  departments: Department[];
  sites: Site[];
  error: string;
  saving: boolean;
  onSubmit: (_data: {
    name: string;
    machine_type: string;
    manufacturer: string;
    machine_id: string;
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
  const [machineType, setMachineType] = useState(machine?.machine_type || '');
  const [manufacturer, setManufacturer] = useState(machine?.manufacturer || '');
  const [machineId, setMachineId] = useState(machine?.serial_number || machine?.name || '');
  const [startingSmr, setStartingSmr] = useState(
    machine?.starting_smr != null ? machine.starting_smr.toString() : ''
  );
  const [name, setName] = useState(machine?.name || '');
  const [binFactorWaste, setBinFactorWaste] = useState(
    (machine?.bin_factor_waste ?? machine?.bin_factor)?.toString() || ''
  );
  const [binFactorCoal, setBinFactorCoal] = useState(machine?.bin_factor_coal?.toString() || '');
  const [departmentId, setDepartmentId] = useState(
    machine?.department_id || departments[0]?.id || ''
  );
  const [siteId, setSiteId] = useState(machine?.site_id || '');
  const [active, setActive] = useState(machine?.active ?? true);
  const [reportExempt, setReportExempt] = useState(machine?.report_exempt ?? false);

  const isDumperType = isArticulatedOrRigidDumper(machineType);

  const activeSites = sites.filter((s) => s.active || s.id === siteId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name: name || machineId,
      machine_type: machineType,
      manufacturer,
      machine_id: machineId,
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
          <label
            htmlFor="machineType"
            className="mb-2 block font-medium text-[var(--text-body)] text-sm"
          >
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
          <label
            htmlFor="manufacturer"
            className="mb-2 block font-medium text-[var(--text-body)] text-sm"
          >
            Machine Manufacture <span className="text-accent-red">*</span>
          </label>
          <Input
            id="manufacturer"
            value={manufacturer}
            onChange={(e) => setManufacturer(e.target.value)}
            placeholder="e.g. Caterpillar, Bell, Komatsu, Volvo"
            className="border-[var(--border-default)] bg-[var(--bg-secondary)]"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="machineId"
            className="mb-2 block font-medium text-[var(--text-body)] text-sm"
          >
            Machine Id <span className="text-accent-red">*</span>
          </label>
          <Input
            id="machineId"
            value={machineId}
            onChange={(e) => {
              setMachineId(e.target.value);
              if (!machine) setName(e.target.value);
            }}
            placeholder="e.g. ADT-001, RDT-104, EX-02"
            className="border-[var(--border-default)] bg-[var(--bg-secondary)] font-mono"
            required
          />
        </div>

        <div>
          <label
            htmlFor="startingSmr"
            className="mb-2 block font-medium text-[var(--text-body)] text-sm"
          >
            Starting SMR on Site <span className="text-accent-red">*</span>
          </label>
          <Input
            id="startingSmr"
            type="number"
            step="0.1"
            min="0"
            value={startingSmr}
            onChange={(e) => setStartingSmr(e.target.value)}
            placeholder="e.g. 1250.0"
            className="border-[var(--border-default)] bg-[var(--bg-secondary)] font-mono"
            required
          />
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
          <label className="mb-2 block font-medium text-[var(--text-body)] text-sm">
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
          <label className="mb-2 block font-medium text-[var(--text-body)] text-sm">Site</label>
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
          {saving ? 'Saving…' : machine ? 'Update' : 'Add Machine'}
        </Button>
      </div>
    </form>
  );
}
