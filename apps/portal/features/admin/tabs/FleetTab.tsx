"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { createBrowserSupabaseClient } from "@repo/supabase/client";
import { GlassCard } from "@repo/ui/GlassCard";
import { Edit2, Plus, Power, Search } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import { Badge } from "@repo/ui/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { Input } from "@repo/ui/components/ui/input";
import { logError } from "@/lib/errors/error-logger";
import { adminAddMachine, adminUpdateMachine } from "../actions/fleet";

interface Machine {
  id: string;
  name: string;
  machine_type: string;
  serial_number: string | null;
  bin_factor: number | null;
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

const DUMPER_TYPES = [
  "articulated dumper",
  "rigid dumper",
  "dump truck",
  "hauler",
];

export function FleetTab() {
  const supabase = createBrowserSupabaseClient();
  const [machines, setMachines] = useState<Machine[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingMachine, setEditingMachine] = useState<Machine | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dialogError, setDialogError] = useState("");

  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [filterSite, setFilterSite] = useState("");
  const [pendingToggle, setPendingToggle] = useState<Machine | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [{ data: machineData }, { data: deptData }, { data: siteData }] =
      await Promise.all([
        supabase
          .from("machines")
          .select(
            "id, name, machine_type, serial_number, bin_factor, active, report_exempt, department_id, site_id, created_at, department:departments(display_name), site:sites(name, site_code)",
          )
          .order("name"),
        supabase
          .from("departments")
          .select("id, display_name")
          .order("display_name"),
        supabase
          .from("sites")
          .select("id, name, site_code, active")
          .order("name"),
      ]);
    if (machineData) {
      const normalised = machineData.map((m) => ({
        ...m,
        department: Array.isArray(m.department)
          ? (m.department[0] ?? null)
          : m.department,
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
        (m.serial_number ?? "").toLowerCase().includes(q);
      const matchDept = !filterDept || m.department_id === filterDept;
      const matchSite =
        !filterSite ||
        (filterSite === "__none__" ? !m.site_id : m.site_id === filterSite);
      return matchSearch && matchDept && matchSite;
    });
  }, [machines, search, filterDept, filterSite]);

  const totalActive = machines.filter((m) => m.active).length;
  const totalInactive = machines.length - totalActive;

  const handleAdd = () => {
    setEditingMachine(null);
    setDialogError("");
    setShowDialog(true);
  };

  const handleEdit = (machine: Machine) => {
    setEditingMachine(machine);
    setDialogError("");
    setShowDialog(true);
  };

  const handleConfirmToggle = async () => {
    if (!pendingToggle) return;
    setSaving(true);
    const result = await adminUpdateMachine(pendingToggle.id, {
      active: !pendingToggle.active,
    });
    if (result.error) {
      logError(new Error(result.error), { context: "fleet_toggle_active" });
    }
    setPendingToggle(null);
    setSaving(false);
    await loadData();
  };

  const handleSave = async (data: {
    name: string;
    machine_type: string;
    serial_number: string;
    bin_factor: string;
    department_id: string;
    site_id: string;
    active: boolean;
    report_exempt: boolean;
  }) => {
    setSaving(true);
    setDialogError("");

    const payload = {
      name: data.name,
      machine_type: data.machine_type,
      serial_number: data.serial_number || undefined,
      bin_factor: data.bin_factor ? parseFloat(data.bin_factor) : null,
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
        <h2 className="text-lg font-medium text-[var(--text-heading)]">
          Fleet
        </h2>
        <Button
          onClick={handleAdd}
          className="bg-[var(--accent-emerald)] hover:bg-[var(--accent-green)] text-[var(--bg-void)]"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Machine
        </Button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4">
        <GlassCard className="py-3 px-4">
          <p className="text-[var(--text-muted)] text-xs">Total</p>
          <p className="text-2xl font-medium text-[var(--text-heading)] mt-0.5">
            {machines.length}
          </p>
        </GlassCard>
        <GlassCard className="py-3 px-4">
          <p className="text-[var(--text-muted)] text-xs">Active</p>
          <p className="text-2xl font-medium text-accent-green mt-0.5">
            {totalActive}
          </p>
        </GlassCard>
        <GlassCard className="py-3 px-4">
          <p className="text-[var(--text-muted)] text-xs">Inactive</p>
          <p className="text-2xl font-medium text-[var(--text-muted)] mt-0.5">
            {totalInactive}
          </p>
        </GlassCard>
      </div>

      {/* Search + filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, type, serial…"
            className="pl-9 bg-[var(--bg-secondary)] border-[var(--border-default)]"
          />
        </div>
        <select
          value={filterDept}
          onChange={(e) => setFilterDept(e.target.value)}
          aria-label="Filter by department"
          className="px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-md text-[var(--text-heading)] text-sm focus:outline-none focus:border-[var(--accent-blue)]"
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
          className="px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-md text-[var(--text-heading)] text-sm focus:outline-none focus:border-[var(--accent-blue)]"
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
              setSearch("");
              setFilterDept("");
              setFilterSite("");
            }}
            className="px-3 py-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-heading)] transition-colors"
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
              <tr className="border-b border-[var(--border-default)]">
                {[
                  "Name",
                  "Type / Bin Factor",
                  "Serial No",
                  "Department",
                  "Site",
                  "Status",
                  "Exempt",
                  "Actions",
                ].map((h) => (
                  <th
                    key={h}
                    scope="col"
                    className={`px-6 py-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider${h === "Actions" ? " text-right" : ""}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-default)]">
              {loading ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-6 py-12 text-center text-[var(--text-muted)]"
                  >
                    Loading…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-6 py-12 text-center text-[var(--text-muted)]"
                  >
                    {machines.length === 0
                      ? "No machines registered. Add one to get started."
                      : "No machines match the current filters."}
                  </td>
                </tr>
              ) : (
                filtered.map((m) => {
                  const isDumper = DUMPER_TYPES.some((t) =>
                    m.machine_type.toLowerCase().includes(t),
                  );
                  return (
                    <tr
                      key={m.id}
                      className="hover:bg-[var(--bg-tertiary)] transition-colors"
                    >
                      <td className="px-6 py-4 text-[var(--text-heading)] text-sm font-medium">
                        {m.name}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className="text-[var(--text-muted)] font-mono">
                          {m.machine_type}
                        </span>
                        {isDumper && m.bin_factor != null && (
                          <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] border border-[var(--accent-blue)]/20 font-mono">
                            {m.bin_factor} BCM
                          </span>
                        )}
                        {isDumper && m.bin_factor == null && (
                          <span className="ml-2 text-[10px] text-accent-amber">
                            ⚠ no bin factor
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-[var(--text-muted)] text-sm">
                        {m.serial_number || "—"}
                      </td>
                      <td className="px-6 py-4 text-[var(--text-muted)] text-sm">
                        {m.department?.display_name || "—"}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {m.site ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--accent-cyan)]/10 text-[var(--accent-cyan)] border border-[var(--accent-cyan)]/20">
                            {m.site.site_code}
                            <span className="text-[var(--text-muted)]">
                              {m.site.name}
                            </span>
                          </span>
                        ) : (
                          <span className="text-[var(--text-muted)] text-xs">
                            —
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <Badge
                          variant="outline"
                          className={
                            m.active
                              ? "bg-accent-green/10 text-accent-green border-accent-green/20"
                              : "bg-[var(--bg-secondary)] text-[var(--text-muted)] border-[var(--border-default)]"
                          }
                        >
                          {m.active ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        {m.report_exempt ? (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-accent-amber/10 text-accent-amber border border-accent-amber/20">
                            Exempt
                          </span>
                        ) : (
                          <span className="text-[var(--text-muted)] text-xs">
                            —
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex gap-2 justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(m)}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={saving}
                            className={
                              m.active
                                ? "text-accent-red hover:text-accent-red/80"
                                : "text-accent-green hover:text-accent-green"
                            }
                            onClick={() => setPendingToggle(m)}
                            title={m.active ? "Deactivate" : "Activate"}
                          >
                            <Power className="w-4 h-4" />
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
        {!loading &&
          filtered.length > 0 &&
          filtered.length < machines.length && (
            <p className="px-6 py-2 text-xs text-[var(--text-muted)] border-t border-[var(--border-default)]">
              Showing {filtered.length} of {machines.length} machines
            </p>
          )}
      </GlassCard>

      {/* Add / Edit dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="bg-[var(--bg-primary)] border-[var(--border-default)] max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingMachine ? "Edit Machine" : "Add Machine"}
            </DialogTitle>
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
      <Dialog
        open={!!pendingToggle}
        onOpenChange={(open) => !open && setPendingToggle(null)}
      >
        <DialogContent className="bg-[var(--bg-primary)] border-[var(--border-default)] max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {pendingToggle?.active
                ? "Deactivate Machine?"
                : "Activate Machine?"}
            </DialogTitle>
          </DialogHeader>
          <p className="text-[var(--text-body)] text-sm">
            {pendingToggle?.active
              ? `"${pendingToggle?.name}" will be removed from all active dropdowns and marked inactive. This affects shift entry forms immediately.`
              : `"${pendingToggle?.name}" will become available again in all shift entry forms.`}
          </p>
          <div className="flex gap-2 justify-end pt-2">
            <Button
              variant="outline"
              onClick={() => setPendingToggle(null)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              disabled={saving}
              className={
                pendingToggle?.active
                  ? "bg-accent-red hover:bg-accent-red/90 text-white"
                  : "bg-[var(--accent-emerald)] hover:bg-[var(--accent-green)] text-[var(--bg-void)]"
              }
              onClick={handleConfirmToggle}
            >
              {saving
                ? "Saving…"
                : pendingToggle?.active
                  ? "Deactivate"
                  : "Activate"}
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
    serial_number: string;
    bin_factor: string;
    department_id: string;
    site_id: string;
    active: boolean;
    report_exempt: boolean;
  }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(machine?.name || "");
  const [machineType, setMachineType] = useState(machine?.machine_type || "");
  const [serialNumber, setSerialNumber] = useState(
    machine?.serial_number || "",
  );
  const [binFactor, setBinFactor] = useState(
    machine?.bin_factor?.toString() || "",
  );
  const [departmentId, setDepartmentId] = useState(
    machine?.department_id || "",
  );
  const [siteId, setSiteId] = useState(machine?.site_id || "");
  const [active, setActive] = useState(machine?.active ?? true);
  const [reportExempt, setReportExempt] = useState(
    machine?.report_exempt ?? false,
  );

  const isDumperType = DUMPER_TYPES.some((t) =>
    machineType.toLowerCase().includes(t),
  );

  const activeSites = sites.filter((s) => s.active || s.id === siteId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name,
      machine_type: machineType,
      serial_number: serialNumber,
      bin_factor: binFactor,
      department_id: departmentId,
      site_id: siteId,
      active,
      report_exempt: reportExempt,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-[var(--text-body)] mb-2">
          Name <span className="text-accent-red">*</span>
        </label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Haul Truck 3"
          className="bg-[var(--bg-secondary)] border-[var(--border-default)]"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-[var(--text-body)] mb-2">
          Type <span className="text-accent-red">*</span>
        </label>
        <Input
          value={machineType}
          onChange={(e) => setMachineType(e.target.value)}
          placeholder="e.g. dump_truck, excavator, dozer"
          className="bg-[var(--bg-secondary)] border-[var(--border-default)]"
          required
        />
      </div>

      {isDumperType && (
        <div>
          <label className="block text-sm font-medium text-[var(--text-body)] mb-2">
            Bin Factor (BCM / load) <span className="text-accent-red">*</span>
          </label>
          <Input
            type="number"
            step="0.1"
            min="0.1"
            value={binFactor}
            onChange={(e) => setBinFactor(e.target.value)}
            placeholder="e.g. 25.5"
            className="bg-[var(--bg-secondary)] border-[var(--border-default)]"
            required
          />
          <p className="text-[var(--text-muted)] text-xs mt-1">
            Bank Cubic Meters per truckload — used for BCM/hour calculations.
          </p>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-[var(--text-body)] mb-2">
          Serial Number
        </label>
        <Input
          value={serialNumber}
          onChange={(e) => setSerialNumber(e.target.value)}
          placeholder="e.g. HT-2024-003"
          className="bg-[var(--bg-secondary)] border-[var(--border-default)]"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-[var(--text-body)] mb-2">
          Department <span className="text-accent-red">*</span>
        </label>
        <select
          value={departmentId}
          onChange={(e) => setDepartmentId(e.target.value)}
          aria-label="Department"
          className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-md text-[var(--text-heading)] text-sm focus:outline-none focus:border-[var(--accent-blue)]"
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
        <label className="block text-sm font-medium text-[var(--text-body)] mb-2">
          Site
        </label>
        <select
          value={siteId}
          onChange={(e) => setSiteId(e.target.value)}
          aria-label="Site"
          className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-md text-[var(--text-heading)] text-sm focus:outline-none focus:border-[var(--accent-blue)]"
        >
          <option value="">No site assigned</option>
          {activeSites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.site_code} — {s.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          id="active"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
          className="w-4 h-4 accent-[var(--accent-emerald)]"
        />
        <label
          htmlFor="active"
          className="text-sm font-medium text-[var(--text-body)]"
        >
          Active
        </label>
      </div>

      <div className="flex items-center gap-3 p-3 rounded-lg border border-accent-amber/20 bg-accent-amber/5">
        <input
          type="checkbox"
          id="report_exempt"
          checked={reportExempt}
          onChange={(e) => setReportExempt(e.target.checked)}
          className="w-4 h-4 accent-amber-400"
        />
        <div>
          <label
            htmlFor="report_exempt"
            className="text-sm font-medium text-accent-amber cursor-pointer"
          >
            Exempt from shift reporting
          </label>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            When checked, control room users will not be required to log this
            machine before generating reports.
          </p>
        </div>
      </div>

      {error && (
        <p className="text-sm text-accent-red bg-accent-red/10 border border-accent-red/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex gap-2 justify-end pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={saving}
          className="bg-[var(--accent-emerald)] hover:bg-[var(--accent-green)] text-[var(--bg-void)]"
        >
          {saving ? "Saving…" : machine ? "Update" : "Add Machine"}
        </Button>
      </div>
    </form>
  );
}
